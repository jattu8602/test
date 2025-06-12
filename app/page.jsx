"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { checkBluetoothSupport } from "@/lib/bluetooth"
import { Bluetooth, Users, BarChart3, Wifi, WifiOff } from "lucide-react"

// Lazy load heavy components to improve initial load time
const ClassManager = dynamic(() => import("@/components/ClassManager"), {
  loading: () => <div className="animate-pulse bg-gradient-to-r from-gray-200 to-gray-300 h-48 rounded-2xl"></div>,
})

const BluetoothManager = dynamic(() => import("@/components/BluetoothManager"), {
  loading: () => <div className="animate-pulse bg-gradient-to-r from-blue-200 to-blue-300 h-48 rounded-2xl"></div>,
})

const AttendanceViewer = dynamic(() => import("@/components/AttendanceViewer"), {
  loading: () => <div className="animate-pulse bg-gradient-to-r from-green-200 to-green-300 h-48 rounded-2xl"></div>,
})

// Enhanced loading component
const LoadingSpinner = ({ message = "Loading..." }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
        <div className="absolute inset-0 rounded-full bg-blue-100 opacity-20 animate-ping"></div>
      </div>
      <p className="mt-6 text-slate-600 font-medium text-base sm:text-lg">{message}</p>

    </div>
  </div>
)

// Enhanced header component
const Header = ({ bluetoothSupported, classCount }) => (
  <header className="relative overflow-hidden">
    {/* Background gradient */}
    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800"></div>
    <div className="absolute inset-0 bg-black/10"></div>

    {/* Floating elements */}
    <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl float-animation"></div>
    <div
      className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl float-animation"
      style={{ animationDelay: "2s" }}
    ></div>

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-12 space-y-6 md:space-y-0">
    <div className="text-white">
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2 sm:mb-3">
        ESP32 ATTENDANCE
        <span className="block text-3xl sm:text-4xl font-light text-blue-200">SYSTEM</span>
      </h1>
      <p className="text-blue-100 text-base sm:text-lg font-medium max-w-md">
        Next-generation Bluetooth-enabled attendance management
      </p>
    </div>

    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">

          {!bluetoothSupported ? (
            <div className="glass-morphism px-4 py-2 rounded-full flex items-center space-x-2 text-red-200">
              <WifiOff className="w-5 h-5" />
              <span className="text-sm font-medium">Bluetooth Unavailable</span>
            </div>
          ) : (
            <div className="glass-morphism px-4 py-2 rounded-full flex items-center space-x-2 text-green-200 pulse-glow">
              <Wifi className="w-5 h-5" />
              <span className="text-sm font-medium">Bluetooth Ready</span>
            </div>
          )}

          <div className="glass-morphism px-6 py-3 rounded-full">
            <div className="text-white text-center">
              <div className="text-2xl font-bold">{classCount}</div>
              <div className="text-xs text-blue-200 font-medium">CLASSES</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
)

// Enhanced navigation component
const Navigation = ({ activeTab, bluetoothSupported, onTabChange }) => {
  const tabs = useMemo(
    () => [
      {
        id: "classes",
        label: "Class Management",
        icon: Users,
        enabled: true,
        color: "from-blue-500 to-blue-600",
      },
      {
        id: "bluetooth",
        label: "ESP32 Connection",
        icon: Bluetooth,
        enabled: bluetoothSupported,
        color: "from-purple-500 to-purple-600",
      },
      {
        id: "attendance",
        label: "Attendance Records",
        icon: BarChart3,
        enabled: true,
        color: "from-green-500 to-green-600",
      },
    ],
    [bluetoothSupported],
  )

  return (
    <div className="relative -mt-6 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-2">
          <nav className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  disabled={!tab.enabled}
                  className={`
                    flex-1 flex items-center justify-center space-x-3 py-4 px-6 rounded-xl font-semibold text-sm transition-all duration-300
                    ${
                      isActive
                        ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-105`
                        : tab.enabled
                          ? "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                          : "text-slate-300 cursor-not-allowed"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : ""}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

// Enhanced error component for Bluetooth not supported
const BluetoothNotSupported = () => (
  <div className="enhanced-card bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl p-8 shadow-xl">
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
          <WifiOff className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-red-800 mb-3">Bluetooth Not Supported</h3>
        <div className="text-red-700 space-y-3">
          <p className="font-medium">Web Bluetooth API is not available in this browser.</p>
          <div className="bg-white/50 rounded-lg p-4">
            <p className="font-semibold mb-2">Recommended browsers:</p>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Chrome 70+ or Edge 79+</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Ensure you're using HTTPS</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Enable experimental web features if needed</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default function Home() {
  const [activeTab, setActiveTab] = useState("classes")
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Memoized load classes function
  const loadClasses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/classes", {
        cache: "no-store",
      })

      if (response.ok) {
        const data = await response.json()
        setClasses(data)
      } else {
        throw new Error("Failed to load classes")
      }
    } catch (error) {
      console.error("Error loading classes:", error)
      setError("Failed to load classes. Please try again.")
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
    setBluetoothSupported(checkBluetoothSupport())
    loadClasses()
  }, [loadClasses])

  // Memoized class count
  const classCount = useMemo(() => classes.length, [classes])

  if (loading && classes.length === 0) {
    return <LoadingSpinner message="Initializing system..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center enhanced-card bg-white p-8 rounded-2xl shadow-2xl max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">System Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>

          <button
            onClick={loadClasses}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header bluetoothSupported={bluetoothSupported} classCount={classCount} />

      <Navigation activeTab={activeTab} bluetoothSupported={bluetoothSupported} onTabChange={handleTabChange} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeTab === "classes" && <ClassManager classes={classes} onUpdate={handleClassesUpdate} loading={loading} />}

        {activeTab === "bluetooth" && bluetoothSupported && (
          <BluetoothManager classes={classes} onClassesUpdate={handleClassesUpdate} />
        )}

        {activeTab === "bluetooth" && !bluetoothSupported && <BluetoothNotSupported />}

        {activeTab === "attendance" && <AttendanceViewer classes={classes} />}
      </main>
    </div>
  )
}
