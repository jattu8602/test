"""
ESP32 Attendance System - Bluetooth LE GATT Server
Handles communication with web application
"""

import bluetooth
import json
import time
from micropython import const
from config import Config

# BLE Events
_IRQ_CENTRAL_CONNECT = const(1)
_IRQ_CENTRAL_DISCONNECT = const(2)
_IRQ_GATTS_WRITE = const(3)
_IRQ_GATTS_READ_REQUEST = const(4)

class AttendanceBLEServer:
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.ble = bluetooth.BLE()
        self.ble.active(True)
        self.ble.irq(self._irq_handler)

        # Connection state
        self.connected = False
        self.conn_handle = None

        # Service and characteristics handles
        self.service_handle = None
        self.char_handles = {}

        # Data buffers for handling chunked transfers
        self.rx_buffers = {}  # Separate buffer for each characteristic
        self.tx_buffer = bytearray()

        print("BLE Server initialized")

    def _irq_handler(self, event, data):
        """Handle BLE interrupt events"""
        if event == _IRQ_CENTRAL_CONNECT:
            conn_handle, addr_type, addr = data
            self.conn_handle = conn_handle
            self.connected = True
            # Clear buffers on new connection
            self.rx_buffers = {}
            # Build "aa:bb:cc:…" from the bytearray 'addr'
            addr_str = ":".join("{:02x}".format(b) for b in addr)
            print("Client connected: {}".format(addr_str))

        elif event == _IRQ_CENTRAL_DISCONNECT:
            conn_handle, addr_type, addr = data
            self.connected = False
            self.conn_handle = None
            # Clear buffers on disconnect
            self.rx_buffers = {}
            print("Client disconnected")
            # Restart advertising
            self._advertise()

        elif event == _IRQ_GATTS_WRITE:
            conn_handle, value_handle = data
            value = self.ble.gatts_read(value_handle)
            self._handle_write(value_handle, value)

        elif event == _IRQ_GATTS_READ_REQUEST:
            conn_handle, value_handle = data
            self._handle_read(value_handle)

    def _handle_write(self, value_handle, value):
        """Handle write requests from client with proper buffering"""
        try:
            # Initialize buffer for this characteristic if needed
            if value_handle not in self.rx_buffers:
                self.rx_buffers[value_handle] = bytearray()

            # Append new data to buffer
            self.rx_buffers[value_handle].extend(value)

            # Debug: show what we received
            print(f"Received {len(value)} bytes for handle {value_handle}")

            # Only show raw bytes for first few chunks to avoid spam
            if len(self.rx_buffers[value_handle]) <= 100:
                print(f"Raw bytes: {[hex(b) for b in value]}")

            print(f"Buffer now has {len(self.rx_buffers[value_handle])} bytes")

            # Try to decode and find complete JSON messages
            try:
                buffer_str = self.rx_buffers[value_handle].decode('utf-8')
            except UnicodeDecodeError as e:
                print(f"Unicode decode error at position {e.start}: waiting for more data")
                # Don't process anything yet, wait for more data
                return

            # Debug: show buffer content (truncated for readability)
            if len(buffer_str) > 200:
                display_buffer = buffer_str[:100] + f"...({len(buffer_str)} total chars)..." + buffer_str[-50:]
            else:
                display_buffer = buffer_str
            print(f"Buffer content: '{display_buffer}'")

            # Look for complete JSON messages (ending with newline)
            if '\n' in buffer_str:
                messages = buffer_str.split('\n')

                print(f"Found newline! Split into {len(messages)} parts:")
                for i, msg in enumerate(messages[:3]):  # Show only first 3 parts
                    print(f"  Part {i}: '{msg[:50]}{'...' if len(msg) > 50 else ''}' (len={len(msg)})")

                # Process complete messages (all but the last one, which might be incomplete)
                for i in range(len(messages) - 1):
                    message = messages[i].strip()
                    if message:  # Skip empty messages
                        print(f"\n🔍 Processing complete message {i+1}:")
                        print(f"Message length: {len(message)} characters")
                        self._process_complete_message(value_handle, message)

                # Keep the last (potentially incomplete) message in buffer
                remaining = messages[-1]
                self.rx_buffers[value_handle] = bytearray(remaining.encode('utf-8'))
                if remaining:
                    print(f"Keeping in buffer: '{remaining[:50]}{'...' if len(remaining) > 50 else ''}' (len={len(remaining)})")
                else:
                    print("Buffer cleared - message was complete")
            else:
                print("No newline found yet, waiting for more data...")

        except Exception as e:
            print(f"Error handling write: {e}")
            print(f"Error type: {type(e)}")
            # Clear buffer on error to prevent corruption
            if value_handle in self.rx_buffers:
                del self.rx_buffers[value_handle]
                print("Cleared buffer due to error")

    def _process_complete_message(self, value_handle, message):
        """Process a complete JSON message"""
        try:
            # Try to parse as JSON
            json.loads(message)  # Validate JSON first

            if value_handle == self.char_handles['class_data']:
                self._handle_class_data_write(message)
            elif value_handle == self.char_handles['command']:
                self._handle_command_write(message)

        except ValueError as e:
            print(f"JSON parse error: {e}")
            print(f"Message: {message[:100]}...")  # Print first 100 chars for debugging
        except Exception as e:
            print(f"Error processing message: {e}")

    def _handle_read(self, value_handle):
        """Handle read requests from client"""
        try:
            if value_handle == self.char_handles['storage_info']:
                storage_info = Config.get_storage_info()
                response = json.dumps(storage_info)
                self.ble.gatts_write(value_handle, response.encode('utf-8'))

            elif value_handle == self.char_handles['attendance_data']:
                attendance_data = self.data_manager.get_all_attendance()
                response = json.dumps(attendance_data)
                # For large responses, we might need to implement chunking here too
                self._send_chunked_response(value_handle, response)

        except Exception as e:
            print(f"Error handling read: {e}")

    def _send_chunked_response(self, value_handle, response):
        """Send response in chunks if it's too large"""
        try:
            response_bytes = response.encode('utf-8')
            chunk_size = 100  # Conservative chunk size for BLE

            if len(response_bytes) <= chunk_size:
                # Send in one piece
                self.ble.gatts_write(value_handle, response_bytes)
            else:
                # Send in chunks with delimiter
                for i in range(0, len(response_bytes), chunk_size):
                    chunk = response_bytes[i:i + chunk_size]
                    if i + chunk_size >= len(response_bytes):
                        # Last chunk - add newline delimiter
                        chunk += b'\n'
                    self.ble.gatts_write(value_handle, chunk)
                    time.sleep_ms(10)  # Small delay between chunks

        except Exception as e:
            print(f"Error sending chunked response: {e}")
            # Fallback to simple write
            self.ble.gatts_write(value_handle, response.encode('utf-8'))

    def _handle_class_data_write(self, data):
        """Handle class data synchronization"""
        try:
            classes_data = json.loads(data)
            success = self.data_manager.save_classes(classes_data)

            if success:
                print(f"Synced {len(classes_data)} classes")
                # Send confirmation
                response = json.dumps({"status": "success", "message": "Data synced successfully"}) + "\n"
            else:
                response = json.dumps({"status": "error", "message": "Failed to save data"}) + "\n"

            # Notify client of result
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['class_data'], response.encode('utf-8'))

        except Exception as e:
            print(f"Error syncing class data: {e}")
            response = json.dumps({"status": "error", "message": str(e)}) + "\n"
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['class_data'], response.encode('utf-8'))

    def _handle_command_write(self, data):
        """Handle command requests"""
        try:
            command_data = json.loads(data)
            command = command_data.get('command')

            if command == 'clear_attendance':
                class_id = command_data.get('class_id')
                success = self.data_manager.clear_attendance(class_id)
                response = json.dumps({
                    "status": "success" if success else "error",
                    "command": command,
                    "class_id": class_id
                }) + "\n"

            elif command == 'clear_all_attendance':
                success = self.data_manager.clear_all_attendance()
                response = json.dumps({
                    "status": "success" if success else "error",
                    "command": command
                }) + "\n"

            elif command == 'get_status':
                classes = self.data_manager.get_classes()
                total_students = sum(len(c.get('students', [])) for c in classes)
                status = {
                    "device_name": Config.BLE_DEVICE_NAME,
                    "classes_count": len(classes),
                    "total_students": total_students,
                    "storage": Config.get_storage_info(),
                    "memory_free": self._get_memory_info()
                }
                response = json.dumps(status) + "\n"

            else:
                response = json.dumps({"status": "error", "message": "Unknown command"}) + "\n"

            # Send response
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['command'], response.encode('utf-8'))

        except Exception as e:
            print(f"Error handling command: {e}")
            response = json.dumps({"status": "error", "message": str(e)}) + "\n"
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['command'], response.encode('utf-8'))

    def _get_memory_info(self):
        """Get memory information"""
        import gc
        gc.collect()
        return {
            "free": gc.mem_free(),
            "allocated": gc.mem_alloc()
        }

    def _register_services(self):
        """Register GATT services and characteristics"""
        try:
            # Convert UUIDs to bytes
            service_uuid = bluetooth.UUID(Config.BLE_SERVICE_UUID)
            class_data_uuid = bluetooth.UUID(Config.CHAR_CLASS_DATA_UUID)
            storage_info_uuid = bluetooth.UUID(Config.CHAR_STORAGE_INFO_UUID)
            attendance_data_uuid = bluetooth.UUID(Config.CHAR_ATTENDANCE_DATA_UUID)
            command_uuid = bluetooth.UUID(Config.CHAR_COMMAND_UUID)

            # Define characteristics
            # (uuid, flags)
            characteristics = [
                (class_data_uuid, bluetooth.FLAG_READ | bluetooth.FLAG_WRITE | bluetooth.FLAG_NOTIFY),
                (storage_info_uuid, bluetooth.FLAG_READ),
                (attendance_data_uuid, bluetooth.FLAG_READ | bluetooth.FLAG_NOTIFY),
                (command_uuid, bluetooth.FLAG_WRITE | bluetooth.FLAG_NOTIFY),
            ]

            # Register service
            services = [(service_uuid, characteristics)]

            # Handle different return formats from gatts_register_services
            result = self.ble.gatts_register_services(services)
            print(f"BLE register result: {result}")
            print(f"Result type: {type(result)}, length: {len(result) if hasattr(result, '__len__') else 'N/A'}")

            # Parse the result based on the actual format returned
            char_handles = None

            # Handle the case ((16, 19, 21, 24),) - nested tuple with char handles
            if isinstance(result, tuple) and len(result) == 1:
                if isinstance(result[0], (tuple, list)) and len(result[0]) >= 4:
                    # This is the format we're seeing: ((16, 19, 21, 24),)
                    char_handles = result[0]
                    self.service_handle = None  # Service handle not returned in this format
                    print(f"Found nested tuple format with char handles: {char_handles}")
                else:
                    raise Exception(f"Unexpected single-element tuple format: {result}")

            # Handle the case (service_handles, char_handles)
            elif isinstance(result, tuple) and len(result) == 2:
                service_handles, char_handles = result
                if isinstance(service_handles, (list, tuple)) and len(service_handles) > 0:
                    self.service_handle = service_handles[0]
                else:
                    self.service_handle = service_handles
                print(f"Found service+char handles format: service={self.service_handle}, chars={char_handles}")

            # Handle flat list/tuple format
            elif isinstance(result, (list, tuple)) and len(result) >= 4:
                char_handles = result
                self.service_handle = None
                print(f"Found flat format with char handles: {char_handles}")

            else:
                raise Exception(f"Unsupported result format: {result}")

            # Store characteristic handles
            if char_handles and len(char_handles) >= 4:
                # Use the handles directly (they should be integers)
                self.char_handles = {
                    'class_data': char_handles[0],
                    'storage_info': char_handles[1],
                    'attendance_data': char_handles[2],
                    'command': char_handles[3]
                }
                print(f"Assigned characteristic handles: {self.char_handles}")
            else:
                raise Exception(f"Invalid or insufficient characteristic handles: {char_handles}")

            print("GATT services registered successfully")
            print(f"Service handle: {self.service_handle}")
            print(f"Characteristic handles: {self.char_handles}")

        except Exception as e:
            print(f"Error registering GATT services: {e}")
            raise

    def _advertise(self):
        """Start BLE advertising"""
        try:
            name = Config.BLE_DEVICE_NAME
            adv_data = bytearray()

            # Flags (General Discoverable Mode, BR/EDR Not Supported)
            adv_data.extend(b'\x02\x01\x06')

            # Complete local name
            name_bytes = name.encode('utf-8')
            adv_data.extend(bytes([len(name_bytes) + 1, 0x09]) + name_bytes)

            # Start advertising with simple data first
            self.ble.gap_advertise(100, adv_data)
            print(f"Advertising as: {name}")

        except Exception as e:
            print(f"Error starting advertising: {e}")
            # Try minimal advertising as fallback
            try:
                self.ble.gap_advertise(100)
                print("Started minimal advertising")
            except Exception as e2:
                print(f"Failed to start even minimal advertising: {e2}")
                raise

    def start(self):
        """Start the BLE server"""
        try:
            self._register_services()
            self._advertise()
            print("BLE server started successfully")
            return True
        except Exception as e:
            print(f"Failed to start BLE server: {e}")
            return False

    def stop(self):
        """Stop the BLE server"""
        try:
            self.ble.gap_advertise(None)
            self.ble.active(False)
            print("BLE server stopped")
        except Exception as e:
            print(f"Error stopping BLE server: {e}")

    def handle_events(self):
        """Handle any pending BLE events"""
        # This method can be called periodically to handle events
        # In MicroPython, BLE events are handled via interrupts
        pass

    def is_connected(self):
        """Check if a client is connected"""
        return self.connected

    def send_notification(self, characteristic, data):
        """Send notification to connected client"""
        if self.connected and characteristic in self.char_handles:
            try:
                char_handle = self.char_handles[characteristic]
                self.ble.gatts_notify(self.conn_handle, char_handle, data.encode('utf-8'))
                return True
            except Exception as e:
                print(f"Error sending notification: {e}")
                return False
        return False