// 17.6 智能密码生成器：自然语言规则解析 / AI生成 / 自动填入主密码与确认密码
    let currentGeneratedPassword = "";
    let isPasswordMasked = false;

    function evaluatePasswordStrength(pwd) {
      if (!pwd) return { desc: "空密码", tag: "⚪ 无密码" };
      const len = pwd.length;
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasDigit = /[0-9]/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
      const typesCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

      const typeDesc = [];
      if (hasUpper && hasLower) typeDesc.push("大小写字母");
      else if (hasUpper) typeDesc.push("大写字母");
      else if (hasLower) typeDesc.push("小写字母");
      if (hasDigit) typeDesc.push("数字");
      if (hasSpecial) typeDesc.push("特殊符号");

      const descStr = `${len}位 · ${typeDesc.join("+") || "字符"}`;
      let tagStr = "🟢 高强度";
      if (len >= 12 && typesCount >= 3) tagStr = "🟢 极高强度";
      else if (len >= 8 && typesCount >= 2) tagStr = "🟢 强密码";
      else if (len >= 6) tagStr = "🟡 中等强度";
      else tagStr = "🔴 弱密码";

      return { desc: descStr, tag: tagStr };
    }

    function updatePasswordDisplayUI(pwd) {
      currentGeneratedPassword = pwd || "";
      if (!pwdVal) return;
      if (isPasswordMasked) {
        pwdVal.textContent = "•".repeat(Math.max(6, pwd.length));
        if (pwdToggleEye) pwdToggleEye.textContent = "🙈";
      } else {
        pwdVal.textContent = pwd || "——";
        if (pwdToggleEye) pwdToggleEye.textContent = "👁️";
      }
      const st = evaluatePasswordStrength(pwd);
      if (pwdDesc) pwdDesc.textContent = st.desc;
      if (pwdStrength) pwdStrength.textContent = st.tag;
    }

    async function triggerGeneratePassword(ruleText, isAi = false) {
      const api = window.ResumeFillerContent;
      const rule = ruleText || (pwdRuleInput ? pwdRuleInput.value.trim() : "") || "8-16位，包含大写字母、小写字母、数字和特殊字符";
      if (pwdRuleInput && !pwdRuleInput.value.trim()) {
        pwdRuleInput.value = rule;
      }

      let res = null;
      if (api && typeof api.generateSmartPassword === "function") {
        res = await api.generateSmartPassword(rule);
      } else if (api && typeof api.generatePasswordLocally === "function") {
        res = { password: api.generatePasswordLocally(rule), source: "local" };
      }

      const finalPwd = (res && res.password) ? res.password : "P@ssw0rd2026!";
      updatePasswordDisplayUI(finalPwd);

      if (isAi && res && res.source === "ai") {
        showToast("✓ AI 已根据要求生成高强度随机密码！");
      }
      return finalPwd;
    }

    function updatePasswordTargetStatusUI() {
      if (!pwdStatus) return;
      const api = window.ResumeFillerContent;
      if (api && typeof api.detectPasswordTargets === "function") {
        const tg = api.detectPasswordTargets();
        if (tg.hasTarget) {
          pwdStatus.className = "rf-pwd-status ok";
          pwdStatus.textContent = `✅ ${tg.label}`;
        } else {
          pwdStatus.className = "rf-pwd-status warn";
          pwdStatus.textContent = "⚠️ 当前页面暂未检测到密码输入框（可使用「点选填入」）";
        }
      }
    }

    function closePwdMenu() {
      if (!pwdMenu) return;
      pwdMenu.classList.add("rf-hidden");
      pwdMenu.style.display = "none";
    }
    // ==================== 站点密码保存与求职密码备忘录 (Password Vault) ====================
    let savedPasswordsList = [];
    let isCurrentSavedMasked = true;

    function safeStr(val) {
      return String(val || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function getDomainFromUrl() {
      try {
        return window.location.hostname || "local";
      } catch (_) {
        return "local";
      }
    }

    function getSiteDisplayName() {
      const dom = getDomainFromUrl();
      const ats = (window.ResumeFillerContent && window.ResumeFillerContent.getAtsProfile) ? window.ResumeFillerContent.getAtsProfile().name : "";
      if (ats && ats !== "通用网页表单") return ats;
      const title = (document.title || "").split(/[-_|]/)[0].trim();
      return title || dom;
    }

    async function loadSavedPasswords() {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get("rf_saved_passwords", (res) => {
            savedPasswordsList = Array.isArray(res?.rf_saved_passwords) ? res.rf_saved_passwords : [];
            resolve(savedPasswordsList);
          });
        } else {
          try {
            savedPasswordsList = JSON.parse(localStorage.getItem("rf_saved_passwords") || "[]");
          } catch (_) {
            savedPasswordsList = [];
          }
          resolve(savedPasswordsList);
        }
      });
    }

    async function persistSavedPasswords(list) {
      savedPasswordsList = list;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ rf_saved_passwords: list });
      } else {
        localStorage.setItem("rf_saved_passwords", JSON.stringify(list));
      }
      renderPasswordVaultUI();
    }

    function renderPasswordVaultUI() {
      const curDomain = getDomainFromUrl();
      const siteNameEl = shadow.getElementById("rf-pwd-site-name");
      if (siteNameEl) siteNameEl.textContent = getSiteDisplayName();

      const accInput = shadow.getElementById("rf-pwd-account-input");
      if (accInput && !accInput.value.trim()) {
        const phone = resumeData.basic && resumeData.basic.phone;
        const email = resumeData.basic && resumeData.basic.email;
        accInput.value = phone || email || "";
      }

      // 渲染当前站点已保存的密码卡片
      const curSiteItem = savedPasswordsList.find(p => p.domain === curDomain);
      const curSiteCard = shadow.getElementById("rf-pwd-current-site-card");
      if (curSiteCard) {
        if (curSiteItem) {
          curSiteCard.style.display = "flex";
          const accEl = shadow.getElementById("rf-pwd-saved-acc");
          const valEl = shadow.getElementById("rf-pwd-saved-val");
          const timeEl = shadow.getElementById("rf-pwd-saved-time");
          const eyeBtn = shadow.getElementById("rf-pwd-saved-toggle-eye");

          if (accEl) accEl.textContent = curSiteItem.account || "默认账号";
          if (timeEl) timeEl.textContent = curSiteItem.updatedAt || "";
          if (valEl) {
            valEl.textContent = isCurrentSavedMasked ? "•".repeat(Math.max(6, curSiteItem.password.length)) : curSiteItem.password;
          }
          if (eyeBtn) eyeBtn.textContent = isCurrentSavedMasked ? "👁️" : "🙈";

          const fillBtn = shadow.getElementById("rf-pwd-saved-btn-fill");
          if (fillBtn) {
            fillBtn.onclick = (e) => {
              e.stopPropagation();
              fillPasswordValue(curSiteItem.password);
            };
          }

          const copyBtn = shadow.getElementById("rf-pwd-saved-btn-copy");
          if (copyBtn) {
            copyBtn.onclick = async (e) => {
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(curSiteItem.password);
                showToast(`已复制本站密码 (${curSiteItem.account || '默认账号'})`);
              } catch (_) {
                showToast("复制失败", "error");
              }
            };
          }

          const delBtn = shadow.getElementById("rf-pwd-saved-btn-del");
          if (delBtn) {
            delBtn.onclick = async (e) => {
              e.stopPropagation();
              if (confirm(`确定删除此站（${curDomain}）已保存的求职密码吗？`)) {
                const next = savedPasswordsList.filter(p => p.id !== curSiteItem.id);
                await persistSavedPasswords(next);
                showToast("已删除本站密码备忘");
              }
            };
          }
        } else {
          curSiteCard.style.display = "none";
        }
      }

      // 渲染全站点抽屉计数
      const countEl = shadow.getElementById("rf-pwd-vault-count");
      if (countEl) countEl.textContent = savedPasswordsList.length;

      renderVaultItemsList();
    }

    function renderVaultItemsList(filterText = "") {
      const container = shadow.getElementById("rf-pwd-vault-list");
      if (!container) return;
      container.innerHTML = "";

      const query = (filterText || "").toLowerCase().trim();
      const filtered = savedPasswordsList.filter(item => {
        if (!query) return true;
        return (item.domain || "").toLowerCase().includes(query) ||
               (item.siteName || "").toLowerCase().includes(query) ||
               (item.account || "").toLowerCase().includes(query);
      });

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:8px; font-size:11px; color:var(--text-muted);">暂无已保存的站点密码</div>`;
        return;
      }
      filtered.forEach(item => {
        const row = document.createElement("div");
        row.className = "rf-pwd-vault-item";
        row.innerHTML = `
          <div class="rf-pwd-vault-item-head">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">🌐 ${safeStr(item.siteName || item.domain)}</span>
            <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">${safeStr(item.domain)}</span>
          </div>
          <div class="rf-pwd-vault-item-body">
            <span>👤 ${safeStr(item.account || '未填账号')}</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="vault-pwd-mask" data-id="${item.id}">••••••••</span>
              <button type="button" class="rf-sms-link-btn btn-vault-toggle-eye" data-id="${item.id}" style="padding:0 2px;">👁️</button>
            </div>
          </div>
          <div style="display:flex; gap:4px; margin-top:2px;">
            <button type="button" class="rf-pwd-saved-btn btn-vault-fill" data-id="${item.id}">⚡ 填入</button>
            <button type="button" class="rf-pwd-saved-btn btn-vault-copy" data-id="${item.id}">📋 复制</button>
            <button type="button" class="rf-pwd-saved-btn danger btn-vault-del" data-id="${item.id}" title="删除此记录">🗑️</button>
          </div>
        `;
        container.appendChild(row);
      });

      container.querySelectorAll(".btn-vault-toggle-eye").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          const maskSpan = container.querySelector(`.vault-pwd-mask[data-id="${id}"]`);
          if (targetItem && maskSpan) {
            const isMasked = maskSpan.textContent.includes("•");
            maskSpan.textContent = isMasked ? targetItem.password : "••••••••";
            btn.textContent = isMasked ? "🙈" : "👁️";
          }
        });
      });

      container.querySelectorAll(".btn-vault-fill").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem) fillPasswordValue(targetItem.password);
        });
      });

      container.querySelectorAll(".btn-vault-copy").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem) {
            try {
              await navigator.clipboard.writeText(targetItem.password);
              showToast(`已复制「${targetItem.siteName || targetItem.domain}」密码`);
            } catch (_) {
              showToast("复制失败", "error");
            }
          }
        });
      });

      container.querySelectorAll(".btn-vault-del").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const targetItem = savedPasswordsList.find(p => p.id === id);
          if (targetItem && confirm(`确定删除「${targetItem.siteName || targetItem.domain}」的密码备忘吗？`)) {
            const next = savedPasswordsList.filter(p => p.id !== id);
            await persistSavedPasswords(next);
            showToast("已删除对应密码备忘");
          }
        });
      });
    }

    function fillPasswordValue(pwd) {
      if (!pwd) return;
      const api = window.ResumeFillerContent;
      if (api && typeof api.fillPasswordToPage === "function") {
        const r = api.fillPasswordToPage(pwd);
        if (r && r.success) {
          const hasConfirm = r.hasConfirm ? "（主密码框 + 确认密码框已同步填好）" : "";
          showToast(`✓ 密码已自动填入！${hasConfirm}`);
          updatePasswordTargetStatusUI();
          return;
        }
      }
      showToast("请点击页面密码框以填入", "info");
      if (api && typeof api.startPasswordPickMode === "function") {
        api.startPasswordPickMode(pwd);
        closePwdMenu();
      }
    }

    async function openPwdMenu() {
      if (!pwdMenu) return;
      if (typeof closeSmsMenu === "function") closeSmsMenu();
      if (typeof closeSiteMenu === "function") closeSiteMenu();

      pwdMenu.classList.remove("rf-hidden");
      pwdMenu.style.display = "flex";

      // 加载并渲染密码保险库与当前站点状态
      await loadSavedPasswords();
      renderPasswordVaultUI();

      // 自动提取网页上的密码规则提示作为初始值
      const api = window.ResumeFillerContent;
      let hint = "";
      if (api && typeof api.extractPasswordRequirementHints === "function") {
        hint = api.extractPasswordRequirementHints();
      }
      if (pwdRuleInput && (!pwdRuleInput.value.trim() || hint)) {
        pwdRuleInput.value = hint || "8-16位，包含大写字母、小写字母、数字和特殊字符";
      }

      updatePasswordTargetStatusUI();

      if (!currentGeneratedPassword) {
        await triggerGeneratePassword(pwdRuleInput.value);
      }
    }
    if (btnPasswordGen && pwdMenu) {
      btnPasswordGen.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = pwdMenu.classList.contains("rf-hidden") || pwdMenu.style.display === "none";
        if (isHidden) openPwdMenu(); else closePwdMenu();
      });

      const closePwdBtn = shadow.getElementById("rf-btn-close-pwd-menu");
      if (closePwdBtn) {
        closePwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          closePwdMenu();
        });
      }

      // 切换明文/密文小眼睛
      if (pwdToggleEye) {
        pwdToggleEye.addEventListener("click", (e) => {
          e.stopPropagation();
          isPasswordMasked = !isPasswordMasked;
          updatePasswordDisplayUI(currentGeneratedPassword);
        });
      }

      // 重新生成 / 换一个
      const regenBtn = shadow.getElementById("rf-pwd-btn-regen");
      if (regenBtn) {
        regenBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          regenBtn.textContent = "⏳…";
          await triggerGeneratePassword(pwdRuleInput ? pwdRuleInput.value : "");
          regenBtn.textContent = "🎲 换一个";
        });
      }

      // AI 按要求生成按钮
      const aiGenBtn = shadow.getElementById("rf-pwd-btn-ai-generate");
      if (aiGenBtn) {
        aiGenBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          aiGenBtn.textContent = "🪄 AI 理解生成中…";
          aiGenBtn.disabled = true;
          try {
            await triggerGeneratePassword(pwdRuleInput ? pwdRuleInput.value : "", true);
          } finally {
            aiGenBtn.textContent = "🪄 AI 按要求生成新密码";
            aiGenBtn.disabled = false;
          }
        });
      }

      // 复制密码
      const copyPwdBtn = shadow.getElementById("rf-pwd-btn-copy");
      if (copyPwdBtn) {
        copyPwdBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("暂无可复制的密码", "error");
            return;
          }
          try {
            await navigator.clipboard.writeText(currentGeneratedPassword);
            copyPwdBtn.textContent = "✓ 已复制";
            showToast(`已复制密码：${currentGeneratedPassword}`);
            setTimeout(() => { copyPwdBtn.textContent = "📋 复制密码"; }, 1500);
          } catch (err) {
            showToast("复制失败", "error");
          }
        });
      }

      // 填入当前密码框（主密码框 + 确认密码框同时填好）
      const fillPwdBtn = shadow.getElementById("rf-pwd-btn-fill");
      if (fillPwdBtn) {
        fillPwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("请先生成密码", "error");
            return;
          }
          const api = window.ResumeFillerContent;
          if (!api || typeof api.fillPasswordToPage !== "function") {
            showToast("当前页面不支持填入", "error");
            return;
          }
          const r = api.fillPasswordToPage(currentGeneratedPassword);
          if (r && r.success) {
            const hasConfirm = r.hasConfirm ? "（主密码框 + 确认密码框已同步填好）" : "";
            showToast(`✓ 密码已自动填入！${hasConfirm}`);
            updatePasswordTargetStatusUI();
          } else {
            showToast((r && r.reason) || "填入失败，请使用「👉 点选填入」", "error");
          }
        });
      }

      // 点选填入
      const pickPwdBtn = shadow.getElementById("rf-pwd-btn-pick");
      if (pickPwdBtn) {
        pickPwdBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!currentGeneratedPassword) {
            showToast("请先生成密码", "error");
            return;
          }
          const api = window.ResumeFillerContent;
          if (!api || typeof api.startPasswordPickMode !== "function") {
            showToast("当前页面不支持点选", "error");
            return;
          }
          closePwdMenu();
          api.startPasswordPickMode(currentGeneratedPassword);
        });
      }

      // 提取网页规则按钮
      const extractBtn = shadow.getElementById("rf-pwd-btn-extract");
      if (extractBtn) {
        extractBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const api = window.ResumeFillerContent;
          let hint = "";
          if (api && typeof api.extractPasswordRequirementHints === "function") {
            hint = api.extractPasswordRequirementHints();
          }
          if (hint) {
            if (pwdRuleInput) pwdRuleInput.value = hint;
            showToast(`✓ 已从网页提取要求：${hint.slice(0, 20)}...`);
            await triggerGeneratePassword(hint);
          } else {
            showToast("网页未检测到显式规则提示，已保留推荐规则", "info");
          }
        });
      }

      // 预设快捷标签点击
      shadow.querySelectorAll(".rf-pwd-tag").forEach((tag) => {
        tag.addEventListener("click", async (e) => {
          e.stopPropagation();
          const rule = tag.getAttribute("data-rule");
          if (rule && pwdRuleInput) {
            pwdRuleInput.value = rule;
            showToast(`已切换规则：${tag.textContent.trim()}`);
            await triggerGeneratePassword(rule);
          }
        });
      });
      // 保存为当前站点密码
      const saveSiteBtn = shadow.getElementById("rf-pwd-btn-save-site");
      if (saveSiteBtn) {
        saveSiteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const pwd = currentGeneratedPassword;
          if (!pwd) {
            showToast("请先生成密码后再保存", "error");
            return;
          }
          const domain = getDomainFromUrl();
          const siteName = getSiteDisplayName();
          const accInput = shadow.getElementById("rf-pwd-account-input");
          const account = (accInput ? accInput.value.trim() : "") || (resumeData.basic && resumeData.basic.phone) || "";

          const existingIdx = savedPasswordsList.findIndex(p => p.domain === domain);
          const nowStr = new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

          const newEntry = {
            id: existingIdx !== -1 ? savedPasswordsList[existingIdx].id : ("pwd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
            domain,
            siteName,
            url: window.location.href,
            account,
            password: pwd,
            updatedAt: nowStr
          };

          const nextList = [...savedPasswordsList];
          if (existingIdx !== -1) {
            nextList[existingIdx] = newEntry;
          } else {
            nextList.unshift(newEntry);
          }

          await persistSavedPasswords(nextList);
          showToast(`✓ 已成功保存「${siteName}」求职密码！`);
        });
      }

      // 当前站点已存密码卡片上的眼睛切换
      const savedEyeBtn = shadow.getElementById("rf-pwd-saved-toggle-eye");
      if (savedEyeBtn) {
        savedEyeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          isCurrentSavedMasked = !isCurrentSavedMasked;
          renderPasswordVaultUI();
        });
      }

      // 保险库抽屉折叠展开
      const vaultToggle = shadow.getElementById("rf-pwd-vault-toggle");
      const vaultDrawer = shadow.getElementById("rf-pwd-vault-drawer");
      const vaultArrow = shadow.getElementById("rf-pwd-vault-arrow");
      if (vaultToggle && vaultDrawer) {
        vaultToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const isClosed = vaultDrawer.style.display === "none";
          vaultDrawer.style.display = isClosed ? "block" : "none";
          if (vaultArrow) vaultArrow.textContent = isClosed ? "▴" : "▾";
          if (isClosed) renderVaultItemsList();
        });
      }

      const vaultSearch = shadow.getElementById("rf-pwd-vault-search");
      if (vaultSearch) {
        vaultSearch.addEventListener("input", (e) => {
          renderVaultItemsList(e.target.value);
        });
      }

      const vaultExport = shadow.getElementById("rf-pwd-vault-export");
      if (vaultExport) {
        vaultExport.addEventListener("click", (e) => {
          e.stopPropagation();
          if (savedPasswordsList.length === 0) {
            showToast("暂无可导出的密码记录", "error");
            return;
          }
          const blob = new Blob([JSON.stringify(savedPasswordsList, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `offergo_passwords_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast("已导出全部站点密码备份");
        });
      }

      // 点击卡片内部其它地方，关闭密码浮层
      cardModal.addEventListener("click", (e) => {
        if (!pwdMenu.contains(e.target) && e.target !== btnPasswordGen && !btnPasswordGen.contains(e.target)) {
          closePwdMenu();
        }
      });

      pwdMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    // 18. 网站弹出规则管理交互与状态更新
    async function updateSiteMenuUI() {
      if (!siteDomainText) return;
      siteDomainText.textContent = currentHostname;

      let storageData;
      try {
        storageData = await new Promise((resolve) => {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], resolve);
          } else {
            resolve({
              rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
              rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
            });
          }
        });
      } catch (e) {
        storageData = { rf_whitelist_domains: [], rf_blacklist_domains: [] };
      }

      const whitelist = storageData.rf_whitelist_domains || [];
      const blacklist = storageData.rf_blacklist_domains || [];

      if (optSiteAuto) optSiteAuto.classList.remove("active");
      if (optSiteAlways) optSiteAlways.classList.remove("active");
      if (optSiteNever) optSiteNever.classList.remove("active");

      if (blacklist.some(d => currentHostname === d || currentHostname.endsWith("." + d))) {
        if (optSiteNever) optSiteNever.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = "🚫已隐藏小球";
          siteStatusBadge.style.color = "var(--danger)";
        }
      } else if (whitelist.some(d => currentHostname === d || currentHostname.endsWith("." + d))) {
        if (optSiteAlways) optSiteAlways.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = "✅始终弹气泡";
          siteStatusBadge.style.color = "#059669";
        }
      } else {
        if (optSiteAuto) optSiteAuto.classList.add("active");
        if (siteStatusBadge) {
          siteStatusBadge.textContent = isRecruitmentPage ? "⚡智能(网申页)" : "⚡智能(普通页)";
          siteStatusBadge.style.color = "var(--primary)";
        }
      }
    }

    if (btnSiteSetting && siteMenu) {
      function closeSiteMenu() {
        if (!siteMenu) return;
        siteMenu.classList.add("rf-hidden");
        siteMenu.style.display = "none";
      }

      function openSiteMenu() {
        if (!siteMenu) return;
        siteMenu.classList.remove("rf-hidden");
        siteMenu.style.display = "flex";
        updateSiteMenuUI();
      }

      btnSiteSetting.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = siteMenu.classList.contains("rf-hidden") || siteMenu.style.display === "none";
        if (isHidden) {
          openSiteMenu();
        } else {
          closeSiteMenu();
        }
      });

      const btnCloseSiteMenu = shadow.getElementById("rf-btn-close-site-menu");
      if (btnCloseSiteMenu) {
        btnCloseSiteMenu.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeSiteMenu();
        });
      }

      // 点击卡片内部其它地方，关闭设置菜单
      cardModal.addEventListener("click", (e) => {
        if (!siteMenu.contains(e.target) && e.target !== btnSiteSetting && !btnSiteSetting.contains(e.target)) {
          closeSiteMenu();
        }
      });

      // 点击页面其它任何地方，也关闭设置菜单
      document.addEventListener("click", () => {
        closeSiteMenu();
      }, true);

      async function saveDomainRules(newWl, newBl) {
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
              rf_whitelist_domains: newWl,
              rf_blacklist_domains: newBl
            });
          }
        } catch(e) {}
        localStorage.setItem("rf_whitelist_domains", JSON.stringify(newWl));
        localStorage.setItem("rf_blacklist_domains", JSON.stringify(newBl));
      }

      if (optSiteAuto) {
        optSiteAuto.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const wl = (storageData.rf_whitelist_domains || []).filter(d => d !== currentHostname);
          const bl = (storageData.rf_blacklist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          closeSiteMenu();
          const res = await checkPageActivation();
          isRecruitmentPage = res.isRecruitment;
          isPillEnabled = res.pillEnabled;
          isBlacklisted = res.isBlacklisted;

          // 恢复智能模式：小球常驻，气泡由是否网申页面决定
          triggerBtn.classList.remove("rf-hidden");
          if (isRecruitmentPage) {
            showToast("⚡ 已恢复智能模式：当前为网申页面，已启用智能气泡！");
          } else {
            showToast("⚡ 已恢复智能模式：悬浮按钮常驻，普通页面不弹气泡打扰");
            hidePill();
          }
          updateSiteMenuUI();
        });
      }

      if (optSiteAlways) {
        optSiteAlways.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const wl = Array.from(new Set([...(storageData.rf_whitelist_domains || []), currentHostname]));
          const bl = (storageData.rf_blacklist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          isPillEnabled = true;
          isBlacklisted = false;
          closeSiteMenu();
          triggerBtn.classList.remove("rf-hidden");
          showToast("✅ 已设置：在此网站输入框聚焦时始终自动弹推荐气泡！");
          updateSiteMenuUI();
        });
      }

      if (optSiteNever) {
        optSiteNever.addEventListener("click", async (e) => {
          e.stopPropagation();
          const storageData = await new Promise(r => {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(["rf_whitelist_domains", "rf_blacklist_domains"], r);
            } else {
              r({
                rf_whitelist_domains: JSON.parse(localStorage.getItem("rf_whitelist_domains") || "[]"),
                rf_blacklist_domains: JSON.parse(localStorage.getItem("rf_blacklist_domains") || "[]")
              });
            }
          });
          const bl = Array.from(new Set([...(storageData.rf_blacklist_domains || []), currentHostname]));
          const wl = (storageData.rf_whitelist_domains || []).filter(d => d !== currentHostname);
          await saveDomainRules(wl, bl);
          isPillEnabled = false;
          isBlacklisted = true;
          closeSiteMenu();
          cardModal.classList.add("rf-hidden");
          triggerBtn.classList.add("rf-hidden");
          hidePill();
          showToast("🚫 已设置：在此网站彻底隐藏悬浮球 (需要时可点插件图标唤出)");
          updateSiteMenuUI();
        });
      }
    }

    // 19. 页面智能启用状态初始化判定
    checkPageActivation().then((res) => {
      isRecruitmentPage = res.isRecruitment;
      // 如果是子 iframe，默认允许气泡弹出以保障嵌入式表单体验
      isPillEnabled = !isTopFrame ? (!res.isBlacklisted) : res.pillEnabled;
      isBlacklisted = res.isBlacklisted;

      if (!isTopFrame) {
        // 子 iframe 内仅保留焦点智能气泡，隐藏主悬浮球与大卡片，避免多球重叠
        if (triggerBtn) triggerBtn.style.setProperty("display", "none", "important");
        if (cardModal) cardModal.style.setProperty("display", "none", "important");
        if (ghostBadge) ghostBadge.style.setProperty("display", "none", "important");
      } else if (isBlacklisted) {
        // 用户黑名单：彻底隐藏小球与气泡
        triggerBtn.classList.add("rf-hidden");
        cardModal.classList.add("rf-hidden");
        hidePill();
      } else {
        // 默认状态：小球始终显示（方便随时点击），大卡片保持折叠，绝不自动弹大卡片遮挡屏幕
        if (isCardCollapsed) {
          triggerBtn.classList.remove("rf-hidden");
          cardModal.classList.add("rf-hidden");
        } else {
          triggerBtn.classList.add("rf-hidden");
          cardModal.classList.remove("rf-hidden");
        }
      }
      updateSiteMenuUI();
    });
