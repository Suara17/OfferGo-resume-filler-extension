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
