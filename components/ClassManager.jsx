'use client'

import { useState } from 'react'

export default function ClassManager({ classes, onUpdate }) {
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(null)
  const [loading, setLoading] = useState(false)

  const [newClass, setNewClass] = useState({
    name: '',
    startRoll: 1,
  })

  const [newStudent, setNewStudent] = useState({
    name: '',
    roll: '',
  })

  const handleCreateClass = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newClass),
      })

      if (response.ok) {
        setNewClass({ name: '', startRoll: 1 })
        setShowCreateClass(false)
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create class')
      }
    } catch (error) {
      console.error('Error creating class:', error)
      alert('Failed to create class')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStudent = async (e, classId) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/classes/${classId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStudent),
      })

      if (response.ok) {
        setNewStudent({ name: '', roll: '' })
        setShowAddStudent(null)
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add student')
      }
    } catch (error) {
      console.error('Error adding student:', error)
      alert('Failed to add student')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClass = async (classId) => {
    if (
      !confirm(
        'Are you sure you want to delete this class? This will also delete all students and attendance records.'
      )
    ) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete class')
      }
    } catch (error) {
      console.error('Error deleting class:', error)
      alert('Failed to delete class')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStudent = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student?')) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete student')
      }
    } catch (error) {
      console.error('Error deleting student:', error)
      alert('Failed to delete student')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Class Management</h2>
          <p className="text-gray-600">Create classes and add students</p>
        </div>
        <button
          onClick={() => setShowCreateClass(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          ➕ Create Class
        </button>
      </div>

      {/* Create Class Modal */}
      {showCreateClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Class</h3>
            <form onSubmit={handleCreateClass}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    value={newClass.name}
                    onChange={(e) =>
                      setNewClass({ ...newClass, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Math Class A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starting Roll Number
                  </label>
                  <input
                    type="number"
                    value={newClass.startRoll}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        startRoll: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Classes List */}
      {classes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No classes yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create your first class to get started
          </p>
          <button
            onClick={() => setShowCreateClass(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Class
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="bg-white rounded-lg shadow-sm border p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {classItem.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Starting Roll: {classItem.startRoll}
                  </p>
                  <p className="text-sm text-gray-600">
                    {classItem.students.length} students
                  </p>
                  {classItem.attendance.length > 0 && (
                    <p className="text-sm text-green-600">
                      ✅ Attendance taken
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteClass(classItem.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                  disabled={loading}
                >
                  🗑️
                </button>
              </div>

              {/* Students List */}
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-medium text-gray-700">Students:</h4>
                {classItem.students.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No students added
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {classItem.students.map((student) => (
                      <div
                        key={student.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span>
                          <span className="font-medium">#{student.roll}</span>{' '}
                          {student.name}
                        </span>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-red-600 hover:text-red-800 ml-2"
                          disabled={loading}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Student */}
              {showAddStudent === classItem.id ? (
                <form
                  onSubmit={(e) => handleAddStudent(e, classItem.id)}
                  className="space-y-2"
                >
                  <input
                    type="text"
                    value={newStudent.name}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, name: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="Student name"
                    required
                  />
                  <input
                    type="number"
                    value={newStudent.roll}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, roll: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder={`Roll number (auto: ${
                      classItem.students.length > 0
                        ? Math.max(...classItem.students.map((s) => s.roll)) + 1
                        : classItem.startRoll
                    })`}
                  />
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white px-2 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddStudent(null)
                        setNewStudent({ name: '', roll: '' })
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 px-2 py-1 text-sm rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddStudent(classItem.id)}
                  className="w-full bg-gray-100 text-gray-700 px-3 py-2 text-sm rounded hover:bg-gray-200 transition-colors"
                >
                  ➕ Add Student
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
