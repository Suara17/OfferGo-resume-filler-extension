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
  console.log("简历自动填充助手已成功安装！页面悬浮卡片已启用。");
});

// ==================== 专供 Agent 后台分析的结构化诊断日志系统 ====================
async function appendAgentLog(entry) {
  const logItem = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    time: new Date().toISOString(),
    ...entry
  };

  // 1. 在控制台单行输出紧凑 JSON，方便 AI Agent / 自动化脚本捕获
  console.log("[AGENT_DIAGNOSTIC_JSON]: " + JSON.stringify(logItem));

  // 2. 尝试将日志推送到本地 CLI 接收器 (http://127.0.0.1:28888/log)，若未开启则静默忽略
  fetch("http://127.0.0.1:28888/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logItem)
  }).catch(() => {});

  // 3. 在 chrome.storage.local 中持久化保留最近 100 条
  try {
    const storage = await chrome.storage.local.get("rf_agent_debug_logs");
    const logs = storage.rf_agent_debug_logs || [];
    logs.push(logItem);
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    await chrome.storage.local.set({ rf_agent_debug_logs: logs });
  } catch(e) {
    console.warn("记录 Agent 调试日志失败:", e);
  }
}

// ==================== 统一 LLM 调用消息转发 (解决前端页面 CSP/CORS 限制) ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "callLLM") {
    handleCallLLM(request.payload, sender)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // 异步响应
  }
  // 供 CLI 或外部脚本直接查询最近日志
  if (request && request.action === "getAgentLogs") {
    chrome.storage.local.get("rf_agent_debug_logs").then((res) => {
      sendResponse({ success: true, logs: res.rf_agent_debug_logs || [] });
    });
    return true;
  }
});

async function handleCallLLM({ prompt, systemPrompt, jsonMode = false, meta = {} }, sender = {}) {
  const startTime = Date.now();
  // 从 chrome.storage.local 读取用户的 API 配置
  const storage = await chrome.storage.local.get("apiConfig");
  const apiConfig = storage.apiConfig || {
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini"
  };

  if (!apiConfig.apiKey) {
    const errMsg = "未配置 API Key。请在侧边栏【AI 优化】选项卡中配置并保存大模型接口信息！";
    await appendAgentLog({
      action: meta.action || "callLLM",
      url: sender.url || meta.url || "unknown",
      status: "error",
      error: errMsg,
      durationMs: 0
    });
    throw new Error(errMsg);
  }

  const protocol = apiConfig.protocol || "openai";
  const baseUrl = (apiConfig.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = apiConfig.model || (protocol === "claude" ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini");

  console.log(`[ResumeFiller LLM] 发起请求 -> 协议: ${protocol}, 模型: ${model}, 目标: ${baseUrl}`);

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
