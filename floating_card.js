/**
 * 简历自动填充助手 - 页面悬浮卡片 (Floating Card Widget)
 * 基于 Shadow DOM 隔离页面样式，支持折叠悬浮球、展开多Tab卡片、单项/整段/整页填充、复制及实时数据双向同步。
 */

(function () {
  // 避免在非正常页面或重复注入
  if (window !== window.top && !window.location.href.startsWith("http")) return;
  if (document.getElementById("resume-filler-extension-host")) return;

  // 默认数据结构
  const defaultResumeData = {
    basic: {
      name: "",
      gender: "",
      ethnicity: "",
      birth: "",
      height: "",
      weight: "",
      phone: "",
      email: "",
      political: "",
      city: "",
      nativePlace: "",
      website: "",
      github: "",
      emergencyContact: "",
      emergencyRelation: "",
      emergencyPhone: "",
      jobIntent: "",
      selfEval: "",
      selfDescription: "",
      highestDegree: "",
      country: "",
      acceptRelocation: "",
      extraInfo: "",
      idCard: "",
      wechat: "",
      residence: ""
    },
    education: [],
    internship: [],
    project: [],
    competition: [],
    paper: [],
    skills: "",
    languages: "",
    honors: [],
    family: []
  };

  let resumeData = JSON.parse(JSON.stringify(defaultResumeData));
  let resumesList = [];
  let activeResumeId = "default";
  let isCardCollapsed = localStorage.getItem("rf_card_collapsed") !== "false"; // 默认折叠为悬浮小球
  let isRecruitmentPage = false; // 当前页面是否属于网申/招聘表单
  let isPillEnabled = false; // 是否自动弹出输入框智能气泡
  let isBlacklisted = false; // 是否被黑名单彻底隐藏

  // 获取当前网站主机名
  const currentHostname = window.location.hostname || "local";

  // 检查当前页面是否属于网申/招聘相关页面或用户配置的允许域名
  async function checkPageActivation() {
    // 1. 本地测试页面始终启用气泡与小球
    if (window.location.protocol === "file:" || window.location.href.includes("test_page.html")) {
      return { isRecruitment: true, pillEnabled: true, isBlacklisted: false };
    }

    try {
      // 2. 从本地存储读取用户自定义的黑白名单
      const storageData = await new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], resolve);
        } else {
          resolve({
            rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
            rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
          });
        }
      });

      const whitelist = storageData.rf_whitelist_domains || [];
      const blacklist = storageData.rf_blacklist_domains || [];

      // 用户黑名单优先：彻底隐藏小球与气泡
      if (blacklist.some(domain => currentHostname === domain || currentHostname.endsWith("." + domain))) {
        return { isRecruitment: false, pillEnabled: false, isBlacklisted: true };
      }

      // 用户白名单：始终弹气泡与小球
      if (whitelist.some(domain => currentHostname === domain || currentHostname.endsWith("." + domain))) {
        return { isRecruitment: true, pillEnabled: true, isBlacklisted: false };
      }

      // 3. 智能检测网申与招聘系统特征 (Smart Detection)
      const href = window.location.href.toLowerCase();
      const recruitmentKeywords = [
        "zhaopin", "liepin", "51job", "lagou", "zhipin", "boss",
        "moka", "mokahr", "beisen", "italent", "nowcoder", "niuke",
        "job", "jobs", "career", "careers", "campus", "hire", "hiring",
        "recruit", "recruitment", "apply", "applicant", "resume", "cv",
        "ats", "candidate", "jobhub", "dajie", "shixiseng", "xiaoyuan"
      ];

      // URL 关键词命中
      const urlMatched = recruitmentKeywords.some(kw => href.includes(kw));
      if (urlMatched) {
        return { isRecruitment: true, pillEnabled: true, isBlacklisted: false };
      }

      // 页面 DOM 内容特征命中 (页面包含多个网申/简历关键短语)
      const pageText = (document.body ? document.body.innerText || "" : "").slice(0, 15000);
      const domKeywords = [
        "基本信息", "求职意向", "教育背景", "教育经历", "工作经历",
        "工作经验", "实习经历", "实习经验", "项目经历", "项目经验",
        "个人信息", "简历信息", "最高学历", "毕业院校", "期望薪资",
        "期望工作地", "专业技能", "自我评价", "紧急联系人"
      ];
      let matchCount = 0;
      for (const kw of domKeywords) {
        if (pageText.includes(kw)) {
          matchCount++;
          if (matchCount >= 2) break; // 只要命中2个以上即视为招聘网申页面
        }
      }

      if (matchCount >= 2) {
        return { isRecruitment: true, pillEnabled: true, isBlacklisted: false };
      }

      // 普通非网申页面：小球正常驻留可点击（方便随时唤起），但不自动弹出气泡干扰日常打字
      return { isRecruitment: false, pillEnabled: false, isBlacklisted: false };
    } catch (e) {
      return { isRecruitment: false, pillEnabled: false, isBlacklisted: false };
    }
  }

  // 创建宿主节点
  const host = document.createElement("div");
  host.id = "resume-filler-extension-host";
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0; pointer-events: none;";
  document.documentElement.appendChild(host);

  // 创建 Shadow Root
  const shadow = host.attachShadow({ mode: "open" });

  // 注入样式
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    :host {
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #eef2ff;
      --primary-border: #c7d2fe;
      --bg-card: #ffffff;
      --bg-header: #f8fafc;
      --bg-hover: #f1f5f9;
      --border-color: #e2e8f0;
      --text-main: #1e293b;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #10b981;
      --success-light: #ecfdf5;
      --shadow-lg: 0 10px 30px rgba(15, 23, 42, 0.18), 0 4px 10px rgba(15, 23, 42, 0.08);
      --shadow-btn: 0 4px 14px rgba(79, 70, 229, 0.35);
      --radius-lg: 14px;
      --radius-md: 8px;
      --radius-sm: 6px;
    }

    /* 1. 输入框焦点跟随智能气泡 */
    .rf-inline-pill {
      pointer-events: auto;
      position: fixed;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px 5px 12px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28), 0 2px 6px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 12px;
      user-select: none;
      transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: bottom left;
      max-width: calc(100vw - 40px);
    }
    .rf-inline-pill.rf-pill-hidden {
      opacity: 0;
      transform: translateY(6px) scale(0.92);
      pointer-events: none !important;
    }
    .rf-pill-body {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rf-pill-tag {
      color: #818cf8;
      font-weight: 700;
      font-size: 11.5px;
    }
    .rf-pill-val {
      color: #f8fafc;
      font-weight: 500;
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @keyframes rfPillAiGlow {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7), 0 8px 24px rgba(15, 23, 42, 0.28); }
      50% { box-shadow: 0 0 0 7px rgba(99, 102, 241, 0.15), 0 8px 24px rgba(15, 23, 42, 0.28); }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0), 0 8px 24px rgba(15, 23, 42, 0.28); }
    }
    .rf-pill-ai-glow {
      animation: rfPillAiGlow 1.2s ease-out;
    }
    .rf-pill-fill-btn {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      border: none;
      border-radius: 14px;
      padding: 3px 10px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.12s ease;
      white-space: nowrap;
    }
    .rf-pill-fill-btn:hover {
      background: linear-gradient(135deg, #4338ca, #4f46e5);
      transform: scale(1.04);
    }
    .rf-pill-fill-btn:active {
      transform: scale(0.96);
    }
    .rf-pill-copy-btn {
      background: rgba(255, 255, 255, 0.12);
      color: #e2e8f0;
      border: none;
      border-radius: 14px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .rf-pill-copy-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }
    .rf-pill-ai-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 10px;
      white-space: nowrap;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .rf-pill-ai-status.loading {
      color: #c7d2fe;
      background: rgba(99, 102, 241, 0.25);
      border: 1px solid rgba(199, 210, 254, 0.3);
    }
    .rf-pill-ai-status.success {
      color: #86efac;
      background: rgba(16, 185, 129, 0.25);
      border: 1px solid rgba(134, 239, 172, 0.3);
    }
    .rf-pill-ai-status.error {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.25);
      border: 1px solid rgba(252, 165, 165, 0.3);
    }
    .rf-pill-suggestions {
      display: flex;
      align-items: center;
      gap: 4px;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      padding-left: 6px;
      margin-left: 2px;
    }
    .rf-pill-sug-item {
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10.5px;
      cursor: pointer;
      transition: all 0.12s ease;
      white-space: nowrap;
    }
    .rf-pill-sug-item:hover {
      background: #4f46e5;
      color: #ffffff;
    }
    .rf-pill-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      cursor: pointer;
      padding: 0 3px;
      line-height: 1;
    }
    .rf-pill-close-btn:hover {
      color: #ffffff;
    }

    /* 悬浮球 (折叠状态) */
    .rf-floating-btn {
      pointer-events: auto;
      position: fixed;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      border-radius: 30px;
      cursor: pointer;
      box-shadow: var(--shadow-btn);
      border: 1px solid rgba(255, 255, 255, 0.3);
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s ease;
      z-index: 2147483647;
    }
    .rf-floating-btn:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
    }
    .rf-floating-btn:active {
      transform: scale(0.97);
    }
    .rf-floating-btn.rf-hidden {
      display: none !important;
    }
    .rf-btn-badge {
      background: rgba(255, 255, 255, 0.25);
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: normal;
      max-width: 90px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 悬浮卡片主体 (展开状态) */
    .rf-card-modal {
      pointer-events: auto;
      position: fixed;
      width: 410px;
      max-height: calc(100vh - 60px);
      height: 620px;
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483647;
      transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
    }
    .rf-card-modal.rf-hidden {
      opacity: 0;
      transform: scale(0.3) translateY(20px);
      pointer-events: none !important;
    }
    /* 幽灵鼠标穿透模式 */
    .rf-card-modal.rf-ghost-mode {
      pointer-events: none !important;
      opacity: 0.45 !important;
      border: 2px dashed var(--primary) !important;
      box-shadow: 0 0 20px rgba(79, 70, 229, 0.45) !important;
      backdrop-filter: blur(8px) !important;
    }
    /* 穿透模式下的退出胶囊 (始终响应鼠标点击) */
    .rf-ghost-badge {
      pointer-events: auto !important;
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #ffffff;
      padding: 7px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.35);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
      animation: rfPulse 2s infinite ease-in-out;
    }
    .rf-ghost-badge:hover {
      transform: scale(1.05);
    }
    .rf-ghost-badge.rf-hidden {
      display: none !important;
    }
    @keyframes rfPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.5); }
      50% { box-shadow: 0 0 0 8px rgba(79, 70, 229, 0); }
    }

    /* 顶部标题栏 */
    .rf-header {
      background: var(--bg-header);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }
    .rf-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    .rf-logo-title {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--text-main);
      cursor: pointer;
      user-select: none;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .rf-logo-title:hover {
      background: #e0e7ff;
      color: var(--primary);
    }
    .rf-header-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rf-icon-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      color: var(--text-secondary);
      transition: all 0.15s ease;
    }
    .rf-icon-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-color);
      color: var(--text-main);
    }
    .rf-icon-btn.rf-btn-close:hover {
      background: #fee2e2;
      color: var(--danger);
      border-color: #fca5a5;
    }

    /* 快捷操作栏 */
    .rf-action-bar {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rf-select-version {
      flex: 1;
      height: 28px;
      font-size: 11.5px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      padding: 0 8px;
      color: var(--text-main);
      background: #ffffff;
      outline: none;
      cursor: pointer;
    }
    .rf-select-version:focus {
      border-color: var(--primary);
    }

    .rf-btn-smart-fill {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      border: none;
      border-radius: var(--radius-sm);
      padding: 0 12px;
      height: 28px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .rf-btn-smart-fill:hover {
      background: linear-gradient(135deg, #4338ca, #4f46e5);
      transform: translateY(-1px);
    }
    .rf-btn-smart-fill:active {
      transform: translateY(0);
    }

    /* Tabs 导航 */
    .rf-tabs-nav {
      display: flex;
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;
      scrollbar-width: none;
      flex-shrink: 0;
      padding: 0 6px;
    }
    .rf-tabs-nav::-webkit-scrollbar {
      display: none;
    }
    .rf-tab-item {
      padding: 9px 11px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .rf-tab-item:hover {
      color: var(--text-main);
    }
    .rf-tab-item.active {
      color: var(--primary);
      font-weight: 600;
      border-bottom-color: var(--primary);
    }

    /* 快捷交互提示条与模式切换胶囊 */
    .rf-quick-hint {
      padding: 6px 10px;
      background: #f1f5f9;
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .rf-hint-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      color: var(--primary);
      font-weight: 600;
    }

    /* 模式切换小药丸 */
    .rf-mode-switch {
      display: inline-flex;
      background: #e2e8f0;
      border-radius: 12px;
      padding: 1px;
      gap: 1px;
      user-select: none;
      flex-shrink: 0;
    }
    .rf-mode-btn {
      padding: 2px 7px;
      font-size: 10.5px;
      font-weight: 600;
      border-radius: 11px;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.15s ease;
    }
    .rf-mode-btn:hover {
      color: var(--text-main);
    }
    .rf-mode-btn.active {
      background: #ffffff;
      color: var(--primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .rf-mode-btn[data-mode="edit"].active {
      color: #d97706;
    }

    /* 编辑修改模式激活时的整卡视觉感知 */
    .rf-card-modal.rf-mode-edit-active {
      border: 1.5px solid #f59e0b !important;
      box-shadow: 0 10px 30px rgba(245, 158, 11, 0.22), 0 4px 10px rgba(0, 0, 0, 0.08) !important;
    }
    .rf-card-modal.rf-mode-edit-active .rf-quick-hint {
      background: #fef3c7 !important;
      color: #92400e !important;
    }
    .rf-card-modal.rf-mode-edit-active .rf-form-control {
      background: #fffbeb !important;
      border-color: #fde68a !important;
    }
    .rf-card-modal.rf-mode-edit-active .rf-form-control:focus {
      border-color: #f59e0b !important;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25) !important;
    }

    /* 卡片内容滚动区 */
    .rf-card-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
      background: #fbfcfe;
    }
    .rf-card-body::-webkit-scrollbar {
      width: 5px;
    }
    .rf-card-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .rf-tab-panel {
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .rf-tab-panel.active {
      display: flex;
    }

    /* 表单组件: 单击标签复制，单击输入框填入 */
    .rf-form-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
      position: relative;
    }
    .rf-form-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: fit-content;
      padding: 2px 5px;
      border-radius: 4px;
      user-select: none;
      transition: all 0.15s ease;
    }
    .rf-form-label:hover {
      background: var(--primary-light);
      color: var(--primary);
    }
    .rf-form-label .rf-lbl-copy-icon {
      font-size: 10px;
      opacity: 0.6;
    }
    .rf-form-label:hover .rf-lbl-copy-icon {
      opacity: 1;
    }
    .rf-form-label.rf-copied {
      background: var(--success-light) !important;
      color: var(--success) !important;
    }

    .rf-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .rf-form-control {
      width: 100%;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 7px 10px;
      font-size: 12px;
      color: var(--text-main);
      background: #ffffff;
      outline: none;
      cursor: text;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    .rf-form-control:hover {
      border-color: #cbd5e1;
    }
    .rf-form-control:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.12);
    }
    .rf-form-control.rf-fill-pulse {
      border-color: var(--success) !important;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3) !important;
      background: var(--success-light) !important;
    }
    textarea.rf-form-control {
      min-height: 52px;
      resize: vertical;
      line-height: 1.4;
    }
    .rf-field-btn {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 2px 5px;
      font-size: 10.5px;
      cursor: pointer;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 22px;
      transition: all 0.12s ease;
    }
    .rf-field-btn:hover {
      background: var(--bg-hover);
      color: var(--primary);
      border-color: var(--primary-border);
    }
    .rf-field-btn.rf-btn-fill {
      color: var(--primary);
      background: var(--primary-light);
      border-color: var(--primary-border);
    }
    .rf-field-btn.rf-btn-fill:hover {
      background: #e0e7ff;
    }

    /* 栅格 */
    .rf-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    /* 经历子卡片 */
    .rf-sub-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      position: relative;
    }
    .rf-sub-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px dashed var(--border-color);
    }
    .rf-sub-card-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
    }
    .rf-sub-card-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rf-btn-add {
      background: #ffffff;
      border: 1px dashed var(--primary);
      color: var(--primary);
      border-radius: var(--radius-sm);
      padding: 7px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .rf-btn-add:hover {
      background: var(--primary-light);
    }

    /* 底部操作区 */
    .rf-footer {
      background: var(--bg-header);
      border-top: 1px solid var(--border-color);
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .rf-footer-btns {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rf-footer-link {
      color: var(--text-secondary);
      cursor: pointer;
      text-decoration: none;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .rf-footer-link:hover {
      background: var(--bg-hover);
      color: var(--text-main);
    }

    /* 网站弹出设置菜单 */
    .rf-site-menu {
      position: absolute;
      top: 44px;
      right: 10px;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 8px;
      width: 240px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 5px;
      animation: rf-menu-in 0.15s ease-out;
    }
    .rf-site-menu.rf-hidden,
    .rf-site-menu[style*="display: none"] {
      display: none !important;
    }
    @keyframes rf-menu-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rf-site-menu-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      padding: 2px 4px 6px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rf-site-menu-item {
      font-size: 12px;
      color: var(--text-main);
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.12s;
      user-select: none;
    }
    .rf-site-menu-item:hover {
      background: var(--bg-hover);
    }
    .rf-site-menu-item.active {
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 600;
    }

    /* 全局 Toast 提示 (穿透所有层级，居中浮动) */
    .rf-global-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      padding: 9px 20px;
      border-radius: 24px;
      font-size: 12.5px;
      font-weight: 600;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
      transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15);
    }
    .rf-global-toast.rf-show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .rf-global-toast.rf-toast-error {
      background: rgba(220, 38, 38, 0.95) !important;
      box-shadow: 0 10px 30px rgba(220, 38, 38, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
    }
    .rf-global-toast.rf-toast-success {
      background: rgba(16, 185, 129, 0.95) !important;
      box-shadow: 0 10px 30px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
    }
  `;
  shadow.appendChild(styleEl);

  // 容器构建
  const container = document.createElement("div");
  container.innerHTML = `
    <!-- 全局独立 Toast 提示 (无论卡片是否折叠，屏幕居中浮动) -->
    <div class="rf-global-toast" id="rf-toast">提示信息</div>

    <!-- 1. 输入框焦点跟随智能气泡 -->
    <div class="rf-inline-pill rf-pill-hidden" id="rf-inline-pill">
      <div class="rf-pill-body">
        <span id="rf-pill-ai-icon" title="大模型高精度对齐" style="cursor: pointer;">🪄</span>
        <span class="rf-pill-tag" id="rf-pill-tag">姓名</span>
        <span style="opacity: 0.5;">:</span>
        <span class="rf-pill-val" id="rf-pill-val">李某某</span>
      </div>
      <button class="rf-pill-fill-btn" id="rf-pill-fill-btn" title="单击或按快捷键自动填入">↵ 填入</button>
      <button class="rf-pill-copy-btn" id="rf-pill-copy-btn" title="复制内容">📋</button>
      <button class="rf-pill-copy-btn" id="rf-pill-refine-btn" title="不准确？点击呼唤 AI 重新精确定位此框" style="background: rgba(99, 102, 241, 0.3); border: 1px solid rgba(199, 210, 254, 0.4);">🪄AI重诊</button>
      <span id="rf-pill-ai-status" class="rf-pill-ai-status" style="display: none;"></span>
      <div class="rf-pill-suggestions" id="rf-pill-suggestions"></div>
      <button class="rf-pill-close-btn" id="rf-pill-close-btn" title="关闭气泡">×</button>
    </div>

    <!-- 退出鼠标穿透胶囊 (穿透模式下常驻) -->
    <div class="rf-ghost-badge rf-hidden" id="rf-ghost-badge" title="点击退出鼠标穿透模式 (快捷键 Alt+T)">
      <span>👻</span>
      <span>穿透模式 (点击退出 / Alt+T)</span>
    </div>

    <!-- 2. 悬浮折叠球 -->
    <div class="rf-floating-btn" id="rf-trigger-btn" title="点击展开简历助手">
      <span>🪄</span>
      <span>简历助手</span>
      <span class="rf-btn-badge" id="rf-btn-badge">默认简历</span>
    </div>

    <!-- 3. 悬浮卡片 -->
    <div class="rf-card-modal ${isCardCollapsed ? 'rf-hidden' : ''}" id="rf-card-modal">

      <!-- 头部 -->
      <div class="rf-header" id="rf-header">
        <div class="rf-header-top">
          <div class="rf-logo-title" id="rf-logo-title" title="单击卡片任意空白区域立即折叠 (单击小球就地展开)">
            <span>🪄</span>
            <span>简历填充助手</span>
            <span style="font-size: 10px; font-weight: normal; color: var(--text-muted); opacity: 0.85;">(点空白折叠)</span>
          </div>
          <div class="rf-header-controls">
            <button class="rf-icon-btn" id="rf-btn-site-setting" title="当前网站自动弹出设置 (智能/始终/禁止)">🌐</button>
            <button class="rf-icon-btn" id="rf-btn-mode-toggle" title="切换模式 (Alt+E)：当前为【填报模式】，点击进入【修改模式】">✏️</button>
            <button class="rf-icon-btn" id="rf-btn-opacity" title="调节透明度: 100% / 75% / 45%">💧</button>
            <button class="rf-icon-btn" id="rf-btn-ghost" title="开启鼠标穿透 (Alt+T)：卡片变半透明且可直接点击穿透底下的网页">👻</button>
            <button class="rf-icon-btn" id="rf-btn-reset-pos" title="重置卡片位置到右下角">📍</button>
            <button class="rf-icon-btn" id="rf-btn-version-rename" title="重命名当前版本">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="rf-icon-btn" id="rf-btn-version-add" title="另存为新版本">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="rf-icon-btn rf-btn-close" id="rf-btn-minimize" title="折叠卡片">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>

        <!-- 网站弹出控制下拉浮层 (默认绝对隐藏) -->
        <div class="rf-site-menu rf-hidden" id="rf-site-menu" style="display: none;">
          <div class="rf-site-menu-title">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">域名: <b id="rf-site-domain-text">current</b></span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span id="rf-site-status-badge" style="font-size: 10px; color: var(--primary); font-weight: bold;">⚡智能</span>
              <button id="rf-btn-close-site-menu" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: var(--text-secondary); cursor: pointer; font-size: 13px; font-weight: bold; width: 22px; height: 22px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" title="关闭菜单">✕</button>
            </div>
          </div>
          <div class="rf-site-menu-item active" id="rf-opt-site-auto" title="仅在招聘与网申表单页面自动显示">
            <span>⚡</span>
            <span>智能检测 (仅网申页自动弹出)</span>
          </div>
          <div class="rf-site-menu-item" id="rf-opt-site-always" title="无论什么页面均自动弹出">
            <span>✅</span>
            <span>在此网站始终弹出 (加入白名单)</span>
          </div>
          <div class="rf-site-menu-item" id="rf-opt-site-never" title="绝不自动弹出，仅在点击图标时唤起">
            <span>🚫</span>
            <span>在此网站禁止弹出 (加入黑名单)</span>
          </div>
        </div>

        <div class="rf-action-bar">
          <select class="rf-select-version" id="rf-select-version"></select>
          <button class="rf-btn-smart-fill" id="rf-btn-smart-fill" title="自动识别当前网页输入框并一键填充">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            智能填充整页
          </button>
        </div>
      </div>

      <!-- 选项卡导航 -->
      <div class="rf-tabs-nav" id="rf-tabs-nav">
        <div class="rf-tab-item active" data-tab="basic">基本信息</div>
        <div class="rf-tab-item" data-tab="education">教育背景</div>
        <div class="rf-tab-item" data-tab="internship">工作实习</div>
        <div class="rf-tab-item" data-tab="project">项目经历</div>
        <div class="rf-tab-item" data-tab="skills">技能荣誉</div>
        <div class="rf-tab-item" data-tab="paper-comp">赛事论文</div>
        <div class="rf-tab-item" data-tab="ai-config" style="color: #4f46e5; font-weight: 600;">🪄 AI配置</div>
      </div>

      <!-- 交互提示条与模式切换胶囊 -->
      <div class="rf-quick-hint" id="rf-quick-hint">
        <span id="rf-hint-text">💡 <b>填报模式</b>：单击标签复制，单击输入框填入网页</span>
        <div class="rf-mode-switch" id="rf-mode-switch" title="切换填报/修改模式 (快捷键 Alt+E)">
          <span class="rf-mode-btn active" id="rf-mode-btn-fill" data-mode="fill">⚡ 填报</span>
          <span class="rf-mode-btn" id="rf-mode-btn-edit" data-mode="edit">✏️ 修改</span>
        </div>
      </div>

      <!-- 卡片内容体 -->
      <div class="rf-card-body" id="rf-card-body">
        <!-- 1. 基本信息面板 -->
        <div class="rf-tab-panel active" id="panel-basic">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.name">姓名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="basic.name" placeholder="如：张三">
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.gender">性别 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.gender" placeholder="男 / 女">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.ethnicity">民族 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.ethnicity" placeholder="如：汉族">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.birth">生日 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.birth" placeholder="如：1999-01-01">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.political">政治面貌 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.political" placeholder="群众/共青团员/党员">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.height">身高 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.height" placeholder="如：160cm 或 160">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.weight">体重 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.weight" placeholder="如：67kg 或 67">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.phone">手机号码 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.phone" placeholder="11位手机号">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.email">电子邮箱 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.email" placeholder="example@163.com">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.idCard">身份证号 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.idCard" placeholder="身份证号码">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.wechat">微信号 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.wechat" placeholder="微信号码">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.city">现居城市 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.city" placeholder="如：北京市海淀区">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.nativePlace">籍贯 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.nativePlace" placeholder="如：山东济南">
              </div>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.residence">现居详细地址 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="basic.residence" placeholder="现居城市+详细门牌号">
            </div>
          </div>

          <!-- 拆分：个人网站 与 GitHub -->
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.website">个人网站 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="basic.website" placeholder="如：https://yourdomain.com">
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.github">GitHub <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="basic.github" placeholder="如：https://github.com/username">
            </div>
          </div>

          <!-- 新增：紧急联系人姓名、关系、电话 -->
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">紧急联系人（选填）</span>
          </div>
          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.emergencyContact">紧急联系人姓名 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.emergencyContact" placeholder="姓名">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.emergencyRelation">与本人关系 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.emergencyRelation" placeholder="父母/配偶/朋友">
              </div>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.emergencyPhone">紧急联系人电话 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="basic.emergencyPhone" placeholder="联系电话">
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.jobIntent">求职意向 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.jobIntent" placeholder="如：AI应用开发">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.highestDegree">最高学历 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.highestDegree" placeholder="硕士 / 本科">
              </div>
            </div>
          </div>

          <div class="rf-grid-2">
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.country">所在国家 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.country" placeholder="中国">
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-form-label" data-copy-ref="basic.acceptRelocation">接受城市调剂 <span class="rf-lbl-copy-icon">📋</span></label>
              <div class="rf-input-wrapper">
                <input type="text" class="rf-form-control" data-key="basic.acceptRelocation" placeholder="是 / 否">
              </div>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.selfEval">自我评价 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <textarea class="rf-form-control" data-key="basic.selfEval" placeholder="自我介绍/个人优势简述..."></textarea>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.selfDescription">自我描述 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <textarea class="rf-form-control" data-key="basic.selfDescription" placeholder="自我描述、性格特质、工作风格与个人亮点..."></textarea>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="basic.extraInfo">补充说明 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <textarea class="rf-form-control" data-key="basic.extraInfo" placeholder="其他补充说明事项..."></textarea>
            </div>
          </div>
        </div>

        <!-- 2. 教育背景面板 -->
        <div class="rf-tab-panel" id="panel-education">
          <div id="rf-edu-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-edu">+ 新增教育经历</button>
        </div>

        <!-- 3. 工作实习面板 -->
        <div class="rf-tab-panel" id="panel-internship">
          <div id="rf-intern-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-intern">+ 新增工作实习</button>
        </div>

        <!-- 4. 项目经历面板 -->
        <div class="rf-tab-panel" id="panel-project">
          <div id="rf-proj-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-proj">+ 新增项目经历</button>
        </div>

        <!-- 5. 技能荣誉面板 -->
        <div class="rf-tab-panel" id="panel-skills">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="skills">专业技能描述 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <textarea class="rf-form-control" data-key="skills" placeholder="列出编程语言、框架、工具链、技术优势..."></textarea>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="languages">语言能力 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" data-key="languages" placeholder="如：英语六级 / CET-6">
            </div>
          </div>

          <div style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-top: 4px;">荣誉奖项列表</div>
          <div id="rf-honor-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-honor">+ 新增荣誉奖项</button>
        </div>

        <!-- 6. 赛事与论文面板 -->
        <div class="rf-tab-panel" id="panel-paper-comp">
          <div style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">竞赛 / 赛事经历</div>
          <div id="rf-comp-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-comp">+ 新增赛事经验</button>

          <div style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-top: 10px;">论文 / 期刊 / 专利</div>
          <div id="rf-paper-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <button class="rf-btn-add" id="rf-btn-add-paper">+ 新增论文/期刊/专利</button>
        </div>

        <!-- 7. 大模型 AI 配置面板 -->
        <div class="rf-tab-panel" id="panel-ai-config">
          <div style="font-size: 12px; font-weight: 700; color: #4f46e5; display: flex; align-items: center; justify-content: space-between;">
            <span>🤖 大模型接口配置 (AI 智能对齐)</span>
            <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">全局共享</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; background: #eef2ff; padding: 7px 10px; border-radius: 6px; border: 1px solid #c7d2fe; margin-top: 4px;">
            💡 用于网申输入框的 99%+ 高精度对齐。支持任何兼容 OpenAI 或 Claude 格式的接口（如 DeepSeek、OpenAI、通义千问等）。
          </div>

          <div class="rf-form-group" style="margin-top: 8px;">
            <label class="rf-form-label">接口协议 (Protocol)</label>
            <div class="rf-input-wrapper">
              <select class="rf-form-control" id="rf-ai-protocol" style="height: 32px; background: #fff; cursor: pointer;">
                <option value="openai">OpenAI 兼容协议 (支持大多数中转/国产大模型)</option>
                <option value="claude">Claude 原生协议 (Anthropic Messages API)</option>
              </select>
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label">API 服务地址 (Base URL)</label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" id="rf-ai-base-url" placeholder="如：https://api.openai.com/v1 或 https://api.deepseek.com/v1">
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label">API 密钥 (API Key) *</label>
            <div class="rf-input-wrapper">
              <input type="password" class="rf-form-control" id="rf-ai-api-key" placeholder="填入你的 sk-xxxxxxxx 密钥">
            </div>
          </div>

          <div class="rf-form-group">
            <label class="rf-form-label">模型名称 (Model Name)</label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control" id="rf-ai-model" placeholder="如：gpt-4o-mini / deepseek-chat / gpt-4o">
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="rf-btn-smart-fill" id="rf-btn-test-ai" style="flex: 1; background: #f1f5f9; color: var(--text-main); border: 1px solid var(--border-color); box-shadow: none; justify-content: center;">
              ⚡ 测试连接
            </button>
            <button class="rf-btn-smart-fill" id="rf-btn-save-ai" style="flex: 1.2; justify-content: center;">
              💾 保存配置
            </button>
          </div>
          <div id="rf-ai-test-result" style="font-size: 11px; padding: 6px 8px; border-radius: 4px; display: none; line-height: 1.4; margin-top: 8px;"></div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="rf-footer">
        <span>数据自动本地保存</span>
        <div class="rf-footer-btns">
          <span class="rf-footer-link" id="rf-btn-export" title="导出当前简历数据为 JSON 文件">导出</span>
          <span>·</span>
          <span class="rf-footer-link" id="rf-btn-import" title="从 JSON 文件导入简历数据">导入</span>
          <span>·</span>
          <span class="rf-footer-link" id="rf-btn-clear" title="清空当前简历数据" style="color: var(--danger);">清空</span>
          <input type="file" id="rf-file-input" accept=".json" style="display: none;">
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(container);

  // 节点引用
  const triggerBtn = shadow.getElementById("rf-trigger-btn");
  const cardModal = shadow.getElementById("rf-card-modal");
  const btnBadge = shadow.getElementById("rf-btn-badge");
  const minimizeBtn = shadow.getElementById("rf-btn-minimize");
  const selectVersion = shadow.getElementById("rf-select-version");
  const toastEl = shadow.getElementById("rf-toast");
  const smartFillBtn = shadow.getElementById("rf-btn-smart-fill");
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

  // ==================== 存储与数据同步 ====================

  async function loadData() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["resumesList", "activeResumeId", "resumeData"], (result) => {
          if (result.resumesList && result.resumesList.length > 0) {
            resumesList = result.resumesList;
            activeResumeId = result.activeResumeId || resumesList[0].id;
          } else if (result.resumeData) {
            resumesList = [{ id: "default", name: "默认简历", data: result.resumeData }];
            activeResumeId = "default";
            chrome.storage.local.set({ resumesList, activeResumeId });
            chrome.storage.local.remove("resumeData");
          } else {
            resumesList = [{ id: "default", name: "默认简历", data: JSON.parse(JSON.stringify(defaultResumeData)) }];
            activeResumeId = "default";
          }
          const activeItem = resumesList.find((r) => r.id === activeResumeId) || resumesList[0];
          resumeData = mergeWithDefault(activeItem.data, defaultResumeData);
          updateAllViews();
          resolve();
        });
      } else {
        const localList = localStorage.getItem("resumesList");
        if (localList) {
          resumesList = JSON.parse(localList);
          activeResumeId = localStorage.getItem("activeResumeId") || resumesList[0].id;
        } else {
          resumesList = [{ id: "default", name: "默认简历", data: JSON.parse(JSON.stringify(defaultResumeData)) }];
          activeResumeId = "default";
        }
        const activeItem = resumesList.find((r) => r.id === activeResumeId) || resumesList[0];
        resumeData = mergeWithDefault(activeItem.data, defaultResumeData);
        updateAllViews();
        resolve();
      }
    });
  }

  function saveData() {
    const activeIdx = resumesList.findIndex((r) => r.id === activeResumeId);
    if (activeIdx !== -1) {
      resumesList[activeIdx].data = resumeData;
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ resumesList, activeResumeId });
    } else {
      localStorage.setItem("resumesList", JSON.stringify(resumesList));
      localStorage.setItem("activeResumeId", activeResumeId);
    }
  }

  // 监听外部 storage 变化，保持悬浮窗与侧边栏数据双向同步
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.resumesList || changes.activeResumeId)) {
        loadData();
      }
    });
  }

  // ==================== UI 渲染逻辑 ====================

  function updateAllViews() {
    renderVersionDropdown();
    fillBasicAndSkillsForm();
    renderEducationList();
    renderInternshipList();
    renderProjectList();
    renderHonorsList();
    renderCompetitionList();
    renderPaperList();
  }

  function renderVersionDropdown() {
    if (!selectVersion) return;
    selectVersion.innerHTML = "";
    resumesList.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      if (r.id === activeResumeId) opt.selected = true;
      selectVersion.appendChild(opt);
    });
    const current = resumesList.find((r) => r.id === activeResumeId);
    if (btnBadge && current) {
      btnBadge.textContent = current.name;
    }
  }

  function fillBasicAndSkillsForm() {
    shadow.querySelectorAll("[data-key^='basic.']").forEach((input) => {
      const key = input.getAttribute("data-key").split(".")[1];
      input.value = resumeData.basic[key] || "";
    });
    const skillsTextarea = shadow.querySelector("[data-key='skills']");
    if (skillsTextarea) skillsTextarea.value = resumeData.skills || "";
    const languagesInput = shadow.querySelector("[data-key='languages']");
    if (languagesInput) languagesInput.value = resumeData.languages || "";
  }

  // 渲染教育经历
  function renderEducationList() {
    const container = shadow.getElementById("rf-edu-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.education.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无教育经历</div>`;
      return;
    }

    resumeData.education.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">教育经历 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="education" data-index="${index}" title="填入当前聚焦的教育板块">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="education" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.school">学校名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="school" value="${item.school || ''}" placeholder="如：北京大学">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.degree">学历学位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="degree" value="${item.degree || ''}" placeholder="如：硕士/本科">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.major">所学专业 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="major" value="${item.major || ''}" placeholder="专业名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.gpa">GPA / 排名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="gpa" value="${item.gpa || ''}" placeholder="3.8/4.0 或 前10%">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.start">入学时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2020-09">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.end">毕业时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2024-06">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.studentId">学号 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="studentId" value="${item.studentId || ''}" placeholder="学号">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.schoolLocation">学校所在地 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="schoolLocation" value="${item.schoolLocation || ''}" placeholder="如：北京市海淀区">
            </div>
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.department">院系名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="计算机科学与技术学院">
          </div>
        </div>

        <!-- 导师姓名 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.supervisor">导师姓名 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="supervisor" value="${item.supervisor || ''}" placeholder="如：李教授 / 张老师">
          </div>
        </div>

        <!-- 专业描述 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.majorDescription">专业描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="majorDescription" placeholder="专业特色、主修方向、专业概述说明...">${item.majorDescription || ''}</textarea>
          </div>
        </div>

        <!-- 毕业论文/设计/作品 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.thesisTopic">毕业论文/设计/作品 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="thesisTopic" placeholder="毕设题目、毕业设计或作品主要内容...">${item.thesisTopic || ''}</textarea>
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.courses">主修课程 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="courses" placeholder="核心课程，以逗号隔开">${item.courses || ''}</textarea>
          </div>
        </div>

        <!-- 研究方向 (主修课程之后) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.researchDirection">研究方向 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="researchDirection" value="${item.researchDirection || ''}" placeholder="如：自然语言处理 / 计算机视觉 / 大模型应用">
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.labExperience">科研/实验室经历 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="labExperience" placeholder="科研课题、承担角色与主要贡献...">${item.labExperience || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染实习经历
  function renderInternshipList() {
    const container = shadow.getElementById("rf-intern-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.internship.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无实习经历</div>`;
      return;
    }

    resumeData.internship.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">工作实习 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="internship" data-index="${index}">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="internship" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.company">公司名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="公司名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.position">担任岗位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="担任职位">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.start">入职时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2023-06">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.end">离职时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2023-09 或 至今">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="internship.${index}.desc">职责与产出 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="desc" placeholder="简述日常开发、核心产出等...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染项目经历 (重点：拆分为项目描述、项目职责、项目成果三个输入框)
  function renderProjectList() {
    const container = shadow.getElementById("rf-proj-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.project.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无项目经历</div>`;
      return;
    }

    resumeData.project.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">项目经历 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="project" data-index="${index}">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="project" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.name">项目名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="项目名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.role">担任角色 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="项目负责人 / 核心开发">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.start">开始时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2023-10">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.end">结束时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2023-12">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.tech">主要技术栈 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="tech" value="${item.tech || ''}" placeholder="如：FastAPI, React, Docker">
          </div>
        </div>

        <!-- 拆分 1: 项目描述 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.desc">项目描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="desc" placeholder="描述项目背景、目标定位、业务场景与系统核心架构...">${item.desc || ''}</textarea>
          </div>
        </div>

        <!-- 拆分 2: 项目职责 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.duty">项目职责 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="duty" placeholder="描述你在项目中承担的核心角色职责、负责的具体模块开发与技术工作...">${item.duty || ''}</textarea>
          </div>
        </div>

        <!-- 拆分 3: 项目成果 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.result">项目成果 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="result" placeholder="描述项目的量化指标提升、业务收益、线上成效或竞赛获奖成果...">${item.result || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染荣誉奖项
  function renderHonorsList() {
    const container = shadow.getElementById("rf-honor-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.honors.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无荣誉奖项</div>`;
      return;
    }
    resumeData.honors.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">奖项 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="honors" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="honors.${index}.name">奖项名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="国家奖学金 / 一等奖">
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="honors.${index}.date">获奖时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="date" value="${item.date || ''}" placeholder="2023-11">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="honors.${index}.level">级别 / 机构 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="level" value="${item.level || ''}" placeholder="国家级 / 教育部">
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染赛事经历
  function renderCompetitionList() {
    const container = shadow.getElementById("rf-comp-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.competition.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无赛事经历</div>`;
      return;
    }
    resumeData.competition.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">赛事 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="competition" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="competition.${index}.name">比赛名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="competition" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="挑战杯 / 创青春 / 开发者大赛">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="competition.${index}.desc">描述与成果 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="competition" data-index="${index}" data-key="desc" placeholder="简述赛事职责、名次与成果...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染论文/专利
  function renderPaperList() {
    const container = shadow.getElementById("rf-paper-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.paper.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无论文/期刊/专利</div>`;
      return;
    }
    resumeData.paper.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">论文/专利 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="paper" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="paper.${index}.title">论文/专利题目 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="paper" data-index="${index}" data-key="title" value="${item.title || ''}" placeholder="论文/专利题目">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="paper.${index}.desc">摘要 / 研究内容 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="paper" data-index="${index}" data-key="desc" placeholder="简要描述研究内容、算法、成果...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ==================== 智能气泡跟随逻辑 ====================

  function updatePillPosition() {
    if (!currentTargetInput || !document.body.contains(currentTargetInput)) {
      inlinePill.classList.add("rf-pill-hidden");
      return;
    }
    const rect = currentTargetInput.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      inlinePill.classList.add("rf-pill-hidden");
      return;
    }

    const pillHeight = inlinePill.offsetHeight || 36;
    let left = rect.left;
    let top = rect.top - pillHeight - 6;
    if (top < 8) {
      top = rect.bottom + 6;
    }
    left = Math.max(10, Math.min(window.innerWidth - 340, left));

    inlinePill.style.left = `${left}px`;
    inlinePill.style.top = `${top}px`;
  }

  // 智能解析任意点击或焦点元素对应的表单输入控件 (全面适配 Moka/AntD/Element/自定义下拉/富文本/图标包裹等复杂结构)
  function resolveTargetControl(el) {
    if (!el) return null;
    try {
      if (el.closest && el.closest("#resume-filler-extension-host")) return null;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return null;

      // 1. 本身是输入控件或富文本
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return el;
      if (el.isContentEditable || (typeof el.getAttribute === "function" && el.getAttribute("contenteditable") === "true")) return el;

      // 2. 向下在子树中查找有效输入框
      if (typeof el.querySelector === "function") {
        const inner = el.querySelector("input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [contenteditable='true']");
        if (inner) return inner;
      }

      // 3. 向上追溯查找（解决点在 label、前置图标、picker 容器、select 箭头、td 等位置）
      let p = el.parentElement;
      let steps = 0;
      while (p && p !== document.body && steps < 5) {
        if (typeof p.querySelector === "function") {
          const inputInParent = p.querySelector("input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [contenteditable='true']");
          if (inputInParent) return inputInParent;
        }
        p = p.parentElement;
        steps++;
      }
    } catch(e) {
      console.error("resolveTargetControl error:", e);
    }
    return null;
  }

  function showPillForInput(inputEl) {
    if (!inputEl) return;
    // 仅在当前页面启用了智能气泡推荐（网申页面或用户白名单）时弹出，日常普通页面不打扰
    if (!isPillEnabled) return;
    const target = resolveTargetControl(inputEl) || inputEl;

    let match = null;
    try {
      if (window.ResumeFillerContent && window.ResumeFillerContent.detectFieldForElement) {
        match = window.ResumeFillerContent.detectFieldForElement(target, resumeData);
      }
    } catch (e) {
      console.error("detectFieldForElement error:", e);
    }

    currentTargetInput = target;
    currentDetectedField = match;

    // 重置重诊按钮状态与内联提示
    if (pillRefineBtn) {
      pillRefineBtn.textContent = "🪄AI重诊";
      pillRefineBtn.disabled = false;
      pillRefineBtn.style.opacity = "1";
    }
    if (pillAiStatus) {
      pillAiStatus.style.display = "none";
    }

    if (match) {
      pillTag.textContent = match.label;
      const previewVal = match.value || "[空]";
      pillVal.textContent = previewVal.length > 18 ? previewVal.slice(0, 16) + "..." : previewVal;
      pillFillBtn.style.display = "inline-flex";

      if (pillAiIcon) {
        pillAiIcon.textContent = match.isAiMatched ? "🤖" : "🪄";
        pillAiIcon.title = match.isAiMatched
          ? `大模型语义对齐 (置信度: ${Math.round((match.confidence || 0.95) * 100)}%)\n${match.reason || ''}`
          : "本地规则推断，点击让 AI 重新深度分析此框";
      }
      if (pillRefineBtn) {
        pillRefineBtn.style.display = match.isAiMatched ? "none" : "inline-flex";
      }

      // 地区级联一键选择支持
      pillSuggestions.innerHTML = "";
      if (match.isArea && match.value) {
        const autoCascaderBtn = document.createElement("span");
        autoCascaderBtn.className = "rf-pill-sug-item";
        autoCascaderBtn.style.background = "#059669";
        autoCascaderBtn.style.color = "#ffffff";
        autoCascaderBtn.textContent = "⚡ 自动级联选";
        autoCascaderBtn.title = "自动点击展开并选中省市区";
        autoCascaderBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (window.ResumeFillerContent.autoSelectCascaderArea) {
            showToast("正在自动选择地区...");
            await window.ResumeFillerContent.autoSelectCascaderArea(currentTargetInput, match.value);
            showToast("地区选择完成！");
            hidePill();
          }
        });
        pillSuggestions.appendChild(autoCascaderBtn);
      }

      // 渲染拆分候选项
      if (match.suggestions && match.suggestions.length > 0) {
        match.suggestions.slice(0, 4).forEach((sug) => {
          const sugEl = document.createElement("span");
          sugEl.className = "rf-pill-sug-item";
          sugEl.textContent = sug.label;
          sugEl.title = `填入：${sug.value}`;
          sugEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentTargetInput) {
              window.ResumeFillerContent.setElementValue(currentTargetInput, sug.value);
              showToast(`已填入：${sug.label}`);
              hidePill();
            }
          });
          pillSuggestions.appendChild(sugEl);
        });
      }
    } else {
      // 兜底气泡：输入框未命中特定特征时，弹出常用高频选择，绝不让气泡消失！
      pillTag.textContent = "快速选填";
      pillVal.textContent = "点击填入常用项";
      pillFillBtn.style.display = "none";

      pillSuggestions.innerHTML = "";
      const commonQuickList = [
        { label: "姓名", val: resumeData.basic.name },
        { label: "手机", val: resumeData.basic.phone },
        { label: "邮箱", val: resumeData.basic.email },
        { label: "紧急联系人", val: resumeData.basic.emergencyContact },
        { label: "导师", val: (resumeData.education[0] && resumeData.education[0].supervisor) || "" },
        { label: "研究方向", val: (resumeData.education[0] && resumeData.education[0].researchDirection) || "" }
      ].filter(it => it.val);

      commonQuickList.forEach(q => {
        const sugEl = document.createElement("span");
        sugEl.className = "rf-pill-sug-item";
        sugEl.textContent = q.label;
        sugEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (currentTargetInput) {
            window.ResumeFillerContent.setElementValue(currentTargetInput, q.val);
            showToast(`已填入：${q.label}`);
            hidePill();
          }
        });
        pillSuggestions.appendChild(sugEl);
      });
    }

    // 先移除隐藏类，再测量并设置坐标
    inlinePill.classList.remove("rf-pill-hidden");
    updatePillPosition();
  }

  function hidePill() {
    inlinePill.classList.add("rf-pill-hidden");
  }

  // ==================== 事件监听与交互 ====================

  function initEvents() {
    // 1. 就地智能折叠与展开算法 (精准记忆位置，折叠就地变成球，展开从当前位置展开)
    function collapseCard(mousePos) {
      const cardRect = cardModal.getBoundingClientRect();
      const headRect = cardHeader.getBoundingClientRect();
      
      // 目标折叠点：优先使用鼠标位置；若无鼠标位置则使用卡片头部中心
      const targetX = (mousePos && typeof mousePos.x === "number") ? mousePos.x : (headRect.left + 80);
      const targetY = (mousePos && typeof mousePos.y === "number") ? mousePos.y : (headRect.top + 18);

      const btnW = triggerBtn.offsetWidth || 135;
      const btnH = triggerBtn.offsetHeight || 36;

      // 让悬浮球出现并就地吸附在鼠标当前位置 (光标正下方/中心偏左)
      let btnLeft = targetX - 35;
      let btnTop = targetY - (btnH / 2);

      // 视口边界保护
      btnLeft = Math.max(10, Math.min(window.innerWidth - btnW - 10, btnLeft));
      btnTop = Math.max(10, Math.min(window.innerHeight - btnH - 10, btnTop));

      // 动态设置缩拢动画原点，视觉上卡片朝鼠标位置收缩
      const originX = Math.max(0, Math.min(cardRect.width, targetX - cardRect.left));
      const originY = Math.max(0, Math.min(cardRect.height, targetY - cardRect.top));
      cardModal.style.transformOrigin = `${originX}px ${originY}px`;

      // 应用并记忆悬浮球坐标
      triggerBtn.style.right = "auto";
      triggerBtn.style.bottom = "auto";
      triggerBtn.style.left = `${btnLeft}px`;
      triggerBtn.style.top = `${btnTop}px`;
      localStorage.setItem("rf_trigger_pos", JSON.stringify({ left: btnLeft, top: btnTop }));

      // 切换显示状态
      cardModal.classList.add("rf-hidden");
      triggerBtn.classList.remove("rf-hidden");
      isCardCollapsed = true;
      localStorage.setItem("rf_card_collapsed", "true");
      showToast("已就地折叠到鼠标位置 (单击小球就地展开)");
    }

    function expandCard() {
      const btnRect = triggerBtn.getBoundingClientRect();
      const cardW = 410;
      const cardH = Math.min(620, window.innerHeight - 30);

      // 展开目标位置：让卡片头部尽可能贴合悬浮球当前所在位置
      let cardLeft = btnRect.left;
      let cardTop = btnRect.top;

      // 如果小球靠近屏幕右侧，卡片向左侧展开避免出界
      if (btnRect.left + (btnRect.width / 2) > window.innerWidth / 2) {
        cardLeft = btnRect.right - cardW;
      }
      // 如果小球靠近屏幕下方，卡片向上方展开避免出界
      if (btnRect.top + (btnRect.height / 2) > window.innerHeight / 2) {
        cardTop = btnRect.bottom - cardH;
      }

      // 视口边界保护
      cardLeft = Math.max(10, Math.min(window.innerWidth - cardW - 10, cardLeft));
      cardTop = Math.max(10, Math.min(window.innerHeight - cardH - 10, cardTop));

      // 动态设置绽放动画原点，卡片从悬浮球当前位置展开
      const originX = Math.max(0, Math.min(cardW, btnRect.left - cardLeft + btnRect.width / 2));
      const originY = Math.max(0, Math.min(cardH, btnRect.top - cardTop + btnRect.height / 2));
      cardModal.style.transformOrigin = `${originX}px ${originY}px`;

      // 应用并记忆卡片坐标
      cardModal.style.right = "auto";
      cardModal.style.bottom = "auto";
      cardModal.style.left = `${cardLeft}px`;
      cardModal.style.top = `${cardTop}px`;
      localStorage.setItem("rf_card_pos", JSON.stringify({ left: cardLeft, top: cardTop }));

      // 切换显示状态
      cardModal.classList.remove("rf-hidden");
      triggerBtn.classList.add("rf-hidden");
      isCardCollapsed = false;
      localStorage.setItem("rf_card_collapsed", "false");
    }

    function toggleCard(expand, mousePos) {
      if (isBlacklisted) {
        triggerBtn.classList.remove("rf-hidden");
      }
      const willExpand = expand !== undefined ? expand : cardModal.classList.contains("rf-hidden");
      if (willExpand) {
        expandCard();
      } else {
        collapseCard(mousePos);
      }
    }

    // 悬浮球单击就地展开
    triggerBtn.addEventListener("click", () => {
      if (!isTriggerDragging) {
        expandCard();
      }
    });

    // 右上角小按钮折叠
    minimizeBtn.addEventListener("click", (e) => {
      collapseCard({ x: e.clientX, y: e.clientY });
    });

    // 单击卡片任意非填写框区域或非功能按钮区域，即可切换到悬浮按钮形式
    cardModal.addEventListener("click", (e) => {
      // 1. 如果刚刚进行了拖动移动卡片位置，不触发折叠
      if (cardJustDragged) return;

      // 2. 如果用户当前在选中文本，避免收起
      const selection = window.getSelection ? window.getSelection().toString().trim() : "";
      if (selection.length > 0) return;

      // 3. 检查点击目标是否属于填写输入框、可复制字段标签、操作按钮或功能控件
      const interactiveEl = e.target.closest([
        "input",
        "textarea",
        "select",
        "button",
        ".rf-form-control",
        ".card-input",
        "[data-copy-ref]",
        ".rf-form-label",
        ".rf-tab-item",
        ".rf-mode-btn",
        ".rf-mode-switch",
        ".rf-select-version",
        ".rf-btn-smart-fill",
        ".rf-btn-add",
        ".btn-delete-card",
        ".rf-footer-link",
        ".rf-icon-btn",
        "#rf-site-menu",
        ".rf-site-menu",
        ".rf-site-menu-item",
        "#rf-toast"
      ].join(","));

      // 如果点击的是具体的功能按钮、选项卡、输入框或复制标签，则正常执行对应功能，不折叠
      if (interactiveEl) return;

      // 否则说明点击的是卡片的空白/背景/间距区域，单击立即收起为悬浮球！
      e.stopPropagation();
      collapseCard({ x: e.clientX, y: e.clientY });
    });

    if (isCardCollapsed) {
      cardModal.classList.add("rf-hidden");
      triggerBtn.classList.remove("rf-hidden");
    } else {
      cardModal.classList.remove("rf-hidden");
      triggerBtn.classList.add("rf-hidden");
    }

    // 2. 标签页切换
    tabsNav.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".rf-tab-item");
      if (!tabBtn) return;
      tabsNav.querySelectorAll(".rf-tab-item").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      const tabId = tabBtn.getAttribute("data-tab");

      shadow.querySelectorAll(".rf-tab-panel").forEach((p) => p.classList.remove("active"));
      const targetPanel = shadow.getElementById(`panel-${tabId}`);
      if (targetPanel) targetPanel.classList.add("active");
    });

    // ==================== 悬浮卡片内的 AI 配置与连通性测试 ====================
    const aiProtocolEl = shadow.getElementById("rf-ai-protocol");
    const aiBaseUrlEl = shadow.getElementById("rf-ai-base-url");
    const aiApiKeyEl = shadow.getElementById("rf-ai-api-key");
    const aiModelEl = shadow.getElementById("rf-ai-model");
    const aiSaveBtn = shadow.getElementById("rf-btn-save-ai");
    const aiTestBtn = shadow.getElementById("rf-btn-test-ai");
    const aiTestResult = shadow.getElementById("rf-ai-test-result");

    async function loadFloatingAiConfig() {
      try {
        const storage = await new Promise(r => {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get("apiConfig", r);
          } else {
            r({ apiConfig: JSON.parse(localStorage.getItem("apiConfig") || "{}") });
          }
        });
        const cfg = storage.apiConfig || {};
        if (aiProtocolEl) aiProtocolEl.value = cfg.protocol || "openai";
        if (aiBaseUrlEl) aiBaseUrlEl.value = cfg.baseUrl || "https://api.openai.com/v1";
        if (aiApiKeyEl) aiApiKeyEl.value = cfg.apiKey || "";
        if (aiModelEl) aiModelEl.value = cfg.model || "gpt-4o-mini";
      } catch (e) {}
    }

    loadFloatingAiConfig();

    if (aiSaveBtn) {
      aiSaveBtn.addEventListener("click", async () => {
        const newCfg = {
          protocol: aiProtocolEl ? aiProtocolEl.value : "openai",
          baseUrl: aiBaseUrlEl ? aiBaseUrlEl.value.trim() : "https://api.openai.com/v1",
          apiKey: aiApiKeyEl ? aiApiKeyEl.value.trim() : "",
          model: aiModelEl ? aiModelEl.value.trim() : "gpt-4o-mini"
        };
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ apiConfig: newCfg });
          }
          localStorage.setItem("apiConfig", JSON.stringify(newCfg));
          showToast("✅ AI 接口配置已保存！", "success");
        } catch(err) {
          showToast("保存失败: " + err.message, "error");
        }
      });
    }

    if (aiTestBtn) {
      aiTestBtn.addEventListener("click", async () => {
        const protocol = aiProtocolEl ? aiProtocolEl.value : "openai";
        const baseUrl = aiBaseUrlEl ? aiBaseUrlEl.value.trim() : "https://api.openai.com/v1";
        const apiKey = aiApiKeyEl ? aiApiKeyEl.value.trim() : "";
        const model = aiModelEl ? aiModelEl.value.trim() : "gpt-4o-mini";

        if (!apiKey) {
          showToast("请先输入 API Key 再进行测试！", "error");
          if (aiTestResult) {
            aiTestResult.style.display = "block";
            aiTestResult.style.background = "#fee2e2";
            aiTestResult.style.color = "#991b1b";
            aiTestResult.textContent = "❌ 请先填写 API Key！";
          }
          return;
        }

        // 先自动保存当前输入的配置
        const testCfg = { protocol, baseUrl, apiKey, model };
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ apiConfig: testCfg });
        }
        localStorage.setItem("apiConfig", JSON.stringify(testCfg));

        aiTestBtn.textContent = "正在测试...";
        aiTestBtn.disabled = true;
        aiTestBtn.style.opacity = "0.6";
        showToast("⚡ 正在向大模型发送握手测试请求...", "info");

        if (aiTestResult) {
          aiTestResult.style.display = "block";
          aiTestResult.style.background = "#f1f5f9";
          aiTestResult.style.color = "var(--text-secondary)";
          aiTestResult.textContent = "⏳ 正在连接大模型并验证回复...";
        }

        const t0 = Date.now();
        try {
          const resp = await new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                resolve({ success: false, error: "连接测试超时 (15s)" });
              }
            }, 15000);

            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                action: "callLLM",
                payload: {
                  prompt: "Hello, this is a connectivity test. Reply with 'pong' directly.",
                  systemPrompt: "You are a test ping bot.",
                  jsonMode: false,
                  meta: { action: "test_ping", url: window.location.href }
                }
              }, (res) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(res);
                }
              });
            } else {
              resolve({ success: false, error: "chrome.runtime 不可用" });
            }
          });

          const duration = Date.now() - t0;
          if (resp && resp.success) {
            showToast(`✅ 连接成功！模型响应耗时: ${duration}ms`, "success");
            if (aiTestResult) {
              aiTestResult.style.display = "block";
              aiTestResult.style.background = "#dcfce7";
              aiTestResult.style.color = "#166534";
              aiTestResult.innerHTML = `✅ <b>连接成功！</b> 耗时: <b>${duration}ms</b><br>模型回复: "${(resp.data || '').slice(0, 50)}"`;
            }
          } else {
            const err = resp ? resp.error : "未知错误";
            showToast(`❌ 连接测试失败: ${err}`, "error");
            if (aiTestResult) {
              aiTestResult.style.display = "block";
              aiTestResult.style.background = "#fee2e2";
              aiTestResult.style.color = "#991b1b";
              aiTestResult.innerHTML = `❌ <b>连接失败:</b> ${err}`;
            }
          }
        } catch(err) {
          showToast(`❌ 测试发生异常: ${err.message}`, "error");
          if (aiTestResult) {
            aiTestResult.style.display = "block";
            aiTestResult.style.background = "#fee2e2";
            aiTestResult.style.color = "#991b1b";
            aiTestResult.textContent = "❌ 发生异常: " + err.message;
          }
        } finally {
          aiTestBtn.textContent = "⚡ 测试连接";
          aiTestBtn.disabled = false;
          aiTestBtn.style.opacity = "1";
        }
      });
    }

    // 3. 智能填充整页
    smartFillBtn.addEventListener("click", () => {
      if (window.ResumeFillerContent && window.ResumeFillerContent.smartFillPage) {
        const count = window.ResumeFillerContent.smartFillPage(resumeData);
        showToast(`已智能识别并填充 ${count} 个输入框！`);
      } else {
        showToast("无法获取页面填充引擎");
      }
    });

    // 4. 重构核心 1：单击字段标签一键复制 (彻底去除独立复制按钮)
    shadow.addEventListener("click", (e) => {
      const label = e.target.closest("[data-copy-ref]");
      if (label) {
        const ref = label.getAttribute("data-copy-ref");
        const val = getValueByRef(ref);
        if (val) {
          navigator.clipboard.writeText(val).then(() => {
            const originalHtml = label.innerHTML;
            label.classList.add("rf-copied");
            label.innerHTML = `✓ 已复制`;
            setTimeout(() => {
              label.innerHTML = originalHtml;
              label.classList.remove("rf-copied");
            }, 750);
          }).catch(() => {
            showToast("复制失败，请手动选择复制");
          });
        } else {
          showToast("该项内容为空");
        }
      }
    });

    // 模式切换函数 (填报模式 vs 修改模式)
    function setEditMode(enable) {
      isEditMode = !!enable;
      if (isEditMode) {
        cardModal.classList.add("rf-mode-edit-active");
        if (modeBtnEdit) modeBtnEdit.classList.add("active");
        if (modeBtnFill) modeBtnFill.classList.remove("active");
        if (modeToggleBtn) {
          modeToggleBtn.textContent = "⚡";
          modeToggleBtn.title = "切换模式 (Alt+E)：当前为【修改模式】，点击切回【填报模式】";
        }
        if (hintText) {
          hintText.innerHTML = "✏️ <b>修改模式</b>：可自由打字、选区修改卡片内容(自动保存)，不触发填入网页";
        }
        showToast("✏️ 已开启【修改模式】：可自由编辑卡片文字，不会触发填入网页！");
      } else {
        cardModal.classList.remove("rf-mode-edit-active");
        if (modeBtnFill) modeBtnFill.classList.add("active");
        if (modeBtnEdit) modeBtnEdit.classList.remove("active");
        if (modeToggleBtn) {
          modeToggleBtn.textContent = "✏️";
          modeToggleBtn.title = "切换模式 (Alt+E)：当前为【填报模式】，点击进入【修改模式】";
        }
        if (hintText) {
          hintText.innerHTML = "💡 <b>填报模式</b>：单击标签复制，单击输入框直接填入网页";
        }
        showToast("⚡ 已切回【填报模式】：单击输入框即可一键填入当前网页！");
      }
    }

    if (modeToggleBtn) modeToggleBtn.addEventListener("click", () => setEditMode(!isEditMode));
    if (modeBtnFill) modeBtnFill.addEventListener("click", () => setEditMode(false));
    if (modeBtnEdit) modeBtnEdit.addEventListener("click", () => setEditMode(true));

    // 5. 重构核心 2：单击输入框直接填入网页当前输入框 (修改编辑模式下直接放行原生聚焦打字修改)
    shadow.addEventListener("click", (e) => {
      const input = e.target.closest(".rf-form-control");
      if (input) {
        // 如果当前是修改编辑模式，直接退出，绝不触发网页自动填入，让用户正常打字和移动光标！
        if (isEditMode) return;

        const val = input.value;
        const lastEl = window.ResumeFillerContent && window.ResumeFillerContent.getLastActiveElement();
        if (lastEl && document.body.contains(lastEl)) {
          if (val) {
            window.ResumeFillerContent.fillFocusedInput(val);
            input.classList.add("rf-fill-pulse");
            showToast("✓ 已自动填入网页输入框！");
            setTimeout(() => {
              input.classList.remove("rf-fill-pulse");
            }, 450);
          }
        }
      }
    });

    // 6. 事件代理：定向整段经历填充 (education / internship / project)
    shadow.addEventListener("click", (e) => {
      const fillSecBtn = e.target.closest(".btn-fill-section");
      if (fillSecBtn) {
        const type = fillSecBtn.getAttribute("data-type");
        const index = parseInt(fillSecBtn.getAttribute("data-index"), 10);
        const secData = resumeData[type] && resumeData[type][index];
        if (!secData) return;

        if (window.ResumeFillerContent && window.ResumeFillerContent.fillSection) {
          const success = window.ResumeFillerContent.fillSection(type, secData);
          if (success) {
            showToast("已成功定向填充此段经历！");
          } else {
            showToast("请先点击网页中该经历板块的任意输入框");
          }
        }
      }
    });

    // 7. 表单输入自动双向绑定与保存 (基本信息 + 技能)
    shadow.addEventListener("input", (e) => {
      const input = e.target;
      const key = input.getAttribute("data-key");
      if (!key) return;

      if (key.startsWith("basic.")) {
        const subKey = key.split(".")[1];
        resumeData.basic[subKey] = input.value;
        saveData();
      } else if (key === "skills") {
        resumeData.skills = input.value;
        saveData();
      } else if (key === "languages") {
        resumeData.languages = input.value;
        saveData();
      } else if (input.classList.contains("card-input")) {
        const type = input.getAttribute("data-type");
        const index = parseInt(input.getAttribute("data-index"), 10);
        if (resumeData[type] && resumeData[type][index]) {
          resumeData[type][index][key] = input.value;
          saveData();
        }
      }
    });

    // 8. 新增各卡片
    shadow.getElementById("rf-btn-add-edu").addEventListener("click", () => {
      resumeData.education.push({
        school: "",
        degree: "",
        major: "",
        start: "",
        end: "",
        gpa: "",
        supervisor: "",
        majorDescription: "",
        thesisTopic: "",
        courses: "",
        researchDirection: "",
        department: "",
        labExperience: "",
        studentId: "",
        schoolLocation: ""
      });
      saveData();
      renderEducationList();
      showToast("已新增一段教育经历");
    });

    shadow.getElementById("rf-btn-add-intern").addEventListener("click", () => {
      resumeData.internship.push({ company: "", position: "", start: "", end: "", desc: "" });
      saveData();
      renderInternshipList();
      showToast("已新增一段工作实习");
    });

    shadow.getElementById("rf-btn-add-proj").addEventListener("click", () => {
      resumeData.project.push({ name: "", role: "", start: "", end: "", tech: "", desc: "", duty: "", result: "" });
      saveData();
      renderProjectList();
      showToast("已新增一段项目经历");
    });

    shadow.getElementById("rf-btn-add-honor").addEventListener("click", () => {
      resumeData.honors.push({ name: "", date: "", level: "" });
      saveData();
      renderHonorsList();
      showToast("已新增一段荣誉奖项");
    });

    shadow.getElementById("rf-btn-add-comp").addEventListener("click", () => {
      resumeData.competition.push({ name: "", start: "", end: "", desc: "" });
      saveData();
      renderCompetitionList();
      showToast("已新增一段赛事经验");
    });

    shadow.getElementById("rf-btn-add-paper").addEventListener("click", () => {
      resumeData.paper.push({ title: "", desc: "", result: "" });
      saveData();
      renderPaperList();
      showToast("已新增一篇论文/专利");
    });

    // 9. 删除卡片
    shadow.addEventListener("click", (e) => {
      const delBtn = e.target.closest(".btn-delete-card");
      if (delBtn) {
        const type = delBtn.getAttribute("data-type");
        const index = parseInt(delBtn.getAttribute("data-index"), 10);
        if (confirm("确定要删除此项内容吗？")) {
          resumeData[type].splice(index, 1);
          saveData();
          if (type === "education") renderEducationList();
          if (type === "internship") renderInternshipList();
          if (type === "project") renderProjectList();
          if (type === "honors") renderHonorsList();
          if (type === "competition") renderCompetitionList();
          if (type === "paper") renderPaperList();
          showToast("已删除对应内容");
        }
      }
    });

    // 10. 切换简历版本
    selectVersion.addEventListener("change", (e) => {
      const newId = e.target.value;
      const targetResume = resumesList.find((r) => r.id === newId);
      if (targetResume) {
        activeResumeId = newId;
        resumeData = mergeWithDefault(targetResume.data, defaultResumeData);
        saveData();
        updateAllViews();
        showToast(`已切换至版本：${targetResume.name}`);
      }
    });

    // 11. 重命名版本
    shadow.getElementById("rf-btn-version-rename").addEventListener("click", () => {
      const cur = resumesList.find((r) => r.id === activeResumeId);
      if (!cur) return;
      const newName = prompt("请输入当前版本的新名称：", cur.name);
      if (newName && newName.trim()) {
        cur.name = newName.trim();
        saveData();
        renderVersionDropdown();
        showToast("版本重命名成功！");
      }
    });

    // 12. 另存为新版本
    shadow.getElementById("rf-btn-version-add").addEventListener("click", () => {
      const newName = prompt("请输入新简历版本名称（如：大模型算法岗 / 前端开发岗）：");
      if (newName && newName.trim()) {
        const newId = "resume_" + Date.now();
        resumesList.push({
          id: newId,
          name: newName.trim(),
          data: JSON.parse(JSON.stringify(resumeData))
        });
        activeResumeId = newId;
        saveData();
        renderVersionDropdown();
        showToast(`已另存为新版本：${newName.trim()}`);
      }
    });

    // 13. 导出 JSON
    shadow.getElementById("rf-btn-export").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(resumeData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_data_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("简历配置已导出");
    });

    // 14. 导入 JSON
    const fileInput = shadow.getElementById("rf-file-input");
    shadow.getElementById("rf-btn-import").addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          resumeData = mergeWithDefault(imported, defaultResumeData);
          saveData();
          updateAllViews();
          showToast("简历数据导入成功！");
        } catch (err) {
          showToast("导入失败，JSON 格式不正确");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    // 15. 清空数据
    shadow.getElementById("rf-btn-clear").addEventListener("click", () => {
      if (confirm("确定要清空当前版本的所有简历内容吗？")) {
        resumeData = JSON.parse(JSON.stringify(defaultResumeData));
        saveData();
        updateAllViews();
        showToast("数据已清空");
      }
    });

    // 16. 全方位自由拖拽悬浮球 (支持屏幕任意放置与拖拽记忆)
    let isTriggerDragging = false;
    let triggerStartX = 0;
    let triggerStartY = 0;
    let triggerInitLeft = 0;
    let triggerInitTop = 0;

    function applySavedPositions() {
      // 1. 恢复卡片记忆位置
      const savedCardPos = localStorage.getItem("rf_card_pos");
      if (savedCardPos) {
        try {
          const { left, top } = JSON.parse(savedCardPos);
          if (typeof left === "number" && typeof top === "number") {
            const cardW = cardModal.offsetWidth || 410;
            const maxL = Math.max(0, window.innerWidth - cardW);
            const maxT = Math.max(0, window.innerHeight - 80);
            const validLeft = Math.max(0, Math.min(maxL, left));
            const validTop = Math.max(0, Math.min(maxT, top));
            cardModal.style.right = "auto";
            cardModal.style.bottom = "auto";
            cardModal.style.left = `${validLeft}px`;
            cardModal.style.top = `${validTop}px`;
          }
        } catch(e) {}
      } else {
        cardModal.style.right = "20px";
        cardModal.style.bottom = "30px";
      }

      // 2. 恢复悬浮球记忆位置
      const savedTriggerPos = localStorage.getItem("rf_trigger_pos");
      if (savedTriggerPos) {
        try {
          const { left, top } = JSON.parse(savedTriggerPos);
          if (typeof left === "number" && typeof top === "number") {
            const btnW = triggerBtn.offsetWidth || 135;
            const btnH = triggerBtn.offsetHeight || 36;
            const validLeft = Math.max(10, Math.min(window.innerWidth - btnW - 10, left));
            const validTop = Math.max(10, Math.min(window.innerHeight - btnH - 10, top));
            triggerBtn.style.right = "auto";
            triggerBtn.style.bottom = "auto";
            triggerBtn.style.left = `${validLeft}px`;
            triggerBtn.style.top = `${validTop}px`;
          }
        } catch(e) {}
      } else {
        triggerBtn.style.right = "20px";
        triggerBtn.style.bottom = "80px";
      }
    }
    applySavedPositions();

    triggerBtn.addEventListener("mousedown", (e) => {
      isTriggerDragging = false;
      triggerStartX = e.clientX;
      triggerStartY = e.clientY;

      const rect = triggerBtn.getBoundingClientRect();
      triggerInitLeft = rect.left;
      triggerInitTop = rect.top;

      triggerBtn.style.right = "auto";
      triggerBtn.style.bottom = "auto";
      triggerBtn.style.left = `${triggerInitLeft}px`;
      triggerBtn.style.top = `${triggerInitTop}px`;
      triggerBtn.style.transition = "none";

      function onTriggerMouseMove(moveEvent) {
        const dx = moveEvent.clientX - triggerStartX;
        const dy = moveEvent.clientY - triggerStartY;
        if (Math.hypot(dx, dy) > 4) {
          isTriggerDragging = true;
          const btnW = triggerBtn.offsetWidth || 135;
          const btnH = triggerBtn.offsetHeight || 36;
          let newL = triggerInitLeft + dx;
          let newT = triggerInitTop + dy;
          newL = Math.max(10, Math.min(window.innerWidth - btnW - 10, newL));
          newT = Math.max(10, Math.min(window.innerHeight - btnH - 10, newT));
          triggerBtn.style.left = `${newL}px`;
          triggerBtn.style.top = `${newT}px`;
        }
      }

      function onTriggerMouseUp() {
        triggerBtn.style.transition = "";
        if (isTriggerDragging) {
          const curRect = triggerBtn.getBoundingClientRect();
          localStorage.setItem("rf_trigger_pos", JSON.stringify({ left: curRect.left, top: curRect.top }));
          setTimeout(() => { isTriggerDragging = false; }, 60);
        }
        document.removeEventListener("mousemove", onTriggerMouseMove);
        document.removeEventListener("mouseup", onTriggerMouseUp);
      }

      document.addEventListener("mousemove", onTriggerMouseMove);
      document.addEventListener("mouseup", onTriggerMouseUp);
    });

    let isCardDragging = false;
    let cardStartX = 0;
    let cardStartY = 0;
    let cardInitLeft = 0;
    let cardInitTop = 0;
    let hasCardMoved = false;
    let cardJustDragged = false;

    cardHeader.addEventListener("mousedown", (e) => {
      // 点击按钮、选择框或输入项时不触发拖动
      if (e.target.closest("button, select, input, .rf-icon-btn, .rf-btn-smart-fill, #rf-site-menu")) return;
      isCardDragging = true;
      hasCardMoved = false;
      cardStartX = e.clientX;
      cardStartY = e.clientY;

      const rect = cardModal.getBoundingClientRect();
      cardInitLeft = rect.left;
      cardInitTop = rect.top;

      cardModal.style.right = "auto";
      cardModal.style.bottom = "auto";
      cardModal.style.left = `${cardInitLeft}px`;
      cardModal.style.top = `${cardInitTop}px`;
      cardModal.style.transition = "none"; // 拖动时关闭过渡动画，保证极致跟手

      function onCardMouseMove(moveEv) {
        if (!isCardDragging) return;
        const dx = moveEv.clientX - cardStartX;
        const dy = moveEv.clientY - cardStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          hasCardMoved = true;
        }
        let newL = cardInitLeft + dx;
        let newT = cardInitTop + dy;

        const maxL = Math.max(0, window.innerWidth - (cardModal.offsetWidth || 410));
        const maxT = Math.max(0, window.innerHeight - 70);
        newL = Math.max(0, Math.min(maxL, newL));
        newT = Math.max(0, Math.min(maxT, newT));

        cardModal.style.left = `${newL}px`;
        cardModal.style.top = `${newT}px`;
      }

      function onCardMouseUp() {
        if (isCardDragging) {
          isCardDragging = false;
          cardModal.style.transition = "";
          if (hasCardMoved) {
            cardJustDragged = true;
            setTimeout(() => { cardJustDragged = false; }, 80);
            const curRect = cardModal.getBoundingClientRect();
            localStorage.setItem("rf_card_pos", JSON.stringify({ left: curRect.left, top: curRect.top }));
          }
        }
        document.removeEventListener("mousemove", onCardMouseMove);
        document.removeEventListener("mouseup", onCardMouseUp);
      }

      document.addEventListener("mousemove", onCardMouseMove);
      document.addEventListener("mouseup", onCardMouseUp);
    });

    // 16.2 重置卡片位置回到右下角
    resetPosBtn.addEventListener("click", () => {
      localStorage.removeItem("rf_card_pos");
      cardModal.style.left = "auto";
      cardModal.style.top = "auto";
      cardModal.style.right = "20px";
      cardModal.style.bottom = "30px";
      showToast("已重置卡片位置到右下角");
    });

    // 16.3 多档透明度调节 (100% -> 75% -> 45%)
    const opacityLevels = [1, 0.75, 0.45];
    let curOpacityIdx = 0;
    opacityBtn.addEventListener("click", () => {
      curOpacityIdx = (curOpacityIdx + 1) % opacityLevels.length;
      const level = opacityLevels[curOpacityIdx];
      cardModal.style.opacity = level.toString();
      if (level < 1) {
        cardModal.style.backdropFilter = "blur(12px)";
      } else {
        cardModal.style.backdropFilter = "";
      }
      showToast(`当前透明度: ${Math.round(level * 100)}% (透视底层网页)`);
    });

    // 16.4 幽灵鼠标穿透模式开关 (Click-Through)
    function toggleGhostMode(forceState) {
      const willBeGhost = forceState !== undefined ? forceState : !cardModal.classList.contains("rf-ghost-mode");
      if (willBeGhost) {
        cardModal.classList.add("rf-ghost-mode");
        ghostBadge.classList.remove("rf-hidden");
        showToast("👻 鼠标穿透已开启！鼠标可直接穿透卡片点击底层网页 (Alt+T 或点右上角退出)");
      } else {
        cardModal.classList.remove("rf-ghost-mode");
        ghostBadge.classList.add("rf-hidden");
        showToast("已退出鼠标穿透，卡片交互已恢复");
      }
    }

    ghostBtn.addEventListener("click", () => toggleGhostMode(true));
    ghostBadge.addEventListener("click", () => toggleGhostMode(false));

    // 17. 智能气泡交互与事件绑定
    pillFillBtn.addEventListener("click", () => {
      if (currentTargetInput && currentDetectedField && currentDetectedField.value) {
        window.ResumeFillerContent.setElementValue(currentTargetInput, currentDetectedField.value);
        showToast(`✓ 已填入：${currentDetectedField.label}`);
        hidePill();
      }
    });

    pillCopyBtn.addEventListener("click", () => {
      if (currentDetectedField && currentDetectedField.value) {
        navigator.clipboard.writeText(currentDetectedField.value).then(() => {
          showToast("已成功复制到剪贴板！");
        });
      }
    });

    // 🪄 AI 重诊：当本地推断不准时，单点呼叫大模型重新诊断此输入框 (所有提示直接呈现在按钮旁，不弹外部Toast)
    if (pillRefineBtn) {
      pillRefineBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!currentTargetInput) return;

        // 按钮及旁边状态更新
        pillRefineBtn.textContent = "分析中...";
        pillRefineBtn.disabled = true;
        pillRefineBtn.style.opacity = "0.6";

        if (pillAiStatus) {
          pillAiStatus.className = "rf-pill-ai-status loading";
          pillAiStatus.style.display = "inline-flex";
          pillAiStatus.textContent = "⏳ 思考中...";
        }

        try {
          if (window.ResumeFillerContent && window.ResumeFillerContent.requestAiSingleFieldRefinement) {
            const slot = await window.ResumeFillerContent.requestAiSingleFieldRefinement(currentTargetInput);
            if (slot) {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status success";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = `✓ 已对齐: ${slot}`;
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2200);
              }
              showPillForInput(currentTargetInput); // 重新渲染气泡为精准项
            } else {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status error";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = "未匹配到合适槽位";
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2500);
              }
            }
          } else {
            if (pillAiStatus) {
              pillAiStatus.className = "rf-pill-ai-status error";
              pillAiStatus.style.display = "inline-flex";
              pillAiStatus.textContent = "未找到 AI 诊断引擎";
            }
          }
        } catch(err) {
          console.error("AI 重诊异常:", err);
          const errMsg = err.message || String(err);
          if (pillAiStatus) {
            pillAiStatus.className = "rf-pill-ai-status error";
            pillAiStatus.style.display = "inline-flex";
            pillAiStatus.textContent = "❌ " + (errMsg.length > 22 ? errMsg.slice(0, 20) + "..." : errMsg);
            setTimeout(() => {
              if (pillAiStatus) pillAiStatus.style.display = "none";
            }, 3500);
          }
        } finally {
          pillRefineBtn.textContent = "🪄AI重诊";
          pillRefineBtn.disabled = false;
          pillRefineBtn.style.opacity = "1";
        }
      });
    }

    // 监听整页 AI 拓扑分析完成事件，即时更新气泡
    window.addEventListener("rf-ai-mapping-updated", (e) => {
      if (currentTargetInput && document.body.contains(currentTargetInput)) {
        showPillForInput(currentTargetInput);
      }
    });

    pillCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hidePill();
    });

    function handleActiveElement(el) {
      if (!el) return;
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      const target = resolveTargetControl(el);
      if (target) {
        showPillForInput(target);
      }
    }

    // 页面焦点监听: 任何页面输入框获得焦点时，呼出对应跟随气泡
    document.addEventListener("focusin", (e) => handleActiveElement(e.target), true);

    document.addEventListener("click", (e) => {
      const el = e.target;
      if (!el) return;
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      const target = resolveTargetControl(el);
      if (target) {
        showPillForInput(target);
      } else {
        // 仅当点击了明确与当前输入框无关的非表单背景区域时，才平滑隐藏气泡
        if (currentTargetInput && !currentTargetInput.contains(el)) {
          const active = document.activeElement;
          const isFocusingInput = active && (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) || active.isContentEditable);
          if (!isFocusingInput) {
            hidePill();
          }
        }
      }
    }, true);

    window.addEventListener("scroll", updatePillPosition, { passive: true });
    window.addEventListener("resize", updatePillPosition, { passive: true });

    // 键盘快捷键监听:
    // Alt + Enter: 直接将气泡内容填入当前聚焦的输入框
    // Alt + F: 一键智能填充整页
    // Alt + C: 快速展开/折叠悬浮卡片
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "Enter" || e.keyCode === 13)) {
        if (!inlinePill.classList.contains("rf-pill-hidden") && currentTargetInput && currentDetectedField) {
          e.preventDefault();
          window.ResumeFillerContent.setElementValue(currentTargetInput, currentDetectedField.value);
          showToast(`✓ 已快捷填入：${currentDetectedField.label}`);
          hidePill();
        }
      } else if (e.altKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        smartFillBtn.click();
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        toggleCard();
      } else if (e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        toggleGhostMode();
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setEditMode(!isEditMode);
      }
    });

    // 18. 网站弹出规则管理交互与状态更新
    async function updateSiteMenuUI() {
      if (!siteDomainText) return;
      siteDomainText.textContent = currentHostname;

      let storageData;
      try {
        storageData = await new Promise((resolve) => {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], resolve);
          } else {
            resolve({
              rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
              rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
            });
          }
        });
      } catch (e) {
        storageData = { rf_whitelist_domains: [], rf_blacklist_domains: [] };
      }

      const whitelist = storageData.rf_whitelist_domains || [];
      const blacklist = storageData.rf_blacklist_domains || [];

      if (optSiteAuto) optSiteAuto.classList.remove("active");
      if (optSiteAlways) optSiteAlways.classList.remove("active");
      if (optSiteNever) optSiteNever.classList.remove("active");

      if (blacklist.some(d => currentHostname === d || currentHostname.endsWith("." + d))) {
        if (optSiteNever) optSiteNever.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = "🚫已隐藏小球";
          siteStatusBadge.style.color = "var(--danger)";
        }
      } else if (whitelist.some(d => currentHostname === d || currentHostname.endsWith("." + d))) {
        if (optSiteAlways) optSiteAlways.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = "✅始终弹气泡";
          siteStatusBadge.style.color = "#059669";
        }
      } else {
        if (optSiteAuto) optSiteAuto.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = isRecruitmentPage ? "⚡智能(网申页)" : "⚡智能(普通页)";
          siteStatusBadge.style.color = "var(--primary)";
        }
      }
    }

    if (btnSiteSetting && siteMenu) {
      function closeSiteMenu() {
        if (!siteMenu) return;
        siteMenu.classList.add("rf-hidden");
        siteMenu.style.display = "none";
      }

      function openSiteMenu() {
        if (!siteMenu) return;
        siteMenu.classList.remove("rf-hidden");
        siteMenu.style.display = "flex";
        updateSiteMenuUI();
      }

      btnSiteSetting.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = siteMenu.classList.contains("rf-hidden") || siteMenu.style.display === "none";
        if (isHidden) {
          openSiteMenu();
        } else {
          closeSiteMenu();
        }
      });

      const btnCloseSiteMenu = shadow.getElementById("rf-btn-close-site-menu");
      if (btnCloseSiteMenu) {
        btnCloseSiteMenu.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeSiteMenu();
        });
      }

      // 点击卡片内部其它地方，关闭设置菜单
      cardModal.addEventListener("click", (e) => {
        if (!siteMenu.contains(e.target) && e.target !== btnSiteSetting && !btnSiteSetting.contains(e.target)) {
          closeSiteMenu();
        }
      });

      // 点击页面其它任何地方，也关闭设置菜单
      document.addEventListener("click", () => {
        closeSiteMenu();
      }, true);

      async function saveDomainRules(newWl, newBl) {
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
              rf_whitelist_domains: newWl,
              rf_blacklist_domains: newBl
            });
          }
        } catch(e) {}
        localStorage.setItem("rf_whitelist_domains", JSON.stringify(newWl));
        localStorage.setItem("rf_blacklist_domains", JSON.stringify(newBl));
      }

      if (optSiteAuto) {
        optSiteAuto.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const wl = (storageData.rf_whitelist_domains || []).filter(d => d !== currentHostname);
          const bl = (storageData.rf_blacklist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          closeSiteMenu();
          const res = await checkPageActivation();
          isRecruitmentPage = res.isRecruitment;
          isPillEnabled = res.pillEnabled;
          isBlacklisted = res.isBlacklisted;

          // 恢复智能模式：小球常驻，气泡由是否网申页面决定
          triggerBtn.classList.remove("rf-hidden");
          if (isRecruitmentPage) {
            showToast("⚡ 已恢复智能模式：当前为网申页面，已启用智能气泡！");
          } else {
            showToast("⚡ 已恢复智能模式：悬浮按钮常驻，普通页面不弹气泡打扰");
            hidePill();
          }
          updateSiteMenuUI();
        });
      }

      if (optSiteAlways) {
        optSiteAlways.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const wl = Array.from(new Set([...(storageData.rf_whitelist_domains || []), currentHostname]));
          const bl = (storageData.rf_blacklist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          isPillEnabled = true;
          isBlacklisted = false;
          closeSiteMenu();
          triggerBtn.classList.remove("rf-hidden");
          showToast("✅ 已设置：在此网站输入框聚焦时始终自动弹推荐气泡！");
          updateSiteMenuUI();
        });
      }

      if (optSiteNever) {
        optSiteNever.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const bl = Array.from(new Set([...(storageData.rf_blacklist_domains || []), currentHostname]));
          const wl = (storageData.rf_whitelist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          isPillEnabled = false;
          isBlacklisted = true;
          closeSiteMenu();
          cardModal.classList.add("rf-hidden");
          triggerBtn.classList.add("rf-hidden");
          hidePill();
          showToast("🚫 已设置：在此网站彻底隐藏悬浮球 (需要时可点插件图标唤出)");
          updateSiteMenuUI();
        });
      }
    }

    // 19. 页面智能启用状态初始化判定
    checkPageActivation().then((res) => {
      isRecruitmentPage = res.isRecruitment;
      isPillEnabled = res.pillEnabled;
      isBlacklisted = res.isBlacklisted;

      if (isBlacklisted) {
        // 用户黑名单：彻底隐藏小球与气泡
        triggerBtn.classList.add("rf-hidden");
        cardModal.classList.add("rf-hidden");
        hidePill();
      } else {
        // 默认状态：小球始终显示（方便随时点击），大卡片保持折叠，绝不自动弹大卡片遮挡屏幕
        if (isCardCollapsed) {
          triggerBtn.classList.remove("rf-hidden");
          cardModal.classList.add("rf-hidden");
        } else {
          triggerBtn.classList.add("rf-hidden");
          cardModal.classList.remove("rf-hidden");
        }
      }
      updateSiteMenuUI();
    });

    // 20. 监听 background 发来的展开切换消息
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === "toggleFloatingCard") {
          toggleCard();
        }
      });
    }
  }

  // 初始化加载
  loadData().then(() => {
    initEvents();
  });
})();
