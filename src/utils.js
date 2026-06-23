// ==========================================
// BOSS直聘 AI海投助手 - 工具函数模块
// 防检测优化版：消除console泄露，改进人类行为模拟
// ==========================================

// --- 安全日志系统（不输出到浏览器控制台） ---
const __bossLogBuffer = [];
let __bossDebugMode = false;

// --- 即时停止（AbortController） ---
let __bossAbortController = new AbortController();
const getAbortSignal = () => __bossAbortController.signal;
const requestAbort = () => __bossAbortController.abort();
const resetAbort = () => { __bossAbortController = new AbortController(); };
const isAborted = () => __bossAbortController.signal.aborted;

/**
 * 安全日志 - 仅存入缓冲区，不输出到控制台
 * 开启调试模式时可通过 __bossGetLogs() 获取
 */
const safeLog = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    __bossLogBuffer.push({ time: Date.now(), msg });
    // 限制缓冲区大小
    if (__bossLogBuffer.length > 500) __bossLogBuffer.shift();
    // 仅在调试模式下输出到控制台
    if (__bossDebugMode) {
        console.log('[BOSS-DEBUG]', msg);
    }
};

/**
 * 获取日志缓冲区内容
 */
const getLogs = () => __bossLogBuffer.map(e => `[${new Date(e.time).toLocaleTimeString()}] ${e.msg}`).join('\n');

/**
 * 开启/关闭调试模式
 */
const setDebugMode = (enabled) => { __bossDebugMode = !!enabled; };

// --- 行为配置文件系统（架构4.1） ---
/**
 * 生成或加载行为配置文件
 * 每个用户有独特的行为参数，增加批量检测难度
 * 使用正态分布生成更真实的参数组合
 */
const __behaviorProfile = {
    // 基础操作速度：快(0.7) / 中(1.0) / 慢(1.4)
    speedFactor: 1.0,
    // 打字速度因子
    typingFactor: 1.0,
    // 注意力集中度：影响停顿频率 (0.5=容易走神, 1.5=高度集中)
    attentionFactor: 1.0,
    // 浏览习惯：0.5=快速扫视, 1.5=仔细阅读
    browsingFactor: 1.0,
    // 疲劳累积（随运行时间增长）
    fatigueLevel: 0,
    // 会话开始时间
    sessionStart: Date.now(),
    // 鼠标精确度（影响微抖动幅度）
    mousePrecision: 1.0,
    // 打字错误率基数（受疲劳影响会增加）
    typoRate: 0.05
};

/**
 * 初始化行为配置文件（从storage加载或生成新的）
 * 使用正态分布生成更真实的参数组合
 */
const initBehaviorProfile = async () => {
    try {
        const result = await chrome.storage.local.get('_behaviorProfile');
        if (result._behaviorProfile) {
            Object.assign(__behaviorProfile, result._behaviorProfile);
            __behaviorProfile.sessionStart = Date.now();
            __behaviorProfile.fatigueLevel = 0;
        } else {
            // 使用正态分布生成更真实的参数组合
            // 人类的各项能力之间存在相关性
            const baseFactor = gaussianRandom() * 0.2; // 基础能力因子

            // 速度和打字相关（相关系数约0.6）
            __behaviorProfile.speedFactor = Math.max(0.6, Math.min(1.5,
                1.0 + baseFactor * 0.6 + gaussianRandom() * 0.15));
            __behaviorProfile.typingFactor = Math.max(0.7, Math.min(1.4,
                1.0 + baseFactor * 0.5 + gaussianRandom() * 0.12));

            // 注意力和浏览习惯相关（相关系数约0.4）
            const attentionBase = gaussianRandom() * 0.2;
            __behaviorProfile.attentionFactor = Math.max(0.5, Math.min(1.5,
                1.0 + attentionBase * 0.5 + gaussianRandom() * 0.18));
            __behaviorProfile.browsingFactor = Math.max(0.5, Math.min(1.5,
                1.0 + attentionBase * 0.4 + gaussianRandom() * 0.2));

            // 鼠标精确度（与速度负相关）
            __behaviorProfile.mousePrecision = Math.max(0.6, Math.min(1.4,
                1.0 - baseFactor * 0.3 + gaussianRandom() * 0.15));

            // 打字错误率（与精确度负相关）
            __behaviorProfile.typoRate = Math.max(0.02, Math.min(0.12,
                0.05 - (__behaviorProfile.mousePrecision - 1.0) * 0.1 + gaussianRandom() * 0.02));

            await chrome.storage.local.set({ _behaviorProfile: __behaviorProfile });
        }
    } catch (e) {
        // storage不可用时使用默认值
    }
};

/**
 * 获取当前疲劳因子（随运行时间增长）
 * 疲劳模型改进：非线性增长 + 波动 + 个体差异
 * 特点：
 * - 初期增长缓慢，中期加速，后期趋缓（对数曲线）
 * - 叠加正弦波动（模拟注意力周期）
 * - 个体差异通过 behaviorProfile 调整
 */
const getFatigueFactor = () => {
    const elapsed = (Date.now() - __behaviorProfile.sessionStart) / 60000; // 分钟

    // 基础疲劳：对数增长，最多增加40%
    // 使用 log(1 + x) 实现初期慢、后期快的增长
    const baseFatigue = Math.min(0.4, 0.15 * Math.log(1 + elapsed / 20));

    // 注意力周期波动（约90分钟一个周期，模拟人类的 ultradian rhythm）
    const cyclePhase = (elapsed % 90) / 90 * Math.PI * 2;
    const cycleFactor = Math.sin(cyclePhase) * 0.05; // ±5% 波动

    // 个体差异：注意力因子高的用户疲劳增长更慢
    const individualFactor = 1.2 - __behaviorProfile.attentionFactor * 0.2;

    // 最终疲劳因子（1.0 = 无疲劳，1.4 = 最大疲劳）
    const fatigue = 1.0 + (baseFatigue + cycleFactor) * individualFactor;

    return Math.max(1.0, Math.min(1.4, fatigue));
};

// --- 核心工具函数 ---

/**
 * 延迟执行（带随机化）
 */
const sleep = (ms) => {
    const jitter = ms * 0.1;
    const actualMs = ms + (Math.random() * jitter * 2 - jitter);
    return new Promise(resolve => setTimeout(resolve, Math.max(50, actualMs)));
};

/**
 * 高斯随机数生成器（Box-Muller 变换）
 */
const gaussianRandom = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

/**
 * 对数正态分布随机数生成器
 * 更符合人类反应时间的分布特征（右偏，长尾）
 * @param {number} mu - 对数均值
 * @param {number} sigma - 对数标准差
 */
const logNormalRandom = (mu = 0, sigma = 1) => {
    const z = gaussianRandom();
    return Math.exp(mu + sigma * z);
};

/**
 * 混合分布随机延迟（改进版3.0）
 * 更符合人类行为的统计特征：
 * - 70% 正态分布（正常操作）
 * - 15% 对数正态分布（偶尔的长尾延迟，模拟分心）
 * - 10% 均匀分布（快速连贯操作）
 * - 5% 极端值（罕见的长时间停顿，模拟看手机/喝水）
 */
const generateHumanDelay = (avg, stdDev) => {
    const rand = Math.random();

    if (rand < 0.05) {
        // 5% 极端值：罕见的长时间停顿（2-5倍平均值）
        const extremeFactor = 2.0 + Math.random() * 3.0;
        return Math.round(avg * extremeFactor + Math.abs(gaussianRandom()) * stdDev * 0.5);
    } else if (rand < 0.15) {
        // 10% 快速连贯操作（20%-50%平均值）
        const fastFactor = 0.2 + Math.random() * 0.3;
        return Math.round(avg * fastFactor + Math.abs(gaussianRandom()) * stdDev * 0.2);
    } else if (rand < 0.30) {
        // 15% 对数正态分布（长尾延迟，模拟分心/思考）
        const logNormal = logNormalRandom(Math.log(avg * 0.8), 0.4);
        return Math.round(Math.min(logNormal, avg * 3.5));
    } else {
        // 70% 正态分布（正常操作）
        const g = gaussianRandom();
        return Math.round(avg + g * stdDev);
    }
};

/**
 * 人类化延迟 - 混合分布（架构3.0）
 * 改进点：
 * - 对数正态分布模拟人类反应时间
 * - 疲劳和注意力因子影响
 * - 反应时间变异系数动态调整
 * @param {number} avg - 平均延迟ms
 * @param {number} stdDev - 标准差ms
 */
const humanSleep = (avg = 1000, stdDev = 300) => {
    const signal = __bossAbortController.signal;
    // 已中止则立即返回
    if (signal.aborted) return Promise.resolve();

    // 应用行为配置文件的速度因子
    const speedFactor = __behaviorProfile.speedFactor;
    const fatigueFactor = getFatigueFactor();
    const attentionFactor = __behaviorProfile.attentionFactor;

    // 注意力因子影响标准差（注意力低时变异更大）
    const adjustedStdDev = stdDev * (1.5 - attentionFactor * 0.5);

    // 疲劳时平均延迟增加
    const adjustedAvg = avg * speedFactor * fatigueFactor;

    let delay = generateHumanDelay(adjustedAvg, adjustedStdDev);

    // 限制范围：最小100ms，最大5倍平均值
    delay = Math.max(100, Math.min(delay, adjustedAvg * 5));

    // Promise.race: abort时立即返回，无需轮询
    const timer = new Promise(resolve => {
        const id = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, delay);
        const onAbort = () => { clearTimeout(id); resolve(); };
        signal.addEventListener('abort', onAbort, { once: true });
    });
    return timer;
};

/**
 * 生成随机整数
 */
const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 查询单个元素（支持多个选择器）
 */
const qs = (selectors, parent = document) => {
    for (const sel of selectors) {
        try {
            const el = parent.querySelector(sel);
            if (el) return el;
        } catch (e) {
            // 静默处理选择器错误
        }
    }
    return null;
};

/**
 * 查询多个元素（支持多个选择器）
 */
const qsa = (selectors, parent = document) => {
    for (const sel of selectors) {
        try {
            const els = parent.querySelectorAll(sel);
            if (els && els.length > 0) return Array.from(els);
        } catch (e) {
            // 静默处理选择器错误
        }
    }
    return [];
};

/**
 * 创建伪造的 InputDeviceCapabilities 对象（模拟真实鼠标设备）
 * Chrome 反检测会检查 event.sourceCapabilities 是否为 null
 */
let __fakeMouseCapabilities = null;
const __getMouseCapabilities = () => {
    if (__fakeMouseCapabilities) return __fakeMouseCapabilities;
    try {
        // 优先使用原生 API
        if (typeof InputDeviceCapabilities !== 'undefined') {
            __fakeMouseCapabilities = new InputDeviceCapabilities({ firesTouchEvents: false });
        } else {
            // 回退：创建一个 duck-typing 对象
            __fakeMouseCapabilities = { firesTouchEvents: false };
        }
    } catch (e) {
        __fakeMouseCapabilities = { firesTouchEvents: false };
    }
    return __fakeMouseCapabilities;
};

/**
 * 补全鼠标事件属性
 * 保持属性间的逻辑一致性，注入 sourceCapabilities
 */
const createMouseEvent = (type, x, y, extra = {}) => {
    const EventClass = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    const evt = new EventClass(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        screenX: x + (window.screenX || 0),
        screenY: y + (window.screenY || 0),
        movementX: extra.movementX || 0,
        movementY: extra.movementY || 0,
        detail: extra.detail || 0,
        button: extra.button || 0,
        buttons: extra.buttons || 0,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        pointerType: 'mouse',
        isPrimary: true
    });

    // 注入 sourceCapabilities（Chrome 检测点：真实事件有此属性，伪造事件为 null）
    try {
        Object.defineProperty(evt, 'sourceCapabilities', {
            get: () => __getMouseCapabilities(),
            configurable: true
        });
    } catch (e) { /* ignore */ }

    return evt;
};

/**
 * 运行日志持久化
 */
const __RUN_LOG_KEY = '_runLogs';
const __RUN_LOG_MAX = 200;  // 最多保存200条日志
let __runLogs = [];

/**
 * 保存运行日志到storage
 */
const saveRunLogs = async () => {
    try {
        await chrome.storage.local.set({ [__RUN_LOG_KEY]: __runLogs });
    } catch (e) { safeLog('saveRunLogs失败: ' + e.message); }
};

/**
 * 加载运行日志（从storage恢复）
 */
const loadRunLogs = async () => {
    try {
        const result = await chrome.storage.local.get(__RUN_LOG_KEY);
        if (result[__RUN_LOG_KEY]) {
            __runLogs = result[__RUN_LOG_KEY];
        }
    } catch (e) { safeLog('loadRunLogs失败: ' + e.message); }
};

/**
 * 恢复运行日志到页面
 */
const restoreRunLogs = () => {
    const el = document.getElementById('log-auto');
    if (!el || __runLogs.length === 0) return;
    const colorMap = { success: '#10b981', skip: '#f59e0b', fail: '#ef4444', info: '#6b7280' };
    __runLogs.forEach(log => {
        const color = colorMap[log.type] || '#a9b1d6';
        if (log.html) {
            el.insertAdjacentHTML('beforeend', `<div>[${log.time}] ${log.html}</div>`);
        } else {
            el.insertAdjacentHTML('beforeend', `<div style="color:${color}">[${log.time}] ${log.message}</div>`);
        }
    });
    el.scrollTop = el.scrollHeight;
};

/**
 * 清除运行日志
 */
const clearRunLogs = async () => {
    __runLogs = [];
    try {
        await chrome.storage.local.remove(__RUN_LOG_KEY);
    } catch (e) { safeLog('clearRunLogs失败: ' + e.message); }
};

/**
 * 添加运行日志条目
 */
let __saveRunLogsTimer = null;
const addRunLog = (message, type = '', html = null) => {
    __runLogs.push({
        time: new Date().toLocaleTimeString(),
        message: message,
        type: type,
        html: html
    });
    // 限制日志数量
    while (__runLogs.length > __RUN_LOG_MAX) {
        __runLogs.shift();
    }
    // 防抖保存：1秒内的多次日志合并为一次写入
    if (__saveRunLogsTimer) clearTimeout(__saveRunLogsTimer);
    __saveRunLogsTimer = setTimeout(() => {
        __saveRunLogsTimer = null;
        saveRunLogs();
    }, 1000);
};

/**
 * 日志输出到面板（不输出到控制台）
 * @param {string} elementId - 日志容器ID
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型: 'success'|'skip'|'fail'|'info'|''
 */
const logPrint = (elementId, message, type = '') => {
    const el = document.getElementById(elementId);
    const colorMap = { success: '#10b981', skip: '#f59e0b', fail: '#ef4444', info: '#6b7280' };
    const color = colorMap[type] || '#a9b1d6';

    // 保存到持久化日志
    addRunLog(message, type);

    if (!el) return;
    el.insertAdjacentHTML('beforeend', `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${message}</div>`);
    el.scrollTop = el.scrollHeight;
    safeLog(message);
};

/**
 * 日志输出（支持HTML内容，用于彩色文字）
 */
const logPrintHTML = (elementId, html) => {
    const el = document.getElementById(elementId);

    // 保存到持久化日志
    addRunLog('', '', html);

    if (!el) return;
    el.insertAdjacentHTML('beforeend', `<div>[${new Date().toLocaleTimeString()}] ${html}</div>`);
    el.scrollTop = el.scrollHeight;
};

/**
 * 安全获取元素文本
 */
const getElementText = (el) => {
    if (!el) return '';
    return (el.innerText || el.textContent || '').trim();
};

/**
 * HTML转义（防XSS）
 */
const escapeHtml = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/**
 * 防抖函数
 */
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * 休息机制（架构4.2）
 * 模拟人类休息行为
 */
const __restState = {
    chatCount: 0,
    lastRestTime: Date.now(),
    isResting: false
};

/**
 * 检查是否需要休息（改进版 - 概率触发 + 疲劳影响）
 * @param {number} chatCount - 当前沟通次数
 * @returns {Promise<boolean>} 是否进入了休息状态
 */
const checkAndRest = async (chatCount) => {
    __restState.chatCount = chatCount;
    const now = Date.now();
    const timeSinceLastRest = now - __restState.lastRestTime;

    // 疲劳因子影响休息概率（疲劳时更容易休息）
    const fatigueFactor = getFatigueFactor();
    const restProbabilityMultiplier = 1.0 + (fatigueFactor - 1.0) * 2; // 疲劳时概率翻倍

    // 短休息：基于概率触发，非固定周期
    // 基础概率：每次操作5%，最低间隔60秒
    const shortRestProb = 0.05 * restProbabilityMultiplier;
    if (chatCount > 2 && timeSinceLastRest > 60000 && Math.random() < shortRestProb) {
        const restDuration = randomInt(20000, 50000);
        safeLog(`休息一下... ${(restDuration / 1000).toFixed(0)}秒后继续`);
        __restState.isResting = true;

        // 休息期间偶尔移动鼠标（"人在但没操作"）
        const restEnd = Date.now() + restDuration;
        while (Date.now() < restEnd) {
            await humanSleep(5000, 2000);
            if (Math.random() < 0.3) {
                const x = randomInt(100, window.innerWidth - 100);
                const y = randomInt(100, window.innerHeight - 100);
                BossAntiDetection.trustedDispatchEvent(document, createMouseEvent('mousemove', x, y));
            }
            // 偶尔切换焦点（模拟切走再切回）
            if (Math.random() < 0.1) {
                BossAntiDetection.trustedDispatchEvent(window, new Event('blur'));
                BossAntiDetection.trustedDispatchEvent(document, new Event('visibilitychange'));
                await humanSleep(randomInt(1000, 5000), 500);
                BossAntiDetection.trustedDispatchEvent(window, new Event('focus'));
                BossAntiDetection.trustedDispatchEvent(document, new Event('visibilitychange'));
            }
        }

        __restState.isResting = false;
        __restState.lastRestTime = Date.now();
        return true;
    }

    // 长休息：基于概率触发，最低间隔5分钟
    // 基础概率：每次操作2%，疲劳时最高6%
    const longRestProb = 0.02 * restProbabilityMultiplier;
    if (chatCount > 5 && timeSinceLastRest > 300000 && Math.random() < longRestProb) {
        const restDuration = randomInt(120000, 180000);
        safeLog(`长休息... ${(restDuration / 60000).toFixed(1)}分钟后继续`);
        __restState.isResting = true;

        const restEnd = Date.now() + restDuration;
        while (Date.now() < restEnd) {
            await humanSleep(8000, 3000);
            if (Math.random() < 0.2) {
                const x = randomInt(100, window.innerWidth - 100);
                const y = randomInt(100, window.innerHeight - 100);
                BossAntiDetection.trustedDispatchEvent(document, createMouseEvent('mousemove', x, y));
            }
        }

        __restState.isResting = false;
        __restState.lastRestTime = Date.now();
        return true;
    }

    // 偶尔插入异常长停顿（模拟看手机、喝水）
    // 基础概率：每次操作3%，最低间隔30秒
    const microPauseProb = 0.03 * restProbabilityMultiplier;
    if (chatCount > 1 && timeSinceLastRest > 30000 && Math.random() < microPauseProb) {
        const pauseDuration = randomInt(5000, 15000);
        safeLog(`短暂离开...`);
        await new Promise(r => setTimeout(r, pauseDuration));
        return true;
    }

    return false;
};

/**
 * 检测自测机制（架构4.3）
 * 检查是否被风控标记
 */
const detectRiskSignals = () => {
    const signals = [];

    // 1. 检查验证码
    const captchaSelectors = [
        '[class*=captcha]', '[class*=verify]', '[id*=captcha]',
        '[class*=slider]', '[class*=geetest]', '[class*=verify-wrap]',
        'iframe[src*=captcha]', 'iframe[src*=verify]'
    ];
    for (const sel of captchaSelectors) {
        if (document.querySelector(sel)) {
            signals.push({ type: 'captcha', selector: sel });
            break;
        }
    }

    // 2. 检查安全提示
    const securityTexts = ['验证', '异常', '频繁', '风控', '安全检测', '请完成验证', '人机'];
    const allText = document.body.innerText || '';
    for (const text of securityTexts) {
        if (allText.includes(text)) {
            // 排除正常页面内容中的匹配
            const elements = document.querySelectorAll('div, span, p, h1, h2, h3');
            for (const el of elements) {
                const elText = el.innerText || '';
                if (elText.includes(text) && elText.length < 100) {
                    signals.push({ type: 'security_warning', text: text, element: el.tagName });
                    break;
                }
            }
        }
    }

    // 3. 检查navigator.webdriver是否被重设
    if (navigator.webdriver) {
        signals.push({ type: 'webdriver', detail: 'navigator.webdriver is true' });
    }

    // 4. 检查页面是否被重定向到验证页面
    if (location.href.includes('verify') || location.href.includes('captcha') || location.href.includes('safe')) {
        signals.push({ type: 'redirect', url: location.href });
    }

    return signals;
};

/**
 * 处理检测到的风险信号
 * @returns {boolean} 是否应该暂停操作
 */
const handleRiskSignals = () => {
    const signals = detectRiskSignals();
    if (signals.length === 0) return false;

    const hasHighRisk = signals.some(s =>
        s.type === 'captcha' || s.type === 'redirect' ||
        (s.type === 'security_warning' && (s.text === '验证' || s.text === '风控' || s.text === '安全检测'))
    );

    if (hasHighRisk) {
        safeLog('检测到高风险信号，暂停操作并等待...');
        return true;
    }

    return false;
};

// --- 会话级已处理岗位恢复 ---

/**
 * 加载已处理岗位集合（从storage恢复）
 */
const __processedJobs = new Set();
const __PROCESSED_STORAGE_KEY = '_processedJobs';
const __PROCESSED_MAX = 500;

const loadProcessedJobs = async () => {
    try {
        const result = await chrome.storage.local.get(__PROCESSED_STORAGE_KEY);
        if (result[__PROCESSED_STORAGE_KEY]) {
            result[__PROCESSED_STORAGE_KEY].forEach(id => __processedJobs.add(id));
        }
    } catch (e) { safeLog('loadProcessedJobs失败: ' + e.message); }
};

/**
 * 标记岗位已处理
 */
let __saveProcessedTimer = null;
const markJobProcessed = (jobKey) => {
    __processedJobs.add(jobKey);
    // FIFO淘汰
    if (__processedJobs.size > __PROCESSED_MAX) {
        const first = __processedJobs.values().next().value;
        __processedJobs.delete(first);
    }
    // 防抖保存：2秒内的多次标记合并为一次写入
    if (__saveProcessedTimer) clearTimeout(__saveProcessedTimer);
    __saveProcessedTimer = setTimeout(async () => {
        __saveProcessedTimer = null;
        try {
            await chrome.storage.local.set({
                [__PROCESSED_STORAGE_KEY]: Array.from(__processedJobs)
            });
        } catch (e) { safeLog('saveProcessedJobs失败: ' + e.message); }
    }, 2000);
};

/**
 * 检查岗位是否已处理
 */
const isJobProcessed = (jobKey) => __processedJobs.has(jobKey);

// --- AI匹配结果缓存 ---

const __aiMatchCache = {};
const __AI_CACHE_KEY = '_aiMatchCache';
const __AI_CACHE_MAX = 200;

const loadAiMatchCache = async () => {
    try {
        const result = await chrome.storage.local.get(__AI_CACHE_KEY);
        if (result[__AI_CACHE_KEY]) {
            const now = Date.now();
            for (const [k, v] of Object.entries(result[__AI_CACHE_KEY])) {
                __aiMatchCache[k] = { value: v, lastAccess: now };
            }
        }
    } catch (e) { safeLog('loadAiMatchCache失败: ' + e.message); }
};

const getCachedAiMatch = (cacheKey) => {
    const entry = __aiMatchCache[cacheKey];
    if (entry) entry.lastAccess = Date.now();
    return entry ? entry.value : null;
};

let __saveAiCacheTimer = null;
const setCachedAiMatch = (cacheKey, result) => {
    __aiMatchCache[cacheKey] = { value: result, lastAccess: Date.now() };
    // LRU淘汰：删除最久未访问的条目
    const keys = Object.keys(__aiMatchCache);
    if (keys.length > __AI_CACHE_MAX) {
        const oldest = keys.reduce((a, b) =>
            (__aiMatchCache[a].lastAccess || 0) < (__aiMatchCache[b].lastAccess || 0) ? a : b
        );
        delete __aiMatchCache[oldest];
    }
    // 防抖保存：3秒内的多次缓存更新合并为一次写入
    if (__saveAiCacheTimer) clearTimeout(__saveAiCacheTimer);
    __saveAiCacheTimer = setTimeout(async () => {
        __saveAiCacheTimer = null;
        try {
            // 序列化时还原为纯值
            const plainCache = {};
            for (const [k, v] of Object.entries(__aiMatchCache)) {
                plainCache[k] = v.value;
            }
            await chrome.storage.local.set({ [__AI_CACHE_KEY]: plainCache });
        } catch (e) { safeLog('saveAiMatchCache失败: ' + e.message); }
    }, 3000);
};

// --- 统计数据持久化 ---

const __STATS_KEY = '_persistentStats';

const loadStats = async () => {
    try {
        const result = await chrome.storage.local.get(__STATS_KEY);
        if (result[__STATS_KEY]) {
            return result[__STATS_KEY];
        }
    } catch (e) { safeLog('loadStats失败: ' + e.message); }
    return null;
};

const saveStats = async (stats) => {
    try {
        await chrome.storage.local.set({ [__STATS_KEY]: stats });
    } catch (e) { safeLog('saveStats失败: ' + e.message); }
};

// 导出工具函数（通过非枚举的单一命名空间，避免多个全局变量暴露）
const BossUtils = {
    // 日志
    safeLog, getLogs, setDebugMode,
    // 即时停止
    requestAbort, resetAbort, isAborted, getAbortSignal,
    // 行为配置
    initBehaviorProfile, getFatigueFactor,
    // 延迟
    sleep, humanSleep, gaussianRandom, logNormalRandom, generateHumanDelay, randomInt,
    // DOM操作
    qs, qsa,
    // 事件模拟
    createMouseEvent,
    // 工具
    logPrint, logPrintHTML, getElementText, escapeHtml, debounce,
    // 运行日志持久化
    loadRunLogs, restoreRunLogs, clearRunLogs,
    // 休息机制
    checkAndRest,
    // 风险检测
    detectRiskSignals, handleRiskSignals,
    // 会话恢复
    loadProcessedJobs, markJobProcessed, isJobProcessed,
    // AI缓存
    loadAiMatchCache, getCachedAiMatch, setCachedAiMatch,
    // 统计持久化
    loadStats, saveStats,
    // 内部状态
    __behaviorProfile, __restState
};

// 使用 Symbol 作为键挂载（Object.getOwnPropertyNames 无法发现 Symbol）
const __BOSS_UTILS_KEY = Symbol.for('__boss_utils__');
if (!window[__BOSS_UTILS_KEY]) {
    Object.defineProperty(window, __BOSS_UTILS_KEY, {
        value: BossUtils,
        enumerable: false,
        configurable: false,
        writable: false
    });
    // 兼容旧引用（逐步迁移）
    if (!window.BossUtils) {
        Object.defineProperty(window, 'BossUtils', {
            value: BossUtils,
            enumerable: false,
            configurable: false,
            writable: false
        });
    }
}
