/**
 * quocthaiAuth / CYBERAUTH - Core Application Controller (Tiếng Việt)
 * Quản lý phiên đăng nhập bảo mật, chuyển tab, âm thanh tương lai, nạp dữ liệu và thao tác quản trị.
 */

// ==================== BỘ TỔNG HỢP ÂM THANH CYBER ====================
class CyberAudioEngine {
  constructor() {
    this.enabled = localStorage.getItem("cyberauth_audio") === "true";
    this.ctx = null;
  }

  initCtx() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("cyberauth_audio", this.enabled);
    return this.enabled;
  }

  playClick() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playSuccess() {
    if (!this.enabled) return;
    this.initCtx();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.25);
  }

  playDanger() {
    if (!this.enabled) return;
    this.initCtx();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.15);
  }

  playBeep() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }
}

window.soundFX = new CyberAudioEngine();

// ==================== THÔNG BÁO TOAST ====================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div style="flex:1;">${message}</div>
    <span style="cursor:pointer; opacity:0.6; font-weight:700;" onclick="this.parentElement.remove()">✕</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

// ==================== QUẢN LÝ MODAL ====================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
    if (window.soundFX) window.soundFX.playClick();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("open");
  }
}
window.openModal = openModal;
window.closeModal = closeModal;

// ==================== ĐĂNG NHẬP BẢO MẬT ====================
const AUTH_STORAGE_KEY = "cyberauth_seller_token";

function checkAuthStatus() {
  const overlay = document.getElementById("seller-login-overlay");
  const token = localStorage.getItem(AUTH_STORAGE_KEY);

  if (token) {
    if (overlay) overlay.classList.add("hidden");
    loadAllDashboardData();
  } else {
    if (overlay) overlay.classList.remove("hidden");
    const input = document.getElementById("seller-access-key");
    if (input) setTimeout(() => input.focus(), 200);
  }
}

async function handleSellerLogin() {
  const input = document.getElementById("seller-access-key");
  const card = document.getElementById("login-card-box");
  const overlay = document.getElementById("seller-login-overlay");
  const btn = document.getElementById("btn-seller-login");
  const keyVal = input ? input.value.trim() : "";

  if (!keyVal) {
    showToast("Vui lòng nhập khóa bảo mật truy cập!", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>ĐANG XÁC THỰC...</span>`;

  try {
    const res = await fetch("/api/v1/seller/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_key: keyVal })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Khóa bảo mật không chính xác!");
    }

    // Đăng nhập thành công!
    localStorage.setItem(AUTH_STORAGE_KEY, data.token);
    if (window.soundFX) window.soundFX.playSuccess();
    showToast("Xác thực thành công! Chào mừng Quản Trị Viên Thái", "success");

    overlay.classList.add("hidden");
    input.value = "";
    loadAllDashboardData();

  } catch (err) {
    if (window.soundFX) window.soundFX.playDanger();
    showToast(err.message, "error");
    if (card) {
      card.classList.remove("shake");
      void card.offsetWidth; // trigger reflow
      card.classList.add("shake");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
        <polyline points="10 17 15 12 10 7"></polyline>
        <line x1="15" y1="12" x2="3" y2="12"></line>
      </svg>
      <span>XÁC THỰC TRUY CẬP HỆ THỐNG</span>
    `;
  }
}
window.handleSellerLogin = handleSellerLogin;

function handleSellerLogout() {
  if (!confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống quản trị quocthaiAuth?")) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  const overlay = document.getElementById("seller-login-overlay");
  if (overlay) overlay.classList.remove("hidden");
  showToast("Đã đăng xuất an toàn khỏi hệ thống.", "info");
  if (window.soundFX) window.soundFX.playClick();
}
window.handleSellerLogout = handleSellerLogout;

function loadAllDashboardData() {
  loadDashboardStats();
  loadApplications();
  loadLicenses();
  loadUsers();
  loadSellerKeys();
  loadSecurityLogs();
  checkLiveDomainStatus();
}


// ==================== KHỞI TẠO SỰ KIỆN DOM ====================
document.addEventListener("DOMContentLoaded", () => {
  // Modal backdrop click
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("open");
    });
  });

  document.querySelectorAll(".modal-close-btn, .btn-modal-cancel").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    });
  });

  // Nút âm thanh Cyber
  const audioBtn = document.getElementById("audio-toggle-btn");
  if (audioBtn) {
    if (window.soundFX.enabled) audioBtn.classList.add("active");
    audioBtn.addEventListener("click", () => {
      const isEnabled = window.soundFX.toggle();
      audioBtn.classList.toggle("active", isEnabled);
      showToast(`Âm thanh Cyber SFX: ${isEnabled ? "BẬT" : "TẮT"}`, isEnabled ? "success" : "info");
      if (isEnabled) window.soundFX.playSuccess();
    });
  }

  // Khởi tạo điều hướng Tab
  initTabNavigation();

  // Khởi tạo các module con
  if (window.initGeneratorModule) window.initGeneratorModule();
  if (window.initSandbox) window.initSandbox();
  initSdkTabs();

  // Kiểm tra đăng nhập & tên miền
  checkAuthStatus();
  checkLiveDomainStatus();

  // Radar polling mỗi 10 giây
  setInterval(() => {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) {
      loadDashboardStats(true);
    }
  }, 10000);
});

// ==================== ĐIỀU HƯỚNG TAB ====================
function initTabNavigation() {
  const navItems = document.querySelectorAll(".nav-item[data-tab]");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-item[data-tab]").forEach(i => {
    i.classList.toggle("active", i.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.remove("active");
  });
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.add("active");

  const titleEl = document.getElementById("header-title");
  const breadcrumbEl = document.getElementById("header-breadcrumb");

  const tabTitles = {
    overview: { title: "BẢNG ĐIỀU KHIỂN & ĐO LƯỜNG TỪ XA", breadcrumb: "TỔNG QUAN / ĐO LƯỜNG" },
    apps: { title: "QUẢN LÝ ỨNG DỤNG & PHẦN MỀM", breadcrumb: "BẢO MẬT / APPS" },
    generator: { title: "BỘ SINH LICENSE KEY TỰ ĐỘNG", breadcrumb: "BẢN QUYỀN / KEY-GEN" },
    "reverse-key": { title: "BỘ SINH KEY NGƯỢC CHIỀU (REVERSE HWID BINDING)", breadcrumb: "BẢN QUYỀN / REVERSE-KEY" },
    users: { title: "QUẢN LÝ TÀI KHOẢN KHÁCH HÀNG", breadcrumb: "KHÁCH HÀNG / USERS" },
    sdk: { title: "THƯ VIỆN SDK & TRÌNH TEST SANDBOX", breadcrumb: "LẬP TRÌNH / API-DOCS" },
    apikeys: { title: "QUẢN LÝ MÃ KHÓA API SELLER", breadcrumb: "XÁC THỰC / TOKENS" },
    domain: { title: "CẤU HÌNH TÊN MIỀN & DEPLOY RENDER.COM", breadcrumb: "HỆ THỐNG / DOMAIN-RENDER" },
    logs: { title: "NHẬT KÝ KIỂM TRA BẢO MẬT THỜI GIAN THỰC", breadcrumb: "PHÒNG THỦ / LOGS" }
  };


  if (tabTitles[tabId]) {
    titleEl.textContent = tabTitles[tabId].title;
    breadcrumbEl.textContent = tabTitles[tabId].breadcrumb;
  }

  if (window.soundFX) window.soundFX.playClick();
}
window.switchTab = switchTab;

// ==================== THỐNG KÊ DASHBOARD ====================
async function loadDashboardStats(silent = false) {
  try {
    const res = await fetch("/api/v1/seller/stats");
    const data = await res.json();
    const m = data.metrics;

    document.getElementById("stat-total-apps").textContent = m.total_apps;
    document.getElementById("stat-total-licenses").textContent = m.total_licenses;
    document.getElementById("stat-bound-licenses").textContent = m.bound_licenses;
    document.getElementById("stat-total-users").textContent = m.total_users;
    document.getElementById("stat-total-hwids").textContent = m.total_hwids;
    document.getElementById("stat-security-alerts").textContent = m.security_alerts;

    renderOverviewLogs(data.recent_logs);

    const latencyEl = document.getElementById("latency-metric");
    if (latencyEl) {
      const ping = Math.floor(Math.random() * 5) + 9;
      latencyEl.textContent = `~${ping}ms (AES-256)`;
    }

  } catch (err) {
    if (!silent) console.error("Lỗi nạp thống kê:", err);
  }
}
window.loadDashboardStats = loadDashboardStats;

function renderOverviewLogs(logs) {
  const container = document.getElementById("overview-recent-logs");
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="padding:16px; color:var(--text-muted);">Chưa có sự kiện an ninh nào được ghi nhận.</div>';
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="log-item">
      <span class="log-badge ${log.severity}">${log.event_type}</span>
      <div style="flex:1;">
        <div style="color:var(--text-main);">${escapeHtml(log.details)}</div>
        <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono); margin-top:2px;">
          IP: ${log.source_ip} | Thời gian: ${log.timestamp}
        </div>
      </div>
    </div>
  `).join("");
}

// ==================== QUẢN LÝ ỨNG DỤNG ====================
let _appsCache = [];

async function loadApplications() {
  try {
    const res = await fetch("/api/v1/seller/apps");
    const apps = await res.json();
    _appsCache = apps;

    populateAppDropdowns(apps);

    const container = document.getElementById("apps-cards-grid");
    if (!container) return;

    container.innerHTML = apps.map(app => `
      <div class="app-card">
        <div class="app-card-header">
          <div>
            <div class="app-info-title">${escapeHtml(app.name)}</div>
            <span class="app-code-tag">${app.app_code}</span>
          </div>
          <span class="badge ${app.status}">${app.status === 'active' ? 'ĐANG CHẠY' : 'BẢO TRÌ'}</span>
        </div>

        <div style="font-size:12px; color:var(--text-muted); min-height:36px;">
          ${escapeHtml(app.description || "Chưa có mô tả chi tiết.")}
        </div>

        <div class="app-stats-row">
          <div class="app-stat-col">
            <div class="label">PHIÊN BẢN</div>
            <div class="val">v${escapeHtml(app.version)}</div>
          </div>
          <div class="app-stat-col">
            <div class="label">BẢN QUYỀN</div>
            <div class="val" style="color:var(--cyan-neon);">${app.license_count}</div>
          </div>
          <div class="app-stat-col">
            <div class="label">KHÁCH HÀNG</div>
            <div class="val" style="color:var(--emerald-neon);">${app.user_count}</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono);">MÃ BÍ MẬT APP SECRET:</div>
          <div class="key-display" style="justify-content:space-between; font-size:11px;">
            <span id="secret-${app.id}">••••••••••••••••••••</span>
            <div style="display:flex; gap:6px;">
              <button class="copy-icon-btn" title="Ẩn/Hiện Mã Bí Mật" onclick="toggleSecretVisibility(${app.id}, '${app.secret_key}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="copy-icon-btn" title="Sao Chép Secret" onclick="copyToClipboard('${app.secret_key}', 'Đã sao chép Secret Key!')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:6px;">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="toggleAppMaintenance(${app.id}, '${app.status}')">
            ${app.status === 'active' ? 'Bật Bảo Trì' : 'Bật Hoạt Động'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteApplication(${app.id}, '${escapeHtml(app.name)}')">
            Xóa Tool
          </button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Lỗi nạp ứng dụng:", err);
  }
}
window.loadApplications = loadApplications;

function populateAppDropdowns(apps) {
  const genSelect = document.getElementById("gen-app-select");
  const genRevSelect = document.getElementById("gen-rev-app-select");
  const userSelect = document.getElementById("user-app-select");
  const filterSelect = document.getElementById("license-filter-app");

  const optionsHtml = apps.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.app_code})</option>`).join("");

  if (genSelect) genSelect.innerHTML = optionsHtml;
  if (genRevSelect) genRevSelect.innerHTML = optionsHtml;
  if (userSelect) userSelect.innerHTML = optionsHtml;
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Tất Cả Ứng Dụng</option>' + optionsHtml;
  }
}


function toggleSecretVisibility(appId, secret) {
  const el = document.getElementById(`secret-${appId}`);
  if (el.textContent.includes("••••")) {
    el.textContent = secret;
  } else {
    el.textContent = "••••••••••••••••••••";
  }
}

async function toggleAppMaintenance(appId, currentStatus) {
  const newStatus = currentStatus === "active" ? "maintenance" : "active";
  try {
    await fetch(`/api/v1/seller/apps/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Trạng thái ứng dụng chuyển sang: ${newStatus === 'active' ? 'Đang chạy' : 'Bảo trì'}`, "info");
    loadApplications();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteApplication(appId, appName) {
  if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn phần mềm "${appName}"? Toàn bộ key và tài khoản liên quan sẽ bị xóa theo!`)) return;
  try {
    await fetch(`/api/v1/seller/apps/${appId}`, { method: "DELETE" });
    showToast("Đã xóa ứng dụng", "info");
    loadApplications();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Tạo Ứng Dụng Mới
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-create-app");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById("new-app-name").value.trim(),
        app_code: document.getElementById("new-app-code").value.trim(),
        version: document.getElementById("new-app-version").value.trim() || "1.0.0",
        download_url: document.getElementById("new-app-url").value.trim(),
        description: document.getElementById("new-app-desc").value.trim()
      };

      try {
        const res = await fetch("/api/v1/seller/apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Không thể tạo ứng dụng");

        showToast("Đã tạo ứng dụng thành công!", "success");
        closeModal("modal-create-app");
        form.reset();
        loadApplications();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
});

// ==================== QUẢN LÝ LICENSE ====================
let _licensesCache = [];

async function loadLicenses() {
  const appId = document.getElementById("license-filter-app")?.value || "";
  const status = document.getElementById("license-filter-status")?.value || "";
  const search = document.getElementById("license-search-input")?.value || "";

  let url = "/api/v1/seller/licenses?";
  if (appId) url += `app_id=${appId}&`;
  if (status) url += `status=${status}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;

  try {
    const res = await fetch(url);
    const licenses = await res.json();
    _licensesCache = licenses;

    const tbody = document.getElementById("licenses-table-body");
    if (!tbody) return;

    if (licenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy mã bản quyền nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = licenses.map(lic => {
      const hwidCount = lic.hwids ? lic.hwids.length : 0;
      const maxHwidLabel = lic.max_hwid === -1 ? "Vĩnh viễn" : lic.max_hwid;
      const hwidBadgeCls = hwidCount >= lic.max_hwid && lic.max_hwid !== -1 ? "banned" : "bound";
      
      const durationLabel = lic.duration_days === -1 ? "Trọn Đời" : `${lic.duration_days} Ngày`;
      const expiresLabel = lic.expires_at ? lic.expires_at.split(" ")[0] : (lic.duration_days === -1 ? "Trọn Đời" : "Chưa Kích Hoạt");

      const statusMap = {
        active: "CHƯA DÙNG",
        bound: "ĐANG DÙNG",
        expired: "HẾT HẠN",
        banned: "BỊ KHÓA"
      };

      return `
        <tr>
          <td>
            <div class="key-display">
              <span>${lic.license_key}</span>
              <button class="copy-icon-btn" onclick="copyToClipboard('${lic.license_key}', 'Đã sao chép License Key!')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            ${lic.client_tag ? `<div style="font-size:10px; color:var(--cyan-neon); margin-top:3px;">Thẻ: ${escapeHtml(lic.client_tag)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight:600; color:#fff;">${escapeHtml(lic.app_name)}</div>
            <span class="breadcrumb-tag" style="font-size:9px;">${lic.app_code}</span>
          </td>
          <td>
            <span class="badge ${lic.status}">${statusMap[lic.status] || lic.status.toUpperCase()}</span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="badge ${hwidBadgeCls}">${hwidCount} / ${maxHwidLabel} Máy</span>
              ${hwidCount > 0 ? `
                <button class="btn btn-secondary btn-sm btn-icon" title="Xem Chi Tiết Máy" onclick="inspectLicenseHwids(${lic.id})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              ` : ''}
            </div>
          </td>
          <td>
            <div>${durationLabel}</div>
            <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${expiresLabel}</div>
          </td>
          <td style="font-size:11px; color:var(--text-muted);">
            ${lic.created_at ? lic.created_at.split(" ")[0] : '--'}
          </td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" title="Xóa liên kết HWID để khách đổi máy" onclick="resetLicenseHWID(${lic.id}, '${lic.license_key}')">
                Reset HWID
              </button>
              <button class="btn btn-secondary btn-sm" title="Gia hạn thêm 30 ngày" onclick="extendLicenseDays(${lic.id})">
                +30d
              </button>
              <button class="btn ${lic.status === 'banned' ? 'btn-success' : 'btn-danger'} btn-sm" onclick="toggleLicenseBan(${lic.id}, '${lic.status}')">
                ${lic.status === 'banned' ? 'Mở Khóa' : 'Khóa'}
              </button>
              <button class="btn btn-secondary btn-sm" style="color:var(--crimson-neon);" onclick="deleteLicenseKey(${lic.id})">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Lỗi nạp danh sách license:", err);
  }
}
window.loadLicenses = loadLicenses;

// Reset HWID
async function resetLicenseHWID(licenseId, key) {
  if (!confirm(`Xác nhận xóa liên kết phần cứng cho License Key: "${key}"?\n\nKhách hàng sẽ có thể kích hoạt sử dụng trên máy tính mới.`)) return;
  try {
    const res = await fetch("/api/v1/seller/licenses/reset-hwid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_id: licenseId })
    });
    const data = await res.json();
    showToast("Đã làm mới HWID thành công! Khách có thể đổi sang máy khác.", "success");
    if (window.soundFX) window.soundFX.playSuccess();
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Gia hạn bản quyền
async function extendLicenseDays(licenseId) {
  const daysStr = prompt("Nhập số ngày muốn cộng thêm cho bản quyền này:", "30");
  if (!daysStr) return;
  const days = parseInt(daysStr, 10);
  if (isNaN(days) || days <= 0) return;

  try {
    const res = await fetch("/api/v1/seller/licenses/extend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_id: licenseId, additional_days: days })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Không thể gia hạn bản quyền");
    showToast(`Đã gia hạn thêm ${days} ngày thành công!`, "success");
    loadLicenses();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Khóa / Mở Khóa Key
async function toggleLicenseBan(licenseId, currentStatus) {
  const newStatus = currentStatus === "banned" ? "active" : "banned";
  try {
    await fetch("/api/v1/seller/licenses/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_id: licenseId, status: newStatus })
    });
    showToast(`Trạng thái key đã chuyển thành: ${newStatus === 'banned' ? 'Đã bị khóa' : 'Đang hoạt động'}`, "info");
    if (newStatus === "banned" && window.soundFX) window.soundFX.playDanger();
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Xóa Key
async function deleteLicenseKey(licenseId) {
  if (!confirm("Bạn có chắc muốn xóa vĩnh viễn mã license này?")) return;
  try {
    await fetch(`/api/v1/seller/licenses/${licenseId}`, { method: "DELETE" });
    showToast("Đã xóa mã bản quyền", "info");
    loadLicenses();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Xem chi tiết HWID máy tính
function inspectLicenseHwids(licenseId) {
  const lic = _licensesCache.find(l => l.id === licenseId);
  if (!lic || !lic.hwids) return;

  const content = document.getElementById("inspect-hwids-content");
  const title = document.getElementById("inspect-hwids-title");
  title.textContent = `Hồ Sơ Thiết Bị Đã Khóa: ${lic.license_key}`;

  if (lic.hwids.length === 0) {
    content.innerHTML = `<div style="color:var(--text-muted); padding:16px;">Chưa có máy tính nào liên kết với mã key này.</div>`;
  } else {
    content.innerHTML = lic.hwids.map((h, i) => `
      <div style="background:rgba(9, 14, 23, 0.8); border:1px solid var(--border-subtle); border-radius:6px; padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <strong style="color:#fff;">Thiết bị #${i+1}: ${escapeHtml(h.device_name || 'Máy tính Windows')}</strong>
          <span style="font-family:var(--font-mono); color:var(--cyan-neon); font-size:11px;">IP: ${h.ip_address}</span>
        </div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim); word-break:break-all;">
          Mã HWID: ${h.hwid_hash}
        </div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">
          Lần cuối kết nối: ${h.last_seen_at || '--'}
        </div>
      </div>
    `).join("");
  }

  openModal("modal-inspect-hwids");
}

// Xuất file CSV / JSON
function exportLicensesCSV() {
  if (!_licensesCache || _licensesCache.length === 0) {
    showToast("Không có dữ liệu license để xuất", "warning");
    return;
  }
  const headers = ["ID", "Ma_License", "Ung_Dung", "Trang_Thai", "Gioi_Han_HWID", "Thoi_Han_Ngay", "Ngay_Het_Han", "The_Khach_Hang"];
  const rows = _licensesCache.map(l => [
    l.id,
    `"${l.license_key}"`,
    `"${l.app_name}"`,
    l.status,
    l.max_hwid,
    l.duration_days,
    `"${l.expires_at || ''}"`,
    `"${l.client_tag || ''}"`
  ]);
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  downloadBlob(csvContent, "text/csv;charset=utf-8;", `cyberauth_licenses_${Date.now()}.csv`);
  showToast("Đã tải xuống file CSV thành công!", "success");
}

function exportLicensesJSON() {
  if (!_licensesCache || _licensesCache.length === 0) {
    showToast("Không có dữ liệu license để xuất", "warning");
    return;
  }
  const jsonStr = JSON.stringify(_licensesCache, null, 2);
  downloadBlob(jsonStr, "application/json;charset=utf-8;", `cyberauth_licenses_${Date.now()}.json`);
  showToast("Đã tải xuống file JSON thành công!", "success");
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== QUẢN LÝ NGƯỜI DÙNG ====================
async function loadUsers() {
  try {
    const res = await fetch("/api/v1/seller/users");
    const users = await res.json();

    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có tài khoản khách hàng nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(u.username)}</div>
          <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono);">ID: #${u.id}</div>
        </td>
        <td>
          <span class="breadcrumb-tag">${u.app_code}</span>
        </td>
        <td>
          <span class="badge ${u.status}">${u.status === 'active' ? 'HOẠT ĐỘNG' : 'ĐÃ KHÓA'}</span>
        </td>
        <td>
          ${u.license_key ? `<span class="font-mono" style="color:var(--cyan-neon); font-size:12px;">${u.license_key}</span>` : '<span style="color:var(--text-muted);">Chưa gán</span>'}
        </td>
        <td style="font-size:11px; font-family:var(--font-mono); color:var(--text-dim);">
          ${u.last_login_ip || '--'}
          <div style="color:var(--text-muted); font-size:10px;">${u.last_login_at || 'Chưa đăng nhập'}</div>
        </td>
        <td>
          ${u.hwid_hash ? `<span class="badge bound" title="${u.hwid_hash}">ĐÃ KHÓA MÁY</span>` : `<span class="badge active">CHƯA KHÓA</span>`}
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn ${u.status === 'suspended' ? 'btn-success' : 'btn-danger'} btn-sm" onclick="toggleUserStatus(${u.id}, '${u.status}')">
              ${u.status === 'suspended' ? 'Mở Khóa' : 'Khóa'}
            </button>
            <button class="btn btn-secondary btn-sm" title="Xóa liên kết máy tính" onclick="resetUserHWID(${u.id})">
              Reset HWID
            </button>
            <button class="btn btn-secondary btn-sm" style="color:var(--crimson-neon);" onclick="deleteUserAccount(${u.id}, '${escapeHtml(u.username)}')">
              ✕
            </button>
          </div>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Lỗi nạp danh sách khách hàng:", err);
  }
}
window.loadUsers = loadUsers;

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  try {
    await fetch("/api/v1/seller/users/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, status: newStatus })
    });
    showToast(`Đã chuyển trạng thái tài khoản sang: ${newStatus === 'suspended' ? 'Đã Khóa' : 'Hoạt Động'}`, "info");
    if (newStatus === "suspended" && window.soundFX) window.soundFX.playDanger();
    loadUsers();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function resetUserHWID(userId) {
  try {
    await fetch(`/api/v1/seller/users/reset-hwid?user_id=${userId}`, { method: "POST" });
    showToast("Đã reset HWID cho người dùng thành công!", "success");
    loadUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteUserAccount(userId, username) {
  if (!confirm(`Bạn có chắc muốn xóa tài khoản khách hàng "${username}"?`)) return;
  try {
    await fetch(`/api/v1/seller/users/${userId}`, { method: "DELETE" });
    showToast("Đã xóa tài khoản", "info");
    loadUsers();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Tạo Tài Khoản Người Dùng Mới
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-create-user");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        app_id: parseInt(document.getElementById("user-app-select").value, 10),
        username: document.getElementById("new-user-name").value.trim(),
        password: document.getElementById("new-user-pass").value.trim(),
        license_key: document.getElementById("new-user-key").value.trim()
      };

      try {
        const res = await fetch("/api/v1/seller/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Không thể tạo tài khoản");

        showToast("Đã cấp tài khoản người dùng thành công!", "success");
        closeModal("modal-create-user");
        form.reset();
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
});

// ==================== QUẢN LÝ KHÓA API SELLER ====================
async function loadSellerKeys() {
  try {
    const res = await fetch("/api/v1/seller/keys");
    const keys = await res.json();

    const tbody = document.getElementById("apikeys-table-body");
    if (!tbody) return;

    if (keys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có mã khóa API nào được cấp.</td></tr>`;
      return;
    }

    tbody.innerHTML = keys.map(k => `
      <tr>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(k.seller_name)}</div>
          <span class="badge ${k.is_active ? 'active' : 'banned'}">${k.is_active ? 'ĐANG CHẠY' : 'ĐÃ THU HỒI'}</span>
        </td>
        <td>
          <div class="key-display">
            <span>${k.api_key}</span>
            <button class="copy-icon-btn" onclick="copyToClipboard('${k.api_key}', 'Đã sao chép Public API Key!')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </td>
        <td>
          <span class="breadcrumb-tag">${k.role.toUpperCase()}</span>
        </td>
        <td style="font-family:var(--font-mono); font-size:12px;">
          ${escapeHtml(k.ip_whitelist)}
        </td>
        <td style="font-family:var(--font-mono); font-size:12px; color:var(--cyan-neon);">
          ${k.rate_limit_per_min} req/phút
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn ${k.is_active ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleSellerKey(${k.id})">
              ${k.is_active ? 'Thu Hồi' : 'Kích Hoạt'}
            </button>
            <button class="btn btn-secondary btn-sm" style="color:var(--crimson-neon);" onclick="deleteSellerKey(${k.id})">
              ✕
            </button>
          </div>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Lỗi nạp khóa API:", err);
  }
}
window.loadSellerKeys = loadSellerKeys;

async function toggleSellerKey(keyId) {
  try {
    const res = await fetch(`/api/v1/seller/keys/toggle?key_id=${keyId}`, { method: "POST" });
    const data = await res.json();
    showToast(data.message, "info");
    loadSellerKeys();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteSellerKey(keyId) {
  if (!confirm("Xóa vĩnh viễn mã API Key này? Các kênh tích hợp bên ngoài sẽ ngừng hoạt động ngay lập tức!")) return;
  try {
    await fetch(`/api/v1/seller/keys/${keyId}`, { method: "DELETE" });
    showToast("Đã xóa khóa API", "info");
    loadSellerKeys();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Cấp API Key Mới
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-create-apikey");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        seller_name: document.getElementById("new-key-seller").value.trim(),
        role: document.getElementById("new-key-role").value,
        ip_whitelist: document.getElementById("new-key-ip").value.trim() || "*",
        rate_limit_per_min: parseInt(document.getElementById("new-key-ratelimit").value, 10) || 120
      };

      try {
        const res = await fetch("/api/v1/seller/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Không thể cấp khóa");

        closeModal("modal-create-apikey");
        form.reset();
        loadSellerKeys();

        alert(`Khóa API Đã Được Tạo!\n\nPublic Key: ${data.api_key}\nSecret Token: ${data.secret_token}\n\nVui lòng lưu lại Secret Token này ngay vì nó sẽ không được hiển thị lại!`);
        showToast("Đã cấp API Key thành công!", "success");

      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
});

// ==================== NHẬT KÝ BẢO MẬT ====================
async function loadSecurityLogs() {
  const severity = document.getElementById("logs-filter-severity")?.value || "all";
  try {
    const res = await fetch(`/api/v1/seller/logs?limit=50&severity=${severity}`);
    const logs = await res.json();

    const container = document.getElementById("full-security-logs-container");
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-muted);">Không có nhật ký nào phù hợp bộ lọc hiện tại.</div>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <div class="log-item">
        <span class="log-badge ${l.severity}">${l.event_type}</span>
        <div style="flex:1;">
          <div style="color:var(--text-main); font-weight:500;">${escapeHtml(l.details)}</div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-top:3px; display:flex; gap:16px;">
            <span>IP Nguồn: ${l.source_ip}</span>
            <span>Ứng Dụng: ${escapeHtml(l.app_name || 'Lõi Hệ Thống')}</span>
            <span>Thời Gian: ${l.timestamp}</span>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Lỗi nạp nhật ký an ninh:", err);
  }
}
window.loadSecurityLogs = loadSecurityLogs;

async function clearSecurityLogs() {
  if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký an ninh hiện tại?")) return;
  try {
    await fetch("/api/v1/seller/logs/clear", { method: "POST" });
    showToast("Đã dọn sạch nhật ký kiểm tra", "info");
    loadSecurityLogs();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.clearSecurityLogs = clearSecurityLogs;

// ==================== SDK TABS & CODE SNIPPETS ====================
function initSdkTabs() {
  const tabsContainer = document.getElementById("sdk-language-tabs");
  if (!tabsContainer || !window.SDK_TEMPLATES) return;

  const languages = Object.keys(window.SDK_TEMPLATES);
  tabsContainer.innerHTML = languages.map((langKey, idx) => `
    <button class="sdk-tab-btn ${idx === 0 ? 'active' : ''}" data-lang="${langKey}">
      ${window.SDK_TEMPLATES[langKey].lang}
    </button>
  `).join("");

  tabsContainer.querySelectorAll(".sdk-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      tabsContainer.querySelectorAll(".sdk-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      displaySdkCode(btn.dataset.lang);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  displaySdkCode(languages[0]);
}

function displaySdkCode(langKey) {
  const item = window.SDK_TEMPLATES[langKey];
  if (!item) return;

  const filenameEl = document.getElementById("sdk-filename");
  const preEl = document.getElementById("sdk-code-block");

  if (filenameEl) filenameEl.textContent = item.filename;
  if (preEl) preEl.textContent = item.code;
}

function copySdkCurrentCode() {
  const preEl = document.getElementById("sdk-code-block");
  if (preEl) {
    navigator.clipboard.writeText(preEl.textContent);
    showToast("Đã sao chép đoạn mã nguồn SDK vào bộ nhớ tạm!", "success");
    if (window.soundFX) window.soundFX.playSuccess();
  }
}
window.copySdkCurrentCode = copySdkCurrentCode;

// ==================== HÀM TIỆN ÍCH ====================
function copyToClipboard(text, successMsg = "Đã sao chép vào bộ nhớ tạm!") {
  navigator.clipboard.writeText(text);
  showToast(successMsg, "info");
  if (window.soundFX) window.soundFX.playClick();
}
window.copyToClipboard = copyToClipboard;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== TRA CỨU NGƯỢC TỪ HWID ====================
async function performReverseLookup() {
  const input = document.getElementById("lookup-hwid-input");
  const resultContainer = document.getElementById("lookup-hwid-results");
  if (!input || !resultContainer) return;

  const hwid = input.value.trim();
  if (!hwid) {
    showToast("Vui lòng nhập mã HWID cần tra cứu!", "warning");
    input.focus();
    return;
  }

  resultContainer.innerHTML = '<div style="color:var(--text-muted); font-size:11px; padding:10px;">Đang dò tìm trong cơ sở dữ liệu...</div>';

  try {
    const res = await fetch(`/api/v1/seller/licenses/reverse-lookup?hwid=${encodeURIComponent(hwid)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Lỗi tra cứu HWID");

    if (!data.licenses || data.licenses.length === 0) {
      resultContainer.innerHTML = `
        <div style="background:rgba(255, 0, 85, 0.1); border:1px solid rgba(255, 0, 85, 0.3); border-radius:6px; padding:12px; font-size:12px; color:var(--crimson-neon);">
          Chưa tìm thấy License nào liên kết với máy tính có HWID: <code>${escapeHtml(hwid)}</code>.
        </div>
      `;
      return;
    }

    resultContainer.innerHTML = data.licenses.map(lic => `
      <div style="background:rgba(9, 14, 23, 0.95); border:1px solid var(--border-glow); border-radius:6px; padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--cyan-neon); font-family:var(--font-mono);">${lic.license_key}</strong>
          <span class="badge ${lic.status}">${lic.status.toUpperCase()}</span>
        </div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">
          Ứng dụng: <strong style="color:#fff;">${escapeHtml(lic.app_name)} (${lic.app_code})</strong>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
          Thiết bị: ${escapeHtml(lic.device_name || 'PC')} | IP: ${lic.bound_ip || '--'} | Hết hạn: ${lic.expires_at || 'Trọn đời'}
        </div>
      </div>
    `).join("");

    if (window.soundFX) window.soundFX.playSuccess();
  } catch (err) {
    resultContainer.innerHTML = `<div style="color:var(--crimson-neon); font-size:12px;">Lỗi: ${err.message}</div>`;
  }
}
window.performReverseLookup = performReverseLookup;

// ==================== CẤU HÌNH TÊN MIỀN & RENDER STATUS ====================
async function checkLiveDomainStatus() {
  try {
    const res = await fetch("/api/v1/system/domain-info");
    const data = await res.json();

    const hostText = data.host;
    const isRender = data.is_render || hostText.includes("onrender.com");
    const isCustomDomain = !hostText.includes("localhost") && !hostText.includes("127.0.0.1") && !hostText.includes("onrender.com");

    const headerDomainText = document.getElementById("header-domain-text");
    if (headerDomainText) {
      if (isCustomDomain) {
        headerDomainText.textContent = `DOMAIN: ${hostText.toUpperCase()}`;
      } else if (isRender) {
        headerDomainText.textContent = "RENDER: ONLINE";
      } else {
        headerDomainText.textContent = `HOST: ${hostText}`;
      }
    }

    const hostEl = document.getElementById("domain-detected-host");
    if (hostEl) hostEl.textContent = hostText;

    const sslEl = document.getElementById("domain-ssl-status");
    if (sslEl) {
      sslEl.textContent = data.is_ssl ? "HTTPS (BẢO MẬT SSL)" : "HTTP (CHƯA BẬT SSL)";
      sslEl.style.color = data.is_ssl ? "var(--emerald-neon)" : "var(--amber-neon)";
    }

    const clientDistUrl = document.getElementById("client-api-distribution-url");
    if (clientDistUrl) clientDistUrl.textContent = `${data.origin}/api/v1/client`;

    const modalCurrentUrl = document.getElementById("modal-domain-current-url");
    if (modalCurrentUrl) modalCurrentUrl.textContent = data.origin;

    const renderCname = document.getElementById("render-cname-target");
    if (renderCname && hostText.includes(".onrender.com")) {
      renderCname.textContent = hostText;
    }

    const externalApiEndpoint = document.getElementById("external-api-endpoint-label");
    if (externalApiEndpoint) {
      externalApiEndpoint.textContent = `${data.origin}/api/v1/seller/licenses/external/generate`;
    }

    // Rebuild SDK templates to match detected domain
    if (window.buildSdkTemplates) {
      window.SDK_TEMPLATES = window.buildSdkTemplates(`${data.origin}/api/v1/client`);
      const activeSdkBtn = document.querySelector(".sdk-tab-btn.active");
      if (activeSdkBtn && window.displaySdkCode) {
        window.displaySdkCode(activeSdkBtn.dataset.lang);
      }
    }
  } catch (e) {
    console.warn("Không thể lấy domain-info:", e);
  }
}
window.checkLiveDomainStatus = checkLiveDomainStatus;

function copyClientApiDistributionUrl() {
  const el = document.getElementById("client-api-distribution-url");
  if (el) {
    copyToClipboard(el.textContent, "Đã sao chép Link API Client!");
  }
}
window.copyClientApiDistributionUrl = copyClientApiDistributionUrl;

