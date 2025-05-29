import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/classes/[id]/students - Get all students in a class
export async function GET(request, { params }) {
  try {
    const { id } = params

    const students = await prisma.student.findMany({
      where: { classId: id },
      orderBy: {
        roll: 'asc',
      },
    })

    return NextResponse.json(students)
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}

// POST /api/classes/[id]/students - Add student to class
export async function POST(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, roll } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Student name is required' },
        { status: 400 }
      )
    }

    // Get class to determine next roll number if not provided
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          orderBy: {
            roll: 'desc',
          },
          take: 1,
        },
      },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Calculate roll number
    let studentRoll = roll
    if (!studentRoll) {
      if (classData.students.length > 0) {
        studentRoll = classData.students[0].roll + 1
      } else {
        studentRoll = classData.startRoll
      }
    }

    // Check if roll number already exists
    const existingStudent = await prisma.student.findFirst({
      where: {
        classId: id,
        roll: parseInt(studentRoll),
      },
    })

    if (existingStudent) {
      return NextResponse.json(
        { error: 'Roll number already exists in this class' },
        { status: 400 }
      )
    }

    const newStudent = await prisma.student.create({
      data: {
        name,
        roll: parseInt(studentRoll),
        classId: id,
      },
    })

    return NextResponse.json(newStudent, { status: 201 })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    )
  }
}
