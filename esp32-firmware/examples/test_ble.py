"""
ESP32 Attendance System - BLE Test Script
Test Bluetooth LE functionality and GATT server
"""

import time
import json
import sys
import gc

# Add parent directory to path to import modules
sys.path.append('..')

from ble_server import AttendanceBLEServer
from data_manager import DataManager
from config import Config

def test_ble_initialization():
    """Test BLE server initialization"""
    print("Testing BLE initialization...")

    try:
        data_manager = DataManager()
        ble_server = AttendanceBLEServer(data_manager)

        print("✅ BLE server created successfully!")

        # Test starting the server
        if ble_server.start():
            print("✅ BLE server started successfully!")
            print(f"Device name: {Config.BLE_DEVICE_NAME}")
            print(f"Service UUID: {Config.BLE_SERVICE_UUID}")

            # Test stopping the server
            ble_server.stop()
            print("✅ BLE server stopped successfully!")
            return True
        else:
            print("❌ Failed to start BLE server")
            return False

    except Exception as e:
        print(f"❌ BLE initialization failed: {e}")
        return False

def test_data_manager_integration():
    """Test BLE server integration with data manager"""
    print("Testing data manager integration...")

    try:
        data_manager = DataManager()

        # Create sample class data
        sample_classes = [
            {
                "id": "class-1",
                "name": "Math Class A",
                "students": [
                    {"roll": 1, "name": "Alice Johnson"},
                    {"roll": 2, "name": "Bob Smith"},
                    {"roll": 3, "name": "Charlie Brown"}
                ]
            },
            {
                "id": "class-2",
                "name": "Science Class B",
                "students": [
                    {"roll": 1, "name": "David Wilson"},
                    {"roll": 2, "name": "Eva Davis"}
                ]
            }
        ]

        # Test saving classes
        if data_manager.save_classes(sample_classes):
            print("✅ Sample classes saved successfully!")
        else:
            print("❌ Failed to save sample classes")
            return False

        # Test loading classes
        loaded_classes = data_manager.get_classes()
        if len(loaded_classes) == 2:
            print("✅ Classes loaded successfully!")
        else:
            print("❌ Failed to load classes correctly")
            return False

        # Test attendance operations
        sample_attendance = [
            {"roll": 1, "name": "Alice Johnson", "present": True},
            {"roll": 2, "name": "Bob Smith", "present": False},
            {"roll": 3, "name": "Charlie Brown", "present": True}
        ]

        if data_manager.save_attendance("class-1", sample_attendance):
            print("✅ Sample attendance saved successfully!")
        else:
            print("❌ Failed to save sample attendance")
            return False

        # Test BLE server with data
        ble_server = AttendanceBLEServer(data_manager)
        if ble_server.start():
            print("✅ BLE server started with sample data!")

            # Test memory info
            memory_info = ble_server._get_memory_info()
            print(f"Memory info: {memory_info}")

            ble_server.stop()
            return True
        else:
            print("❌ Failed to start BLE server with data")
            return False

    except Exception as e:
        print(f"❌ Data manager integration test failed: {e}")
        return False

def test_json_operations():
    """Test JSON serialization/deserialization"""
    print("Testing JSON operations...")

    try:
        # Test class data JSON
        sample_class = {
            "id": "test-class",
            "name": "Test Class",
            "students": [
                {"roll": 1, "name": "Test Student 1"},
                {"roll": 2, "name": "Test Student 2"}
            ]
        }

        # Serialize to JSON
        json_str = json.dumps(sample_class)
        print(f"JSON serialized: {len(json_str)} characters")

        # Deserialize from JSON
        parsed_class = json.loads(json_str)

        if parsed_class["id"] == sample_class["id"]:
            print("✅ JSON serialization/deserialization working!")
        else:
            print("❌ JSON data corruption detected")
            return False

        # Test large data
        large_class = {
            "id": "large-class",
            "name": "Large Test Class",
            "students": []
        }

        # Add many students
        for i in range(100):
            large_class["students"].append({
                "roll": i + 1,
                "name": f"Student {i + 1} with a very long name that might cause issues"
            })

        large_json = json.dumps(large_class)
        print(f"Large JSON size: {len(large_json)} characters")

        if len(large_json) < Config.MAX_JSON_SIZE:
            print("✅ Large JSON within size limits!")
        else:
            print(f"⚠️  Large JSON exceeds limit ({Config.MAX_JSON_SIZE} chars)")

        # Test parsing large JSON
        parsed_large = json.loads(large_json)
        if len(parsed_large["students"]) == 100:
            print("✅ Large JSON parsing successful!")
            return True
        else:
            print("❌ Large JSON parsing failed")
            return False

    except Exception as e:
        print(f"❌ JSON operations test failed: {e}")
        return False

def test_memory_usage():
    """Test memory usage during BLE operations"""
    print("Testing memory usage...")

    try:
        # Initial memory
        gc.collect()
        initial_memory = gc.mem_free()
        print(f"Initial free memory: {initial_memory} bytes")

        # Create data manager
        data_manager = DataManager()
        gc.collect()
        after_data_manager = gc.mem_free()
        print(f"After DataManager: {after_data_manager} bytes ({initial_memory - after_data_manager} used)")

        # Create BLE server
        ble_server = AttendanceBLEServer(data_manager)
        gc.collect()
        after_ble_server = gc.mem_free()
        print(f"After BLE server: {after_ble_server} bytes ({after_data_manager - after_ble_server} used)")

        # Start BLE server
        if ble_server.start():
            gc.collect()
            after_start = gc.mem_free()
            print(f"After BLE start: {after_start} bytes ({after_ble_server - after_start} used)")

            # Add sample data
            sample_classes = []
            for i in range(5):
                class_data = {
                    "id": f"class-{i}",
                    "name": f"Test Class {i}",
                    "students": []
                }
                for j in range(20):
                    class_data["students"].append({
                        "roll": j + 1,
                        "name": f"Student {j + 1}"
                    })
                sample_classes.append(class_data)

            data_manager.save_classes(sample_classes)
            gc.collect()
            after_data = gc.mem_free()
            print(f"After sample data: {after_data} bytes ({after_start - after_data} used)")

            # Check if we have enough memory
            if after_data > Config.MIN_FREE_MEMORY:
                print("✅ Memory usage within acceptable limits!")
                ble_server.stop()
                return True
            else:
                print("❌ Memory usage too high!")
                ble_server.stop()
                return False
        else:
            print("❌ Failed to start BLE server for memory test")
            return False

    except Exception as e:
        print(f"❌ Memory usage test failed: {e}")
        return False

def test_ble_advertising():
    """Test BLE advertising functionality"""
    print("Testing BLE advertising...")

    try:
        data_manager = DataManager()
        ble_server = AttendanceBLEServer(data_manager)

        # Start advertising
        if ble_server.start():
            print("✅ BLE advertising started!")
            print(f"Device should be visible as: {Config.BLE_DEVICE_NAME}")
            print("You can now try to connect from a BLE scanner app")

            # Run for a short time to allow testing
            print("Advertising for 10 seconds...")
            start_time = time.ticks_ms()

            while time.ticks_diff(time.ticks_ms(), start_time) < 10000:
                ble_server.handle_events()

                if ble_server.is_connected():
                    print("✅ Client connected!")
                    break

                time.sleep_ms(100)

            if ble_server.is_connected():
                print("✅ Connection test successful!")
                # Wait a bit more for potential data exchange
                time.sleep(2)
            else:
                print("ℹ️  No client connected (this is normal for automated testing)")

            ble_server.stop()
            print("✅ BLE advertising stopped!")
            return True
        else:
            print("❌ Failed to start BLE advertising")
            return False

    except Exception as e:
        print(f"❌ BLE advertising test failed: {e}")
        return False

def main():
    """Main test function"""
    print("ESP32 Attendance System - BLE Test")
    print("="*50)

    tests_passed = 0
    total_tests = 5

    try:
        # Test 1: BLE initialization
        if test_ble_initialization():
            tests_passed += 1

        # Test 2: Data manager integration
        if test_data_manager_integration():
            tests_passed += 1

        # Test 3: JSON operations
        if test_json_operations():
            tests_passed += 1

        # Test 4: Memory usage
        if test_memory_usage():
            tests_passed += 1

        # Test 5: BLE advertising
        if test_ble_advertising():
            tests_passed += 1

    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test suite failed: {e}")

    print(f"\nTest Results: {tests_passed}/{total_tests} tests passed")

    if tests_passed == total_tests:
        print("✅ All BLE tests passed!")
    else:
        print("❌ Some BLE tests failed!")

    print("BLE test completed!")
    print("\nNote: For full BLE testing, use a BLE scanner app on your phone")
    print("or connect from the web application to test data synchronization.")

if __name__ == "__main__":
    main()