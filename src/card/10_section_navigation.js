// ==================== 标签页左侧分块快速导航 ====================
// 统一为每个一级标签提供左侧锚点导航，右侧区域独立滚动；不改变原有字段、填写和复制事件。

  const panelDefinitions = {
    basic: [
      { id: "basic-personal", label: "个人信息", target: () => shadow.querySelector('[data-key="basic.name"]') },
      { id: "basic-contact", label: "联系方式", target: () => shadow.querySelector('[data-key="basic.phone"]') },
      { id: "basic-location", label: "身份与所在地", target: () => shadow.querySelector('[data-key="basic.idCard"]') },
      { id: "basic-links", label: "账号与链接", target: () => shadow.querySelector('[data-key="basic.website"]') },
      { id: "basic-intent", label: "求职信息", target: () => shadow.querySelector('[data-key="basic.jobIntent"]') },
      { id: "basic-family", label: "家庭关系", target: () => shadow.getElementById("rf-family-list") },
      { id: "basic-summary", label: "自我评价", target: () => shadow.querySelector('[data-key="basic.selfEval"]') }
    ],
    education: [
      { id: "education-top", label: "教育经历总览", target: () => shadow.getElementById("rf-edu-list") },
      { id: "education-add", label: "新增教育经历", target: () => shadow.getElementById("rf-btn-add-edu") }
    ],
    internship: [
      { id: "internship-top", label: "实习经历总览", target: () => shadow.getElementById("rf-intern-list") },
      { id: "internship-add", label: "新增工作实习", target: () => shadow.getElementById("rf-btn-add-intern") }
    ],
    project: [
      { id: "project-top", label: "项目经历总览", target: () => shadow.getElementById("rf-proj-list") },
      { id: "project-add", label: "新增项目经历", target: () => shadow.getElementById("rf-btn-add-proj") }
    ],
    skills: [
      { id: "skills-main", label: "专业技能", target: () => shadow.querySelector('[data-key="skills"]') },
      { id: "skills-language", label: "语言能力", target: () => shadow.querySelector('[data-key="languages"]') },
      { id: "skills-honors", label: "荣誉奖项", target: () => shadow.getElementById("rf-honor-list") },
      { id: "skills-add-honor", label: "新增荣誉", target: () => shadow.getElementById("rf-btn-add-honor") }
    ],
    "paper-comp": [
      { id: "comp-main", label: "竞赛经历", target: () => shadow.getElementById("rf-comp-list") },
      { id: "comp-add", label: "新增赛事", target: () => shadow.getElementById("rf-btn-add-comp") },
      { id: "paper-main", label: "论文 / 专利", target: () => shadow.getElementById("rf-paper-list") },
      { id: "paper-add", label: "新增论文", target: () => shadow.getElementById("rf-btn-add-paper") }
    ],
    "ai-config": [
      { id: "ai-protocol", label: "模型协议", target: () => shadow.getElementById("rf-ai-protocol") },
      { id: "ai-endpoint", label: "服务地址", target: () => shadow.getElementById("rf-ai-base-url") },
      { id: "ai-key", label: "API Key", target: () => shadow.getElementById("rf-ai-api-key") },
      { id: "ai-model", label: "模型名称", target: () => shadow.getElementById("rf-ai-model") },
      { id: "ai-test", label: "连接测试", target: () => shadow.getElementById("rf-btn-test-api") },
      { id: "ai-audit", label: "诊断日志", target: () => shadow.getElementById("rf-agent-log-summary") }
    ]
  };

  function panelKey(panel) {
    return panel.id.replace(/^panel-/, "");
  }

  function getDynamicDefinitions(key, panel) {
    let list = [];
    if (key === "education") list = Array.from(panel.querySelectorAll("#rf-edu-list > .rf-sub-card"));
    if (key === "internship") list = Array.from(panel.querySelectorAll("#rf-intern-list > .rf-sub-card"));
    if (key === "project") list = Array.from(panel.querySelectorAll("#rf-proj-list > .rf-sub-card"));
    if (key === "skills") list = Array.from(panel.querySelectorAll("#rf-honor-list > .rf-sub-card"));
    if (key === "paper-comp") {
      list = [
        ...Array.from(panel.querySelectorAll("#rf-comp-list > .rf-sub-card")),
        ...Array.from(panel.querySelectorAll("#rf-paper-list > .rf-sub-card"))
      ];
    }
    return list.map((card, index) => {
      const title = card.querySelector(".rf-sub-card-title")?.textContent?.trim() || `记录 ${index + 1}`;
      const id = `${key}-record-${index}`;
      card.dataset.rfSectionId = id;
      return {
        id,
        label: title.length > 16 ? `${title.slice(0, 15)}…` : title,
        target: () => shadow.querySelector(`[data-rf-section-id="${id}"]`)
      };
    });
  }

  function sectionHasContent(target) {
    if (!target) return false;
    if (target.matches?.("input, textarea, select")) return !!String(target.value || "").trim();
    return !!target.querySelector?.("input:not([type='file']), textarea, select") &&
      Array.from(target.querySelectorAll("input:not([type='file']), textarea, select")).some(el => String(el.value || "").trim());
  }

  function buildPanel(panel) {
    if (!panel.classList.contains("rf-tab-panel")) return;
    const key = panelKey(panel);
    let scroll = Array.from(panel.children).find(el => el.classList.contains("rf-section-scroll"));
    let nav = Array.from(panel.children).find(el => el.classList.contains("rf-section-nav"));
    if (!scroll) {
      scroll = document.createElement("div");
      scroll.className = "rf-section-scroll";
      while (panel.firstChild) scroll.appendChild(panel.firstChild);
      nav = document.createElement("nav");
      nav.className = "rf-section-nav";
      panel.append(nav, scroll);
    }

    const defs = [...(panelDefinitions[key] || []), ...getDynamicDefinitions(key, scroll)];
    nav.innerHTML = defs.map(def => `<button type="button" class="rf-section-nav-item" data-rf-nav-id="${def.id}"><span class="rf-section-nav-dot"></span><span>${def.label}</span></button>`).join("");
    const items = Array.from(nav.querySelectorAll(".rf-section-nav-item"));
    items.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const def = defs[index];
        const target = def.target();
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        items.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      });
      const target = defs[index].target();
      if (sectionHasContent(target)) item.classList.add("has-content");
    });

    const updateActive = () => {
      const scrollRect = scroll.getBoundingClientRect();
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      defs.forEach((def, index) => {
        const target = def.target();
        if (!target) return;
        const distance = Math.abs(target.getBoundingClientRect().top - scrollRect.top - 12);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      items.forEach((item, index) => item.classList.toggle("active", index === bestIndex));
    };
    scroll.onscroll = updateActive;
    updateActive();
  }

  function refreshSectionNavigation() {
    shadow.querySelectorAll(".rf-tab-panel").forEach(buildPanel);
  }

  // updateAllViews 会在数据加载、版本切换、增删经历时调用；每次刷新导航以同步动态记录。



setTimeout(() => {
  try { refreshSectionNavigation(); } catch (err) { console.warn("OfferGo section navigation init failed", err); }
}, 0);
window.__offerGoRefreshSectionNavigation = refreshSectionNavigation;
// 初始化后通过全局调用，供生命周期模块在数据渲染完成后重建导航。
window.__offerGoSectionNav = { refresh: refreshSectionNavigation };
