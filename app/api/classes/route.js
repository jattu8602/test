import { NextResponse } from 'next/server'
import { prisma, withRetry, checkDatabaseConnection } from '@/lib/prisma'

// Cache for classes data (simple in-memory cache)
let classesCache = null
let cacheTimestamp = null
const CACHE_DURATION = 30000 // 30 seconds

// GET /api/classes - Get all classes with students
export async function GET(request) {
  try {
    // Check if we can use cached data
    const now = Date.now()
    if (
      classesCache &&
      cacheTimestamp &&
      now - cacheTimestamp < CACHE_DURATION
    ) {
      console.log('📦 Returning cached classes data')
      return NextResponse.json(classesCache, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Cache': 'HIT',
        },
      })
    }

    // Check database connection first
    const dbStatus = await checkDatabaseConnection()
    if (dbStatus.status === 'disconnected') {
      console.error('❌ Database connection failed:', dbStatus.message)

      // Return cached data if available, even if stale
      if (classesCache) {
        console.log('📦 Returning stale cached data due to DB connection issue')
        return NextResponse.json(classesCache, {
          headers: {
            'Cache-Control': 'public, s-maxage=0, stale-while-revalidate=300',
            'X-Cache': 'STALE',
            'X-DB-Status': 'disconnected',
          },
        })
      }

      return NextResponse.json(
        {
          error: 'Database connection failed',
          details: dbStatus.message,
          suggestion: 'Please check your DATABASE_URL environment variable',
        },
        { status: 503 } // Service Unavailable
      )
    }

    console.log('🔄 Fetching fresh classes data from database')

    // Use retry wrapper for database operations
    const classes = await withRetry(
      async () => {
        return await prisma.class.findMany({
          select: {
            id: true,
            name: true,
            startRoll: true,
            createdAt: true,
            updatedAt: true,
            // Only get essential student data
            students: {
              select: {
                id: true,
                roll: true,
                name: true,
              },
              orderBy: {
                roll: 'asc',
              },
            },
            // Only get the latest attendance record
            attendance: {
              select: {
                id: true,
                takenAt: true,
                records: true,
              },
              orderBy: {
                takenAt: 'desc',
              },
              take: 1,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      },
      3,
      1000
    )

    // Process data for better performance
    const processedClasses = classes.map((classItem) => ({
      ...classItem,
      studentCount: classItem.students.length,
      hasAttendance: classItem.attendance.length > 0,
      lastAttendance: classItem.attendance[0]?.takenAt || null,
    }))

    // Update cache
    classesCache = processedClasses
    cacheTimestamp = now

    console.log(`✅ Successfully fetched ${processedClasses.length} classes`)

    return NextResponse.json(processedClasses, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Cache': 'MISS',
        'X-DB-Status': 'connected',
      },
    })
  } catch (error) {
    console.error('❌ Error fetching classes:', error)

    // Return cached data if available during errors
    if (classesCache) {
      console.log('📦 Returning cached data due to error')
      return NextResponse.json(classesCache, {
        headers: {
          'Cache-Control': 'public, s-maxage=0, stale-while-revalidate=300',
          'X-Cache': 'ERROR-FALLBACK',
        },
      })
    }

    // Determine error type and status code
    let statusCode = 500
    let errorMessage = 'Failed to fetch classes'

    if (error.code === 'P2024') {
      statusCode = 408 // Request Timeout
      errorMessage = 'Database connection timeout'
    } else if (error.code === 'P2028') {
      statusCode = 503 // Service Unavailable
      errorMessage = 'Database transaction failed'
    }

    return NextResponse.json(
      {
        error: errorMessage,
        code: error.code,
        timestamp: new Date().toISOString(),
        suggestion: 'Please try again or check your database connection',
      },
      { status: statusCode }
    )
  }
}

// POST /api/classes - Create a new class
export async function POST(request) {
  try {
    // Check database connection first
    const dbStatus = await checkDatabaseConnection()
    if (dbStatus.status === 'disconnected') {
      return NextResponse.json(
        {
          error: 'Database connection failed',
          details: dbStatus.message,
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { name, startRoll = 1 } = body

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Class name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Class name must be less than 100 characters' },
        { status: 400 }
      )
    }

    // Check for duplicate class names
    const existingClass = await prisma.class.findFirst({
      where: { name: name.trim() },
    })

    if (existingClass) {
      return NextResponse.json(
        { error: 'A class with this name already exists' },
        { status: 409 }
      )
    }

    const newClass = await withRetry(async () => {
      return await prisma.class.create({
        data: {
          name: name.trim(),
          startRoll: parseInt(startRoll) || 1,
        },
        select: {
          id: true,
          name: true,
          startRoll: true,
          createdAt: true,
          students: {
            select: {
              id: true,
              roll: true,
              name: true,
            },
          },
        },
      })
    })

    // Clear cache when new class is created
    classesCache = null
    cacheTimestamp = null

    console.log(`✅ Created new class: ${newClass.name}`)

    return NextResponse.json(newClass, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating class:', error)

    let statusCode = 500
    let errorMessage = 'Failed to create class'

    if (error.code === 'P2002') {
      statusCode = 409 // Conflict
      errorMessage = 'A class with this name already exists'
    }

    return NextResponse.json(
      {
        error: errorMessage,
        code: error.code,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    )
  }
}
