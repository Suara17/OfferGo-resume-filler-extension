# 🚀 OfferGo - 网申简历快速填写助手

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/Release-v1.1.0-indigo?style=flat-square" alt="Release" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Data%20Privacy-100%25%20Local-success?style=flat-square" alt="Local Privacy" />
  <a href="https://linux.do/"><img src="https://img.shields.io/badge/LINUX%20DO-Community-blueviolet?style=flat-square" alt="LINUX DO" /></a>
</p>

> **求职 / 校招 / 社招网申必备神器** —— 告别繁琐的窗口切换与机械重复的复制粘贴！
> 原地智能气泡、卡片一键填入与复制、网申 Agent 多轮代填、多简历版本、密码生成与备忘，100% 本地离线安全存储。

---

## 🖼️ 演示示意图

<p align="center">
  <img src="assets/preview.svg" alt="功能演示与交互示意图" width="100%" />
</p>

---

## ✨ 核心亮点

### 1. 🎯 一键复制粘贴与跟手填入
- **原地智能气泡**：点击网页任意输入框，就近原地弹出推荐气泡，一键直接填入；
- **悬浮面板随点随填**：右下角常驻悬浮面板，点击卡片选项直接填入当前聚焦的网页输入框；点击字段标签（Label）一键复制到剪贴板；
- **原生事件智能穿透**：原生模拟 `input`、`change` 事件，完美穿透 Vue、React、Ant Design 等现代前端受控组件。

### 2. 🤖 网申 Agent 智能代填 (Zero-PII)
- **多轮自动闭环**：一键开启自动化代填，端侧极速预填 + 大模型 ReAct 多轮循环；
- **联想搜索框自动求解**：针对院校、专业、省市联想下拉框，自动输入关键字 → 轮询浮层 → 语义匹配并点击锁定；
- **零隐私外发（Zero-PII）**：上行给大模型的仅是公开结构线索与抽象代号（如 `basic.email`），姓名、电话、真实简历内容 **100% 保留端侧本机**；遇到验证码自动暂停请求人工接管。

### 3. 📑 多简历版本随心切换
- **针对不同岗位管理多份简历**：按求职方向管理多套版本（如“前端开发版”、“大模型算法版”、“国企通识版”）；
- **一秒无缝切换**：卡片与侧边栏一键切换当前版本，所有字段即时同步；支持随时另存新版本、重命名与 JSON 导入导出。

### 4. 🔑 智能密码生成器 & 站点备忘录
- **自然语言规则生成强密码**：直接输入“8-16位必须含大小写字母数字符号”，或点击提取网页规则提示，AI 自动生成高强度合规密码（离线本地算法保底）；
- **双框同时填入**：自动识别注册页面的“登录密码 + 确认密码”，一次点击同时填好两框；
- **💾 站点求职密码备忘录**：一键保存生成的密码与当前招聘站点、手机账号；下次登录时卡片直接显示已存密码，气泡亦优先推荐已存密码，一键填回不再遗忘；支持多站点搜索与导出备份。

### 5. 🔒 100% 纯本地离线安全存储
- 所有个人简历数据与站点密码均保存在浏览器的本地隔离存储 `chrome.storage.local` 中；
- **无任何中转后端、无网络上报、无用户追踪**，断网亦可全功能离线使用，代码开源可审计。

---

## 🛠️ 安装与使用指南

### 方式一：直接下载 Release 安装包（推荐）
1. 前往 GitHub 右侧 **[Releases](https://github.com/Suara17/resume-filler-extension/releases)** 下载最新版 `OfferGo-v1.1.0.zip` 并解压；
2. 打开 Chrome / Edge 浏览器，在地址栏输入 `chrome://extensions/`；
3. 开启右上角 **「开发者模式」**；
4. 点击左上角 **「加载已解压的扩展程序」**，选择刚刚解压的目录即可。

### 方式二：源码安装与二次开发
```bash
git clone https://github.com/Suara17/resume-filler-extension.git
```
本项目源码已重构为**零依赖模块化架构**（业务逻辑分拆在 `src/` 各子目录中，样式与模板完全独立）：
```bash
# 单次极速编译构建 (耗时约 20~50ms)
npm run build
# 或 node build.js

# 热重载监听模式 (保存即自动装配)
npm run watch
```
在浏览器扩展管理界面加载根目录即可。

---

## 📂 项目结构

```text
OfferGo/
├── src/                       # 核心模块化源码（业务逻辑细化拆分，单文件轻量易维护）
│   ├── content/               # 网页端内容注入模块（DOM 探测、ATS 适配、智能求解器等）
│   ├── card/                  # 悬浮面板模块（独立 styles.css 与 template.html，视图与交互）
│   ├── background/            # 后台 Service Worker 模块（Agent ReAct 调度、Frame 广播等）
│   └── sidepanel/             # 侧边栏工作台模块（经历管理、附件管理、AI 接口等）
├── build.js                   # 零依赖模块编译器（执行 node build.js 或 npm run build 秒级装配）
├── assets/                    # 演示图与交互矢量示意图
├── icons/                     # 扩展品牌图标（16/32/48/128/512/1024 与矢量源）
├── manifest.json              # Chrome 扩展 Manifest V3 核心配置文件
├── background.js              # 扩展后台 Service Worker（编译单入口）
├── content.js                 # 网页内容脚本（编译单入口）
├── floating_card.js           # 页面悬浮交互面板（编译单入口）
├── sidepanel.html             # Chrome 侧边栏页面
├── sidepanel.js               # 侧边栏逻辑与数据持久化（编译单入口）
├── style.css                  # 侧边栏样式文件
├── test_page.html             # 本地离线综合表单测试页面
├── resume_template.json       # 空白简历结构标准模板
├── resume_demo.json           # 示例脱敏演示数据（张三）
├── agent_logs.js              # Agent 诊断日志与审计分析工具
├── CHANGELOG.md               # 版本更新日志
├── .gitignore                 # Git 忽略规则（保护个人真实简历防误传）
├── LICENSE                    # MIT 开源许可证
└── README.md                  # 本说明文档
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源，欢迎自由使用、分发与二次开发！

---

## 🌐 社区认可 / Acknowledgement

> 本开源项目已链接认可 [LINUX DO](https://linux.do/) 社区。感谢社区技术交流与开源探索精神的支持与启发！
