// ==================== 第三方大模型 API 配置与调用 ====================
let apiConfig = {
  protocol: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini"
};

// 从 Storage 加载 API 配置
function loadApiConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("apiConfig", (result) => {
        if (result.apiConfig) {
          apiConfig = result.apiConfig;
        }
        resolve();
      });
    } else {
      const local = localStorage.getItem("apiConfig");
      if (local) apiConfig = JSON.parse(local);
      resolve();
    }
  });
}

// 保存 API 配置到 Storage
function saveApiConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ apiConfig }, () => {
      showToast("接口配置保存成功");
    });
  } else {
    localStorage.setItem("apiConfig", JSON.stringify(apiConfig));
    showToast("接口配置保存成功");
  }
}

// 填充 API 配置表单
function fillApiConfigForm() {
  const protocolEl = document.getElementById("ai-protocol");
  const baseUrlEl = document.getElementById("ai-base-url");
  const apiKeyEl = document.getElementById("ai-api-key");
  const modelEl = document.getElementById("ai-model");
  const typesafeTip = document.getElementById("typesafe-tip");
  
  if (protocolEl) protocolEl.value = apiConfig.protocol || "openai";
  if (baseUrlEl) baseUrlEl.value = apiConfig.baseUrl || "https://api.openai.com/v1";
  if (apiKeyEl) apiKeyEl.value = apiConfig.apiKey || "";
  if (modelEl) modelEl.value = apiConfig.model || "gpt-4o-mini";
  if (typesafeTip) typesafeTip.style.display = (apiConfig.protocol === "typesafe") ? "block" : "none";

  if (protocolEl && !protocolEl.hasAttribute("data-bound-change")) {
    protocolEl.setAttribute("data-bound-change", "true");
    protocolEl.addEventListener("change", () => {
      const p = protocolEl.value;
      if (typesafeTip) typesafeTip.style.display = (p === "typesafe") ? "block" : "none";
      if (p === "typesafe") {
        if (baseUrlEl && (!baseUrlEl.value || baseUrlEl.value.includes("openai.com") || baseUrlEl.value.includes("anthropic.com"))) {
          baseUrlEl.value = "https://openrouter.ai/api/v1";
        }
        if (modelEl && (!modelEl.value || modelEl.value.includes("gpt") || modelEl.value.includes("claude"))) {
          modelEl.value = "typesafe/jev-1.13";
        }
        if (apiKeyEl && !apiKeyEl.value) apiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...) 或 TypeSafe Key";
      } else if (p === "openai") {
        if (baseUrlEl && (baseUrlEl.value.includes("typesafe.ai") || baseUrlEl.value.includes("openrouter.ai"))) {
          baseUrlEl.value = "https://api.openai.com/v1";
        }
        if (modelEl && modelEl.value.includes("jev")) {
          modelEl.value = "gpt-4o-mini";
        }
        if (apiKeyEl) apiKeyEl.placeholder = "输入你的 API Key";
      } else if (p === "claude") {
        if (baseUrlEl && (baseUrlEl.value.includes("typesafe.ai") || baseUrlEl.value.includes("openai.com") || baseUrlEl.value.includes("openrouter.ai"))) {
          baseUrlEl.value = "https://api.anthropic.com/v1";
        }
        if (modelEl && (modelEl.value.includes("jev") || modelEl.value.includes("gpt"))) {
          modelEl.value = "claude-3-5-sonnet-20241022";
        }
        if (apiKeyEl) apiKeyEl.placeholder = "输入你的 Claude API Key";
      }
    });

    document.getElementById("btn-preset-openrouter-jev")?.addEventListener("click", () => {
      if (protocolEl) protocolEl.value = "typesafe";
      if (baseUrlEl) baseUrlEl.value = "https://openrouter.ai/api/v1";
      if (modelEl) modelEl.value = "typesafe/jev-1.13";
      if (apiKeyEl && !apiKeyEl.value) apiKeyEl.placeholder = "填入 OpenRouter 密钥 (sk-or-v1-...)";
      showToast("✓ 已填入 OpenRouter Jev 预设，输入 Key 后点击保存");
    });

    document.getElementById("btn-preset-typesafe-jev")?.addEventListener("click", () => {
      if (protocolEl) protocolEl.value = "typesafe";
      if (baseUrlEl) baseUrlEl.value = "https://api.typesafe.ai/v1";
      if (modelEl) modelEl.value = "jev-latest";
      if (apiKeyEl && !apiKeyEl.value) apiKeyEl.placeholder = "填入 TypeSafe 官方 Key";
      showToast("✓ 已填入 TypeSafe 官方预设");
    });
  }
}
// 统一的 LLM 调用接口，支持 OpenAI 和 Claude 原生协议
async function callLLM(prompt, systemPrompt = "") {
  if (!apiConfig.apiKey) {
    throw new Error("请先在【AI 优化】选项卡中配置并保存你的 API 密钥 (API Key)！");
  }

  const protocol = apiConfig.protocol;
  const baseUrl = apiConfig.baseUrl.replace(/\/$/, "");
  
  if (protocol === "openai") {
    const url = `${baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 错误 (${response.status}): ${errText || response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } else if (protocol === "claude") {
    const url = `${baseUrl}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiConfig.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: apiConfig.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API 错误 (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  } else {
    throw new Error("不支持的 API 协议类型");
  }
}

// 根据 data-ref 精准更新底层数据结构中的字段
function updateResumeDataByRef(ref, value) {
  const parts = ref.split('.');
  if (parts.length === 2 && parts[0] === 'basic') {
    resumeData.basic[parts[1]] = value;
  } else if (ref === 'skills') {
    resumeData.skills = value;
  } else if (parts.length === 3) {
    const section = parts[0];
    const index = parseInt(parts[1], 10);
    const field = parts[2];
    if (resumeData[section] && resumeData[section][index]) {
      resumeData[section][index][field] = value;
    }
  }
}



// 根据 ref 获取值 (支持 basic.xxx, skills, 以及 education.0.school 等复杂路径)
function getValueByRef(ref) {
  if (!ref) return "";
  const parts = ref.split('.');
  if (parts.length === 1) {
    if (ref === 'skills') return resumeData.skills || "";
    return "";
  }
  if (parts.length === 2 && parts[0] === 'basic') {
    return resumeData.basic[parts[1]] || "";
  }
  if (parts.length === 3) {
    const section = parts[0];
    const index = parseInt(parts[1], 10);
    const field = parts[2];
    if (resumeData[section] && resumeData[section][index]) {
      return resumeData[section][index][field] || "";
    }
  }
  return "";
}

// ==================== 多简历版本管理辅助函数 ====================

// 渲染版本下拉框
function renderResumeVersionDropdown() {
  const select = document.getElementById("select-resume-version");
  if (!select) return;
  
  select.innerHTML = "";
  resumesList.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    if (r.id === activeResumeId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// 切换活跃简历版本
function switchResumeVersion(newId) {
  const activeResume = resumesList.find(r => r.id === newId);
  if (!activeResume) return;

  activeResumeId = newId;
  resumeData = mergeWithDefault(activeResume.data, defaultResumeData);

  // 保存当前的活跃 ID 并刷新 UI
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ activeResumeId }, () => {
      console.log("已保存激活的简历 ID");
    });
  } else {
    localStorage.setItem("activeResumeId", activeResumeId);
  }

  fillBasicForm();
  renderAllLists();
  showToast(`已切换至版本: ${activeResume.name}`);
}

// ==================== 赛事经验 & 论文/期刊 渲染 ====================

// 渲染赛事经验列表
function renderCompetitionList() {
  const container = document.getElementById("competition-list");
  if (!container) return;
  container.innerHTML = "";

  if (!resumeData.competition || resumeData.competition.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无赛事经验，请点击下方按钮添加</div>`;
    return;
  }

  resumeData.competition.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">赛事经验 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="competition" data-index="${index}" title="填充本段赛事经历">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="competition" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">赛事名称</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="competition" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="如：挑战杯全国一等奖 / 阿里云开发者大赛">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="competition.${index}.name" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="competition.${index}.name" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="competition" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="如：2023-10">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="competition.${index}.start" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="competition.${index}.start" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="competition" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="如：2023-12">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="competition.${index}.end" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="competition.${index}.end" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">赛事描述 / 取得成果</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="competition" data-index="${index}" data-key="desc" placeholder="简述赛事内容、使用技术、参赛职责以及最终取得的名次等成果...">${item.desc || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="competition.${index}.desc" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="competition.${index}.desc" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="competition.${index}.desc" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 渲染论文/期刊列表
function renderPaperList() {
  const container = document.getElementById("paper-list");
  if (!container) return;
  container.innerHTML = "";

  if (!resumeData.paper || resumeData.paper.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无需文/期刊，请点击下方按钮添加</div>`;
    return;
  }

  resumeData.paper.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">论文/期刊/专利 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="paper" data-index="${index}" title="填充本篇论文/专利">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="paper" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">论文/期刊/专利名称</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="paper" data-index="${index}" data-key="title" value="${item.title || ''}" placeholder="如：一种基于大模型的智能问答方法及系统">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="paper.${index}.title" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="paper.${index}.title" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">发表状态 / 期刊级别 / 专利成果说明</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="paper" data-index="${index}" data-key="result" value="${item.result || ''}" placeholder="如：已发表于 IEEE T-PAMI / 核心期刊在投 / 第一发明人国家发明专利已受理">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="paper.${index}.result" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="paper.${index}.result" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">摘要 / 主要内容描述说明</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="paper" data-index="${index}" data-key="desc" placeholder="简述论文研究课题、解决的核心问题、使用算法、创新点与最终实验结论等...">${item.desc || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="paper.${index}.desc" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="paper.${index}.desc" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="paper.${index}.desc" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
