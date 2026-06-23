# Mr_Cheng - 岗位投递助手

> 🚀 BOSS 直聘自动投递 Chrome 扩展 — 多维度精准筛选 + AI 深度匹配

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue)](https://developer.chrome.com/docs/extensions/)
[![Version](https://img.shields.io/badge/version-1.19.0-green)](https://github.com/your-username/boss-zhipin-auto-apply)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

一个运行在 BOSS 直聘网页端的 Chrome 扩展，帮助求职者自动筛选岗位、智能匹配职位并批量发起沟通，大幅提升求职效率。

---

## ✨ 核心功能

### 🎯 基础筛选
- **关键词匹配**：按职位关键词精准筛选，支持多关键词
- **排除关键词**：自动过滤含排除词的岗位
- **薪资过滤**：设置最低薪资门槛，低于标准自动跳过
- **HR 活跃度**：过滤不活跃的 HR，避免无效投递

### 🤖 AI 深度匹配
- **JD 智能分析**：使用大模型（DeepSeek 等）分析职位描述与个人画像的匹配度
- **个性化打招呼**：根据 JD 自动生成定制化的开场白，提高回复率
- **多模型支持**：可配置多个 AI 模型（DeepSeek、OpenAI 等）
- **匹配日志**：记录每次 AI 匹配结果，方便复盘

### 📋 工作经历配置
- **技能标签**：配置你的核心技能
- **工作经历**：录入工作背景供 AI 参考
- **求职要求**：设定期望条件，AI 综合评估匹配度

### 🏢 企业黑名单
- **手动添加**：一键拉黑不想投递的公司
- **自动跳过**：黑名单企业在扫描时自动过滤

### 🛡️ 反检测系统
- **贝塞尔曲线鼠标轨迹**：模拟真实鼠标移动路径
- **打字模拟**：逐字输入，偶尔模拟打字错误
- **疲劳模型**：随使用时间增加逐渐放缓操作速度
- **休息机制**：短休息（每 5-10 次沟通）+ 长休息（每 20-30 次沟通）
- **空闲行为模拟**：随机滚动、移动鼠标等，模拟人类浏览行为

### 📊 运行日志
- **实时统计**：已沟通数、已投递数、跳过数等
- **持久化日志**：页面刷新后日志不丢失
- **详细记录**：每次操作的时间、公司、岗位、结果

### 💾 配置管理
- **导入/导出**：一键备份和恢复所有配置
- **本地存储**：所有数据保存在 `chrome.storage.local`，不上传任何服务器

---

## 📦 安装方式

### 方式一：开发者模式加载（推荐）

1. **下载源码**
   ```bash
   git clone https://github.com/your-username/boss-zhipin-auto-apply.git
   ```
   或者直接下载 ZIP 压缩包并解压

2. **打开 Chrome 扩展管理页面**
   - 地址栏输入 `chrome://extensions/`
   - 打开右上角「开发者模式」开关

3. **加载扩展**
   - 点击「加载已解压的扩展程序」
   - 选择解压后的项目文件夹

4. **开始使用**
   - 打开 [BOSS 直聘](https://www.zhipin.com/web/geek/jobs)
   - 扩展自动激活，点击浮动面板开始配置

---

## 🚀 使用指南

### 基本使用流程

```
1. 打开 BOSS 直聘找工作页面
2. 点击右侧浮动设置面板
3. 配置筛选条件（城市、关键词、薪资等）
4. （可选）配置 AI 深度匹配
5. 点击「开始」按钮
6. 扩展自动扫描、筛选、发起沟通
```

### AI 深度匹配配置

1. 切换到「AI 深度匹配」标签页
2. 填入你的 AI API Key（如 DeepSeek）
3. 在「工作经历」标签页配置个人信息
4. 开启 AI 深度匹配开关
5. 扩展将自动分析 JD 并生成个性化打招呼语

### 配置导入/导出

- **导出**：AI 深度匹配标签页 → 点击「导出配置」
- **导入**：粘贴配置 JSON → 点击「导入配置」

---

## 📁 项目结构

```
boss_agent_c/
├── manifest.json              # Chrome 扩展配置清单
├── background.js              # Service Worker（AI API 代理）
├── content.js                 # 入口文件（模块初始化编排）
├── src/
│   ├── utils.js               # 核心工具库（sleep、DOM、模拟人类行为）
│   ├── core/
│   │   ├── config.js          # 配置管理（CRUD、存储、导入导出）
│   │   └── selectors.js       # DOM 选择器常量、城市编码映射
│   ├── modules/
│   │   ├── event-trusted.js   # MAIN world — isTrusted 反检测钩子
│   │   ├── filters.js         # 职位过滤（标题/薪资/排除词/PUA 字体解码）
│   │   ├── ai.js              # AI 集成（DeepSeek 匹配、个性化打招呼）
│   │   ├── ui.js              # 浮动设置面板（多标签页 UI）
│   │   ├── anti-detection.js  # 反检测（鼠标/键盘/滚动模拟）
│   │   └── automation.js      # 核心自动化循环（扫描/筛选/点击/弹窗处理）
│   └── styles/                # 样式文件
├── icons/                     # 扩展图标（16/32/48/128px）
├── CLAUDE.md                  # 项目开发文档
└── README.md                  # 本文件
```

---

## 🔧 技术亮点

| 技术点 | 说明 |
|--------|------|
| **MV3 Content Scripts** | 双世界注入（MAIN + ISOLATED），绕过页面反检测 |
| **非枚举全局变量** | `Object.defineProperty` 隐藏模块，避免被页面脚本探测 |
| **PUA 字体解码** | Canvas 像素比对破解 BOSS 直聘薪资数字混淆 |
| **贝塞尔曲线鼠标模拟** | 三次贝塞尔 + 随机抖动，模拟真实鼠标轨迹 |
| **AbortController 中断** | 所有异步操作支持即时停止 |
| **WeakSet 去重** | 弱引用追踪已处理卡片，不阻止 GC |
| **疲劳模型** | 30 分钟窗口内延迟递增 5%（上限 30%），模拟人类疲劳 |

---

## ⚙️ 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 本地存储用户配置和运行日志 |
| `scripting` | 动态注入脚本 |
| `host_permissions: zhipin.com` | 访问 BOSS 直聘页面 |
| `host_permissions: api.deepseek.com` | 代理 AI API 请求 |

> ⚠️ 本扩展不会收集、上传或分享任何用户数据。所有配置和日志均存储在本地浏览器中。

---

## ⚠️ 免责声明

- 本项目仅供学习和研究使用
- 使用本扩展产生的一切后果由用户自行承担
- 请遵守 BOSS 直聘的用户协议和相关法律法规
- 建议合理使用，避免高频操作触发平台风控
- 本项目与 BOSS 直聘无任何关联

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

---

## 📄 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。

---

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) — 提供 AI 模型支持
- 所有贡献者和使用者
