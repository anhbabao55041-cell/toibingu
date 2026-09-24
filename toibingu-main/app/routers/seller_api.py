import os
from fastapi import APIRouter, HTTPException, status, Request, Query
from datetime import datetime, timedelta
import time
import requests
import json
from typing import Optional
from app.database import get_db, hash_password
from app.security import generate_key, generate_api_tokens, log_event, get_real_client_ip, sign_payload
from app.models import (
    GenerateLicenseRequest,
    ResetHWIDRequest,
    UpdateLicenseStatusRequest,
    ExtendLicenseRequest,
    CreateUserRequest,
    UpdateUserStatusRequest,
    ResetUserPasswordRequest,
    CreateAppRequest,
    UpdateAppRequest,
    CreateApiKeyRequest,
    SandboxExecuteRequest,
    GenerateReverseKeyRequest,
    ReverseLookupRequest,
    ExternalGenerateKeyRequest
)
from pydantic import BaseModel

class SellerLoginRequest(BaseModel):
    access_key: str

router = APIRouter(prefix="/api/v1/seller", tags=["Seller Dashboard API"])

# ==================== SELLER LOGIN AUTHENTICATION ====================
@router.post("/auth/login")
async def seller_login(req: SellerLoginRequest):
    allowed_key = os.getenv("SELLER_ACCESS_KEY", "thai")
    if req.access_key.strip() == allowed_key:
        return {
            "status": "success",
            "code": "AUTH_SUCCESS",
            "message": "Đăng nhập thành công vào Hệ Thống Quản Trị quocthaiAuth - CYBERAUTH!",
            "token": "ca_sess_" + generate_api_tokens()[0][8:],
            "user": {
                "name": "Quản Trị Viên Thái",
                "role": "SUPER ADMIN",
                "access_level": "Root Clearance"
            }
        }
    raise HTTPException(
        status_code=401,
        detail="Mã khóa truy cập không chính xác! Vui lòng nhập đúng khóa bảo mật được cấp."
    )



# ==================== STATS & TELEMETRY ====================
@router.get("/stats")
async def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as c FROM apps")
    total_apps = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM licenses")
    total_licenses = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM licenses WHERE status = 'active'")
    active_licenses = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM licenses WHERE status = 'bound'")
    bound_licenses = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM licenses WHERE status = 'banned'")
    banned_licenses = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM licenses WHERE status = 'expired'")
    expired_licenses = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM license_hwids")
    total_hwids = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM users")
    total_users = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM security_logs WHERE severity IN ('danger', 'warning')")
    security_alerts = cursor.fetchone()["c"]

    # Recent security logs
    cursor.execute("""
    SELECT id, event_type, severity, source_ip, details, timestamp 
    FROM security_logs ORDER BY id DESC LIMIT 8
    """)
    recent_logs = [dict(r) for r in cursor.fetchall()]

    # Hardware breakdown
    cursor.execute("SELECT max_hwid, COUNT(*) as count FROM licenses GROUP BY max_hwid")
    hwid_distribution = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "metrics": {
            "total_apps": total_apps,
            "total_licenses": total_licenses,
            "active_licenses": active_licenses,
            "bound_licenses": bound_licenses,
            "banned_licenses": banned_licenses,
            "expired_licenses": expired_licenses,
            "total_hwids": total_hwids,
            "total_users": total_users,
            "security_alerts": security_alerts
        },
        "recent_logs": recent_logs,
        "hwid_distribution": hwid_distribution
    }

# ==================== APPLICATIONS ====================
@router.get("/apps")
async def list_apps():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT a.*, 
        (SELECT COUNT(*) FROM licenses WHERE app_id = a.id) as license_count,
        (SELECT COUNT(*) FROM users WHERE app_id = a.id) as user_count
    FROM apps a ORDER BY a.id ASC
    """)
    apps = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return apps

@router.post("/apps")
async def create_app(req: CreateAppRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check duplicate code
    cursor.execute("SELECT id FROM apps WHERE app_code = ?", (req.app_code.upper(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"App Code '{req.app_code}' already exists.")

    secret_key = "sec_live_" + generate_api_tokens()[0][8:]
    cursor.execute("""
    INSERT INTO apps (name, app_code, secret_key, version, description, download_url, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    """, (req.name, req.app_code.upper(), secret_key, req.version, req.description, req.download_url))
    
    app_id = cursor.lastrowid
    log_event(cursor, "APP_CREATED", "info", f"New application created: {req.name} ({req.app_code.upper()})", app_id=app_id)
    conn.commit()
    conn.close()
    return {"message": "Application created successfully", "app_id": app_id, "app_code": req.app_code.upper()}

@router.put("/apps/{app_id}")
async def update_app(app_id: int, req: UpdateAppRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM apps WHERE id = ?", (app_id,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="App not found.")

    updates = []
    params = []
    if req.name is not None:
        updates.append("name = ?")
        params.append(req.name)
    if req.version is not None:
        updates.append("version = ?")
        params.append(req.version)
    if req.status is not None:
        updates.append("status = ?")
        params.append(req.status)
    if req.download_url is not None:
        updates.append("download_url = ?")
        params.append(req.download_url)
    if req.description is not None:
        updates.append("description = ?")
        params.append(req.description)

    if updates:
        params.append(app_id)
        cursor.execute(f"UPDATE apps SET {', '.join(updates)} WHERE id = ?", params)
        log_event(cursor, "APP_UPDATED", "info", f"Application '{app['name']}' updated", app_id=app_id)
        conn.commit()

    conn.close()
    return {"message": "Application updated"}

@router.delete("/apps/{app_id}")
async def delete_app(app_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM apps WHERE id = ?", (app_id,))
    conn.commit()
    conn.close()
    return {"message": "Application and related resources deleted"}

# ==================== LICENSES & GENERATOR ====================
@router.get("/licenses")
async def list_licenses(app_id: int = None, status: str = None, search: str = None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
    SELECT l.*, a.name as app_name, a.app_code
    FROM licenses l
    JOIN apps a ON l.app_id = a.id
    WHERE 1=1
    """
    params = []

    if app_id:
        query += " AND l.app_id = ?"
        params.append(app_id)
    if status:
        query += " AND l.status = ?"
        params.append(status)
    if search:
        query += " AND (l.license_key LIKE ? OR l.client_tag LIKE ? OR l.notes LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY l.id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    licenses_list = []
    for r in rows:
        lic_dict = dict(r)
        # Fetch bound HWIDs
        cursor.execute("SELECT hwid_hash, device_name, ip_address, last_seen_at FROM license_hwids WHERE license_id = ?", (lic_dict["id"],))
        lic_dict["hwids"] = [dict(h) for h in cursor.fetchall()]
        licenses_list.append(lic_dict)

    conn.close()
    return licenses_list

@router.post("/licenses/generate")
async def generate_licenses(req: GenerateLicenseRequest):
    conn = get_db()
    cursor = conn.cursor()

    # Verify App
    cursor.execute("SELECT id, name, app_code FROM apps WHERE id = ?", (req.app_id,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="Application not found.")

    generated_keys = []
    for _ in range(req.quantity):
        # Generate unique key
        key_str = generate_key(prefix=req.prefix, mask=req.mask)
        cursor.execute("""
        INSERT INTO licenses (app_id, license_key, max_hwid, duration_days, status, client_tag, notes)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
        """, (req.app_id, key_str, req.hwid_limit, req.duration_days, req.client_tag, req.notes))
        generated_keys.append(key_str)

    log_event(cursor, "KEY_GENERATED", "info", f"Generated {req.quantity} keys for {app['name']} (HWID: {req.hwid_limit}, Days: {req.duration_days})", app_id=req.app_id)
    conn.commit()
    conn.close()

    return {
        "message": f"Successfully generated {len(generated_keys)} license keys",
        "keys": generated_keys,
        "app_name": app["name"],
        "hwid_limit": req.hwid_limit,
        "duration_days": req.duration_days
    }

# ==================== TẠO KEY NGƯỢC CHIỀU (REVERSE BINDING) ====================
@router.post("/licenses/generate-reverse")
async def generate_reverse_license(req: GenerateReverseKeyRequest, request: Request):
    """
    Tạo Key Ngược Chiều (Reverse-Bound License):
    Khóa cứng và kích hoạt License Key trực tiếp với Hardware ID (HWID) của khách hàng ngay tại thời điểm tạo.
    """
    clean_hwid = req.hwid.strip()
    if not clean_hwid:
        raise HTTPException(status_code=400, detail="Mã phần cứng (HWID) không được để trống!")

    conn = get_db()
    cursor = conn.cursor()

    # Find App
    if req.app_id:
        cursor.execute("SELECT id, name, app_code, secret_key FROM apps WHERE id = ?", (req.app_id,))
    elif req.app_code:
        cursor.execute("SELECT id, name, app_code, secret_key FROM apps WHERE app_code = ?", (req.app_code.upper(),))
    else:
        # Default to first app
        cursor.execute("SELECT id, name, app_code, secret_key FROM apps ORDER BY id ASC LIMIT 1")
    
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy ứng dụng chỉ định.")

    # Generate Unique Reverse Key
    prefix = req.prefix.strip().upper() if req.prefix else "REV"
    mask = req.mask.strip() if req.mask else "XXXX-XXXX-XXXX"
    key_str = generate_key(prefix=prefix, mask=mask)

    now = datetime.utcnow()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    if req.duration_days != -1:
        exp_dt = now + timedelta(days=req.duration_days)
        exp_str = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
        remaining_seconds = int((exp_dt - now).total_seconds())
    else:
        exp_str = None
        remaining_seconds = -1

    # Insert into licenses directly as 'bound'
    cursor.execute("""
    INSERT INTO licenses (app_id, license_key, max_hwid, duration_days, activated_at, expires_at, status, client_tag, notes)
    VALUES (?, ?, 1, ?, ?, ?, 'bound', ?, ?)
    """, (app["id"], key_str, req.duration_days, now_str, exp_str, req.client_tag or "Tạo Ngược Chiều", req.notes or f"Khóa trực tiếp HWID: {clean_hwid[:16]}..."))
    
    lic_id = cursor.lastrowid
    client_ip = get_real_client_ip(request)

    # Immediately bind HWID
    cursor.execute("""
    INSERT INTO license_hwids (license_id, hwid_hash, device_name, ip_address, first_bound_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (lic_id, clean_hwid, req.device_name or "Khách Hàng PC", client_ip, now_str, now_str))

    # HMAC Signature for anti-tamper verification
    sig_payload = f"{key_str}:{clean_hwid}:{remaining_seconds}"
    signature = sign_payload(sig_payload, app["secret_key"])

    log_event(cursor, "REVERSE_KEY_GENERATED", "success", f"Reverse Key {key_str} created and bound directly to HWID '{clean_hwid[:20]}...'", client_ip, app["id"])
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "code": "REVERSE_KEY_CREATED",
        "message": "Đã tạo License Key ngược chiều và liên kết trực tiếp với máy tính của khách!",
        "license_key": key_str,
        "hwid": clean_hwid,
        "app_id": app["id"],
        "app_code": app["app_code"],
        "app_name": app["name"],
        "duration_days": "Lifetime" if req.duration_days == -1 else req.duration_days,
        "activated_at": now_str,
        "expires_at": exp_str or "Trọn Đời (Lifetime)",
        "remaining_seconds": remaining_seconds,
        "device_name": req.device_name or "Khách Hàng PC",
        "signature": signature
    }

# ==================== TRA CỨU NGƯỢC TỪ HWID ====================
@router.get("/licenses/reverse-lookup")
async def reverse_lookup_by_hwid(hwid: str, app_code: Optional[str] = None):
    """
    Tra cứu ngược từ mã phần cứng HWID:
    Tìm xem máy tính có HWID này đang liên kết với license nào.
    """
    clean_hwid = hwid.strip()
    if not clean_hwid:
        raise HTTPException(status_code=400, detail="Mã HWID không được để trống!")

    conn = get_db()
    cursor = conn.cursor()

    query = """
    SELECT l.*, a.name as app_name, a.app_code, h.hwid_hash, h.device_name, h.last_seen_at, h.ip_address as bound_ip
    FROM license_hwids h
    JOIN licenses l ON h.license_id = l.id
    JOIN apps a ON l.app_id = a.id
    WHERE h.hwid_hash = ?
    """
    params = [clean_hwid]
    if app_code:
        query += " AND a.app_code = ?"
        params.append(app_code.upper())

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = [dict(r) for r in rows]
    return {
        "status": "success",
        "query_hwid": clean_hwid,
        "total_matched": len(results),
        "licenses": results
    }

# ==================== EXTERNAL API LIÊN KẾT NGOÀI (BOTS / SHOPS) ====================
@router.post("/licenses/external/generate")
async def external_generate_license(req: ExternalGenerateKeyRequest, request: Request):
    """
    Endpoint liên kết API dành cho hệ thống bên thứ 3 (Web shop tự động, Discord bot, Telegram bot).
    Xác thực qua Header: X-Api-Key hoặc Authorization Bearer.
    Nếu cung cấp `hwid`: tự động tạo Key Ngược Chiều đã bind HWID ngay lập tức!
    """
    # 1. Authenticate Seller API Key
    api_key = request.headers.get("x-api-key")
    auth_header = request.headers.get("authorization", "")
    secret_token = request.headers.get("x-secret-token")

    if auth_header.startswith("Bearer "):
        secret_token = auth_header[7:].strip()

    conn = get_db()
    cursor = conn.cursor()

    # Verify key
    if api_key:
        cursor.execute("SELECT * FROM seller_api_keys WHERE api_key = ? AND is_active = 1", (api_key,))
    elif secret_token:
        cursor.execute("SELECT * FROM seller_api_keys WHERE secret_token = ? AND is_active = 1", (secret_token,))
    else:
        conn.close()
        raise HTTPException(
            status_code=401, 
            detail="Thiếu thông tin xác thực! Vui lòng truyền Header 'X-Api-Key' hoặc 'X-Secret-Token' / 'Authorization: Bearer <token>'."
        )

    seller = cursor.fetchone()
    if not seller:
        conn.close()
        raise HTTPException(status_code=401, detail="API Key không hợp lệ hoặc đã bị vô hiệu hóa.")

    # Whitelist check
    client_ip = get_real_client_ip(request)
    if seller["ip_whitelist"] != "*":
        allowed_ips = [ip.strip() for ip in seller["ip_whitelist"].split(",") if ip.strip()]
        if client_ip not in allowed_ips:
            conn.close()
            raise HTTPException(status_code=403, detail=f"IP '{client_ip}' không nằm trong danh sách Whitelist cho phép của API Key này.")

    # Find App
    cursor.execute("SELECT id, name, app_code, secret_key FROM apps WHERE app_code = ?", (req.app_code.upper(),))
    app = cursor.fetchone()
    if not app:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ứng dụng với mã App Code '{req.app_code}'.")

    # Generate key
    prefix = req.prefix.strip().upper() if req.prefix else "CYBER"
    mask = req.mask.strip() if req.mask else "XXXX-XXXX-XXXX"
    key_str = generate_key(prefix=prefix, mask=mask)

    now = datetime.utcnow()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # Check if HWID is provided -> REVERSE BOUND KEY!
    if req.hwid and req.hwid.strip():
        clean_hwid = req.hwid.strip()
        if req.duration_days != -1:
            exp_dt = now + timedelta(days=req.duration_days)
            exp_str = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
            remaining_seconds = int((exp_dt - now).total_seconds())
        else:
            exp_str = None
            remaining_seconds = -1

        cursor.execute("""
        INSERT INTO licenses (app_id, license_key, max_hwid, duration_days, activated_at, expires_at, status, client_tag, notes, created_by)
        VALUES (?, ?, 1, ?, ?, ?, 'bound', ?, ?, ?)
        """, (app["id"], key_str, req.duration_days, now_str, exp_str, req.client_tag or "External Bot", req.notes or f"Khóa trực tiếp HWID qua API: {clean_hwid[:16]}...", seller["seller_name"]))
        
        lic_id = cursor.lastrowid

        cursor.execute("""
        INSERT INTO license_hwids (license_id, hwid_hash, device_name, ip_address, first_bound_at, last_seen_at)
        VALUES (?, ?, 'External Client PC', ?, ?, ?)
        """, (lic_id, clean_hwid, client_ip, now_str, now_str))

        signature = sign_payload(f"{key_str}:{clean_hwid}:{remaining_seconds}", app["secret_key"])

        log_event(cursor, "API_REVERSE_KEY_ISSUED", "success", f"External key {key_str} created & bound to HWID {clean_hwid[:16]}... by seller '{seller['seller_name']}'", client_ip, app["id"])
        conn.commit()
        conn.close()

        return {
            "status": "success",
            "type": "reverse_bound_key",
            "license_key": key_str,
            "hwid": clean_hwid,
            "app_code": app["app_code"],
            "app_name": app["name"],
            "duration_days": "Lifetime" if req.duration_days == -1 else req.duration_days,
            "activated_at": now_str,
            "expires_at": exp_str or "Lifetime",
            "signature": signature,
            "created_by": seller["seller_name"]
        }
    else:
        # Normal key (pending activation)
        cursor.execute("""
        INSERT INTO licenses (app_id, license_key, max_hwid, duration_days, status, client_tag, notes, created_by)
        VALUES (?, ?, 1, ?, 'active', ?, ?, ?)
        """, (app["id"], key_str, req.duration_days, req.client_tag or "External Bot", req.notes or "Cấp qua Seller API", seller["seller_name"]))
        
        log_event(cursor, "API_KEY_ISSUED", "info", f"External key {key_str} created by seller '{seller['seller_name']}'", client_ip, app["id"])
        conn.commit()
        conn.close()

        return {
            "status": "success",
            "type": "standard_key",
            "license_key": key_str,
            "app_code": app["app_code"],
            "app_name": app["name"],
            "duration_days": "Lifetime" if req.duration_days == -1 else req.duration_days,
            "status": "active",
            "created_by": seller["seller_name"]
        }

@router.post("/licenses/reset-hwid")
async def reset_license_hwid(req: ResetHWIDRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM licenses WHERE id = ?", (req.license_id,))
    lic = cursor.fetchone()
    if not lic:
        conn.close()
        raise HTTPException(status_code=404, detail="License not found.")

    cursor.execute("DELETE FROM license_hwids WHERE license_id = ?", (req.license_id,))
    
    # If the license was bound, we keep status as bound or active so they can bind a new machine
    if lic["status"] == "bound":
        cursor.execute("UPDATE licenses SET status = 'active' WHERE id = ?", (req.license_id,))

    log_event(cursor, "HWID_RESET", "warning", f"HWID binding cleared for license {lic['license_key']}", app_id=lic["app_id"])
    conn.commit()
    conn.close()
    return {"message": f"Hardware IDs reset for key {lic['license_key']}. Customer can now bind a new device."}

@router.post("/licenses/update-status")
async def update_license_status(req: UpdateLicenseStatusRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM licenses WHERE id = ?", (req.license_id,))
    lic = cursor.fetchone()
    if not lic:
        conn.close()
        raise HTTPException(status_code=404, detail="License not found.")

    cursor.execute("UPDATE licenses SET status = ? WHERE id = ?", (req.status, req.license_id))
    log_event(cursor, "LICENSE_STATUS_CHANGED", "warning" if req.status == "banned" else "info", f"License {lic['license_key']} status changed to '{req.status}'", app_id=lic["app_id"])
    conn.commit()
    conn.close()
    return {"message": f"License status updated to {req.status}"}

@router.post("/licenses/extend")
async def extend_license(req: ExtendLicenseRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM licenses WHERE id = ?", (req.license_id,))
    lic = cursor.fetchone()
    if not lic:
        conn.close()
        raise HTTPException(status_code=404, detail="License not found.")

    if lic["duration_days"] == -1 or not lic["expires_at"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot extend lifetime license.")

    current_exp = datetime.strptime(lic["expires_at"], "%Y-%m-%d %H:%M:%S")
    now = datetime.utcnow()
    # If already expired, start extending from now
    base_time = max(current_exp, now)
    new_exp = base_time + timedelta(days=req.additional_days)
    new_exp_str = new_exp.strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("UPDATE licenses SET expires_at = ?, status = 'bound' WHERE id = ?", (new_exp_str, req.license_id))
    log_event(cursor, "LICENSE_EXTENDED", "info", f"License {lic['license_key']} extended by {req.additional_days} days (New expiry: {new_exp_str})", app_id=lic["app_id"])
    conn.commit()
    conn.close()

    return {"message": f"License extended by {req.additional_days} days", "new_expires_at": new_exp_str}

@router.delete("/licenses/{license_id}")
async def delete_license(license_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM licenses WHERE id = ?", (license_id,))
    conn.commit()
    conn.close()
    return {"message": "License deleted successfully"}

# ==================== END-USERS ====================
@router.get("/users")
async def list_users(app_id: int = None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
    SELECT u.id, u.app_id, u.username, u.license_key, u.status, u.last_login_at, u.last_login_ip, u.hwid_hash, u.created_at,
           a.name as app_name, a.app_code
    FROM users u
    JOIN apps a ON u.app_id = a.id
    """
    params = []
    if app_id:
        query += " WHERE u.app_id = ?"
        params.append(app_id)
    query += " ORDER BY u.id DESC"
    cursor.execute(query, params)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return users

@router.post("/users")
async def create_user(req: CreateUserRequest):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE username = ?", (req.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Username '{req.username}' is already taken.")

    pass_hash = hash_password(req.password)
    cursor.execute("""
    INSERT INTO users (app_id, username, password_hash, license_key, status)
    VALUES (?, ?, ?, ?, 'active')
    """, (req.app_id, req.username, pass_hash, req.license_key or ""))

    user_id = cursor.lastrowid
    log_event(cursor, "USER_CREATED", "info", f"End-user account '{req.username}' created", app_id=req.app_id)
    conn.commit()
    conn.close()
    return {"message": "User created successfully", "user_id": user_id, "username": req.username}

@router.post("/users/update-status")
async def update_user_status(req: UpdateUserStatusRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (req.user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (req.status, req.user_id))
    log_event(cursor, "USER_STATUS_CHANGE", "danger" if req.status == "suspended" else "info", f"User '{user['username']}' status changed to '{req.status}'", app_id=user["app_id"])
    conn.commit()
    conn.close()
    return {"message": f"User status changed to {req.status}"}

@router.post("/users/reset-hwid")
async def reset_user_hwid(request: Request, user_id: Optional[int] = Query(None)):
    uid = user_id
    if uid is None:
        try:
            body = await request.json()
            uid = body.get("user_id")
        except Exception:
            pass
    if uid is None:
        raise HTTPException(status_code=400, detail="Thiếu tham số user_id")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET hwid_hash = '' WHERE id = ?", (uid,))
    conn.commit()
    conn.close()
    return {"message": "User HWID reset successfully", "user_id": uid}

@router.post("/users/reset-password")
async def reset_user_password(req: ResetUserPasswordRequest):
    conn = get_db()
    cursor = conn.cursor()
    pass_hash = hash_password(req.new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pass_hash, req.user_id))
    conn.commit()
    conn.close()
    return {"message": "User password reset successfully"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"message": "User deleted"}

# ==================== SELLER API KEYS ====================
@router.get("/keys")
async def list_seller_keys():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, seller_name, api_key, secret_token, role, ip_whitelist, rate_limit_per_min, is_active, created_at FROM seller_api_keys ORDER BY id DESC")
    keys = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return keys

@router.post("/keys")
async def create_seller_key(req: CreateApiKeyRequest):
    conn = get_db()
    cursor = conn.cursor()
    api_key, secret_token = generate_api_tokens()

    cursor.execute("""
    INSERT INTO seller_api_keys (seller_name, api_key, secret_token, role, ip_whitelist, rate_limit_per_min, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    """, (req.seller_name, api_key, secret_token, req.role, req.ip_whitelist, req.rate_limit_per_min))

    key_id = cursor.lastrowid
    log_event(cursor, "SELLER_APIKEY_CREATED", "info", f"New API Key issued for seller '{req.seller_name}' with role '{req.role}'")
    conn.commit()
    conn.close()

    return {
        "message": "Seller API Key generated",
        "id": key_id,
        "api_key": api_key,
        "secret_token": secret_token
    }

@router.post("/keys/toggle")
async def toggle_seller_key(request: Request, key_id: Optional[int] = Query(None)):
    kid = key_id
    if kid is None:
        try:
            body = await request.json()
            kid = body.get("key_id")
        except Exception:
            pass
    if kid is None:
        raise HTTPException(status_code=400, detail="Thiếu tham số key_id")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_active FROM seller_api_keys WHERE id = ?", (kid,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Key not found.")

    new_state = 0 if row["is_active"] == 1 else 1
    cursor.execute("UPDATE seller_api_keys SET is_active = ? WHERE id = ?", (new_state, kid))
    conn.commit()
    conn.close()
    return {"message": f"Key state toggled to {'Active' if new_state == 1 else 'Revoked'}", "is_active": new_state}

@router.delete("/keys/{key_id}")
async def delete_seller_key(key_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM seller_api_keys WHERE id = ?", (key_id,))
    conn.commit()
    conn.close()
    return {"message": "API Key deleted"}

# ==================== SECURITY AUDIT LOGS ====================
@router.get("/logs")
async def get_logs(limit: int = 50, severity: str = None):
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT l.*, a.name as app_name FROM security_logs l LEFT JOIN apps a ON l.app_id = a.id"
    params = []
    if severity and severity != "all":
        query += " WHERE l.severity = ?"
        params.append(severity)
    query += " ORDER BY l.id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return logs

@router.post("/logs/clear")
async def clear_logs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM security_logs")
    log_event(cursor, "LOGS_CLEARED", "warning", "Audit logs cleared by Administrator")
    conn.commit()
    conn.close()
    return {"message": "Audit logs cleared"}

# ==================== INTERACTIVE API SANDBOX ====================
@router.post("/sandbox/execute")
async def sandbox_execute(req: SandboxExecuteRequest, request: Request):
    """Executes a simulated or internal API call directly to test latency, headers and response"""
    start_time = time.time()
    
    endpoint = req.endpoint.strip()
    method = req.method.upper()
    body = req.body or {}

    local_port = int(os.environ.get("PORT", 8000))
    # Dynamically resolve host or use 127.0.0.1 with local port
    url = f"http://127.0.0.1:{local_port}{endpoint}" if endpoint.startswith("/") else f"http://127.0.0.1:{local_port}/{endpoint}"
    headers = req.headers or {"Content-Type": "application/json"}

    try:
        if method == "POST":
            resp = requests.post(url, json=body, headers=headers, timeout=6)
        elif method == "GET":
            resp = requests.get(url, params=body, headers=headers, timeout=6)
        else:
            resp = requests.request(method, url, json=body, headers=headers, timeout=6)

        latency_ms = round((time.time() - start_time) * 1000, 2)
        try:
            resp_json = resp.json()
        except:
            resp_json = {"raw": resp.text}

        return {
            "status_code": resp.status_code,
            "latency_ms": latency_ms,
            "headers": dict(resp.headers),
            "body": resp_json
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status_code": 500,
            "latency_ms": latency_ms,
            "headers": {"content-type": "application/json"},
            "body": {"error": str(e), "message": f"Sandbox request to {url} failed. Check server port or endpoint format."}
        }

