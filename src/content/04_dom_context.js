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

// 寻找最邻近的前置标题或同卡片核心特征，判断当前属于哪个表单板块（教育、项目、实习、荣誉、基本信息等）
function getContextSection(el) {
  if (!el) return null;

  // 1. 同卡片核心锚点推断 (向上攀爬寻找或 closest 经历卡片容器，彻底解决深层嵌套与标题缺失)
  let card = el.parentElement;
  let steps = 0;
  while (card && card !== document.body && steps < 10) {
    const inputCount = (typeof card.querySelectorAll === "function") ? card.querySelectorAll("input:not([type='hidden']), textarea, select").length : 0;
    if (inputCount >= 2 && inputCount <= 20) {
      const cardText = (card.innerText || card.textContent || "").slice(0, 1500);
      if (/公司名称|单位名称|企业名称|实习单位|工作单位|工作职责|实习职责/i.test(cardText)) {
        return "internship";
      }
      if (/项目名称|project name|项目职责|项目描述/i.test(cardText)) {
        return "project";
      }
      if (/学校名称|毕业院校|就读学校|毕业学校|最高学历学校|专业名称|所学专业/i.test(cardText)) {
        return "education";
      }
      if (/家庭成员|主要社会关系|父亲|母亲/i.test(cardText)) {
        return "family";
      }
      if (/奖项名称|荣誉名称|获奖时间/i.test(cardText)) {
        return "honors";
      }
    }
    if (inputCount > 20) break;
    card = card.parentElement;
    steps++;
  }

  // 兜底 closest 检查
  if (typeof el.closest === "function") {
    const closestCard = el.closest(".sub-section, .card, [class*='card' i], [class*='group' i], [class*='block' i], [class*='section' i], [class*='item-wrapper' i]");
    if (closestCard) {
      const cardText = (closestCard.innerText || closestCard.textContent || "").slice(0, 1500);
      if (/公司名称|单位名称|企业名称|实习单位|工作单位/i.test(cardText)) return "internship";
      if (/项目名称|project name/i.test(cardText)) return "project";
      if (/学校名称|毕业院校|就读学校|毕业学校/i.test(cardText)) return "education";
    }
  }
  let current = el;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      let header = null;
      if (isHeaderElement(sibling)) {
        header = sibling;
      } else {
        header = (typeof sibling.querySelector === "function") ? sibling.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="header"], legend') : null;
      }
      
      if (header) {
        const text = (header.textContent || "").replace(/[\s\t\n]+/g, "").toLowerCase();
        if (/教育经历|教育背景|学习经历|教育信息|学历信息|education/i.test(text)) {
          return 'education';
        }
        if (/项目经历|项目经验|科研项目|project/i.test(text)) {
          return 'project';
        }
        if (/工作经历|实习经历|工作经验|实习经验|任职经历|workexperience|internship/i.test(text)) {
          return 'internship';
        }
        if (/家庭成员|主要社会关系|家庭背景|亲属关系|family/i.test(text)) {
          return 'family';
        }
        if (/荣誉奖项|获奖经历|获奖情况|奖励情况|所获荣誉|honors|awards/i.test(text)) {
          return 'honors';
        }
        if (/基本信息|个人信息|个人资料|求职意向|联系信息|basicinfo|personalinfo/i.test(text)) {
          return 'basic';
        }
        if (/比赛经历|赛事经历|竞赛经历|competition/i.test(text)) {
          return 'competition';
        }
        if (/论文期刊|发表论文|学术期刊|专利成果|paper|publication/i.test(text)) {
          return 'paper';
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return null;
}

// 过滤页面上的占位词、错误提示词与无意义短语，严防污染为真实表单字段标签
function isMeaninglessLabelText(text) {
  if (!text) return true;
  const clean = text.replace(/[:：\*]/g, '').trim().toLowerCase();
  if (!clean || clean.length < 2) return true;
  return /^(?:请选择|请输入|请填写|必填|必填项|必填项未填写|项未写|未填写|未选择|select|choose|input|placeholder|\+86|86|年|月|日|至|到|--|~|至今|输入职位关键字|搜索职位)$/i.test(clean);
}

// 获取输入框最直接、最精准的关联标签 (Direct Label)，深度适配 Moka / 北森 / 飞书 / 各大厂自研招聘系统
function getElementDirectLabel(element) {
  if (!element) return "";
  // 飞书 Formily 的 label 位于 item 容器，不一定通过 label[for] 关联。
  if (getAtsProfile().id === "feishu") {
    const formilyLabel = getFeishuFormItemLabel(element);
    if (formilyLabel) return formilyLabel;
  }
  // Phoenix 真实交互目标是 select 根 div；标签通常绑定在其内部隐藏/搜索 input 上。
  const phoenixRoot = getPhoenixSelectRoot(element);
  if (phoenixRoot && phoenixRoot !== element) {
    const rootLabel = getElementDirectLabel(phoenixRoot);
    if (rootLabel) return rootLabel;
  }

  // 1. 标准 label[for] 关联
  if (element.id) {
    try {
      const l = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (l) {
        const text = (l.innerText || l.textContent || "").trim();
        if (text && text.length < 35 && !isMeaninglessLabelText(text)) {
          return text.replace(/[:：\*]/g, '').trim();
        }
      }
    } catch(e) {}
  }

  // 2. 被 label 直接包裹
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const text = (parentLabel.innerText || parentLabel.textContent || "").trim();
    if (text && text.length < 35 && !isMeaninglessLabelText(text)) {
      return text.replace(/[:：\*]/g, '').trim();
    }
  }

  // 3. 优先检索表单容器 (适配 Moka/北森/飞书/AntD/Element)
  // 查找最贴近当前输入的表单项容器，提取真实标签，严格排除错误提示节点和占位符节点
  const formItem = element.closest(
    '.form-item, .form-group, .ant-form-item, .el-form-item, .moka-form-item, .phoenix__form-item, ' +
    '[class*="form-item" i], [class*="formItem" i], [class*="field-item" i], [class*="fieldItem" i], ' +
    '[class*="item-wrapper" i], [class*="itemWrapper" i], [class*="form-group" i], [class*="fieldWrapper" i], ' +
    '[class*="formField" i], [class*="form-field" i], [class*="form_item" i], tr'
  );

  if (formItem) {
    const candidates = Array.from(formItem.querySelectorAll(
      'label, .ant-form-item-label, .el-form-item__label, [class*="item-label" i], [class*="itemLabel" i], ' +
      '[class*="field-label" i], [class*="fieldLabel" i], [class*="moka-form-item-label" i], ' +
      '[class*="label" i], [class*="title" i], th'
    )).filter(c => {
      if (c.contains(element)) return false;
      // 排除红字错误提示节点与占位符节点
      if (c.closest('[class*="error" i], [class*="explain" i], [class*="invalid" i], [class*="placeholder" i]')) return false;
      return true;
    });

    for (const cand of candidates) {
      const text = (cand.innerText || cand.textContent || "").replace(/[:：\*]/g, '').trim();
      if (text && text.length >= 2 && text.length < 35 && !isMeaninglessLabelText(text)) {
        return text;
      }
    }
  }

  // 4. 跨层级检索父级或祖先级的前置标题 (如 Moka 复杂的深层组件嵌套)
  // 4. 跨层级检索父级或祖先级的前置标题 (深度穿透，适配 Moka / 北森 常见的 5~8 层嵌套组件)
  let parent = element.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 8) {
    // 若当前容器已包含超过 3 个输入框，说明已经超出单个表单项范围进入了整行或整个板块，避免误取大标题
    if (parent.querySelectorAll("input:not([type='hidden']), textarea, select").length > 3) {
      break;
    }
    let pPrev = parent.previousElementSibling;
    while (pPrev) {
      if (!pPrev.closest('[class*="error" i], [class*="explain" i]')) {
        const text = (pPrev.innerText || pPrev.textContent || "").replace(/[:：\*]/g, '').trim();
        if (text && text.length >= 2 && text.length < 35 && !isMeaninglessLabelText(text)) {
          return text;
        }
      }
      pPrev = pPrev.previousElementSibling;
    }
    parent = parent.parentElement;
    depth++;
  }
  // 5. 前置兄弟节点兜底 (仅当非无效词时采纳)
  let prev = element.previousElementSibling;
  while (prev) {
    if (!prev.closest('[class*="error" i], [class*="explain" i]')) {
      const text = (prev.innerText || prev.textContent || "").replace(/[:：\*]/g, '').trim();
      if (text && text.length >= 2 && text.length < 30 && !isMeaninglessLabelText(text)) {
        return text;
      }
    }
    prev = prev.previousElementSibling;
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
  if (getAtsProfile().id === "feishu") {
    const formilyLabel = getFeishuFormItemLabel(element);
    if (formilyLabel && !clues.includes(formilyLabel.toLowerCase())) clues.unshift(formilyLabel.toLowerCase());
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
  if (isPhoenixSelectRoot(element)) {
    const ownText = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (ownText && ownText.length < 100) clues.push(ownText.toLowerCase());
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
  if (!Array.isArray(keywords) || !Array.isArray(clues)) return false;
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
