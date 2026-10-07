const AGENT_LOG_STORAGE_KEY = "rf_agent_debug_logs";
const AGENT_LOG_MAX_ENTRIES = 300;
const AGENT_LOG_SCHEMA_VERSION = 2;

function sanitizeTelemetryUrl(rawUrl) {
  if (!rawUrl || rawUrl === "unknown") return "unknown";
  try {
    const url = new URL(rawUrl);
    // URL 参数常含 userId、职位 ID 等；诊断只需要站点与路径。
    return `${url.origin}${url.pathname}`;
  } catch (_) {
    return String(rawUrl).split("?")[0].split("#")[0];
  }
}

function createAgentSessionId() {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
  return `session_${Date.now()}_${random}`;
}

function compactError(error) {
  if (!error) return undefined;
  return String(error).replace(/[\r\n\t]+/g, " ").trim().slice(0, 300);
}

function summarizeStepResult(response) {
  const result = response?.result || response || {};
  return {
    success: !!result.success,
    verified: result.verified === true,
    skipped: !!result.skipped,
    pausedForHuman: !!result.pausedForHuman,
    error: compactError(result.error || response?.message || result.reason),
    outputSlot: result.slot,
    buttonClicked: result.buttonClicked,
    agreementCount: result.agreementCount,
    declarationCount: result.declarationCount
  };
}

function summarizePageState(stateDSL, errors) {
  const text = String(stateDSL || "");
  return {
    controls: (text.match(/<[^>]+status=/g) || []).length,
    emptyControls: (text.match(/status="empty"/g) || []).length,
    filledControls: (text.match(/status="filled"/g) || []).length,
    validationErrorCount: Array.isArray(errors) ? errors.length : 0,
    hasSecurityAlert: text.includes("[SECURITY_ALERT]")
  };
}

function generateTelemetryResumeSummary(resumeData) {
  const basic = resumeData?.basic || {};
  const hasValue = key => !!String(basic[key] || "").trim();
  return {
    availableBasicSlots: ["name", "phone", "email", "jobIntent", "city", "birth", "idCard", "highestDegree"].filter(hasValue),
    sectionCounts: {
      education: Array.isArray(resumeData?.education) ? resumeData.education.length : 0,
      internship: Array.isArray(resumeData?.internship) ? resumeData.internship.length : 0,
      project: Array.isArray(resumeData?.project) ? resumeData.project.length : 0
    }
  };
}

// ==================== 专供 Agent 后台分析的结构化诊断日志系统 ====================
async function appendAgentLog(entry) {
  const safeEntry = { ...entry };
  if (safeEntry.url) safeEntry.url = sanitizeTelemetryUrl(safeEntry.url);
  const logItem = {
    schemaVersion: AGENT_LOG_SCHEMA_VERSION,
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    time: new Date().toISOString(),
    ...safeEntry
  };

  // 1. 在控制台单行输出紧凑 JSON，方便 AI Agent / 自动化脚本捕获
  console.log("[AGENT_DIAGNOSTIC_JSON]: " + JSON.stringify(logItem));

  // 2. 本地 CLI 日志推送设为显式配置项：默认不向 127.0.0.1:28888 发送未认证明文请求 (CWE-319 防御)
  //    仅当在开发环境中显式开启 rf_enable_local_cli_debug 时，才按需推送到本地调试接收器
  try {
    const debugCfg = await chrome.storage.local.get("rf_enable_local_cli_debug");
    if (debugCfg && debugCfg.rf_enable_local_cli_debug) {
      fetch("http://127.0.0.1:28888/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logItem)
      }).catch(() => {});
    }
  } catch (_) {}
  // 3. 在 chrome.storage.local 中持久化保留最近 100 条
  try {
    const storage = await chrome.storage.local.get(AGENT_LOG_STORAGE_KEY);
    const logs = storage[AGENT_LOG_STORAGE_KEY] || [];
    logs.push(logItem);
    if (logs.length > AGENT_LOG_MAX_ENTRIES) {
      logs.splice(0, logs.length - AGENT_LOG_MAX_ENTRIES);
    }
    await chrome.storage.local.set({ [AGENT_LOG_STORAGE_KEY]: logs });
  } catch(e) {
    console.warn("记录 Agent 调试日志失败:", e);
  }
}
