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
