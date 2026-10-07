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
