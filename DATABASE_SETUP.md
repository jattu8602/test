# 🗄️ Database Setup Guide

## Quick Fix for Current Issues

Your website is slow because of database connection problems. Follow these steps to fix it:

### 1. 🚨 **Create Environment File** (CRITICAL)

Create a file named `.env` in your project root with this content:

```bash
# Copy this into a new file called .env in your project root

# FOR MONGODB ATLAS (Recommended)
DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/esp32-attendance?retryWrites=true&w=majority"

# OR FOR LOCAL MONGODB
# DATABASE_URL="mongodb://localhost:27017/esp32-attendance"

# Next.js Configuration
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

### 2. 🌐 **MongoDB Atlas Setup** (Recommended)

1. **Go to [MongoDB Atlas](https://cloud.mongodb.com/)**
2. **Sign up/Login** to your account
3. **Create a new cluster** (free tier is fine)
4. **Create a database user:**

   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `esp32user`
   - Password: Generate a strong password
   - Database User Privileges: "Read and write to any database"

5. **Whitelist your IP:**

   - Go to "Network Access"
   - Click "Add IP Address"
   - Choose "Add Current IP Address" or "Allow Access from Anywhere" (0.0.0.0/0)

6. **Get connection string:**
   - Go to "Clusters"
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>`, `<password>`, and `<dbname>` with your values

### 3. 🔧 **Update Your .env File**

Replace the DATABASE_URL in your `.env` file:

```bash
# Example with real values:
DATABASE_URL="mongodb+srv://esp32user:YourPassword123@cluster0.xyz123.mongodb.net/esp32-attendance?retryWrites=true&w=majority"
```

### 4. 🔄 **Initialize Database**

Run these commands:

```bash
# Install dependencies if not already done
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### 5. ✅ **Test Database Connection**

1. **Start your development server:**

   ```bash
   npm run dev
   ```

2. **Test the health endpoint:**
   Open: `http://localhost:3000/api/health`

   You should see:

   ```json
   {
     "status": "healthy",
     "database": {
       "status": "connected",
       "message": "Database connection successful"
     }
   }
   ```

3. **Test the classes API:**
   Open: `http://localhost:3000/api/classes`

   Should return an empty array: `[]`

## Alternative: Local MongoDB Setup

If you prefer local development:

### 1. **Install MongoDB locally:**

**macOS:**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Windows:**

- Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
- Install and start the service

**Linux (Ubuntu):**

```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 2. **Update .env for local:**

```bash
DATABASE_URL="mongodb://localhost:27017/esp32-attendance"
```

## 🚨 Troubleshooting Connection Issues

### Error: "Server selection timeout"

**Solution 1: Check IP Whitelist**

```bash
# In MongoDB Atlas, go to Network Access
# Make sure your current IP is whitelisted
# Or temporarily allow all IPs: 0.0.0.0/0
```

**Solution 2: Check Connection String**

```bash
# Make sure your connection string has:
# - Correct username/password
# - Correct cluster URL
# - Database name specified
# - retryWrites=true parameter
```

**Solution 3: Check Database User Permissions**

```bash
# In MongoDB Atlas, go to Database Access
# Make sure user has "Read and write to any database" permission
```

### Error: "Authentication failed"

```bash
# Check your username/password in the connection string
# Make sure there are no special characters that need URL encoding
# Example: @ should be %40, # should be %23
```

### Error: "Database does not exist"

```bash
# Run this to create the database and tables:
npx prisma db push
```

## 🚀 Performance Optimization

### 1. **Connection Pooling** (Already implemented)

- Maximum 10 connections
- 30-second idle timeout
- 10-second connect timeout

### 2. **Caching** (Already implemented)

- 30-second cache for classes data
- Stale-while-revalidate for better UX

### 3. **Error Handling** (Already implemented)

- Retry logic for failed queries
- Graceful fallback to cached data
- Proper HTTP status codes

## 📊 Monitoring Database Performance

### Health Check Endpoint

```bash
curl http://localhost:3000/api/health
```

### Monitor API Response Times

```bash
# Classes API with cache headers
curl -I http://localhost:3000/api/classes
```

### Prisma Studio (Visual Database Browser)

```bash
npx prisma studio
```

## 🔒 Security Best Practices

1. **Never commit .env files** (already in .gitignore)
2. **Use strong passwords** for database users
3. **Restrict IP access** in production
4. **Use environment-specific secrets** in production
5. **Enable MongoDB Atlas auditing** for production

## 📝 Environment Variables Reference

| Variable          | Required | Description                          |
| ----------------- | -------- | ------------------------------------ |
| `DATABASE_URL`    | ✅ Yes   | MongoDB connection string            |
| `NEXTAUTH_SECRET` | ✅ Yes   | Secret for NextAuth (if using auth)  |
| `NEXTAUTH_URL`    | ⚠️ Prod  | Base URL for the application         |
| `NODE_ENV`        | 🔄 Auto  | Environment (development/production) |

## 🎯 Quick Test Commands

```bash
# Test database connection
npm run dev
curl http://localhost:3000/api/health

# Test classes API
curl http://localhost:3000/api/classes

# Create a test class
curl -X POST http://localhost:3000/api/classes \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Class", "startRoll": 1}'

# Open Prisma Studio
npx prisma studio
```

After following this guide, your website should load much faster and the database errors should be resolved!
