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
  classes = [],
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
      console.log('🔌 Connection state changed:', connected)
      setIsConnected(connected)
      onConnectionChange?.(connected)

      if (!connected) {
        setDeviceInfo(null)
        setStorageInfo(null)
        setAttendanceData(null)
        setSyncedData(null)
        onDeviceInfoUpdate?.(null)
      } else {
        // Auto-refresh device info when connected with delay
        setTimeout(async () => {
          try {
            console.log('🔄 Auto-refreshing device info after connection...')
            await refreshAllStatus()
          } catch (error) {
            console.warn('Failed to get initial device status:', error)
          }
        }, 2000) // Wait 2 seconds after connection for ESP32 to be ready
      }
    }

    // Set up data received listener with improved JSON parsing
    bluetoothManager.onDataReceived = (characteristic, data) => {
      console.log('📡 Data received from ESP32:', characteristic, typeof data)

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
          setTimeout(refreshAllStatus, 1000)
        } else if (characteristic === 'COMMAND') {
          // Handle command responses (like get_status)
          if (
            parsedData &&
            (parsedData.device_name !== undefined ||
              parsedData.command === 'get_status')
          ) {
            console.log('📊 Received device status from command:', parsedData)
            setDeviceInfo(parsedData)
            onDeviceInfoUpdate?.(parsedData)
          }
        } else if (characteristic === 'ATTENDANCE_DATA') {
          console.log('📋 Received attendance data via notifications')
          setAttendanceData(parsedData)
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

  // Function to refresh all device status information
  const refreshAllStatus = async () => {
    if (!isConnected) return

    console.log('🔄 Refreshing all device status...')
    const results = await Promise.allSettled([
      refreshDeviceInfo(),
      refreshStorageInfo(),
    ])

    results.forEach((result, index) => {
      const operation = ['device info', 'storage info'][index]
      if (result.status === 'rejected') {
        console.warn(`Failed to refresh ${operation}:`, result.reason)
      }
    })
  }

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
      throw error
    }
  }

  const refreshStorageInfo = async () => {
    if (!isConnected) return

    try {
      const info = await getESP32StorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.warn('Failed to refresh storage info:', error)
      throw error
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      await bluetoothManager.connect()
      console.log('✅ Connected successfully!')
    } catch (error) {
      console.error('Connection failed:', error)
      setError(error.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await bluetoothManager.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Smart Sync Function - Enhanced workflow
  const handleSmartSync = async () => {
    if (!isConnected || classes.length === 0) return

    setLoading(true)
    setError(null)

    try {
      console.log('🚀 Starting smart sync workflow...')

      // Step 1: Check if there's existing attendance data before syncing
      let existingAttendance = null
      try {
        console.log('📋 Checking for existing attendance data...')
        existingAttendance = await getESP32AttendanceData()

        if (existingAttendance && Object.keys(existingAttendance).length > 0) {
          console.log(
            '⚠️ Found existing attendance data:',
            Object.keys(existingAttendance).length,
            'classes'
          )
          setAttendanceData(existingAttendance)

          // Ask user what to do with existing data
          const userChoice = confirm(
            `Found attendance data for ${
              Object.keys(existingAttendance).length
            } classes on ESP32.\n\n` +
              'Would you like to:\n' +
              '• OK: Download and save existing data first, then sync new classes\n' +
              '• Cancel: Skip download and sync new classes (existing data will be overwritten)'
          )

          if (userChoice) {
            console.log('👤 User chose to save existing attendance data first')
            // We'll handle this data later in the download section
          } else {
            console.log(
              '👤 User chose to skip existing data and sync new classes'
            )
            existingAttendance = null
          }
        }
      } catch (error) {
        console.warn('Could not check existing attendance:', error)
      }

      // Step 2: Prepare and sync new class data to ESP32
      const esp32Data = classes.map((classItem) => ({
        id: classItem.id,
        name: classItem.name,
        students: classItem.students.map((student) => ({
          roll: student.roll,
          name: student.name,
        })),
      }))

      console.log('📊 Syncing new class data...')
      console.log(
        `📚 Syncing ${esp32Data.length} classes with ${esp32Data.reduce(
          (total, cls) => total + cls.students.length,
          0
        )} total students`
      )

      await syncDataToESP32(esp32Data)
      setSyncedData(esp32Data)

      // Step 3: Auto-refresh all status after successful sync
      console.log('🔄 Auto-refreshing status after sync...')
      await refreshAllStatus()

      // Step 4: If there was existing attendance data, set it for download
      if (existingAttendance && Object.keys(existingAttendance).length > 0) {
        setAttendanceData(existingAttendance)
      }

      console.log('✅ Smart sync completed successfully!')
      setError(null)
    } catch (error) {
      console.error('❌ Smart sync failed:', error)
      setError(`Smart sync failed: ${error.message}`)
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

      if (!attendance || Object.keys(attendance).length === 0) {
        setError('No attendance data found on ESP32')
        return
      }

      setAttendanceData(attendance)
      setError(null)
    } catch (error) {
      console.error('❌ Download failed:', error)
      console.error('❌ Error details:', error.stack)
      setError(`Download failed: ${error.message}`)
      setAttendanceData(null)
    } finally {
      setLoading(false)
    }
  }

  // Save individual class attendance to database and clean ESP32
  const handleSaveClassToDatabase = async (classId, classData) => {
    setLoading(true)
    try {
      console.log('💾 Saving class to database:', classId)

      // Prepare attendance data for database
      const attendancePayload = {
        classId: classId,
        date: new Date().toISOString().split('T')[0], // Today's date
        records: classData.records.map((record) => ({
          studentRoll: record.roll,
          studentName: record.name,
          present: record.present,
          timestamp: record.timestamp || new Date().toISOString(),
        })),
        totalStudents: classData.total_students,
        presentCount: classData.records.filter((r) => r.present).length,
        absentCount: classData.records.filter((r) => !r.present).length,
        metadata: {
          source: 'ESP32',
          esp32Timestamp: classData.timestamp,
          syncedAt: new Date().toISOString(),
        },
      }

      // Save to database
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attendancePayload),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Database save failed: ${error}`)
      }

      const result = await response.json()
      console.log('✅ Saved to database:', result)

      // Remove this class from local attendance data
      setAttendanceData((prev) => {
        if (!prev) return prev
        const updated = { ...prev }
        delete updated[classId]
        return updated
      })

      // Clear this specific class from ESP32
      try {
        await clearESP32Attendance(classId)
        console.log('🧹 Cleared class from ESP32:', classId)
      } catch (clearError) {
        console.warn('Failed to clear ESP32 data:', clearError)
        // Don't fail the operation if ESP32 clear fails
      }

      // Refresh device info to show updated attendance counts
      await refreshAllStatus()

      setError(null)
      return result
    } catch (error) {
      console.error('❌ Failed to save class to database:', error)
      setError(`Save failed: ${error.message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Save all attendance classes to database
  const handleSaveAllToDatabase = async () => {
    if (!attendanceData || Object.keys(attendanceData).length === 0) return

    setLoading(true)
    try {
      const classIds = Object.keys(attendanceData)
      console.log(
        '💾 Saving all classes to database:',
        classIds.length,
        'classes'
      )

      const results = []
      for (const classId of classIds) {
        try {
          const result = await handleSaveClassToDatabase(
            classId,
            attendanceData[classId]
          )
          results.push({ classId, success: true, result })
        } catch (error) {
          console.error(`Failed to save class ${classId}:`, error)
          results.push({ classId, success: false, error: error.message })
        }
      }

      const successful = results.filter((r) => r.success).length
      console.log(
        `✅ Saved ${successful}/${classIds.length} classes to database`
      )

      if (successful === classIds.length) {
        setAttendanceData(null) // Clear all if everything was successful
      }
    } catch (error) {
      console.error('❌ Bulk save failed:', error)
      setError(`Bulk save failed: ${error.message}`)
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
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 text-xl mr-3">⚠️</span>
            <div>
              <h3 className="text-red-800 font-medium">Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">🔌 ESP32 Connection</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-300'
              }`}
            ></div>
            <span className="font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {deviceInfo && (
              <span className="text-sm text-gray-500">
                ({deviceInfo.device_name})
              </span>
            )}
          </div>

          <div className="flex space-x-3">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isConnecting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>📡</span>
                )}
                <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Status Dashboard */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📊 System Status</h3>
            <button
              onClick={refreshAllStatus}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Local Classes */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Local Classes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {classes.length}
                  </p>
                </div>
                <span className="text-3xl">📚</span>
              </div>
            </div>

            {/* ESP32 Classes */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ESP32 Classes</p>
                  <p className="text-2xl font-bold text-green-600">
                    {deviceInfo?.classes_count ?? '—'}
                  </p>
                </div>
                <span className="text-3xl">🛡️</span>
              </div>
            </div>

            {/* Attendance Ready */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Attendance Ready</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {attendanceData ? Object.keys(attendanceData).length : '0'}
                  </p>
                </div>
                <span className="text-3xl">📋</span>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  syncedData ? 'bg-green-500' : 'bg-gray-300'
                }`}
              ></div>
              <span className="text-gray-600">
                {syncedData ? '📚 Data synced' : '📚 Ready to sync'}
              </span>
            </div>

            {storageInfo && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">
                  💾 Storage:{' '}
                  {((storageInfo.used / storageInfo.total) * 100).toFixed(1)}%
                  used
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Sync and Actions */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">
            ⚡ Smart Sync & Actions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={handleSmartSync}
              disabled={loading || classes.length === 0}
              className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-xl">🚀</span>
              )}
              <span className="font-medium">
                {loading ? 'Syncing...' : 'Smart Sync Classes'}
              </span>
            </button>

            <button
              onClick={handleDownloadAttendance}
              disabled={loading}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <span className="text-xl">📥</span>
              )}
              <span className="font-medium">
                {loading ? 'Downloading...' : 'Download Attendance'}
              </span>
            </button>
          </div>

          {/* Smart Sync Explanation */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">
              🧠 Smart Sync Workflow:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • <strong>Step 1:</strong> Checks for existing attendance data
                on ESP32
              </li>
              <li>
                • <strong>Step 2:</strong> Prompts to save existing data before
                syncing new classes
              </li>
              <li>
                • <strong>Step 3:</strong> Syncs your local classes to ESP32 for
                attendance
              </li>
              <li>
                • <strong>Step 4:</strong> Auto-refreshes device status and
                counts
              </li>
              <li>
                • <strong>Step 5:</strong> Makes any existing attendance ready
                for download
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Attendance Data Display and Management */}
      {attendanceData && Object.keys(attendanceData).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              📋 Attendance Data Management
            </h3>
            <button
              onClick={handleSaveAllToDatabase}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💾 Save All to Database
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(attendanceData).map(([classId, classData]) => {
              const presentCount =
                classData.records?.filter((r) => r.present).length || 0
              const totalStudents =
                classData.total_students || classData.records?.length || 0
              const percentage =
                totalStudents > 0
                  ? ((presentCount / totalStudents) * 100).toFixed(1)
                  : 0

              // Find class name from local classes
              const localClass = classes.find((c) => c.id === classId)
              const className =
                localClass?.name || `Class ${classId.substring(0, 8)}`

              return (
                <div key={classId} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{className}</h4>
                      <p className="text-sm text-gray-600">
                        {presentCount}/{totalStudents} present ({percentage}%)
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleSaveClassToDatabase(classId, classData)
                      }
                      disabled={loading}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      💾 Save to Database
                    </button>
                  </div>

                  {/* Attendance Records Preview */}
                  {classData.records && classData.records.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {classData.records.slice(0, 8).map((record, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded text-center ${
                            record.present
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <div className="font-medium">{record.name}</div>
                          <div className="text-xs opacity-75">
                            Roll {record.roll} •{' '}
                            {record.present ? 'Present' : 'Absent'}
                          </div>
                        </div>
                      ))}

                      {classData.records.length > 8 && (
                        <div className="p-2 rounded text-center bg-gray-100 text-gray-600">
                          +{classData.records.length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>💡 Tip:</strong> After saving to database, the attendance
              data will be automatically cleared from ESP32 to free up space for
              new attendance records.
            </p>
          </div>
        </div>
      )}

      {/* Storage Information */}
      {storageInfo && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">💾 Storage Information</h3>

          <div className="flex items-center mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(storageInfo.used / storageInfo.total) * 100}%`,
                }}
              ></div>
            </div>
            <button
              onClick={refreshStorageInfo}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-600">Total</p>
              <p className="font-semibold">
                {(storageInfo.total / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Used</p>
              <p className="font-semibold">
                {(storageInfo.used / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Free</p>
              <p className="font-semibold">
                {((storageInfo.total - storageInfo.used) / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Instructions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">📖 Quick Instructions</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start space-x-3">
            <span className="text-lg">1️⃣</span>
            <div>
              <strong>Connect & Sync:</strong> Connect to ESP32 and use "Smart
              Sync Classes" to send your class data. This also checks for any
              existing attendance data and gives you option to save it first.
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-lg">2️⃣</span>
            <div>
              <strong>Take Attendance:</strong> Use the ESP32 device to take
              attendance for your classes. The device will store attendance data
              locally.
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-lg">3️⃣</span>
            <div>
              <strong>Download & Save:</strong> Use "Download Attendance" to get
              attendance data from ESP32. Then save individual classes or all
              classes to your database.
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-lg">4️⃣</span>
            <div>
              <strong>Auto-Cleanup:</strong> After saving to database,
              attendance data is automatically cleared from ESP32 to make space
              for new records.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
