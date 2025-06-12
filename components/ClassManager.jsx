"use client"

import { useState } from "react"
import { Plus, Users, Trash2, UserPlus, BookOpen,X} from "lucide-react"

export default function ClassManager({ classes, onUpdate, loading }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [newClassName, setNewClassName] = useState("")
  const [newStartingRoll, setNewStartingRoll] = useState("")
   const [newStudentName, setNewStudentName] = useState("")
  const [newStudentRoll, setNewStudentRoll] = useState("")

  const handleCreateClass = async (e) => {
    e.preventDefault()

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newClassName,
          startingRoll: Number.parseInt(newStartingRoll),
        }),
      })

      if (response.ok) {
        setNewClassName("")
        setNewStartingRoll("")
        setShowCreateForm(false)
        onUpdate()
      }
    } catch (error) {
      console.error("Error creating class:", error)
    }
  }

  const handleDeleteClass = async (classId) => {
    if (!confirm("Are you sure you want to delete this class?")) return

    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error("Error deleting class:", error)
    }
  }
  const handleAddStudent = async (e) => {
    e.preventDefault()

    try {
      const response = await fetch(`/api/classes/${selectedClassId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStudentName,
          rollNumber: Number.parseInt(newStudentRoll),
        }),
      })

      if (response.ok) {
        setNewStudentName("")
        setNewStudentRoll("")
        setShowStudentForm(false)
        setSelectedClassId(null)
        onUpdate()
      }
    } catch (error) {
      console.error("Error adding student:", error)
    }
  }

  const handleDeleteStudent = async (classId, studentId) => {
    if (!confirm("Are you sure you want to remove this student?")) return

    try {
      const response = await fetch(`/api/classes/${classId}/students/${studentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error("Error removing student:", error)
    }
  }

  const openStudentForm = (classId) => {
    setSelectedClassId(classId)
    setShowStudentForm(true)

    // Auto-generate next roll number
    const classItem = classes.find((c) => c.id === classId)
    if (classItem && classItem.students && classItem.students.length > 0) {
      const maxRoll = Math.max(...classItem.students.map((s) => s.rollNumber))
      setNewStudentRoll((maxRoll + 1).toString())
    } else if (classItem) {
      setNewStudentRoll(classItem.startingRoll.toString())
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2">CLASS MANAGEMENT</h2>
          <p className="text-slate-600 font-medium text-base sm:text-lg">
            Create classes and manage student enrollment
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="enhanced-card bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Create Class</span>
        </button>
      </div>

      {/* Create Class Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="enhanced-card bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-2xl mx-3">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Create New Class</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Class Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="e.g., 5th A, Grade 10B"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Starting Roll Number</label>
                <input
                  type="number"
                  value={newStartingRoll}
                  onChange={(e) => setNewStartingRoll(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="e.g., 1, 101"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

       {/* Add Student Modal */}
      {showStudentForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="enhanced-card bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Add New Student</h3>
              <button
                onClick={() => {
                  setShowStudentForm(false)
                  setSelectedClassId(null)
                  setNewStudentName("")
                  setNewStudentRoll("")
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Student Name</label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter student name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Roll Number</label>
                <input
                  type="number"
                  value={newStudentRoll}
                  onChange={(e) => setNewStudentRoll(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter roll number"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentForm(false)
                    setSelectedClassId(null)
                    setNewStudentName("")
                    setNewStudentRoll("")
                  }}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {classes.map((classItem) => (
          <div
            key={classItem.id}
            className="enhanced-card bg-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-100 relative overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full -translate-y-16 translate-x-16 opacity-50"></div>

            {/* Delete Button */}
            <button
              onClick={() => handleDeleteClass(classItem.id)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Class Header */}
            <div className="relative mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{classItem.name}</h3>
                 <p className="text-sm text-slate-500 font-medium">Starting Roll: {classItem.startingRoll}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-slate-800">{classItem.students?.length || 0}</div>
                <div className="text-xs text-slate-500 font-medium">STUDENTS</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{classItem.attendanceRecords?.length || 0}</div>
                <div className="text-xs text-blue-500 font-medium">RECORDS</div>
              </div>
            </div>

            {/* Students Section */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center space-x-2">
                <Users className="w-4 h-4" />
                    <span>Students ({classItem.students?.length || 0})</span>
              </h4>

              {classItem.students && classItem.students.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {classItem.students.map((student) => (
                     <div
                      key={student.id}
                      className="flex items-center justify-between bg-slate-50 rounded-lg p-3 group hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-700">{student.name}</span>
                          <div className="text-xs text-slate-500">Roll #{student.rollNumber}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteStudent(classItem.id, student.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all duration-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No students added</p>
                    <p className="text-xs text-slate-400">Click below to add students</p>
                </div>
              )}
            </div>

            {/* Add Student Button */}
             <button
              onClick={() => openStudentForm(classItem.id)}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          </div>
        ))}

        {/* Empty State */}
        {classes.length === 0 && !loading && (
          <div className="col-span-full text-center py-8 sm:py-16">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-slate-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-600 mb-2">No Classes Yet</h3>
            <p className="text-slate-500 mb-4 sm:mb-6">Create your first class to get started</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="enhanced-card bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold inline-flex items-center space-x-2 shadow-lg"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Create First Class</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
