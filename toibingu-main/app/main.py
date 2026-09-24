import os
import time
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import client_api, seller_api

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(
    title="CYBERAUTH - Identity & License Control System",
    description="High-security software licensing and user authentication API engine.",
    version="3.8.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Security Headers & Latency Middleware
@app.middleware("http")
async def add_security_headers_and_timing(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Security-Engine"] = "CYBERAUTH-v3.8-ENTERPRISE"
    response.headers["X-Encryption-Standard"] = "AES-256-GCM"
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include Routers
app.include_router(client_api.router)
app.include_router(seller_api.router)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
async def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "engine": "CYBERAUTH v3.8",
        "timestamp": time.time(),
        "modules": ["LicenseGenerator", "ReverseKeyBinding", "UserManagement", "HWIDLock", "SellerAPI", "SDKCore"]
    }

@app.get("/api/v1/system/domain-info")
async def domain_info(request: Request):
    """Provides current domain, SSL scheme, Render status and client IP detection"""
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:8000"
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    origin = f"{proto}://{host}"
    
    from app.security import get_real_client_ip
    client_ip = get_real_client_ip(request)
    
    return {
        "status": "online",
        "origin": origin,
        "host": host,
        "protocol": proto,
        "is_ssl": proto == "https",
        "detected_client_ip": client_ip,
        "port": os.environ.get("PORT", "8000"),
        "is_render": "RENDER" in os.environ or "PORT" in os.environ,
        "version": "3.8.0",
        "features": {
            "reverse_key_binding": True,
            "hwid_strict_lock": True,
            "external_api_seller": True,
            "hmac_sha256": True
        }
    }

