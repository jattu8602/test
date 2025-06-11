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
          this.processCompleteNotification(characteristicName, message)
        }
      }

      // Keep the last (potentially incomplete) message in buffer
      this.notificationBuffers[characteristicName] =
        messages[messages.length - 1]
    } catch (error) {
      console.error('Error handling notification:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Process a complete notification message
  processCompleteNotification(characteristicName, message) {
    try {
      // Try to parse JSON if possible
      let parsedData = message
      try {
        parsedData = JSON.parse(message)
      } catch {
        // Not JSON, keep as string
      }

      if (this.onDataReceived) {
        this.onDataReceived(characteristicName, parsedData)
      }
    } catch (error) {
      console.error('Error processing notification:', error)
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

  // Enhanced read with timeout
  async readCharacteristic(characteristicName, timeout = 5000) {
    if (!this.isConnected || !this.characteristics[characteristicName]) {
      throw new Error(
        `Not connected or characteristic ${characteristicName} not available`
      )
    }

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Read timeout for ${characteristicName}`))
      }, timeout)

      try {
        const value = await this.characteristics[characteristicName].readValue()
        clearTimeout(timeoutId)
        const decoder = new TextDecoder()
        const result = decoder.decode(value)
        console.log(
          `✅ Read from ${characteristicName}: ${result.length} characters`
        )
        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        console.error(`❌ Error reading from ${characteristicName}:`, error)
        reject(error)
      }
    })
  }

  // Sync class data to ESP32
  async syncClassData(classesData) {
    const jsonData = JSON.stringify(classesData) + '\n' // Add delimiter
    console.log('🚀 Syncing class data:')
    console.log('📦 Data length:', jsonData.length, 'characters')
    console.log('📝 Data preview:', jsonData.substring(0, 100) + '...')
    console.log('🔚 Ends with newline:', jsonData.endsWith('\n'))
    console.log('📋 Full data:', jsonData)
    return await this.writeCharacteristic('CLASS_DATA', jsonData)
  }

  // Get storage info from ESP32
  async getStorageInfo() {
    const data = await this.readCharacteristic('STORAGE_INFO')
    return JSON.parse(data.replace(/\n$/, '')) // Remove trailing newline if present
  }

  // Get attendance data from ESP32
  async getAttendanceData() {
    const data = await this.readCharacteristic('ATTENDANCE_DATA')
    return JSON.parse(data.replace(/\n$/, '')) // Remove trailing newline if present
  }

  // Send command to ESP32
  async sendCommand(command, params = {}) {
    const commandData = JSON.stringify({ command, ...params }) + '\n' // Add delimiter
    return await this.writeCharacteristic('COMMAND', commandData)
  }

  // Clear attendance data on ESP32
  async clearAttendance(classId = null) {
    if (classId) {
      return await this.sendCommand('clear_attendance', { class_id: classId })
    } else {
      return await this.sendCommand('clear_all_attendance')
    }
  }

  // Get device status
  async getDeviceStatus() {
    return await this.sendCommand('get_status')
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
