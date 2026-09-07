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
    allow_origins=["*"],
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
        "modules": ["LicenseGenerator", "UserManagement", "HWIDLock", "SellerAPI", "SDKCore"]
    }
