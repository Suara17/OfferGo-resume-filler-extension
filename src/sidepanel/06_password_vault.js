// ==================== 求职站点账号密码备忘录 (Password Vault) ====================
let sidepanelSavedPasswords = [];

async function loadSidepanelSavedPasswords() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("rf_saved_passwords", (result) => {
        sidepanelSavedPasswords = Array.isArray(result?.rf_saved_passwords) ? result.rf_saved_passwords : [];
        resolve(sidepanelSavedPasswords);
      });
    } else {
      try {
        sidepanelSavedPasswords = JSON.parse(localStorage.getItem("rf_saved_passwords") || "[]");
      } catch (_) {
        sidepanelSavedPasswords = [];
      }
      resolve(sidepanelSavedPasswords);
    }
  });
}

async function saveSidepanelSavedPasswords(list) {
  sidepanelSavedPasswords = list;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ rf_saved_passwords: list });
  } else {
    localStorage.setItem("rf_saved_passwords", JSON.stringify(list));
  }
  renderSidepanelPasswordVault();
}

async function renderSidepanelPasswordVault(filterQuery = "") {
  await loadSidepanelSavedPasswords();
  const countEl = document.getElementById("sidepanel-vault-count");
  if (countEl) countEl.textContent = `${sidepanelSavedPasswords.length} 个站点`;

  const container = document.getElementById("sidepanel-vault-list");
  if (!container) return;

  const query = (filterQuery || "").toLowerCase().trim();
  const filtered = sidepanelSavedPasswords.filter((p) => {
    if (!query) return true;
    return (p.siteName || "").toLowerCase().includes(query) ||
           (p.domain || "").toLowerCase().includes(query) ||
           (p.account || "").toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 16px 10px; font-size: 11.5px; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 8px;">暂无已保存的求职站点密码（可在悬浮卡片 🔑 密码生成器中为网申站点一键保存）。</div>`;
    return;
  }

  container.innerHTML = filtered.map((item) => {
    return `
      <div class="card" style="padding: 10px; border: 1px solid #e2e8f0; box-shadow: none; margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 12px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">🌐 ${escapeHtml(item.siteName || item.domain)}</strong>
          <span style="font-size: 10.5px; color: #64748b;">${escapeHtml(item.domain)}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #f1f5f9; margin-bottom: 8px;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="color: #475569;">账号: <b style="color: #0f172a;">${escapeHtml(item.account || '未填写')}</b></span>
            <span style="color: #64748b; font-size: 10px;">更新: ${escapeHtml(item.updatedAt || '未知')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="sidepanel-pwd-val" data-id="${item.id}" style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: #4338ca;">••••••••</span>
            <button type="button" class="btn-toggle-sidepanel-pwd" data-id="${item.id}" style="background: none; border: none; cursor: pointer; font-size: 12px; padding: 0 2px;">👁️</button>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn btn-secondary btn-sm btn-copy-sp-acc" data-account="${escapeHtml(item.account || '')}" style="flex: 1; font-size: 11px;">📋 复制账号</button>
          <button type="button" class="btn btn-secondary btn-sm btn-copy-sp-pwd" data-id="${item.id}" style="flex: 1; font-size: 11px;">🔑 复制密码</button>
          <button type="button" class="btn btn-danger btn-sm btn-del-sp-pwd" data-id="${item.id}" style="padding: 4px 8px; font-size: 11px;" title="删除此记录">🗑️</button>
        </div>
      </div>
    `;
  }).join("");

  // 绑定事件
  container.querySelectorAll(".btn-toggle-sidepanel-pwd").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const target = sidepanelSavedPasswords.find((p) => p.id === id);
      const span = container.querySelector(`.sidepanel-pwd-val[data-id="${id}"]`);
      if (target && span) {
        const isMasked = span.textContent.includes("•");
        span.textContent = isMasked ? target.password : "••••••••";
        btn.textContent = isMasked ? "🙈" : "👁️";
      }
    });
  });

  container.querySelectorAll(".btn-copy-sp-acc").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const acc = btn.getAttribute("data-account");
      if (!acc) {
        showToast("该站点未记录账号");
        return;
      }
      await navigator.clipboard.writeText(acc);
      showToast(`已复制账号：${acc}`);
    });
  });

  container.querySelectorAll(".btn-copy-sp-pwd").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const target = sidepanelSavedPasswords.find((p) => p.id === id);
      if (target && target.password) {
        await navigator.clipboard.writeText(target.password);
        showToast(`已复制「${target.siteName || target.domain}」密码`);
      }
    });
  });

  container.querySelectorAll(".btn-del-sp-pwd").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const target = sidepanelSavedPasswords.find((p) => p.id === id);
      if (target && confirm(`确定删除「${target.siteName || target.domain}」的密码备忘吗？`)) {
        const next = sidepanelSavedPasswords.filter((p) => p.id !== id);
        await saveSidepanelSavedPasswords(next);
        showToast("已删除对应密码备忘");
      }
    });
  });
}

function initSidepanelPasswordVaultEvents() {
  const searchInput = document.getElementById("sidepanel-vault-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderSidepanelPasswordVault(e.target.value);
    });
  }

  const exportBtn = document.getElementById("btn-export-passwords");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (sidepanelSavedPasswords.length === 0) {
        showToast("暂无可导出的密码记录");
        return;
      }
      const blob = new Blob([JSON.stringify(sidepanelSavedPasswords, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offergo_passwords_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("已导出全部求职站点密码备份");
    });
  }

  const importBtn = document.getElementById("btn-import-passwords");
  const fileInput = document.getElementById("sidepanel-pwd-file-input");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            const map = new Map();
            sidepanelSavedPasswords.forEach((p) => map.set(p.domain, p));
            parsed.forEach((p) => {
              if (p && p.domain && p.password) map.set(p.domain, p);
            });
            const merged = Array.from(map.values());
            await saveSidepanelSavedPasswords(merged);
            showToast(`成功导入 ${parsed.length} 条站点密码！`);
          } else {
            showToast("导入失败：文件格式不符合规范");
          }
        } catch (_) {
          showToast("导入失败：JSON 文件解析错误");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // 监听 Storage 变更（当在悬浮面板保存了新密码时，侧边栏自动同步）
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.rf_saved_passwords) {
        renderSidepanelPasswordVault();
      }
    });
  }
}
