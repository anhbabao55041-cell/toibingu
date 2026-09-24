import sqlite3
import os
import secrets
import hashlib
from datetime import datetime, timedelta

DB_PATH = os.getenv(
    "DB_PATH", 
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cyberauth.db")
)

def get_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def hash_password(password: str) -> str:
    salt = "cyberauth_salt_v1_"
    return hashlib.sha256((salt + password).encode()).hexdigest()

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        app_code TEXT UNIQUE NOT NULL,
        secret_key TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        status TEXT NOT NULL DEFAULT 'active', -- active, maintenance
        download_url TEXT DEFAULT '',
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        license_key TEXT UNIQUE NOT NULL,
        max_hwid INTEGER NOT NULL DEFAULT 1, -- 1, 5, 10, -1 (unlimited)
        duration_days INTEGER NOT NULL DEFAULT 30, -- 1, 2, 5, 14, 30, 90, -1 (lifetime)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        status TEXT NOT NULL DEFAULT 'active', -- active, bound, expired, banned
        client_tag TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_by TEXT DEFAULT 'Seller_Admin'
    );

    CREATE TABLE IF NOT EXISTS license_hwids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_id INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
        hwid_hash TEXT NOT NULL,
        device_name TEXT DEFAULT 'Windows PC',
        ip_address TEXT DEFAULT '127.0.0.1',
        first_bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(license_id, hwid_hash)
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        license_key TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active', -- active, suspended
        last_login_at TIMESTAMP NULL,
        last_login_ip TEXT DEFAULT '',
        hwid_hash TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seller_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        secret_token TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin', -- admin, issuer, read_only
        ip_whitelist TEXT DEFAULT '*',
        rate_limit_per_min INTEGER DEFAULT 120,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS security_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info', -- info, warning, danger, success
        source_ip TEXT DEFAULT '127.0.0.1',
        app_id INTEGER NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Check if data exists; if not, seed realistic data
    cursor.execute("SELECT COUNT(*) as count FROM apps")
    if cursor.fetchone()["count"] == 0:
        seed_data(cursor)

    conn.commit()
    conn.close()

def seed_data(cursor):
    now = datetime.utcnow()
    
    # 1. Seed Apps
    apps_data = [
        (
            "Aegis Sentinel Security Engine",
            "AEGIS-SEC",
            "sec_live_7c4f9a1e0b5d2c8841a39",
            "2.4.1",
            "active",
            "https://cdn.cyberauth.io/releases/aegis-sentinel-v2.4.1.zip",
            "Core cybersecurity overlay and anti-cheat bypass protection module."
        ),
        (
            "Phantom Auto-Pilot & Clicker Pro",
            "PHANTOM-BOT",
            "sec_live_3b81d90f6e4a2c7102b48",
            "3.0.0",
            "active",
            "https://cdn.cyberauth.io/releases/phantom-bot-v3.0.0.exe",
            "High frequency input simulation and task automation toolkit."
        ),
        (
            "Spectre HWID Spoofer & Guard",
            "SPECTRE-GUARD",
            "sec_live_1d5e6a7c8b9f0e2413a90",
            "1.8.5",
            "maintenance",
            "https://cdn.cyberauth.io/releases/spectre-guard-v1.8.5.zip",
            "Kernel-level hardware signature cleaner and sandbox guard."
        )
    ]
    cursor.executemany("""
    INSERT INTO apps (name, app_code, secret_key, version, status, download_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, apps_data)

    # 2. Seed Seller API Keys
    seller_keys = [
        (
            "Main Discord Shop Bot",
            "ca_live_948a201dfbc83e74",
            "sk_sec_a7f10b42c98d3e21",
            "admin",
            "*",
            300,
            1
        ),
        (
            "Auto-Pay Webhook Integration",
            "ca_live_1b6c739ae024f8d5",
            "sk_sec_f98c21ea70b431ad",
            "issuer",
            "192.168.1.100,10.0.0.5",
            120,
            1
        )
    ]
    cursor.executemany("""
    INSERT INTO seller_api_keys (seller_name, api_key, secret_token, role, ip_whitelist, rate_limit_per_min, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, seller_keys)

    # 3. Seed Licenses
    licenses_data = [
        # app_id 1 (AEGIS-SEC)
        (1, "AEGIS-7F89-A2C4-90B1", 1, 30, now.strftime("%Y-%m-%d %H:%M:%S"), (now + timedelta(days=28)).strftime("%Y-%m-%d %H:%M:%S"), "bound", "VIP Customer #8812", "Paid via Crypto"),
        (1, "AEGIS-3B41-C9D0-88E2", 5, -1, now.strftime("%Y-%m-%d %H:%M:%S"), None, "bound", "Dev Team Alpha", "Lifetime 5 slots license"),
        (1, "AEGIS-91FA-2D88-B4C1", 1, 14, now.strftime("%Y-%m-%d %H:%M:%S"), (now + timedelta(days=12)).strftime("%Y-%m-%d %H:%M:%S"), "bound", "Reseller John", "14-day trial package"),
        (1, "AEGIS-110A-7C99-F42D", 1, 1, None, None, "active", "Promo Giveaway", "Unused 1-day key"),
        (1, "AEGIS-DEAD-BEEF-0001", 1, 30, (now - timedelta(days=40)).strftime("%Y-%m-%d %H:%M:%S"), (now - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S"), "expired", "Old Buyer", "Expired license key"),
        (1, "AEGIS-HACK-AB01-9988", 1, 30, now.strftime("%Y-%m-%d %H:%M:%S"), (now + timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S"), "banned", "Blacklisted Cheater", "Detected memory alteration"),
        
        # app_id 2 (PHANTOM-BOT)
        (2, "PHAN-55C1-8899-A0B2", 1, 90, now.strftime("%Y-%m-%d %H:%M:%S"), (now + timedelta(days=85)).strftime("%Y-%m-%d %H:%M:%S"), "bound", "Pro Trader 01", "Quarterly subscription"),
        (2, "PHAN-L1FE-T1ME-7788", 10, -1, now.strftime("%Y-%m-%d %H:%M:%S"), None, "bound", "Studio StudioX", "10-seat lifetime bundle"),
        (2, "PHAN-2DAY-TR1A-4455", 1, 2, None, None, "active", "Weekend Tester", "Ready to activate"),
        
        # app_id 3 (SPECTRE-GUARD)
        (3, "SPEC-99A1-B0C4-D2E3", 1, 5, None, None, "active", "Early Adopter", "5-day test key")
    ]

    for lic in licenses_data:
        cursor.execute("""
        INSERT INTO licenses (app_id, license_key, max_hwid, duration_days, activated_at, expires_at, status, client_tag, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, lic)

    # 4. Seed HWIDs for bound keys
    hwid_data = [
        (1, "HWID-WIN11-BFEBFBFF00090672-SN750-NVME", "DESKTOP-THAI-RIG", "113.161.42.19"),
        (2, "HWID-WIN10-BFEBFBFF000806E9-SAMSUNG-970", "WORKSTATION-01", "14.232.18.5"),
        (2, "HWID-WIN11-BFEBFBFF000906EA-KINGSTON-A2", "LAPTOP-DEV-ALPHA", "14.232.18.6"),
        (3, "HWID-WIN11-BFEBFBFF000A0652-WD-BLACK-1T", "GAMING-PC-99", "171.244.12.80"),
        (7, "HWID-WIN10-BFEBFBFF000506E3-INTEL-SSD-5", "TRADER-BOT-NODE", "118.69.182.3")
    ]
    cursor.executemany("""
    INSERT INTO license_hwids (license_id, hwid_hash, device_name, ip_address)
    VALUES (?, ?, ?, ?)
    """, hwid_data)

    # 5. Seed Users
    users_data = [
        (1, "alex_cyber", hash_password("pass1234"), "AEGIS-7F89-A2C4-90B1", "active", (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "113.161.42.19", "HWID-WIN11-BFEBFBFF00090672-SN750-NVME"),
        (1, "shadow_hunter", hash_password("hunter99"), "AEGIS-3B41-C9D0-88E2", "active", (now - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"), "14.232.18.5", "HWID-WIN10-BFEBFBFF000806E9-SAMSUNG-970"),
        (1, "blacklisted_user", hash_password("hackme"), "AEGIS-HACK-AB01-9988", "suspended", (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"), "45.33.32.156", "HWID-SUSPECT-00921"),
        (2, "trader_prime", hash_password("prime2026"), "PHAN-55C1-8899-A0B2", "active", (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"), "118.69.182.3", "HWID-WIN10-BFEBFBFF000506E3-INTEL-SSD-5")
    ]
    cursor.executemany("""
    INSERT INTO users (app_id, username, password_hash, license_key, status, last_login_at, last_login_ip, hwid_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, users_data)

    # 6. Seed Security Audit Logs
    logs_data = [
        ("LICENSE_VERIFY_SUCCESS", "success", "113.161.42.19", 1, "Key AEGIS-7F89-A2C4-90B1 validated successfully on DESKTOP-THAI-RIG (HWID Match)"),
        ("HWID_MISMATCH_BLOCKED", "danger", "185.220.101.5", 1, "Unauthorized activation attempt on key AEGIS-7F89-A2C4-90B1 with unregistered HWID-ROGUE-01"),
        ("API_AUTH_SUCCESS", "info", "127.0.0.1", 1, "Seller API Key authenticated via Token [ca_live_948a...] - Endpoint /seller/licenses"),
        ("USER_LOGIN_SUCCESS", "success", "14.232.18.5", 1, "User 'shadow_hunter' logged in via tool client (Aegis Sentinel v2.4.1)"),
        ("LICENSE_AUTO_EXPIRED", "warning", "127.0.0.1", 1, "Key AEGIS-DEAD-BEEF-0001 reached validity expiration date - Status updated to Expired"),
        ("REMOTE_ACCOUNT_LOCKED", "danger", "127.0.0.1", 1, "User 'blacklisted_user' remotely suspended by Administrator"),
        ("KEY_BATCH_GENERATED", "info", "127.0.0.1", 2, "Batch of 5 keys generated for Phantom Auto-Pilot with 90-day duration"),
        ("HEARTBEAT_ACKNOWLEDGED", "success", "118.69.182.3", 2, "Heartbeat session verified for HWID-WIN10-BFEBFBFF... (Latency: 9ms)")
    ]
    cursor.executemany("""
    INSERT INTO security_logs (event_type, severity, source_ip, app_id, details)
    VALUES (?, ?, ?, ?, ?)
    """, logs_data)
