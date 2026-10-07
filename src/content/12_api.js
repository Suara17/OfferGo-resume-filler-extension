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
