import secrets
import string
import hmac
import hashlib
import time
from typing import Dict, Tuple

# Simple in-memory rate limiter: ip -> list of timestamps
_rate_limits: Dict[str, list] = {}

def get_real_client_ip(request) -> str:
    """Extracts genuine client IP behind Render load balancers, Cloudflare, or reverse proxies"""
    try:
        # 1. Cloudflare header
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip.strip()

        # 2. X-Forwarded-For (Render / standard proxy)
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            # First IP in the comma-separated chain is the client
            return x_forwarded_for.split(",")[0].strip()

        # 3. X-Real-IP
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip.strip()

        # 4. FastAPI client host
        if hasattr(request, "client") and request.client and request.client.host:
            return request.client.host
    except Exception:
        pass
    return "127.0.0.1"

def generate_key(prefix: str = "CYBER", mask: str = "XXXX-XXXX-XXXX") -> str:
    """Generate secure license key formatted by mask"""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" # Exclude confusing characters like 0/O, 1/I
    parts = []
    
    # If mask has '-' separator
    sections = mask.split('-')
    for sec in sections:
        part = "".join(secrets.choice(chars) for _ in range(len(sec)))
        parts.append(part)
        
    formatted = "-".join(parts)
    if prefix:
        clean_prefix = prefix.strip().upper().replace(" ", "")
        return f"{clean_prefix}-{formatted}"
    return formatted

def generate_api_tokens() -> Tuple[str, str]:
    """Generates a public API Key and a Secret Token"""
    public_key = "ca_live_" + secrets.token_hex(12)
    secret_token = "sk_sec_" + secrets.token_urlsafe(24)
    return public_key, secret_token

def sign_payload(payload_str: str, secret_key: str) -> str:
    """Calculates HMAC-SHA256 signature of a payload string using secret key"""
    return hmac.new(secret_key.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()

def verify_signature(payload_str: str, signature: str, secret_key: str) -> bool:
    expected = sign_payload(payload_str, secret_key)
    return hmac.compare_digest(expected, signature)

def check_rate_limit(ip: str, max_requests: int = 60, window_seconds: int = 60) -> bool:
    """Returns True if request is allowed, False if rate limited"""
    now = time.time()
    timestamps = _rate_limits.get(ip, [])
    # Filter out timestamps older than window
    timestamps = [ts for ts in timestamps if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        _rate_limits[ip] = timestamps
        return False
    timestamps.append(now)
    _rate_limits[ip] = timestamps
    return True

def log_event(cursor, event_type: str, severity: str, details: str, source_ip: str = "127.0.0.1", app_id: int = None):
    """Utility to record security audit logs into SQLite"""
    try:
        cursor.execute("""
        INSERT INTO security_logs (event_type, severity, source_ip, app_id, details)
        VALUES (?, ?, ?, ?, ?)
        """, (event_type, severity, source_ip, app_id, details))
    except Exception as e:
        print(f"Error logging security event: {e}")

