// ==========================================
// BOSS直聘 AI海投助手 - UI模块（重新设计）
// 标签页切换：基础配置、企业黑名单、AI配置、运行日志
// ==========================================

/**
 * 注入样式
 */
const injectStyle = () => {
    const style = document.createElement('style');
    style.textContent = `
        /* ===== 面板主体 ===== */
        .boss-panel {
            position: fixed; top: 60px; right: 16px;
            width: 360px; max-height: calc(100vh - 80px);
            background: rgba(255,255,255,.96);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0,0,0,.08); border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04);
            z-index: 999999;
            font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Microsoft YaHei", sans-serif;
            display: flex; flex-direction: column; overflow: hidden;
            transition: box-shadow .3s, width .3s;
            color: #1d1d1f;
        }
        .boss-panel:hover { box-shadow: 0 12px 40px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.06); }
        .boss-panel.dragging { box-shadow: 0 20px 60px rgba(0,0,0,.18) !important; transition: none; }
        .boss-panel.dragging .boss-header { cursor: grabbing !important; }

        /* ===== 顶部栏 ===== */
        .boss-header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff; padding: 12px 16px; font-weight: 600; font-size: 13px;
            display: flex; justify-content: space-between; align-items: center;
            border-radius: 14px 14px 0 0; min-height: 22px; cursor: grab;
            flex-shrink: 0; letter-spacing: .3px; user-select: none;
        }
        .boss-header span { opacity: .95; }
        .btn-collapse {
            background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.1);
            color: #fff; font-size: 14px; width: 26px; height: 26px; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            opacity: .7; transition: all .2s; line-height: 1;
        }
        .btn-collapse:hover { background: rgba(255,255,255,.22); opacity: 1; }

        /* ===== 标签页导航 ===== */
        .boss-tabs {
            display: flex; background: #fafafa; border-bottom: 1px solid #f0f0f0;
            flex-shrink: 0; padding: 0 4px;
        }
        .boss-tab {
            flex: 1; padding: 10px 2px; text-align: center; font-size: 12px;
            color: #86868b; cursor: pointer; border-bottom: 2.5px solid transparent;
            transition: all .25s; white-space: nowrap; user-select: none;
            position: relative;
        }
        .boss-tab:hover { color: #1d1d1f; background: rgba(0,0,0,.02); }
        .boss-tab.active {
            color: #0071e3; border-bottom-color: #0071e3; font-weight: 600;
        }

        /* ===== 标签页内容 ===== */
        .boss-tab-page { display: none; overflow-y: auto; flex: 1; }
        .boss-tab-page.active { display: block; }
        .boss-tab-page::-webkit-scrollbar { width: 4px; }
        .boss-tab-page::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 4px; }
        .boss-tab-page::-webkit-scrollbar-track { background: transparent; }

        .boss-page-body { padding: 14px 16px 8px; }

        /* ===== 表单元素 ===== */
        .boss-page-body label {
            display: block; margin: 0 0 10px 0; font-size: 12px; color: #1d1d1f;
            font-weight: 500;
        }
        .boss-page-body input[type=text],
        .boss-page-body input[type=password],
        .boss-page-body input[type=number],
        .boss-page-body textarea {
            width: 100%; padding: 8px 12px; border: 1px solid #d2d2d7;
            border-radius: 8px; font-size: 12px; margin-top: 5px;
            box-sizing: border-box; background: #fff; color: #1d1d1f;
            transition: border-color .2s, box-shadow .2s;
            font-family: inherit;
        }
        .boss-page-body input:focus, .boss-page-body textarea:focus {
            outline: none; border-color: #0071e3;
            box-shadow: 0 0 0 3px rgba(0,113,227,.15);
        }
        .boss-page-body input::placeholder, .boss-page-body textarea::placeholder { color: #a1a1a6; }
        .boss-page-body input[type=checkbox] {
            width: 15px; height: 15px; margin: 0; accent-color: #0071e3;
            border-radius: 4px;
        }
        .field-hint {
            font-size: 11px; color: #86868b; margin: 2px 0 6px 0; line-height: 1.4;
        }
        .city-hint { font-size: 11px; color: #ff3b30; margin: 2px 0 6px 0; display: none; }
        .city-hint.show { display: block; }

        /* ===== 城市联想下拉 ===== */
        .city-wrap { position: relative; }
        .city-dropdown {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
            background: #fff; border: 1px solid #d2d2d7; border-radius: 8px;
            max-height: 180px; overflow-y: auto; display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,.1);
        }
        .city-dropdown.show { display: block; }
        .city-item {
            padding: 8px 12px; font-size: 12px; cursor: pointer;
            transition: background .15s;
        }
        .city-item:hover, .city-item.active { background: #f0f7ff; color: #0071e3; }
        .field-section {
            margin: 0 0 12px 0; padding: 10px 12px; border-radius: 10px;
            font-size: 11.5px; line-height: 1.5;
        }
        .field-section.info { background: #f0f7ff; color: #0066cc; border: 1px solid #d0e3f7; }
        .field-section.warn { background: #fffbf0; color: #996600; border: 1px solid #f0e0c0; }

        /* ===== 复选框组 ===== */
        .checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
        .checkbox-group label {
            display: flex; align-items: center; gap: 5px;
            font-size: 12px; cursor: pointer; margin: 0; font-weight: 400;
            padding: 4px 10px; border-radius: 6px; background: #f5f5f7;
            transition: background .15s;
        }
        .checkbox-group label:hover { background: #e8e8ed; }

        /* ===== 企业黑名单 ===== */
        .blacklist-input-row { display: flex; gap: 6px; margin-bottom: 10px; }
        .blacklist-input-row input { flex: 1; margin: 0; }
        .btn-add-sm {
            padding: 8px 16px; border: none; border-radius: 8px;
            background: #0071e3; color: #fff; cursor: pointer;
            font-size: 12px; font-weight: 500; white-space: nowrap;
            transition: background .2s;
        }
        .btn-add-sm:hover { background: #0077ed; }
        .blacklist-list { max-height: 300px; overflow-y: auto; }
        .blacklist-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px; margin: 3px 0; background: #f5f5f7;
            border-radius: 8px; font-size: 12px;
            transition: background .15s;
        }
        .blacklist-item:hover { background: #fff0f0; }
        .btn-del-sm {
            border: none; background: #ff3b30; color: #fff;
            width: 20px; height: 20px; border-radius: 50%;
            cursor: pointer; font-size: 12px; line-height: 20px;
            text-align: center; padding: 0; flex-shrink: 0;
            transition: background .15s;
        }
        .btn-del-sm:hover { background: #d63027; }
        .blacklist-empty { color: #a1a1a6; font-size: 12px; text-align: center; padding: 20px 0; }

        /* ===== AI模型卡片 ===== */
        .ai-model-card {
            border: 1px solid #d2d2d7; border-radius: 10px;
            padding: 12px 14px; margin: 6px 0; background: #fafafa;
            position: relative; transition: all .2s;
        }
        .ai-model-card:hover { border-color: #a1a1a6; }
        .ai-model-card.active {
            border-color: #0071e3; background: #f0f7ff;
            box-shadow: 0 0 0 1px rgba(0,113,227,.2);
        }
        .ai-model-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 8px;
        }
        .ai-model-name { font-size: 13px; font-weight: 600; color: #1d1d1f; }
        .ai-model-actions { display: flex; gap: 6px; }
        .btn-sm {
            padding: 4px 10px; border: 1px solid #d2d2d7; border-radius: 6px;
            background: #fff; color: #1d1d1f; cursor: pointer;
            font-size: 11px; font-weight: 500; transition: all .15s;
        }
        .btn-sm:hover { background: #f5f5f7; }
        .btn-sm.primary { background: #0071e3; color: #fff; border-color: #0071e3; }
        .btn-sm.primary:hover { background: #0077ed; }
        .btn-sm.danger { color: #ff3b30; border-color: #ffcdd0; }
        .btn-sm.danger:hover { background: #fff5f5; }
        .ai-model-fields label { font-size: 11px; margin: 0 0 4px 0; }
        .ai-model-fields input { font-size: 11px; padding: 6px 10px; margin-top: 3px; }

        /* ===== 统计栏 ===== */
        .stats-bar {
            display: flex; gap: 1px; padding: 12px 16px;
            background: #fafafa; border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
        }
        .stat-item {
            flex: 1; text-align: center; font-size: 11px; color: #86868b;
            font-weight: 500;
        }
        .stat-num {
            display: block; font-size: 20px; font-weight: 700;
            color: #1d1d1f; margin-bottom: 2px;
            font-variant-numeric: tabular-nums;
        }
        .stat-item:nth-child(1) .stat-num { color: #0071e3; }
        .stat-item:nth-child(2) .stat-num { color: #34c759; }
        .stat-item:nth-child(3) .stat-num { color: #ff9500; }

        /* ===== 日志 ===== */
        .boss-log {
            background: #1a1a2e; color: #c8c8d0; font-size: 11px;
            font-family: "SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace;
            padding: 10px 12px; height: 450px; overflow-y: auto;
            line-height: 1.6; user-select: text;
            border-radius: 0 0 10px 10px;
        }
        .boss-log::-webkit-scrollbar { width: 5px; }
        .boss-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }
        .boss-log::-webkit-scrollbar-track { background: transparent; }

        /* ===== 底部按钮 ===== */
        .boss-footer {
            background: #fafafa; padding: 10px 14px 12px;
            display: flex; gap: 8px; border-top: 1px solid #f0f0f0;
            border-radius: 0 0 14px 14px; flex-shrink: 0;
        }
        .boss-footer button {
            padding: 9px 16px; border: none; border-radius: 10px;
            cursor: pointer; font-size: 13px; font-weight: 600;
            transition: all .2s; letter-spacing: .2px;
        }
        .btn-primary {
            flex: 1; background: linear-gradient(135deg, #0071e3, #5856d6);
            color: #fff;
        }
        .btn-primary:hover { background: linear-gradient(135deg, #0077ed, #6366f1); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,113,227,.3); }
        .btn-primary:active { transform: translateY(0); }
        .btn-danger { background: #fff0f0; color: #ff3b30; }
        .btn-danger:hover { background: #ffe0e0; }
        .btn-stop {
            background: #fff0f0; color: #ff3b30; border: 1px solid #ffcdd0;
        }
        .btn-stop:hover { background: #ffe0e0; }
        .btn-secondary { background: #f5f5f7; color: #86868b; }
        .btn-secondary:hover { background: #e8e8ed; }
        .btn-utility {
            padding: 6px 10px; border: 1px solid #d2d2d7; border-radius: 8px;
            background: #fff; color: #86868b; cursor: pointer;
            font-size: 11px; font-weight: 500; transition: all .15s;
            white-space: nowrap;
        }
        .btn-utility:hover { background: #f5f5f7; color: #1d1d1f; }

        /* ===== 折叠状态 ===== */
        .boss-panel.collapsed { width: 220px; min-width: 220px; max-width: 220px; }
        .boss-panel.collapsed .boss-header { border-radius: 14px; }
        .boss-panel.collapsed .boss-tabs,
        .boss-panel.collapsed .boss-tab-page,
        .boss-panel.collapsed .boss-footer,
        .boss-panel.collapsed .stats-bar { display: none !important; }
        .collapsed-status {
            display: none; padding: 6px 16px; font-size: 11px; color: #86868b;
            background: #fafafa; border-top: 1px solid #f0f0f0; text-align: center;
        }
        .boss-panel.collapsed .collapsed-status { display: block; }
        .collapsed-status .cs-run { color: #34c759; font-weight: 600; }

        /* ===== 动画 ===== */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .boss-panel { animation: fadeIn .3s ease-out; }
    `;
    document.head.appendChild(style);
};

// ---- 标签页渲染 ----

/**
 * 渲染基础配置页
 */
const renderBasicPage = () => `
    <div class="boss-page-body">
        <div class="field-section info">
            <strong>使用方法：</strong>先手动搜索岗位或进入推荐页面，然后点击"开始海投"。<br>
            关键词以<strong>顿号（、）</strong>分隔，用于筛选标题是否匹配。
        </div>
        <label>意向城市
            <div class="city-wrap">
                <input type="text" id="cfg-city" placeholder="输入城市名，如：成都市(可选)" value="${config.city || ''}" autocomplete="off">
                <div class="city-dropdown" id="city-dropdown"></div>
            </div>
        </label>
        <div class="city-hint" id="city-hint">⚠ 当前仅支持热门城市筛选，其它城市请自行筛选</div>
        <div class="field-hint">运行时自动点击页面城市选择器匹配，留空不限</div>

        <label>岗位标题关键词 <span style="color:#34c759;font-weight:600">（含）</span>
            <input type="text" id="cfg-positions" placeholder="前端开发、web前端（留空全部通过）" value="${(config.positions || []).join('、')}">
        </label>

        <label>岗位标题关键词 <span style="color:#ff3b30;font-weight:600">（不含）</span>
            <input type="text" id="cfg-excludeTitle" placeholder="外包、销售、客服、实习、兼职、助理、BASE" value="${config.excludeTitle || ''}">
        </label>

        <label>岗位JD关键词 <span style="color:#ff3b30;font-weight:600">（不含）</span>
            <input type="text" id="cfg-excludeDesc" placeholder="出差、客服、销售、单体、大小周、大小休、996" value="${config.excludeDesc || ''}">
        </label>

        <label>薪资底线（K）
            <input type="number" id="cfg-salaryMin" placeholder="留空不限" value="${config.salaryMin || ''}">
        </label>

        <label>单次投递量上限
            <input type="number" id="cfg-maxChats" placeholder="0=不限制" value="${config.maxChatsPerRun != null ? config.maxChatsPerRun : 50}">
        </label>
        <div class="field-hint">达到上限自动停止，0 或留空不限</div>

        <label style="margin-top:8px">HR 活跃状态</label>
        <div class="checkbox-group">
            ${HR_ACTIVE_OPTIONS.map(opt => `
                <label><input type="checkbox" class="hr-active-checkbox" value="${opt.value}"
                    ${(config.hrActiveFilter || []).includes(opt.value) ? 'checked' : ''}>${opt.label}</label>
            `).join('')}
        </div>
    </div>
`;

/**
 * 渲染企业黑名单列表项
 */
const renderBlacklistItems = () => {
    const list = config.companyBlacklist || [];
    if (list.length === 0) return '<div class="blacklist-empty">暂无黑名单企业</div>';
    return list.map(kw => {
        const safe = BossUtils.escapeHtml(kw);
        return `
        <div class="blacklist-item">
            <span>${safe}</span>
            <button class="btn-del-sm" data-kw="${safe}" title="移除">×</button>
        </div>`;
    }).join('');
};

/**
 * 渲染企业黑名单页
 */
const renderBlacklistPage = () => `
    <div class="boss-page-body">
        <div class="field-section warn">
            卡片中包含任意黑名单关键词的企业将被自动跳过
        </div>
        <div class="blacklist-input-row">
            <input type="text" id="bl-input" placeholder="输入企业关键词">
            <button class="btn-add-sm" id="bl-add-btn">添加</button>
        </div>
        <div class="blacklist-list" id="bl-list">${renderBlacklistItems()}</div>
    </div>
`;

/**
 * 渲染AI配置页
 */
const renderAiPage = () => {
    const models = config.aiModels || [];
    const activeId = config.activeAiModelId || 'deepseek';

    const cardsHtml = models.map(m => {
        const isActive = m.id === activeId;
        return `
            <div class="ai-model-card ${isActive ? 'active' : ''}" data-id="${m.id}">
                <div class="ai-model-header">
                    <span class="ai-model-name">${isActive ? '● ' : ''}${m.name}</span>
                    <div class="ai-model-actions">
                        ${!isActive ? `<button class="btn-sm primary ai-switch" data-id="${m.id}">切换</button>` : '<span style="font-size:11px;color:#0071e3;font-weight:500">使用中</span>'}
                        ${models.length > 1 ? `<button class="btn-sm danger ai-delete" data-id="${m.id}">删除</button>` : ''}
                    </div>
                </div>
                <div class="ai-model-fields">
                    <label>名称<input type="text" class="ai-field" data-id="${m.id}" data-key="name" value="${m.name}"></label>
                    <label>API 地址<input type="text" class="ai-field" data-id="${m.id}" data-key="apiUrl" value="${m.apiUrl}"></label>
                    <label>API Key<input type="password" class="ai-field" data-id="${m.id}" data-key="apiKey" value="${m.apiKey || ''}" placeholder="sk-xxx"></label>
                    <label>模型名称<input type="text" class="ai-field" data-id="${m.id}" data-key="model" value="${m.model}"></label>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="boss-page-body">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <input type="checkbox" id="cfg-aiMatch" ${config.aiMatchEnabled ? 'checked' : ''}>
                <label for="cfg-aiMatch" style="margin:0;font-weight:600">启用 AI 深度匹配</label>
            </div>
            <div class="field-section info">
                开启后将对 JD 内容进行智能匹配（消耗 API 额度）<br>
                匹配成功后将自动生成个性化打招呼语并发送<br>
                支持自定义工作经历配置，提高匹配精准度
            </div>
            ${cardsHtml}
            <button class="btn-add-sm" id="ai-add-btn" style="width:100%;margin-top:8px">+ 添加模型</button>
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f0f0f0;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:12px;font-weight:600;color:#1d1d1f">AI匹配日志</span>
                    <div style="display:flex;gap:6px">
                        <button class="btn-sm danger" id="ai-clear-logs" title="清空所有匹配日志">清空日志</button>
                        <button class="btn-sm" id="ai-view-logs" title="查看最近10条匹配日志">查看日志</button>
                        <button class="btn-sm primary" id="ai-export-logs" title="导出匹配日志为JSON文件">导出日志</button>
                    </div>
                </div>
                <div id="ai-logs-container" style="display:none;max-height:300px;overflow-y:auto;background:#1a1a2e;border-radius:8px;padding:8px;font-size:11px;font-family:monospace;color:#c8c8d0;"></div>
            </div>

            <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f0f0f0;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:12px;font-weight:600;color:#1d1d1f">用户配置</span>
                    <div style="display:flex;gap:6px">
                        <button class="btn-sm" id="config-import" title="导入配置文件">导入配置</button>
                        <button class="btn-sm primary" id="config-export" title="导出所有配置为JSON文件">导出配置</button>
                    </div>
                </div>
                <div class="field-hint">导出/导入所有配置，包括基础配置、企业黑名单、工作经历和AI模型配置</div>
                <input type="file" id="config-file-input" accept=".json" style="display:none;">
            </div>
        </div>
    `;
};

/**
 * 渲染工作经历配置页
 */
const renderWorkPage = () => `
    <div class="boss-page-body">
        <div class="field-section info">
            <strong>说明：</strong>填写的工作经历信息将供AI深度匹配使用，帮助AI更精准地判断职位匹配度并生成个性化打招呼语。
        </div>

        <label>工作技能简述
            <textarea id="cfg-workSkills" rows="4" placeholder="如：Vue、React、Node.js、Python、MySQL...">${config.workSkills || ''}</textarea>
        </label>
        <div class="field-hint">列举您掌握的核心技术栈和工具</div>

        <label>工作经历简述
            <textarea id="cfg-workExperience" rows="4" placeholder="如：3年前端开发经验，曾在XX公司负责电商平台开发...">${config.workExperience || ''}</textarea>
        </label>
        <div class="field-hint">简要描述您的工作年限、公司经历和项目经验</div>

        <label>其它要求
            <textarea id="cfg-otherRequirements" rows="4" placeholder="如：不接受加班、期望双休、不接受出差、期望远程办公...">${config.otherRequirements || ''}</textarea>
        </label>
        <div class="field-hint">您对工作的附加要求，AI会在匹配时参考</div>
    </div>
`;

/**
 * 渲染运行日志页
 * @param {boolean} showStats - 是否显示统计栏
 */
const renderLogPage = (showStats = true) => `
    ${showStats ? `
    <div class="stats-bar" id="stats-auto">
        <div class="stat-item"><span class="stat-num" id="stat-scanned">0</span>已扫描</div>
        <div class="stat-item"><span class="stat-num" id="stat-chatted">0</span>已沟通</div>
        <div class="stat-item"><span class="stat-num" id="stat-skipped">0</span>已跳过</div>
    </div>
    ` : ''}
    <div style="padding:0"><div class="boss-log" id="log-auto">等待操作...</div></div>
`;

// ---- 防抖保存 ----
const __debouncedSaveConfig = BossUtils.debounce(() => saveConfig(), 300);

// ---- 事件绑定 ----

/**
 * 绑定标签页切换
 */
const bindTabs = (panel) => {
    const tabs = panel.querySelectorAll('.boss-tab');
    const pages = panel.querySelectorAll('.boss-tab-page');

    const utilityBtns = panel.querySelectorAll('.btn-utility');
    const startBtn = document.getElementById('btn-start-auto');
    const stopBtn = document.getElementById('btn-stop-auto');

    const updateFooterVisibility = (target) => {
        const isRunning = typeof state !== 'undefined' && state.autoRunning;
        const isLog = target === 'log';
        // 日志页：隐藏开始按钮，运行中显示停止按钮
        // 其他页：未运行显示开始按钮，运行中显示停止按钮
        if (startBtn) startBtn.style.display = (isLog || isRunning) ? 'none' : '';
        if (stopBtn) stopBtn.style.display = isRunning ? '' : 'none';
        utilityBtns.forEach(btn => {
            btn.style.display = isLog ? 'none' : '';
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPage = panel.querySelector(`[data-page="${target}"]`);
            if (targetPage) targetPage.classList.add('active');
            config.activeTab = target;
            updateFooterVisibility(target);
        });
    });

    const defaultTab = panel.querySelector('.boss-tab[data-tab="basic"]');
    if (defaultTab) defaultTab.click();
};

/**
 * 绑定基础配置事件
 */
const bindBasicEvents = () => {
    // ---- 城市联想 ----
    const HOT_CITIES = ['北京','上海','广州','深圳','杭州','天津','西安','苏州','武汉','厦门','长沙','成都','郑州','重庆'];
    const cityInput = document.getElementById('cfg-city');
    const cityDropdown = document.getElementById('city-dropdown');
    const cityHint = document.getElementById('city-hint');
    let cityActiveIdx = -1;

    const renderCityDropdown = (list) => {
        if (list.length === 0) {
            cityDropdown.classList.remove('show');
            cityDropdown.innerHTML = '';
            return;
        }
        cityDropdown.innerHTML = list.map((c, i) =>
            `<div class="city-item${i === cityActiveIdx ? ' active' : ''}" data-city="${c}">${c}市</div>`
        ).join('');
        cityDropdown.classList.add('show');
    };

    if (cityInput) {
        cityInput.addEventListener('input', () => {
            const val = cityInput.value.replace(/市$/, '').trim();
            cityActiveIdx = -1;
            if (!val) {
                cityDropdown.classList.remove('show');
                cityHint.classList.remove('show');
                config.city = '';
                __debouncedSaveConfig();
                return;
            }
            const matched = HOT_CITIES.filter(c => c.includes(val));
            renderCityDropdown(matched);
            // 输入不匹配任何城市时显示提示
            if (matched.length === 0) {
                cityHint.classList.add('show');
            } else {
                cityHint.classList.remove('show');
            }
        });

        cityInput.addEventListener('focus', () => {
            const val = cityInput.value.replace(/市$/, '').trim();
            const list = val ? HOT_CITIES.filter(c => c.includes(val)) : HOT_CITIES;
            cityActiveIdx = -1;
            renderCityDropdown(list);
        });

        cityInput.addEventListener('keydown', (e) => {
            const items = cityDropdown.querySelectorAll('.city-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                cityActiveIdx = (cityActiveIdx + 1) % items.length;
                items.forEach((el, i) => el.classList.toggle('active', i === cityActiveIdx));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                cityActiveIdx = (cityActiveIdx - 1 + items.length) % items.length;
                items.forEach((el, i) => el.classList.toggle('active', i === cityActiveIdx));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (cityActiveIdx >= 0 && items[cityActiveIdx]) {
                    selectCity(items[cityActiveIdx].dataset.city);
                }
            }
        });

        const selectCity = (city) => {
            cityInput.value = city + '市';
            config.city = city;
            __debouncedSaveConfig();
            cityDropdown.classList.remove('show');
            cityHint.classList.remove('show');
        };

        cityDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.city-item');
            if (item) selectCity(item.dataset.city);
        });

        // 失焦时校验：不匹配则清空
        cityInput.addEventListener('blur', () => {
            setTimeout(() => {
                cityDropdown.classList.remove('show');
                const val = cityInput.value.replace(/市$/, '').trim();
                if (val && !HOT_CITIES.includes(val)) {
                    cityInput.value = '';
                    config.city = '';
                    __debouncedSaveConfig();
                    cityHint.classList.add('show');
                } else if (val && HOT_CITIES.includes(val)) {
                    cityInput.value = val + '市';
                    config.city = val;
                    __debouncedSaveConfig();
                    cityHint.classList.remove('show');
                } else {
                    cityHint.classList.remove('show');
                }
            }, 200);
        });
    }

    const fields = [
        { id: 'cfg-excludeTitle', key: 'excludeTitle' },
        { id: 'cfg-excludeDesc', key: 'excludeDesc' },
        { id: 'cfg-salaryMin', key: 'salaryMin' }
    ];
    fields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { config[key] = el.value; __debouncedSaveConfig(); });
    });

    const positionsEl = document.getElementById('cfg-positions');
    if (positionsEl) positionsEl.addEventListener('input', () => {
        config.positions = positionsEl.value.trim() ? [positionsEl.value.trim()] : [''];
        __debouncedSaveConfig();
    });

    const maxChatsEl = document.getElementById('cfg-maxChats');
    if (maxChatsEl) maxChatsEl.addEventListener('input', () => {
        config.maxChatsPerRun = parseInt(maxChatsEl.value) || 0;
        __debouncedSaveConfig();
    });

    document.querySelectorAll('.hr-active-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            config.hrActiveFilter = Array.from(document.querySelectorAll('.hr-active-checkbox:checked')).map(c => c.value);
            saveConfig();
        });
    });
};

/**
 * 绑定企业黑名单事件
 */
const bindBlacklistEvents = () => {
    const input = document.getElementById('bl-input');
    const addBtn = document.getElementById('bl-add-btn');
    const listEl = document.getElementById('bl-list');

    const refreshList = () => {
        listEl.innerHTML = renderBlacklistItems();
        bindDeleteButtons();
    };

    const bindDeleteButtons = () => {
        listEl.querySelectorAll('.btn-del-sm').forEach(btn => {
            btn.addEventListener('click', async () => {
                await removeCompanyFromBlacklist(btn.dataset.kw);
                refreshList();
            });
        });
    };

    const addKeyword = async () => {
        const kw = (input.value || '').trim();
        if (!kw) return;
        await addCompanyToBlacklist(kw);
        input.value = '';
        refreshList();
    };

    if (addBtn) addBtn.addEventListener('click', addKeyword);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addKeyword(); });

    bindDeleteButtons();
};

/**
 * 绑定AI配置事件
 */
const bindAiEvents = () => {
    const aiMatchEl = document.getElementById('cfg-aiMatch');
    if (aiMatchEl) aiMatchEl.addEventListener('change', () => {
        config.aiMatchEnabled = aiMatchEl.checked;
        saveConfig();
    });

    document.querySelectorAll('.ai-field').forEach(el => {
        el.addEventListener('input', () => {
            const modelId = el.dataset.id;
            const key = el.dataset.key;
            const model = (config.aiModels || []).find(m => m.id === modelId);
            if (model) {
                model[key] = el.value;
                __debouncedSaveConfig();
            }
        });
    });

    document.querySelectorAll('.ai-switch').forEach(btn => {
        btn.addEventListener('click', async () => {
            config.activeAiModelId = btn.dataset.id;
            await saveConfig();
            refreshAiPage();
        });
    });

    document.querySelectorAll('.ai-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            config.aiModels = (config.aiModels || []).filter(m => m.id !== btn.dataset.id);
            if (config.activeAiModelId === btn.dataset.id && config.aiModels.length > 0) {
                config.activeAiModelId = config.aiModels[0].id;
            }
            await saveConfig();
            refreshAiPage();
        });
    });

    const addBtn = document.getElementById('ai-add-btn');
    if (addBtn) addBtn.addEventListener('click', async () => {
        const id = 'model_' + Date.now();
        if (!config.aiModels) config.aiModels = [];
        config.aiModels.push({ id, name: '新模型', apiUrl: '', apiKey: '', model: '' });
        await saveConfig();
        refreshAiPage();
    });

    // 清空日志按钮
    const clearLogsBtn = document.getElementById('ai-clear-logs');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            // 确认清空
            if (clearLogsBtn.textContent === '清空日志') {
                clearLogsBtn.textContent = '确认清空';
                clearLogsBtn.style.color = '#ff3b30';
                clearLogsBtn.style.borderColor = '#ffcdd0';
                // 3秒后恢复
                setTimeout(() => {
                    clearLogsBtn.textContent = '清空日志';
                    clearLogsBtn.style.color = '';
                    clearLogsBtn.style.borderColor = '';
                }, 3000);
                return;
            }

            // 执行清空
            await BossAI.clearDeepMatchLogs();

            // 清空日志容器
            const logsContainer = document.getElementById('ai-logs-container');
            if (logsContainer) {
                logsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#86868b;">暂无匹配日志</div>';
                logsContainer.style.display = 'block';
            }

            // 重置按钮状态
            clearLogsBtn.textContent = '✓ 已清空';
            clearLogsBtn.style.color = '#34c759';
            clearLogsBtn.style.borderColor = '#a8e6cf';
            setTimeout(() => {
                clearLogsBtn.textContent = '清空日志';
                clearLogsBtn.style.color = '';
                clearLogsBtn.style.borderColor = '';
            }, 1500);
        });
    }

    // 查看日志按钮
    const viewLogsBtn = document.getElementById('ai-view-logs');
    const logsContainer = document.getElementById('ai-logs-container');
    if (viewLogsBtn && logsContainer) {
        viewLogsBtn.addEventListener('click', async () => {
            const isVisible = logsContainer.style.display !== 'none';
            if (isVisible) {
                logsContainer.style.display = 'none';
                viewLogsBtn.textContent = '查看日志';
                return;
            }

            // 加载日志
            await BossAI.loadDeepMatchLogs();
            const logs = BossAI.getDeepMatchLogs();

            if (logs.length === 0) {
                logsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#86868b;">暂无匹配日志</div>';
            } else {
                logsContainer.innerHTML = logs.map((log, index) => {
                    const time = new Date(log.timestamp).toLocaleString();
                    const result = log.result || {};
                    const statusColor = result.isMatch ? '#10b981' : '#ef4444';
                    const statusText = result.isMatch ? '匹配' : '不匹配';
                    const duration = log.duration ? `${log.duration}ms` : '未知';
                    const error = log.error ? `<div style="color:#ef4444;margin-top:4px;">错误: ${escapeHtml(log.error)}</div>` : '';

                    return `
                        <div style="margin-bottom:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;" class="ai-log-item" data-index="${index}">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="color:#e2e8f0;font-weight:500;">${escapeHtml(log.jobName)}</span>
                                <span style="color:${statusColor};font-weight:600;">${statusText}</span>
                            </div>
                            <div style="color:#86868b;font-size:10px;margin-top:2px;">${time} | ${duration}</div>
                            ${error}
                            <div style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);" class="ai-log-detail">
                                <div style="margin-bottom:6px;"><span style="color:#86868b;">Prompt:</span><pre style="white-space:pre-wrap;word-break:break-all;color:#a9b1d6;font-size:10px;margin:4px 0 0 0;">${escapeHtml(log.prompt)}</pre></div>
                                <div><span style="color:#86868b;">Response:</span><pre style="white-space:pre-wrap;word-break:break-all;color:#a9b1d6;font-size:10px;margin:4px 0 0 0;">${escapeHtml(log.response)}</pre></div>
                            </div>
                        </div>
                    `;
                }).join('');

                // 添加点击展开/收起详情的事件
                logsContainer.querySelectorAll('.ai-log-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const detail = item.querySelector('.ai-log-detail');
                        if (detail) {
                            detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
                        }
                    });
                });
            }

            logsContainer.style.display = 'block';
            viewLogsBtn.textContent = '收起日志';
        });
    }

    // 导出日志按钮
    const exportLogsBtn = document.getElementById('ai-export-logs');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', async () => {
            await BossAI.loadDeepMatchLogs();
            const logsJson = BossAI.exportDeepMatchLogs();

            // 创建下载链接
            const blob = new Blob([logsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai_deep_match_logs_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // 按钮反馈
            const origText = exportLogsBtn.textContent;
            exportLogsBtn.textContent = '✓ 已导出';
            setTimeout(() => {
                exportLogsBtn.textContent = origText;
            }, 1500);
        });
    }

    // 导出配置按钮
    const configExportBtn = document.getElementById('config-export');
    if (configExportBtn) {
        configExportBtn.addEventListener('click', () => {
            const configJson = BossConfig.exportConfig();

            // 创建下载链接
            const blob = new Blob([configJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `boss_agent_config_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // 按钮反馈
            const origText = configExportBtn.textContent;
            configExportBtn.textContent = '✓ 已导出';
            setTimeout(() => {
                configExportBtn.textContent = origText;
            }, 1500);
        });
    }

    // 导入配置按钮
    const configImportBtn = document.getElementById('config-import');
    const configFileInput = document.getElementById('config-file-input');
    if (configImportBtn && configFileInput) {
        configImportBtn.addEventListener('click', () => {
            configFileInput.click();
        });

        configFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // 重置input，允许重复选择同一文件
            configFileInput.value = '';

            try {
                const text = await file.text();
                const result = await BossConfig.importConfig(text);

                if (result.success) {
                    // 导入成功，刷新UI
                    configImportBtn.textContent = '✓ 已导入';
                    configImportBtn.style.color = '#34c759';
                    configImportBtn.style.borderColor = '#a8e6cf';

                    // 提示用户刷新页面
                    setTimeout(() => {
                        alert('配置导入成功！页面将刷新以应用新配置。');
                        window.location.reload();
                    }, 500);
                } else {
                    // 导入失败
                    configImportBtn.textContent = '导入失败';
                    configImportBtn.style.color = '#ff3b30';
                    configImportBtn.style.borderColor = '#ffcdd0';

                    alert('导入失败：' + result.message);

                    setTimeout(() => {
                        configImportBtn.textContent = '导入配置';
                        configImportBtn.style.color = '';
                        configImportBtn.style.borderColor = '';
                    }, 2000);
                }
            } catch (err) {
                alert('文件读取失败：' + err.message);
            }
        });
    }
};

/**
 * 刷新AI页面内容
 */
const refreshAiPage = () => {
    const aiPage = document.querySelector('[data-page="ai"]');
    if (!aiPage) return;
    aiPage.innerHTML = renderAiPage();
    bindAiEvents();
};

/**
 * 绑定工作经历配置事件
 */
const bindWorkEvents = () => {
    const workFields = [
        { id: 'cfg-workSkills', key: 'workSkills' },
        { id: 'cfg-workExperience', key: 'workExperience' },
        { id: 'cfg-otherRequirements', key: 'otherRequirements' }
    ];
    workFields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { config[key] = el.value; __debouncedSaveConfig(); });
    });
};

// ---- 面板注入 ----

/**
 * 判断当前是否在聊天页面
 */
const isChatPage = () => {
    return window.location.href.includes('/web/geek/chat');
};

/**
 * 注入UI
 */
const injectUI = () => {
    if (document.getElementById('boss-ai-panel')) return;
    injectStyle();

    const panel = document.createElement('div');
    panel.id = 'boss-ai-panel';
    panel.className = 'boss-panel';
    const extVersion = chrome.runtime.getManifest().version;

    // 判断是否在聊天页面
    const isChat = isChatPage();

    if (isChat) {
        // 聊天页面：仅显示运行日志（不含统计栏）
        panel.innerHTML = `
            <div class="boss-header">
                <span>Mr_Cheng - 岗位投递助手 V${extVersion}</span>
                <button class="btn-collapse" id="btn-collapse-panel" title="折叠/展开">−</button>
            </div>
            <div class="boss-tab-page active" data-page="log" style="display:block">${renderLogPage(false)}</div>
            <div class="collapsed-status" id="collapsed-status">等待操作...</div>
        `;
    } else {
        // 职位列表页面：显示完整配置
        panel.innerHTML = `
            <div class="boss-header">
                <span>Mr_Cheng - 岗位投递助手 V${extVersion}</span>
                <button class="btn-collapse" id="btn-collapse-panel" title="折叠/展开">−</button>
            </div>
            <div class="boss-tabs">
                <div class="boss-tab active" data-tab="basic">基础配置</div>
                <div class="boss-tab" data-tab="blacklist">企业黑名单</div>
                <div class="boss-tab" data-tab="work">工作经历</div>
                <div class="boss-tab" data-tab="ai">AI深度匹配</div>
                <div class="boss-tab" data-tab="log">运行日志</div>
            </div>
            <div class="boss-tab-page active" data-page="basic">${renderBasicPage()}</div>
            <div class="boss-tab-page" data-page="blacklist">${renderBlacklistPage()}</div>
            <div class="boss-tab-page" data-page="work">${renderWorkPage()}</div>
            <div class="boss-tab-page" data-page="ai">${renderAiPage()}</div>
            <div class="boss-tab-page" data-page="log">${renderLogPage()}</div>
            <div class="boss-footer">
                <button class="btn-primary" id="btn-start-auto">▶ 开始海投</button>
                <button class="btn-primary btn-stop" id="btn-stop-auto" style="display:none">■ 停止</button>
                <button class="btn-utility" id="btn-reset-config" title="重置为默认配置">↺ 重置</button>
                <button class="btn-utility" id="btn-save-config" title="保存当前配置">💾 保存</button>
            </div>
            <div class="collapsed-status" id="collapsed-status">等待操作...</div>
        `;
    }

    document.body.appendChild(panel);

    // 面板位置
    if (config.panelX !== null && config.panelY !== null) {
        panel.style.left = Math.max(0, Math.min(config.panelX, window.innerWidth - 380)) + 'px';
        panel.style.top = config.panelY + 'px';
        panel.style.right = 'auto';
    }

    // 根据页面类型绑定事件
    if (!isChat) {
        // 职位列表页面：绑定所有事件
        bindTabs(panel);
        bindBasicEvents();
        bindBlacklistEvents();
        bindAiEvents();
        bindWorkEvents();
    }
    restoreLog();

    // 折叠
    const collapseBtn = document.getElementById('btn-collapse-panel');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isCollapsed = panel.classList.toggle('collapsed');
            collapseBtn.textContent = isCollapsed ? '□' : '−';
            config.isCollapsed = isCollapsed;
            saveConfig();
        });
    }

    // 保存配置（数据已自动保存，此按钮提供确认反馈）
    const saveBtn = document.getElementById('btn-save-config');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // 同步UI字段到config
            const cityVal = document.getElementById('cfg-city');
            if (cityVal) config.city = cityVal.value.replace(/市$/, '').trim();
            const posVal = document.getElementById('cfg-positions');
            if (posVal) config.positions = posVal.value.trim() ? [posVal.value.trim()] : [''];
            const exTitle = document.getElementById('cfg-excludeTitle');
            if (exTitle) config.excludeTitle = exTitle.value;
            const exDesc = document.getElementById('cfg-excludeDesc');
            if (exDesc) config.excludeDesc = exDesc.value;
            const salary = document.getElementById('cfg-salaryMin');
            if (salary) config.salaryMin = salary.value;
            const maxChats = document.getElementById('cfg-maxChats');
            if (maxChats) config.maxChatsPerRun = parseInt(maxChats.value) || 0;
            await saveConfig();
            // 按钮视觉反馈
            const origText = saveBtn.textContent;
            saveBtn.textContent = '✓ 已保存';
            saveBtn.style.color = '#34c759';
            saveBtn.style.borderColor = '#a8e6cf';
            setTimeout(() => {
                saveBtn.textContent = origText;
                saveBtn.style.color = '';
                saveBtn.style.borderColor = '';
            }, 1500);
        });
    }

    // 重置配置（仅基础配置，保留AI配置和企业黑名单）
    const resetBtn = document.getElementById('btn-reset-config');
    if (resetBtn) {
        let resetClicks = 0;
        let resetTimer = null;
        resetBtn.addEventListener('click', async () => {
            resetClicks++;
            if (resetClicks === 1) {
                resetBtn.textContent = '↩ 再点一次重置';
                resetBtn.style.color = '#ff3b30';
                resetBtn.style.borderColor = '#ffcdd0';
                resetTimer = setTimeout(() => {
                    resetBtn.textContent = '↺ 重置';
                    resetBtn.style.color = '';
                    resetBtn.style.borderColor = '';
                    resetClicks = 0;
                }, 3000);
                return;
            }
            clearTimeout(resetTimer);
            resetClicks = 0;
            resetBtn.textContent = '↺ 重置';
            resetBtn.style.color = '';
            resetBtn.style.borderColor = '';

            const preserve = {
                companyBlacklist: config.companyBlacklist,
                aiMatchEnabled: config.aiMatchEnabled,
                aiModels: config.aiModels,
                activeAiModelId: config.activeAiModelId
            };
            Object.assign(config, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
            Object.assign(config, preserve);
            await saveConfig();
            // 刷新UI字段为默认值
            const cityEl = document.getElementById('cfg-city');
            if (cityEl) cityEl.value = '';
            const posEl = document.getElementById('cfg-positions');
            if (posEl) posEl.value = '';
            const exTitle = document.getElementById('cfg-excludeTitle');
            if (exTitle) exTitle.value = '';
            const exDesc = document.getElementById('cfg-excludeDesc');
            if (exDesc) exDesc.value = '';
            const salary = document.getElementById('cfg-salaryMin');
            if (salary) salary.value = '';
            const maxChats = document.getElementById('cfg-maxChats');
            if (maxChats) maxChats.value = '50';
            document.querySelectorAll('.hr-active-checkbox').forEach(cb => {
                cb.checked = ['online', 'just_active', 'today_active'].includes(cb.value);
            });
            logPrint('log-auto', '↺ 基础配置已重置为默认值', 'info');
        });
    }

    // 拖拽
    let isDragging = false, dragStartX = 0, dragStartY = 0, initLeft = 0, initTop = 60;
    const header = panel.querySelector('.boss-header');
    header.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
        const rect = panel.getBoundingClientRect(); initLeft = rect.left; initTop = rect.top;
        panel.classList.add('dragging'); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        let newLeft = initLeft + (e.clientX - dragStartX);
        let newTop = initTop + (e.clientY - dragStartY);
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 380));
        newTop = Math.max(20, Math.min(newTop, window.innerHeight - 120));
        panel.style.left = newLeft + 'px'; panel.style.top = newTop + 'px'; panel.style.right = 'auto';
        e.preventDefault();
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return; isDragging = false; panel.classList.remove('dragging');
        const rect = panel.getBoundingClientRect(); config.panelX = Math.round(rect.left); config.panelY = Math.round(rect.top);
        saveConfig();
    });

    if (config.isCollapsed) { panel.classList.add('collapsed'); collapseBtn.textContent = '□'; }
};

// 导出（非枚举）
const BossUI = { injectStyle, injectUI };

if (!window.BossUI) {
    Object.defineProperty(window, 'BossUI', {
        value: BossUI, enumerable: false, configurable: false, writable: false
    });
}
