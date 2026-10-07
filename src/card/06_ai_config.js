// ==================== 悬浮卡片内的 AI 配置与连通性测试 ====================
    const aiProtocolEl = shadow.getElementById("rf-ai-protocol");
    const aiBaseUrlEl = shadow.getElementById("rf-ai-base-url");
    const aiApiKeyEl = shadow.getElementById("rf-ai-api-key");
    const aiModelEl = shadow.getElementById("rf-ai-model");
    const aiSaveBtn = shadow.getElementById("rf-btn-save-ai");
    const aiTestBtn = shadow.getElementById("rf-btn-test-ai");
    const aiTestResult = shadow.getElementById("rf-ai-test-result");

    async function loadFloatingAiConfig() {
      try {
        const storage = await new Promise(r => {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get("apiConfig", r);
          } else {
            r({ apiConfig: JSON.parse(localStorage.getItem("apiConfig") || "{}") });
          }
        });
        const cfg = storage.apiConfig || {};
        const proto = cfg.protocol || "openai";
        if (aiProtocolEl) aiProtocolEl.value = proto;
        if (aiBaseUrlEl) aiBaseUrlEl.value = cfg.baseUrl || (proto === "typesafe" ? "https://api.typesafe.ai/v1" : "https://api.openai.com/v1");
        if (aiApiKeyEl) aiApiKeyEl.value = cfg.apiKey || "";
        if (aiModelEl) aiModelEl.value = cfg.model || (proto === "typesafe" ? "jev-latest" : "gpt-4o-mini");
        const tipEl = shadow.getElementById("rf-typesafe-tip");
        if (tipEl) tipEl.style.display = (proto === "typesafe") ? "block" : "none";
      } catch (e) {}
    }

    if (aiProtocolEl && !aiProtocolEl.hasAttribute("data-bound-proto")) {
      aiProtocolEl.setAttribute("data-bound-proto", "true");
      aiProtocolEl.addEventListener("change", () => {
        const p = aiProtocolEl.value;
        const tipEl = shadow.getElementById("rf-typesafe-tip");
        if (tipEl) tipEl.style.display = (p === "typesafe") ? "block" : "none";
        if (p === "typesafe") {
          if (aiBaseUrlEl && (!aiBaseUrlEl.value || aiBaseUrlEl.value.includes("openai.com") || aiBaseUrlEl.value.includes("anthropic.com"))) {
            aiBaseUrlEl.value = "https://openrouter.ai/api/v1";
          }
          if (aiModelEl && (!aiModelEl.value || aiModelEl.value.includes("gpt") || aiModelEl.value.includes("claude"))) {
            aiModelEl.value = "typesafe/jev-1.13";
          }
          if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...) 或 TypeSafe Key";
        } else if (p === "openai") {
          if (aiBaseUrlEl && (aiBaseUrlEl.value.includes("typesafe.ai") || aiBaseUrlEl.value.includes("openrouter.ai"))) {
            aiBaseUrlEl.value = "https://api.openai.com/v1";
          }
          if (aiModelEl && aiModelEl.value.includes("jev")) {
            aiModelEl.value = "gpt-4o-mini";
          }
        } else if (p === "claude") {
          if (aiBaseUrlEl && (aiBaseUrlEl.value.includes("typesafe.ai") || aiBaseUrlEl.value.includes("openai.com"))) {
            aiBaseUrlEl.value = "https://api.anthropic.com/v1";
          }
          if (aiModelEl && (aiModelEl.value.includes("jev") || aiModelEl.value.includes("gpt"))) {
            aiModelEl.value = "claude-3-5-sonnet-20241022";
          }
        }
      });

      const btnOpenRouterJev = shadow.getElementById("rf-btn-preset-openrouter-jev");
      const btnTypeSafeJev = shadow.getElementById("rf-btn-preset-typesafe-jev");

      btnOpenRouterJev?.addEventListener("click", () => {
        if (aiProtocolEl) aiProtocolEl.value = "typesafe";
        if (aiBaseUrlEl) aiBaseUrlEl.value = "https://openrouter.ai/api/v1";
        if (aiModelEl) aiModelEl.value = "typesafe/jev-1.13";
        if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...)";
        showToast("✓ 已填入 OpenRouter Jev 预设，输入 Key 后点击保存");
      });

      btnTypeSafeJev?.addEventListener("click", () => {
        if (aiProtocolEl) aiProtocolEl.value = "typesafe";
        if (aiBaseUrlEl) aiBaseUrlEl.value = "https://api.typesafe.ai/v1";
        if (aiModelEl) aiModelEl.value = "jev-latest";
        if (aiApiKeyEl && !aiApiKeyEl.value) aiApiKeyEl.placeholder = "填入 TypeSafe 官方 Key";
        showToast("✓ 已填入 TypeSafe 官方预设");
      });
    }
    if (aiSaveBtn) {
      aiSaveBtn.addEventListener("click", async () => {
        const rawKey = aiApiKeyEl ? aiApiKeyEl.value.trim() : "";
        const cleanKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
        const newCfg = {
          protocol: aiProtocolEl ? aiProtocolEl.value : "openai",
          baseUrl: aiBaseUrlEl ? aiBaseUrlEl.value.trim() : "https://api.openai.com/v1",
          apiKey: cleanKey,
          model: aiModelEl ? aiModelEl.value.trim() : "gpt-4o-mini"
        };
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ apiConfig: newCfg });
          }
          localStorage.setItem("apiConfig", JSON.stringify(newCfg));
          showToast("✅ AI 接口配置已保存！", "success");
        } catch(err) {
          showToast("保存失败: " + err.message, "error");
        }
      });
    }

    if (aiTestBtn) {
      aiTestBtn.addEventListener("click", async () => {
        const protocol = aiProtocolEl ? aiProtocolEl.value : "openai";
        const baseUrl = aiBaseUrlEl ? aiBaseUrlEl.value.trim() : "https://api.openai.com/v1";
        const rawKey = aiApiKeyEl ? aiApiKeyEl.value.trim() : "";
        const apiKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
        const model = aiModelEl ? aiModelEl.value.trim() : "gpt-4o-mini";

        if (!apiKey) {
          showToast("请先输入 API Key 再进行测试！", "error");
          if (aiTestResult) {
            aiTestResult.style.display = "block";
            aiTestResult.style.background = "#fee2e2";
            aiTestResult.style.color = "#991b1b";
            aiTestResult.textContent = "❌ 请先填写 API Key！";
          }
          return;
        }

        // 先自动保存当前输入的配置
        const testCfg = { protocol, baseUrl, apiKey, model };
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ apiConfig: testCfg });
        }
        localStorage.setItem("apiConfig", JSON.stringify(testCfg));

        aiTestBtn.textContent = "正在测试...";
        aiTestBtn.disabled = true;
        aiTestBtn.style.opacity = "0.6";
        showToast("⚡ 正在向大模型发送握手测试请求...", "info");

        if (aiTestResult) {
          aiTestResult.style.display = "block";
          aiTestResult.style.background = "#f1f5f9";
          aiTestResult.style.color = "var(--text-secondary)";
          aiTestResult.textContent = "⏳ 正在连接大模型并验证回复...";
        }

        const t0 = Date.now();
        try {
          const resp = await new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                resolve({ success: false, error: "连接测试超时 (15s)" });
              }
            }, 15000);

            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({
                action: "callLLM",
                payload: {
                  prompt: "Hello, this is a connectivity test. Reply with 'pong' directly.",
                  systemPrompt: "You are a test ping bot.",
                  jsonMode: false,
                  apiConfig: testCfg,
                  meta: { action: "test_ping", url: window.location.href }
                }
              }, (res) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(res);
                }
              });
            } else {
              resolve({ success: false, error: "chrome.runtime 不可用" });
            }
          });

          const duration = Date.now() - t0;
          if (resp && resp.success) {
            showToast(`✅ 连接成功！模型响应耗时: ${duration}ms`, "success");
            if (aiTestResult) {
              aiTestResult.style.display = "block";
              aiTestResult.style.background = "#dcfce7";
              aiTestResult.style.color = "#166534";
              aiTestResult.innerHTML = `✅ <b>连接成功！</b> 耗时: <b>${duration}ms</b><br>模型回复: "${(resp.data || '').slice(0, 50)}"`;
            }
          } else {
            const err = resp ? resp.error : "未知错误";
            showToast(`❌ 连接测试失败: ${err}`, "error");
            if (aiTestResult) {
              aiTestResult.style.display = "block";
              aiTestResult.style.background = "#fee2e2";
              aiTestResult.style.color = "#991b1b";
              aiTestResult.innerHTML = `❌ <b>连接失败:</b> ${err}`;
            }
          }
        } catch(err) {
          showToast(`❌ 测试发生异常: ${err.message}`, "error");
          if (aiTestResult) {
            aiTestResult.style.display = "block";
            aiTestResult.style.background = "#fee2e2";
            aiTestResult.style.color = "#991b1b";
            aiTestResult.textContent = "❌ 发生异常: " + err.message;
          }
        } finally {
          aiTestBtn.textContent = "⚡ 测试连接";
          aiTestBtn.disabled = false;
          aiTestBtn.style.opacity = "1";
        }
      });
    }
