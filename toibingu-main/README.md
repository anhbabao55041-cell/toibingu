# quocthaiAuth / CYBERAUTH - Identity & License Control System v3.8
> **Hệ thống Xác Thực Bản Quyền Phần Mềm, Tạo Key Ngược Chiều (Reverse HWID Binding) & Sẵn Sàng Triển Khai Lên Render.com với Tên Miền Riêng**

---

## 1. Giới thiệu tổng quan
**CYBERAUTH / quocthaiAuth SECURITY** là nền tảng quản trị và cấp phát bản quyền phần mềm (License Key) kết hợp xác thực danh tính người dùng (End-User Identity Authentication) chuyên nghiệp dành cho các **Developer & Seller** kinh doanh Tool, Bot, hoặc Ứng dụng Desktop (C#, C++, Python, Node.js/Electron, Go, VB.NET).

Hệ thống được thiết kế theo phong cách **Cybersecurity HUD Dark Mode** tối tân, bảo mật đa tầng, khóa phần cứng máy tính (**HWID Strict Lock**), chống crack, chống brute-force và sẵn sàng kết nối API RESTful tốc độ cao (< 15ms).

---

## 2. Điểm Nổi Bật: Tạo Key Ngược Chiều (Reverse HWID Binding)

### Khái niệm "Tạo Key Ngược Chiều" là gì?
- **Quy trình Thuận Chiều (Standard)**: Seller tạo key trước &rarr; Giao key cho khách &rarr; Khách mở tool nhập key &rarr; Tool gửi HWID lên để khóa máy lần đầu.
- **Quy trình Ngược Chiều (Reverse Binding)**: Khách hàng chỉ cần gửi mã phần cứng máy tính (**HWID**) &rarr; Seller hoặc Bot tự động sinh License Key và **lập tức khóa cứng (bound) trực tiếp vào HWID đó ngay tại thời điểm tạo**.
  - **Lợi ích**: Key được kích hoạt sẵn, bắt đầu đếm ngược thời hạn ngay, khách mở tool lên là chạy ngay không cần qua bước kích hoạt, chống tuyệt đối việc key bị người khác kích hoạt trộm!
- **Tra cứu ngược từ HWID (Reverse Lookup)**: Dễ dàng tra cứu xem máy tính có HWID bất kỳ đang sở hữu mã key nào, hạn sử dụng đến ngày nào và IP kết nối.

---

## 3. Hướng Dẫn Deploy Lên Render.com & Gắn Tên Miền Riêng (Custom Domain)

Dự án đã được tích hợp đầy đủ file cấu hình chuẩn của **Render.com**:
- `render.yaml` (Blueprint tự động nhận diện)
- `Procfile` (`web: uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`)
- `runtime.txt` (`python-3.11.8`)
- `requirements.txt` (FastAPI, Uvicorn, Gunicorn, Pydantic, Httpx, Requests)

### Bước 1: Đẩy mã nguồn lên GitHub
Tải toàn bộ thư mục dự án lên một kho lưu trữ (Repository) trên GitHub của bạn.

### Bước 2: Tạo Web Service trên Render
1. Đăng nhập [dashboard.render.com](https://dashboard.render.com).
2. Nhấn nút **New +** &rarr; Chọn **Web Service** (hoặc **Blueprint**).
3. Kết nối với kho GitHub chứa mã nguồn dự án.
4. Render sẽ tự động điền hoặc bạn kiểm tra cấu hình:
   - **Environment**: `Python 3`
   - **Region**: `Singapore` (hoặc khu vực gần bạn nhất)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`
5. Bấm **Deploy Web Service**. Sau 1-2 phút, dịch vụ sẽ trực tuyến tại địa chỉ: `https://<ten-app>.onrender.com`.

### Bước 3: Cấu hình Tên Miền Riêng (Custom Domain)
1. Trong Dashboard của Render, vào Web Service của bạn &rarr; Chọn **Settings** &rarr; Kéo xuống phần **Custom Domains**.
2. Bấm **Add Custom Domain** &rarr; Nhập tên miền bạn muốn gắn (Ví dụ: `auth.yourdomain.com` hoặc `yourdomain.com`).
3. Truy cập vào trang quản trị DNS của nhà cung cấp tên miền (Cloudflare, Namecheap, GoDaddy, Mắt Bão, iNet...):
   - **Nếu dùng Subdomain** (VD: `auth.yourdomain.com`):
     - **Loại (Type)**: `CNAME`
     - **Tên (Name / Host)**: `auth`
     - **Giá trị (Target / Content)**: `<ten-app>.onrender.com`
     - **Proxy status**: DNS Only (hoặc Proxied nếu dùng Cloudflare)
   - **Nếu dùng Tên Miền Gốc** (VD: `yourdomain.com`):
     - **Loại (Type)**: `A Record`
     - **Tên (Name / Host)**: `@`
     - **Giá trị (Target / Content)**: `216.24.57.1` (IP Anycast của Render)
4. Bấm Lưu bản ghi DNS. Render sẽ tự động xác minh và cấp phát chứng chỉ **SSL HTTPS Miễn Phí** trong vòng 2 - 5 phút.

### Bước 4: Biến môi trường trên Render (Tùy chọn)
Trong mục **Environment** trên Render, bạn có thể thiết lập:
- `SELLER_ACCESS_KEY`: Mật khẩu khóa đăng nhập quản trị (Mặc định: `thai`).
- `DB_PATH`: Nếu dùng Render Persistent Disk (ổ đĩa lưu trữ vĩnh viễn), đặt: `/var/data/cyberauth.db`.

---

## 4. API Dành Cho Web Shop Tự Động & Discord/Telegram Bot

Hệ thống cung cấp Endpoint liên kết API ngoài được bảo vệ bằng Master API Key:

### Endpoint: `POST /api/v1/seller/licenses/external/generate`
**Headers:**
```http
Content-Type: application/json
X-Api-Key: ca_live_948a201dfbc83e74
```

**Body tạo Key Ngược Chiều (Khóa HWID ngay):**
```json
{
  "app_code": "AEGIS-SEC",
  "hwid": "HWID-WIN11-BFEBFBFF00090672-SN750-NVME",
  "duration_days": 30,
  "prefix": "REV",
  "client_tag": "Discord Buyer #8821"
}
```

**Phản hồi thành công (JSON):**
```json
{
  "status": "success",
  "type": "reverse_bound_key",
  "license_key": "REV-7F89-A2C4-90B1",
  "hwid": "HWID-WIN11-BFEBFBFF00090672-SN750-NVME",
  "app_code": "AEGIS-SEC",
  "app_name": "Aegis Sentinel Security Engine",
  "duration_days": 30,
  "activated_at": "2026-09-24 13:30:00",
  "expires_at": "2026-10-24 13:30:00",
  "signature": "a8f3b...",
  "created_by": "Main Discord Shop Bot"
}
```

---

## 5. Danh mục API Endpoints Đầy Đủ

### Phân Hệ Client Tool (Dành Cho Phần Mềm Của Khách)
| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/client/auth/login` | Đăng nhập tài khoản end-user trên tool |
| `POST` | `/api/v1/client/license/verify` | Kiểm tra tính hợp lệ của Key & Khóa HWID (Hỗ trợ cả key thuận & key ngược chiều) |
| `POST` | `/api/v1/client/license/activate` | Kích hoạt Key và liên kết phần cứng lần đầu |
| `POST` | `/api/v1/client/license/heartbeat` | Gửi tín hiệu sống duy trì phiên chạy ngầm |
| `GET` | `/api/v1/client/app/version` | Kiểm tra phiên bản mới nhất của Tool |

### Phân Hệ Quản Trị Seller & Key Ngược Chiều
| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/v1/seller/licenses/generate-reverse` | **Tạo Key Ngược Chiều khóa cứng HWID trực tiếp** |
| `GET` | `/api/v1/seller/licenses/reverse-lookup` | **Tra cứu ngược từ mã HWID ra License Key** |
| `POST` | `/api/v1/seller/licenses/external/generate` | **API liên kết ngoài cho Web Shop / Discord Bot bán key** |
| `POST` | `/api/v1/seller/licenses/generate` | Tạo License Key thuận chiều thông thường |
| `POST` | `/api/v1/seller/licenses/reset-hwid` | Giải phóng HWID để khách đổi sang máy mới |
| `POST` | `/api/v1/seller/licenses/extend` | Gia hạn thêm ngày sử dụng (+30 ngày) |
| `GET` | `/api/v1/system/domain-info` | Kiểm tra tên miền, SSL, IP khách và trạng thái Render |

---

## 6. Dữ Liệu Đăng Nhập Mặc Định

- **URL Quản Trị**: `http://127.0.0.1:8000` (hoặc tên miền Render của bạn)
- **Mã Khóa Truy Cập (Access Key)**: `thai` (hoặc giá trị cấu hình trong `SELLER_ACCESS_KEY`)
- **Master API Key mẫu**: `ca_live_948a201dfbc83e74` (Secret Token: `sk_sec_a7f10b42c98d3e21`)
