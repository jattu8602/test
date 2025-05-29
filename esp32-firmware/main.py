"""
ESP32 Attendance System - Main Entry Point
Bluetooth LE GATT Server with OLED Display and Button Interface
"""

import gc
import time
import json
from machine import Pin, I2C, reset
from ble_server import AttendanceBLEServer
from display_manager import DisplayManager
from button_handler import ButtonHandler
from data_manager import DataManager
from config import Config

class AttendanceSystem:
    def __init__(self):
        print("Initializing ESP32 Attendance System...")

        # Initialize components
        self.config = Config()
        self.data_manager = DataManager()
        self.display = DisplayManager()
        self.buttons = ButtonHandler()
        self.ble_server = AttendanceBLEServer(self.data_manager)

        # System state
        self.current_state = "MAIN_MENU"  # MAIN_MENU, CLASS_SELECTION, ATTENDANCE_TAKING
        self.selected_class_index = 0
        self.current_student_index = 0
        self.attendance_session = None

        # Show startup message
        self.display.show_startup()
        time.sleep(2)

        print("System initialized successfully!")

    def run(self):
        """Main system loop"""
        try:
            # Start BLE server
            self.ble_server.start()
            self.display.show_device_on()

            while True:
                # Handle button inputs
                button_event = self.buttons.get_event()

                if button_event:
                    self.handle_button_event(button_event)

                # Update display based on current state
                self.update_display()

                # Handle BLE events
                self.ble_server.handle_events()

                # Small delay to prevent excessive CPU usage
                time.sleep_ms(50)

                # Garbage collection
                if gc.mem_free() < 10000:
                    gc.collect()

        except KeyboardInterrupt:
            print("System interrupted by user")
        except Exception as e:
            print(f"System error: {e}")
            self.display.show_error(str(e))
            time.sleep(5)
            reset()

    def handle_button_event(self, event):
        """Handle button press events based on current state"""
        if self.current_state == "MAIN_MENU":
            self.handle_main_menu_buttons(event)
        elif self.current_state == "CLASS_SELECTION":
            self.handle_class_selection_buttons(event)
        elif self.current_state == "ATTENDANCE_TAKING":
            self.handle_attendance_buttons(event)

    def handle_main_menu_buttons(self, event):
        """Handle buttons in main menu state"""
        if event == "SELECT":
            # Check if we have classes loaded
            classes = self.data_manager.get_classes()
            if classes:
                self.current_state = "CLASS_SELECTION"
                self.selected_class_index = 0
            else:
                self.display.show_message("No classes found!\nSync data first.")
                time.sleep(2)

    def handle_class_selection_buttons(self, event):
        """Handle buttons in class selection state"""
        classes = self.data_manager.get_classes()

        if event == "UP":
            self.selected_class_index = (self.selected_class_index - 1) % len(classes)
        elif event == "DOWN":
            self.selected_class_index = (self.selected_class_index + 1) % len(classes)
        elif event == "SELECT":
            selected_class = classes[self.selected_class_index]

            # Check if attendance already taken for this class
            if self.data_manager.is_attendance_taken(selected_class['id']):
                self.display.show_message("Attendance already\ntaken for this class!")
                time.sleep(2)
                return

            # Start attendance session
            self.start_attendance_session(selected_class)
        elif event == "BACK":
            self.current_state = "MAIN_MENU"

    def handle_attendance_buttons(self, event):
        """Handle buttons during attendance taking"""
        if event == "PRESENT":
            self.mark_student_present()
        elif event == "ABSENT":
            self.mark_student_absent()
        elif event == "BACK":
            self.cancel_attendance_session()

    def start_attendance_session(self, class_data):
        """Start taking attendance for a class"""
        self.attendance_session = {
            'class_id': class_data['id'],
            'class_name': class_data['name'],
            'students': class_data['students'],
            'records': [],
            'current_index': 0
        }
        self.current_student_index = 0
        self.current_state = "ATTENDANCE_TAKING"

        print(f"Started attendance for class: {class_data['name']}")

    def mark_student_present(self):
        """Mark current student as present and advance"""
        self.mark_student(True)

    def mark_student_absent(self):
        """Mark current student as absent and advance"""
        self.mark_student(False)

    def mark_student(self, is_present):
        """Mark student attendance and advance to next"""
        if not self.attendance_session:
            return

        students = self.attendance_session['students']
        current_student = students[self.current_student_index]

        # Record attendance
        record = {
            'roll': current_student['roll'],
            'name': current_student['name'],
            'present': is_present
        }
        self.attendance_session['records'].append(record)

        print(f"Marked {current_student['name']} as {'Present' if is_present else 'Absent'}")

        # Advance to next student
        self.current_student_index += 1

        # Check if we've completed all students
        if self.current_student_index >= len(students):
            self.complete_attendance_session()

    def complete_attendance_session(self):
        """Complete attendance session and save data"""
        if not self.attendance_session:
            return

        # Save attendance data
        success = self.data_manager.save_attendance(
            self.attendance_session['class_id'],
            self.attendance_session['records']
        )

        if success:
            self.display.show_message("Attendance completed\nand saved!")
            print(f"Attendance saved for class: {self.attendance_session['class_name']}")
        else:
            self.display.show_message("Error saving\nattendance!")

        time.sleep(3)

        # Reset to class selection
        self.attendance_session = None
        self.current_state = "CLASS_SELECTION"

    def cancel_attendance_session(self):
        """Cancel current attendance session"""
        if self.attendance_session:
            self.display.show_message("Attendance cancelled!\nData not saved.")
            time.sleep(2)
            self.attendance_session = None
            self.current_state = "CLASS_SELECTION"

    def update_display(self):
        """Update display based on current state"""
        if self.current_state == "MAIN_MENU":
            self.display.show_main_menu()
        elif self.current_state == "CLASS_SELECTION":
            classes = self.data_manager.get_classes()
            if classes:
                self.display.show_class_selection(classes, self.selected_class_index)
        elif self.current_state == "ATTENDANCE_TAKING":
            if self.attendance_session:
                students = self.attendance_session['students']
                if self.current_student_index < len(students):
                    current_student = students[self.current_student_index]
                    progress = f"{self.current_student_index + 1}/{len(students)}"
                    self.display.show_attendance_screen(
                        current_student,
                        progress,
                        self.attendance_session['class_name']
                    )

# Main execution
if __name__ == "__main__":
    try:
        system = AttendanceSystem()
        system.run()
    except Exception as e:
        print(f"Fatal error: {e}")
        # Try to show error on display if possible
        try:
            from display_manager import DisplayManager
            display = DisplayManager()
            display.show_error(str(e))
        except:
            pass
        time.sleep(10)
        reset()