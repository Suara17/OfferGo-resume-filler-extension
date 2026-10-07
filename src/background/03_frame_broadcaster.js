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
