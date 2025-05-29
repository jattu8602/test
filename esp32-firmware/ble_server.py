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

        # Data buffers
        self.rx_buffer = bytearray()
        self.tx_buffer = bytearray()

        print("BLE Server initialized")

    def _irq_handler(self, event, data):
        """Handle BLE interrupt events"""
        if event == _IRQ_CENTRAL_CONNECT:
            conn_handle, addr_type, addr = data
            self.conn_handle = conn_handle
            self.connected = True
            print(f"Client connected: {':'.join(['%02x' % b for b in addr])}")

        elif event == _IRQ_CENTRAL_DISCONNECT:
            conn_handle, addr_type, addr = data
            self.connected = False
            self.conn_handle = None
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
        """Handle write requests from client"""
        try:
            data = value.decode('utf-8')

            if value_handle == self.char_handles['class_data']:
                self._handle_class_data_write(data)
            elif value_handle == self.char_handles['command']:
                self._handle_command_write(data)

        except Exception as e:
            print(f"Error handling write: {e}")

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
                self.ble.gatts_write(value_handle, response.encode('utf-8'))

        except Exception as e:
            print(f"Error handling read: {e}")

    def _handle_class_data_write(self, data):
        """Handle class data synchronization"""
        try:
            classes_data = json.loads(data)
            success = self.data_manager.save_classes(classes_data)

            if success:
                print(f"Synced {len(classes_data)} classes")
                # Send confirmation
                response = json.dumps({"status": "success", "message": "Data synced successfully"})
            else:
                response = json.dumps({"status": "error", "message": "Failed to save data"})

            # Notify client of result
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['class_data'], response.encode('utf-8'))

        except Exception as e:
            print(f"Error syncing class data: {e}")
            response = json.dumps({"status": "error", "message": str(e)})
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
                })

            elif command == 'clear_all_attendance':
                success = self.data_manager.clear_all_attendance()
                response = json.dumps({
                    "status": "success" if success else "error",
                    "command": command
                })

            elif command == 'get_status':
                status = {
                    "device_name": Config.BLE_DEVICE_NAME,
                    "classes_count": len(self.data_manager.get_classes()),
                    "storage": Config.get_storage_info(),
                    "memory_free": self._get_memory_info()
                }
                response = json.dumps(status)

            else:
                response = json.dumps({"status": "error", "message": "Unknown command"})

            # Send response
            if self.connected:
                self.ble.gatts_notify(self.conn_handle, self.char_handles['command'], response.encode('utf-8'))

        except Exception as e:
            print(f"Error handling command: {e}")
            response = json.dumps({"status": "error", "message": str(e)})
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
        ((self.service_handle,), char_handles) = self.ble.gatts_register_services(services)

        # Store characteristic handles
        self.char_handles = {
            'class_data': char_handles[0][0],
            'storage_info': char_handles[1][0],
            'attendance_data': char_handles[2][0],
            'command': char_handles[3][0]
        }

        print("GATT services registered")

    def _advertise(self):
        """Start BLE advertising"""
        name = Config.BLE_DEVICE_NAME
        adv_data = bytearray()

        # Flags
        adv_data.extend(b'\x02\x01\x06')

        # Complete local name
        adv_data.extend(bytes([len(name) + 1, 0x09]) + name.encode())

        # Service UUID
        service_uuid_bytes = bytes.fromhex(Config.BLE_SERVICE_UUID.replace('-', ''))
        adv_data.extend(bytes([17, 0x06]) + service_uuid_bytes)

        self.ble.gap_advertise(100, adv_data)
        print(f"Advertising as: {name}")

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