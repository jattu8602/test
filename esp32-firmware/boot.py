"""
ESP32 Attendance System - Boot Configuration
Initial setup and configuration before main application starts
"""

import gc
import esp
import network
import time

# Disable ESP32 debug output for cleaner console
esp.osdebug(None)

# Enable garbage collection
gc.enable()

# Initial garbage collection
gc.collect()

print("ESP32 Attendance System - Boot")
print("==============================")
print(f"Free memory: {gc.mem_free()} bytes")
print(f"Allocated memory: {gc.mem_alloc()} bytes")

# Disable WiFi to save power (we only use Bluetooth)
try:
    wlan = network.WLAN(network.STA_IF)
    wlan.active(False)

    ap = network.WLAN(network.AP_IF)
    ap.active(False)

    print("WiFi disabled - using Bluetooth only")
except Exception as e:
    print(f"Warning: Could not disable WiFi: {e}")

# Set CPU frequency for optimal performance
try:
    import machine
    # Set to 240MHz for best performance
    machine.freq(240000000)
    print(f"CPU frequency set to: {machine.freq()} Hz")
except Exception as e:
    print(f"Warning: Could not set CPU frequency: {e}")

# Basic system info
try:
    import os
    print(f"File system: {os.listdir('/')}")
except Exception as e:
    print(f"Warning: Could not list file system: {e}")

print("Boot completed - starting main application...")
print("=" * 50)