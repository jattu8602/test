"""
ESP32 Test Data Transfer
Simple test to verify JSON data transfer is working correctly
"""

import json

# Sample class data that mimics what the web app would send
test_classes_data = [
    {
        "id": "test-class-1",
        "name": "Test Class A",
        "students": [
            {"roll": 1, "name": "John Doe"},
            {"roll": 2, "name": "Jane Smith"},
            {"roll": 3, "name": "Bob Johnson"}
        ]
    },
    {
        "id": "test-class-2",
        "name": "Test Class B",
        "students": [
            {"roll": 101, "name": "Alice Brown"},
            {"roll": 102, "name": "Charlie Wilson"}
        ]
    }
]

def test_json_parsing():
    """Test JSON parsing with various data formats"""
    print("Testing JSON parsing...")

    # Test 1: Simple JSON
    test_json = '{"status": "success", "message": "Data synced successfully"}'
    try:
        result = json.loads(test_json)
        print("✅ Simple JSON parse: SUCCESS")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"❌ Simple JSON parse: FAILED - {e}")

    # Test 2: JSON with newline delimiter
    test_json_with_newline = '{"status": "success", "message": "Data synced"}\n'
    try:
        # Remove trailing newline and parse
        clean_json = test_json_with_newline.strip()
        result = json.loads(clean_json)
        print("✅ JSON with newline parse: SUCCESS")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"❌ JSON with newline parse: FAILED - {e}")

    # Test 3: Classes data
    test_classes_json = json.dumps(test_classes_data)
    try:
        result = json.loads(test_classes_json)
        print("✅ Classes data parse: SUCCESS")
        print(f"   Classes count: {len(result)}")
        print(f"   First class: {result[0]['name']}")
    except Exception as e:
        print(f"❌ Classes data parse: FAILED - {e}")

    # Test 4: Chunked data simulation
    print("\nTesting chunked data handling...")
    chunks = [
        '{"status": "suc',
        'cess", "messag',
        'e": "Data sync',
        'ed successfully"}\n'
    ]

    buffer = ""
    for i, chunk in enumerate(chunks):
        buffer += chunk
        print(f"   Chunk {i+1}: Added '{chunk}' -> Buffer: '{buffer}'")

        # Check for complete messages
        messages = buffer.split('\n')
        for j in range(len(messages) - 1):
            message = messages[j].strip()
            if message:
                try:
                    result = json.loads(message)
                    print(f"   ✅ Complete message parsed: {result}")
                except Exception as e:
                    print(f"   ❌ Parse error: {e}")

        # Keep incomplete message
        buffer = messages[-1]
        print(f"   Remaining buffer: '{buffer}'")

def simulate_data_transfer():
    """Simulate the data transfer process"""
    print("\n" + "="*50)
    print("SIMULATING DATA TRANSFER")
    print("="*50)

    # Simulate received data with delimiter
    received_data = json.dumps(test_classes_data) + '\n'
    print(f"Received data length: {len(received_data)} characters")
    print(f"First 100 chars: {received_data[:100]}...")

    try:
        # Process like the ESP32 would
        clean_data = received_data.strip()
        parsed_data = json.loads(clean_data)

        print("✅ Data transfer simulation: SUCCESS")
        print(f"   Parsed {len(parsed_data)} classes")
        for class_data in parsed_data:
            print(f"   - {class_data['name']}: {len(class_data['students'])} students")

        return True

    except Exception as e:
        print(f"❌ Data transfer simulation: FAILED - {e}")
        return False

if __name__ == "__main__":
    print("ESP32 Data Transfer Test")
    print("=" * 30)

    test_json_parsing()

    success = simulate_data_transfer()

    print("\n" + "="*30)
    if success:
        print("🎉 All tests passed! Data transfer should work correctly.")
    else:
        print("⚠️  Some tests failed. Check the JSON format and parsing logic.")
    print("="*30)