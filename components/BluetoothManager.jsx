'use client'

import { useState, useEffect } from 'react'
import {
  bluetoothManager,
  syncDataToESP32,
  getESP32StorageInfo,
  getESP32AttendanceData,
  clearESP32Attendance,
} from '@/lib/bluetooth'

export default function BluetoothManager({
  classes,
  onClassesUpdate,
  onDeviceInfoUpdate,
  onConnectionChange,
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [storageInfo, setStorageInfo] = useState(null)
  const [attendanceData, setAttendanceData] = useState(null)
  const [syncedData, setSyncedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Set up connection change listener
    bluetoothManager.onConnectionChange = (connected) => {
      setIsConnected(connected)
      onConnectionChange?.(connected)
      if (!connected) {
        setDeviceInfo(null)
        setStorageInfo(null)
        setAttendanceData(null)
        setSyncedData(null)
        onDeviceInfoUpdate?.(null)
      } else {
        // Auto-refresh device info when connected
        setTimeout(async () => {
          try {
            const status = await bluetoothManager.getDeviceStatus()
            if (status) {
              setDeviceInfo(status)
              onDeviceInfoUpdate?.(status)
            }
          } catch (error) {
            console.warn('Failed to get initial device status:', error)
          }
        }, 1000) // Wait 1 second after connection
      }
    }

    // Set up data received listener with improved JSON parsing
    bluetoothManager.onDataReceived = (characteristic, data) => {
      console.log('Data received from ESP32:', characteristic, data)
      try {
        let parsedData = data

        // Handle both string and already parsed data
        if (typeof data === 'string') {
          // Clean the string - remove trailing newlines and whitespace
          const cleanedData = data.trim()

          if (cleanedData) {
            try {
              parsedData = JSON.parse(cleanedData)
              console.log(
                '✅ Successfully parsed notification data:',
                parsedData
              )
            } catch (parseError) {
              console.warn(
                'Failed to parse JSON, keeping as string:',
                parseError.message
              )
              console.log('Raw data length:', data.length)
              console.log('Cleaned data length:', cleanedData.length)
              console.log('First 100 chars:', cleanedData.substring(0, 100))
              console.log(
                'Last 100 chars:',
                cleanedData.substring(Math.max(0, cleanedData.length - 100))
              )
              setError(`JSON Parse Error: ${parseError.message}`)
              return
            }
          } else {
            console.warn('Received empty data after cleaning')
            return
          }
        }

        // Handle different characteristics
        if (characteristic === 'CLASS_DATA') {
          setSyncedData(parsedData)
          // Auto-refresh device info after sync
          setTimeout(refreshDeviceInfo, 500)
        } else if (characteristic === 'COMMAND') {
          // Handle command responses (like get_status)
          if (parsedData && parsedData.device_name !== undefined) {
            console.log('📊 Received device status from command:', parsedData)
            setDeviceInfo(parsedData)
            onDeviceInfoUpdate?.(parsedData)
          }
        }

        // Clear any previous errors if parsing was successful
        setError(null)
      } catch (error) {
        console.error('Error processing received data:', error)
        setError(`Data processing error: ${error.message}`)
      }
    }

    return () => {
      bluetoothManager.onConnectionChange = null
      bluetoothManager.onDataReceived = null
    }
  }, [onDeviceInfoUpdate, onConnectionChange])

  // Separate function to refresh device info
  const refreshDeviceInfo = async () => {
    if (!isConnected) return

    try {
      console.log('🔄 Refreshing device info...')
      const status = await bluetoothManager.getDeviceStatus()
      if (status) {
        console.log('📊 Updated device info:', status)
        setDeviceInfo(status)
        onDeviceInfoUpdate?.(status)
      }
    } catch (error) {
      console.warn('Failed to refresh device info:', error)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      await bluetoothManager.connect()

      // Get device info after connection with improved error handling
      try {
        console.log('🔄 Getting initial device status...')
        await refreshDeviceInfo()
      } catch (statusError) {
        console.warn('Failed to get device status:', statusError)
        // Don't fail the connection for this
      }

      // Get storage info with improved error handling
      try {
        await refreshStorageInfo()
      } catch (storageError) {
        console.warn('Failed to get storage info:', storageError)
        // Don't fail the connection for this
      }
    } catch (error) {
      console.error('Connection failed:', error)
      setError(error.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await bluetoothManager.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const refreshStorageInfo = async () => {
    if (!isConnected) return

    try {
      const storage = await getESP32StorageInfo()
      setStorageInfo(storage)
    } catch (error) {
      console.error('Failed to get storage info:', error)
      setError(`Storage info error: ${error.message}`)
    }
  }

  const handleSyncData = async () => {
    if (!isConnected || classes.length === 0) return

    setLoading(true)
    setError(null)

    try {
      // Prepare data for ESP32
      const esp32Data = classes.map((classItem) => ({
        id: classItem.id,
        name: classItem.name,
        students: classItem.students.map((student) => ({
          roll: student.roll,
          name: student.name,
        })),
      }))

      console.log('🚀 Starting data sync to ESP32...')
      console.log(
        `📊 Syncing ${esp32Data.length} classes with ${esp32Data.reduce(
          (total, cls) => total + cls.students.length,
          0
        )} total students`
      )

      await syncDataToESP32(esp32Data)
      setSyncedData(esp32Data)

      // Auto-refresh all status after successful sync
      console.log('🔄 Auto-refreshing status after sync...')
      await Promise.all([refreshDeviceInfo(), refreshStorageInfo()])

      console.log('✅ Data sync completed successfully!')
      setError(null)
    } catch (error) {
      console.error('❌ Sync failed:', error)
      setError(`Sync failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadAttendance = async () => {
    if (!isConnected) return

    setLoading(true)
    setError(null)

    try {
      console.log('📥 Starting attendance download from ESP32...')

      // Clear any existing attendance data first
      setAttendanceData(null)

      const attendance = await getESP32AttendanceData()

      console.log('📊 Download completed:', attendance)
      console.log('📊 Data type:', typeof attendance)
      console.log('📊 Data keys:', Object.keys(attendance || {}))

      setAttendanceData(attendance)

      // Clear error to indicate success
      setError(null)
    } catch (error) {
      console.error('❌ Download failed:', error)
      console.error('❌ Error details:', error.stack)
      setError(`Download failed: ${error.message}`)

      // Clear attendance data on error
      setAttendanceData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAttendance = async (classId, records) => {
    setLoading(true)
    setError(null)

    try {
      console.log(`💾 Saving attendance for class ${classId}...`)

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId,
          records,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        console.log('✅ Attendance saved successfully to database')

        // Clear attendance on ESP32 after successful save
        try {
          console.log(`🧹 Clearing ESP32 attendance for class ${classId}...`)
          await clearESP32Attendance(classId)
          console.log('✅ ESP32 attendance cleared successfully')

          // Refresh attendance data to remove the saved class
          await handleDownloadAttendance()

          // Update classes to reflect attendance taken
          onClassesUpdate()

          // Show success message temporarily
          setError(null)
        } catch (clearError) {
          console.warn('⚠️ Failed to clear ESP32 attendance:', clearError)
          // Still consider it a success since DB save worked
        }
      } else {
        throw new Error(responseData.error || 'Failed to save attendance')
      }
    } catch (error) {
      console.error('❌ Failed to save attendance:', error)
      setError(`Save failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date))
  }

  const calculateAttendanceStats = (records) => {
    const present = records.filter((r) => r.present).length
    const absent = records.filter((r) => !r.present).length
    const total = records.length
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0

    return { present, absent, total, percentage }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ESP32 Connection</h2>
          <p className="text-gray-600">
            Connect to ESP32 device and manage data
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div
            className={`px-3 py-1 rounded-full text-sm ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect to ESP32'}
            </button>
          )}
        </div>
      </div>

      {/* System Status Summary */}
      {isConnected && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📋 System Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Local Classes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {classes.length}
                  </p>
                </div>
                <div className="text-blue-500 text-2xl">📚</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ESP32 Classes</p>
                  <p className="text-2xl font-bold text-green-600">
                    {deviceInfo?.classes_count ?? '—'}
                  </p>
                </div>
                <div className="text-green-500 text-2xl">📡</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Attendance Ready</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {attendanceData ? Object.keys(attendanceData).length : 0}
                  </p>
                </div>
                <div className="text-purple-500 text-2xl">📊</div>
              </div>
            </div>
          </div>

          {/* Sync Status */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {classes.length > 0 &&
              deviceInfo?.classes_count > 0 &&
              classes.length === deviceInfo.classes_count ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-700 font-medium">
                    ✅ Data synchronized
                  </span>
                </>
              ) : classes.length > 0 && deviceInfo?.classes_count === 0 ? (
                <>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-700 font-medium">
                    ⚠️ Sync required
                  </span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    📋 Ready to sync
                  </span>
                </>
              )}
            </div>

            {storageInfo && (
              <div className="text-sm text-gray-600">
                💾 Storage:{' '}
                {((storageInfo.used / storageInfo.total) * 100).toFixed(1)}%
                used
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">⚡ Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleSyncData}
              disabled={loading || classes.length === 0}
              className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-lg">🔄</span>
              )}
              <span>{loading ? 'Syncing...' : 'Sync Classes to ESP32'}</span>
            </button>

            <button
              onClick={handleDownloadAttendance}
              disabled={loading}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-lg">📥</span>
              )}
              <span>{loading ? 'Downloading...' : 'Download Attendance'}</span>
            </button>

            <button
              onClick={async () => {
                setLoading(true)
                try {
                  await Promise.all([refreshDeviceInfo(), refreshStorageInfo()])
                } catch (error) {
                  console.error('Failed to refresh status:', error)
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-lg">🔄</span>
              )}
              <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
            </button>
          </div>

          {/* Action Tips */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">💡 Tips:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                • <strong>Sync Classes:</strong> Send your class data to ESP32
                before taking attendance
              </li>
              <li>
                • <strong>Download Attendance:</strong> Get attendance records
                from ESP32 after taking attendance
              </li>
              <li>
                • <strong>Refresh Status:</strong> Update device information and
                storage details
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Instructions */}
      {!isConnected && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-3">
              🔗 Connection Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              <li>
                Make sure your ESP32 is powered on and running the attendance
                firmware
              </li>
              <li>Ensure Bluetooth is enabled on your device</li>
              <li>
                Click "Connect to ESP32" and select "ESP32-Attendance" from the
                device list
              </li>
              <li>Wait for the connection to establish</li>
            </ol>
          </div>

          {/* Complete Workflow Guide */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📋 Complete Workflow Guide
            </h3>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Prepare Classes & Students
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Go to "Class Management" tab and create your classes with
                    students. Each student gets an auto-generated roll number.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Connect & Sync to ESP32
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Connect to your ESP32 device, then click "Sync Classes to
                    ESP32" to transfer all class and student data.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Take Attendance on ESP32
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Use your ESP32 device to select classes, navigate through
                    students, and mark attendance (Present/Absent).
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Download & Save Attendance
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Return to web app, click "Download Attendance" to retrieve
                    data, review it, then "Save to Database" for each class.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  5
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Automatic Cleanup
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    ESP32 attendance data is automatically cleared after
                    successful database save. Classes remain for next day's
                    attendance.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">
                🎯 Key Benefits:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  • <strong>Offline Capable:</strong> Take attendance without
                  internet connection on ESP32
                </li>
                <li>
                  • <strong>Data Safety:</strong> Attendance saved to MongoDB
                  with timestamps
                </li>
                <li>
                  • <strong>Daily Reset:</strong> Automatic cleanup prevents
                  duplicate entries
                </li>
                <li>
                  • <strong>Export Ready:</strong> View and export attendance
                  records anytime
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Device Info */}
      {isConnected && deviceInfo && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Device Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Device Name</p>
              <p className="font-medium">
                {deviceInfo.device_name || 'ESP32-Attendance'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Classes Count</p>
              <p className="font-medium">{deviceInfo.classes_count || 0}</p>
            </div>
            {deviceInfo.memory_free && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Free Memory</p>
                  <p className="font-medium">
                    {formatBytes(deviceInfo.memory_free.free)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Used Memory</p>
                  <p className="font-medium">
                    {formatBytes(deviceInfo.memory_free.allocated)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Storage Info */}
      {isConnected && storageInfo && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Storage Information</h3>
            <button
              onClick={refreshStorageInfo}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Storage Usage</span>
                <span>{storageInfo.percent_used?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${storageInfo.percent_used || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total</p>
                <p className="font-medium">{formatBytes(storageInfo.total)}</p>
              </div>
              <div>
                <p className="text-gray-600">Used</p>
                <p className="font-medium">{formatBytes(storageInfo.used)}</p>
              </div>
              <div>
                <p className="text-gray-600">Free</p>
                <p className="font-medium">{formatBytes(storageInfo.free)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sync Section */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Data Synchronization</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Sync Classes to ESP32</p>
                <p className="text-sm text-gray-600">
                  Send {classes.length} classes with all student data to ESP32
                </p>
                {deviceInfo && deviceInfo.classes_count > 0 && (
                  <p className="text-sm text-green-600 font-medium mt-1">
                    ✅ {deviceInfo.classes_count} classes currently on ESP32
                  </p>
                )}
                {loading && (
                  <p className="text-sm text-blue-600 mt-1">
                    🔄 Syncing data to ESP32...
                  </p>
                )}
              </div>
              <button
                onClick={handleSyncData}
                disabled={loading || classes.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{loading ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            </div>

            {syncedData && !loading && (
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">
                  ✅ Last Sync Successful:
                </h4>
                <p className="text-sm text-green-700">
                  Synced {syncedData.length} classes with{' '}
                  {syncedData.reduce(
                    (total, cls) => total + cls.students.length,
                    0
                  )}{' '}
                  students
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Management */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">
            📊 Attendance Management
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Download Attendance from ESP32</p>
                <p className="text-sm text-gray-600">
                  Retrieve attendance data collected on the device
                </p>
                {loading && (
                  <p className="text-sm text-blue-600 mt-1">
                    📥 Downloading attendance data...
                  </p>
                )}
              </div>
              <button
                onClick={handleDownloadAttendance}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>
                  {loading ? 'Downloading...' : 'Download Attendance'}
                </span>
              </button>
            </div>

            {/* Attendance Data Display */}
            {attendanceData && Object.keys(attendanceData).length > 0 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">
                    ✅ Attendance Data Retrieved from ESP32
                  </h4>
                  <p className="text-sm text-green-700">
                    Found attendance data for{' '}
                    {Object.keys(attendanceData).length} class(es). Review and
                    save to database below.
                  </p>
                </div>

                <div className="grid gap-4">
                  {Object.entries(attendanceData).map(([classId, data]) => {
                    const classInfo = classes.find((c) => c.id === classId)
                    const stats = calculateAttendanceStats(data.records || [])

                    return (
                      <div
                        key={classId}
                        className="bg-gray-50 border rounded-lg p-6"
                      >
                        {/* Class Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h5 className="text-lg font-semibold text-gray-900">
                              📚 {classInfo?.name || `Class ${classId}`}
                            </h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                              <div className="bg-white rounded p-2 text-center">
                                <div className="font-semibold text-green-600">
                                  {stats.present}
                                </div>
                                <div className="text-gray-600">Present</div>
                              </div>
                              <div className="bg-white rounded p-2 text-center">
                                <div className="font-semibold text-red-600">
                                  {stats.absent}
                                </div>
                                <div className="text-gray-600">Absent</div>
                              </div>
                              <div className="bg-white rounded p-2 text-center">
                                <div className="font-semibold text-blue-600">
                                  {stats.total}
                                </div>
                                <div className="text-gray-600">Total</div>
                              </div>
                              <div className="bg-white rounded p-2 text-center">
                                <div className="font-semibold text-purple-600">
                                  {stats.percentage}%
                                </div>
                                <div className="text-gray-600">Attendance</div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              handleSaveAttendance(classId, data.records)
                            }
                            disabled={loading}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2 ml-4"
                          >
                            {loading && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            )}
                            <span>💾 Save to Database</span>
                          </button>
                        </div>

                        {/* Attendance Records */}
                        <div className="max-h-64 overflow-y-auto">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(data.records || []).map((record, index) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-2 rounded ${
                                  record.present
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-red-50 border border-red-200'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-sm font-medium">
                                    #{record.roll}
                                  </span>
                                  <span className="text-sm truncate">
                                    {record.name}
                                  </span>
                                </div>
                                <span
                                  className={`text-sm font-medium ${
                                    record.present
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {record.present ? '✅ P' : '❌ A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Metadata */}
                        {data.timestamp && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              📅 Taken on ESP32:{' '}
                              {formatDateTime(data.timestamp)}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No Attendance Data */}
            {attendanceData && Object.keys(attendanceData).length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-gray-600 font-medium">
                  No attendance data found on ESP32
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Take attendance on the device first, then download it here
                </p>
              </div>
            )}

            {/* Instructions */}
            {!attendanceData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">
                  📋 How to use:
                </h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Take attendance on your ESP32 device</li>
                  <li>Click "Download Attendance" to retrieve data</li>
                  <li>Review the attendance records for each class</li>
                  <li>
                    Click "Save to Database" for each class to store in MongoDB
                  </li>
                  <li>
                    ESP32 data will be automatically cleared after successful
                    save
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
