"""
ESP32 Attendance System Configuration
Pin assignments, BLE settings, and system constants
"""

class Config:
    # Hardware Pin Assignments
    BUTTON_UP_PIN = 25
    BUTTON_DOWN_PIN = 26
    BUTTON_SELECT_PIN = 27
    BUTTON_PRESENT_PIN = 32  # Green button for marking present
    BUTTON_ABSENT_PIN = 33   # Red button for marking absent
    BUTTON_BACK_PIN = 35     # Back/Cancel button

    # ========== CUSTOMIZE YOUR PINS HERE ==========
    # If your buttons are wired differently, change these pin numbers:
    # BUTTON_UP_PIN = 25      # Change to your UP button pin
    # BUTTON_DOWN_PIN = 26    # Change to your DOWN button pin
    # BUTTON_SELECT_PIN = 27  # Change to your SELECT button pin
    # BUTTON_PRESENT_PIN = 32 # Change to your PRESENT button pin
    # BUTTON_ABSENT_PIN = 33  # Change to your ABSENT button pin
    # BUTTON_BACK_PIN = 35    # Change to your BACK button pin
    # ===============================================

    # OLED Display I2C Configuration
    I2C_SDA_PIN = 21
    I2C_SCL_PIN = 22
    I2C_FREQ = 400000
    OLED_WIDTH = 128
    OLED_HEIGHT = 64
    OLED_ADDRESS = 0x3C

    # BLE Configuration
    BLE_DEVICE_NAME = "ESP32-Attendance"
    BLE_SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"

    # BLE Characteristics UUIDs
    CHAR_CLASS_DATA_UUID = "12345678-1234-1234-1234-123456789abd"
    CHAR_STORAGE_INFO_UUID = "12345678-1234-1234-1234-123456789abe"
    CHAR_ATTENDANCE_DATA_UUID = "12345678-1234-1234-1234-123456789abf"
    CHAR_COMMAND_UUID = "12345678-1234-1234-1234-123456789ac0"

    # File System Paths
    CLASSES_FILE = "/classes.json"
    ATTENDANCE_FILE = "/attendance.json"
    CONFIG_FILE = "/config.json"

    # System Settings
    BUTTON_DEBOUNCE_MS = 200
    DISPLAY_REFRESH_MS = 100
    BLE_TIMEOUT_MS = 30000
    MAX_CLASSES = 20
    MAX_STUDENTS_PER_CLASS = 100

    # Display Settings
    FONT_SIZE = 8
    LINE_HEIGHT = 10
    SCROLL_DELAY_MS = 500

    # Memory Management
    MIN_FREE_MEMORY = 10000  # Minimum free memory before garbage collection
    MAX_JSON_SIZE = 8192     # Maximum size for JSON data transfer

    # Error Messages
    ERROR_MESSAGES = {
        'NO_CLASSES': 'No classes found!\nSync data first.',
        'ATTENDANCE_TAKEN': 'Attendance already\ntaken for this class!',
        'SAVE_ERROR': 'Error saving\nattendance data!',
        'MEMORY_LOW': 'Low memory!\nRestarting...',
        'BLE_ERROR': 'Bluetooth error!\nCheck connection.',
        'STORAGE_FULL': 'Storage full!\nClear old data.'
    }

    # Success Messages
    SUCCESS_MESSAGES = {
        'ATTENDANCE_SAVED': 'Attendance completed\nand saved!',
        'DATA_SYNCED': 'Data synced\nsuccessfully!',
        'DATA_CLEARED': 'Data cleared\nsuccessfully!'
    }

    @staticmethod
    def get_storage_info():
        """Get storage information"""
        import os
        try:
            stat = os.statvfs('/')
            total = stat[0] * stat[2]
            free = stat[0] * stat[3]
            used = total - free
            return {
                'total': total,
                'used': used,
                'free': free,
                'percent_used': (used / total) * 100 if total > 0 else 0
            }
        except:
            return {
                'total': 0,
                'used': 0,
                'free': 0,
                'percent_used': 0
            }