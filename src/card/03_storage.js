// ==================== 存储与数据同步 ====================

  async function loadData() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["resumesList", "activeResumeId", "resumeData"], (result) => {
          if (result.resumesList && result.resumesList.length > 0) {
            resumesList = result.resumesList;
            activeResumeId = result.activeResumeId || resumesList[0].id;
          } else if (result.resumeData) {
            resumesList = [{ id: "default", name: "默认简历", data: result.resumeData }];
            activeResumeId = "default";
            chrome.storage.local.set({ resumesList, activeResumeId });
            chrome.storage.local.remove("resumeData");
          } else {
            resumesList = [{ id: "default", name: "默认简历", data: JSON.parse(JSON.stringify(defaultResumeData)) }];
            activeResumeId = "default";
          }
          const activeItem = resumesList.find((r) => r.id === activeResumeId) || resumesList[0];
          resumeData = mergeWithDefault(activeItem.data, defaultResumeData);
          updateAllViews();
          resolve();
        });
      } else {
        const localList = localStorage.getItem("resumesList");
        if (localList) {
          resumesList = JSON.parse(localList);
          activeResumeId = localStorage.getItem("activeResumeId") || resumesList[0].id;
        } else {
          resumesList = [{ id: "default", name: "默认简历", data: JSON.parse(JSON.stringify(defaultResumeData)) }];
          activeResumeId = "default";
        }
        const activeItem = resumesList.find((r) => r.id === activeResumeId) || resumesList[0];
        resumeData = mergeWithDefault(activeItem.data, defaultResumeData);
        updateAllViews();
        resolve();
      }
    });
  }

  let isSelfSaving = false;
  let selfSaveTimer = null;

  function saveData() {
    const activeIdx = resumesList.findIndex((r) => r.id === activeResumeId);
    if (activeIdx !== -1) {
      resumesList[activeIdx].data = resumeData;
    }
    isSelfSaving = true;
    clearTimeout(selfSaveTimer);
    selfSaveTimer = setTimeout(() => {
      isSelfSaving = false;
    }, 350);

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ resumesList, activeResumeId });
    } else {
      localStorage.setItem("resumesList", JSON.stringify(resumesList));
      localStorage.setItem("activeResumeId", activeResumeId);
    }
  }

  // 监听外部 storage 变化，保持悬浮窗与侧边栏数据双向同步
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (isSelfSaving) {
        // 当前卡片内部输入保存时，忽略重绘，保证光标和中文输入法不被打断
        return;
      }
      if (area === "local" && (changes.resumesList || changes.activeResumeId)) {
        loadData();
      }
      if (area === "local" && changes.apiConfig) {
        loadFloatingAiConfig();
      }
    });
  }
