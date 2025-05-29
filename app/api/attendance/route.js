import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/attendance - Get all attendance records
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const date = searchParams.get('date')

    let whereClause = {}

    if (classId) {
      whereClause.classId = classId
    }

    if (date) {
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)

      whereClause.takenAt = {
        gte: startDate,
        lt: endDate,
      }
    }

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        class: {
          include: {
            students: true,
          },
        },
      },
      orderBy: {
        takenAt: 'desc',
      },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// POST /api/attendance - Save attendance from ESP32
export async function POST(request) {
  try {
    const body = await request.json()
    const { classId, records } = body

    if (!classId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'Class ID and records array are required' },
        { status: 400 }
      )
    }

    // Check if class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Check if attendance already taken today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        classId,
        takenAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance already taken for this class today' },
        { status: 400 }
      )
    }

    // Validate records format
    for (const record of records) {
      if (
        !record.hasOwnProperty('roll') ||
        !record.hasOwnProperty('name') ||
        !record.hasOwnProperty('present')
      ) {
        return NextResponse.json(
          {
            error:
              'Invalid record format. Each record must have roll, name, and present fields',
          },
          { status: 400 }
        )
      }
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        classId,
        records,
        takenAt: new Date(),
      },
      include: {
        class: {
          include: {
            students: true,
          },
        },
      },
    })

    return NextResponse.json(attendance, { status: 201 })
  } catch (error) {
    console.error('Error saving attendance:', error)
    return NextResponse.json(
      { error: 'Failed to save attendance' },
      { status: 500 }
    )
  }
}
