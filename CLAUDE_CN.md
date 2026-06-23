# CLAUDE_CN.md（中文版）

本文件为 Claude Code (claude.ai/code) 提供项目指导说明。

## 项目概述

Chrome 扩展程序（Manifest V3），用于自动化 BOSS 直聘（zhipin.com）的职位投递。扫描职位列表，按用户条件筛选（关键词、薪资、HR 活跃状态、黑名单），可选使用 DeepSeek AI 进行 JD 匹配，并自动点击"沟通"发起联系。包含完整的反检测系统，模拟人类行为。

**名称:** Mr_Cheng - 岗位投递助手 | **版本:** 1.19.0

## 核心功能

- **基础筛选**: 按关键词、薪资、HR 活跃状态筛选职位
- **AI 深度匹配**: 使用大模型分析 JD 与用户画像匹配度，生成个性化打招呼语
- **工作经历配置**: 配置技能、经历、要求，供 AI 匹配使用
- **企业黑名单**: 自动跳过黑名单企业
- **导入/导出配置**: 备份和恢复所有配置
- **运行日志持久化**: 页面刷新后保留日志
- **反检测系统**: 模拟人类行为（鼠标、键盘、滚动、休息机制）

## 构建与运行

无需构建步骤 — 纯 JavaScript，无打包器/转译器/依赖。

1. 打开 `chrome://extensions/`，启用开发者模式
2. 点击"加载已解压的扩展程序" → 选择此目录
3. 访问 `https://www.zhipin.com/web/geek/jobs*` 或 `https://www.zhipin.com/web/geek/chat*` — 扩展自动激活

无测试框架、代码检查工具或 CI 配置。

## 架构设计

三个执行上下文，定义在 `manifest.json` 中：

### 执行上下文

- **MAIN world** (`src/modules/event-trusted.js`): 在 `document_start` 时运行于页面 JS 上下文。Hook `EventTarget.prototype.addEventListener` 以覆盖 `event.isTrusted` — 核心反检测机制。
- **Content script**（其他所有 `src/` 文件 + `content.js`）: 在 `document_end` 时运行于隔离上下文。所有模块通过非枚举属性挂载到 `window`。
- **Service worker** (`background.js`): 代理 AI API 请求（content script 无法跨域 fetch），处理脚本注入。

### 模块加载顺序（依赖链）

```
event-trusted.js（独立，MAIN world）
    ↓
utils.js (BossUtils) — sleep/delay、DOM 辅助、人类模拟、AbortController
    ↓
selectors.js (BossSelectors) — zhipin.com 的 DOM 选择器常量、城市编码
    ↓
config.js (BossConfig) — 配置 CRUD、chrome.storage.local 持久化、状态管理
    ↓
filters.js (BossFilters) — 标题匹配、薪资解析、PUA 字体解码、JD 清理
    ↓
ai.js (BossAI) — DeepSeek API 集成（通过 background.js 代理）、AI 深度匹配、匹配日志
    ↓
ui.js (BossUI) — 浮动设置面板（基础配置/黑名单/工作经历/AI/日志 标签页）
    ↓
anti-detection.js (BossAntiDetection) — 鼠标/键盘/滚动模拟、空闲行为
    ↓
automation.js (BossAutomation) — 主自动化循环、弹窗处理、自动发送打招呼语
    ↓
content.js — 入口点，协调初始化，待发送消息恢复
```

### 关键模式

**非枚举全局变量**: 所有模块通过 `Object.defineProperty` 挂载到 `window`，使用 `{ enumerable: false, configurable: false, writable: false }` 以避免被反机器人脚本检测。

**懒加载模块访问**: 需要后加载模块功能的模块使用懒访问器（`const U = () => window.BossUtils;`），因为加载顺序确保调用时可用但解析时不可用。

**AbortController 即时停止**: 使用 `BossUtils.requestAbort()` / `BossUtils.resetAbort()` / `BossUtils.isAborted()` 模式。所有 `humanSleep()` 调用与 abort 信号竞争，用户操作时立即停止。

**PUA 字体解码**: BOSS 直聘使用自定义 PUA Unicode 字体混淆薪资数字。通过将数字 0-9 + PUA 字符渲染到 canvas，比较像素数据，按字体缓存结果来解码。使用后立即清理 canvas。

**WeakSet 已处理卡片**: `automation.js` 使用 `__processedCards` WeakSet 跟踪已处理的职位卡片 DOM 元素，不阻止 GC。

**错误处理**: 错误静默捕获，使用空 catch 块或记录到内部缓冲区（不使用 `console`）。这是有意的反检测设计。

**配置**: 所有用户设置通过 `chrome.storage.local` 持久化，300ms 防抖。包括城市、关键词、排除词、薪资底线、HR 筛选、聊天上限、黑名单、工作经历、AI 模型设置。

**反检测功能**: 贝塞尔曲线鼠标轨迹（带抖动）、打字模拟（偶有错字）、疲劳模型（每 30 分钟延迟增加 5%，上限 30%）、休息机制（每 5-10 次沟通短休息，每 20-30 次长休息）、rAF 防御循环、空闲行为模拟。

**AI 深度匹配**: 使用大模型分析职位描述与用户画像（技能、经历、要求）的匹配度。返回结构化 JSON，包含匹配结果和个性化打招呼语。

**页面感知 UI**: 职位页面显示完整配置，聊天页面仅显示日志。跨页面导航的状态持久化支持自动消息发送流程。

**运行日志持久化**: 日志保存到 chrome.storage.local，页面刷新后恢复。每次新运行重置统计。

## 文件映射

| 文件 | 用途 |
|------|------|
| `manifest.json` | MV3 清单 — 权限、content scripts（职位 + 聊天页面）、service worker |
| `background.js` | Service worker — AI API 代理、消息处理 |
| `content.js` | 入口点 — 协调模块初始化、注入 UI、待发送消息恢复 |
| `src/utils.js` | 核心工具 — sleep、DOM 辅助、人类模拟、风险检测、运行日志持久化 |
| `src/core/config.js` | 配置 — 默认值、存储 CRUD、状态管理、导入导出配置 |
| `src/core/selectors.js` | zhipin.com 元素的 DOM 选择器、城市编码映射 |
| `src/modules/filters.js` | 职位筛选 — 标题/薪资/排除匹配、PUA 字体解码、JD 清理 |
| `src/modules/ai.js` | AI 集成 — DeepSeek API 匹配、AI 深度匹配（含日志） |
| `src/modules/ui.js` | UI 面板 — 浮动设置面板（基础配置/黑名单/工作经历/AI/日志 标签页） |
| `src/modules/anti-detection.js` | 反检测 — 鼠标/打字/滚动模拟、空闲行为 |
| `src/modules/automation.js` | 核心循环 — 扫描卡片、筛选、点击沟通、处理弹窗、自动发送打招呼语 |
| `src/modules/event-trusted.js` | MAIN world — 通过 addEventListener hook 绕过 isTrusted |

## 约定

- 所有代码注释使用中文
- 无外部依赖或包管理器
- UI 样式通过动态 `<style>` 元素注入（Apple 风格美学）
- 自动化流程: 扫描可见卡片 → 筛选 → 点击卡片 → 滚动 JD → 检查条件 → AI 深度匹配（可选）→ 点击"立即沟通" → 处理对话框/自动发送打招呼语 → 继续滚动
- 聊天页面流程: 点击"继续沟通" → 保存待发送状态 → 跳转到聊天页面 → 自动发送打招呼语 → 返回职位列表
- 跨模块函数调用使用命名空间前缀（如 `BossFilters.cleanJobDesc()`、`BossConfig.getPosKw()`、`BossAI.aiDeepMatch()`）

## UI 标签页

| 标签页 | 内容 |
|--------|------|
| 基础配置 | 城市、关键词、薪资、HR 筛选、聊天上限 |
| 企业黑名单 | 企业黑名单管理 |
| 工作经历 | 技能、经历、要求（供 AI 匹配使用） |
| AI 深度匹配 | AI 开关、模型配置、匹配日志、配置导入导出 |
| 运行日志 | 统计数据和实时日志 |
