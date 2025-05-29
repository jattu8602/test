import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/classes - Get all classes with students
export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      include: {
        students: {
          orderBy: {
            roll: 'asc',
          },
        },
        attendance: {
          orderBy: {
            takenAt: 'desc',
          },
          take: 1, // Get latest attendance only
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(classes)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    )
  }
}

// POST /api/classes - Create a new class
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, startRoll = 1 } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Class name is required' },
        { status: 400 }
      )
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        startRoll: parseInt(startRoll),
      },
      include: {
        students: true,
      },
    })

    return NextResponse.json(newClass, { status: 201 })
  } catch (error) {
    console.error('Error creating class:', error)
    return NextResponse.json(
      { error: 'Failed to create class' },
      { status: 500 }
    )
  }
}
