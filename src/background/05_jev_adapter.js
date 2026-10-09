// ==================== TypeSafe AI / OpenRouter (Jev System-One) 专精决策模型适配器 ====================
const JEV_SLOT_CRITERIA = {
  "basic.name": "Candidate full real name (姓名)",
  "basic.lastName": "Candidate family name / surname (姓氏)",
  "basic.firstName": "Candidate given name (名字)",
  "basic.gender": "Gender / sex (性别 男/女)",
  "basic.birth": "Date of birth / birthday (出生日期/生日)",
  "basic.phone": "Mobile phone number (手机号码/联系电话)",
  "basic.email": "Email address (电子邮箱)",
  "basic.idCard": "ID card number / passport (身份证号/证件号码)",
  "basic.ethnicity": "Ethnicity / nationality group (民族)",
  "basic.political": "Political status (政治面貌 党员/团员/群众)",
  "basic.city": "Current living city (现居城市/所在城市)",
  "basic.nativePlace": "Native place / hukou / birth place (籍贯/户籍所在地/生源地)",
  "basic.residence": "Detailed current living address (现居详细地址/通信地址)",
  "basic.wechat": "WeChat ID (微信号)",
  "basic.website": "Personal website / portfolio URL (个人网站/作品集)",
  "basic.github": "GitHub profile link (GitHub主页)",
  "basic.jobIntent": "Job intention / applied position (求职意向/期望职位)",
  "basic.highestDegree": "Highest education degree (最高学历)",
  "basic.emergencyContact": "Emergency contact name (紧急联系人姓名)",
  "basic.emergencyRelation": "Emergency contact relationship (与紧急联系人关系)",
  "basic.emergencyPhone": "Emergency contact phone (紧急联系人电话)",
  "basic.selfEval": "Self evaluation / personal summary (自我评价/个人总结)",
  "basic.selfDescription": "Personal traits / self description (自我描述)",
  "basic.workYears": "Years of work experience (工作年限/工作经验)",
  "basic.availableTime": "Available start / onboarding time (到岗时间/入职时间)",
  "basic.expectedSalary": "Expected monthly salary before tax (期望月薪/期望薪资)",
  "basic.currentSalary": "Current monthly salary (现月薪/目前月薪)",
  "basic.jobIndustry": "Expected industry (期望从事行业/意向行业)",
  "education.0.school": "1st (Highest) education university/school name (最高学历毕业院校)",
  "education.0.degree": "1st (Highest) education degree level (最高学历学位 硕士/本科/博士)",
  "education.0.major": "1st (Highest) education major (最高学历所学专业)",
  "education.0.department": "1st education college/department (最高学历学院/院系)",
  "education.0.start": "1st education start date (最高学历入学时间)",
  "education.0.end": "1st education graduation/end date (最高学历毕业时间)",
  "education.0.gpa": "1st education GPA / rank (成绩绩点/排名)",
  "education.0.supervisor": "1st education advisor/supervisor (导师姓名)",
  "education.0.role": "1st education student/campus role (在校担任职务)",
  "education.0.roleDescription": "1st education student role description (职务描述/学生工作描述)",
  "education.0.researchDirection": "Research direction (研究方向)",
  "education.1.school": "2nd (Bachelor/Undergraduate) education school name (第二段/本科学校名称)",
  "education.1.degree": "2nd education degree (本科学历学位)",
  "education.1.major": "2nd education major (本科专业)",
  "education.1.start": "2nd education start date (本科入学时间)",
  "education.1.end": "2nd education graduation date (本科毕业时间)",
  "internship.0.company": "1st internship/work company name (第一段实习/工作单位名称)",
  "internship.0.position": "1st internship job title/position (第一段实习职位/岗位)",
  "internship.0.start": "1st internship start date (入职时间)",
  "internship.0.end": "1st internship end date (离职时间)",
  "internship.0.desc": "1st internship responsibilities and achievements (工作内容/职责描述)",
  "internship.1.company": "2nd internship/work company name (第二段实习公司名称)",
  "internship.1.position": "2nd internship position (第二段实习职位)",
  "internship.1.desc": "2nd internship description (第二段实习职责)",
  "project.0.name": "1st project name (第一个项目名称)",
  "project.0.role": "1st project role (项目担任角色)",
  "project.0.link": "1st project link/demo/repository URL (项目链接/项目地址)",
  "project.0.desc": "1st project description (项目描述/背景)",
  "project.0.duty": "1st project responsibility (项目个人职责)",
  "project.0.result": "1st project achievement (项目成果)",
  "project.1.name": "2nd project name (第二个项目名称)",
  "project.1.desc": "2nd project description (第二个项目描述)",
  "skills": "Professional IT/technical skills (专业技能/技术栈)",
  "languages": "Foreign language proficiency (外语能力/英语等级)",
  "honors.0.name": "1st award / honor name (荣誉奖项名称)",
  "honors.0.desc": "1st award / honor description (奖项描述/获奖说明)",
  "skip": "Unrelated field, already filled, or no matching resume slot"
};

async function handleTypeSafeJevCall({ prompt, systemPrompt, meta = {}, apiConfig, signal }) {
  const rawBaseUrl = (apiConfig.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const isOpenRouter = rawBaseUrl.includes("openrouter.ai");
  const rawModel = (apiConfig.model || (isOpenRouter ? "typesafe/jev-1.13" : "jev-latest")).trim();

  // 自动对齐模型名称前缀：OpenRouter 要求 "typesafe/jev-1.13"，官方要求 "jev-1.13" 或 "jev-latest"
  let model = rawModel;
  if (isOpenRouter) {
    if (!model.startsWith("typesafe/")) {
      model = model === "jev-latest" ? "typesafe/jev-1.13" : `typesafe/${model}`;
    }
  } else if (rawBaseUrl.includes("typesafe.ai")) {
    if (model.startsWith("typesafe/")) {
      model = model.replace(/^typesafe\//, "");
    }
  }

  // OpenRouter 与 TypeSafe 官方均使用 /systemone 端点处理 System-One 决策请求
  const url = rawBaseUrl.endsWith("/systemone") ? rawBaseUrl : `${rawBaseUrl}/systemone`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiConfig.apiKey}`
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://github.com/Suara17/OfferGo-resume-filler-extension";
    headers["X-Title"] = "OfferGo";
  }

  // 场景 A: 握手连通性测试 (Test Ping)
  if (meta.action === "test_ping" || meta.action === "test_connection") {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: "TypeSafe AI Jev connectivity handshake test",
        questions: {
          handshake: {
            type: "noul",
            instructions: "Is this API service online and healthy?"
          }
        }
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 402 || res.status === 403) {
        throw new Error(`额度不足或 API Key 无效 [${res.status}]: ${errText.slice(0, 120)}`);
      }
      throw new Error(`Jev 连接失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    return `pong (Jev System-One 在线, 网关: ${isOpenRouter ? "OpenRouter" : "TypeSafe Official"}, 模型: ${data.model || model})`;
  }

  // 场景 B: 网页单字段 AI 深度重诊 (Single Refine)
  if (meta.action === "single_refine") {
    const el = meta.element || {};
    const stateText = `Field: ${el.tag || "input"}, Type: ${el.type || "text"}, Labels: ${(el.clues || []).join(" ")}, Placeholder: ${el.placeholder || ""}, Breadcrumb: ${el.breadcrumb || ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: stateText,
        questions: {
          slot: {
            type: "choice",
            instructions: "Select the most accurate resume slot for this form field.",
            criteria: JEV_SLOT_CRITERIA
          }
        }
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev 重诊失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const chosenSlot = data.answers?.slot?.choice;
    const confidence = data.answers?.slot?.confidence || 0.95;

    if (chosenSlot && chosenSlot !== "skip") {
      return JSON.stringify({
        slot: chosenSlot,
        confidence,
        reason: `Jev System-One 决策对齐 (置信度: ${Math.round(confidence * 100)}%)`
      });
    }
    return JSON.stringify({ slot: "unknown", confidence: 0.5, reason: "Jev 未匹配到可靠槽位" });
  }

  // 场景 C: 多轮 Agent 并行决策步进 (Agent ReAct Step - 单次请求并行决策整页未填字段)
  if (meta.action === "agent_react_step") {
    const questions = {};
    const fieldMetaMap = {};

    // 从 prompt (State DSL) 中提取所有 status="empty" 的待填字段 (每轮最多并行评估 8 个)
    const emptyRegex = /\[(rf_fid_[^\]]+)\]\s*<(\w+)\s+type="([^"]*)"\s+label="([^"]*)"\s+section="([^"]*)"\s+status="empty"([^>]*)\/>/g;
    let match;
    let count = 0;
    while ((match = emptyRegex.exec(prompt)) !== null && count < 8) {
      const [, fid, tag, type, label, section, extra] = match;
      const isCombobox = extra.includes('role="combobox"') || tag === "select";
      fieldMetaMap[fid] = { fid, tag, type, label, section, isCombobox };
      questions[fid] = {
        type: "choice",
        instructions: `Map web form field [${fid}] (label="${label}", section="${section}", type="${type}") to the matching candidate resume slot, or 'skip' if unrelated.`,
        criteria: JEV_SLOT_CRITERIA
      };
      count++;
    }

    // 提取结构性添加按钮 (如 + 添加教育背景)
    const btnRegex = /\[(Btn_rf_fid_[^\]]+)\]\s*<button[^>]*section="([^"]*)"[^>]*>([^<]+)<\/button>/g;
    const btnMetaMap = {};
    let btnMatch;
    while ((btnMatch = btnRegex.exec(prompt)) !== null) {
      const [, btnId, sec, btnText] = btnMatch;
      btnMetaMap[btnId] = { btnId, sec, btnText };
      questions[btnId] = {
        type: "noul",
        instructions: `Does the candidate have multiple ${sec} records in summary that are not yet filled on the page, requiring us to click button "${btnText}"?`
      };
    }

    // 如果没有提取到具体问题，添加一个主决策探针
    if (Object.keys(questions).length === 0) {
      questions["isDone"] = {
        type: "noul",
        instructions: "Are all form fields already filled and complete?"
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        state: prompt.slice(0, 7500),
        questions
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev Agent 决策失败 [${res.status}]: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const answers = data.answers || {};
    const steps = [];

    // 1. 解析字段映射结果
    for (const [fid, fMeta] of Object.entries(fieldMetaMap)) {
      const ans = answers[fid];
      const chosen = ans?.choice;
      const conf = ans?.confidence ?? 0.9;
      if (chosen && chosen !== "skip" && conf >= 0.55) {
        if (fMeta.isCombobox) {
          steps.push({
            action: "solve_combobox",
            fieldId: fid,
            sourceSlot: chosen,
            reason: `Jev 决策搜索选择「${fMeta.label}」-> ${chosen}`
          });
        } else {
          steps.push({
            action: "fill_slot",
            fieldId: fid,
            slot: chosen,
            reason: `Jev 决策填入「${fMeta.label}」-> ${chosen}`
          });
        }
      }
    }

    // 2. 解析新增经历卡片按钮结果
    for (const [btnId, bMeta] of Object.entries(btnMetaMap)) {
      const ans = answers[btnId];
      if (ans && (ans.noul || 0) >= 0.65) {
        steps.push({
          action: "click_button",
          buttonId: btnId,
          reason: `Jev 决策点击「${bMeta.btnText}」扩充卡片`
        });
        break; // 每次点一个添加按钮
      }
    }

    return JSON.stringify({
      thought: `Jev 并行决策完成：评估 ${Object.keys(questions).length} 项，生成 ${steps.length} 个精准动作`,
      currentSection: "Jev并行决策引擎",
      steps
    });
  }

  throw new Error("TypeSafe Jev 是 System-One 决策模型，不支持开放式长文本生成。请在配置中切换为 OpenAI 兼容协议处理简历文本润色。");
}
