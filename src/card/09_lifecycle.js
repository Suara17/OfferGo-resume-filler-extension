// 20. 监听 background 发来的消息 (展开切换 & Agent 状态广播)
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === "toggleFloatingCard" && isTopFrame) {
          if (msg.forceExpand) {
            expandCard();
          } else {
            toggleCard();
          }
        }

        // Agent 状态实时推送到看板
        if (msg && msg.action === "agentStatusUpdate") {
          const agentPanel = shadow.getElementById("rf-agent-status-panel");
          const agentBadge = shadow.getElementById("rf-agent-status-badge");
          const agentMsg = shadow.getElementById("rf-agent-status-msg");
          const agentResumeAction = shadow.getElementById("rf-agent-resume-action");
          const startAgentBtn = shadow.getElementById("rf-btn-start-agent");

          if (agentPanel) {
            agentPanel.classList.remove("rf-hidden");
            agentPanel.style.display = "block";
          }
          if (agentBadge && msg.round !== undefined) {
            agentBadge.textContent = msg.round > 0 ? `第 ${msg.round} 轮` : "预填";
          }
          if (agentMsg && msg.message) {
            agentMsg.textContent = msg.message;
          }

          if (msg.phase === "paused") {
            if (agentResumeAction) agentResumeAction.style.display = "block";
            showToast(msg.message, true);
          } else if (msg.phase === "finished") {
            if (agentResumeAction) agentResumeAction.style.display = "none";
            if (startAgentBtn) {
              startAgentBtn.disabled = false;
              startAgentBtn.style.opacity = "1";
            }
            showToast(msg.message);
            setTimeout(() => {
              if (agentPanel) {
                agentPanel.style.transition = "opacity 0.5s ease";
                agentPanel.style.opacity = "0";
                setTimeout(() => {
                  agentPanel.style.display = "none";
                  agentPanel.style.opacity = "1";
                  agentPanel.style.transition = "";
                }, 500);
              }
            }, 6000);
          }
        }
      });
    }

    // ATS SPA/Hash 路由或动态卡片完成挂载后，重新触发轻量页面分析；不会自动提交。
    window.addEventListener("rf-ats-form-stable", (event) => {
      const detail = event.detail || {};
      if (detail.controlCount === 0) return;
      if (window.ResumeFillerContent?.analyzePageFillCoverage) {
        const audit = window.ResumeFillerContent.analyzePageFillCoverage("ats_stable_rescan", resumeData);
        const retryable = audit.metrics?.actionableUnfilledCount ?? audit.metrics?.emptyFieldsCount ?? 0;
        if (agentMsg && !startAgentBtn?.disabled) agentMsg.textContent = `检测到 ${detail.profileName || detail.profileId} 页面更新：${retryable} 项可检查字段`;
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: "recordFillAudit", audit });
        }
      }
    });
    // 21. 绑定 Agent 启动与断点继续按钮
    const startAgentBtn = shadow.getElementById("rf-btn-start-agent");
    const btnResumeAgent = shadow.getElementById("rf-btn-resume-agent");
    const agentPanel = shadow.getElementById("rf-agent-status-panel");
    const agentMsg = shadow.getElementById("rf-agent-status-msg");
    const agentResumeAction = shadow.getElementById("rf-agent-resume-action");

    startAgentBtn?.addEventListener("click", () => {
      if (agentPanel) {
        agentPanel.classList.remove("rf-hidden");
        agentPanel.style.display = "block";
      }
      if (agentMsg) agentMsg.textContent = "⚡ 正在初始化 Zero-PII 符号化沙箱...";
      startAgentBtn.disabled = true;
      startAgentBtn.style.opacity = "0.7";
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        (async () => {
          if (agentMsg) agentMsg.textContent = "⚡ 正在以本地离线 Agent 状态机推进规划...";
          if (window.ResumeFillerContent && window.ResumeFillerContent.smartFillPage) {
            window.ResumeFillerContent.smartFillPage(resumeData);
          }
          await new Promise((r) => setTimeout(r, 350));
          if (window.ResumeFillerContent && window.ResumeFillerContent.planSymbolicStepsLocally) {
            const steps = window.ResumeFillerContent.planSymbolicStepsLocally(resumeData);
            for (const step of steps) {
              if (agentMsg) agentMsg.textContent = `⚡ 正在执行: ${step.reason || step.action}`;
              await window.ResumeFillerContent.executeSymbolicCommand(step, resumeData);
              await new Promise((r) => setTimeout(r, 200));
            }
          }
          if (agentMsg) agentMsg.textContent = "🎉 本地 Agent 填报与核验完成！";
          startAgentBtn.disabled = false;
          startAgentBtn.style.opacity = "1";
          showToast("🎉 本地 Agent 填报完成！");
        })();
        return;
      }

      chrome.runtime.sendMessage({
        action: "startAgentAutofill",
        resumeData
      }, (res) => {
        startAgentBtn.disabled = false;
        startAgentBtn.style.opacity = "1";
        if (chrome.runtime.lastError || (res && !res.success)) {
          const err = chrome.runtime.lastError?.message || res?.error || "执行异常";
          if (agentMsg) agentMsg.textContent = `❌ Agent 提示: ${err}`;
          showToast(`Agent 执行提示: ${err}`, true);
        }
      });
    });

    btnResumeAgent?.addEventListener("click", () => {
      if (agentResumeAction) agentResumeAction.style.display = "none";
      if (agentMsg) agentMsg.textContent = "▶️ 继续推进 Agent 规划...";
      chrome.runtime.sendMessage({ action: "startAgentAutofill", resumeData });
    });

    const btnCopyAudit = shadow.getElementById("rf-btn-copy-audit");
    btnCopyAudit?.addEventListener("click", () => {
      if (window.ResumeFillerContent && window.ResumeFillerContent.analyzePageFillCoverage) {
        const audit = window.ResumeFillerContent.analyzePageFillCoverage("manual_inspect");
        const jsonStr = JSON.stringify(audit, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
          showToast(`✓ 已复制填充率报告 (${audit.metrics.fillRatePercent}%) 到剪贴板！`);
        }).catch(() => {
          showToast("复制失败，请通过侧边栏导出 JSON");
        });
      }
    });
  }

  // 初始化加载
  loadData().then(() => {
    initEvents();
  });
})();
