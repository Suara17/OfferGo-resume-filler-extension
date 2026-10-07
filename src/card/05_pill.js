// 智能解析任意点击或焦点元素对应的表单输入控件 (全面适配 Moka/AntD/Element/自定义下拉/富文本/图标包裹等复杂结构)
  function resolveTargetControl(el) {
    if (!el) return null;
    try {
      if (el.closest && el.closest("#resume-filler-extension-host")) return null;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return null;

      // 1. 本身是输入控件或富文本
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return el;
      if (el.isContentEditable || (typeof el.getAttribute === "function" && el.getAttribute("contenteditable") === "true")) return el;

      // 2. 向下在子树中查找有效输入框
      if (typeof el.querySelector === "function") {
        const inner = el.querySelector("input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [contenteditable='true']");
        if (inner) return inner;
      }

      // 3. 向上追溯查找（解决点在 label、前置图标、picker 容器、select 箭头、td 等位置）
      let p = el.parentElement;
      let steps = 0;
      while (p && p !== document.body && steps < 5) {
        if (typeof p.querySelector === "function") {
          const inputInParent = p.querySelector("input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [contenteditable='true']");
          if (inputInParent) return inputInParent;
        }
        p = p.parentElement;
        steps++;
      }
    } catch(e) {
      console.error("resolveTargetControl error:", e);
    }
    return null;
  }

  function showPillForInput(inputEl) {
    if (!inputEl) return;
    // 仅在当前页面启用了智能气泡推荐（网申页面或用户白名单）时弹出，日常普通页面不打扰
    if (!isPillEnabled) return;
    const target = resolveTargetControl(inputEl) || inputEl;

    let match = null;
    try {
      if (window.ResumeFillerContent && window.ResumeFillerContent.detectFieldForElement) {
        match = window.ResumeFillerContent.detectFieldForElement(target, resumeData);
      }
    } catch (e) {
      console.error("detectFieldForElement error:", e);
    }

    currentTargetInput = target;
    currentDetectedField = match;

    // 重置重诊按钮状态与内联提示
    if (pillRefineBtn) {
      pillRefineBtn.textContent = "重诊";
      pillRefineBtn.disabled = false;
      pillRefineBtn.style.opacity = "1";
    }
    if (pillAiStatus) {
      pillAiStatus.style.display = "none";
    }

    if (match) {
      if (match.isPassword) {
        pillTag.textContent = "🔑 " + match.label;
        pillVal.textContent = match.ruleHint || "点击自动生成合规密码";
        pillFillBtn.textContent = "⚡ 智能生成并填入";
        pillFillBtn.style.display = "inline-flex";
        if (pillAiIcon) {
          pillAiIcon.textContent = "🔑";
          pillAiIcon.style.color = "#38bdf8";
          pillAiIcon.title = `密码格式要求: ${match.ruleHint || '8-16位，含大小写字母、数字和符号'}`;
        }
        if (pillRefineBtn) pillRefineBtn.style.display = "none";
      } else {
        pillTag.textContent = match.label;
        const previewVal = match.value || "[空]";
        pillVal.textContent = previewVal.length > 18 ? previewVal.slice(0, 16) + "..." : previewVal;
        pillFillBtn.textContent = "↵ 填入";
        pillFillBtn.style.display = "inline-flex";

        if (pillAiIcon) {
          pillAiIcon.textContent = match.isAiMatched ? "●" : "✦";
          pillAiIcon.style.color = match.isAiMatched ? "#38bdf8" : "#818cf8";
          pillAiIcon.title = match.isAiMatched
            ? `大模型语义对齐 (置信度: ${Math.round((match.confidence || 0.95) * 100)}%)\n${match.reason || ''}`
            : "本地规则推断，点击右侧重诊可呼唤大模型精确对齐此框";
        }
        if (pillRefineBtn) {
          pillRefineBtn.style.display = match.isAiMatched ? "none" : "inline-flex";
        }
      }

      pillSuggestions.innerHTML = "";

      // 密码框快捷预设推荐
      if (match.isPassword) {
        // 优先检测当前站点是否已保存过密码备忘
        try {
          const dom = window.location.hostname || "";
          const savedStr = localStorage.getItem("rf_saved_passwords");
          const savedList = savedStr ? JSON.parse(savedStr) : [];
          const matchedSaved = savedList.find(p => p.domain === dom);
          if (matchedSaved && matchedSaved.password) {
            const savedSug = document.createElement("span");
            savedSug.className = "rf-pill-sug-item";
            savedSug.style.cssText = "background: rgba(16, 185, 129, 0.25); color: #34d399; font-weight: 700; border-color: rgba(52, 211, 153, 0.4);";
            savedSug.textContent = `🔖 已存密码 (${matchedSaved.account || '本站'})`;
            savedSug.title = `点击填入本站已保存的密码: ${matchedSaved.account || ''}`;
            savedSug.addEventListener("click", (e) => {
              e.stopPropagation();
              const api = window.ResumeFillerContent;
              if (api && typeof api.fillPasswordToPage === "function") {
                const r = api.fillPasswordToPage(matchedSaved.password);
                if (r && r.success) {
                  showToast(`✓ 已填入本站已保存密码 (${matchedSaved.account || ''})`);
                  hidePill();
                  return;
                }
              }
              if (currentTargetInput && api && typeof api.setElementValue === "function") {
                api.setElementValue(currentTargetInput, matchedSaved.password);
                showToast("✓ 已填入本站密码");
                hidePill();
              }
            });
            pillSuggestions.appendChild(savedSug);
          }
        } catch (_) {}

        const pwdPresets = [
          { label: "8-16位 全字符", rule: "8-16位，包含大写字母、小写字母、数字和特殊符号" },
          { label: "8-20位 字母数字", rule: "8-20位，必须包含大小写字母和数字" },
          { label: "12位 强随机", rule: "12位高强度随机密码，包含大小写、数字及符号" }
        ];
        pwdPresets.forEach((p) => {
          const sugEl = document.createElement("span");
          sugEl.className = "rf-pill-sug-item";
          sugEl.textContent = p.label;
          sugEl.title = `按「${p.rule}」生成密码填入`;
          sugEl.addEventListener("click", async (e) => {
            e.stopPropagation();
            const api = window.ResumeFillerContent;
            if (api && typeof api.generateSmartPassword === "function" && typeof api.fillPasswordToPage === "function") {
              sugEl.textContent = "⏳…";
              const res = await api.generateSmartPassword(p.rule);
              const pwd = res && res.password ? res.password : "P@ssw0rd2026!";
              const r = api.fillPasswordToPage(pwd);
              if (r && r.success) {
                const extra = r.hasConfirm ? "（主密码框 + 确认密码框）" : "";
                showToast(`✓ 已生成并填入：${p.label}！${extra}`);
              }
              hidePill();
            }
          });
          pillSuggestions.appendChild(sugEl);
        });
      }

      // 地区级联一键选择支持
      if (match.isArea && match.value) {
        const autoCascaderBtn = document.createElement("span");
        autoCascaderBtn.className = "rf-pill-sug-item";
        autoCascaderBtn.style.background = "#059669";
        autoCascaderBtn.style.color = "#ffffff";
        autoCascaderBtn.textContent = "⚡ 自动级联选";
        autoCascaderBtn.title = "自动点击展开并选中省市区";
        autoCascaderBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (window.ResumeFillerContent.autoSelectCascaderArea) {
            showToast("正在自动选择地区...");
            await window.ResumeFillerContent.autoSelectCascaderArea(currentTargetInput, match.value);
            showToast("地区选择完成！");
            hidePill();
          }
        });
        pillSuggestions.appendChild(autoCascaderBtn);
      }

      // 渲染拆分候选项
      if (match.suggestions && match.suggestions.length > 0) {
        match.suggestions.slice(0, 4).forEach((sug) => {
          const sugEl = document.createElement("span");
          sugEl.className = "rf-pill-sug-item";
          sugEl.textContent = sug.label;
          sugEl.title = `填入：${sug.value}`;
          sugEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentTargetInput) {
              window.ResumeFillerContent.setElementValue(currentTargetInput, sug.value);
              showToast(`已填入：${sug.label}`);
              hidePill();
            }
          });
          pillSuggestions.appendChild(sugEl);
        });
      }
    } else {
      // 兜底气泡：输入框未命中特定特征时，弹出常用高频选择，绝不让气泡消失！
      pillTag.textContent = "快速选填";
      pillVal.textContent = "点击填入常用项";
      pillFillBtn.style.display = "none";

      pillSuggestions.innerHTML = "";
      const commonQuickList = [
        { label: "姓名", val: resumeData.basic.name },
        { label: "手机", val: resumeData.basic.phone },
        { label: "邮箱", val: resumeData.basic.email },
        { label: "紧急联系人", val: resumeData.basic.emergencyContact },
        { label: "导师", val: (resumeData.education[0] && resumeData.education[0].supervisor) || "" },
        { label: "研究方向", val: (resumeData.education[0] && resumeData.education[0].researchDirection) || "" }
      ].filter(it => it.val);

      commonQuickList.forEach(q => {
        const sugEl = document.createElement("span");
        sugEl.className = "rf-pill-sug-item";
        sugEl.textContent = q.label;
        sugEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (currentTargetInput) {
            window.ResumeFillerContent.setElementValue(currentTargetInput, q.val);
            showToast(`已填入：${q.label}`);
            hidePill();
          }
        });
        pillSuggestions.appendChild(sugEl);
      });
    }

    // 先移除隐藏类，再测量并设置坐标
    inlinePill.classList.remove("rf-pill-hidden");
    updatePillPosition();
  }

  function hidePill() {
    inlinePill.classList.add("rf-pill-hidden");
  }

  // ==================== 事件监听与交互 ====================

  function initEvents() {
    // 1. 就地智能折叠与展开算法 (精准记忆位置，折叠就地变成球，展开从当前位置展开)
    function collapseCard(mousePos) {
      const cardRect = cardModal.getBoundingClientRect();
      const headRect = cardHeader.getBoundingClientRect();
      
      // 目标折叠点：优先使用鼠标位置；若无鼠标位置则使用卡片头部中心
      const targetX = (mousePos && typeof mousePos.x === "number") ? mousePos.x : (headRect.left + 80);
      const targetY = (mousePos && typeof mousePos.y === "number") ? mousePos.y : (headRect.top + 18);

      const btnW = triggerBtn.offsetWidth || 44;
      const btnH = triggerBtn.offsetHeight || 44;

      // 让悬浮球出现并就地吸附在鼠标当前位置 (光标中心)
      let btnLeft = targetX - (btnW / 2);
      let btnTop = targetY - (btnH / 2);

      // 视口边界保护
      btnLeft = Math.max(8, Math.min(window.innerWidth - btnW - 8, btnLeft));
      btnTop = Math.max(8, Math.min(window.innerHeight - btnH - 8, btnTop));

      // 动态设置缩拢动画原点，视觉上卡片朝鼠标位置收缩
      const originX = Math.max(0, Math.min(cardRect.width, targetX - cardRect.left));
      const originY = Math.max(0, Math.min(cardRect.height, targetY - cardRect.top));
      cardModal.style.transformOrigin = `${originX}px ${originY}px`;

      // 应用并记忆悬浮球坐标
      triggerBtn.style.right = "auto";
      triggerBtn.style.bottom = "auto";
      triggerBtn.style.left = `${btnLeft}px`;
      triggerBtn.style.top = `${btnTop}px`;
      localStorage.setItem("rf_trigger_pos", JSON.stringify({ left: btnLeft, top: btnTop }));

      // 切换显示状态
      cardModal.classList.add("rf-hidden");
      triggerBtn.classList.remove("rf-hidden");
      isCardCollapsed = true;
      localStorage.setItem("rf_card_collapsed", "true");
      wakeUpAll();
    }

    function expandCard(pos) {
      wakeUpAll();
      const btnRect = triggerBtn.getBoundingClientRect();
      const cardW = 410;
      const cardH = Math.min(620, window.innerHeight - 30);

      // 展开目标位置：优先使用传进来的坐标(如气泡/鼠标附近)；默认让卡片头部贴合悬浮球位置
      let cardLeft = (pos && typeof pos.x === "number") ? pos.x : btnRect.left;
      let cardTop = (pos && typeof pos.y === "number") ? pos.y : btnRect.top;

      // 如果靠近屏幕右侧，卡片向左侧展开避免出界
      if (cardLeft + cardW > window.innerWidth - 10) {
        cardLeft = Math.max(10, window.innerWidth - cardW - 14);
      }
      // 如果靠近屏幕下方，卡片向上方展开避免出界
      if (cardTop + cardH > window.innerHeight - 10) {
        cardTop = Math.max(10, window.innerHeight - cardH - 14);
      }

      // 视口边界保护
      cardLeft = Math.max(10, Math.min(window.innerWidth - cardW - 10, cardLeft));
      cardTop = Math.max(10, Math.min(window.innerHeight - cardH - 10, cardTop));

      // 动态设置绽放动画原点，卡片从悬浮球当前位置展开
      const originX = Math.max(0, Math.min(cardW, btnRect.left - cardLeft + btnRect.width / 2));
      const originY = Math.max(0, Math.min(cardH, btnRect.top - cardTop + btnRect.height / 2));
      cardModal.style.transformOrigin = `${originX}px ${originY}px`;

      // 应用并记忆卡片坐标
      cardModal.style.right = "auto";
      cardModal.style.bottom = "auto";
      cardModal.style.left = `${cardLeft}px`;
      cardModal.style.top = `${cardTop}px`;
      localStorage.setItem("rf_card_pos", JSON.stringify({ left: cardLeft, top: cardTop }));

      // 切换显示状态
      cardModal.classList.remove("rf-hidden");
      triggerBtn.classList.add("rf-hidden");
      isCardCollapsed = false;
      localStorage.setItem("rf_card_collapsed", "false");
    }

    function toggleCard(expand, mousePos) {
      if (isBlacklisted) {
        triggerBtn.classList.remove("rf-hidden");
      }
      const willExpand = expand !== undefined ? expand : cardModal.classList.contains("rf-hidden");
      if (willExpand) {
        expandCard();
      } else {
        collapseCard(mousePos);
      }
    }

    // 悬浮球单击就地展开
    triggerBtn.addEventListener("click", () => {
      if (!isTriggerDragging) {
        expandCard();
      }
    });

    // 右上角小按钮折叠
    minimizeBtn.addEventListener("click", (e) => {
      collapseCard({ x: e.clientX, y: e.clientY });
    });

    // 单击卡片任意非填写框区域或非功能按钮区域，即可切换到悬浮按钮形式
    cardModal.addEventListener("click", (e) => {
      // 1. 如果刚刚进行了拖动移动卡片位置，不触发折叠
      if (cardJustDragged) return;

      // 2. 如果用户当前在选中文本，避免收起
      const selection = window.getSelection ? window.getSelection().toString().trim() : "";
      if (selection.length > 0) return;

      // 3. 检查点击目标是否属于填写输入框、可复制字段标签、操作按钮或功能控件
      const interactiveEl = e.target.closest([
        "input",
        "textarea",
        "select",
        "button",
        ".rf-form-control",
        ".card-input",
        "[data-copy-ref]",
        ".rf-form-label",
        ".rf-tab-item",
        ".rf-mode-btn",
        ".rf-mode-switch",
        ".rf-select-version",
        ".rf-btn-smart-fill",
        ".rf-btn-add",
        ".btn-delete-card",
        ".rf-footer-link",
        ".rf-icon-btn",
        "#rf-site-menu",
        ".rf-site-menu",
        ".rf-site-menu-item",
        "#rf-toast"
      ].join(","));

      // 如果点击的是具体的功能按钮、选项卡、输入框或复制标签，则正常执行对应功能，不折叠
      if (interactiveEl) return;

      // 否则说明点击的是卡片的空白/背景/间距区域，单击立即收起为悬浮球！
      e.stopPropagation();
      collapseCard({ x: e.clientX, y: e.clientY });
    });

    if (isCardCollapsed) {
      cardModal.classList.add("rf-hidden");
      triggerBtn.classList.remove("rf-hidden");
    } else {
      cardModal.classList.remove("rf-hidden");
      triggerBtn.classList.add("rf-hidden");
    }

    // 2. 标签页切换
    tabsNav.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".rf-tab-item");
      if (!tabBtn) return;
      tabsNav.querySelectorAll(".rf-tab-item").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      const tabId = tabBtn.getAttribute("data-tab");

      shadow.querySelectorAll(".rf-tab-panel").forEach((p) => p.classList.remove("active"));
      const targetPanel = shadow.getElementById(`panel-${tabId}`);
      if (targetPanel) targetPanel.classList.add("active");
      if (tabId === "ai-config") {
        loadFloatingAiConfig();
      }
    });
