# ESP32 Attendance System - Complete Setup Guide

## 🔧 Hardware Requirements

- **ESP32 Development Board** (ESP32-WROOM-32 or similar)
- **OLED Display** (128x64, I2C interface - SSD1306)
- **Push Buttons** (4x for navigation: UP, DOWN, SELECT, BACK)
- **Resistors** (4x 10kΩ for button pull-ups)
- **Breadboard and jumper wires**
- **USB cable** for programming

## 📋 Hardware Wiring

### OLED Display (I2C)

```
ESP32 Pin    ->    OLED Pin
GPIO 21      ->    SDA
GPIO 22      ->    SCL
3.3V         ->    VCC
GND          ->    GND
```

### Buttons

```
ESP32 Pin    ->    Button Function
GPIO 16      ->    UP Button
GPIO 17      ->    DOWN Button
GPIO 18      ->    SELECT Button
GPIO 19      ->    BACK Button
```

Each button should be connected between the GPIO pin and GND, with a 10kΩ pull-up resistor to 3.3V.

## 💻 Software Setup

### 1. Install MicroPython on ESP32

1. **Download ESP32 MicroPython firmware:**

   ```bash
   # Download latest MicroPython firmware for ESP32
   wget https://micropython.org/resources/firmware/esp32-20231227-v1.22.0.bin
   ```

2. **Install esptool:**

   ```bash
   pip install esptool
   ```

3. **Erase flash and install MicroPython:**

   ```bash
   # Erase flash (replace /dev/ttyUSB0 with your port)
   esptool.py --port /dev/ttyUSB0 erase_flash

   # Flash MicroPython firmware
   esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash -z 0x1000 esp32-20231227-v1.22.0.bin
   ```

### 2. Upload Firmware Files

Upload all files from the `esp32-firmware` directory to your ESP32:

**Required files:**

- `main.py` - Main application entry point
- `ble_server.py` - Bluetooth LE GATT server
- `display_manager.py` - OLED display controller
- `button_handler.py` - Button input manager
- `data_manager.py` - Data storage and management
- `config.py` - Configuration settings
- `boot.py` - Boot configuration

**Upload using a tool like Thonny, ampy, or rshell:**

```bash
# Using ampy (install with: pip install adafruit-ampy)
ampy --port /dev/ttyUSB0 put esp32-firmware/main.py
ampy --port /dev/ttyUSB0 put esp32-firmware/ble_server.py
ampy --port /dev/ttyUSB0 put esp32-firmware/display_manager.py
ampy --port /dev/ttyUSB0 put esp32-firmware/button_handler.py
ampy --port /dev/ttyUSB0 put esp32-firmware/data_manager.py
ampy --port /dev/ttyUSB0 put esp32-firmware/config.py
ampy --port /dev/ttyUSB0 put esp32-firmware/boot.py
```

## 🚀 First Time Setup

### 1. Power On and Check Display

1. Connect ESP32 to power via USB
2. The OLED should show:
   ```
   ESP32 Attendance
   System Starting...
   ```
3. After initialization:
   ```
   Main Menu
   [SELECT] Start
   Device: Ready
   ```

### 2. Test Buttons

- **UP/DOWN**: Navigate menus
- **SELECT**: Confirm selection
- **BACK**: Go back/cancel

### 3. Enable Bluetooth

The device will automatically start advertising as "ESP32-Attendance" when powered on.

## 🌐 Web Application Connection

### 1. Browser Requirements

**Supported Browsers:**

- Chrome 70+ (Desktop/Android)
- Edge 79+ (Desktop)
- Opera 71+ (Desktop)

**Requirements:**

- **HTTPS connection** (required for Web Bluetooth)
- **Bluetooth permissions** enabled

### 2. Connect to ESP32

1. **Open your web app** in supported browser
2. **Navigate to "ESP32 Connection" tab**
3. **Click "Connect to ESP32"**
4. **Select device** from browser popup:
   - Look for "ESP32-Attendance"
   - Click "Pair"

### 3. Sync Data

1. **Create classes** in the web interface
2. **Add students** to each class
3. **Click "Sync to ESP32"** to transfer data
4. **Verify sync** - ESP32 display should show class count

## 🔧 Troubleshooting

### Connection Issues

**Problem:** ESP32 not found during scanning

```
Solution:
1. Check ESP32 is powered on
2. Verify Bluetooth is enabled on computer
3. Try resetting ESP32
4. Check serial monitor for error messages
```

**Problem:** Connection timeout

```
Solution:
1. Move closer to ESP32 (within 10 meters)
2. Restart both ESP32 and browser
3. Clear browser Bluetooth cache
4. Try different browser
```

**Problem:** Permission denied

```
Solution:
1. Use HTTPS (not HTTP)
2. Enable Bluetooth permissions in browser
3. Try Chrome's experimental features: chrome://flags/#enable-experimental-web-platform-features
```

### Hardware Issues

**Problem:** OLED display not working

```
Solution:
1. Check I2C wiring (SDA, SCL)
2. Verify power connections (3.3V, GND)
3. Test with I2C scanner code
4. Check display address (usually 0x3C)
```

**Problem:** Buttons not responding

```
Solution:
1. Check button wiring and pull-up resistors
2. Test GPIO pins with multimeter
3. Verify button debouncing is working
4. Check for loose connections
```

### Software Issues

**Problem:** MicroPython import errors

```
Solution:
1. Verify all files are uploaded
2. Check file names match exactly
3. Restart ESP32 after upload
4. Check for syntax errors in uploaded files
```

## 🧪 Testing Guide

### Basic Functionality Test

```python
# Run this in ESP32 REPL to test basic functions
from ble_server import AttendanceBLEServer
from data_manager import DataManager

# Test data manager
dm = DataManager()
print("Data manager OK")

# Test BLE server
ble = AttendanceBLEServer(dm)
print("BLE server OK")

# Start advertising
ble.start()
print("BLE advertising started")
```

### Hardware Test

```python
# Test display
from display_manager import DisplayManager
display = DisplayManager()
display.show_message("Test Display", "Working!")

# Test buttons
from button_handler import ButtonHandler
buttons = ButtonHandler()
print("Press any button...")
while True:
    event = buttons.get_event()
    if event:
        print(f"Button pressed: {event}")
        break
```

### Web Bluetooth Test

1. Open browser developer console
2. Navigate to ESP32 Connection tab
3. Open console and run:

```javascript
// Check Bluetooth support
console.log('Bluetooth supported:', 'bluetooth' in navigator)

// Test permissions
navigator.permissions.query({ name: 'bluetooth' }).then((result) => {
  console.log('Bluetooth permission:', result.state)
})
```

## 📊 Performance Optimization

### Memory Management

- ESP32 has limited RAM (~320KB available)
- Large class lists may cause memory issues
- Recommended: Max 10 classes with 50 students each

### Battery Usage

- OLED display consumes most power
- Consider auto-sleep after inactivity
- Bluetooth Low Energy is already optimized

### Range and Reliability

- Bluetooth LE range: ~10 meters indoors
- Obstacles reduce range significantly
- Keep devices close during data sync

## 🔄 Regular Maintenance

### Weekly Tasks

1. **Backup data** from ESP32 to web app
2. **Clear old attendance** records if storage is full
3. **Check battery level** (if using battery power)

### Monthly Tasks

1. **Update firmware** if new versions available
2. **Clean hardware** connections
3. **Test all buttons** and display

### Firmware Updates

1. Download new firmware files
2. Upload via same method as initial setup
3. Data is preserved in flash storage

## 📞 Support

If you encounter issues:

1. **Check serial monitor** for error messages
2. **Review wiring** against the diagrams
3. **Test individual components** separately
4. **Check browser compatibility** and permissions

**Common Error Codes:**

- `BLE_INIT_FAILED`: Bluetooth hardware issue
- `DISPLAY_NOT_FOUND`: I2C connection problem
- `STORAGE_FULL`: Clear old data or expand storage
- `JSON_PARSE_ERROR`: Data corruption, re-sync from web app
