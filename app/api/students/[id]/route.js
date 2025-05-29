import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/students/[id] - Get specific student
export async function GET(request, { params }) {
  try {
    const { id } = params

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json(student)
  } catch (error) {
    console.error('Error fetching student:', error)
    return NextResponse.json(
      { error: 'Failed to fetch student' },
      { status: 500 }
    )
  }
}

// PUT /api/students/[id] - Update student
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, roll } = body

    // If roll is being updated, check for conflicts
    if (roll) {
      const student = await prisma.student.findUnique({
        where: { id },
      })

      if (!student) {
        return NextResponse.json(
          { error: 'Student not found' },
          { status: 404 }
        )
      }

      const existingStudent = await prisma.student.findFirst({
        where: {
          classId: student.classId,
          roll: parseInt(roll),
          id: { not: id },
        },
      })

      if (existingStudent) {
        return NextResponse.json(
          { error: 'Roll number already exists in this class' },
          { status: 400 }
        )
      }
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(roll && { roll: parseInt(roll) }),
      },
      include: {
        class: true,
      },
    })

    return NextResponse.json(updatedStudent)
  } catch (error) {
    console.error('Error updating student:', error)
    return NextResponse.json(
      { error: 'Failed to update student' },
      { status: 500 }
    )
  }
}

// DELETE /api/students/[id] - Delete student
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    await prisma.student.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Student deleted successfully' })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json(
      { error: 'Failed to delete student' },
      { status: 500 }
    )
  }
}
