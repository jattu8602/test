"""
Debug BLE Server - Simple version to troubleshoot JSON issues
"""

import bluetooth
import json
import time
from micropython import const

# BLE Events
_IRQ_CENTRAL_CONNECT = const(1)
_IRQ_CENTRAL_DISCONNECT = const(2)
_IRQ_GATTS_WRITE = const(3)

class DebugBLEServer:
    def __init__(self):
        self.ble = bluetooth.BLE()
        self.ble.active(True)
        self.ble.irq(self._irq_handler)
        self.connected = False
        self.conn_handle = None
        self.char_handles = {}
        self.buffer = bytearray()

    def _irq_handler(self, event, data):
        if event == _IRQ_CENTRAL_CONNECT:
            conn_handle, addr_type, addr = data
            self.conn_handle = conn_handle
            self.connected = True
            self.buffer = bytearray()  # Clear buffer on new connection
            addr_str = ":".join("{:02x}".format(b) for b in addr)
            print(f"🟢 Client connected: {addr_str}")

        elif event == _IRQ_CENTRAL_DISCONNECT:
            self.connected = False
            self.conn_handle = None
            self.buffer = bytearray()
            print("🔴 Client disconnected")
            self._advertise()

        elif event == _IRQ_GATTS_WRITE:
            conn_handle, value_handle = data
            value = self.ble.gatts_read(value_handle)
            self._handle_write(value_handle, value)

    def _handle_write(self, value_handle, value):
        print(f"\n📡 RECEIVED DATA:")
        print(f"Handle: {value_handle}")
        print(f"Length: {len(value)} bytes")
        print(f"Raw bytes: {[hex(b) for b in value]}")

        # Try to decode as text
        try:
            text = value.decode('utf-8')
            print(f"Text: '{text}'")
            print(f"Text repr: {repr(text)}")
        except UnicodeDecodeError as e:
            print(f"❌ UTF-8 decode error: {e}")
            return

        # Add to buffer
        self.buffer.extend(value)
        print(f"Buffer size: {len(self.buffer)} bytes")

        # Try to decode full buffer
        try:
            buffer_text = self.buffer.decode('utf-8')
            print(f"Full buffer: '{buffer_text}'")
            print(f"Buffer repr: {repr(buffer_text)}")

            # Check for complete messages (with newline)
            if '\n' in buffer_text:
                messages = buffer_text.split('\n')
                print(f"Found {len(messages)} message parts")

                for i, msg in enumerate(messages):
                    print(f"Part {i}: '{msg}' (len={len(msg)})")

                # Try to parse complete messages
                for i in range(len(messages) - 1):
                    msg = messages[i].strip()
                    if msg:
                        print(f"\n🔍 Trying to parse message {i+1}: '{msg[:100]}...'")
                        try:
                            parsed = json.loads(msg)
                            print(f"✅ JSON parsed successfully!")
                            print(f"Type: {type(parsed)}")
                            if isinstance(parsed, list):
                                print(f"List length: {len(parsed)}")
                            elif isinstance(parsed, dict):
                                print(f"Dict keys: {list(parsed.keys())}")
                        except Exception as e:
                            print(f"❌ JSON parse failed: {e}")
                            print(f"Message was: {repr(msg)}")

                # Keep remaining incomplete message
                remaining = messages[-1]
                self.buffer = bytearray(remaining.encode('utf-8'))
                print(f"Kept in buffer: '{remaining}'")

        except UnicodeDecodeError as e:
            print(f"❌ Buffer UTF-8 decode error: {e}")

        print("─" * 50)

    def _register_services(self):
        # Simple service registration
        service_uuid = bluetooth.UUID('12345678-1234-1234-1234-123456789abc')
        class_data_uuid = bluetooth.UUID('12345678-1234-1234-1234-123456789abd')
        command_uuid = bluetooth.UUID('12345678-1234-1234-1234-123456789ac0')

        characteristics = [
            (class_data_uuid, bluetooth.FLAG_READ | bluetooth.FLAG_WRITE | bluetooth.FLAG_NOTIFY),
            (command_uuid, bluetooth.FLAG_WRITE | bluetooth.FLAG_NOTIFY),
        ]

        services = [(service_uuid, characteristics)]
        result = self.ble.gatts_register_services(services)
        print(f"Service registration result: {result}")

        # Handle the result format
        if isinstance(result, tuple) and len(result) == 1:
            if isinstance(result[0], (tuple, list)) and len(result[0]) >= 2:
                char_handles = result[0]
                self.char_handles = {
                    'class_data': char_handles[0],
                    'command': char_handles[1] if len(char_handles) > 1 else None
                }
                print(f"Characteristic handles: {self.char_handles}")

    def _advertise(self):
        name = 'ESP32-Debug'
        adv_data = bytearray()
        adv_data.extend(b'\x02\x01\x06')  # Flags
        name_bytes = name.encode('utf-8')
        adv_data.extend(bytes([len(name_bytes) + 1, 0x09]) + name_bytes)
        self.ble.gap_advertise(100, adv_data)
        print(f"📡 Advertising as: {name}")

    def start(self):
        try:
            self._register_services()
            self._advertise()
            print("🚀 Debug BLE server started!")
            return True
        except Exception as e:
            print(f"❌ Failed to start: {e}")
            return False

# Main execution
if __name__ == "__main__":
    print("🔧 ESP32 BLE Debug Server")
    print("=" * 30)

    server = DebugBLEServer()
    if server.start():
        print("✅ Server running. Connect from web app to see debug output.")
        print("Press Ctrl+C to stop.")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
    else:
        print("❌ Failed to start server")