"""
ESP32 Attendance System - Button Handler
Manages physical button inputs with debouncing
"""

from machine import Pin
import time
from config import Config

class ButtonHandler:
    def __init__(self):
        # Initialize button pins with pull-up resistors
        self.buttons = {
            'UP': Pin(Config.BUTTON_UP_PIN, Pin.IN, Pin.PULL_UP),
            'DOWN': Pin(Config.BUTTON_DOWN_PIN, Pin.IN, Pin.PULL_UP),
            'SELECT': Pin(Config.BUTTON_SELECT_PIN, Pin.IN, Pin.PULL_UP),
            'PRESENT': Pin(Config.BUTTON_PRESENT_PIN, Pin.IN, Pin.PULL_UP),
            'ABSENT': Pin(Config.BUTTON_ABSENT_PIN, Pin.IN, Pin.PULL_UP),
            'BACK': Pin(Config.BUTTON_BACK_PIN, Pin.IN, Pin.PULL_UP)
        }

        # Button state tracking
        self.button_states = {}
        self.last_press_time = {}
        self.button_pressed = {}

        # Initialize state tracking
        for button_name in self.buttons:
            self.button_states[button_name] = 1  # Pull-up means 1 is unpressed
            self.last_press_time[button_name] = 0
            self.button_pressed[button_name] = False

        print("Button handler initialized")

    def _is_button_pressed(self, button_name):
        """Check if button is currently pressed (accounting for pull-up)"""
        return self.buttons[button_name].value() == 0  # 0 means pressed with pull-up

    def _debounce_button(self, button_name):
        """Check if enough time has passed since last press for debouncing"""
        current_time = time.ticks_ms()
        time_diff = time.ticks_diff(current_time, self.last_press_time[button_name])
        return time_diff > Config.BUTTON_DEBOUNCE_MS

    def get_event(self):
        """Get button press event if any"""
        current_time = time.ticks_ms()

        for button_name, button_pin in self.buttons.items():
            current_state = button_pin.value()
            previous_state = self.button_states[button_name]

            # Detect button press (transition from 1 to 0 with pull-up)
            if previous_state == 1 and current_state == 0:
                # Button was just pressed
                if self._debounce_button(button_name):
                    self.last_press_time[button_name] = current_time
                    self.button_states[button_name] = current_state
                    self.button_pressed[button_name] = True
                    print(f"Button pressed: {button_name}")
                    return button_name

            # Update button state
            self.button_states[button_name] = current_state

            # Reset pressed flag when button is released
            if current_state == 1 and self.button_pressed[button_name]:
                self.button_pressed[button_name] = False

        return None

    def wait_for_button(self, timeout_ms=None):
        """Wait for any button press with optional timeout"""
        start_time = time.ticks_ms()

        while True:
            event = self.get_event()
            if event:
                return event

            # Check timeout
            if timeout_ms:
                elapsed = time.ticks_diff(time.ticks_ms(), start_time)
                if elapsed > timeout_ms:
                    return None

            time.sleep_ms(10)  # Small delay to prevent excessive CPU usage

    def wait_for_specific_button(self, button_name, timeout_ms=None):
        """Wait for a specific button press"""
        start_time = time.ticks_ms()

        while True:
            event = self.get_event()
            if event == button_name:
                return True

            # Check timeout
            if timeout_ms:
                elapsed = time.ticks_diff(time.ticks_ms(), start_time)
                if elapsed > timeout_ms:
                    return False

            time.sleep_ms(10)

    def is_button_currently_pressed(self, button_name):
        """Check if a specific button is currently being pressed"""
        if button_name in self.buttons:
            return self._is_button_pressed(button_name)
        return False

    def get_pressed_buttons(self):
        """Get list of all currently pressed buttons"""
        pressed = []
        for button_name in self.buttons:
            if self._is_button_pressed(button_name):
                pressed.append(button_name)
        return pressed

    def reset_button_states(self):
        """Reset all button states (useful after errors or state changes)"""
        for button_name in self.buttons:
            self.button_states[button_name] = self.buttons[button_name].value()
            self.button_pressed[button_name] = False
            self.last_press_time[button_name] = 0
        print("Button states reset")

    def test_buttons(self, duration_ms=10000):
        """Test all buttons for a specified duration (useful for debugging)"""
        print("Button test started - press buttons to test")
        start_time = time.ticks_ms()

        while time.ticks_diff(time.ticks_ms(), start_time) < duration_ms:
            event = self.get_event()
            if event:
                print(f"Button test: {event} pressed")
            time.sleep_ms(50)

        print("Button test completed")

    def get_button_status(self):
        """Get status of all buttons for debugging"""
        status = {}
        for button_name, button_pin in self.buttons.items():
            status[button_name] = {
                'current_value': button_pin.value(),
                'is_pressed': self._is_button_pressed(button_name),
                'last_press_time': self.last_press_time[button_name],
                'state': self.button_states[button_name]
            }
        return status