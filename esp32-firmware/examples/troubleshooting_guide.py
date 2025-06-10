"""
ESP32 Attendance System - Troubleshooting Guide
Comprehensive testing and debugging tools
"""

import time
import gc
import sys
import json
from machine import Pin, I2C

# Add parent directory to path
sys.path.append('..')

def check_hardware_connections():
    """Check basic hardware connections"""
    print("="*50)
    print("HARDWARE CONNECTION CHECK")
    print("="*50)

    from config import Config

    # Test button pins
    print("\n1. BUTTON PINS TEST:")
    button_pins = {
        'UP': Config.BUTTON_UP_PIN,
        'DOWN': Config.BUTTON_DOWN_PIN,
        'SELECT': Config.BUTTON_SELECT_PIN,
        'PRESENT': Config.BUTTON_PRESENT_PIN,
        'ABSENT': Config.BUTTON_ABSENT_PIN,
        'BACK': Config.BUTTON_BACK_PIN
    }

    for name, pin_num in button_pins.items():
        try:
            pin = Pin(pin_num, Pin.IN, Pin.PULL_UP)
            status = "✅ OK" if pin.value() == 1 else "⚠️  PRESSED"
            print(f"  {name} button (GPIO {pin_num}): {status}")
        except Exception as e:
            print(f"  {name} button (GPIO {pin_num}): ❌ ERROR - {e}")

    # Test I2C for OLED
    print("\n2. I2C/OLED TEST:")
    try:
        i2c = I2C(0, scl=Pin(Config.I2C_SCL_PIN), sda=Pin(Config.I2C_SDA_PIN))
        devices = i2c.scan()

        if Config.OLED_ADDRESS in devices:
            print(f"  OLED Display (0x{Config.OLED_ADDRESS:02X}): ✅ FOUND")
        else:
            print(f"  OLED Display (0x{Config.OLED_ADDRESS:02X}): ❌ NOT FOUND")
            if devices:
                print(f"  Found I2C devices: {[hex(d) for d in devices]}")
            else:
                print("  No I2C devices found - check wiring!")
    except Exception as e:
        print(f"  I2C Error: ❌ {e}")

def test_memory_and_storage():
    """Test memory and storage status"""
    print("\n" + "="*50)
    print("MEMORY AND STORAGE TEST")
    print("="*50)

    # RAM test
    gc.collect()
    free_ram = gc.mem_free()
    print(f"\nRAM Status:")
    print(f"  Free memory: {free_ram:,} bytes")

    from config import Config
    if free_ram > Config.MIN_FREE_MEMORY:
        print(f"  Status: ✅ OK (>{Config.MIN_FREE_MEMORY:,} required)")
    else:
        print(f"  Status: ❌ LOW (need {Config.MIN_FREE_MEMORY:,})")

    # Storage test
    try:
        storage_info = Config.get_storage_info()
        print(f"\nFlash Storage:")
        print(f"  Total: {storage_info['total']:,} bytes")
        print(f"  Used: {storage_info['used']:,} bytes")
        print(f"  Free: {storage_info['free']:,} bytes")
        print(f"  Usage: {storage_info['percent_used']:.1f}%")

        if storage_info['percent_used'] < 80:
            print(f"  Status: ✅ OK")
        else:
            print(f"  Status: ⚠️  HIGH USAGE")
    except Exception as e:
        print(f"  Storage Error: ❌ {e}")

def interactive_button_test():
    """Interactive button testing"""
    print("\n" + "="*50)
    print("INTERACTIVE BUTTON TEST")
    print("="*50)
    print("Press any button to test. Press CTRL+C to exit.")

    try:
        from button_handler import ButtonHandler
        buttons = ButtonHandler()

        last_status_time = 0

        while True:
            # Get button events
            event = buttons.get_event()
            if event:
                print(f"✅ {event} button pressed!")

            # Show status every 2 seconds
            current_time = time.ticks_ms()
            if time.ticks_diff(current_time, last_status_time) > 2000:
                pressed = buttons.get_pressed_buttons()
                if pressed:
                    print(f"Currently held: {pressed}")
                last_status_time = current_time

            time.sleep_ms(50)

    except KeyboardInterrupt:
        print("\nButton test stopped by user")
    except Exception as e:
        print(f"❌ Button test error: {e}")

def test_all_systems():
    """Comprehensive system test"""
    print("\n" + "="*50)
    print("COMPREHENSIVE SYSTEM TEST")
    print("="*50)

    tests_passed = 0
    total_tests = 0

    # Test 1: Hardware
    print("\n[Test 1] Hardware Connections...")
    try:
        check_hardware_connections()
        tests_passed += 1
    except Exception as e:
        print(f"❌ Hardware test failed: {e}")
    total_tests += 1

    # Test 2: Display
    print("\n[Test 2] Display System...")
    try:
        from display_manager import DisplayManager
        display = DisplayManager()
        display.show_text("System Test", 0, 0)
        time.sleep(1)
        display.show_success("Display OK!")
        time.sleep(2)
        print("✅ Display test passed")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Display test failed: {e}")
    total_tests += 1

    # Test 3: Data Manager
    print("\n[Test 3] Data Manager...")
    try:
        from data_manager import DataManager
        dm = DataManager()

        # Test save/load
        test_data = [{"id": "test", "name": "Test Class", "students": []}]
        if dm.save_classes(test_data) and dm.get_classes():
            print("✅ Data manager test passed")
            tests_passed += 1
        else:
            print("❌ Data manager test failed")
    except Exception as e:
        print(f"❌ Data manager test failed: {e}")
    total_tests += 1

    # Test 4: BLE
    print("\n[Test 4] Bluetooth System...")
    try:
        from ble_server import AttendanceBLEServer
        from data_manager import DataManager

        dm = DataManager()
        ble = AttendanceBLEServer(dm)

        if ble.start():
            print("✅ BLE test passed")
            ble.stop()
            tests_passed += 1
        else:
            print("❌ BLE test failed to start")
    except Exception as e:
        print(f"❌ BLE test failed: {e}")
    total_tests += 1

    # Results
    print(f"\n" + "="*50)
    print(f"SYSTEM TEST RESULTS: {tests_passed}/{total_tests} passed")
    if tests_passed == total_tests:
        print("🎉 ALL SYSTEMS WORKING!")
    else:
        print("⚠️  Some systems need attention")
    print("="*50)

def main():
    """Main troubleshooting menu"""
    print("ESP32 Attendance System - Troubleshooting Guide")
    print("="*50)
    print("1. Hardware Connection Check")
    print("2. Memory and Storage Test")
    print("3. Interactive Button Test")
    print("4. Comprehensive System Test")
    print("5. Exit")

    while True:
        try:
            choice = input("\nSelect test (1-5): ").strip()

            if choice == '1':
                check_hardware_connections()
            elif choice == '2':
                test_memory_and_storage()
            elif choice == '3':
                interactive_button_test()
            elif choice == '4':
                test_all_systems()
            elif choice == '5':
                print("Goodbye!")
                break
            else:
                print("Invalid choice. Please enter 1-5.")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()