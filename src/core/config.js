// ==========================================
// BOSS直聘 AI海投助手 - 配置管理模块
// 防检测优化版：移除console输出
// ==========================================

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
    // 基础配置
    city: '',
    positions: [''],
    excludeTitle: '',
    excludeDesc: '',
    salaryMin: '',
    hrActiveFilter: ['online', 'just_active', 'today_active'],
    maxChatsPerRun: 50,

    // 企业黑名单
    companyBlacklist: [],

    // 工作经历配置（供AI深度匹配使用）
    workSkills: '',        // 工作技能简述
    workExperience: '',    // 工作经历简述
    otherRequirements: '', // 其它要求/附加要求

    // AI配置 - 支持多模型
    aiMatchEnabled: false,
    aiModels: [
        { id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1/chat/completions', apiKey: '', model: 'deepseek-chat' }
    ],
    activeAiModelId: 'deepseek',

    // 面板状态
    panelX: null,
    panelY: null,
    isCollapsed: false
};

/**
 * 存储键名列表
 */
const STORAGE_KEYS = [
    'city', 'positions', 'excludeTitle', 'excludeDesc',
    'salaryMin', 'hrActiveFilter', 'maxChatsPerRun',
    'companyBlacklist',
    'workSkills', 'workExperience', 'otherRequirements',
    'aiMatchEnabled', 'aiModels', 'activeAiModelId',
    'panelX', 'panelY', 'isCollapsed'
];

/**
 * HR活跃状态选项
 */
const HR_ACTIVE_OPTIONS = [
    { value: 'online', label: '在线', description: '当前在线的HR' },
    { value: 'just_active', label: '刚刚活跃', description: '刚刚活跃过的HR' },
    { value: 'today_active', label: '今日活跃', description: '今天活跃过的HR' },
    { value: '3day_active', label: '3日内活跃', description: '3天内活跃过的HR' },
    { value: '7day_active', label: '本周活跃', description: '本周内活跃过的HR' }
];

/**
 * 当前配置对象
 */
let config = { ...DEFAULT_CONFIG };

/**
 * 应用状态
 */
let state = {
    autoRunning: false,
    currentPosIndex: 0,
    positionDone: [],
    positionExhausted: [],
    chatCountThisPos: 0,
    stats: { scanned: 0, chatted: 0, skipped: 0 }
};

/**
 * 加载配置
 */
const loadConfig = async () => {
    try {
        const saved = await chrome.storage.local.get(STORAGE_KEYS);
        STORAGE_KEYS.forEach(key => {
            if (saved[key] !== undefined) {
                config[key] = saved[key];
            }
        });
        config.aiMatchEnabled = !!config.aiMatchEnabled;

        if (saved.excludeKw && !saved.excludeTitle) {
            config.excludeTitle = saved.excludeKw;
        }
    } catch (e) {
        BossUtils.safeLog('加载配置失败: ' + (e.message || e));
    }
};

/**
 * 立即保存配置（同步写入，用于关键操作如导入配置）
 */
const saveConfigImmediate = async () => {
    if (__saveConfigTimer) {
        clearTimeout(__saveConfigTimer);
        __saveConfigTimer = null;
    }
    const data = {};
    STORAGE_KEYS.forEach(key => {
        data[key] = config[key];
    });
    try {
        await chrome.storage.local.set(data);
    } catch (e) {
        BossUtils.safeLog('保存配置失败: ' + (e.message || e));
    }
};

/**
 * 保存配置（防抖：300ms内的多次保存合并为一次写入，用于UI输入）
 */
let __saveConfigTimer = null;
const saveConfig = () => {
    if (__saveConfigTimer) clearTimeout(__saveConfigTimer);
    __saveConfigTimer = setTimeout(async () => {
        __saveConfigTimer = null;
        await saveConfigImmediate();
    }, 300);
};

/**
 * 保存日志
 */
const saveLog = async () => {
    try {
        const logEl = document.getElementById('log-auto');
        if (logEl && logEl.innerHTML) {
            await chrome.storage.local.set({ '_savedLog': logEl.innerHTML });
        }
    } catch (e) {
        BossUtils.safeLog('保存日志失败: ' + (e.message || e));
    }
};

/**
 * 恢复日志
 */
const restoreLog = () => {
    chrome.storage.local.get('_savedLog').then(result => {
        if (result._savedLog) {
            const logEl = document.getElementById('log-auto');
            if (logEl) {
                logEl.innerHTML = result._savedLog;
                logEl.scrollTop = logEl.scrollHeight;
            }
            chrome.storage.local.remove('_savedLog');
        }
    }).catch(() => {});
};

/**
 * 更新统计显示
 */
const updateStats = () => {
    const { stats } = state;
    const elements = {
        'stat-scanned': stats.scanned,
        'stat-chatted': stats.chatted,
        'stat-skipped': stats.skipped
    };

    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
};

/**
 * 获取当前岗位关键词
 */
const getPosKw = () => {
    const positions = config.positions || [''];
    let index = state.currentPosIndex;
    if (index < 0 || index >= positions.length) index = 0;

    // 兼容新旧格式：
    // 新格式：['前端开发、web前端'] - 单个字符串包含多个关键词
    // 旧格式：['前端开发', 'web前端'] - 多个独立关键词
    if (positions.length > 1) {
        // 旧格式：直接返回整个数组作为关键词列表
        return positions.filter(k => k).map(k => k.toLowerCase());
    }

    return (positions[index] || '')
        .split(/[,，、\s]+/)
        .filter(k => k)
        .map(k => k.toLowerCase());
};

/**
 * 获取当前岗位完整文本
 */
const getFirstKw = () => {
    const positions = config.positions || [''];
    let index = state.currentPosIndex;
    if (index < 0 || index >= positions.length) index = 0;
    return (positions[index] || '').trim();
};

/**
 * 清除自动投递状态
 */
const clearAutoState = async () => {
    try {
        await chrome.storage.local.remove([
            '_autoResume', '_posIdx', '_stats', '_posDone', '_posExhausted'
        ]);
    } catch (e) {
        BossUtils.safeLog('清除状态失败: ' + (e.message || e));
    }
};

/**
 * 构建搜索URL
 */
const buildSearchUrl = (keyword) => {
    let url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(keyword)}`;
    const city = config.city ? config.city.trim() : '';

    if (city) {
        const code = CITY_CODES[city];
        if (code) {
            url += '&city=' + code;
        }
    }

    return url;
};

/**
 * 检查HR活跃状态
 */
const checkHrActiveFilter = (activeText) => {
    const filters = config.hrActiveFilter || [];

    // 未设置筛选条件，全部通过
    if (filters.length === 0) return true;

    // 找不到活跃信息，跳过
    if (!activeText) return false;

    const text = activeText.trim().toLowerCase();

    return filters.some(filter => {
        switch (filter) {
            case 'online':
                return text.includes('在线');
            case 'just_active':
                return text.includes('刚刚活跃') || text.includes('在线');
            case 'today_active':
                return text.includes('今日活跃') || text.includes('今天') ||
                       text.includes('在线') || text.includes('刚刚活跃');
            case '3day_active':
                if (text.includes('在线') || text.includes('刚刚活跃') || text.includes('今日活跃')) return true;
                const age3 = parsePostAge(activeText);
                return age3 !== null && age3 <= 3;
            case '7day_active':
                if (text.includes('在线') || text.includes('刚刚活跃') || text.includes('今日活跃')) return true;
                if (text.includes('本周')) return true;
                const age7 = parsePostAge(activeText);
                return age7 !== null && age7 <= 7;
            default:
                return true;
        }
    });
};

/**
 * 获取当前激活的AI模型配置
 */
const getActiveAiModel = () => {
    const models = config.aiModels || [];
    const activeId = config.activeAiModelId || 'deepseek';
    return models.find(m => m.id === activeId) || models[0] || DEFAULT_CONFIG.aiModels[0];
};

/**
 * 检查公司名是否在黑名单中
 * @param {string} companyName - 公司名或卡片全文
 * @returns {boolean} true=在黑名单中，应跳过
 */
const checkCompanyBlacklist = (text) => {
    const blacklist = config.companyBlacklist || [];
    if (blacklist.length === 0 || !text) return false;
    const lowerText = text.toLowerCase();
    return blacklist.some(kw => lowerText.includes(kw.toLowerCase()));
};

/**
 * 添加公司到黑名单
 */
const addCompanyToBlacklist = async (keyword) => {
    const kw = keyword.trim();
    if (!kw) return;
    if (!config.companyBlacklist) config.companyBlacklist = [];
    if (!config.companyBlacklist.includes(kw)) {
        config.companyBlacklist.push(kw);
        await saveConfigImmediate();
    }
};

/**
 * 从黑名单移除公司
 */
const removeCompanyFromBlacklist = async (keyword) => {
    if (!config.companyBlacklist) return;
    config.companyBlacklist = config.companyBlacklist.filter(kw => kw !== keyword);
    await saveConfigImmediate();
};

/**
 * 导出所有配置为JSON字符串
 * @returns {string} JSON字符串
 */
const exportConfig = () => {
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        config: {}
    };

    // 导出所有配置项
    STORAGE_KEYS.forEach(key => {
        exportData.config[key] = config[key];
    });

    return JSON.stringify(exportData, null, 2);
};

/**
 * 导入配置
 * @param {string} jsonString - JSON配置字符串
 * @returns {{success: boolean, message: string}} 导入结果
 */
const importConfig = async (jsonString) => {
    try {
        const importData = JSON.parse(jsonString);

        // 验证格式
        if (!importData.config) {
            return { success: false, message: '配置文件格式错误：缺少config字段' };
        }

        // 验证版本（可选）
        if (importData.version && parseFloat(importData.version) > 2.0) {
            return { success: false, message: '配置文件版本过高，请更新插件' };
        }

        // 导入配置
        const importedKeys = Object.keys(importData.config);
        let importedCount = 0;

        importedKeys.forEach(key => {
            if (STORAGE_KEYS.includes(key)) {
                config[key] = importData.config[key];
                importedCount++;
            }
        });

        // 保存到storage
        await saveConfigImmediate();

        return {
            success: true,
            message: `成功导入 ${importedCount} 项配置`
        };
    } catch (e) {
        return {
            success: false,
            message: '配置文件解析失败：' + e.message
        };
    }
};

/**
 * 获取所有配置项的键名列表
 * @returns {string[]} 配置项键名数组
 */
const getStorageKeys = () => STORAGE_KEYS;

// 导出配置模块（非枚举）
const BossConfig = {
    DEFAULT_CONFIG,
    STORAGE_KEYS,
    HR_ACTIVE_OPTIONS,
    config,
    state,
    loadConfig,
    saveConfig,
    saveConfigImmediate,
    saveLog,
    restoreLog,
    updateStats,
    getPosKw,
    getFirstKw,
    clearAutoState,
    buildSearchUrl,
    checkHrActiveFilter,
    getActiveAiModel,
    checkCompanyBlacklist,
    addCompanyToBlacklist,
    removeCompanyFromBlacklist,
    exportConfig,
    importConfig,
    getStorageKeys
};

if (!window.BossConfig) {
    Object.defineProperty(window, 'BossConfig', {
        value: BossConfig,
        enumerable: false,
        configurable: false,
        writable: false
    });
}
