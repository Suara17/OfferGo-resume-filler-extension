/**
 * OfferGo - 页面悬浮卡片 (Floating Card Widget)
 * 基于 Shadow DOM 隔离页面样式，支持折叠悬浮球、展开多Tab卡片、单项/整段填充、复制及实时数据双向同步。
 */

(function () {
  const isTopFrame = (window === window.top);
  // 避免在非正常页面或重复注入 (允许主页面及 http/file/srcdoc 嵌套 iframe 注入以支持焦点智能气泡)
  if (!isTopFrame && !window.location.href.startsWith("http") && !window.location.href.startsWith("file") && window.location.href !== "about:srcdoc" && window.location.href !== "about:blank") return;
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
      residence: "",
      resumeAttachment: null, // 简历附件对象: { fileName, dataUrl, mimeType, size }
      attachments: []
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

  // --- [src/card/styles.css] ---
  styleEl.textContent = `
* {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    :host {
      --primary: #4338ca;
      --primary-hover: #3730a3;
      --primary-light: #eef2ff;
      --primary-border: #c7d2fe;
      --bg-card: #ffffff;
      --bg-header: #ffffff;
      --bg-hover: #f8fafc;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #10b981;
      --success-light: #ecfdf5;
      --shadow-lg: 0 20px 40px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.07);
      --shadow-btn: 0 4px 14px rgba(15, 23, 42, 0.28);
      --radius-lg: 16px;
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
      background: #3b82f6;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.18);
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
      background: #2563eb;
      transform: scale(1.03);
    }
    .rf-pill-fill-btn:active {
      transform: scale(0.96);
    }
    .rf-pill-copy-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .rf-pill-copy-btn:hover {
      background: rgba(255, 255, 255, 0.22);
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
    .rf-pill-expand-card-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s ease;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .rf-pill-expand-card-btn:hover {
      background: #334155;
      color: #ffffff;
      border-color: #94a3b8;
    }

    /* 悬浮球 (折叠状态：极简高级生产力工具图标，拒绝廉价AI味) */
    .rf-floating-btn {
      pointer-events: auto;
      position: fixed;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      padding: 0;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.28), 0 1px 3px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.14);
      user-select: none;
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, opacity 0.35s ease, background 0.2s ease, left 0.4s cubic-bezier(0.25, 1, 0.5, 1);
      z-index: 2147483647;
      opacity: 1;
    }
    .rf-floating-btn:hover {
      transform: translateY(-1px) scale(1.08);
      background: #1e293b;
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.38), 0 2px 6px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.26);
      opacity: 1 !important;
    }
    .rf-floating-btn:active {
      transform: scale(0.92);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25), inset 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    .rf-floating-btn.rf-hidden {
      display: none !important;
    }
    .rf-floating-svg {
      display: block;
      transition: transform 0.2s ease;
    }
    .rf-floating-btn:hover .rf-floating-svg {
      transform: scale(1.04);
    }
    /* 超过3秒无操作自动变半透明 */
    .rf-floating-btn.rf-idle-fade {
      opacity: 0.32;
    }
    .rf-floating-btn.rf-idle-fade:hover {
      opacity: 1 !important;
    }
    /* 超过30秒无操作自动贴边半隐藏收纳 (左/右) */
    .rf-floating-btn.rf-docked-left {
      transform: translateX(-16px);
      opacity: 0.38;
    }
    .rf-floating-btn.rf-docked-left:hover {
      transform: translateX(0) scale(1.08);
      opacity: 1 !important;
    }
    .rf-floating-btn.rf-docked-right {
      transform: translateX(16px);
      opacity: 0.38;
    }
    .rf-floating-btn.rf-docked-right:hover {
      transform: translateX(0) scale(1.08);
      opacity: 1 !important;
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
      opacity: 0 !important;
      transform: scale(0.3) translateY(20px) !important;
      pointer-events: none !important;
      visibility: hidden !important;
      display: none !important;
    }
    /* 悬浮卡片超过3秒无操作自动变半透明 */
    .rf-card-modal.rf-idle-fade {
      opacity: 0.36 !important;
    }
    .rf-card-modal.rf-idle-fade:hover {
      opacity: 1 !important;
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
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
      padding: 12px 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 9px;
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
      gap: 6px;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--text-main);
      cursor: pointer;
      user-select: none;
      padding: 3px 6px;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease, color 0.15s ease;
      letter-spacing: -0.01em;
    }
    .rf-logo-title:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .rf-header-controls {
      display: flex;
      align-items: center;
      gap: 3px;
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
      font-size: 12.5px;
    }
    .rf-icon-btn:hover {
      background: #f1f5f9;
      border-color: #e2e8f0;
      color: var(--text-main);
    }
    .rf-icon-btn.rf-btn-close:hover {
      background: #fef2f2;
      color: var(--danger);
      border-color: #fecaca;
    }

    /* 快捷操作栏 */
    .rf-action-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rf-select-version {
      flex: 1;
      height: 30px;
      font-size: 12px;
      font-weight: 500;
      border-radius: var(--radius-sm);
      border: 1px solid #e2e8f0;
      padding: 0 8px;
      color: var(--text-main);
      background: #f8fafc;
      outline: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .rf-select-version:hover {
      border-color: #cbd5e1;
      background: #ffffff;
    }
    .rf-select-version:focus {
      border-color: #0f172a;
      background: #ffffff;
    }

    .rf-btn-smart-fill {
      background: #0f172a;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-sm);
      padding: 0 12px;
      height: 30px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.14);
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .rf-btn-smart-fill:hover {
      background: #1e293b;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22);
    }
    .rf-btn-smart-fill:active {
      transform: translateY(0);
    }

    /* Tabs 导航 (现代多色微边框胶囊风格) */
    .rf-tabs-nav {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;
      scrollbar-width: none;
      flex-shrink: 0;
      padding: 6px 8px;
      gap: 5px;
    }
    .rf-tabs-nav::-webkit-scrollbar {
      display: none;
    }
    .rf-tab-item {
      padding: 4px 9px;
      font-size: 11.5px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid transparent;
      user-select: none;
    }

    /* 7大板块专属主题色彩边框与微底色 */
    /* 1. 基本信息: 经典极简深蓝靛 */
    .rf-tab-item[data-tab="basic"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="basic"]:hover {
      border-color: #3b82f6;
      color: #1d4ed8;
      background: #eff6ff;
    }
    .rf-tab-item[data-tab="basic"].active {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #93c5fd;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.12);
    }

    /* 2. 教育背景: 典雅知识祖母绿 */
    .rf-tab-item[data-tab="education"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="education"]:hover {
      border-color: #10b981;
      color: #047857;
      background: #ecfdf5;
    }
    .rf-tab-item[data-tab="education"].active {
      color: #047857;
      background: #ecfdf5;
      border-color: #6ee7b7;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(16, 185, 129, 0.12);
    }

    /* 3. 工作实习: 活力商务暖琥珀 */
    .rf-tab-item[data-tab="internship"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="internship"]:hover {
      border-color: #f59e0b;
      color: #b45309;
      background: #fffbeb;
    }
    .rf-tab-item[data-tab="internship"].active {
      color: #b45309;
      background: #fffbeb;
      border-color: #fcd34d;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(245, 158, 11, 0.12);
    }

    /* 4. 项目经历: 前沿沉稳极光紫 */
    .rf-tab-item[data-tab="project"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="project"]:hover {
      border-color: #8b5cf6;
      color: #6d28d9;
      background: #f5f3ff;
    }
    .rf-tab-item[data-tab="project"].active {
      color: #6d28d9;
      background: #f5f3ff;
      border-color: #c4b5fd;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(139, 92, 246, 0.12);
    }

    /* 5. 技能荣誉: 敏捷先锋天青蓝 */
    .rf-tab-item[data-tab="skills"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="skills"]:hover {
      border-color: #06b6d4;
      color: #0e7490;
      background: #ecfeff;
    }
    .rf-tab-item[data-tab="skills"].active {
      color: #0e7490;
      background: #ecfeff;
      border-color: #67e8f9;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(6, 182, 212, 0.12);
    }

    /* 6. 赛事论文: 权威学术玫瑰红 */
    .rf-tab-item[data-tab="paper-comp"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="paper-comp"]:hover {
      border-color: #f43f5e;
      color: #be123c;
      background: #fff1f2;
    }
    .rf-tab-item[data-tab="paper-comp"].active {
      color: #be123c;
      background: #fff1f2;
      border-color: #fda4af;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(244, 63, 94, 0.12);
    }

    /* 7. 接口设置: 极客深曜石冷灰 */
    .rf-tab-item[data-tab="ai-config"] {
      color: #334155;
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .rf-tab-item[data-tab="ai-config"]:hover {
      border-color: #475569;
      color: #0f172a;
      background: #f1f5f9;
    }
    .rf-tab-item[data-tab="ai-config"].active {
      color: #0f172a;
      background: #f1f5f9;
      border-color: #94a3b8;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
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
      border: 1px solid #e2e8f0;
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
      border-color: #0f172a;
      box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
    }
    .rf-form-control.rf-fill-pulse {
      border-color: var(--success) !important;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25) !important;
      background: var(--success-light) !important;
    }
    textarea.rf-form-control {
      min-height: 52px;
      resize: vertical;
      line-height: 1.45;
    }
    .rf-field-btn {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      cursor: pointer;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 22px;
      transition: all 0.12s ease;
    }
    .rf-field-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #cbd5e1;
    }
    .rf-field-btn.rf-btn-fill {
      color: #0f172a;
      background: #f1f5f9;
      border-color: #cbd5e1;
      font-weight: 600;
    }
    .rf-field-btn.rf-btn-fill:hover {
      background: #e2e8f0;
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
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-md);
      padding: 11px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      position: relative;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .rf-sub-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06);
    }
    .rf-sub-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 7px;
      border-bottom: 1px solid #f1f5f9;
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
      border: 1px dashed #cbd5e1;
      color: #475569;
      border-radius: var(--radius-sm);
      padding: 8px;
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
      border-color: #0f172a;
      color: #0f172a;
      background: #f8fafc;
    }

    /* 底部操作区 */
    .rf-footer {
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      padding: 8px 14px;
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

    /* 通用小按钮 / 按钮行 / 行内链接 / 面板底部提示（密码助手面板共用） */
    .rf-sms-row { display: flex; gap: 6px; }
    .rf-sms-btn {
      flex: 1;
      border: 1px solid var(--border-color);
      background: #ffffff;
      color: var(--text-main);
      border-radius: 7px;
      padding: 6px 8px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.14s ease;
      white-space: nowrap;
    }
    .rf-sms-btn:hover { background: var(--bg-hover); border-color: #cbd5e1; }
    .rf-sms-btn.primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #ffffff;
    }
    .rf-sms-btn.primary:hover { background: var(--primary-hover); }
    .rf-sms-link-btn {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 11px;
      cursor: pointer;
      padding: 0 4px;
      font-weight: 600;
    }
    .rf-sms-link-btn:hover { text-decoration: underline; }
    .rf-sms-tip {
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.5;
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
    }

    /* 智能密码生成器浮层 */
    .rf-pwd-menu {
      position: absolute;
      top: 44px;
      right: 10px;
      width: 320px;
      max-height: 85vh;
      overflow-y: auto;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 10px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: rf-menu-in 0.15s ease-out;
    }
    .rf-pwd-menu.rf-hidden { display: none !important; }
    .rf-pwd-box {
      background: #f8fafc;
      border: 1px dashed var(--border-color);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rf-pwd-val-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .rf-pwd-val {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 1.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color: var(--primary);
      word-break: break-all;
      user-select: all;
    }
    .rf-pwd-meta {
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .rf-pwd-strength {
      font-size: 10.5px;
      font-weight: 600;
      color: #059669;
    }
    .rf-pwd-input-area {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rf-pwd-input-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rf-pwd-rule-input {
      width: 100%;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11.5px;
      line-height: 1.4;
      color: var(--text-main);
      background: #ffffff;
      outline: none;
      resize: vertical;
      min-height: 48px;
      box-sizing: border-box;
      font-family: inherit;
    }
    .rf-pwd-rule-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.12);
    }
    .rf-pwd-preset-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 2px;
    }
    .rf-pwd-tag {
      font-size: 10px;
      background: #f1f5f9;
      color: var(--text-secondary);
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      user-select: none;
      transition: all 0.12s ease;
    }
    .rf-pwd-tag:hover {
      background: var(--primary-light);
      color: var(--primary);
      border-color: var(--primary-border);
    }
    .rf-pwd-status {
      font-size: 11px;
      padding: 5px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: var(--text-secondary);
      line-height: 1.45;
      word-break: break-all;
    }
    .rf-pwd-status.ok { background: var(--success-light); color: #047857; }
    /* 左侧分块快速导航布局 */
    .rf-tab-panel.active {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 10px;
      min-height: 100%;
    }
    .rf-section-nav {
      flex: 0 0 104px;
      width: 104px;
      position: sticky;
      top: 0;
      align-self: flex-start;
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 4px 3px;
      max-height: 100%;
      overflow-y: auto;
      scrollbar-width: none;
      border-right: 1px solid #e2e8f0;
    }
    .rf-section-nav::-webkit-scrollbar { display: none; }
    .rf-section-nav-item {
      width: 100%;
      min-height: 29px;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: #64748b;
      font-size: 10.5px;
      line-height: 1.2;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .rf-section-nav-item:hover {
      background: #eef2ff;
      color: #4338ca;
    }
    .rf-section-nav-item.active {
      background: #e0e7ff;
      color: #3730a3;
      border-color: #c7d2fe;
      font-weight: 700;
    }
    .rf-section-nav-dot {
      width: 5px;
      height: 5px;
      flex: 0 0 5px;
      border-radius: 50%;
      background: #cbd5e1;
    }
    .rf-section-nav-item.has-content .rf-section-nav-dot {
      background: #10b981;
    }
    .rf-section-nav-item.active .rf-section-nav-dot {
      background: #4f46e5;
    }
    .rf-section-nav-item > span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rf-section-scroll {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 100%;
    }
    .rf-section-scroll > .rf-form-group,
    .rf-section-scroll > .rf-sub-card,
    .rf-section-scroll > .rf-grid-2,
    .rf-section-scroll > .rf-grid-3,
    .rf-section-scroll > .rf-btn-add,
    .rf-section-scroll > .rf-form-control,
    .rf-section-scroll > div {
      scroll-margin-top: 10px;
    }
    @media (max-width: 440px) {
      .rf-section-nav { flex-basis: 88px; width: 88px; }
      .rf-section-nav-item { font-size: 9.5px; padding-left: 4px; padding-right: 4px; }
      .rf-card-body { padding-left: 8px; padding-right: 8px; }
    }

    /* 全局 Toast 提示 (穿透所有层级，居中浮动) */

    /* 站点密码保存与备忘展示区 */
    .rf-pwd-site-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11px;
      color: var(--text-secondary);
      background: #f8fafc;
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }
    .rf-pwd-site-name {
      font-weight: 700;
      color: var(--text-main);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rf-pwd-account-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rf-pwd-account-input {
      flex: 1;
      height: 28px;
      border: 1px solid var(--border-color);
      border-radius: 5px;
      padding: 0 8px;
      font-size: 11px;
      color: var(--text-main);
      background: #ffffff;
      outline: none;
      box-sizing: border-box;
    }
    .rf-pwd-account-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.1);
    }
    .rf-pwd-saved-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 7px 9px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .rf-pwd-saved-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #166534;
    }
    .rf-pwd-saved-info {
      font-size: 11px;
      color: #15803d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border: 1px dashed #86efac;
      padding: 4px 8px;
      border-radius: 5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .rf-pwd-saved-actions {
      display: flex;
      gap: 4px;
    }
    .rf-pwd-saved-btn {
      flex: 1;
      height: 24px;
      font-size: 10.5px;
      font-weight: 600;
      border-radius: 4px;
      border: 1px solid #86efac;
      background: #ffffff;
      color: #166534;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
    }
    .rf-pwd-saved-btn:hover {
      background: #dcfce7;
    }
    .rf-pwd-saved-btn.danger {
      flex: 0 0 24px;
      color: #b91c1c;
      border-color: #fca5a5;
    }
    .rf-pwd-saved-btn.danger:hover {
      background: #fee2e2;
    }

    /* 保险库全部站点密码列表抽屉 */
    .rf-pwd-vault-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px dashed var(--border-color);
      cursor: pointer;
      user-select: none;
    }
    .rf-pwd-vault-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .rf-pwd-vault-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      max-height: 180px;
      overflow-y: auto;
    }
    .rf-pwd-vault-item {
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rf-pwd-vault-item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
    .rf-pwd-vault-item-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11px;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

  // --- [src/card/template.html] ---
  const container = document.createElement("div");
  container.innerHTML = `
<!-- 全局独立 Toast 提示 (无论卡片是否折叠，屏幕居中浮动) -->
    <div class="rf-global-toast" id="rf-toast">提示信息</div>

    <!-- 1. 输入框焦点跟随智能气泡 -->
    <div class="rf-inline-pill rf-pill-hidden" id="rf-inline-pill">
      <div class="rf-pill-body">
        <span id="rf-pill-ai-icon" title="智能槽位匹配" style="cursor: pointer; opacity: 0.85;">✦</span>
        <span class="rf-pill-tag" id="rf-pill-tag">姓名</span>
        <span style="opacity: 0.4;">:</span>
        <span class="rf-pill-val" id="rf-pill-val">李某某</span>
      </div>
      <button class="rf-pill-fill-btn" id="rf-pill-fill-btn" title="单击或按快捷键自动填入">↵ 填入</button>
      <button class="rf-pill-copy-btn" id="rf-pill-copy-btn" title="复制内容">复制</button>
      <button class="rf-pill-copy-btn" id="rf-pill-refine-btn" title="不准确？点击呼唤大模型深度诊断此框" style="background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2); color: #cbd5e1;">重诊</button>
      <span id="rf-pill-ai-status" class="rf-pill-ai-status" style="display: none;"></span>
      <div class="rf-pill-suggestions" id="rf-pill-suggestions"></div>
      <button class="rf-pill-expand-card-btn" id="rf-pill-expand-card-btn" title="就地展开完整简历面板">展开面板 ↗</button>
      <button class="rf-pill-close-btn" id="rf-pill-close-btn" title="关闭气泡">×</button>
    </div>

    <!-- 退出鼠标穿透胶囊 (穿透模式下常驻) -->
    <div class="rf-ghost-badge rf-hidden" id="rf-ghost-badge" title="点击退出鼠标穿透模式 (快捷键 Alt+T)">
      <span>👻</span>
      <span>穿透模式 (点击退出 / Alt+T)</span>
    </div>

    <!-- 2. 悬浮折叠球 (极简现代矢量图标，克制高级) -->
    <div class="rf-floating-btn" id="rf-trigger-btn" title="OfferGo-网申简历快速填写助手 (单击展开，可任意拖拽放置)">
      <svg class="rf-floating-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3.5" y="2.5" width="13" height="17" rx="2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="6.5" y1="6.5" x2="11" y2="6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.85"/>
        <line x1="6.5" y1="13.5" x2="10.5" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.75"/>
        <circle cx="16.5" cy="16.5" r="5" fill="#0ea5e9" stroke="#0f172a" stroke-width="1.5"/>
        <path d="M17 13.8L14.9 16.6H16.9L16.1 19.2L18.8 16.3H16.9L17 13.8Z" fill="#ffffff"/>
      </svg>
    </div>

    <!-- 3. 悬浮卡片 -->
    <div class="rf-card-modal ${isCardCollapsed ? 'rf-hidden' : ''}" id="rf-card-modal">

      <!-- 头部 -->
      <div class="rf-header" id="rf-header">
        <div class="rf-header-top">
          <div class="rf-logo-title" id="rf-logo-title" title="单击卡片任意空白区域立即折叠 (单击小球就地展开)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
              <rect x="3.5" y="2.5" width="13" height="17" rx="2.6" stroke="#4338ca" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="6.5" y1="6.5" x2="11" y2="6.5" stroke="#4338ca" stroke-width="1.6" stroke-linecap="round"/>
              <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="#4338ca" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.85"/>
              <line x1="6.5" y1="13.5" x2="10.5" y2="13.5" stroke="#4338ca" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.75"/>
              <circle cx="16.5" cy="16.5" r="5" fill="#0ea5e9" stroke="#ffffff" stroke-width="1.5"/>
              <path d="M17 13.8L14.9 16.6H16.9L16.1 19.2L18.8 16.3H16.9L17 13.8Z" fill="#ffffff"/>
            </svg>
          </div>
          <div class="rf-header-controls">
            <button class="rf-icon-btn" id="rf-btn-password-gen" title="智能密码生成器：按格式要求生成随机合规密码并填入">🔑</button>
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

        <!-- 智能密码生成器浮层 (自然语言规则解析/AI生成/一键填入主密码与确认密码) -->
        <!-- 智能密码生成器浮层 (自然语言规则解析/AI生成/一键填入主密码与确认密码/站点密码保存) -->
        <div class="rf-pwd-menu rf-hidden" id="rf-pwd-menu" style="display: none;">
          <div class="rf-site-menu-title">
            <span>🔑 智能密码生成器</span>
            <button id="rf-btn-close-pwd-menu" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: var(--text-secondary); cursor: pointer; font-size: 13px; font-weight: bold; width: 22px; height: 22px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" title="关闭">✕</button>
          </div>

          <!-- 当前站点提示与账号关联行 -->
          <div class="rf-pwd-site-banner">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              🌐 站点: <b class="rf-pwd-site-name" id="rf-pwd-site-name">检测中…</b>
            </span>
            <span id="rf-pwd-site-badge" style="font-size:10px; color:#4338ca; background:#eef2ff; padding:1px 5px; border-radius:4px; white-space:nowrap;">求职站点</span>
          </div>

          <!-- 账号关联与保存按钮行 -->
          <div class="rf-pwd-account-row">
            <input type="text" class="rf-pwd-account-input" id="rf-pwd-account-input" placeholder="关联账号(手机号/邮箱/用户名)">
            <button type="button" class="rf-sms-btn" id="rf-pwd-btn-save-site" style="height:28px; padding:0 8px; font-size:11px; background:#ecfdf5; color:#047857; border-color:#a7f3d0; font-weight:700; white-space:nowrap;" title="保存生成的密码到当前站点备忘录">💾 保存此站</button>
          </div>

          <!-- 本站已存密码快捷卡片 (有保存时动态呈现) -->
          <div class="rf-pwd-saved-card" id="rf-pwd-current-site-card" style="display: none;">
            <div class="rf-pwd-saved-header">
              <span>📌 本站已保存密码</span>
              <span id="rf-pwd-saved-time" style="font-size:10px; font-weight:normal; opacity:0.8;"></span>
            </div>
            <div class="rf-pwd-saved-info">
              <span id="rf-pwd-saved-acc" style="font-weight:600;">——</span>
              <span id="rf-pwd-saved-val" style="letter-spacing:1px;">••••••••</span>
              <button type="button" id="rf-pwd-saved-toggle-eye" style="background:none; border:none; cursor:pointer; font-size:11px; color:#15803d; padding:0 2px;">👁️</button>
            </div>
            <div class="rf-pwd-saved-actions">
              <button type="button" class="rf-pwd-saved-btn" id="rf-pwd-saved-btn-fill">⚡ 填入此密码</button>
              <button type="button" class="rf-pwd-saved-btn" id="rf-pwd-saved-btn-copy">📋 复制</button>
              <button type="button" class="rf-pwd-saved-btn danger" id="rf-pwd-saved-btn-del" title="删除本站已保存密码">🗑️</button>
            </div>
          </div>

          <!-- 密码展示卡片 -->
          <div class="rf-pwd-box">
            <div class="rf-pwd-val-row">
              <span class="rf-pwd-val" id="rf-pwd-val">P@ssw0rd2026!</span>
              <button type="button" id="rf-pwd-toggle-eye" title="切换显示/隐藏" style="background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-muted); padding:2px;">👁️</button>
            </div>
            <div class="rf-pwd-meta">
              <span id="rf-pwd-desc">13位 · 大小写+数字+特殊字符</span>
              <span class="rf-pwd-strength" id="rf-pwd-strength">🟢 强密码</span>
            </div>
          </div>

          <!-- 当前页面密码框探测状态 -->
          <div class="rf-pwd-status" id="rf-pwd-status">正在检测页面密码输入框…</div>

          <!-- 操作按钮行 -->
          <div class="rf-sms-row">
            <button class="rf-sms-btn primary" id="rf-pwd-btn-fill" title="自动填入主密码框与确认密码框">⚡ 填入密码框</button>
            <button class="rf-sms-btn" id="rf-pwd-btn-pick" title="鼠标点击页面任意输入框直接填入">👉 点选填入</button>
          </div>

          <div class="rf-sms-row">
            <button class="rf-sms-btn" id="rf-pwd-btn-regen" title="换一个符合要求的随机密码">🎲 换一个</button>
            <button class="rf-sms-btn" id="rf-pwd-btn-copy" title="复制当前密码到剪贴板">📋 复制密码</button>
          </div>

          <!-- 规则输入区 -->
          <div class="rf-pwd-input-area">
            <div class="rf-pwd-input-label">
              <span>密码格式要求 (AI智能解析)：</span>
              <button type="button" class="rf-sms-link-btn" id="rf-pwd-btn-extract" title="从页面密码框及其附近的说明文字自动提取格式要求">🔍 提取网页提示</button>
            </div>
            <textarea class="rf-pwd-rule-input" id="rf-pwd-rule-input" placeholder="例如：8-16位，必须包含大写字母、小写字母、数字和特殊字符"></textarea>
            
            <div class="rf-pwd-preset-tags">
              <span class="rf-pwd-tag" data-rule="8-16位，包含大写字母、小写字母、数字和特殊符号">8-16位 全字符</span>
              <span class="rf-pwd-tag" data-rule="8-20位，必须包含大小写字母和数字">8-20位 字母+数字</span>
              <span class="rf-pwd-tag" data-rule="12位高强度随机密码，包含大小写、数字及符号">12位 强随机</span>
              <span class="rf-pwd-tag" data-rule="6位纯数字密码">6位 纯数字</span>
            </div>
          </div>

          <button class="rf-sms-btn" id="rf-pwd-btn-ai-generate" style="background:#eef2ff; color:#4338ca; border-color:#c7d2fe; font-weight:700;" title="调用大模型理解要求并生成合规随机密码">🪄 AI 按要求生成新密码</button>

          <!-- 全站点已保存密码备忘折叠抽屉 -->
          <div class="rf-pwd-vault-header" id="rf-pwd-vault-toggle">
            <span class="rf-pwd-vault-title">
              <span>🗂️ 已保存密码备忘</span>
              <span id="rf-pwd-vault-count" style="font-size:10px; background:#e2e8f0; color:#475569; padding:0 5px; border-radius:10px; font-weight:bold;">0</span>
            </span>
            <span id="rf-pwd-vault-arrow" style="font-size:10px; color:var(--text-muted);">▾</span>
          </div>
          <div id="rf-pwd-vault-drawer" style="display: none;">
            <div style="display:flex; gap:4px; margin-bottom:4px;">
              <input type="text" class="rf-pwd-account-input" id="rf-pwd-vault-search" placeholder="🔍 搜索站点/账号..." style="height:24px; font-size:10.5px;">
              <button type="button" id="rf-pwd-vault-export" class="rf-sms-link-btn" title="导出所有站点密码为 JSON">📥导出</button>
            </div>
            <div class="rf-pwd-vault-container" id="rf-pwd-vault-list"></div>
          </div>

          <div class="rf-sms-tip">
            💡 支持任意自然语言规则，AI 自动理解并生成。<br>
            若页面包含“密码”与“确认密码”两个框，点击【填入】将<b>同时自动填好</b>！
          </div>
        </div>

        <div class="rf-action-bar">
          <select class="rf-select-version" id="rf-select-version"></select>
          <button class="rf-btn-smart-fill" id="rf-btn-start-agent" style="background: linear-gradient(135deg, #4f46e5, #4338ca); border-color: #6366f1;" title="启动 Zero-PII 符号化 Agent 代填 (支持多经历卡片扩增与搜索下拉框求解)">
            🤖 Agent代填
          </button>
        </div>

        <!-- Agent 运行状态即时交互看板 -->
        <div id="rf-agent-status-panel" class="rf-hidden" style="display: none; margin: 6px 12px; background: linear-gradient(135deg, #1e1b4b, #312e81); border: 1px solid rgba(129, 140, 248, 0.4); border-radius: 10px; padding: 8px 12px; color: #ffffff; font-size: 11.5px; box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span id="rf-agent-status-icon">🤖</span>
              <span id="rf-agent-status-title" style="font-weight: 700; color: #93c5fd;">网申 Agent 待命</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span id="rf-agent-status-badge" style="font-size: 10px; padding: 1px 6px; border-radius: 10px; background: rgba(56, 189, 248, 0.25); color: #38bdf8; font-weight: bold;">就绪</span>
              <button id="rf-btn-copy-audit" title="一键生成并复制当前页面填充率与未填项 JSON 诊断报告" style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); color: #e2e8f0; border-radius: 6px; padding: 1px 6px; font-size: 10px; cursor: pointer;">📊 复制审计</button>
            </div>
          </div>
          <div id="rf-agent-status-msg" style="color: #e2e8f0; line-height: 1.4; font-size: 11px;">点击【Agent代填】即可启动零隐私外发的智能填报循环</div>
          <div id="rf-agent-resume-action" style="display: none; margin-top: 6px; text-align: right;">
            <button id="rf-btn-resume-agent" style="background: #10b981; border: none; color: #ffffff; padding: 3px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">▶️ 已完成验证，继续推进</button>
          </div>
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
        <div class="rf-tab-item" data-tab="ai-config">接口设置</div>
      </div>

      <!-- 交互提示条与模式切换胶囊 -->
      <div class="rf-quick-hint" id="rf-quick-hint">
        <span id="rf-hint-text"><b>填报模式</b>：单击或回车直接填入网页，支持打字修改；单击标签复制</span>
        <div class="rf-mode-switch" id="rf-mode-switch" title="切换填报/修改模式 (快捷键 Alt+E)">
          <span class="rf-mode-btn active" id="rf-mode-btn-fill" data-mode="fill">填报</span>
          <span class="rf-mode-btn" id="rf-mode-btn-edit" data-mode="edit">修改</span>
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

          <!-- 家庭关系 / 亲属网申记录 -->
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">家庭关系 / 亲属记录</span>
              <button class="rf-btn-add" id="rf-btn-add-family" style="padding: 4px 8px; font-size: 11px; width: auto; margin: 0;">+ 新增家庭成员</button>
            </div>
            <div id="rf-family-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
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
                <option value="typesafe">⚡ TypeSafe AI (Jev 专精决策模型 - 推荐)</option>
                <option value="claude">Claude 原生协议 (Anthropic Messages API)</option>
              </select>
            </div>
          </div>
          <div id="rf-typesafe-tip" style="display: none; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 6px 10px; margin-top: 8px; font-size: 11px; color: #3730a3; line-height: 1.45;">
            💡 <b>Jev (System-One)</b> 决策模型：推荐通过 <b>OpenRouter</b> 接入（填入 <code>sk-or-v1-...</code> 密钥即可）：<br>
            <div style="margin-top: 5px; display: flex; gap: 4px;">
              <button type="button" id="rf-btn-preset-openrouter-jev" style="background: #4f46e5; color: #ffffff; border: none; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-weight: 600;">⚡ 填入 OpenRouter 预设</button>
              <button type="button" id="rf-btn-preset-typesafe-jev" style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;">填入官方预设</button>
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

  // --- [src/card/02_dom_refs.js] ---

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


  // --- [src/card/03_storage.js] ---
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

  let isSelfSaving = false;
  let selfSaveTimer = null;

  function saveData() {
    const activeIdx = resumesList.findIndex((r) => r.id === activeResumeId);
    if (activeIdx !== -1) {
      resumesList[activeIdx].data = resumeData;
    }
    isSelfSaving = true;
    clearTimeout(selfSaveTimer);
    selfSaveTimer = setTimeout(() => {
      isSelfSaving = false;
    }, 350);

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
      if (isSelfSaving) {
        // 当前卡片内部输入保存时，忽略重绘，保证光标和中文输入法不被打断
        return;
      }
      if (area === "local" && (changes.resumesList || changes.activeResumeId)) {
        loadData();
      }
      if (area === "local" && changes.apiConfig) {
        loadFloatingAiConfig();
      }
    });
  }


  // --- [src/card/04_views.js] ---
// ==================== UI 渲染逻辑 ====================

  function updateAllViews() {
    renderVersionDropdown();
    fillBasicAndSkillsForm();
    renderFamilyList();
    renderEducationList();
    renderInternshipList();
    renderProjectList();
    renderHonorsList();
    renderCompetitionList();
    renderPaperList();
  }

  // 渲染家庭关系列表
  function renderFamilyList() {
    const container = shadow.getElementById("rf-family-list");
    if (!container) return;
    container.innerHTML = "";

    if (!resumeData.family || resumeData.family.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无家庭关系记录，可点击上方按钮添加</div>`;
      return;
    }

    resumeData.family.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">${item.relation || '家庭成员'} #${index + 1}: ${item.name || '未命名'}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="family" data-index="${index}" title="定向填充当前家庭成员">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="family" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.relation">与本人关系 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="relation" value="${item.relation || ''}" placeholder="如：父亲/母亲">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.name">亲属姓名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="亲属姓名">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.age">年龄 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="age" value="${item.age || ''}" placeholder="如：60">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.political">政治面貌 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="political" value="${item.political || ''}" placeholder="群众/党员">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.company">工作单位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="工作单位/无">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.department">工作部门 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="工作部门/无">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.position">职务 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="职务/岗位">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.phone">联系电话 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="phone" value="${item.phone || ''}" placeholder="联系电话">
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
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
    // 允许字段拖拽即填
    shadow.querySelectorAll(".rf-form-control, .rf-field-label").forEach((el) => {
      el.setAttribute("draggable", "true");
    });
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

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.role">担任职务 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="如：班长 / 学生会部长 / 社团负责人">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.roleDescription">职务描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="roleDescription" placeholder="说明任职期间负责的工作、组织活动和取得的成果...">${item.roleDescription || ''}</textarea>
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

        <!-- 证明人信息补充 (国企/校招/大厂背调) -->
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">证明人信息</span>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witness">证明人 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witness" value="${item.witness || ''}" placeholder="有 / 无">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessName">证明人姓名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessName" value="${item.witnessName || ''}" placeholder="证明人姓名">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessRelation">证明人关系 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessRelation" value="${item.witnessRelation || ''}" placeholder="如：直属领导/带教">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessPosition">证明人职务 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPosition" value="${item.witnessPosition || ''}" placeholder="如：带教/主管">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessCompany">证明人单位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessCompany" value="${item.witnessCompany || ''}" placeholder="证明人工作单位">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessPhone">证明人联系方式 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPhone" value="${item.witnessPhone || ''}" placeholder="手机号/微信号">
            </div>
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
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.link">项目链接 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="url" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="link" value="${item.link || ''}" placeholder="GitHub / 在线演示 / 项目主页链接">
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
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="honors.${index}.desc">奖项描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="desc" placeholder="简述获奖背景、奖项内容、个人贡献或排名...">${item.desc || ''}</textarea>
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


  // --- [src/card/05_pill.js] ---
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
      pillRefineBtn.textContent = "重诊";
      pillRefineBtn.disabled = false;
      pillRefineBtn.style.opacity = "1";
    }
    if (pillAiStatus) {
      pillAiStatus.style.display = "none";
    }

    if (match) {
      if (match.isPassword) {
        pillTag.textContent = "🔑 " + match.label;
        pillVal.textContent = match.ruleHint || "点击自动生成合规密码";
        pillFillBtn.textContent = "⚡ 智能生成并填入";
        pillFillBtn.style.display = "inline-flex";
        if (pillAiIcon) {
          pillAiIcon.textContent = "🔑";
          pillAiIcon.style.color = "#38bdf8";
          pillAiIcon.title = `密码格式要求: ${match.ruleHint || '8-16位，含大小写字母、数字和符号'}`;
        }
        if (pillRefineBtn) pillRefineBtn.style.display = "none";
      } else {
        pillTag.textContent = match.label;
        const previewVal = match.value || "[空]";
        pillVal.textContent = previewVal.length > 18 ? previewVal.slice(0, 16) + "..." : previewVal;
        pillFillBtn.textContent = "↵ 填入";
        pillFillBtn.style.display = "inline-flex";

        if (pillAiIcon) {
          pillAiIcon.textContent = match.isAiMatched ? "●" : "✦";
          pillAiIcon.style.color = match.isAiMatched ? "#38bdf8" : "#818cf8";
          pillAiIcon.title = match.isAiMatched
            ? `大模型语义对齐 (置信度: ${Math.round((match.confidence || 0.95) * 100)}%)\n${match.reason || ''}`
            : "本地规则推断，点击右侧重诊可呼唤大模型精确对齐此框";
        }
        if (pillRefineBtn) {
          pillRefineBtn.style.display = match.isAiMatched ? "none" : "inline-flex";
        }
      }

      pillSuggestions.innerHTML = "";

      // 密码框快捷预设推荐
      if (match.isPassword) {
        // 优先检测当前站点是否已保存过密码备忘
        try {
          const dom = window.location.hostname || "";
          const savedStr = localStorage.getItem("rf_saved_passwords");
          const savedList = savedStr ? JSON.parse(savedStr) : [];
          const matchedSaved = savedList.find(p => p.domain === dom);
          if (matchedSaved && matchedSaved.password) {
            const savedSug = document.createElement("span");
            savedSug.className = "rf-pill-sug-item";
            savedSug.style.cssText = "background: rgba(16, 185, 129, 0.25); color: #34d399; font-weight: 700; border-color: rgba(52, 211, 153, 0.4);";
            savedSug.textContent = `🔖 已存密码 (${matchedSaved.account || '本站'})`;
            savedSug.title = `点击填入本站已保存的密码: ${matchedSaved.account || ''}`;
            savedSug.addEventListener("click", (e) => {
              e.stopPropagation();
              const api = window.ResumeFillerContent;
              if (api && typeof api.fillPasswordToPage === "function") {
                const r = api.fillPasswordToPage(matchedSaved.password);
                if (r && r.success) {
                  showToast(`✓ 已填入本站已保存密码 (${matchedSaved.account || ''})`);
                  hidePill();
                  return;
                }
              }
              if (currentTargetInput && api && typeof api.setElementValue === "function") {
                api.setElementValue(currentTargetInput, matchedSaved.password);
                showToast("✓ 已填入本站密码");
                hidePill();
              }
            });
            pillSuggestions.appendChild(savedSug);
          }
        } catch (_) {}

        const pwdPresets = [
          { label: "8-16位 全字符", rule: "8-16位，包含大写字母、小写字母、数字和特殊符号" },
          { label: "8-20位 字母数字", rule: "8-20位，必须包含大小写字母和数字" },
          { label: "12位 强随机", rule: "12位高强度随机密码，包含大小写、数字及符号" }
        ];
        pwdPresets.forEach((p) => {
          const sugEl = document.createElement("span");
          sugEl.className = "rf-pill-sug-item";
          sugEl.textContent = p.label;
          sugEl.title = `按「${p.rule}」生成密码填入`;
          sugEl.addEventListener("click", async (e) => {
            e.stopPropagation();
            const api = window.ResumeFillerContent;
            if (api && typeof api.generateSmartPassword === "function" && typeof api.fillPasswordToPage === "function") {
              sugEl.textContent = "⏳…";
              const res = await api.generateSmartPassword(p.rule);
              const pwd = res && res.password ? res.password : "P@ssw0rd2026!";
              const r = api.fillPasswordToPage(pwd);
              if (r && r.success) {
                const extra = r.hasConfirm ? "（主密码框 + 确认密码框）" : "";
                showToast(`✓ 已生成并填入：${p.label}！${extra}`);
              }
              hidePill();
            }
          });
          pillSuggestions.appendChild(sugEl);
        });
      }

      // 地区级联一键选择支持
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

      const btnW = triggerBtn.offsetWidth || 44;
      const btnH = triggerBtn.offsetHeight || 44;

      // 让悬浮球出现并就地吸附在鼠标当前位置 (光标中心)
      let btnLeft = targetX - (btnW / 2);
      let btnTop = targetY - (btnH / 2);

      // 视口边界保护
      btnLeft = Math.max(8, Math.min(window.innerWidth - btnW - 8, btnLeft));
      btnTop = Math.max(8, Math.min(window.innerHeight - btnH - 8, btnTop));

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
      wakeUpAll();
    }

    function expandCard(pos) {
      wakeUpAll();
      const btnRect = triggerBtn.getBoundingClientRect();
      const cardW = 410;
      const cardH = Math.min(620, window.innerHeight - 30);

      // 展开目标位置：优先使用传进来的坐标(如气泡/鼠标附近)；默认让卡片头部贴合悬浮球位置
      let cardLeft = (pos && typeof pos.x === "number") ? pos.x : btnRect.left;
      let cardTop = (pos && typeof pos.y === "number") ? pos.y : btnRect.top;

      // 如果靠近屏幕右侧，卡片向左侧展开避免出界
      if (cardLeft + cardW > window.innerWidth - 10) {
        cardLeft = Math.max(10, window.innerWidth - cardW - 14);
      }
      // 如果靠近屏幕下方，卡片向上方展开避免出界
      if (cardTop + cardH > window.innerHeight - 10) {
        cardTop = Math.max(10, window.innerHeight - cardH - 14);
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
      if (tabId === "ai-config") {
        loadFloatingAiConfig();
      }
    });


  // --- [src/card/06_ai_config.js] ---
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
        const proto = cfg.protocol || "openai";
        if (aiProtocolEl) aiProtocolEl.value = proto;
        if (aiBaseUrlEl) aiBaseUrlEl.value = cfg.baseUrl || (proto === "typesafe" ? "https://api.typesafe.ai/v1" : "https://api.openai.com/v1");
        if (aiApiKeyEl) aiApiKeyEl.value = cfg.apiKey || "";
        if (aiModelEl) aiModelEl.value = cfg.model || (proto === "typesafe" ? "jev-latest" : "gpt-4o-mini");
        const tipEl = shadow.getElementById("rf-typesafe-tip");
        if (tipEl) tipEl.style.display = (proto === "typesafe") ? "block" : "none";
      } catch (e) {}
    }

    if (aiProtocolEl && !aiProtocolEl.hasAttribute("data-bound-proto")) {
      aiProtocolEl.setAttribute("data-bound-proto", "true");
      aiProtocolEl.addEventListener("change", () => {
        const p = aiProtocolEl.value;
        const tipEl = shadow.getElementById("rf-typesafe-tip");
        if (tipEl) tipEl.style.display = (p === "typesafe") ? "block" : "none";
        if (p === "typesafe") {
          if (aiBaseUrlEl && (!aiBaseUrlEl.value || aiBaseUrlEl.value.includes("openai.com") || aiBaseUrlEl.value.includes("anthropic.com"))) {
            aiBaseUrlEl.value = "https://openrouter.ai/api/v1";
          }
          if (aiModelEl && (!aiModelEl.value || aiModelEl.value.includes("gpt") || aiModelEl.value.includes("claude"))) {
            aiModelEl.value = "typesafe/jev-1.13";
          }
          if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...) 或 TypeSafe Key";
        } else if (p === "openai") {
          if (aiBaseUrlEl && (aiBaseUrlEl.value.includes("typesafe.ai") || aiBaseUrlEl.value.includes("openrouter.ai"))) {
            aiBaseUrlEl.value = "https://api.openai.com/v1";
          }
          if (aiModelEl && aiModelEl.value.includes("jev")) {
            aiModelEl.value = "gpt-4o-mini";
          }
        } else if (p === "claude") {
          if (aiBaseUrlEl && (aiBaseUrlEl.value.includes("typesafe.ai") || aiBaseUrlEl.value.includes("openai.com"))) {
            aiBaseUrlEl.value = "https://api.anthropic.com/v1";
          }
          if (aiModelEl && (aiModelEl.value.includes("jev") || aiModelEl.value.includes("gpt"))) {
            aiModelEl.value = "claude-3-5-sonnet-20241022";
          }
        }
      });

      const btnOpenRouterJev = shadow.getElementById("rf-btn-preset-openrouter-jev");
      const btnTypeSafeJev = shadow.getElementById("rf-btn-preset-typesafe-jev");

      btnOpenRouterJev?.addEventListener("click", () => {
        if (aiProtocolEl) aiProtocolEl.value = "typesafe";
        if (aiBaseUrlEl) aiBaseUrlEl.value = "https://openrouter.ai/api/v1";
        if (aiModelEl) aiModelEl.value = "typesafe/jev-1.13";
        if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...)";
        showToast("✓ 已填入 OpenRouter Jev 预设，输入 Key 后点击保存");
      });

      btnTypeSafeJev?.addEventListener("click", () => {
        if (aiProtocolEl) aiProtocolEl.value = "typesafe";
        if (aiBaseUrlEl) aiBaseUrlEl.value = "https://api.typesafe.ai/v1";
        if (aiModelEl) aiModelEl.value = "jev-latest";
        if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 TypeSafe 官方 Key";
        showToast("✓ 已填入 TypeSafe 官方预设");
      });
    }
    if (aiSaveBtn) {
      aiSaveBtn.addEventListener("click", async () => {
        const rawKey = aiApiKeyEl ? aiApiKeyEl.value.trim() : "";
        const cleanKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
        const newCfg = {
          protocol: aiProtocolEl ? aiProtocolEl.value : "openai",
          baseUrl: aiBaseUrlEl ? aiBaseUrlEl.value.trim() : "https://api.openai.com/v1",
          apiKey: cleanKey,
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
        const rawKey = aiApiKeyEl ? aiApiKeyEl.value.trim() : "";
        const apiKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
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
                  apiConfig: testCfg,
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


  // --- [src/card/07_interactions.js] ---
// 4. 重构核心 1：单击字段标签一键复制 (彻底去除独立复制按钮)
    shadow.addEventListener("click", (e) => {
      const label = e.target.closest("[data-copy-ref]");
      if (label) {
        const ref = label.getAttribute("data-copy-ref");
        const group = label.closest(".rf-form-group, .rf-field-item");
        const siblingInput = group ? group.querySelector(".rf-form-control, .card-input") : null;
        let val = (siblingInput && siblingInput.value !== undefined && siblingInput.value !== "") ? siblingInput.value : getValueByRef(ref);

        if (val) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => {
              const originalHtml = label.innerHTML;
              label.classList.add("rf-copied");
              label.innerHTML = `✓ 已复制`;
              setTimeout(() => {
                label.innerHTML = originalHtml;
                label.classList.remove("rf-copied");
              }, 750);
              showToast(`已复制: ${String(val).slice(0, 15)}...`);
            }).catch(() => {
              const originalHtml = label.innerHTML;
              label.classList.add("rf-copied");
              label.innerHTML = `✓ 已复制`;
              setTimeout(() => {
                label.innerHTML = originalHtml;
                label.classList.remove("rf-copied");
              }, 750);
              showToast(`已复制: ${String(val).slice(0, 15)}...`);
            });
          } else {
            showToast(`已复制: ${String(val).slice(0, 15)}...`);
          }
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
          hintText.innerHTML = "💡 <b>填报模式</b>：单击或回车直接填入网页，支持打字修改；单击标签复制";
        }
        showToast("⚡ 已切回【填报模式】：支持打字修改，单击或按回车即可一键填入网页！");
      }
    }

    if (modeToggleBtn) modeToggleBtn.addEventListener("click", () => setEditMode(!isEditMode));
    if (modeBtnFill) modeBtnFill.addEventListener("click", () => setEditMode(false));
    if (modeBtnEdit) modeBtnEdit.addEventListener("click", () => setEditMode(true));

    // 启用字段从卡片拖拽即填 (HTML5 Drag & Drop)
    shadow.addEventListener("dragstart", (e) => {
      const target = e.target.closest(".rf-form-control, .rf-field-label, .rf-pill-tag, .rf-pill-val");
      if (!target) return;
      let val = "";
      let lbl = "";
      if (target.classList.contains("rf-form-control")) {
        val = target.value || "";
        const item = target.closest(".rf-field-item");
        lbl = (item && item.querySelector(".rf-field-label") ? item.querySelector(".rf-field-label").textContent : "").trim();
      } else if (target.classList.contains("rf-field-label")) {
        const ref = target.getAttribute("data-copy-ref");
        val = getValueByRef(ref);
        lbl = target.textContent.trim();
      } else {
        val = target.textContent.trim();
        lbl = "字段";
      }
      if (val) {
        e.dataTransfer.setData("application/x-resume-field", JSON.stringify({ label: lbl, value: val }));
        e.dataTransfer.setData("text/plain", val);
        e.dataTransfer.effectAllowed = "copy";
      }
    });

    // 5. 统一字段填入方法 (支持主 frame 本地直接注入，以及穿透子 iframe 广播注入)
    function fillValueToPage(val, inputEl = null) {
      val = (val !== undefined && val !== null) ? String(val) : "";
      if (!val) {
        showToast("字段内容为空，无法填充");
        return;
      }

      let filled = false;

      // 1. 本地多重优先寻回真实目标输入框 (支持跨组件重新渲染与气泡目标留存)
      let target = (currentTargetInput && document.body && document.body.contains(currentTargetInput)) ? currentTargetInput : null;
      if (!target && window.ResumeFillerContent && window.ResumeFillerContent.getLastActiveElement) {
        target = window.ResumeFillerContent.getLastActiveElement();
      }
      if (!target) {
        const act = document.activeElement;
        if (act && (!act.closest || !act.closest("#resume-filler-extension-host")) && ["INPUT", "TEXTAREA", "SELECT"].includes(act.tagName)) {
          target = act;
        }
      }

      if (target && window.ResumeFillerContent && window.ResumeFillerContent.setElementValue) {
        try {
          window.ResumeFillerContent.setElementValue(target, val);
          filled = true;
          currentTargetInput = target;
        } catch (_) {
          filled = false;
        }
      } else if (window.ResumeFillerContent && window.ResumeFillerContent.fillFocusedInput) {
        try {
          filled = !!window.ResumeFillerContent.fillFocusedInput(val);
        } catch (_) {
          filled = false;
        }
      }

      if (filled) {
        if (inputEl) {
          inputEl.classList.add("rf-fill-pulse");
          setTimeout(() => inputEl.classList.remove("rf-fill-pulse"), 450);
        }
        showToast("✓ 已自动填入网页输入框！");
        return;
      }

      // 2. 主 frame 未找到焦点，尝试广播给子 iframe
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            action: "broadcastToTabFrames",
            payload: { action: "fillFocusedInput", value: val },
            excludeSenderFrame: true
          }, (resp) => {
            if (resp && resp.success && resp.results && resp.results.some((r) => r && r.status === "success")) {
              if (inputEl) {
                inputEl.classList.add("rf-fill-pulse");
                setTimeout(() => inputEl.classList.remove("rf-fill-pulse"), 450);
              }
              showToast("✓ 已自动填入子框架输入框！");
            } else {
              showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(val).catch(() => {});
              }
            }
          });
        } catch (_) {
          showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).catch(() => {});
          }
        }
      } else {
        showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).catch(() => {});
        }
      }
    }

    // 单击输入框或其外层包裹容器直接填入网页当前输入框 (修改模式下放行原生打字编辑)
    shadow.addEventListener("click", (e) => {
      let input = e.target.closest(".rf-form-control");
      if (!input) {
        const wrapper = e.target.closest(".rf-input-wrapper");
        if (wrapper) {
          input = wrapper.querySelector(".rf-form-control");
        }
      }
      if (input) {
        if (isEditMode) return;
        fillValueToPage(input.value, input);
      }
    });
    // 填报模式下：输入框打字后按 Enter 键一键填入网页！
    shadow.addEventListener("keydown", (e) => {
      const input = e.target.closest(".rf-form-control");
      if (!input || isEditMode) return;

      if (e.key === "Enter") {
        if (input.tagName === "TEXTAREA" && !e.ctrlKey) {
          return; // 多行文本框默认回车换行，Ctrl+Enter 快捷填入
        }
        e.preventDefault();
        fillValueToPage(input.value, input);
      }
    });

    // 填报模式下：输入框内容打字修改后失焦，自动同步填入网页
    shadow.addEventListener("change", (e) => {
      const input = e.target.closest(".rf-form-control");
      if (!input || isEditMode) return;
      if (input.value) {
        fillValueToPage(input.value, input);
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
          } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: "broadcastToTabFrames",
              payload: { action: "fillSection", type: type, data: secData },
              excludeSenderFrame: true
            }, (resp) => {
              if (resp && resp.success && resp.results && resp.results.some((r) => r && r.status === "success")) {
                showToast("已成功在子框架中定向填充此段经历！");
              } else {
                showToast("请先点击网页中该经历板块的任意输入框");
              }
            });
          } else {
            showToast("请先点击网页中该经历板块的任意输入框");
          }
        }
      }
    });

    // 7. 表单输入自动双向绑定与保存 (基本信息 + 技能)
    let inputSaveDebounceTimer = null;
    shadow.addEventListener("input", (e) => {
      const input = e.target;
      const key = input.getAttribute("data-key");
      if (!key) return;

      if (key.startsWith("basic.")) {
        const subKey = key.split(".")[1];
        resumeData.basic[subKey] = input.value;
      } else if (key === "skills") {
        resumeData.skills = input.value;
      } else if (key === "languages") {
        resumeData.languages = input.value;
      } else if (input.classList.contains("card-input")) {
        const type = input.getAttribute("data-type");
        const index = parseInt(input.getAttribute("data-index"), 10);
        if (resumeData[type] && resumeData[type][index]) {
          resumeData[type][index][key] = input.value;
        }
      }

      clearTimeout(inputSaveDebounceTimer);
      inputSaveDebounceTimer = setTimeout(() => {
        saveData();
      }, 120);
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
      resumeData.internship.push({
        company: "",
        position: "",
        start: "",
        end: "",
        desc: "",
        witness: "有",
        witnessName: "",
        witnessRelation: "",
        witnessPosition: "",
        witnessCompany: "",
        witnessPhone: ""
      });
      saveData();
      renderInternshipList();
      showToast("已新增一段工作实习");
    });

    shadow.getElementById("rf-btn-add-family")?.addEventListener("click", () => {
      if (!resumeData.family) resumeData.family = [];
      resumeData.family.push({
        relation: "",
        name: "",
        age: "",
        company: "",
        department: "",
        position: "",
        phone: "",
        political: ""
      });
      saveData();
      renderFamilyList();
      showToast("已新增家庭成员");
    });

    shadow.getElementById("rf-btn-add-proj").addEventListener("click", () => {
      resumeData.project.push({ name: "", role: "", start: "", end: "", tech: "", desc: "", duty: "", result: "" });
      saveData();
      renderProjectList();
      showToast("已新增一段项目经历");
    });

    shadow.getElementById("rf-btn-add-honor").addEventListener("click", () => {
      resumeData.honors.push({ name: "", date: "", level: "", desc: "" });
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
          if (type === "family") renderFamilyList();
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
            const btnW = triggerBtn.offsetWidth || 44;
            const btnH = triggerBtn.offsetHeight || 44;
            const validLeft = Math.max(8, Math.min(window.innerWidth - btnW - 8, left));
            const validTop = Math.max(8, Math.min(window.innerHeight - btnH - 8, top));
            triggerBtn.style.right = "auto";
            triggerBtn.style.bottom = "auto";
            triggerBtn.style.left = `${validLeft}px`;
            triggerBtn.style.top = `${validTop}px`;
          }
        } catch(e) {}
      } else {
        triggerBtn.style.right = "24px";
        triggerBtn.style.bottom = "80px";
      }
    }
    applySavedPositions();

    // ==================== 统一无操作智能交互：3秒半透明 / 卡片自动收起 / 小球自动贴边 ====================
    let idleTimer = null;
    let cardCollapseTimer = null;
    let dockTimer = null;
    let isMouseInsideCard = false;
    let isMouseInsideTrigger = false;

    cardModal.addEventListener("mouseenter", () => {
      isMouseInsideCard = true;
      cardModal.classList.remove("rf-idle-fade");
      resetInactivityTimers();
    });

    cardModal.addEventListener("mouseleave", () => {
      isMouseInsideCard = false;
      resetInactivityTimers();
    });

    triggerBtn.addEventListener("mouseenter", () => {
      isMouseInsideTrigger = true;
      triggerBtn.classList.remove("rf-idle-fade");
      resetInactivityTimers();
    });

    triggerBtn.addEventListener("mouseleave", () => {
      isMouseInsideTrigger = false;
      resetInactivityTimers();
    });

    function wakeUpAll() {
      // 悬浮按钮：鼠标不在按钮上时保持已有透明状态，只有鼠标移动到按钮上时才恢复不透明
      if (triggerBtn && isMouseInsideTrigger) {
        triggerBtn.classList.remove("rf-idle-fade");
      }
      // 卡片若展开：用户在页面操作且鼠标进入卡片时保持不透明
      if (cardModal && !isCardCollapsed) {
        cardModal.classList.remove("rf-idle-fade");
      }
      resetInactivityTimers();
    }

    function resetInactivityTimers() {
      clearTimeout(idleTimer);
      clearTimeout(cardCollapseTimer);
      clearTimeout(dockTimer);

      if (isTriggerDragging || isCardDragging) {
        return;
      }

      // 1. 超过 3 秒没有鼠标操作：
      // - 悬浮卡片：超过 3 秒自动变半透明
      // - 悬浮按钮：超过 3 秒自动变半透明，鼠标只要没移到按钮上就一直保持半透明
      idleTimer = setTimeout(() => {
        if (isTriggerDragging || isCardDragging) return;
        if (isCardCollapsed) {
          if (!isMouseInsideTrigger) {
            triggerBtn.classList.add("rf-idle-fade");
          }
        } else {
          if (!isMouseInsideCard) {
            cardModal.classList.add("rf-idle-fade");
          }
        }
      }, 3000);

      // 2. 悬浮卡片若无操作：持续无操作达到 3 秒（且鼠标不在卡片内部），自动平滑收缩变为悬浮按钮！
      if (!isCardCollapsed) {
        cardCollapseTimer = setTimeout(() => {
          if (!isCardCollapsed && !isMouseInsideCard && !isCardDragging) {
            collapseCard();
          }
        }, 3000);
      }

      // 3. 悬浮按钮状态下：变透明后再过 3 秒（无操作累计 6 秒）自动贴边
      if (isCardCollapsed) {
        dockTimer = setTimeout(() => {
          if (isCardCollapsed && !isTriggerDragging && !isMouseInsideTrigger) {
            autoDockFloatingBtn();
          }
        }, 6000);
      }
    }

    function autoDockFloatingBtn() {
      if (!triggerBtn || !isCardCollapsed) return;
      const rect = triggerBtn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const winW = window.innerWidth;

      if (centerX < winW / 2) {
        // 贴屏幕左边缘
        triggerBtn.classList.add("rf-docked-left");
        triggerBtn.style.left = "0px";
        triggerBtn.style.right = "auto";
      } else {
        // 贴屏幕右边缘
        triggerBtn.classList.add("rf-docked-right");
        triggerBtn.style.left = `${winW - rect.width}px`;
        triggerBtn.style.right = "auto";
      }
    }

    // 全局鼠标/交互监听：重置计时器，若鼠标未进入按钮则按钮继续保持透明
    window.addEventListener("mousemove", wakeUpAll, { passive: true });
    window.addEventListener("scroll", wakeUpAll, { passive: true });
    window.addEventListener("keydown", wakeUpAll, { passive: true });

    triggerBtn.addEventListener("mousedown", (e) => {
      isTriggerDragging = false;
      triggerBtn.classList.remove("rf-idle-fade", "rf-docked-left", "rf-docked-right");
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
          const btnW = triggerBtn.offsetWidth || 44;
          const btnH = triggerBtn.offsetHeight || 44;
          let newL = triggerInitLeft + dx;
          let newT = triggerInitTop + dy;
          newL = Math.max(0, Math.min(window.innerWidth - btnW, newL));
          newT = Math.max(0, Math.min(window.innerHeight - btnH, newT));
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
        resetInactivityTimers();
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
    pillFillBtn.addEventListener("click", async () => {
      if (currentTargetInput && currentDetectedField) {
        if (currentDetectedField.isPassword) {
          const api = window.ResumeFillerContent;
          if (api && typeof api.generateSmartPassword === "function" && typeof api.fillPasswordToPage === "function") {
            pillFillBtn.textContent = "⏳…";
            try {
              const res = await api.generateSmartPassword(currentDetectedField.ruleHint || "");
              const pwd = res && res.password ? res.password : "P@ssw0rd2026!";
              const r = api.fillPasswordToPage(pwd);
              if (r && r.success) {
                const extra = r.hasConfirm ? "（主密码框 + 确认密码框）" : "";
                showToast(`✓ 已生成并填入合规密码！${extra}`);
              }
            } finally {
              pillFillBtn.textContent = "⚡ 智能生成并填入";
              hidePill();
            }
            return;
          }
        }
        const fillVal = currentDetectedField.fileAttachment || currentDetectedField.value;
        if (fillVal !== undefined && fillVal !== null && fillVal !== "") {
          window.ResumeFillerContent.setElementValue(currentTargetInput, fillVal);
          showToast(`✓ 已填入：${currentDetectedField.label}`);
          hidePill();
        }
      }
    });
    pillCopyBtn.addEventListener("click", () => {
      if (currentDetectedField && currentDetectedField.value) {
        navigator.clipboard.writeText(currentDetectedField.value).then(() => {
          showToast("已成功复制到剪贴板！");
        });
      }
    });

    // 🪄 AI 重诊：当本地推断不准时，单点呼叫大模型重新诊断此输入框
    if (pillRefineBtn) {
      pillRefineBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // 优先使用当前目标输入框，若丢失则尝试从最后聚焦节点或当前活跃节点恢复
        let target = currentTargetInput;
        if (!target || !document.body.contains(target)) {
          target = window.ResumeFillerContent && window.ResumeFillerContent.getLastActiveElement();
        }
        if (!target) {
          const act = document.activeElement;
          if (act && (["INPUT", "TEXTAREA", "SELECT"].includes(act.tagName) || act.isContentEditable)) {
            target = act;
          }
        }

        if (!target) {
          showToast("请先在网页中点击需要诊断的输入框", true);
          return;
        }

        // 检查是否配置了 API Key
        let hasApiKey = false;
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            const st = await chrome.storage.local.get("apiConfig");
            hasApiKey = !!(st.apiConfig && st.apiConfig.apiKey);
          }
        } catch(e) {}

        if (!hasApiKey) {
          showToast("⚠️ 未配置大模型 API Key！已为你展开【🪄 AI配置】面板，请填入密钥", true);
          expandCard();
          const aiTab = shadow.querySelector(".rf-tab-item[data-tab='ai-config']");
          if (aiTab) aiTab.click();
          return;
        }

        // 按钮及旁边状态更新
        pillRefineBtn.textContent = "分析中...";
        pillRefineBtn.disabled = true;
        pillRefineBtn.style.opacity = "0.7";

        if (pillAiStatus) {
          pillAiStatus.className = "rf-pill-ai-status loading";
          pillAiStatus.style.display = "inline-flex";
          pillAiStatus.textContent = "⏳ 思考中...";
        }
        showToast("🪄 正在呼唤大模型深度诊断此输入框...");

        try {
          if (window.ResumeFillerContent && window.ResumeFillerContent.requestAiSingleFieldRefinement) {
            const slot = await window.ResumeFillerContent.requestAiSingleFieldRefinement(target);
            if (slot) {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status success";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = `✓ 已对齐: ${slot}`;
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2200);
              }
              showToast(`✓ AI 诊断对齐成功：${slot}`);
              currentTargetInput = target;
              showPillForInput(target); // 重新渲染气泡为精准项
            } else {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status error";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = "未匹配到合适槽位";
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2500);
              }
              showToast("AI 未能识别出更佳字段", true);
            }
          } else {
            showToast("未找到 AI 诊断引擎", true);
          }
        } catch(err) {
          console.error("AI 重诊异常:", err);
          const errMsg = err.message || String(err);
          if (pillAiStatus) {
            pillAiStatus.className = "rf-pill-ai-status error";
            pillAiStatus.style.display = "inline-flex";
            pillAiStatus.textContent = "❌ " + (errMsg.length > 20 ? errMsg.slice(0, 18) + "..." : errMsg);
            setTimeout(() => {
              if (pillAiStatus) pillAiStatus.style.display = "none";
            }, 3500);
          }
          showToast(`❌ AI 诊断失败: ${errMsg}`, true);
        } finally {
          pillRefineBtn.textContent = "重诊";
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

    // 气泡内就地展开完整卡片按钮
    if (pillExpandCardBtn) {
      pillExpandCardBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isTopFrame && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "openTopFloatingCard" });
          showToast("已在主页面展开面板");
          return;
        }
        // 如果有当前输入框，就在输入框附近展开卡片，手感极佳
        if (currentTargetInput) {
          const r = currentTargetInput.getBoundingClientRect();
          expandCard({ x: r.left + 50, y: r.bottom + 10 });
        } else {
          expandCard();
        }
      });
    }

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

    // 网页空白处双击监听：在网申/填报页面任意空白背景处双击，快速切换悬浮按钮与悬浮卡片
    document.addEventListener("dblclick", (e) => {
      const el = e.target;
      if (!el) return;
      // 排除插件自身 DOM
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      // 排除用户正在操作的控件（输入框、选择框、按钮、链接等）
      const isControl = el.closest("input, textarea, select, button, a, [contenteditable='true'], .rf-form-control");
      if (isControl) return;

      // 排除用户正在划选文字的行为
      const selection = window.getSelection ? window.getSelection().toString().trim() : "";
      if (selection.length > 0) return;

      // 触发切换（支持就地在鼠标位置折叠/展开）
      toggleCard(undefined, { x: e.clientX, y: e.clientY });
    }, true);

    // 键盘快捷键监听:
    // Alt + Enter: 直接将气泡内容填入当前聚焦的输入框
    // Alt + C: 快速展开/折叠悬浮卡片
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "Enter" || e.keyCode === 13)) {
        if (!inlinePill.classList.contains("rf-pill-hidden") && currentTargetInput && currentDetectedField) {
          e.preventDefault();
          window.ResumeFillerContent.setElementValue(currentTargetInput, currentDetectedField.value);
          showToast(`✓ 已快捷填入：${currentDetectedField.label}`);
          hidePill();
        }
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


  // --- [src/card/08_password_card.js] ---
// 17.6 智能密码生成器：自然语言规则解析 / AI生成 / 自动填入主密码与确认密码
    let currentGeneratedPassword = "";
    let isPasswordMasked = false;

    function evaluatePasswordStrength(pwd) {
      if (!pwd) return { desc: "空密码", tag: "⚪ 无密码" };
      const len = pwd.length;
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasDigit = /[0-9]/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
      const typesCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

      const typeDesc = [];
      if (hasUpper && hasLower) typeDesc.push("大小写字母");
      else if (hasUpper) typeDesc.push("大写字母");
      else if (hasLower) typeDesc.push("小写字母");
      if (hasDigit) typeDesc.push("数字");
      if (hasSpecial) typeDesc.push("特殊符号");

      const descStr = `${len}位 · ${typeDesc.join("+") || "字符"}`;
      let tagStr = "🟢 高强度";
      if (len >= 12 && typesCount >= 3) tagStr = "🟢 极高强度";
      else if (len >= 8 && typesCount >= 2) tagStr = "🟢 强密码";
      else if (len >= 6) tagStr = "🟡 中等强度";
      else tagStr = "🔴 弱密码";

      return { desc: descStr, tag: tagStr };
    }

    function updatePasswordDisplayUI(pwd) {
      currentGeneratedPassword = pwd || "";
      if (!pwdVal) return;
      if (isPasswordMasked) {
        pwdVal.textContent = "•".repeat(Math.max(6, pwd.length));
        if (pwdToggleEye) pwdToggleEye.textContent = "🙈";
      } else {
        pwdVal.textContent = pwd || "——";
        if (pwdToggleEye) pwdToggleEye.textContent = "👁️";
      }
      const st = evaluatePasswordStrength(pwd);
      if (pwdDesc) pwdDesc.textContent = st.desc;
      if (pwdStrength) pwdStrength.textContent = st.tag;
    }

    async function triggerGeneratePassword(ruleText, isAi = false) {
      const api = window.ResumeFillerContent;
      const rule = ruleText || (pwdRuleInput ? pwdRuleInput.value.trim() : "") || "8-16位，包含大写字母、小写字母、数字和特殊字符";
      if (pwdRuleInput && !pwdRuleInput.value.trim()) {
        pwdRuleInput.value = rule;
      }

      let res = null;
      if (api && typeof api.generateSmartPassword === "function") {
        res = await api.generateSmartPassword(rule);
      } else if (api && typeof api.generatePasswordLocally === "function") {
        res = { password: api.generatePasswordLocally(rule), source: "local" };
      }

      const finalPwd = (res && res.password) ? res.password : "P@ssw0rd2026!";
      updatePasswordDisplayUI(finalPwd);

      if (isAi && res && res.source === "ai") {
        showToast("✓ AI 已根据要求生成高强度随机密码！");
      }
      return finalPwd;
    }

    function updatePasswordTargetStatusUI() {
      if (!pwdStatus) return;
      const api = window.ResumeFillerContent;
      if (api && typeof api.detectPasswordTargets === "function") {
        const tg = api.detectPasswordTargets();
        if (tg.hasTarget) {
          pwdStatus.className = "rf-pwd-status ok";
          pwdStatus.textContent = `✅ ${tg.label}`;
        } else {
          pwdStatus.className = "rf-pwd-status warn";
          pwdStatus.textContent = "⚠️ 当前页面暂未检测到密码输入框（可使用「点选填入」）";
        }
      }
    }

    function closePwdMenu() {
      if (!pwdMenu) return;
      pwdMenu.classList.add("rf-hidden");
      pwdMenu.style.display = "none";
    }
    // ==================== 站点密码保存与求职密码备忘录 (Password Vault) ====================
    let savedPasswordsList = [];
    let isCurrentSavedMasked = true;

    function safeStr(val) {
      return String(val || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function getDomainFromUrl() {
      try {
        return window.location.hostname || "local";
      } catch (_) {
        return "local";
      }
    }

    function getSiteDisplayName() {
      const dom = getDomainFromUrl();
      const ats = (window.ResumeFillerContent && window.ResumeFillerContent.getAtsProfile) ? window.ResumeFillerContent.getAtsProfile().name : "";
      if (ats && ats !== "通用网页表单") return ats;
      const title = (document.title || "").split(/[-_|]/)[0].trim();
      return title || dom;
    }

    async function loadSavedPasswords() {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get("rf_saved_passwords", (res) => {
            savedPasswordsList = Array.isArray(res?.rf_saved_passwords) ? res.rf_saved_passwords : [];
            resolve(savedPasswordsList);
          });
        } else {
          try {
            savedPasswordsList = JSON.parse(localStorage.getItem("rf_saved_passwords") || "[]");
          } catch (_) {
            savedPasswordsList = [];
          }
          resolve(savedPasswordsList);
        }
      });
    }

    async function persistSavedPasswords(list) {
      savedPasswordsList = list;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ rf_saved_passwords: list });
      } else {
        localStorage.setItem("rf_saved_passwords", JSON.stringify(list));
      }
      renderPasswordVaultUI();
    }

    function renderPasswordVaultUI() {
      const curDomain = getDomainFromUrl();
      const siteNameEl = shadow.getElementById("rf-pwd-site-name");
      if (siteNameEl) siteNameEl.textContent = getSiteDisplayName();

      const accInput = shadow.getElementById("rf-pwd-account-input");
      if (accInput && !accInput.value.trim()) {
        const phone = resumeData.basic && resumeData.basic.phone;
        const email = resumeData.basic && resumeData.basic.email;
        accInput.value = phone || email || "";
      }

      // 渲染当前站点已保存的密码卡片
      const curSiteItem = savedPasswordsList.find(p => p.domain === curDomain);
      const curSiteCard = shadow.getElementById("rf-pwd-current-site-card");
      if (curSiteCard) {
        if (curSiteItem) {
          curSiteCard.style.display = "flex";
          const accEl = shadow.getElementById("rf-pwd-saved-acc");
          const valEl = shadow.getElementById("rf-pwd-saved-val");
          const timeEl = shadow.getElementById("rf-pwd-saved-time");
          const eyeBtn = shadow.getElementById("rf-pwd-saved-toggle-eye");

          if (accEl) accEl.textContent = curSiteItem.account || "默认账号";
          if (timeEl) timeEl.textContent = curSiteItem.updatedAt || "";
          if (valEl) {
            valEl.textContent = isCurrentSavedMasked ? "•".repeat(Math.max(6, curSiteItem.password.length)) : curSiteItem.password;
          }
          if (eyeBtn) eyeBtn.textContent = isCurrentSavedMasked ? "👁️" : "🙈";

          const fillBtn = shadow.getElementById("rf-pwd-saved-btn-fill");
          if (fillBtn) {
            fillBtn.onclick = (e) => {
              e.stopPropagation();
              fillPasswordValue(curSiteItem.password);
            };
          }

          const copyBtn = shadow.getElementById("rf-pwd-saved-btn-copy");
          if (copyBtn) {
            copyBtn.onclick = async (e) => {
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(curSiteItem.password);
                showToast(`已复制本站密码 (${curSiteItem.account || '默认账号'})`);
              } catch (_) {
                showToast("复制失败", "error");
              }
            };
          }

          const delBtn = shadow.getElementById("rf-pwd-saved-btn-del");
          if (delBtn) {
            delBtn.onclick = async (e) => {
              e.stopPropagation();
              if (confirm(`确定删除此站（${curDomain}）已保存的求职密码吗？`)) {
                const next = savedPasswordsList.filter(p => p.id !== curSiteItem.id);
                await persistSavedPasswords(next);
                showToast("已删除本站密码备忘");
              }
            };
          }
        } else {
          curSiteCard.style.display = "none";
        }
      }

      // 渲染全站点抽屉计数
      const countEl = shadow.getElementById("rf-pwd-vault-count");
      if (countEl) countEl.textContent = savedPasswordsList.length;

      renderVaultItemsList();
    }

    function renderVaultItemsList(filterText = "") {
      const container = shadow.getElementById("rf-pwd-vault-list");
      if (!container) return;
      container.innerHTML = "";

      const query = (filterText || "").toLowerCase().trim();
      const filtered = savedPasswordsList.filter(item => {
        if (!query) return true;
        return (item.domain || "").toLowerCase().includes(query) ||
               (item.siteName || "").toLowerCase().includes(query) ||
               (item.account || "").toLowerCase().includes(query);
      });

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11px; color:var(--text-muted);">暂无已保存的站点密码</div>`;
        return;
      }
      filtered.forEach(item => {
        const row = document.createElement("div");
        row.className = "rf-pwd-vault-item";
        row.innerHTML = `
          <div class="rf-pwd-vault-item-head">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">🌐 ${safeStr(item.siteName || item.domain)}</span>
            <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${safeStr(item.domain)}</span>
          </div>
          <div class="rf-pwd-vault-item-body">
            <span>👤 ${safeStr(item.account || '未填账号')}</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="vault-pwd-mask" data-id="${item.id}">••••••••</span>
              <button type="button" class="rf-sms-link-btn btn-vault-toggle-eye" data-id="${item.id}" style="padding:0 2px;">👁️</button>
            </div>
          </div>
          <div style="display:flex; gap:4px; margin-top:2px;">
            <button type="button" class="rf-pwd-saved-btn btn-vault-fill" data-id="${item.id}">⚡ 填入</button>
            <button type="button" class="rf-pwd-saved-btn btn-vault-copy" data-id="${item.id}">📋 复制</button>
            <button type="button" class="rf-pwd-saved-btn danger btn-vault-del" data-id="${item.id}" title="删除此记录">🗑️</button>
          </div>
        `;
        container.appendChild(row);
      });

      container.querySelectorAll(".btn-vault-toggle-eye").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          const maskSpan = container.querySelector(`.vault-pwd-mask[data-id="${id}"]`);
          if (targetItem && maskSpan) {
            const isMasked = maskSpan.textContent.includes("•");
            maskSpan.textContent = isMasked ? targetItem.password : "••••••••";
            btn.textContent = isMasked ? "🙈" : "👁️";
          }
        });
      });

      container.querySelectorAll(".btn-vault-fill").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem) fillPasswordValue(targetItem.password);
        });
      });

      container.querySelectorAll(".btn-vault-copy").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem) {
            try {
              await navigator.clipboard.writeText(targetItem.password);
              showToast(`已复制「${targetItem.siteName || targetItem.domain}」密码`);
            } catch (_) {
              showToast("复制失败", "error");
            }
          }
        });
      });

      container.querySelectorAll(".btn-vault-del").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem && confirm(`确定删除「${targetItem.siteName || targetItem.domain}」的密码备忘吗？`)) {
            const next = savedPasswordsList.filter(p => p.id !== id);
            await persistSavedPasswords(next);
            showToast("已删除对应密码备忘");
          }
        });
      });
    }

    function fillPasswordValue(pwd) {
      if (!pwd) return;
      const api = window.ResumeFillerContent;
      if (api && typeof api.fillPasswordToPage === "function") {
        const r = api.fillPasswordToPage(pwd);
        if (r && r.success) {
          const hasConfirm = r.hasConfirm ? "（主密码框 + 确认密码框已同步填好）" : "";
          showToast(`✓ 密码已自动填入！${hasConfirm}`);
          updatePasswordTargetStatusUI();
          return;
        }
      }
      showToast("请点击页面密码框以填入", "info");
      if (api && typeof api.startPasswordPickMode === "function") {
        api.startPasswordPickMode(pwd);
        closePwdMenu();
      }
    }

    async function openPwdMenu() {
      if (!pwdMenu) return;
      if (typeof closeSmsMenu === "function") closeSmsMenu();
      if (typeof closeSiteMenu === "function") closeSiteMenu();

      pwdMenu.classList.remove("rf-hidden");
      pwdMenu.style.display = "flex";

      // 加载并渲染密码保险库与当前站点状态
      await loadSavedPasswords();
      renderPasswordVaultUI();

      // 自动提取网页上的密码规则提示作为初始值
      const api = window.ResumeFillerContent;
      let hint = "";
      if (api && typeof api.extractPasswordRequirementHints === "function") {
        hint = api.extractPasswordRequirementHints();
      }
      if (pwdRuleInput && (!pwdRuleInput.value.trim() || hint)) {
        pwdRuleInput.value = hint || "8-16位，包含大写字母、小写字母、数字和特殊字符";
      }

      updatePasswordTargetStatusUI();

      if (!currentGeneratedPassword) {
        await triggerGeneratePassword(pwdRuleInput.value);
      }
    }
    if (btnPasswordGen && pwdMenu) {
      btnPasswordGen.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = pwdMenu.classList.contains("rf-hidden") || pwdMenu.style.display === "none";
        if (isHidden) openPwdMenu(); else closePwdMenu();
      });

      const closePwdBtn = shadow.getElementById("rf-btn-close-pwd-menu");
      if (closePwdBtn) {
        closePwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          closePwdMenu();
        });
      }

      // 切换明文/密文小眼睛
      if (pwdToggleEye) {
        pwdToggleEye.addEventListener("click", (e) => {
          e.stopPropagation();
          isPasswordMasked = !isPasswordMasked;
          updatePasswordDisplayUI(currentGeneratedPassword);
        });
      }

      // 重新生成 / 换一个
      const regenBtn = shadow.getElementById("rf-pwd-btn-regen");
      if (regenBtn) {
        regenBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          regenBtn.textContent = "⏳…";
          await triggerGeneratePassword(pwdRuleInput ? pwdRuleInput.value : "");
          regenBtn.textContent = "🎲 换一个";
        });
      }

      // AI 按要求生成按钮
      const aiGenBtn = shadow.getElementById("rf-pwd-btn-ai-generate");
      if (aiGenBtn) {
        aiGenBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          aiGenBtn.textContent = "🪄 AI 理解生成中…";
          aiGenBtn.disabled = true;
          try {
            await triggerGeneratePassword(pwdRuleInput ? pwdRuleInput.value : "", true);
          } finally {
            aiGenBtn.textContent = "🪄 AI 按要求生成新密码";
            aiGenBtn.disabled = false;
          }
        });
      }

      // 复制密码
      const copyPwdBtn = shadow.getElementById("rf-pwd-btn-copy");
      if (copyPwdBtn) {
        copyPwdBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("暂无可复制的密码", "error");
            return;
          }
          try {
            await navigator.clipboard.writeText(currentGeneratedPassword);
            copyPwdBtn.textContent = "✓ 已复制";
            showToast(`已复制密码：${currentGeneratedPassword}`);
            setTimeout(() => { copyPwdBtn.textContent = "📋 复制密码"; }, 1500);
          } catch (err) {
            showToast("复制失败", "error");
          }
        });
      }

      // 填入当前密码框（主密码框 + 确认密码框同时填好）
      const fillPwdBtn = shadow.getElementById("rf-pwd-btn-fill");
      if (fillPwdBtn) {
        fillPwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("请先生成密码", "error");
            return;
          }
          const api = window.ResumeFillerContent;
          if (!api || typeof api.fillPasswordToPage !== "function") {
            showToast("当前页面不支持填入", "error");
            return;
          }
          const r = api.fillPasswordToPage(currentGeneratedPassword);
          if (r && r.success) {
            const hasConfirm = r.hasConfirm ? "（主密码框 + 确认密码框已同步填好）" : "";
            showToast(`✓ 密码已自动填入！${hasConfirm}`);
            updatePasswordTargetStatusUI();
          } else {
            showToast((r && r.reason) || "填入失败，请使用「👉 点选填入」", "error");
          }
        });
      }

      // 点选填入
      const pickPwdBtn = shadow.getElementById("rf-pwd-btn-pick");
      if (pickPwdBtn) {
        pickPwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("请先生成密码", "error");
            return;
          }
          const api = window.ResumeFillerContent;
          if (!api || typeof api.startPasswordPickMode !== "function") {
            showToast("当前页面不支持点选", "error");
            return;
          }
          closePwdMenu();
          api.startPasswordPickMode(currentGeneratedPassword);
        });
      }

      // 提取网页规则按钮
      const extractBtn = shadow.getElementById("rf-pwd-btn-extract");
      if (extractBtn) {
        extractBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const api = window.ResumeFillerContent;
          let hint = "";
          if (api && typeof api.extractPasswordRequirementHints === "function") {
            hint = api.extractPasswordRequirementHints();
          }
          if (hint) {
            if (pwdRuleInput) pwdRuleInput.value = hint;
            showToast(`✓ 已从网页提取要求：${hint.slice(0, 20)}...`);
            await triggerGeneratePassword(hint);
          } else {
            showToast("网页未检测到显式规则提示，已保留推荐规则", "info");
          }
        });
      }

      // 预设快捷标签点击
      shadow.querySelectorAll(".rf-pwd-tag").forEach((tag) => {
        tag.addEventListener("click", async (e) => {
          e.stopPropagation();
          const rule = tag.getAttribute("data-rule");
          if (rule && pwdRuleInput) {
            pwdRuleInput.value = rule;
            showToast(`已切换规则：${tag.textContent.trim()}`);
            await triggerGeneratePassword(rule);
          }
        });
      });
      // 保存为当前站点密码
      const saveSiteBtn = shadow.getElementById("rf-pwd-btn-save-site");
      if (saveSiteBtn) {
        saveSiteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const pwd = currentGeneratedPassword;
          if (!pwd) {
            showToast("请先生成密码后再保存", "error");
            return;
          }
          const domain = getDomainFromUrl();
          const siteName = getSiteDisplayName();
          const accInput = shadow.getElementById("rf-pwd-account-input");
          const account = (accInput ? accInput.value.trim() : "") || (resumeData.basic && resumeData.basic.phone) || "";

          const existingIdx = savedPasswordsList.findIndex(p => p.domain === domain);
          const nowStr = new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

          const newEntry = {
            id: existingIdx !== -1 ? savedPasswordsList[existingIdx].id : ("pwd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
            domain,
            siteName,
            url: window.location.href,
            account,
            password: pwd,
            updatedAt: nowStr
          };

          const nextList = [...savedPasswordsList];
          if (existingIdx !== -1) {
            nextList[existingIdx] = newEntry;
          } else {
            nextList.unshift(newEntry);
          }

          await persistSavedPasswords(nextList);
          showToast(`✓ 已成功保存「${siteName}」求职密码！`);
        });
      }

      // 当前站点已存密码卡片上的眼睛切换
      const savedEyeBtn = shadow.getElementById("rf-pwd-saved-toggle-eye");
      if (savedEyeBtn) {
        savedEyeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          isCurrentSavedMasked = !isCurrentSavedMasked;
          renderPasswordVaultUI();
        });
      }

      // 保险库抽屉折叠展开
      const vaultToggle = shadow.getElementById("rf-pwd-vault-toggle");
      const vaultDrawer = shadow.getElementById("rf-pwd-vault-drawer");
      const vaultArrow = shadow.getElementById("rf-pwd-vault-arrow");
      if (vaultToggle && vaultDrawer) {
        vaultToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const isClosed = vaultDrawer.style.display === "none";
          vaultDrawer.style.display = isClosed ? "block" : "none";
          if (vaultArrow) vaultArrow.textContent = isClosed ? "▴" : "▾";
          if (isClosed) renderVaultItemsList();
        });
      }

      const vaultSearch = shadow.getElementById("rf-pwd-vault-search");
      if (vaultSearch) {
        vaultSearch.addEventListener("input", (e) => {
          renderVaultItemsList(e.target.value);
        });
      }

      const vaultExport = shadow.getElementById("rf-pwd-vault-export");
      if (vaultExport) {
        vaultExport.addEventListener("click", (e) => {
          e.stopPropagation();
          if (savedPasswordsList.length === 0) {
            showToast("暂无可导出的密码记录", "error");
            return;
          }
          const blob = new Blob([JSON.stringify(savedPasswordsList, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `offergo_passwords_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast("已导出全部站点密码备份");
        });
      }

      // 点击卡片内部其它地方，关闭密码浮层
      cardModal.addEventListener("click", (e) => {
        if (!pwdMenu.contains(e.target) && e.target !== btnPasswordGen && !btnPasswordGen.contains(e.target)) {
          closePwdMenu();
        }
      });

      pwdMenu.addEventListener("click", (e) => e.stopPropagation());
    }

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
      // 如果是子 iframe，默认允许气泡弹出以保障嵌入式表单体验
      isPillEnabled = !isTopFrame ? (!res.isBlacklisted) : res.pillEnabled;
      isBlacklisted = res.isBlacklisted;

      if (!isTopFrame) {
        // 子 iframe 内仅保留焦点智能气泡，隐藏主悬浮球与大卡片，避免多球重叠
        if (triggerBtn) triggerBtn.style.setProperty("display", "none", "important");
        if (cardModal) cardModal.style.setProperty("display", "none", "important");
        if (ghostBadge) ghostBadge.style.setProperty("display", "none", "important");
      } else if (isBlacklisted) {
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


  // --- [src/card/10_section_navigation.js] ---
// ==================== 标签页左侧分块快速导航 ====================
// 统一为每个一级标签提供左侧锚点导航，右侧区域独立滚动；不改变原有字段、填写和复制事件。

  const panelDefinitions = {
    basic: [
      { id: "basic-personal", label: "个人信息", target: () => shadow.querySelector('[data-key="basic.name"]') },
      { id: "basic-contact", label: "联系方式", target: () => shadow.querySelector('[data-key="basic.phone"]') },
      { id: "basic-location", label: "身份与所在地", target: () => shadow.querySelector('[data-key="basic.idCard"]') },
      { id: "basic-links", label: "账号与链接", target: () => shadow.querySelector('[data-key="basic.website"]') },
      { id: "basic-intent", label: "求职信息", target: () => shadow.querySelector('[data-key="basic.jobIntent"]') },
      { id: "basic-family", label: "家庭关系", target: () => shadow.getElementById("rf-family-list") },
      { id: "basic-summary", label: "自我评价", target: () => shadow.querySelector('[data-key="basic.selfEval"]') }
    ],
    education: [
      { id: "education-top", label: "教育经历总览", target: () => shadow.getElementById("rf-edu-list") },
      { id: "education-add", label: "新增教育经历", target: () => shadow.getElementById("rf-btn-add-edu") }
    ],
    internship: [
      { id: "internship-top", label: "实习经历总览", target: () => shadow.getElementById("rf-intern-list") },
      { id: "internship-add", label: "新增工作实习", target: () => shadow.getElementById("rf-btn-add-intern") }
    ],
    project: [
      { id: "project-top", label: "项目经历总览", target: () => shadow.getElementById("rf-proj-list") },
      { id: "project-add", label: "新增项目经历", target: () => shadow.getElementById("rf-btn-add-proj") }
    ],
    skills: [
      { id: "skills-main", label: "专业技能", target: () => shadow.querySelector('[data-key="skills"]') },
      { id: "skills-language", label: "语言能力", target: () => shadow.querySelector('[data-key="languages"]') },
      { id: "skills-honors", label: "荣誉奖项", target: () => shadow.getElementById("rf-honor-list") },
      { id: "skills-add-honor", label: "新增荣誉", target: () => shadow.getElementById("rf-btn-add-honor") }
    ],
    "paper-comp": [
      { id: "comp-main", label: "竞赛经历", target: () => shadow.getElementById("rf-comp-list") },
      { id: "comp-add", label: "新增赛事", target: () => shadow.getElementById("rf-btn-add-comp") },
      { id: "paper-main", label: "论文 / 专利", target: () => shadow.getElementById("rf-paper-list") },
      { id: "paper-add", label: "新增论文", target: () => shadow.getElementById("rf-btn-add-paper") }
    ],
    "ai-config": [
      { id: "ai-protocol", label: "模型协议", target: () => shadow.getElementById("rf-ai-protocol") },
      { id: "ai-endpoint", label: "服务地址", target: () => shadow.getElementById("rf-ai-base-url") },
      { id: "ai-key", label: "API Key", target: () => shadow.getElementById("rf-ai-api-key") },
      { id: "ai-model", label: "模型名称", target: () => shadow.getElementById("rf-ai-model") },
      { id: "ai-test", label: "连接测试", target: () => shadow.getElementById("rf-btn-test-api") },
      { id: "ai-audit", label: "诊断日志", target: () => shadow.getElementById("rf-agent-log-summary") }
    ]
  };

  function panelKey(panel) {
    return panel.id.replace(/^panel-/, "");
  }

  function getDynamicDefinitions(key, panel) {
    let list = [];
    if (key === "education") list = Array.from(panel.querySelectorAll("#rf-edu-list > .rf-sub-card"));
    if (key === "internship") list = Array.from(panel.querySelectorAll("#rf-intern-list > .rf-sub-card"));
    if (key === "project") list = Array.from(panel.querySelectorAll("#rf-proj-list > .rf-sub-card"));
    if (key === "skills") list = Array.from(panel.querySelectorAll("#rf-honor-list > .rf-sub-card"));
    if (key === "paper-comp") {
      list = [
        ...Array.from(panel.querySelectorAll("#rf-comp-list > .rf-sub-card")),
        ...Array.from(panel.querySelectorAll("#rf-paper-list > .rf-sub-card"))
      ];
    }
    return list.map((card, index) => {
      const title = card.querySelector(".rf-sub-card-title")?.textContent?.trim() || `记录 ${index + 1}`;
      const id = `${key}-record-${index}`;
      card.dataset.rfSectionId = id;
      return {
        id,
        label: title.length > 16 ? `${title.slice(0, 15)}…` : title,
        target: () => shadow.querySelector(`[data-rf-section-id="${id}"]`)
      };
    });
  }

  function sectionHasContent(target) {
    if (!target) return false;
    if (target.matches?.("input, textarea, select")) return !!String(target.value || "").trim();
    return !!target.querySelector?.("input:not([type='file']), textarea, select") &&
      Array.from(target.querySelectorAll("input:not([type='file']), textarea, select")).some(el => String(el.value || "").trim());
  }

  function buildPanel(panel) {
    if (!panel.classList.contains("rf-tab-panel")) return;
    const key = panelKey(panel);
    let scroll = Array.from(panel.children).find(el => el.classList.contains("rf-section-scroll"));
    let nav = Array.from(panel.children).find(el => el.classList.contains("rf-section-nav"));
    if (!scroll) {
      scroll = document.createElement("div");
      scroll.className = "rf-section-scroll";
      while (panel.firstChild) scroll.appendChild(panel.firstChild);
      nav = document.createElement("nav");
      nav.className = "rf-section-nav";
      panel.append(nav, scroll);
    }

    const defs = [...(panelDefinitions[key] || []), ...getDynamicDefinitions(key, scroll)];
    nav.innerHTML = defs.map(def => `<button type="button" class="rf-section-nav-item" data-rf-nav-id="${def.id}"><span class="rf-section-nav-dot"></span><span>${def.label}</span></button>`).join("");
    const items = Array.from(nav.querySelectorAll(".rf-section-nav-item"));
    items.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const def = defs[index];
        const target = def.target();
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        items.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      });
      const target = defs[index].target();
      if (sectionHasContent(target)) item.classList.add("has-content");
    });

    const updateActive = () => {
      const scrollRect = scroll.getBoundingClientRect();
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      defs.forEach((def, index) => {
        const target = def.target();
        if (!target) return;
        const distance = Math.abs(target.getBoundingClientRect().top - scrollRect.top - 12);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      items.forEach((item, index) => item.classList.toggle("active", index === bestIndex));
    };
    scroll.onscroll = updateActive;
    updateActive();
  }

  function refreshSectionNavigation() {
    shadow.querySelectorAll(".rf-tab-panel").forEach(buildPanel);
  }

  // updateAllViews 会在数据加载、版本切换、增删经历时调用；每次刷新导航以同步动态记录。



setTimeout(() => {
  try { refreshSectionNavigation(); } catch (err) { console.warn("OfferGo section navigation init failed", err); }
}, 0);
window.__offerGoRefreshSectionNavigation = refreshSectionNavigation;
// 初始化后通过全局调用，供生命周期模块在数据渲染完成后重建导航。
window.__offerGoSectionNav = { refresh: refreshSectionNavigation };


  // --- [src/card/09_lifecycle.js] ---
// 20. 监听 background 发来的消息 (展开切换 & Agent 状态广播)
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === "toggleFloatingCard" && isTopFrame) {
          if (msg.forceExpand) {
            expandCard();
          } else {
            toggleCard();
          }
        }

        // Agent 状态实时推送到看板
        if (msg && msg.action === "agentStatusUpdate") {
          const agentPanel = shadow.getElementById("rf-agent-status-panel");
          const agentBadge = shadow.getElementById("rf-agent-status-badge");
          const agentMsg = shadow.getElementById("rf-agent-status-msg");
          const agentResumeAction = shadow.getElementById("rf-agent-resume-action");
          const startAgentBtn = shadow.getElementById("rf-btn-start-agent");

          if (agentPanel) {
            agentPanel.classList.remove("rf-hidden");
            agentPanel.style.display = "block";
          }
          if (agentBadge && msg.round !== undefined) {
            agentBadge.textContent = msg.round > 0 ? `第 ${msg.round} 轮` : "预填";
          }
          if (agentMsg && msg.message) {
            agentMsg.textContent = msg.message;
          }

          if (msg.phase === "paused") {
            if (agentResumeAction) agentResumeAction.style.display = "block";
            showToast(msg.message, true);
          } else if (msg.phase === "finished") {
            if (agentResumeAction) agentResumeAction.style.display = "none";
            if (startAgentBtn) {
              startAgentBtn.disabled = false;
              startAgentBtn.style.opacity = "1";
            }
            showToast(msg.message);
            setTimeout(() => {
              if (agentPanel) {
                agentPanel.style.transition = "opacity 0.5s ease";
                agentPanel.style.opacity = "0";
                setTimeout(() => {
                  agentPanel.style.display = "none";
                  agentPanel.style.opacity = "1";
                  agentPanel.style.transition = "";
                }, 500);
              }
            }, 6000);
          }
        }
      });
    }

    // ATS SPA/Hash 路由或动态卡片完成挂载后，重新触发轻量页面分析；不会自动提交。
    window.addEventListener("rf-ats-form-stable", (event) => {
      const detail = event.detail || {};
      if (detail.controlCount === 0) return;
      if (window.ResumeFillerContent?.analyzePageFillCoverage) {
        const audit = window.ResumeFillerContent.analyzePageFillCoverage("ats_stable_rescan", resumeData);
        const retryable = audit.metrics?.actionableUnfilledCount ?? audit.metrics?.emptyFieldsCount ?? 0;
        if (agentMsg && !startAgentBtn?.disabled) agentMsg.textContent = `检测到 ${detail.profileName || detail.profileId} 页面更新：${retryable} 项可检查字段`;
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: "recordFillAudit", audit });
        }
      }
    });
    // 21. 绑定 Agent 启动与断点继续按钮
    const startAgentBtn = shadow.getElementById("rf-btn-start-agent");
    const btnResumeAgent = shadow.getElementById("rf-btn-resume-agent");
    const agentPanel = shadow.getElementById("rf-agent-status-panel");
    const agentMsg = shadow.getElementById("rf-agent-status-msg");
    const agentResumeAction = shadow.getElementById("rf-agent-resume-action");

    startAgentBtn?.addEventListener("click", () => {
      if (agentPanel) {
        agentPanel.classList.remove("rf-hidden");
        agentPanel.style.display = "block";
      }
      if (agentMsg) agentMsg.textContent = "⚡ 正在初始化 Zero-PII 符号化沙箱...";
      startAgentBtn.disabled = true;
      startAgentBtn.style.opacity = "0.7";
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        (async () => {
          if (agentMsg) agentMsg.textContent = "⚡ 正在以本地离线 Agent 状态机推进规划...";
          if (window.ResumeFillerContent && window.ResumeFillerContent.smartFillPage) {
            window.ResumeFillerContent.smartFillPage(resumeData);
          }
          await new Promise((r) => setTimeout(r, 350));
          if (window.ResumeFillerContent && window.ResumeFillerContent.planSymbolicStepsLocally) {
            const steps = window.ResumeFillerContent.planSymbolicStepsLocally(resumeData);
            for (const step of steps) {
              if (agentMsg) agentMsg.textContent = `⚡ 正在执行: ${step.reason || step.action}`;
              await window.ResumeFillerContent.executeSymbolicCommand(step, resumeData);
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          if (agentMsg) agentMsg.textContent = "🎉 本地 Agent 填报与核验完成！";
          startAgentBtn.disabled = false;
          startAgentBtn.style.opacity = "1";
          showToast("🎉 本地 Agent 填报完成！");
        })();
        return;
      }

      chrome.runtime.sendMessage({
        action: "startAgentAutofill",
        resumeData
      }, (res) => {
        startAgentBtn.disabled = false;
        startAgentBtn.style.opacity = "1";
        if (chrome.runtime.lastError || (res && !res.success)) {
          const err = chrome.runtime.lastError?.message || res?.error || "执行异常";
          if (agentMsg) agentMsg.textContent = `❌ Agent 提示: ${err}`;
          showToast(`Agent 执行提示: ${err}`, true);
        }
      });
    });

    btnResumeAgent?.addEventListener("click", () => {
      if (agentResumeAction) agentResumeAction.style.display = "none";
      if (agentMsg) agentMsg.textContent = "▶️ 继续推进 Agent 规划...";
      chrome.runtime.sendMessage({ action: "startAgentAutofill", resumeData });
    });

    const btnCopyAudit = shadow.getElementById("rf-btn-copy-audit");
    btnCopyAudit?.addEventListener("click", () => {
      if (window.ResumeFillerContent && window.ResumeFillerContent.analyzePageFillCoverage) {
        const audit = window.ResumeFillerContent.analyzePageFillCoverage("manual_inspect");
        const jsonStr = JSON.stringify(audit, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
          showToast(`✓ 已复制填充率报告 (${audit.metrics.fillRatePercent}%) 到剪贴板！`);
        }).catch(() => {
          showToast("复制失败，请通过侧边栏导出 JSON");
        });
      }
    });
  }

  // 初始化加载
  loadData().then(() => {
    initEvents();
    window.__offerGoSectionNav?.refresh?.();
  });
})();

// 初始化分块导航需在卡片模板、动态列表和数据加载完成后执行。
