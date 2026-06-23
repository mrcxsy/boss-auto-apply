// ==========================================
// BOSS直聘 AI海投助手 - 筛选逻辑模块
// 防检测优化版：Canvas指纹清理
// ==========================================

/**
 * 检查沟通按钮是否可用
 */
const isChatBtnAvailable = (btn) => {
    if (!btn) return false;
    if (btn.classList.contains('disabled') || btn.hasAttribute('disabled')) return false;
    if (btn.offsetParent === null && getComputedStyle(btn).position !== 'fixed') return false;

    const btnText = getElementText(btn);
    const hasValidText = SELECTORS.chatBtnTexts.some(t => btnText.includes(t));
    const isInvalid = btnText.includes('已沟通过') || btnText.includes('不合适');

    return hasValidText && !isInvalid;
};

/**
 * 获取沟通按钮
 */
const getChatBtn = (container) => {
    let btn = qs(SELECTORS.homeChatBtn, container);
    if (btn && isChatBtnAvailable(btn)) return btn;

    btn = qs(SELECTORS.chatBtn, container);
    if (btn && isChatBtnAvailable(btn)) return btn;

    const allLinks = container.querySelectorAll('a,button');
    for (const el of allLinks) {
        const text = getElementText(el);
        if (isChatBtnAvailable(el) && SELECTORS.chatBtnTexts.some(t => text.includes(t))) {
            return el;
        }
    }
    return null;
};

/**
 * 获取详情面板的沟通按钮
 */
const getChatBtnD = (detailBox) => {
    let btn = qs(SELECTORS.chatBtn, detailBox);
    if (btn && isChatBtnAvailable(btn)) return btn;

    const allLinks = (detailBox || document).querySelectorAll('a,button');
    for (const el of allLinks) {
        const text = getElementText(el);
        if (isChatBtnAvailable(el) && SELECTORS.chatBtnTexts.some(t => text.includes(t))) {
            return el;
        }
    }
    return null;
};

/**
 * 岗位标题匹配
 */
const matchJobTitle = (jobName, keywords) => {
    if (!keywords || keywords.length === 0) return true;
    if (!jobName) return false;

    const lowerName = jobName.toLowerCase();

    return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        if (lowerName.includes(lowerKeyword)) return true;

        const words = splitKeyword(lowerKeyword);
        if (words.length > 0 && words.some(w => lowerName.includes(w))) return true;

        return false;
    });
};

/**
 * 拆分关键词为子词
 */
const splitKeyword = (keyword) => {
    const words = [];
    let buffer = '';

    for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];

        if (ch === '/' || ch === ' ' || ch === ',' || ch === '、' || ch === '-') {
            if (buffer.length > 1) words.push(buffer);
            buffer = '';
            continue;
        }

        const isCJK = (ch >= '一' && ch <= '鿿') || (ch >= '㐀' && ch <= '䶿');
        const prevIsCJK = buffer.length > 0 &&
            ((buffer[buffer.length - 1] >= '一' && buffer[buffer.length - 1] <= '鿿') ||
             (buffer[buffer.length - 1] >= '㐀' && buffer[buffer.length - 1] <= '䶿'));

        if (buffer.length > 0 && isCJK !== prevIsCJK) {
            if (buffer.length > 1) words.push(buffer);
            buffer = ch;
        } else {
            buffer += ch;
        }
    }
    if (buffer.length > 1) words.push(buffer);

    return words;
};

/**
 * 检查排除关键词
 */
const checkExclude = (text, excludeKeywords) => {
    if (!excludeKeywords || !text) return false;
    const keywords = excludeKeywords.split(/[,，、\s]+/).filter(k => k);
    if (keywords.length === 0) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(k => lowerText.includes(k.toLowerCase()));
};

/**
 * 返回第一个命中的排除关键词（用于日志显示）
 */
const findExcludeMatch = (text, excludeKeywords) => {
    if (!excludeKeywords || !text) return null;
    const keywords = excludeKeywords.split(/[,，、\s]+/).filter(k => k);
    const lowerText = text.toLowerCase();
    return keywords.find(k => lowerText.includes(k.toLowerCase())) || null;
};

/**
 * 返回第一个命中的黑名单关键词（用于日志显示）
 */
const findBlacklistMatch = (text, blacklist) => {
    if (!blacklist || !text) return null;
    const lowerText = text.toLowerCase();
    return blacklist.find(kw => lowerText.includes(kw.toLowerCase())) || null;
};

/**
 * 短延迟（用于Canvas操作间隔，降低时序检测风险）
 */
const __canvasDelay = () => new Promise(r => setTimeout(r, Math.floor(Math.random() * 15) + 5));

/**
 * PUA字符→数字的会话级缓存（同一字体的映射在会话中不变）
 */
const __puaMappingCache = {};  // fontKey → { charCode → digit }

/**
 * 创建临时 Canvas 上下文（用完即销毁，不留存活实例）
 * 使用 willReadFrequently 优化频繁 getImageData 调用
 */
const __createTempCtx = () => {
    let canvas, ctx;
    const ctxOptions = { willReadFrequently: true };
    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(80, 50);
        ctx = canvas.getContext('2d', ctxOptions);
    } else {
        canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 50;
        canvas.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d', ctxOptions);
    }
    return { canvas, ctx };
};

/**
 * 销毁临时 Canvas（清除像素+移除DOM节点）
 */
const __destroyTempCtx = (canvas, ctx) => {
    try {
        if (ctx) ctx.clearRect(0, 0, 80, 50);
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    } catch (e) { /* ignore */ }
};

/**
 * BOSS直聘自定义字体解码（安全版 - 临时Canvas+用完即销毁+willReadFrequently优化）
 */
const decodeBOSSNumber = async (text) => {
    if (!text) return text;

    // 检查是否包含PUA字符
    let hasPUA = false;
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) >= 0xE000 && text.charCodeAt(i) <= 0xF8FF) {
            hasPUA = true;
            break;
        }
    }
    if (!hasPUA) return text;

    let canvas = null, ctx = null;
    try {
        // 获取页面上薪资元素的字体
        let font = '14px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
        const salEl = document.querySelector('[class*=salary], .job-salary, [class*=money]');
        if (salEl) {
            const computedFont = window.getComputedStyle(salEl).font;
            if (computedFont) font = computedFont;
        }

        // 检查缓存
        const fontKey = font;
        if (!__puaMappingCache[fontKey]) {
            __puaMappingCache[fontKey] = {};
        }
        const cachedMapping = __puaMappingCache[fontKey];

        // 收集需要解码的未知PUA字符
        const unknownCodes = new Set();
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 0xE000 && code <= 0xF8FF && cachedMapping[code] === undefined) {
                unknownCodes.add(code);
            }
        }

        // 有未知字符才进行canvas解码
        if (unknownCodes.size > 0) {
            const temp = __createTempCtx();
            canvas = temp.canvas;
            ctx = temp.ctx;

            for (const code of unknownCodes) {
                const ch = String.fromCharCode(code);
                let best = '?';
                let bestScore = Infinity;

                for (let d = 0; d <= 9; d++) {
                    ctx.clearRect(0, 0, 80, 50);
                    ctx.font = font;
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#000';
                    ctx.fillText(String(d), 4, 4);
                    await __canvasDelay();
                    const refData = ctx.getImageData(0, 0, 80, 50).data;

                    ctx.clearRect(0, 0, 80, 50);
                    ctx.fillText(ch, 4, 4);
                    await __canvasDelay();
                    const puaData = ctx.getImageData(0, 0, 80, 50).data;

                    let score = 0;
                    for (let px = 0; px < refData.length; px += 4) {
                        score += Math.abs((refData[px + 3] || 0) - (puaData[px + 3] || 0));
                    }
                    if (score < bestScore) {
                        bestScore = score;
                        best = String(d);
                    }
                }
                cachedMapping[code] = best;
            }
        }

        // 替换PUA字符
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 0xE000 && code <= 0xF8FF) {
                result += cachedMapping[code] || '?';
            } else {
                result += text[i];
            }
        }
        return result;
    } catch (e) {
        return text;
    } finally {
        // 立即销毁临时Canvas
        __destroyTempCtx(canvas, ctx);
    }
};

/**
 * 解析薪资范围（async，因为内部调用decodeBOSSNumber）
 */
const parseSalaryRange = async (text) => {
    if (!text) return null;
    text = await decodeBOSSNumber(text);
    const t = text.replace(/[\s,，\s]/g, '').trim();

    let dm = t.match(/([\d.]+)\s*[-~]\s*([\d.]+)\s*(?:元)?\s*\/(?:天|日)/);
    if (dm) return { min: +(dm[1] * 22 / 1000).toFixed(1), max: +(dm[2] * 22 / 1000).toFixed(1) };

    dm = t.match(/([\d.]+)\s*(?:元)?\s*\/(?:天|日)/);
    if (dm) return { min: +(dm[1] * 22 / 1000).toFixed(1), max: +(dm[1] * 22 / 1000).toFixed(1) };

    if (t.includes('/天') || t.includes('/日') || t.includes('元/')) return null;
    let m = t.match(/(\d+\.?\d*)\s*[kK千]?\s*[-~–—]\s*(\d+\.?\d*)\s*[kK千]?/);
    if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]) };

    m = t.match(/([\d.]+)\s*[kK]?\s*以上/);
    if (m) return { min: parseFloat(m[1]), max: Infinity };

    m = t.match(/(\d+\.?\d*)/);
    if (m) return { min: parseFloat(m[1]), max: parseFloat(m[1]) };

    return null;
};

/**
 * 清理职位描述，提取核心JD内容
 * 过滤掉按钮、标签、广告等无关内容
 * @param {string} rawDesc - 原始职位描述
 * @returns {string} 清理后的职位描述
 */
const cleanJobDesc = (rawDesc) => {
    if (!rawDesc) return '';

    let text = rawDesc;

    // 1. 移除常见的卡片基本信息（职位标题下方的标签）
    const cardInfoPatterns = [
        // 薪资格式
        /\d+[-~]?\d*[kK千]?[·•]\d+[-~]?\d*[kK千]?薪?/g,
        // 城市（常见的热门城市）
        /^(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|西安|苏州|天津|长沙|郑州|东莞|青岛|沈阳|宁波|大连|厦门|合肥|佛山|福州|哈尔滨|济南|昆明|贵阳|南昌|太原|烟台|嘉兴|南通|金华|珠海|惠州|徐州|海口|乌鲁木齐|绍兴|中山|台州|兰州)\s*$/gm,
        // 经验要求
        /^经验不限$|^(\d+[-~])?\d+年$/gm,
        // 学历要求
        /^学历不限$|^本科$|^硕士$|^博士$|^大专$|^高中$|^中专$/gm,
        // 单独的数字+K格式
        /^\d+[kK]$/gm
    ];
    for (const pattern of cardInfoPatterns) {
        text = text.replace(pattern, '');
    }

    // 2. 移除常见的无关关键词和它们之后的内容
    const cutoffKeywords = [
        '微信扫码分享', '去App', '与BOSS随时沟通', '查看更多信息',
        '求职工具', '升级VIP', '尊享', '去升级', '热门职位', '热门城市',
        '热门企业', '附近城市', '公司信息', '工商信息',
        '相似职位', '看了又看', '推荐职位', '举报按钮'
    ];

    // 找到最早出现的无关关键词，截断
    let minIndex = text.length;
    for (const kw of cutoffKeywords) {
        const idx = text.indexOf(kw);
        if (idx !== -1 && idx < minIndex) {
            minIndex = idx;
        }
    }
    text = text.substring(0, minIndex);

    // 3. 移除常见的按钮/标签文本
    const removePatterns = [
        '收藏', '立即沟通', '举报', '不合适',
        '分享到微信', '分享', '投诉', '去App'
    ];
    for (const pattern of removePatterns) {
        text = text.replace(new RegExp(pattern, 'g'), '');
    }

    // 4. 尝试提取"职位描述"之后的内容
    const descMarkers = ['职位描述', '岗位描述', '工作内容', '工作职责', '岗位职责', '职责描述'];
    let foundMarker = false;
    for (const marker of descMarkers) {
        const idx = text.indexOf(marker);
        if (idx !== -1) {
            text = text.substring(idx + marker.length);
            foundMarker = true;
            break;
        }
    }

    // 5. 如果没有找到标记，尝试移除开头的短行（可能是标题或标签）
    if (!foundMarker) {
        const lines = text.split('\n');
        const contentStart = lines.findIndex(line => {
            const trimmed = line.trim();
            // 找到第一个较长的行或包含关键词的行
            return trimmed.length > 20 ||
                   trimmed.includes('职责') ||
                   trimmed.includes('要求') ||
                   trimmed.includes('任职') ||
                   trimmed.includes('岗位') ||
                   trimmed.includes('工作');
        });
        if (contentStart > 0) {
            text = lines.slice(contentStart).join('\n');
        }
    }

    // 6. 清理多余空白和换行
    text = text
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // 多个空行合并为两个
        .replace(/^\s+|\s+$/g, '')           // 去除首尾空白
        .replace(/\t/g, ' ')                 // Tab替换为空格
        .replace(/ {2,}/g, ' ')              // 多个空格合并
        .trim();

    // 7. 限制长度（避免过长）
    if (text.length > 2000) {
        text = text.substring(0, 2000) + '...';
    }

    return text;
};

/**
 * 解析发布时间
 */
const parsePostAge = (text) => {
    if (!text) return null;
    const t = text.trim();

    if (t.includes('刚刚')) return 0;

    let m = t.match(/(\d+)\s*分钟前/);
    if (m) return 0;

    m = t.match(/(\d+)\s*小时前/);
    if (m) return 0;

    // 支持"X天前"和"X日内"两种格式
    m = t.match(/(\d+)\s*(?:天前|日内)/);
    if (m) return parseInt(m[1]);

    m = t.match(/(\d+)\s*周前/);
    if (m) return parseInt(m[1]) * 7;

    m = t.match(/(\d+)\s*个月前/);
    if (m) return parseInt(m[1]) * 30;

    if (t.includes('半年')) return 180;

    m = t.match(/(\d+)\s*年前/);
    if (m) return parseInt(m[1]) * 365;

    m = t.match(/(\d{1,2})-(\d{1,2})/);
    if (m) {
        const now = new Date();
        const month = parseInt(m[1]) - 1;
        const day = parseInt(m[2]);
        const date = new Date(now.getFullYear(), month, day);
        return Math.round((now - date) / 86400000);
    }

    return null;
};

// 导出筛选模块（非枚举）
const BossFilters = {
    isChatBtnAvailable,
    getChatBtn,
    getChatBtnD,
    matchJobTitle,
    splitKeyword,
    checkExclude,
    findExcludeMatch,
    findBlacklistMatch,
    decodeBOSSNumber,
    parseSalaryRange,
    parsePostAge,
    cleanJobDesc
};

if (!window.BossFilters) {
    Object.defineProperty(window, 'BossFilters', {
        value: BossFilters,
        enumerable: false,
        configurable: false,
        writable: false
    });
}
