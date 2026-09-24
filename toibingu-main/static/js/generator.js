/**
 * quocthaiAuth / CYBERAUTH - Module Bộ Sinh License Key & Tạo Key Ngược Chiều (Tiếng Việt)
 * Quản lý:
 * - Bộ sinh key thuận chiều (Standard: Batch generate, HWID limit, Duration)
 * - Bộ sinh key ngược chiều (Reverse-Bound Key: Khóa cứng HWID trực tiếp ngay khi tạo)
 * - Tra cứu ngược từ mã phần cứng HWID
 */

let selectedHwidLimit = 1;
let selectedDurationDays = 30;
let selectedReverseDurationDays = 30;

function initGeneratorModule() {
  // Lựa chọn nút HWID (Thuận chiều)
  const hwidPills = document.querySelectorAll("#gen-hwid-pills .pill-option");
  hwidPills.forEach(pill => {
    pill.addEventListener("click", () => {
      hwidPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedHwidLimit = parseInt(pill.dataset.value, 10);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Lựa chọn nút Thời Hạn (Thuận chiều)
  const durationPills = document.querySelectorAll("#gen-duration-pills .pill-option");
  durationPills.forEach(pill => {
    pill.addEventListener("click", () => {
      durationPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedDurationDays = parseInt(pill.dataset.value, 10);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Lựa chọn nút Thời Hạn (Ngược chiều)
  const reverseDurationPills = document.querySelectorAll("#gen-rev-duration-pills .pill-option");
  reverseDurationPills.forEach(pill => {
    pill.addEventListener("click", () => {
      reverseDurationPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedReverseDurationDays = parseInt(pill.dataset.value, 10);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Đồng bộ thanh trượt số lượng
  const qtyInput = document.getElementById("gen-quantity");
  const qtyDisplay = document.getElementById("gen-quantity-val");
  if (qtyInput && qtyDisplay) {
    qtyInput.addEventListener("input", (e) => {
      qtyDisplay.textContent = e.target.value;
    });
  }

  // Nút xác nhận tạo thuận chiều
  const submitBtn = document.getElementById("btn-submit-generate");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleGenerateKeys);
  }

  // Nút xác nhận tạo ngược chiều
  const submitRevBtn = document.getElementById("btn-submit-generate-reverse");
  if (submitRevBtn) {
    submitRevBtn.addEventListener("click", handleGenerateReverseKey);
  }
}

// 1. TẠO KEY THUẬN CHIỀU (CHƯA KHÓA MÁY, ĐỢI KÍCH HOẠT)
async function handleGenerateKeys() {
  const appId = document.getElementById("gen-app-select").value;
  const prefix = document.getElementById("gen-prefix").value.trim() || "CYBER";
  const mask = document.getElementById("gen-mask").value.trim() || "XXXX-XXXX-XXXX";
  const quantity = parseInt(document.getElementById("gen-quantity").value, 10) || 1;
  const clientTag = document.getElementById("gen-client-tag").value.trim();
  const notes = document.getElementById("gen-notes").value.trim();

  if (!appId) {
    window.showToast("Vui lòng chọn Ứng Dụng / Tool cần tạo key!", "error");
    return;
  }

  const payload = {
    app_id: parseInt(appId, 10),
    hwid_limit: selectedHwidLimit,
    duration_days: selectedDurationDays,
    prefix: prefix,
    mask: mask,
    quantity: quantity,
    client_tag: clientTag,
    notes: notes
  };

  const btn = document.getElementById("btn-submit-generate");
  btn.disabled = true;
  btn.innerHTML = `<span>ĐANG SINH ${quantity} MÃ LICENSE...</span>`;

  try {
    const res = await fetch("/api/v1/seller/licenses/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Không thể sinh mã license");

    if (window.soundFX) window.soundFX.playSuccess();
    window.showToast(`Đã tạo thành công ${data.keys.length} mã bản quyền!`, "success");

    // Hiển thị modal kết quả
    displayGeneratedKeysModal(data.keys, data.app_name, selectedHwidLimit, selectedDurationDays);

    // Nạp lại danh sách
    if (window.loadLicenses) window.loadLicenses();
    if (window.loadDashboardStats) window.loadDashboardStats();

  } catch (err) {
    if (window.soundFX) window.soundFX.playDanger();
    window.showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg> 
      <span>XUẤT LICENSE BẢN QUYỀN</span>
    `;
  }
}

// 2. TẠO KEY NGƯỢC CHIỀU (KHÓA CỨNG HWID TRỰC TIẾP TẠI THỜI ĐIỂM TẠO)
async function handleGenerateReverseKey() {
  const appId = document.getElementById("gen-rev-app-select")?.value || document.getElementById("gen-app-select")?.value;
  const hwid = document.getElementById("gen-rev-hwid")?.value.trim();
  const deviceName = document.getElementById("gen-rev-device")?.value.trim() || "Máy Khách Hàng";
  const prefix = document.getElementById("gen-rev-prefix")?.value.trim() || "REV";
  const clientTag = document.getElementById("gen-rev-tag")?.value.trim() || "Khách Khóa HWID";
  const notes = document.getElementById("gen-rev-notes")?.value.trim() || "Tạo ngược chiều liên kết API";

  if (!hwid) {
    window.showToast("Vui lòng nhập Mã Hardware ID (HWID) máy của khách hàng!", "error");
    document.getElementById("gen-rev-hwid")?.focus();
    return;
  }

  if (!appId) {
    window.showToast("Vui lòng chọn Ứng Dụng / Tool cần liên kết!", "error");
    return;
  }

  const payload = {
    app_id: parseInt(appId, 10),
    hwid: hwid,
    device_name: deviceName,
    duration_days: selectedReverseDurationDays,
    prefix: prefix,
    mask: "XXXX-XXXX-XXXX",
    client_tag: clientTag,
    notes: notes
  };

  const btn = document.getElementById("btn-submit-generate-reverse");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>ĐANG KHÓA CỨNG VÀO HWID...</span>`;
  }

  try {
    const res = await fetch("/api/v1/seller/licenses/generate-reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Không thể tạo key ngược chiều");

    if (window.soundFX) window.soundFX.playSuccess();
    window.showToast("Đã tạo Key Ngược Chiều & khóa cứng HWID thành công!", "success");

    // Hiển thị modal kết quả tạo key ngược chiều
    displayReverseKeyResultModal(data);

    // Nạp lại danh sách
    if (window.loadLicenses) window.loadLicenses();
    if (window.loadDashboardStats) window.loadDashboardStats();

  } catch (err) {
    if (window.soundFX) window.soundFX.playDanger();
    window.showToast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span>⚡ XUẤT KEY NGƯỢC CHIỀU (ĐÃ KHÓA HWID)</span>
      `;
    }
  }
}

// Hiển thị Modal Kết Quả Key Ngược Chiều
function displayReverseKeyResultModal(data) {
  const modal = document.getElementById("modal-reverse-key-result");
  if (!modal) return;

  const keyEl = document.getElementById("rev-res-key");
  const hwidEl = document.getElementById("rev-res-hwid");
  const appEl = document.getElementById("rev-res-app");
  const durationEl = document.getElementById("rev-res-duration");
  const expiryEl = document.getElementById("rev-res-expiry");
  const sigEl = document.getElementById("rev-res-sig");
  const handoverArea = document.getElementById("rev-res-handover-text");

  if (keyEl) keyEl.textContent = data.license_key;
  if (hwidEl) hwidEl.textContent = data.hwid;
  if (appEl) appEl.textContent = `${data.app_name} (${data.app_code})`;
  if (durationEl) durationEl.textContent = data.duration_days === "Lifetime" ? "Trọn Đời" : `${data.duration_days} Ngày`;
  if (expiryEl) expiryEl.textContent = data.expires_at;
  if (sigEl) sigEl.textContent = data.signature;

  // Soạn sẵn tin nhắn bàn giao chuyên nghiệp cho khách hàng
  const handoverText = 
`🛡️ THÔNG TIN BẢN QUYỀN PHẦN MỀM - quocthaiAuth SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phần mềm: ${data.app_name} (${data.app_code})
Mã License Key: ${data.license_key}
Thiết bị khóa cứng (HWID): ${data.hwid}
Thời hạn sử dụng: ${data.duration_days === "Lifetime" ? "Trọn Đời" : data.duration_days + " Ngày"}
Hạn bản quyền: ${data.expires_at}
Trạng thái: ĐÃ KÍCH HOẠT (Chỉ chạy trên thiết bị đã đăng ký)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chúc bạn có trải nghiệm tuyệt vời khi sử dụng!`;

  if (handoverArea) handoverArea.value = handoverText;

  window.openModal("modal-reverse-key-result");
}

function copyReverseHandoverMessage() {
  const handoverArea = document.getElementById("rev-res-handover-text");
  if (handoverArea) {
    navigator.clipboard.writeText(handoverArea.value);
    window.showToast("Đã sao chép tin nhắn bàn giao khách hàng!", "success");
    if (window.soundFX) window.soundFX.playSuccess();
  }
}

// Dán HWID từ bộ nhớ tạm
async function pasteHwidFromClipboard(targetInputId = "gen-rev-hwid") {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById(targetInputId);
    if (input && text) {
      input.value = text.trim();
      window.showToast("Đã dán HWID từ bộ nhớ tạm!", "info");
      if (window.soundFX) window.soundFX.playClick();
    }
  } catch (e) {
    window.showToast("Vui lòng cấp quyền đọc bộ nhớ tạm hoặc tự dán (Ctrl+V)!", "warning");
  }
}

// Tạo mẫu HWID ngẫu nhiên để thử nghiệm nhanh
function generateSampleHwid(targetInputId = "gen-rev-hwid") {
  const hex = () => Math.random().toString(16).substring(2, 6).toUpperCase();
  const sample = `HWID-WIN11-BFEBFBFF${hex()}${hex()}-NVME-${hex()}`;
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = sample;
    window.showToast("Đã tạo mã HWID mẫu để thử nghiệm!", "info");
    if (window.soundFX) window.soundFX.playClick();
  }
}

function displayGeneratedKeysModal(keys, appName, hwidLimit, duration) {
  const modal = document.getElementById("modal-generated-keys");
  const listArea = document.getElementById("generated-keys-textarea");
  const infoLabel = document.getElementById("gen-result-info");

  const hwidLabel = hwidLimit === -1 ? "Vĩnh viễn (Không giới hạn)" : `${hwidLimit} Thiết bị`;
  const durLabel = duration === -1 ? "Trọn Đời" : `${duration} Ngày`;

  infoLabel.textContent = `Ứng Dụng: ${appName} | Khóa Phần Cứng: ${hwidLabel} | Thời Hạn: ${durLabel}`;
  listArea.value = keys.join("\n");

  window.openModal("modal-generated-keys");
}

function copyAllGeneratedKeys() {
  const textarea = document.getElementById("generated-keys-textarea");
  textarea.select();
  navigator.clipboard.writeText(textarea.value);
  window.showToast("Đã sao chép toàn bộ mã key vào bộ nhớ tạm!", "success");
  if (window.soundFX) window.soundFX.playClick();
}

function downloadKeysAsFile() {
  const textarea = document.getElementById("generated-keys-textarea");
  const text = textarea.value;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quocthaiAuth_licenses_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast("Đã tải xuống file .TXT thành công!", "info");
}

window.initGeneratorModule = initGeneratorModule;
window.handleGenerateReverseKey = handleGenerateReverseKey;
window.copyReverseHandoverMessage = copyReverseHandoverMessage;
window.pasteHwidFromClipboard = pasteHwidFromClipboard;
window.generateSampleHwid = generateSampleHwid;
window.copyAllGeneratedKeys = copyAllGeneratedKeys;
window.downloadKeysAsFile = downloadKeysAsFile;
