'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { checkBluetoothSupport } from '@/lib/bluetooth'

// Lazy load heavy components to improve initial load time
const ClassManager = dynamic(() => import('@/components/ClassManager'), {
  loading: () => (
    <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
  ),
})

const BluetoothManager = dynamic(
  () => import('@/components/BluetoothManager'),
  {
    loading: () => (
      <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
    ),
  }
)
const AttendanceViewer = dynamic(
  () => import('@/components/AttendanceViewer'),
  {
    loading: () => (
      <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
    ),
  }
)

// Memoized loading component
const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  </div>
)

// Memoized header component
const Header = ({
  bluetoothSupported,
  classCount,
  deviceInfo,
  isConnected,
}) => (
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
          {isConnected && deviceInfo ? (
            <div className="text-sm text-gray-500">
              ESP32: {deviceInfo.classes_count || 0} classes
            </div>
          ) : (
            <div className="text-sm text-gray-500">{classCount} classes</div>
          )}
        </div>
      </div>
    </div>
  </header>
)

// Memoized navigation component
const Navigation = ({ activeTab, bluetoothSupported, onTabChange }) => {
  const tabs = useMemo(
    () => [
      { id: 'classes', label: '📚 Class Management', enabled: true },
      {
        id: 'bluetooth',
        label: '📡 ESP32 Connection',
        enabled: bluetoothSupported,
      },
      { id: 'attendance', label: '📊 Attendance Records', enabled: true },
    ],
    [bluetoothSupported]
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              disabled={!tab.enabled}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.enabled
                  ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

// Memoized error component for Bluetooth not supported
const BluetoothNotSupported = () => (
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
          <p>Web Bluetooth API is not supported in this browser. Please use:</p>
          <ul className="list-disc list-inside mt-2">
            <li>Chrome 70+ or Edge 79+</li>
            <li>Ensure you're using HTTPS</li>
            <li>Enable experimental web features if needed</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
)

export default function Home() {
  const [activeTab, setActiveTab] = useState('classes')
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [esp32DeviceInfo, setEsp32DeviceInfo] = useState(null)
  const [isEsp32Connected, setIsEsp32Connected] = useState(false)

  // Memoized load classes function
  const loadClasses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/classes', {
        cache: 'no-store', // Ensure fresh data
      })

      if (response.ok) {
        const data = await response.json()
        setClasses(data)
      } else {
        throw new Error('Failed to load classes')
      }
    } catch (error) {
      console.error('Error loading classes:', error)
      setError('Failed to load classes. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Optimized update handler
  const handleClassesUpdate = useCallback(() => {
    loadClasses()
  }, [loadClasses])

  // Optimized tab change handler
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
  }, [])

  // Initialize on mount
  useEffect(() => {
    // Check Bluetooth support (synchronous)
    setBluetoothSupported(checkBluetoothSupport())

    // Load classes (asynchronous)
    loadClasses()
  }, [loadClasses])

  // Memoized class count
  const classCount = useMemo(() => classes.length, [classes])

  if (loading && classes.length === 0) {
    return <LoadingSpinner message="Initializing system..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadClasses}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        bluetoothSupported={bluetoothSupported}
        classCount={classCount}
        deviceInfo={esp32DeviceInfo}
        isConnected={isEsp32Connected}
      />

      <Navigation
        activeTab={activeTab}
        bluetoothSupported={bluetoothSupported}
        onTabChange={handleTabChange}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'classes' && (
          <ClassManager
            classes={classes}
            onUpdate={handleClassesUpdate}
            loading={loading}
          />
        )}

        {activeTab === 'bluetooth' && bluetoothSupported && (
          <BluetoothManager
            classes={classes}
            onClassesUpdate={handleClassesUpdate}
            onDeviceInfoUpdate={setEsp32DeviceInfo}
            onConnectionChange={setIsEsp32Connected}
          />
        )}

        {activeTab === 'bluetooth' && !bluetoothSupported && (
          <BluetoothNotSupported />
        )}

        {activeTab === 'attendance' && <AttendanceViewer classes={classes} />}
      </main>
    </div>
  )
}
