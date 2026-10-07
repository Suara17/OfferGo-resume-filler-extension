// ==========================================================================
//  OfferGo - Content Script (Auto-generated from src/content/*.js)
//  请编辑 src/content/ 下对应的小模块文件，然后运行 npm run build (或 node build.js)
// ==========================================================================

// --- [src/content/01_profiles.js] ---
// ==================== ATS 系统 Profile Registry ====================
// Profile 仅决定探测、稳定等待和校验策略；填写仍必须经过统一的端侧回读验证。
const ATS_PROFILES = [
  { id: "beisen", name: "北森 Beisen / Phoenix", match: () => /zhiye\.com/i.test(location.hostname) || !!document.querySelector(".demo-beisen-fixture"), mode: "spa", controlRoots: [".phoenix-select"], errorSelectors: [".phoenix-form-explain", ".phoenix-input--error", ".phoenix-select--error"], settleMs: 500 },
  { id: "moka", name: "Moka HR", match: () => /mokahr\.com/i.test(location.hostname) || !!document.querySelector("[class*=moka- i]"), mode: "hash-spa", controlRoots: [], errorSelectors: ["[class*=moka-][class*=error i]", ".form-item--error"], settleMs: 650 },
  { id: "feishu", name: "飞书招聘 / Lark ATS", match: () => /jobs\.feishu\.cn/i.test(location.hostname) || !!document.querySelector("[class*=ud__ i], .ud-formily-item"), mode: "spa", controlRoots: [".ud__select", ".ud-formily-item"], errorSelectors: [".ud-formily-item-error", ".ud-form-item-error", "[class*=ud__][class*=error i]"], settleMs: 600 },
  { id: "haier", name: "海尔 Maker", match: () => /maker\.haier\.net/i.test(location.hostname) || !!document.querySelector("[pdtype], .xm-select, .xm-hide-input"), mode: "jquery", controlRoots: ["[pdtype]", ".xm-select"], errorSelectors: [".tip-wrong"], settleMs: 350 },
  { id: "hcmcloud", name: "浪潮 HCM Cloud", match: () => /hcmcloud\.cn/i.test(location.hostname) || !!document.querySelector("[data-ng-model], [ng-model]"), mode: "hash-angular", controlRoots: [], errorSelectors: ["[class*=error i]", "[class*=invalid i]"], settleMs: 650 },
  { id: "wecruit", name: "用友大易 / Wecruit", match: () => /hotjob\.cn/i.test(location.hostname) || /posResume\.html/i.test(location.pathname), mode: "traditional", controlRoots: [], errorSelectors: [".error", ".help-block-error", "[class*=error i]"], settleMs: 350 },
  { id: "51job", name: "51job / 智联 / 应届生", match: () => /51job\.com|zhaopin\.com|yingjiesheng\.com/i.test(location.hostname), mode: "wizard", controlRoots: [], errorSelectors: [".el-form-item__error", ".error", "[class*=error i]"], settleMs: 500 },
  { id: "generic", name: "通用网页表单", match: () => true, mode: "generic", controlRoots: [], errorSelectors: [".ant-form-item-explain-error", ".el-form-item__error", ".error-tip", "[class*=error i]", "[class*=invalid i]"], settleMs: 400 }
];

function getAtsProfile() {
  return ATS_PROFILES.find(profile => { try { return profile.match(); } catch (_) { return false; } }) || ATS_PROFILES.at(-1);
}

function getAtsRouteKey() {
  return `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
}

function getProfileErrorSelectors() {
  const profile = getAtsProfile();
  return [...new Set([...(profile.errorSelectors || []), ".ant-form-item-explain-error", ".el-form-item__error", ".error-tip", "[class*=error i]", "[class*=invalid i]"])];
}



// --- [src/content/02_dom_tracker.js] ---
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



// --- [src/content/03_keywords.js] ---
// ==================== 智能匹配关键词及规则配置 ====================

const KEYWORDS = {
  // 基本信息
  name: ['姓名', '名字', 'name', 'username', 'realname', 'real name', '真实姓名'],
  lastName: ['姓氏', '姓', 'last name', 'lastname', 'family name', 'surname'],
  firstName: ['名字', '名', 'first name', 'firstname', 'given name'],
  gender: ['性别', 'gender', 'sex', '男', '女'],
  ethnicity: ['民族', 'ethnicity', 'nationality', '民 族'],
  birth: ['生日', '出生', '出生日期', '出生年月', 'birth', 'birthday', 'date of birth', 'dateofbirth', '年龄', 'age'],
  height: ['身高', 'height', '身 高', '身长'],
  weight: ['体重', 'weight', '体 重'],
  phone: ['手机', '电话', '联系电话', '手机号', 'phone', 'mobile', 'tel', 'contact', '联系方式'],
  email: ['邮箱', '邮件', '电子邮箱', 'email', 'mail'],
  political: ['政治面貌', '政治', 'political', 'politics', '面貌'],
  city: ['现居城市', '现居住城市', '居住城市', '当前城市', '期望工作城市', '期望工作地', '期望城市', '意向工作城市', 'current city', 'target city'],
  nativePlace: ['籍贯', '家乡', 'hometown', 'native place', 'birthplace', '生源地', '户籍所在地', '户籍地', '户口所在地', '户口地'],
  nativeProvince: ['户籍所在省', '户口所在省', '户籍省', '籍贯省', '出生省', '生源省'],
  nativeCity: ['户籍所在地市', '户口所在地市', '户籍市', '籍贯市', '出生城市', '生源城市'],
  residenceProvince: ['现居住省', '现居住地省', '现居省', '居住省', '所在省', '现住省', '居住地省'],
  residenceCity: ['现居住市', '现居住地市', '现居市', '居住市', '常住市', '现住市', '居住地市'],
  idCard: ['身份证', '身份证号', '身份证号码', '证件号码', '证件号', 'id card', 'idcard', 'id number', 'id_number', 'identity card', '公民身份号码'],
  wechat: ['微信', '微信号', '微信账号', 'wechat', 'weixin'],
  residence: ['现居地', '现居住地', '居住地', '居住地址', '现住址', '家庭住址', '通讯地址', '联系地址', '详细地址', '门牌号', 'residence', 'address', 'current address', 'home address', 'mailing address'],
  website: ['个人网站', '个人主页', '博客', 'website', 'blog', 'homepage', '个人网页', '作品集'],
  github: ['github', 'github主页', 'github链接', 'github地址', 'github repository'],
  emergencyContact: ['紧急联系人姓名', '紧急联系人名字', '紧急联系人', '联系人姓名', 'emergency contact name', 'emergency contact'],
  emergencyRelation: ['紧急联系人关系', '与紧急联系人关系', '与本人关系', '亲属关系', 'emergency relation', 'relationship'],
  emergencyPhone: ['紧急联系人电话', '紧急联系人手机', '紧急联系电话', '紧急联系方式', 'emergency contact phone', 'emergency phone'],
  jobIntent: ['求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位', '应聘岗位', '目标岗位', '期望岗位', '期望职位', '求职岗位', 'job intent', 'target position'],
  selfEval: ['自我评价', '自我介绍', '个人总结', '综合评价', '自我阐述', '个人优势', 'self evaluation', 'self intro', 'self_eval'],
  selfDescription: ['自我描述', '个人描述', '性格特质', '特质描述', '工作风格', 'self description', 'self_description', 'personal description'],
  highestDegree: ['最高学历', '最高学位', 'highest degree', 'highestdegree'],
  country: ['国家', '当前所在国家', '国籍', 'country', 'nationality', '所在地区', '国家地区'],
  acceptRelocation: ['调剂', '是否接受调剂', '接受城市调剂', '是否接受意向城市调剂', '接受调剂', '城市调剂', 'relocation', 'relocate'],
  extraInfo: ['补充说明', '其他说明', 'extra info', 'supplementary', '备注说明'],
  
  // 技能
  skills: ['专业技能', '技能', '技术栈', 'it技能', 'skills', 'skill', 'technologies', '特长'],
  languages: ['语言', '语言能力', '外语', '外语水平', '语言证书', 'languages', 'english', 'cet', 'ielts'],

  // 教育经历子字段
  education: {
    school: ['学校', '大学', '学院', '毕业院校', '毕业学校', 'school', 'university', 'college'],
    degree: ['学历', '学位', 'degree', 'education', 'level', '文化程度'],
    major: ['专业', '学科', 'major', 'discipline', 'subject', '主修专业', '专业名称'],
    gpa: ['gpa', '绩点', '排名', '成绩排名', '成绩', 'rank', 'score', '成绩绩点', '平均分'],
    start: ['入学', '开始', '教育开始', 'start', 'from'],
    end: ['毕业', '结束', '教育结束', 'end', 'to', '毕业时间', '毕业年份'],
    startYear: ['入学年', '入学年份', '开始年', '开始年份', '教育开始年', 'start year', 'start_year'],
    startMonth: ['入学月', '入学月份', '开始月', '开始月份', 'start month', 'start_month'],
    endYear: ['毕业年', '毕业年份', '结束年', '结束年份', 'end year', 'graduation year', 'end_year'],
    endMonth: ['毕业月', '毕业月份', '结束月', '结束月份', 'end month', 'graduation month', 'end_month'],
    supervisor: ['导师', '导师姓名', '指导老师', '指导教师', 'advisor', 'tutor', 'supervisor'],
    role: ['担任职务', '学生职务', '在校职务', '学生干部', '班长', '团支书', '职务', 'student role', 'campus role'],
    roleDescription: ['职务描述', '任职描述', '职务职责', '学生工作描述', '学生干部描述', '职务说明', 'role description'],
    majorDescription: ['专业描述', '专业介绍', '主修专业介绍', '专业概况', 'major description'],
    thesisTopic: ['毕业论文', '毕业设计', '毕业作品', '毕设', '论文题目', '毕设题目', 'thesis', 'graduation project', 'graduation thesis'],
    courses: ['课程', '主修', '核心课程', '专业课程', '主修课程', '主修专业课程', '所修课程', 'courses', 'coursework', 'main courses'],
    researchDirection: ['研究方向', '研究课题', '研究领域', '研究内容', 'research direction', 'research field', 'research area'],
    department: ['院系', '院系名称', '学院名称', 'department', 'faculty', 'college'],
    labExperience: ['实验室', '实验室经历', '科研经历', 'lab', 'laboratory'],
    studentId: ['学号', '学籍号', 'student id', 'studentid', 'student number', 'student_no'],
    schoolLocation: ['学校所在地', '学校所在城市', '学校地址', '院校所在地', '学校城市', 'school location', 'university location', 'school address']
  },

  // 工作实习子字段
  internship: {
    company: ['公司', '单位', '企业', '工作单位', '实习单位', 'company', 'organization', 'employer', 'workplace', '公司名称'],
    position: ['职位', '岗位', '角色', 'position', 'title', 'role', '工作岗位', '职位名称'],
    start: ['入职', '开始', '入职时间', 'start', 'from'],
    end: ['离职', '结束', '离职时间', 'end', 'to', 'until'],
    desc: ['职责', '描述', '工作内容', '工作描述', '业绩', 'desc', 'description', 'responsibility', 'duty', '工作职责'],
    witness: ['证明人', '是否有证明人', '有无证明人', 'witness'],
    witnessName: ['证明人姓名', '证明人名字', '证明人联系人', 'witness name', 'witnessname'],
    witnessRelation: ['证明人关系', '与证明人关系', '证明人与本人关系', 'witness relation', 'witness relationship'],
    witnessPosition: ['证明人职务', '证明人职位', 'witness position', 'witness title'],
    witnessCompany: ['证明人单位', '证明人工作单位', '证明人所在单位', 'witness company', 'witness employer'],
    witnessPhone: ['证明人联系方式', '证明人电话', '证明人手机', '证明人联系电话', 'witness phone', 'witness contact']
  },

  // 项目经历子字段
  project: {
    name: ['项目名称', '项目名字', '项目', 'project name', 'project title'],
    role: ['角色', '担任角色', '职位', 'role', 'position', '职责'],
    start: ['开始', '项目开始', 'start', 'from'],
    end: ['结束', '项目结束', 'end', 'to'],
    desc: ['项目描述', '项目介绍', '项目背景', '项目简介', '项目概述', 'project desc', 'project description', 'proj_desc', 'project summary'],
    duty: ['项目职责', '工作职责', '主要职责', '负责内容', '职责描述', '工作内容', '担任职责', 'project duty', 'project duties', 'responsibility', 'responsibilities', 'duty', 'duties'],
    result: ['项目成果', '项目业绩', '量化成果', '项目收益', '项目产出', '取得成果', 'project result', 'project results', 'project achievement', 'project achievements', 'achievements', 'project outcome'],
    tech: ['项目技术', '技术栈', '主要技术', '使用技术', 'tech', 'technologies', 'technology', 'tools'],
    link: ['项目链接', '项目地址', '项目网址', '演示地址', '在线地址', '代码地址', '仓库地址', 'github链接', 'project link', 'project url', 'demo url', 'repository']
  },

  // 赛事经历子字段
  competition: {
    name: ['赛事', '竞赛', '比赛', '赛事名称', '竞赛名称', 'competition name', 'contest name'],
    start: ['开始', '比赛开始', 'start', 'from'],
    end: ['结束', '比赛结束', 'end', 'to'],
    desc: ['描述', '成绩', '奖项', '赛事描述', '竞赛描述', 'desc', 'description']
  },

  // 论文期刊子字段
  paper: {
    title: ['论文', '期刊', '专利', '论文名称', '文献', 'paper title', 'publication title', '名称'],
    desc: ['论文描述', '摘要', '内容', 'desc', 'abstract', 'description', '描述'],
    result: ['发表', '成果', '期刊级别', '分区', 'result', 'status', 'journal']
  },

  // 荣誉奖项子字段
  honors: {
    name: ['奖项', '荣誉', '名称', '奖项名称', 'award', 'honor', 'title'],
    date: ['时间', '获奖时间', '日期', 'date', 'year'],
    level: ['机构', '级别', '颁发', '颁发机构', 'issuer', 'organization', 'level'],
    desc: ['奖项描述', '获奖描述', '荣誉描述', '奖励说明', '获奖说明', '奖项简介', 'award description', 'honor description']
  },

  // 家庭成员子字段 (国企/传统大厂高频)
  family: {
    relation: ['与本人关系', '家庭关系', '亲属关系', '关系'],
    name: ['家属姓名', '亲属姓名', '姓名', '成员姓名'],
    age: ['年龄', '家属年龄', '亲属年龄', '周岁', 'age'],
    political: ['政治面貌', '家属政治面貌', '亲属政治面貌', '政治', '面貌'],
    company: ['工作单位', '单位名称', '单位', '公司'],
    department: ['工作部门', '所在部门', '部门', '部 门'],
    position: ['职务', '职位', '担任职务', '职业'],
    phone: ['联系电话', '手机', '电话']
  }
};

// 强指示词定义 (按精细度排序：具体复合字段排在通用字段之前，严格规避截胡)
const STRONG_INDICATORS = [
  // 1. 紧急联系人细项 (电话/关系必须在姓名之前，防止包含“紧急联系人”被截胡)
  { section: 'basic', subKey: 'emergencyPhone', keywords: ['紧急联系人电话', '紧急联系人手机', '紧急联系电话', 'emergency contact phone', 'emergency phone'] },
  { section: 'basic', subKey: 'emergencyRelation', keywords: ['与紧急联系人关系', '紧急联系人关系', '与本人关系', '与联系人关系', 'emergency relation', 'relationship'] },
  { section: 'basic', subKey: 'emergencyContact', keywords: ['紧急联系人姓名', '紧急联系人名字', '联系人姓名', '紧急联系人', 'emergency contact name', 'emergency contact'] },

  // 2. 导师姓名与教育细项 (必须在通用姓名之前)
  { section: 'education', subKey: 'supervisor', keywords: ['导师姓名', '指导老师姓名', '指导老师', '导师', 'advisor name', 'supervisor name', 'advisor', 'tutor', 'supervisor'] },
  { section: 'education', subKey: 'roleDescription', keywords: ['职务描述', '任职描述', '职务职责', '学生工作描述', '学生干部描述', 'role description'] },
  { section: 'education', subKey: 'role', keywords: ['担任职务', '学生职务', '在校职务', '学生干部', '班长', '团支书', 'student role'] },
  { section: 'education', subKey: 'schoolLocation', keywords: ['学校所在地', '学校所在城市', '学校地址', '院校所在地', '学校城市', '院校所在省市', '就读城市', '就读所在地', 'school location', 'university location', 'school address'] },
  { section: 'education', subKey: 'school', keywords: ['最高学历学校', '最高学历院校', '毕业学校', '毕业院校', '就读学校', '就读院校', '毕业大学', '学校名称', '院校名称', 'school name', 'university name'] },
  { section: 'education', subKey: 'major', keywords: ['专业名称', '所学专业', '就读专业', '主修专业', '就读专业名称', '专业', 'major name', 'major', 'discipline'] },
  { section: 'basic', subKey: 'city', keywords: ['意向工作城市', '期望工作城市', '期望工作地', '期望城市', '意向城市', '就职城市', '工作地点', 'target city'] },
  { section: 'basic', subKey: 'jobIntent', keywords: ['求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位', '应聘岗位', '目标岗位', '期望岗位', '期望职位'] },
  { section: 'internship', subKey: 'desc', keywords: ['工作内容', '实习内容', '工作职责', '实习职责', '实习描述', '工作描述', '内容', '职责描述'] },
  { section: 'honors', subKey: 'desc', keywords: ['奖励说明', '获奖描述', '荣誉简介', '荣誉描述', '简介', '奖项说明'] },
  { section: 'education', subKey: 'degree', keywords: ['最高学历', '最高学位', '毕业学历', '学历学位'] },
  { section: 'education', subKey: 'startYear', keywords: ['入学年份', '入学年度', '开始年份', '教育开始年', 'start year', 'start_year', 'edu_start_year'] },
  { section: 'education', subKey: 'startMonth', keywords: ['入学月份', '开始月份', 'start month', 'start_month', 'edu_start_month'] },
  { section: 'education', subKey: 'endYear', keywords: ['毕业年份', '毕业年度', '结束年份', '毕业时间年', 'graduation year', 'end year', 'end_year', 'edu_end_year'] },
  { section: 'education', subKey: 'endMonth', keywords: ['毕业月份', '结束月份', '毕业时间月', 'graduation month', 'end month', 'end_month', 'edu_end_month'] },
  { section: 'education', subKey: 'start', keywords: ['入学时间', '入学年月', '就读时间', '就读开始时间', '在校开始时间', '入学日期', 'start date', 'edu_start_date'] },
  { section: 'education', subKey: 'end', keywords: ['毕业时间', '毕业年月', '就读结束时间', '就读结束年月', '在校结束时间', '毕业日期', 'graduation date', 'edu_end_date'] },
  { section: 'education', subKey: 'thesisTopic', keywords: ['毕业论文', '毕业设计', '毕业作品', '毕业论文题目', '毕业设计题目', '毕设题目', '毕业论文/设计', '毕业论文/设计/作品', 'thesis', 'graduation project'] },
  { section: 'education', subKey: 'courses', keywords: ['主修课程', '核心课程', '专业课程', '核心专业课程', '主修专业课程', '所修课程', 'main courses', 'core courses', 'courses'] },
  { section: 'education', subKey: 'researchDirection', keywords: ['研究方向', '研究课题', '研究领域', 'research direction', 'research field'] },
  { section: 'education', subKey: 'department', keywords: ['院系名称', '学院名称'] },
  { section: 'education', subKey: 'studentId', keywords: ['学号', '学籍号', 'student id', 'studentid', 'student number'] },

  // 3. 家庭成员强指示词 (必须在通用姓名/单位/电话之前)
  { section: 'family', subKey: 'name', keywords: ['家庭成员姓名', '亲属姓名', '父亲姓名', '母亲姓名', '家属姓名'] },
  { section: 'family', subKey: 'age', keywords: ['亲属年龄', '家属年龄', '父亲年龄', '母亲年龄', '父母年龄', '亲属周岁'] },
  { section: 'family', subKey: 'political', keywords: ['亲属政治面貌', '家属政治面貌', '父亲政治面貌', '母亲政治面貌'] },
  { section: 'family', subKey: 'company', keywords: ['家庭成员工作单位', '亲属工作单位', '家属工作单位', '父亲工作单位', '母亲工作单位', '父母单位'] },
  { section: 'family', subKey: 'department', keywords: ['亲属工作部门', '家属工作部门', '亲属部门', '家属部门', '工作部门'] },
  { section: 'family', subKey: 'phone', keywords: ['家庭成员电话', '亲属电话', '家属电话', '父亲电话', '母亲电话', '父母电话', '父亲联系电话', '母亲联系电话', '家属联系电话', '亲属联系电话', '父母联系电话'] },
  { section: 'family', subKey: 'position', keywords: ['家庭成员职务', '亲属职务', '家属职务', '父亲职务', '母亲职务'] },
  { section: 'family', subKey: 'relation', keywords: ['家庭成员关系', '亲属关系', '与本人关系'] },

  // 4. 工作实习证明人与经历 (强指示词排在通用词前)
  { section: 'internship', subKey: 'witness', keywords: ['是否有证明人', '有无证明人', '证明人存在'] },
  { section: 'internship', subKey: 'witnessName', keywords: ['证明人姓名', '证明人名字', '证明人联系人', '实习证明人姓名'] },
  { section: 'internship', subKey: 'witnessRelation', keywords: ['证明人关系', '与证明人关系', '证明人与本人关系'] },
  { section: 'internship', subKey: 'witnessPosition', keywords: ['证明人职务', '证明人职位', '带教职务', '直属领导职务'] },
  { section: 'internship', subKey: 'witnessCompany', keywords: ['证明人单位', '证明人工作单位', '证明人所在单位'] },
  { section: 'internship', subKey: 'witnessPhone', keywords: ['证明人联系方式', '证明人电话', '证明人手机', '证明人联系电话'] },
  { section: 'internship', subKey: 'company', keywords: ['公司名称', '单位名称', '企业名称', '实习单位', '工作单位', '就职单位', '雇主名称', 'company name', 'work_company', 'intern_company'] },
  { section: 'internship', subKey: 'position', keywords: ['职位名称', '岗位名称', '担任职位', '任职岗位', '职位', '岗位', '实习职位', '实习岗位', '工作职位', '工作岗位', '实习职务', '工作职务', 'internship position', 'intern_position', 'work_position'] },
  { section: 'internship', subKey: 'start', keywords: ['入职时间', '开始时间', '工作开始时间', '实习开始时间', '在职开始时间', '在职起', '开始年月'] },
  { section: 'internship', subKey: 'end', keywords: ['离职时间', '结束时间', '工作结束时间', '实习结束时间', '在职结束时间', '在职止', '结束年月'] },
  { section: 'internship', subKey: 'desc', keywords: ['实习描述', '工作描述', '实习内容', '工作内容', '实习职责', '工作职责', '内容', '职责描述', '工作业绩', 'internship desc', 'work desc', 'internship description'] },
  { section: 'project', subKey: 'name', keywords: ['项目名称', '项目名字', 'project name', 'project title', 'proj_name'] },
  { section: 'project', subKey: 'role', keywords: ['项目角色', '项目担任角色', '项目职位', '职务', '担任职务', '角色', '担任角色', '项目中职责', '负责模块', 'project role', 'proj_role'] },
  { section: 'project', subKey: 'start', keywords: ['项目开始时间', '项目开始年月', '研发开始时间', '起止时间起', '开始时间'] },
  { section: 'project', subKey: 'end', keywords: ['项目结束时间', '项目结束年月', '研发结束时间', '起止时间止', '结束时间'] },
  { section: 'project', subKey: 'desc', keywords: ['项目描述', '项目介绍', '项目背景', 'project desc', 'project description', 'proj_desc'] },
  { section: 'project', subKey: 'duty', keywords: ['项目职责', '负责内容', '主要职责', '工作职责', 'project duty', 'project duties', 'responsibility', 'proj_duty'] },
  { section: 'project', subKey: 'result', keywords: ['项目成果', '项目业绩', '量化成果', '项目收益', 'project result', 'project results', 'project achievement', 'proj_result'] },
  { section: 'project', subKey: 'link', keywords: ['项目链接', '项目地址', '项目网址', '演示地址', '在线地址', '代码地址', '仓库地址', 'github链接', 'project link', 'project url', 'demo url', 'repository'] },
  { section: 'project', subKey: 'tech', keywords: ['项目技术', '项目技术栈', 'project tech', 'project technology', 'proj_tech'] },
  // 5. 基础信息专项拆分与强指示词 (高特异性字段排在最前面，防止被通用姓名截胡)
  { section: 'basic', subKey: 'email', keywords: ['电子邮箱', '电子信箱', '联系邮箱', '个人邮箱', '常用邮箱', '我的邮箱', '邮箱地址', '邮箱', 'email', 'e-mail', 'mail address', 'mail'] },
  { section: 'basic', subKey: 'phone', keywords: ['手机号码', '联系电话', '手机号', '移动电话', '电话号码', '常用手机', '手机', 'phone', 'mobile', 'tel'] },
  { section: 'basic', subKey: 'lastName', keywords: ['姓氏', '姓', 'lastname', 'last name', 'family name', 'surname'] },
  { section: 'basic', subKey: 'firstName', keywords: ['名字', '名', 'firstname', 'first name', 'given name'] },
  { section: 'basic', subKey: 'idCard', keywords: ['身份证号码', '身份证号', '证件号码', '证件号', '身份证件号', '身份证', '公民身份证', '公民身份号码', 'id card', 'idcard', 'id number', 'identity card'] },
  { section: 'basic', subKey: 'name', keywords: ['真实姓名', '您的姓名', '中文姓名', '本人姓名', 'candidate name', 'applicant name', '姓名'] },
  { section: 'basic', subKey: 'height', keywords: ['身高', 'height', '身 高', '身长'] },
  { section: 'basic', subKey: 'weight', keywords: ['体重', 'weight', '体 重'] },
  { section: 'basic', subKey: 'ethnicity', keywords: ['民族', 'ethnicity', 'nationality', '民 族', '所属民族', '名族'] },
  { section: 'basic', subKey: 'nativeProvince', keywords: ['户籍所在地省', '户籍所在省', '户口所在地省', '户籍省', '籍贯省', '出生省', '生源省'] },
  { section: 'basic', subKey: 'nativeCity', keywords: ['户籍所在地市', '户籍所在市', '户口所在地市', '户籍市', '籍贯市', '出生城市', '生源市'] },
  { section: 'basic', subKey: 'residenceProvince', keywords: ['现居住省', '现居住地省', '现居省', '居住省', '所在省', '现住省', '居住地省'] },
  { section: 'basic', subKey: 'residenceCity', keywords: ['现居住市', '现居住地市', '现居市', '居住市', '所在市', '现住市', '居住地市'] },
  { section: 'basic', subKey: 'nativePlace', keywords: ['户口所在地', '生源所在地', '户籍所在地', '生源地', '户籍地', '户口地', '籍贯', '户籍地址', '户口地址', '生源地址', '籍贯地址', 'hometown', 'native place', 'birthplace'] },
  { section: 'basic', subKey: 'selfDescription', keywords: ['自我描述', '个人描述', '性格特质', '特质描述', 'self description', 'self_description'] },
  { section: 'basic', subKey: 'selfEval', keywords: ['自我评价', '自我介绍', 'self evaluation', 'self_eval'] },
  { section: 'basic', subKey: 'workYears', keywords: ['工作年限', '工作经验', '工作年资', '经验年限', '年限', 'work years'] },
  { section: 'basic', subKey: 'availableTime', keywords: ['到岗时间', '最快到岗时间', '入职时间', '何时到岗', '可到岗时间', 'available time'] },
  { section: 'basic', subKey: 'expectedSalary', keywords: ['期望月薪', '期望薪资', '期望月薪(税前)', '期望月薪（税前）', '薪资要求', '期望薪酬', '薪酬期望'] },
  { section: 'basic', subKey: 'currentSalary', keywords: ['现月薪', '目前月薪', '现月薪(税前)', '现月薪（税前）', '当前月薪'] },
  { section: 'basic', subKey: 'jobIndustry', keywords: ['期望从事行业', '期望行业', '意向行业', '从事行业', '目标行业'] },
  { section: 'basic', subKey: 'jobIntent', keywords: ['期望从事职业', '期望职业', '意向职业', '目标职位', '求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位'] },
  // 6. 赛事/论文/荣誉
  { section: 'competition', subKey: 'name', keywords: ['赛事名称', '竞赛名称', '比赛名称'] },
  { section: 'paper', subKey: 'title', keywords: ['论文名称', '期刊名称', '专利名称'] },
  { section: 'honors', subKey: 'desc', keywords: ['奖项描述', '获奖描述', '荣誉描述', '奖励说明', '获奖说明', '奖项简介', 'award description', 'honor description'] },
  { section: 'honors', subKey: 'name', keywords: ['奖项名称', '荣誉名称', '奖项名字', 'award name', 'honor name'] }
];

// 基础信息匹配排除词 (防止全局匹配错乱)
const EXCLUSIONS = {
  name: [
    '项目', '公司', '大学', '学校', '学院', '紧急', '联系人', '推荐', '家长', '老师', '导师', '单位', '奖', '荣誉', '亲属', '成员', '证明人', '推荐人',
    '姓氏', 'last name', 'lastname', 'family name', 'surname', 'first name', 'firstname',
    '邮箱', '邮件', '电子邮箱', 'email', 'e-mail', 'mail',
    '手机', '电话', '联系电话', '手机号', 'phone', 'mobile', 'tel',
    '身份证', '证件号', 'idcard', '微信号', 'wechat', '微信', '籍贯', '地址', '专业', '学历'
  ],
  lastName: ['姓名', '全名', 'real name', 'username', '真实姓名', '项目', '公司', '学校', '学院', '院校', '名称'],
  firstName: ['姓名', '全名', 'real name', 'username', '真实姓名', '项目', '公司', '学校', '学院', '院校', '签名', '域名', '名次', '名称'],
  phone: ['紧急', '联系人', '推荐', '家长', '老师', '导师', '公司', '单位', '亲属', '成员', '学校', '大学', '证明人', '推荐人', '父亲', '母亲', '父母', '家属'],
  email: ['联系人', '推荐', '公司', '单位', '亲属', '成员', '学校', '大学', '证明人', '推荐人'],
  jobIntent: ['项目', '公司', '实习', '学校', '专业', '调剂', '服从'],
  city: ['公司', '学校', '大学', '院校', '项目', '实习', '省', '调剂', '详细', '门牌'],
  nativePlace: ['所在省', '所在地省', '所在市', '所在地市', '所属省', '所属市', '省份', '城市'],
  nativeProvince: ['现居', '居住', '现住', '学校', '大学', '公司', '市', '区', '县'],
  nativeCity: ['现居', '居住', '现住', '学校', '大学', '公司', '省'],
  residenceProvince: ['户籍', '籍贯', '生源', '学校', '大学', '公司', '市', '区', '县'],
  residenceCity: ['户籍', '籍贯', '生源', '学校', '大学', '公司', '省'],
  idCard: ['证书', '银行卡', '护照'],
  residence: ['公司', '单位', '学校', '大学', '项目', '实习', '紧急'],
  website: ['github', 'git'],
  github: ['博客', '主页', 'homepage', 'blog'],
  height: ['体重', 'weight', '重'],
  weight: ['身高', 'height', '身'],
  emergencyContact: ['公司', '项目', '学校', '大学', '电话', '手机', '关系', 'phone', 'relation'],
  emergencyPhone: ['公司', '单位', '学校', '大学', '姓名', '名字', '关系', 'name', 'relation'],
  emergencyRelation: ['姓名', '名字', '电话', '手机', 'phone', 'name']
};



// --- [src/content/04_dom_context.js] ---
// ==================== DOM 上下文分析逻辑 ====================

// 判断一个元素是否为标题/头部标记
function isHeaderElement(el) {
  if (!el) return false;
  if (/^(H[1-6]|LEGEND)$/i.test(el.tagName)) return true;
  const className = (el.className || '').toString().toLowerCase();
  const idName = (el.id || '').toString().toLowerCase();
  return className.includes('title') || className.includes('header') || className.includes('legend') ||
         idName.includes('title') || idName.includes('header');
}

// 寻找最邻近的前置标题或同卡片核心特征，判断当前属于哪个表单板块（教育、项目、实习、荣誉、基本信息等）
function getContextSection(el) {
  if (!el) return null;

  // 1. 同卡片核心锚点推断 (向上攀爬寻找或 closest 经历卡片容器，彻底解决深层嵌套与标题缺失)
  let card = el.parentElement;
  let steps = 0;
  while (card && card !== document.body && steps < 10) {
    const inputCount = (typeof card.querySelectorAll === "function") ? card.querySelectorAll("input:not([type='hidden']), textarea, select").length : 0;
    if (inputCount >= 2 && inputCount <= 20) {
      const cardText = (card.innerText || card.textContent || "").slice(0, 1500);
      if (/公司名称|单位名称|企业名称|实习单位|工作单位|工作职责|实习职责/i.test(cardText)) {
        return "internship";
      }
      if (/项目名称|project name|项目职责|项目描述/i.test(cardText)) {
        return "project";
      }
      if (/学校名称|毕业院校|就读学校|毕业学校|最高学历学校|专业名称|所学专业/i.test(cardText)) {
        return "education";
      }
      if (/家庭成员|主要社会关系|父亲|母亲/i.test(cardText)) {
        return "family";
      }
      if (/奖项名称|荣誉名称|获奖时间/i.test(cardText)) {
        return "honors";
      }
    }
    if (inputCount > 20) break;
    card = card.parentElement;
    steps++;
  }

  // 兜底 closest 检查
  if (typeof el.closest === "function") {
    const closestCard = el.closest(".sub-section, .card, [class*='card' i], [class*='group' i], [class*='block' i], [class*='section' i], [class*='item-wrapper' i]");
    if (closestCard) {
      const cardText = (closestCard.innerText || closestCard.textContent || "").slice(0, 1500);
      if (/公司名称|单位名称|企业名称|实习单位|工作单位/i.test(cardText)) return "internship";
      if (/项目名称|project name/i.test(cardText)) return "project";
      if (/学校名称|毕业院校|就读学校|毕业学校/i.test(cardText)) return "education";
    }
  }
  let current = el;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      let header = null;
      if (isHeaderElement(sibling)) {
        header = sibling;
      } else {
        header = (typeof sibling.querySelector === "function") ? sibling.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="header"], legend') : null;
      }
      
      if (header) {
        const text = (header.textContent || "").replace(/[\s\t\n]+/g, "").toLowerCase();
        if (/教育经历|教育背景|学习经历|教育信息|学历信息|education/i.test(text)) {
          return 'education';
        }
        if (/项目经历|项目经验|科研项目|project/i.test(text)) {
          return 'project';
        }
        if (/工作经历|实习经历|工作经验|实习经验|任职经历|workexperience|internship/i.test(text)) {
          return 'internship';
        }
        if (/家庭成员|主要社会关系|家庭背景|亲属关系|family/i.test(text)) {
          return 'family';
        }
        if (/荣誉奖项|获奖经历|获奖情况|奖励情况|所获荣誉|honors|awards/i.test(text)) {
          return 'honors';
        }
        if (/基本信息|个人信息|个人资料|求职意向|联系信息|basicinfo|personalinfo/i.test(text)) {
          return 'basic';
        }
        if (/比赛经历|赛事经历|竞赛经历|competition/i.test(text)) {
          return 'competition';
        }
        if (/论文期刊|发表论文|学术期刊|专利成果|paper|publication/i.test(text)) {
          return 'paper';
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return null;
}

// 过滤页面上的占位词、错误提示词与无意义短语，严防污染为真实表单字段标签
function isMeaninglessLabelText(text) {
  if (!text) return true;
  const clean = text.replace(/[:：\*]/g, '').trim().toLowerCase();
  if (!clean || clean.length < 2) return true;
  return /^(?:请选择|请输入|请填写|必填|必填项|必填项未填写|项未写|未填写|未选择|select|choose|input|placeholder|\+86|86|年|月|日|至|到|--|~|至今|输入职位关键字|搜索职位)$/i.test(clean);
}

// 获取输入框最直接、最精准的关联标签 (Direct Label)，深度适配 Moka / 北森 / 飞书 / 各大厂自研招聘系统
function getElementDirectLabel(element) {
  if (!element) return "";
  // 飞书 Formily 的 label 位于 item 容器，不一定通过 label[for] 关联。
  if (getAtsProfile().id === "feishu") {
    const formilyLabel = getFeishuFormItemLabel(element);
    if (formilyLabel) return formilyLabel;
  }
  // Phoenix 真实交互目标是 select 根 div；标签通常绑定在其内部隐藏/搜索 input 上。
  const phoenixRoot = getPhoenixSelectRoot(element);
  if (phoenixRoot && phoenixRoot !== element) {
    const rootLabel = getElementDirectLabel(phoenixRoot);
    if (rootLabel) return rootLabel;
  }

  // 1. 标准 label[for] 关联
  if (element.id) {
    try {
      const l = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (l) {
        const text = (l.innerText || l.textContent || "").trim();
        if (text && text.length < 35 && !isMeaninglessLabelText(text)) {
          return text.replace(/[:：\*]/g, '').trim();
        }
      }
    } catch(e) {}
  }

  // 2. 被 label 直接包裹
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const text = (parentLabel.innerText || parentLabel.textContent || "").trim();
    if (text && text.length < 35 && !isMeaninglessLabelText(text)) {
      return text.replace(/[:：\*]/g, '').trim();
    }
  }

  // 3. 优先检索表单容器 (适配 Moka/北森/飞书/AntD/Element)
  // 查找最贴近当前输入的表单项容器，提取真实标签，严格排除错误提示节点和占位符节点
  const formItem = element.closest(
    '.form-item, .form-group, .ant-form-item, .el-form-item, .moka-form-item, .phoenix__form-item, ' +
    '[class*="form-item" i], [class*="formItem" i], [class*="field-item" i], [class*="fieldItem" i], ' +
    '[class*="item-wrapper" i], [class*="itemWrapper" i], [class*="form-group" i], [class*="fieldWrapper" i], ' +
    '[class*="formField" i], [class*="form-field" i], [class*="form_item" i], tr'
  );

  if (formItem) {
    const candidates = Array.from(formItem.querySelectorAll(
      'label, .ant-form-item-label, .el-form-item__label, [class*="item-label" i], [class*="itemLabel" i], ' +
      '[class*="field-label" i], [class*="fieldLabel" i], [class*="moka-form-item-label" i], ' +
      '[class*="label" i], [class*="title" i], th'
    )).filter(c => {
      if (c.contains(element)) return false;
      // 排除红字错误提示节点与占位符节点
      if (c.closest('[class*="error" i], [class*="explain" i], [class*="invalid" i], [class*="placeholder" i]')) return false;
      return true;
    });

    for (const cand of candidates) {
      const text = (cand.innerText || cand.textContent || "").replace(/[:：\*]/g, '').trim();
      if (text && text.length >= 2 && text.length < 35 && !isMeaninglessLabelText(text)) {
        return text;
      }
    }
  }

  // 4. 跨层级检索父级或祖先级的前置标题 (如 Moka 复杂的深层组件嵌套)
  // 4. 跨层级检索父级或祖先级的前置标题 (深度穿透，适配 Moka / 北森 常见的 5~8 层嵌套组件)
  let parent = element.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 8) {
    // 若当前容器已包含超过 3 个输入框，说明已经超出单个表单项范围进入了整行或整个板块，避免误取大标题
    if (parent.querySelectorAll("input:not([type='hidden']), textarea, select").length > 3) {
      break;
    }
    let pPrev = parent.previousElementSibling;
    while (pPrev) {
      if (!pPrev.closest('[class*="error" i], [class*="explain" i]')) {
        const text = (pPrev.innerText || pPrev.textContent || "").replace(/[:：\*]/g, '').trim();
        if (text && text.length >= 2 && text.length < 35 && !isMeaninglessLabelText(text)) {
          return text;
        }
      }
      pPrev = pPrev.previousElementSibling;
    }
    parent = parent.parentElement;
    depth++;
  }
  // 5. 前置兄弟节点兜底 (仅当非无效词时采纳)
  let prev = element.previousElementSibling;
  while (prev) {
    if (!prev.closest('[class*="error" i], [class*="explain" i]')) {
      const text = (prev.innerText || prev.textContent || "").replace(/[:：\*]/g, '').trim();
      if (text && text.length >= 2 && text.length < 30 && !isMeaninglessLabelText(text)) {
        return text;
      }
    }
    prev = prev.previousElementSibling;
  }

  return "";
}

// 获取输入框周围的所有文本线索，用来做模糊识别
function getElementClues(element) {
  let clues = [];
  
  const directLabel = getElementDirectLabel(element);
  if (directLabel) {
    clues.push(directLabel.toLowerCase());
  }
  if (getAtsProfile().id === "feishu") {
    const formilyLabel = getFeishuFormItemLabel(element);
    if (formilyLabel && !clues.includes(formilyLabel.toLowerCase())) clues.unshift(formilyLabel.toLowerCase());
  }

  if (element.placeholder) {
    clues.push(element.placeholder.toLowerCase());
  }
  if (element.name) {
    clues.push(element.name.toLowerCase());
  }
  if (element.id) {
    clues.push(element.id.toLowerCase());
  }
  if (element.getAttribute("aria-label")) {
    clues.push(element.getAttribute("aria-label").toLowerCase());
  }
  if (isPhoenixSelectRoot(element)) {
    const ownText = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (ownText && ownText.length < 100) clues.push(ownText.toLowerCase());
  }
  
  // 后置兄弟节点文本 (如 [下拉框] 年, [下拉框] 月, 至, 到, -- 等关键线索)
  let next = element.nextSibling;
  if (next) {
    const text = next.textContent ? next.textContent.trim() : (next.nodeValue ? next.nodeValue.trim() : "");
    if (text && text.length < 20) clues.push(text.toLowerCase());
  }
  let nextEl = element.nextElementSibling;
  if (nextEl) {
    const text = (nextEl.innerText || nextEl.textContent || "").trim();
    if (text && text.length < 20) clues.push(text.toLowerCase());
  }

  // 过滤特殊字符并移除多余空字符
  return clues.map(c => c.trim().replace(/[:：\*]/g, '')).filter(c => c.length > 0);
}

// 检查线索中是否包含指定的关键词
function isMatch(clues, keywords) {
  if (!Array.isArray(keywords) || !Array.isArray(clues)) return false;
  return clues.some(clue => {
    return keywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      
      // 特殊单字防误伤防护：
      // 1. 单字“名”：防止“学校名称”、“公司名称”、“项目名称”、“姓名”误命中单字“名”
      if (keyword === "名") {
        if (/学校|院校|单位|公司|项目|姓名|全名|realname|username|域名|名次|签名|名称/i.test(clue)) {
          return false;
        }
        return /(?:^|[\s\(/（/\\_-])名(?:$|[\s\)/）/\\*：:_-])|first\s*name|given\s*name/i.test(clue) || clue === "名";
      }

      // 2. 单字“姓”：防止“姓名”、“真实姓名”误命中单字“姓”
      if (keyword === "姓") {
        if (/姓名|全名|realname|username/i.test(clue)) {
          return false;
        }
        return /(?:^|[\s\(/（/\\_-])姓(?:$|[\s\)/）/\\*：:_-])|last\s*name|family\s*name|surname/i.test(clue) || clue === "姓";
      }

      // 3. 仅对英文短单词 (长度 <= 3) 启用单词边界匹配，防止 substring 误伤 (如 end 匹配 gender)
      if (lowerKeyword.length <= 3 && /^[a-z]+$/i.test(lowerKeyword)) {
        const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
        return regex.test(clue) || clue === lowerKeyword;
      }

      return clue.includes(lowerKeyword);
    });
  });
}



// --- [src/content/05_ats_adapters.js] ---
// ==================== 事件分发与智能穿透（适配 React/Vue/DatePicker/Cascader） ====================

// ==================== 飞书 ud__ / Formily 适配 ====================
function findFormilyContainer(element) {
  let current = element;
  for (let depth = 0; current && current !== document.body && depth < 8; depth++, current = current.parentElement) {
    const className = String(current.className || "");
    if (/\bud-formily-item\b|\bud-form-item\b/.test(className) && current.querySelector("input, select, textarea, [role=combobox]")) return current;
  }
  return null;
}

function getFeishuFormItem(element) {
  if (!element?.closest) return null;
  return element.closest(".ud-formily-item, [class*=ud-formily-item i], .ud-form-item, [class*=ud__form i], [class*=form-item i]");
}

function getFeishuFormItemLabel(element) {
  const item = getFeishuFormItem(element);
  if (!item) return "";
  const label = item.querySelector(".ud-formily-item-label, [class*=formily-item-label i], .ud-form-item-label, label, [class*=label i]");
  return (label?.innerText || label?.textContent || "").replace(/[：:*]/g, "").replace(/\s+/g, " ").trim();
}

function isFeishuSelectControl(element) {
  if (!element) return false;
  const item = getFeishuFormItem(element);
  const text = `${element.className || ""} ${element.getAttribute?.("role") || ""} ${item?.className || ""}`;
  return /ud__select|select|combobox|autocomplete/i.test(text);
}

function isFeishuMultiSelectControl(element) {
  const item = getFeishuFormItem(element);
  const text = `${element.getAttribute?.("aria-multiselectable") || ""} ${element.className || ""} ${item?.innerText || ""}`;
  return element.getAttribute?.("aria-multiselectable") === "true" || /multiple|多选|已选/.test(text);
}

function getFeishuVisibleOptions() {
  return Array.from(document.querySelectorAll(".ud__select__list__item, [class*=ud__select i][class*=item i], [role=option]"))
    .filter(item => { const style = window.getComputedStyle(item); return style.display !== "none" && style.visibility !== "hidden" && item.getAttribute("aria-disabled") !== "true"; });
}

function chooseFeishuVisibleOption(targetValue) {
  const target = String(targetValue || "").trim().toLowerCase();
  if (!target) return false;
  const option = getFeishuVisibleOptions().map(item => ({ item, text: (item.innerText || item.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() }))
    .find(entry => entry.text === target || entry.text.includes(target) || target.includes(entry.text));
  if (!option) return false;
  option.item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  option.item.click();
  return true;
}

function invokeFeishuFormilyChange(element, value, { multi = false } = {}) {
  let invoked = false;
  walkReactFiber(element, fiber => {
    const props = fiber.memoizedProps || fiber.pendingProps || {};
    if (typeof props.onChange !== "function") return false;
    try {
      props.onChange(multi ? (Array.isArray(value) ? value : [value]) : value);
      invoked = true;
      return true;
    } catch (_) { return false; }
  });
  return invoked;
}
// ==================== React/Fiber 受控组件安全桥 ====================
function getReactFiberNode(element) {
  if (!element) return null;
  const key = Object.keys(element).find(name => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
  return key ? element[key] : null;
}

function walkReactFiber(element, visitor, maxDepth = 28) {
  let fiber = getReactFiberNode(element);
  let depth = 0;
  while (fiber && depth++ < maxDepth) {
    const result = visitor(fiber, depth);
    if (result) return result;
    fiber = fiber.return;
  }
  return null;
}

function makeSafeSyntheticChangeEvent(element, value) {
  return {
    target: { value }, currentTarget: { value }, nativeEvent: { target: { value }, stopImmediatePropagation() {} },
    persist() {}, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}
  };
}

function invokeReactChange(element, value) {
  let invoked = false;
  walkReactFiber(element, fiber => {
    const props = fiber.memoizedProps || fiber.pendingProps;
    if (!props || typeof props.onChange !== "function") return false;
    try {
      props.onChange(makeSafeSyntheticChangeEvent(element, value));
      invoked = true;
      return true;
    } catch (_) { return false; }
  });
  return invoked;
}

function getReactSelectCandidates(element) {
  const candidates = [];
  walkReactFiber(element, fiber => {
    const props = fiber.memoizedProps || fiber.pendingProps || {};
    for (const key of ["dataSource", "options", "list", "items"]) {
      if (Array.isArray(props[key])) candidates.push(...props[key]);
    }
  });
  return [...new Map(candidates.filter(Boolean).map(item => [JSON.stringify(item), item])).values()];
}

function getOptionDisplayText(option) {
  if (option == null) return "";
  if (typeof option === "string" || typeof option === "number") return String(option);
  return String(option.text ?? option.label ?? option.name ?? option.title ?? option.value ?? "");
}

function invokeReactSelect(element, targetText) {
  const target = String(targetText || "").trim().toLowerCase();
  if (!target) return false;
  const candidates = getReactSelectCandidates(element);
  const option = candidates.find(item => {
    const text = getOptionDisplayText(item).trim().toLowerCase();
    return text === target || text.includes(target) || target.includes(text);
  });
  if (!option) return false;
  let invoked = false;
  walkReactFiber(element, fiber => {
    const props = fiber.memoizedProps || fiber.pendingProps || {};
    if (typeof props.onChange !== "function") return false;
    try { props.onChange(option); invoked = true; return true; } catch (_) { return false; }
  });
  return invoked;
}
// 智能日期格式转换
function adaptDateFormat(rawDate, placeholder) {
  if (!rawDate) return rawDate;
  const ph = (placeholder || "").toLowerCase();
  let str = rawDate.toString().trim();
  
  // 标准化成 [YYYY, MM, DD]
  const match = str.match(/^(\d{4})[-/\.年](\d{1,2})(?:[-/\.月](\d{1,2})日?)?$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, "0");
    const d = (match[3] || "01").padStart(2, "0");

    if (ph.includes("yyyy/mm/dd")) return `${y}/${m}/${d}`;
    if (ph.includes("yyyy/mm")) return `${y}/${m}`;
    if (ph.includes("yyyy-mm-dd")) return `${y}-${m}-${d}`;
    if (ph.includes("yyyy.mm.dd")) return `${y}.${m}.${d}`;
    if (ph.includes("yyyy.mm")) return `${y}.${m}`;
    if (ph.includes("yyyymmdd")) return `${y}${m}${d}`;
    if (ph.includes("yyyymm")) return `${y}${m}`;
    if (ph.includes("年") && ph.includes("月")) {
      return match[3] ? `${y}年${m}月${d}日` : `${y}年${m}月`;
    }
    return match[3] ? `${y}-${m}-${d}` : `${y}-${m}`;
  }
  return str;
}

// 北森 Phoenix 把许多下拉框渲染成 div 而非原生 input/select。
// 统一把“组件根节点”当成可交互控件，避免只写入其内部搜索 input 后被框架回滚。
const PHOENIX_SELECT_ROOT = ".phoenix-select, [class*='phoenix-select--' i], [class*='phoenix__select' i]";

function getPhoenixSelectRoot(element) {
  if (!element || typeof element.closest !== "function") return null;
  return element.matches?.(PHOENIX_SELECT_ROOT) ? element : element.closest(PHOENIX_SELECT_ROOT);
}

function isPhoenixSelectRoot(element) {
  return !!element && !!element.matches?.(PHOENIX_SELECT_ROOT) && !element.closest("#resume-filler-extension-host");
}

function isPhoenixSelectChild(element) {
  const root = getPhoenixSelectRoot(element);
  return !!root && root !== element;
}

function getControlVisibleText(element) {
  if (!element) return "";
  if (element.tagName === "SELECT") {
    const option = element.options && element.options[element.selectedIndex];
    return (option?.text || option?.value || "").trim();
  }
  if (isPhoenixSelectRoot(element)) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").replace(/^(请选择|请选择(?:\S+)?)$/i, "").trim();
  }
  return (element.value || element.textContent || "").trim();
}

function isDateLikeControl(element, slot = "") {
  const text = [slot, element?.type, element?.className, element?.name, element?.id, element?.placeholder, getElementDirectLabel(element)].filter(Boolean).join(" ");
  return /(?:^|[._\s-])(start|end|birth|date|year|month)(?:$|[._\s-])|日期|时间|年月|年份|月份|date|calendar|picker/i.test(text);
}

function getPresentCheckbox(fieldEl) {
  let container = fieldEl?.parentElement;
  for (let depth = 0; container && container !== document.body && depth < 6; depth++, container = container.parentElement) {
    const boxes = Array.from(container.querySelectorAll("input[type=\'checkbox\']"));
    const matched = boxes.find(box => {
      const label = box.closest("label") || box.parentElement;
      const text = (label?.innerText || label?.textContent || "").replace(/\s+/g, "");
      return /至今|当前|仍在|present|current/i.test(text);
    });
    if (matched) return matched;
  }
  return null;
}

function dispatchNativeValueEvents(element, value) {
  if (!element) return;
  try {
    const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
  } catch (_) { element.value = value; }
  try { element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: value, inputType: "insertText" })); }
  catch (_) { element.dispatchEvent(new Event("input", { bubbles: true })); }
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

// 智能拆分中文姓名（姓与名）
function splitChineseName(fullName) {
  if (!fullName) return { lastName: "", firstName: "" };
  const str = fullName.trim();
  const compoundSurnames = [
    "欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人",
    "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "淳于",
    "单于", "太叔", "申屠", "公孙", "仲孙", "轩辕", "令狐", "钟离", "宇文", "长孙",
    "慕容", "鲜于", "闾丘", "司徒", "司空", "亓官", "司寇", "仉督", "子车", "颛孙"
  ];
  for (const cs of compoundSurnames) {
    if (str.startsWith(cs)) {
      return {
        lastName: cs,
        firstName: str.slice(cs.length)
      };
    }
  }
  return {
    lastName: str.slice(0, 1),
    firstName: str.slice(1)
  };
}

// 获取基本信息衍生字段值（如姓、名、户籍省/市、现居省/市）
function getBasicFieldDerivedValue(key, resumeData) {
  if (!resumeData || !resumeData.basic) return "";
  const b = resumeData.basic;
  
  if (key === 'lastName') {
    return splitChineseName(b.name || "").lastName;
  }
  if (key === 'firstName') {
    return splitChineseName(b.name || "").firstName;
  }
  if (key === 'nativeProvince') {
    const parts = parseChineseArea(b.nativePlace || "");
    if (parts[0]) {
      return ["北京", "天津", "上海", "重庆"].includes(parts[0]) ? `${parts[0]}市` : (parts[0].endsWith("省") || parts[0].endsWith("市") ? parts[0] : `${parts[0]}省`);
    }
    return "";
  }
  if (key === 'nativeCity') {
    const parts = parseChineseArea(b.nativePlace || "");
    if (parts[0] && ["北京", "天津", "上海", "重庆"].includes(parts[0])) {
      return `${parts[0]}市`;
    }
    if (parts[1]) {
      return parts[1].endsWith("市") ? parts[1] : `${parts[1]}市`;
    }
    return "";
  }
  if (key === 'residenceProvince') {
    const parts = parseChineseArea(b.residence || b.city || "");
    if (parts[0]) {
      return ["北京", "天津", "上海", "重庆"].includes(parts[0]) ? `${parts[0]}市` : (parts[0].endsWith("省") || parts[0].endsWith("市") ? parts[0] : `${parts[0]}省`);
    }
    return "";
  }
  if (key === 'residenceCity') {
    const parts = parseChineseArea(b.residence || b.city || "");
    if (parts[0] && ["北京", "天津", "上海", "重庆"].includes(parts[0])) {
      return `${parts[0]}市`;
    }
    if (parts[1]) {
      return parts[1].endsWith("市") ? parts[1] : `${parts[1]}市`;
    }
    return "";
  }
  if (key === 'residenceDistrict') {
    const parts = parseChineseArea(b.residence || b.city || "");
    return parts[2] || (parts[1] && parts[1].endsWith("区") ? parts[1] : "");
  }
  if (key === 'workYears') {
    return b.workYears || "应届生";
  }
  if (key === 'availableTime') {
    return b.availableTime || "随时到岗";
  }
  if (key === 'expectedSalary') {
    return b.expectedSalary || "面议";
  }
  if (key === 'currentSalary') {
    return b.currentSalary || "无";
  }
  if (key === 'jobIndustry') {
    return b.jobIndustry || "互联网/IT/电子/通信";
  }
  return b[key] || "";
}

// 从各板块经历对象中提取常规及衍生字段值（如入学/在职年份、月份等，全面适配 Moka / 北森 常见的年/月独立选框与至今转换）
function getSectionFieldValue(section, item, subKey) {
  if (!item) return "";
  if (subKey === 'startYear') {
    const raw = item.start ? String(item.start).trim() : "";
    const m = raw.match(/(\d{4})/);
    return m ? m[1] : "";
  }
  if (subKey === 'startMonth') {
    const raw = item.start ? String(item.start).trim() : "";
    const m = raw.match(/[-/\.年](\d{1,2})/);
    return m ? m[1].padStart(2, "0") : "";
  }
  if (subKey === 'endYear') {
    const endRaw = item.end ? String(item.end).trim() : "";
    if (/至今|present|now/i.test(endRaw)) {
      if (section === 'education' && item.start) {
        const m = String(item.start).match(/(\d{4})/);
        if (m) return String(parseInt(m[1], 10) + 3);
      }
      return "2027";
    }
    const m = endRaw.match(/(\d{4})/);
    return m ? m[1] : "";
  }
  if (subKey === 'endMonth') {
    const endRaw = item.end ? String(item.end).trim() : "";
    if (/至今|present|now/i.test(endRaw)) return "06";
    const m = endRaw.match(/[-/\.年](\d{1,2})/);
    return m ? m[1].padStart(2, "0") : "";
  }
  if (subKey === 'end') {
    const endRaw = item.end ? String(item.end).trim() : "";
    if (/至今|present|now/i.test(endRaw)) {
      if (section === 'education' && item.start) {
        const m = String(item.start).match(/(\d{4})/);
        if (m) return `${parseInt(m[1], 10) + 3}-06`;
      }
      return "2027-06";
    }
    return endRaw;
  }
  return item[subKey] || "";
}

function getEducationFieldValue(item, subKey) {
  return getSectionFieldValue('education', item, subKey);
}

// ==================== Moka 教育卡片与日期范围适配 ====================
function getMokaEducationCard(element) {
  if (!element?.closest) return null;
  const explicit = element.closest("[data-education-index], [data-edu-index], [data-block-id], [class*=education-item i], [class*=education-card i]");
  if (explicit) return explicit;
  let current = element.parentElement;
  for (let depth = 0; current && current !== document.body && depth < 8; depth++, current = current.parentElement) {
    const text = (current.innerText || current.textContent || "").slice(0, 1800);
    const controls = current.querySelectorAll?.("input, textarea, select, [role=combobox]").length || 0;
    if (controls >= 3 && controls <= 30 && /学校|院校|学历|学位|专业|入学|毕业|教育经历|education/i.test(text)) return current;
  }
  return null;
}

function getMokaEducationCardIndex(element, resumeData) {
  const card = getMokaEducationCard(element);
  if (!card) return null;
  const explicit = card.getAttribute("data-education-index") || card.getAttribute("data-edu-index");
  if (/^\d+$/.test(explicit || "")) return Number(explicit);
  const cards = Array.from(document.querySelectorAll("[data-education-index], [data-edu-index], [class*=education-item i], [class*=education-card i]"));
  if (cards.length > 1) {
    const idx = cards.indexOf(card);
    if (idx >= 0 && idx < (resumeData?.education?.length || 0)) return idx;
  }
  const cardText = (card.innerText || card.textContent || "").toLowerCase();
  const master = resumeData?.education?.findIndex(item => /硕|研究生|master/i.test(item.degree || "")) ?? -1;
  const bachelor = resumeData?.education?.findIndex(item => /本科|学士|bachelor/i.test(item.degree || "")) ?? -1;
  if (/硕士|研究生|master/.test(cardText) && master >= 0) return master;
  if (/本科|学士|bachelor/.test(cardText) && bachelor >= 0) return bachelor;
  return null;
}

function detectMokaEducationDateRole(element) {
  const card = getMokaEducationCard(element);
  if (!card) return null;
  const controls = Array.from(card.querySelectorAll("input, [role=combobox], select"));
  const index = controls.indexOf(element);
  const label = `${getElementDirectLabel(element)} ${element.name || ""} ${element.id || ""} ${element.placeholder || ""}`.toLowerCase();
  const isDate = /入学|毕业|开始|结束|日期|时间|date|start|end|year|month/.test(label) || /date|picker|range/i.test(element.className || "");
  if (!isDate) return null;
  if (/毕业|结束|end|graduate/.test(label)) return "end";
  if (/入学|开始|start/.test(label)) return "start";
  const dateLike = controls.filter(control => /date|picker|range/i.test(`${control.className || ""} ${control.name || ""} ${control.placeholder || ""}`));
  const position = dateLike.indexOf(element);
  if (position === 0) return "start";
  if (position === 1) return "end";
  return index >= 0 && index % 2 ? "end" : "start";
}

function invokeMokaDateRangeChange(element, startDate, endDate) {
  const rangeValue = { startDate, endDate };
  let invoked = false;
  walkReactFiber(element, fiber => {
    const props = fiber.memoizedProps || fiber.pendingProps || {};
    if (typeof props.onChange !== "function") return false;
    const name = String(props.name || props.fieldName || "").toLowerCase();
    if (!/date|start|end|education/.test(name) && !/range|picker/i.test(String(element.className || ""))) return false;
    try { props.onChange(rangeValue); invoked = true; return true; } catch (_) { return false; }
  });
  return invoked;
}
// 智能识别当前输入框应该匹配硕士经历还是本科经历（基于显式关键词、父容器上下文与时间倒序惯例）
function detectEducationItemIndex(el, clues, resumeData, defaultIdx = 0) {
  if (!resumeData.education || resumeData.education.length === 0) return 0;
  
  const masterIdx = resumeData.education.findIndex(item => 
    (item.degree || '').includes('硕') || (item.degree || '').includes('研')
  );
  const bachelorIdx = resumeData.education.findIndex(item => 
    (item.degree || '').includes('本') || (item.degree || '').includes('学士')
  );

  // 1. 优先检查输入框自身 clues 中是否显式包含学历关键词
  const clueStr = (clues || []).join(' ').toLowerCase();
  if (/硕士|研究生|最高学历|最高教育|第一学历|master|postgraduate/i.test(clueStr)) {
    return masterIdx !== -1 ? masterIdx : 0;
  }
  if (/本科|学士|第二学历|bachelor|undergraduate/i.test(clueStr)) {
    return bachelorIdx !== -1 ? bachelorIdx : (masterIdx !== -1 ? (masterIdx === 0 ? 1 : 0) : 0);
  }

  // 2. 向上追溯当前输入框所在的紧凑教育容器（卡片/行/模块/Section）
  let container = el && el.closest ? el.closest('.education-item, .card, .form-section, .section, .block, fieldset, tr, [class*="edu" i]') : null;
  if (container) {
    const containerText = (container.textContent || '').toLowerCase();
    
    // 检查容器内部是否有包含学历的 select、radio 或已填写的 input
    const degreeElements = (typeof container.querySelectorAll === "function") ? container.querySelectorAll('select, input, [class*="value" i], [class*="title" i], [class*="header" i]') : [];
    for (let del of degreeElements) {
      const val = (del.value || del.textContent || '').trim().toLowerCase();
      if (/硕士|研究生|master/i.test(val)) {
        return masterIdx !== -1 ? masterIdx : 0;
      }
      if (/本科|学士|bachelor/i.test(val)) {
        return bachelorIdx !== -1 ? bachelorIdx : 1;
      }
    }

    if (/硕士|研究生|最高学历/i.test(containerText)) {
      return masterIdx !== -1 ? masterIdx : 0;
    }
    if (/本科|学士|第二学历/i.test(containerText)) {
      return bachelorIdx !== -1 ? bachelorIdx : 1;
    }
  }

  // 3. 时间倒序兜底：校招网申默认第 1 个教育经历模块是最高学历（硕士），第 2 个是次高学历（本科）
  if (defaultIdx === 0) {
    return masterIdx !== -1 ? masterIdx : 0;
  }
  if (defaultIdx === 1) {
    return bachelorIdx !== -1 ? bachelorIdx : 1;
  }

  return defaultIdx < resumeData.education.length ? defaultIdx : 0;
}

// 深度探测输入框是否属于就读时间的年/月选择 (支持 input 与 select 全形态)
function inspectEduDateTimeRole(el, clues, sectionContext) {
  const selfClues = [
    el.placeholder,
    el.name,
    el.id,
    el.previousSibling ? (el.previousSibling.textContent || el.previousSibling.nodeValue) : "",
    el.previousElementSibling ? el.previousElementSibling.textContent : "",
    el.nextSibling ? (el.nextSibling.textContent || el.nextSibling.nodeValue) : "",
    el.nextElementSibling ? el.nextElementSibling.textContent : ""
  ].filter(Boolean).join(" ").toLowerCase();

  // 跨层级检索前置隔断词 (如 <div class="start"><input></div> <span>至</span> <div class="end"><input></div>)
  const parentPrevText = (el.parentElement && el.parentElement.previousElementSibling ? (el.parentElement.previousElementSibling.textContent || "") : "") + 
                         (el.parentElement && el.parentElement.previousSibling ? (el.parentElement.previousSibling.textContent || el.parentElement.previousSibling.nodeValue || "") : "");

  const allCluesStr = (clues || []).join(" ").toLowerCase() + " " + parentPrevText.toLowerCase();
  const isEdu = sectionContext === "education" || /就读|在校|学习|教育|学历|学业|学校|college|academic|education|毕业|入学/i.test(allCluesStr);
  if (!isEdu) return null;

  const isTimeField = /时间|年月|年份|月份|日期|date|period|time/i.test(allCluesStr) || 
                      (el.placeholder && /年|月|yyyy|mm/i.test(el.placeholder)) ||
                      (clues || []).some(c => c === "年" || c === "月" || c === "yyyy" || c === "mm");
  if (!isTimeField) return null;

  const hasYear = /年份|年度|yyyy|year/i.test(allCluesStr) || (el.placeholder && /年|yyyy/i.test(el.placeholder)) || (clues || []).some(c => c === "年" || c === "yyyy");
  const hasMonth = /月份|month|mm/i.test(allCluesStr) || (el.placeholder && /月|mm/i.test(el.placeholder)) || (clues || []).some(c => c === "月" || c === "mm");

  // 判断是开始还是结束：
  // 1. 自身文本或直接父级的前置分隔符中包含“至/到/结束/毕业”
  let isEnd = false;
  if (/毕业|结束|止|至|到|end|grad|to|until/i.test(selfClues) || /至|到|--|~|结束|毕业|end|to/i.test(parentPrevText)) {
    isEnd = true;
  } else if (/入学|开始|起|start|from/i.test(selfClues)) {
    isEnd = false;
  } else {
    // 2. 卡片级年份顺序判定 (Card-Level Order Resolution)
    let eduCard = el.closest ? el.closest('.education-item, .sub-section, .card, .form-section, .section, .block, fieldset, form, [class*="edu" i]') : null;
    if (eduCard && typeof eduCard.querySelectorAll === "function") {
      const allInputs = Array.from(eduCard.querySelectorAll('input, select')).filter(i => isEditableElement(i));
      const yearInputs = allInputs.filter(i => {
        const p = (i.placeholder || "").toLowerCase();
        const n = (i.name || "").toLowerCase();
        return /年|yyyy|year/i.test(p) || /year/i.test(n) || (i.tagName === 'SELECT' && inspectSelectType(i) === 'year');
      });
      if (yearInputs.length >= 2) {
        const idxInCard = yearInputs.indexOf(el);
        if (idxInCard === 0) isEnd = false;
        else if (idxInCard >= 1) isEnd = true;
      }
    }
  }

  // 单独年份框
  if (hasYear && !hasMonth) {
    return isEnd ? "endYear" : "startYear";
  }
  // 单独月份框
  if (hasMonth && !hasYear) {
    return isEnd ? "endMonth" : "startMonth";
  }
  // 年月一体框
  if (hasYear && hasMonth) {
    return isEnd ? "end" : "start";
  }

  return null;
}

// 智能识别当前输入框应该匹配项目经历 1 还是项目经历 2
function detectProjectItemIndex(el, clues, resumeData, defaultIdx = 0) {
  if (!resumeData.project || resumeData.project.length === 0) return 0;
  
  const clueStr = (clues || []).join(' ').toLowerCase();
  
  // 1. 显式线索 (项目1 / 项目2)
  if (/项目2|项目二|第二个项目|proj.*2/i.test(clueStr)) {
    return resumeData.project.length > 1 ? 1 : 0;
  }
  if (/项目1|项目一|第一个项目|proj.*1/i.test(clueStr)) {
    return 0;
  }

  // 2. 向上追溯容器
  let container = el && el.closest ? el.closest('.project-item, .card, .form-section, .section, .block, fieldset, tr, [class*="proj" i]') : null;
  if (container) {
    const containerText = (container.textContent || '').toLowerCase();
    if (/项目2|项目二|第二段项目/i.test(containerText)) {
      return resumeData.project.length > 1 ? 1 : 0;
    }
    if (/项目1|项目一|第一段项目/i.test(containerText)) {
      return 0;
    }
  }

  return defaultIdx < resumeData.project.length ? defaultIdx : 0;
}

// 探测一个 <select> 是否是年份或月份下拉框 (基于 option 内容特征)
function inspectSelectType(selectEl) {
  if (!selectEl || selectEl.tagName !== "SELECT" || !selectEl.options || selectEl.options.length === 0) return null;
  let yearCount = 0;
  let monthCount = 0;
  let totalChecked = 0;
  
  for (let opt of selectEl.options) {
    const val = (opt.value || "").trim();
    const txt = (opt.text || "").trim();
    if (!val && !txt) continue;
    totalChecked++;
    
    // 年份检查：四位数字 1970~2040，或 2024年
    if (/^(19\d\d|20\d\d)年?$/.test(val) || /^(19\d\d|20\d\d)年?$/.test(txt)) {
      yearCount++;
    }
    // 月份检查：1~12，01~12，或 1月~12月
    if (/^(0?[1-9]|1[0-2])月?$/.test(val) || /^(0?[1-9]|1[0-2])月?$/.test(txt)) {
      monthCount++;
    }
  }
  
  if (totalChecked > 0) {
    if (yearCount / totalChecked >= 0.35) return 'year';
    if (monthCount / totalChecked >= 0.35) return 'month';
  }
  return null;
}

// 判定一个年月选择框到底属于入学还是毕业 (基于线索与同级下拉框顺序)
function detectYearMonthSelectRole(selectEl, selectType, clues) {
  const clueStr = (clues || []).join(' ').toLowerCase();
  
  // 1. 显式线索
  if (/毕业|结束|至|到|end|grad/i.test(clueStr)) {
    return selectType === 'year' ? 'endYear' : 'endMonth';
  }
  if (/入学|开始|起|start|from/i.test(clueStr)) {
    return selectType === 'year' ? 'startYear' : 'startMonth';
  }

  // 2. 检查同一容器内所有下拉框的相对位置顺序
  let container = selectEl.closest ? selectEl.closest('.form-group, .form-item, .form-row, tr, td, .section, fieldset, div') : null;
  if (!container) container = selectEl.parentElement;
  
  if (container) {
    const allSelects = Array.from(container.querySelectorAll('select'));
    const sameTypeSelects = allSelects.filter(s => inspectSelectType(s) === selectType);
    if (sameTypeSelects.length >= 2) {
      const idxInGroup = sameTypeSelects.indexOf(selectEl);
      if (idxInGroup === 0) {
        return selectType === 'year' ? 'startYear' : 'startMonth';
      } else {
        return selectType === 'year' ? 'endYear' : 'endMonth';
      }
    }
  }

  return selectType === 'year' ? 'startYear' : 'startMonth';
}



// --- [src/content/06_solvers.js] ---
// ==================== 下拉选项与动态浮层轮询等待器 (Polling Waiter - 深度适配北森/Moka/AntD/Element) ====================
function triggerDropdownOpen(element) {
  if (!element) return;
  // Phoenix 的点击会冒泡到组件根；对多个祖先连点会让菜单瞬间打开又关闭。
  const target = getPhoenixSelectRoot(element) || element;
  try {
    target.focus?.({ preventScroll: true });
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    target.click?.();
  } catch (_) {}
}

function getSelectionCandidates(targetValue, fieldEl) {
  const raw = String(targetValue || "").trim();
  if (!raw) return [];
  const candidates = [raw];
  const label = [getElementDirectLabel(fieldEl), fieldEl?.getAttribute?.("aria-label"), fieldEl?.getAttribute?.("data-rf-slot")].filter(Boolean).join(" ");
  const context = (label + " " + raw).toLowerCase();
  const add = (...values) => values.forEach(value => { if (value && !candidates.includes(value)) candidates.push(value); });

  // 北森职业下拉只接受标准分类；把简历的具体岗位映射为候选分类，再优先精确点击。
  if (/求职意向|期望.*(?:职业|岗位|职位)|意向.*(?:职业|岗位|职位)|目标.*(?:职业|岗位|职位)/.test(label)) {
    if (/大模型|ai|人工智能|算法|机器学习|深度学习|agent|开发|前端|后端|软件|程序|数据/.test(context)) add("计算机·网络·技术类", "计算机软件", "软件研发", "技术研发");
    else if (/产品/.test(context)) add("产品类", "产品/项目");
    else if (/测试|质量/.test(context)) add("质量管理/测试", "测试");
    else if (/运营|市场|销售/.test(context)) add("运营类", "市场/营销", "销售");
  }
  if (/期望.*行业|意向.*行业|从事行业/.test(label) && /互联网|软件|开发|算法|ai|通信|电子|计算机/.test(context)) add("互联网/电子商务", "计算机软件", "IT服务(系统/数据/维护)");
  if (/到岗|入职/.test(label) && /随时|立即/.test(context)) add("随时", "一周内", "立即到岗");
  if (/期望.*薪|薪资/.test(label) && /面议/.test(context)) add("面议", "不限");
  if (/现.*薪/.test(label) && /无|应届/.test(context)) add("无", "面议", "应届生");
  return candidates;
}
async function pollAndSelectOption(element, value, timeoutMs = 1600) {
  const candidateValues = (Array.isArray(value) ? value : [value]).map(v => String(v || "").trim()).filter(Boolean);
  if (candidateValues.length === 0) return false;
  const targets = candidateValues.map(raw => {
    const normalized = raw.toLowerCase();
    return { normalized, clean: normalized.replace(/族|省|市|区|县|年|月$/, ""), number: parseInt(normalized, 10) };
  });
  const startTime = Date.now();
  if (element) triggerDropdownOpen(element);

  while (Date.now() - startTime < timeoutMs) {
    const dropdowns = Array.from(document.querySelectorAll(
      ".phoenix-selectList, [class*='phoenix-selectList' i], [class*='phoenix' i][class*='dropdown' i], [class*='phoenix' i][class*='popper' i], [class*='phoenix' i][class*='menu' i], .ant-picker-dropdown, .el-picker-panel, .ant-select-dropdown, .el-select-dropdown, .moka-autocomplete-dropdown, [role=listbox], [role=menu], [cmdk-list], [data-radix-popper-content-wrapper], [class*='dropdown' i], [class*='picker-panel' i], [class*='popover' i], [class*='popup' i], [class*='layer' i], [class*='cascader-menu' i]"
    )).filter(dropdown => {
      const style = window.getComputedStyle(dropdown);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    });

    for (const dropdown of dropdowns) {
      const items = Array.from(dropdown.querySelectorAll(
        ".phoenix-selectList__listItem, .phoenix-selectList__singleLabel, .phoenix-select-option, [class*='select-option' i], [class*='listItem' i], [class*='option' i], .ant-picker-cell-inner, .el-year-table td, .el-month-table td, .ant-select-item-option, .el-select-dropdown__item, [role=gridcell], [role=option], [role=menuitem], [cmdk-item], li"
      )).filter(item => {
        const style = window.getComputedStyle(item);
        return style.display !== "none" && style.visibility !== "hidden" && !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true";
      });
      let bestMatch = null;
      let bestScore = 0;
      for (const item of items) {
        const text = (item.innerText || item.textContent || "").replace(/\s+/g, " ").toLowerCase().trim();
        if (!text) continue;
        const cleanText = text.replace(/族|省|市|区|县|年|月$/, "");
        const itemNumber = parseInt(cleanText, 10);
        for (const target of targets) {
          let score = 0;
          if (text === target.normalized || cleanText === target.clean) score = 100;
          else if (!Number.isNaN(target.number) && !Number.isNaN(itemNumber) && target.number === itemNumber) score = 95;
          else if (text.startsWith(target.clean) || cleanText.startsWith(target.clean)) score = 85;
          else if (target.clean.length >= 2 && cleanText.length >= 2 && (cleanText.includes(target.clean) || target.clean.includes(cleanText))) score = 75;
          if (score > bestScore) { bestScore = score; bestMatch = item; }
        }
      }
      if (bestMatch && bestScore >= 75) {
        try {
          bestMatch.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
          bestMatch.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          bestMatch.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
          bestMatch.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          bestMatch.click();
          return true;
        } catch (_) {}
      }
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  return false;
}
// ==================== 日期选择器专用求解器 (DatePicker Solver) ====================
async function solveDatePicker(fieldEl, dateValue) {
  if (!fieldEl || !dateValue) return false;
  let dateStr = String(dateValue).trim();
  const mokaEducationIndex = getAtsProfile().id === "moka" ? getMokaEducationCardIndex(fieldEl, window.__rfCurrentResumeData || null) : null;
  const isPresent = /至今|present|now/i.test(dateStr);
  const presentCheckbox = isPresent ? getPresentCheckbox(fieldEl) : null;
  if (isPresent && presentCheckbox && !presentCheckbox.checked) {
    presentCheckbox.click();
    presentCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 北森日期框仍要求合法 YYYY-MM；仅在“至今”框存在时用保底值帮助底层校验通过。
  if (isPresent) dateStr = "2027-06";
  dateStr = adaptDateFormat(dateStr, fieldEl.placeholder || "yyyy-mm");
  const wasReadonly = fieldEl.hasAttribute?.("readonly");
  if (wasReadonly) fieldEl.removeAttribute("readonly");
  fieldEl.focus?.({ preventScroll: true });
  dispatchNativeValueEvents(fieldEl, dateStr);
  // 飞书 Formily 日期项优先使用字段级 onChange；其他 React 控件使用通用安全事件。
  if (getAtsProfile().id === "feishu") invokeFeishuFormilyChange(fieldEl, dateStr);
  else invokeReactChange(fieldEl, dateStr);
  // Moka 可能将起止日期保存为同一个 range field。若卡片与简历经历可确定对应，附带完整范围对象更新。
  if (mokaEducationIndex !== null && window.__rfCurrentResumeData?.education?.[mokaEducationIndex]) {
    const education = window.__rfCurrentResumeData.education[mokaEducationIndex];
    const role = detectMokaEducationDateRole(fieldEl);
    const startValue = role === "start" ? dateStr : getEducationFieldValue(education, "start");
    const endValue = role === "end" ? dateStr : getEducationFieldValue(education, "end");
    if (startValue && endValue) invokeMokaDateRangeChange(fieldEl, startValue, endValue);
  }

  for (const type of ["keydown", "keypress", "keyup"]) {
    fieldEl.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
  }

  // Phoenix 的月份面板会在输入后延迟挂载；只在确有匹配项时点击，绝不以泛化文本误点其他日期。
  await pollAndSelectOption(fieldEl, [dateStr, adaptDateFormat(dateStr, "yyyy年mm月")], 1200);
  if (isPresent && presentCheckbox && !presentCheckbox.checked) {
    presentCheckbox.click();
    presentCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (fieldEl.parentElement) {
    const placeholder = fieldEl.parentElement.querySelector("[class*=\'placeholder\' i]");
    if (placeholder && placeholder !== fieldEl) placeholder.style.display = "none";
  }
  markElement(fieldEl, "filled", "已填入日期: " + (isPresent ? "至今" : dateStr));
  if (wasReadonly) setTimeout(() => { try { fieldEl.setAttribute("readonly", "readonly"); } catch (_) {} }, 200);
  return true;
}
// ==================== 下拉选择器综合求解器 (Dropdown Solver - 深度穿透 Phoenix / AntD / Element) ====================
async function solveDropdown(fieldEl, targetValue) {
  if (!fieldEl || !targetValue) return false;
  const val = String(targetValue).trim();
  const candidates = getSelectionCandidates(val, fieldEl);

  const profile = getAtsProfile();
  // 先走页面可见候选项；飞书优先 ud__ option，其他 React 组件再走通用轮询/Fiber 后备。
  triggerDropdownOpen(fieldEl);
  await new Promise(r => setTimeout(r, profile.settleMs || 120));
  const selected = profile.id === "feishu"
    ? candidates.some(candidate => chooseFeishuVisibleOption(candidate))
    : await pollAndSelectOption(fieldEl, candidates, 1800);
  if (selected) {
    markElement(fieldEl, "filled", `已选择: ${val}`);
    return true;
  }
  if (profile.id === "feishu" && candidates.some(candidate => invokeFeishuFormilyChange(fieldEl, candidate, { multi: isFeishuMultiSelectControl(fieldEl) }))) {
    await new Promise(resolve => setTimeout(resolve, 120));
    markElement(fieldEl, "filled", `已通过 Formily 选择: ${val}`);
    return true;
  }
  if (["beisen", "moka"].includes(profile.id) && candidates.some(candidate => invokeReactSelect(fieldEl, candidate))) {
    await new Promise(resolve => setTimeout(resolve, 120));
    markElement(fieldEl, "filled", `已通过受控组件选择: ${val}`);
    return true;
  }

  // 对 Phoenix div 绝不把分类文本硬塞进 innerText，否则会被受控状态回滚且产生假成功。
  if (isPhoenixSelectRoot(fieldEl)) {
    markElement(fieldEl, "uncertain", `未在下拉选项中找到匹配项: ${val}`);
    return false;
  }

  // 3. 如果浮层没有选上：穿透 React 受控组件 Props 注入
  let cur = fieldEl;
  let depth = 0;
  while (cur && depth < 6) {
    for (const k in cur) {
      if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$")) {
        const props = cur[k];
        if (props) {
          if (typeof props.onChange === "function") {
            try { props.onChange(val); } catch(e) {}
            try { props.onChange({ target: fieldEl, currentTarget: fieldEl, value: val }); } catch(e) {}
          }
          if (typeof props.onSelect === "function") {
            try { props.onSelect(val); } catch(e) {}
          }
          if (typeof props.onValueChange === "function") {
            try { props.onValueChange(val); } catch(e) {}
          }
        }
      }
    }
    cur = cur.parentElement;
    depth++;
  }

  // 4. 原生 input 设置与兄弟 placeholder 隐藏
  setElementValue(fieldEl, val);
  if (fieldEl.parentElement) {
    const ph = fieldEl.parentElement.querySelector('[class*="placeholder" i]');
    if (ph && ph !== fieldEl) {
      ph.style.display = "none";
    }
  }

  return true;
}

function normalizeAttachmentText(value) {
  return String(value || "").toLowerCase().replace(/[\s_\-—–（）()【】\[\]，,。.]/g, "");
}

function getFileInputContext(fileEl) {
  const label = getElementDirectLabel(fileEl);
  const container = fileEl.closest(".form-item, .form-group, .form-row, td, li, [class*=form-item i], [class*=upload i], [class*=field i]") || fileEl.parentElement;
  const nearby = (container?.innerText || container?.textContent || "").slice(0, 800);
  return [label, fileEl.name, fileEl.id, fileEl.accept, nearby].filter(Boolean).join(" ");
}

function chooseAttachmentForFileInput(fileEl, resumeData) {
  const attachments = (resumeData?.basic?.attachments || []).filter(item => item?.dataUrl);
  if (attachments.length === 0) return null;
  const context = normalizeAttachmentText(getFileInputContext(fileEl));
  const accepts = String(fileEl.accept || "").toLowerCase();
  let best = null, bestScore = 0;
  for (const attachment of attachments) {
    const label = normalizeAttachmentText(attachment.label);
    const keywords = String(attachment.keywords || attachment.label || "").split(/[，,;；|/]+/).map(normalizeAttachmentText).filter(word => word.length >= 2);
    let score = 0;
    for (const keyword of keywords) if (context.includes(keyword)) score += 50 + Math.min(keyword.length, 12);
    if (label && context.includes(label)) score += 60;
    const photoTarget = /证件照|头像|photo|avatar/.test(context);
    const photoFile = /^image\//.test(attachment.mimeType || "") || /证件照|头像|photo|avatar/.test(label);
    if (photoTarget && photoFile) score += 80;
    if (photoTarget && !photoFile) score -= 80;
    if (/成绩|transcript/.test(context) && /成绩|transcript/.test(label)) score += 70;
    if (/学籍|学历|验证|enrollment/.test(context) && /学籍|学历|验证|enrollment/.test(label)) score += 70;
    if (/奖学金|获奖|证书|certificate/.test(context) && /奖学金|获奖|证书|certificate/.test(label)) score += 60;
    if (/作品|portfolio/.test(context) && /作品|portfolio/.test(label)) score += 70;
    if (/简历|resume|cv/.test(context) && /简历|resume|cv/.test(label)) score += 70;
    if (accepts && attachment.mimeType && accepts.includes("image/") && !/^image\//.test(attachment.mimeType)) score -= 60;
    if (score > bestScore) { best = attachment; bestScore = score; }
  }
  return bestScore >= 50 ? { attachment: best, score: bestScore } : null;
}
// ==================== 文件附件自动注入 (<input type="file">) ====================
async function setFileInputValue(inputEl, fileData) {
  if (!inputEl || inputEl.type !== "file" || !fileData) return false;
  const dataUrl = fileData.dataUrl || fileData.fileDataUrl || fileData.url;
  if (!dataUrl) return false;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = fileData.fileName || fileData.name || "简历附件.pdf";
    const mimeType = fileData.mimeType || blob.type || "application/pdf";
    const file = new File([blob], fileName, { type: mimeType });

    const dt = new DataTransfer();
    dt.items.add(file);
    inputEl.files = dt.files;

    inputEl.dispatchEvent(new Event("focus", { bubbles: true }));
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    inputEl.dispatchEvent(new Event("blur", { bubbles: true }));

    markElement(inputEl, "filled", `已挂载附件: ${fileName}`);
    return true;
  } catch (e) {
    console.warn("文件挂载失败:", e);
    return false;
  }
}

// ==================== 填后即验 (Post-Fill Verification) ====================
function verifyElementValue(element, expectedValue) {
  if (!element || expectedValue === undefined || expectedValue === null) return true;
  
  const expStr = String(expectedValue).trim().toLowerCase();
  if (!expStr) return true;

  if (element.isContentEditable || (typeof element.getAttribute === "function" && element.getAttribute("contenteditable") === "true")) {
    const text = (element.textContent || "").trim().toLowerCase();
    return text.includes(expStr) || expStr.includes(text);
  }

  if (isPhoenixSelectRoot(element)) {
    const actual = getControlVisibleText(element).toLowerCase();
    if (!actual) return false;
    const expectedCandidates = getSelectionCandidates(expectedValue, element).map(value => String(value).toLowerCase());
    return expectedCandidates.some(expected => actual === expected || actual.includes(expected) || expected.includes(actual));
  }

  if (getAtsProfile().id === "feishu") {
    const formItem = getFeishuFormItem(element);
    const visibleText = (formItem?.innerText || element.value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const expectedText = String(expectedValue).trim().toLowerCase();
    if (visibleText && (visibleText.includes(expectedText) || expectedText.includes(visibleText))) return true;
  }

  if (element.tagName === "SELECT") {
    const selectedOpt = element.options[element.selectedIndex];
    const optVal = (selectedOpt ? (selectedOpt.value || selectedOpt.text) : "").trim().toLowerCase();
    const optText = (selectedOpt ? (selectedOpt.text || selectedOpt.value) : "").trim().toLowerCase();
    const cleanExp = expStr.replace(/族|省|市|区|县|年|月$/, "");
    return optVal === expStr || optText === expStr || optVal.includes(cleanExp) || optText.includes(cleanExp);
  }

  if (element.type === "radio" || element.type === "checkbox") {
    return element.checked;
  }

  if (element.type === "file") {
    return element.files && element.files.length > 0;
  }

  const actStr = (element.value || "").trim().toLowerCase();
  if (!actStr) return false;
  if (actStr === expStr) return true;

  // 电话号码去符号比对
  const expDigits = expStr.replace(/\D/g, "");
  const actDigits = actStr.replace(/\D/g, "");
  if (expDigits.length >= 7 && (expDigits === actDigits || actDigits.endsWith(expDigits) || expDigits.endsWith(actDigits))) {
    return true;
  }

  // 日期比对 (2024-09, 2024/09, 2024年09月)
  const expDateNorm = expStr.replace(/[\/\.\s年月-]/g, "");
  const actDateNorm = actStr.replace(/[\/\.\s年月-]/g, "");
  if (expDateNorm.length >= 4 && expDateNorm === actDateNorm) {
    return true;
  }

  // 去单位比对
  const expClean = expStr.replace(/族|省|市|区|县|年|月$/, "");
  const actClean = actStr.replace(/族|省|市|区|县|年|月$/, "");
  if (expClean && actClean && (expClean === actClean || actClean.includes(expClean) || expClean.includes(actClean))) {
    return true;
  }

  return actStr.includes(expStr) || expStr.includes(actStr);
}

function setElementValue(element, value) {
  if (!element || value === undefined || value === null) return;
  
  // 支持 <input type="file"> 文件上传 (简历附件/照片)
  if (element.tagName === "INPUT" && element.type === "file") {
    if (typeof value === "object" && value !== null) {
      setFileInputValue(element, value);
    }
    return;
  }

  // 支持 contenteditable 富文本输入框 (如大厂自研招聘系统的项目描述/自我介绍)
  if (element.isContentEditable || (typeof element.getAttribute === "function" && element.getAttribute("contenteditable") === "true")) {
    element.focus();
    element.textContent = value == null ? "" : String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    markElement(element, "filled", `已填入: ${value}`);
    return;
  }

  // Phoenix select 根节点不能被直接写 value；必须通过可见选项完成受控状态变更。
  if (isPhoenixSelectRoot(element)) {
    solveDropdown(element, value);
    return;
  }

  // 1. 日期格式智能识别与只读属性解除穿透
  const isDateInput = element.type === "date" || 
                      /date|picker|calendar|birth|time/i.test(element.className || "") ||
                      /date|picker|birth|time/i.test(element.name || "") ||
                      /date|picker|birth|time/i.test(element.id || "") ||
                      /yyyy|年|月|日/i.test(element.placeholder || "");
  
  if (isDateInput) {
    value = adaptDateFormat(value, element.placeholder);
  }

  const wasReadonly = typeof element.hasAttribute === "function" && element.hasAttribute("readonly");
  if (wasReadonly && typeof element.removeAttribute === "function") {
    element.removeAttribute("readonly");
  }

  // 先触发 focus
  element.dispatchEvent(new Event("focus", { bubbles: true }));

  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    // 兼容 React/Vue 等框架的特殊 Setter 拦截
    const valueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    
    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    // 派发带有数据的 InputEvent
    try {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
    } catch (e) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (getAtsProfile().id === "feishu" && getFeishuFormItem(element)) invokeFeishuFormilyChange(element, value);
    else invokeReactChange(element, value);

    // 模拟 Down 箭头选择下拉联想第一项，再按 Enter 确认锁定 (适配 Moka/AntD/Element 联想搜索输入框)
    const arrowDown = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 });
    element.dispatchEvent(arrowDown);

    // 针对日期与常规输入框，模拟敲击回车键 (Enter)，触发日期组件将文本转换为受控日期对象
    const enterDown = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterDown);
    const enterPress = new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterPress);
    const enterUp = new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterUp);

    // 兼容 React Props 挂载直接调用
    for (let key in element) {
      if (key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$")) {
        const props = element[key];
        if (props) {
          if (typeof props.onChange === "function") {
            try { props.onChange({ target: element, currentTarget: element, value: value }); } catch (e) {}
          }
          if (typeof props.onPressEnter === "function") {
            try { props.onPressEnter({ target: element, currentTarget: element, key: "Enter", keyCode: 13 }); } catch (e) {}
          }
        }
      }
    }

    // 向上穿透父容器的 React/Vue Props (如 AntD Picker 容器)
    let parent = element.parentElement;
    let pSteps = 0;
    while (parent && pSteps < 3) {
      for (let key in parent) {
        if (key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$")) {
          const props = parent[key];
          if (props && typeof props.onChange === "function") {
            try { props.onChange(value); } catch (e) {}
          }
        }
      }
      parent = parent.parentElement;
      pSteps++;
    }

  } else if (element.tagName === "SELECT") {
    let matchedOption = null;
    const lowerValue = value.toString().toLowerCase().trim();
    const cleanValue = lowerValue.replace(/族|年|月$/, "");
    const numValue = parseInt(cleanValue, 10);
    
    for (let option of element.options) {
      const optVal = (option.value || "").toLowerCase().trim();
      const optText = (option.text || "").toLowerCase().trim();
      const cleanOptVal = optVal.replace(/族|年|月$/, "");
      const cleanOptText = optText.replace(/族|年|月$/, "");
      const optNumVal = parseInt(cleanOptVal, 10);
      const optNumText = parseInt(cleanOptText, 10);

      // 1. 文本或去单位完全匹配 (如 "2024" 和 "2024年", "09" 和 "9月", "汉族" 和 "汉")
      const matchExact = (optVal && optVal === lowerValue) || (optText && optText === lowerValue) ||
                         (cleanOptVal && cleanOptVal === cleanValue) || (cleanOptText && cleanOptText === cleanValue);
      
      // 2. 数值匹配 (例如 value="09" 匹配 option 9 或 9月; value="2024" 匹配 2024)
      const matchNum = !isNaN(numValue) && ((!isNaN(optNumVal) && optNumVal === numValue) || (!isNaN(optNumText) && optNumText === numValue));

      // 3. 包含匹配
      const matchInc = (optVal && (lowerValue.includes(optVal) || cleanValue.includes(optVal))) ||
                       (optText && (lowerValue.includes(optText) || cleanValue.includes(cleanOptText))) ||
                       (optVal && (optVal.includes(lowerValue) || optVal.includes(cleanValue))) ||
                       (optText && (optText.includes(lowerValue) || cleanOptText.includes(cleanValue)));
      
      if (matchExact || matchNum || matchInc) {
        matchedOption = option;
        break;
      }
    }
    
    if (matchedOption) {
      element.value = matchedOption.value;
      matchedOption.selected = true;
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 仅对真正的下拉或联想组件触发选项轮询，纯文本输入框直接失焦，避免并发冲突
  const isSelectOrCombobox = element.tagName === "SELECT" || element.getAttribute("role") === "combobox" || /select|picker|dropdown/i.test(element.className || "");
  if (isSelectOrCombobox) {
    // 该函数是同步 API，不能在这里异步轮询并立即汇报成功；Agent 路径会使用 await solveDropdown/solveCombobox。
    triggerDropdownOpen(element);
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  } else {
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  // 标记仅表示已经尝试写入；最终成功由 executeSymbolicCommand 回读 verifyElementValue 决定。
  markElement(element, "filled", `已尝试填入: ${value}`);
  // 如果原本是 readonly，延迟 200ms 还原，保证框架已完成受控同步
  if (wasReadonly) {
    setTimeout(() => {
      try { element.setAttribute("readonly", "readonly"); } catch(e) {}
    }, 200);
  }
}

// 智能切分中文省市区
function parseChineseArea(rawStr) {
  if (!rawStr) return [];
  let s = rawStr.trim();
  const parts = [];
  
  // 匹配直辖市/特别行政区/省/自治区 (包括后面的省/市字样)
  const pMatch = s.match(/^((?:北京|天津|上海|重庆|香港|澳门)|(?:河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)|(?:内蒙古|广西|西藏|宁夏|新疆))(?:省|市|自治区|特别行政区)?/);
  if (pMatch) {
    parts.push(pMatch[1]);
    s = s.slice(pMatch[0].length).trim();
  }
  
  // 匹配地级市/区县
  const cMatch = s.match(/^([^\s市区县]{2,5})(?:市|地区|自治州|盟|区|县)?/);
  if (cMatch) {
    parts.push(cMatch[1]);
    s = s.slice(cMatch[0].length).trim();
  }

  // 剩余区县/详细地址
  if (s) {
    const dMatch = s.match(/^([^\s市区县]{2,5})(?:区|县|旗|市)?/);
    if (dMatch) {
      parts.push(dMatch[1]);
    } else {
      parts.push(s);
    }
  }

  return parts.length > 0 ? parts : [rawStr];
}

// 自动模拟点击级联选择器（Cascader 智能联动）
async function autoSelectCascaderArea(inputEl, areaStr) {
  if (!inputEl || !areaStr) return false;
  const parts = parseChineseArea(areaStr);
  if (parts.length === 0) return false;
  // 1. 触发外层容器与输入框展开级联选择浮层 (深度穿透北森/AntD/Element)
  triggerDropdownOpen(inputEl);
  await new Promise(r => setTimeout(r, 150));

  for (let i = 0; i < parts.length; i++) {
    const keyword = parts[i];
    if (!keyword) continue;

    // 寻找可见的级联下拉浮层菜单列 (北森 Phoenix, AntD, Element, 通用菜单)
    const menus = Array.from(document.querySelectorAll(
      ".phoenix-cascader-menu, .phoenix-cascader-menus, [class*='cascader-menu' i], [class*='cascader-panel' i], " +
      ".ant-cascader-menu, .el-cascader-menu, .cascader-list, [class*='cascader' i] ul, [class*='cascader' i] ol, " +
      "[role='menu'], [role='tree'], div[style*='z-index'][style*='position: absolute']"
    )).filter(m => {
      try {
        const st = window.getComputedStyle(m);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      } catch(e) { return false; }
    });

    let targetMenu = menus[i] || menus[menus.length - 1] || document.body;
    const items = Array.from(targetMenu.querySelectorAll(
      "li, .phoenix-cascader-menu-item, .ant-cascader-menu-item, .el-cascader-node, " +
      "[role='menuitem'], [role='treeitem'], [class*='menu-item' i], [class*='node' i], div, span"
    )).filter(it => {
      try {
        const st = window.getComputedStyle(it);
        return st.display !== 'none' && st.visibility !== 'hidden' && (it.children.length <= 1);
      } catch(e) { return false; }
    });

    const matchItem = items.find(it => {
      const txt = (it.textContent || "").trim();
      return txt.includes(keyword) || keyword.includes(txt);
    });

    if (matchItem) {
      try {
        matchItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        matchItem.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        matchItem.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
        matchItem.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        matchItem.click();
      } catch(e) {}
      await new Promise(r => setTimeout(r, 120));
    }
  }

  // 2. React Props 穿透与隐藏占位符
  let cur = inputEl;
  let depth = 0;
  while (cur && depth < 6) {
    for (const k in cur) {
      if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$")) {
        const props = cur[k];
        if (props) {
          if (typeof props.onChange === "function") {
            try { props.onChange(areaStr); } catch(e) {}
            try { props.onChange({ target: inputEl, currentTarget: inputEl, value: areaStr }); } catch(e) {}
          }
          if (typeof props.onSelect === "function") {
            try { props.onSelect(areaStr); } catch(e) {}
          }
        }
      }
    }
    cur = cur.parentElement;
    depth++;
  }

  setElementValue(inputEl, areaStr);
  if (inputEl.parentElement) {
    const phDiv = inputEl.parentElement.querySelector('[class*="placeholder" i]');
    if (phDiv && phDiv !== inputEl) {
      phDiv.style.display = "none";
    }
  }
  return true;
}



// --- [src/content/07_matcher.js] ---
// ==================== 匹配填充主逻辑 ====================

// 智能填充整页 (集成文件附件自动挂载 + 填后即验 Post-Fill Verification 闭环)
function smartFillPage(resumeData, options = {}) {
  const syncOnly = !!options.syncOnly;
  const elements = getFillableControls().filter(el => {
    if (el.tagName === "INPUT" && el.type === "file") return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const counters = {
    basic: {},
    education: { school: 0, degree: 0, major: 0, gpa: 0, start: 0, startYear: 0, startMonth: 0, end: 0, endYear: 0, endMonth: 0, supervisor: 0, role: 0, roleDescription: 0, courses: 0, researchDirection: 0, department: 0, labExperience: 0, studentId: 0, schoolLocation: 0 },
    internship: { company: 0, position: 0, start: 0, end: 0, desc: 0, witness: 0, witnessName: 0, witnessRelation: 0, witnessPosition: 0, witnessCompany: 0, witnessPhone: 0 },
    project: { name: 0, link: 0, role: 0, start: 0, end: 0, desc: 0, duty: 0, result: 0, tech: 0 },
    competition: { name: 0, start: 0, end: 0, desc: 0 },
    paper: { title: 0, desc: 0, result: 0 },
    honors: { name: 0, date: 0, level: 0, desc: 0 },
    family: { name: 0, relation: 0, age: 0, political: 0, company: 0, department: 0, position: 0, phone: 0 }
  };

  let filledCount = 0;
  const attemptedFillList = [];
  const interactiveQueue = [];

  function recordAttempt(el, expectedValue, fallbackLabel) {
    const lbl = getElementDirectLabel(el) || el.placeholder || el.name || fallbackLabel || "输入框";
    attemptedFillList.push({ element: el, expectedValue, label: lbl });
  }

  function scheduleFill(el, val, slot, label, subKey, section, idx) {
    const isInteractive = el.tagName === "SELECT" || el.getAttribute("role") === "combobox" ||
                          el.placeholder === "请选择" || el.placeholder === "年" || el.placeholder === "月" ||
                          /school|major|city|nativePlace|jobIntent|workYears|availableTime|expectedSalary|currentSalary|jobIndustry|start|end|birth|degree|highestDegree|political/i.test(subKey || "") ||
                          /date|calendar|picker|select/i.test(el.className || "");
    if (isInteractive) {
      if (!syncOnly) {
        interactiveQueue.push({ el, val, slot, label, subKey, section, idx });
      }
    } else {
      setElementValue(el, val);
      el.setAttribute("data-rf-filled-slot", slot);
      recordAttempt(el, val, label);
      filledCount++;
    }
  }
  elements.forEach((el) => {
    const clues = getElementClues(el);
    if (!clues || clues.length === 0) return;

    const isYearOrMonthInput = (el.placeholder === "年" || el.placeholder === "月" || clues.some(c => c === "年" || c === "月"));
    if (isYearOrMonthInput) {
      const sec = getContextSection(el) || "education";
      const isYear = el.placeholder === "年" || clues.some(c => c === "年" || c === "yyyy");
      
      const keyType = isYear ? "Year" : "Month";
      if (!counters[sec]) counters[sec] = {};
      const currentOrder = counters[sec][`dateCount_${keyType}`] || 0;
      counters[sec][`dateCount_${keyType}`] = currentOrder + 1;

      const isEndPart = (currentOrder % 2 === 1);
      const itemIdx = Math.floor(currentOrder / 2);
      const subKey = isEndPart ? (isYear ? "endYear" : "endMonth") : (isYear ? "startYear" : "startMonth");
      
      let dateVal = "";
      if (sec === "basic") {
        if (clues.some(c => /出生|生日|birth/i.test(c)) || getElementDirectLabel(el).includes("出生")) {
          dateVal = isYear ? (resumeData.basic.birth ? resumeData.basic.birth.split('-')[0] : "") : (resumeData.basic.birth ? resumeData.basic.birth.split('-')[1] : "");
        } else {
          const firstEdu = resumeData.education && resumeData.education[0];
          dateVal = getSectionFieldValue("education", firstEdu, isYear ? "endYear" : "endMonth");
        }
      } else {
        const item = resumeData[sec] && resumeData[sec][itemIdx];
        dateVal = getSectionFieldValue(sec, item, subKey);
      }

      if (dateVal) {
        scheduleFill(el, dateVal, `${sec}.${itemIdx}.${subKey}`, `${sec}.${itemIdx}.${subKey}`, subKey, sec, itemIdx);
        return;
      }
    }

    // 1. 强指示词匹配 (优先级最高，结合同卡片板块锚点过滤，严格规避跨段名称冲突)
    const sectionCtx = getContextSection(el);
    for (let indicator of STRONG_INDICATORS) {
      if (indicator.section !== 'basic' && indicator.section !== 'family' && sectionCtx && sectionCtx !== indicator.section) continue;
      if (isMatch(clues, indicator.keywords)) {
        const section = indicator.section;
        const subKey = indicator.subKey;
        
        if (section === 'basic') {
          const val = getBasicFieldDerivedValue(subKey, resumeData);
          if (val !== undefined && val !== "") {
            scheduleFill(el, val, "basic." + subKey, FIELD_LABEL_MAP[subKey] || subKey, subKey, "basic", 0);
            return;
          }
        } else {
          let idx = counters[section][subKey] || 0;
          if (section === 'education') {
            idx = detectEducationItemIndex(el, clues, resumeData, counters.education[subKey] || 0);
          } else if (section === 'family') {
            const clueStr = clues.join(' ').toLowerCase();
            if (/母|妈|mother/i.test(clueStr)) {
              idx = (resumeData.family || []).findIndex(f => (f.relation || '').includes('母'));
            } else if (/父|爸|father/i.test(clueStr)) {
              idx = (resumeData.family || []).findIndex(f => (f.relation || '').includes('父'));
            }
            if (idx === -1) idx = counters[section][subKey] || 0;
          }
          
          if (idx === (counters[section][subKey] || 0)) {
            counters[section][subKey] = (counters[section][subKey] || 0) + 1;
          }
          
          const item = resumeData[section][idx];
          const itemVal = getSectionFieldValue(section, item, subKey);
          if (itemVal !== undefined && itemVal !== "") {
            scheduleFill(el, itemVal, `${section}.${idx}.${subKey}`, FIELD_LABEL_MAP[subKey] || subKey, subKey, section, idx);
            return;
          }
        }
      }
    }

    // 2. 根据上下文标题结构匹配板块子字段
    const sectionContext = getContextSection(el);
    if (sectionContext && KEYWORDS[sectionContext]) {
      const subKeywords = KEYWORDS[sectionContext];
      for (let subKey in subKeywords) {
        if (isMatch(clues, subKeywords[subKey])) {
          let idx = counters[sectionContext][subKey] || 0;
          
          if (sectionContext === 'education') {
            idx = detectEducationItemIndex(el, clues, resumeData, counters.education[subKey] || 0);
          }
          
          if (idx === (counters[sectionContext][subKey] || 0)) {
            counters[sectionContext][subKey] = (counters[sectionContext][subKey] || 0) + 1;
          }

          const item = resumeData[sectionContext][idx];
          const itemVal = getSectionFieldValue(sectionContext, item, subKey);
          if (itemVal !== undefined && itemVal !== "") {
            scheduleFill(el, itemVal, `${sectionContext}.${idx}.${subKey}`, FIELD_LABEL_MAP[subKey] || subKey, subKey, sectionContext, idx);
            return;
          }
        }
      }
    }

    // 3. 基本信息匹配 (使用排除规则，防止个人姓名进项目名称，个人手机进公司电话等)
    for (let key in KEYWORDS) {
      if (!['education', 'internship', 'project', 'honors', 'competition', 'paper', 'family'].includes(key)) {
        const keywords = KEYWORDS[key];
        if (isMatch(clues, keywords)) {
          if (EXCLUSIONS[key]) {
            const hasExclusion = clues.some(clue => {
              return EXCLUSIONS[key].some(ex => clue.includes(ex));
            });
            if (hasExclusion) continue;
          }

          let matchedValue = (key === 'skills') ? resumeData.skills : (key === 'languages' ? resumeData.languages : getBasicFieldDerivedValue(key, resumeData));
          if (matchedValue !== undefined && matchedValue !== "") {
            const slotName = (key === 'skills' || key === 'languages') ? key : "basic." + key;
            scheduleFill(el, matchedValue, slotName, FIELD_LABEL_MAP[key] || key, key, "basic", 0);
            return;
          }
        }
      }
    }
  });

  // Agent 预填阶段只填写字段，禁止上传附件：部分 ATS 上传后会解析简历并重绘/跳转，必须留给显式 upload_attachment 动作处理。
  if (!syncOnly) try {
    const fileInputs = Array.from(document.querySelectorAll("input[type=file]")).filter(el => !el.disabled && (!el.files || el.files.length === 0));
    fileInputs.forEach(fileEl => {
      const matched = chooseAttachmentForFileInput(fileEl, resumeData);
      if (matched?.attachment) {
        setFileInputValue(fileEl, matched.attachment);
        recordAttempt(fileEl, matched.attachment.fileName || matched.attachment.label || "自定义附件", matched.attachment.label || "自定义附件");
        fileEl.setAttribute("data-rf-filled-slot", `basic.attachments.${matched.attachment.id || "matched"}`);
        filledCount++;
        return;
      }
      const allClues = getFileInputContext(fileEl).toLowerCase();
      const isPhoto = /照片|头像|证件照|photo|avatar/i.test(allClues);
      const fallback = isPhoto ? resumeData.basic?.photoAttachment : resumeData.basic?.resumeAttachment;
      if (fallback?.dataUrl && (isPhoto || /简历|附件|cv|resume|curriculum/i.test(allClues))) {
        setFileInputValue(fileEl, fallback);
        recordAttempt(fileEl, fallback.fileName || "附件", isPhoto ? "证件照片" : "简历附件");
        filledCount++;
      }
    });
  } catch (e) {
    console.error("File upload fill error:", e);
  }
  // 额外处理页面中的 Radio 单选组件 (如性别 男/女、是否接受调剂 是/否)
  try {
    const radios = Array.from(document.querySelectorAll("input[type='radio']")).filter(r => {
      const style = window.getComputedStyle(r);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    radios.forEach(r => {
      const clues = getElementClues(r);
      const rVal = (r.value || "").trim().toLowerCase();
      
      // 性别单选
      if (clues.some(c => c.includes('性别') || c === '男' || c === '女' || c === 'male' || c === 'female')) {
        const myGender = (resumeData.basic.gender || "").trim().toLowerCase();
        const isTarget = clues.some(c => c === myGender || c.includes(myGender)) || rVal === myGender;
        if (isTarget && !r.checked) {
          r.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
          recordAttempt(r, true, "性别单选");
          filledCount++;
        }
      }
      // 城市调剂单选
      else if (clues.some(c => c.includes('调剂') || c === '是' || c === '否')) {
        const myReloc = (resumeData.basic.acceptRelocation || "是").trim().toLowerCase();
        const isTarget = clues.some(c => c === myReloc) || rVal === myReloc;
        if (isTarget && !r.checked) {
          r.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
          recordAttempt(r, true, "调剂意愿");
          filledCount++;
        }
      }
    });
  } catch (e) {
    console.error("Radio fill error:", e);
  }

  // 自动勾选“我已阅读并同意”用户协议、个人信息保护政策、隐私条款复选框
  let extraCheckedCount = 0;
  try {
    const agreementCount = autoCheckAgreements();
    if (agreementCount > 0) {
      filledCount += agreementCount;
      extraCheckedCount += agreementCount;
    }
  } catch (e) {
    console.error("Agreement check error:", e);
  }

  // 自动回答校招常见合规声明与背调问卷 (如亲属任职选“否”，真实性背调选“是”)
  try {
    const decCount = autoFillDeclarations();
    if (decCount > 0) {
      filledCount += decCount;
      extraCheckedCount += decCount;
    }
  } catch (e) {
    console.error("Declaration check error:", e);
  }

  // 填后即验 (Post-Fill Verification) 闭环：
  // 先异步排队执行复杂的下拉、级联与日期弹窗 (120ms~180ms/项)，全部完成后回读核对每个已填项
  (async () => {
    for (const item of interactiveQueue) {
      try {
        if (item.el.getAttribute("data-rf-mark") === "filled") continue;

        // 尝试点击触发器激活下拉 (北森/Moka 必须点击才挂载下拉)
        item.el.focus();
        item.el.click();
        if (item.el.parentElement && item.el.parentElement !== document.body) {
          item.el.parentElement.click();
        }
        await new Promise(r => setTimeout(r, 60));

        const isDateField = /start|end|birth|date/i.test(item.slot) || /date|picker|calendar/i.test(item.el.className || "");
        if (isDateField) {
          await solveDatePicker(item.el, item.val);
        } else if (item.subKey === 'school' || item.subKey === 'major' || item.el.getAttribute("role") === "combobox") {
          await solveCombobox(item.el, item.val, item.val);
        } else if (item.subKey === 'city' || item.subKey === 'nativePlace' || item.slot.includes('city') || item.slot.includes('nativePlace')) {
          await autoSelectCascaderArea(item.el, item.val);
        } else {
          await solveDropdown(item.el, item.val);
        }
        // 处理“至今”复选框联动
        if (item.slot && item.slot.endsWith('.end') && /至今|present|now/i.test(item.val)) {
          const parentRow = item.el.closest('.form-item, .form-group, tr, .form-row') || item.el.parentElement;
          const zjCheckbox = parentRow ? parentRow.querySelector("input[type='checkbox']") : null;
          if (zjCheckbox && !zjCheckbox.checked) {
            zjCheckbox.click();
          }
        }

        item.el.setAttribute("data-rf-filled-slot", item.slot);
        recordAttempt(item.el, item.val, item.label);
        filledCount++;
      } catch(err) {
        console.warn("排队下拉填入异常:", item.label, err);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    let verifiedCount = extraCheckedCount;
    const unverifiedList = [];

    attemptedFillList.forEach(item => {
      const ok = verifyElementValue(item.element, item.expectedValue);
      if (ok) {
        verifiedCount++;
        markElement(item.element, "filled", `已验证填入: ${item.expectedValue}`);
      } else {
        markElement(item.element, "uncertain", `填入后被重置或需手动确认 (预期: ${item.expectedValue})`);
        unverifiedList.push({
          element: item.element,
          label: `${item.label} (需手动确认)`
        });
      }
    });

    // 收集未填写的必填项并标记橙黄色光晕 (防错系统)
    const uncertainList = [...unverifiedList];
    elements.forEach((el, idx) => {
      if (el.getAttribute("data-rf-mark") === "filled") return;
      const val = (el.value || el.textContent || "").trim();
      if (val) return;

      const clues = getElementClues(el);
      const isRequired = el.hasAttribute("required") || 
                         el.getAttribute("aria-required") === "true" ||
                         clues.some(c => c.includes("*") || c.includes("必填") || c.includes("required"));
      
      if (isRequired) {
        markElement(el, "uncertain", "建议核对必填项");
        const rawLabel = clues[0] || el.placeholder || el.name || `未填项 #${idx + 1}`;
        const cleanLabel = rawLabel.replace(/[*必填:：\s]/g, "") || `第 ${idx + 1} 项`;
        if (!uncertainList.some(u => u.element === el)) {
          uncertainList.push({ element: el, label: cleanLabel });
        }
      }
    });

    if (verifiedCount > 0 || uncertainList.length > 0) {
      showAutofillSummaryBadge(verifiedCount, uncertainList);
    }

    // 自动生成整页表单填充率审计报告并异步记录到后台日志系统
    try {
      const audit = analyzePageFillCoverage("smart_fill");
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "recordFillAudit",
          audit
        }, () => {
          void chrome.runtime.lastError;
        });
      }
    } catch (e) {
      console.warn("生成填充率审计报告异常:", e);
    }
  })();

  return filledCount;
}

// 自动填充校招合规声明与背调问卷 (如亲属任职/违法记录/竞业限制 选否，真实性/背调同意 选是)
function autoFillDeclarations() {
  let filledCount = 0;
  try {
    const questionRows = Array.from(document.querySelectorAll(
      ".ant-form-item, .el-form-item, .form-group, .form-row, .question-item, tr, [class*='question' i], [class*='item' i]"
    ));

    questionRows.forEach(row => {
      const text = (row.textContent || "").toLowerCase();
      const isNegativeQuestion = /亲属|亲友|回避|兼职|违纪|违法|犯罪|处分|处罚|不良记录|竞业|诉讼|借贷|重疾|兼任/i.test(text);
      const isPositiveQuestion = /背景调查|背调|真实有效|自愿承担|诚信承诺|遵守规定|知悉并/i.test(text);

      if (!isNegativeQuestion && !isPositiveQuestion) return;
      const expectedAnswer = isNegativeQuestion ? "否" : "是";

      // 1. 单选按钮 / 复选框
      const choices = Array.from(row.querySelectorAll("input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox'], .ant-radio-wrapper, .el-radio, .ant-checkbox-wrapper, .el-checkbox, label"));
      for (let c of choices) {
        const cText = (c.textContent || c.value || "").trim().toLowerCase();
        const matchesNegative = isNegativeQuestion && (cText === "否" || cText === "无" || cText.includes("否") || cText.includes("无"));
        const matchesPositive = isPositiveQuestion && (cText === "是" || cText === "同意" || cText.includes("是") || cText.includes("同意"));
        
        if (matchesNegative || matchesPositive) {
          const clickTarget = c.querySelector("input") || c;
          if (clickTarget && !clickTarget.checked && !c.classList.contains("is-checked") && !c.classList.contains("ant-radio-checked")) {
            clickTarget.click();
            if (typeof HTMLInputElement !== "undefined" && clickTarget instanceof HTMLInputElement) {
              clickTarget.checked = true;
              if (typeof clickTarget.dispatchEvent === "function") {
                clickTarget.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
            markElement(c, "filled", `合规问卷: ${expectedAnswer}`);
            filledCount++;
            break;
          }
        }
      }

      // 2. 下拉框
      const selects = Array.from(row.querySelectorAll("select"));
      selects.forEach(sel => {
        if (!sel.value || sel.value === "") {
          for (let opt of sel.options) {
            const oText = (opt.text || opt.value || "").trim().toLowerCase();
            const matchesNegative = isNegativeQuestion && (oText === "否" || oText === "无");
            const matchesPositive = isPositiveQuestion && (oText === "是" || oText === "同意");
            if (matchesNegative || matchesPositive) {
              sel.value = opt.value;
              opt.selected = true;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              markElement(sel, "filled", `合规问卷: ${expectedAnswer}`);
              filledCount++;
              break;
            }
          }
        }
      });
    });
  } catch (e) {
    console.error("autoFillDeclarations error:", e);
  }
  return filledCount;
}

// 自动检测并勾选网申协议与隐私政策小按钮
function autoCheckAgreements() {
  let checkedCount = 0;
  try {
    // 1. 原生 Checkbox
    const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']")).filter(cb => {
      try {
        const style = window.getComputedStyle(cb);
        return style.display !== 'none' && style.visibility !== 'hidden';
      } catch (e) { return true; }
    });

    checkboxes.forEach(cb => {
      if (cb.checked) return;
      const clues = (typeof getElementClues === "function" ? getElementClues(cb) : []).join(" ").toLowerCase();
      const parentText = (cb.parentElement ? cb.parentElement.textContent : "").toLowerCase();
      const isAgreement = /阅读|同意|隐私|协议|条款|个人信息|授权|policy|privacy|agreement|terms/i.test(clues + " " + parentText);
      if (isAgreement) {
        cb.click();
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        checkedCount++;
      }
    });

    // 2. 现代前端框架自定义 Checkbox (AntD, Element Plus, Moka, 飞书, 牛客等)
    const customCheckboxes = Array.from(document.querySelectorAll(
      ".ant-checkbox:not(.ant-checkbox-checked), .el-checkbox:not(.is-checked), [class*='checkbox']:not([class*='checked']), [role='checkbox'][aria-checked='false']"
    ));

    customCheckboxes.forEach(cc => {
      const wrapper = (cc.closest && cc.closest(".ant-checkbox-wrapper, .el-checkbox, label, [class*='agreement' i], [class*='policy' i], div")) || cc;
      const txt = (wrapper.textContent || "").toLowerCase();
      if (/阅读|同意|隐私|协议|条款|个人信息|授权|policy|privacy|agreement|terms/i.test(txt)) {
        const targetClick = (cc.querySelector && cc.querySelector("input")) || cc;
        targetClick.click();
        checkedCount++;
      }
    });
  } catch (e) {
    console.error("autoCheckAgreements error:", e);
  }
  return checkedCount;
}

// 全局监听：当用户在页面上点击任何“提交 / 投递 / 确认 / 下一步”按钮时，瞬间自动勾选协议小按钮！
document.addEventListener("click", (e) => {
  try {
    const el = e.target;
    if (!el) return;
    if (el.closest && el.closest("#resume-filler-extension-host")) return;
    const btn = el.closest ? el.closest("button, input[type='submit'], input[type='button'], a, [role='button'], .btn, [class*='submit' i], [class*='apply' i]") : null;
    if (btn) {
      const btnText = (btn.textContent || btn.value || "").trim().toLowerCase();
      if (/提交|投递|申请|确认|下一步|完成|同意并|submit|apply/i.test(btnText)) {
        autoCheckAgreements();
      }
    }
  } catch (err) {}
}, true);

// 针对某个容器进行定向的经历/项目局部填充
function fillSection(type, data) {
  if (!lastActiveElement) return false;

  let container = lastActiveElement.closest("form, fieldset, tr, tbody, .form-section, .section, .block, .card");
  if (!container) {
    let current = lastActiveElement;
    for (let i = 0; i < 4; i++) {
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        break;
      }
    }
    container = current;
  }

  if (!container) return false;

  const elements = container.querySelectorAll("input, textarea, select");
  let filledCount = 0;

  elements.forEach((el) => {
    if (!isEditableElement(el)) return;
    const clues = getElementClues(el);
    if (clues.length === 0) return;

    const keyConfig = KEYWORDS[type];
    if (!keyConfig) return;

    for (let subKey in keyConfig) {
      if (isMatch(clues, keyConfig[subKey])) {
        if (data[subKey] !== undefined && data[subKey] !== "") {
          setElementValue(el, data[subKey]);
          filledCount++;
        }
      }
    }
  });

  return filledCount > 0;
}

// ==================== ATS SPA / 动态表单稳定观察器 ====================
let atsObservationStarted = false;
let atsMutationTimer = null;
let atsLastRouteKey = "";
let atsLastControlSignature = "";

function getAtsControlSignature() {
  const controls = getFillableControls();
  return controls.map(el => `${el.tagName}:${el.type || ""}:${el.name || ""}:${el.id || ""}:${el.placeholder || ""}`).join("|");
}

function emitAtsFormStable(reason) {
  const profile = getAtsProfile();
  const routeKey = getAtsRouteKey();
  const signature = getAtsControlSignature();
  const changed = routeKey !== atsLastRouteKey || signature !== atsLastControlSignature;
  atsLastRouteKey = routeKey;
  atsLastControlSignature = signature;
  if (!changed) return;
  window.dispatchEvent(new CustomEvent("rf-ats-form-stable", { detail: {
    profileId: profile.id, profileName: profile.name, mode: profile.mode, routeKey, reason, controlCount: getFillableControls().length
  }}));
}

function scheduleAtsFormStability(reason) {
  const delay = getAtsProfile().settleMs || 400;
  clearTimeout(atsMutationTimer);
  atsMutationTimer = setTimeout(() => emitAtsFormStable(reason), delay);
}

function startAtsFormObserver() {
  if (atsObservationStarted || !document.documentElement) return;
  atsObservationStarted = true;
  atsLastRouteKey = getAtsRouteKey();
  atsLastControlSignature = getAtsControlSignature();
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) scheduleAtsFormStability("dom_mutation");
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => scheduleAtsFormStability("hashchange"));
  window.addEventListener("popstate", () => scheduleAtsFormStability("popstate"));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAtsFormObserver, { once: true });
else startAtsFormObserver();
// ==================== Agent 路由保护 ====================
let agentRouteGuard = null;

function normalizeAgentRoute(url = location.href) {
  try { const parsed = new URL(url, location.href); return { origin: parsed.origin, pathname: parsed.pathname, hash: parsed.hash }; }
  catch (_) { return { origin: location.origin, pathname: location.pathname, hash: location.hash }; }
}

function setAgentRouteGuard(active, initialUrl = location.href) {
  agentRouteGuard = active ? normalizeAgentRoute(initialUrl) : null;
}

// 仅阻止 Agent 合成 click 导致跨文档跳转；用户本人点击不受影响。
document.addEventListener("click", event => {
  if (!agentRouteGuard || event.isTrusted) return;
  const link = event.target?.closest?.("a[href]");
  if (!link) return;
  const target = normalizeAgentRoute(link.href);
  if (target.origin !== agentRouteGuard.origin || target.pathname !== agentRouteGuard.pathname) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent("rf-agent-route-blocked", { detail: { from: agentRouteGuard, to: target, text: (link.innerText || link.textContent || "").trim().slice(0, 80) } }));
  }
}, true);
// ==================== 通用页面工具（元素可见性判断 / 页面轻提示） ====================
// 说明：以下两个工具函数被「智能密码生成器」等模块复用，因此保留在此处。

function isSmsVisibleElement(el) {
  if (!el || !el.isConnected) return false;
  const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
  if (!rect || rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}
function showSmsCodeToast(message, tone = "info", duration = 3200) {
  let toast = document.getElementById("rf-page-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "rf-page-toast";
    toast.style.cssText = [
      "position:fixed", "left:50%", "bottom:36px", "transform:translateX(-50%) translateY(14px)",
      "z-index:2147483647", "padding:10px 18px", "border-radius:999px", "font-size:13px",
      "font-weight:600", "line-height:1.4", "max-width:78vw",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
      "color:#ffffff", "background:rgba(15,23,42,0.94)", "border:1px solid rgba(255,255,255,0.16)",
      "box-shadow:0 12px 32px rgba(15,23,42,0.35)", "opacity:0", "pointer-events:none",
      "transition:opacity .22s ease, transform .22s cubic-bezier(.34,1.56,.64,1)",
      "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"
    ].join(";");
    document.documentElement.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = tone === "error"
    ? "rgba(220,38,38,0.95)"
    : tone === "success"
      ? "rgba(16,185,129,0.95)"
      : "rgba(15,23,42,0.94)";
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  clearTimeout(showSmsCodeToast._timer);
  showSmsCodeToast._timer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(14px)";
    setTimeout(() => { if (toast.parentNode && toast.style.opacity === "0") toast.remove(); }, 400);
  }, duration);
}



// --- [src/content/08_password.js] ---
// ==================== 智能密码生成器（AI理解格式要求 + 自动填入主密码与确认密码框） ====================

let passwordPickHandlers = null;

// 密码框探测器：在页面上寻找主密码框与确认密码框
function detectPasswordTargets() {
  const allInputs = Array.from(document.querySelectorAll("input, [role='textbox']"));
  const candidates = [];

  allInputs.forEach(el => {
    if (!el || !el.isConnected) return;
    if (el.closest && el.closest("#resume-filler-extension-host")) return;
    if (el.disabled || el.readOnly) return;

    const type = String(el.getAttribute("type") || "text").toLowerCase();
    const name = String(el.getAttribute("name") || "").toLowerCase();
    const id = String(el.id || "").toLowerCase();
    const placeholder = String(el.getAttribute("placeholder") || "").toLowerCase();
    const ariaLabel = String(el.getAttribute("aria-label") || "").toLowerCase();
    const clueText = (name + " " + id + " " + placeholder + " " + ariaLabel).trim();

    const isPasswordType = type === "password";
    const isPasswordName = /(?:password|passwd|pwd|passcode|口令|密码)/i.test(clueText);

    if (isPasswordType || isPasswordName) {
      if (isSmsVisibleElement(el)) {
        candidates.push(el);
      }
    }
  });

  if (candidates.length === 0) {
    return { hasTarget: false, mainPassword: null, confirmPassword: null, all: [], label: "未找到密码输入框" };
  }

  // 区分主密码框和确认密码框
  let mainPassword = null;
  let confirmPassword = null;

  for (let el of candidates) {
    const text = (
      (el.name || "") + " " +
      (el.id || "") + " " +
      (el.placeholder || "") + " " +
      (el.getAttribute("aria-label") || "")
    ).toLowerCase();

    const isConfirm = /(?:confirm|repeat|again|repassword|repwd|pwd2|passwd2|确认|再次|重复)/i.test(text);
    if (isConfirm) {
      if (!confirmPassword) confirmPassword = el;
    } else {
      if (!mainPassword) mainPassword = el;
    }
  }

  if (!mainPassword && candidates.length > 0) {
    mainPassword = candidates[0];
  }
  if (!confirmPassword && candidates.length >= 2) {
    confirmPassword = candidates.find(c => c !== mainPassword) || candidates[1];
  }

  const label = confirmPassword 
    ? "已定位：主密码框 + 确认密码框" 
    : "已定位：密码输入框";

  return {
    hasTarget: true,
    mainPassword,
    confirmPassword,
    all: candidates,
    label
  };
}

// 自动提取网页上的密码格式要求提示文案
function extractPasswordRequirementHints() {
  const targets = detectPasswordTargets();
  const input = targets.mainPassword || (targets.all && targets.all[0]);
  if (!input) return "";

  const hints = [];
  const pushHint = (t) => {
    if (!t) return;
    const clean = String(t).trim().replace(/\s+/g, " ");
    if (clean.length >= 4 && clean.length <= 140 && !hints.includes(clean)) {
      if (/(?:位|字符|字母|数字|大小写|特殊|长度|不少于|至|~|-|min|max|包含|必须)/i.test(clean)) {
        hints.push(clean);
      }
    }
  };

  pushHint(input.getAttribute("placeholder"));
  pushHint(input.getAttribute("title"));
  pushHint(input.getAttribute("data-placeholder"));
  pushHint(input.getAttribute("aria-description"));

  let parent = input.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 4) {
    const textNodes = Array.from(parent.querySelectorAll(".tip, .rule, .rules, .desc, .hint, .help-block, .form-text, span, p, div, label"));
    for (let node of textNodes) {
      if (node !== input && !node.contains(input)) {
        pushHint(node.innerText || node.textContent);
      }
    }
    parent = parent.parentElement;
    depth++;
  }

  return hints[0] || "";
}

function cryptoRandomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

// 本地高精度随机密码求解器（免 API Key / 离线高可用 / 强随机）
function generatePasswordLocally(ruleText = "") {
  const text = String(ruleText || "").toLowerCase();

  let minLen = 8;
  let maxLen = 16;

  const rangeMatch = text.match(/(\d+)\s*[-~到至]\s*(\d+)/);
  if (rangeMatch) {
    minLen = parseInt(rangeMatch[1], 10);
    maxLen = parseInt(rangeMatch[2], 10);
  } else {
    const atLeastMatch = text.match(/(?:至少|不少于|不低于|大于等于?)\s*(\d+)/);
    if (atLeastMatch) {
      minLen = parseInt(atLeastMatch[1], 10);
      maxLen = Math.max(minLen + 6, 16);
    } else {
      const exactMatch = text.match(/(\d+)\s*(?:位|个字符)/);
      if (exactMatch) {
        minLen = parseInt(exactMatch[1], 10);
        maxLen = minLen;
      }
    }
  }

  minLen = Math.max(4, Math.min(minLen, 64));
  maxLen = Math.max(minLen, Math.min(maxLen, 64));
  let targetLen = Math.min(maxLen, Math.max(minLen, Math.floor((minLen + maxLen) / 2)));
  if (targetLen < 12 && maxLen >= 12 && minLen <= 12) {
    targetLen = 12;
  }

  const isPureDigits = /(?:纯数字|仅数字|全数字|纯数字密码|6位纯数字)/i.test(text);
  if (isPureDigits) {
    return Array.from({ length: targetLen }, () => Math.floor(Math.random() * 10)).join("");
  }

  const noSpecial = /(?:不能包含特殊|禁止特殊|无特殊|不含特殊|仅限?字母和数字|只包含字母和数字|无需特殊)/i.test(text);
  const requireUpper = /(?:大写|uppercase)/i.test(text) || (!noSpecial && targetLen >= 8);
  const requireLower = /(?:小写|lowercase)/i.test(text) || true;
  const requireDigit = /(?:数字|number|digit)/i.test(text) || true;
  const requireSpecial = !noSpecial && (/(?:特殊|符号|标点|symbol|special)/i.test(text) || targetLen >= 10);

  const UPPERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 排除易混淆字符 I, O
  const LOWERS = "abcdefghijkmnpqrstuvwxyz";  // 排除 l, o
  const DIGITS = "23456789";                  // 排除 0, 1
  const SPECIALS = "@#$%&*!_+=";

  let pool = "";
  const guaranteed = [];

  if (requireLower) {
    pool += LOWERS;
    guaranteed.push(LOWERS[cryptoRandomInt(LOWERS.length)]);
  }
  if (requireUpper) {
    pool += UPPERS;
    guaranteed.push(UPPERS[cryptoRandomInt(UPPERS.length)]);
  }
  if (requireDigit) {
    pool += DIGITS;
    guaranteed.push(DIGITS[cryptoRandomInt(DIGITS.length)]);
  }
  if (requireSpecial) {
    pool += SPECIALS;
    guaranteed.push(SPECIALS[cryptoRandomInt(SPECIALS.length)]);
  }

  if (!pool) pool = LOWERS + UPPERS + DIGITS;

  while (guaranteed.length < targetLen) {
    guaranteed.push(pool[cryptoRandomInt(pool.length)]);
  }

  // Fisher-Yates 加密洗牌
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = guaranteed[i];
    guaranteed[i] = guaranteed[j];
    guaranteed[j] = tmp;
  }

  return guaranteed.join("");
}

// 智能密码生成器（大模型AI优先，本地加密求解器兜底）
async function generateSmartPassword(ruleText = "") {
  const rule = String(ruleText || "").trim() || "8-16位，包含大写字母、小写字母、数字和特殊字符";

  // 1. 尝试大模型 AI 理解与生成
  try {
    const systemPrompt = `你是一个专业的密码生成专家。你的任务是根据用户提供的密码格式要求，生成 1 个完全符合该规则的高强度随机密码。
请严格遵守：
1. 必须完全满足所有长度、字符种类（大写/小写/数字/特殊字符等）的所有约束。
2. 密码必须高随机性，不得使用常见连续字典词汇（如 admin, 123456, password 等）。
3. 必须以严格的 JSON 格式输出，不得包含任何额外废话：
{"password": "生成的密码", "ruleMatched": "规则满足简述"}`;

    const userPrompt = `密码格式要求：${rule}`;

    const resp = await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(null); }
      }, 7000);

      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: { prompt: userPrompt, systemPrompt, jsonMode: true, meta: { action: "generate_password" } }
        }, (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        });
      } else {
        resolve(null);
      }
    });

    if (resp && resp.success && resp.data) {
      let parsed = null;
      try {
        parsed = JSON.parse(resp.data);
      } catch (e) {
        const m = resp.data.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      if (parsed && parsed.password) {
        const pwdStr = String(parsed.password).trim();
        if (pwdStr.length >= 4) {
          return {
            password: pwdStr,
            source: "ai",
            ruleMatched: parsed.ruleMatched || "符合指定格式要求"
          };
        }
      }
    }
  } catch (err) {
    console.warn("AI 密码生成未成功，降级为本地高精度规则生成器:", err);
  }

  // 2. 本地加密随机规则求解器兜底
  const localPwd = generatePasswordLocally(rule);
  return {
    password: localPwd,
    source: "local",
    ruleMatched: "本地高精度生成 (符合长度与字符类型约束)"
  };
}

// 将密码填入页面（同时自动填入主密码框与确认密码框）
function fillPasswordToPage(password) {
  if (!password) return { success: false, reason: "密码不能为空" };
  const targets = detectPasswordTargets();
  if (!targets.hasTarget || !targets.mainPassword) {
    return { success: false, reason: "当前页面未找到密码输入框，请使用「👉 点选填入」" };
  }

  let filledCount = 0;
  // 1. 填入主密码框
  setElementValue(targets.mainPassword, password);
  markElement(targets.mainPassword, "filled", "密码已填入");
  filledCount++;

  // 2. 填入确认密码框 (若存在)
  if (targets.confirmPassword && targets.confirmPassword !== targets.mainPassword) {
    setElementValue(targets.confirmPassword, password);
    markElement(targets.confirmPassword, "filled", "确认密码已同步填入");
    filledCount++;
  }

  // 尝试自动写入剪贴板，方便用户留底记录
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(password).catch(() => {});
    }
  } catch (e) {}

  return {
    success: true,
    count: filledCount,
    hasConfirm: !!targets.confirmPassword,
    mainElement: targets.mainPassword,
    confirmElement: targets.confirmPassword
  };
}

// 点选模式：点哪填哪
function stopPasswordPickMode() {
  if (!passwordPickHandlers) return;
  const h = passwordPickHandlers;
  document.removeEventListener("mousemove", h.move, true);
  document.removeEventListener("click", h.click, true);
  document.removeEventListener("keydown", h.key, true);
  if (h.highlighted && h.highlighted.style) {
    h.highlighted.style.outline = h.prevOutline || "";
    h.highlighted.style.outlineOffset = h.prevOffset || "";
  }
  passwordPickHandlers = null;
}

function startPasswordPickMode(password) {
  if (!password) return;
  stopPasswordPickMode();

  const handlers = { move: null, click: null, key: null, highlighted: null, prevOutline: "", prevOffset: "" };

  handlers.move = (e) => {
    const el = e.target;
    if (!el || !el.style || el.closest && el.closest("#resume-filler-extension-host")) return;
    if (handlers.highlighted === el) return;
    if (handlers.highlighted && handlers.highlighted.style) {
      handlers.highlighted.style.outline = handlers.prevOutline || "";
      handlers.highlighted.style.outlineOffset = handlers.prevOffset || "";
    }
    handlers.highlighted = el;
    handlers.prevOutline = el.style.outline || "";
    handlers.prevOffset = el.style.outlineOffset || "";
    el.style.outline = "2px solid #4f46e5";
    el.style.outlineOffset = "2px";
  };

  handlers.click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    stopPasswordPickMode();
    const editable = (el && el.tagName === "INPUT") ? el : ((el && el.querySelector && el.querySelector("input, textarea, [contenteditable='true']")) || el);
    setElementValue(editable, password);
    markElement(editable, "filled", "密码已填入");
    showSmsCodeToast(`✅ 密码已填入所选输入框`, "success", 3000);
  };

  handlers.key = (e) => {
    if (e.key === "Escape") {
      stopPasswordPickMode();
      showSmsCodeToast("已取消点选填入", "info", 1600);
    }
  };

  passwordPickHandlers = handlers;
  document.addEventListener("mousemove", handlers.move, true);
  document.addEventListener("click", handlers.click, true);
  document.addEventListener("keydown", handlers.key, true);
  showSmsCodeToast("👉 请点击需要填入密码的输入框（Esc 取消）", "info", 6000);
}



// --- [src/content/09_agent_engine.js] ---
// ==================== 大模型驱动的高精度表单拓扑分析与字段映射引擎 ====================

// 页面表单字段的 AI 映射缓存: Map<string (fieldId/hash), { slot: string, confidence: number, label: string, reason: string }>
const aiFieldMappingCache = new Map();
let isAiPageScanning = false;
let lastAiScanUrl = "";

// 生成元素稳定特征哈希/唯一标识
function getElementStableFingerprint(el) {
  if (!el) return "";
  if (el.getAttribute("data-rf-fid")) return el.getAttribute("data-rf-fid");

  const name = el.name || "";
  const id = el.id || "";
  const placeholder = el.placeholder || "";
  const type = el.type || el.tagName.toLowerCase();
  const directLabel = getElementDirectLabel(el) || "";
  const section = getContextSection(el) || "";
  const parent = el.parentElement;
  const siblingIndex = parent ? Array.from(parent.querySelectorAll(":scope > input, :scope > textarea, :scope > select, :scope > [role='combobox']")).indexOf(el) : -1;

  // 同名重复卡片（如两段教育经历）必须生成不同 ID，防止 Agent 重复操作第一张卡片。
  const allInputs = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='combobox']"));
  const idx = allInputs.indexOf(el);
  const raw = [idx, type, name, id, placeholder, directLabel, section, siblingIndex].join("_").replace(/[\s\t\n]+/g, "_");
  const fid = "rf_fid_" + Math.abs(hashString(raw));
  el.setAttribute("data-rf-fid", fid);
  return fid;
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// 提取当前页面表单的脱敏 DOM 拓扑结构 (Zero-PII: 仅提取结构和公开Label，绝无用户个人数据)
function extractPageDomTopology() {
  const formControls = Array.from(document.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']"
  ));

  const items = [];

  formControls.forEach((el, index) => {
    // 忽略不可见的输入框（非渲染元素）
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== "select-one") {
      return;
    }
    // 忽略插件自身的输入框
    if (el.closest && el.closest("#resume-filler-extension-host")) {
      return;
    }

    const fid = getElementStableFingerprint(el);
    const clues = getElementClues(el).slice(0, 5); // 最多取前5条关键线索
    const breadcrumb = getElementBreadcrumbPath(el);
    const tagName = el.tagName.toLowerCase();
    const type = (el.type || tagName).toLowerCase();
    const placeholder = (el.placeholder || "").trim();

    // 兄弟成对线索 (例如开始时间至结束时间)
    const siblingClue = getSiblingControlClue(el);

    items.push({
      fid,
      tag: tagName,
      type,
      placeholder: placeholder.slice(0, 40),
      breadcrumb: breadcrumb.slice(0, 80),
      clues: clues.map(c => c.slice(0, 30)),
      siblingClue: siblingClue ? siblingClue.slice(0, 30) : undefined
    });
  });

  return items;
}

// 获取控件的面包屑祖先路径 (如: 申请表 > 基本信息 > 联系方式)
function getElementBreadcrumbPath(el) {
  const parts = [];
  let cur = el.parentElement;
  let depth = 0;
  while (cur && cur !== document.body && depth < 6) {
    // 寻找容器上的标题文本
    const header = cur.querySelector("h1, h2, h3, h4, h5, .title, [class*='title' i], [class*='header' i], [class*='section' i], legend");
    if (header && header !== el && !header.contains(el)) {
      const t = (header.innerText || header.textContent || "").trim();
      if (t && t.length < 30 && !parts.includes(t)) {
        parts.unshift(t);
      }
    }
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

// 探测成对兄弟输入控件关系
function getSiblingControlClue(el) {
  const parent = el.parentElement;
  if (!parent) return "";
  const inputs = parent.querySelectorAll("input, select");
  if (inputs.length === 2) {
    if (inputs[0] === el) return "成对输入框中的第1项(如起始/省份/姓氏)";
    if (inputs[1] === el) return "成对输入框中的第2项(如结束/城市/名字)";
  }
  return "";
}

// 检测登录、图形、滑块、短信等人机验证。此检测只用于暂停并请求用户手动完成验证，绝不识别或填写验证码。
function detectSecurityChallenge() {
  const text = (document.body?.innerText || "").replace(/\s+/g, " ");
  const input = Array.from(document.querySelectorAll("input")).find(el => {
    const context = [el.placeholder, el.name, el.id, el.getAttribute("aria-label"), getElementDirectLabel(el)].filter(Boolean).join(" ");
    return /验证码|校验码|图形验证|图形验证码|安全验证|人机验证|captcha|verification.?code/i.test(context);
  });
  const visualWidget = document.querySelector(
    "#nc_1_n1z, .geetest_radar_tip, [class*='captcha' i], [id*='captcha' i], [class*='verify' i], [id*='verify' i], [class*='geetest' i], [class*='slider' i], img[alt*='验证码'], img[title*='验证码']"
  );
  const textSignal = /请输入.{0,12}(?:图形)?验证码|(?:图形|滑块|安全|人机).{0,8}验证|验证码(?:错误|失效|不正确)/i.test(text);
  const challenge = input || visualWidget || (textSignal ? document.body : null);
  if (!challenge) return null;
  const style = challenge === document.body ? null : window.getComputedStyle(challenge);
  if (style && (style.display === "none" || style.visibility === "hidden")) return null;
  const context = [input?.placeholder, input?.name, input?.id, input ? getElementDirectLabel(input) : "", visualWidget?.className, visualWidget?.id].filter(Boolean).join(" ");
  let type = /滑块|slider|geetest|nc_1_n1z/i.test(context + " " + text) ? "slider" : "image_or_code";
  if (/短信|手机验证码|短信验证码/i.test(context + " " + text)) type = "sms";
  return { type, fieldId: input ? getElementStableFingerprint(input) : "", label: (getElementDirectLabel(input) || input?.placeholder || "安全验证").slice(0, 60) };
}
// ==================== 零隐私出境 (Zero-PII) 页面状态序列化器 ====================
function serializeAgentPageState() {
  const lines = [];
  lines.push(`URL: ${location.pathname || location.href}`);
  lines.push(`Title: ${document.title}`);
  lines.push("--- 表单交互控件状态 ---");

  // 1. 扫描输入控件 (绝不外发用户真实输入内容，仅输出 status="filled" 或 status="empty")
  const controls = getFillableControls().filter(el => {
    if (el.closest && el.closest("#resume-filler-extension-host")) return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== "file" && el.type !== "select-one") return false;
    return true;
  });

  controls.forEach(el => {
    const fid = getElementStableFingerprint(el);
    const tag = el.tagName.toLowerCase();
    const type = (el.type || tag).toLowerCase();
    const label = (getElementDirectLabel(el) || el.placeholder || el.name || "").replace(/[\s\t\n]+/g, " ").trim().slice(0, 36);
    const section = getContextSection(el) || "";
    const isRequired = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
    
    let hasVal = false;
    if (el.tagName === "SELECT") {
      const selected = el.options[el.selectedIndex];
      const optVal = selected ? (selected.value || selected.text) : "";
      hasVal = !!(optVal && !/^(请选择|select|choose)/i.test(optVal));
    } else if (el.type === "radio" || el.type === "checkbox") {
      hasVal = el.checked;
    } else if (el.type === "file") {
      hasVal = el.files && el.files.length > 0;
    } else {
      const v = (el.value || el.textContent || "").trim();
      hasVal = !!(v && !/^(请选择|select|choose)/i.test(v));
    }

    const filledSlot = el.getAttribute("data-rf-filled-slot") || "";
    const statusStr = hasVal ? `status="filled"${filledSlot ? ` slot="${filledSlot}"` : ""}` : 'status="empty"';
    const isCombobox = (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") || (el.classList && el.classList.contains("ant-select-selection-search-input")) || /search|picker|select/i.test(el.className || ""));
    const comboboxAttr = isCombobox ? ' role="combobox"' : '';

    let optionsStr = "";
    if (el.tagName === "SELECT" && el.options && el.options.length > 0) {
      const optList = Array.from(el.options).slice(0, 8).map(o => (o.text || o.value).trim()).filter(Boolean);
      if (optList.length > 0) optionsStr = ` options=[${optList.join("|")}]`;
    }

    lines.push(`[${fid}] <${tag} type="${type}" label="${label}" section="${section}" ${statusStr}${comboboxAttr}${optionsStr}${isRequired ? " required" : ""} />`);
  });

  // 2. 扫描结构性操作按钮 (如: + 添加教育经历, 下一步)
  lines.push("--- 结构操作按钮 ---");
  const buttons = Array.from(document.querySelectorAll("button, a, [role='button'], .ant-btn, .el-button")).filter(b => {
    if (b.closest && b.closest("#resume-filler-extension-host")) return false;
    if (b.offsetWidth === 0 && b.offsetHeight === 0) return false;
    const txt = (b.innerText || b.textContent || "").replace(/\s+/g, "").trim();
    return /(?:添加|新增|增加|补充|add).{0,8}(?:经历|背景|实习|工作|项目|荣誉|获奖|语言|education|work|project)/i.test(txt) ||
           /^(?:下一步|保存并继续|继续填写|next)/i.test(txt);
  });

  buttons.forEach(btn => {
    const fid = getElementStableFingerprint(btn);
    const txt = (btn.innerText || btn.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
    const isAddEdu = /教育|education/i.test(txt);
    const isAddWork = /实习|工作|work|intern/i.test(txt);
    const isAddProj = /项目|project/i.test(txt);
    const sec = isAddEdu ? "education" : (isAddWork ? "internship" : (isAddProj ? "project" : "common"));
    lines.push(`[Btn_${fid}] <button type="action" section="${sec}">${txt}</button>`);
  });

  // 3. 扫描安全验证码/人机拦截。仅标记后暂停，绝不读取图片内容或填写验证码。
  const securityChallenge = detectSecurityChallenge();
  if (securityChallenge) {
    lines.push(`[SECURITY_ALERT] 检测到${securityChallenge.type}验证码/人机验证（${securityChallenge.label}），需用户手动完成后继续`);
  }

  // 4. 扫描表单校验错误红字
  const errs = scanFormValidationErrors();
  if (errs.length > 0) {
    lines.push("--- 表单未通过红字报错 ---");
    errs.forEach(err => {
      lines.push(`[Error_${err.fieldId || 'unknown'}] 字段「${err.fieldName}」: ${err.errorMessage}`);
    });
  }

  return lines.join("\n");
}

// ==================== 零 PII 纯符号化数据画像生成器 ====================
function generateZeroPiiProfileDescriptor(resumeData) {
  if (!resumeData) return { availableSlots: [], summary: {} };

  const slots = [];
  const basic = resumeData.basic || {};

  const basicKeys = [
    "name", "lastName", "firstName", "gender", "birth", "height", "weight",
    "ethnicity", "phone", "email", "political", "city", "nativePlace",
    "nativeProvince", "nativeCity", "residenceProvince", "residenceCity",
    "website", "github", "emergencyContact", "emergencyRelation", "emergencyPhone",
    "jobIntent", "selfEval", "selfDescription", "highestDegree", "country",
    "acceptRelocation", "extraInfo", "idCard", "wechat", "residence"
  ];
  basicKeys.forEach(k => {
    const val = getBasicFieldDerivedValue(k, resumeData);
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      slots.push(`basic.${k}`);
    }
  });

  if (basic.resumeAttachment && basic.resumeAttachment.dataUrl) {
    slots.push("basic.resumeAttachment");
  }
  (basic.attachments || []).forEach((attachment, index) => {
    if (attachment?.dataUrl) slots.push("basic.attachments." + index);
  });

  const listSections = ["education", "internship", "project", "competition", "paper", "honors", "family"];
  listSections.forEach(sec => {
    const list = resumeData[sec] || [];
    list.forEach((item, idx) => {
      Object.keys(item).forEach(subKey => {
        const val = (sec === "education") ? getEducationFieldValue(item, subKey) : item[subKey];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          slots.push(`${sec}.${idx}.${subKey}`);
        }
      });
      if (sec === "education" && item) {
        if (item.start) slots.push(`education.${idx}.startYear`, `education.${idx}.startMonth`);
        if (item.end) slots.push(`education.${idx}.endYear`, `education.${idx}.endMonth`);
      }
    });
  });

  if (resumeData.skills && resumeData.skills.trim()) slots.push("skills");
  if (resumeData.languages && resumeData.languages.trim()) slots.push("languages");

  return {
    availableSlots: Array.from(new Set(slots)),
    summary: {
      hasResumeAttachment: !!(basic.resumeAttachment && basic.resumeAttachment.dataUrl),
      customAttachmentCount: (basic.attachments || []).filter(item => item?.dataUrl).length,
      educationCount: (resumeData.education || []).length,
      internshipCount: (resumeData.internship || []).length,
      projectCount: (resumeData.project || []).length,
      honorsCount: (resumeData.honors || []).length,
      competitionCount: (resumeData.competition || []).length,
      paperCount: (resumeData.paper || []).length,
      familyCount: (resumeData.family || []).length
    },
    complianceDefaults: {
      acceptRelocation: basic.acceptRelocation || "是",
      hasRelativeInCompany: "否",
      hasCrimeRecord: "否",
      agreeBackgroundCheck: "是",
      agreePrivacyPolicy: true
    }
  };
}

// ==================== 根据槽位代号从本地真实数据安全取值 (完全离线解析) ====================
function getActualValueBySlot(slot, resumeData) {
  if (!slot || !resumeData) return "";
  if (slot === "skills") return resumeData.skills || "";
  if (slot === "languages") return resumeData.languages || "";
  if (slot === "basic.resumeAttachment") return resumeData.basic?.resumeAttachment || "";

  const parts = slot.split(".");
  if (parts[0] === "basic" && parts[1]) {
    return getBasicFieldDerivedValue(parts[1], resumeData) || "";
  }

  if (parts.length >= 3) {
    const [sec, idxStr, subKey] = parts;
    const idx = parseInt(idxStr, 10);
    const item = resumeData[sec] && resumeData[sec][idx];
    if (!item) return "";
    if (sec === "education") {
      return getEducationFieldValue(item, subKey) || "";
    }
    return item[subKey] || "";
  }

  return "";
}

// ==================== 复杂下拉搜索框专用求解器 (Combobox Solver) ====================
async function solveCombobox(fieldEl, keyword, targetOption) {
  if (!fieldEl) return false;
  const kw = String(keyword || "").trim();
  const opt = String(targetOption || keyword || "").trim();
  if (!kw) return false;
  try { fieldEl.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}

  triggerDropdownOpen(fieldEl);
  await new Promise(resolve => setTimeout(resolve, 120));
  let searchInput = (fieldEl.tagName === "INPUT" || fieldEl.tagName === "TEXTAREA") ? fieldEl : null;
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.getAttribute("role") === "searchbox")) searchInput = active;
  else if (!searchInput) searchInput = document.querySelector(".phoenix-selectList input, .ant-select-dropdown input, .el-select-dropdown input, [role=listbox] input, input[type=search]");
  if (searchInput && !searchInput.readOnly && !searchInput.disabled) dispatchNativeValueEvents(searchInput, kw);

  const pollSuccess = await pollAndSelectOption(fieldEl, getSelectionCandidates(opt, fieldEl), 1800);
  if (pollSuccess) {
    markElement(fieldEl, "filled", `已选择: ${opt}`);
    return true;
  }
  if (isPhoenixSelectRoot(fieldEl)) {
    markElement(fieldEl, "uncertain", `未在下拉选项中找到匹配项: ${opt}`);
    return false;
  }
  fieldEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown", code: "ArrowDown", keyCode: 40 }));
  await new Promise(resolve => setTimeout(resolve, 60));
  fieldEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13 }));
  setElementValue(fieldEl, opt);
  return true;
}
// ==================== 扫描页面表单校验红字报错 ====================
function scanFormValidationErrors() {
  const errorElements = Array.from(document.querySelectorAll(
    [...new Set([...getProfileErrorSelectors(), ".help-block-error"])].join(", ")
  )).filter(el => {
    try {
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && (el.innerText || "").trim().length > 0;
    } catch(e) { return false; }
  });

  return errorElements.slice(0, 5).map(el => {
    // 错误节点本身通常不是 input；只要 DOM 存在 Formily item 就优先绑定，无需依赖页面 profile 的其它测试/旧组件。
    const formilyParent = findFormilyContainer(el) || getFeishuFormItem(el);
    const parent = formilyParent || (el.closest(".ant-form-item, .el-form-item, .form-group, tr, .form-row") || el.parentElement);
    // 红字可能挂在 Formily item；把 item label 与控件属性合并判断，避免误把相邻“所在地点”当成出生日期。
    const preferredControl = parent ? Array.from(parent.querySelectorAll("input, select, textarea, [role=combobox]")).find(control => {
      const combined = [getFeishuFormItemLabel(control), control.className || "", control.name || "", control.placeholder || ""].join(" ");
      return /date|picker|birth|出生|日期/i.test(combined);
    }) : null;
    const input = preferredControl || (parent ? parent.querySelector("input, select, textarea, [role=combobox]") : null);
    return {
      fieldId: input ? getElementStableFingerprint(input) : "",
      fieldName: input ? (getFeishuFormItemLabel(input) || getElementDirectLabel(input) || input.name || "未命名字段") : "表单项",
      errorMessage: (el.innerText || el.textContent || "").replace(/[\s\t\n]+/g, " ").trim().slice(0, 60)
    };
  });
}

// ==================== 多步骤向导安全推进器 ====================
function getWizardNextButton(buttonId = "") {
  const wantedId = String(buttonId || "").replace(/^Btn_/, "");
  if (wantedId) {
    const direct = document.querySelector(`[data-rf-fid="${wantedId}"]`);
    if (direct) return direct;
  }
  return Array.from(document.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit]")).find(button => {
    if (button.closest?.("#resume-filler-extension-host") || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    const text = (button.innerText || button.value || button.textContent || "").replace(/\s+/g, "").trim();
    return /^(下一步|继续填写|保存并继续|下一页|next|continue)$/i.test(text);
  }) || null;
}

function isFinalSubmissionButton(button) {
  const text = (button?.innerText || button?.value || button?.textContent || "").replace(/\s+/g, "").trim();
  return /(?:确认提交|确认投递|提交网申|立即投递|提交申请|完成投递|submitapplication|finalsubmit)/i.test(text);
}

async function advanceWizardSafely(buttonId = "") {
  const button = getWizardNextButton(buttonId);
  if (!button) return { success: false, error: "未找到可安全推进的下一步按钮" };
  if (isFinalSubmissionButton(button)) return { success: false, pausedForHuman: true, reason: "检测到最终提交按钮，必须由用户本人确认" };
  const errorsBefore = scanFormValidationErrors();
  if (errorsBefore.length) return { success: false, validationBlocked: true, errors: errorsBefore, error: "当前步骤存在校验错误，已停止推进" };
  const beforeRoute = getAtsRouteKey();
  const beforeSignature = getAtsControlSignature();
  button.scrollIntoView?.({ block: "center", behavior: "smooth" });
  button.click();
  const timeout = Math.max(1400, (getAtsProfile().settleMs || 400) * 4);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (getAtsRouteKey() !== beforeRoute || getAtsControlSignature() !== beforeSignature) {
      const errorsAfter = scanFormValidationErrors();
      return { success: errorsAfter.length === 0, advanced: errorsAfter.length === 0, validationBlocked: errorsAfter.length > 0, buttonClicked: (button.innerText || button.value || "").trim(), routeChanged: getAtsRouteKey() !== beforeRoute, errors: errorsAfter };
    }
  }
  const errorsAfter = scanFormValidationErrors();
  return { success: false, validationBlocked: errorsAfter.length > 0, buttonClicked: (button.innerText || button.value || "").trim(), error: errorsAfter.length ? "下一步后出现校验错误" : "下一步未产生可检测的页面变化", errors: errorsAfter };
}
// ==================== 端侧安全水合与动作闭环执行器 ====================
async function executeSymbolicCommand(command, resumeData) {
  if (!command || !command.action) return { success: false, error: "缺少指令" };
  // 仅在命令生命周期内提供给 Moka date-range 适配器使用；不写入页面或遥测。
  window.__rfCurrentResumeData = resumeData;
  const action = command.action;

  // 1. 符号化槽位填入 (带智能类型路由升级，防止下拉和日期被纯文本写入清空)
  if (action === "fill_slot") {
    const fid = command.fieldId;
    const el = document.querySelector(`[data-rf-fid="${fid}"]`);
    if (!el) return { success: false, error: `未找到控件 [${fid}]` };

    const actualVal = getActualValueBySlot(command.slot, resumeData);
    if (actualVal === undefined || actualVal === null || actualVal === "") {
      return { success: false, skipped: true, reason: `槽位 ${command.slot} 在简历中为空` };
    }

    const isDate = /start|end|birth|date/i.test(command.slot) || /date|calendar|picker/i.test(el.className || "");
    const isArea = command.slot.includes("city") || command.slot.includes("nativePlace");
    const isDropdown = el.tagName === "SELECT" || el.getAttribute("role") === "combobox" ||
                       /workYears|jobIndustry|jobIntent|currentSalary|expectedSalary|availableTime|political|degree|highestDegree/i.test(command.slot) ||
                       /select|picker/i.test(el.className || "");

    if (el.type === "radio" || el.type === "checkbox") {
      const boolVal = (actualVal === "是" || actualVal === true || actualVal === "1");
      if (el.checked !== boolVal) {
        el.click();
        el.checked = boolVal;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (isDate) {
      await solveDatePicker(el, actualVal);
    } else if (isArea) {
      await autoSelectCascaderArea(el, actualVal);
    } else if (isDropdown) {
      await solveDropdown(el, actualVal);
    } else {
      setElementValue(el, actualVal);
    }

    const verified = verifyElementValue(el, actualVal);
    if (!verified) {
      el.removeAttribute("data-rf-filled-slot");
      return { success: false, verified: false, slot: command.slot, error: `控件未接受值或值未持久化: ${command.slot}` };
    }
    el.setAttribute("data-rf-filled-slot", command.slot);
    return { success: true, verified: true, slot: command.slot };
  }

  // 2. 搜索下拉框 / 日期选择框 / 级联选择框 综合求解 (Smart Dispatcher)
  if (action === "solve_combobox") {
    const fid = command.fieldId;
    const el = document.querySelector(`[data-rf-fid="${fid}"]`);
    if (!el) return { success: false, error: `未找到下拉控件 [${fid}]` };

    const slot = command.sourceSlot || command.slot;
    const actualVal = getActualValueBySlot(slot, resumeData);
    if (!actualVal) return { success: false, skipped: true, reason: `槽位 ${slot} 为空` };

    const isDateField = /start|end|birth|date|year|month/i.test(slot) || /date|calendar|picker/i.test(el.className || "");
    const isComboCapable = el.tagName === "SELECT" || el.getAttribute("role") === "combobox" ||
      !!getPhoenixSelectRoot(el) || /select|combobox|autocomplete|dropdown|lookup/i.test(el.className || "");
    // 规划器把普通文本框误标为 solve_combobox 时，禁止退化为硬写文本造成“假选择成功”。
    if (!isDateField && !isComboCapable && !slot.includes("city") && !slot.includes("nativePlace")) {
      return { success: false, verified: false, slot, error: "目标不是可选择的下拉/联想控件" };
    }
    if (isDateField) {
      await solveDatePicker(el, actualVal);
    } else if (slot.includes("city") || slot.includes("nativePlace")) {
      await autoSelectCascaderArea(el, actualVal);
    } else if (el.tagName === "SELECT") {
      setElementValue(el, actualVal);
    } else {
      await solveDropdown(el, actualVal);
    }
    const verified = verifyElementValue(el, actualVal);
    if (!verified) {
      el.removeAttribute("data-rf-filled-slot");
      return { success: false, verified: false, slot, error: `下拉/日期控件未选择目标值: ${slot}` };
    }
    el.setAttribute("data-rf-filled-slot", slot);
    return { success: true, verified: true, slot };
  }
  // 3. 级联选择器求解
  if (action === "select_cascader") {
    const fid = command.fieldId;
    const el = document.querySelector(`[data-rf-fid="${fid}"]`);
    if (!el) return { success: false, error: `未找到级联控件 [${fid}]` };

    const slot = command.sourceSlot || command.slot;
    const actualVal = getActualValueBySlot(slot, resumeData);
    if (actualVal) {
      await autoSelectCascaderArea(el, actualVal);
      el.setAttribute("data-rf-filled-slot", slot);
      return { success: true, slot };
    }
    return { success: false, error: "槽位为空" };
  }

  // 4. 安全推进多步骤向导（只允许“下一步/继续”，最终提交始终交给用户）
  if (action === "advance_wizard") {
    return await advanceWizardSafely(command.buttonId || command.fieldId || "");
  }

  // 5. 点击结构控制按钮 (+ 添加经历)
  if (action === "click_button") {
    let btnFid = command.buttonId || "";
    if (btnFid.startsWith("Btn_")) btnFid = btnFid.slice(4);
    const btn = document.querySelector(`[data-rf-fid="${btnFid}"]`) ||
                Array.from(document.querySelectorAll("button, a, [role='button']")).find(b => {
                  const t = (b.innerText || b.textContent || "").trim();
                  return t.includes(command.label || command.text || "添加");
                });

    if (!btn) return { success: false, error: `未找到按钮 [${command.buttonId}]` };

    // 安全守护：严禁自动点击提交/投递按钮
    const btnText = (btn.innerText || btn.textContent || "").replace(/\s+/g, "");
    if (/确认提交|确认投递|提交网申|立即投递|submitapplication/i.test(btnText)) {
      return { success: false, pausedForHuman: true, reason: "已填毕！遇到最终投递按钮，交由用户亲自确认" };
    }

    btn.scrollIntoView({ block: "center", behavior: "smooth" });
    btn.click();
    await new Promise(r => setTimeout(r, 450)); // 等待新卡片 DOM 挂载
    return { success: true, buttonClicked: btnText };
  }

  // 6. 简历附件上传
  if (action === "upload_attachment") {
    const fileEl = (command.fieldId ? document.querySelector(`[data-rf-fid="${command.fieldId}"]`) : null) || document.querySelector("input[type=file]");
    if (!fileEl) return { success: false, error: "未找到上传控件" };
    const matched = chooseAttachmentForFileInput(fileEl, resumeData);
    const attachment = matched?.attachment || resumeData.basic?.resumeAttachment;
    if (!attachment?.dataUrl) return { success: false, skipped: true, reason: "没有匹配的已绑定附件" };
    const ok = await setFileInputValue(fileEl, attachment);
    if (ok) fileEl.setAttribute("data-rf-filled-slot", matched ? `basic.attachments.${attachment.id || "matched"}` : "basic.resumeAttachment");
    return { success: ok, verified: !!fileEl.files?.length, fileName: attachment.fileName, attachmentLabel: attachment.label || "简历附件", matchScore: matched?.score };
  }
  // 6. 自动勾选协议与合规问卷
  if (action === "check_agreements") {
    const agr = autoCheckAgreements();
    const dec = autoFillDeclarations();
    return { success: true, agreementCount: agr, declarationCount: dec };
  }

  // 7. 人工安全暂停
  if (action === "pause_for_human") {
    return { success: true, pausedForHuman: true, reason: command.reason || "需要人工处理" };
  }

  // 8. 任务完成
  if (action === "finish") {
    return { success: true, finished: true, summary: command.summary || "网申表单填报核验完毕" };
  }

  return { success: false, error: `不支持的动作: ${action}` };
}

// ==================== 本地确定性规划器 (无 API 时的智能兜底规划) ====================
function planSymbolicStepsLocally(resumeData) {
  const steps = [];
  // 1. 页面红字是当前步骤最可靠的失败信号。先只修复与红字绑定的字段，避免泛化扫描分散动作。
  const validationErrors = scanFormValidationErrors();
  if (validationErrors.length > 0) {
    for (const error of validationErrors) {
      const el = error.fieldId ? document.querySelector(`[data-rf-fid="${error.fieldId}"]`) : null;
      const match = el ? detectFieldForElement(el, resumeData) : null;
      if (!el || !match?.fieldKey || !match.value) continue;
      const isDate = /start|end|birth|date/i.test(match.fieldKey) || /date|picker|calendar/i.test(el.className || "");
      const isArea = match.isArea || match.fieldKey.includes("city") || match.fieldKey.includes("nativePlace");
      const isDropdown = el.tagName === "SELECT" || el.getAttribute("role") === "combobox" || isFeishuSelectControl(el) || /select|search|picker|dropdown/i.test(el.className || "");
      const reason = "优先修复红字：" + (error.fieldName || "字段");
      if (isArea) steps.push({ action: "select_cascader", fieldId: error.fieldId, sourceSlot: match.fieldKey, reason });
      else if (isDate || isDropdown) steps.push({ action: "solve_combobox", fieldId: error.fieldId, sourceSlot: match.fieldKey, reason });
      else steps.push({ action: "fill_slot", fieldId: error.fieldId, slot: match.fieldKey, reason });
    }
    if (steps.length > 0) return steps;
  }
  // 2. 无红字时才优先勾选协议与背调声明
  steps.push({ action: "check_agreements" });

  // 2. 简历附件上传
  if (resumeData.basic?.resumeAttachment?.dataUrl) {
    const fileEl = document.querySelector("input[type='file']");
    if (fileEl && (!fileEl.files || fileEl.files.length === 0)) {
      steps.push({ action: "upload_attachment", fieldId: getElementStableFingerprint(fileEl) });
    }
  }

  // 3. 扫描页面当前可填充的空输入项
  const elements = getFillableControls();
  let filledThisRound = 0;
  elements.forEach(el => {
    // 只有当元素确实已有非空真实内容时才跳过；若实际为空或仍为“请选择”，则自动纳入自愈再填写规划
    let currentVal = "";
    if (el.tagName === "SELECT") {
      const s = el.options && el.options[el.selectedIndex];
      currentVal = (s ? (s.value || s.text) : "").trim();
    } else {
      currentVal = (el.value || el.textContent || "").trim();
    }
    const hasRealValue = !!(currentVal && !/^(请选择|select|choose|年|月)/i.test(currentVal));
    if (hasRealValue) return;

    const match = detectFieldForElement(el, resumeData);
    if (match && match.fieldKey && match.value) {
      const fid = getElementStableFingerprint(el);
      const isDate = /start|end|birth|date/i.test(match.fieldKey) || /date|picker|calendar/i.test(el.className || "");
      const isArea = match.isArea || match.fieldKey.includes("city") || match.fieldKey.includes("nativePlace");
      const isDropdown = el.tagName === "SELECT" || el.getAttribute("role") === "combobox" ||
                         /workYears|jobIndustry|jobIntent|currentSalary|expectedSalary|availableTime|political|degree|highestDegree/i.test(match.fieldKey) ||
                         /select|search|picker/i.test(el.className || "");

      if (isArea) {
        steps.push({ action: "select_cascader", fieldId: fid, sourceSlot: match.fieldKey });
        filledThisRound++;
      } else if (isDate) {
        steps.push({ action: "solve_combobox", fieldId: fid, sourceSlot: match.fieldKey });
        filledThisRound++;
      } else if (isDropdown) {
        steps.push({ action: "solve_combobox", fieldId: fid, sourceSlot: match.fieldKey });
        filledThisRound++;
      } else {
        steps.push({ action: "fill_slot", fieldId: fid, slot: match.fieldKey });
        filledThisRound++;
      }
    }
  });
  const listSections = [
    { sec: "education", slotCheck: "education.1.school", kw: /教育|education/i },
    { sec: "internship", slotCheck: "internship.1.company", kw: /实习|工作|work|intern/i },
    { sec: "project", slotCheck: "project.1.name", kw: /项目|project/i }
  ];

  for (const item of listSections) {
    const count = (resumeData[item.sec] || []).length;
    if (count > 1) {
      // 检查是否已经填入过第 2 段经历
      const alreadyFilledSec1 = document.querySelector(`[data-rf-filled-slot="${item.slotCheck}"]`);
      if (!alreadyFilledSec1) {
        const addBtn = Array.from(document.querySelectorAll("button, a, [role='button'], .ant-btn, .el-button")).find(b => {
          const txt = (b.innerText || b.textContent || "").replace(/\s+/g, "");
          return /(?:添加|新增|增加|补充|add)/i.test(txt) && item.kw.test(txt);
        });
        if (addBtn) {
          const timesClicked = parseInt(addBtn.getAttribute("data-rf-clicked-times") || "0", 10);
          if (timesClicked < count - 1) {
            addBtn.setAttribute("data-rf-clicked-times", String(timesClicked + 1));
            steps.push({
              action: "click_button",
              buttonId: `Btn_${getElementStableFingerprint(addBtn)}`,
              reason: `检测到候选人有 ${count} 段${item.sec === "education" ? "教育经历" : (item.sec === "internship" ? "实习经历" : "项目经历")}，自动点击新增卡片`
            });
            break;
          }
        }
      }
    }
  }

  if (steps.length === 1 && steps[0].action === "check_agreements" && filledThisRound === 0) {
    const nextButton = getWizardNextButton();
    if (nextButton && !isFinalSubmissionButton(nextButton) && scanFormValidationErrors().length === 0) {
      steps.push({ action: "advance_wizard", buttonId: "Btn_" + getElementStableFingerprint(nextButton), reason: "当前步骤已完成，安全进入下一步并重新扫描" });
    } else {
      steps.push({ action: "finish", summary: "所有当前步骤可用字段与经历均已处理完毕" });
    }
  }

  return steps;
}
const RESUME_SCHEMA_SLOTS = `
[基础信息 basic]
basic.name: 候选人本人姓名
basic.lastName: 候选人姓氏 (如: 张)
basic.firstName: 候选人名字 (如: 三)
basic.gender: 性别 (男/女)
basic.birth: 出生日期/生日 (如: 2001-01-01)
basic.phone: 本人手机号码/联系电话
basic.email: 本人电子邮箱
basic.idCard: 身份证号/证件号码
basic.political: 政治面貌 (群众/团员/党员)
basic.city: 现居城市/所在城市 (如: 北京市海淀区)
basic.nativePlace: 籍贯/户籍地/生源地 (如: 山东济南)
basic.residence: 现居住详细地址/通信地址
basic.website: 个人网站/作品集链接
basic.github: GitHub主页
basic.jobIntent: 求职意向/申请岗位/期望职位
basic.highestDegree: 最高学历 (博士/硕士/本科/大专)
basic.emergencyContact: 紧急联系人姓名
basic.emergencyRelation: 与紧急联系人关系 (如: 父母/配偶)
basic.emergencyPhone: 紧急联系人电话
basic.selfEval: 自我评价/自我介绍/核心优势
basic.selfDescription: 自我描述/性格特质

[教育经历 education] (支持多段: 0为最高学历，1为前置学历，如0为硕士，1为本科)
education.0.school: 最高学历学校/院校名称
education.0.degree: 最高学历/学位 (硕士/学士)
education.0.major: 最高学历所学专业
education.0.start: 入学时间 (如: 2024-09)
education.0.end: 毕业时间 (如: 2027-06)
education.0.startYear: 入学年份 (如: 2024)
education.0.startMonth: 入学月份 (如: 09)
education.0.endYear: 毕业年份 (如: 2027)
education.0.endMonth: 毕业月份 (如: 06)
education.0.gpa: 绩点/成绩排名
education.0.supervisor: 导师姓名
education.0.role: 在校担任职务
education.0.roleDescription: 职务描述/学生工作描述
education.0.department: 院系/学院名称
education.0.courses: 主修课程/核心课程
education.0.researchDirection: 研究方向
education.0.thesisTopic: 毕业论文/设计题目
education.1.school: 第二段/本科学校名称
education.1.degree: 第二段/本科学历学位
education.1.major: 第二段/本科专业
education.1.start: 本科入学时间
education.1.end: 本科毕业时间

[实习与工作经历 internship]
internship.0.company: 实习/工作单位名称
internship.0.position: 担任职位/岗位
internship.0.start: 入职时间
internship.0.end: 离职时间
internship.0.desc: 工作职责与内容描述
internship.0.witness: 证明人 (有/无)
internship.0.witnessName: 证明人姓名
internship.0.witnessRelation: 证明人关系 (直属领导/带教)
internship.0.witnessPosition: 证明人职务 (带教/主管)
internship.0.witnessCompany: 证明人单位
internship.0.witnessPhone: 证明人联系方式 (电话/微信)
internship.1.company: 第二段实习公司名称
internship.1.position: 第二段实习职位
internship.1.desc: 第二段实习职责

[项目经历 project]
project.0.name: 项目名称
project.0.role: 项目角色/职责
project.0.tech: 技术栈
project.0.link: 项目链接/演示地址
project.0.desc: 项目描述/背景
project.0.duty: 个人核心职责
project.0.result: 项目成果/量化指标
project.1.name: 第二个项目名称
project.1.desc: 第二个项目描述

[综合能力与荣誉]
skills: 专业技能/IT技能描述
languages: 外语能力/英语等级
honors.0.name: 荣誉奖项名称
honors.0.desc: 奖项描述/获奖说明

[家庭关系 family]
family.0.relation: 与本人关系 (如: 父亲)
family.0.name: 亲属姓名 (如: 张建国)
family.0.age: 年龄 (如: 61)
family.0.political: 政治面貌 (如: 群众)
family.0.company: 工作单位 (如: 无)
family.0.department: 工作部门 (如: 无)
family.0.position: 职务/岗位 (如: 打零工)
family.0.phone: 联系电话
family.1.relation: 与本人关系 (如: 母亲)
family.1.name: 亲属姓名 (如: 李秀英)
family.1.age: 年龄 (如: 60)
family.1.political: 政治面貌 (如: 群众)
family.1.company: 工作单位 (如: 海淀区人才发展中心)
family.1.department: 工作部门 (如: 后勤部)
family.1.position: 职务/岗位 (如: 保洁)
family.1.phone: 联系电话
`;

// 向大模型发起整页表单拓扑映射分析 (异步非阻塞，结果写入缓存)
async function triggerAiPageFormAnalysis() {
  if (isAiPageScanning) return;
  if (window.location.protocol === "file:" && !window.location.href.includes("test_page.html")) return;

  const currentUrl = window.location.href.split("#")[0];
  const items = extractPageDomTopology();
  if (!items || items.length === 0) return;

  isAiPageScanning = true;
  lastAiScanUrl = currentUrl;
  console.log(`[ResumeFiller AI] 开始整页表单拓扑分析，捕捉到 ${items.length} 个输入控件...`);

  const systemPrompt = `你是一个顶级网页表单结构与求职简历槽位语义映射专家。
你的任务是将招聘网申网页上的各个输入控件，精准映射到候选人简历的对应字段槽位（target_slot）上。

【映射候选标准字段列表 (RESUME_SCHEMA_SLOTS)】:
${RESUME_SCHEMA_SLOTS}

【严格遵守的推理原则】:
1. 绝对区分个人信息与他人信息：候选人本人的电话(basic.phone)、邮箱(basic.email)绝不能与紧急联系人(emergencyPhone/emergencyContact)或家庭成员混淆！
2. 绝对区分教育经历阶段：页面排在最前/标记为最高学历的一律对应 education.0.*；排在第2个教育卡片的一律对应 education.1.*。
3. 空间与成对关联：若两输入框成对并排(如入学与毕业，或省与市)，需根据前后顺序分别映射为 start/end 或 省/市。
4. 无法确定的字段：target_slot 设为 "unknown"，置信度低于 0.6。
5. 必须严格以 JSON 格式输出，不得输出任何多余废话。

【输出 JSON 格式规范】:
{
  "mappings": [
    {
      "fid": "rf_fid_xxx",
      "slot": "basic.email",
      "confidence": 0.98,
      "reason": "上下文为个人联系信息，控件类型为email，placeholder提示输入常用邮箱"
    }
  ]
}`;

  const userPrompt = `请对以下页面上的 ${items.length} 个表单输入控件进行语义对齐分析：\n` + JSON.stringify(items, null, 2);

  try {
    const resp = await new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: { prompt: userPrompt, systemPrompt, jsonMode: true }
        }, resolve);
      } else {
        resolve({ success: false, error: "chrome.runtime unavailable" });
      }
    });

    if (!resp || !resp.success) {
      console.warn("[ResumeFiller AI] 大模型分析未完成:", resp ? resp.error : "未知错误");
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(resp.data);
    } catch(e) {
      const match = resp.data.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && Array.isArray(parsed.mappings)) {
      let mappedCount = 0;
      parsed.mappings.forEach((m) => {
        if (m.fid && m.slot && m.slot !== "unknown") {
          aiFieldMappingCache.set(m.fid, {
            slot: m.slot,
            confidence: m.confidence || 0.9,
            reason: m.reason || "",
            timestamp: Date.now()
          });
          mappedCount++;
        }
      });
      console.log(`[ResumeFiller AI] 整页表单拓扑映射完成！成功建立 ${mappedCount} 个输入框的高精度语义绑定。`);
      
      // 如果当前正有输入框聚焦，通知气泡刷新
      if (lastActiveElement && document.body.contains(lastActiveElement)) {
        window.dispatchEvent(new CustomEvent("rf-ai-mapping-updated", { detail: { count: mappedCount } }));
      }
    }
  } catch(err) {
    console.warn("[ResumeFiller AI] 分析流程异常:", err);
  } finally {
    isAiPageScanning = false;
  }
}

// 针对单个控件的即时高精度微调精修 (Micro Refinement)
async function requestAiSingleFieldRefinement(el) {
  if (!el) return null;
  const fid = getElementStableFingerprint(el);
  const clues = getElementClues(el);
  const breadcrumb = getElementBreadcrumbPath(el);
  const parentText = (el.parentElement ? el.parentElement.innerText || el.parentElement.textContent || "" : "").replace(/\s+/g, " ").slice(0, 300);

  const singleItem = {
    fid,
    tag: el.tagName.toLowerCase(),
    type: (el.type || el.tagName).toLowerCase(),
    placeholder: el.placeholder || "",
    breadcrumb,
    clues: clues.slice(0, 8),
    parentContextText: parentText
  };

  const systemPrompt = `你是一个表单字段精确定位专家。请分析给定输入框在求职网申表单中对应的最准确简历字段槽位。
参考槽位：${RESUME_SCHEMA_SLOTS}
请严格输出格式：{"slot": "basic.email", "confidence": 0.99, "reason": "说明"}，不可带其它说明。`;

  const userPrompt = `分析此输入控件：\n` + JSON.stringify(singleItem, null, 2);

  console.log("[ResumeFiller Content] 正在向后台请求单点 AI 重诊...", singleItem);

  try {
    const resp = await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ success: false, error: "前后台通信超时 (28s)" });
        }
      }, 28000);

      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: {
            prompt: userPrompt,
            systemPrompt,
            jsonMode: true,
            meta: { action: "single_refine", element: singleItem, url: window.location.href }
          }
        }, (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        });
      } else {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: false, error: "未连接到扩展后台 (chrome.runtime 不可用)" });
        }
      }
    });

    if (!resp) {
      throw new Error("后台未返回响应");
    }
    if (!resp.success) {
      throw new Error(resp.error || "大模型调用未成功");
    }

    let parsed = null;
    try {
      parsed = JSON.parse(resp.data);
    } catch(e) {
      const match = resp.data.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("模型未按 JSON 格式返回: " + resp.data.slice(0, 80));
      }
    }

    if (parsed && parsed.slot) {
      aiFieldMappingCache.set(fid, {
        slot: parsed.slot,
        confidence: parsed.confidence || 0.95,
        reason: parsed.reason || "单点精修识别",
        timestamp: Date.now()
      });
      return parsed.slot;
    } else {
      throw new Error("模型返回数据中未包含有效 slot 字段");
    }
  } catch(e) {
    console.error("[ResumeFiller AI] 单点精修失败:", e);
    throw e;
  }
}



// --- [src/content/10_coverage_audit.js] ---
// ==================== 全页面表单填充率综合审计分析器 (Fill Rate & Coverage Analyzer) ====================
function analyzePageFillCoverage(triggerSource = "manual", resumeData = null) {
  const currentUrl = typeof location !== "undefined" ? location.href : "";
  const hostname = typeof location !== "undefined" ? (location.hostname || "") : "";
  const pageTitle = typeof document !== "undefined" ? (document.title || "") : "";

  const atsProfile = getAtsProfile();
  const systemName = atsProfile.name;

  const controls = getFillableControls().filter(el => {
    if (el.closest && el.closest("#resume-filler-extension-host")) return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== "file" && el.type !== "select-one") return false;
    // 排除招聘网站页面顶部的职位检索搜索框 (非求职填报项)
    const ph = (el.placeholder || "").toLowerCase();
    if (/输入职位关键字|搜索职位|搜索岗位|搜索关键词|search\s*job/i.test(ph)) return false;
    return true;
  });
  const sectionStats = {};
  const unfilledList = [];
  const filledList = [];
  const excludedControls = [];

  // Moka 等系统会把下拉候选项渲染为大量 readonly 文本 input；它们不是表单字段。
  const isNonFieldControl = (el) => {
    const label = (getElementDirectLabel(el) || el.placeholder || el.name || "").replace(/\s+/g, "").trim();
    const value = (el.value || "").trim();
    const nativeChoice = el.tagName === "INPUT" && ["radio", "checkbox"].includes(el.type);
    const choiceWrapper = el.closest?.("[role='radio'], [role='checkbox'], [class*='radio' i], [class*='checkbox' i]");
    const likelyOptionText = el.tagName === "INPUT" && (el.readOnly || el.getAttribute("aria-readonly") === "true") &&
      !el.placeholder && !!value && value === label && value.length <= 32;
    return nativeChoice || !!choiceWrapper || likelyOptionText;
  };

  let totalCount = 0;
  let filledCount = 0;
  let requiredTotal = 0;
  let requiredFilled = 0;

  controls.forEach((el, index) => {
    if (isNonFieldControl(el)) {
      excludedControls.push({ fieldId: getElementStableFingerprint(el), label: (getElementDirectLabel(el) || el.placeholder || el.name || "候选项").slice(0, 40), reason: "choice_or_readonly_option" });
      return;
    }
    totalCount++;
    const fid = getElementStableFingerprint(el);
    const tag = el.tagName.toLowerCase();
    const type = (el.type || tag).toLowerCase();
    const rawLabel = (getElementDirectLabel(el) || el.placeholder || el.name || `字段 #${index + 1}`).replace(/[\s\t\n]+/g, " ").trim();
    const cleanLabel = rawLabel.replace(/[*必填:：\s]/g, "") || `字段 #${index + 1}`;
    const section = getContextSection(el) || "common";

    if (!sectionStats[section]) {
      sectionStats[section] = { total: 0, filled: 0, requiredTotal: 0, requiredFilled: 0 };
    }
    sectionStats[section].total++;

    const isRequired = (el.hasAttribute && el.hasAttribute("required")) ||
                       (el.getAttribute && el.getAttribute("aria-required") === "true") ||
                       rawLabel.includes("*") || rawLabel.includes("必填");

    if (isRequired) {
      requiredTotal++;
      sectionStats[section].requiredTotal++;
    }

    let isFilled = false;
    if (el.tagName === "SELECT") {
      const selected = el.options && el.options[el.selectedIndex];
      const optVal = selected ? (selected.value || selected.text) : "";
      isFilled = !!(optVal && !/^(请选择|select|choose)/i.test(optVal));
    } else if (el.type === "radio" || el.type === "checkbox") {
      isFilled = !!el.checked;
    } else if (el.type === "file") {
      isFilled = !!(el.files && el.files.length > 0);
    } else {
      const v = (el.value || el.textContent || "").trim();
      isFilled = !!(v && !/^(请选择|select|choose)/i.test(v));
    }

    const filledSlot = (el.getAttribute && el.getAttribute("data-rf-filled-slot")) || "";
    const mapping = !isFilled && resumeData ? detectFieldForElement(el, resumeData) : null;
    const hasAttachmentSource = !!(resumeData?.basic?.resumeAttachment?.dataUrl || resumeData?.basic?.photoAttachment?.dataUrl);
    const nonActionableReason = !isFilled && el.type === "file" && !hasAttachmentSource ? "no_attachment_source" :
      (!isFilled && resumeData && !mapping ? "no_resume_slot_mapping" : "");
    const fieldMeta = {
      fieldId: fid,
      tag,
      type,
      label: cleanLabel,
      section,
      isRequired,
      isFilled,
      filledSlot: filledSlot || undefined,
      suggestedSlot: mapping?.fieldKey || undefined,
      actionability: isFilled ? "filled" : (nonActionableReason ? "manual_or_missing_source" : "agent_retryable"),
      nonActionableReason: nonActionableReason || undefined,
      placeholder: el.placeholder || undefined,
      name: el.name || undefined
    };

    const isOptionalCheckbox = el.type === "checkbox" && !isRequired && /至今|同步更新|在线简历/i.test(rawLabel);

    if (isFilled) {
      filledCount++;
      sectionStats[section].filled++;
      if (isRequired) {
        requiredFilled++;
        sectionStats[section].requiredFilled++;
      }
      filledList.push(fieldMeta);
    } else if (!isOptionalCheckbox) {
      unfilledList.push(fieldMeta);
    }
  });
  const emptyCount = totalCount - filledCount;
  const requiredEmpty = requiredTotal - requiredFilled;
  const actionableUnfilledCount = unfilledList.filter(field => field.actionability === "agent_retryable").length;
  const manualOrMissingSourceCount = unfilledList.filter(field => field.actionability === "manual_or_missing_source").length;
  const fillRate = totalCount > 0 ? Number(((filledCount / totalCount) * 100).toFixed(1)) : 0;
  const requiredFillRate = requiredTotal > 0 ? Number(((requiredFilled / requiredTotal) * 100).toFixed(1)) : 100;

  const sectionSummary = {};
  for (const [sec, stats] of Object.entries(sectionStats)) {
    sectionSummary[sec] = {
      total: stats.total,
      filled: stats.filled,
      rate: stats.total > 0 ? `${((stats.filled / stats.total) * 100).toFixed(1)}%` : "0%",
      requiredTotal: stats.requiredTotal,
      requiredFilled: stats.requiredFilled
    };
  }

  const validationErrors = scanFormValidationErrors();

  return {
    triggerSource,
    timestamp: new Date().toISOString(),
    system: systemName,
    atsProfile: { id: atsProfile.id, mode: atsProfile.mode, routeKey: getAtsRouteKey() },
    url: currentUrl,
    pageTitle,
    metrics: {
      totalFieldsCount: totalCount,
      filledFieldsCount: filledCount,
      emptyFieldsCount: emptyCount,
      requiredTotalCount: requiredTotal,
      requiredFilledCount: requiredFilled,
      requiredEmptyCount: requiredEmpty,
      actionableUnfilledCount,
      manualOrMissingSourceCount,
      fillRatePercent: fillRate,
      requiredFillRatePercent: requiredFillRate
    },
    sectionSummary,
    filledFields: filledList,
    unfilledFields: unfilledList,
    excludedControlCount: excludedControls.length,
    excludedControls: excludedControls.slice(0, 20),
    validationErrors
  };
}



// --- [src/content/11_messaging.js] ---
// ==================== 接收消息 ====================
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fillFocusedInput") {
      const target = getValidActiveElement();
      if (target) {
        setElementValue(target, request.value);
        sendResponse({ status: "success" });
      } else {
        sendResponse({ status: "no_focus" });
      }
    } else if (request.action === "fillSection") {
      try {
        const success = fillSection(request.type, request.data);
        if (success) {
          sendResponse({ status: "success" });
        } else {
          sendResponse({ status: "no_focus" });
        }
      } catch (err) {
        console.error(err);
        sendResponse({ status: "error", message: err.message });
      }
    } else if (request.action === "agentGetPageState") {
      try {
        const stateDSL = serializeAgentPageState();
        const profileDescriptor = generateZeroPiiProfileDescriptor(request.resumeData);
        const errors = scanFormValidationErrors();
        const recoveryAudit = analyzePageFillCoverage("agent_round_scan", request.resumeData);
        sendResponse({ status: "success", stateDSL, profileDescriptor, errors, recoveryAudit, url: location.href });
      } catch (err) {
        console.error(err);
        sendResponse({ status: "error", message: err.message });
      }
    } else if (request.action === "agentExecuteCommand") {
      executeSymbolicCommand(request.command, request.resumeData)
        .then((result) => sendResponse({ status: "success", result }))
        .catch((err) => sendResponse({ status: "error", message: err.message || String(err) }));
      return true;
    } else if (request.action === "agentPrePass") {
      try {
        setAgentRouteGuard(true, location.href);
        const count = smartFillPage(request.resumeData, { syncOnly: true });
        sendResponse({ status: "success", count, route: normalizeAgentRoute() });
      } catch (err) {
        sendResponse({ status: "error", message: err.message });
      }
    } else if (request.action === "agentSetRouteGuard") {
      setAgentRouteGuard(!!request.active, request.initialUrl || location.href);
      sendResponse({ status: "success", route: agentRouteGuard });
    } else if (request.action === "agentPlanLocally") {
      try {
        const steps = planSymbolicStepsLocally(request.resumeData);
        sendResponse({ status: "success", steps, thought: "使用端侧确定性状态机规划动作" });
      } catch (err) {
        sendResponse({ status: "error", message: err.message });
      }
    } else if (request.action === "agentGetCoverageAudit") {
      try {
        const audit = analyzePageFillCoverage(request.source || "agent_autofill", request.resumeData || null);
        sendResponse({ status: "success", audit });
      } catch (err) {
        sendResponse({ status: "error", message: err.message });
      }
    }
    return true;
  });
}



// --- [src/content/12_api.js] ---
// 暴露接口给同在 content script 中的悬浮卡片模块调用
window.ResumeFillerContent = {
  smartFillPage,
  fillSection,
  getFillableControls,
  getSelectionCandidates,
  solveDatePicker,
  solveDropdown,
  setElementValue,
  setFileInputValue,
  chooseAttachmentForFileInput,
  pollAndSelectOption,
  verifyElementValue,
  detectFieldForElement,
  detectEducationItemIndex,
  detectProjectItemIndex,
  inspectSelectType,
  detectYearMonthSelectRole,
  parseChineseArea,
  autoSelectCascaderArea,
  autoCheckAgreements,
  triggerAiPageFormAnalysis,
  requestAiSingleFieldRefinement,
  setAiFieldMapping: (fid, mapping) => aiFieldMappingCache.set(fid, mapping),
  getAiFieldMapping: (fid) => aiFieldMappingCache.get(fid),
  getLastActiveElement: () => getValidActiveElement(),
  detectPasswordTargets,
  extractPasswordRequirementHints,
  generateSmartPassword,
  generatePasswordLocally,
  fillPasswordToPage,
  startPasswordPickMode,
  stopPasswordPickMode,
  serializeAgentPageState,
  generateZeroPiiProfileDescriptor,
  getAtsProfile,
  getAtsRouteKey,
  getReactFiberNode,
  invokeReactChange,
  invokeReactSelect,
  findFormilyContainer,
  getFeishuFormItem,
  getFeishuFormItemLabel,
  chooseFeishuVisibleOption,
  invokeFeishuFormilyChange,
  getWizardNextButton,
  advanceWizardSafely,
  setAgentRouteGuard,
  normalizeAgentRoute,
  getMokaEducationCard,
  getMokaEducationCardIndex,
  detectMokaEducationDateRole,
  invokeMokaDateRangeChange,
  getActualValueBySlot,
  solveCombobox,
  scanFormValidationErrors,
  executeSymbolicCommand,
  planSymbolicStepsLocally,
  analyzePageFillCoverage,
  fillFocusedInput: (val) => {
    const target = getValidActiveElement();
    if (target) {
      setElementValue(target, val);
      return true;
    }
    return false;
  }
};

// 中文友好的字段名称映射
const FIELD_LABEL_MAP = {
  name: "姓名",
  lastName: "姓氏",
  firstName: "名字",
  gender: "性别",
  ethnicity: "民族",
  birth: "出生日期",
  height: "身高",
  weight: "体重",
  phone: "手机号码",
  email: "电子邮箱",
  political: "政治面貌",
  city: "现居城市",
  nativePlace: "籍贯",
  nativeProvince: "户籍所在省",
  nativeCity: "户籍所在地市",
  residenceProvince: "现居住省",
  residenceCity: "现居住市",
  idCard: "身份证号",
  wechat: "微信号",
  residence: "现居详细地址",
  website: "个人网站",
  github: "GitHub",
  emergencyContact: "紧急联系人姓名",
  emergencyRelation: "与紧急联系人关系",
  emergencyPhone: "紧急联系人电话",
  jobIntent: "求职意向",
  selfEval: "自我评价",
  selfDescription: "自我描述",
  highestDegree: "最高学历",
  country: "所在国家",
  acceptRelocation: "城市调剂",
  extraInfo: "补充说明",
  skills: "专业技能",
  languages: "语言能力",

  school: "学校名称",
  degree: "学历学位",
  major: "所学专业",
  gpa: "绩点/成绩",
  start: "开始时间",
  startYear: "入学年份",
  startMonth: "入学月份",
  end: "结束时间",
  endYear: "毕业年份",
  endMonth: "毕业月份",
  supervisor: "导师姓名",
  role: "担任职务",
  roleDescription: "职务描述",
  majorDescription: "专业描述",
  thesisTopic: "毕业论文/设计/作品",
  courses: "主修课程",
  researchDirection: "研究方向",
  department: "院系名称",
  labExperience: "科研/实验室经历",
  studentId: "学号",
  schoolLocation: "学校所在地",

  company: "公司名称",
  position: "职位岗位",
  witness: "证明人",
  witnessName: "证明人姓名",
  witnessRelation: "证明人关系",
  witnessPosition: "证明人职务",
  witnessCompany: "证明人单位",
  witnessPhone: "证明人联系方式",

  tech: "主要技术栈",
  link: "项目链接",
  desc: "项目描述",
  duty: "项目职责",
  result: "项目成果",

  relation: "与本人关系",
  age: "年龄",
  department: "工作部门"
};

// 根据槽位路径解析真实简历数据与候选推荐列表
function resolveSlotValueAndMetadata(slot, resumeData, el) {
  if (!slot || !resumeData) return null;
  const parts = slot.split(".");
  const clues = el ? getElementClues(el) : [];

  if (parts[0] === "basic" && parts[1]) {
    const subKey = parts[1];
    const val = getBasicFieldDerivedValue(subKey, resumeData);
    let suggestions = [];

    if (subKey === "name") {
      const split = splitChineseName(resumeData.basic.name || "");
      if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
      if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
    } else if (subKey.startsWith("emergency")) {
      ["emergencyContact", "emergencyRelation", "emergencyPhone"].forEach(k => {
        if (k !== subKey && resumeData.basic[k]) {
          suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
        }
      });
    }

    return {
      section: "basic",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val || "",
      clues,
      suggestions,
      isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)
    };
  }

  if (parts[0] === "education" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.education && resumeData.education[idx];
    const val = item ? getEducationFieldValue(item, subKey) : "";
    let suggestions = [];

    if (["start", "startYear", "startMonth", "end", "endYear", "endMonth"].includes(subKey) && item) {
      if (item.start) {
        const [sy, sm] = item.start.split("-");
        if (sy) suggestions.push({ label: `${sy}年`, value: sy });
        if (sm) suggestions.push({ label: `${sm}月`, value: sm });
      }
      if (item.end) {
        const [ey, em] = item.end.split("-");
        if (ey) suggestions.push({ label: `${ey}年`, value: ey });
        if (em) suggestions.push({ label: `${em}月`, value: em });
      }
    }

    return {
      section: "education",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val || "",
      clues,
      suggestions
    };
  }

  if (parts[0] === "internship" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.internship && resumeData.internship[idx];
    const val = item ? (item[subKey] || "") : "";
    return {
      section: "internship",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val,
      clues,
      suggestions: []
    };
  }

  if (parts[0] === "project" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.project && resumeData.project[idx];
    const val = item ? (item[subKey] || "") : "";
    let suggestions = [];
    if (item) {
      ["desc", "duty", "result", "tech"].forEach(k => {
        if (k !== subKey && item[k]) {
          suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
        }
      });
    }
    return {
      section: "project",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val,
      clues,
      suggestions
    };
  }

  if (slot === "skills" || slot === "languages") {
    return {
      section: "basic",
      subKey: slot,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[slot] || slot,
      value: resumeData[slot] || "",
      clues,
      suggestions: []
    };
  }

  return null;
}

// 精确单字段识别与匹配算法
function detectFieldForElement(el, resumeData) {
  try {
    if (!el || !isEditableElement(el) || !resumeData) return null;

    // ==================== 优先层：大模型拓扑映射缓存查询 ====================
    const fid = getElementStableFingerprint(el);
    const aiMapping = aiFieldMappingCache.get(fid);
    if (aiMapping && aiMapping.slot && aiMapping.confidence >= 0.7) {
      const slot = aiMapping.slot; // e.g. "basic.email", "education.0.school", "project.0.desc"
      const resolved = resolveSlotValueAndMetadata(slot, resumeData, el);
      if (resolved) {
        resolved.isAiMatched = true;
        resolved.confidence = aiMapping.confidence;
        resolved.reason = aiMapping.reason;
        return resolved;
      }
    }

    const clues = getElementClues(el);
    if (!clues || clues.length === 0) return null;

    // Moka 的教育卡片优先于全局计数：每张卡片只对应一段教育经历，避免两张学校名称都写入最高学历。
    if (getAtsProfile().id === "moka") {
      const educationIndex = getMokaEducationCardIndex(el, resumeData);
      if (educationIndex !== null && resumeData.education?.[educationIndex]) {
        const dateRole = detectMokaEducationDateRole(el);
        if (dateRole) {
          const value = getEducationFieldValue(resumeData.education[educationIndex], dateRole);
          if (value) return { section: "education", subKey: dateRole, fieldKey: "education." + educationIndex + "." + dateRole, label: dateRole === "start" ? "入学时间" : "毕业时间", value, clues, suggestions: [], isMokaCardMatched: true };
        }
        const labelText = clues.join(" ");
        const educationKeys = ["school", "degree", "major", "gpa", "department", "supervisor", "role", "roleDescription", "courses", "researchDirection", "thesisTopic"];
        for (const subKey of educationKeys) {
          if (isMatch([labelText], KEYWORDS.education[subKey] || [])) {
            const value = getEducationFieldValue(resumeData.education[educationIndex], subKey);
            if (value) return { section: "education", subKey, fieldKey: "education." + educationIndex + "." + subKey, label: FIELD_LABEL_MAP[subKey] || subKey, value, clues, suggestions: [], isMokaCardMatched: true };
          }
        }
      }
    }

    // 0. 输入框自身高特异性类型与属性强判定 (最高优先级，严禁被祖先容器的"姓名"等词汇截胡)
    const elType = (el.type || "").toLowerCase();
    const elName = (el.name || "").toLowerCase();
    const elId = (el.id || "").toLowerCase();
    const elPlaceholder = (el.placeholder || "").toLowerCase();
    const allClueStr = clues.join(" ");

    // 0.0 文件上传框直接锁定 (简历附件)
    if (elType === "file") {
      const att = resumeData.basic && resumeData.basic.resumeAttachment;
      if (att && att.dataUrl) {
        return {
          section: "basic",
          subKey: "resumeAttachment",
          fieldKey: "basic.resumeAttachment",
          label: "简历附件",
          value: att.fileName || "已配置的简历附件",
          fileAttachment: att,
          clues,
          suggestions: []
        };
      }
    }

    // 0.05 密码输入框直接锁定 (支持智能生成与密码规则匹配)
    const isPasswordClue = elType === "password" ||
      /(?:password|passwd|pwd|passcode)/i.test(elName) ||
      /(?:password|passwd|pwd|passcode)/i.test(elId) ||
      /(?:密码|口令)/i.test(elPlaceholder) ||
      clues.some(c => /^(?:账户)?密码|设置密码|登录密码|确认密码$/i.test(c.trim()));

    if (isPasswordClue) {
      const isConfirm = /(?:confirm|repeat|again|repassword|repwd|pwd2|passwd2|确认|再次|重复)/i.test(elName + " " + elId + " " + elPlaceholder + " " + allClueStr);
      const hint = extractPasswordRequirementHints();
      return {
        section: "security",
        subKey: isConfirm ? "confirmPassword" : "password",
        fieldKey: isConfirm ? "security.confirmPassword" : "security.password",
        label: isConfirm ? "确认密码" : "密码",
        value: "",
        isPassword: true,
        isConfirmPassword: isConfirm,
        ruleHint: hint || "8-16位 大小写+数字+符号",
        clues,
        suggestions: []
      };
    }
    const isEmailClue = elType === "email" ||
      /(?:^|[_.-])email(?:[_.-]|$)|e-mail|mail/i.test(elName) ||
      /(?:^|[_.-])email(?:[_.-]|$)|e-mail|mail/i.test(elId) ||
      /(?:邮箱|email|e-mail)/i.test(elPlaceholder) ||
      clues.some(c => /^(?:电子)?邮箱(?:地址)?$|^email$/i.test(c.trim()));

    if (isEmailClue && !clues.some(c => /紧急|父母|家属|亲属|证明人|推荐人/i.test(c))) {
      return {
        section: "basic",
        subKey: "email",
        fieldKey: "basic.email",
        label: FIELD_LABEL_MAP.email || "电子邮箱",
        value: resumeData.basic.email || "",
        clues,
        suggestions: []
      };
    }

    // 0.2 手机电话直接锁定
    const isPhoneClue = elType === "tel" ||
      /(?:^|[_.-])(?:mobile|phone|tel)(?:[_.-]|$)/i.test(elName) ||
      /(?:^|[_.-])(?:mobile|phone|tel)(?:[_.-]|$)/i.test(elId) ||
      /(?:手机|电话|手机号|手机号码|联系电话|移动电话)/i.test(elPlaceholder) ||
      clues.some(c => /^(?:手机号?码?|联系电话|移动电话)$/i.test(c.trim()));

    if (isPhoneClue && !clues.some(c => /紧急|父母|家属|亲属|证明人|推荐人/i.test(c))) {
      return {
        section: "basic",
        subKey: "phone",
        fieldKey: "basic.phone",
        label: FIELD_LABEL_MAP.phone || "手机号码",
        value: resumeData.basic.phone || "",
        clues,
        suggestions: []
      };
    }

    // 0.3 身份证号直接锁定
    const isIdCardClue = el.getAttribute("maxlength") === "18" ||
      /(?:^|[_.-])(?:idcard|id_card|identity|idnumber)(?:[_.-]|$)/i.test(elName) ||
      /(?:^|[_.-])(?:idcard|id_card|identity|idnumber)(?:[_.-]|$)/i.test(elId) ||
      /(?:身份证|证件号码|公民身份证)/i.test(elPlaceholder) ||
      clues.some(c => /(?:身份证号?码?|公民身份号码|证件号码)$/i.test(c.trim()));

    if (isIdCardClue) {
      return {
        section: "basic",
        subKey: "idCard",
        fieldKey: "basic.idCard",
        label: FIELD_LABEL_MAP.idCard || "身份证号",
        value: resumeData.basic.idCard || "",
        clues,
        suggestions: []
      };
    }

    // 0.4 城市调剂直接锁定 (严禁被误判为城市或岗位)
    if (/调剂|服从调剂|接受调剂|城市调剂/i.test(allClueStr) && !/岗位|职位|学校/i.test(allClueStr)) {
      return {
        section: "basic",
        subKey: "acceptRelocation",
        fieldKey: "basic.acceptRelocation",
        label: "城市调剂",
        value: resumeData.basic.acceptRelocation || "是",
        clues,
        suggestions: [
          { label: "是", value: "是" },
          { label: "否", value: "否" }
        ]
      };
    }

    // 0.5 政治面貌直接锁定
    if (/政治面貌|政治身份|党派/i.test(allClueStr)) {
      return {
        section: "basic",
        subKey: "political",
        fieldKey: "basic.political",
        label: "政治面貌",
        value: resumeData.basic.political || "共青团员",
        clues,
        suggestions: [
          { label: "中共党员", value: "中共党员" },
          { label: "共青团员", value: "共青团员" },
          { label: "群众", value: "群众" }
        ]
      };
    }

    // 0.6 求职意向直接锁定 (排除调剂、学校、项目)
    if (/(?:求职意向|期望岗位|期望职位|申请岗位|应聘岗位|目标岗位)/i.test(allClueStr) && !/调剂|项目|经历/i.test(allClueStr)) {
      return {
        section: "basic",
        subKey: "jobIntent",
        fieldKey: "basic.jobIntent",
        label: "求职意向",
        value: resumeData.basic.jobIntent || "",
        clues,
        suggestions: []
      };
    }

    // 0.7 居住地址与籍贯省市精密锁定
    if (/学校所在地|学校所在城市|院校所在地|学校地址/i.test(allClueStr)) {
      const eduIdx = detectEducationItemIndex(el, clues, resumeData, 0);
      const item = resumeData.education && resumeData.education[eduIdx];
      return {
        section: "education",
        subKey: "schoolLocation",
        fieldKey: `education.${eduIdx}.schoolLocation`,
        label: "学校所在地",
        value: item ? (item.schoolLocation || "") : "",
        clues,
        suggestions: []
      };
    }

    if (/户籍所在省|户口所在省|籍贯省|生源省|出生省/i.test(allClueStr) && !/市|区|县/i.test(allClueStr)) {
      const area = resumeData.basic.nativePlace || "";
      const parts = parseChineseArea(area);
      const prov = parts[0] || "";
      return {
        section: "basic",
        subKey: "nativeProvince",
        fieldKey: "basic.nativeProvince",
        label: "籍贯省份",
        value: prov,
        clues,
        suggestions: [{ label: prov, value: prov }]
      };
    }

    if (/户籍所在地市|户口所在地市|籍贯市|生源市|出生城市/i.test(allClueStr) && !/省/i.test(allClueStr)) {
      const area = resumeData.basic.nativePlace || "";
      const parts = parseChineseArea(area);
      const city = parts[1] || parts[0] || "";
      return {
        section: "basic",
        subKey: "nativeCity",
        fieldKey: "basic.nativeCity",
        label: "籍贯城市",
        value: city,
        clues,
        suggestions: [{ label: city, value: city }]
      };
    }

    if (/现居住省|现居省|居住省|所在省/i.test(allClueStr) && !/市|区|县/i.test(allClueStr)) {
      const area = resumeData.basic.residence || resumeData.basic.city || "";
      const parts = parseChineseArea(area);
      const prov = parts[0] || "";
      return {
        section: "basic",
        subKey: "residenceProvince",
        fieldKey: "basic.residenceProvince",
        label: "现居省份",
        value: prov,
        clues,
        suggestions: [{ label: prov, value: prov }]
      };
    }

    if (/现居住市|现居市|居住市|常住市/i.test(allClueStr) && !/省/i.test(allClueStr)) {
      const area = resumeData.basic.residence || resumeData.basic.city || "";
      const parts = parseChineseArea(area);
      const city = parts[1] || parts[0] || "";
      return {
        section: "basic",
        subKey: "residenceCity",
        fieldKey: "basic.residenceCity",
        label: "现居城市",
        value: city,
        clues,
        suggestions: [{ label: city, value: city }]
      };
    }

    if (/详细地址|现居住地|详细住址|家庭住址|居住地址|通信地址|门牌/i.test(allClueStr) && !/公司|单位|学校/i.test(allClueStr)) {
      return {
        section: "basic",
        subKey: "residence",
        fieldKey: "basic.residence",
        label: "现居详细地址",
        value: resumeData.basic.residence || "",
        clues,
        suggestions: []
      };
    }

    // 0.8 多行长文本框 (TEXTAREA) 专属路由拦截：绝不分配给短字段 (姓名/电话/邮箱/生日等)
    if (el.tagName === "TEXTAREA" || el.isContentEditable) {
      if (/自我评价|自我介绍|自我阐述|个人优势/i.test(allClueStr)) {
        return {
          section: "basic",
          subKey: "selfEval",
          fieldKey: "basic.selfEval",
          label: "自我评价",
          value: resumeData.basic.selfEval || "",
          clues,
          suggestions: []
        };
      }
      if (/工作职责|实习职责|工作内容|实习内容|工作描述|实习描述/i.test(allClueStr)) {
        const item = resumeData.internship && resumeData.internship[0];
        return {
          section: "internship",
          subKey: "desc",
          fieldKey: "internship.0.desc",
          label: "实习职责描述",
          value: item ? item.desc : "",
          clues,
          suggestions: []
        };
      }
      if (/项目职责|负责内容|主要职责/i.test(allClueStr)) {
        const item = resumeData.project && resumeData.project[0];
        return {
          section: "project",
          subKey: "duty",
          fieldKey: "project.0.duty",
          label: "项目职责",
          value: item ? (item.duty || item.desc) : "",
          clues,
          suggestions: []
        };
      }
      if (/项目成果|业绩|收益|量化/i.test(allClueStr)) {
        const item = resumeData.project && resumeData.project[0];
        return {
          section: "project",
          subKey: "result",
          fieldKey: "project.0.result",
          label: "项目成果",
          value: item ? (item.result || item.desc) : "",
          clues,
          suggestions: []
        };
      }
      if (/项目描述|项目介绍|项目背景/i.test(allClueStr)) {
        const item = resumeData.project && resumeData.project[0];
        return {
          section: "project",
          subKey: "desc",
          fieldKey: "project.0.desc",
          label: "项目描述",
          value: item ? item.desc : "",
          clues,
          suggestions: []
        };
      }
      if (/专业描述|专业介绍|主修介绍/i.test(allClueStr)) {
        const item = resumeData.education && resumeData.education[0];
        return {
          section: "education",
          subKey: "majorDescription",
          fieldKey: "education.0.majorDescription",
          label: "专业描述",
          value: item ? (item.majorDescription || "") : "",
          clues,
          suggestions: []
        };
      }
      if (/技能|技术栈|it技能/i.test(allClueStr)) {
        return {
          section: "basic",
          subKey: "skills",
          fieldKey: "skills",
          label: "专业技能",
          value: resumeData.skills || "",
          clues,
          suggestions: []
        };
      }
    }

  // 0.1 专门探测就读时间年-月输入框/下拉框 (支持输入框/下拉框叫“年”、“月”、“就读时间”等全形态)
  let eduDateRole = null;
  if (el.tagName === "SELECT") {
    const sType = inspectSelectType(el);
    if (sType) {
      eduDateRole = detectYearMonthSelectRole(el, sType, clues);
    }
  }
  if (!eduDateRole) {
    const sectionCtx = getContextSection(el);
    eduDateRole = inspectEduDateTimeRole(el, clues, sectionCtx);
  }

  if (eduDateRole) {
    const subKey = eduDateRole;
    const eduIdx = detectEducationItemIndex(el, clues, resumeData, 0);
    const item = resumeData.education && resumeData.education[eduIdx];
    const val = getEducationFieldValue(item, subKey);
    
    let suggestions = [];
    const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
    const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));

    if (subKey === 'startYear' || subKey === 'endYear') {
      if (masterEdu) {
        const myStartYear = masterEdu.start ? masterEdu.start.split('-')[0] : "";
        const myEndYear = masterEdu.end ? masterEdu.end.split('-')[0] : "";
        if (myStartYear) suggestions.push({ label: `硕入学: ${myStartYear}年`, value: myStartYear });
        if (myEndYear) suggestions.push({ label: `硕毕业: ${myEndYear}年`, value: myEndYear });
      }
      if (bachelorEdu) {
        const bStartYear = bachelorEdu.start ? bachelorEdu.start.split('-')[0] : "";
        const bEndYear = bachelorEdu.end ? bachelorEdu.end.split('-')[0] : "";
        if (bStartYear) suggestions.push({ label: `本入学: ${bStartYear}年`, value: bStartYear });
        if (bEndYear) suggestions.push({ label: `本毕业: ${bEndYear}年`, value: bEndYear });
      }
    } else if (subKey === 'startMonth' || subKey === 'endMonth') {
      if (masterEdu) {
        const myStartMonth = masterEdu.start ? masterEdu.start.split('-')[1] : "";
        const myEndMonth = masterEdu.end ? masterEdu.end.split('-')[1] : "";
        if (myStartMonth) suggestions.push({ label: `硕入学: ${myStartMonth}月`, value: myStartMonth });
        if (myEndMonth) suggestions.push({ label: `硕毕业: ${myEndMonth}月`, value: myEndMonth });
      }
      if (bachelorEdu) {
        const bStartMonth = bachelorEdu.start ? bachelorEdu.start.split('-')[1] : "";
        const bEndMonth = bachelorEdu.end ? bachelorEdu.end.split('-')[1] : "";
        if (bStartMonth) suggestions.push({ label: `本入学: ${bStartMonth}月`, value: bStartMonth });
        if (bEndMonth) suggestions.push({ label: `本毕业: ${bEndMonth}月`, value: bEndMonth });
      }
    } else if (subKey === 'start' || subKey === 'end') {
      if (item && item.start) suggestions.push({ label: `入学: ${item.start}`, value: item.start });
      if (item && item.end) suggestions.push({ label: `毕业: ${item.end}`, value: item.end });
    }

    return {
      section: 'education',
      subKey,
      fieldKey: `education.${eduIdx}.${subKey}`,
      label: (FIELD_LABEL_MAP[subKey] || '就读时间'),
      value: val,
      clues,
      suggestions
    };
  }

  // 1. 强指示词优先匹配 (结合同卡片板块锚点过滤，规避导师/紧急联系人/跨段起止时间混淆)
  const sectionCtx = getContextSection(el);
  for (let indicator of STRONG_INDICATORS) {
    if (indicator.section !== 'basic' && indicator.section !== 'family' && sectionCtx && sectionCtx !== indicator.section) continue;
    if (isMatch(clues, indicator.keywords)) {
      const section = indicator.section;
      const subKey = indicator.subKey;
      if (section === 'basic') {
        if (subKey === 'name') {
          if (EXCLUSIONS.name.some(ex => clues.some(c => c.includes(ex)))) {
            continue; // 包含导师、紧急联系人、亲属、父母、公司等关键词时，严禁误判为本人全名
          }
        }
        const val = getBasicFieldDerivedValue(subKey, resumeData);
        let suggestions = [];
        if (subKey.startsWith('emergency')) {
          ['emergencyContact', 'emergencyRelation', 'emergencyPhone'].forEach(k => {
            if (k !== subKey && resumeData.basic[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
            }
          });
        } else if (subKey === 'name') {
          const split = splitChineseName(resumeData.basic.name || "");
          if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
          if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
        } else if (subKey === 'height' && val) {
          const num = val.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}cm`, value: `${num}cm` });
          suggestions.push({ label: num, value: num });
        } else if (subKey === 'weight' && val) {
          const num = val.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}kg`, value: `${num}kg` });
          suggestions.push({ label: `${num}公斤`, value: `${num}公斤` });
          suggestions.push({ label: num, value: num });
        } else if (['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)) {
          const areaBase = (subKey.startsWith('native') ? resumeData.basic.nativePlace : (resumeData.basic.residence || resumeData.basic.city)) || "";
          const areaParts = parseChineseArea(areaBase);
          areaParts.forEach(part => {
            suggestions.push({ label: part, value: part });
          });
        }
        return {
          section: 'basic',
          subKey,
          fieldKey: `basic.${subKey}`,
          label: (FIELD_LABEL_MAP[subKey] || subKey),
          value: val,
          clues,
          suggestions,
          isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)
        };
      }

      let idx = 0;
      if (section === 'education') {
        idx = detectEducationItemIndex(el, clues, resumeData, 0);
      } else if (section === 'project') {
        idx = detectProjectItemIndex(el, clues, resumeData, 0);
      }
      const item = resumeData[section] && resumeData[section][idx];
      const val = (section === 'education') ? getEducationFieldValue(item, subKey) : (item ? (item[subKey] || "") : "");
      
      // 生成相关候选项，方便用户在气泡中一键选择其他相近字段
      let suggestions = [];
      if (section === 'project' && item) {
        if (subKey === 'name') {
          resumeData.project.forEach((p, pIdx) => {
            if (p.name) {
              suggestions.push({ label: `项${pIdx + 1}: ${p.name.slice(0, 10)}`, value: p.name });
            }
          });
        } else {
          ['desc', 'duty', 'result', 'tech'].forEach(k => {
            if (k !== subKey && item[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
            }
          });
        }
      } else if (section === 'education' && item) {
        if (subKey === 'school') {
          // 本硕直选双胶囊
          const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
          const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));
          if (masterEdu && masterEdu.school) {
            suggestions.push({ label: `硕: ${masterEdu.school.replace(/（.*）/, '')}`, value: masterEdu.school });
          }
          if (bachelorEdu && bachelorEdu.school) {
            suggestions.push({ label: `本: ${bachelorEdu.school.replace(/（.*）/, '')}`, value: bachelorEdu.school });
          }
        } else if (['start', 'startYear', 'startMonth', 'end', 'endYear', 'endMonth'].includes(subKey)) {
          // 年月拆分直选胶囊
          if (item.start) {
            const [sy, sm] = item.start.split('-');
            if (sy) suggestions.push({ label: `${sy}年`, value: sy });
            if (sm) suggestions.push({ label: `${sm}月`, value: sm });
          }
          if (item.end) {
            const [ey, em] = item.end.split('-');
            if (ey) suggestions.push({ label: `${ey}年`, value: ey });
            if (em) suggestions.push({ label: `${em}月`, value: em });
          }
        } else {
          ['supervisor', 'courses', 'researchDirection', 'major'].forEach(k => {
            if (k !== subKey && item[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
            }
          });
        }
      } else if (section === 'family') {
        (resumeData.family || []).forEach(f => {
          if (f.name && f.relation) {
            suggestions.push({ label: `${f.relation}: ${f.name}`, value: f[subKey] || f.name });
          }
        });
      }

      return {
        section,
        subKey,
        fieldKey: `${section}.${idx}.${subKey}`,
        label: (FIELD_LABEL_MAP[subKey] || subKey),
        value: val,
        clues,
        suggestions
      };
    }
  }

  // 2. 根据上下文标题结构匹配板块子字段
  const sectionContext = getContextSection(el);
  if (sectionContext && KEYWORDS[sectionContext]) {
    const subKeywords = KEYWORDS[sectionContext];
    for (let subKey in subKeywords) {
      if (isMatch(clues, subKeywords[subKey])) {
        let idx = 0;
        if (sectionContext === 'education') {
          idx = detectEducationItemIndex(el, clues, resumeData, 0);
        } else if (sectionContext === 'project') {
          idx = detectProjectItemIndex(el, clues, resumeData, 0);
        }
        const item = resumeData[sectionContext] && resumeData[sectionContext][idx];
        const val = (sectionContext === 'education') ? getEducationFieldValue(item, subKey) : (item ? (item[subKey] || "") : "");
        let suggestions = [];
        if (sectionContext === 'project' && item) {
          if (subKey === 'name') {
            resumeData.project.forEach((p, pIdx) => {
              if (p.name) {
                suggestions.push({ label: `项${pIdx + 1}: ${p.name.slice(0, 10)}`, value: p.name });
              }
            });
          } else {
            ['desc', 'duty', 'result', 'tech'].forEach(k => {
              if (k !== subKey && item[k]) {
                suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
              }
            });
          }
        } else if (sectionContext === 'education' && item) {
          if (subKey === 'school') {
            const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
            const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));
            if (masterEdu && masterEdu.school) {
              suggestions.push({ label: `硕: ${masterEdu.school.replace(/（.*）/, '')}`, value: masterEdu.school });
            }
            if (bachelorEdu && bachelorEdu.school) {
              suggestions.push({ label: `本: ${bachelorEdu.school.replace(/（.*）/, '')}`, value: bachelorEdu.school });
            }
          } else if (['start', 'startYear', 'startMonth', 'end', 'endYear', 'endMonth'].includes(subKey)) {
            if (item.start) {
              const [sy, sm] = item.start.split('-');
              if (sy) suggestions.push({ label: `${sy}年`, value: sy });
              if (sm) suggestions.push({ label: `${sm}月`, value: sm });
            }
            if (item.end) {
              const [ey, em] = item.end.split('-');
              if (ey) suggestions.push({ label: `${ey}年`, value: ey });
              if (em) suggestions.push({ label: `${em}月`, value: em });
            }
          }
        }
        return {
          section: sectionContext,
          subKey,
          fieldKey: `${sectionContext}.${idx}.${subKey}`,
          label: (FIELD_LABEL_MAP[subKey] || subKey),
          value: val,
          clues,
          suggestions
        };
      }
    }
  }

  // 3. 基本信息匹配 (使用严格排除规则)
  for (let key in KEYWORDS) {
    if (!['education', 'internship', 'project', 'honors', 'competition', 'paper', 'family'].includes(key)) {
      const keywords = KEYWORDS[key];
      if (isMatch(clues, keywords)) {
        if (EXCLUSIONS[key]) {
          const hasExclusion = clues.some(clue => EXCLUSIONS[key].some(ex => clue.includes(ex)));
          if (hasExclusion) continue;
        }
        let matchedValue = (key === 'skills') ? resumeData.skills : (key === 'languages' ? resumeData.languages : getBasicFieldDerivedValue(key, resumeData));
        let suggestions = [];
        if (key.startsWith('emergency')) {
          ['emergencyContact', 'emergencyRelation', 'emergencyPhone'].forEach(k => {
            if (k !== key && resumeData.basic[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
            }
          });
        } else if (key === 'name') {
          const split = splitChineseName(resumeData.basic.name || "");
          if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
          if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
        } else if (key === 'height' && matchedValue) {
          const num = matchedValue.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}cm`, value: `${num}cm` });
          suggestions.push({ label: num, value: num });
        } else if (key === 'weight' && matchedValue) {
          const num = matchedValue.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}kg`, value: `${num}kg` });
          suggestions.push({ label: `${num}公斤`, value: `${num}公斤` });
          suggestions.push({ label: num, value: num });
        } else if (['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(key) && matchedValue) {
          const areaParts = parseChineseArea(matchedValue);
          areaParts.forEach(part => {
            suggestions.push({ label: part, value: part });
          });
        }
        return {
          section: 'basic',
          subKey: key,
          fieldKey: `basic.${key}`,
          label: (FIELD_LABEL_MAP[key] || key),
          value: matchedValue || "",
          clues,
          suggestions,
          isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(key)
        };
      }
    }
  }

  return null;
  } catch (err) {
    console.error("detectFieldForElement error:", err);
    return null;
  }
}


