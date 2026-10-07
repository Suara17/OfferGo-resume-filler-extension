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
