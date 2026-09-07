/**
 * CYBERAUTH SDK & Code Snippets Library
 * Provides production-ready integration code for multiple programming languages.
 */

const SDK_TEMPLATES = {
  csharp: {
    lang: "C# (.NET 6/7/8 & Framework)",
    filename: "CyberAuthClient.cs",
    code: `using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Management; // Add reference to System.Management for HWID

namespace CyberAuthSecurity
{
    public class CyberAuthClient
    {
        private static readonly HttpClient _httpClient = new HttpClient();
        private const string BASE_URL = "http://127.0.0.1:8000/api/v1/client";
        private readonly string _appCode;

        public CyberAuthClient(string appCode)
        {
            _appCode = appCode;
        }

        /// <summary>
        /// Retrieves unique Windows Machine Hardware ID (Motherboard UUID + CPU ID)
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
        /// Verifies license key validity & HWID lock status
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
                    Console.WriteLine("[+] License Validated Successfully! Welcome.");
                    Console.ResetColor();
                    return true;
                }
                else if (code == "KEY_REQUIRES_ACTIVATION")
                {
                    Console.WriteLine("[*] First time activation detected. Binding hardware...");
                    return await ActivateLicenseAsync(licenseKey, hwid);
                }
            }

            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[-] Verification Failed: {responseText}");
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

  cpp: {
    lang: "C++ (Win32 / Libcurl)",
    filename: "cyberauth_client.cpp",
    code: `#include <iostream>
#include <string>
#include <windows.h>
#include <intrin.h>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Retrieve CPU ID & Volume Serial as HWID
std::string GetHardwareID() {
    int cpuInfo[4] = { 0 };
    __cpuid(cpuInfo, 1);
    char cpuBuf[32];
    sprintf_s(cpuBuf, "%08X%08X", cpuInfo[3], cpuInfo[0]);

    DWORD volumeSerial = 0;
    GetVolumeInformationA("C:\\\\", NULL, 0, &volumeSerial, NULL, NULL, NULL, 0);

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

    curl_easy_setopt(curl, CURLOPT_URL, "http://127.0.0.1:8000/api/v1/client/license/verify");
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

  python: {
    lang: "Python 3",
    filename: "cyberauth_sdk.py",
    code: `import platform
import hashlib
import requests
import time
import threading

class CyberAuthClient:
    def __init__(self, app_code: str, base_url: str = "http://127.0.0.1:8000/api/v1/client"):
        self.app_code = app_code
        self.base_url = base_url
        self.hwid = self._generate_hwid()
        self.license_key = None
        self._keepalive_running = False

    def _generate_hwid(self) -> str:
        raw = f"{platform.node()}-{platform.processor()}-{platform.machine()}"
        return "HWID-PY-" + hashlib.sha256(raw.encode()).hexdigest()[:24].upper()

    def login(self, username: str, password: str) -> dict:
        """Authenticates user credentials and checks tool status"""
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
        """Verifies license validity and performs HWID handshake"""
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
                print(f"[+] License Validated! Remaining: {data['data']['remaining_seconds']}s")
                self._start_heartbeat()
                return True
            elif data.get("code") == "KEY_REQUIRES_ACTIVATION":
                print("[*] Binding Hardware ID to key...")
                return self.activate_key(license_key)
                
        print(f"[-] Verification Error ({res.status_code}): {res.text}")
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
                    print(f"[!] Heartbeat warning: {e}")
        threading.Thread(target=worker, daemon=True).start()

# Example Usage:
if __name__ == "__main__":
    auth = CyberAuthClient(app_code="AEGIS-SEC")
    is_valid = auth.verify_key("AEGIS-7F89-A2C4-90B1")
    if is_valid:
        print("[+] Application unlocked. Starting main routine...")`
  },

  javascript: {
    lang: "JavaScript / TypeScript (Node.js & Electron)",
    filename: "cyberauth.js",
    code: `const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

class CyberAuthClient {
  constructor(appCode, baseUrl = 'http://127.0.0.1:8000/api/v1/client') {
    this.appCode = appCode;
    this.baseUrl = baseUrl;
    this.hwid = this.getHardwareID();
  }

  getHardwareID() {
    const raw = \`\${os.hostname()}_\${os.cpus()[0].model}_\${os.arch()}_\${os.platform()}\`;
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
        console.log('✅ License validated successfully!');
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

  vbnet: {
    lang: "VB.NET (WinForms / Console)",
    filename: "CyberAuthClient.vb",
    code: `Imports System.Net.Http
Imports System.Text
Imports System.Text.Json
Imports System.Management

Public Class CyberAuthClient
    Private Shared ReadOnly client As New HttpClient()
    Private Const BASE_URL As String = "http://127.0.0.1:8000/api/v1/client"
    Private ReadOnly appCode As String

    Public Sub New(code As String)
        appCode = code
    End Sub

    Public Function GetHWID() As String
        Try
            Dim cpuId As String = ""
            Using mc As New ManagementClass("Win32_Processor")
                For Each mo As ManagementObject In mc.GetInstances()
                    cpuId = mo.Properties("ProcessorId")?.Value?.ToString()
                    Exit For
                Next
            End Using
            Return "HWID-VB-" & cpuId & "-" & Environment.MachineName
        Catch
            Return "HWID-VB-FALLBACK-" & Environment.MachineName
        End Try
    End Function

    Public Async Function VerifyKey(licenseKey As String) As Task(Of Boolean)
        Dim hwid As String = GetHWID()
        Dim payload = New With {
            .app_code = appCode,
            .license_key = licenseKey,
            .hwid = hwid,
            .device_name = Environment.MachineName
        }

        Dim jsonStr = JsonSerializer.Serialize(payload)
        Dim content = New StringContent(jsonStr, Encoding.UTF8, "application/json")
        Dim resp = Await client.PostAsync(BASE_URL & "/license/verify", content)

        If resp.IsSuccessStatusCode Then
            Return True
        End If
        Return False
    End Function
End Class`
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
	resp, err := http.Post("http://127.0.0.1:8000/api/v1/client/license/verify", "application/json", bytes.NewBuffer(payload))
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

window.SDK_TEMPLATES = SDK_TEMPLATES;
