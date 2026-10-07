// ==========================================================================
//  OfferGo - Background Service Worker (Auto-generated from src/background/*.js)
//  请编辑 src/background/ 下对应的小模块文件，然后运行 npm run build
// ==========================================================================

// --- [src/background/01_init.js] ---
// 确保点击扩展图标时优先触发 action.onClicked 而非直接打开侧边栏
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

// 监听扩展图标点击，优先切换当前页面上的悬浮卡片展开/折叠
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "toggleFloatingCard" });
    } catch (e) {
      // 降级支持：在受限页面 (如 chrome://, edge://, webstore 等不能注入 content script 的页面) 打开侧边栏
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
    }
  }
});

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  console.log("OfferGo 已成功安装！页面悬浮卡片已启用。");
});



// --- [src/background/02_telemetry.js] ---
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

  // 2. 本地 CLI 日志推送已移除：该接口未经身份验证，且会将简历 PII 以明文发送到
  //    本机任意进程可监听的端口 (127.0.0.1:28888)，存在信息泄露风险 (CWE-319)。

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



// --- [src/background/03_frame_broadcaster.js] ---
// ==================== 获取指定标签页的全部 Frame IDs (支持嵌套 iframe 穿透) ====================
async function getAllFramesForTab(tabId) {
  if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
    try {
      const frames = await new Promise((resolve) => {
        chrome.webNavigation.getAllFrames({ tabId }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      });
      if (Array.isArray(frames) && frames.length > 0) {
        return frames.map((f) => f.frameId);
      }
    } catch (e) {}
  }
  return [0];
}

// ==================== 统一消息监听与跨 Frame 广播转发 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "callLLM") {
    handleCallLLM(request.payload, sender)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // 异步响应
  }

  // 跨 Frame 广播消息 (穿透主页面与所有子 iframe)
  if (request && request.action === "broadcastToTabFrames") {
    (async () => {
      try {
        let tabId = request.tabId || (sender && sender.tab && sender.tab.id);
        if (!tabId && chrome.tabs && chrome.tabs.query) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab) tabId = activeTab.id;
        }
        if (!tabId) {
          sendResponse({ success: false, error: "未找到目标标签页" });
          return;
        }

        const frameIds = await getAllFramesForTab(tabId);
        const results = await Promise.all(
          frameIds.map(async (frameId) => {
            if (request.excludeSenderFrame && sender && sender.frameId === frameId) {
              return null;
            }
            return await new Promise((resolve) => {
              chrome.tabs.sendMessage(tabId, request.payload, { frameId }, (resp) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(resp);
              });
            });
          })
        );

        const validResults = results.filter(Boolean);
        const totalCount = validResults.reduce((sum, r) => sum + (typeof r.count === "number" ? r.count : 0), 0);
        const anySuccess = validResults.some((r) => r.status === "success");
        sendResponse({
          success: true,
          status: anySuccess ? "success" : (validResults[0] ? validResults[0].status : "no_response"),
          count: totalCount,
          results: validResults
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  // 子 iframe 请求唤醒顶层悬浮卡片
  if (request && request.action === "openTopFloatingCard") {
    const tabId = sender && sender.tab && sender.tab.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: "toggleFloatingCard", forceExpand: true }, { frameId: 0 }, () => {
        void chrome.runtime.lastError;
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // 供 CLI 或外部脚本直接查询最近日志
  if (request && request.action === "getAgentLogs") {
    chrome.storage.local.get(AGENT_LOG_STORAGE_KEY).then((res) => {
      sendResponse({ success: true, logs: res[AGENT_LOG_STORAGE_KEY] || [] });
    });
    return true;
  }

  if (request && request.action === "getAgentLogDiagnostics") {
    chrome.storage.local.get(AGENT_LOG_STORAGE_KEY).then((res) => {
      const logs = res[AGENT_LOG_STORAGE_KEY] || [];
      const sessions = logs.filter(item => item.action === "agent_session_report");
      sendResponse({
        success: true,
        diagnostics: {
          schemaVersion: AGENT_LOG_SCHEMA_VERSION,
          retentionLimit: AGENT_LOG_MAX_ENTRIES,
          storedEntries: logs.length,
          sessionReports: sessions.length,
          latestSession: sessions.at(-1) || null,
          localReceiver: "http://127.0.0.1:28888/log (optional; run node agent_logs.js --listen)"
        }
      });
    });
    return true;
  }

  // 接收并落盘前端表单填充率综合审计报告
  if (request && request.action === "recordFillAudit") {
    (async () => {
      await appendAgentLog({
        action: "page_fill_rate_audit",
        url: (sender && sender.url) || request.audit?.url || "unknown",
        ...request.audit
      });
      sendResponse({ success: true });
    })();
    return true;
  }

  // 启动零隐私泄露 (Zero-PII) 网申 Agent 自动化填报循环
  if (request && request.action === "startAgentAutofill") {
    (async () => {
      let tabId = request.tabId || (sender && sender.tab && sender.tab.id);
      if (!tabId && chrome.tabs && chrome.tabs.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) tabId = tab.id;
      }
      if (!tabId) {
        sendResponse({ success: false, error: "未找到活动标签页" });
        return;
      }
      runAgentFormFilling(tabId, request.resumeData)
        .then((res) => sendResponse({ success: true, result: res }))
        .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    })();
    return true;
  }
});



// --- [src/background/04_agent_engine.js] ---
// ==================== 零隐私泄露 (Zero-PII) 网申智能体编排循环引擎 ====================
async function runAgentFormFilling(tabId, resumeData) {
  const maxRounds = 8;
  const maxNoProgressRounds = 2;
  const history = [];
  const sessionId = createAgentSessionId();
  const startedAtMs = Date.now();
  let roundsExecuted = 0;
  let terminationReason = "max_rounds_reached";
  let pageUrl = "unknown";
  let previousStateSummary = null;
  let noProgressRounds = 0;

  async function logSessionEvent(event, details = {}) {
    await appendAgentLog({
      action: "agent_session_event",
      event,
      sessionId,
      tabId,
      url: details.url || pageUrl,
      elapsedMs: Date.now() - startedAtMs,
      ...details
    });
  }

  function emitStatus(payload) {
    chrome.tabs.sendMessage(tabId, { action: "agentStatusUpdate", ...payload }, { frameId: 0 }, () => {
      void chrome.runtime.lastError;
    });
  }

  emitStatus({ phase: "start", round: 0, message: "🤖 AI Agent 正在初始化，启动安全隔离沙箱..." });
  await logSessionEvent("session_started", { maxRounds, resumeSlotSummary: generateTelemetryResumeSummary(resumeData) });
  // Agent 不允许合成点击离开当前申请表；内容脚本仅拦截非可信的跨文档链接动作。
  await new Promise(resolve => chrome.tabs.sendMessage(tabId, { action: "agentSetRouteGuard", active: true }, () => resolve()));

  // 阶段 1：本地确定性极速初筛预填 (把最确定的基础项在端侧秒填，减轻大模型负担)
  const prePassStartedAt = Date.now();
  let prePassResult = null;
  try {
    prePassResult = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "agentPrePass", resumeData }, (res) => resolve(res));
    });
  } catch (error) {
    prePassResult = { status: "error", message: compactError(error) };
  }
  await logSessionEvent("prepass_completed", {
    durationMs: Date.now() - prePassStartedAt,
    success: prePassResult?.status === "success",
    filledCandidates: prePassResult?.count || 0,
    error: compactError(prePassResult?.message)
  });
  await new Promise((r) => setTimeout(r, 350));

  // 阶段 2：进入 ReAct 多轮符号化规划与端侧水合循环
  for (let round = 1; round <= maxRounds; round++) {
    roundsExecuted = round;
    const roundStartedAt = Date.now();
    emitStatus({ phase: "analyzing", round, message: `🔍 [第 ${round}/${maxRounds} 轮] 正在捕获页面动态拓扑与控件状态...` });

    // 获取当前脱敏页面状态与画像
    let pageStateRes = null;
    try {
      pageStateRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "agentGetPageState", resumeData }, (res) => {
          resolve(res);
        });
      });
    } catch (e) {}

    if (!pageStateRes || !pageStateRes.stateDSL) {
      terminationReason = "page_state_unavailable_or_no_pending_fields";
      await logSessionEvent("round_state_unavailable", { round, durationMs: Date.now() - roundStartedAt, error: compactError(pageStateRes?.message) });
      emitStatus({ phase: "finished", round, message: "🎉 页面已无待填项或已全部就绪！" });
      break;
    }

    const { stateDSL, profileDescriptor, errors, recoveryAudit } = pageStateRes;
    pageUrl = pageStateRes.url || pageUrl;
    const stateSummary = summarizePageState(stateDSL, errors);
    if (recoveryAudit?.metrics) {
      stateSummary.actionableUnfilledCount = recoveryAudit.metrics.actionableUnfilledCount || 0;
      stateSummary.manualOrMissingSourceCount = recoveryAudit.metrics.manualOrMissingSourceCount || 0;
    }
    const stateDelta = previousStateSummary ? {
      emptyControlsDelta: previousStateSummary.emptyControls - stateSummary.emptyControls,
      filledControlsDelta: stateSummary.filledControls - previousStateSummary.filledControls,
      validationErrorsDelta: previousStateSummary.validationErrorCount - stateSummary.validationErrorCount
    } : null;
    await logSessionEvent("round_state_captured", { round, durationMs: Date.now() - roundStartedAt, stateSummary, stateDelta });

    // 1. 安全探测：若存在验证码/滑块，自动暂停并请求人工接管
    if (stateDSL.includes("[SECURITY_ALERT]")) {
      terminationReason = "security_challenge";
      await logSessionEvent("session_paused", { round, reason: terminationReason, stateSummary });
      emitStatus({
        phase: "paused",
        round,
        message: "🔔 检测到页面存在安全验证码或滑块校验，Agent 已自动暂停，请手动完成后点击继续",
        canResume: true
      });
      break;
    }

    // 2. 检查是否所有表单项均已填毕且无红字报错
    const hasEmptyInput = stateDSL.includes('status="empty"');
    const hasError = errors && errors.length > 0;
    const hasAgentRetryableWork = !recoveryAudit || (recoveryAudit.metrics?.actionableUnfilledCount || 0) > 0;
    if ((!hasEmptyInput || !hasAgentRetryableWork) && !hasError && round > 1) {
      terminationReason = "all_fields_verified";
      await logSessionEvent("round_completed", { round, durationMs: Date.now() - roundStartedAt, stateSummary, reason: terminationReason });
      break;
    }

    // 3. 构建 Zero-PII 符号规划提示词 (绝无任何个人隐私真实数据)
    const systemPrompt = `你是一个零隐私泄露（Zero-PII）求职网申自动化智能体（Symbolic Slot Agent）。
你只接收脱敏后的页面控件结构（State DSL）与候选人可用槽位代号清单（Available Slots），严禁编造任何真实个人信息文本，所有指令必须通过槽位代号（slot）下发，由浏览器端侧安全水合。

【可用符号化动作指令 (Symbolic Actions)】:
1. {"action": "fill_slot", "fieldId": "rf_fid_xxx", "slot": "basic.name", "reason": "填入姓名"}
2. {"action": "solve_combobox", "fieldId": "rf_fid_xxx", "sourceSlot": "education.0.school", "reason": "搜索并选择最高学历院校"}
3. {"action": "select_cascader", "fieldId": "rf_fid_xxx", "sourceSlot": "basic.nativePlace", "reason": "省市区级联选择"}
4. {"action": "click_button", "buttonId": "Btn_rf_fid_xxx", "reason": "候选人有第2段教育经历，点击新增教育卡片"}
5. {"action": "advance_wizard", "buttonId": "Btn_rf_fid_xxx", "reason": "当前步骤无红字且已完成，安全进入下一步"}
6. {"action": "upload_attachment", "fieldId": "rf_fid_xxx", "reason": "自动挂载简历附件"}
7. {"action": "check_agreements", "reason": "勾选隐私政策与合规问卷"}
8. {"action": "pause_for_human", "reason": "遇到验证码，交由人工接管"}
9. {"action": "finish", "summary": "本页字段已全部对齐完毕"}

【核心规划推理原则】:
- 红字错误优先级最高：若【表单未通过红字报错】存在，先只围绕错误 fieldId 生成修复动作，禁止点击下一步。
- 只能在 status="empty" 或存在红字报错的控件中下发动作，严禁重复操作已标注为 status="filled" 的控件。
- 复杂下拉框、院校/专业搜索框务必使用 solve_combobox，利用端侧求解器闭环选择。
- 当 summary.educationCount > 页面已渲染的教育卡片数量时，务必先输出 click_button 点击添加卡片按钮！
- 仅当本页没有红字、没有 agent_retryable 空字段，且页面提供文字明确为“下一步/继续填写/保存并继续”的按钮时，才允许 advance_wizard；绝对不能用它点击“提交/投递/完成”。
- 严格直接输出纯合法 JSON，不得包含 Markdown 代码块反引号：
{"thought": "简短思考过程", "currentSection": "当前处理板块", "steps": [...]}`;

    const userPrompt = `【候选人抽象槽位清单 (100% 结构代号，无个人数据)】:
${JSON.stringify(profileDescriptor, null, 2)}

【当前页面表单脱敏状态快照 (DSL)】:
${stateDSL}

【已执行动作历史（含成功、验证、失败原因；严禁重复 verified=true 的动作）】:
${JSON.stringify(history.slice(-8).map(item => ({
  action: item.step?.action,
  slot: item.step?.slot || item.step?.sourceSlot,
  target: item.step?.fieldId || item.step?.buttonId,
  success: item.resultSummary?.success,
  verified: item.resultSummary?.verified,
  error: item.resultSummary?.error
})), null, 2)}

【本轮纠错要求】:
- 优先修复页面红字和 status="empty" 的控件；不要填写“推荐码”、无数据来源的附件、干部/语言/成果等级等简历没有对应槽位的可选字段。
- 每个动作必须等待端侧 verified=true 才算完成；对于此前失败的 target，换交互策略或暂停人工核对，不要机械重复。
- 仅在明确是 select / combobox / 日期 / 级联控件时使用 solve_combobox 或 select_cascader；普通输入框用 fill_slot。

请分析当前步骤，输出下一步的符号化操作计划：`;

    let steps = [];
    let thought = "";
    let currentSection = "";

    // 4. 调用大模型或端侧确定性状态机
    try {
      const rawOutput = await handleCallLLM({
        prompt: userPrompt,
        systemPrompt,
        jsonMode: true,
        meta: { action: "agent_react_step", round }
      });
      let cleaned = (rawOutput || "").trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
      }
      const parsed = JSON.parse(cleaned);
      steps = Array.isArray(parsed.steps) ? parsed.steps : [];
      thought = parsed.thought || "正在推进当前表单步骤...";
      currentSection = parsed.currentSection || "表单";
    } catch (llmErr) {
      console.warn("[ResumeFiller Agent] LLM 规划未连接，启用端侧确定性符号状态机:", llmErr.message);
      emitStatus({
        phase: "running",
        round,
        message: `💡 正在使用端侧符号状态机深度规划第 ${round} 轮...`
      });
      const localPlanRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "agentPlanLocally", resumeData }, (res) => {
          resolve(res);
        });
      });
      if (localPlanRes && Array.isArray(localPlanRes.steps)) {
        steps = localPlanRes.steps;
        thought = localPlanRes.thought || "端侧状态机规划完成";
      }
    }

    // 若云端模型本轮未生成动作，自动触发端侧深层自愈规划器扫描剩余未填项
    if (!steps || steps.length === 0) {
      const localPlanRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: "agentPlanLocally", resumeData }, (res) => {
          resolve(res);
        });
      });
      if (localPlanRes && Array.isArray(localPlanRes.steps)) {
        const actionableSteps = localPlanRes.steps.filter(s => s.action !== "finish" && s.action !== "check_agreements");
        if (actionableSteps.length > 0) {
          steps = actionableSteps;
          thought = "启动端侧深层自愈引擎，补填剩余漏填字段...";
        }
      }
    }

    if (!steps || steps.length === 0) {
      terminationReason = "planner_returned_no_actionable_steps";
      await logSessionEvent("round_no_actionable_steps", { round, durationMs: Date.now() - roundStartedAt, stateSummary, thought: String(thought || "").slice(0, 160) });
      break;
    }

    await logSessionEvent("round_plan_ready", {
      round,
      currentSection,
      planner: thought?.includes("端侧") || thought?.includes("自愈") ? "local" : "llm",
      stepCount: steps.filter(step => step.action !== "finish").length,
      plannedActions: steps.slice(0, 20).map(step => ({ action: step.action, slot: step.slot || step.sourceSlot, target: step.fieldId || step.buttonId }))
    });
    emitStatus({ phase: "executing", round, thought, currentSection, message: `🤖 [第 ${round} 轮] ${thought}` });

    // 5. 逐项派发给端侧执行器完成数据水合与交互
    let shouldBreakForNewDom = false;
    let shouldFinishAll = false;
    for (const step of steps) {
      if (step.action === "finish") {
        shouldFinishAll = true;
        break;
      }
      if (step.action === "pause_for_human") {
        terminationReason = "planner_requested_human";
        await logSessionEvent("session_paused", { round, reason: terminationReason, step: { action: step.action, reason: step.reason || "" } });
        emitStatus({ phase: "paused", round, message: step.reason || "需要人工处理", canResume: true });
        break;
      }
      emitStatus({
        phase: "executing",
        round,
        thought,
        currentSection,
        currentAction: step.reason || step.action,
        message: `⚡ 正在执行: ${step.reason || step.action}`
      });

      const stepStartedAt = Date.now();
      let execRes = null;
      try {
        execRes = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { action: "agentExecuteCommand", command: step, resumeData }, (res) => {
            if (chrome.runtime.lastError) resolve({ status: "error", message: chrome.runtime.lastError.message });
            else resolve(res);
          });
        });
      } catch (error) {
        execRes = { status: "error", message: compactError(error) };
      }

      const resultSummary = summarizeStepResult(execRes);
      const traceItem = { step, result: execRes, resultSummary, durationMs: Date.now() - stepStartedAt, round };
      history.push(traceItem);
      await logSessionEvent("step_completed", {
        round,
        stepIndex: history.length,
        durationMs: traceItem.durationMs,
        step: { action: step.action, target: step.fieldId || step.buttonId, slot: step.slot || step.sourceSlot, reason: String(step.reason || "").slice(0, 160) },
        result: resultSummary
      });
      // 验证失败时继续本轮其他字段，但下一轮不会把该字段当成已填，从而避免“假成功后遗忘”。
      if (!resultSummary.success && !resultSummary.skipped) {
        emitStatus({ phase: "executing", round, message: `⚠️ 未确认写入：${step.slot || step.sourceSlot || step.action}，将保留供下一轮重试` });
      }

      // 新增卡片或安全进入下一步后，新 DOM / 路由需稳定，立刻进入下一轮差量扫描。
      if (step.action === "click_button" || step.action === "advance_wizard") {
        shouldBreakForNewDom = true;
        await new Promise((r) => setTimeout(r, step.action === "advance_wizard" ? 750 : 500));
        break;
      }

      await new Promise((r) => setTimeout(r, 120));
    }

    if (shouldFinishAll) {
      terminationReason = "planner_finished";
      await logSessionEvent("round_completed", { round, durationMs: Date.now() - roundStartedAt, stateSummary, reason: terminationReason });
      break;
    }
    if (shouldBreakForNewDom) {
      await logSessionEvent("round_completed", { round, durationMs: Date.now() - roundStartedAt, stateSummary, reason: "new_dom_requested" });
      continue;
    }

    // 只在空控件或校验错误实际下降时继续扩展轮次，避免机械重复同一动作。
    const progress = !previousStateSummary || stateSummary.emptyControls < previousStateSummary.emptyControls || stateSummary.validationErrorCount < previousStateSummary.validationErrorCount;
    noProgressRounds = progress ? 0 : noProgressRounds + 1;
    previousStateSummary = stateSummary;
    await logSessionEvent("round_completed", { round, durationMs: Date.now() - roundStartedAt, stateSummary, progress, noProgressRounds, reason: terminationReason === "planner_requested_human" ? terminationReason : "steps_executed" });
    if (terminationReason === "planner_requested_human") break;
    if (noProgressRounds >= maxNoProgressRounds) {
      terminationReason = "no_verified_progress";
      await logSessionEvent("recovery_stopped", { round, reason: terminationReason, noProgressRounds, stateSummary });
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // 最终生成整页综合填充率审计报告并落盘供其他 Agent 分析改进
  let finalAudit = null;
  try {
    const auditRes = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "agentGetCoverageAudit", resumeData }, (res) => {
        resolve(res);
      });
    });
    if (auditRes && auditRes.audit) {
      finalAudit = auditRes.audit;
    }
  } catch (e) {}

  const fullAgentSessionReport = {
    action: "agent_session_report",
    sessionId,
    url: (finalAudit && finalAudit.url) || pageUrl || "unknown",
    system: (finalAudit && finalAudit.system) || "未知系统",
    durationMs: Date.now() - startedAtMs,
    terminationReason,
    sessionSummary: {
      roundsExecuted,
      totalStepsExecuted: history.length,
      successfulStepsCount: history.filter(h => h.resultSummary?.success).length,
      verifiedStepsCount: history.filter(h => h.resultSummary?.verified).length,
      skippedStepsCount: history.filter(h => h.resultSummary?.skipped).length,
      failedStepsCount: history.filter(h => !h.resultSummary?.success && !h.resultSummary?.skipped).length,
      recoverySummary: {
        maxRounds,
        maxNoProgressRounds,
        noProgressRoundsAtStop: noProgressRounds,
        finalActionableUnfilledCount: finalAudit?.metrics?.actionableUnfilledCount ?? null,
        finalManualOrMissingSourceCount: finalAudit?.metrics?.manualOrMissingSourceCount ?? null
      },
      actionSummary: history.reduce((summary, item) => {
        const action = item.step?.action || "unknown";
        summary[action] = (summary[action] || 0) + 1;
        return summary;
      }, {}),
      executionTrace: history.map((h, idx) => ({
        stepIndex: idx + 1,
        round: h.round,
        action: h.step?.action,
        fieldId: h.step?.fieldId || h.step?.buttonId,
        slot: h.step?.slot || h.step?.sourceSlot,
        reason: h.step?.reason || "",
        durationMs: h.durationMs,
        ...h.resultSummary
      }))
    },
    coverageAudit: finalAudit
  };

  await appendAgentLog(fullAgentSessionReport);
  await logSessionEvent("session_finished", {
    roundsExecuted,
    durationMs: Date.now() - startedAtMs,
    terminationReason,
    totalStepsExecuted: history.length,
    successfulStepsCount: fullAgentSessionReport.sessionSummary.successfulStepsCount,
    failedStepsCount: fullAgentSessionReport.sessionSummary.failedStepsCount,
    coverage: finalAudit?.metrics || null
  });

  const m = finalAudit && finalAudit.metrics;
  let finalStatusMsg = "🎉 Agent 已完成全轮次填报与复核！";
  if (m) {
    if (m.emptyFieldsCount > 0) {
      const retryable = (finalAudit.unfilledFields || []).filter(u => u.actionability === "agent_retryable");
      const manual = (finalAudit.unfilledFields || []).filter(u => u.actionability === "manual_or_missing_source");
      const unNames = retryable.slice(0, 3).map(u => u.label).join("、");
      const retryText = retryable.length ? `仍有 ${retryable.length} 项可继续优化${unNames ? `（如：${unNames}）` : ""}` : "无可自动填充字段";
      const manualText = manual.length ? `；${manual.length} 项缺少简历数据/附件，需人工处理` : "";
      finalStatusMsg = `✓ Agent 已填入 ${m.filledFieldsCount} 项 (填充率 ${m.fillRatePercent}%)！${retryText}${manualText}。`;
    } else {
      finalStatusMsg = `🎉 恭喜！整页 ${m.totalFieldsCount} 项表单已 100% 全部填报与核验完成！`;
    }
  }

  await new Promise(resolve => chrome.tabs.sendMessage(tabId, { action: "agentSetRouteGuard", active: false }, () => resolve()));
  emitStatus({ phase: "finished", round: roundsExecuted, message: finalStatusMsg });
  return { status: terminationReason === "security_challenge" || terminationReason === "planner_requested_human" ? "paused_for_human" : "finished", sessionId, round: roundsExecuted, coverage: finalAudit, terminationReason };
}

async function handleCallLLM({ prompt, systemPrompt, jsonMode = false, meta = {}, apiConfig: payloadCfg }, sender = {}) {
  const startTime = Date.now();
  // 优先使用直接传入的实时配置，否则从 storage 读取
  let apiConfig = payloadCfg;
  if (!apiConfig || !apiConfig.apiKey) {
    const storage = await chrome.storage.local.get("apiConfig");
    apiConfig = (storage && storage.apiConfig) || payloadCfg || {};
  }

  const rawKey = String(apiConfig.apiKey || "").trim();
  const cleanKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();

  if (!cleanKey) {
    const errMsg = "未检测到有效 API Key。请在侧边栏或悬浮卡片的【接口设置】中输入你的 API Key！";
    await appendAgentLog({
      action: meta.action || "callLLM",
      url: sender.url || meta.url || "unknown",
      status: "error",
      error: errMsg,
      durationMs: 0
    });
    throw new Error(errMsg);
  }

  apiConfig = { ...apiConfig, apiKey: cleanKey };
  const protocol = apiConfig.protocol || "openai";
  const baseUrl = (apiConfig.baseUrl || (protocol === "typesafe" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1")).replace(/\/$/, "");
  const model = apiConfig.model || (protocol === "typesafe" ? "typesafe/jev-1.13" : (protocol === "claude" ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini"));

  // 设置 25 秒超时控制器，防止网络或中转服务卡死挂起
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let content = "";
    if (protocol === "openai") {
      const url = `${baseUrl}/chat/completions`;
      const reqBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt || "你是一个精通网页表单结构与简历数据对齐的专家助手。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.1
      };

      if (jsonMode && (baseUrl.includes("openai.com") || model.includes("gpt-4"))) {
        reqBody.response_format = { type: "json_object" };
      }

      let res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });

      // 如果因 response_format 导致 400，自动去除重试一次
      if (!res.ok && jsonMode && reqBody.response_format && res.status === 400) {
        console.warn("[ResumeFiller LLM] 400 降级重试 (移除 response_format)...");
        delete reqBody.response_format;
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify(reqBody),
          signal: controller.signal
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[ResumeFiller LLM] API 响应错误 [${res.status}]:`, errText);
        throw new Error(`API 调用失败 [${res.status}]: ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content.trim() : "";
    } else if (protocol === "claude") {
      const url = `${baseUrl}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiConfig.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system: systemPrompt || "",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[ResumeFiller LLM] Claude API 错误 [${res.status}]:`, errText);
        throw new Error(`Claude API 调用失败 [${res.status}]: ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      content = data.content && data.content[0] ? data.content[0].text.trim() : "";
    } else if (protocol === "typesafe") {
      content = await handleTypeSafeJevCall({
        prompt,
        systemPrompt,
        meta,
        apiConfig: { ...apiConfig, baseUrl, model },
        signal: controller.signal
      });
    } else {
      throw new Error(`不支持的协议类型: ${protocol}`);
    }
    const duration = Date.now() - startTime;
    console.log(`[ResumeFiller LLM] 响应成功 (耗时: ${duration}ms) ->`, content.slice(0, 80) + "...");

    // 记录 Agent 分析日志
    await appendAgentLog({
      action: meta.action || "callLLM",
      url: sender.url || meta.url || "unknown",
      elementMeta: meta.element || null,
      model,
      durationMs: duration,
      rawOutput: content,
      status: "success"
    });

    return content;
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err.name === "AbortError" ? "大模型响应超时 (25s)，请检查网络连接或 API 服务状态" : (err.message || String(err));

    await appendAgentLog({
      action: meta.action || "callLLM",
      url: sender.url || meta.url || "unknown",
      elementMeta: meta.element || null,
      model,
      durationMs: duration,
      status: "error",
      error: errorMsg
    });

    throw new Error(errorMsg);
  } finally {
    clearTimeout(timeoutId);
  }
}



// --- [src/background/05_jev_adapter.js] ---
// ==================== TypeSafe AI / OpenRouter (Jev System-One) 专精决策模型适配器 ====================
const JEV_SLOT_CRITERIA = {
  "basic.name": "Candidate full real name (姓名)",
  "basic.lastName": "Candidate family name / surname (姓氏)",
  "basic.firstName": "Candidate given name (名字)",
  "basic.gender": "Gender / sex (性别 男/女)",
  "basic.birth": "Date of birth / birthday (出生日期/生日)",
  "basic.phone": "Mobile phone number (手机号码/联系电话)",
  "basic.email": "Email address (电子邮箱)",
  "basic.idCard": "ID card number / passport (身份证号/证件号码)",
  "basic.ethnicity": "Ethnicity / nationality group (民族)",
  "basic.political": "Political status (政治面貌 党员/团员/群众)",
  "basic.city": "Current living city (现居城市/所在城市)",
  "basic.nativePlace": "Native place / hukou / birth place (籍贯/户籍所在地/生源地)",
  "basic.residence": "Detailed current living address (现居详细地址/通信地址)",
  "basic.wechat": "WeChat ID (微信号)",
  "basic.website": "Personal website / portfolio URL (个人网站/作品集)",
  "basic.github": "GitHub profile link (GitHub主页)",
  "basic.jobIntent": "Job intention / applied position (求职意向/期望职位)",
  "basic.highestDegree": "Highest education degree (最高学历)",
  "basic.emergencyContact": "Emergency contact name (紧急联系人姓名)",
  "basic.emergencyRelation": "Emergency contact relationship (与紧急联系人关系)",
  "basic.emergencyPhone": "Emergency contact phone (紧急联系人电话)",
  "basic.selfEval": "Self evaluation / personal summary (自我评价/个人总结)",
  "basic.selfDescription": "Personal traits / self description (自我描述)",
  "basic.workYears": "Years of work experience (工作年限/工作经验)",
  "basic.availableTime": "Available start / onboarding time (到岗时间/入职时间)",
  "basic.expectedSalary": "Expected monthly salary before tax (期望月薪/期望薪资)",
  "basic.currentSalary": "Current monthly salary (现月薪/目前月薪)",
  "basic.jobIndustry": "Expected industry (期望从事行业/意向行业)",
  "education.0.school": "1st (Highest) education university/school name (最高学历毕业院校)",
  "education.0.degree": "1st (Highest) education degree level (最高学历学位 硕士/本科/博士)",
  "education.0.major": "1st (Highest) education major (最高学历所学专业)",
  "education.0.department": "1st education college/department (最高学历学院/院系)",
  "education.0.start": "1st education start date (最高学历入学时间)",
  "education.0.end": "1st education graduation/end date (最高学历毕业时间)",
  "education.0.gpa": "1st education GPA / rank (成绩绩点/排名)",
  "education.0.supervisor": "1st education advisor/supervisor (导师姓名)",
  "education.0.role": "1st education student/campus role (在校担任职务)",
  "education.0.roleDescription": "1st education student role description (职务描述/学生工作描述)",
  "education.0.researchDirection": "Research direction (研究方向)",
  "education.1.school": "2nd (Bachelor/Undergraduate) education school name (第二段/本科学校名称)",
  "education.1.degree": "2nd education degree (本科学历学位)",
  "education.1.major": "2nd education major (本科专业)",
  "education.1.start": "2nd education start date (本科入学时间)",
  "education.1.end": "2nd education graduation date (本科毕业时间)",
  "internship.0.company": "1st internship/work company name (第一段实习/工作单位名称)",
  "internship.0.position": "1st internship job title/position (第一段实习职位/岗位)",
  "internship.0.start": "1st internship start date (入职时间)",
  "internship.0.end": "1st internship end date (离职时间)",
  "internship.0.desc": "1st internship responsibilities and achievements (工作内容/职责描述)",
  "internship.1.company": "2nd internship/work company name (第二段实习公司名称)",
  "internship.1.position": "2nd internship position (第二段实习职位)",
  "internship.1.desc": "2nd internship description (第二段实习职责)",
  "project.0.name": "1st project name (第一个项目名称)",
  "project.0.role": "1st project role (项目担任角色)",
  "project.0.link": "1st project link/demo/repository URL (项目链接/项目地址)",
  "project.0.desc": "1st project description (项目描述/背景)",
  "project.0.duty": "1st project responsibility (项目个人职责)",
  "project.0.result": "1st project achievement (项目成果)",
  "project.1.name": "2nd project name (第二个项目名称)",
  "project.1.desc": "2nd project description (第二个项目描述)",
  "skills": "Professional IT/technical skills (专业技能/技术栈)",
  "languages": "Foreign language proficiency (外语能力/英语等级)",
  "honors.0.name": "1st award / honor name (荣誉奖项名称)",
  "honors.0.desc": "1st award / honor description (奖项描述/获奖说明)",
  "skip": "Unrelated field, already filled, or no matching resume slot"
};

async function handleTypeSafeJevCall({ prompt, systemPrompt, meta = {}, apiConfig, signal }) {
  const rawBaseUrl = (apiConfig.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const isOpenRouter = rawBaseUrl.includes("openrouter.ai");
  const rawModel = (apiConfig.model || (isOpenRouter ? "typesafe/jev-1.13" : "jev-latest")).trim();

  // 自动对齐模型名称前缀：OpenRouter 要求 "typesafe/jev-1.13"，官方要求 "jev-1.13" 或 "jev-latest"
  let model = rawModel;
  if (isOpenRouter) {
    if (!model.startsWith("typesafe/")) {
      model = model === "jev-latest" ? "typesafe/jev-1.13" : `typesafe/${model}`;
    }
  } else if (rawBaseUrl.includes("typesafe.ai")) {
    if (model.startsWith("typesafe/")) {
      model = model.replace(/^typesafe\//, "");
    }
  }

  // OpenRouter 与 TypeSafe 官方均使用 /systemone 端点处理 System-One 决策请求
  const url = rawBaseUrl.endsWith("/systemone") ? rawBaseUrl : `${rawBaseUrl}/systemone`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiConfig.apiKey}`
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://github.com/Suara17/resume-filler-extension";
    headers["X-Title"] = "OfferGo";
  }

  // 场景 A: 握手连通性测试 (Test Ping)
  if (meta.action === "test_ping" || meta.action === "test_connection") {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: "TypeSafe AI Jev connectivity handshake test",
        questions: {
          handshake: {
            type: "noul",
            instructions: "Is this API service online and healthy?"
          }
        }
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 402 || res.status === 403) {
        throw new Error(`额度不足或 API Key 无效 [${res.status}]: ${errText.slice(0, 120)}`);
      }
      throw new Error(`Jev 连接失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    return `pong (Jev System-One 在线, 网关: ${isOpenRouter ? "OpenRouter" : "TypeSafe Official"}, 模型: ${data.model || model})`;
  }

  // 场景 B: 网页单字段 AI 深度重诊 (Single Refine)
  if (meta.action === "single_refine") {
    const el = meta.element || {};
    const stateText = `Field: ${el.tag || "input"}, Type: ${el.type || "text"}, Labels: ${(el.clues || []).join(" ")}, Placeholder: ${el.placeholder || ""}, Breadcrumb: ${el.breadcrumb || ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: stateText,
        questions: {
          slot: {
            type: "choice",
            instructions: "Select the most accurate resume slot for this form field.",
            criteria: JEV_SLOT_CRITERIA
          }
        }
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev 重诊失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const chosenSlot = data.answers?.slot?.choice;
    const confidence = data.answers?.slot?.confidence || 0.95;

    if (chosenSlot && chosenSlot !== "skip") {
      return JSON.stringify({
        slot: chosenSlot,
        confidence,
        reason: `Jev System-One 决策对齐 (置信度: ${Math.round(confidence * 100)}%)`
      });
    }
    return JSON.stringify({ slot: "unknown", confidence: 0.5, reason: "Jev 未匹配到可靠槽位" });
  }

  // 场景 C: 多轮 Agent 并行决策步进 (Agent ReAct Step - 单次请求并行决策整页未填字段)
  if (meta.action === "agent_react_step") {
    const questions = {};
    const fieldMetaMap = {};

    // 从 prompt (State DSL) 中提取所有 status="empty" 的待填字段 (每轮最多并行评估 8 个)
    const emptyRegex = /\[(rf_fid_[^\]]+)\]\s*<(\w+)\s+type="([^"]*)"\s+label="([^"]*)"\s+section="([^"]*)"\s+status="empty"([^>]*)\/>/g;
    let match;
    let count = 0;
    while ((match = emptyRegex.exec(prompt)) !== null && count < 8) {
      const [, fid, tag, type, label, section, extra] = match;
      const isCombobox = extra.includes('role="combobox"') || tag === "select";
      fieldMetaMap[fid] = { fid, tag, type, label, section, isCombobox };
      questions[fid] = {
        type: "choice",
        instructions: `Map web form field [${fid}] (label="${label}", section="${section}", type="${type}") to the matching candidate resume slot, or 'skip' if unrelated.`,
        criteria: JEV_SLOT_CRITERIA
      };
      count++;
    }

    // 提取结构性添加按钮 (如 + 添加教育背景)
    const btnRegex = /\[(Btn_rf_fid_[^\]]+)\]\s*<button[^>]*section="([^"]*)"[^>]*>([^<]+)<\/button>/g;
    const btnMetaMap = {};
    let btnMatch;
    while ((btnMatch = btnRegex.exec(prompt)) !== null) {
      const [, btnId, sec, btnText] = btnMatch;
      btnMetaMap[btnId] = { btnId, sec, btnText };
      questions[btnId] = {
        type: "noul",
        instructions: `Does the candidate have multiple ${sec} records in summary that are not yet filled on the page, requiring us to click button "${btnText}"?`
      };
    }

    // 如果没有提取到具体问题，添加一个主决策探针
    if (Object.keys(questions).length === 0) {
      questions["isDone"] = {
        type: "noul",
        instructions: "Are all form fields already filled and complete?"
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: prompt.slice(0, 7500),
        questions
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev Agent 决策失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const answers = data.answers || {};
    const steps = [];

    // 1. 解析字段映射结果
    for (const [fid, fMeta] of Object.entries(fieldMetaMap)) {
      const ans = answers[fid];
      const chosen = ans?.choice;
      const conf = ans?.confidence ?? 0.9;
      if (chosen && chosen !== "skip" && conf >= 0.55) {
        if (fMeta.isCombobox) {
          steps.push({
            action: "solve_combobox",
            fieldId: fid,
            sourceSlot: chosen,
            reason: `Jev 决策搜索选择「${fMeta.label}」-> ${chosen}`
          });
        } else {
          steps.push({
            action: "fill_slot",
            fieldId: fid,
            slot: chosen,
            reason: `Jev 决策填入「${fMeta.label}」-> ${chosen}`
          });
        }
      }
    }

    // 2. 解析新增经历卡片按钮结果
    for (const [btnId, bMeta] of Object.entries(btnMetaMap)) {
      const ans = answers[btnId];
      if (ans && (ans.noul || 0) >= 0.65) {
        steps.push({
          action: "click_button",
          buttonId: btnId,
          reason: `Jev 决策点击「${bMeta.btnText}」扩充卡片`
        });
        break; // 每次点一个添加按钮
      }
    }

    return JSON.stringify({
      thought: `Jev 并行决策完成：评估 ${Object.keys(questions).length} 项，生成 ${steps.length} 个精准动作`,
      currentSection: "Jev并行决策引擎",
      steps
    });
  }

  throw new Error("TypeSafe Jev 是 System-One 决策模型，不支持开放式长文本生成。请在配置中切换为 OpenAI 兼容协议处理简历文本润色。");
}


