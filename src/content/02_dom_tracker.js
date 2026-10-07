// 缓存最后一个聚焦的输入元素及其稳定特征 (防止 React/Vue 在 blur 时重新 render 导致 DOM 脱离失效)
let lastActiveElement = null;
let lastActiveElementFingerprint = null;

function isHostElement(el) {
  if (!el) return false;
  if (el.id === "resume-filler-extension-host") return true;
  if (el.closest && el.closest("#resume-filler-extension-host")) return true;
  const root = el.getRootNode ? el.getRootNode() : null;
  if (root && root.host && root.host.id === "resume-filler-extension-host") return true;
  return false;
}

function updateActiveElement(target) {
  if (!target || isHostElement(target)) return;

  let el = target;
  // 如果点击的是输入框的外层包裹容器（如 .ant-input-affix-wrapper 等），向下探测真正可填充的输入元素
  if (!isEditableElement(el) && el.querySelector) {
    const candidate = el.querySelector("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select, [contenteditable='true'], [role='combobox']");
    if (candidate && isEditableElement(candidate)) {
      el = candidate;
    }
  }

  if (isEditableElement(el)) {
    lastActiveElement = el;
    lastActiveElementFingerprint = {
      id: el.id || "",
      name: el.name || "",
      placeholder: el.placeholder || "",
      fid: (typeof getElementStableFingerprint === "function" ? getElementStableFingerprint(el) : "") || el.getAttribute("data-rf-fid") || "",
      tagName: el.tagName || ""
    };
  }
}

// 监听页面的聚焦 (focus/focusin) 和点击/指针 (click/mousedown) 事件，无死角记录用户当前选中的输入框
document.addEventListener("focus", (e) => updateActiveElement(e.target), true);
document.addEventListener("focusin", (e) => updateActiveElement(e.target), true);
document.addEventListener("click", (e) => updateActiveElement(e.target), true);
document.addEventListener("mousedown", (e) => updateActiveElement(e.target), true);

function getValidActiveElement() {
  // 1. 如果 lastActiveElement 仍正常挂载在当前 DOM 树中，直接返回
  if (lastActiveElement && document.contains(lastActiveElement)) {
    return lastActiveElement;
  }

  // 2. 如果当前页面正在聚焦的 document.activeElement 是可编辑元素，直接采用
  const act = document.activeElement;
  if (act && !isHostElement(act) && isEditableElement(act)) {
    lastActiveElement = act;
    return act;
  }

  // 3. 如果 lastActiveElement 经历了 React/Vue 的 blur 重建（脱离了 DOM 树），尝试通过特征重新在当前页面找回对应节点
  if (lastActiveElementFingerprint) {
    const fp = lastActiveElementFingerprint;
    let recovered = null;
    try {
      if (fp.fid && window.CSS && CSS.escape) recovered = document.querySelector(`[data-rf-fid="${CSS.escape(fp.fid)}"]`);
      if (!recovered && fp.id) recovered = document.getElementById(fp.id);
      if (!recovered && fp.name && window.CSS && CSS.escape) recovered = document.querySelector(`[name="${CSS.escape(fp.name)}"]`);
      if (!recovered && fp.placeholder && window.CSS && CSS.escape) recovered = document.querySelector(`[placeholder="${CSS.escape(fp.placeholder)}"]`);
    } catch (_) {}
    if (recovered && isEditableElement(recovered)) {
      lastActiveElement = recovered;
      return recovered;
    }
  }

  return null;
}

// 判断是否是可编辑/可填充的表单元素 (支持常规输入框、下拉框、文件上传框以及大厂富文本 contenteditable 编辑器)
function isEditableElement(el) {
  if (!el) return false;
  // 排除悬浮窗内部的元素，防止点击悬浮卡片时抢走页面真实的输入框焦点
  if (isHostElement(el)) return false;
  // 排除页面顶部的职位检索搜索框，以及单选/复选控件的内部文本 input。
  const ph = (el.placeholder || "").toLowerCase();
  if (/输入职位关键字|搜索职位|搜索岗位|search\s*job/i.test(ph)) return false;
  const tagName = el.tagName;
  if (tagName === "INPUT" && ["radio", "checkbox"].includes(el.type)) return false;
  if (tagName === "INPUT" && el.closest("[role='radio'], [role='checkbox'], [class*='radio' i], [class*='checkbox' i], [role='option'], [class*='option' i]")) return false;

  const isInput = tagName === "INPUT" && !["button", "submit", "reset", "radio", "checkbox", "image"].includes(el.type);
  const isTextarea = tagName === "TEXTAREA";
  const isSelect = tagName === "SELECT";
  const isContentEditable = el.isContentEditable || el.getAttribute("contenteditable") === "true";
  const isPhoenixRoot = typeof isPhoenixSelectRoot === "function" && isPhoenixSelectRoot(el);
  return isInput || isTextarea || isSelect || isContentEditable || isPhoenixRoot;
}

function getFillableControls(root = document) {
  const native = Array.from(root.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='combobox']"));
  const profileRoots = getAtsProfile().controlRoots || [];
  const specializedRoots = profileRoots.length ? Array.from(root.querySelectorAll(profileRoots.join(","))) : [];
  const phoenixRoots = Array.from(root.querySelectorAll(PHOENIX_SELECT_ROOT));
  return [...new Set([...native, ...phoenixRoots, ...specializedRoots])].filter(el => {
    if (isPhoenixSelectChild(el)) return false;
    return isEditableElement(el);
  });
}

// 注入视觉高亮标记样式 (绿框: 成功填入, 橙框: 建议人工核对, 蓝紫虚框: 拖拽释放目标, 浮层摘要)
function injectMarkStyles() {
  if (document.getElementById("rf-mark-styles")) return;
  const style = document.createElement("style");
  style.id = "rf-mark-styles";
  style.textContent = `
    [data-rf-mark="filled"] {
      outline: 2px solid #10b981 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    [data-rf-mark="uncertain"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.25) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    [data-rf-drop-target="true"] {
      outline: 2px dashed #4f46e5 !important;
      outline-offset: 2px !important;
      background-color: rgba(238, 242, 255, 0.88) !important;
      transition: outline 0.15s ease, background-color 0.15s ease !important;
    }
    #rf-summary-badge {
      position: fixed;
      bottom: 24px;
      right: 175px;
      z-index: 2147483640;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 320px;
      user-select: none;
      animation: rfSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes rfSlideUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rf-sum-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-weight: 700;
      font-size: 12px;
    }
    .rf-sum-close {
      cursor: pointer;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1;
    }
    .rf-sum-close:hover { color: #ffffff; }
    .rf-sum-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
    }
    .rf-sum-green { color: #34d399; font-weight: 600; }
    .rf-sum-orange { color: #fbbf24; font-weight: 600; }
    .rf-sum-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 110px;
      overflow-y: auto;
      margin-top: 2px;
      padding-right: 4px;
    }
    .rf-sum-items::-webkit-scrollbar { width: 3px; }
    .rf-sum-items::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .rf-sum-item {
      color: #cbd5e1;
      font-size: 11px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.12s ease, color 0.12s ease;
    }
    .rf-sum-item:hover {
      background: rgba(255,255,255,0.12);
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);
}

// 标记元素已填充或待确认
function markElement(element, status, title) {
  if (!element || !element.setAttribute) return;
  injectMarkStyles();
  element.setAttribute("data-rf-mark", status);
  if (title) element.setAttribute("data-rf-title", title);
}

// 清除页面所有高亮标记
function clearMarks() {
  document.querySelectorAll("[data-rf-mark]").forEach(el => {
    el.removeAttribute("data-rf-mark");
    el.removeAttribute("data-rf-title");
  });
  const badge = document.getElementById("rf-summary-badge");
  if (badge) badge.remove();
 }

// ==================== 拖拽即填 (Drag & Drop) 全局监听 ====================
let currentDropTarget = null;
function setDropTarget(el) {
  if (currentDropTarget !== el) {
    if (currentDropTarget) currentDropTarget.removeAttribute("data-rf-drop-target");
    currentDropTarget = el;
    if (currentDropTarget) {
      injectMarkStyles();
      currentDropTarget.setAttribute("data-rf-drop-target", "true");
    }
  }
}

document.addEventListener("dragover", (e) => {
  const types = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
  if (!types.includes("application/x-resume-field") && !types.includes("text/plain")) return;
  const target = e.target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']");
  if (target && isEditableElement(target)) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setDropTarget(target);
  } else {
    setDropTarget(null);
  }
}, true);

document.addEventListener("dragleave", (e) => {
  if (currentDropTarget && !currentDropTarget.contains(e.relatedTarget)) {
    setDropTarget(null);
  }
}, true);

document.addEventListener("drop", (e) => {
  const target = currentDropTarget || e.target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']");
  setDropTarget(null);
  if (!target || !isEditableElement(target)) return;

  let val = "";
  try {
    const json = e.dataTransfer.getData("application/x-resume-field");
    if (json) {
      const obj = JSON.parse(json);
      val = obj.value || "";
    }
  } catch (err) {}
  if (!val) {
    val = e.dataTransfer.getData("text/plain") || "";
  }

  if (val) {
    e.preventDefault();
    e.stopPropagation();
    setElementValue(target, val);
  }
}, true);

document.addEventListener("dragend", () => {
  setDropTarget(null);
}, true);
// 渲染智能填充结果悬浮徽章小清单
function showAutofillSummaryBadge(filledCount, uncertainList) {
  injectMarkStyles();
  let badge = document.getElementById("rf-summary-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "rf-summary-badge";
    document.body.appendChild(badge);
  }

  const hasUncertain = uncertainList && uncertainList.length > 0;
  badge.innerHTML = `
    <div class="rf-sum-header">
      <span>🎯 智能填充报告</span>
      <button class="rf-sum-close" id="rf-close-summary-badge" title="关闭并清除高亮标记">✕</button>
    </div>
    <div class="rf-sum-stats">
      <span class="rf-sum-green">🟢 已自动填入 ${filledCount} 项</span>
      ${hasUncertain ? `<span class="rf-sum-orange">🟠 建议核对 ${uncertainList.length} 项</span>` : ''}
    </div>
    ${hasUncertain ? `
      <div class="rf-sum-items">
        ${uncertainList.slice(0, 6).map((u, i) => `
          <div class="rf-sum-item" data-uncertain-idx="${i}" title="点击定位到该输入框">
            <span>👉</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.label}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  badge.querySelector("#rf-close-summary-badge")?.addEventListener("click", () => {
    clearMarks();
  });

  if (hasUncertain) {
    badge.querySelectorAll(".rf-sum-item").forEach(itemEl => {
      itemEl.addEventListener("click", () => {
        const idx = parseInt(itemEl.getAttribute("data-uncertain-idx"), 10);
        const target = uncertainList[idx]?.element;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus();
          // 闪烁高亮提示
          target.classList.add("rf-fill-pulse");
          setTimeout(() => target.classList.remove("rf-fill-pulse"), 800);
        }
      });
    });
  }

  // 15 秒后自动平滑淡出徽章 (保留输入框边框颜色)
  setTimeout(() => {
    if (badge && badge.parentNode) {
      badge.style.transition = "opacity 0.5s ease";
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 500);
    }
  }, 15000);
}
