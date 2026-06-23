# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) that automates job applications on BOSS Zhipin (zhipin.com). Scans job listings, filters by user criteria (keywords, salary, HR activity, blacklist), optionally uses DeepSeek AI for JD matching, and auto-clicks "chat" to initiate recruiter contact. Extensive anti-detection system simulates human behavior.

**Name:** Mr_Cheng - 岗位投递助手 | **Version:** 1.19.0

## Key Features

- **基础筛选**: 按关键词、薪资、HR活跃状态筛选职位
- **AI深度匹配**: 使用大模型分析JD与用户画像匹配度，生成个性化打招呼语
- **工作经历配置**: 配置技能、经历、要求，供AI匹配使用
- **企业黑名单**: 自动跳过黑名单企业
- **导入/导出配置**: 备份和恢复所有配置
- **运行日志持久化**: 页面刷新后保留日志
- **反检测系统**: 模拟人类行为（鼠标、键盘、滚动、休息机制）

## Build & Run

No build step — plain JavaScript, no bundler/transpiler/dependencies.

1. Open `chrome://extensions/`, enable Developer mode
2. Click "Load unpacked" → select this directory
3. Navigate to `https://www.zhipin.com/web/geek/jobs*` or `https://www.zhipin.com/web/geek/chat*` — extension activates automatically

No test framework, linter, or CI is configured.

## Architecture

Three execution contexts defined in `manifest.json`:

### Execution Contexts
- **MAIN world** (`src/modules/event-trusted.js`): Runs at `document_start` in page JS context. Hooks `EventTarget.prototype.addEventListener` to override `event.isTrusted` — the core anti-detection mechanism.
- **Content script** (all other `src/` files + `content.js`): Runs at `document_end` in isolated context. All modules attach to `window` as non-enumerable properties.
- **Service worker** (`background.js`): Proxies AI API requests (content scripts can't make cross-origin fetches) and handles script injection.

### Module Loading Order (dependency chain)
```
event-trusted.js (standalone, MAIN world)
    ↓
utils.js (BossUtils) — sleep/delay, DOM helpers, human simulation, AbortController
    ↓
selectors.js (BossSelectors) — DOM selector constants for zhipin.com, city codes
    ↓
config.js (BossConfig) — settings CRUD, chrome.storage.local persistence, state
    ↓
filters.js (BossFilters) — title matching, salary parsing, PUA font decoding
    ↓
ai.js (BossAI) — DeepSeek API integration via background.js proxy
    ↓
ui.js (BossUI) — floating settings panel (config/blacklist/AI/logs tabs)
    ↓
anti-detection.js (BossAntiDetection) — mouse/keyboard/scroll simulation
    ↓
automation.js (BossAutomation) — main automation loop, popup handling
    ↓
content.js — entry point, orchestrates initialization
```

### Key Patterns

**Non-enumerable globals**: All modules attach to `window` via `Object.defineProperty` with `{ enumerable: false, configurable: false, writable: false }` to avoid detection by anti-bot scripts.

**Lazy module access**: Modules that need utilities from later-loaded modules use lazy accessors (`const U = () => window.BossUtils;`) since load order ensures availability at call time but not parse time.

**AbortController for instant stop**: A single `BossUtils.requestAbort()` / `BossUtils.resetAbort()` / `BossUtils.isAborted()` pattern. All `humanSleep()` calls race against the abort signal for immediate stop on user action.

**PUA font decoding**: BOSS Zhipin obfuscates salary numbers with custom PUA Unicode fonts. Decoded by rendering digits 0-9 + PUA char onto canvas, comparing pixel data, caching results per font. Canvas is immediately cleaned after use.

**WeakSet for processed cards**: `automation.js` uses `__processedCards` WeakSet to track processed job card DOM elements without preventing GC.

**Error handling**: Errors are silently caught with empty catch blocks or logged to an internal buffer (never `console`). This is intentional anti-detection.

**Configuration**: All user settings persisted to `chrome.storage.local` with 300ms debounce. Includes city, keywords, exclude words, salary floor, HR filters, chat limit, blacklist, work experience, AI model settings.

**Anti-detection features**: Bezier curve mouse trajectories with jitter, typing simulation with occasional typos, fatigue model (delays increase 5% per 30min, capped 30%), rest mechanism (short rests every 5-10 chats, long rests every 20-30), rAF defense loop, idle behavior simulation.

**AI Deep Matching**: Uses LLM to analyze job descriptions against user profile (skills, experience, requirements). Returns structured JSON with match result and personalized greeting message.

**Page-aware UI**: Different UI for jobs page (full config) and chat page (logs only). State persistence across page navigation for automated messaging flow.

**Run Log Persistence**: Logs saved to chrome.storage.local and restored on page refresh. Statistics reset on each new run.

## File Map

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions, content scripts (jobs + chat pages), service worker |
| `background.js` | Service worker — AI API proxy, message handling |
| `content.js` | Entry point — orchestrates module initialization, injects UI, pending message recovery |
| `src/utils.js` | Core utilities — sleep, DOM helpers, human simulation, risk detection, run log persistence |
| `src/core/config.js` | Configuration — defaults, storage CRUD, state management, import/export config |
| `src/core/selectors.js` | DOM selectors for zhipin.com elements, city code mapping |
| `src/modules/filters.js` | Job filtering — title/salary/exclude matching, PUA font decoding, JD cleaning |
| `src/modules/ai.js` | AI integration — DeepSeek API matching, AI deep match with logging |
| `src/modules/ui.js` | UI panel — floating settings panel with tabs (basic/blacklist/work/AI/logs) |
| `src/modules/anti-detection.js` | Anti-detection — mouse/typing/scroll simulation, idle behavior |
| `src/modules/automation.js` | Core loop — scan cards, filter, click chat, handle popups, auto-send greeting |
| `src/modules/event-trusted.js` | MAIN world — isTrusted bypass via addEventListener hook |

## Conventions

- All code comments are in Chinese
- No external dependencies or package manager
- UI styles injected via dynamic `<style>` element (Apple-like aesthetic)
- Automation flow: scan visible cards → filter → click card → scroll JD → check criteria → AI deep match (optional) → click "立即沟通" → handle dialog/auto-send greeting → scroll for more
- Chat page flow: click "继续沟通" → save pending state → navigate to chat → auto-send greeting → navigate back
- Cross-module function calls use namespace prefixes (e.g., `BossFilters.cleanJobDesc()`, `BossConfig.getPosKw()`, `BossAI.aiDeepMatch()`)

## UI Tabs

| Tab | Content |
|-----|---------|
| 基础配置 | City, keywords, salary, HR filters, chat limit |
| 企业黑名单 | Company blacklist management |
| 工作经历 | Skills, experience, requirements (for AI matching) |
| AI深度匹配 | AI toggle, model config, match logs, config import/export |
| 运行日志 | Statistics and real-time logs |
