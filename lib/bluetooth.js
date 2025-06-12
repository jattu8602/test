// Bluetooth Web API utilities for ESP32 communication
// Based on the ESP32 firmware BLE configuration

export const ESP32_CONFIG = {
  SERVICE_UUID: '12345678-1234-1234-1234-123456789abc',
  CHARACTERISTICS: {
    CLASS_DATA: '12345678-1234-1234-1234-123456789abd',
    STORAGE_INFO: '12345678-1234-1234-1234-123456789abe',
    ATTENDANCE_DATA: '12345678-1234-1234-1234-123456789abf',
    COMMAND: '12345678-1234-1234-1234-123456789ac0',
  },
  DEVICE_NAME: 'ESP32-Attendance',
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 2000, // 2 seconds
}

// Check for required browser permissions
export const checkBluetoothPermissions = async () => {
  if (!('bluetooth' in navigator)) {
    return { supported: false, reason: 'Web Bluetooth API not supported' }
  }

  try {
    // Check if permissions are already granted
    const permission = await navigator.permissions.query({ name: 'bluetooth' })

    return {
      supported: true,
      permission: permission.state, // 'granted', 'denied', or 'prompt'
      canRequest: permission.state !== 'denied',
    }
  } catch (error) {
    console.warn('Could not check bluetooth permissions:', error)
    return {
      supported: true,
      permission: 'unknown',
      canRequest: true,
    }
  }
}

class BluetoothManager {
  constructor() {
    this.device = null
    this.server = null
    this.service = null
    this.characteristics = {}
    this.isConnected = false
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.onConnectionChange = null
    this.onDataReceived = null
    this.onError = null
    this.connectionTimeout = null
    this.notificationBuffers = {} // Buffer for handling chunked notifications
    this.pendingCommands = new Map() // Track pending command responses
    this.notificationBuffer = '' // Buffer for handling chunked notifications
    this.commandCallbacks = new Map() // Track command callbacks
  }

  // Check if Web Bluetooth is supported
  isSupported() {
    return 'bluetooth' in navigator && 'serviceWorker' in navigator
  }

  // Enhanced device scanning with filters
  async scanDevices(options = {}) {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser')
    }

    const permissions = await checkBluetoothPermissions()
    if (!permissions.supported) {
      throw new Error(permissions.reason)
    }

    if (permissions.permission === 'denied') {
      throw new Error(
        'Bluetooth permission denied. Please enable in browser settings.'
      )
    }

    try {
      const scanOptions = {
        filters: [
          { name: ESP32_CONFIG.DEVICE_NAME },
          { namePrefix: 'ESP32' },
          { services: [ESP32_CONFIG.SERVICE_UUID] },
        ],
        optionalServices: [ESP32_CONFIG.SERVICE_UUID],
        acceptAllDevices: false,
        ...options,
      }

      console.log('Scanning for devices with options:', scanOptions)
      const device = await navigator.bluetooth.requestDevice(scanOptions)

      console.log('Found device:', device.name, device.id)
      return device
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new Error(
          'No ESP32 device found. Make sure the device is powered on and in pairing mode.'
        )
      }
      if (error.name === 'SecurityError') {
        throw new Error(
          'Bluetooth access denied. Please use HTTPS and enable permissions.'
        )
      }
      console.error('Error scanning for devices:', error)
      throw error
    }
  }

  // Enhanced connection with timeout and retry logic
  async connect(device = null, retryOnFailure = true) {
    if (this.isConnecting) {
      throw new Error('Already attempting to connect')
    }

    if (this.isConnected) {
      console.log('Already connected')
      return true
    }

    try {
      this.isConnecting = true

      if (!device) {
        device = await this.scanDevices()
      }

      this.device = device

      // Add disconnect listener
      device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect()
      })

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.isConnecting) {
          this.handleConnectionTimeout()
        }
      }, ESP32_CONFIG.CONNECTION_TIMEOUT)

      console.log('Connecting to GATT Server...')
      this.server = await device.gatt.connect()

      console.log('Getting service...')
      this.service = await this.server.getPrimaryService(
        ESP32_CONFIG.SERVICE_UUID
      )

      console.log('Setting up characteristics...')
      await this.setupCharacteristics()

      // Clear timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }

      this.isConnected = true
      this.isConnecting = false
      this.reconnectAttempts = 0

      if (this.onConnectionChange) {
        this.onConnectionChange(true)
      }

      console.log('✅ Connected to ESP32 successfully!')
      return true
    } catch (error) {
      this.isConnecting = false

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }

      console.error('Connection failed:', error)

      // Auto-retry connection if enabled
      if (
        retryOnFailure &&
        this.reconnectAttempts < ESP32_CONFIG.RECONNECT_ATTEMPTS
      ) {
        this.reconnectAttempts++
        console.log(
          `Retrying connection (${this.reconnectAttempts}/${ESP32_CONFIG.RECONNECT_ATTEMPTS})...`
        )

        await new Promise((resolve) =>
          setTimeout(resolve, ESP32_CONFIG.RECONNECT_DELAY)
        )
        return this.connect(device, retryOnFailure)
      }

      this.handleDisconnect()
      throw error
    }
  }

  // Handle connection timeout
  handleConnectionTimeout() {
    console.error('Connection timeout')
    this.isConnecting = false
    this.handleDisconnect()

    if (this.onError) {
      this.onError(new Error('Connection timeout'))
    }
  }

  // Enhanced characteristic setup with better error handling
  async setupCharacteristics() {
    const charUUIDs = ESP32_CONFIG.CHARACTERISTICS
    const setupPromises = []

    for (const [name, uuid] of Object.entries(charUUIDs)) {
      setupPromises.push(this.setupCharacteristic(name, uuid))
    }

    const results = await Promise.allSettled(setupPromises)

    // Check if any critical characteristics failed
    const failed = results.filter((result) => result.status === 'rejected')
    if (failed.length > 0) {
      console.warn('Some characteristics failed to setup:', failed)
    }

    const successful = results.filter((result) => result.status === 'fulfilled')
    console.log(
      `Successfully setup ${successful.length}/${results.length} characteristics`
    )
  }

  async setupCharacteristic(name, uuid) {
    try {
      const characteristic = await this.service.getCharacteristic(uuid)
      this.characteristics[name] = characteristic

      // Setup notifications for characteristics that support it
      if (characteristic.properties.notify) {
        await characteristic.startNotifications()
        characteristic.addEventListener(
          'characteristicvaluechanged',
          (event) => {
            this.handleNotification(event)
          }
        )
        console.log(`✅ Notifications enabled for ${name}`)
      }

      console.log(`✅ Characteristic ${name} setup complete`)
      return true
    } catch (error) {
      console.warn(`❌ Could not setup characteristic ${name}:`, error)
      throw error
    }
  }

  // Enhanced notification handling with buffering
  handleNotification(event) {
    const value = event.target.value
    const decoder = new TextDecoder()
    const chunk = decoder.decode(value)

    console.log('📡 BLE notification received, chunk size:', chunk.length)

    // Accumulate chunks in buffer
    this.notificationBuffer += chunk

    // Enhanced detection for complete JSON objects
    const buffer = this.notificationBuffer.trim()

    // Check for complete JSON structures
    let isComplete = false
    if (buffer.startsWith('{')) {
      // Count braces to detect complete JSON objects
      let braceCount = 0
      let inString = false
      let escaped = false

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]

        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (char === '"') {
          inString = !inString
          continue
        }

        if (!inString) {
          if (char === '{') braceCount++
          else if (char === '}') braceCount--

          // Complete object found
          if (braceCount === 0 && i > 0) {
            isComplete = true
            break
          }
        }
      }
    } else if (buffer.startsWith('[')) {
      // Similar logic for arrays
      let bracketCount = 0
      let inString = false
      let escaped = false

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]

        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (char === '"') {
          inString = !inString
          continue
        }

        if (!inString) {
          if (char === '[') bracketCount++
          else if (char === ']') bracketCount--

          if (bracketCount === 0 && i > 0) {
            isComplete = true
            break
          }
        }
      }
    }

    // Process complete messages or timeout
    if (isComplete || buffer.length > 2000) {
      // Process if complete or buffer too large
      if (buffer.length > 2000) {
        console.log(
          '🔄 Processing large buffer due to size limit:',
          buffer.length
        )
      }

      console.log('📦 Processing complete message, size:', buffer.length)

      try {
        // Clean and parse the complete message
        const cleanedBuffer = buffer
          .replace(/^\s+|\s+$/g, '') // trim
          .replace(/\r\n/g, '\n') // normalize line endings
          .replace(/\n\s*\n/g, '\n') // remove empty lines

        let parsedData
        try {
          parsedData = JSON.parse(cleanedBuffer)
          console.log('✅ Successfully parsed complete JSON message')
        } catch (parseError) {
          console.warn(
            '⚠️ JSON parse failed, trying cleanup...',
            parseError.message
          )

          // Advanced cleanup for truncated JSON
          let fixedBuffer = cleanedBuffer

          // Fix common issues
          if (fixedBuffer.startsWith('{') && !fixedBuffer.endsWith('}')) {
            const openBraces = (fixedBuffer.match(/\{/g) || []).length
            const closeBraces = (fixedBuffer.match(/\}/g) || []).length
            if (openBraces > closeBraces) {
              fixedBuffer += '}'.repeat(openBraces - closeBraces)
              console.log('🔧 Added missing closing braces')
            }
          }

          // Try parsing the fixed buffer
          try {
            parsedData = JSON.parse(fixedBuffer)
            console.log('✅ Successfully parsed fixed JSON')
          } catch (secondError) {
            console.error(
              '❌ JSON parsing failed after cleanup:',
              secondError.message
            )
            this.triggerDataReceived(
              'ERROR',
              `JSON Parse Error: ${secondError.message}`
            )
            this.notificationBuffer = ''
            return
          }
        }

        // Determine data type and trigger appropriate handler
        if (parsedData && typeof parsedData === 'object') {
          if (
            parsedData.device_name !== undefined ||
            parsedData.classes_count !== undefined ||
            parsedData.command === 'get_status'
          ) {
            console.log('📊 Device status data received:', parsedData)

            // Handle as device status response - check for pending commands first
            if (this.pendingCommands.has('get_status')) {
              const { resolve } = this.pendingCommands.get('get_status')
              this.pendingCommands.delete('get_status')
              resolve(parsedData)
            } else {
              // Fallback to general data received trigger
              this.triggerDataReceived('COMMAND', parsedData)
            }
          } else if (
            Array.isArray(parsedData) ||
            (typeof parsedData === 'object' &&
              Object.keys(parsedData).length > 0)
          ) {
            console.log('📚 Class/Attendance data received')

            // Check if it's attendance data (has class IDs as keys with records)
            const isAttendanceData = Object.values(parsedData).some(
              (value) =>
                value &&
                typeof value === 'object' &&
                value.records &&
                Array.isArray(value.records)
            )

            if (isAttendanceData) {
              console.log(
                '📋 Attendance data detected, size:',
                Object.keys(parsedData).length,
                'classes'
              )

              // For attendance data, try command callbacks first, then fallback
              let callbackFound = false
              for (const [
                commandId,
                callback,
              ] of this.commandCallbacks.entries()) {
                try {
                  console.log(
                    '📋 Calling attendance callback for command:',
                    commandId
                  )
                  callback(parsedData)
                  callbackFound = true
                  break
                } catch (error) {
                  console.error('Error in command callback:', error)
                }
              }

              if (!callbackFound) {
                console.log('📋 No callback found, triggering data received')
                this.triggerDataReceived('ATTENDANCE_DATA', parsedData)
              }
            } else {
              console.log('📚 Class data detected')
              this.triggerDataReceived('CLASS_DATA', parsedData)
            }
          }
        }

        // Clear the buffer after successful processing
        this.notificationBuffer = ''
      } catch (error) {
        console.error('❌ Error processing notification:', error)
        this.triggerDataReceived('ERROR', `Processing Error: ${error.message}`)
        this.notificationBuffer = ''
      }
    } else {
      console.log('📦 Buffering incomplete data, current size:', buffer.length)
    }
  }

  // Enhanced disconnect with cleanup
  async disconnect() {
    try {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout)
        this.connectionTimeout = null
      }

      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect()
      }
    } catch (error) {
      console.error('Error during disconnect:', error)
    } finally {
      this.handleDisconnect()
    }
  }

  // Enhanced disconnect handler
  handleDisconnect() {
    this.isConnected = false
    this.isConnecting = false
    this.device = null
    this.server = null
    this.service = null
    this.characteristics = {}
    this.notificationBuffers = {} // Clear notification buffers

    // Reject all pending commands
    for (const [command, { reject }] of this.pendingCommands) {
      reject(new Error('Disconnected while waiting for response'))
    }
    this.pendingCommands.clear()

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (this.onConnectionChange) {
      this.onConnectionChange(false)
    }

    console.log('📱 Disconnected from ESP32')
  }

  // Enhanced write with chunking and retry logic
  async writeCharacteristic(characteristicName, data, retries = 2) {
    if (!this.isConnected || !this.characteristics[characteristicName]) {
      throw new Error(
        `Not connected or characteristic ${characteristicName} not available`
      )
    }

    const encoder = new TextEncoder()
    const encodedData = encoder.encode(data)
    const chunkSize = 20 // Match ESP32's actual BLE MTU limitation

    console.log(`🔧 Writing to ${characteristicName}:`)
    console.log(`📏 Total data size: ${encodedData.length} bytes`)
    console.log(`✂️ Chunk size: ${chunkSize} bytes`)
    console.log(
      `📦 Number of chunks: ${Math.ceil(encodedData.length / chunkSize)}`
    )

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (encodedData.length <= chunkSize) {
          // Send in one piece
          console.log(`📤 Sending single chunk: ${encodedData.length} bytes`)
          console.log(
            `📝 Chunk content: "${new TextDecoder().decode(encodedData)}"`
          )
          await this.characteristics[characteristicName].writeValue(encodedData)
        } else {
          // Send in chunks with longer delays
          for (let i = 0; i < encodedData.length; i += chunkSize) {
            const chunk = encodedData.slice(i, i + chunkSize)
            const chunkNumber = Math.floor(i / chunkSize) + 1
            const totalChunks = Math.ceil(encodedData.length / chunkSize)

            console.log(
              `📤 Sending chunk ${chunkNumber}/${totalChunks}: ${chunk.length} bytes`
            )
            console.log(
              `📝 Chunk content: "${new TextDecoder().decode(chunk)}"`
            )

            await this.characteristics[characteristicName].writeValue(chunk)

            // Longer delay between chunks to prevent corruption
            if (i + chunkSize < encodedData.length) {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
        }

        console.log(
          `✅ Written to ${characteristicName}: ${data.length} characters`
        )
        return true
      } catch (error) {
        console.error(`❌ Write attempt ${attempt + 1} failed:`, error)

        if (attempt === retries) {
          throw error
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  // Enhanced read with better error handling and validation
  async readCharacteristic(characteristicName, timeout = 15000) {
    if (!this.isConnected || !this.characteristics[characteristicName]) {
      throw new Error(
        `Not connected or characteristic ${characteristicName} not available`
      )
    }

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(
          `⏰ Read timeout for ${characteristicName} after ${timeout}ms`
        )
        reject(new Error(`Read timeout for ${characteristicName}`))
      }, timeout)

      try {
        console.log(`🔍 Reading from ${characteristicName}...`)

        // Clear any existing buffer for this characteristic
        if (
          this.notificationBuffers &&
          this.notificationBuffers[characteristicName]
        ) {
          this.notificationBuffers[characteristicName] = ''
          console.log(`🧹 Cleared existing buffer for ${characteristicName}`)
        }

        const startTime = Date.now()
        const value = await this.characteristics[characteristicName].readValue()
        const readTime = Date.now() - startTime

        clearTimeout(timeoutId)

        const decoder = new TextDecoder()
        const result = decoder.decode(value)

        console.log(
          `✅ Read from ${characteristicName} completed in ${readTime}ms`
        )
        console.log(`📏 Response size: ${result.length} characters`)
        console.log(
          `📝 Data preview: ${result.substring(0, 100)}${
            result.length > 100 ? '...' : ''
          }`
        )

        // Validate the result
        if (!result || result.trim().length === 0) {
          throw new Error(`Empty response from ${characteristicName}`)
        }

        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        console.error(`❌ Error reading from ${characteristicName}:`, error)
        console.error(`❌ Error type: ${error.constructor.name}`)
        reject(error)
      }
    })
  }

  // Sync class data to ESP32 with enhanced logging
  async syncClassData(classesData) {
    const jsonData = JSON.stringify(classesData) + '\n' // Add delimiter
    console.log('🚀 Syncing class data:')
    console.log(`📊 Classes: ${classesData.length}`)
    console.log(
      `👥 Total students: ${classesData.reduce(
        (total, cls) => total + cls.students.length,
        0
      )}`
    )
    console.log(`📦 Data length: ${jsonData.length} characters`)
    console.log(`📝 Data preview: ${jsonData.substring(0, 150)}...`)
    console.log(`🔚 Ends with newline: ${jsonData.endsWith('\n')}`)

    const startTime = Date.now()
    const result = await this.writeCharacteristic('CLASS_DATA', jsonData)
    const syncTime = Date.now() - startTime

    console.log(`✅ Sync completed in ${syncTime}ms`)
    return result
  }

  // Get storage info from ESP32 with improved error handling
  async getStorageInfo() {
    try {
      console.log('📊 Requesting storage info from ESP32...')
      const data = await this.readCharacteristic('STORAGE_INFO')

      // Clean the data before parsing
      const cleanedData = data.replace(/[\r\n]+/g, '').trim()

      if (!cleanedData) {
        throw new Error('Received empty storage info data')
      }

      console.log(`🧹 Cleaned storage data: ${cleanedData}`)

      const parsedData = JSON.parse(cleanedData)
      console.log('✅ Successfully parsed storage info:', parsedData)
      return parsedData
    } catch (error) {
      console.error('❌ Error getting storage info:', error)
      throw new Error(`Storage info error: ${error.message}`)
    }
  }

  // Get attendance data from ESP32 with improved error handling
  async getESP32AttendanceData() {
    if (!this.isConnected()) {
      throw new Error('ESP32 not connected')
    }

    try {
      console.log('📥 Requesting attendance data from ESP32...')

      // Clear any existing buffer data
      this.notificationBuffer = ''

      // Set up a promise to handle the response
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.cleanupCommandTracking(commandId)
          reject(new Error('Timeout: No response from ESP32 (15s)'))
        }, 15000) // 15 second timeout for large data

        const commandId = this.generateCommandId()

        // Enhanced response handler for large attendance data
        const responseHandler = (data) => {
          console.log(
            '📥 Raw attendance response received:',
            typeof data,
            data.length || 'N/A'
          )

          try {
            let cleanedData = data

            // Handle string data
            if (typeof data === 'string') {
              // Clean the string more thoroughly
              cleanedData = data
                .replace(/^\s+|\s+$/g, '') // trim
                .replace(/\r\n/g, '\n') // normalize line endings
                .replace(/\n+/g, ' ') // replace newlines with spaces
                .replace(/\s+/g, ' ') // normalize whitespace
                .trim()

              console.log('🧹 Cleaned data length:', cleanedData.length)
              console.log(
                '🧹 Data preview (first 200 chars):',
                cleanedData.substring(0, 200)
              )
              console.log(
                '🧹 Data ending (last 50 chars):',
                cleanedData.substring(Math.max(0, cleanedData.length - 50))
              )
            }

            // Try to parse the cleaned data
            let parsedData
            if (typeof cleanedData === 'string') {
              // Validate JSON structure before parsing
              if (
                !cleanedData.startsWith('{') &&
                !cleanedData.startsWith('[')
              ) {
                throw new Error(
                  `Invalid JSON start: "${cleanedData.substring(0, 10)}..."`
                )
              }

              const lastChar = cleanedData.charAt(cleanedData.length - 1)
              if (lastChar !== '}' && lastChar !== ']') {
                console.warn(
                  '⚠️ JSON might be incomplete, last char:',
                  lastChar
                )

                // Try to fix common truncation issues
                if (cleanedData.includes('{') && !cleanedData.endsWith('}')) {
                  // Count braces to see if we can auto-fix
                  const openBraces = (cleanedData.match(/\{/g) || []).length
                  const closeBraces = (cleanedData.match(/\}/g) || []).length

                  if (openBraces > closeBraces) {
                    const missingBraces = openBraces - closeBraces
                    cleanedData += '}'.repeat(missingBraces)
                    console.log(
                      '🔧 Auto-fixed JSON with',
                      missingBraces,
                      'missing braces'
                    )
                  }
                }
              }

              try {
                parsedData = JSON.parse(cleanedData)
                console.log('✅ Successfully parsed attendance data')
                console.log('📊 Data keys:', Object.keys(parsedData))
              } catch (parseError) {
                console.error('❌ JSON parse error:', parseError.message)
                console.error(
                  '❌ Error position:',
                  parseError.message.match(/position (\d+)/)?.[1] || 'unknown'
                )

                // Log the problematic area
                const pos =
                  parseInt(parseError.message.match(/position (\d+)/)?.[1]) || 0
                if (pos > 0) {
                  const start = Math.max(0, pos - 50)
                  const end = Math.min(cleanedData.length, pos + 50)
                  console.error(
                    '❌ Context around error:',
                    cleanedData.substring(start, end)
                  )
                }

                throw new Error(`JSON parsing failed: ${parseError.message}`)
              }
            } else {
              parsedData = cleanedData
            }

            // Validate the parsed data structure
            if (!parsedData || typeof parsedData !== 'object') {
              throw new Error('Invalid attendance data format: not an object')
            }

            // Check if it's empty
            const keys = Object.keys(parsedData)
            if (keys.length === 0) {
              console.log('⚠️ No attendance data found on ESP32')
              parsedData = {}
            } else {
              console.log(`✅ Received attendance for ${keys.length} classes`)

              // Validate each class data
              for (const [classId, classData] of Object.entries(parsedData)) {
                if (!classData.records || !Array.isArray(classData.records)) {
                  console.warn(
                    `⚠️ Invalid class data for ${classId}:`,
                    classData
                  )
                }
              }
            }

            clearTimeout(timeoutId)
            this.cleanupCommandTracking(commandId)
            resolve(parsedData)
          } catch (error) {
            console.error('❌ Error processing attendance data:', error)
            clearTimeout(timeoutId)
            this.cleanupCommandTracking(commandId)
            reject(
              new Error(`Attendance data processing failed: ${error.message}`)
            )
          }
        }

        // Track this command
        this.commandCallbacks.set(commandId, responseHandler)

        // Send the command
        this.sendCommand('get_attendance').catch((error) => {
          clearTimeout(timeoutId)
          this.cleanupCommandTracking(commandId)
          reject(
            new Error(`Failed to send attendance request: ${error.message}`)
          )
        })
      })
    } catch (error) {
      console.error('❌ Failed to get ESP32 attendance data:', error)
      throw error
    }
  }

  // Send command to ESP32 and wait for response
  async sendCommand(command, params = {}, timeout = 10000) {
    const commandData = JSON.stringify({ command, ...params }) + '\n' // Add delimiter
    console.log('Sending command:', commandData.trim())

    // Send the command
    await this.writeCharacteristic('COMMAND', commandData)

    // For get_status command, wait for response
    if (command === 'get_status') {
      return new Promise((resolve, reject) => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          this.pendingCommands.delete(command)
          reject(new Error(`Command timeout: ${command}`))
        }, timeout)

        // Store the promise resolvers
        this.pendingCommands.set(command, {
          resolve: (data) => {
            clearTimeout(timeoutId)
            resolve(data)
          },
          reject: (error) => {
            clearTimeout(timeoutId)
            reject(error)
          },
        })
      })
    }

    return true // For other commands that don't need responses
  }

  // Clear attendance data on ESP32
  async clearAttendance(classId = null) {
    if (classId) {
      return await this.sendCommand('clear_attendance', { class_id: classId })
    } else {
      return await this.sendCommand('clear_all_attendance')
    }
  }

  // Get device status - now properly waits for response
  async getDeviceStatus() {
    console.log('📊 Getting device status...')
    try {
      // Clear notification buffer to ensure clean response
      this.notificationBuffer = ''

      const response = await this.sendCommand('get_status', {}, 10000)
      console.log('📊 Device status response:', response)

      // Ensure we have the expected fields
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid device status response')
      }

      return response
    } catch (error) {
      console.error('❌ Failed to get device status:', error)
      throw error
    }
  }

  // Generate a unique command ID
  generateCommandId() {
    // Implement your logic to generate a unique command ID here
    return Date.now().toString()
  }

  // Cleanup command tracking
  cleanupCommandTracking(commandId) {
    this.commandCallbacks.delete(commandId)
  }

  // Trigger data received event
  triggerDataReceived(characteristicName, data) {
    if (this.onDataReceived) {
      this.onDataReceived(characteristicName, data)
    }
  }
}

// Create singleton instance
export const bluetoothManager = new BluetoothManager()

// Utility functions
export const checkBluetoothSupport = () => {
  return bluetoothManager.isSupported()
}

export const connectToESP32 = async () => {
  return await bluetoothManager.connect()
}

export const disconnectFromESP32 = async () => {
  return await bluetoothManager.disconnect()
}

export const syncDataToESP32 = async (classesData) => {
  return await bluetoothManager.syncClassData(classesData)
}

export const getESP32StorageInfo = async () => {
  return await bluetoothManager.getStorageInfo()
}

export const getESP32AttendanceData = async () => {
  return await bluetoothManager.getESP32AttendanceData()
}

export const clearESP32Attendance = async (classId = null) => {
  return await bluetoothManager.clearAttendance(classId)
}
