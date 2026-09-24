from fastapi import APIRouter, Request, HTTPException, status
from datetime import datetime, timedelta
import secrets
from app.database import get_db, hash_password
from app.security import sign_payload, check_rate_limit, log_event, get_real_client_ip
from app.models import (
    ClientVerifyRequest,
    ClientActivateRequest,
    ClientLoginRequest,
    ClientHeartbeatRequest
)

router = APIRouter(prefix="/api/v1/client", tags=["Client Tool API"])

@router.post("/auth/login")
async def client_login(req: ClientLoginRequest, request: Request):
    client_ip = get_real_client_ip(request)
    if not check_rate_limit(client_ip, max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait 60 seconds.")

    conn = get_db()
    cursor = conn.cursor()

    # 1. Check App
    cursor.execute("SELECT * FROM apps WHERE app_code = ?", (req.app_code,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="Application code not found.")
    
    if app["status"] == "maintenance":
        conn.close()
        raise HTTPException(status_code=503, detail="Application is currently in maintenance mode.")

    # 2. Check User
    pass_hash = hash_password(req.password)
    cursor.execute("""
    SELECT * FROM users WHERE app_id = ? AND username = ?
    """, (app["id"], req.username))
    user = cursor.fetchone()

    if not user or user["password_hash"] != pass_hash:
        log_event(cursor, "LOGIN_FAILED", "warning", f"Failed login for username '{req.username}' on app '{req.app_code}'", client_ip, app["id"])
        conn.commit()
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if user["status"] == "suspended":
        log_event(cursor, "SUSPENDED_USER_BLOCKED", "danger", f"Suspended user '{req.username}' attempted login", client_ip, app["id"])
        conn.commit()
        conn.close()
        raise HTTPException(status_code=403, detail="Account has been suspended by administrator.")

    # Update login telemetry
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    UPDATE users SET last_login_at = ?, last_login_ip = ?, hwid_hash = ?
    WHERE id = ?
    """, (now_str, client_ip, req.hwid or user["hwid_hash"], user["id"]))

    log_event(cursor, "USER_LOGIN_SUCCESS", "success", f"User '{user['username']}' logged in successfully via tool client", client_ip, app["id"])
    conn.commit()

    # Session token
    session_token = "sess_" + secrets.token_hex(20)
    signature = sign_payload(f"{user['username']}:{session_token}", app["secret_key"])

    response_data = {
        "status": "success",
        "code": "AUTH_SUCCESS",
        "message": f"Welcome back, {user['username']}",
        "data": {
            "user_id": user["id"],
            "username": user["username"],
            "app_code": app["app_code"],
            "app_version": app["version"],
            "license_key": user["license_key"],
            "session_token": session_token,
            "signature": signature,
            "server_time": now_str
        }
    }
    conn.close()
    return response_data

@router.post("/license/verify")
async def verify_license(req: ClientVerifyRequest, request: Request):
    client_ip = get_real_client_ip(request)
    if not check_rate_limit(client_ip, max_requests=60, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    conn = get_db()
    cursor = conn.cursor()

    # Find App
    cursor.execute("SELECT * FROM apps WHERE app_code = ?", (req.app_code,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="Application code not found.")

    if app["status"] == "maintenance":
        conn.close()
        raise HTTPException(status_code=503, detail="Application is currently in maintenance mode.")

    # Find License
    cursor.execute("SELECT * FROM licenses WHERE app_id = ? AND license_key = ?", (app["id"], req.license_key))
    lic = cursor.fetchone()
    if not lic:
        log_event(cursor, "INVALID_KEY_ATTEMPT", "warning", f"Invalid key attempt: {req.license_key} from IP {client_ip}", client_ip, app["id"])
        conn.commit()
        conn.close()
        raise HTTPException(status_code=404, detail="License key does not exist.")

    # Check Ban
    if lic["status"] == "banned":
        log_event(cursor, "BANNED_KEY_DETECTED", "danger", f"Banned key {lic['license_key']} attempted verification", client_ip, app["id"])
        conn.commit()
        conn.close()
        raise HTTPException(status_code=403, detail="License key has been revoked/banned by administrator.")

    # Check Expiration
    now = datetime.utcnow()
    if lic["expires_at"]:
        exp_dt = datetime.strptime(lic["expires_at"], "%Y-%m-%d %H:%M:%S")
        if now > exp_dt:
            cursor.execute("UPDATE licenses SET status = 'expired' WHERE id = ?", (lic["id"],))
            log_event(cursor, "EXPIRED_KEY_REJECTED", "warning", f"Expired key {lic['license_key']} rejected", client_ip, app["id"])
            conn.commit()
            conn.close()
            raise HTTPException(status_code=403, detail="License key has expired.")

    # Check HWID Binding
    cursor.execute("SELECT * FROM license_hwids WHERE license_id = ?", (lic["id"],))
    bound_hwids = cursor.fetchall()
    bound_list = [h["hwid_hash"] for h in bound_hwids]

    hwid_matched = req.hwid in bound_list

    if not hwid_matched:
        # If not activated yet or slots available, prompt to activate
        max_allowed = lic["max_hwid"]
        if max_allowed != -1 and len(bound_hwids) >= max_allowed:
            log_event(cursor, "HWID_MISMATCH_BLOCKED", "danger", f"HWID mismatch on key {lic['license_key']}. Bound: {len(bound_hwids)}/{max_allowed}, Incoming: {req.hwid}", client_ip, app["id"])
            conn.commit()
            conn.close()
            raise HTTPException(
                status_code=403,
                detail=f"Hardware ID mismatch. Max allowed devices ({max_allowed}) already registered. Contact seller to reset HWID."
            )
        else:
            # Can activate
            conn.close()
            return {
                "status": "pending_activation",
                "code": "KEY_REQUIRES_ACTIVATION",
                "message": "Key is valid and has available device slots. Please call /license/activate to bind this device.",
                "data": {
                    "license_key": lic["license_key"],
                    "slots_available": (max_allowed - len(bound_hwids)) if max_allowed != -1 else "Unlimited",
                    "duration_days": lic["duration_days"]
                }
            }

    # HWID is matched! Update last seen
    cursor.execute("""
    UPDATE license_hwids SET last_seen_at = CURRENT_TIMESTAMP, ip_address = ?
    WHERE license_id = ? AND hwid_hash = ?
    """, (client_ip, lic["id"], req.hwid))
    conn.commit()

    remaining_seconds = 0
    if lic["expires_at"]:
        exp_dt = datetime.strptime(lic["expires_at"], "%Y-%m-%d %H:%M:%S")
        remaining_seconds = max(0, int((exp_dt - now).total_seconds()))
    else:
        remaining_seconds = -1 # Lifetime

    signature = sign_payload(f"{lic['license_key']}:{req.hwid}:{remaining_seconds}", app["secret_key"])

    log_event(cursor, "LICENSE_VERIFIED", "success", f"License {lic['license_key']} verified on HWID {req.hwid[:16]}...", client_ip, app["id"])
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "code": "LICENSE_VALID",
        "message": "License verified and valid for this machine.",
        "data": {
            "license_key": lic["license_key"],
            "hwid": req.hwid,
            "status": lic["status"],
            "max_hwid": "Unlimited" if lic["max_hwid"] == -1 else lic["max_hwid"],
            "active_devices": len(bound_hwids),
            "duration_days": "Lifetime" if lic["duration_days"] == -1 else lic["duration_days"],
            "activated_at": lic["activated_at"],
            "expires_at": lic["expires_at"] or "Lifetime",
            "remaining_seconds": remaining_seconds,
            "signature": signature
        }
    }

@router.post("/license/activate")
async def activate_license(req: ClientActivateRequest, request: Request):
    client_ip = get_real_client_ip(request)
    conn = get_db()
    cursor = conn.cursor()

    # Find App
    cursor.execute("SELECT * FROM apps WHERE app_code = ?", (req.app_code,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="Application code not found.")

    # Find License
    cursor.execute("SELECT * FROM licenses WHERE app_id = ? AND license_key = ?", (app["id"], req.license_key))
    lic = cursor.fetchone()
    if not lic:
        conn.close()
        raise HTTPException(status_code=404, detail="License key not found.")

    if lic["status"] == "banned":
        conn.close()
        raise HTTPException(status_code=403, detail="License key is revoked/banned.")

    # Check existing bound HWIDs
    cursor.execute("SELECT * FROM license_hwids WHERE license_id = ?", (lic["id"],))
    bound_hwids = cursor.fetchall()

    for h in bound_hwids:
        if h["hwid_hash"] == req.hwid:
            conn.close()
            return {
                "status": "success",
                "code": "ALREADY_ACTIVATED",
                "message": "This device is already activated for this key."
            }

    # Check device slot limit
    if lic["max_hwid"] != -1 and len(bound_hwids) >= lic["max_hwid"]:
        conn.close()
        raise HTTPException(status_code=403, detail=f"Cannot activate: Device limit ({lic['max_hwid']}) reached.")

    # Bind new HWID
    cursor.execute("""
    INSERT INTO license_hwids (license_id, hwid_hash, device_name, ip_address)
    VALUES (?, ?, ?, ?)
    """, (lic["id"], req.hwid, req.device_name or "Client PC", client_ip))

    now = datetime.utcnow()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # If first activation, set activated_at and calculate expires_at
    if not lic["activated_at"]:
        if lic["duration_days"] != -1:
            expires_dt = now + timedelta(days=lic["duration_days"])
            exp_str = expires_dt.strftime("%Y-%m-%d %H:%M:%S")
        else:
            exp_str = None
        
        cursor.execute("""
        UPDATE licenses SET activated_at = ?, expires_at = ?, status = 'bound'
        WHERE id = ?
        """, (now_str, exp_str, lic["id"]))
    else:
        cursor.execute("UPDATE licenses SET status = 'bound' WHERE id = ?", (lic["id"],))

    log_event(cursor, "LICENSE_ACTIVATED", "success", f"License {lic['license_key']} bound to device '{req.device_name}' (HWID: {req.hwid[:16]}...)", client_ip, app["id"])
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "code": "ACTIVATION_SUCCESS",
        "message": "Hardware ID successfully registered and license bound.",
        "data": {
            "license_key": lic["license_key"],
            "hwid": req.hwid,
            "registered_devices": len(bound_hwids) + 1,
            "max_devices": "Unlimited" if lic["max_hwid"] == -1 else lic["max_hwid"]
        }
    }

@router.post("/license/heartbeat")
async def license_heartbeat(req: ClientHeartbeatRequest, request: Request):
    client_ip = get_real_client_ip(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM apps WHERE app_code = ?", (req.app_code,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="App not found.")

    cursor.execute("SELECT * FROM licenses WHERE app_id = ? AND license_key = ?", (app["id"], req.license_key))
    lic = cursor.fetchone()
    if not lic:
        conn.close()
        raise HTTPException(status_code=404, detail="License not found.")

    if lic["status"] != "bound":
        conn.close()
        raise HTTPException(status_code=403, detail=f"License is not in bound state (Current: {lic['status']}).")

    # Update last seen
    cursor.execute("""
    UPDATE license_hwids SET last_seen_at = CURRENT_TIMESTAMP, ip_address = ?
    WHERE license_id = ? AND hwid_hash = ?
    """, (client_ip, lic["id"], req.hwid))
    
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "code": "HEARTBEAT_ACK",
        "server_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "keepalive": True
    }

@router.get("/app/version")
async def get_app_version(app_code: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name, app_code, version, status, download_url FROM apps WHERE app_code = ?", (app_code,))
    app = cursor.fetchone()
    conn.close()
    if not app:
        raise HTTPException(status_code=404, detail="App not found.")
    return dict(app)
