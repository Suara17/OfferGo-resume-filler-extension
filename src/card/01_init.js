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
