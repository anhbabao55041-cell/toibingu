# CYBERAUTH - Identity & License Control System v3.8
> **Hệ thống Quản lý Bản quyền Phần mềm & Xác thực Người dùng Cao cấp (Lấy cảm hứng từ quocthaiAuth SECURITY - Identity Control System)**

---

## 1. Giới thiệu tổng quan
**CYBERAUTH** là nền tảng quản trị và cấp phát bản quyền phần mềm (License Key) kết hợp xác thực người dùng (Identity Authentication) chuyên nghiệp dành cho các **Seller / Developer** kinh doanh Tool, Bot, hoặc Ứng dụng Desktop.

Hệ thống được thiết kế theo phong cách **Cybersecurity HUD Dark Mode** tối tân, bảo mật đa tầng, khóa phần cứng máy tính tính toán qua WMI/UUID (**HWID Lock**), chống crack, chống brute-force và sẵn sàng kết nối API RESTful tốc độ cao (< 15ms).

---

## 2. Các Phân Hệ Chức Năng Chính

### A. Quản lý Ứng dụng & Bộ sinh Key Chuyên sâu (Applications & Generator)
- **Quản lý danh mục tool/phần mềm**: Mỗi tool có mã App Code riêng, Secret Token mã hóa HMAC-SHA256, phiên bản và trạng thái (Active / Maintenance).
- **Bộ sinh License Key thông minh**:
  - **Giới hạn thiết bị (HWID Lock)**: 1 thiết bị (Strict Lock), 5 thiết bị (Team), 10 thiết bị (Studio), hoặc Vĩnh viễn (Unlimited).
  - **Thời hạn bản quyền (Duration)**: 1 ngày, 2 ngày, 5 ngày, 14 ngày, 30 ngày, 90 ngày, hoặc Vĩnh viễn (Lifetime).
  - **Tùy biến định dạng**: Hỗ trợ Custom Prefix (`CYBER`, `AEGIS`,...) và Mask (`XXXX-XXXX-XXXX`).
  - **Sinh hàng loạt (Batch)**: Tạo từ 1 đến 50 keys chỉ với 1 cú click.
  - **Quản lý & Thao tác nhanh**:
    - Reset HWID từ xa (giải phóng thiết bị khi khách đổi máy tính).
    - Gia hạn ngày sử dụng (+30 ngày).
    - Khóa (Ban) / Mở khóa (Unban) tức thì.
    - Xuất dữ liệu sang định dạng **CSV** và **JSON**.

### B. Quản lý Người dùng Cuối (End-User Identity Management)
- Cấp tài khoản (Tên đăng nhập / Mật khẩu) đăng nhập trực tiếp trên phần mềm trước khi xác thực key.
- Khóa / Mở khóa tài khoản người dùng từ xa khi phát hiện gian lận.
- Reset HWID tài khoản người dùng và xem IP / thời gian đăng nhập lần cuối.

### C. Bộ SDK & Trình kiểm thử API Trực tiếp (SDK & Interactive Sandbox)
- **Thư viện tích hợp đa ngôn ngữ**:
  - **C# (.NET 6/7/8 & Framework)**: Mã nguồn hoàn chỉnh với truy xuất phần cứng bằng `System.Management (WMI)`.
  - **C++ (Win32 API + Libcurl)**: Kiểm tra CPUID + Volume Serial Number an toàn.
  - **Python 3**: Class hướng đối tượng với luồng gửi **Heartbeat** ngầm tự động.
  - **JavaScript / Node.js**: Hỗ trợ tích hợp cho ứng dụng Electron và CLI tool.
  - **VB.NET**: Cho các ứng dụng Windows Forms truyền thống.
  - **Go (Golang)**: Cho backend tool và microservices tốc độ cao.
- **Interactive API Sandbox**: Cho phép Seller thử nghiệm gọi API kiểm tra Key, kích hoạt HWID, đăng nhập tài khoản ngay trên Dashboard với đo độ trễ mạng theo thời gian thực (latency ms).

### D. Quản lý API Key riêng (Seller Master API Access)
- Cấp phát Secret Token riêng biệt cho từng Seller/Admin để kết nối hệ thống ngoài (Web shop tự động, Discord bot, Telegram bot).
- Phân quyền chi tiết: `Full Administrator`, `License Issuer`, `Read-Only`.
- Giới hạn IP Whitelist và thiết lập Rate Limit theo phút.

---

## 3. Hướng dẫn Khởi chạy Hệ thống

### Yêu cầu môi trường:
- Python 3.10+ (Đã hỗ trợ sẵn trên máy).
- Thư viện: `fastapi`, `uvicorn`, `pydantic`, `httpx`, `requests`.

### Lệnh khởi động Server:
Mở terminal tại thư mục dự án và chạy:
```powershell
py run_server.py
```
Hoặc:
```powershell
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Truy cập hệ thống trên trình duyệt:
👉 **http://127.0.0.1:8000**

---

## 4. Danh mục API Endpoints Dành Cho Tool Client

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/client/auth/login` | Đăng nhập tài khoản end-user trên tool |
| `POST` | `/api/v1/client/license/verify` | Kiểm tra tính hợp lệ của Key & Khóa HWID |
| `POST` | `/api/v1/client/license/activate` | Kích hoạt Key và liên kết phần cứng lần đầu |
| `POST` | `/api/v1/client/license/heartbeat` | Gửi tín hiệu duy trì phiên chạy ngầm |
| `GET` | `/api/v1/client/app/version` | Kiểm tra phiên bản mới nhất của Tool |

---

## 5. Dữ liệu Mẫu Khởi tạo Sẵn (Sample Data)

Hệ thống đã tự động kích hoạt cơ sở dữ liệu `cyberauth.db` với dữ liệu phong phú:
- **Ứng dụng**: `AEGIS-SEC` (Aegis Sentinel), `PHANTOM-BOT` (Phantom Auto-Pilot), `SPECTRE-GUARD`.
- **License Keys**: Các key mẫu đa dạng trạng thái (`Active`, `Bound`, `Expired`, `Banned`).
- **Tài khoản người dùng**: `alex_cyber` (pass: `pass1234`), `shadow_hunter` (pass: `hunter99`), `blacklisted_user`.
- **Seller API Key**: `ca_live_948a201dfbc83e74` (Admin).
