// ==================== UI 渲染逻辑 ====================

  function updateAllViews() {
    renderVersionDropdown();
    fillBasicAndSkillsForm();
    renderFamilyList();
    renderEducationList();
    renderInternshipList();
    renderProjectList();
    renderHonorsList();
    renderCompetitionList();
    renderPaperList();
  }

  // 渲染家庭关系列表
  function renderFamilyList() {
    const container = shadow.getElementById("rf-family-list");
    if (!container) return;
    container.innerHTML = "";

    if (!resumeData.family || resumeData.family.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无家庭关系记录，可点击上方按钮添加</div>`;
      return;
    }

    resumeData.family.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">${item.relation || '家庭成员'} #${index + 1}: ${item.name || '未命名'}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="family" data-index="${index}" title="定向填充当前家庭成员">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="family" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.relation">与本人关系 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="relation" value="${item.relation || ''}" placeholder="如：父亲/母亲">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.name">亲属姓名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="亲属姓名">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.age">年龄 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="age" value="${item.age || ''}" placeholder="如：60">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.political">政治面貌 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="political" value="${item.political || ''}" placeholder="群众/党员">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.company">工作单位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="工作单位/无">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.department">工作部门 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="工作部门/无">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.position">职务 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="职务/岗位">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="family.${index}.phone">联系电话 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="family" data-index="${index}" data-key="phone" value="${item.phone || ''}" placeholder="联系电话">
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function renderVersionDropdown() {
    if (!selectVersion) return;
    selectVersion.innerHTML = "";
    resumesList.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      if (r.id === activeResumeId) opt.selected = true;
      selectVersion.appendChild(opt);
    });
    const current = resumesList.find((r) => r.id === activeResumeId);
    if (btnBadge && current) {
      btnBadge.textContent = current.name;
    }
  }

  function fillBasicAndSkillsForm() {
    shadow.querySelectorAll("[data-key^='basic.']").forEach((input) => {
      const key = input.getAttribute("data-key").split(".")[1];
      input.value = resumeData.basic[key] || "";
    });
    const skillsTextarea = shadow.querySelector("[data-key='skills']");
    if (skillsTextarea) skillsTextarea.value = resumeData.skills || "";
    const languagesInput = shadow.querySelector("[data-key='languages']");
    if (languagesInput) languagesInput.value = resumeData.languages || "";
    // 允许字段拖拽即填
    shadow.querySelectorAll(".rf-form-control, .rf-field-label").forEach((el) => {
      el.setAttribute("draggable", "true");
    });
  }
  // 渲染教育经历
  function renderEducationList() {
    const container = shadow.getElementById("rf-edu-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.education.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无教育经历</div>`;
      return;
    }

    resumeData.education.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">教育经历 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="education" data-index="${index}" title="填入当前聚焦的教育板块">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="education" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.school">学校名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="school" value="${item.school || ''}" placeholder="如：北京大学">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.degree">学历学位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="degree" value="${item.degree || ''}" placeholder="如：硕士/本科">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.major">所学专业 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="major" value="${item.major || ''}" placeholder="专业名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.gpa">GPA / 排名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="gpa" value="${item.gpa || ''}" placeholder="3.8/4.0 或 前10%">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.start">入学时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2020-09">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.end">毕业时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2024-06">
            </div>
          </div>
        </div>

        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.studentId">学号 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="studentId" value="${item.studentId || ''}" placeholder="学号">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="education.${index}.schoolLocation">学校所在地 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="schoolLocation" value="${item.schoolLocation || ''}" placeholder="如：北京市海淀区">
            </div>
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.department">院系名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="计算机科学与技术学院">
          </div>
        </div>

        <!-- 导师姓名 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.supervisor">导师姓名 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="supervisor" value="${item.supervisor || ''}" placeholder="如：李教授 / 张老师">
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.role">担任职务 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="如：班长 / 学生会部长 / 社团负责人">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.roleDescription">职务描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="roleDescription" placeholder="说明任职期间负责的工作、组织活动和取得的成果...">${item.roleDescription || ''}</textarea>
          </div>
        </div>

        <!-- 专业描述 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.majorDescription">专业描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="majorDescription" placeholder="专业特色、主修方向、专业概述说明...">${item.majorDescription || ''}</textarea>
          </div>
        </div>

        <!-- 毕业论文/设计/作品 (主修课程之前) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.thesisTopic">毕业论文/设计/作品 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="thesisTopic" placeholder="毕设题目、毕业设计或作品主要内容...">${item.thesisTopic || ''}</textarea>
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.courses">主修课程 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="courses" placeholder="核心课程，以逗号隔开">${item.courses || ''}</textarea>
          </div>
        </div>

        <!-- 研究方向 (主修课程之后) -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.researchDirection">研究方向 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="researchDirection" value="${item.researchDirection || ''}" placeholder="如：自然语言处理 / 计算机视觉 / 大模型应用">
          </div>
        </div>

        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="education.${index}.labExperience">科研/实验室经历 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="education" data-index="${index}" data-key="labExperience" placeholder="科研课题、承担角色与主要贡献...">${item.labExperience || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染实习经历
  function renderInternshipList() {
    const container = shadow.getElementById("rf-intern-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.internship.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无实习经历</div>`;
      return;
    }

    resumeData.internship.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">工作实习 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="internship" data-index="${index}">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="internship" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.company">公司名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="公司名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.position">担任岗位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="担任职位">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.start">入职时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2023-06">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.end">离职时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2023-09 或 至今">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="internship.${index}.desc">职责与产出 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="desc" placeholder="简述日常开发、核心产出等...">${item.desc || ''}</textarea>
          </div>
        </div>

        <!-- 证明人信息补充 (国企/校招/大厂背调) -->
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">证明人信息</span>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witness">证明人 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witness" value="${item.witness || ''}" placeholder="有 / 无">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessName">证明人姓名 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessName" value="${item.witnessName || ''}" placeholder="证明人姓名">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessRelation">证明人关系 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessRelation" value="${item.witnessRelation || ''}" placeholder="如：直属领导/带教">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessPosition">证明人职务 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPosition" value="${item.witnessPosition || ''}" placeholder="如：带教/主管">
            </div>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessCompany">证明人单位 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessCompany" value="${item.witnessCompany || ''}" placeholder="证明人工作单位">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="internship.${index}.witnessPhone">证明人联系方式 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPhone" value="${item.witnessPhone || ''}" placeholder="手机号/微信号">
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染项目经历 (重点：拆分为项目描述、项目职责、项目成果三个输入框)
  function renderProjectList() {
    const container = shadow.getElementById("rf-proj-list");
    if (!container) return;
    container.innerHTML = "";

    if (resumeData.project.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; color:var(--text-muted);">暂无项目经历</div>`;
      return;
    }

    resumeData.project.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">项目经历 #${index + 1}</span>
          <div class="rf-sub-card-actions">
            <button class="rf-field-btn rf-btn-fill btn-fill-section" data-type="project" data-index="${index}">⚡ 填充此项</button>
            <button class="rf-field-btn btn-delete-card" data-type="project" data-index="${index}" style="color:var(--danger);">🗑️</button>
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.name">项目名称 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="项目名称">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.role">担任角色 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="项目负责人 / 核心开发">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.link">项目链接 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="url" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="link" value="${item.link || ''}" placeholder="GitHub / 在线演示 / 项目主页链接">
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.start">开始时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="2023-10">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="project.${index}.end">结束时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="2023-12">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.tech">主要技术栈 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="tech" value="${item.tech || ''}" placeholder="如：FastAPI, React, Docker">
          </div>
        </div>

        <!-- 拆分 1: 项目描述 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.desc">项目描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="desc" placeholder="描述项目背景、目标定位、业务场景与系统核心架构...">${item.desc || ''}</textarea>
          </div>
        </div>

        <!-- 拆分 2: 项目职责 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.duty">项目职责 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="duty" placeholder="描述你在项目中承担的核心角色职责、负责的具体模块开发与技术工作...">${item.duty || ''}</textarea>
          </div>
        </div>

        <!-- 拆分 3: 项目成果 -->
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="project.${index}.result">项目成果 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="project" data-index="${index}" data-key="result" placeholder="描述项目的量化指标提升、业务收益、线上成效或竞赛获奖成果...">${item.result || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染荣誉奖项
  function renderHonorsList() {
    const container = shadow.getElementById("rf-honor-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.honors.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无荣誉奖项</div>`;
      return;
    }
    resumeData.honors.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">奖项 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="honors" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="honors.${index}.name">奖项名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="国家奖学金 / 一等奖">
          </div>
        </div>
        <div class="rf-grid-2">
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="honors.${index}.date">获奖时间 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="date" value="${item.date || ''}" placeholder="2023-11">
            </div>
          </div>
          <div class="rf-form-group">
            <label class="rf-form-label" data-copy-ref="honors.${index}.level">级别 / 机构 <span class="rf-lbl-copy-icon">📋</span></label>
            <div class="rf-input-wrapper">
              <input type="text" class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="level" value="${item.level || ''}" placeholder="国家级 / 教育部">
            </div>
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="honors.${index}.desc">奖项描述 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="honors" data-index="${index}" data-key="desc" placeholder="简述获奖背景、奖项内容、个人贡献或排名...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染赛事经历
  function renderCompetitionList() {
    const container = shadow.getElementById("rf-comp-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.competition.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无赛事经历</div>`;
      return;
    }
    resumeData.competition.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">赛事 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="competition" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="competition.${index}.name">比赛名称 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="competition" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="挑战杯 / 创青春 / 开发者大赛">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="competition.${index}.desc">描述与成果 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="competition" data-index="${index}" data-key="desc" placeholder="简述赛事职责、名次与成果...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 渲染论文/专利
  function renderPaperList() {
    const container = shadow.getElementById("rf-paper-list");
    if (!container) return;
    container.innerHTML = "";
    if (resumeData.paper.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11.5px; color:var(--text-muted);">暂无论文/期刊/专利</div>`;
      return;
    }
    resumeData.paper.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "rf-sub-card";
      card.innerHTML = `
        <div class="rf-sub-card-header">
          <span class="rf-sub-card-title">论文/专利 #${index + 1}</span>
          <button class="rf-field-btn btn-delete-card" data-type="paper" data-index="${index}" style="color:var(--danger);">🗑️</button>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="paper.${index}.title">论文/专利题目 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <input type="text" class="rf-form-control card-input" data-type="paper" data-index="${index}" data-key="title" value="${item.title || ''}" placeholder="论文/专利题目">
          </div>
        </div>
        <div class="rf-form-group">
          <label class="rf-form-label" data-copy-ref="paper.${index}.desc">摘要 / 研究内容 <span class="rf-lbl-copy-icon">📋</span></label>
          <div class="rf-input-wrapper">
            <textarea class="rf-form-control card-input" data-type="paper" data-index="${index}" data-key="desc" placeholder="简要描述研究内容、算法、成果...">${item.desc || ''}</textarea>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ==================== 智能气泡跟随逻辑 ====================

  function updatePillPosition() {
    if (!currentTargetInput || !document.body.contains(currentTargetInput)) {
      inlinePill.classList.add("rf-pill-hidden");
      return;
    }
    const rect = currentTargetInput.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      inlinePill.classList.add("rf-pill-hidden");
      return;
    }

    const pillHeight = inlinePill.offsetHeight || 36;
    let left = rect.left;
    let top = rect.top - pillHeight - 6;
    if (top < 8) {
      top = rect.bottom + 6;
    }
    left = Math.max(10, Math.min(window.innerWidth - 340, left));

    inlinePill.style.left = `${left}px`;
    inlinePill.style.top = `${top}px`;
  }
