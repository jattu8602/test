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
}

class BluetoothManager {
  constructor() {
    this.device = null
    this.server = null
    this.service = null
    this.characteristics = {}
    this.isConnected = false
    this.onConnectionChange = null
    this.onDataReceived = null
  }

  // Check if Web Bluetooth is supported
  isSupported() {
    return 'bluetooth' in navigator
  }

  // Scan for ESP32 devices
  async scanDevices() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser')
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: ESP32_CONFIG.DEVICE_NAME },
          { services: [ESP32_CONFIG.SERVICE_UUID] },
        ],
        optionalServices: [ESP32_CONFIG.SERVICE_UUID],
      })

      return device
    } catch (error) {
      console.error('Error scanning for devices:', error)
      throw error
    }
  }

  // Connect to ESP32 device
  async connect(device = null) {
    try {
      if (!device) {
        device = await this.scanDevices()
      }

      this.device = device

      // Add disconnect listener
      device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect()
      })

      console.log('Connecting to GATT Server...')
      this.server = await device.gatt.connect()

      console.log('Getting service...')
      this.service = await this.server.getPrimaryService(
        ESP32_CONFIG.SERVICE_UUID
      )

      console.log('Getting characteristics...')
      await this.setupCharacteristics()

      this.isConnected = true
      if (this.onConnectionChange) {
        this.onConnectionChange(true)
      }

      console.log('Connected to ESP32!')
      return true
    } catch (error) {
      console.error('Connection failed:', error)
      this.handleDisconnect()
      throw error
    }
  }

  // Setup all characteristics
  async setupCharacteristics() {
    const charUUIDs = ESP32_CONFIG.CHARACTERISTICS

    for (const [name, uuid] of Object.entries(charUUIDs)) {
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
        }
      } catch (error) {
        console.warn(`Could not setup characteristic ${name}:`, error)
      }
    }
  }

  // Handle notifications from ESP32
  handleNotification(characteristicName, event) {
    const value = new TextDecoder().decode(event.target.value)
    console.log(`Notification from ${characteristicName}:`, value)

    if (this.onDataReceived) {
      this.onDataReceived(characteristicName, value)
    }
  }

  // Disconnect from device
  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect()
    }
    this.handleDisconnect()
  }

  // Handle disconnect event
  handleDisconnect() {
    this.isConnected = false
    this.device = null
    this.server = null
    this.service = null
    this.characteristics = {}

    if (this.onConnectionChange) {
      this.onConnectionChange(false)
    }

    console.log('Disconnected from ESP32')
  }

  // Write data to characteristic
  async writeCharacteristic(characteristicName, data) {
    if (!this.isConnected || !this.characteristics[characteristicName]) {
      throw new Error(
        `Not connected or characteristic ${characteristicName} not available`
      )
    }

    try {
      const encoder = new TextEncoder()
      const encodedData = encoder.encode(data)
      await this.characteristics[characteristicName].writeValue(encodedData)
      return true
    } catch (error) {
      console.error(`Error writing to ${characteristicName}:`, error)
      throw error
    }
  }

  // Read data from characteristic
  async readCharacteristic(characteristicName) {
    if (!this.isConnected || !this.characteristics[characteristicName]) {
      throw new Error(
        `Not connected or characteristic ${characteristicName} not available`
      )
    }

    try {
      const value = await this.characteristics[characteristicName].readValue()
      const decoder = new TextDecoder()
      return decoder.decode(value)
    } catch (error) {
      console.error(`Error reading from ${characteristicName}:`, error)
      throw error
    }
  }

  // Sync class data to ESP32
  async syncClassData(classesData) {
    const jsonData = JSON.stringify(classesData)
    console.log('Syncing class data:', jsonData)
    return await this.writeCharacteristic('CLASS_DATA', jsonData)
  }

  // Get storage info from ESP32
  async getStorageInfo() {
    const data = await this.readCharacteristic('STORAGE_INFO')
    return JSON.parse(data)
  }

  // Get attendance data from ESP32
  async getAttendanceData() {
    const data = await this.readCharacteristic('ATTENDANCE_DATA')
    return JSON.parse(data)
  }

  // Send command to ESP32
  async sendCommand(command, params = {}) {
    const commandData = JSON.stringify({ command, ...params })
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
