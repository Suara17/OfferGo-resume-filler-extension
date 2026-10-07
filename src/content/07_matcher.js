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
