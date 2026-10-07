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
