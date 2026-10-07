// ==================== UI 渲染与动态绑定 ====================

// 渲染所有动态列表
function renderAllLists() {
  renderFamilyList();
  renderEducationList();
  renderInternshipList();
  renderProjectList();
  renderHonorsList();
  renderCompetitionList();
  renderPaperList();
  adjustAllTextareas();
}

// 渲染家庭关系列表
function renderFamilyList() {
  const container = document.getElementById("family-list");
  if (!container) return;
  container.innerHTML = "";

  if (!resumeData.family || resumeData.family.length === 0) {
    container.innerHTML = `<div class="empty-tip" style="padding:10px;">暂无家庭关系记录，点击上方按钮添加</div>`;
    return;
  }

  resumeData.family.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${item.relation || '家庭成员'} #${index + 1}: ${item.name || '未命名'}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="family" data-index="${index}" title="填充本位家庭成员">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="family" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">与本人关系</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="relation" value="${item.relation || ''}" placeholder="如：父亲/母亲">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.relation" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.relation" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">亲属姓名</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="亲属姓名">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.name" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.name" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">年龄</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="age" value="${item.age || ''}" placeholder="如：60">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.age" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.age" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">政治面貌</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="political" value="${item.political || ''}" placeholder="群众/党员">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.political" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.political" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">工作单位</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="工作单位/无">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.company" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.company" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">工作部门</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="工作部门/无">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.department" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.department" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">职务/岗位</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="职务/岗位">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.position" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.position" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">联系电话</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="family" data-index="${index}" data-key="phone" value="${item.phone || ''}" placeholder="联系电话">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="family.${index}.phone" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="family.${index}.phone" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 渲染教育经历列表
function renderEducationList() {
  const container = document.getElementById("education-list");
  container.innerHTML = "";

  if (resumeData.education.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无教育经历，请点击下方按钮添加</div>`;
    return;
  }

  resumeData.education.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">教育经历 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="education" data-index="${index}" title="填充本段教育经历">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="education" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">学校名称</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="school" value="${item.school || ''}" placeholder="如：北京大学">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.school" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.school" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">学历学位</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="degree" value="${item.degree || ''}" placeholder="如：本科/硕士/博士">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.degree" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.degree" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">学号</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="studentId" value="${item.studentId || ''}" placeholder="如：2020123456">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.studentId" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.studentId" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">学校所在地</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="schoolLocation" value="${item.schoolLocation || ''}" placeholder="如：天津市西青区">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.schoolLocation" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.schoolLocation" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">所学专业</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="major" value="${item.major || ''}" placeholder="如：计算机科学与技术">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.major" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.major" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">GPA/成绩排名</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="gpa" value="${item.gpa || ''}" placeholder="如：3.8/4.0 或 前10%">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.gpa" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.gpa" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">入学时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="如：2020-09">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.start" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.start" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">毕业时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="如：2024-06">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="education.${index}.end" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="education.${index}.end" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">院系名称</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="department" value="${item.department || ''}" placeholder="如：计算机科学与技术学院">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="education.${index}.department" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.department" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">导师姓名</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="supervisor" value="${item.supervisor || ''}" placeholder="如：李教授 / 张老师">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="education.${index}.supervisor" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.supervisor" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">担任职务</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="如：班长 / 学生会部长 / 社团负责人">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="education.${index}.role" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.role" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">职务描述</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="education" data-index="${index}" data-key="roleDescription" placeholder="说明任职期间负责的工作、组织活动和取得的成果...">${item.roleDescription || ''}</textarea>
            <div class="field-actions" style="top:8px;">
              <button class="field-btn btn-copy" data-ref="education.${index}.roleDescription" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.roleDescription" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">专业描述</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="education" data-index="${index}" data-key="majorDescription" placeholder="专业特色、主修方向、专业概述说明...">${item.majorDescription || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="education.${index}.majorDescription" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93(MD5)l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="education.${index}.majorDescription" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.majorDescription" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">毕业论文/设计/作品</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="education" data-index="${index}" data-key="thesisTopic" placeholder="毕设题目、毕业设计或作品主要内容...">${item.thesisTopic || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="education.${index}.thesisTopic" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93(MD5)l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="education.${index}.thesisTopic" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.thesisTopic" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">主修课程</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="education" data-index="${index}" data-key="courses" placeholder="核心课程，以逗号隔开">${item.courses || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="education.${index}.courses" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93(MD5)l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="education.${index}.courses" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.courses" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">研究方向</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="education" data-index="${index}" data-key="researchDirection" value="${item.researchDirection || ''}" placeholder="如：计算机视觉 / 自然语言处理 / 大模型应用">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="education.${index}.researchDirection" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.researchDirection" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">是否有实验室经历 / 科研经历说明</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="education" data-index="${index}" data-key="labExperience" placeholder="描述你的实验室科研项目、主要贡献、担任角色等...">${item.labExperience || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="education.${index}.labExperience" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="education.${index}.labExperience" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="education.${index}.labExperience" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 渲染实习经历列表
function renderInternshipList() {
  const container = document.getElementById("internship-list");
  container.innerHTML = "";

  if (resumeData.internship.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无工作实习经历，请点击下方按钮添加</div>`;
    return;
  }

  resumeData.internship.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">工作实习 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="internship" data-index="${index}" title="填充本段工作实习经历">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="internship" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">公司/组织</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="company" value="${item.company || ''}" placeholder="如：字节跳动">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.company" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.company" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">职位名称</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="position" value="${item.position || ''}" placeholder="如：前端开发实习生">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.position" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.position" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="如：2023-06">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.start" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.start" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="如：2023-09 或 至今">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.end" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.end" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">职责与工作内容</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="internship" data-index="${index}" data-key="desc" placeholder="简述你的工作职责，开发内容，技术产出等...">${item.desc || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="internship.${index}.desc" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="internship.${index}.desc" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="internship.${index}.desc" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>

        <!-- 证明人信息补充 (国企/校招/大厂背调必备) -->
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
          <span style="font-size: 11.5px; font-weight: 700; color: var(--text-main);">证明人信息</span>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">证明人</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witness" value="${item.witness || ''}" placeholder="有 / 无">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witness" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witness" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">证明人姓名</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witnessName" value="${item.witnessName || ''}" placeholder="证明人姓名">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witnessName" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witnessName" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">证明人关系</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witnessRelation" value="${item.witnessRelation || ''}" placeholder="如：直属领导/带教">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witnessRelation" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witnessRelation" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">证明人职务</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPosition" value="${item.witnessPosition || ''}" placeholder="如：带教/主管">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witnessPosition" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witnessPosition" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">证明人单位</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witnessCompany" value="${item.witnessCompany || ''}" placeholder="证明人所在单位">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witnessCompany" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witnessCompany" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">证明人联系方式</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="internship" data-index="${index}" data-key="witnessPhone" value="${item.witnessPhone || ''}" placeholder="手机号/微信号">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="internship.${index}.witnessPhone" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="internship.${index}.witnessPhone" title="填充"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 渲染项目经历列表
function renderProjectList() {
  const container = document.getElementById("project-list");
  container.innerHTML = "";

  if (resumeData.project.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无项目经历，请点击下方按钮添加</div>`;
    return;
  }

  resumeData.project.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">项目经历 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="project" data-index="${index}" title="填充本段项目经历">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="project" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">项目名称</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="project" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="如：在线简历助手">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="project.${index}.name" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="project.${index}.name" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">担任角色</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="project" data-index="${index}" data-key="role" value="${item.role || ''}" placeholder="如：项目负责人/前端开发">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="project.${index}.role" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="project.${index}.role" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="project" data-index="${index}" data-key="start" value="${item.start || ''}" placeholder="如：2023-10">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="project.${index}.start" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="project.${index}.start" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="project" data-index="${index}" data-key="end" value="${item.end || ''}" placeholder="如：2023-12">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="project.${index}.end" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="project.${index}.end" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">主要技术栈</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="project" data-index="${index}" data-key="tech" value="${item.tech || ''}" placeholder="如：React, FastAPI, Docker">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="project.${index}.tech" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="project.${index}.tech" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">项目链接</label>
          <div class="form-input-wrapper">
            <input type="url" class="form-control card-input" data-type="project" data-index="${index}" data-key="link" value="${item.link || ''}" placeholder="如：GitHub 地址 / 在线演示地址">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="project.${index}.link" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="project.${index}.link" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">项目描述</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="project" data-index="${index}" data-key="desc" placeholder="描述项目背景、目标定位、业务场景与系统核心架构...">${item.desc || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="project.${index}.desc" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="project.${index}.desc" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="project.${index}.desc" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">项目职责</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="project" data-index="${index}" data-key="duty" placeholder="描述你在项目中承担的核心角色职责、负责的具体模块开发与技术工作...">${item.duty || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="project.${index}.duty" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="project.${index}.duty" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="project.${index}.duty" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">项目成果</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="project" data-index="${index}" data-key="result" placeholder="描述项目的量化指标提升、业务收益、线上成效或竞赛获奖成果...">${item.result || ''}</textarea>
            <div class="field-actions" style="top: 8px;">
              <button class="field-btn btn-ai-modify" data-ref="project.${index}.result" title="AI 优化本项"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg></button>
              <button class="field-btn btn-copy" data-ref="project.${index}.result" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="project.${index}.result" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 渲染荣誉奖项列表
function renderHonorsList() {
  const container = document.getElementById("honors-list");
  container.innerHTML = "";

  if (resumeData.honors.length === 0) {
    container.innerHTML = `<div class="empty-tip">暂无荣誉奖项</div>`;
    return;
  }

  resumeData.honors.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">奖项 #${index + 1}</span>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-fill-section" data-type="honors" data-index="${index}">
            填充此项
          </button>
          <button class="btn btn-danger btn-sm btn-delete-card" data-type="honors" data-index="${index}">
            删除
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">奖项名称</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="honors" data-index="${index}" data-key="name" value="${item.name || ''}" placeholder="如：国家奖学金/美赛一等奖">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="honors.${index}.name" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="honors.${index}.name" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">获奖时间</label>
            <div class="form-input-wrapper">
              <input type="text" class="form-control card-input" data-type="honors" data-index="${index}" data-key="date" value="${item.date || ''}" placeholder="如：2023-11">
              <div class="field-actions">
                <button class="field-btn btn-copy" data-ref="honors.${index}.date" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                <button class="field-btn btn-fill-field" data-ref="honors.${index}.date" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">颁发机构/级别</label>
          <div class="form-input-wrapper">
            <input type="text" class="form-control card-input" data-type="honors" data-index="${index}" data-key="level" value="${item.level || ''}" placeholder="如：教育部 / 全国一等奖">
            <div class="field-actions">
              <button class="field-btn btn-copy" data-ref="honors.${index}.level" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="honors.${index}.level" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">奖项描述</label>
          <div class="form-input-wrapper">
            <textarea class="form-control card-input" data-type="honors" data-index="${index}" data-key="desc" placeholder="简述获奖背景、奖项内容、个人贡献或排名...">${item.desc || ''}</textarea>
            <div class="field-actions" style="top:8px;">
              <button class="field-btn btn-copy" data-ref="honors.${index}.desc" title="复制"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="field-btn btn-fill-field" data-ref="honors.${index}.desc" title="填充到当前焦点输入框"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
