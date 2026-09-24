/**
 * quocthaiAuth / CYBERAUTH - Trình Kiểm Thử API Trực Tiếp (Interactive Sandbox Tiếng Việt)
 */

const SANDBOX_PRESETS = {
  verify_license: {
    name: "1. Kiểm Tra Key & Khóa HWID",
    method: "POST",
    endpoint: "/api/v1/client/license/verify",
    body: {
      app_code: "AEGIS-SEC",
      license_key: "AEGIS-7F89-A2C4-90B1",
      hwid: "HWID-WIN11-BFEBFBFF00090672-SN750-NVME",
      device_name: "DESKTOP-THAI-RIG"
    }
  },
  activate_license: {
    name: "2. Kích Hoạt Key Lần Đầu & Khóa Máy",
    method: "POST",
    endpoint: "/api/v1/client/license/activate",
    body: {
      app_code: "AEGIS-SEC",
      license_key: "AEGIS-110A-7C99-F42D",
      hwid: "HWID-NEW-LAPTOP-99442",
      device_name: "Laptop-Gaming-Moi"
    }
  },
  user_login: {
    name: "3. Đăng Nhập Tài Khoản Khách Vào Tool",
    method: "POST",
    endpoint: "/api/v1/client/auth/login",
    body: {
      app_code: "AEGIS-SEC",
      username: "alex_cyber",
      password: "pass1234",
      hwid: "HWID-WIN11-BFEBFBFF00090672-SN750-NVME"
    }
  },
  heartbeat_ping: {
    name: "4. Gửi Tín Hiệu Sống Heartbeat (Duy Trì Phiên)",
    method: "POST",
    endpoint: "/api/v1/client/license/heartbeat",
    body: {
      app_code: "AEGIS-SEC",
      license_key: "AEGIS-7F89-A2C4-90B1",
      hwid: "HWID-WIN11-BFEBFBFF00090672-SN750-NVME"
    }
  },
  check_version: {
    name: "5. Kiểm Tra Phiên Bản Tool Mới Nhất",
    method: "GET",
    endpoint: "/api/v1/client/app/version?app_code=AEGIS-SEC",
    body: null
  }
};

function initSandbox() {
  const presetSelect = document.getElementById("sandbox-preset");
  const methodSelect = document.getElementById("sandbox-method");
  const endpointInput = document.getElementById("sandbox-endpoint");
  const bodyTextarea = document.getElementById("sandbox-body");
  const runBtn = document.getElementById("btn-run-sandbox");

  if (!presetSelect) return;

  presetSelect.addEventListener("change", (e) => {
    const key = e.target.value;
    if (SANDBOX_PRESETS[key]) {
      const p = SANDBOX_PRESETS[key];
      methodSelect.value = p.method;
      endpointInput.value = p.endpoint;
      bodyTextarea.value = p.body ? JSON.stringify(p.body, null, 2) : "{}";
      if (window.soundFX) window.soundFX.playClick();
    }
  });

  runBtn.addEventListener("click", async () => {
    await executeSandboxCall();
  });
}

async function executeSandboxCall() {
  const endpoint = document.getElementById("sandbox-endpoint").value.trim();
  const method = document.getElementById("sandbox-method").value;
  const bodyStr = document.getElementById("sandbox-body").value.trim();
  const viewer = document.getElementById("sandbox-response-viewer");
  const statusBadge = document.getElementById("sandbox-status-badge");
  const latencyBadge = document.getElementById("sandbox-latency-badge");

  let parsedBody = null;
  if (method === "POST" && bodyStr) {
    try {
      parsedBody = JSON.parse(bodyStr);
    } catch (e) {
      alert("Định dạng dữ liệu JSON không hợp lệ: " + e.message);
      return;
    }
  }

  if (window.soundFX) window.soundFX.playBeep();

  viewer.innerHTML = '<span class="tok-comment">// Đang truyền gói tin mã hóa qua lá chắn bảo mật...</span>';
  statusBadge.className = "badge expired";
  statusBadge.textContent = "ĐANG GỬI...";
  latencyBadge.textContent = "-- ms";

  const startTime = performance.now();

  try {
    const response = await fetch(endpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: method === "POST" ? JSON.stringify(parsedBody) : undefined
    });

    const latency = Math.round(performance.now() - startTime);
    latencyBadge.textContent = `${latency} ms`;

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { raw: await response.text() };
    }

    if (response.status >= 200 && response.status < 300) {
      statusBadge.className = "badge active";
      statusBadge.textContent = `${response.status} THÀNH CÔNG`;
      if (window.soundFX) window.soundFX.playSuccess();
    } else if (response.status === 403) {
      statusBadge.className = "badge banned";
      statusBadge.textContent = `${response.status} BỊ CHẶN (LỆCH HWID/KHÓA)`;
      if (window.soundFX) window.soundFX.playDanger();
    } else {
      statusBadge.className = "badge maintenance";
      statusBadge.textContent = `${response.status} ${response.statusText}`;
      if (window.soundFX) window.soundFX.playDanger();
    }

    viewer.innerHTML = syntaxHighlightJson(data);

  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    latencyBadge.textContent = `${latency} ms`;
    statusBadge.className = "badge banned";
    statusBadge.textContent = "LỖI KẾT NỐI";
    viewer.innerHTML = `<span class="tok-kw">Lỗi:</span> ${err.message}`;
    if (window.soundFX) window.soundFX.playDanger();
  }
}

function syntaxHighlightJson(jsonObj) {
  const json = JSON.stringify(jsonObj, null, 2);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'tok-num';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'tok-kw'; // key
      } else {
        cls = 'tok-str'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'tok-fn';
    } else if (/null/.test(match)) {
      cls = 'tok-comment';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

window.initSandbox = initSandbox;
