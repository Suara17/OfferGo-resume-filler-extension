// 4. 重构核心 1：单击字段标签一键复制 (彻底去除独立复制按钮)
    shadow.addEventListener("click", (e) => {
      const label = e.target.closest("[data-copy-ref]");
      if (label) {
        const ref = label.getAttribute("data-copy-ref");
        const group = label.closest(".rf-form-group, .rf-field-item");
        const siblingInput = group ? group.querySelector(".rf-form-control, .card-input") : null;
        let val = (siblingInput && siblingInput.value !== undefined && siblingInput.value !== "") ? siblingInput.value : getValueByRef(ref);

        if (val) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => {
              const originalHtml = label.innerHTML;
              label.classList.add("rf-copied");
              label.innerHTML = `✓ 已复制`;
              setTimeout(() => {
                label.innerHTML = originalHtml;
                label.classList.remove("rf-copied");
              }, 750);
              showToast(`已复制: ${String(val).slice(0, 15)}...`);
            }).catch(() => {
              const originalHtml = label.innerHTML;
              label.classList.add("rf-copied");
              label.innerHTML = `✓ 已复制`;
              setTimeout(() => {
                label.innerHTML = originalHtml;
                label.classList.remove("rf-copied");
              }, 750);
              showToast(`已复制: ${String(val).slice(0, 15)}...`);
            });
          } else {
            showToast(`已复制: ${String(val).slice(0, 15)}...`);
          }
        } else {
          showToast("该项内容为空");
        }
      }
    });

    // 模式切换函数 (填报模式 vs 修改模式)
    function setEditMode(enable) {
      isEditMode = !!enable;
      if (isEditMode) {
        cardModal.classList.add("rf-mode-edit-active");
        if (modeBtnEdit) modeBtnEdit.classList.add("active");
        if (modeBtnFill) modeBtnFill.classList.remove("active");
        if (modeToggleBtn) {
          modeToggleBtn.textContent = "⚡";
          modeToggleBtn.title = "切换模式 (Alt+E)：当前为【修改模式】，点击切回【填报模式】";
        }
        if (hintText) {
          hintText.innerHTML = "✏️ <b>修改模式</b>：可自由打字、选区修改卡片内容(自动保存)，不触发填入网页";
        }
        showToast("✏️ 已开启【修改模式】：可自由编辑卡片文字，不会触发填入网页！");
      } else {
        cardModal.classList.remove("rf-mode-edit-active");
        if (modeBtnFill) modeBtnFill.classList.add("active");
        if (modeBtnEdit) modeBtnEdit.classList.remove("active");
        if (modeToggleBtn) {
          modeToggleBtn.textContent = "✏️";
          modeToggleBtn.title = "切换模式 (Alt+E)：当前为【填报模式】，点击进入【修改模式】";
        }
        if (hintText) {
          hintText.innerHTML = "💡 <b>填报模式</b>：单击或回车直接填入网页，支持打字修改；单击标签复制";
        }
        showToast("⚡ 已切回【填报模式】：支持打字修改，单击或按回车即可一键填入网页！");
      }
    }

    if (modeToggleBtn) modeToggleBtn.addEventListener("click", () => setEditMode(!isEditMode));
    if (modeBtnFill) modeBtnFill.addEventListener("click", () => setEditMode(false));
    if (modeBtnEdit) modeBtnEdit.addEventListener("click", () => setEditMode(true));

    // 启用字段从卡片拖拽即填 (HTML5 Drag & Drop)
    shadow.addEventListener("dragstart", (e) => {
      const target = e.target.closest(".rf-form-control, .rf-field-label, .rf-pill-tag, .rf-pill-val");
      if (!target) return;
      let val = "";
      let lbl = "";
      if (target.classList.contains("rf-form-control")) {
        val = target.value || "";
        const item = target.closest(".rf-field-item");
        lbl = (item && item.querySelector(".rf-field-label") ? item.querySelector(".rf-field-label").textContent : "").trim();
      } else if (target.classList.contains("rf-field-label")) {
        const ref = target.getAttribute("data-copy-ref");
        val = getValueByRef(ref);
        lbl = target.textContent.trim();
      } else {
        val = target.textContent.trim();
        lbl = "字段";
      }
      if (val) {
        e.dataTransfer.setData("application/x-resume-field", JSON.stringify({ label: lbl, value: val }));
        e.dataTransfer.setData("text/plain", val);
        e.dataTransfer.effectAllowed = "copy";
      }
    });

    // 5. 统一字段填入方法 (支持主 frame 本地直接注入，以及穿透子 iframe 广播注入)
    function fillValueToPage(val, inputEl = null) {
      val = (val !== undefined && val !== null) ? String(val) : "";
      if (!val) {
        showToast("字段内容为空，无法填充");
        return;
      }

      let filled = false;

      // 1. 本地多重优先寻回真实目标输入框 (支持跨组件重新渲染与气泡目标留存)
      let target = (currentTargetInput && document.body && document.body.contains(currentTargetInput)) ? currentTargetInput : null;
      if (!target && window.ResumeFillerContent && window.ResumeFillerContent.getLastActiveElement) {
        target = window.ResumeFillerContent.getLastActiveElement();
      }
      if (!target) {
        const act = document.activeElement;
        if (act && (!act.closest || !act.closest("#resume-filler-extension-host")) && ["INPUT", "TEXTAREA", "SELECT"].includes(act.tagName)) {
          target = act;
        }
      }

      if (target && window.ResumeFillerContent && window.ResumeFillerContent.setElementValue) {
        try {
          window.ResumeFillerContent.setElementValue(target, val);
          filled = true;
          currentTargetInput = target;
        } catch (_) {
          filled = false;
        }
      } else if (window.ResumeFillerContent && window.ResumeFillerContent.fillFocusedInput) {
        try {
          filled = !!window.ResumeFillerContent.fillFocusedInput(val);
        } catch (_) {
          filled = false;
        }
      }

      if (filled) {
        if (inputEl) {
          inputEl.classList.add("rf-fill-pulse");
          setTimeout(() => inputEl.classList.remove("rf-fill-pulse"), 450);
        }
        showToast("✓ 已自动填入网页输入框！");
        return;
      }

      // 2. 主 frame 未找到焦点，尝试广播给子 iframe
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            action: "broadcastToTabFrames",
            payload: { action: "fillFocusedInput", value: val },
            excludeSenderFrame: true
          }, (resp) => {
            if (resp && resp.success && resp.results && resp.results.some((r) => r && r.status === "success")) {
              if (inputEl) {
                inputEl.classList.add("rf-fill-pulse");
                setTimeout(() => inputEl.classList.remove("rf-fill-pulse"), 450);
              }
              showToast("✓ 已自动填入子框架输入框！");
            } else {
              showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(val).catch(() => {});
              }
            }
          });
        } catch (_) {
          showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).catch(() => {});
          }
        }
      } else {
        showToast(`已复制: ${val.slice(0, 15)}... (请先点击网页输入框)`);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).catch(() => {});
        }
      }
    }

    // 单击输入框或其外层包裹容器直接填入网页当前输入框 (修改模式下放行原生打字编辑)
    shadow.addEventListener("click", (e) => {
      let input = e.target.closest(".rf-form-control");
      if (!input) {
        const wrapper = e.target.closest(".rf-input-wrapper");
        if (wrapper) {
          input = wrapper.querySelector(".rf-form-control");
        }
      }
      if (input) {
        if (isEditMode) return;
        fillValueToPage(input.value, input);
      }
    });
    // 填报模式下：输入框打字后按 Enter 键一键填入网页！
    shadow.addEventListener("keydown", (e) => {
      const input = e.target.closest(".rf-form-control");
      if (!input || isEditMode) return;

      if (e.key === "Enter") {
        if (input.tagName === "TEXTAREA" && !e.ctrlKey) {
          return; // 多行文本框默认回车换行，Ctrl+Enter 快捷填入
        }
        e.preventDefault();
        fillValueToPage(input.value, input);
      }
    });

    // 填报模式下：输入框内容打字修改后失焦，自动同步填入网页
    shadow.addEventListener("change", (e) => {
      const input = e.target.closest(".rf-form-control");
      if (!input || isEditMode) return;
      if (input.value) {
        fillValueToPage(input.value, input);
      }
    });
    // 6. 事件代理：定向整段经历填充 (education / internship / project)
    shadow.addEventListener("click", (e) => {
      const fillSecBtn = e.target.closest(".btn-fill-section");
      if (fillSecBtn) {
        const type = fillSecBtn.getAttribute("data-type");
        const index = parseInt(fillSecBtn.getAttribute("data-index"), 10);
        const secData = resumeData[type] && resumeData[type][index];
        if (!secData) return;

        if (window.ResumeFillerContent && window.ResumeFillerContent.fillSection) {
          const success = window.ResumeFillerContent.fillSection(type, secData);
          if (success) {
            showToast("已成功定向填充此段经历！");
          } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: "broadcastToTabFrames",
              payload: { action: "fillSection", type: type, data: secData },
              excludeSenderFrame: true
            }, (resp) => {
              if (resp && resp.success && resp.results && resp.results.some((r) => r && r.status === "success")) {
                showToast("已成功在子框架中定向填充此段经历！");
              } else {
                showToast("请先点击网页中该经历板块的任意输入框");
              }
            });
          } else {
            showToast("请先点击网页中该经历板块的任意输入框");
          }
        }
      }
    });

    // 7. 表单输入自动双向绑定与保存 (基本信息 + 技能)
    let inputSaveDebounceTimer = null;
    shadow.addEventListener("input", (e) => {
      const input = e.target;
      const key = input.getAttribute("data-key");
      if (!key) return;

      if (key.startsWith("basic.")) {
        const subKey = key.split(".")[1];
        resumeData.basic[subKey] = input.value;
      } else if (key === "skills") {
        resumeData.skills = input.value;
      } else if (key === "languages") {
        resumeData.languages = input.value;
      } else if (input.classList.contains("card-input")) {
        const type = input.getAttribute("data-type");
        const index = parseInt(input.getAttribute("data-index"), 10);
        if (resumeData[type] && resumeData[type][index]) {
          resumeData[type][index][key] = input.value;
        }
      }

      clearTimeout(inputSaveDebounceTimer);
      inputSaveDebounceTimer = setTimeout(() => {
        saveData();
      }, 120);
    });

    // 8. 新增各卡片
    shadow.getElementById("rf-btn-add-edu").addEventListener("click", () => {
      resumeData.education.push({
        school: "",
        degree: "",
        major: "",
        start: "",
        end: "",
        gpa: "",
        supervisor: "",
        majorDescription: "",
        thesisTopic: "",
        courses: "",
        researchDirection: "",
        department: "",
        labExperience: "",
        studentId: "",
        schoolLocation: ""
      });
      saveData();
      renderEducationList();
      showToast("已新增一段教育经历");
    });

    shadow.getElementById("rf-btn-add-intern").addEventListener("click", () => {
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
      saveData();
      renderInternshipList();
      showToast("已新增一段工作实习");
    });

    shadow.getElementById("rf-btn-add-family")?.addEventListener("click", () => {
      if (!resumeData.family) resumeData.family = [];
      resumeData.family.push({
        relation: "",
        name: "",
        age: "",
        company: "",
        department: "",
        position: "",
        phone: "",
        political: ""
      });
      saveData();
      renderFamilyList();
      showToast("已新增家庭成员");
    });

    shadow.getElementById("rf-btn-add-proj").addEventListener("click", () => {
      resumeData.project.push({ name: "", role: "", start: "", end: "", tech: "", desc: "", duty: "", result: "" });
      saveData();
      renderProjectList();
      showToast("已新增一段项目经历");
    });

    shadow.getElementById("rf-btn-add-honor").addEventListener("click", () => {
      resumeData.honors.push({ name: "", date: "", level: "", desc: "" });
      saveData();
      renderHonorsList();
      showToast("已新增一段荣誉奖项");
    });

    shadow.getElementById("rf-btn-add-comp").addEventListener("click", () => {
      resumeData.competition.push({ name: "", start: "", end: "", desc: "" });
      saveData();
      renderCompetitionList();
      showToast("已新增一段赛事经验");
    });

    shadow.getElementById("rf-btn-add-paper").addEventListener("click", () => {
      resumeData.paper.push({ title: "", desc: "", result: "" });
      saveData();
      renderPaperList();
      showToast("已新增一篇论文/专利");
    });

    // 9. 删除卡片
    shadow.addEventListener("click", (e) => {
      const delBtn = e.target.closest(".btn-delete-card");
      if (delBtn) {
        const type = delBtn.getAttribute("data-type");
        const index = parseInt(delBtn.getAttribute("data-index"), 10);
        if (confirm("确定要删除此项内容吗？")) {
          resumeData[type].splice(index, 1);
          saveData();
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

    // 10. 切换简历版本
    selectVersion.addEventListener("change", (e) => {
      const newId = e.target.value;
      const targetResume = resumesList.find((r) => r.id === newId);
      if (targetResume) {
        activeResumeId = newId;
        resumeData = mergeWithDefault(targetResume.data, defaultResumeData);
        saveData();
        updateAllViews();
        showToast(`已切换至版本：${targetResume.name}`);
      }
    });

    // 11. 重命名版本
    shadow.getElementById("rf-btn-version-rename").addEventListener("click", () => {
      const cur = resumesList.find((r) => r.id === activeResumeId);
      if (!cur) return;
      const newName = prompt("请输入当前版本的新名称：", cur.name);
      if (newName && newName.trim()) {
        cur.name = newName.trim();
        saveData();
        renderVersionDropdown();
        showToast("版本重命名成功！");
      }
    });

    // 12. 另存为新版本
    shadow.getElementById("rf-btn-version-add").addEventListener("click", () => {
      const newName = prompt("请输入新简历版本名称（如：大模型算法岗 / 前端开发岗）：");
      if (newName && newName.trim()) {
        const newId = "resume_" + Date.now();
        resumesList.push({
          id: newId,
          name: newName.trim(),
          data: JSON.parse(JSON.stringify(resumeData))
        });
        activeResumeId = newId;
        saveData();
        renderVersionDropdown();
        showToast(`已另存为新版本：${newName.trim()}`);
      }
    });

    // 13. 导出 JSON
    shadow.getElementById("rf-btn-export").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(resumeData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_data_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("简历配置已导出");
    });

    // 14. 导入 JSON
    const fileInput = shadow.getElementById("rf-file-input");
    shadow.getElementById("rf-btn-import").addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          resumeData = mergeWithDefault(imported, defaultResumeData);
          saveData();
          updateAllViews();
          showToast("简历数据导入成功！");
        } catch (err) {
          showToast("导入失败，JSON 格式不正确");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    // 15. 清空数据
    shadow.getElementById("rf-btn-clear").addEventListener("click", () => {
      if (confirm("确定要清空当前版本的所有简历内容吗？")) {
        resumeData = JSON.parse(JSON.stringify(defaultResumeData));
        saveData();
        updateAllViews();
        showToast("数据已清空");
      }
    });

    // 16. 全方位自由拖拽悬浮球 (支持屏幕任意放置与拖拽记忆)
    let isTriggerDragging = false;
    let triggerStartX = 0;
    let triggerStartY = 0;
    let triggerInitLeft = 0;
    let triggerInitTop = 0;

    function applySavedPositions() {
      // 1. 恢复卡片记忆位置
      const savedCardPos = localStorage.getItem("rf_card_pos");
      if (savedCardPos) {
        try {
          const { left, top } = JSON.parse(savedCardPos);
          if (typeof left === "number" && typeof top === "number") {
            const cardW = cardModal.offsetWidth || 410;
            const maxL = Math.max(0, window.innerWidth - cardW);
            const maxT = Math.max(0, window.innerHeight - 80);
            const validLeft = Math.max(0, Math.min(maxL, left));
            const validTop = Math.max(0, Math.min(maxT, top));
            cardModal.style.right = "auto";
            cardModal.style.bottom = "auto";
            cardModal.style.left = `${validLeft}px`;
            cardModal.style.top = `${validTop}px`;
          }
        } catch(e) {}
      } else {
        cardModal.style.right = "20px";
        cardModal.style.bottom = "30px";
      }

      // 2. 恢复悬浮球记忆位置
      const savedTriggerPos = localStorage.getItem("rf_trigger_pos");
      if (savedTriggerPos) {
        try {
          const { left, top } = JSON.parse(savedTriggerPos);
          if (typeof left === "number" && typeof top === "number") {
            const btnW = triggerBtn.offsetWidth || 44;
            const btnH = triggerBtn.offsetHeight || 44;
            const validLeft = Math.max(8, Math.min(window.innerWidth - btnW - 8, left));
            const validTop = Math.max(8, Math.min(window.innerHeight - btnH - 8, top));
            triggerBtn.style.right = "auto";
            triggerBtn.style.bottom = "auto";
            triggerBtn.style.left = `${validLeft}px`;
            triggerBtn.style.top = `${validTop}px`;
          }
        } catch(e) {}
      } else {
        triggerBtn.style.right = "24px";
        triggerBtn.style.bottom = "80px";
      }
    }
    applySavedPositions();

    // ==================== 统一无操作智能交互：3秒半透明 / 卡片自动收起 / 小球自动贴边 ====================
    let idleTimer = null;
    let cardCollapseTimer = null;
    let dockTimer = null;
    let isMouseInsideCard = false;
    let isMouseInsideTrigger = false;

    cardModal.addEventListener("mouseenter", () => {
      isMouseInsideCard = true;
      cardModal.classList.remove("rf-idle-fade");
      resetInactivityTimers();
    });

    cardModal.addEventListener("mouseleave", () => {
      isMouseInsideCard = false;
      resetInactivityTimers();
    });

    triggerBtn.addEventListener("mouseenter", () => {
      isMouseInsideTrigger = true;
      triggerBtn.classList.remove("rf-idle-fade");
      resetInactivityTimers();
    });

    triggerBtn.addEventListener("mouseleave", () => {
      isMouseInsideTrigger = false;
      resetInactivityTimers();
    });

    function wakeUpAll() {
      // 悬浮按钮：鼠标不在按钮上时保持已有透明状态，只有鼠标移动到按钮上时才恢复不透明
      if (triggerBtn && isMouseInsideTrigger) {
        triggerBtn.classList.remove("rf-idle-fade");
      }
      // 卡片若展开：用户在页面操作且鼠标进入卡片时保持不透明
      if (cardModal && !isCardCollapsed) {
        cardModal.classList.remove("rf-idle-fade");
      }
      resetInactivityTimers();
    }

    function resetInactivityTimers() {
      clearTimeout(idleTimer);
      clearTimeout(cardCollapseTimer);
      clearTimeout(dockTimer);

      if (isTriggerDragging || isCardDragging) {
        return;
      }

      // 1. 超过 3 秒没有鼠标操作：
      // - 悬浮卡片：超过 3 秒自动变半透明
      // - 悬浮按钮：超过 3 秒自动变半透明，鼠标只要没移到按钮上就一直保持半透明
      idleTimer = setTimeout(() => {
        if (isTriggerDragging || isCardDragging) return;
        if (isCardCollapsed) {
          if (!isMouseInsideTrigger) {
            triggerBtn.classList.add("rf-idle-fade");
          }
        } else {
          if (!isMouseInsideCard) {
            cardModal.classList.add("rf-idle-fade");
          }
        }
      }, 3000);

      // 2. 悬浮卡片若无操作：持续无操作达到 3 秒（且鼠标不在卡片内部），自动平滑收缩变为悬浮按钮！
      if (!isCardCollapsed) {
        cardCollapseTimer = setTimeout(() => {
          if (!isCardCollapsed && !isMouseInsideCard && !isCardDragging) {
            collapseCard();
          }
        }, 3000);
      }

      // 3. 悬浮按钮状态下：变透明后再过 3 秒（无操作累计 6 秒）自动贴边
      if (isCardCollapsed) {
        dockTimer = setTimeout(() => {
          if (isCardCollapsed && !isTriggerDragging && !isMouseInsideTrigger) {
            autoDockFloatingBtn();
          }
        }, 6000);
      }
    }

    function autoDockFloatingBtn() {
      if (!triggerBtn || !isCardCollapsed) return;
      const rect = triggerBtn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const winW = window.innerWidth;

      if (centerX < winW / 2) {
        // 贴屏幕左边缘
        triggerBtn.classList.add("rf-docked-left");
        triggerBtn.style.left = "0px";
        triggerBtn.style.right = "auto";
      } else {
        // 贴屏幕右边缘
        triggerBtn.classList.add("rf-docked-right");
        triggerBtn.style.left = `${winW - rect.width}px`;
        triggerBtn.style.right = "auto";
      }
    }

    // 全局鼠标/交互监听：重置计时器，若鼠标未进入按钮则按钮继续保持透明
    window.addEventListener("mousemove", wakeUpAll, { passive: true });
    window.addEventListener("scroll", wakeUpAll, { passive: true });
    window.addEventListener("keydown", wakeUpAll, { passive: true });

    triggerBtn.addEventListener("mousedown", (e) => {
      isTriggerDragging = false;
      triggerBtn.classList.remove("rf-idle-fade", "rf-docked-left", "rf-docked-right");
      triggerStartX = e.clientX;
      triggerStartY = e.clientY;

      const rect = triggerBtn.getBoundingClientRect();
      triggerInitLeft = rect.left;
      triggerInitTop = rect.top;

      triggerBtn.style.right = "auto";
      triggerBtn.style.bottom = "auto";
      triggerBtn.style.left = `${triggerInitLeft}px`;
      triggerBtn.style.top = `${triggerInitTop}px`;
      triggerBtn.style.transition = "none";

      function onTriggerMouseMove(moveEvent) {
        const dx = moveEvent.clientX - triggerStartX;
        const dy = moveEvent.clientY - triggerStartY;
        if (Math.hypot(dx, dy) > 4) {
          isTriggerDragging = true;
          const btnW = triggerBtn.offsetWidth || 44;
          const btnH = triggerBtn.offsetHeight || 44;
          let newL = triggerInitLeft + dx;
          let newT = triggerInitTop + dy;
          newL = Math.max(0, Math.min(window.innerWidth - btnW, newL));
          newT = Math.max(0, Math.min(window.innerHeight - btnH, newT));
          triggerBtn.style.left = `${newL}px`;
          triggerBtn.style.top = `${newT}px`;
        }
      }

      function onTriggerMouseUp() {
        triggerBtn.style.transition = "";
        if (isTriggerDragging) {
          const curRect = triggerBtn.getBoundingClientRect();
          localStorage.setItem("rf_trigger_pos", JSON.stringify({ left: curRect.left, top: curRect.top }));
          setTimeout(() => { isTriggerDragging = false; }, 60);
        }
        resetInactivityTimers();
        document.removeEventListener("mousemove", onTriggerMouseMove);
        document.removeEventListener("mouseup", onTriggerMouseUp);
      }

      document.addEventListener("mousemove", onTriggerMouseMove);
      document.addEventListener("mouseup", onTriggerMouseUp);
    });

    let isCardDragging = false;
    let cardStartX = 0;
    let cardStartY = 0;
    let cardInitLeft = 0;
    let cardInitTop = 0;
    let hasCardMoved = false;
    let cardJustDragged = false;

    cardHeader.addEventListener("mousedown", (e) => {
      // 点击按钮、选择框或输入项时不触发拖动
      if (e.target.closest("button, select, input, .rf-icon-btn, .rf-btn-smart-fill, #rf-site-menu")) return;
      isCardDragging = true;
      hasCardMoved = false;
      cardStartX = e.clientX;
      cardStartY = e.clientY;

      const rect = cardModal.getBoundingClientRect();
      cardInitLeft = rect.left;
      cardInitTop = rect.top;

      cardModal.style.right = "auto";
      cardModal.style.bottom = "auto";
      cardModal.style.left = `${cardInitLeft}px`;
      cardModal.style.top = `${cardInitTop}px`;
      cardModal.style.transition = "none"; // 拖动时关闭过渡动画，保证极致跟手

      function onCardMouseMove(moveEv) {
        if (!isCardDragging) return;
        const dx = moveEv.clientX - cardStartX;
        const dy = moveEv.clientY - cardStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          hasCardMoved = true;
        }
        let newL = cardInitLeft + dx;
        let newT = cardInitTop + dy;

        const maxL = Math.max(0, window.innerWidth - (cardModal.offsetWidth || 410));
        const maxT = Math.max(0, window.innerHeight - 70);
        newL = Math.max(0, Math.min(maxL, newL));
        newT = Math.max(0, Math.min(maxT, newT));

        cardModal.style.left = `${newL}px`;
        cardModal.style.top = `${newT}px`;
      }

      function onCardMouseUp() {
        if (isCardDragging) {
          isCardDragging = false;
          cardModal.style.transition = "";
          if (hasCardMoved) {
            cardJustDragged = true;
            setTimeout(() => { cardJustDragged = false; }, 80);
            const curRect = cardModal.getBoundingClientRect();
            localStorage.setItem("rf_card_pos", JSON.stringify({ left: curRect.left, top: curRect.top }));
          }
        }
        document.removeEventListener("mousemove", onCardMouseMove);
        document.removeEventListener("mouseup", onCardMouseUp);
      }

      document.addEventListener("mousemove", onCardMouseMove);
      document.addEventListener("mouseup", onCardMouseUp);
    });

    // 16.2 重置卡片位置回到右下角
    resetPosBtn.addEventListener("click", () => {
      localStorage.removeItem("rf_card_pos");
      cardModal.style.left = "auto";
      cardModal.style.top = "auto";
      cardModal.style.right = "20px";
      cardModal.style.bottom = "30px";
      showToast("已重置卡片位置到右下角");
    });

    // 16.3 多档透明度调节 (100% -> 75% -> 45%)
    const opacityLevels = [1, 0.75, 0.45];
    let curOpacityIdx = 0;
    opacityBtn.addEventListener("click", () => {
      curOpacityIdx = (curOpacityIdx + 1) % opacityLevels.length;
      const level = opacityLevels[curOpacityIdx];
      cardModal.style.opacity = level.toString();
      if (level < 1) {
        cardModal.style.backdropFilter = "blur(12px)";
      } else {
        cardModal.style.backdropFilter = "";
      }
      showToast(`当前透明度: ${Math.round(level * 100)}% (透视底层网页)`);
    });

    // 16.4 幽灵鼠标穿透模式开关 (Click-Through)
    function toggleGhostMode(forceState) {
      const willBeGhost = forceState !== undefined ? forceState : !cardModal.classList.contains("rf-ghost-mode");
      if (willBeGhost) {
        cardModal.classList.add("rf-ghost-mode");
        ghostBadge.classList.remove("rf-hidden");
        showToast("👻 鼠标穿透已开启！鼠标可直接穿透卡片点击底层网页 (Alt+T 或点右上角退出)");
      } else {
        cardModal.classList.remove("rf-ghost-mode");
        ghostBadge.classList.add("rf-hidden");
        showToast("已退出鼠标穿透，卡片交互已恢复");
      }
    }

    ghostBtn.addEventListener("click", () => toggleGhostMode(true));
    ghostBadge.addEventListener("click", () => toggleGhostMode(false));

    // 17. 智能气泡交互与事件绑定
    pillFillBtn.addEventListener("click", async () => {
      if (currentTargetInput && currentDetectedField) {
        if (currentDetectedField.isPassword) {
          const api = window.ResumeFillerContent;
          if (api && typeof api.generateSmartPassword === "function" && typeof api.fillPasswordToPage === "function") {
            pillFillBtn.textContent = "⏳…";
            try {
              const res = await api.generateSmartPassword(currentDetectedField.ruleHint || "");
              const pwd = res && res.password ? res.password : "P@ssw0rd2026!";
              const r = api.fillPasswordToPage(pwd);
              if (r && r.success) {
                const extra = r.hasConfirm ? "（主密码框 + 确认密码框）" : "";
                showToast(`✓ 已生成并填入合规密码！${extra}`);
              }
            } finally {
              pillFillBtn.textContent = "⚡ 智能生成并填入";
              hidePill();
            }
            return;
          }
        }
        const fillVal = currentDetectedField.fileAttachment || currentDetectedField.value;
        if (fillVal !== undefined && fillVal !== null && fillVal !== "") {
          window.ResumeFillerContent.setElementValue(currentTargetInput, fillVal);
          showToast(`✓ 已填入：${currentDetectedField.label}`);
          hidePill();
        }
      }
    });
    pillCopyBtn.addEventListener("click", () => {
      if (currentDetectedField && currentDetectedField.value) {
        navigator.clipboard.writeText(currentDetectedField.value).then(() => {
          showToast("已成功复制到剪贴板！");
        });
      }
    });

    // 🪄 AI 重诊：当本地推断不准时，单点呼叫大模型重新诊断此输入框
    if (pillRefineBtn) {
      pillRefineBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // 优先使用当前目标输入框，若丢失则尝试从最后聚焦节点或当前活跃节点恢复
        let target = currentTargetInput;
        if (!target || !document.body.contains(target)) {
          target = window.ResumeFillerContent && window.ResumeFillerContent.getLastActiveElement();
        }
        if (!target) {
          const act = document.activeElement;
          if (act && (["INPUT", "TEXTAREA", "SELECT"].includes(act.tagName) || act.isContentEditable)) {
            target = act;
          }
        }

        if (!target) {
          showToast("请先在网页中点击需要诊断的输入框", true);
          return;
        }

        // 检查是否配置了 API Key
        let hasApiKey = false;
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            const st = await chrome.storage.local.get("apiConfig");
            hasApiKey = !!(st.apiConfig && st.apiConfig.apiKey);
          }
        } catch(e) {}

        if (!hasApiKey) {
          showToast("⚠️ 未配置大模型 API Key！已为你展开【🪄 AI配置】面板，请填入密钥", true);
          expandCard();
          const aiTab = shadow.querySelector(".rf-tab-item[data-tab='ai-config']");
          if (aiTab) aiTab.click();
          return;
        }

        // 按钮及旁边状态更新
        pillRefineBtn.textContent = "分析中...";
        pillRefineBtn.disabled = true;
        pillRefineBtn.style.opacity = "0.7";

        if (pillAiStatus) {
          pillAiStatus.className = "rf-pill-ai-status loading";
          pillAiStatus.style.display = "inline-flex";
          pillAiStatus.textContent = "⏳ 思考中...";
        }
        showToast("🪄 正在呼唤大模型深度诊断此输入框...");

        try {
          if (window.ResumeFillerContent && window.ResumeFillerContent.requestAiSingleFieldRefinement) {
            const slot = await window.ResumeFillerContent.requestAiSingleFieldRefinement(target);
            if (slot) {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status success";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = `✓ 已对齐: ${slot}`;
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2200);
              }
              showToast(`✓ AI 诊断对齐成功：${slot}`);
              currentTargetInput = target;
              showPillForInput(target); // 重新渲染气泡为精准项
            } else {
              if (pillAiStatus) {
                pillAiStatus.className = "rf-pill-ai-status error";
                pillAiStatus.style.display = "inline-flex";
                pillAiStatus.textContent = "未匹配到合适槽位";
                setTimeout(() => {
                  if (pillAiStatus) pillAiStatus.style.display = "none";
                }, 2500);
              }
              showToast("AI 未能识别出更佳字段", true);
            }
          } else {
            showToast("未找到 AI 诊断引擎", true);
          }
        } catch(err) {
          console.error("AI 重诊异常:", err);
          const errMsg = err.message || String(err);
          if (pillAiStatus) {
            pillAiStatus.className = "rf-pill-ai-status error";
            pillAiStatus.style.display = "inline-flex";
            pillAiStatus.textContent = "❌ " + (errMsg.length > 20 ? errMsg.slice(0, 18) + "..." : errMsg);
            setTimeout(() => {
              if (pillAiStatus) pillAiStatus.style.display = "none";
            }, 3500);
          }
          showToast(`❌ AI 诊断失败: ${errMsg}`, true);
        } finally {
          pillRefineBtn.textContent = "重诊";
          pillRefineBtn.disabled = false;
          pillRefineBtn.style.opacity = "1";
        }
      });
    }

    // 监听整页 AI 拓扑分析完成事件，即时更新气泡
    window.addEventListener("rf-ai-mapping-updated", (e) => {
      if (currentTargetInput && document.body.contains(currentTargetInput)) {
        showPillForInput(currentTargetInput);
      }
    });

    // 气泡内就地展开完整卡片按钮
    if (pillExpandCardBtn) {
      pillExpandCardBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!isTopFrame && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "openTopFloatingCard" });
          showToast("已在主页面展开面板");
          return;
        }
        // 如果有当前输入框，就在输入框附近展开卡片，手感极佳
        if (currentTargetInput) {
          const r = currentTargetInput.getBoundingClientRect();
          expandCard({ x: r.left + 50, y: r.bottom + 10 });
        } else {
          expandCard();
        }
      });
    }

    pillCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hidePill();
    });

    function handleActiveElement(el) {
      if (!el) return;
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      const target = resolveTargetControl(el);
      if (target) {
        showPillForInput(target);
      }
    }

    // 页面焦点监听: 任何页面输入框获得焦点时，呼出对应跟随气泡
    document.addEventListener("focusin", (e) => handleActiveElement(e.target), true);

    document.addEventListener("click", (e) => {
      const el = e.target;
      if (!el) return;
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      const target = resolveTargetControl(el);
      if (target) {
        showPillForInput(target);
      } else {
        // 仅当点击了明确与当前输入框无关的非表单背景区域时，才平滑隐藏气泡
        if (currentTargetInput && !currentTargetInput.contains(el)) {
          const active = document.activeElement;
          const isFocusingInput = active && (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) || active.isContentEditable);
          if (!isFocusingInput) {
            hidePill();
          }
        }
      }
    }, true);

    window.addEventListener("scroll", updatePillPosition, { passive: true });
    window.addEventListener("resize", updatePillPosition, { passive: true });

    // 网页空白处双击监听：在网申/填报页面任意空白背景处双击，快速切换悬浮按钮与悬浮卡片
    document.addEventListener("dblclick", (e) => {
      const el = e.target;
      if (!el) return;
      // 排除插件自身 DOM
      if (el.closest && el.closest("#resume-filler-extension-host")) return;
      if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return;

      // 排除用户正在操作的控件（输入框、选择框、按钮、链接等）
      const isControl = el.closest("input, textarea, select, button, a, [contenteditable='true'], .rf-form-control");
      if (isControl) return;

      // 排除用户正在划选文字的行为
      const selection = window.getSelection ? window.getSelection().toString().trim() : "";
      if (selection.length > 0) return;

      // 触发切换（支持就地在鼠标位置折叠/展开）
      toggleCard(undefined, { x: e.clientX, y: e.clientY });
    }, true);

    // 键盘快捷键监听:
    // Alt + Enter: 直接将气泡内容填入当前聚焦的输入框
    // Alt + C: 快速展开/折叠悬浮卡片
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "Enter" || e.keyCode === 13)) {
        if (!inlinePill.classList.contains("rf-pill-hidden") && currentTargetInput && currentDetectedField) {
          e.preventDefault();
          window.ResumeFillerContent.setElementValue(currentTargetInput, currentDetectedField.value);
          showToast(`✓ 已快捷填入：${currentDetectedField.label}`);
          hidePill();
        }
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        toggleCard();
      } else if (e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        toggleGhostMode();
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setEditMode(!isEditMode);
      }
    });
