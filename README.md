# ESP32 Attendance System - Web Application

A comprehensive Bluetooth-enabled attendance management system with ESP32 integration. This web application allows teachers to manage classes, students, and sync data with ESP32 devices for offline attendance taking.

## Features

### 🎓 Class Management

- Create and manage classes with custom starting roll numbers
- Add, edit, and delete students
- Auto-increment roll numbers
- Visual class overview with student counts

### 📡 Bluetooth ESP32 Integration

- Connect to ESP32 devices via Web Bluetooth API
- Sync class and student data to ESP32
- Monitor ESP32 storage and memory usage
- Download attendance data from ESP32
- Automatic data cleanup after successful sync

### 📊 Attendance Tracking

- View attendance records with detailed statistics
- Filter by class and date
- Export attendance to CSV format
- Real-time attendance percentage calculations
- Day-boundary enforcement (one attendance per day)

### 🔧 Technical Features

- Modern Next.js 15 with App Router
- MongoDB database with Prisma ORM
- Responsive Tailwind CSS design
- Web Bluetooth API integration
- Real-time data synchronization

## Prerequisites

- Node.js 18+ and npm
- MongoDB database (local or MongoDB Atlas)
- Modern browser with Web Bluetooth support (Chrome 70+, Edge 79+)
- HTTPS connection (required for Web Bluetooth)
- ESP32 device with attendance firmware

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd esp32-attendance-system
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/esp32-attendance"
# For MongoDB Atlas:
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/esp32-attendance"

# Next.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
# For production:
# NEXTAUTH_URL="https://yourdomain.com"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Optional: Open Prisma Studio to view data
npm run db:studio
```

### 4. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Deployment

### 1. Build the Application

```bash
npm run build
npm start
```

### 2. Environment Variables for Production

Update your `.env` file:

```env
DATABASE_URL="your-production-mongodb-url"
NEXTAUTH_URL="https://yourdomain.com"
NODE_ENV="production"
```

### 3. HTTPS Requirement

Web Bluetooth API requires HTTPS. Deploy to:

- Vercel (recommended)
- Netlify
- Your own server with SSL certificate

## ESP32 Setup

### 1. Hardware Requirements

- ESP32 DevKit with Bluetooth LE
- SSD1306 OLED display (128x64)
- 6 tactile buttons
- Breadboard and jumper wires

### 2. Firmware Installation

1. Flash MicroPython firmware to ESP32
2. Upload the attendance system firmware from `esp32-firmware/` folder
3. Configure pin assignments in `config.py`
4. Power on the device

### 3. Connection Process

1. Ensure ESP32 is powered and advertising
2. Open web app in Chrome/Edge browser
3. Go to "ESP32 Connection" tab
4. Click "Connect to ESP32"
5. Select "ESP32-Attendance" from device list
6. Sync class data to ESP32

## Usage Guide

### 1. Class Management

1. Go to "Class Management" tab
2. Click "Create Class"
3. Enter class name and starting roll number
4. Add students to the class
5. Students get auto-assigned roll numbers

### 2. ESP32 Data Sync

1. Connect to ESP32 via Bluetooth
2. Click "Sync Data" to send classes to ESP32
3. Monitor storage usage and device status
4. ESP32 is now ready for offline attendance

### 3. Taking Attendance (ESP32)

1. Power on ESP32 device
2. Use UP/DOWN buttons to select class
3. Press SELECT to start attendance
4. For each student: Press PRESENT or ABSENT
5. System auto-advances to next student
6. Attendance is saved automatically

### 4. Retrieving Attendance

1. Connect ESP32 to web app
2. Click "Download Attendance"
3. Review attendance data
4. Click "Save to Database" for each class
5. ESP32 data is cleared after successful save

### 5. Viewing Records

1. Go to "Attendance Records" tab
2. Filter by class or date
3. View detailed statistics
4. Export to CSV for external use

## API Endpoints

### Classes

- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create new class
- `GET /api/classes/[id]` - Get specific class
- `PUT /api/classes/[id]` - Update class
- `DELETE /api/classes/[id]` - Delete class

### Students

- `GET /api/classes/[id]/students` - Get class students
- `POST /api/classes/[id]/students` - Add student
- `PUT /api/students/[id]` - Update student
- `DELETE /api/students/[id]` - Delete student

### Attendance

- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Save attendance from ESP32

## Database Schema

### Class Model

```javascript
{
  id: String (ObjectId)
  name: String
  startRoll: Number
  students: Student[]
  attendance: Attendance[]
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Student Model

```javascript
{
  id: String(ObjectId)
  roll: Number
  name: String
  classId: String(ObjectId)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Attendance Model

```javascript
{
  id: String(ObjectId)
  classId: String(ObjectId)
  records: Json // [{ roll, name, present }]
  takenAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Bluetooth Communication

### ESP32 BLE Service

- Service UUID: `12345678-1234-1234-1234-123456789abc`
- Device Name: `ESP32-Attendance`

### Characteristics

- **Class Data**: Send/receive class and student data
- **Storage Info**: Get ESP32 storage usage
- **Attendance Data**: Retrieve attendance records
- **Command**: Send control commands

### Data Format

```javascript
// Class sync data
[
  {
    id: "class-uuid",
    name: "Math Class A",
    students: [
      { roll: 1, name: "Student Name" }
    ]
  }
]

// Attendance data
{
  "class-id": {
    records: [
      { roll: 1, name: "Student Name", present: true }
    ],
    total_students: 25,
    present_count: 23,
    absent_count: 2
  }
}
```

## Troubleshooting

### Bluetooth Connection Issues

- Ensure you're using Chrome 70+ or Edge 79+
- Check that you're on HTTPS (required for Web Bluetooth)
- Make sure ESP32 is powered and advertising
- Try refreshing the page and reconnecting

### Database Connection Issues

- Verify MongoDB is running (if local)
- Check DATABASE_URL in .env file
- Ensure network connectivity to MongoDB Atlas (if cloud)

### ESP32 Issues

- Check ESP32 power and firmware
- Verify button and display connections
- Monitor serial output for errors
- Restart ESP32 if needed

### Build Issues

- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version (18+ required)

## Development

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.jsx         # Root layout
│   └── page.jsx           # Home page
├── components/            # React components
│   ├── ClassManager.jsx   # Class management
│   ├── BluetoothManager.jsx # ESP32 connection
│   └── AttendanceViewer.jsx # Attendance records
├── lib/                   # Utility libraries
│   ├── prisma.js          # Database client
│   └── bluetooth.js       # Bluetooth utilities
├── prisma/                # Database schema
│   └── schema.prisma      # Prisma schema
└── esp32-firmware/        # ESP32 firmware files
```

### Adding Features

1. Create new API routes in `app/api/`
2. Add React components in `components/`
3. Update database schema in `prisma/schema.prisma`
4. Run `npm run db:push` to apply changes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review ESP32 firmware documentation
3. Ensure proper hardware connections
4. Check browser console for errors
