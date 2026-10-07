// ==================== 事件初始化 ====================

// 初始化选项卡切换事件
function initTabEvents() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      // 移除当前活动状态
      document.querySelector(".tab-btn.active").classList.remove("active");
      document.querySelector(".tab-panel.active").classList.remove("active");

      // 激活点击的选项卡
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");

      // Tab 切换后延迟调整其中文本框高度（只有显示出来的元素才能计算出正确的 scrollHeight）
      setTimeout(adjustAllTextareas, 20);
    });
  });
}

// 初始化表单即时保存绑定
function initFormBindings() {
  // 监听基本信息输入框变化
  document.querySelectorAll("[data-key^='basic.']").forEach((input) => {
    input.addEventListener("input", (e) => {
      const key = e.target.getAttribute("data-key").split(".")[1];
      resumeData.basic[key] = e.target.value;
      saveToStorage();
    });
  });

  // 监听技能输入框变化
  const skillsTextarea = document.querySelector("[data-key='skills']");
  if (skillsTextarea) {
    skillsTextarea.addEventListener("input", (e) => {
      resumeData.skills = e.target.value;
      saveToStorage();
    });
  }

  // 监听语言能力输入框变化
  const languagesTextarea = document.querySelector("[data-key='languages']");
  if (languagesTextarea) {
    languagesTextarea.addEventListener("input", (e) => {
      resumeData.languages = e.target.value;
      saveToStorage();
    });
  }

  // 利用事件代理监听动态列表卡片内的输入框变化
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("card-input")) {
      const type = e.target.getAttribute("data-type");
      const index = parseInt(e.target.getAttribute("data-index"), 10);
      const key = e.target.getAttribute("data-key");

      if (resumeData[type] && resumeData[type][index]) {
        resumeData[type][index][key] = e.target.value;
        saveToStorage();
      }
    }
  });

  // 监听所有文本框的输入事件，动态调整高度
  document.addEventListener("input", (e) => {
    if (e.target.tagName === "TEXTAREA" && e.target.classList.contains("form-control")) {
      autoResizeTextarea(e.target);
    }
  });

  // 监听 AI 修改快捷按钮点击（利用事件代理，处理动态增加的卡片）
  document.addEventListener("click", (e) => {
    const aiBtn = e.target.closest(".btn-ai-modify");
    if (aiBtn) {
      const wrapper = aiBtn.closest(".form-input-wrapper");
      if (!wrapper) return;

      // 检查是否已经存在 prompt 输入盒，如果存在则直接移除（起到开关作用）
      let promptBox = wrapper.parentElement.querySelector(".ai-prompt-box");
      if (promptBox) {
        promptBox.remove();
        return;
      }

      // 创建新的 prompt 优化编辑盒子
      promptBox = document.createElement("div");
      promptBox.className = "ai-prompt-box";
      promptBox.style.marginTop = "8px";
      promptBox.style.border = "1px solid var(--primary-color)";
      promptBox.style.borderRadius = "var(--radius-md)";
      promptBox.style.padding = "10px";
      promptBox.style.backgroundColor = "var(--primary-light)";
      promptBox.style.display = "flex";
      promptBox.style.flexDirection = "column";
      promptBox.style.gap = "8px";
      promptBox.style.zIndex = "5";

      promptBox.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--primary-color); display: flex; align-items: center; gap: 4px;">
          <span>🪄 AI 快捷优化本项内容</span>
        </div>
        <textarea class="form-control ai-prompt-input" style="min-height: 50px; font-size: 12px; padding: 6px; background-color: #ffffff;" placeholder="输入优化指令，如：用STAR法则润色 / 翻译成英文 / 突出大模型集成经历..."></textarea>
        <div style="display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm btn-ai-cancel">取消</button>
          <button class="btn btn-primary btn-sm btn-ai-generate">生成优化</button>
        </div>
      `;

      wrapper.insertAdjacentElement("afterend", promptBox);
      const promptInput = promptBox.querySelector(".ai-prompt-input");
      promptInput.focus();

      // 绑定取消按钮
      promptBox.querySelector(".btn-ai-cancel").addEventListener("click", () => {
        promptBox.remove();
      });

      // 绑定生成按钮
      promptBox.querySelector(".btn-ai-generate").addEventListener("click", async () => {
        const instruction = promptInput.value.trim();
        if (!instruction) {
          showToast("请输入优化指令");
          return;
        }

        const textarea = wrapper.querySelector("textarea");
        if (!textarea) return;
        
        const originalText = textarea.value.trim();
        const generateBtn = promptBox.querySelector(".btn-ai-generate");
        const cancelBtn = promptBox.querySelector(".btn-ai-cancel");

        generateBtn.disabled = true;
        generateBtn.textContent = "优化中...";
        cancelBtn.disabled = true;

        try {
          const systemPrompt = "你是一个专业的简历打磨助手。请根据用户的优化指令，润色并修改用户提供的这段简历文本。你需要遵循以下原则：\\n1. 只返回修改后的简历文本本身，不要添加任何解释、导语、Markdown 代码块标记（如 \`\`\`），也不要在前后加引号，直接返回纯文本。\\n2. 保持简历的真实度，不要编造不存在的核心事实（如公司、学校等），只对语言表述进行优化、专业化或按字数精简。\\n3. 如果指令要求翻译为英文，则输出对应的英文表述。";
          const prompt = `优化指令：${instruction}\\n\\n原内容：\\n${originalText || "[空]"}`;

          const optimizedText = await callLLM(prompt, systemPrompt);
          
          // 更新文本框并自适应高度
          textarea.value = optimizedText;
          autoResizeTextarea(textarea);

          // 更新底层数据模型
          const ref = aiBtn.getAttribute("data-ref");
          updateResumeDataByRef(ref, optimizedText);

          saveToStorage();
          showToast("内容优化成功并已保存！");
          promptBox.remove();
        } catch (err) {
          showToast("优化失败：" + err.message);
          console.error(err);
          generateBtn.disabled = false;
          generateBtn.textContent = "生成优化";
          cancelBtn.disabled = false;
        }
      });
    }
  });

  // 启用字段拖拽即填 (HTML5 Drag & Drop)
  document.addEventListener("dragstart", (e) => {
    const input = e.target.closest(".form-control, .btn-fill-field, .card-input");
    if (!input) return;
    let val = "";
    let lbl = "";
    if (input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
      val = input.value || "";
      const group = input.closest(".form-group");
      lbl = (group && group.querySelector(".form-label") ? group.querySelector(".form-label").textContent : "").trim();
    } else if (input.classList.contains("btn-fill-field")) {
      const ref = input.getAttribute("data-ref");
      val = getValueByRef(ref);
      lbl = ref;
    }
    if (val) {
      e.dataTransfer.setData("application/x-resume-field", JSON.stringify({ label: lbl, value: val }));
      e.dataTransfer.setData("text/plain", val);
      e.dataTransfer.effectAllowed = "copy";
    }
  });
}

// 初始化列表操作事件 (添加 / 删除)
function initListActionEvents() {
  // 添加教育背景
  document.getElementById("btn-add-education").addEventListener("click", () => {
    resumeData.education.push({ school: "", degree: "", major: "", start: "", end: "", gpa: "", supervisor: "", role: "", roleDescription: "", majorDescription: "", thesisTopic: "", courses: "", researchDirection: "", department: "", labExperience: "", studentId: "", schoolLocation: "" });
    saveToStorage();
    renderEducationList();
    showToast("已新增一段教育经历");
  });

  // 添加工作实习
  document.getElementById("btn-add-internship").addEventListener("click", () => {
    resumeData.internship.push({
      company: "",
      position: "",
      start: "",
      end: "",
      desc: "",
      witness: "有",
      witnessName: "",
      witnessRelation: "",
      witnessPosition: "",
      witnessCompany: "",
      witnessPhone: ""
    });
    saveToStorage();
    renderInternshipList();
    showToast("已新增一段工作实习经历");
  });

  // 添加家庭成员
  document.getElementById("btn-add-family")?.addEventListener("click", () => {
    if (!resumeData.family) resumeData.family = [];
    resumeData.family.push({
      relation: "",
      name: "",
      age: "",
      political: "",
      company: "",
      department: "",
      position: "",
      phone: ""
    });
    saveToStorage();
    renderFamilyList();
    showToast("已新增家庭成员记录");
  });

  // 添加项目经历
  document.getElementById("btn-add-project").addEventListener("click", () => {
    resumeData.project.push({ name: "", link: "", role: "", start: "", end: "", desc: "", duty: "", result: "", tech: "" });
    saveToStorage();
    renderProjectList();
    showToast("已新增一段项目经历");
  });

  // 添加荣誉奖项
  document.getElementById("btn-add-honor").addEventListener("click", () => {
    resumeData.honors.push({ name: "", date: "", level: "", desc: "" });
    saveToStorage();
    renderHonorsList();
    showToast("已新增一段荣誉奖项");
  });

  // 添加赛事经验
  document.getElementById("btn-add-competition").addEventListener("click", () => {
    resumeData.competition.push({ name: "", start: "", end: "", desc: "" });
    saveToStorage();
    renderCompetitionList();
    showToast("已新增一段赛事经验");
  });

  // 添加论文/期刊/专利
  document.getElementById("btn-add-paper").addEventListener("click", () => {
    resumeData.paper.push({ title: "", desc: "", result: "" });
    saveToStorage();
    renderPaperList();
    showToast("已新增一篇论文/期刊/专利");
  });

  // 删除卡片逻辑（使用事件代理）
  document.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".btn-delete-card");
    if (deleteBtn) {
      const type = deleteBtn.getAttribute("data-type");
      const index = parseInt(deleteBtn.getAttribute("data-index"), 10);
      
      if (confirm(`确定要删除此项内容吗？`)) {
        resumeData[type].splice(index, 1);
        saveToStorage();
        if (type === "education") renderEducationList();
        if (type === "internship") renderInternshipList();
        if (type === "project") renderProjectList();
        if (type === "honors") renderHonorsList();
        if (type === "competition") renderCompetitionList();
        if (type === "paper") renderPaperList();
        if (type === "family") renderFamilyList();
        showToast("已删除对应内容");
      }
    }
  });
}

// 初始化系统操作事件 (导入/导出/清空/一键填充等)
function initSystemActionEvents() {
  // 启动 Zero-PII 符号化 Agent 代填 (支持多经历卡片扩增与搜索下拉框求解)
  document.getElementById("btn-agent-autofill")?.addEventListener("click", async () => {
    showToast("🤖 正在启动网申 Agent，开启安全隔离代填...");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showToast("未找到活动网页标签");
        return;
      }
      chrome.runtime.sendMessage({
        action: "startAgentAutofill",
        tabId: tab.id,
        resumeData
      }, (res) => {
        if (chrome.runtime.lastError || (res && !res.success)) {
          const err = chrome.runtime.lastError?.message || res?.error || "执行异常";
          showToast(`Agent 提示: ${err}`);
        } else {
          showToast("✓ Agent 任务已启动，请在网页端查看即时进度");
        }
      });
    } catch (err) {
      showToast("启动异常：" + err.message);
    }
  });

  // 单字段“填充”按钮逻辑
  document.addEventListener("click", async (e) => {
    const fillBtn = e.target.closest(".btn-fill-field");
    if (fillBtn) {
      const ref = fillBtn.getAttribute("data-ref");
      const value = getValueByRef(ref);
      
      if (!value) {
        showToast("字段内容为空，无法填充");
        return;
      }

      await sendMsgToContentScript({
        action: "fillFocusedInput",
        value: value
      });
    }
  });

  // 定向局部段落填充按钮逻辑
  document.addEventListener("click", async (e) => {
    const fillSectionBtn = e.target.closest(".btn-fill-section");
    if (fillSectionBtn) {
      const type = fillSectionBtn.getAttribute("data-type");
      const index = parseInt(fillSectionBtn.getAttribute("data-index"), 10);
      const sectionData = resumeData[type][index];

      if (!sectionData) return;

      await sendMsgToContentScript({
        action: "fillSection",
        type: type,
        data: sectionData
      });
    }
  });

  // 单字段复制按钮逻辑
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".btn-copy");
    if (copyBtn) {
      const ref = copyBtn.getAttribute("data-ref");
      const value = getValueByRef(ref);

      if (value) {
        navigator.clipboard.writeText(value)
          .then(() => showToast("已成功复制到剪贴板"))
          .catch(() => showToast("复制失败，请手动选择复制"));
      } else {
        showToast("内容为空，无法复制");
      }
    }
  });

  // 导出 JSON
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(resumeData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("配置已导出");
  });

  // 点击导入按钮，触发隐藏的文件输入框
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file-input").click();
  });

  // 导入文件逻辑
  document.getElementById("import-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        resumeData = mergeWithDefault(importedData, defaultResumeData);
        saveToStorage();
        fillBasicForm();
        renderAllLists();
        showToast("简历数据导入成功！");
      } catch (err) {
        showToast("导入失败，JSON 格式不正确");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // 重置 input
  });

  // 简历附件上传与清除逻辑
  document.getElementById("btn-upload-attachment")?.addEventListener("click", () => {
    document.getElementById("resume-attachment-file")?.click();
  });

  document.getElementById("resume-attachment-file")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("简历附件大小不能超过 5MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!resumeData.basic) resumeData.basic = {};
      resumeData.basic.resumeAttachment = {
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        dataUrl: event.target.result,
        size: file.size
      };
      saveToStorage();
      fillBasicForm();
      showToast(`✓ 已成功绑定简历附件：${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  document.getElementById("btn-remove-attachment")?.addEventListener("click", () => {
    if (resumeData.basic) resumeData.basic.resumeAttachment = null;
    saveToStorage();
    fillBasicForm();
    showToast("已清除简历附件");
  });

  // 自定义附件库：路径只作为用户参考；实际上传文件必须由用户通过 file picker 显式绑定。
  document.getElementById("btn-import-attachment-config")?.addEventListener("click", () => {
    document.getElementById("attachment-config-file")?.click();
  });
  document.getElementById("attachment-config-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const items = Array.isArray(imported) ? imported : imported.attachments;
        if (!Array.isArray(items)) throw new Error("附件配置必须是数组或包含 attachments 数组");
        const normalized = items.map((item, index) => ({
          id: `attachment_${Date.now()}_${index}`,
          label: String(item.label || item.name || "").trim(),
          keywords: String(item.keywords || "").trim(),
          pathHint: String(item.pathHint || item.path || "").trim(),
          fileName: "", dataUrl: "", mimeType: "", size: 0, updatedAt: ""
        })).filter(item => item.label || item.pathHint);
        resumeData.basic.attachments = normalized;
        saveToStorage();
        renderAttachmentsList();
        showToast(`已导入 ${normalized.length} 条附件配置；请逐项选择文件绑定`);
      } catch (error) {
        showToast("附件配置导入失败：" + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });
  document.getElementById("btn-add-attachment")?.addEventListener("click", () => {
    ensureAttachments().push({ id: `attachment_${Date.now()}`, label: "", keywords: "", pathHint: "", fileName: "", dataUrl: "", mimeType: "", size: 0, updatedAt: "" });
    saveToStorage();
    renderAttachmentsList();
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest(".attachment-input");
    if (!input) return;
    const index = Number.parseInt(input.dataset.index, 10);
    const key = input.dataset.key;
    const item = ensureAttachments()[index];
    if (!item || !key) return;
    item[key] = input.value;
    saveToStorage();
  });

  document.addEventListener("click", (event) => {
    const bindButton = event.target.closest(".btn-bind-attachment");
    if (bindButton) {
      const input = document.querySelector(`.attachment-file-input[data-index="${bindButton.dataset.index}"]`);
      input?.click();
      return;
    }
    const deleteButton = event.target.closest(".btn-delete-attachment");
    if (deleteButton) {
      const index = Number.parseInt(deleteButton.dataset.index, 10);
      ensureAttachments().splice(index, 1);
      saveToStorage();
      renderAttachmentsList();
      showToast("已删除附件配置");
    }
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest(".attachment-file-input");
    if (!input) return;
    const index = Number.parseInt(input.dataset.index, 10);
    const file = input.files?.[0];
    const item = ensureAttachments()[index];
    if (!file || !item) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast("单个附件不能超过 8MB");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      item.fileName = file.name;
      item.mimeType = file.type || "application/octet-stream";
      item.dataUrl = reader.result;
      item.size = file.size;
      item.updatedAt = new Date().toISOString();
      if (!item.pathHint) item.pathHint = `已从文件选择器绑定：${file.name}`;
      saveToStorage();
      renderAttachmentsList();
      showToast(`已绑定附件：${file.name}`);
    };
    reader.readAsDataURL(file);
    input.value = "";
  });
  // 读取本机持久化状态：日志默认只存在插件 storage；可选启动本地监听器额外落盘。
  const renderAgentLogDiagnostics = () => {
    const summary = document.getElementById("agent-log-summary");
    if (!summary) return;
    summary.textContent = "正在读取本机诊断日志状态…";
    const render = (diagnostics) => {
      const latest = diagnostics?.latestSession;
      const count = diagnostics?.storedEntries ?? 0;
      const max = diagnostics?.retentionLimit ?? 300;
      if (!latest) {
        summary.textContent = `本机已保存 ${count}/${max} 条结构化日志；尚无完整 Agent 会话。完成一次 Agent 代填后可导出复盘。`;
        return;
      }
      const metrics = latest.coverageAudit?.metrics;
      const duration = Number.isFinite(latest.durationMs) ? `，耗时 ${(latest.durationMs / 1000).toFixed(1)} 秒` : "";
      const rate = metrics ? `，填充率 ${metrics.fillRatePercent}%` : "";
      summary.textContent = `本机已保存 ${count}/${max} 条日志。最近会话：${latest.sessionSummary?.totalStepsExecuted || 0} 步${duration}${rate}；终止原因：${latest.terminationReason || "未知"}。`;
    };
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: "getAgentLogDiagnostics" }, (res) => {
        if (chrome.runtime.lastError || !res?.success) {
          summary.textContent = "诊断状态读取失败；仍可直接导出插件本地日志。";
          return;
        }
        render(res.diagnostics);
      });
      return;
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get("rf_agent_debug_logs", (res) => render({ storedEntries: (res.rf_agent_debug_logs || []).length, retentionLimit: 300 }));
    }
  };
  document.getElementById("btn-refresh-agent-logs")?.addEventListener("click", renderAgentLogDiagnostics);
  renderAgentLogDiagnostics();
  // 导出 Agent 诊断与填充率审计日志 (供其他 Agent 分析改进)
  document.getElementById("btn-export-agent-logs")?.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("rf_agent_debug_logs", (res) => {
        const logs = res.rf_agent_debug_logs || [];
        if (logs.length === 0) {
          showToast("暂无已记录的审计日志，请先在网申页面运行一次填充");
          return;
        }
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `agent_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✓ 已导出 ${logs.length} 条审计与轨迹日志！`);
        renderAgentLogDiagnostics();
      });
    } else {
      showToast("请在 Chrome 插件环境中导出");
    }
  });

  document.getElementById("btn-clear-agent-logs")?.addEventListener("click", () => {
    if (confirm("确定要清空后台已记录的 Agent 诊断审计日志吗？")) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove("rf_agent_debug_logs", () => {
          showToast("已清空审计日志");
          renderAgentLogDiagnostics();
        });
      }
    }
  });
  // AI 纯文本简历一键提取逻辑
  const extractModal = document.getElementById("ai-extract-modal");
  document.getElementById("btn-ai-extract")?.addEventListener("click", () => {
    if (extractModal) extractModal.style.display = "flex";
  });
  document.getElementById("btn-close-extract-modal")?.addEventListener("click", () => {
    if (extractModal) extractModal.style.display = "none";
  });
  document.getElementById("btn-cancel-extract")?.addEventListener("click", () => {
    if (extractModal) extractModal.style.display = "none";
  });

  document.getElementById("btn-do-ai-extract")?.addEventListener("click", async () => {
    const text = document.getElementById("ai-extract-text")?.value.trim();
    if (!text) {
      showToast("请先粘贴你的简历文本内容");
      return;
    }

    const btn = document.getElementById("btn-do-ai-extract");
    btn.disabled = true;
    btn.textContent = "AI 正在结构化提取中...";

    try {
      const systemPrompt = `你是一个专业的求职简历数据结构化提取专家。
请将用户提供的原始简历文本，精准提取并填入到以下标准求职简历 JSON 模板中。
必须严格直接返回纯 JSON 格式，严禁输出任何额外废话、Markdown 代码块反引号。缺失字段保持空字符串 "" 或空数组 []。
【目标 JSON 结构标准】:
${JSON.stringify(defaultResumeData, null, 2)}`;

      const responseText = await callLLM(text, systemPrompt);
      let cleaned = responseText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
      }

      let parsed = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error("大模型返回格式不是合法 JSON");
      }

      if (parsed && typeof parsed === "object") {
        resumeData = mergeWithDefault(parsed, defaultResumeData);
        saveToStorage();
        fillBasicForm();
        renderAllLists();
        if (extractModal) extractModal.style.display = "none";
        const textarea = document.getElementById("ai-extract-text");
        if (textarea) textarea.value = "";
        showToast("🎉 简历结构化提取完成！已自动填入当前版本！");
      }
    } catch (err) {
      showToast("AI 提取失败：" + err.message);
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "⚡ 开始智能提取与录入";
    }
  });
  // 清空数据
  document.getElementById("btn-clear").addEventListener("click", () => {
    if (confirm("确定要清空所有已保存的简历数据吗？此操作无法恢复！")) {
      resumeData = JSON.parse(JSON.stringify(defaultResumeData));
      saveToStorage();
      fillBasicForm();
      renderAllLists();
      showToast("数据已清空");
    }
  });

  // 保存 API 接口配置
  document.getElementById("btn-save-api-config").addEventListener("click", () => {
    const rawKey = document.getElementById("ai-api-key").value.trim();
    const cleanKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
    apiConfig.protocol = document.getElementById("ai-protocol").value;
    apiConfig.baseUrl = document.getElementById("ai-base-url").value.trim();
    apiConfig.apiKey = cleanKey;
    apiConfig.model = document.getElementById("ai-model").value.trim();

    saveApiConfig();
  });

  // 测试 API 接口配置连通性
  document.getElementById("btn-test-api-config")?.addEventListener("click", async () => {
    const protocol = document.getElementById("ai-protocol")?.value || "openai";
    const baseUrl = document.getElementById("ai-base-url")?.value.trim() || "";
    const rawKey = document.getElementById("ai-api-key")?.value.trim() || "";
    const apiKey = rawKey.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
    const model = document.getElementById("ai-model")?.value.trim() || "";
    const testResultEl = document.getElementById("sidepanel-ai-test-result");
    const testBtn = document.getElementById("btn-test-api-config");

    if (!apiKey) {
      showToast("请先输入 API Key！");
      if (testResultEl) {
        testResultEl.style.display = "block";
        testResultEl.style.background = "#fee2e2";
        testResultEl.style.color = "#991b1b";
        testResultEl.textContent = "❌ 请先填写 API Key！";
      }
      return;
    }

    const testCfg = { protocol, baseUrl, apiKey, model };
    apiConfig = testCfg;
    saveApiConfig();

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = "正在测试...";
    }
    if (testResultEl) {
      testResultEl.style.display = "block";
      testResultEl.style.background = "#f1f5f9";
      testResultEl.style.color = "#475569";
      testResultEl.textContent = "⏳ 正在向大模型接口发送握手测试...";
    }
    showToast("⚡ 正在向接口发送测试握手...");

    try {
      const resp = await new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve({ success: false, error: "连接测试超时 (15s)，请检查网络或代理" });
          }
        }, 15000);

        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: {
            prompt: "Hello, this is a connectivity test. Reply with 'pong' directly.",
            systemPrompt: "You are a test ping bot.",
            jsonMode: false,
            apiConfig: testCfg,
            meta: { action: "test_ping" }
          }
        }, (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        });
      });

      if (resp && resp.success) {
        if (testResultEl) {
          testResultEl.style.display = "block";
          testResultEl.style.background = "#dcfce7";
          testResultEl.style.color = "#166534";
          testResultEl.textContent = `✓ 握手成功！回复: ${String(resp.data).slice(0, 70)}`;
        }
        showToast("✓ 接口连接测试成功！");
      } else {
        const err = (resp && resp.error) || "未知错误";
        if (testResultEl) {
          testResultEl.style.display = "block";
          testResultEl.style.background = "#fee2e2";
          testResultEl.style.color = "#991b1b";
          testResultEl.textContent = `❌ 测试失败: ${err}`;
        }
        showToast(`测试失败: ${err}`);
      }
    } catch (err) {
      if (testResultEl) {
        testResultEl.style.display = "block";
        testResultEl.style.background = "#fee2e2";
        testResultEl.style.color = "#991b1b";
        testResultEl.textContent = `❌ 异常: ${err.message}`;
      }
      showToast(`测试异常: ${err.message}`);
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = "⚡ 测试连接";
      }
    }
  });

  // 一键对齐优化按钮点击
  document.getElementById("btn-ai-optimize-resume").addEventListener("click", async () => {
    const jdText = document.getElementById("ai-jd-input").value.trim();
    const customPrompt = document.getElementById("ai-custom-prompt").value.trim();

    if (!jdText) {
      showToast("请先粘贴目标岗位的 JD 描述");
      return;
    }

    const optimizeBtn = document.getElementById("btn-ai-optimize-resume");
    optimizeBtn.disabled = true;
    optimizeBtn.textContent = "分析优化中, 请稍候...";

    try {
      const systemPrompt = "你是一位专业的求职招聘顾问。请根据用户提供的目标岗位 JD (Job Description) 以及优化指令，针对性优化用户的简历信息，使其最大限度对齐岗位需求。\\n请直接返回修改后的 JSON 结构，不要包含任何 Markdown 包装（不要用 \`\`\`json 包装，不要有任何解释说明），直接返回一个合法的 JSON 字符串。\\n你需要返回的 JSON 结构只包含你想更新的部分（支持 basic.jobIntent, basic.selfEval 以及 skills 字段）。结构如下：\\n{\\n  \\\"basic\\\": {\\n    \\\"jobIntent\\\": \\\"修改后的求职意向\\\",\\n    \\\"selfEval\\\": \\\"修改后的自我评价内容（结合JD进行润色）\\\"\\n  },\\n  \\\"skills\\\": \\\"修改后的专业技能描述（合理对齐JD要求的技术栈）\\\"\\n}";
      
      const prompt = `【当前简历基本信息】\\n求职意向：\${resumeData.basic.jobIntent || "[空]"}\\n自我评价：\${resumeData.basic.selfEval || "[空]"}\\n\\n【当前简历专业技能】\\n\${resumeData.skills || "[空]"}\\n\\n【目标岗位 JD】\\n\${jdText}\\n\\n【优化要求指令】\\n\${customPrompt || "请根据 JD 针对性润色自我评价与专业技能描述，突出匹配的技术栈和项目职责。"}`;

      const responseText = await callLLM(prompt, systemPrompt);
      
      // 清洗 Markdown 包裹
      let cleanedJson = responseText.trim();
      if (cleanedJson.startsWith("\`\`\`")) {
        cleanedJson = cleanedJson.replace(/^\`\`\`[a-zA-Z]*\\n/, "").replace(/\\n\`\`\`$/, "");
      }
      
      const result = JSON.parse(cleanedJson);
      
      if (result.basic) {
        if (result.basic.jobIntent) resumeData.basic.jobIntent = result.basic.jobIntent;
        if (result.basic.selfEval) resumeData.basic.selfEval = result.basic.selfEval;
      }
      if (result.skills) {
        resumeData.skills = result.skills;
      }

      saveToStorage();
      fillBasicForm();
      adjustAllTextareas();
      
      showToast("简历优化成功！已更新求职意向、自我评价和专业技能！");
    } catch (err) {
      showToast("全局优化失败：" + err.message);
      console.error(err);
    } finally {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = "一键智能对齐优化";
    }
  });

  // 切换简历版本
  document.getElementById("select-resume-version").addEventListener("change", (e) => {
    const newId = e.target.value;
    switchResumeVersion(newId);
  });

  // 新建简历版本 (另存为)
  document.getElementById("btn-resume-add").addEventListener("click", () => {
    const newName = prompt("请输入新简历版本的名称（例如：Java开发版 / AI方向版）：");
    if (!newName) return;
    
    const cleanName = newName.trim();
    if (!cleanName) return;

    // 复制当前活跃的数据
    const copiedData = JSON.parse(JSON.stringify(resumeData));
    const newId = Date.now().toString();

    resumesList.push({
      id: newId,
      name: cleanName,
      data: copiedData
    });

    activeResumeId = newId;
    resumeData = copiedData;

    saveToStorage();
    renderResumeVersionDropdown();
    fillBasicForm();
    renderAllLists();
    showToast(`新建版本并切换成功: ${cleanName}`);
  });

  // 重命名当前简历版本
  document.getElementById("btn-resume-rename").addEventListener("click", () => {
    const activeIdx = resumesList.findIndex(r => r.id === activeResumeId);
    if (activeIdx === -1) return;

    const currentName = resumesList[activeIdx].name;
    const newName = prompt(`请输入简历版本 [${currentName}] 的新名称：`, currentName);
    if (!newName) return;

    const cleanName = newName.trim();
    if (!cleanName || cleanName === currentName) return;

    resumesList[activeIdx].name = cleanName;
    saveToStorage();
    renderResumeVersionDropdown();
    showToast("重命名当前版本成功");
  });

  // 删除当前简历版本
  document.getElementById("btn-resume-delete").addEventListener("click", () => {
    if (resumesList.length <= 1) {
      showToast("必须保留至少一个简历版本！");
      return;
    }

    const activeIdx = resumesList.findIndex(r => r.id === activeResumeId);
    if (activeIdx === -1) return;

    const currentName = resumesList[activeIdx].name;
    if (confirm(`确定要删除简历版本 [${currentName}] 吗？此操作无法恢复！`)) {
      resumesList.splice(activeIdx, 1);
      
      // 切换到第一个剩余版本
      activeResumeId = resumesList[0].id;
      resumeData = mergeWithDefault(resumesList[0].data, defaultResumeData);

      saveToStorage();
      renderResumeVersionDropdown();
      fillBasicForm();
      renderAllLists();
      showToast(`已删除该版本，已自动切换至: ${resumesList[0].name}`);
    }
  });
}
