// ==================== 跨脚本通信 ====================

// 向当前标签页的所有 Frame (主页面 + 嵌套 iframe) 广播发送消息
async function sendMsgToContentScript(msg) {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    showToast("当前环境不支持与网页通信，请在网页中以插件形式运行");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showToast("未找到活动网页标签");
      return;
    }

    // 优先通过 background 广播给当前页面的所有 frames (支持穿透 iframe)
    chrome.runtime.sendMessage({
      action: "broadcastToTabFrames",
      tabId: tab.id,
      payload: msg
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // 降级使用基础 tabs.sendMessage
        chrome.tabs.sendMessage(tab.id, msg, (fallbackRes) => {
          if (chrome.runtime.lastError) {
            showToast("请先刷新网页，再进行填充操作");
            return;
          }
          handleFillResponse(fallbackRes);
        });
        return;
      }

      handleFillResponse(response);
    });
  } catch (err) {
    showToast("通信异常，请刷新页面重试");
    console.error(err);
  }
}

function handleFillResponse(response) {
  if (response && response.status === "success") {
    if (typeof response.count === "number" && response.count > 0) {
      showToast(`成功填充了 ${response.count} 个字段`);
    } else {
      showToast("填充成功");
    }
  } else if (response && response.status === "no_focus") {
    showToast("请先在网页或子框架中点击一个输入框以指定位置");
  } else {
    showToast("未检测到匹配的可填充输入框");
  }
}

// ==================== Toast 提示 ====================
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  
  // 3秒后自动隐藏（CSS 动画有 2.5s，这里设置 2.5s 后隐藏 DOM）
  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

// ==================== 文本框高度动态自适应 ====================
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight + 2) + 'px';
}

function adjustAllTextareas() {
  document.querySelectorAll("textarea.form-control").forEach((textarea) => {
    // 仅在元素可见时调整，隐藏的 textarea 无法获取正确的 scrollHeight，防止初始化折叠为 0
    if (textarea.offsetWidth > 0 || textarea.offsetHeight > 0) {
      autoResizeTextarea(textarea);
    }
  });
}
