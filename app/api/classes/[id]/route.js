import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/classes/[id] - Get specific class with students
export async function GET(request, { params }) {
  try {
    const { id } = params

    const classData = await prisma.class.findUnique({
      where: { id },
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
        },
      },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    return NextResponse.json(classData)
  } catch (error) {
    console.error('Error fetching class:', error)
    return NextResponse.json(
      { error: 'Failed to fetch class' },
      { status: 500 }
    )
  }
}

// PUT /api/classes/[id] - Update class
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, startRoll } = body

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startRoll && { startRoll: parseInt(startRoll) }),
      },
      include: {
        students: {
          orderBy: {
            roll: 'asc',
          },
        },
      },
    })

    return NextResponse.json(updatedClass)
  } catch (error) {
    console.error('Error updating class:', error)
    return NextResponse.json(
      { error: 'Failed to update class' },
      { status: 500 }
    )
  }
}

// DELETE /api/classes/[id] - Delete class
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    await prisma.class.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Class deleted successfully' })
  } catch (error) {
    console.error('Error deleting class:', error)
    return NextResponse.json(
      { error: 'Failed to delete class' },
      { status: 500 }
    )
  }
}
