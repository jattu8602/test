"""
ESP32 Attendance System - Display Test Script
Test OLED display and verify all UI screens
"""

import time
import sys
import gc

# Add parent directory to path to import modules
sys.path.append('..')

from display_manager import DisplayManager
from config import Config

def test_basic_display():
    """Test basic display functionality"""
    print("Testing basic display functionality...")

    try:
        display = DisplayManager()
        print("✅ Display initialized successfully!")

        # Test clear
        display.clear()
        time.sleep(1)

        # Test simple text
        display.show_text("Hello ESP32!", 0, 0)
        time.sleep(2)

        # Test multiline text
        lines = [
            "Line 1",
            "Line 2",
            "Line 3",
            "Line 4"
        ]
        display.show_multiline_text(lines)
        time.sleep(2)

        print("✅ Basic display tests passed!")
        return True

    except Exception as e:
        print(f"❌ Display test failed: {e}")
        return False

def test_ui_screens():
    """Test all UI screens"""
    print("Testing UI screens...")

    try:
        display = DisplayManager()

        # Test startup screen
        print("Testing startup screen...")
        display.show_startup()
        time.sleep(3)

        # Test device on screen
        print("Testing device on screen...")
        display.show_device_on()
        time.sleep(3)

        # Test main menu
        print("Testing main menu...")
        display.show_main_menu()
        time.sleep(3)

        # Test class selection with sample data
        print("Testing class selection...")
        sample_classes = [
            {"id": "1", "name": "Math Class A"},
            {"id": "2", "name": "Science Class B"},
            {"id": "3", "name": "English Class C"},
            {"id": "4", "name": "History Class D"},
            {"id": "5", "name": "Very Long Class Name That Should Be Truncated"}
        ]

        for i in range(len(sample_classes)):
            display.show_class_selection(sample_classes, i)
            time.sleep(2)

        # Test attendance screen
        print("Testing attendance screen...")
        sample_student = {
            "roll": 42,
            "name": "John Doe Smith Johnson"  # Long name to test wrapping
        }
        display.show_attendance_screen(sample_student, "3/25", "Math Class")
        time.sleep(3)

        # Test message screens
        print("Testing message screens...")
        display.show_message("Test Message\nMultiple Lines\nHere!")
        time.sleep(2)

        display.show_error("Test Error\nSomething went wrong!")
        time.sleep(2)

        display.show_success("Test Success\nOperation completed!")
        time.sleep(2)

        # Test bluetooth status
        print("Testing bluetooth screens...")
        display.show_bluetooth_status(False)
        time.sleep(2)

        display.show_bluetooth_status(True, "Web Browser")
        time.sleep(2)

        # Test storage info
        print("Testing storage info...")
        sample_storage = {
            'total': 4194304,  # 4MB
            'used': 1048576,   # 1MB
            'free': 3145728,   # 3MB
            'percent_used': 25.0
        }
        display.show_storage_info(sample_storage)
        time.sleep(3)

        # Test completion screen
        print("Testing completion screen...")
        display.show_attendance_complete("Math Class A", 25)
        time.sleep(3)

        # Test no classes screen
        print("Testing no classes screen...")
        display.show_no_classes()
        time.sleep(3)

        # Test attendance taken screen
        print("Testing attendance taken screen...")
        display.show_attendance_taken("Science Class B")
        time.sleep(3)

        print("✅ All UI screens tested successfully!")
        return True

    except Exception as e:
        print(f"❌ UI screen test failed: {e}")
        return False

def test_display_performance():
    """Test display performance and memory usage"""
    print("Testing display performance...")

    try:
        display = DisplayManager()

        # Memory before test
        gc.collect()
        mem_before = gc.mem_free()
        print(f"Memory before test: {mem_before} bytes")

        # Rapid screen updates
        start_time = time.ticks_ms()
        for i in range(50):
            display.show_text(f"Frame {i}", 0, 0)
            time.sleep_ms(20)

        end_time = time.ticks_ms()
        duration = time.ticks_diff(end_time, start_time)

        # Memory after test
        gc.collect()
        mem_after = gc.mem_free()
        print(f"Memory after test: {mem_after} bytes")
        print(f"Memory used: {mem_before - mem_after} bytes")
        print(f"50 frames in {duration}ms ({duration/50:.1f}ms per frame)")

        if duration < 2000:  # Should complete in under 2 seconds
            print("✅ Display performance test passed!")
            return True
        else:
            print("❌ Display performance test failed (too slow)")
            return False

    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False

def test_display_stress():
    """Stress test the display with various content"""
    print("Running display stress test...")

    try:
        display = DisplayManager()

        # Test with various character sets
        test_strings = [
            "ABCDEFGHIJKLMNOP",
            "1234567890!@#$%^",
            "abcdefghijklmnop",
            "()[]{}+-*/=<>?",
            "Mixed 123 ABC xyz",
            "Very Long String That Should Be Truncated Properly",
            "",  # Empty string
            " ",  # Space only
            "\n\n\n",  # Newlines only
        ]

        for i, test_str in enumerate(test_strings):
            print(f"Testing string {i+1}: '{test_str[:20]}...'")
            display.show_text(test_str, 0, 0)
            time.sleep(1)

        # Test multiline with various combinations
        multiline_tests = [
            ["Short", "Medium length", "Very long line that exceeds display width"],
            ["", "Empty line above", ""],
            [" ", "Spaces", "   "],
            ["Line 1", "", "Line 3", "", "Line 5"],
        ]

        for i, lines in enumerate(multiline_tests):
            print(f"Testing multiline {i+1}")
            display.show_multiline_text(lines)
            time.sleep(2)

        print("✅ Display stress test passed!")
        return True

    except Exception as e:
        print(f"❌ Stress test failed: {e}")
        return False

def main():
    """Main test function"""
    print("ESP32 Attendance System - Display Test")
    print("="*50)

    tests_passed = 0
    total_tests = 4

    try:
        # Test 1: Basic display functionality
        if test_basic_display():
            tests_passed += 1

        # Test 2: UI screens
        if test_ui_screens():
            tests_passed += 1

        # Test 3: Performance
        if test_display_performance():
            tests_passed += 1

        # Test 4: Stress test
        if test_display_stress():
            tests_passed += 1

    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test suite failed: {e}")

    print(f"\nTest Results: {tests_passed}/{total_tests} tests passed")

    if tests_passed == total_tests:
        print("✅ All display tests passed!")
    else:
        print("❌ Some display tests failed!")

    print("Display test completed!")

if __name__ == "__main__":
    main()