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
            this.handleNotification(name, event)
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
  handleNotification(characteristicName, event) {
    try {
      const value = new TextDecoder().decode(event.target.value)
      console.log(`📡 Notification from ${characteristicName}:`, value)

      // Initialize buffer for this characteristic if needed
      if (!this.notificationBuffers) {
        this.notificationBuffers = {}
      }
      if (!this.notificationBuffers[characteristicName]) {
        this.notificationBuffers[characteristicName] = ''
      }

      // Append new data to buffer
      this.notificationBuffers[characteristicName] += value

      // Check for complete messages (ending with newline)
      const messages = this.notificationBuffers[characteristicName].split('\n')

      // Process complete messages (all but the last one, which might be incomplete)
      for (let i = 0; i < messages.length - 1; i++) {
        const message = messages[i].trim()
        if (message) {
          console.log(
            `📦 Processing complete message ${i + 1}: ${message.length} chars`
          )
          this.processCompleteNotification(characteristicName, message)
        }
      }

      // Keep the last (potentially incomplete) message in buffer
      this.notificationBuffers[characteristicName] =
        messages[messages.length - 1]

      // Debug: show buffer status
      if (this.notificationBuffers[characteristicName]) {
        console.log(
          `📄 Buffer contains: ${this.notificationBuffers[characteristicName].length} chars waiting`
        )
      } else {
        console.log(`✅ Buffer cleared - message was complete`)
      }
    } catch (error) {
      console.error('Error handling notification:', error)
      // Clear corrupted buffer
      if (
        this.notificationBuffers &&
        this.notificationBuffers[characteristicName]
      ) {
        this.notificationBuffers[characteristicName] = ''
      }
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Process a complete notification message
  processCompleteNotification(characteristicName, message) {
    try {
      // Clean the message - remove extra whitespace and control characters
      const cleanedMessage = message.replace(/[\r\n]+/g, '').trim()

      if (!cleanedMessage) {
        console.warn('Empty message after cleaning')
        return
      }

      // Try to parse JSON if possible
      let parsedData = cleanedMessage
      try {
        // Validate that it looks like JSON before parsing
        if (
          (cleanedMessage.startsWith('{') && cleanedMessage.endsWith('}')) ||
          (cleanedMessage.startsWith('[') && cleanedMessage.endsWith(']'))
        ) {
          parsedData = JSON.parse(cleanedMessage)
          console.log('Successfully parsed JSON:', parsedData)
        } else {
          console.log(
            'Message does not appear to be JSON, keeping as string:',
            cleanedMessage
          )
        }
      } catch (parseError) {
        console.warn('JSON parse failed:', parseError.message)
        console.log('Problematic message:', JSON.stringify(cleanedMessage))
        // Keep as string but notify about the error
        if (this.onError) {
          this.onError(new Error(`JSON Parse Error: ${parseError.message}`))
        }
      }

      // Handle command responses from COMMAND characteristic
      if (characteristicName === 'COMMAND' && typeof parsedData === 'object') {
        const commandType = parsedData.command || 'get_status' // Default to get_status for compatibility

        // For get_status responses, look for device_name field as indicator
        if (!parsedData.command && parsedData.device_name) {
          console.log('Detected get_status response by device_name field')
          // Resolve get_status command
          if (this.pendingCommands.has('get_status')) {
            const { resolve } = this.pendingCommands.get('get_status')
            this.pendingCommands.delete('get_status')
            resolve(parsedData)
            return
          }
        } else if (parsedData.command) {
          // Handle responses with explicit command field
          if (this.pendingCommands.has(commandType)) {
            const { resolve } = this.pendingCommands.get(commandType)
            this.pendingCommands.delete(commandType)
            resolve(parsedData)
            return
          }
        }
      }

      if (this.onDataReceived) {
        this.onDataReceived(characteristicName, parsedData)
      }
    } catch (error) {
      console.error('Error processing notification:', error)
      if (this.onError) {
        this.onError(error)
      }
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
  async getAttendanceData() {
    try {
      console.log('📥 Requesting attendance data from ESP32...')
      const startTime = Date.now()
      const data = await this.readCharacteristic('ATTENDANCE_DATA')
      const readTime = Date.now() - startTime

      console.log(`📥 Read completed in ${readTime}ms`)

      // Clean the data before parsing
      const cleanedData = data.replace(/[\r\n]+/g, '').trim()

      if (!cleanedData) {
        console.warn('⚠️ Received empty attendance data')
        return {} // Return empty object instead of throwing
      }

      console.log(`🧹 Cleaned data: ${cleanedData.length} chars`)
      console.log(
        `📋 Cleaned preview: ${cleanedData.substring(0, 150)}${
          cleanedData.length > 150 ? '...' : ''
        }`
      )

      // Validate JSON structure before parsing
      if (!cleanedData.startsWith('{') && !cleanedData.startsWith('[')) {
        console.error(
          `❌ Invalid JSON format: data does not start with { or [ but with: "${cleanedData.substring(
            0,
            10
          )}"`
        )
        throw new Error(`Invalid JSON format: data does not start with { or [`)
      }

      if (!cleanedData.endsWith('}') && !cleanedData.endsWith(']')) {
        console.error(
          `❌ Invalid JSON format: data does not end with } or ] but with: "${cleanedData.substring(
            cleanedData.length - 10
          )}"`
        )
        throw new Error(`Invalid JSON format: data does not end with } or ]`)
      }

      console.log('🔍 JSON structure validation passed')

      const parseStartTime = Date.now()
      const parsedData = JSON.parse(cleanedData)
      const parseTime = Date.now() - parseStartTime

      console.log(`✅ JSON parsing completed in ${parseTime}ms`)
      console.log('📊 Parsed attendance data:', parsedData)
      console.log(`📋 Data type: ${typeof parsedData}`)

      if (typeof parsedData === 'object' && parsedData !== null) {
        const keys = Object.keys(parsedData)
        console.log(
          `🗂️ Object keys: [${keys.join(', ')}] (${keys.length} total)`
        )
      }

      return parsedData
    } catch (error) {
      console.error('❌ Error getting attendance data:', error)
      console.error(`❌ Error stack:`, error.stack)
      throw new Error(`Attendance data error: ${error.message}`)
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
    try {
      const response = await this.sendCommand('get_status')
      console.log('Device status response:', response)
      return response
    } catch (error) {
      console.error('Failed to get device status:', error)
      throw error
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
  return await bluetoothManager.getAttendanceData()
}

export const clearESP32Attendance = async (classId = null) => {
  return await bluetoothManager.clearAttendance(classId)
}
