import requests
import json

BASE_URL = "http://localhost:5000/api"

def test_recovery():
    print("Testing /api/recovery...")
    data = {
        "processes": ["P1", "P2"],
        "allocation": [[1, 0], [0, 1]],
        "max_demand": [[2, 1], [1, 2]],
        "resources": ["R1", "R2"]
    }
    try:
        response = requests.post(f"{BASE_URL}/recovery", json=data, timeout=5)
        if response.status_code == 200:
            result = response.json()
            print("Recovery Success:", json.dumps(result, indent=2))
            assert "victim" in result
            assert "new_allocation" in result
        else:
            print("Recovery Failed:", response.status_code, response.text)
    except Exception as e:
        print("Error:", e)

def test_banker_safe():
    print("\nTesting /api/banker/safe...")
    data = {
        "total": [10, 5, 7],
        "max_demand": [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
        "allocation": [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]]
    }
    response = requests.post(f"{BASE_URL}/banker/safe", json=data, timeout=5)
    print("Banker Safe Status:", response.json())

if __name__ == "__main__":
    test_recovery()
    test_banker_safe()
