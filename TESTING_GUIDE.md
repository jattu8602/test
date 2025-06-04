# 🧪 ESP32 Testing Guide

## Quick Testing Commands

Run these commands on your ESP32 to test different components:

### 1. 🔌 Test Basic Hardware

```python
# Connect to ESP32 via serial terminal (Thonny, PuTTY, etc.)
# Run each command one by one

# Test OLED Display
from esp32_firmware.display_manager import DisplayManager
display = DisplayManager()
display.show_message("TEST", "Display OK!")

# Test Buttons
from esp32_firmware.button_handler import ButtonHandler
buttons = ButtonHandler()
print("Press any button...")
event = buttons.get_event()
print(f"Button pressed: {event}")

# Test Data Storage
from esp32_firmware.data_manager import DataManager
dm = DataManager()
test_data = [{"id": "test", "name": "Test Class", "students": []}]
dm.save_classes(test_data)
print("Data saved:", dm.get_classes())
```

### 2. 📡 Test Bluetooth Functionality

```python
# Run the comprehensive BLE test
exec(open('examples/test_ble.py').read())
```

Expected output:

```
ESP32 Attendance System - BLE Test
==================================================
Testing BLE initialization...
✅ BLE server created successfully!
✅ BLE server started successfully!
Device name: ESP32-Attendance
Service UUID: 12345678-1234-1234-1234-123456789abc
✅ BLE server stopped successfully!

Testing data manager integration...
✅ Sample classes saved successfully!
✅ Classes loaded successfully!
✅ Sample attendance saved successfully!
✅ BLE server started with sample data!

Testing JSON operations...
JSON serialized: 143 characters
✅ JSON serialization/deserialization working!
Large JSON size: 5847 characters
✅ Large JSON within size limits!
✅ Large JSON parsing successful!

Testing memory usage...
Initial free memory: 118784 bytes
After DataManager: 118112 bytes (672 used)
After BLE server: 115200 bytes (2912 used)
After BLE start: 112256 bytes (2944 used)
After sample data: 108032 bytes (4224 used)
✅ Memory usage within acceptable limits!

Testing BLE advertising...
✅ BLE advertising started!
Device should be visible as: ESP32-Attendance
Advertising for 10 seconds...
ℹ️  No client connected (this is normal for automated testing)
✅ BLE advertising stopped!

Test Results: 5/5 tests passed
✅ All BLE tests passed!
```

### 3. 🎮 Test Button Navigation

```python
# Run the button test
exec(open('examples/test_buttons.py').read())
```

This will test:

- Button press detection
- Debouncing functionality
- Navigation logic
- Button combinations

### 4. 📺 Test Display Functions

```python
# Run the display test
exec(open('examples/test_display.py').read())
```

This will test:

- OLED initialization
- Text rendering
- Menu displays
- Animation effects

## 🔍 Step-by-Step Testing Process

### Phase 1: Hardware Verification

1. **Power on ESP32**

   ```
   Expected: OLED shows "ESP32 Attendance System Starting..."
   ```

2. **Test individual buttons**

   ```python
   # Test UP button
   from machine import Pin
   up_btn = Pin(16, Pin.IN, Pin.PULL_UP)
   print("UP button state:", not up_btn.value())
   ```

3. **Test I2C display**
   ```python
   from machine import I2C, Pin
   i2c = I2C(0, scl=Pin(22), sda=Pin(21))
   devices = i2c.scan()
   print("I2C devices found:", [hex(d) for d in devices])
   # Should show [0x3c] for OLED
   ```

### Phase 2: Software Component Testing

4. **Test BLE advertising**

   ```python
   from esp32_firmware.ble_server import AttendanceBLEServer
   from esp32_firmware.data_manager import DataManager

   ble = AttendanceBLEServer(DataManager())
   ble.start()
   print("BLE started. Check with BLE scanner app.")
   ```

5. **Test data persistence**

   ```python
   from esp32_firmware.data_manager import DataManager
   dm = DataManager()

   # Save test data
   classes = [{"id": "test1", "name": "Math", "students": []}]
   dm.save_classes(classes)

   # Restart ESP32 and verify data persists
   # Then run:
   loaded = dm.get_classes()
   print("Persisted data:", loaded)
   ```

### Phase 3: Integration Testing

6. **Test complete system**

   ```python
   # Start main application
   from esp32_firmware.main import AttendanceSystem
   system = AttendanceSystem()
   # This should initialize all components
   ```

7. **Test web app connection**
   - Open web app in Chrome
   - Navigate to "ESP32 Connection" tab
   - Click "Connect to ESP32"
   - Should see "ESP32-Attendance" in device list

## 🚨 Troubleshooting Test Failures

### BLE Test Failures

**Error: `bluetooth not available`**

```python
# Check if bluetooth module exists
import bluetooth
print("Bluetooth module available")

# Check BLE activation
ble = bluetooth.BLE()
ble.active(True)
print("BLE activated")
```

**Error: `characteristic setup failed`**

```python
# Check service registration
from esp32_firmware.config import Config
print("Service UUID:", Config.BLE_SERVICE_UUID)
print("Characteristics:", Config.CHAR_CLASS_DATA_UUID)
```

### Display Test Failures

**Error: `display not found`**

```python
# Manual I2C scan
from machine import I2C, Pin
i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
devices = i2c.scan()
print("Found devices:", [hex(d) for d in devices])

# If empty, check wiring
# If 0x3c found, check display initialization
```

**Error: `display initialization failed`**

```python
# Test basic display communication
from machine import I2C, Pin
import ssd1306

i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
oled.text("Test", 0, 0)
oled.show()
```

### Button Test Failures

**Error: `button not responding`**

```python
# Test raw GPIO
from machine import Pin
import time

button = Pin(16, Pin.IN, Pin.PULL_UP)
while True:
    print("Button state:", button.value())
    time.sleep(0.1)
```

### Memory Test Failures

**Error: `memory usage too high`**

```python
# Check available memory
import gc
gc.collect()
print("Free memory:", gc.mem_free())
print("Allocated memory:", gc.mem_alloc())

# If low, reduce data size or clear old data
```

## 📱 Testing with Web App

### Step 1: Browser Setup

1. Use **Chrome 70+** or **Edge 79+**
2. Ensure **HTTPS** connection
3. Enable **Bluetooth permissions**

### Step 2: Connection Test

```javascript
// Open browser console and run:
navigator.bluetooth
  .requestDevice({
    filters: [{ name: 'ESP32-Attendance' }],
    optionalServices: ['12345678-1234-1234-1234-123456789abc'],
  })
  .then((device) => {
    console.log('Device found:', device.name)
    return device.gatt.connect()
  })
  .then((server) => {
    console.log('Connected to:', server.device.name)
    return server.getPrimaryService('12345678-1234-1234-1234-123456789abc')
  })
  .then((service) => {
    console.log('Service found:', service.uuid)
  })
  .catch((error) => {
    console.error('Error:', error)
  })
```

### Step 3: Data Sync Test

1. Create a test class in web app
2. Add 2-3 students
3. Click "Sync to ESP32"
4. Check ESP32 display shows class count
5. Use buttons to navigate to class selection

## 📊 Performance Testing

### Memory Benchmarks

- **Idle system**: ~118KB free
- **With BLE active**: ~115KB free
- **With 5 classes (100 students)**: ~108KB free
- **Critical threshold**: <50KB free

### Bluetooth Range Testing

1. Connect ESP32 at 1 meter distance
2. Gradually increase distance
3. Test data sync at each distance
4. Expected range: 5-10 meters indoors

### Battery Life Testing (if using battery)

1. Fully charge battery
2. Run system continuously
3. Monitor voltage levels
4. Expected life: 8-12 hours with OLED on

## 🔄 Automated Testing

Create this script for regular testing:

```python
# auto_test.py
def run_all_tests():
    tests = [
        ("BLE", "examples/test_ble.py"),
        ("Display", "examples/test_display.py"),
        ("Buttons", "examples/test_buttons.py")
    ]

    results = {}
    for name, script in tests:
        try:
            exec(open(script).read())
            results[name] = "PASS"
        except Exception as e:
            results[name] = f"FAIL: {e}"

    print("\n=== Test Summary ===")
    for test, result in results.items():
        print(f"{test}: {result}")

# Run all tests
run_all_tests()
```

This testing guide ensures your ESP32 attendance system is working correctly before deployment!
