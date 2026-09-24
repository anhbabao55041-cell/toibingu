/**
 * quocthaiAuth / CYBERAUTH SDK & Code Snippets Library
 * Cung cấp mã nguồn tích hợp sẵn sàng chạy cho các ngôn ngữ và Bot/Shop tự động.
 * Tự động điều chỉnh theo Tên Miền / Domain hiện tại trên Render / VPS.
 */

function getDetectedApiBaseUrl() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin + "/api/v1/client";
  }
  return "http://127.0.0.1:8000/api/v1/client";
}

function getDetectedSellerApiUrl() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin + "/api/v1/seller";
  }
  return "http://127.0.0.1:8000/api/v1/seller";
}

function buildSdkTemplates(customBaseUrl = null) {
  const BASE_URL = customBaseUrl || getDetectedApiBaseUrl();
  const SELLER_URL = customBaseUrl ? customBaseUrl.replace("/client", "/seller") : getDetectedSellerApiUrl();

  return {
    csharp: {
      lang: "C# (.NET 6/7/8 & Framework)",
      filename: "CyberAuthClient.cs",
      code: `using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Management; // Thêm tham chiếu đến System.Management để lấy HWID

namespace CyberAuthSecurity
{
    public class CyberAuthClient
    {
        private static readonly HttpClient _httpClient = new HttpClient();
        private const string BASE_URL = "${BASE_URL}";
        private readonly string _appCode;

        public CyberAuthClient(string appCode)
        {
            _appCode = appCode;
        }

        /// <summary>
        /// Lấy mã phần cứng Windows duy nhất (Motherboard UUID + CPU ID)
        /// </summary>
        public string GetHardwareID()
        {
            try
            {
                string cpuId = "";
                using (var mc = new ManagementClass("Win32_Processor"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        cpuId = mo.Properties["ProcessorId"]?.Value?.ToString();
                        break;
                    }
                }

                string biosSerial = "";
                using (var mc = new ManagementClass("Win32_BIOS"))
                {
                    foreach (ManagementObject mo in mc.GetInstances())
                    {
                        biosSerial = mo.Properties["SerialNumber"]?.Value?.ToString();
                        break;
                    }
                }

                return $"HWID-WIN-{cpuId}-{biosSerial}".Trim();
            }
            catch
            {
                return "HWID-FALLBACK-" + Environment.MachineName;
            }
        }

        /// <summary>
        /// Xác thực bản quyền Key & Khóa phần cứng HWID
        /// </summary>
        public async Task<bool> VerifyLicenseAsync(string licenseKey)
        {
            var hwid = GetHardwareID();
            var payload = new
            {
                app_code = _appCode,
                license_key = licenseKey,
                hwid = hwid,
                device_name = Environment.MachineName
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{BASE_URL}/license/verify", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(responseText);
                var code = doc.RootElement.GetProperty("code").GetString();
                
                if (code == "LICENSE_VALID")
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("[+] License Validated Successfully! HWID Matched.");
                    Console.ResetColor();
                    return true;
                }
                else if (code == "KEY_REQUIRES_ACTIVATION")
                {
                    Console.WriteLine("[*] Phát hiện lần đầu kích hoạt. Đang liên kết phần cứng máy...");
                    return await ActivateLicenseAsync(licenseKey, hwid);
                }
            }
            
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[-] Xác thực thất bại: {responseText}");
            Console.ResetColor();
            return false;
        }

        public async Task<bool> ActivateLicenseAsync(string licenseKey, string hwid)
        {
            var payload = new
            {
                app_code = _appCode,
                license_key = licenseKey,
                hwid = hwid,
                device_name = Environment.MachineName
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{BASE_URL}/license/activate", content);
            return response.IsSuccessStatusCode;
        }
    }
}`
    },

    python: {
      lang: "Python 3",
      filename: "cyberauth_sdk.py",
      code: `import platform
import hashlib
import requests
import time
import threading

class CyberAuthClient:
    def __init__(self, app_code: str, base_url: str = "${BASE_URL}"):
        self.app_code = app_code
        self.base_url = base_url
        self.hwid = self._generate_hwid()
        self.license_key = None
        self._keepalive_running = False

    def _generate_hwid(self) -> str:
        raw = f"{platform.node()}-{platform.processor()}-{platform.machine()}"
        return "HWID-PY-" + hashlib.sha256(raw.encode()).hexdigest()[:24].upper()

    def login(self, username: str, password: str) -> dict:
        """Đăng nhập tài khoản end-user trên tool"""
        url = f"{self.base_url}/auth/login"
        payload = {
            "app_code": self.app_code,
            "username": username,
            "password": password,
            "hwid": self.hwid
        }
        res = requests.post(url, json=payload, timeout=10)
        return res.json()

    def verify_key(self, license_key: str) -> bool:
        """Kiểm tra Key & Bắt tay phần cứng HWID (Hỗ trợ cả Key Thuận & Key Ngược Chiều)"""
        self.license_key = license_key
        url = f"{self.base_url}/license/verify"
        payload = {
            "app_code": self.app_code,
            "license_key": license_key,
            "hwid": self.hwid,
            "device_name": platform.node()
        }
        res = requests.post(url, json=payload, timeout=10)
        
        if res.status_code == 200:
            data = res.json()
            if data.get("code") == "LICENSE_VALID":
                print(f"[+] License Hợp Lệ! Thời gian còn lại: {data['data']['remaining_seconds']}s")
                self._start_heartbeat()
                return True
            elif data.get("code") == "KEY_REQUIRES_ACTIVATION":
                print("[*] Đang kích hoạt thiết bị lần đầu...")
                return self.activate_key(license_key)
                
        print(f"[-] Lỗi xác thực ({res.status_code}): {res.text}")
        return False

    def activate_key(self, license_key: str) -> bool:
        url = f"{self.base_url}/license/activate"
        payload = {
            "app_code": self.app_code,
            "license_key": license_key,
            "hwid": self.hwid,
            "device_name": platform.node()
        }
        res = requests.post(url, json=payload, timeout=10)
        return res.status_code == 200

    def _start_heartbeat(self):
        """Gửi tín hiệu duy trì phiên sống ngầm mỗi 60 giây"""
        self._keepalive_running = True
        def worker():
            while self._keepalive_running:
                time.sleep(60)
                try:
                    requests.post(f"{self.base_url}/license/heartbeat", json={
                        "app_code": self.app_code,
                        "license_key": self.license_key,
                        "hwid": self.hwid
                    }, timeout=5)
                except Exception as e:
                    print(f"[!] Heartbeat error: {e}")
        threading.Thread(target=worker, daemon=True).start()

# Cách chạy thử nghiệm:
if __name__ == "__main__":
    auth = CyberAuthClient(app_code="AEGIS-SEC")
    is_valid = auth.verify_key("AEGIS-7F89-A2C4-90B1")
    if is_valid:
        print("[+] Bản quyền hợp lệ! Mở khóa các module phần mềm...")`
    },

    bot_api: {
      lang: "⚡ Liên Kết Web Shop & Bot Bán Key Tự Động (Python / cURL)",
      filename: "external_shop_bot.py",
      code: `# ==============================================================================
# HƯỚNG DẪN LIÊN KẾT API BÁN KEY TỰ ĐỘNG & TẠO KEY NGƯỢC CHIỀU (REVERSE BINDING)
# Dành cho: Discord Bot, Telegram Bot, Web Shop MMO Tự Động, Auto-Pay Webhook
# ==============================================================================

import requests

API_ENDPOINT = "${SELLER_URL}/licenses/external/generate"
# Lấy Public Key hoặc Secret Token từ tab "Khóa API Quản Trị"
API_KEY = "ca_live_948a201dfbc83e74" 

# ------------------------------------------------------------------------------
# TRƯỜNG HỢP 1: TẠO KEY NGƯỢC CHIỀU (REVERSE BINDING - ĐÃ BIẾT HWID CỦA KHÁCH)
# Khi khách mua gửi mã HWID máy tính của họ -> Tạo key khóa cứng ngay lập tức!
# ------------------------------------------------------------------------------
def create_reverse_key(app_code: str, customer_hwid: str, duration_days: int = 30):
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY
    }
    payload = {
        "app_code": app_code,
        "hwid": customer_hwid,                # Truyền HWID để tạo Key Ngược Chiều
        "duration_days": duration_days,        # Số ngày: 1, 7, 30, hoặc -1 (Vĩnh viễn)
        "prefix": "REV",
        "client_tag": "Discord Order #8821",
        "notes": "Khách thanh toán qua MoMo/Crypto"
    }

    res = requests.post(API_ENDPOINT, json=payload, headers=headers)
    data = res.json()
    
    if res.status_code == 200:
        print("✅ Tạo Key Ngược Chiều Thành Công!")
        print(f"Mã Key: {data['license_key']}")
        print(f"Khóa máy HWID: {data['hwid']}")
        print(f"Hết hạn lúc: {data['expires_at']}")
        return data
    else:
        print(f"❌ Lỗi: {data}")
        return None

# ------------------------------------------------------------------------------
# TRƯỜNG HỢP 2: TẠO KEY THUẬN CHIỀU (CHƯA CÓ HWID - KHÁCH TỰ KÍCH HOẠT SAU)
# ------------------------------------------------------------------------------
def create_standard_key(app_code: str, duration_days: int = 30):
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY
    }
    payload = {
        "app_code": app_code,
        "hwid": None,                          # Để trống HWID -> Key chờ kích hoạt
        "duration_days": duration_days,
        "prefix": "CYBER",
        "client_tag": "WebShop Buyer"
    }
    res = requests.post(API_ENDPOINT, json=payload, headers=headers)
    return res.json()

# Thử nghiệm:
if __name__ == "__main__":
    # Ví dụ khách gửi HWID máy:
    sample_hwid = "HWID-WIN11-BFEBFBFF00090672-SN750-NVME"
    create_reverse_key(app_code="AEGIS-SEC", customer_hwid=sample_hwid, duration_days=30)`
    },

    nodejs: {
      lang: "JavaScript / Node.js (Electron & CLI)",
      filename: "cyberauth.js",
      code: `const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

class CyberAuthClient {
  constructor(appCode, baseUrl = '${BASE_URL}') {
    this.appCode = appCode;
    this.baseUrl = baseUrl;
    this.hwid = this.getHardwareID();
  }

  getHardwareID() {
    const raw = \`\${os.hostname()}_\${os.cpus()[0]?.model || ''}_\${os.arch()}_\${os.platform()}\`;
    return 'HWID-NODE-' + crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24).toUpperCase();
  }

  async verifyLicense(licenseKey) {
    try {
      const response = await axios.post(\`\${this.baseUrl}/license/verify\`, {
        app_code: this.appCode,
        license_key: licenseKey,
        hwid: this.hwid,
        device_name: os.hostname()
      });

      if (response.data.code === 'LICENSE_VALID') {
        console.log('✅ License validated successfully! HWID locked.');
        return { success: true, details: response.data.data };
      } else if (response.data.code === 'KEY_REQUIRES_ACTIVATION') {
        console.log('⚡ Key requires binding. Activating now...');
        return await this.activateLicense(licenseKey);
      }
    } catch (err) {
      console.error('❌ Authentication failed:', err.response ? err.response.data : err.message);
      return { success: false, error: err.message };
    }
  }

  async activateLicense(licenseKey) {
    const response = await axios.post(\`\${this.baseUrl}/license/activate\`, {
      app_code: this.appCode,
      license_key: licenseKey,
      hwid: this.hwid,
      device_name: os.hostname()
    });
    return { success: response.status === 200, details: response.data };
  }
}

module.exports = CyberAuthClient;`
    },

    cpp: {
      lang: "C++ (Win32 + Libcurl)",
      filename: "CyberAuthClient.cpp",
      code: `#include <iostream>
#include <string>
#include <windows.h>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

std::string GetHardwareID() {
    DWORD volumeSerial = 0;
    GetVolumeInformationA("C:\\\\", NULL, 0, &volumeSerial, NULL, NULL, NULL, 0);

    int cpuInfo[4] = { 0 };
    __cpuid(cpuInfo, 0);
    char cpuBuf[32];
    sprintf_s(cpuBuf, "%08X%08X", cpuInfo[3], cpuInfo[2]);

    char hwidBuf[128];
    sprintf_s(hwidBuf, "HWID-WIN-%s-%08X", cpuBuf, volumeSerial);
    return std::string(hwidBuf);
}

static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

bool VerifyLicense(const std::string& appCode, const std::string& licenseKey) {
    CURL* curl = curl_easy_init();
    if (!curl) return false;

    std::string hwid = GetHardwareID();
    json reqBody = {
        {"app_code", appCode},
        {"license_key", licenseKey},
        {"hwid", hwid},
        {"device_name", "CppClientNode"}
    };
    std::string jsonStr = reqBody.dump();

    std::string readBuffer;
    struct curl_slist* headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, "${BASE_URL}/license/verify");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonStr.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res == CURLE_OK) {
        try {
            auto j = json::parse(readBuffer);
            if (j.contains("code") && j["code"] == "LICENSE_VALID") {
                std::cout << "[+] License Verified. HWID Handshake Passed." << std::endl;
                return true;
            }
        } catch (...) {}
    }

    std::cout << "[-] License Verification Failed." << std::endl;
    return false;
}`
    },

    golang: {
      lang: "Go (Golang)",
      filename: "cyberauth.go",
      code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type VerifyRequest struct {
	AppCode    string \`json:"app_code"\`
	LicenseKey string \`json:"license_key"\`
	HWID       string \`json:"hwid"\`
	DeviceName string \`json:"device_name"\`
}

func VerifyLicense(appCode string, licenseKey string) (bool, error) {
	hostname, _ := os.Hostname()
	hwid := "HWID-GO-" + hostname

	reqData := VerifyRequest{
		AppCode:    appCode,
		LicenseKey: licenseKey,
		HWID:       hwid,
		DeviceName: hostname,
	}

	payload, _ := json.Marshal(reqData)
	resp, err := http.Post("${BASE_URL}/license/verify", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		fmt.Println("[+] License verified successfully in Go!")
		return true, nil
	}

	return false, fmt.Errorf("verification returned status: %d", resp.StatusCode)
}`
    }
  };
}

window.buildSdkTemplates = buildSdkTemplates;
window.SDK_TEMPLATES = buildSdkTemplates();
