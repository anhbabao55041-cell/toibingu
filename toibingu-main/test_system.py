import sys
from app.database import init_db, get_db, hash_password
from app.security import generate_key
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print(">>> Starting System Verification Tests...")
    init_db()
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] 1. Server Health Check")

    # 2. Seller Stats
    res = client.get("/api/v1/seller/stats")
    assert res.status_code == 200
    stats = res.json()["metrics"]
    print(f"[PASS] 2. Dashboard Stats: {stats['total_apps']} Apps, {stats['total_licenses']} Keys, {stats['total_users']} Users")

    # 3. Generate License with HWID=1, Duration=30 days
    gen_payload = {
        "app_id": 1,
        "hwid_limit": 1,
        "duration_days": 30,
        "prefix": "CYBERTEST",
        "mask": "XXXX-XXXX-XXXX",
        "quantity": 1,
        "client_tag": "Automated Tester",
        "notes": "Testing HWID Lock"
    }
    res = client.post("/api/v1/seller/licenses/generate", json=gen_payload)
    assert res.status_code == 200, f"Generate failed: {res.text}"
    new_key = res.json()["keys"][0]
    print(f"[PASS] 3. Generated Key: {new_key}")

    # 4. Verify new key on machine A before activation -> pending activation
    verify_payload = {
        "app_code": "AEGIS-SEC",
        "license_key": new_key,
        "hwid": "HWID-MACHINE-ALPHA-01",
        "device_name": "Test Rig Alpha"
    }
    res = client.post("/api/v1/client/license/verify", json=verify_payload)
    assert res.status_code == 200
    assert res.json()["code"] == "KEY_REQUIRES_ACTIVATION"
    print("[PASS] 4. Key correctly recognized as needing device activation")

    # 5. Activate key on machine A
    act_payload = {
        "app_code": "AEGIS-SEC",
        "license_key": new_key,
        "hwid": "HWID-MACHINE-ALPHA-01",
        "device_name": "Test Rig Alpha"
    }
    res = client.post("/api/v1/client/license/activate", json=act_payload)
    assert res.status_code == 200
    assert res.json()["code"] == "ACTIVATION_SUCCESS"
    print("[PASS] 5. Key activated on Machine Alpha (1/1 device slots used)")

    # 6. Verify again on machine A -> Valid!
    res = client.post("/api/v1/client/license/verify", json=verify_payload)
    assert res.status_code == 200
    assert res.json()["code"] == "LICENSE_VALID"
    print(f"[PASS] 6. Key verified successfully for Machine Alpha. Remaining seconds: {res.json()['data']['remaining_seconds']}")

    # 7. Try to verify on machine B (Unregistered HWID) -> 403 HWID mismatch blocked!
    res = client.post("/api/v1/client/license/verify", json={
        "app_code": "AEGIS-SEC",
        "license_key": new_key,
        "hwid": "HWID-ROGUE-BETA-02",
        "device_name": "Rogue Rig Beta"
    })
    assert res.status_code == 403, f"Expected 403 mismatch, got: {res.status_code}"
    print("[PASS] 7. Machine Beta blocked by HWID Lock (Protection working!)")

    # 8. Seller Reset HWID
    # Find license ID
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM licenses WHERE license_key = ?", (new_key,))
    lic_id = c.fetchone()["id"]
    conn.close()

    res = client.post("/api/v1/seller/licenses/reset-hwid", json={"license_id": lic_id})
    assert res.status_code == 200
    print("[PASS] 8. HWID reset performed by Seller")

    # 9. Now Machine Beta can activate because slots were cleared
    res = client.post("/api/v1/client/license/activate", json={
        "app_code": "AEGIS-SEC",
        "license_key": new_key,
        "hwid": "HWID-ROGUE-BETA-02",
        "device_name": "Rogue Rig Beta"
    })
    assert res.status_code == 200
    print("[PASS] 9. Machine Beta successfully activated after HWID reset")

    # 10. Test User Login and Remote Suspension
    # Create user
    res = client.post("/api/v1/seller/users", json={
        "app_id": 1,
        "username": "tester_agent_007",
        "password": "secure_secret_pass",
        "license_key": new_key
    })
    assert res.status_code == 200
    u_id = res.json()["user_id"]
    print(f"[PASS] 10. Created User 'tester_agent_007' (ID: {u_id})")

    # Login user
    res = client.post("/api/v1/client/auth/login", json={
        "app_code": "AEGIS-SEC",
        "username": "tester_agent_007",
        "password": "secure_secret_pass",
        "hwid": "HWID-ROGUE-BETA-02"
    })
    assert res.status_code == 200
    print("[PASS] 11. User logged in via Client Tool API")

    # Suspend user remotely
    res = client.post("/api/v1/seller/users/update-status", json={"user_id": u_id, "status": "suspended"})
    assert res.status_code == 200

    # Login again -> blocked!
    res = client.post("/api/v1/client/auth/login", json={
        "app_code": "AEGIS-SEC",
        "username": "tester_agent_007",
        "password": "secure_secret_pass",
        "hwid": "HWID-ROGUE-BETA-02"
    })
    assert res.status_code == 403
    print("[PASS] 12. Remotely Suspended User successfully blocked from logging into tool")

    # 13. System Domain Info
    res = client.get("/api/v1/system/domain-info")

    assert res.status_code == 200
    assert "origin" in res.json()
    assert res.json()["features"]["reverse_key_binding"] is True
    print("[PASS] 13. Domain Info Endpoint & Render Custom Domain Readiness")

    # 14. Generate Reverse Key (Key Ngược Chiều - Bound Directly to HWID)
    rev_payload = {
        "app_id": 1,
        "hwid": "HWID-CUSTOMER-DIRECT-MACHINE-99",
        "device_name": "VIP Customer Desktop",
        "duration_days": 30,
        "prefix": "REVIP",
        "client_tag": "VIP Order #771",
        "notes": "Direct binding test"
    }
    res = client.post("/api/v1/seller/licenses/generate-reverse", json=rev_payload)
    assert res.status_code == 200, f"Generate reverse failed: {res.text}"
    rev_data = res.json()
    assert rev_data["code"] == "REVERSE_KEY_CREATED"
    rev_key = rev_data["license_key"]
    print(f"[PASS] 14. Reverse Key Created: {rev_key} (Directly bound to HWID)")

    # 15. Verify Reverse Key directly - client does NOT need activation step!
    res = client.post("/api/v1/client/license/verify", json={
        "app_code": "AEGIS-SEC",
        "license_key": rev_key,
        "hwid": "HWID-CUSTOMER-DIRECT-MACHINE-99",
        "device_name": "VIP Customer Desktop"
    })
    assert res.status_code == 200
    assert res.json()["code"] == "LICENSE_VALID"
    print(f"[PASS] 15. Reverse Key instantly Validated on target HWID without pending activation!")

    # 16. Reverse Lookup by HWID
    res = client.get("/api/v1/seller/licenses/reverse-lookup?hwid=HWID-CUSTOMER-DIRECT-MACHINE-99")
    assert res.status_code == 200
    assert res.json()["total_matched"] >= 1
    assert res.json()["licenses"][0]["license_key"] == rev_key
    print("[PASS] 16. Reverse Lookup by HWID successfully returned bound license")

    # 17. External Bot/Shop API Generation with Header Authentication
    ext_payload = {
        "app_code": "AEGIS-SEC",
        "hwid": "HWID-DISCORD-BOT-BUYER-01",
        "duration_days": 14,
        "prefix": "EXTREV",
        "client_tag": "Discord Bot Customer"
    }
    res = client.post(
        "/api/v1/seller/licenses/external/generate",
        json=ext_payload,
        headers={"X-Api-Key": "ca_live_948a201dfbc83e74"}
    )
    assert res.status_code == 200, f"External generate failed: {res.text}"
    assert res.json()["type"] == "reverse_bound_key"
    print(f"[PASS] 17. External API (Discord Bot / Web Shop) successfully issued Reverse Key: {res.json()['license_key']}")

    print("\n=======================================================")
    print(" >>> ALL 17 SYSTEM & REVERSE KEY TESTS PASSED! <<<")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()

