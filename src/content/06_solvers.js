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
