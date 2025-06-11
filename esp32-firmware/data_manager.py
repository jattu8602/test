"""
ESP32 Attendance System - Data Manager
Handles file system operations and data persistence
"""

import json
import os
import gc
from config import Config

class DataManager:
    def __init__(self):
        self.classes_data = []
        self.attendance_data = {}

        # Load existing data
        self.load_classes()
        self.load_attendance()

        print("Data manager initialized")

    def save_classes(self, classes_data):
        """Save classes data to file system"""
        try:
            # Validate data structure
            if not isinstance(classes_data, list):
                print("Error: Classes data must be a list")
                return False

            # Validate each class
            for class_item in classes_data:
                if not self._validate_class_data(class_item):
                    print(f"Error: Invalid class data structure: {class_item}")
                    return False

            # Save to file
            with open(Config.CLASSES_FILE, 'w') as f:
                json.dump(classes_data, f)

            # Update in-memory data
            self.classes_data = classes_data

            print(f"Saved {len(classes_data)} classes to file system")
            return True

        except Exception as e:
            print(f"Error saving classes: {e}")
            return False

    def load_classes(self):
        """Load classes data from file system"""
        try:
            if self._file_exists(Config.CLASSES_FILE):
                with open(Config.CLASSES_FILE, 'r') as f:
                    self.classes_data = json.load(f)
                print(f"Loaded {len(self.classes_data)} classes from file system")
            else:
                self.classes_data = []
                print("No classes file found, starting with empty data")
            return True

        except Exception as e:
            print(f"Error loading classes: {e}")
            self.classes_data = []
            return False

    def get_classes(self):
        """Get all classes data"""
        return self.classes_data

    def get_class_by_id(self, class_id):
        """Get specific class by ID"""
        for class_item in self.classes_data:
            if class_item.get('id') == class_id:
                return class_item
        return None





    def save_attendance(self, class_id, attendance_records):
        """Save attendance data for a specific class"""
        try:
            # Validate attendance records
            if not isinstance(attendance_records, list):
                print("Error: Attendance records must be a list")
                return False

            for record in attendance_records:
                if not self._validate_attendance_record(record):
                    print(f"Error: Invalid attendance record: {record}")
                    return False

            # Load existing attendance data
            self.load_attendance()

            # Add new attendance data
            self.attendance_data[class_id] = {
                'class_id': class_id,
                'records': attendance_records,
                'timestamp': self._get_timestamp(),
                'total_students': len(attendance_records),
                'present_count': sum(1 for r in attendance_records if r.get('present', False)),
                'absent_count': sum(1 for r in attendance_records if not r.get('present', False))
            }

            # Save to file
            with open(Config.ATTENDANCE_FILE, 'w') as f:
                json.dump(self.attendance_data, f)

            print(f"Saved attendance for class {class_id} with {len(attendance_records)} records")
            return True

        except Exception as e:
            print(f"Error saving attendance: {e}")
            return False

    def load_attendance(self):
        """Load attendance data from file system"""
        try:
            if self._file_exists(Config.ATTENDANCE_FILE):
                with open(Config.ATTENDANCE_FILE, 'r') as f:
                    self.attendance_data = json.load(f)
                print(f"Loaded attendance data for {len(self.attendance_data)} classes")
            else:
                self.attendance_data = {}
                print("No attendance file found, starting with empty data")
            return True

        except Exception as e:
            print(f"Error loading attendance: {e}")
            self.attendance_data = {}
            return False

    def get_attendance(self, class_id):
        """Get attendance data for a specific class"""
        return self.attendance_data.get(class_id)

    def get_all_attendance(self):
        """Get all attendance data"""
        return self.attendance_data

    def is_attendance_taken(self, class_id):
        """Check if attendance has been taken for a class"""
        return class_id in self.attendance_data

    def clear_attendance(self, class_id):
        """Clear attendance data for a specific class"""
        try:
            if class_id in self.attendance_data:
                del self.attendance_data[class_id]

                # Save updated data
                with open(Config.ATTENDANCE_FILE, 'w') as f:
                    json.dump(self.attendance_data, f)

                print(f"Cleared attendance for class {class_id}")
                return True
            else:
                print(f"No attendance data found for class {class_id}")
                return False

        except Exception as e:
            print(f"Error clearing attendance: {e}")
            return False

    def clear_all_attendance(self):
        """Clear all attendance data"""
        try:
            self.attendance_data = {}

            # Save empty data
            with open(Config.ATTENDANCE_FILE, 'w') as f:
                json.dump(self.attendance_data, f)

            print("Cleared all attendance data")
            return True

        except Exception as e:
            print(f"Error clearing all attendance: {e}")
            return False

    def get_storage_usage(self):
        """Get storage usage information"""
        try:
            classes_size = self._get_file_size(Config.CLASSES_FILE)
            attendance_size = self._get_file_size(Config.ATTENDANCE_FILE)
            config_size = self._get_file_size(Config.CONFIG_FILE)

            total_used = classes_size + attendance_size + config_size

            return {
                'classes_file_size': classes_size,
                'attendance_file_size': attendance_size,
                'config_file_size': config_size,
                'total_app_usage': total_used,
                'system_info': Config.get_storage_info()
            }

        except Exception as e:
            print(f"Error getting storage usage: {e}")
            return None

    def export_data(self):
        """Export all data for backup or transfer"""
        try:
            export_data = {
                'classes': self.classes_data,
                'attendance': self.attendance_data,
                'export_timestamp': self._get_timestamp(),
                'version': '1.0'
            }
            return export_data

        except Exception as e:
            print(f"Error exporting data: {e}")
            return None

    def import_data(self, import_data):
        """Import data from backup or transfer"""
        try:
            if not isinstance(import_data, dict):
                print("Error: Import data must be a dictionary")
                return False

            # Validate structure
            if 'classes' not in import_data or 'attendance' not in import_data:
                print("Error: Import data missing required fields")
                return False

            # Backup current data
            backup_classes = self.classes_data.copy()
            backup_attendance = self.attendance_data.copy()

            try:
                # Import classes
                if self.save_classes(import_data['classes']):
                    # Import attendance
                    self.attendance_data = import_data['attendance']
                    with open(Config.ATTENDANCE_FILE, 'w') as f:
                        json.dump(self.attendance_data, f)

                    print("Data imported successfully")
                    return True
                else:
                    raise Exception("Failed to import classes")

            except Exception as e:
                # Restore backup on failure
                self.classes_data = backup_classes
                self.attendance_data = backup_attendance
                print(f"Import failed, restored backup: {e}")
                return False

        except Exception as e:
            print(f"Error importing data: {e}")
            return False

    def _validate_class_data(self, class_data):
        """Validate class data structure"""
        required_fields = ['id', 'name', 'students']

        if not isinstance(class_data, dict):
            return False

        for field in required_fields:
            if field not in class_data:
                return False

        # Validate students list
        if not isinstance(class_data['students'], list):
            return False

        for student in class_data['students']:
            if not self._validate_student_data(student):
                return False

        return True

    def _validate_student_data(self, student_data):
        """Validate student data structure"""
        required_fields = ['roll', 'name']

        if not isinstance(student_data, dict):
            return False

        for field in required_fields:
            if field not in student_data:
                return False

        # Validate roll number is integer
        if not isinstance(student_data['roll'], int):
            return False

        # Validate name is string
        if not isinstance(student_data['name'], str):
            return False

        return True

    def _validate_attendance_record(self, record):
        """Validate attendance record structure"""
        required_fields = ['roll', 'name', 'present']

        if not isinstance(record, dict):
            return False

        for field in required_fields:
            if field not in record:
                return False

        # Validate types
        if not isinstance(record['roll'], int):
            return False

        if not isinstance(record['name'], str):
            return False

        if not isinstance(record['present'], bool):
            return False

        return True

    def _file_exists(self, filename):
        """Check if file exists"""
        try:
            os.stat(filename)
            return True
        except OSError:
            return False

    def _get_file_size(self, filename):
        """Get file size in bytes"""
        try:
            if self._file_exists(filename):
                return os.stat(filename)[6]  # Size is at index 6
            return 0
        except:
            return 0

    def _get_timestamp(self):
        """Get current timestamp (simple counter since no RTC)"""
        import time
        return time.ticks_ms()

    def cleanup_old_data(self, max_age_ms=None):
        """Clean up old data files (if needed)"""
        try:
            # This is a placeholder for future implementation
            # Could implement based on timestamp or file age
            print("Cleanup completed")
            return True
        except Exception as e:
            print(f"Error during cleanup: {e}")
            return False

    def get_statistics(self):
        """Get data statistics"""
        try:
            stats = {
                'total_classes': len(self.classes_data),
                'total_students': sum(len(c.get('students', [])) for c in self.classes_data),
                'classes_with_attendance': len(self.attendance_data),
                'total_attendance_records': sum(len(a.get('records', [])) for a in self.attendance_data.values()),
                'storage_usage': self.get_storage_usage(),
                'memory_info': {
                    'free': gc.mem_free(),
                    'allocated': gc.mem_alloc()
                }
            }
            return stats
        except Exception as e:
            print(f"Error getting statistics: {e}")
            return None