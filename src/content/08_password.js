// ==================== 智能密码生成器（AI理解格式要求 + 自动填入主密码与确认密码框） ====================

let passwordPickHandlers = null;

// 密码框探测器：在页面上寻找主密码框与确认密码框
function detectPasswordTargets() {
  const allInputs = Array.from(document.querySelectorAll("input, [role='textbox']"));
  const candidates = [];

  allInputs.forEach(el => {
    if (!el || !el.isConnected) return;
    if (el.closest && el.closest("#resume-filler-extension-host")) return;
    if (el.disabled || el.readOnly) return;

    const type = String(el.getAttribute("type") || "text").toLowerCase();
    const name = String(el.getAttribute("name") || "").toLowerCase();
    const id = String(el.id || "").toLowerCase();
    const placeholder = String(el.getAttribute("placeholder") || "").toLowerCase();
    const ariaLabel = String(el.getAttribute("aria-label") || "").toLowerCase();
    const clueText = (name + " " + id + " " + placeholder + " " + ariaLabel).trim();

    const isPasswordType = type === "password";
    const isPasswordName = /(?:password|passwd|pwd|passcode|口令|密码)/i.test(clueText);

    if (isPasswordType || isPasswordName) {
      if (isSmsVisibleElement(el)) {
        candidates.push(el);
      }
    }
  });

  if (candidates.length === 0) {
    return { hasTarget: false, mainPassword: null, confirmPassword: null, all: [], label: "未找到密码输入框" };
  }

  // 区分主密码框和确认密码框
  let mainPassword = null;
  let confirmPassword = null;

  for (let el of candidates) {
    const text = (
      (el.name || "") + " " +
      (el.id || "") + " " +
      (el.placeholder || "") + " " +
      (el.getAttribute("aria-label") || "")
    ).toLowerCase();

    const isConfirm = /(?:confirm|repeat|again|repassword|repwd|pwd2|passwd2|确认|再次|重复)/i.test(text);
    if (isConfirm) {
      if (!confirmPassword) confirmPassword = el;
    } else {
      if (!mainPassword) mainPassword = el;
    }
  }

  if (!mainPassword && candidates.length > 0) {
    mainPassword = candidates[0];
  }
  if (!confirmPassword && candidates.length >= 2) {
    confirmPassword = candidates.find(c => c !== mainPassword) || candidates[1];
  }

  const label = confirmPassword 
    ? "已定位：主密码框 + 确认密码框" 
    : "已定位：密码输入框";

  return {
    hasTarget: true,
    mainPassword,
    confirmPassword,
    all: candidates,
    label
  };
}

// 自动提取网页上的密码格式要求提示文案
function extractPasswordRequirementHints() {
  const targets = detectPasswordTargets();
  const input = targets.mainPassword || (targets.all && targets.all[0]);
  if (!input) return "";

  const hints = [];
  const pushHint = (t) => {
    if (!t) return;
    const clean = String(t).trim().replace(/\s+/g, " ");
    if (clean.length >= 4 && clean.length <= 140 && !hints.includes(clean)) {
      if (/(?:位|字符|字母|数字|大小写|特殊|长度|不少于|至|~|-|min|max|包含|必须)/i.test(clean)) {
        hints.push(clean);
      }
    }
  };

  pushHint(input.getAttribute("placeholder"));
  pushHint(input.getAttribute("title"));
  pushHint(input.getAttribute("data-placeholder"));
  pushHint(input.getAttribute("aria-description"));

  let parent = input.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 4) {
    const textNodes = Array.from(parent.querySelectorAll(".tip, .rule, .rules, .desc, .hint, .help-block, .form-text, span, p, div, label"));
    for (let node of textNodes) {
      if (node !== input && !node.contains(input)) {
        pushHint(node.innerText || node.textContent);
      }
    }
    parent = parent.parentElement;
    depth++;
  }

  return hints[0] || "";
}

function cryptoRandomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

// 本地高精度随机密码求解器（免 API Key / 离线高可用 / 强随机）
function generatePasswordLocally(ruleText = "") {
  const text = String(ruleText || "").toLowerCase();

  let minLen = 8;
  let maxLen = 16;

  const rangeMatch = text.match(/(\d+)\s*[-~到至]\s*(\d+)/);
  if (rangeMatch) {
    minLen = parseInt(rangeMatch[1], 10);
    maxLen = parseInt(rangeMatch[2], 10);
  } else {
    const atLeastMatch = text.match(/(?:至少|不少于|不低于|大于等于?)\s*(\d+)/);
    if (atLeastMatch) {
      minLen = parseInt(atLeastMatch[1], 10);
      maxLen = Math.max(minLen + 6, 16);
    } else {
      const exactMatch = text.match(/(\d+)\s*(?:位|个字符)/);
      if (exactMatch) {
        minLen = parseInt(exactMatch[1], 10);
        maxLen = minLen;
      }
    }
  }

  minLen = Math.max(4, Math.min(minLen, 64));
  maxLen = Math.max(minLen, Math.min(maxLen, 64));
  let targetLen = Math.min(maxLen, Math.max(minLen, Math.floor((minLen + maxLen) / 2)));
  if (targetLen < 12 && maxLen >= 12 && minLen <= 12) {
    targetLen = 12;
  }

  const isPureDigits = /(?:纯数字|仅数字|全数字|纯数字密码|6位纯数字)/i.test(text);
  if (isPureDigits) {
    return Array.from({ length: targetLen }, () => Math.floor(Math.random() * 10)).join("");
  }

  const noSpecial = /(?:不能包含特殊|禁止特殊|无特殊|不含特殊|仅限?字母和数字|只包含字母和数字|无需特殊)/i.test(text);
  const requireUpper = /(?:大写|uppercase)/i.test(text) || (!noSpecial && targetLen >= 8);
  const requireLower = /(?:小写|lowercase)/i.test(text) || true;
  const requireDigit = /(?:数字|number|digit)/i.test(text) || true;
  const requireSpecial = !noSpecial && (/(?:特殊|符号|标点|symbol|special)/i.test(text) || targetLen >= 10);

  const UPPERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 排除易混淆字符 I, O
  const LOWERS = "abcdefghijkmnpqrstuvwxyz";  // 排除 l, o
  const DIGITS = "23456789";                  // 排除 0, 1
  const SPECIALS = "@#$%&*!_+=";

  let pool = "";
  const guaranteed = [];

  if (requireLower) {
    pool += LOWERS;
    guaranteed.push(LOWERS[cryptoRandomInt(LOWERS.length)]);
  }
  if (requireUpper) {
    pool += UPPERS;
    guaranteed.push(UPPERS[cryptoRandomInt(UPPERS.length)]);
  }
  if (requireDigit) {
    pool += DIGITS;
    guaranteed.push(DIGITS[cryptoRandomInt(DIGITS.length)]);
  }
  if (requireSpecial) {
    pool += SPECIALS;
    guaranteed.push(SPECIALS[cryptoRandomInt(SPECIALS.length)]);
  }

  if (!pool) pool = LOWERS + UPPERS + DIGITS;

  while (guaranteed.length < targetLen) {
    guaranteed.push(pool[cryptoRandomInt(pool.length)]);
  }

  // Fisher-Yates 加密洗牌
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = guaranteed[i];
    guaranteed[i] = guaranteed[j];
    guaranteed[j] = tmp;
  }

  return guaranteed.join("");
}

// 智能密码生成器（大模型AI优先，本地加密求解器兜底）
async function generateSmartPassword(ruleText = "") {
  const rule = String(ruleText || "").trim() || "8-16位，包含大写字母、小写字母、数字和特殊字符";

  // 1. 尝试大模型 AI 理解与生成
  try {
    const systemPrompt = `你是一个专业的密码生成专家。你的任务是根据用户提供的密码格式要求，生成 1 个完全符合该规则的高强度随机密码。
请严格遵守：
1. 必须完全满足所有长度、字符种类（大写/小写/数字/特殊字符等）的所有约束。
2. 密码必须高随机性，不得使用常见连续字典词汇（如 admin, 123456, password 等）。
3. 必须以严格的 JSON 格式输出，不得包含任何额外废话：
{"password": "生成的密码", "ruleMatched": "规则满足简述"}`;

    const userPrompt = `密码格式要求：${rule}`;

    const resp = await new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(null); }
      }, 7000);

      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "callLLM",
          payload: { prompt: userPrompt, systemPrompt, jsonMode: true, meta: { action: "generate_password" } }
        }, (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        });
      } else {
        resolve(null);
      }
    });

    if (resp && resp.success && resp.data) {
      let parsed = null;
      try {
        parsed = JSON.parse(resp.data);
      } catch (e) {
        const m = resp.data.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      if (parsed && parsed.password) {
        const pwdStr = String(parsed.password).trim();
        if (pwdStr.length >= 4) {
          return {
            password: pwdStr,
            source: "ai",
            ruleMatched: parsed.ruleMatched || "符合指定格式要求"
          };
        }
      }
    }
  } catch (err) {
    console.warn("AI 密码生成未成功，降级为本地高精度规则生成器:", err);
  }

  // 2. 本地加密随机规则求解器兜底
  const localPwd = generatePasswordLocally(rule);
  return {
    password: localPwd,
    source: "local",
    ruleMatched: "本地高精度生成 (符合长度与字符类型约束)"
  };
}

// 将密码填入页面（同时自动填入主密码框与确认密码框）
function fillPasswordToPage(password) {
  if (!password) return { success: false, reason: "密码不能为空" };
  const targets = detectPasswordTargets();
  if (!targets.hasTarget || !targets.mainPassword) {
    return { success: false, reason: "当前页面未找到密码输入框，请使用「👉 点选填入」" };
  }

  let filledCount = 0;
  // 1. 填入主密码框
  setElementValue(targets.mainPassword, password);
  markElement(targets.mainPassword, "filled", "密码已填入");
  filledCount++;

  // 2. 填入确认密码框 (若存在)
  if (targets.confirmPassword && targets.confirmPassword !== targets.mainPassword) {
    setElementValue(targets.confirmPassword, password);
    markElement(targets.confirmPassword, "filled", "确认密码已同步填入");
    filledCount++;
  }

  // 尝试自动写入剪贴板，方便用户留底记录
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(password).catch(() => {});
    }
  } catch (e) {}

  return {
    success: true,
    count: filledCount,
    hasConfirm: !!targets.confirmPassword,
    mainElement: targets.mainPassword,
    confirmElement: targets.confirmPassword
  };
}

// 点选模式：点哪填哪
function stopPasswordPickMode() {
  if (!passwordPickHandlers) return;
  const h = passwordPickHandlers;
  document.removeEventListener("mousemove", h.move, true);
  document.removeEventListener("click", h.click, true);
  document.removeEventListener("keydown", h.key, true);
  if (h.highlighted && h.highlighted.style) {
    h.highlighted.style.outline = h.prevOutline || "";
    h.highlighted.style.outlineOffset = h.prevOffset || "";
  }
  passwordPickHandlers = null;
}

function startPasswordPickMode(password) {
  if (!password) return;
  stopPasswordPickMode();

  const handlers = { move: null, click: null, key: null, highlighted: null, prevOutline: "", prevOffset: "" };

  handlers.move = (e) => {
    const el = e.target;
    if (!el || !el.style || el.closest && el.closest("#resume-filler-extension-host")) return;
    if (handlers.highlighted === el) return;
    if (handlers.highlighted && handlers.highlighted.style) {
      handlers.highlighted.style.outline = handlers.prevOutline || "";
      handlers.highlighted.style.outlineOffset = handlers.prevOffset || "";
    }
    handlers.highlighted = el;
    handlers.prevOutline = el.style.outline || "";
    handlers.prevOffset = el.style.outlineOffset || "";
    el.style.outline = "2px solid #4f46e5";
    el.style.outlineOffset = "2px";
  };

  handlers.click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    stopPasswordPickMode();
    const editable = (el && el.tagName === "INPUT") ? el : ((el && el.querySelector && el.querySelector("input, textarea, [contenteditable='true']")) || el);
    setElementValue(editable, password);
    markElement(editable, "filled", "密码已填入");
    showSmsCodeToast(`✅ 密码已填入所选输入框`, "success", 3000);
  };

  handlers.key = (e) => {
    if (e.key === "Escape") {
      stopPasswordPickMode();
      showSmsCodeToast("已取消点选填入", "info", 1600);
    }
  };

  passwordPickHandlers = handlers;
  document.addEventListener("mousemove", handlers.move, true);
  document.addEventListener("click", handlers.click, true);
  document.addEventListener("keydown", handlers.key, true);
  showSmsCodeToast("👉 请点击需要填入密码的输入框（Esc 取消）", "info", 6000);
}
