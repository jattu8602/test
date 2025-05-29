'use client'

import { useState, useEffect } from 'react'
import ClassManager from '@/components/ClassManager'
import BluetoothManager from '@/components/BluetoothManager'
import AttendanceViewer from '@/components/AttendanceViewer'
import { checkBluetoothSupport } from '@/lib/bluetooth'

export default function Home() {
  const [activeTab, setActiveTab] = useState('classes')
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check Bluetooth support
    setBluetoothSupported(checkBluetoothSupport())

    // Load classes
    loadClasses()
  }, [])

  const loadClasses = async () => {
    try {
      const response = await fetch('/api/classes')
      if (response.ok) {
        const data = await response.json()
        setClasses(data)
      }
    } catch (error) {
      console.error('Error loading classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClassesUpdate = () => {
    loadClasses()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ESP32 Attendance System
              </h1>
              <p className="text-gray-600 mt-1">
                Bluetooth-enabled attendance management
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {!bluetoothSupported && (
                <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                  ⚠️ Bluetooth not supported
                </div>
              )}
              <div className="text-sm text-gray-500">
                {classes.length} classes
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('classes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'classes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📚 Class Management
            </button>
            <button
              onClick={() => setActiveTab('bluetooth')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bluetooth'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={!bluetoothSupported}
            >
              📡 ESP32 Connection
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Attendance Records
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'classes' && (
          <ClassManager classes={classes} onUpdate={handleClassesUpdate} />
        )}

        {activeTab === 'bluetooth' && bluetoothSupported && (
          <BluetoothManager
            classes={classes}
            onClassesUpdate={handleClassesUpdate}
          />
        )}

        {activeTab === 'bluetooth' && !bluetoothSupported && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
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
                <h3 className="text-sm font-medium text-red-800">
                  Bluetooth Not Supported
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Web Bluetooth API is not supported in this browser. Please
                    use:
                  </p>
                  <ul className="list-disc list-inside mt-2">
                    <li>Chrome 70+ or Edge 79+</li>
                    <li>Ensure you're using HTTPS</li>
                    <li>Enable experimental web features if needed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && <AttendanceViewer classes={classes} />}
      </main>
    </div>
  )
}
