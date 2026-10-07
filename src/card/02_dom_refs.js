
  // 节点引用
  const triggerBtn = shadow.getElementById("rf-trigger-btn");
  const cardModal = shadow.getElementById("rf-card-modal");
  const btnBadge = shadow.getElementById("rf-btn-badge");
  const minimizeBtn = shadow.getElementById("rf-btn-minimize");
  const selectVersion = shadow.getElementById("rf-select-version");
  const toastEl = shadow.getElementById("rf-toast");
  const tabsNav = shadow.getElementById("rf-tabs-nav");
  const cardHeader = shadow.getElementById("rf-header");
  const opacityBtn = shadow.getElementById("rf-btn-opacity");
  const ghostBtn = shadow.getElementById("rf-btn-ghost");
  const resetPosBtn = shadow.getElementById("rf-btn-reset-pos");
  const ghostBadge = shadow.getElementById("rf-ghost-badge");
  const modeToggleBtn = shadow.getElementById("rf-btn-mode-toggle");
  const modeBtnFill = shadow.getElementById("rf-mode-btn-fill");
  const modeBtnEdit = shadow.getElementById("rf-mode-btn-edit");
  const hintText = shadow.getElementById("rf-hint-text");
  let isEditMode = false;

  // 网站弹出设置节点引用
  const btnSiteSetting = shadow.getElementById("rf-btn-site-setting");
  // 智能密码生成器节点引用
  const btnPasswordGen = shadow.getElementById("rf-btn-password-gen");
  const pwdMenu = shadow.getElementById("rf-pwd-menu");
  const pwdVal = shadow.getElementById("rf-pwd-val");
  const pwdDesc = shadow.getElementById("rf-pwd-desc");
  const pwdStrength = shadow.getElementById("rf-pwd-strength");
  const pwdStatus = shadow.getElementById("rf-pwd-status");
  const pwdRuleInput = shadow.getElementById("rf-pwd-rule-input");
  const pwdToggleEye = shadow.getElementById("rf-pwd-toggle-eye");

  const siteMenu = shadow.getElementById("rf-site-menu");
  const siteDomainText = shadow.getElementById("rf-site-domain-text");
  const siteStatusBadge = shadow.getElementById("rf-site-status-badge");
  const optSiteAuto = shadow.getElementById("rf-opt-site-auto");
  const optSiteAlways = shadow.getElementById("rf-opt-site-always");
  const optSiteNever = shadow.getElementById("rf-opt-site-never");

  // 跟随智能气泡节点
  const inlinePill = shadow.getElementById("rf-inline-pill");
  const pillTag = shadow.getElementById("rf-pill-tag");
  const pillVal = shadow.getElementById("rf-pill-val");
  const pillFillBtn = shadow.getElementById("rf-pill-fill-btn");
  const pillCopyBtn = shadow.getElementById("rf-pill-copy-btn");
  const pillRefineBtn = shadow.getElementById("rf-pill-refine-btn");
  const pillAiStatus = shadow.getElementById("rf-pill-ai-status");
  const pillAiIcon = shadow.getElementById("rf-pill-ai-icon");
  const pillSuggestions = shadow.getElementById("rf-pill-suggestions");
  const pillExpandCardBtn = shadow.getElementById("rf-pill-expand-card-btn");
  const pillCloseBtn = shadow.getElementById("rf-pill-close-btn");

  let currentTargetInput = null;
  let currentDetectedField = null;

  // ==================== 工具函数 ====================

  let toastTimer = null;
  function showToast(msg, type = "info") {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove("rf-toast-error", "rf-toast-success");
    if (type === "error") toastEl.classList.add("rf-toast-error");
    if (type === "success") toastEl.classList.add("rf-toast-success");
    toastEl.classList.add("rf-show");
    clearTimeout(toastTimer);
    const duration = type === "error" ? 4500 : (type === "success" ? 2500 : 2000);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("rf-show");
    }, duration);
  }

  // 递归合并默认结构
  function mergeWithDefault(obj, defaults) {
    if (obj === null || typeof obj !== "object") return defaults;
    const result = Array.isArray(obj) ? [] : {};
    for (let key in defaults) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          result[key] = mergeWithDefault(obj[key], defaults[key]);
        } else {
          result[key] = obj[key];
        }
      } else {
        result[key] = JSON.parse(JSON.stringify(defaults[key]));
      }
    }
    for (let key in obj) {
      if (!result.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  // 根据 ref 获取值
  function getValueByRef(ref) {
    if (!ref) return "";
    const parts = ref.split(".");
    if (parts.length === 1) {
      if (ref === "skills") return resumeData.skills || "";
      if (ref === "languages") return resumeData.languages || "";
      return "";
    }
    if (parts.length === 2 && parts[0] === "basic") {
      return resumeData.basic[parts[1]] || "";
    }
    if (parts.length === 3) {
      const section = parts[0];
      const index = parseInt(parts[1], 10);
      const field = parts[2];
      if (resumeData[section] && resumeData[section][index]) {
        return resumeData[section][index][field] || "";
      }
    }
    return "";
  }
