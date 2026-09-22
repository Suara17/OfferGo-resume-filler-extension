// 缓存最后一个聚焦的输入元素
let lastActiveElement = null;

// 监听页面的聚焦 (focus) 和点击 (click) 事件，记录用户当前选中的输入框
document.addEventListener("focus", (e) => {
  if (isEditableElement(e.target)) {
    lastActiveElement = e.target;
  }
}, true);

document.addEventListener("click", (e) => {
  if (isEditableElement(e.target)) {
    lastActiveElement = e.target;
  }
}, true);

// 判断是否是可编辑/可填充的表单元素 (支持常规输入框、下拉框以及大厂富文本 contenteditable 编辑器)
function isEditableElement(el) {
  if (!el) return false;
  // 排除悬浮窗内部的元素，防止点击悬浮卡片时抢走页面真实的输入框焦点
  if (el.closest && el.closest('#resume-filler-extension-host')) return false;
  if (el.getRootNode && el.getRootNode() instanceof ShadowRoot) return false;
  const tagName = el.tagName;
  const isInput = tagName === "INPUT" && !["button", "submit", "reset", "file", "radio", "checkbox", "image"].includes(el.type);
  const isTextarea = tagName === "TEXTAREA";
  const isSelect = tagName === "SELECT";
  const isContentEditable = el.isContentEditable || el.getAttribute("contenteditable") === "true";
  return isInput || isTextarea || isSelect || isContentEditable;
}

// 注入视觉高亮标记样式 (绿框: 成功填入, 橙框: 建议人工核对, 浮层摘要)
function injectMarkStyles() {
  if (document.getElementById("rf-mark-styles")) return;
  const style = document.createElement("style");
  style.id = "rf-mark-styles";
  style.textContent = `
    [data-rf-mark="filled"] {
      outline: 2px solid #10b981 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    [data-rf-mark="uncertain"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.25) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    #rf-summary-badge {
      position: fixed;
      bottom: 24px;
      right: 175px;
      z-index: 2147483640;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 320px;
      user-select: none;
      animation: rfSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes rfSlideUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rf-sum-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-weight: 700;
      font-size: 12px;
    }
    .rf-sum-close {
      cursor: pointer;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1;
    }
    .rf-sum-close:hover { color: #ffffff; }
    .rf-sum-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
    }
    .rf-sum-green { color: #34d399; font-weight: 600; }
    .rf-sum-orange { color: #fbbf24; font-weight: 600; }
    .rf-sum-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 110px;
      overflow-y: auto;
      margin-top: 2px;
      padding-right: 4px;
    }
    .rf-sum-items::-webkit-scrollbar { width: 3px; }
    .rf-sum-items::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .rf-sum-item {
      color: #cbd5e1;
      font-size: 11px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.12s ease, color 0.12s ease;
    }
    .rf-sum-item:hover {
      background: rgba(255,255,255,0.12);
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);
}

// 标记元素已填充或待确认
function markElement(element, status, title) {
  if (!element || !element.setAttribute) return;
  injectMarkStyles();
  element.setAttribute("data-rf-mark", status);
  if (title) element.setAttribute("data-rf-title", title);
}

// 清除页面所有高亮标记
function clearMarks() {
  document.querySelectorAll("[data-rf-mark]").forEach(el => {
    el.removeAttribute("data-rf-mark");
    el.removeAttribute("data-rf-title");
  });
  const badge = document.getElementById("rf-summary-badge");
  if (badge) badge.remove();
}

// 渲染智能填充结果悬浮徽章小清单
function showAutofillSummaryBadge(filledCount, uncertainList) {
  injectMarkStyles();
  let badge = document.getElementById("rf-summary-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "rf-summary-badge";
    document.body.appendChild(badge);
  }

  const hasUncertain = uncertainList && uncertainList.length > 0;
  badge.innerHTML = `
    <div class="rf-sum-header">
      <span>🎯 智能填充报告</span>
      <button class="rf-sum-close" id="rf-close-summary-badge" title="关闭并清除高亮标记">✕</button>
    </div>
    <div class="rf-sum-stats">
      <span class="rf-sum-green">🟢 已自动填入 ${filledCount} 项</span>
      ${hasUncertain ? `<span class="rf-sum-orange">🟠 建议核对 ${uncertainList.length} 项</span>` : ''}
    </div>
    ${hasUncertain ? `
      <div class="rf-sum-items">
        ${uncertainList.slice(0, 6).map((u, i) => `
          <div class="rf-sum-item" data-uncertain-idx="${i}" title="点击定位到该输入框">
            <span>👉</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.label}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  badge.querySelector("#rf-close-summary-badge")?.addEventListener("click", () => {
    clearMarks();
  });

  if (hasUncertain) {
    badge.querySelectorAll(".rf-sum-item").forEach(itemEl => {
      itemEl.addEventListener("click", () => {
        const idx = parseInt(itemEl.getAttribute("data-uncertain-idx"), 10);
        const target = uncertainList[idx]?.element;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus();
          // 闪烁高亮提示
          target.classList.add("rf-fill-pulse");
          setTimeout(() => target.classList.remove("rf-fill-pulse"), 800);
        }
      });
    });
  }

  // 15 秒后自动平滑淡出徽章 (保留输入框边框颜色)
  setTimeout(() => {
    if (badge && badge.parentNode) {
      badge.style.transition = "opacity 0.5s ease";
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 500);
    }
  }, 15000);
}

// ==================== 智能匹配关键词及规则配置 ====================

const KEYWORDS = {
  // 基本信息
  name: ['姓名', '名字', 'name', 'username', 'realname', 'real name', '真实姓名'],
  lastName: ['姓氏', '姓', 'last name', 'lastname', 'family name', 'surname'],
  firstName: ['名字', '名', 'first name', 'firstname', 'given name'],
  gender: ['性别', 'gender', 'sex', '男', '女'],
  ethnicity: ['民族', 'ethnicity', 'nationality', '民 族'],
  birth: ['生日', '出生', '出生日期', '出生年月', 'birth', 'birthday', 'date of birth', 'dateofbirth', '年龄', 'age'],
  height: ['身高', 'height', '身 高', '身长'],
  weight: ['体重', 'weight', '体 重'],
  phone: ['手机', '电话', '联系电话', '手机号', 'phone', 'mobile', 'tel', 'contact', '联系方式'],
  email: ['邮箱', '邮件', '电子邮箱', 'email', 'mail'],
  political: ['政治面貌', '政治', 'political', 'politics', '面貌'],
  city: ['城市', '现居城市', '居住城市', '所在地', 'city', 'location'],
  nativePlace: ['籍贯', '家乡', 'hometown', 'native place', 'birthplace', '生源地', '户籍', '户口所在地'],
  nativeProvince: ['户籍所在省', '户口所在省', '户籍省', '籍贯省', '出生省', '生源省', '省份', '省'],
  nativeCity: ['户籍所在地市', '户口所在地市', '户籍市', '籍贯市', '出生城市', '生源城市', '城市', '市'],
  residenceProvince: ['现居住省', '现居住地省', '现居省', '居住省', '所在省', '现住省', '居住地省'],
  residenceCity: ['现居住市', '现居住地市', '现居市', '居住市', '所在市', '现住市', '居住地市'],
  idCard: ['身份证', '身份证号', '身份证号码', '证件号码', '证件号', 'id card', 'idcard', 'id number', 'id_number', 'identity card', '公民身份号码'],
  wechat: ['微信', '微信号', '微信账号', 'wechat', 'weixin'],
  residence: ['现居地', '现居住地', '居住地', '居住地址', '现住址', '家庭住址', '通讯地址', '联系地址', '详细地址', '地址', 'residence', 'address', 'current address', 'home address', 'mailing address'],
  website: ['个人网站', '个人主页', '网站', '博客', '主页', 'website', 'blog', 'homepage', '个人网页', '作品集'],
  github: ['github', 'git', 'github主页', 'github链接', 'github地址', 'github repository'],
  emergencyContact: ['紧急联系人姓名', '紧急联系人名字', '紧急联系人', '联系人姓名', '紧急人', 'emergency contact name', 'emergency contact'],
  emergencyRelation: ['紧急联系人关系', '与紧急联系人关系', '与本人关系', '关系', '亲属关系', 'emergency relation', 'relationship'],
  emergencyPhone: ['紧急联系人电话', '紧急联系人手机', '紧急联系电话', '紧急联系方式', 'emergency contact phone', 'emergency phone'],
  jobIntent: ['意向', '岗位', '职位', 'job', 'position', 'intent', 'role', '求职岗位'],
  selfEval: ['自我评价', '评价', '自我介绍', 'intro', 'evaluation', 'describe yourself', '简评'],
  selfDescription: ['自我描述', '个人描述', '性格特质', '特质描述', '工作风格', 'self description', 'self_description', 'personal description'],
  highestDegree: ['最高学历', '学历', '学位', 'highest degree', 'highestdegree'],
  country: ['国家', '当前所在国家', '国籍', 'country', 'nationality', '所在地区', '国家地区'],
  acceptRelocation: ['调剂', '是否接受调剂', '接受城市调剂', '是否接受意向城市调剂', 'relocation', 'relocate'],
  extraInfo: ['补充', '补充说明', '其他说明', 'extra info', 'supplementary', '备注'],
  
  // 技能
  skills: ['专业技能', '技能', '技术栈', 'it技能', 'skills', 'skill', 'technologies', '特长'],
  languages: ['语言', '语言能力', '外语', '外语水平', '语言证书', 'languages', 'english', 'cet', 'ielts'],

  // 教育经历子字段
  education: {
    school: ['学校', '大学', '学院', '毕业院校', '毕业学校', 'school', 'university', 'college'],
    degree: ['学历', '学位', 'degree', 'education', 'level', '文化程度'],
    major: ['专业', '学科', 'major', 'discipline', 'subject', '主修专业', '专业名称'],
    gpa: ['gpa', '绩点', '排名', '成绩排名', '成绩', 'rank', 'score', '成绩绩点', '平均分'],
    start: ['入学', '开始', '教育开始', 'start', 'from'],
    end: ['毕业', '结束', '教育结束', 'end', 'to', '毕业时间', '毕业年份'],
    startYear: ['入学年', '入学年份', '开始年', '开始年份', '教育开始年', 'start year', 'start_year'],
    startMonth: ['入学月', '入学月份', '开始月', '开始月份', 'start month', 'start_month'],
    endYear: ['毕业年', '毕业年份', '结束年', '结束年份', 'end year', 'graduation year', 'end_year'],
    endMonth: ['毕业月', '毕业月份', '结束月', '结束月份', 'end month', 'graduation month', 'end_month'],
    supervisor: ['导师', '导师姓名', '指导老师', '指导教师', 'advisor', 'tutor', 'supervisor'],
    majorDescription: ['专业描述', '专业介绍', '主修专业介绍', '专业概况', 'major description'],
    thesisTopic: ['毕业论文', '毕业设计', '毕业作品', '毕设', '论文题目', '毕设题目', 'thesis', 'graduation project', 'graduation thesis'],
    courses: ['课程', '主修', '核心课程', '专业课程', '主修课程', '主修专业课程', '所修课程', 'courses', 'coursework', 'main courses'],
    researchDirection: ['研究方向', '研究课题', '研究领域', '研究内容', 'research direction', 'research field', 'research area'],
    department: ['院系', '院系名称', '学院名称', 'department', 'faculty', 'college'],
    labExperience: ['实验室', '实验室经历', '科研经历', 'lab', 'laboratory'],
    studentId: ['学号', '学籍号', 'student id', 'studentid', 'student number', 'student_no'],
    schoolLocation: ['学校所在地', '学校所在城市', '学校地址', '院校所在地', '学校城市', 'school location', 'university location', 'school address']
  },

  // 工作实习子字段
  internship: {
    company: ['公司', '单位', '企业', '工作单位', '实习单位', 'company', 'organization', 'employer', 'workplace', '公司名称'],
    position: ['职位', '岗位', '角色', 'position', 'title', 'role', '工作岗位', '职位名称'],
    start: ['入职', '开始', '入职时间', 'start', 'from'],
    end: ['离职', '结束', '离职时间', 'end', 'to', 'until'],
    desc: ['职责', '描述', '工作内容', '工作描述', '业绩', 'desc', 'description', 'responsibility', 'duty', '工作职责']
  },

  // 项目经历子字段
  project: {
    name: ['项目名称', '项目名字', '项目', 'project name', 'project title'],
    role: ['角色', '担任角色', '职位', 'role', 'position', '职责'],
    start: ['开始', '项目开始', 'start', 'from'],
    end: ['结束', '项目结束', 'end', 'to'],
    desc: ['项目描述', '项目介绍', '项目背景', '项目简介', '项目概述', 'project desc', 'project description', 'proj_desc', 'project summary'],
    duty: ['项目职责', '工作职责', '主要职责', '负责内容', '职责描述', '工作内容', '担任职责', 'project duty', 'project duties', 'responsibility', 'responsibilities', 'duty', 'duties'],
    result: ['项目成果', '项目业绩', '量化成果', '项目收益', '项目产出', '取得成果', 'project result', 'project results', 'project achievement', 'project achievements', 'achievements', 'project outcome'],
    tech: ['项目技术', '技术栈', '主要技术', '使用技术', 'tech', 'technologies', 'technology', 'tools']
  },

  // 赛事经历子字段
  competition: {
    name: ['赛事', '竞赛', '比赛', '赛事名称', '竞赛名称', 'competition name', 'contest name'],
    start: ['开始', '比赛开始', 'start', 'from'],
    end: ['结束', '比赛结束', 'end', 'to'],
    desc: ['描述', '成绩', '奖项', '赛事描述', '竞赛描述', 'desc', 'description']
  },

  // 论文期刊子字段
  paper: {
    title: ['论文', '期刊', '专利', '论文名称', '文献', 'paper title', 'publication title', '名称'],
    desc: ['论文描述', '摘要', '内容', 'desc', 'abstract', 'description', '描述'],
    result: ['发表', '成果', '期刊级别', '分区', 'result', 'status', 'journal']
  },

  // 荣誉奖项子字段
  honors: {
    name: ['奖项', '荣誉', '名称', '奖项名称', 'award', 'honor', 'title'],
    date: ['时间', '获奖时间', '日期', 'date', 'year'],
    level: ['机构', '级别', '颁发', '颁发机构', 'issuer', 'organization', 'level']
  },

  // 家庭成员子字段 (国企/传统大厂高频)
  family: {
    relation: ['与本人关系', '家庭关系', '亲属关系', '关系'],
    name: ['家属姓名', '亲属姓名', '姓名', '成员姓名'],
    company: ['工作单位', '单位名称', '单位', '公司'],
    position: ['职务', '职位', '担任职务'],
    phone: ['联系电话', '手机', '电话']
  }
};

// 强指示词定义 (按精细度排序：具体复合字段排在通用字段之前，严格规避截胡)
const STRONG_INDICATORS = [
  // 1. 紧急联系人细项 (电话/关系必须在姓名之前，防止包含“紧急联系人”被截胡)
  { section: 'basic', subKey: 'emergencyPhone', keywords: ['紧急联系人电话', '紧急联系人手机', '紧急联系电话', 'emergency contact phone', 'emergency phone'] },
  { section: 'basic', subKey: 'emergencyRelation', keywords: ['与紧急联系人关系', '紧急联系人关系', '与本人关系', '与联系人关系', 'emergency relation', 'relationship'] },
  { section: 'basic', subKey: 'emergencyContact', keywords: ['紧急联系人姓名', '紧急联系人名字', '联系人姓名', '紧急联系人', 'emergency contact name', 'emergency contact'] },

  // 2. 导师姓名与教育细项 (必须在通用姓名之前)
  { section: 'education', subKey: 'supervisor', keywords: ['导师姓名', '指导老师姓名', '指导老师', '导师', 'advisor name', 'supervisor name', 'advisor', 'tutor', 'supervisor'] },
  { section: 'education', subKey: 'school', keywords: ['最高学历学校', '最高学历院校', '毕业学校', '毕业院校', '就读学校', '就读院校', '毕业大学', '学校名称', '院校名称', 'school name', 'university name'] },
  { section: 'education', subKey: 'degree', keywords: ['最高学历', '最高学位', '毕业学历', '学历学位'] },
  { section: 'education', subKey: 'startYear', keywords: ['入学年份', '入学年度', '开始年份', '教育开始年', 'start year', 'start_year', 'edu_start_year'] },
  { section: 'education', subKey: 'startMonth', keywords: ['入学月份', '开始月份', 'start month', 'start_month', 'edu_start_month'] },
  { section: 'education', subKey: 'endYear', keywords: ['毕业年份', '毕业年度', '结束年份', '毕业时间年', 'graduation year', 'end year', 'end_year', 'edu_end_year'] },
  { section: 'education', subKey: 'endMonth', keywords: ['毕业月份', '结束月份', '毕业时间月', 'graduation month', 'end month', 'end_month', 'edu_end_month'] },
  { section: 'education', subKey: 'start', keywords: ['入学时间', '入学年月', '就读时间', '开始时间', '入学日期', 'start date', 'start time', 'edu_start_date'] },
  { section: 'education', subKey: 'end', keywords: ['毕业时间', '毕业年月', '就读结束时间', '结束时间', '毕业日期', 'graduation date', 'end date', 'edu_end_date'] },
  { section: 'education', subKey: 'majorDescription', keywords: ['专业描述', '专业介绍', '主修专业介绍', '专业概况', 'major description', 'major desc'] },
  { section: 'education', subKey: 'thesisTopic', keywords: ['毕业论文', '毕业设计', '毕业作品', '毕业论文题目', '毕业设计题目', '毕设题目', '毕业论文/设计', '毕业论文/设计/作品', 'thesis', 'graduation project'] },
  { section: 'education', subKey: 'courses', keywords: ['主修课程', '核心课程', '专业课程', '核心专业课程', '主修专业课程', '所修课程', 'main courses', 'core courses', 'courses'] },
  { section: 'education', subKey: 'researchDirection', keywords: ['研究方向', '研究课题', '研究领域', 'research direction', 'research field'] },
  { section: 'education', subKey: 'department', keywords: ['院系名称', '学院名称'] },
  { section: 'education', subKey: 'studentId', keywords: ['学号', '学籍号', 'student id', 'studentid', 'student number'] },
  { section: 'education', subKey: 'schoolLocation', keywords: ['学校所在地', '学校所在城市', '学校地址', '院校所在地', '学校城市', 'school location', 'university location', 'school address'] },

  // 3. 家庭成员强指示词 (必须在通用姓名/单位/电话之前)
  { section: 'family', subKey: 'name', keywords: ['家庭成员姓名', '亲属姓名', '父亲姓名', '母亲姓名', '家属姓名'] },
  { section: 'family', subKey: 'company', keywords: ['家庭成员工作单位', '亲属工作单位', '家属工作单位', '父亲工作单位', '母亲工作单位', '父母单位'] },
  { section: 'family', subKey: 'phone', keywords: ['家庭成员电话', '亲属电话', '家属电话', '父亲电话', '母亲电话', '父母电话', '父亲联系电话', '母亲联系电话', '家属联系电话', '亲属联系电话', '父母联系电话'] },
  { section: 'family', subKey: 'position', keywords: ['家庭成员职务', '亲属职务', '家属职务', '父亲职务', '母亲职务'] },
  { section: 'family', subKey: 'relation', keywords: ['家庭成员关系', '亲属关系'] },

  // 4. 工作实习与项目经历
  { section: 'internship', subKey: 'company', keywords: ['公司名称', '单位名称', '企业名称', '实习单位', '工作单位', 'company name', 'work_company', 'intern_company'] },
  { section: 'internship', subKey: 'position', keywords: ['实习岗位', '实习职位', '工作岗位', '工作职位', 'internship position', 'intern_position', 'work_position'] },
  { section: 'internship', subKey: 'desc', keywords: ['实习描述', '工作描述', '实习内容', '工作内容', '实习职责', '工作职责', 'internship desc', 'work desc', 'internship description', '工作职责'] },
  { section: 'project', subKey: 'name', keywords: ['项目名称', '项目名字', 'project name', 'project title', 'proj_name'] },
  { section: 'project', subKey: 'role', keywords: ['项目角色', '项目担任角色', '项目职位', 'project role', 'proj_role'] },
  { section: 'project', subKey: 'desc', keywords: ['项目描述', '项目介绍', '项目背景', 'project desc', 'project description', 'proj_desc'] },
  { section: 'project', subKey: 'duty', keywords: ['项目职责', '负责内容', '主要职责', '工作职责', 'project duty', 'project duties', 'responsibility', 'proj_duty'] },
  { section: 'project', subKey: 'result', keywords: ['项目成果', '项目业绩', '量化成果', '项目收益', 'project result', 'project results', 'project achievement', 'proj_result'] },
  { section: 'project', subKey: 'tech', keywords: ['项目技术', '项目技术栈', 'project tech', 'project technology', 'proj_tech'] },

  // 5. 基础信息专项拆分与强指示词 (高特异性字段排在最前面，防止被通用姓名截胡)
  { section: 'basic', subKey: 'email', keywords: ['电子邮箱', '电子信箱', '联系邮箱', '个人邮箱', '常用邮箱', '我的邮箱', '邮箱地址', '邮箱', 'email', 'e-mail', 'mail address', 'mail'] },
  { section: 'basic', subKey: 'phone', keywords: ['手机号码', '联系电话', '手机号', '移动电话', '电话号码', '常用手机', '手机', 'phone', 'mobile', 'tel'] },
  { section: 'basic', subKey: 'lastName', keywords: ['姓氏', '姓', 'lastname', 'last name', 'family name', 'surname'] },
  { section: 'basic', subKey: 'firstName', keywords: ['名字', '名', 'firstname', 'first name', 'given name'] },
  { section: 'basic', subKey: 'idCard', keywords: ['身份证号码', '身份证号', '证件号码', '证件号', '身份证件号', '身份证', '公民身份证', '公民身份号码', 'id card', 'idcard', 'id number', 'identity card'] },
  { section: 'basic', subKey: 'name', keywords: ['真实姓名', '您的姓名', '中文姓名', '本人姓名', 'candidate name', 'applicant name', '姓名'] },
  { section: 'basic', subKey: 'height', keywords: ['身高', 'height', '身 高', '身长'] },
  { section: 'basic', subKey: 'weight', keywords: ['体重', 'weight', '体 重'] },
  { section: 'basic', subKey: 'ethnicity', keywords: ['民族', 'ethnicity', 'nationality', '民 族', '所属民族', '名族'] },
  { section: 'basic', subKey: 'nativeProvince', keywords: ['户籍所在地省', '户籍所在省', '户口所在地省', '户籍省', '籍贯省', '出生省', '生源省'] },
  { section: 'basic', subKey: 'nativeCity', keywords: ['户籍所在地市', '户籍所在市', '户口所在地市', '户籍市', '籍贯市', '出生城市', '生源市'] },
  { section: 'basic', subKey: 'residenceProvince', keywords: ['现居住省', '现居住地省', '现居省', '居住省', '所在省', '现住省', '居住地省'] },
  { section: 'basic', subKey: 'residenceCity', keywords: ['现居住市', '现居住地市', '现居市', '居住市', '所在市', '现住市', '居住地市'] },
  { section: 'basic', subKey: 'nativePlace', keywords: ['户口所在地', '生源所在地', '户籍所在地', '生源地', '户籍地', '户口地', '籍贯', '户籍地址', '户口地址', '生源地址', '籍贯地址', 'hometown', 'native place', 'birthplace'] },
  { section: 'basic', subKey: 'selfDescription', keywords: ['自我描述', '个人描述', '性格特质', '特质描述', 'self description', 'self_description'] },
  { section: 'basic', subKey: 'selfEval', keywords: ['自我评价', '自我介绍', 'self evaluation', 'self_eval'] },

  // 6. 赛事/论文/荣誉
  { section: 'competition', subKey: 'name', keywords: ['赛事名称', '竞赛名称', '比赛名称'] },
  { section: 'paper', subKey: 'title', keywords: ['论文名称', '期刊名称', '专利名称'] },
  { section: 'honors', subKey: 'name', keywords: ['奖项名称', '荣誉名称', '奖项名字', 'award name', 'honor name'] }
];

// 基础信息匹配排除词 (防止全局匹配错乱)
const EXCLUSIONS = {
  name: [
    '项目', '公司', '大学', '学校', '学院', '紧急', '联系人', '推荐', '家长', '老师', '导师', '单位', '奖', '荣誉', '亲属', '成员', '证明人', '推荐人',
    '姓氏', 'last name', 'lastname', 'family name', 'surname', 'first name', 'firstname',
    '邮箱', '邮件', '电子邮箱', 'email', 'e-mail', 'mail',
    '手机', '电话', '联系电话', '手机号', 'phone', 'mobile', 'tel',
    '身份证', '证件号', 'idcard', '微信号', 'wechat', '微信', '籍贯', '地址', '专业', '学历'
  ],
  lastName: ['姓名', '全名', 'real name', 'username', '真实姓名', '项目', '公司', '学校', '学院', '院校', '名称'],
  firstName: ['姓名', '全名', 'real name', 'username', '真实姓名', '项目', '公司', '学校', '学院', '院校', '签名', '域名', '名次', '名称'],
  phone: ['紧急', '联系人', '推荐', '家长', '老师', '导师', '公司', '单位', '亲属', '成员', '学校', '大学', '证明人', '推荐人', '父亲', '母亲', '父母', '家属'],
  email: ['联系人', '推荐', '公司', '单位', '亲属', '成员', '学校', '大学', '证明人', '推荐人'],
  jobIntent: ['项目', '公司', '实习', '学校', '专业'],
  city: ['公司', '学校', '大学', '项目', '实习', '省'],
  nativePlace: ['所在省', '所在地省', '所在市', '所在地市', '所属省', '所属市', '省份', '城市'],
  nativeProvince: ['现居', '居住', '现住', '学校', '大学', '公司', '市', '区', '县'],
  nativeCity: ['现居', '居住', '现住', '学校', '大学', '公司', '省'],
  residenceProvince: ['户籍', '籍贯', '生源', '学校', '大学', '公司', '市', '区', '县'],
  residenceCity: ['户籍', '籍贯', '生源', '学校', '大学', '公司', '省'],
  idCard: ['证书', '银行卡', '护照'],
  residence: ['公司', '单位', '学校', '大学', '项目', '实习', '紧急'],
  website: ['github', 'git'],
  github: ['博客', '主页', 'homepage', 'blog'],
  height: ['体重', 'weight', '重'],
  weight: ['身高', 'height', '身'],
  emergencyContact: ['公司', '项目', '学校', '大学', '电话', '手机', '关系', 'phone', 'relation'],
  emergencyPhone: ['公司', '单位', '学校', '大学', '姓名', '名字', '关系', 'name', 'relation'],
  emergencyRelation: ['姓名', '名字', '电话', '手机', 'phone', 'name']
};

// ==================== DOM 上下文分析逻辑 ====================

// 判断一个元素是否为标题/头部标记
function isHeaderElement(el) {
  if (!el) return false;
  if (/^(H[1-6]|LEGEND)$/i.test(el.tagName)) return true;
  const className = (el.className || '').toString().toLowerCase();
  const idName = (el.id || '').toString().toLowerCase();
  return className.includes('title') || className.includes('header') || className.includes('legend') ||
         idName.includes('title') || idName.includes('header');
}

// 寻找最邻近的前置标题，判断当前属于哪个表单板块（教育、项目、实习、荣誉、基本信息等）
function getContextSection(el) {
  let current = el;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      let header = null;
      if (isHeaderElement(sibling)) {
        header = sibling;
      } else {
        // 在兄弟节点中寻找包含标题类/标题标签的子元素
        header = (typeof sibling.querySelector === "function") ? sibling.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="header"], legend') : null;
      }
      
      if (header) {
        const text = header.textContent.toLowerCase();
        if (text.includes('教育') || text.includes('education') || text.includes('学校') || text.includes('academic') || text.includes('学业')) {
          return 'education';
        }
        if (text.includes('项目') || text.includes('project')) {
          return 'project';
        }
        if (text.includes('工作') || text.includes('实习') || text.includes('experience') || text.includes('internship') || text.includes('work') || text.includes('职业')) {
          return 'internship';
        }
        if (text.includes('家庭') || text.includes('亲属') || text.includes('家属') || text.includes('family') || text.includes('社会关系')) {
          return 'family';
        }
        if (text.includes('荣誉') || text.includes('奖') || text.includes('award') || text.includes('honor') || text.includes('证书')) {
          return 'honors';
        }
        if (text.includes('基本') || text.includes('联系') || text.includes('个人') || text.includes('contact') || text.includes('basic') || text.includes('personal')) {
          return 'basic';
        }
        if (text.includes('比赛') || text.includes('赛事') || text.includes('竞赛') || text.includes('competition') || text.includes('contest')) {
          return 'competition';
        }
        if (text.includes('论文') || text.includes('期刊') || text.includes('专利') || text.includes('文献') || text.includes('paper') || text.includes('publication')) {
          return 'paper';
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return null;
}

// 获取输入框最直接、最精准的关联标签 (Direct Label)，彻底杜绝父级/祖先容器的大标题污染
function getElementDirectLabel(element) {
  if (!element) return "";

  // 1. 标准 label[for] 关联
  if (element.id) {
    try {
      const l = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (l) {
        const text = (l.innerText || l.textContent || "").trim();
        if (text && text.length < 35) return text.replace(/[:：\*]/g, '').trim();
      }
    } catch(e) {}
  }

  // 2. 被 label 直接包裹
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const text = (parentLabel.innerText || parentLabel.textContent || "").trim();
    if (text && text.length < 35) return text.replace(/[:：\*]/g, '').trim();
  }

  // 3. 直接前置兄弟节点或前一个具有文本的兄弟
  let prev = element.previousElementSibling;
  while (prev) {
    const text = (prev.innerText || prev.textContent || "").trim();
    if (text && text.length > 0 && text.length < 30) {
      return text.replace(/[:：\*]/g, '').trim();
    }
    prev = prev.previousElementSibling;
  }

  // 4. 适配主流招聘系统 (Moka/北森/飞书/AntD/Element) 的直接 form-item 表单项内部标签
  const formItem = element.closest('.form-item, .form-group, [class*="form-item" i], [class*="form-group" i], [class*="field" i], tr');
  if (formItem) {
    const directLabelEl = formItem.querySelector('label, [class*="label" i], th');
    if (directLabelEl && !directLabelEl.contains(element)) {
      const text = (directLabelEl.innerText || directLabelEl.textContent || "").trim();
      if (text && text.length > 0 && text.length < 35) {
        return text.replace(/[:：\*]/g, '').trim();
      }
    }
  }

  return "";
}

// 获取输入框周围的所有文本线索，用来做模糊识别
function getElementClues(element) {
  let clues = [];
  
  const directLabel = getElementDirectLabel(element);
  if (directLabel) {
    clues.push(directLabel.toLowerCase());
  }

  if (element.placeholder) {
    clues.push(element.placeholder.toLowerCase());
  }
  if (element.name) {
    clues.push(element.name.toLowerCase());
  }
  if (element.id) {
    clues.push(element.id.toLowerCase());
  }
  if (element.getAttribute("aria-label")) {
    clues.push(element.getAttribute("aria-label").toLowerCase());
  }
  
  // 后置兄弟节点文本 (如 [下拉框] 年, [下拉框] 月, 至, 到, -- 等关键线索)
  let next = element.nextSibling;
  if (next) {
    const text = next.textContent ? next.textContent.trim() : (next.nodeValue ? next.nodeValue.trim() : "");
    if (text && text.length < 20) clues.push(text.toLowerCase());
  }
  let nextEl = element.nextElementSibling;
  if (nextEl) {
    const text = (nextEl.innerText || nextEl.textContent || "").trim();
    if (text && text.length < 20) clues.push(text.toLowerCase());
  }

  // 过滤特殊字符并移除多余空字符
  return clues.map(c => c.trim().replace(/[:：\*]/g, '')).filter(c => c.length > 0);
}

// 检查线索中是否包含指定的关键词
function isMatch(clues, keywords) {
  return clues.some(clue => {
    return keywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      
      // 特殊单字防误伤防护：
      // 1. 单字“名”：防止“学校名称”、“公司名称”、“项目名称”、“姓名”误命中单字“名”
      if (keyword === "名") {
        if (/学校|院校|单位|公司|项目|姓名|全名|realname|username|域名|名次|签名|名称/i.test(clue)) {
          return false;
        }
        return /(?:^|[\s\(/（/\\_-])名(?:$|[\s\)/）/\\*：:_-])|first\s*name|given\s*name/i.test(clue) || clue === "名";
      }

      // 2. 单字“姓”：防止“姓名”、“真实姓名”误命中单字“姓”
      if (keyword === "姓") {
        if (/姓名|全名|realname|username/i.test(clue)) {
          return false;
        }
        return /(?:^|[\s\(/（/\\_-])姓(?:$|[\s\)/）/\\*：:_-])|last\s*name|family\s*name|surname/i.test(clue) || clue === "姓";
      }

      // 3. 仅对英文短单词 (长度 <= 3) 启用单词边界匹配，防止 substring 误伤 (如 end 匹配 gender)
      if (lowerKeyword.length <= 3 && /^[a-z]+$/i.test(lowerKeyword)) {
        const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
        return regex.test(clue) || clue === lowerKeyword;
      }

      return clue.includes(lowerKeyword);
    });
  });
}

// ==================== 事件分发与智能穿透（适配 React/Vue/DatePicker/Cascader） ====================

// 智能日期格式转换
function adaptDateFormat(rawDate, placeholder) {
  if (!rawDate) return rawDate;
  const ph = (placeholder || "").toLowerCase();
  let str = rawDate.toString().trim();
  
  // 标准化成 [YYYY, MM, DD]
  const match = str.match(/^(\d{4})[-/\.年](\d{1,2})(?:[-/\.月](\d{1,2})日?)?$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, "0");
    const d = (match[3] || "01").padStart(2, "0");

    if (ph.includes("yyyy/mm/dd")) return `${y}/${m}/${d}`;
    if (ph.includes("yyyy/mm")) return `${y}/${m}`;
    if (ph.includes("yyyy-mm-dd")) return `${y}-${m}-${d}`;
    if (ph.includes("yyyy.mm.dd")) return `${y}.${m}.${d}`;
    if (ph.includes("yyyy.mm")) return `${y}.${m}`;
    if (ph.includes("yyyymmdd")) return `${y}${m}${d}`;
    if (ph.includes("yyyymm")) return `${y}${m}`;
    if (ph.includes("年") && ph.includes("月")) {
      return match[3] ? `${y}年${m}月${d}日` : `${y}年${m}月`;
    }
    return match[3] ? `${y}-${m}-${d}` : `${y}-${m}`;
  }
  return str;
}

// 智能拆分中文姓名（姓与名）
function splitChineseName(fullName) {
  if (!fullName) return { lastName: "", firstName: "" };
  const str = fullName.trim();
  const compoundSurnames = [
    "欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人",
    "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "淳于",
    "单于", "太叔", "申屠", "公孙", "仲孙", "轩辕", "令狐", "钟离", "宇文", "长孙",
    "慕容", "鲜于", "闾丘", "司徒", "司空", "亓官", "司寇", "仉督", "子车", "颛孙"
  ];
  for (const cs of compoundSurnames) {
    if (str.startsWith(cs)) {
      return {
        lastName: cs,
        firstName: str.slice(cs.length)
      };
    }
  }
  return {
    lastName: str.slice(0, 1),
    firstName: str.slice(1)
  };
}

// 获取基本信息衍生字段值（如姓、名、户籍省/市、现居省/市）
function getBasicFieldDerivedValue(key, resumeData) {
  if (!resumeData || !resumeData.basic) return "";
  const b = resumeData.basic;
  
  if (key === 'lastName') {
    return splitChineseName(b.name || "").lastName;
  }
  if (key === 'firstName') {
    return splitChineseName(b.name || "").firstName;
  }
  if (key === 'nativeProvince') {
    const parts = parseChineseArea(b.nativePlace || "");
    if (parts[0]) {
      return ["北京", "天津", "上海", "重庆"].includes(parts[0]) ? `${parts[0]}市` : (parts[0].endsWith("省") || parts[0].endsWith("市") ? parts[0] : `${parts[0]}省`);
    }
    return "";
  }
  if (key === 'nativeCity') {
    const parts = parseChineseArea(b.nativePlace || "");
    if (parts[0] && ["北京", "天津", "上海", "重庆"].includes(parts[0])) {
      return `${parts[0]}市`;
    }
    if (parts[1]) {
      return parts[1].endsWith("市") ? parts[1] : `${parts[1]}市`;
    }
    return "";
  }
  if (key === 'residenceProvince') {
    const parts = parseChineseArea(b.residence || b.city || "");
    if (parts[0]) {
      return ["北京", "天津", "上海", "重庆"].includes(parts[0]) ? `${parts[0]}市` : (parts[0].endsWith("省") || parts[0].endsWith("市") ? parts[0] : `${parts[0]}省`);
    }
    return "";
  }
  if (key === 'residenceCity') {
    const parts = parseChineseArea(b.residence || b.city || "");
    if (parts[0] && ["北京", "天津", "上海", "重庆"].includes(parts[0])) {
      return `${parts[0]}市`;
    }
    if (parts[1]) {
      return parts[1].endsWith("市") ? parts[1] : `${parts[1]}市`;
    }
    return "";
  }
  if (key === 'residenceDistrict') {
    const parts = parseChineseArea(b.residence || b.city || "");
    return parts[2] || (parts[1] && parts[1].endsWith("区") ? parts[1] : "");
  }

  return b[key] || "";
}

// 从教育经历对象中提取常规及衍生字段值（如入学年份、入学月份等）
function getEducationFieldValue(item, subKey) {
  if (!item) return "";
  if (subKey === 'startYear') {
    return item.start ? item.start.split('-')[0] : "";
  }
  if (subKey === 'startMonth') {
    const parts = (item.start || "").split('-');
    return parts[1] || "";
  }
  if (subKey === 'endYear') {
    return item.end ? item.end.split('-')[0] : "";
  }
  if (subKey === 'endMonth') {
    const parts = (item.end || "").split('-');
    return parts[1] || "";
  }
  return item[subKey] || "";
}

// 智能识别当前输入框应该匹配硕士经历还是本科经历（基于显式关键词、父容器上下文与时间倒序惯例）
function detectEducationItemIndex(el, clues, resumeData, defaultIdx = 0) {
  if (!resumeData.education || resumeData.education.length === 0) return 0;
  
  const masterIdx = resumeData.education.findIndex(item => 
    (item.degree || '').includes('硕') || (item.degree || '').includes('研')
  );
  const bachelorIdx = resumeData.education.findIndex(item => 
    (item.degree || '').includes('本') || (item.degree || '').includes('学士')
  );

  // 1. 优先检查输入框自身 clues 中是否显式包含学历关键词
  const clueStr = (clues || []).join(' ').toLowerCase();
  if (/硕士|研究生|最高学历|最高教育|第一学历|master|postgraduate/i.test(clueStr)) {
    return masterIdx !== -1 ? masterIdx : 0;
  }
  if (/本科|学士|第二学历|bachelor|undergraduate/i.test(clueStr)) {
    return bachelorIdx !== -1 ? bachelorIdx : (masterIdx !== -1 ? (masterIdx === 0 ? 1 : 0) : 0);
  }

  // 2. 向上追溯当前输入框所在的紧凑教育容器（卡片/行/模块/Section）
  let container = el && el.closest ? el.closest('.education-item, .card, .form-section, .section, .block, fieldset, tr, [class*="edu" i]') : null;
  if (container) {
    const containerText = (container.textContent || '').toLowerCase();
    
    // 检查容器内部是否有包含学历的 select、radio 或已填写的 input
    const degreeElements = (typeof container.querySelectorAll === "function") ? container.querySelectorAll('select, input, [class*="value" i], [class*="title" i], [class*="header" i]') : [];
    for (let del of degreeElements) {
      const val = (del.value || del.textContent || '').trim().toLowerCase();
      if (/硕士|研究生|master/i.test(val)) {
        return masterIdx !== -1 ? masterIdx : 0;
      }
      if (/本科|学士|bachelor/i.test(val)) {
        return bachelorIdx !== -1 ? bachelorIdx : 1;
      }
    }

    if (/硕士|研究生|最高学历/i.test(containerText)) {
      return masterIdx !== -1 ? masterIdx : 0;
    }
    if (/本科|学士|第二学历/i.test(containerText)) {
      return bachelorIdx !== -1 ? bachelorIdx : 1;
    }
  }

  // 3. 时间倒序兜底：校招网申默认第 1 个教育经历模块是最高学历（硕士），第 2 个是次高学历（本科）
  if (defaultIdx === 0) {
    return masterIdx !== -1 ? masterIdx : 0;
  }
  if (defaultIdx === 1) {
    return bachelorIdx !== -1 ? bachelorIdx : 1;
  }

  return defaultIdx < resumeData.education.length ? defaultIdx : 0;
}

// 深度探测输入框是否属于就读时间的年/月选择 (支持 input 与 select 全形态)
function inspectEduDateTimeRole(el, clues, sectionContext) {
  const selfClues = [
    el.placeholder,
    el.name,
    el.id,
    el.previousSibling ? (el.previousSibling.textContent || el.previousSibling.nodeValue) : "",
    el.previousElementSibling ? el.previousElementSibling.textContent : "",
    el.nextSibling ? (el.nextSibling.textContent || el.nextSibling.nodeValue) : "",
    el.nextElementSibling ? el.nextElementSibling.textContent : ""
  ].filter(Boolean).join(" ").toLowerCase();

  // 跨层级检索前置隔断词 (如 <div class="start"><input></div> <span>至</span> <div class="end"><input></div>)
  const parentPrevText = (el.parentElement && el.parentElement.previousElementSibling ? (el.parentElement.previousElementSibling.textContent || "") : "") + 
                         (el.parentElement && el.parentElement.previousSibling ? (el.parentElement.previousSibling.textContent || el.parentElement.previousSibling.nodeValue || "") : "");

  const allCluesStr = (clues || []).join(" ").toLowerCase() + " " + parentPrevText.toLowerCase();
  const isEdu = sectionContext === "education" || /就读|在校|学习|教育|学历|学业|学校|college|academic|education|毕业|入学/i.test(allCluesStr);
  if (!isEdu) return null;

  const isTimeField = /时间|年月|年份|月份|日期|date|period|time/i.test(allCluesStr) || 
                      (el.placeholder && /年|月|yyyy|mm/i.test(el.placeholder)) ||
                      (clues || []).some(c => c === "年" || c === "月" || c === "yyyy" || c === "mm");
  if (!isTimeField) return null;

  const hasYear = /年份|年度|yyyy|year/i.test(allCluesStr) || (el.placeholder && /年|yyyy/i.test(el.placeholder)) || (clues || []).some(c => c === "年" || c === "yyyy");
  const hasMonth = /月份|month|mm/i.test(allCluesStr) || (el.placeholder && /月|mm/i.test(el.placeholder)) || (clues || []).some(c => c === "月" || c === "mm");

  // 判断是开始还是结束：
  // 1. 自身文本或直接父级的前置分隔符中包含“至/到/结束/毕业”
  let isEnd = false;
  if (/毕业|结束|止|至|到|end|grad|to|until/i.test(selfClues) || /至|到|--|~|结束|毕业|end|to/i.test(parentPrevText)) {
    isEnd = true;
  } else if (/入学|开始|起|start|from/i.test(selfClues)) {
    isEnd = false;
  } else {
    // 2. 卡片级年份顺序判定 (Card-Level Order Resolution)
    let eduCard = el.closest ? el.closest('.education-item, .sub-section, .card, .form-section, .section, .block, fieldset, form, [class*="edu" i]') : null;
    if (eduCard && typeof eduCard.querySelectorAll === "function") {
      const allInputs = Array.from(eduCard.querySelectorAll('input, select')).filter(i => isEditableElement(i));
      const yearInputs = allInputs.filter(i => {
        const p = (i.placeholder || "").toLowerCase();
        const n = (i.name || "").toLowerCase();
        return /年|yyyy|year/i.test(p) || /year/i.test(n) || (i.tagName === 'SELECT' && inspectSelectType(i) === 'year');
      });
      if (yearInputs.length >= 2) {
        const idxInCard = yearInputs.indexOf(el);
        if (idxInCard === 0) isEnd = false;
        else if (idxInCard >= 1) isEnd = true;
      }
    }
  }

  // 单独年份框
  if (hasYear && !hasMonth) {
    return isEnd ? "endYear" : "startYear";
  }
  // 单独月份框
  if (hasMonth && !hasYear) {
    return isEnd ? "endMonth" : "startMonth";
  }
  // 年月一体框
  if (hasYear && hasMonth) {
    return isEnd ? "end" : "start";
  }

  return null;
}

// 智能识别当前输入框应该匹配项目经历 1 还是项目经历 2
function detectProjectItemIndex(el, clues, resumeData, defaultIdx = 0) {
  if (!resumeData.project || resumeData.project.length === 0) return 0;
  
  const clueStr = (clues || []).join(' ').toLowerCase();
  
  // 1. 显式线索 (项目1 / 项目2)
  if (/项目2|项目二|第二个项目|proj.*2/i.test(clueStr)) {
    return resumeData.project.length > 1 ? 1 : 0;
  }
  if (/项目1|项目一|第一个项目|proj.*1/i.test(clueStr)) {
    return 0;
  }

  // 2. 向上追溯容器
  let container = el && el.closest ? el.closest('.project-item, .card, .form-section, .section, .block, fieldset, tr, [class*="proj" i]') : null;
  if (container) {
    const containerText = (container.textContent || '').toLowerCase();
    if (/项目2|项目二|第二段项目/i.test(containerText)) {
      return resumeData.project.length > 1 ? 1 : 0;
    }
    if (/项目1|项目一|第一段项目/i.test(containerText)) {
      return 0;
    }
  }

  return defaultIdx < resumeData.project.length ? defaultIdx : 0;
}

// 探测一个 <select> 是否是年份或月份下拉框 (基于 option 内容特征)
function inspectSelectType(selectEl) {
  if (!selectEl || selectEl.tagName !== "SELECT" || !selectEl.options || selectEl.options.length === 0) return null;
  let yearCount = 0;
  let monthCount = 0;
  let totalChecked = 0;
  
  for (let opt of selectEl.options) {
    const val = (opt.value || "").trim();
    const txt = (opt.text || "").trim();
    if (!val && !txt) continue;
    totalChecked++;
    
    // 年份检查：四位数字 1970~2040，或 2024年
    if (/^(19\d\d|20\d\d)年?$/.test(val) || /^(19\d\d|20\d\d)年?$/.test(txt)) {
      yearCount++;
    }
    // 月份检查：1~12，01~12，或 1月~12月
    if (/^(0?[1-9]|1[0-2])月?$/.test(val) || /^(0?[1-9]|1[0-2])月?$/.test(txt)) {
      monthCount++;
    }
  }
  
  if (totalChecked > 0) {
    if (yearCount / totalChecked >= 0.35) return 'year';
    if (monthCount / totalChecked >= 0.35) return 'month';
  }
  return null;
}

// 判定一个年月选择框到底属于入学还是毕业 (基于线索与同级下拉框顺序)
function detectYearMonthSelectRole(selectEl, selectType, clues) {
  const clueStr = (clues || []).join(' ').toLowerCase();
  
  // 1. 显式线索
  if (/毕业|结束|至|到|end|grad/i.test(clueStr)) {
    return selectType === 'year' ? 'endYear' : 'endMonth';
  }
  if (/入学|开始|起|start|from/i.test(clueStr)) {
    return selectType === 'year' ? 'startYear' : 'startMonth';
  }

  // 2. 检查同一容器内所有下拉框的相对位置顺序
  let container = selectEl.closest ? selectEl.closest('.form-group, .form-item, .form-row, tr, td, .section, fieldset, div') : null;
  if (!container) container = selectEl.parentElement;
  
  if (container) {
    const allSelects = Array.from(container.querySelectorAll('select'));
    const sameTypeSelects = allSelects.filter(s => inspectSelectType(s) === selectType);
    if (sameTypeSelects.length >= 2) {
      const idxInGroup = sameTypeSelects.indexOf(selectEl);
      if (idxInGroup === 0) {
        return selectType === 'year' ? 'startYear' : 'startMonth';
      } else {
        return selectType === 'year' ? 'endYear' : 'endMonth';
      }
    }
  }

  return selectType === 'year' ? 'startYear' : 'startMonth';
}

function setElementValue(element, value) {
  if (!element || value === undefined || value === null) return;
  
  // 支持 contenteditable 富文本输入框 (如大厂自研招聘系统的项目描述/自我介绍)
  if (element.isContentEditable || (typeof element.getAttribute === "function" && element.getAttribute("contenteditable") === "true")) {
    element.focus();
    element.textContent = value == null ? "" : String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    markElement(element, "filled", `已填入: ${value}`);
    return;
  }

  // 1. 日期格式智能识别与只读属性解除穿透
  const isDateInput = element.type === "date" || 
                      /date|picker|calendar|birth|time/i.test(element.className || "") ||
                      /date|picker|birth|time/i.test(element.name || "") ||
                      /date|picker|birth|time/i.test(element.id || "") ||
                      /yyyy|年|月|日/i.test(element.placeholder || "");
  
  if (isDateInput) {
    value = adaptDateFormat(value, element.placeholder);
  }

  const wasReadonly = typeof element.hasAttribute === "function" && element.hasAttribute("readonly");
  if (wasReadonly && typeof element.removeAttribute === "function") {
    element.removeAttribute("readonly");
  }

  // 先触发 focus
  element.dispatchEvent(new Event("focus", { bubbles: true }));

  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    // 兼容 React/Vue 等框架的特殊 Setter 拦截
    const valueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    
    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    // 派发带有数据的 InputEvent
    try {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
    } catch (e) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));

    // 模拟 Down 箭头选择下拉联想第一项，再按 Enter 确认锁定 (适配 Moka/AntD/Element 联想搜索输入框)
    const arrowDown = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 });
    element.dispatchEvent(arrowDown);

    // 针对日期与常规输入框，模拟敲击回车键 (Enter)，触发日期组件将文本转换为受控日期对象
    const enterDown = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterDown);
    const enterPress = new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterPress);
    const enterUp = new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    element.dispatchEvent(enterUp);

    // 兼容 React Props 挂载直接调用
    for (let key in element) {
      if (key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$")) {
        const props = element[key];
        if (props) {
          if (typeof props.onChange === "function") {
            try { props.onChange({ target: element, currentTarget: element, value: value }); } catch (e) {}
          }
          if (typeof props.onPressEnter === "function") {
            try { props.onPressEnter({ target: element, currentTarget: element, key: "Enter", keyCode: 13 }); } catch (e) {}
          }
        }
      }
    }

    // 向上穿透父容器的 React/Vue Props (如 AntD Picker 容器)
    let parent = element.parentElement;
    let pSteps = 0;
    while (parent && pSteps < 3) {
      for (let key in parent) {
        if (key.startsWith("__reactProps$") || key.startsWith("__reactEventHandlers$")) {
          const props = parent[key];
          if (props && typeof props.onChange === "function") {
            try { props.onChange(value); } catch (e) {}
          }
        }
      }
      parent = parent.parentElement;
      pSteps++;
    }

  } else if (element.tagName === "SELECT") {
    let matchedOption = null;
    const lowerValue = value.toString().toLowerCase().trim();
    const cleanValue = lowerValue.replace(/族|年|月$/, "");
    const numValue = parseInt(cleanValue, 10);
    
    for (let option of element.options) {
      const optVal = (option.value || "").toLowerCase().trim();
      const optText = (option.text || "").toLowerCase().trim();
      const cleanOptVal = optVal.replace(/族|年|月$/, "");
      const cleanOptText = optText.replace(/族|年|月$/, "");
      const optNumVal = parseInt(cleanOptVal, 10);
      const optNumText = parseInt(cleanOptText, 10);

      // 1. 文本或去单位完全匹配 (如 "2024" 和 "2024年", "09" 和 "9月", "汉族" 和 "汉")
      const matchExact = (optVal && optVal === lowerValue) || (optText && optText === lowerValue) ||
                         (cleanOptVal && cleanOptVal === cleanValue) || (cleanOptText && cleanOptText === cleanValue);
      
      // 2. 数值匹配 (例如 value="09" 匹配 option 9 或 9月; value="2024" 匹配 2024)
      const matchNum = !isNaN(numValue) && ((!isNaN(optNumVal) && optNumVal === numValue) || (!isNaN(optNumText) && optNumText === numValue));

      // 3. 包含匹配
      const matchInc = (optVal && (lowerValue.includes(optVal) || cleanValue.includes(optVal))) ||
                       (optText && (lowerValue.includes(optText) || cleanValue.includes(cleanOptText))) ||
                       (optVal && (optVal.includes(lowerValue) || optVal.includes(cleanValue))) ||
                       (optText && (optText.includes(lowerValue) || cleanOptText.includes(cleanValue)));
      
      if (matchExact || matchNum || matchInc) {
        matchedOption = option;
        break;
      }
    }
    
    if (matchedOption) {
      element.value = matchedOption.value;
      matchedOption.selected = true;
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 针对现代前端框架（AntD、Element、Moka 等）弹出的日期/年份/下拉选项，自动模拟点击选定完成闭环确认
  setTimeout(() => {
    const valStr = value.toString().trim();
    const valLower = valStr.toLowerCase();
    const valClean = valLower.replace(/族|年|月$/, "");

    // 查找页面中可见的下拉浮层或日期年份浮层
    const dropdowns = Array.from(document.querySelectorAll(
      ".ant-picker-dropdown, .el-picker-panel, .ant-select-dropdown, .el-select-dropdown, .moka-autocomplete-dropdown, [class*='dropdown' i], [class*='picker-panel' i], [class*='popover' i]"
    )).filter(d => {
      try {
        const st = window.getComputedStyle(d);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      } catch(e) { return false; }
    });

    for (let dd of dropdowns) {
      const items = Array.from(dd.querySelectorAll(
        ".ant-picker-cell-inner, .el-year-table td, .el-month-table td, .ant-select-item-option, .el-select-dropdown__item, [role='gridcell'], [role='option'], li, div"
      ));

      const matchOptionEl = items.find(it => {
        const txt = (it.textContent || "").toLowerCase().trim();
        const cleanTxt = txt.replace(/族|年|月$/, "");
        return txt === valLower || txt === valClean || cleanTxt === valClean ||
               (txt.endsWith("月") && parseInt(txt, 10) === parseInt(valClean, 10));
      });

      if (matchOptionEl) {
        try {
          matchOptionEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          matchOptionEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          matchOptionEl.click();
          break;
        } catch(e) {}
      }
    }

    // 如果存在确认按钮，点击确认
    const okBtn = (typeof document.querySelector === "function") ? document.querySelector(".ant-picker-ok button, .el-picker-panel__footer .el-button--default, [class*='picker-btn-ok' i], .ant-picker-today-btn, .today") : null;
    if (okBtn) {
      try { okBtn.click(); } catch(e) {}
    }
  }, 60);

  // 触发失焦与校验
  element.dispatchEvent(new Event("blur", { bubbles: true }));

  // 标记成功填入
  markElement(element, "filled", `已填入: ${value}`);

  // 如果原本是 readonly，延迟 200ms 还原，保证框架已完成受控同步
  if (wasReadonly) {
    setTimeout(() => {
      try { element.setAttribute("readonly", "readonly"); } catch(e) {}
    }, 200);
  }
}

// 智能切分中文省市区
function parseChineseArea(rawStr) {
  if (!rawStr) return [];
  let s = rawStr.trim();
  const parts = [];
  
  // 匹配直辖市/特别行政区/省/自治区 (包括后面的省/市字样)
  const pMatch = s.match(/^((?:北京|天津|上海|重庆|香港|澳门)|(?:河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾)|(?:内蒙古|广西|西藏|宁夏|新疆))(?:省|市|自治区|特别行政区)?/);
  if (pMatch) {
    parts.push(pMatch[1]);
    s = s.slice(pMatch[0].length).trim();
  }
  
  // 匹配地级市/区县
  const cMatch = s.match(/^([^\s市区县]{2,5})(?:市|地区|自治州|盟|区|县)?/);
  if (cMatch) {
    parts.push(cMatch[1]);
    s = s.slice(cMatch[0].length).trim();
  }

  // 剩余区县/详细地址
  if (s) {
    const dMatch = s.match(/^([^\s市区县]{2,5})(?:区|县|旗|市)?/);
    if (dMatch) {
      parts.push(dMatch[1]);
    } else {
      parts.push(s);
    }
  }

  return parts.length > 0 ? parts : [rawStr];
}

// 自动模拟点击级联选择器（Cascader 智能联动）
async function autoSelectCascaderArea(inputEl, areaStr) {
  if (!inputEl || !areaStr) return false;
  const parts = parseChineseArea(areaStr);
  if (parts.length === 0) return false;

  // 1. 点击展开级联浮层
  inputEl.click();
  inputEl.focus();

  // 尝试在展开的下拉容器中查找第一级和第二级
  await new Promise(r => setTimeout(r, 120));

  for (let i = 0; i < parts.length; i++) {
    const keyword = parts[i];
    if (!keyword) continue;

    // 寻找可见的下拉浮层菜单列
    const menus = Array.from(document.querySelectorAll(
      ".ant-cascader-menu, .el-cascader-menu, .cascader-list, [class*='cascader-menu' i], [class*='cascader-panel' i] ul"
    )).filter(m => {
      const st = window.getComputedStyle(m);
      return st.display !== 'none' && st.visibility !== 'hidden';
    });

    let targetMenu = menus[i] || menus[menus.length - 1] || document.body;
    const items = Array.from(targetMenu.querySelectorAll("li, .ant-cascader-menu-item, .el-cascader-node, [role='menuitem']"));
    const matchItem = items.find(it => it.textContent.includes(keyword));
    if (matchItem) {
      matchItem.click();
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 兜底：直接灌入值
  setElementValue(inputEl, areaStr);
  return true;
}

// ==================== 匹配填充主逻辑 ====================

// 智能填充整页
function smartFillPage(resumeData) {
  const elements = Array.from(document.querySelectorAll("input, textarea, select")).filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && isEditableElement(el);
  });

  const counters = {
    education: { school: 0, degree: 0, major: 0, gpa: 0, start: 0, startYear: 0, startMonth: 0, end: 0, endYear: 0, endMonth: 0, supervisor: 0, courses: 0, researchDirection: 0, department: 0, labExperience: 0, studentId: 0, schoolLocation: 0 },
    internship: { company: 0, position: 0, start: 0, end: 0, desc: 0 },
    project: { name: 0, role: 0, start: 0, end: 0, desc: 0, duty: 0, result: 0, tech: 0 },
    competition: { name: 0, start: 0, end: 0, desc: 0 },
    paper: { title: 0, desc: 0, result: 0 },
    honors: { name: 0, date: 0, level: 0 },
    family: { name: 0, relation: 0, company: 0, position: 0, phone: 0 }
  };

  let filledCount = 0;

  elements.forEach((el) => {
    const clues = getElementClues(el);
    if (clues.length === 0) return;

    // 1. 强指示词匹配 (优先级最高，规避跨段名称重叠冲突)
    for (let indicator of STRONG_INDICATORS) {
      if (isMatch(clues, indicator.keywords)) {
        const section = indicator.section;
        const subKey = indicator.subKey;
        
        if (section === 'basic') {
          const val = getBasicFieldDerivedValue(subKey, resumeData);
          if (val !== undefined && val !== "") {
            setElementValue(el, val);
            filledCount++;
            return;
          }
        } else {
          let idx = counters[section][subKey] || 0;
          if (section === 'education') {
            idx = detectEducationItemIndex(el, clues, resumeData, counters.education[subKey] || 0);
          } else if (section === 'family') {
            const clueStr = clues.join(' ').toLowerCase();
            if (/母|妈|mother/i.test(clueStr)) {
              idx = (resumeData.family || []).findIndex(f => (f.relation || '').includes('母'));
            } else if (/父|爸|father/i.test(clueStr)) {
              idx = (resumeData.family || []).findIndex(f => (f.relation || '').includes('父'));
            }
            if (idx === -1) idx = counters[section][subKey] || 0;
          }
          
          if (idx === (counters[section][subKey] || 0)) {
            counters[section][subKey] = (counters[section][subKey] || 0) + 1;
          }
          
          const item = resumeData[section][idx];
          const itemVal = (section === 'education') ? getEducationFieldValue(item, subKey) : (item ? item[subKey] : "");
          if (itemVal !== undefined && itemVal !== "") {
            setElementValue(el, itemVal);
            filledCount++;
            return;
          }
        }
      }
    }

    // 2. 根据上下文标题结构匹配板块子字段
    const sectionContext = getContextSection(el);
    if (sectionContext && KEYWORDS[sectionContext]) {
      const subKeywords = KEYWORDS[sectionContext];
      for (let subKey in subKeywords) {
        if (isMatch(clues, subKeywords[subKey])) {
          let idx = counters[sectionContext][subKey] || 0;
          
          if (sectionContext === 'education') {
            idx = detectEducationItemIndex(el, clues, resumeData, counters.education[subKey] || 0);
          }
          
          if (idx === (counters[sectionContext][subKey] || 0)) {
            counters[sectionContext][subKey] = (counters[sectionContext][subKey] || 0) + 1;
          }

          const item = resumeData[sectionContext][idx];
          const itemVal = (sectionContext === 'education') ? getEducationFieldValue(item, subKey) : (item ? item[subKey] : "");
          if (itemVal !== undefined && itemVal !== "") {
            setElementValue(el, itemVal);
            filledCount++;
            return;
          }
        }
      }
    }

    // 3. 基本信息匹配 (使用排除规则，防止个人姓名进项目名称，个人手机进公司电话等)
    for (let key in KEYWORDS) {
      if (key !== 'education' && key !== 'internship' && key !== 'project' && key !== 'honors' && key !== 'competition' && key !== 'paper') {
        const keywords = KEYWORDS[key];
        if (isMatch(clues, keywords)) {
          if (EXCLUSIONS[key]) {
            const hasExclusion = clues.some(clue => {
              return EXCLUSIONS[key].some(ex => clue.includes(ex));
            });
            if (hasExclusion) continue;
          }

          let matchedValue = (key === 'skills') ? resumeData.skills : (key === 'languages' ? resumeData.languages : getBasicFieldDerivedValue(key, resumeData));
          if (matchedValue !== undefined && matchedValue !== "") {
            setElementValue(el, matchedValue);
            filledCount++;
            return;
          }
        }
      }
    }
  });

  // 额外处理页面中的 Radio 单选组件 (如性别 男/女、是否接受调剂 是/否)
  try {
    const radios = Array.from(document.querySelectorAll("input[type='radio']")).filter(r => {
      const style = window.getComputedStyle(r);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    radios.forEach(r => {
      const clues = getElementClues(r);
      const rVal = (r.value || "").trim().toLowerCase();
      
      // 性别单选
      if (clues.some(c => c.includes('性别') || c === '男' || c === '女' || c === 'male' || c === 'female')) {
        const myGender = (resumeData.basic.gender || "").trim().toLowerCase();
        const isTarget = clues.some(c => c === myGender || c.includes(myGender)) || rVal === myGender;
        if (isTarget && !r.checked) {
          r.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
        }
      }
      // 城市调剂单选
      else if (clues.some(c => c.includes('调剂') || c === '是' || c === '否')) {
        const myReloc = (resumeData.basic.acceptRelocation || "是").trim().toLowerCase();
        const isTarget = clues.some(c => c === myReloc) || rVal === myReloc;
        if (isTarget && !r.checked) {
          r.click();
          r.checked = true;
          r.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
        }
      }
    });
  } catch (e) {
    console.error("Radio fill error:", e);
  }

  // 自动勾选“我已阅读并同意”用户协议、个人信息保护政策、隐私条款复选框
  try {
    const agreementCount = autoCheckAgreements();
    if (agreementCount > 0) {
      filledCount += agreementCount;
    }
  } catch (e) {
    console.error("Agreement check error:", e);
  }

  // 自动回答校招常见合规声明与背调问卷 (如亲属任职选“否”，真实性背调选“是”)
  try {
    const decCount = autoFillDeclarations();
    if (decCount > 0) {
      filledCount += decCount;
    }
  } catch (e) {
    console.error("Declaration check error:", e);
  }

  // 收集未填写的必填项并标记橙黄色光晕 (防错系统)
  const uncertainList = [];
  elements.forEach((el, idx) => {
    if (el.getAttribute("data-rf-mark") === "filled") return;
    const val = (el.value || el.textContent || "").trim();
    if (val) return;

    const clues = getElementClues(el);
    const isRequired = el.hasAttribute("required") || 
                       el.getAttribute("aria-required") === "true" ||
                       clues.some(c => c.includes("*") || c.includes("必填") || c.includes("required"));
    
    if (isRequired) {
      markElement(el, "uncertain", "建议核对必填项");
      const rawLabel = clues[0] || el.placeholder || el.name || `未填项 #${idx + 1}`;
      const cleanLabel = rawLabel.replace(/[*必填:：\s]/g, "") || `第 ${idx + 1} 项`;
      uncertainList.push({ element: el, label: cleanLabel });
    }
  });

  // 弹出智能填充结果汇总小清单 (绿色已填，橙色待确认，支持一键点击定位)
  showAutofillSummaryBadge(filledCount, uncertainList);

  return filledCount;
}

// 自动填充校招合规声明与背调问卷 (如亲属任职/违法记录/竞业限制 选否，真实性/背调同意 选是)
function autoFillDeclarations() {
  let filledCount = 0;
  try {
    const questionRows = Array.from(document.querySelectorAll(
      ".ant-form-item, .el-form-item, .form-group, .form-row, .question-item, tr, [class*='question' i], [class*='item' i]"
    ));

    questionRows.forEach(row => {
      const text = (row.textContent || "").toLowerCase();
      const isNegativeQuestion = /亲属|亲友|回避|兼职|违纪|违法|犯罪|处分|处罚|不良记录|竞业|诉讼|借贷|重疾|兼任/i.test(text);
      const isPositiveQuestion = /背景调查|背调|真实有效|自愿承担|诚信承诺|遵守规定|知悉并/i.test(text);

      if (!isNegativeQuestion && !isPositiveQuestion) return;
      const expectedAnswer = isNegativeQuestion ? "否" : "是";

      // 1. 单选按钮 / 复选框
      const choices = Array.from(row.querySelectorAll("input[type='radio'], input[type='checkbox'], [role='radio'], [role='checkbox'], .ant-radio-wrapper, .el-radio, .ant-checkbox-wrapper, .el-checkbox, label"));
      for (let c of choices) {
        const cText = (c.textContent || c.value || "").trim().toLowerCase();
        const matchesNegative = isNegativeQuestion && (cText === "否" || cText === "无" || cText.includes("否") || cText.includes("无"));
        const matchesPositive = isPositiveQuestion && (cText === "是" || cText === "同意" || cText.includes("是") || cText.includes("同意"));
        
        if (matchesNegative || matchesPositive) {
          const clickTarget = c.querySelector("input") || c;
          if (clickTarget && !clickTarget.checked && !c.classList.contains("is-checked") && !c.classList.contains("ant-radio-checked")) {
            clickTarget.click();
            if (typeof HTMLInputElement !== "undefined" && clickTarget instanceof HTMLInputElement) {
              clickTarget.checked = true;
              if (typeof clickTarget.dispatchEvent === "function") {
                clickTarget.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
            markElement(c, "filled", `合规问卷: ${expectedAnswer}`);
            filledCount++;
            break;
          }
        }
      }

      // 2. 下拉框
      const selects = Array.from(row.querySelectorAll("select"));
      selects.forEach(sel => {
        if (!sel.value || sel.value === "") {
          for (let opt of sel.options) {
            const oText = (opt.text || opt.value || "").trim().toLowerCase();
            const matchesNegative = isNegativeQuestion && (oText === "否" || oText === "无");
            const matchesPositive = isPositiveQuestion && (oText === "是" || oText === "同意");
            if (matchesNegative || matchesPositive) {
              sel.value = opt.value;
              opt.selected = true;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              markElement(sel, "filled", `合规问卷: ${expectedAnswer}`);
              filledCount++;
              break;
            }
          }
        }
      });
    });
  } catch (e) {
    console.error("autoFillDeclarations error:", e);
  }
  return filledCount;
}

// 自动检测并勾选网申协议与隐私政策小按钮
function autoCheckAgreements() {
  let checkedCount = 0;
  try {
    // 1. 原生 Checkbox
    const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']")).filter(cb => {
      try {
        const style = window.getComputedStyle(cb);
        return style.display !== 'none' && style.visibility !== 'hidden';
      } catch (e) { return true; }
    });

    checkboxes.forEach(cb => {
      if (cb.checked) return;
      const clues = (typeof getElementClues === "function" ? getElementClues(cb) : []).join(" ").toLowerCase();
      const parentText = (cb.parentElement ? cb.parentElement.textContent : "").toLowerCase();
      const isAgreement = /阅读|同意|隐私|协议|条款|个人信息|授权|policy|privacy|agreement|terms/i.test(clues + " " + parentText);
      if (isAgreement) {
        cb.click();
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        checkedCount++;
      }
    });

    // 2. 现代前端框架自定义 Checkbox (AntD, Element Plus, Moka, 飞书, 牛客等)
    const customCheckboxes = Array.from(document.querySelectorAll(
      ".ant-checkbox:not(.ant-checkbox-checked), .el-checkbox:not(.is-checked), [class*='checkbox']:not([class*='checked']), [role='checkbox'][aria-checked='false']"
    ));

    customCheckboxes.forEach(cc => {
      const wrapper = (cc.closest && cc.closest(".ant-checkbox-wrapper, .el-checkbox, label, [class*='agreement' i], [class*='policy' i], div")) || cc;
      const txt = (wrapper.textContent || "").toLowerCase();
      if (/阅读|同意|隐私|协议|条款|个人信息|授权|policy|privacy|agreement|terms/i.test(txt)) {
        const targetClick = (cc.querySelector && cc.querySelector("input")) || cc;
        targetClick.click();
        checkedCount++;
      }
    });
  } catch (e) {
    console.error("autoCheckAgreements error:", e);
  }
  return checkedCount;
}

// 全局监听：当用户在页面上点击任何“提交 / 投递 / 确认 / 下一步”按钮时，瞬间自动勾选协议小按钮！
document.addEventListener("click", (e) => {
  try {
    const el = e.target;
    if (!el) return;
    if (el.closest && el.closest("#resume-filler-extension-host")) return;
    const btn = el.closest ? el.closest("button, input[type='submit'], input[type='button'], a, [role='button'], .btn, [class*='submit' i], [class*='apply' i]") : null;
    if (btn) {
      const btnText = (btn.textContent || btn.value || "").trim().toLowerCase();
      if (/提交|投递|申请|确认|下一步|完成|同意并|submit|apply/i.test(btnText)) {
        autoCheckAgreements();
      }
    }
  } catch (err) {}
}, true);

// 针对某个容器进行定向的经历/项目局部填充
function fillSection(type, data) {
  if (!lastActiveElement) return false;

  let container = lastActiveElement.closest("form, fieldset, tr, tbody, .form-section, .section, .block, .card");
  if (!container) {
    let current = lastActiveElement;
    for (let i = 0; i < 4; i++) {
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        break;
      }
    }
    container = current;
  }

  if (!container) return false;

  const elements = container.querySelectorAll("input, textarea, select");
  let filledCount = 0;

  elements.forEach((el) => {
    if (!isEditableElement(el)) return;
    const clues = getElementClues(el);
    if (clues.length === 0) return;

    const keyConfig = KEYWORDS[type];
    if (!keyConfig) return;

    for (let subKey in keyConfig) {
      if (isMatch(clues, keyConfig[subKey])) {
        if (data[subKey] !== undefined && data[subKey] !== "") {
          setElementValue(el, data[subKey]);
          filledCount++;
        }
      }
    }
  });

  return filledCount > 0;
}

// ==================== 接收消息 ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "smartFillPage") {
    try {
      const count = smartFillPage(request.data);
      sendResponse({ status: "success", count: count });
    } catch (err) {
      console.error(err);
      sendResponse({ status: "error", message: err.message });
    }
  } else if (request.action === "fillFocusedInput") {
    if (lastActiveElement) {
      setElementValue(lastActiveElement, request.value);
      sendResponse({ status: "success" });
    } else {
      sendResponse({ status: "no_focus" });
    }
  } else if (request.action === "fillSection") {
    try {
      const success = fillSection(request.type, request.data);
      if (success) {
        sendResponse({ status: "success" });
      } else {
        sendResponse({ status: "no_focus" });
      }
    } catch (err) {
      console.error(err);
      sendResponse({ status: "error", message: err.message });
    }
  }
  return true;
});

// ==================== 大模型驱动的高精度表单拓扑分析与字段映射引擎 ====================

// 页面表单字段的 AI 映射缓存: Map<string (fieldId/hash), { slot: string, confidence: number, label: string, reason: string }>
const aiFieldMappingCache = new Map();
let isAiPageScanning = false;
let lastAiScanUrl = "";

// 生成元素稳定特征哈希/唯一标识
function getElementStableFingerprint(el) {
  if (!el) return "";
  if (el.getAttribute("data-rf-fid")) return el.getAttribute("data-rf-fid");

  const name = el.name || "";
  const id = el.id || "";
  const placeholder = el.placeholder || "";
  const type = el.type || el.tagName.toLowerCase();
  
  // 计算输入框在文档中的大致序号
  const allInputs = Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));
  const idx = allInputs.indexOf(el);

  const raw = `${idx}_${type}_${name}_${id}_${placeholder}`.replace(/[\s\t\n]+/g, "_");
  const fid = "rf_fid_" + Math.abs(hashString(raw));
  el.setAttribute("data-rf-fid", fid);
  return fid;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// 提取当前页面表单的脱敏 DOM 拓扑结构 (Zero-PII: 仅提取结构和公开Label，绝无用户个人数据)
function extractPageDomTopology() {
  const formControls = Array.from(document.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']"
  ));

  const items = [];

  formControls.forEach((el, index) => {
    // 忽略不可见的输入框（非渲染元素）
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== "select-one") {
      return;
    }
    // 忽略插件自身的输入框
    if (el.closest && el.closest("#resume-filler-extension-host")) {
      return;
    }

    const fid = getElementStableFingerprint(el);
    const clues = getElementClues(el).slice(0, 5); // 最多取前5条关键线索
    const breadcrumb = getElementBreadcrumbPath(el);
    const tagName = el.tagName.toLowerCase();
    const type = (el.type || tagName).toLowerCase();
    const placeholder = (el.placeholder || "").trim();

    // 兄弟成对线索 (例如开始时间至结束时间)
    const siblingClue = getSiblingControlClue(el);

    items.push({
      fid,
      tag: tagName,
      type,
      placeholder: placeholder.slice(0, 40),
      breadcrumb: breadcrumb.slice(0, 80),
      clues: clues.map(c => c.slice(0, 30)),
      siblingClue: siblingClue ? siblingClue.slice(0, 30) : undefined
    });
  });

  return items;
}

// 获取控件的面包屑祖先路径 (如: 申请表 > 基本信息 > 联系方式)
function getElementBreadcrumbPath(el) {
  const parts = [];
  let cur = el.parentElement;
  let depth = 0;
  while (cur && cur !== document.body && depth < 6) {
    // 寻找容器上的标题文本
    const header = cur.querySelector("h1, h2, h3, h4, h5, .title, [class*='title' i], [class*='header' i], [class*='section' i], legend");
    if (header && header !== el && !header.contains(el)) {
      const t = (header.innerText || header.textContent || "").trim();
      if (t && t.length < 30 && !parts.includes(t)) {
        parts.unshift(t);
      }
    }
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

// 探测成对兄弟输入控件关系
function getSiblingControlClue(el) {
  const parent = el.parentElement;
  if (!parent) return "";
  const inputs = parent.querySelectorAll("input, select");
  if (inputs.length === 2) {
    if (inputs[0] === el) return "成对输入框中的第1项(如起始/省份/姓氏)";
    if (inputs[1] === el) return "成对输入框中的第2项(如结束/城市/名字)";
  }
  return "";
}

// 标准简历字段槽位规范字典 (供大模型作为参考槽位列表)
const RESUME_SCHEMA_SLOTS = `
[基础信息 basic]
basic.name: 候选人本人姓名
basic.lastName: 候选人姓氏 (如: 张)
basic.firstName: 候选人名字 (如: 三)
basic.gender: 性别 (男/女)
basic.birth: 出生日期/生日 (如: 2001-01-01)
basic.phone: 本人手机号码/联系电话
basic.email: 本人电子邮箱
basic.idCard: 身份证号/证件号码
basic.political: 政治面貌 (群众/团员/党员)
basic.city: 现居城市/所在城市 (如: 北京市海淀区)
basic.nativePlace: 籍贯/户籍地/生源地 (如: 山东济南)
basic.residence: 现居住详细地址/通信地址
basic.website: 个人网站/作品集链接
basic.github: GitHub主页
basic.jobIntent: 求职意向/申请岗位/期望职位
basic.highestDegree: 最高学历 (博士/硕士/本科/大专)
basic.emergencyContact: 紧急联系人姓名
basic.emergencyRelation: 与紧急联系人关系 (如: 父母/配偶)
basic.emergencyPhone: 紧急联系人电话
basic.selfEval: 自我评价/自我介绍/核心优势
basic.selfDescription: 自我描述/性格特质

[教育经历 education] (支持多段: 0为最高学历，1为前置学历，如0为硕士，1为本科)
education.0.school: 最高学历学校/院校名称
education.0.degree: 最高学历/学位 (硕士/学士)
education.0.major: 最高学历所学专业
education.0.start: 入学时间 (如: 2024-09)
education.0.end: 毕业时间 (如: 2027-06)
education.0.startYear: 入学年份 (如: 2024)
education.0.startMonth: 入学月份 (如: 09)
education.0.endYear: 毕业年份 (如: 2027)
education.0.endMonth: 毕业月份 (如: 06)
education.0.gpa: 绩点/成绩排名
education.0.supervisor: 导师姓名
education.0.department: 院系/学院名称
education.0.courses: 主修课程/核心课程
education.0.researchDirection: 研究方向
education.0.thesisTopic: 毕业论文/设计题目
education.1.school: 第二段/本科学校名称
education.1.degree: 第二段/本科学历学位
education.1.major: 第二段/本科专业
education.1.start: 本科入学时间
education.1.end: 本科毕业时间

[实习与工作经历 internship]
internship.0.company: 实习/工作单位名称
internship.0.position: 担任职位/岗位
internship.0.start: 入职时间
internship.0.end: 离职时间
internship.0.desc: 工作职责与内容描述
internship.1.company: 第二段实习公司名称
internship.1.position: 第二段实习职位
internship.1.desc: 第二段实习职责

[项目经历 project]
project.0.name: 项目名称
project.0.role: 项目角色/职责
project.0.tech: 技术栈
project.0.desc: 项目描述/背景
project.0.duty: 个人核心职责
project.0.result: 项目成果/量化指标
project.1.name: 第二个项目名称
project.1.desc: 第二个项目描述

[综合能力与荣誉]
skills: 专业技能/IT技能描述
languages: 外语能力/英语等级
honors.0.name: 荣誉奖项名称
`;

// 向大模型发起整页表单拓扑映射分析 (异步非阻塞，结果写入缓存)
async function triggerAiPageFormAnalysis() {
  if (isAiPageScanning) return;
  if (window.location.protocol === "file:" && !window.location.href.includes("test_page.html")) return;

  const currentUrl = window.location.href.split("#")[0];
  const items = extractPageDomTopology();
  if (!items || items.length === 0) return;

  isAiPageScanning = true;
  lastAiScanUrl = currentUrl;
  console.log(`[ResumeFiller AI] 开始整页表单拓扑分析，捕捉到 ${items.length} 个输入控件...`);

  const systemPrompt = `你是一个顶级网页表单结构与求职简历槽位语义映射专家。
你的任务是将招聘网申网页上的各个输入控件，精准映射到候选人简历的对应字段槽位（target_slot）上。

【映射候选标准字段列表 (RESUME_SCHEMA_SLOTS)】:
${RESUME_SCHEMA_SLOTS}

【严格遵守的推理原则】:
1. 绝对区分个人信息与他人信息：候选人本人的电话(basic.phone)、邮箱(basic.email)绝不能与紧急联系人(emergencyPhone/emergencyContact)或家庭成员混淆！
2. 绝对区分教育经历阶段：页面排在最前/标记为最高学历的一律对应 education.0.*；排在第2个教育卡片的一律对应 education.1.*。
3. 空间与成对关联：若两输入框成对并排(如入学与毕业，或省与市)，需根据前后顺序分别映射为 start/end 或 省/市。
4. 无法确定的字段：target_slot 设为 "unknown"，置信度低于 0.6。
5. 必须严格以 JSON 格式输出，不得输出任何多余废话。

【输出 JSON 格式规范】:
{
  "mappings": [
    {
      "fid": "rf_fid_xxx",
      "slot": "basic.email",
      "confidence": 0.98,
      "reason": "上下文为个人联系信息，控件类型为email，placeholder提示输入常用邮箱"
    }
  ]
}`;

  const userPrompt = `请对以下页面上的 ${items.length} 个表单输入控件进行语义对齐分析：\n` + JSON.stringify(items, null, 2);

  try {
    const resp = await new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: { prompt: userPrompt, systemPrompt, jsonMode: true }
        }, resolve);
      } else {
        resolve({ success: false, error: "chrome.runtime unavailable" });
      }
    });

    if (!resp || !resp.success) {
      console.warn("[ResumeFiller AI] 大模型分析未完成:", resp ? resp.error : "未知错误");
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(resp.data);
    } catch(e) {
      const match = resp.data.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && Array.isArray(parsed.mappings)) {
      let mappedCount = 0;
      parsed.mappings.forEach((m) => {
        if (m.fid && m.slot && m.slot !== "unknown") {
          aiFieldMappingCache.set(m.fid, {
            slot: m.slot,
            confidence: m.confidence || 0.9,
            reason: m.reason || "",
            timestamp: Date.now()
          });
          mappedCount++;
        }
      });
      console.log(`[ResumeFiller AI] 整页表单拓扑映射完成！成功建立 ${mappedCount} 个输入框的高精度语义绑定。`);
      
      // 如果当前正有输入框聚焦，通知气泡刷新
      if (lastActiveElement && document.body.contains(lastActiveElement)) {
        window.dispatchEvent(new CustomEvent("rf-ai-mapping-updated", { detail: { count: mappedCount } }));
      }
    }
  } catch(err) {
    console.warn("[ResumeFiller AI] 分析流程异常:", err);
  } finally {
    isAiPageScanning = false;
  }
}

// 针对单个控件的即时高精度微调精修 (Micro Refinement)
async function requestAiSingleFieldRefinement(el) {
  if (!el) return null;
  const fid = getElementStableFingerprint(el);
  const clues = getElementClues(el);
  const breadcrumb = getElementBreadcrumbPath(el);
  const parentText = (el.parentElement ? el.parentElement.innerText || el.parentElement.textContent || "" : "").replace(/\s+/g, " ").slice(0, 300);

  const singleItem = {
    fid,
    tag: el.tagName.toLowerCase(),
    type: (el.type || el.tagName).toLowerCase(),
    placeholder: el.placeholder || "",
    breadcrumb,
    clues: clues.slice(0, 8),
    parentContextText: parentText
  };

  const systemPrompt = `你是一个表单字段精确定位专家。请分析给定输入框在求职网申表单中对应的最准确简历字段槽位。
参考槽位：${RESUME_SCHEMA_SLOTS}
请严格输出格式：{"slot": "basic.email", "confidence": 0.99, "reason": "说明"}，不可带其它说明。`;

  const userPrompt = `分析此输入控件：\n` + JSON.stringify(singleItem, null, 2);

  console.log("[ResumeFiller Content] 正在向后台请求单点 AI 重诊...", singleItem);

  try {
    const resp = await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ success: false, error: "前后台通信超时 (28s)" });
        }
      }, 28000);

      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: {
            prompt: userPrompt,
            systemPrompt,
            jsonMode: true,
            meta: { action: "single_refine", element: singleItem, url: window.location.href }
          }
        }, (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        });
      } else {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: false, error: "未连接到扩展后台 (chrome.runtime 不可用)" });
        }
      }
    });

    if (!resp) {
      throw new Error("后台未返回响应");
    }
    if (!resp.success) {
      throw new Error(resp.error || "大模型调用未成功");
    }

    let parsed = null;
    try {
      parsed = JSON.parse(resp.data);
    } catch(e) {
      const match = resp.data.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("模型未按 JSON 格式返回: " + resp.data.slice(0, 80));
      }
    }

    if (parsed && parsed.slot) {
      aiFieldMappingCache.set(fid, {
        slot: parsed.slot,
        confidence: parsed.confidence || 0.95,
        reason: parsed.reason || "单点精修识别",
        timestamp: Date.now()
      });
      return parsed.slot;
    } else {
      throw new Error("模型返回数据中未包含有效 slot 字段");
    }
  } catch(e) {
    console.error("[ResumeFiller AI] 单点精修失败:", e);
    throw e;
  }
}

// 页面加载完成后默认不静默消耗 AI 分析，完全由用户在气泡上自主点击【🪄AI重诊】时按需调用
// 如需整页分析，可在需要时由接口明确触发
if (typeof window !== "undefined" && typeof document !== "undefined") {
  // 保持按需调用机制
}

// 暴露接口给同在 content script 中的悬浮卡片模块调用
window.ResumeFillerContent = {
  smartFillPage,
  fillSection,
  setElementValue,
  detectFieldForElement,
  detectEducationItemIndex,
  detectProjectItemIndex,
  inspectSelectType,
  detectYearMonthSelectRole,
  parseChineseArea,
  autoSelectCascaderArea,
  autoCheckAgreements,
  triggerAiPageFormAnalysis,
  requestAiSingleFieldRefinement,
  setAiFieldMapping: (fid, mapping) => aiFieldMappingCache.set(fid, mapping),
  getAiFieldMapping: (fid) => aiFieldMappingCache.get(fid),
  getLastActiveElement: () => lastActiveElement,
  fillFocusedInput: (val) => {
    if (lastActiveElement && document.body.contains(lastActiveElement)) {
      setElementValue(lastActiveElement, val);
      return true;
    }
    return false;
  }
};

// 中文友好的字段名称映射
const FIELD_LABEL_MAP = {
  name: "姓名",
  lastName: "姓氏",
  firstName: "名字",
  gender: "性别",
  ethnicity: "民族",
  birth: "出生日期",
  height: "身高",
  weight: "体重",
  phone: "手机号码",
  email: "电子邮箱",
  political: "政治面貌",
  city: "现居城市",
  nativePlace: "籍贯",
  nativeProvince: "户籍所在省",
  nativeCity: "户籍所在地市",
  residenceProvince: "现居住省",
  residenceCity: "现居住市",
  idCard: "身份证号",
  wechat: "微信号",
  residence: "现居详细地址",
  website: "个人网站",
  github: "GitHub",
  emergencyContact: "紧急联系人姓名",
  emergencyRelation: "与紧急联系人关系",
  emergencyPhone: "紧急联系人电话",
  jobIntent: "求职意向",
  selfEval: "自我评价",
  selfDescription: "自我描述",
  highestDegree: "最高学历",
  country: "所在国家",
  acceptRelocation: "城市调剂",
  extraInfo: "补充说明",
  skills: "专业技能",
  languages: "语言能力",

  school: "学校名称",
  degree: "学历学位",
  major: "所学专业",
  gpa: "绩点/成绩",
  start: "开始时间",
  startYear: "入学年份",
  startMonth: "入学月份",
  end: "结束时间",
  endYear: "毕业年份",
  endMonth: "毕业月份",
  supervisor: "导师姓名",
  majorDescription: "专业描述",
  thesisTopic: "毕业论文/设计/作品",
  courses: "主修课程",
  researchDirection: "研究方向",
  department: "院系名称",
  labExperience: "科研/实验室经历",
  studentId: "学号",
  schoolLocation: "学校所在地",

  company: "公司名称",
  position: "职位岗位",

  tech: "主要技术栈",
  desc: "项目描述",
  duty: "项目职责",
  result: "项目成果"
};

// 根据槽位路径解析真实简历数据与候选推荐列表
function resolveSlotValueAndMetadata(slot, resumeData, el) {
  if (!slot || !resumeData) return null;
  const parts = slot.split(".");
  const clues = el ? getElementClues(el) : [];

  if (parts[0] === "basic" && parts[1]) {
    const subKey = parts[1];
    const val = getBasicFieldDerivedValue(subKey, resumeData);
    let suggestions = [];

    if (subKey === "name") {
      const split = splitChineseName(resumeData.basic.name || "");
      if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
      if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
    } else if (subKey.startsWith("emergency")) {
      ["emergencyContact", "emergencyRelation", "emergencyPhone"].forEach(k => {
        if (k !== subKey && resumeData.basic[k]) {
          suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
        }
      });
    }

    return {
      section: "basic",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val || "",
      clues,
      suggestions,
      isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)
    };
  }

  if (parts[0] === "education" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.education && resumeData.education[idx];
    const val = item ? getEducationFieldValue(item, subKey) : "";
    let suggestions = [];

    if (["start", "startYear", "startMonth", "end", "endYear", "endMonth"].includes(subKey) && item) {
      if (item.start) {
        const [sy, sm] = item.start.split("-");
        if (sy) suggestions.push({ label: `${sy}年`, value: sy });
        if (sm) suggestions.push({ label: `${sm}月`, value: sm });
      }
      if (item.end) {
        const [ey, em] = item.end.split("-");
        if (ey) suggestions.push({ label: `${ey}年`, value: ey });
        if (em) suggestions.push({ label: `${em}月`, value: em });
      }
    }

    return {
      section: "education",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val || "",
      clues,
      suggestions
    };
  }

  if (parts[0] === "internship" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.internship && resumeData.internship[idx];
    const val = item ? (item[subKey] || "") : "";
    return {
      section: "internship",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val,
      clues,
      suggestions: []
    };
  }

  if (parts[0] === "project" && parts.length >= 3) {
    const idx = parseInt(parts[1], 10) || 0;
    const subKey = parts[2];
    const item = resumeData.project && resumeData.project[idx];
    const val = item ? (item[subKey] || "") : "";
    let suggestions = [];
    if (item) {
      ["desc", "duty", "result", "tech"].forEach(k => {
        if (k !== subKey && item[k]) {
          suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
        }
      });
    }
    return {
      section: "project",
      subKey,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[subKey] || subKey,
      value: val,
      clues,
      suggestions
    };
  }

  if (slot === "skills" || slot === "languages") {
    return {
      section: "basic",
      subKey: slot,
      fieldKey: slot,
      label: FIELD_LABEL_MAP[slot] || slot,
      value: resumeData[slot] || "",
      clues,
      suggestions: []
    };
  }

  return null;
}

// 精确单字段识别与匹配算法
function detectFieldForElement(el, resumeData) {
  try {
    if (!el || !isEditableElement(el) || !resumeData) return null;

    // ==================== 优先层：大模型拓扑映射缓存查询 ====================
    const fid = getElementStableFingerprint(el);
    const aiMapping = aiFieldMappingCache.get(fid);
    if (aiMapping && aiMapping.slot && aiMapping.confidence >= 0.7) {
      const slot = aiMapping.slot; // e.g. "basic.email", "education.0.school", "project.0.desc"
      const resolved = resolveSlotValueAndMetadata(slot, resumeData, el);
      if (resolved) {
        resolved.isAiMatched = true;
        resolved.confidence = aiMapping.confidence;
        resolved.reason = aiMapping.reason;
        return resolved;
      }
    }

    const clues = getElementClues(el);
    if (!clues || clues.length === 0) return null;

    // 0. 输入框自身高特异性类型与属性强判定 (最高优先级，严禁被祖先容器的"姓名"等词汇截胡)
    const elType = (el.type || "").toLowerCase();
    const elName = (el.name || "").toLowerCase();
    const elId = (el.id || "").toLowerCase();
    const elPlaceholder = (el.placeholder || "").toLowerCase();

    // 邮箱直接锁定 (全面适配 Moka / Beisen / 各类招聘系统)
    const isEmailClue = elType === "email" ||
      /email|e-mail|mail/i.test(elName) ||
      /email|e-mail|mail/i.test(elId) ||
      /邮箱|email|e-mail|mail/i.test(elPlaceholder) ||
      clues.some(c => /^(?:电子)?邮箱(?:地址)?$|^email$/i.test(c.trim()));

    if (isEmailClue && !clues.some(c => /紧急|父母|家属|亲属|证明人|推荐人/i.test(c))) {
      return {
        section: "basic",
        subKey: "email",
        fieldKey: "basic.email",
        label: FIELD_LABEL_MAP.email || "电子邮箱",
        value: resumeData.basic.email || "",
        clues,
        suggestions: []
      };
    }

    // 手机电话直接锁定
    const isPhoneClue = elType === "tel" ||
      /(?:^|[_.-])(?:mobile|phone|tel)(?:[_.-]|$)/i.test(elName) ||
      /(?:^|[_.-])(?:mobile|phone|tel)(?:[_.-]|$)/i.test(elId) ||
      /(?:手机|电话|手机号|手机号码|联系电话|移动电话)/i.test(elPlaceholder) ||
      clues.some(c => /^(?:手机号?码?|联系电话|移动电话)$/i.test(c.trim()));

    if (isPhoneClue && !clues.some(c => /紧急|父母|家属|亲属|证明人|推荐人/i.test(c))) {
      return {
        section: "basic",
        subKey: "phone",
        fieldKey: "basic.phone",
        label: FIELD_LABEL_MAP.phone || "手机号码",
        value: resumeData.basic.phone || "",
        clues,
        suggestions: []
      };
    }

  // 0.1 专门探测就读时间年-月输入框/下拉框 (支持输入框/下拉框叫“年”、“月”、“就读时间”等全形态)
  let eduDateRole = null;
  if (el.tagName === "SELECT") {
    const sType = inspectSelectType(el);
    if (sType) {
      eduDateRole = detectYearMonthSelectRole(el, sType, clues);
    }
  }
  if (!eduDateRole) {
    const sectionCtx = getContextSection(el);
    eduDateRole = inspectEduDateTimeRole(el, clues, sectionCtx);
  }

  if (eduDateRole) {
    const subKey = eduDateRole;
    const eduIdx = detectEducationItemIndex(el, clues, resumeData, 0);
    const item = resumeData.education && resumeData.education[eduIdx];
    const val = getEducationFieldValue(item, subKey);
    
    let suggestions = [];
    const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
    const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));

    if (subKey === 'startYear' || subKey === 'endYear') {
      if (masterEdu) {
        const myStartYear = masterEdu.start ? masterEdu.start.split('-')[0] : "";
        const myEndYear = masterEdu.end ? masterEdu.end.split('-')[0] : "";
        if (myStartYear) suggestions.push({ label: `硕入学: ${myStartYear}年`, value: myStartYear });
        if (myEndYear) suggestions.push({ label: `硕毕业: ${myEndYear}年`, value: myEndYear });
      }
      if (bachelorEdu) {
        const bStartYear = bachelorEdu.start ? bachelorEdu.start.split('-')[0] : "";
        const bEndYear = bachelorEdu.end ? bachelorEdu.end.split('-')[0] : "";
        if (bStartYear) suggestions.push({ label: `本入学: ${bStartYear}年`, value: bStartYear });
        if (bEndYear) suggestions.push({ label: `本毕业: ${bEndYear}年`, value: bEndYear });
      }
    } else if (subKey === 'startMonth' || subKey === 'endMonth') {
      if (masterEdu) {
        const myStartMonth = masterEdu.start ? masterEdu.start.split('-')[1] : "";
        const myEndMonth = masterEdu.end ? masterEdu.end.split('-')[1] : "";
        if (myStartMonth) suggestions.push({ label: `硕入学: ${myStartMonth}月`, value: myStartMonth });
        if (myEndMonth) suggestions.push({ label: `硕毕业: ${myEndMonth}月`, value: myEndMonth });
      }
      if (bachelorEdu) {
        const bStartMonth = bachelorEdu.start ? bachelorEdu.start.split('-')[1] : "";
        const bEndMonth = bachelorEdu.end ? bachelorEdu.end.split('-')[1] : "";
        if (bStartMonth) suggestions.push({ label: `本入学: ${bStartMonth}月`, value: bStartMonth });
        if (bEndMonth) suggestions.push({ label: `本毕业: ${bEndMonth}月`, value: bEndMonth });
      }
    } else if (subKey === 'start' || subKey === 'end') {
      if (item && item.start) suggestions.push({ label: `入学: ${item.start}`, value: item.start });
      if (item && item.end) suggestions.push({ label: `毕业: ${item.end}`, value: item.end });
    }

    return {
      section: 'education',
      subKey,
      fieldKey: `education.${eduIdx}.${subKey}`,
      label: (FIELD_LABEL_MAP[subKey] || '就读时间'),
      value: val,
      clues,
      suggestions
    };
  }

  // 1. 强指示词优先匹配 (优先级最高，规避导师/紧急联系人/项目描述混淆)
  for (let indicator of STRONG_INDICATORS) {
    if (isMatch(clues, indicator.keywords)) {
      const section = indicator.section;
      const subKey = indicator.subKey;
      if (section === 'basic') {
        if (subKey === 'name') {
          if (EXCLUSIONS.name.some(ex => clues.some(c => c.includes(ex)))) {
            continue; // 包含导师、紧急联系人、亲属、父母、公司等关键词时，严禁误判为本人全名
          }
        }
        const val = getBasicFieldDerivedValue(subKey, resumeData);
        let suggestions = [];
        if (subKey.startsWith('emergency')) {
          ['emergencyContact', 'emergencyRelation', 'emergencyPhone'].forEach(k => {
            if (k !== subKey && resumeData.basic[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
            }
          });
        } else if (subKey === 'name') {
          const split = splitChineseName(resumeData.basic.name || "");
          if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
          if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
        } else if (subKey === 'height' && val) {
          const num = val.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}cm`, value: `${num}cm` });
          suggestions.push({ label: num, value: num });
        } else if (subKey === 'weight' && val) {
          const num = val.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}kg`, value: `${num}kg` });
          suggestions.push({ label: `${num}公斤`, value: `${num}公斤` });
          suggestions.push({ label: num, value: num });
        } else if (['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)) {
          const areaBase = (subKey.startsWith('native') ? resumeData.basic.nativePlace : (resumeData.basic.residence || resumeData.basic.city)) || "";
          const areaParts = parseChineseArea(areaBase);
          areaParts.forEach(part => {
            suggestions.push({ label: part, value: part });
          });
        }
        return {
          section: 'basic',
          subKey,
          fieldKey: `basic.${subKey}`,
          label: (FIELD_LABEL_MAP[subKey] || subKey),
          value: val,
          clues,
          suggestions,
          isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(subKey)
        };
      }

      let idx = 0;
      if (section === 'education') {
        idx = detectEducationItemIndex(el, clues, resumeData, 0);
      } else if (section === 'project') {
        idx = detectProjectItemIndex(el, clues, resumeData, 0);
      }
      const item = resumeData[section] && resumeData[section][idx];
      const val = (section === 'education') ? getEducationFieldValue(item, subKey) : (item ? (item[subKey] || "") : "");
      
      // 生成相关候选项，方便用户在气泡中一键选择其他相近字段
      let suggestions = [];
      if (section === 'project' && item) {
        if (subKey === 'name') {
          resumeData.project.forEach((p, pIdx) => {
            if (p.name) {
              suggestions.push({ label: `项${pIdx + 1}: ${p.name.slice(0, 10)}`, value: p.name });
            }
          });
        } else {
          ['desc', 'duty', 'result', 'tech'].forEach(k => {
            if (k !== subKey && item[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
            }
          });
        }
      } else if (section === 'education' && item) {
        if (subKey === 'school') {
          // 本硕直选双胶囊
          const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
          const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));
          if (masterEdu && masterEdu.school) {
            suggestions.push({ label: `硕: ${masterEdu.school.replace(/（.*）/, '')}`, value: masterEdu.school });
          }
          if (bachelorEdu && bachelorEdu.school) {
            suggestions.push({ label: `本: ${bachelorEdu.school.replace(/（.*）/, '')}`, value: bachelorEdu.school });
          }
        } else if (['start', 'startYear', 'startMonth', 'end', 'endYear', 'endMonth'].includes(subKey)) {
          // 年月拆分直选胶囊
          if (item.start) {
            const [sy, sm] = item.start.split('-');
            if (sy) suggestions.push({ label: `${sy}年`, value: sy });
            if (sm) suggestions.push({ label: `${sm}月`, value: sm });
          }
          if (item.end) {
            const [ey, em] = item.end.split('-');
            if (ey) suggestions.push({ label: `${ey}年`, value: ey });
            if (em) suggestions.push({ label: `${em}月`, value: em });
          }
        } else {
          ['supervisor', 'courses', 'researchDirection', 'major'].forEach(k => {
            if (k !== subKey && item[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
            }
          });
        }
      } else if (section === 'family') {
        (resumeData.family || []).forEach(f => {
          if (f.name && f.relation) {
            suggestions.push({ label: `${f.relation}: ${f.name}`, value: f[subKey] || f.name });
          }
        });
      }

      return {
        section,
        subKey,
        fieldKey: `${section}.${idx}.${subKey}`,
        label: (FIELD_LABEL_MAP[subKey] || subKey),
        value: val,
        clues,
        suggestions
      };
    }
  }

  // 2. 根据上下文标题结构匹配板块子字段
  const sectionContext = getContextSection(el);
  if (sectionContext && KEYWORDS[sectionContext]) {
    const subKeywords = KEYWORDS[sectionContext];
    for (let subKey in subKeywords) {
      if (isMatch(clues, subKeywords[subKey])) {
        let idx = 0;
        if (sectionContext === 'education') {
          idx = detectEducationItemIndex(el, clues, resumeData, 0);
        } else if (sectionContext === 'project') {
          idx = detectProjectItemIndex(el, clues, resumeData, 0);
        }
        const item = resumeData[sectionContext] && resumeData[sectionContext][idx];
        const val = (sectionContext === 'education') ? getEducationFieldValue(item, subKey) : (item ? (item[subKey] || "") : "");
        let suggestions = [];
        if (sectionContext === 'project' && item) {
          if (subKey === 'name') {
            resumeData.project.forEach((p, pIdx) => {
              if (p.name) {
                suggestions.push({ label: `项${pIdx + 1}: ${p.name.slice(0, 10)}`, value: p.name });
              }
            });
          } else {
            ['desc', 'duty', 'result', 'tech'].forEach(k => {
              if (k !== subKey && item[k]) {
                suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: item[k] });
              }
            });
          }
        } else if (sectionContext === 'education' && item) {
          if (subKey === 'school') {
            const masterEdu = resumeData.education.find(it => (it.degree || '').includes('硕') || (it.degree || '').includes('研'));
            const bachelorEdu = resumeData.education.find(it => (it.degree || '').includes('本') || (it.degree || '').includes('学士'));
            if (masterEdu && masterEdu.school) {
              suggestions.push({ label: `硕: ${masterEdu.school.replace(/（.*）/, '')}`, value: masterEdu.school });
            }
            if (bachelorEdu && bachelorEdu.school) {
              suggestions.push({ label: `本: ${bachelorEdu.school.replace(/（.*）/, '')}`, value: bachelorEdu.school });
            }
          } else if (['start', 'startYear', 'startMonth', 'end', 'endYear', 'endMonth'].includes(subKey)) {
            if (item.start) {
              const [sy, sm] = item.start.split('-');
              if (sy) suggestions.push({ label: `${sy}年`, value: sy });
              if (sm) suggestions.push({ label: `${sm}月`, value: sm });
            }
            if (item.end) {
              const [ey, em] = item.end.split('-');
              if (ey) suggestions.push({ label: `${ey}年`, value: ey });
              if (em) suggestions.push({ label: `${em}月`, value: em });
            }
          }
        }
        return {
          section: sectionContext,
          subKey,
          fieldKey: `${sectionContext}.${idx}.${subKey}`,
          label: (FIELD_LABEL_MAP[subKey] || subKey),
          value: val,
          clues,
          suggestions
        };
      }
    }
  }

  // 3. 基本信息匹配 (使用严格排除规则)
  for (let key in KEYWORDS) {
    if (!['education', 'internship', 'project', 'honors', 'competition', 'paper'].includes(key)) {
      const keywords = KEYWORDS[key];
      if (isMatch(clues, keywords)) {
        if (EXCLUSIONS[key]) {
          const hasExclusion = clues.some(clue => EXCLUSIONS[key].some(ex => clue.includes(ex)));
          if (hasExclusion) continue;
        }
        let matchedValue = (key === 'skills') ? resumeData.skills : (key === 'languages' ? resumeData.languages : getBasicFieldDerivedValue(key, resumeData));
        let suggestions = [];
        if (key.startsWith('emergency')) {
          ['emergencyContact', 'emergencyRelation', 'emergencyPhone'].forEach(k => {
            if (k !== key && resumeData.basic[k]) {
              suggestions.push({ label: FIELD_LABEL_MAP[k] || k, value: resumeData.basic[k] });
            }
          });
        } else if (key === 'name') {
          const split = splitChineseName(resumeData.basic.name || "");
          if (split.lastName) suggestions.push({ label: `姓: ${split.lastName}`, value: split.lastName });
          if (split.firstName) suggestions.push({ label: `名: ${split.firstName}`, value: split.firstName });
        } else if (key === 'height' && matchedValue) {
          const num = matchedValue.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}cm`, value: `${num}cm` });
          suggestions.push({ label: num, value: num });
        } else if (key === 'weight' && matchedValue) {
          const num = matchedValue.replace(/[^0-9.]/g, '');
          suggestions.push({ label: `${num}kg`, value: `${num}kg` });
          suggestions.push({ label: `${num}公斤`, value: `${num}公斤` });
          suggestions.push({ label: num, value: num });
        } else if (['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(key) && matchedValue) {
          const areaParts = parseChineseArea(matchedValue);
          areaParts.forEach(part => {
            suggestions.push({ label: part, value: part });
          });
        }
        return {
          section: 'basic',
          subKey: key,
          fieldKey: `basic.${key}`,
          label: (FIELD_LABEL_MAP[key] || key),
          value: matchedValue || "",
          clues,
          suggestions,
          isArea: ['nativePlace', 'nativeProvince', 'nativeCity', 'city', 'residence', 'residenceProvince', 'residenceCity'].includes(key)
        };
      }
    }
  }

  return null;
  } catch (err) {
    console.error("detectFieldForElement error:", err);
    return null;
  }
}
