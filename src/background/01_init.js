// 确保点击扩展图标时优先触发 action.onClicked 而非直接打开侧边栏
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

// 监听扩展图标点击，优先切换当前页面上的悬浮卡片展开/折叠
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "toggleFloatingCard" });
    } catch (e) {
      // 降级支持：在受限页面 (如 chrome://, edge://, webstore 等不能注入 content script 的页面) 打开侧边栏
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
    }
  }
});

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  console.log("OfferGo 已成功安装！页面悬浮卡片已启用。");
});
