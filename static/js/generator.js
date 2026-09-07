/**
 * quocthaiAuth / CYBERAUTH - Module Bộ Sinh License Key (Tiếng Việt)
 * Quản lý lựa chọn khóa HWID (1/5/10/Unlimited), thời hạn (1/2/5/14/30/90 ngày/Lifetime), sinh hàng loạt và tải file .txt.
 */

let selectedHwidLimit = 1;
let selectedDurationDays = 30;

function initGeneratorModule() {
  // Lựa chọn nút HWID
  const hwidPills = document.querySelectorAll("#gen-hwid-pills .pill-option");
  hwidPills.forEach(pill => {
    pill.addEventListener("click", () => {
      hwidPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedHwidLimit = parseInt(pill.dataset.value, 10);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Lựa chọn nút Thời Hạn
  const durationPills = document.querySelectorAll("#gen-duration-pills .pill-option");
  durationPills.forEach(pill => {
    pill.addEventListener("click", () => {
      durationPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedDurationDays = parseInt(pill.dataset.value, 10);
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

  // Nút xác nhận tạo
  const submitBtn = document.getElementById("btn-submit-generate");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleGenerateKeys);
  }
}

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
window.copyAllGeneratedKeys = copyAllGeneratedKeys;
window.downloadKeysAsFile = downloadKeysAsFile;
