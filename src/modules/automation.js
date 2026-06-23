// ==========================================
// BOSS直聘 AI海投助手 - 自动投递模块
// 重构版：纯筛选+自动沟通，无需打字，不修改问候语
// ==========================================

const __processedCards = new WeakSet();

// ---- 弹窗检测（MutationObserver优化版） ----

const __popupSelectors = [
    '.dialog-box', '.dialog', '[class*=dialog]', '.modal',
    '[class*=match-tip]', '[class*=direction]', '[class*=recommend-dialog]',
    '[class*=job-match]', '[class*=alert]', '[class*=notice-popup]',
    '[class*=popup]', '[class*=overlay]', '[class*=mask]',
    '[class*=confirm]', '[class*=toast]', '[class*=tip-box]'
];
const __popupKeywords = [
    '求职方向', '匹配度', '岗位推荐', '是否合适', '修改期望',
    '简历完善', '竞争力', '去优化', '立即修改', '偏好设置',
    '换一批', '看看其他', '暂不考虑', '不适合', '请先',
    '确认', '提示', '警告', '异常', '频繁', '操作太快',
    '稍后再试', '休息一下', '完善简历', '验证码', '安全检测',
    '人机验证', '请完成', '账号', '登录', '封禁', '限制'
];

/**
 * 检查单个元素是否为弹窗
 */
const __isPopupElement = (el) => {
    try {
        if (!el || !el.tagName) return false;
        // 检查选择器匹配
        for (const sel of __popupSelectors) {
            if (el.matches && el.matches(sel)) {
                const rect = el.getBoundingClientRect();
                if (el.offsetParent !== null && rect.height > 50 && rect.height < window.innerHeight * 0.9) {
                    const text = getElementText(el);
                    if (text && text.length < 500) {
                        for (const kw of __popupKeywords) {
                            if (text.includes(kw)) return { detected: true, reason: kw, element: el };
                        }
                    }
                }
            }
        }
        // 检查高z-index
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        if (zIndex > 1000 && style.display !== 'none' && style.visibility !== 'hidden') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 200 && rect.height > 100 && rect.top < window.innerHeight * 0.5) {
                const text = getElementText(el);
                if (text && text.length > 10 && text.length < 500) {
                    for (const kw of __popupKeywords) {
                        if (text.includes(kw)) return { detected: true, reason: kw, element: el };
                    }
                }
            }
        }
    } catch (e) { /* ignore */ }
    return null;
};

// 弹窗检测状态（由MutationObserver维护）
let __popupDetectedState = { detected: false };
let __popupObserverInstalled = false;
let __popupDirty = true; // 脏标记：DOM变化时置true，扫描后置false

/**
 * 初始化弹窗检测MutationObserver
 */
const __initPopupObserver = () => {
    if (__popupObserverInstalled) return;
    __popupObserverInstalled = true;

    document.addEventListener('DOMContentLoaded', () => {
        // 页面加载后做一次初始扫描
        document.querySelectorAll(__popupSelectors.join(',')).forEach(el => {
            const result = __isPopupElement(el);
            if (result) __popupDetectedState = result;
        });
    });

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                __popupDirty = true; // DOM变化，标记脏
                const result = __isPopupElement(node);
                if (result) { __popupDetectedState = result; return; }
                // 检查子元素
                if (node.querySelectorAll) {
                    const children = node.querySelectorAll(__popupSelectors.join(','));
                    for (const child of children) {
                        const r = __isPopupElement(child);
                        if (r) { __popupDetectedState = r; return; }
                    }
                }
            }
        }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
};

/**
 * 检查系统弹窗（优化版：优先使用Observer缓存，仅在DOM变化时回退全扫描）
 */
const detectSystemPopup = () => {
    // 如果Observer已检测到弹窗，直接返回
    if (__popupDetectedState.detected) return __popupDetectedState;

    // DOM未变化且已扫描过，跳过全扫描
    if (!__popupDirty) return { detected: false };
    __popupDirty = false;

    // 回退：全页面扫描（仅在DOM变化时）
    for (const sel of __popupSelectors) {
        try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const rect = el.getBoundingClientRect();
                if (el.offsetParent !== null && rect.height > 50 && rect.height < window.innerHeight * 0.9) {
                    const text = getElementText(el);
                    if (text && text.length < 500) {
                        for (const kw of __popupKeywords) {
                            if (text.includes(kw)) return { detected: true, reason: kw, element: el };
                        }
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }

    const bodyText = document.body.innerText || '';
    for (const kw of ['请先修改求职方向', '岗位匹配度较低', '建议您修改期望']) {
        if (bodyText.includes(kw)) return { detected: true, reason: kw, element: null };
    }

    return { detected: false };
};

/**
 * 重置弹窗检测状态（自动化开始时调用）
 */
const resetPopupState = () => { __popupDetectedState = { detected: false }; __popupDirty = true; };

const isAtBottom = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    return scrollTop + clientHeight >= scrollHeight - 100;
};

// ---- 城市过滤（通过页面UI点击选择） ----

/**
 * 城市选择器相关选择器
 */
const __citySelectors = {
    // 页面左上角的城市按钮（"请选择城市"或当前城市名）
    trigger: [
        '[class*=city-select]', '[class*=city-picker]', '[class*=location-select]',
        '[class*=area-select]', '[class*=city]', '.search-condition-wrapper [class*=city]',
        '[class*=job-search] [class*=city]', 'span[class*=city]', 'div[class*=city]'
    ],
    // 城市列表容器
    container: [
        '[class*=city-list]', '[class*=city-panel]', '[class*=area-list]',
        '[class*=city-dropdown]', '[class*=select-dropdown]', '[class*=popup]',
        '[class*=city-layer]', '[class*=city-picker-panel]'
    ]
};

/**
 * 通过页面UI点击选择城市
 * @returns {Promise<boolean>} 是否成功选择或无需选择
 */
const ensureCityFilter = async () => {
    const city = (config.city || '').trim();
    if (!city) return true;

    // 检查当前页面是否已经筛选了该城市（URL中包含城市编码或页面显示该城市名）
    const code = CITY_CODES[city];
    if (code && location.href.includes(code)) return true;

    // 查找页面上的城市选择器按钮
    let cityTrigger = null;
    for (const sel of __citySelectors.trigger) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
            // 必须可见且在页面顶部区域（城市选择器通常在搜索栏附近）
            if (el.offsetParent !== null) {
                const rect = el.getBoundingClientRect();
                if (rect.top < 200 && rect.height > 10 && rect.height < 80) {
                    cityTrigger = el;
                    break;
                }
            }
        }
        if (cityTrigger) break;
    }

    if (!cityTrigger) {
        logPrint('log-auto', '未找到城市选择器', 'fail');
        return true; // 找不到选择器，继续运行
    }

    logPrint('log-auto', `选择城市: ${city}`, 'info');

    // 点击城市选择器，打开城市列表
    await BossAntiDetection.simulateHumanClick(cityTrigger);
    await humanSleep(randomInt(1500, 2500), 500);

    // 模拟鼠标在城市面板附近移动（扫视）
    const triggerRect = cityTrigger.getBoundingClientRect();
    for (let i = 0; i < randomInt(1, 3); i++) {
        const mx = triggerRect.left + randomInt(-50, triggerRect.width + 100);
        const my = triggerRect.top + randomInt(20, 150);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
        await humanSleep(randomInt(200, 500), 100);
    }

    // 在城市列表中查找匹配的城市名
    let cityFound = false;
    let cityTarget = null;

    // 策略1：在弹出的城市面板/下拉列表中查找
    for (const sel of __citySelectors.container) {
        const containers = document.querySelectorAll(sel);
        for (const container of containers) {
            if (container.offsetParent === null) continue;

            // 查找所有可点击的城市选项
            const cityItems = container.querySelectorAll('a, span, div, li, button');
            for (const item of cityItems) {
                const text = getElementText(item);
                // 精确匹配或包含匹配
                if (text === city || text.includes(city)) {
                    // 确保是可点击的城市选项（不是标题或分隔符）
                    const rect = item.getBoundingClientRect();
                    if (rect.height > 10 && rect.height < 60 && rect.width > 10) {
                        cityTarget = item;
                        break;
                    }
                }
            }
            if (cityTarget) break;
        }
        if (cityTarget) break;
    }

    // 策略2：如果没找到城市面板，直接在整个页面中查找匹配的城市文本
    if (!cityTarget) {
        const allElements = document.querySelectorAll('a, span, li, div');
        for (const el of allElements) {
            const text = getElementText(el);
            if (text === city) {
                const rect = el.getBoundingClientRect();
                if (rect.top > 50 && rect.top < 500 && rect.height > 10 && rect.height < 60) {
                    cityTarget = el;
                    break;
                }
            }
        }
    }

    if (!cityTarget) {
        logPrint('log-auto', `未找到城市"${city}"，请检查输入`, 'fail');
        BossAntiDetection.trustedDispatchEvent(document, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await humanSleep(500, 200);
        return true;
    }

    // 模拟鼠标移到目标城市上方（自然轨迹）
    const targetRect = cityTarget.getBoundingClientRect();
    const moveX = targetRect.left + targetRect.width / 2 + randomInt(-10, 10);
    const moveY = targetRect.top + targetRect.height / 2 + randomInt(-5, 5);
    await BossAntiDetection.simulateMouseMovement(moveX, moveY, randomInt(200, 400));
    await humanSleep(randomInt(300, 700), 150);

    // 点击城市
    await BossAntiDetection.simulateHumanClick(cityTarget);
    cityFound = true;

    // 等待页面刷新/内容更新
    logPrint('log-auto', `已选择城市: ${city}`, 'success');
    await humanSleep(randomInt(2000, 3500), 800);

    return true;
};

// ---- 详情面板滚动 ----

const findDetailScrollContainer = (detailBox) => {
    const scrollSelectors = [
        '.job-detail-content', '.job-sec-text', '.job-detail',
        '[class*=detail-content]', '[class*=detail-body]',
        '[class*=job-detail] [class*=content]',
        '[class*=scroll]', '.detail-main'
    ];

    for (const sel of scrollSelectors) {
        const el = detailBox.querySelector(sel);
        if (el) {
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                return el;
            }
        }
    }

    const children = detailBox.querySelectorAll('*');
    for (const el of children) {
        if (el.scrollHeight > el.clientHeight + 20) {
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
                return el;
            }
        }
    }

    if (detailBox.scrollHeight > detailBox.clientHeight + 20) {
        const style = window.getComputedStyle(detailBox);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return detailBox;
        }
    }

    return null;
};

const scrollInDetail = async (container, direction, distance) => {
    const actualDistance = direction === 'down' ? distance : -distance;
    const steps = randomInt(4, 8);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    for (let i = 0; i < steps; i++) {
        if (isAborted()) return;
        const t1 = i / steps;
        const t2 = (i + 1) / steps;
        const stepDist = actualDistance * (easeOutCubic(t2) - easeOutCubic(t1));
        const jitter = BossUtils.randomInt(-3, 3);
        container.scrollTop += stepDist + jitter;
        await new Promise(r => setTimeout(r, BossUtils.randomInt(20, 40)));
    }
};

// ---- 核心投递逻辑 ----

const dismissDialogs = async () => {
    for (let i = 0; i < 3; i++) {
        const stayBtn = qs(SELECTORS.stayBtn);
        if (stayBtn && stayBtn.offsetParent !== null) {
            await BossAntiDetection.simulateHumanClick(stayBtn);
            await humanSleep(500, 200);
            continue;
        }
        const closeBtn = qs(SELECTORS.closeBtn);
        if (closeBtn && closeBtn.offsetParent !== null) {
            await BossAntiDetection.simulateHumanClick(closeBtn);
            await humanSleep(500, 200);
            continue;
        }
        break;
    }
};

/**
 * 浏览完整JD（在详情面板内滚动）
 * @param {Element} detailBox - 详情面板元素
 * @param {number} interestLevel - 兴趣因子 0.3-1.0，影响浏览深度
 */
const browseFullJD = async (detailBox, interestLevel = 1.0) => {
    const scrollContainer = findDetailScrollContainer(detailBox);

    if (scrollContainer) {
        const contentHeight = scrollContainer.scrollHeight;
        const viewHeight = scrollContainer.clientHeight;
        const scrollNeeded = contentHeight > viewHeight * 1.2;

        if (scrollNeeded) {
            const scrollableDist = contentHeight - viewHeight;
            const scrollTimes = Math.ceil(scrollableDist / (viewHeight * 0.5));
            // 根据兴趣因子限制最大滚动次数
            const maxScrolls = Math.max(1, Math.round(5 * interestLevel));

            for (let i = 0; i < Math.min(scrollTimes, maxScrolls); i++) {
                if (isAborted()) return;
                await scrollInDetail(scrollContainer, 'down', randomInt(100, 250));
                await humanSleep(randomInt(300, 600), 150);
                if (Math.random() < 0.25) await humanSleep(500, 200);
            }

            for (let i = 0; i < Math.min(scrollTimes, maxScrolls); i++) {
                if (isAborted()) return;
                await scrollInDetail(scrollContainer, 'up', randomInt(100, 250));
                await humanSleep(150, 80);
            }
        } else {
            await scrollInDetail(scrollContainer, 'down', randomInt(50, 150));
            await humanSleep(300, 150);
            await scrollInDetail(scrollContainer, 'up', randomInt(50, 150));
        }
    } else {
        const descEl = qs(SELECTORS.jobDesc, detailBox);
        if (descEl) {
            descEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
            await humanSleep(400, 200);
            descEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
            await humanSleep(300, 150);
        }
    }

    const moveCount = randomInt(1, 3);
    for (let i = 0; i < moveCount; i++) {
        const rect = detailBox.getBoundingClientRect();
        const x = rect.left + randomInt(30, rect.width - 30);
        const y = rect.top + randomInt(30, rect.height - 30);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', x, y));
        await humanSleep(150, 80);
    }
};

/**
 * 点击沟通按钮并选择"留在此页"
 * 点击后即视为沟通成功
 */
const clickChatAndStay = async (chatBtn) => {
    chatBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await humanSleep(600, 300);

    // 犹豫行为（15%概率）：鼠标移到按钮附近停留几秒，最终仍会点击
    if (Math.random() < 0.15) {
        const rect = chatBtn.getBoundingClientRect();
        // 鼠标移到按钮旁边（不在按钮上）
        const nearX = rect.left + rect.width / 2 + randomInt(-60, 60);
        const nearY = rect.top + rect.height / 2 + randomInt(-40, 40);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', nearX, nearY));
        await humanSleep(randomInt(2000, 5000), 800);
        // 犹豫期间在按钮周围微动1-3次
        const microMoves = randomInt(1, 3);
        for (let i = 0; i < microMoves; i++) {
            const mx = rect.left + rect.width / 2 + randomInt(-30, 30);
            const my = rect.top + rect.height / 2 + randomInt(-20, 20);
            BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
            await humanSleep(randomInt(300, 800), 200);
        }
    }

    // 点击"立即沟通"
    await BossAntiDetection.simulateHumanClick(chatBtn);
    // 等待弹窗出现
    await humanSleep(2000, 800);

    // 处理弹窗：选择"留在此页"
    for (let i = 0; i < 5; i++) {
        if (isAborted()) return false;
        // 每次检查前等待一下，模拟人类反应时间
        await humanSleep(randomInt(300, 600), 100);
        const stayBtn = qs(SELECTORS.stayBtn);
        if (stayBtn && stayBtn.offsetParent !== null) {
            await humanSleep(randomInt(200, 500), 100);
            await BossAntiDetection.simulateHumanClick(stayBtn);
            await humanSleep(800, 300);
            break;
        }
        const closeBtn = qs(SELECTORS.closeBtn);
        if (closeBtn && closeBtn.offsetParent !== null) {
            await BossAntiDetection.simulateHumanClick(closeBtn);
            await humanSleep(800, 300);
            break;
        }
        await humanSleep(300, 100);
    }

    // 点击了沟通+留在此页，即视为成功
    return true;
};

/**
 * 保存待发送消息状态（用于页面跳转后恢复）
 */
const __PENDING_MSG_KEY = '_pendingGreetingMessage';

const savePendingMessage = async (message, jobKey) => {
    try {
        await chrome.storage.local.set({
            [__PENDING_MSG_KEY]: {
                message: message,
                jobKey: jobKey,
                timestamp: Date.now()
            }
        });
    } catch (e) { BossUtils.safeLog('savePendingMessage失败: ' + e.message); }
};

const loadPendingMessage = async () => {
    try {
        const result = await chrome.storage.local.get(__PENDING_MSG_KEY);
        return result[__PENDING_MSG_KEY] || null;
    } catch (e) {
        return null;
    }
};

const clearPendingMessage = async () => {
    try {
        await chrome.storage.local.remove(__PENDING_MSG_KEY);
    } catch (e) { BossUtils.safeLog('clearPendingMessage失败: ' + e.message); }
};

/**
 * 在聊天页面自动发送消息（由页面加载后调用）
 * @returns {Promise<boolean>} 是否成功发送
 */
const autoSendGreetingMessage = async () => {
    BossUtils.safeLog('autoSendGreetingMessage 开始执行');

    const pending = await loadPendingMessage();
    BossUtils.safeLog('加载待发送消息: ' + JSON.stringify(pending));

    if (!pending || !pending.message) {
        BossUtils.safeLog('没有待发送消息');
        logPrint('log-auto', '未找到待发送消息', 'info');
        return false;
    }

    const message = pending.message;
    BossUtils.safeLog('待发送消息内容: ' + message.substring(0, 50) + '...');
    logPrint('log-auto', `📝 检测到待发送消息，准备发送...`, 'info');

    // 等待页面完全加载
    BossUtils.safeLog('等待页面加载...');
    await humanSleep(randomInt(1500, 2500), 500);

    // 等待聊天输入框出现
    BossUtils.safeLog('开始查找聊天输入框...');
    let chatInput = null;
    for (let i = 0; i < 30; i++) {
        chatInput = qs(SELECTORS.chatInput);
        if (chatInput) {
            BossUtils.safeLog('找到聊天输入框 (尝试 ' + (i + 1) + ' 次)');
            logPrint('log-auto', `✓ 找到聊天输入框 (尝试 ${i + 1} 次)`, 'success');
            break;
        }
        BossUtils.safeLog('未找到输入框，等待... (尝试 ' + (i + 1) + ')');
        await humanSleep(randomInt(400, 600), 200);
    }

    if (!chatInput) {
        BossUtils.safeLog('聊天输入框未出现');
        logPrint('log-auto', '❌ 聊天输入框未出现，可能页面未完全加载', 'fail');
        // 不清除状态，下次刷新可以重试
        return false;
    }

    // 检查输入框是否可见
    const inputRect = chatInput.getBoundingClientRect();
    if (inputRect.height === 0 || chatInput.offsetParent === null) {
        logPrint('log-auto', '❌ 聊天输入框不可见', 'fail');
        await clearPendingMessage();
        return false;
    }

    // 拟人化：先在聊天页面附近移动鼠标（模拟浏览聊天界面）
    for (let i = 0; i < randomInt(1, 3); i++) {
        const mx = inputRect.left + randomInt(-100, inputRect.width + 100);
        const my = inputRect.top + randomInt(-80, inputRect.height + 80);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
        await humanSleep(randomInt(200, 500), 100);
    }

    // 聊天输入框已出现，准备输入消息
    chatInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await humanSleep(randomInt(400, 700), 200);

    // 拟人化：鼠标移到输入框附近
    const inputMoveX = inputRect.left + inputRect.width / 2 + randomInt(-20, 20);
    const inputMoveY = inputRect.top + inputRect.height / 2 + randomInt(-10, 10);
    await BossAntiDetection.simulateMouseMovement(inputMoveX, inputMoveY, randomInt(150, 300));
    await humanSleep(randomInt(200, 400), 100);

    // 点击输入框获取焦点
    await BossAntiDetection.simulateHumanClick(chatInput);
    await humanSleep(randomInt(300, 500), 150);

    logPrint('log-auto', `📝 正在输入消息...`, 'info');

    // 拟人化：输入前停顿（模拟思考要说什么）
    await humanSleep(randomInt(1000, 2000), 500);

    // 使用逐字输入模拟（生成完整的keydown/keyup/input事件链）
    const typingResult = await BossAntiDetection.simulateTyping(chatInput, message);

    if (typingResult) {
        logPrint('log-auto', '✓ 消息输入完成', 'success');
    } else {
        logPrint('log-auto', '❌ 消息输入失败', 'fail');
        await clearPendingMessage();
        return false;
    }

    await humanSleep(randomInt(400, 700), 200);

    // 查找发送按钮
    const sendBtn = qs(SELECTORS.sendBtn);
    if (!sendBtn) {
        logPrint('log-auto', '❌ 发送按钮未找到', 'fail');
        await clearPendingMessage();
        return false;
    }

    logPrint('log-auto', `📤 准备发送消息...`, 'info');

    // 拟人化：输入完成后，鼠标移到发送按钮附近（模拟检查消息）
    const sendRect = sendBtn.getBoundingClientRect();
    const sendMoveX = sendRect.left + sendRect.width / 2 + randomInt(-10, 10);
    const sendMoveY = sendRect.top + sendRect.height / 2 + randomInt(-5, 5);
    await BossAntiDetection.simulateMouseMovement(sendMoveX, sendMoveY, randomInt(200, 400));
    await humanSleep(randomInt(500, 1200), 300);  // 停顿一下，模拟确认消息

    // 点击发送按钮
    await BossAntiDetection.simulateHumanClick(sendBtn);
    await humanSleep(randomInt(1500, 2500), 600);  // 等待消息发送完成

    logPrint('log-auto', `✓ 消息发送完成`, 'success');

    // 拟人化：发送后停留查看聊天记录（模拟人类行为）
    await humanSleep(randomInt(2000, 4000), 800);

    // 随机在页面上移动鼠标（模拟浏览聊天记录）
    for (let i = 0; i < randomInt(2, 4); i++) {
        const mx = randomInt(100, window.innerWidth - 100);
        const my = randomInt(100, window.innerHeight - 100);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
        await humanSleep(randomInt(500, 1500), 300);
    }

    // 偶尔滚动一下聊天记录（30%概率）
    if (Math.random() < 0.3) {
        await BossAntiDetection.simulateScroll('up', randomInt(100, 300));
        await humanSleep(randomInt(800, 1500), 400);
    }

    // 清除待发送状态
    await clearPendingMessage();

    // 返回职位列表前的拟人化停顿
    logPrint('log-auto', `🔙 准备返回职位列表...`, 'info');
    await humanSleep(randomInt(1500, 3000), 600);

    // 返回职位列表（点击浏览器后退按钮）
    window.history.back();

    // 等待页面返回并加载（较长等待）
    await humanSleep(randomInt(4000, 6000), 1500);

    return true;
};

/**
 * 点击沟通按钮，发送自定义消息，然后返回职位列表
 * 流程：点击沟通 → 弹出对话框 → 保存状态 → 点击"继续沟通"（页面跳转） → 新页面自动恢复并发送
 * 包含拟人化犹豫操作，避免反检测
 * @param {Element} chatBtn - 沟通按钮
 * @param {string} message - 要发送的消息
 * @param {string} jobKey - 岗位标识
 * @returns {Promise<boolean>} 是否成功发送
 */
const clickChatAndSendMessage = async (chatBtn, message, jobKey) => {
    // 滚动到沟通按钮位置
    chatBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await humanSleep(600, 300);

    // 犹豫行为（20%概率）：鼠标移到按钮附近停留，模拟思考
    if (Math.random() < 0.20) {
        const rect = chatBtn.getBoundingClientRect();
        // 鼠标移到按钮旁边（不在按钮上）
        const nearX = rect.left + rect.width / 2 + randomInt(-60, 60);
        const nearY = rect.top + rect.height / 2 + randomInt(-40, 40);
        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', nearX, nearY));
        await humanSleep(randomInt(1500, 4000), 800);
        // 犹豫期间在按钮周围微动2-4次
        const microMoves2 = randomInt(2, 4);
        for (let i = 0; i < microMoves2; i++) {
            const mx = rect.left + rect.width / 2 + randomInt(-30, 30);
            const my = rect.top + rect.height / 2 + randomInt(-20, 20);
            BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
            await humanSleep(randomInt(300, 800), 200);
        }
    }

    // 点击"立即沟通"
    await BossAntiDetection.simulateHumanClick(chatBtn);
    await humanSleep(randomInt(1500, 2500), 600);  // 等待对话框出现

    // 等待"已向BOSS发送消息"对话框出现，点击"继续沟通"
    let continueBtn = null;
    for (let i = 0; i < 12; i++) {
        // 查找"继续沟通"按钮（可能是链接或按钮）
        const allBtns = document.querySelectorAll('a, button');
        for (const btn of allBtns) {
            const text = getElementText(btn);
            if (text.includes('继续沟通') || text.includes('继续聊天') || text.includes('发送消息')) {
                const rect = btn.getBoundingClientRect();
                if (btn.offsetParent !== null && rect.height > 10 && rect.height < 80) {
                    continueBtn = btn;
                    break;
                }
            }
        }
        if (continueBtn) break;
        await humanSleep(randomInt(400, 700), 200);
    }

    if (!continueBtn) {
        // 没有找到"继续沟通"按钮，尝试查找聊天输入框（可能直接进入了聊天页面）
        let chatInput = qs(SELECTORS.chatInput);
        if (!chatInput) {
            logPrint('log-auto', '未找到"继续沟通"按钮或聊天输入框', 'fail');
            return false;
        }
        // 直接进入输入消息流程（无需跳转）
        return await autoSendGreetingMessage();
    }

    // 找到"继续沟通"按钮
    // 保存待发送消息状态（页面跳转后会自动恢复）
    await savePendingMessage(message, jobKey);
    logPrint('log-auto', `💾 已保存待发送消息，准备跳转...`, 'info');

    // 拟人化：鼠标移到"继续沟通"按钮附近
    const continueRect = continueBtn.getBoundingClientRect();
    const moveX = continueRect.left + continueRect.width / 2 + randomInt(-15, 15);
    const moveY = continueRect.top + continueRect.height / 2 + randomInt(-8, 8);
    await BossAntiDetection.simulateMouseMovement(moveX, moveY, randomInt(200, 400));
    await humanSleep(randomInt(300, 600), 150);

    // 点击"继续沟通"（页面会跳转到聊天页面）
    await BossAntiDetection.simulateHumanClick(continueBtn);

    // 页面跳转后，content script 会重新加载
    // 新页面加载时会调用 autoSendGreetingMessage() 继续执行
    return true;
};

/**
 * 初始化自动投递
 */
const initAutoHaiTou = () => {
    const startBtn = document.getElementById('btn-start-auto');
    const stopBtn = document.getElementById('btn-stop-auto');
    const collapsedStatus = document.getElementById('collapsed-status');

    const updateCollapsedStatus = (text, cls) => {
        if (collapsedStatus) {
            collapsedStatus.innerHTML = `<span class="${cls || ''}">${text}</span>`;
        }
    };

    // 停止后跳转到基础配置页
    const switchToBasicTab = () => {
        const basicTab = document.querySelector('.boss-tab[data-tab="basic"]');
        if (basicTab) basicTab.click();
    };

    startBtn.addEventListener('click', async () => {
        if (state.autoRunning) return;
        // 跳转到运行日志页面
        const logTab = document.querySelector('.boss-tab[data-tab="log"]');
        if (logTab) logTab.click();

        if (!(await ensureCityFilter())) return;

        // 初始化弹窗Observer、加载会话恢复数据
        __initPopupObserver();
        resetPopupState();
        await BossUtils.loadProcessedJobs();
        await BossUtils.loadAiMatchCache();
        await BossAI.loadDeepMatchLogs();  // 加载AI深度匹配日志

        // 重置统计（每次开始都是新的开始）
        state.stats = { scanned: 0, chatted: 0, skipped: 0 };
        updateStats();

        // 清空运行日志
        const logEl = document.getElementById('log-auto');
        if (logEl) {
            logEl.innerHTML = '';
        }
        await BossUtils.clearRunLogs();

        // 重置中止信号
        resetAbort();
        state.autoRunning = true;
        state.chatCountThisPos = 0;

        startBtn.style.display = 'none';
        stopBtn.style.display = '';
        updateCollapsedStatus('运行中...', 'cs-run');

        logPrint('log-auto', `开始海投`, 'info');
        await humanSleep(1500, 800);

        let emptyCount = 0;
        let bottomHitCount = 0;

        while (state.autoRunning && !isAborted()) {
            // ===== 底部检测 =====
            if (isAtBottom()) {
                bottomHitCount++;
                if (bottomHitCount >= 2) {
                    logPrint('log-auto', '已翻到底部，停止运行', 'info');
                    break;
                }
                await humanSleep(2000, 1000);
                if (isAtBottom()) {
                    logPrint('log-auto', '已翻到底部，停止运行', 'info');
                    break;
                }
            } else {
                bottomHitCount = 0;
            }

            // ===== 系统弹窗检测 =====
            if (isAborted()) break;
            const popup = detectSystemPopup();
            if (popup.detected) {
                logPrint('log-auto', `检测到系统提示框（${popup.reason}），停止运行`, 'fail');
                break;
            }

            // 获取当前可见的职位卡片
            let cards = qsa(SELECTORS.jobCard);
            if (cards.length === 0) cards = qsa(SELECTORS.homeJobCard);
            const fresh = cards.filter(c => !__processedCards.has(c));

            if (fresh.length === 0) {
                emptyCount++;
                if (emptyCount >= 3) {
                    const nextBtn = qs(SELECTORS.nextPage);
                    if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.classList.contains('disabled')) {
                        logPrint('log-auto', '点击下一页', 'info');
                        await BossAntiDetection.simulateHumanClick(nextBtn);
                        await humanSleep(3000, 1500);
                        emptyCount = 0;
                        continue;
                    }
                    logPrint('log-auto', '没有更多职位了，停止运行', 'info');
                    break;
                }
                await BossAntiDetection.simulateScroll('down', randomInt(300, 600));
                await humanSleep(1500, 800);
                continue;
            }

            emptyCount = 0;

            // ===== 依次处理每个卡片 =====
            for (const card of fresh) {
                if (!state.autoRunning || isAborted()) break;

                if (isAtBottom()) {
                    logPrint('log-auto', '已翻到底部，停止运行', 'info');
                    state.autoRunning = false;
                    break;
                }

                const popup = detectSystemPopup();
                if (popup.detected) {
                    logPrint('log-auto', `检测到系统提示框（${popup.reason}），停止运行`, 'fail');
                    state.autoRunning = false;
                    break;
                }

                // 检查单次运行沟通上限
                const maxChats = parseInt(config.maxChatsPerRun) || 0;
                if (maxChats > 0 && state.stats.chatted >= maxChats) {
                    logPrint('log-auto', `已达到单次运行上限（${maxChats}个），停止运行`, 'info');
                    state.autoRunning = false;
                    break;
                }

                __processedCards.add(card);

                try {
                    // 确保卡片在视口内
                    const rect = card.getBoundingClientRect();
                    if (rect.top > window.innerHeight * 0.8 || rect.bottom < 0) {
                        await BossAntiDetection.simulateScroll(rect.top > 0 ? 'down' : 'up',
                            Math.abs(rect.top - window.innerHeight * 0.5));
                        await humanSleep(500, 200);
                    }

                    // ===== 1. 在列表中读取标题 =====
                    const jobEl = qs(SELECTORS.jobName, card) || qs(SELECTORS.homeJobName, card);
                    const jobName = getElementText(jobEl);
                    if (!jobName) continue;

                    // 会话恢复：跳过已处理岗位
                    const companyName = (() => {
                        const el = card.querySelector('.company-name, [class*=company], .boss-name');
                        return el ? getElementText(el) : '';
                    })();
                    const jobKey = `${jobName}|${companyName}`;
                    if (BossUtils.isJobProcessed(jobKey)) {
                        state.stats.scanned++;
                        state.stats.skipped++;
                        updateStats();
                        continue;
                    }

                    // 提取卡片上的地区和薪资信息（用于日志显示）
                    const areaEl = qs(SELECTORS.jobArea, card);
                    const jobArea = areaEl ? getElementText(areaEl) : '';
                    const salaryEl = qs(SELECTORS.salary, card);
                    const salaryRaw = salaryEl ? getElementText(salaryEl) : '';
                    // 薪资含PUA字符时解码
                    const salaryText = salaryRaw ? await BossFilters.decodeBOSSNumber(salaryRaw) : '';

                    // 构建日志详情后缀
                    const logDetail = (() => {
                        const parts = [];
                        if (jobArea) parts.push(jobArea);
                        if (salaryText) parts.push(salaryText);
                        return parts.length > 0 ? ` <span style="color:#6b7280">[${parts.join(' | ')}]</span>` : '';
                    })();

                    // ===== 2. 标题关键词匹配 =====
                    const keywords = BossConfig.getPosKw();
                    if (keywords.length > 0 && !BossFilters.matchJobTitle(jobName, keywords)) {
                        state.stats.scanned++;
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(标题不匹配: <b style="color:#ff6b6b">${escapeHtml(keywords.join('、'))}</b>)</span>`);
                        await humanSleep(randomInt(300, 800), 150);
                        continue;
                    }

                    // 标题排除词
                    if (config.excludeTitle && BossFilters.checkExclude(jobName, config.excludeTitle)) {
                        const matched = BossFilters.findExcludeMatch(jobName, config.excludeTitle);
                        state.stats.scanned++;
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(标题含排除词: <b style="color:#ff6b6b">${escapeHtml(matched || config.excludeTitle)}</b>)</span>`);
                        await humanSleep(randomInt(300, 800), 150);
                        continue;
                    }

                    // 企业黑名单：直接在卡片全文中查找
                    const cardText = getElementText(card);
                    const blacklistMatch = BossFilters.findBlacklistMatch(cardText, config.companyBlacklist);
                    if (blacklistMatch) {
                        state.stats.scanned++;
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(企业黑名单: <b style="color:#ff6b6b">${escapeHtml(blacklistMatch)}</b>)</span>`);
                        await humanSleep(randomInt(300, 800), 150);
                        continue;
                    }

                    state.stats.scanned++;
                    updateStats();

                    // ===== 3. 标题符合，点击进入详情 =====
                    if (isAborted()) break;
                    if (!state.autoRunning || isAborted()) break;
                    await BossAntiDetection.simulateHumanClick(card);
                    await humanSleep(1500, 800);

                    // 等待详情面板加载（查询一次，轮询可见性）
                    let detailBox = null;
                    const detailSelector = SELECTORS.detailBox.join(',');
                    const detailElements = document.querySelectorAll(detailSelector);
                    for (let w = 0; w < 8; w++) {
                        if (isAborted()) break;
                        await humanSleep(1000, 500);
                        for (const el of detailElements) {
                            if (el.offsetParent !== null && el.getBoundingClientRect().height > 100) {
                                detailBox = el;
                                break;
                            }
                        }
                        if (detailBox) break;
                        // 首次未找到，重新查询一次（面板可能延迟插入DOM）
                        if (w === 3) {
                            const fresh = document.querySelectorAll(detailSelector);
                            for (const el of fresh) {
                                if (el.offsetParent !== null && el.getBoundingClientRect().height > 100) {
                                    detailBox = el;
                                    break;
                                }
                            }
                            if (detailBox) break;
                        }
                    }
                    if (isAborted()) break;
                    if (!state.autoRunning || isAborted()) break;

                    if (!detailBox) {
                        state.stats.skipped++;
                        updateStats();
                        logPrint('log-auto', `详情面板未加载`, 'fail');
                        continue;
                    }

                    // ===== 4. 浏览完整JD（随机兴趣因子影响浏览深度） =====
                    const interestLevel = 0.3 + Math.random() * 0.7; // 0.3-1.0
                    await browseFullJD(detailBox, interestLevel);
                    if (isAborted()) break;
                    if (!state.autoRunning || isAborted()) break;

                    // ===== 5. 读取JD，进行剩余判断 =====
                    let descEl = qs(SELECTORS.jobDesc, detailBox);
                    let rawJobDesc = getElementText(descEl);
                    // 回退：选择器未命中时取详情面板全文
                    if (!rawJobDesc) {
                        rawJobDesc = getElementText(detailBox);
                    }
                    // 清理JD，提取核心内容
                    let jobDesc = BossFilters.cleanJobDesc(rawJobDesc);

                    // JD排除词
                    if (config.excludeDesc && jobDesc && BossFilters.checkExclude(jobDesc, config.excludeDesc)) {
                        const matched = BossFilters.findExcludeMatch(jobDesc, config.excludeDesc);
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(JD含排除词: <b style="color:#ff6b6b">${escapeHtml(matched || config.excludeDesc)}</b>)</span>`);
                        await humanSleep(randomInt(200, 500), 100);
                        continue;
                    }

                    // HR活跃状态筛选
                    let hrActiveText = '';
                    const hrActiveEl = qs(SELECTORS.hrActive, card);
                    if (hrActiveEl) hrActiveText = getElementText(hrActiveEl);
                    if (!hrActiveText && detailBox) {
                        const hrInDetail = qs(SELECTORS.hrActive, detailBox);
                        if (hrInDetail) hrActiveText = getElementText(hrInDetail);
                    }
                    if (!hrActiveText) {
                        const hrInfoEl = card.querySelector('.hr-info, .boss-info, [class*=boss]');
                        if (hrInfoEl) {
                            const t = getElementText(hrInfoEl);
                            if (t.includes('活跃') || t.includes('在线')) hrActiveText = t;
                        }
                    }

                    if (!BossConfig.checkHrActiveFilter(hrActiveText)) {
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(HR不活跃: ${escapeHtml(hrActiveText) || '无信息'})</span>`);
                        await humanSleep(randomInt(200, 500), 100);
                        continue;
                    }

                    // 薪资范围检查
                    if (config.salaryMin) {
                        const salaryEl = qs(SELECTORS.salary, card);
                        const salaryText = getElementText(salaryEl);
                        if (salaryText) {
                            const salaryRange = await BossFilters.parseSalaryRange(salaryText);
                            const minSalary = parseFloat(config.salaryMin) || 0;
                            if (salaryRange && salaryRange.max < minSalary) {
                                state.stats.skipped++;
                                updateStats();
                                logPrintHTML('log-auto',
                                    `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(薪资低于 ${minSalary}K)</span>`);
                                await humanSleep(randomInt(200, 500), 100);
                                continue;
                            }
                        }
                    }

                    // ===== 6. AI深度匹配（获取打招呼语） =====
                    let greetingMessage = '';
                    if (config.aiMatchEnabled && jobDesc) {
                        const aiModel = BossConfig.getActiveAiModel();
                        if (!aiModel.apiKey) {
                            if (!state._aiKeyWarned) {
                                logPrint('log-auto', '⚠ AI深度匹配已开启但未配置API Key，已跳过AI匹配', 'fail');
                                state._aiKeyWarned = true;
                            }
                        } else {
                            if (isAborted()) break;

                            // 构建用户画像
                            const userProfile = {
                                positions: BossConfig.getFirstKw(),
                                workSkills: config.workSkills || '',
                                workExperience: config.workExperience || '',
                                otherRequirements: config.otherRequirements || ''
                            };

                            // 检查缓存
                            const deepMatchCacheKey = `deepMatch|${jobName}|${companyName}`;
                            let deepMatchResult = BossUtils.getCachedAiMatch(deepMatchCacheKey);

                            if (deepMatchResult === null) {
                                // 缓存未命中，调用API
                                logPrint('log-auto', `🤖 AI深度匹配中: ${jobName}`, 'info');
                                await humanSleep(500, 300);
                                deepMatchResult = await BossAI.aiDeepMatch(jobName, jobDesc, userProfile);
                                BossUtils.setCachedAiMatch(deepMatchCacheKey, deepMatchResult);
                            }

                            if (!deepMatchResult.isMatch) {
                                state.stats.skipped++;
                                updateStats();
                                logPrintHTML('log-auto',
                                    `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(AI深度不匹配)</span>`);
                                await humanSleep(randomInt(200, 500), 100);
                                continue;
                            }

                            // AI匹配成功，保存打招呼语
                            greetingMessage = deepMatchResult.greetingMessage || '';
                            logPrint('log-auto', `✅ AI匹配成功: ${jobName}`, 'success');
                        }
                    }

                    // ===== 7. 全部通过，点击沟通 =====
                    if (isAborted()) break;
                    if (!state.autoRunning || isAborted()) break;
                    const chatBtn = getChatBtn(card) || getChatBtnD(detailBox);
                    if (!chatBtn) {
                        state.stats.skipped++;
                        updateStats();
                        logPrintHTML('log-auto',
                            `<span style="color:#a9b1d6">跳过</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail} <span style="color:#f59e0b">(按钮不可用)</span>`);
                        await humanSleep(randomInt(200, 500), 100);
                        continue;
                    }

                    let sent = false;
                    if (config.aiMatchEnabled && greetingMessage) {
                        // AI深度匹配模式：发送自定义消息并返回
                        sent = await clickChatAndSendMessage(chatBtn, greetingMessage, jobKey);
                    } else {
                        // 普通模式：点击沟通并留在此页
                        sent = await clickChatAndStay(chatBtn);
                    }

                    state.stats.chatted++;
                    state.chatCountThisPos++;
                    BossUtils.markJobProcessed(jobKey);
                    logPrintHTML('log-auto',
                        `<span style="color:#10b981">✓ 已沟通:</span> <span style="color:#e2e8f0">${escapeHtml(jobName)}</span>${logDetail}`);
                    updateStats();

                    // 休息机制：沟通后检查是否需要休息
                    await BossUtils.checkAndRest(state.stats.chatted);

                    // 沟通后检测弹窗
                    const popup2 = detectSystemPopup();
                    if (popup2.detected) {
                        logPrint('log-auto', `沟通后检测到提示框（${popup2.reason}），停止运行`, 'fail');
                        state.autoRunning = false;
                        break;
                    }

                    // 拟人化：沟通后较长停顿（模拟查看聊天记录、思考下一个）
                    await humanSleep(randomInt(3000, 6000), 1200);

                    // 随机移动鼠标（模拟人在页面上）
                    if (Math.random() < 0.5) {
                        const mx = randomInt(100, window.innerWidth - 100);
                        const my = randomInt(100, window.innerHeight - 100);
                        BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
                        await humanSleep(randomInt(500, 1500), 300);
                    }

                } catch (err) {
                    if (isAborted()) break;
                    const errorMsg = (err && err.message) ? err.message : String(err);
                    state.stats.skipped++;
                    updateStats();
                    logPrint('log-auto', '错误: ' + errorMsg.substring(0, 80), 'fail');
                    await humanSleep(1000, 500);
                }
            }

            // 处理完一批后向下滚动列表
            if (state.autoRunning && !isAborted()) {
                // 拟人化：滚动前的停顿（模拟查看当前页面）
                await humanSleep(randomInt(1500, 3000), 600);

                // 随机移动鼠标
                if (Math.random() < 0.4) {
                    const mx = randomInt(100, window.innerWidth - 100);
                    const my = randomInt(100, window.innerHeight - 100);
                    BossAntiDetection.trustedDispatchEvent(document, BossUtils.createMouseEvent('mousemove', mx, my));
                    await humanSleep(randomInt(300, 800), 200);
                }

                await BossAntiDetection.simulateScroll('down', randomInt(200, 400));
                await humanSleep(randomInt(1500, 2500), 600);
            }
        }

        // 停止
        state.autoRunning = false;
        stopBtn.style.display = 'none';
        startBtn.style.display = '';
        updateCollapsedStatus('已停止', '');
        logPrint('log-auto', `已停止 - 共沟通 ${state.stats.chatted} 个，扫描 ${state.stats.scanned} 个`, 'info');
        switchToBasicTab();
    });

    // 即时停止
    stopBtn.addEventListener('click', () => {
        requestAbort(); // 发送中止信号，所有humanSleep立即返回
        state.autoRunning = false;
        stopBtn.style.display = 'none';
        startBtn.style.display = '';
        updateCollapsedStatus('已停止', '');
        logPrint('log-auto', '已手动停止', 'info');
        switchToBasicTab();
    });
};

// 导出（非枚举）
const BossAutomation = {
    detectSystemPopup,
    resetPopupState,
    isAtBottom,
    ensureCityFilter,
    findDetailScrollContainer,
    scrollInDetail,
    dismissDialogs,
    browseFullJD,
    clickChatAndStay,
    clickChatAndSendMessage,
    loadPendingMessage,
    clearPendingMessage,
    autoSendGreetingMessage,
    initAutoHaiTou
};

if (!window.BossAutomation) {
    Object.defineProperty(window, 'BossAutomation', {
        value: BossAutomation,
        enumerable: false,
        configurable: false,
        writable: false
    });
}
