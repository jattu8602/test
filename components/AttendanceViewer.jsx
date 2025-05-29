'use client'

import { useState, useEffect } from 'react'

export default function AttendanceViewer({ classes }) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  useEffect(() => {
    loadAttendance()
  }, [selectedClass, selectedDate])

  const loadAttendance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedClass) params.append('classId', selectedClass)
      if (selectedDate) params.append('date', selectedDate)

      const response = await fetch(`/api/attendance?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAttendance(data)
      }
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculateStats = (records) => {
    const total = records.length
    const present = records.filter((r) => r.present).length
    const absent = total - present
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0

    return { total, present, absent, percentage }
  }

  const exportToCSV = (attendanceRecord) => {
    const headers = ['Roll Number', 'Name', 'Status']
    const rows = attendanceRecord.records.map((record) => [
      record.roll,
      record.name,
      record.present ? 'Present' : 'Absent',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${attendanceRecord.class.name}-${
      new Date(attendanceRecord.takenAt).toISOString().split('T')[0]
    }.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Attendance Records
          </h2>
          <p className="text-gray-600">View and export attendance data</p>
        </div>
        <div className="text-sm text-gray-500">
          {attendance.length} records found
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => {
              setSelectedClass('')
              setSelectedDate('')
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Clear Filters
          </button>
          <button
            onClick={loadAttendance}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading attendance records...</p>
        </div>
      )}

      {/* No Records */}
      {!loading && attendance.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No attendance records found
          </h3>
          <p className="text-gray-600 mb-4">
            {selectedClass || selectedDate
              ? 'Try adjusting your filters or take attendance first'
              : 'Take attendance using the ESP32 device to see records here'}
          </p>
        </div>
      )}

      {/* Attendance Records */}
      {!loading && attendance.length > 0 && (
        <div className="space-y-6">
          {attendance.map((record) => {
            const stats = calculateStats(record.records)
            return (
              <div
                key={record.id}
                className="bg-white rounded-lg shadow-sm border p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {record.class.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Taken on {formatDate(record.takenAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => exportToCSV(record)}
                    className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700"
                  >
                    📥 Export CSV
                  </button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.total}
                    </div>
                    <div className="text-sm text-gray-600">Total Students</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.present}
                    </div>
                    <div className="text-sm text-gray-600">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {stats.absent}
                    </div>
                    <div className="text-sm text-gray-600">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.percentage}%
                    </div>
                    <div className="text-sm text-gray-600">Attendance</div>
                  </div>
                </div>

                {/* Attendance Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Attendance Rate</span>
                    <span>{stats.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${stats.percentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Student List */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Student Details:
                  </h4>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="grid gap-2">
                      {record.records.map((student, index) => (
                        <div
                          key={index}
                          className={`flex justify-between items-center p-2 rounded ${
                            student.present ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-900">
                              #{student.roll}
                            </span>
                            <span className="text-gray-700">
                              {student.name}
                            </span>
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              student.present
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {student.present ? '✅ Present' : '❌ Absent'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
