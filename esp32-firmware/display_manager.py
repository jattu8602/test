"""
ESP32 Attendance System - Display Manager
Handles OLED display operations and UI screens
"""

from machine import Pin, I2C
import ssd1306
import time
from config import Config

class DisplayManager:
    def __init__(self):
        # Initialize I2C and OLED display
        self.i2c = I2C(
            0,
            sda=Pin(Config.I2C_SDA_PIN),
            scl=Pin(Config.I2C_SCL_PIN),
            freq=Config.I2C_FREQ
        )

        self.oled = ssd1306.SSD1306_I2C(
            Config.OLED_WIDTH,
            Config.OLED_HEIGHT,
            self.i2c,
            addr=Config.OLED_ADDRESS
        )

        # Display state
        self.current_screen = None
        self.last_update = 0

        print("Display manager initialized")
        self.clear()

    def clear(self):
        """Clear the display"""
        self.oled.fill(0)
        self.oled.show()

    def show_text(self, text, x=0, y=0, clear=True):
        """Show text on display"""
        if clear:
            self.oled.fill(0)
        self.oled.text(text, x, y)
        self.oled.show()

    def show_multiline_text(self, lines, clear=True):
        """Show multiple lines of text"""
        if clear:
            self.oled.fill(0)

        for i, line in enumerate(lines):
            if i * Config.LINE_HEIGHT < Config.OLED_HEIGHT:
                self.oled.text(line, 0, i * Config.LINE_HEIGHT)

        self.oled.show()

    def show_startup(self):
        """Show startup screen"""
        self.current_screen = "startup"
        lines = [
            "ESP32 Attendance",
            "System v1.0",
            "",
            "Initializing...",
            "",
            "Please wait..."
        ]
        self.show_multiline_text(lines)

    def show_device_on(self):
        """Show device on screen"""
        self.current_screen = "device_on"
        lines = [
            "=== DEVICE ON ===",
            "",
            "Status: Ready",
            "BLE: Advertising",
            "",
            "Press SELECT to",
            "start attendance"
        ]
        self.show_multiline_text(lines)

    def show_main_menu(self):
        """Show main menu"""
        self.current_screen = "main_menu"
        lines = [
            "=== MAIN MENU ===",
            "",
            "SELECT: Start",
            "        Attendance",
            "",
            "Waiting for",
            "button press..."
        ]
        self.show_multiline_text(lines)

    def show_class_selection(self, classes, selected_index):
        """Show class selection screen"""
        self.current_screen = "class_selection"
        self.oled.fill(0)

        # Title
        self.oled.text("Select Class:", 0, 0)

        # Show classes with selection indicator
        start_y = 15
        visible_classes = 4  # Number of classes visible at once

        # Calculate scroll offset
        scroll_offset = max(0, selected_index - visible_classes + 1)

        for i in range(visible_classes):
            class_index = scroll_offset + i
            if class_index < len(classes):
                class_data = classes[class_index]
                class_name = class_data['name']

                # Truncate long names
                if len(class_name) > 15:
                    class_name = class_name[:12] + "..."

                y_pos = start_y + (i * 10)

                # Show selection indicator
                if class_index == selected_index:
                    self.oled.text(">", 0, y_pos)
                    self.oled.text(class_name, 10, y_pos)
                else:
                    self.oled.text(class_name, 10, y_pos)

        # Show navigation hints
        if len(classes) > 0:
            self.oled.text("UP/DOWN: Navigate", 0, 55)

        self.oled.show()

    def show_attendance_screen(self, student, progress, class_name):
        """Show attendance taking screen"""
        self.current_screen = "attendance"
        self.oled.fill(0)

        # Class name (truncated)
        if len(class_name) > 16:
            class_name = class_name[:13] + "..."
        self.oled.text(class_name, 0, 0)

        # Progress
        self.oled.text(f"Progress: {progress}", 0, 10)

        # Student info
        self.oled.text(f"Roll: {student['roll']}", 0, 25)

        # Student name (truncated and wrapped)
        name = student['name']
        if len(name) > 16:
            # Split long names
            self.oled.text(name[:16], 0, 35)
            if len(name) > 16:
                self.oled.text(name[16:32], 0, 45)
        else:
            self.oled.text(name, 0, 35)

        # Instructions
        self.oled.text("P:Present A:Absent", 0, 55)

        self.oled.show()

    def show_message(self, message, duration=None):
        """Show a message screen"""
        self.current_screen = "message"
        lines = message.split('\n')

        # Center the message
        self.oled.fill(0)
        start_y = max(0, (Config.OLED_HEIGHT - len(lines) * Config.LINE_HEIGHT) // 2)

        for i, line in enumerate(lines):
            if line.strip():  # Skip empty lines
                # Center text horizontally
                text_width = len(line) * 8  # Approximate character width
                x_pos = max(0, (Config.OLED_WIDTH - text_width) // 2)
                self.oled.text(line, x_pos, start_y + i * Config.LINE_HEIGHT)

        self.oled.show()

        if duration:
            time.sleep(duration)

    def show_error(self, error_message):
        """Show error screen"""
        self.current_screen = "error"
        self.oled.fill(0)

        # Error header
        self.oled.text("ERROR!", 35, 0)

        # Error message
        lines = error_message.split('\n')
        for i, line in enumerate(lines):
            if i < 5:  # Limit to 5 lines
                self.oled.text(line[:16], 0, 15 + i * 10)

        self.oled.show()

    def show_success(self, message):
        """Show success screen"""
        self.current_screen = "success"
        self.oled.fill(0)

        # Success header
        self.oled.text("SUCCESS!", 25, 0)

        # Success message
        lines = message.split('\n')
        for i, line in enumerate(lines):
            if i < 4:  # Limit to 4 lines
                self.oled.text(line[:16], 0, 20 + i * 10)

        self.oled.show()

    def show_bluetooth_status(self, connected=False, device_name=""):
        """Show Bluetooth connection status"""
        self.current_screen = "bluetooth"
        self.oled.fill(0)

        self.oled.text("Bluetooth Status", 0, 0)

        if connected:
            self.oled.text("Status: Connected", 0, 15)
            if device_name:
                # Truncate device name if too long
                if len(device_name) > 16:
                    device_name = device_name[:13] + "..."
                self.oled.text(f"Device: {device_name}", 0, 25)
        else:
            self.oled.text("Status: Advertising", 0, 15)
            self.oled.text("Waiting for", 0, 25)
            self.oled.text("connection...", 0, 35)

        self.oled.show()

    def show_storage_info(self, storage_info):
        """Show storage information"""
        self.current_screen = "storage"
        self.oled.fill(0)

        self.oled.text("Storage Info", 0, 0)

        total_mb = storage_info['total'] / (1024 * 1024)
        used_mb = storage_info['used'] / (1024 * 1024)
        free_mb = storage_info['free'] / (1024 * 1024)

        self.oled.text(f"Total: {total_mb:.1f}MB", 0, 15)
        self.oled.text(f"Used:  {used_mb:.1f}MB", 0, 25)
        self.oled.text(f"Free:  {free_mb:.1f}MB", 0, 35)
        self.oled.text(f"Usage: {storage_info['percent_used']:.1f}%", 0, 45)

        self.oled.show()

    def show_attendance_complete(self, class_name, total_students):
        """Show attendance completion screen"""
        self.current_screen = "complete"
        self.oled.fill(0)

        self.oled.text("ATTENDANCE", 15, 0)
        self.oled.text("COMPLETED!", 15, 10)

        # Class info
        if len(class_name) > 16:
            class_name = class_name[:13] + "..."
        self.oled.text(f"Class: {class_name}", 0, 25)
        self.oled.text(f"Students: {total_students}", 0, 35)

        self.oled.text("Data saved!", 20, 50)

        self.oled.show()

    def show_no_classes(self):
        """Show no classes available screen"""
        self.current_screen = "no_classes"
        lines = [
            "No Classes Found!",
            "",
            "Please sync data",
            "from web app first.",
            "",
            "Connect via",
            "Bluetooth to sync."
        ]
        self.show_multiline_text(lines)

    def show_attendance_taken(self, class_name):
        """Show attendance already taken screen"""
        self.current_screen = "taken"
        self.oled.fill(0)

        self.oled.text("ATTENDANCE", 15, 0)
        self.oled.text("ALREADY TAKEN", 5, 10)

        if len(class_name) > 16:
            class_name = class_name[:13] + "..."
        self.oled.text(f"Class: {class_name}", 0, 25)

        self.oled.text("Choose another", 10, 40)
        self.oled.text("class or wait", 15, 50)

        self.oled.show()

    def update(self):
        """Update display if needed"""
        current_time = time.ticks_ms()
        if time.ticks_diff(current_time, self.last_update) > Config.DISPLAY_REFRESH_MS:
            # Refresh current screen if needed
            self.last_update = current_time

    def get_current_screen(self):
        """Get current screen name"""
        return self.current_screen