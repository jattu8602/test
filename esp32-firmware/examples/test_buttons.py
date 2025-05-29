"""
ESP32 Attendance System - Button Test Script
Test all buttons and verify hardware connections
"""

import time
from machine import Pin
import sys
import os

# Add parent directory to path to import modules
sys.path.append('..')

from button_handler import ButtonHandler
from config import Config

def test_individual_buttons():
    """Test each button individually"""
    print("Testing individual buttons...")
    print("Press each button when prompted. Press CTRL+C to exit.")

    button_pins = {
        'UP': Config.BUTTON_UP_PIN,
        'DOWN': Config.BUTTON_DOWN_PIN,
        'SELECT': Config.BUTTON_SELECT_PIN,
        'PRESENT': Config.BUTTON_PRESENT_PIN,
        'ABSENT': Config.BUTTON_ABSENT_PIN,
        'BACK': Config.BUTTON_BACK_PIN
    }

    for button_name, pin_num in button_pins.items():
        print(f"\nTesting {button_name} button (GPIO {pin_num})")
        print("Press the button now...")

        # Create pin with pull-up
        pin = Pin(pin_num, Pin.IN, Pin.PULL_UP)

        # Wait for button press
        timeout = 10000  # 10 seconds
        start_time = time.ticks_ms()
        pressed = False

        while time.ticks_diff(time.ticks_ms(), start_time) < timeout:
            if pin.value() == 0:  # Button pressed (pull-up inverted)
                print(f"✅ {button_name} button working!")
                pressed = True
                # Wait for release
                while pin.value() == 0:
                    time.sleep_ms(10)
                break
            time.sleep_ms(10)

        if not pressed:
            print(f"❌ {button_name} button not detected (timeout)")

def test_button_handler():
    """Test the ButtonHandler class"""
    print("\n" + "="*50)
    print("Testing ButtonHandler class...")
    print("Press any button. Press CTRL+C to exit.")

    try:
        buttons = ButtonHandler()

        print("Button handler initialized successfully!")
        print("Waiting for button presses...")

        while True:
            event = buttons.get_event()
            if event:
                print(f"Button event detected: {event}")

                # Show button status
                status = buttons.get_button_status()
                print(f"Button status: {status[event]}")

            time.sleep_ms(50)

    except Exception as e:
        print(f"Error testing ButtonHandler: {e}")

def test_button_combinations():
    """Test multiple button presses"""
    print("\n" + "="*50)
    print("Testing button combinations...")

    try:
        buttons = ButtonHandler()

        print("Try pressing multiple buttons at once...")
        print("Press CTRL+C to exit.")

        while True:
            pressed_buttons = buttons.get_pressed_buttons()
            if pressed_buttons:
                print(f"Currently pressed: {pressed_buttons}")

            time.sleep_ms(100)

    except Exception as e:
        print(f"Error testing combinations: {e}")

def main():
    """Main test function"""
    print("ESP32 Attendance System - Button Test")
    print("="*50)

    try:
        # Test 1: Individual buttons
        test_individual_buttons()

        # Test 2: Button handler class
        test_button_handler()

        # Test 3: Button combinations
        test_button_combinations()

    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test failed: {e}")

    print("Button test completed!")

if __name__ == "__main__":
    main()