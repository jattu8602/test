# ESP32 Attendance System Firmware

This folder contains the MicroPython firmware for the ESP32-based attendance system. The system provides a Bluetooth LE interface for syncing with a web application and a local UI for taking attendance.

## Hardware Requirements

### ESP32 Development Board

- ESP32 DevKit or similar
- Minimum 4MB flash memory
- Bluetooth LE support

### OLED Display

- SSD1306 128x64 OLED display
- I2C interface
- 3.3V or 5V compatible

### Buttons

- 6 tactile push buttons
- Pull-up resistors (10kΩ recommended)
- Debouncing capacitors (optional but recommended)

### Power Supply

- 5V USB power or
- 3.7V Li-Po battery with voltage regulator
- Power switch (optional)

## Pin Connections

### OLED Display (I2C)

```
ESP32 Pin | OLED Pin | Description
----------|----------|------------
GPIO 21   | SDA      | I2C Data
GPIO 22   | SCL      | I2C Clock
3.3V      | VCC      | Power
GND       | GND      | Ground
```

### Buttons

```
ESP32 Pin | Button   | Description
----------|----------|------------------
GPIO 25   | UP       | Navigate up in menus
GPIO 26   | DOWN     | Navigate down in menus
GPIO 27   | SELECT   | Select/confirm action
GPIO 32   | PRESENT  | Mark student present
GPIO 33   | ABSENT   | Mark student absent
GPIO 35   | BACK     | Go back/cancel
```

### Button Wiring

Each button should be connected between the GPIO pin and GND, with the ESP32's internal pull-up resistor enabled.

```
GPIO Pin ----[Button]---- GND
```

## Software Requirements

### MicroPython

- MicroPython v1.19 or later
- ESP32 port with Bluetooth LE support

### Required Libraries

- `ssd1306` - OLED display driver
- `bluetooth` - Built-in BLE support
- Standard MicroPython libraries (json, os, gc, machine, time)

## Installation

### 1. Flash MicroPython

```bash
# Erase flash
esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash

# Flash MicroPython firmware
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 460800 write_flash -z 0x1000 esp32-20220618-v1.19.1.bin
```

### 2. Install SSD1306 Library

```python
# Connect to ESP32 via REPL
import upip
upip.install('micropython-ssd1306')
```

### 3. Upload Firmware Files

Upload all `.py` files to the ESP32 root directory:

- `boot.py`
- `main.py`
- `config.py`
- `ble_server.py`
- `display_manager.py`
- `button_handler.py`
- `data_manager.py`

### 4. Upload Tools

You can use any of these tools to upload files:

- **ampy**: `ampy --port /dev/ttyUSB0 put main.py`
- **rshell**: `rshell --port /dev/ttyUSB0`
- **Thonny IDE**: Built-in file manager
- **uPyCraft**: Drag and drop interface

## Configuration

### Pin Configuration

Edit `config.py` to match your hardware setup:

```python
# Button pins
BUTTON_UP_PIN = 25
BUTTON_DOWN_PIN = 26
BUTTON_SELECT_PIN = 27
BUTTON_PRESENT_PIN = 32
BUTTON_ABSENT_PIN = 33
BUTTON_BACK_PIN = 35

# I2C pins for OLED
I2C_SDA_PIN = 21
I2C_SCL_PIN = 22
```

### Bluetooth Configuration

The BLE service UUID and characteristics are pre-configured but can be modified in `config.py`:

```python
BLE_SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"
CHAR_CLASS_DATA_UUID = "12345678-1234-1234-1234-123456789abd"
# ... other UUIDs
```

## Usage

### 1. Power On

- Connect power to ESP32
- System will show "DEVICE ON" on OLED
- Bluetooth LE advertising starts automatically

### 2. Sync Data from Web App

- Connect to ESP32 from web application
- Use "Sync Data" button to transfer classes and students
- ESP32 will show confirmation when sync is complete

### 3. Take Attendance

- Press SELECT button to enter class selection
- Use UP/DOWN buttons to navigate classes
- Press SELECT to choose a class
- For each student:
  - Student info is displayed (roll number, name)
  - Press PRESENT or ABSENT button
  - System automatically advances to next student
- After last student, attendance is saved automatically

### 4. Upload Attendance to Web App

- Connect to ESP32 from web application
- Use "Download Attendance" to retrieve data
- Save to database from web app
- ESP32 attendance data is cleared after successful upload

## System States

### Main Menu

- Shows "DEVICE ON" and system status
- Press SELECT to start attendance

### Class Selection

- Shows list of available classes
- UP/DOWN to navigate
- SELECT to choose class
- BACK to return to main menu

### Attendance Taking

- Shows current student information
- PRESENT/ABSENT buttons to mark attendance
- Progress indicator shows current position
- BACK to cancel (data not saved)

### Error States

- No classes: Shows message to sync data first
- Attendance taken: Shows message that class already completed
- Storage full: Shows storage error message

## Troubleshooting

### Display Issues

- Check I2C connections (SDA, SCL)
- Verify OLED address (usually 0x3C)
- Check power supply (3.3V or 5V depending on module)

### Button Issues

- Verify GPIO pin connections
- Check for proper grounding
- Ensure pull-up resistors are working
- Test individual buttons using button test function

### Bluetooth Issues

- Ensure ESP32 has BLE support
- Check if other BLE devices are interfering
- Restart ESP32 to reset BLE stack
- Verify web app is using correct service UUID

### Memory Issues

- Monitor free memory: `gc.mem_free()`
- Reduce number of classes/students if needed
- Clear old attendance data regularly

### File System Issues

- Check available storage: `os.statvfs('/')`
- Clear old files if storage is full
- Verify JSON file integrity

## Development

### Testing Buttons

```python
from button_handler import ButtonHandler
buttons = ButtonHandler()
buttons.test_buttons(10000)  # Test for 10 seconds
```

### Testing Display

```python
from display_manager import DisplayManager
display = DisplayManager()
display.show_message("Test Message")
```

### Testing BLE

```python
from ble_server import AttendanceBLEServer
from data_manager import DataManager
data_mgr = DataManager()
ble = AttendanceBLEServer(data_mgr)
ble.start()
```

### Debug Output

Monitor serial output for system messages:

```bash
# Linux/Mac
screen /dev/ttyUSB0 115200

# Windows
putty -serial COM3 -sercfg 115200,8,n,1,N
```

## File Structure

```
esp32-firmware/
├── README.md              # This file
├── boot.py                # Boot configuration
├── main.py                # Main application entry point
├── config.py              # Hardware and system configuration
├── ble_server.py          # Bluetooth LE GATT server
├── display_manager.py     # OLED display management
├── button_handler.py      # Button input handling
├── data_manager.py        # File system and data management
└── examples/              # Example usage scripts
    ├── test_buttons.py    # Button testing
    ├── test_display.py    # Display testing
    └── test_ble.py        # BLE testing
```

## API Reference

### Main Classes

#### AttendanceSystem

Main system controller that coordinates all components.

#### DisplayManager

Handles OLED display operations and UI screens.

#### ButtonHandler

Manages button inputs with debouncing and event detection.

#### DataManager

Handles file system operations and data persistence.

#### AttendanceBLEServer

Implements Bluetooth LE GATT server for web app communication.

### Data Formats

#### Class Data

```json
{
  "id": "class-uuid",
  "name": "Class Name",
  "startRoll": 1,
  "students": [
    {
      "roll": 1,
      "name": "Student Name"
    }
  ]
}
```

#### Attendance Data

```json
{
  "class_id": "class-uuid",
  "records": [
    {
      "roll": 1,
      "name": "Student Name",
      "present": true
    }
  ],
  "timestamp": 1234567890,
  "total_students": 1,
  "present_count": 1,
  "absent_count": 0
}
```

## License

This project is part of the ESP32 Attendance System and follows the same license as the main project.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the main project documentation
3. Check hardware connections
4. Monitor serial output for error messages
