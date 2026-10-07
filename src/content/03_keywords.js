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
  city: ['现居城市', '现居住城市', '居住城市', '当前城市', '期望工作城市', '期望工作地', '期望城市', '意向工作城市', 'current city', 'target city'],
  nativePlace: ['籍贯', '家乡', 'hometown', 'native place', 'birthplace', '生源地', '户籍所在地', '户籍地', '户口所在地', '户口地'],
  nativeProvince: ['户籍所在省', '户口所在省', '户籍省', '籍贯省', '出生省', '生源省'],
  nativeCity: ['户籍所在地市', '户口所在地市', '户籍市', '籍贯市', '出生城市', '生源城市'],
  residenceProvince: ['现居住省', '现居住地省', '现居省', '居住省', '所在省', '现住省', '居住地省'],
  residenceCity: ['现居住市', '现居住地市', '现居市', '居住市', '常住市', '现住市', '居住地市'],
  idCard: ['身份证', '身份证号', '身份证号码', '证件号码', '证件号', 'id card', 'idcard', 'id number', 'id_number', 'identity card', '公民身份号码'],
  wechat: ['微信', '微信号', '微信账号', 'wechat', 'weixin'],
  residence: ['现居地', '现居住地', '居住地', '居住地址', '现住址', '家庭住址', '通讯地址', '联系地址', '详细地址', '门牌号', 'residence', 'address', 'current address', 'home address', 'mailing address'],
  website: ['个人网站', '个人主页', '博客', 'website', 'blog', 'homepage', '个人网页', '作品集'],
  github: ['github', 'github主页', 'github链接', 'github地址', 'github repository'],
  emergencyContact: ['紧急联系人姓名', '紧急联系人名字', '紧急联系人', '联系人姓名', 'emergency contact name', 'emergency contact'],
  emergencyRelation: ['紧急联系人关系', '与紧急联系人关系', '与本人关系', '亲属关系', 'emergency relation', 'relationship'],
  emergencyPhone: ['紧急联系人电话', '紧急联系人手机', '紧急联系电话', '紧急联系方式', 'emergency contact phone', 'emergency phone'],
  jobIntent: ['求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位', '应聘岗位', '目标岗位', '期望岗位', '期望职位', '求职岗位', 'job intent', 'target position'],
  selfEval: ['自我评价', '自我介绍', '个人总结', '综合评价', '自我阐述', '个人优势', 'self evaluation', 'self intro', 'self_eval'],
  selfDescription: ['自我描述', '个人描述', '性格特质', '特质描述', '工作风格', 'self description', 'self_description', 'personal description'],
  highestDegree: ['最高学历', '最高学位', 'highest degree', 'highestdegree'],
  country: ['国家', '当前所在国家', '国籍', 'country', 'nationality', '所在地区', '国家地区'],
  acceptRelocation: ['调剂', '是否接受调剂', '接受城市调剂', '是否接受意向城市调剂', '接受调剂', '城市调剂', 'relocation', 'relocate'],
  extraInfo: ['补充说明', '其他说明', 'extra info', 'supplementary', '备注说明'],
  
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
    role: ['担任职务', '学生职务', '在校职务', '学生干部', '班长', '团支书', '职务', 'student role', 'campus role'],
    roleDescription: ['职务描述', '任职描述', '职务职责', '学生工作描述', '学生干部描述', '职务说明', 'role description'],
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
    desc: ['职责', '描述', '工作内容', '工作描述', '业绩', 'desc', 'description', 'responsibility', 'duty', '工作职责'],
    witness: ['证明人', '是否有证明人', '有无证明人', 'witness'],
    witnessName: ['证明人姓名', '证明人名字', '证明人联系人', 'witness name', 'witnessname'],
    witnessRelation: ['证明人关系', '与证明人关系', '证明人与本人关系', 'witness relation', 'witness relationship'],
    witnessPosition: ['证明人职务', '证明人职位', 'witness position', 'witness title'],
    witnessCompany: ['证明人单位', '证明人工作单位', '证明人所在单位', 'witness company', 'witness employer'],
    witnessPhone: ['证明人联系方式', '证明人电话', '证明人手机', '证明人联系电话', 'witness phone', 'witness contact']
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
    tech: ['项目技术', '技术栈', '主要技术', '使用技术', 'tech', 'technologies', 'technology', 'tools'],
    link: ['项目链接', '项目地址', '项目网址', '演示地址', '在线地址', '代码地址', '仓库地址', 'github链接', 'project link', 'project url', 'demo url', 'repository']
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
    level: ['机构', '级别', '颁发', '颁发机构', 'issuer', 'organization', 'level'],
    desc: ['奖项描述', '获奖描述', '荣誉描述', '奖励说明', '获奖说明', '奖项简介', 'award description', 'honor description']
  },

  // 家庭成员子字段 (国企/传统大厂高频)
  family: {
    relation: ['与本人关系', '家庭关系', '亲属关系', '关系'],
    name: ['家属姓名', '亲属姓名', '姓名', '成员姓名'],
    age: ['年龄', '家属年龄', '亲属年龄', '周岁', 'age'],
    political: ['政治面貌', '家属政治面貌', '亲属政治面貌', '政治', '面貌'],
    company: ['工作单位', '单位名称', '单位', '公司'],
    department: ['工作部门', '所在部门', '部门', '部 门'],
    position: ['职务', '职位', '担任职务', '职业'],
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
  { section: 'education', subKey: 'roleDescription', keywords: ['职务描述', '任职描述', '职务职责', '学生工作描述', '学生干部描述', 'role description'] },
  { section: 'education', subKey: 'role', keywords: ['担任职务', '学生职务', '在校职务', '学生干部', '班长', '团支书', 'student role'] },
  { section: 'education', subKey: 'schoolLocation', keywords: ['学校所在地', '学校所在城市', '学校地址', '院校所在地', '学校城市', '院校所在省市', '就读城市', '就读所在地', 'school location', 'university location', 'school address'] },
  { section: 'education', subKey: 'school', keywords: ['最高学历学校', '最高学历院校', '毕业学校', '毕业院校', '就读学校', '就读院校', '毕业大学', '学校名称', '院校名称', 'school name', 'university name'] },
  { section: 'education', subKey: 'major', keywords: ['专业名称', '所学专业', '就读专业', '主修专业', '就读专业名称', '专业', 'major name', 'major', 'discipline'] },
  { section: 'basic', subKey: 'city', keywords: ['意向工作城市', '期望工作城市', '期望工作地', '期望城市', '意向城市', '就职城市', '工作地点', 'target city'] },
  { section: 'basic', subKey: 'jobIntent', keywords: ['求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位', '应聘岗位', '目标岗位', '期望岗位', '期望职位'] },
  { section: 'internship', subKey: 'desc', keywords: ['工作内容', '实习内容', '工作职责', '实习职责', '实习描述', '工作描述', '内容', '职责描述'] },
  { section: 'honors', subKey: 'desc', keywords: ['奖励说明', '获奖描述', '荣誉简介', '荣誉描述', '简介', '奖项说明'] },
  { section: 'education', subKey: 'degree', keywords: ['最高学历', '最高学位', '毕业学历', '学历学位'] },
  { section: 'education', subKey: 'startYear', keywords: ['入学年份', '入学年度', '开始年份', '教育开始年', 'start year', 'start_year', 'edu_start_year'] },
  { section: 'education', subKey: 'startMonth', keywords: ['入学月份', '开始月份', 'start month', 'start_month', 'edu_start_month'] },
  { section: 'education', subKey: 'endYear', keywords: ['毕业年份', '毕业年度', '结束年份', '毕业时间年', 'graduation year', 'end year', 'end_year', 'edu_end_year'] },
  { section: 'education', subKey: 'endMonth', keywords: ['毕业月份', '结束月份', '毕业时间月', 'graduation month', 'end month', 'end_month', 'edu_end_month'] },
  { section: 'education', subKey: 'start', keywords: ['入学时间', '入学年月', '就读时间', '就读开始时间', '在校开始时间', '入学日期', 'start date', 'edu_start_date'] },
  { section: 'education', subKey: 'end', keywords: ['毕业时间', '毕业年月', '就读结束时间', '就读结束年月', '在校结束时间', '毕业日期', 'graduation date', 'edu_end_date'] },
  { section: 'education', subKey: 'thesisTopic', keywords: ['毕业论文', '毕业设计', '毕业作品', '毕业论文题目', '毕业设计题目', '毕设题目', '毕业论文/设计', '毕业论文/设计/作品', 'thesis', 'graduation project'] },
  { section: 'education', subKey: 'courses', keywords: ['主修课程', '核心课程', '专业课程', '核心专业课程', '主修专业课程', '所修课程', 'main courses', 'core courses', 'courses'] },
  { section: 'education', subKey: 'researchDirection', keywords: ['研究方向', '研究课题', '研究领域', 'research direction', 'research field'] },
  { section: 'education', subKey: 'department', keywords: ['院系名称', '学院名称'] },
  { section: 'education', subKey: 'studentId', keywords: ['学号', '学籍号', 'student id', 'studentid', 'student number'] },

  // 3. 家庭成员强指示词 (必须在通用姓名/单位/电话之前)
  { section: 'family', subKey: 'name', keywords: ['家庭成员姓名', '亲属姓名', '父亲姓名', '母亲姓名', '家属姓名'] },
  { section: 'family', subKey: 'age', keywords: ['亲属年龄', '家属年龄', '父亲年龄', '母亲年龄', '父母年龄', '亲属周岁'] },
  { section: 'family', subKey: 'political', keywords: ['亲属政治面貌', '家属政治面貌', '父亲政治面貌', '母亲政治面貌'] },
  { section: 'family', subKey: 'company', keywords: ['家庭成员工作单位', '亲属工作单位', '家属工作单位', '父亲工作单位', '母亲工作单位', '父母单位'] },
  { section: 'family', subKey: 'department', keywords: ['亲属工作部门', '家属工作部门', '亲属部门', '家属部门', '工作部门'] },
  { section: 'family', subKey: 'phone', keywords: ['家庭成员电话', '亲属电话', '家属电话', '父亲电话', '母亲电话', '父母电话', '父亲联系电话', '母亲联系电话', '家属联系电话', '亲属联系电话', '父母联系电话'] },
  { section: 'family', subKey: 'position', keywords: ['家庭成员职务', '亲属职务', '家属职务', '父亲职务', '母亲职务'] },
  { section: 'family', subKey: 'relation', keywords: ['家庭成员关系', '亲属关系', '与本人关系'] },

  // 4. 工作实习证明人与经历 (强指示词排在通用词前)
  { section: 'internship', subKey: 'witness', keywords: ['是否有证明人', '有无证明人', '证明人存在'] },
  { section: 'internship', subKey: 'witnessName', keywords: ['证明人姓名', '证明人名字', '证明人联系人', '实习证明人姓名'] },
  { section: 'internship', subKey: 'witnessRelation', keywords: ['证明人关系', '与证明人关系', '证明人与本人关系'] },
  { section: 'internship', subKey: 'witnessPosition', keywords: ['证明人职务', '证明人职位', '带教职务', '直属领导职务'] },
  { section: 'internship', subKey: 'witnessCompany', keywords: ['证明人单位', '证明人工作单位', '证明人所在单位'] },
  { section: 'internship', subKey: 'witnessPhone', keywords: ['证明人联系方式', '证明人电话', '证明人手机', '证明人联系电话'] },
  { section: 'internship', subKey: 'company', keywords: ['公司名称', '单位名称', '企业名称', '实习单位', '工作单位', '就职单位', '雇主名称', 'company name', 'work_company', 'intern_company'] },
  { section: 'internship', subKey: 'position', keywords: ['职位名称', '岗位名称', '担任职位', '任职岗位', '职位', '岗位', '实习职位', '实习岗位', '工作职位', '工作岗位', '实习职务', '工作职务', 'internship position', 'intern_position', 'work_position'] },
  { section: 'internship', subKey: 'start', keywords: ['入职时间', '开始时间', '工作开始时间', '实习开始时间', '在职开始时间', '在职起', '开始年月'] },
  { section: 'internship', subKey: 'end', keywords: ['离职时间', '结束时间', '工作结束时间', '实习结束时间', '在职结束时间', '在职止', '结束年月'] },
  { section: 'internship', subKey: 'desc', keywords: ['实习描述', '工作描述', '实习内容', '工作内容', '实习职责', '工作职责', '内容', '职责描述', '工作业绩', 'internship desc', 'work desc', 'internship description'] },
  { section: 'project', subKey: 'name', keywords: ['项目名称', '项目名字', 'project name', 'project title', 'proj_name'] },
  { section: 'project', subKey: 'role', keywords: ['项目角色', '项目担任角色', '项目职位', '职务', '担任职务', '角色', '担任角色', '项目中职责', '负责模块', 'project role', 'proj_role'] },
  { section: 'project', subKey: 'start', keywords: ['项目开始时间', '项目开始年月', '研发开始时间', '起止时间起', '开始时间'] },
  { section: 'project', subKey: 'end', keywords: ['项目结束时间', '项目结束年月', '研发结束时间', '起止时间止', '结束时间'] },
  { section: 'project', subKey: 'desc', keywords: ['项目描述', '项目介绍', '项目背景', 'project desc', 'project description', 'proj_desc'] },
  { section: 'project', subKey: 'duty', keywords: ['项目职责', '负责内容', '主要职责', '工作职责', 'project duty', 'project duties', 'responsibility', 'proj_duty'] },
  { section: 'project', subKey: 'result', keywords: ['项目成果', '项目业绩', '量化成果', '项目收益', 'project result', 'project results', 'project achievement', 'proj_result'] },
  { section: 'project', subKey: 'link', keywords: ['项目链接', '项目地址', '项目网址', '演示地址', '在线地址', '代码地址', '仓库地址', 'github链接', 'project link', 'project url', 'demo url', 'repository'] },
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
  { section: 'basic', subKey: 'workYears', keywords: ['工作年限', '工作经验', '工作年资', '经验年限', '年限', 'work years'] },
  { section: 'basic', subKey: 'availableTime', keywords: ['到岗时间', '最快到岗时间', '入职时间', '何时到岗', '可到岗时间', 'available time'] },
  { section: 'basic', subKey: 'expectedSalary', keywords: ['期望月薪', '期望薪资', '期望月薪(税前)', '期望月薪（税前）', '薪资要求', '期望薪酬', '薪酬期望'] },
  { section: 'basic', subKey: 'currentSalary', keywords: ['现月薪', '目前月薪', '现月薪(税前)', '现月薪（税前）', '当前月薪'] },
  { section: 'basic', subKey: 'jobIndustry', keywords: ['期望从事行业', '期望行业', '意向行业', '从事行业', '目标行业'] },
  { section: 'basic', subKey: 'jobIntent', keywords: ['期望从事职业', '期望职业', '意向职业', '目标职位', '求职意向', '意向岗位', '意向职位', '申请职位', '申请岗位'] },
  // 6. 赛事/论文/荣誉
  { section: 'competition', subKey: 'name', keywords: ['赛事名称', '竞赛名称', '比赛名称'] },
  { section: 'paper', subKey: 'title', keywords: ['论文名称', '期刊名称', '专利名称'] },
  { section: 'honors', subKey: 'desc', keywords: ['奖项描述', '获奖描述', '荣誉描述', '奖励说明', '获奖说明', '奖项简介', 'award description', 'honor description'] },
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
  jobIntent: ['项目', '公司', '实习', '学校', '专业', '调剂', '服从'],
  city: ['公司', '学校', '大学', '院校', '项目', '实习', '省', '调剂', '详细', '门牌'],
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
