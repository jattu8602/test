"""
ESP32 Attendance System - Simple BLE Test
Minimal BLE server test for debugging
"""

import bluetooth
import time
import sys
import gc

# Add parent directory to path
sys.path.append('..')

from config import Config

def test_basic_ble():
    """Test basic BLE functionality"""
    print("Testing basic BLE functionality...")

    try:
        # Initialize BLE
        ble = bluetooth.BLE()
        ble.active(True)
        print("✅ BLE activated successfully")

        # Test simple advertising
        try:
            ble.gap_advertise(100)
            print("✅ Basic advertising started")
            time.sleep(2)
            ble.gap_advertise(None)  # Stop advertising
            print("✅ Advertising stopped")
        except Exception as e:
            print(f"❌ Advertising failed: {e}")
            return False

        # Test service registration
        try:
            # Simple service with one characteristic
            service_uuid = bluetooth.UUID(Config.BLE_SERVICE_UUID)
            char_uuid = bluetooth.UUID(Config.CHAR_CLASS_DATA_UUID)

            characteristics = [(char_uuid, bluetooth.FLAG_READ | bluetooth.FLAG_WRITE)]
            services = [(service_uuid, characteristics)]

            print("Attempting to register services...")
            result = ble.gatts_register_services(services)
            print(f"✅ Service registration result: {result}")
            print(f"Result type: {type(result)}")
            print(f"Result length: {len(result) if hasattr(result, '__len__') else 'N/A'}")

            # Try to parse the result
            if isinstance(result, tuple) and len(result) >= 1:
                print(f"First element: {result[0]} (type: {type(result[0])})")
                if len(result) >= 2:
                    print(f"Second element: {result[1]} (type: {type(result[1])})")

        except Exception as e:
            print(f"❌ Service registration failed: {e}")
            return False

        ble.active(False)
        return True

    except Exception as e:
        print(f"❌ BLE test failed: {e}")
        return False

def test_config_uuids():
    """Test UUID configuration"""
    print("\nTesting UUID configuration...")

    try:
        print(f"Service UUID: {Config.BLE_SERVICE_UUID}")
        print(f"Class Data UUID: {Config.CHAR_CLASS_DATA_UUID}")
        print(f"Storage Info UUID: {Config.CHAR_STORAGE_INFO_UUID}")
        print(f"Attendance Data UUID: {Config.CHAR_ATTENDANCE_DATA_UUID}")
        print(f"Command UUID: {Config.CHAR_COMMAND_UUID}")

        # Test UUID creation
        service_uuid = bluetooth.UUID(Config.BLE_SERVICE_UUID)
        print(f"✅ Service UUID created: {service_uuid}")

        char_uuid = bluetooth.UUID(Config.CHAR_CLASS_DATA_UUID)
        print(f"✅ Characteristic UUID created: {char_uuid}")

        return True

    except Exception as e:
        print(f"❌ UUID test failed: {e}")
        return False

def test_memory():
    """Test memory status"""
    print("\nTesting memory status...")

    gc.collect()
    free_mem = gc.mem_free()
    alloc_mem = gc.mem_alloc()

    print(f"Free memory: {free_mem:,} bytes")
    print(f"Allocated memory: {alloc_mem:,} bytes")

    if free_mem > 50000:  # Should have at least 50KB free
        print("✅ Memory status OK")
        return True
    else:
        print("❌ Low memory warning")
        return False

def test_full_ble_server():
    """Test the full BLE server"""
    print("\nTesting full BLE server...")

    try:
        from data_manager import DataManager
        from ble_server import AttendanceBLEServer

        # Create data manager
        data_manager = DataManager()
        print("✅ Data manager created")

        # Create BLE server
        ble_server = AttendanceBLEServer(data_manager)
        print("✅ BLE server created")

        # Try to start it
        if ble_server.start():
            print("✅ BLE server started successfully!")
            time.sleep(2)
            ble_server.stop()
            print("✅ BLE server stopped")
            return True
        else:
            print("❌ BLE server failed to start")
            return False

    except Exception as e:
        print(f"❌ Full BLE server test failed: {e}")
        import sys
        sys.print_exception(e)
        return False

def main():
    """Run all BLE tests"""
    print("ESP32 BLE Simple Test")
    print("=" * 40)

    tests = [
        ("Memory Test", test_memory),
        ("UUID Configuration", test_config_uuids),
        ("Basic BLE", test_basic_ble),
        ("Full BLE Server", test_full_ble_server),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        print("-" * 20)
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")

    print(f"\n" + "=" * 40)
    print(f"Test Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed - check output above")

if __name__ == "__main__":
    main()