// ==================== ATS 系统 Profile Registry ====================
// Profile 仅决定探测、稳定等待和校验策略；填写仍必须经过统一的端侧回读验证。
const ATS_PROFILES = [
  { id: "beisen", name: "北森 Beisen / Phoenix", match: () => /zhiye\.com/i.test(location.hostname) || !!document.querySelector(".demo-beisen-fixture"), mode: "spa", controlRoots: [".phoenix-select"], errorSelectors: [".phoenix-form-explain", ".phoenix-input--error", ".phoenix-select--error"], settleMs: 500 },
  { id: "moka", name: "Moka HR", match: () => /mokahr\.com/i.test(location.hostname) || !!document.querySelector("[class*=moka- i]"), mode: "hash-spa", controlRoots: [], errorSelectors: ["[class*=moka-][class*=error i]", ".form-item--error"], settleMs: 650 },
  { id: "feishu", name: "飞书招聘 / Lark ATS", match: () => /jobs\.feishu\.cn/i.test(location.hostname) || !!document.querySelector("[class*=ud__ i], .ud-formily-item"), mode: "spa", controlRoots: [".ud__select", ".ud-formily-item"], errorSelectors: [".ud-formily-item-error", ".ud-form-item-error", "[class*=ud__][class*=error i]"], settleMs: 600 },
  { id: "haier", name: "海尔 Maker", match: () => /maker\.haier\.net/i.test(location.hostname) || !!document.querySelector("[pdtype], .xm-select, .xm-hide-input"), mode: "jquery", controlRoots: ["[pdtype]", ".xm-select"], errorSelectors: [".tip-wrong"], settleMs: 350 },
  { id: "hcmcloud", name: "浪潮 HCM Cloud", match: () => /hcmcloud\.cn/i.test(location.hostname) || !!document.querySelector("[data-ng-model], [ng-model]"), mode: "hash-angular", controlRoots: [], errorSelectors: ["[class*=error i]", "[class*=invalid i]"], settleMs: 650 },
  { id: "wecruit", name: "用友大易 / Wecruit", match: () => /hotjob\.cn/i.test(location.hostname) || /posResume\.html/i.test(location.pathname), mode: "traditional", controlRoots: [], errorSelectors: [".error", ".help-block-error", "[class*=error i]"], settleMs: 350 },
  { id: "51job", name: "51job / 智联 / 应届生", match: () => /51job\.com|zhaopin\.com|yingjiesheng\.com/i.test(location.hostname), mode: "wizard", controlRoots: [], errorSelectors: [".el-form-item__error", ".error", "[class*=error i]"], settleMs: 500 },
  { id: "generic", name: "通用网页表单", match: () => true, mode: "generic", controlRoots: [], errorSelectors: [".ant-form-item-explain-error", ".el-form-item__error", ".error-tip", "[class*=error i]", "[class*=invalid i]"], settleMs: 400 }
];

function getAtsProfile() {
  return ATS_PROFILES.find(profile => { try { return profile.match(); } catch (_) { return false; } }) || ATS_PROFILES.at(-1);
}

function getAtsRouteKey() {
  return `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
}

function getProfileErrorSelectors() {
  const profile = getAtsProfile();
  return [...new Set([...(profile.errorSelectors || []), ".ant-form-item-explain-error", ".el-form-item__error", ".error-tip", "[class*=error i]", "[class*=invalid i]"])];
}
