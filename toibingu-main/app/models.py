from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# ==================== LICENSE MODELS ====================
class GenerateLicenseRequest(BaseModel):
    app_id: int
    hwid_limit: int = Field(default=1, description="1, 5, 10, or -1 for Unlimited")
    duration_days: int = Field(default=30, description="1, 2, 5, 14, 30, 90, or -1 for Lifetime")
    prefix: str = Field(default="CYBER", max_length=15)
    mask: str = Field(default="XXXX-XXXX-XXXX")
    quantity: int = Field(default=1, ge=1, le=100)
    client_tag: Optional[str] = ""
    notes: Optional[str] = ""

class ResetHWIDRequest(BaseModel):
    license_id: int

class UpdateLicenseStatusRequest(BaseModel):
    license_id: int
    status: str # 'active', 'banned', 'expired'

class ExtendLicenseRequest(BaseModel):
    license_id: int
    additional_days: int = Field(ge=1, le=3650)

# ==================== REVERSE KEY & EXTERNAL API MODELS ====================
class GenerateReverseKeyRequest(BaseModel):
    app_id: Optional[int] = None
    app_code: Optional[str] = None
    hwid: str = Field(min_length=4, description="Mã Hardware ID máy của khách để khóa ngược chiều ngay lập tức")
    device_name: Optional[str] = "Khách Hàng Máy Tính"
    duration_days: int = Field(default=30, description="1, 2, 5, 14, 30, 90, or -1 for Lifetime")
    prefix: Optional[str] = "REV"
    mask: Optional[str] = "XXXX-XXXX-XXXX"
    client_tag: Optional[str] = ""
    notes: Optional[str] = ""

class ReverseLookupRequest(BaseModel):
    hwid: str
    app_code: Optional[str] = None

class ExternalGenerateKeyRequest(BaseModel):
    app_code: str
    hwid: Optional[str] = None
    duration_days: int = 30
    prefix: Optional[str] = "CYBER"
    mask: Optional[str] = "XXXX-XXXX-XXXX"
    client_tag: Optional[str] = "External Shop/Bot"
    notes: Optional[str] = ""


# ==================== USER MODELS ====================
class CreateUserRequest(BaseModel):
    app_id: int
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=4, max_length=100)
    license_key: Optional[str] = ""

class UpdateUserStatusRequest(BaseModel):
    user_id: int
    status: str # 'active', 'suspended'

class ResetUserPasswordRequest(BaseModel):
    user_id: int
    new_password: str = Field(min_length=4)

# ==================== APP MODELS ====================
class CreateAppRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    app_code: str = Field(min_length=2, max_length=30)
    version: str = "1.0.0"
    description: Optional[str] = ""
    download_url: Optional[str] = ""

class UpdateAppRequest(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None # 'active', 'maintenance'
    download_url: Optional[str] = None
    description: Optional[str] = None

# ==================== SELLER API KEY MODELS ====================
class CreateApiKeyRequest(BaseModel):
    seller_name: str
    role: str = "admin" # 'admin', 'issuer', 'read_only'
    ip_whitelist: str = "*"
    rate_limit_per_min: int = 120

# ==================== CLIENT (TOOL) REQUEST MODELS ====================
class ClientVerifyRequest(BaseModel):
    app_code: str
    license_key: str
    hwid: str
    device_name: Optional[str] = "Windows Client PC"

class ClientActivateRequest(BaseModel):
    app_code: str
    license_key: str
    hwid: str
    device_name: Optional[str] = "Windows Client PC"

class ClientLoginRequest(BaseModel):
    app_code: str
    username: str
    password: str
    hwid: Optional[str] = ""

class ClientHeartbeatRequest(BaseModel):
    app_code: str
    license_key: str
    hwid: str
    session_token: Optional[str] = None

# ==================== SANDBOX REQUEST ====================
class SandboxExecuteRequest(BaseModel):
    endpoint: str
    method: str = "POST"
    headers: Optional[Dict[str, str]] = None
    body: Optional[Dict[str, Any]] = None
