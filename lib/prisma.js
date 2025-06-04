import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Enhanced Prisma client with connection optimization
const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection optimization for better performance
    __internal: {
      engine: {
        // Reduce connection timeout to fail faster
        connectTimeout: 10000, // 10 seconds instead of default 60s
        // Pool settings for better performance
        pool: {
          timeout: 10000,
          idleTimeout: 30000,
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

// Health check function - MongoDB compatible
export const checkDatabaseConnection = async () => {
  try {
    // Test connection by counting classes (works with MongoDB)
    await prisma.class.count()
    return { status: 'connected', message: 'Database connection successful' }
  } catch (error) {
    console.error('Database connection failed:', error)
    return {
      status: 'disconnected',
      message: error.message,
      code: error.code,
    }
  }
}

// Connection retry wrapper
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message)

      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay * attempt))
    }
  }
}
