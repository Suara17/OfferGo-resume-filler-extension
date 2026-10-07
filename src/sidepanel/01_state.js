// 默认数据结构
const defaultResumeData = {
  basic: {
    name: "",
    gender: "",
    ethnicity: "",        // 新增：民族
    birth: "",
    height: "",           // 新增：身高
    weight: "",           // 新增：体重
    phone: "",
    email: "",
    political: "",
    city: "",
    nativePlace: "",
    website: "",
    github: "",           // 新增：GitHub主页
    emergencyContact: "", // 新增：紧急联系人姓名
    emergencyRelation: "",// 新增：与紧急联系人关系
    emergencyPhone: "",   // 新增：紧急联系人电话
    jobIntent: "",
    selfEval: "",
    selfDescription: "",  // 新增：自我描述
    highestDegree: "",    // 新增：最高学历
    country: "",          // 新增：当前所在国家
    acceptRelocation: "", // 新增：是否接受调剂
    extraInfo: "",        // 新增：补充说明
    idCard: "",           // 新增：身份证号
    wechat: "",           // 新增：微信号
    residence: "",        // 新增：现居地（详细地址）
    resumeAttachment: null, // 简历附件对象: { fileName, dataUrl, mimeType, size }
    attachments: [] // 用户自定义附件: { id, label, pathHint, keywords, fileName, dataUrl, mimeType, size, updatedAt }
  },
  education: [], // { school, degree, major, start, end, gpa, supervisor, role, roleDescription, ... }
  internship: [], // { company: "", position: "", start: "", end: "", desc: "" }
  project: [], // { name, link, role, start, end, desc, duty, result, tech }
  competition: [], // 新增：赛事经验
  paper: [], // 新增：论文/期刊
  skills: "",
  languages: "", // 新增：语言能力
  honors: [], // { name, date, level, desc }
  family: []  // { relation: "", name: "", company: "", position: "", phone: "" }
};

let resumeData = JSON.parse(JSON.stringify(defaultResumeData));
let resumesList = [];
let activeResumeId = "default";

// DOM 元素加载完成后执行
document.addEventListener("DOMContentLoaded", async () => {
  // 初始化加载数据
  await loadFromStorage();
  await loadApiConfig(); // 加载 API 接口配置

  // 初始化绑定事件
  initTabEvents();
  initFormBindings();
  initListActionEvents();
  initSystemActionEvents();
  if (typeof initSidepanelPasswordVaultEvents === "function") {
    initSidepanelPasswordVaultEvents();
  }

  // 渲染动态列表
  renderAllLists();
  renderAttachmentsList();
  if (typeof renderSidepanelPasswordVault === "function") {
    renderSidepanelPasswordVault();
  }

  // 延迟调整所有文本框高度以适配内容
  setTimeout(adjustAllTextareas, 50);
});

// 从 Chrome Storage 加载数据
async function loadFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["resumesList", "activeResumeId", "resumeData"], (result) => {
        if (result.resumesList && result.resumesList.length > 0) {
          resumesList = result.resumesList;
          activeResumeId = result.activeResumeId || resumesList[0].id;
        } else if (result.resumeData) {
          // 自动从旧版单简历数据迁移
          console.log("检测到旧版简历数据，正在自动迁移为多版本列表...");
          resumesList = [{
            id: "default",
            name: "默认简历",
            data: result.resumeData
          }];
          activeResumeId = "default";
          
          // 保存迁移后的列表并清除旧的单简历键
          chrome.storage.local.set({ resumesList, activeResumeId });
          chrome.storage.local.remove("resumeData");
        } else {
          // 初始化默认数据
          resumesList = [{
            id: "default",
            name: "默认简历",
            data: JSON.parse(JSON.stringify(defaultResumeData))
          }];
          activeResumeId = "default";
        }
        
        // 获取当前激活 of 简历数据
        const activeResume = resumesList.find(r => r.id === activeResumeId) || resumesList[0];
        resumeData = mergeWithDefault(activeResume.data, defaultResumeData);
        
        // 渲染版本下拉框
        renderResumeVersionDropdown();
        fillBasicForm();
        resolve();
      });
    } else {
      // 兼容非插件环境测试
      const localList = localStorage.getItem("resumesList");
      const localActiveId = localStorage.getItem("activeResumeId");
      const oldLocalData = localStorage.getItem("resumeData");
      
      if (localList) {
        resumesList = JSON.parse(localList);
        activeResumeId = localActiveId || resumesList[0].id;
      } else if (oldLocalData) {
        resumesList = [{
          id: "default",
          name: "默认简历",
          data: JSON.parse(oldLocalData)
        }];
        activeResumeId = "default";
        localStorage.setItem("resumesList", JSON.stringify(resumesList));
        localStorage.setItem("activeResumeId", activeResumeId);
        localStorage.removeItem("resumeData");
      } else {
        resumesList = [{
          id: "default",
          name: "默认简历",
          data: JSON.parse(JSON.stringify(defaultResumeData))
        }];
        activeResumeId = "default";
      }
      
      const activeResume = resumesList.find(r => r.id === activeResumeId) || resumesList[0];
      resumeData = mergeWithDefault(activeResume.data, defaultResumeData);
      
      renderResumeVersionDropdown();
      fillBasicForm();
      resolve();
    }
  });
}

// 递归合并对象，确保旧数据升级时拥有新字段
function mergeWithDefault(obj, defaults) {
  if (obj === null || typeof obj !== 'object') return defaults;
  const result = Array.isArray(obj) ? [] : {};
  
  // 复制默认结构
  for (let key in defaults) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        result[key] = mergeWithDefault(obj[key], defaults[key]);
      } else {
        result[key] = obj[key];
      }
    } else {
      result[key] = JSON.parse(JSON.stringify(defaults[key]));
    }
  }
  
  // 保留 obj 中原本拥有但 defaults 里没有的字段（如有）
  for (let key in obj) {
    if (!result.hasOwnProperty(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

// 保存数据到 Chrome Storage
function saveToStorage() {
  // 同步当前活跃简历的数据到 resumesList 中
  const activeIdx = resumesList.findIndex(r => r.id === activeResumeId);
  if (activeIdx !== -1) {
    resumesList[activeIdx].data = resumeData;
  }
  
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ resumesList, activeResumeId }, () => {
      console.log("数据已自动保存");
    });
  } else {
    localStorage.setItem("resumesList", JSON.stringify(resumesList));
    localStorage.setItem("activeResumeId", activeResumeId);
  }
}

// 填充基本信息和专业技能的表单
function fillBasicForm() {
  // 填充基本信息输入框
  document.querySelectorAll("[data-key^='basic.']").forEach((input) => {
    const key = input.getAttribute("data-key").split(".")[1];
    input.value = resumeData.basic[key] || "";
  });

  // 填充技能文本域
  const skillsTextarea = document.querySelector("[data-key='skills']");
  if (skillsTextarea) {
    skillsTextarea.value = resumeData.skills || "";
  }

  // 填充语言能力文本域
  const languagesTextarea = document.querySelector("[data-key='languages']");
  if (languagesTextarea) {
    languagesTextarea.value = resumeData.languages || "";
  }

  // 渲染简历附件状态
  const attNameEl = document.getElementById("resume-attachment-name");
  const attSizeEl = document.getElementById("resume-attachment-size");
  const removeBtn = document.getElementById("btn-remove-attachment");
  const att = resumeData.basic && resumeData.basic.resumeAttachment;
  if (att && att.dataUrl) {
    if (attNameEl) attNameEl.textContent = att.fileName || "已上传简历附件";
    const sizeKb = att.size ? Math.round(att.size / 1024) : 0;
    if (attSizeEl) attSizeEl.textContent = sizeKb > 0 ? `${sizeKb} KB` : "已上传";
    if (removeBtn) removeBtn.style.display = "inline-flex";
  } else {
    if (attNameEl) attNameEl.textContent = "未选择文件";
    if (attSizeEl) attSizeEl.textContent = "未绑定";
    if (removeBtn) removeBtn.style.display = "none";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}

function formatAttachmentSize(size) {
  if (!size) return "未绑定文件";
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
}

function ensureAttachments() {
  if (!resumeData.basic) resumeData.basic = {};
  if (!Array.isArray(resumeData.basic.attachments)) resumeData.basic.attachments = [];
  return resumeData.basic.attachments;
}

function renderAttachmentsList() {
  const list = document.getElementById("attachments-list");
  const count = document.getElementById("attachments-count");
  if (!list) return;
  const attachments = ensureAttachments();
  if (count) count.textContent = `${attachments.length} 项`;
  if (attachments.length === 0) {
    list.innerHTML = `<div style="padding: 16px 10px; text-align: center; color: #64748b; font-size: 12px; border: 1px dashed #cbd5e1; border-radius: 8px;">尚未添加附件。添加后填写名称、匹配关键词和本机路径参考，再通过“选择文件”绑定上传文件。</div>`;
    return;
  }
  list.innerHTML = attachments.map((item, index) => {
    const bound = item.dataUrl ? `已绑定 · ${escapeHtml(formatAttachmentSize(item.size))}` : "未绑定文件";
    return `<div class="card" style="margin-bottom: 10px; padding: 10px; border: 1px solid #e2e8f0; box-shadow: none;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
        <strong style="font-size:12px; color:#334155;">附件 ${index + 1}</strong>
        <button type="button" class="btn btn-danger btn-sm btn-delete-attachment" data-index="${index}" style="padding:3px 8px;">删除</button>
      </div>
      <label class="form-label" style="font-size:11px;">附件名称 <span style="color:#ef4444;">*</span></label>
      <input class="form-control attachment-input" data-index="${index}" data-key="label" value="${escapeHtml(item.label)}" placeholder="如：研究生成绩单">
      <label class="form-label" style="font-size:11px; margin-top:7px;">匹配关键词</label>
      <input class="form-control attachment-input" data-index="${index}" data-key="keywords" value="${escapeHtml(item.keywords)}" placeholder="如：成绩单, transcript, 成绩">
      <label class="form-label" style="font-size:11px; margin-top:7px;">本机完整路径（仅作参考，不会被扩展自动读取）</label>
      <input class="form-control attachment-input" data-index="${index}" data-key="pathHint" value="${escapeHtml(item.pathHint)}" placeholder="如：E:\文档\研究生成绩单.pdf">
      <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="file" class="attachment-file-input" data-index="${index}" style="display:none;" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip">
        <button type="button" class="btn btn-secondary btn-sm btn-bind-attachment" data-index="${index}">选择文件</button>
        <span style="font-size:11px; color:${item.dataUrl ? "#047857" : "#64748b"}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.fileName || bound)}</span>
      </div>
      <div style="font-size:10.5px; color:#64748b; margin-top:5px;">${item.dataUrl ? `已绑定：${escapeHtml(item.fileName || "文件")}` : "需通过文件选择器绑定后才能自动上传"}</div>
    </div>`;
  }).join("");
}
