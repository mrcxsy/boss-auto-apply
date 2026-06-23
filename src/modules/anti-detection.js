// ==========================================
// BOSS直聘 AI海投助手 - 反检测模块
// 防检测优化版：鼠标微抖动、过冲、事件属性补全
// IIFE包裹避免与utils.js的全局变量冲突
// ==========================================

(function() {
    'use strict';

    // 延迟引用 BossUtils（加载后可用）
    const U = () => window.BossUtils;

    // 鼠标位置追踪（保证轨迹起点连续）
    let __lastMouseX = null;
    let __lastMouseY = null;

    /**
     * 更新鼠标位置记录
     */
    const updateMousePos = (x, y) => {
        __lastMouseX = x;
        __lastMouseY = y;
    };

    /**
     * 获取上次鼠标位置，无记录则返回随机位置
     */
    const getLastMousePos = () => {
        return {
            x: __lastMouseX !== null ? __lastMouseX : U().randomInt(200, window.innerWidth - 200),
            y: __lastMouseY !== null ? __lastMouseY : U().randomInt(200, window.innerHeight - 200)
        };
    };

    /**
     * 生成随机浮点数（anti-detection 专用）
     */
    const randomFloat = (min, max) => {
        return Math.random() * (max - min) + min;
    };

    // 事件时间戳追踪（防单调性检测）
    let __lastEventTime = 0;

    /**
     * 可信事件派发（isTrusted 绕过）
     * 通过原型级 hook 标记事件为可信，然后 dispatch
     * @param {EventTarget} target - 派发目标元素
     * @param {Event} event - 要派发的事件
     */
    const trustedDispatchEvent = (target, event) => {
        try {
            if (window.__bossEventInterception && window.__bossEventInterception.isActive) {
                window.__bossEventInterception.markTrusted(event);
            }
        } catch (e) { /* ignore */ }

        // 时间戳单调性保护：确保 timeStamp 严格递增
        // 官方可通过 event.timeStamp 检测同一毫秒内多个事件
        try {
            const now = performance.now();
            if (event.timeStamp <= __lastEventTime) {
                // 注入微小偏移，保证递增
                Object.defineProperty(event, 'timeStamp', {
                    value: __lastEventTime + 0.1 + Math.random() * 0.5,
                    configurable: true
                });
            }
            __lastEventTime = event.timeStamp || now;
        } catch (e) { /* ignore */ }

        target.dispatchEvent(event);
    };

    /**
     * 计算 Fitts' Law 移动时间
     * MT = a + b * log2(D/W + 1)
     * D = 距离, W = 目标宽度, a/b = 经验常数
     */
    const calculateFittsDuration = (distance, targetWidth) => {
        // 人类典型参数: a ≈ 100ms, b ≈ 150ms/bit
        const a = 80 + randomFloat(-20, 20); // 基础反应时间
        const b = 130 + randomFloat(-30, 30); // 信息处理速率
        const indexDifficulty = Math.log2(distance / targetWidth + 1);
        return Math.max(150, a + b * indexDifficulty);
    };

    /**
     * 生成惯性漂移（鼠标停在目标附近的微小漂移）
     * 模拟人手在点击前的微小调整
     */
    const generateInertiaDrift = (count = 3) => {
        const drifts = [];
        let driftX = 0, driftY = 0;
        for (let i = 0; i < count; i++) {
            // 漂移逐渐衰减
            const decay = Math.pow(0.6, i);
            driftX += U().gaussianRandom() * 2.5 * decay;
            driftY += U().gaussianRandom() * 2.5 * decay;
            drifts.push({ x: driftX, y: driftY });
        }
        return drifts;
    };

    /**
     * 模拟犹豫行为（接近目标时短暂反向移动）
     * 模拟人类在不确定时的犹豫动作
     */
    const simulateHesitation = async (x, y, prevX, prevY, targetElement) => {
        // 犹豫方向与移动方向相反
        const reverseX = x + (prevX - x) * randomFloat(0.1, 0.3);
        const reverseY = y + (prevY - y) * randomFloat(0.1, 0.3);

        const hesitationSteps = U().randomInt(2, 4);
        for (let i = 0; i < hesitationSteps; i++) {
            const t = i / hesitationSteps;
            const hx = x + (reverseX - x) * t + U().gaussianRandom() * 0.5;
            const hy = y + (reverseY - y) * t + U().gaussianRandom() * 0.5;

            const moveEvent = U().createMouseEvent('mousemove', hx, hy, {
                movementX: hx - x,
                movementY: hy - y
            });
            trustedDispatchEvent(targetElement || document, moveEvent);
            await new Promise(r => setTimeout(r, U().randomInt(20, 50)));
        }
        return { x: reverseX, y: reverseY };
    };

    /**
     * 模拟真实鼠标轨迹（改进版3.0 - Fitts' Law + 惯性漂移 + 动态过冲）
     * - Fitts' Law 定律计算移动时间
     * - 贝塞尔曲线基础轨迹
     * - 高频微抖动（手部颤抖）
     * - 接近目标时减速
     * - 过冲概率随疲劳动态调整
     * - 停止后惯性漂移
     */
    const simulateHumanClick = async (element, options = {}) => {
        if (!element) return false;

        const {
            scrollBehavior = 'smooth',
            moveDuration = null, // null = 自动计算
            clickDelay = 100
        } = options;

        // 1. 滚动到元素附近
        const scrollOptions = {
            block: randomFloat(0.3, 0.7) > 0.5 ? 'center' : 'nearest',
            behavior: scrollBehavior
        };
        element.scrollIntoView(scrollOptions);
        await U().humanSleep(200, 100);

        // 2. 获取元素位置（添加随机偏移）
        const rect = element.getBoundingClientRect();
        const offsetX = randomFloat(-rect.width * 0.2, rect.width * 0.2);
        const offsetY = randomFloat(-rect.height * 0.2, rect.height * 0.2);
        const targetX = rect.left + rect.width / 2 + offsetX;
        const targetY = rect.top + rect.height / 2 + offsetY;

        // 3. 计算 Fitts' Law 移动时间
        const lastPos = getLastMousePos();
        const distance = Math.sqrt(Math.pow(targetX - lastPos.x, 2) + Math.pow(targetY - lastPos.y, 2));
        const targetSize = Math.min(rect.width, rect.height);
        const calculatedDuration = moveDuration || calculateFittsDuration(distance, targetSize);

        // 4. 模拟鼠标移动轨迹（带微抖动和过冲，事件派发在目标元素上）
        await simulateMouseMovement(targetX, targetY, calculatedDuration, element);

        // 5. 惯性漂移（80%概率，模拟点击前的微调）
        if (Math.random() < 0.8) {
            const drifts = generateInertiaDrift(U().randomInt(2, 4));
            for (const drift of drifts) {
                const driftPosX = targetX + drift.x;
                const driftPosY = targetY + drift.y;
                const moveEvent = U().createMouseEvent('mousemove', driftPosX, driftPosY, {
                    movementX: drift.x,
                    movementY: drift.y
                });
                trustedDispatchEvent(element, moveEvent);
                await new Promise(r => setTimeout(r, U().randomInt(15, 40)));
            }
        }

        // 6. 短暂停顿
        await U().humanSleep(clickDelay, 50);

        // 7. 执行点击
        // 对<a>标签临时清除href，防止javascript: URL触发CSP错误
        try {
            const isLink = element.tagName === 'A';
            let savedHref = '';
            if (isLink) {
                savedHref = element.getAttribute('href') || '';
                element.removeAttribute('href');
            }

            const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            let prevX = targetX, prevY = targetY;
            for (const eventType of events) {
                const isDown = eventType.includes('down');
                const evt = U().createMouseEvent(eventType, targetX, targetY, {
                    button: 0,
                    buttons: isDown ? 1 : 0,
                    movementX: targetX - prevX,
                    movementY: targetY - prevY,
                    detail: eventType === 'click' ? 1 : 0,
                    // PointerEvent 特有属性（压力、倾斜）
                    pressure: isDown ? randomFloat(0.3, 0.7) : 0,
                    tiltX: randomFloat(-15, 15),
                    tiltY: randomFloat(-15, 15)
                });
                trustedDispatchEvent(element, evt);
                prevX = targetX;
                prevY = targetY;

                if (eventType !== 'click') {
                    await new Promise(r => setTimeout(r, U().randomInt(10, 30)));
                }
            }

            // 恢复href
            if (isLink && savedHref) {
                element.setAttribute('href', savedHref);
            }

            // 更新鼠标位置记录
            updateMousePos(targetX, targetY);
        } catch (e) {
            return false;
        }

        return true;
    };

    /**
     * 模拟鼠标移动轨迹（改进版3.0 - Fitts' Law + 犹豫 + 动态过冲）
     * 关键改进：
     * - Fitts' Law 驱动的时长计算
     * - 犹豫行为（5%概率）
     * - 过冲概率随疲劳动态调整
     * - dispatch 目标与坐标一致性（防 elementFromPoint 检测）
     */
    const simulateMouseMovement = async (targetX, targetY, duration = 300, targetElement = null) => {
        const lastPos = getLastMousePos();
        const startX = lastPos.x;
        const startY = lastPos.y;

        // 预计算目标元素的边界（用于判断坐标是否在元素内）
        let targetRect = null;
        if (targetElement) {
            try { targetRect = targetElement.getBoundingClientRect(); } catch (e) { /* ignore */ }
        }

        // 过冲概率随疲劳动态调整（基础5%，疲劳时最高15%）
        const fatigueFactor = U().getFatigueFactor();
        const baseOvershootProb = 0.05;
        const fatigueOvershootProb = baseOvershootProb + (fatigueFactor - 1.0) * 0.5;
        const willOvershoot = Math.random() < fatigueOvershootProb;
        const overshootDist = willOvershoot ? randomFloat(8, 30) : 0;
        const overshootAngle = willOvershoot ? Math.random() * Math.PI * 2 : 0;
        const finalTargetX = willOvershoot ? targetX + Math.cos(overshootAngle) * overshootDist : targetX;
        const finalTargetY = willOvershoot ? targetY + Math.sin(overshootAngle) * overshootDist : targetY;

        // 犹豫行为（5%概率，在移动过程中暂停并短暂反向）
        const willHesitate = Math.random() < 0.05;
        const hesitateAt = willHesitate ? randomFloat(0.5, 0.8) : -1;
        let hesitated = false;

        // 生成贝塞尔控制点（增加随机性范围）
        const controlX1 = startX + (finalTargetX - startX) * randomFloat(0.15, 0.45) + U().randomInt(-60, 60);
        const controlY1 = startY + (finalTargetY - startY) * randomFloat(0.1, 0.35) + U().randomInt(-40, 40);
        const controlX2 = startX + (finalTargetX - startX) * randomFloat(0.55, 0.85) + U().randomInt(-40, 40);
        const controlY2 = startY + (finalTargetY - startY) * randomFloat(0.65, 0.95) + U().randomInt(-25, 25);

        // 步数根据距离动态调整
        const moveDistance = Math.sqrt(Math.pow(finalTargetX - startX, 2) + Math.pow(finalTargetY - startY, 2));
        const baseSteps = Math.max(8, Math.min(30, Math.round(moveDistance / 15)));
        const steps = baseSteps + U().randomInt(-3, 3);
        let prevX = startX, prevY = startY;

        /**
         * 根据坐标选择正确的 dispatch 目标
         * 核心原则：elementFromPoint(x, y) 应该能到达 event.target
         */
        const getDispatchTarget = (x, y) => {
            if (!targetElement || !targetRect) return document;
            // 坐标在目标元素边界内（留 5px 容差）→ dispatch 到目标元素
            if (x >= targetRect.left - 5 && x <= targetRect.right + 5 &&
                y >= targetRect.top - 5 && y <= targetRect.bottom + 5) {
                return targetElement;
            }
            // 坐标不在目标元素内 → dispatch 到 document（elementFromPoint 会返回正确的元素）
            return document;
        };

        // 第一阶段：移动到目标（或过冲点）
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // 犹豫行为触发
            if (willHesitate && !hesitated && t >= hesitateAt) {
                hesitated = true;
                await simulateHesitation(prevX, prevY, startX, startY, getDispatchTarget(prevX, prevY));
                await new Promise(r => setTimeout(r, U().randomInt(80, 200)));
            }

            const t2 = t * t;
            const t3 = t2 * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;

            // 三次贝塞尔曲线插值
            let x = mt3 * startX + 3 * mt2 * t * controlX1 + 3 * mt * t2 * controlX2 + t3 * finalTargetX;
            let y = mt3 * startY + 3 * mt2 * t * controlY1 + 3 * mt * t2 * controlY2 + t3 * finalTargetY;

            // 添加高频微抖动（模拟手部颤抖）
            const fatigueJitter = 1.0 + (fatigueFactor - 1.0) * 3;
            const speedJitter = 1.0 + (1.0 - U().__behaviorProfile.speedFactor) * 0.5;
            const jitterAmplitude = 1.2 * fatigueJitter * speedJitter;
            const jitterX = U().gaussianRandom() * jitterAmplitude;
            const jitterY = U().gaussianRandom() * jitterAmplitude;
            x += jitterX;
            y += jitterY;

            // 改进的减速曲线：先加速后减速（更符合人类运动学）
            let speedFactor;
            if (t < 0.2) {
                speedFactor = 1.3 - t * 1.5; // 启动阶段略慢
            } else if (t > 0.8) {
                speedFactor = 1.0 + (t - 0.8) * 3.0; // 接近目标明显减速
            } else if (t > 0.6) {
                speedFactor = 1.0 + (t - 0.6) * 0.5; // 中后段开始减速
            } else {
                speedFactor = 1.0; // 中段匀速
            }
            const stepDuration = (duration / steps) * speedFactor;

            const moveEvent = U().createMouseEvent('mousemove', x, y, {
                movementX: x - prevX,
                movementY: y - prevY
            });
            // 根据坐标选择正确的 dispatch 目标（防 elementFromPoint 检测）
            trustedDispatchEvent(getDispatchTarget(x, y), moveEvent);

            prevX = x;
            prevY = y;
            await new Promise(r => setTimeout(r, stepDuration + U().randomInt(-3, 3)));
        }

        // 第二阶段：过冲回调
        if (willOvershoot) {
            await new Promise(r => setTimeout(r, U().randomInt(50, 150)));

            const returnSteps = U().randomInt(3, 7);
            for (let i = 1; i <= returnSteps; i++) {
                const t = i / returnSteps;
                // 使用 easeOut 缓动使回调更自然
                const easedT = 1 - Math.pow(1 - t, 2);
                const x = finalTargetX + (targetX - finalTargetX) * easedT + U().gaussianRandom() * 0.8;
                const y = finalTargetY + (targetY - finalTargetY) * easedT + U().gaussianRandom() * 0.8;

                const moveEvent = U().createMouseEvent('mousemove', x, y, {
                    movementX: x - prevX,
                    movementY: y - prevY
                });
                trustedDispatchEvent(getDispatchTarget(x, y), moveEvent);

                prevX = x;
                prevY = y;
                await new Promise(r => setTimeout(r, U().randomInt(15, 35)));
            }
        }

        // 更新鼠标位置记录
        updateMousePos(targetX, targetY);
    };

    /**
     * 模拟阅读页面内容（支持兴趣因子）
     * @param {number} minTime - 最短阅读时间ms
     * @param {number} maxTime - 最长阅读时间ms
     * @param {number} interestLevel - 兴趣因子 0.3-1.5，影响滚动次数、模式和停留时间
     */
    const simulateReading = async (minTime = 2000, maxTime = 5000, interestLevel = 1.0) => {
        // 根据兴趣因子缩放阅读时间
        const scaledMin = Math.round(minTime * interestLevel);
        const scaledMax = Math.round(maxTime * interestLevel);
        const readTime = U().randomInt(scaledMin, scaledMax);

        // 兴趣因子影响滚动次数：高兴趣多滚动，低兴趣快速滑过
        const maxScrolls = Math.max(1, Math.round(5 * interestLevel));
        const scrollCount = U().randomInt(Math.max(1, maxScrolls - 2), maxScrolls);
        for (let i = 0; i < scrollCount; i++) {
            // 根据兴趣因子选择滚动模式
            await simulateScroll('down', U().randomInt(100, 300), {
                interestLevel: interestLevel
            });
            // 高兴趣时阅读间隔更长（仔细看）
            const readPause = interestLevel > 1.0 ?
                U().randomInt(600, 1200) : U().randomInt(300, 600);
            await U().humanSleep(readPause, readPause * 0.3);
        }

        // 鼠标随机移动（模拟视线移动）
        const mouseMoveCount = interestLevel > 1.0 ?
            U().randomInt(3, 6) : U().randomInt(1, 3);
        for (let i = 0; i < mouseMoveCount; i++) {
            const x = U().randomInt(100, window.innerWidth - 100);
            const y = U().randomInt(100, window.innerHeight - 100);
            trustedDispatchEvent(document, U().createMouseEvent('mousemove', x, y));
            await U().humanSleep(150, 80);
        }

        return readTime;
    };

    /**
     * 生成随机停顿时间
     */
    const getRandomPause = (action = 'default') => {
        const pauses = {
            'before_click': () => U().randomInt(300, 800),
            'after_click': () => U().randomInt(500, 1500),
            'before_scroll': () => U().randomInt(200, 600),
            'after_scroll': () => U().randomInt(300, 1000),
            'between_cards': () => U().randomInt(2000, 5000),
            'page_load': () => U().randomInt(3000, 6000),
            'typing_char': () => U().randomInt(50, 200),
            'typing_word': () => U().randomInt(200, 500),
            'thinking': () => U().randomInt(1000, 3000),
            'default': () => U().randomInt(500, 1500)
        };

        const pauseFn = pauses[action] || pauses['default'];
        return pauseFn();
    };

    /**
     * 添加随机鼠标移动（页面空闲时）
     */
    const startIdleMouseMovement = (signal) => {
        const moveRandomly = () => {
            if (signal && signal.aborted) return;
            if (Math.random() < 0.3) {
                const x = U().randomInt(50, window.innerWidth - 50);
                const y = U().randomInt(50, window.innerHeight - 50);
                trustedDispatchEvent(document, U().createMouseEvent('mousemove', x, y));
            }
        };

        // 使用随机间隔
        const scheduleNext = () => {
            if (signal && signal.aborted) return;
            const delay = U().randomInt(3000, 8000);
            setTimeout(() => {
                moveRandomly();
                scheduleNext();
            }, delay);
        };
        scheduleNext();
    };

    /**
     * 模拟页面焦点变化
     */
    const simulateFocusChanges = (signal) => {
        const scheduleNext = () => {
            if (signal && signal.aborted) return;
            const delay = U().randomInt(10000, 30000);
            setTimeout(() => {
                if (signal && signal.aborted) return;
                if (Math.random() < 0.1) {
                    // 模拟切走：blur + visibilitychange
                    trustedDispatchEvent(window, new Event('blur'));
                    trustedDispatchEvent(document, new Event('visibilitychange'));

                    const focusDelay = U().randomInt(500, 3000);
                    setTimeout(() => {
                        if (signal && signal.aborted) return;
                        // 模拟切回：focus + visibilitychange
                        trustedDispatchEvent(window, new Event('focus'));
                        trustedDispatchEvent(document, new Event('visibilitychange'));
                    }, focusDelay);
                }
                scheduleNext();
            }, delay);
        };
        scheduleNext();
    };

    /**
     * rAF时间戳检测防御（改进版 - 模拟真实渲染循环）
     * 偶尔执行轻量DOM读取操作，模拟正常页面渲染的副作用
     */
    const startRAFDefense = (signal) => {
        let lastRAFTime = 0;
        let frameCount = 0;
        let readInterval = U().randomInt(30, 80);
        const rafCallback = (timestamp) => {
            if (signal && signal.aborted) return;
            frameCount++;
            const delta = timestamp - lastRAFTime;

            // 模拟真实渲染：每帧间隔应约为16.67ms，允许合理波动
            if (delta > 10) {
                lastRAFTime = timestamp;
            }

            // 每30-80帧执行一次轻量DOM读取（模拟布局计算）
            if (frameCount % readInterval === 0) {
                try {
                    void document.body.offsetHeight;
                    void document.documentElement.scrollTop;
                } catch (e) { /* ignore */ }
                readInterval = U().randomInt(30, 80);
            }

            requestAnimationFrame(rafCallback);
        };
        requestAnimationFrame(rafCallback);
    };

    // ---- 增强版打字/滚动模拟（从utils.js迁移） ----

    /**
     * 检测是否为中文文本
     */
    const isChineseText = (text) => {
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 0x4E00 && code <= 0x9FFF) return true;
        }
        return false;
    };

    /**
     * 将文本分割为词组段落
     */
    const splitIntoSegments = (text) => {
        const segments = [];
        const regex = /([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*)|([^\s\w])/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ text: text.slice(lastIndex, match.index), isBoundary: true });
            }
            if (match[1]) {
                segments.push({ text: match[1], isBoundary: false });
                segments.push({ text: ' ', isBoundary: true });
            } else if (match[2]) {
                segments.push({ text: match[2], isBoundary: false });
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            segments.push({ text: text.slice(lastIndex), isBoundary: false });
        }
        return segments;
    };

    /**
     * 分发键盘事件（完整版：包含 keyCode/charCode/which 三件套）
     * 官方可通过检查这三个废弃属性是否全为0来判定伪造事件
     */
    const dispatchKeyEvents = (element, char) => {
        const isSpecial = char === 'Backspace' || char === 'Enter';
        const key = isSpecial ? char : char;
        const charCode = isSpecial ? (char === 'Backspace' ? 8 : 13) : char.charCodeAt(0);
        const keyCode = charCode;

        // 根据字符类型生成正确的code
        let code;
        if (isSpecial) {
            code = char;
        } else if (/^[a-zA-Z]$/.test(char)) {
            code = `Key${char.toUpperCase()}`;
        } else if (/^\d$/.test(char)) {
            code = `Digit${char}`;
        } else {
            code = '';
        }

        const keyEventProps = {
            key, code, bubbles: true, cancelable: true,
            // 废弃但广泛使用的属性（反检测重点检查对象）
            keyCode: keyCode,
            charCode: isSpecial ? 0 : charCode,
            which: keyCode,
            // 键盘位置（标准布局）
            location: 0,
            // 不是长按触发
            repeat: false
        };

        trustedDispatchEvent(element, new KeyboardEvent('keydown', keyEventProps));

        if (!isSpecial) {
            if (element.isContentEditable) {
                // 使用 insertText 命令触发浏览器原生编辑行为
                // 优先尝试 execCommand（兼容性最好），回退到直接操作
                try {
                    document.execCommand('insertText', false, char);
                } catch (e) {
                    // execCommand 失败时回退
                    element.textContent += char;
                }
            } else {
                element.value += char;
            }
            trustedDispatchEvent(element, new InputEvent('input', {
                bubbles: true, inputType: 'insertText', data: char
            }));
        }

        trustedDispatchEvent(element, new KeyboardEvent('keyup', {
            key, code, bubbles: true, cancelable: true,
            keyCode: keyCode, charCode: 0, which: keyCode, location: 0, repeat: false
        }));
    };

    /**
     * 获取键盘上相邻的字符（模拟打错）
     */
    const getRandomCharNear = (char) => {
        const neighbors = {
            'a': 'sqwz', 'b': 'vghn', 'c': 'xdfv', 'd': 'sfcer', 'e': 'wrds',
            'f': 'dgrtv', 'g': 'fhtyb', 'h': 'gjyun', 'i': 'ujko', 'j': 'hkuim',
            'k': 'jloi', 'l': 'kop', 'm': 'njk', 'n': 'bhjm', 'o': 'iklp',
            'p': 'ol', 'q': 'wa', 'r': 'edft', 's': 'awedxz', 't': 'rfgy',
            'u': 'yhji', 'v': 'cfgb', 'w': 'qase', 'x': 'zsdc', 'y': 'tghu',
            'z': 'asx'
        };
        const lower = char.toLowerCase();
        const near = neighbors[lower];
        if (near) {
            return near[Math.floor(Math.random() * near.length)];
        }
        return char;
    };

    /**
     * 模拟真实打字输入（增强版 - 词组节奏、偶尔打错、中文输入法模拟）
     */
    const simulateTyping = async (element, text) => {
        if (!element || !text) return false;

        try {
            element.focus();
            await U().humanSleep(100, 30);

            // 清空现有内容
            if (element.isContentEditable) {
                element.textContent = '';
                element.innerHTML = '';
            } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                element.value = '';
            }
            trustedDispatchEvent(element, new Event('input', { bubbles: true }));
            await U().humanSleep(50, 20);

            const isChinese = isChineseText(text);
            const typingFactor = U().__behaviorProfile.typingFactor;
            const segments = splitIntoSegments(text);

            for (let si = 0; si < segments.length; si++) {
                const segment = segments[si];
                const isWordBoundary = segment.isBoundary;

                for (let i = 0; i < segment.text.length; i++) {
                    const char = segment.text[i];

                    // 模拟偶尔打错字并退格（5%概率）
                    if (Math.random() < 0.05 && i > 0 && i < segment.text.length - 1) {
                        const wrongChar = getRandomCharNear(char);
                        dispatchKeyEvents(element, wrongChar);
                        await new Promise(r => setTimeout(r, U().randomInt(30, 80) * typingFactor));

                        dispatchKeyEvents(element, 'Backspace');
                        // 额外的 Backspace 事件（保留 keyCode/which）
                        const backspaceProps = {
                            key: 'Backspace', code: 'Backspace', bubbles: true, cancelable: true,
                            keyCode: 8, charCode: 0, which: 8, location: 0, repeat: false
                        };
                        trustedDispatchEvent(element, new KeyboardEvent('keydown', backspaceProps));
                        if (element.isContentEditable) {
                            document.execCommand('delete');
                        } else {
                            element.value = element.value.slice(0, -1);
                        }
                        trustedDispatchEvent(element, new KeyboardEvent('keyup', backspaceProps));
                        await new Promise(r => setTimeout(r, U().randomInt(50, 120) * typingFactor));
                    }

                    // 正常输入字符
                    dispatchKeyEvents(element, char);

                    // 打字间隔：词内快，词间慢
                    let charDelay;
                    if (isChinese) {
                        charDelay = U().randomInt(40, 120) * typingFactor;
                        if (i > 0 && i % U().randomInt(2, 5) === 0) {
                            charDelay += U().randomInt(100, 300) * typingFactor;
                        }
                    } else {
                        if (isWordBoundary) {
                            charDelay = U().randomInt(150, 400) * typingFactor;
                        } else {
                            charDelay = U().randomInt(30, 100) * typingFactor;
                        }
                    }

                    await new Promise(r => setTimeout(r, charDelay));

                    // 偶尔思考停顿（受注意力因子影响）
                    const thinkProb = 0.05 / U().__behaviorProfile.attentionFactor;
                    if (Math.random() < thinkProb) {
                        await U().humanSleep(300, 200);
                    }
                }

                // 词组之间的额外停顿
                if (isWordBoundary && si < segments.length - 1) {
                    await new Promise(r => setTimeout(r, U().randomInt(100, 300) * typingFactor));
                }
            }

            trustedDispatchEvent(element, new Event('change', { bubbles: true }));
            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * 模拟人类滚动（增强版3.0 - 多种滚动模式 + 回滚 + 触控板模拟）
     * 支持多种滚动模式：
     * - 快速扫视（ease-in）：快速浏览列表
     * - 仔细阅读（ease-out）：逐行阅读内容
     * - 触控板模拟：多段小滚动 + 停顿
     * - 回滚行为：偶尔向上滚动再回来
     */
    const simulateScroll = async (direction = 'down', distance = null, options = {}) => {
        const {
            mode = 'auto', // 'auto' | 'fast_scan' | 'careful_read' | 'touchpad'
            interestLevel = 1.0 // 兴趣因子，影响滚动模式选择
        } = options;

        // 自动选择滚动模式
        let scrollMode = mode;
        if (mode === 'auto') {
            const rand = Math.random();
            if (interestLevel < 0.5) {
                scrollMode = rand < 0.7 ? 'fast_scan' : 'touchpad';
            } else if (interestLevel > 1.2) {
                scrollMode = rand < 0.6 ? 'careful_read' : 'touchpad';
            } else {
                scrollMode = rand < 0.4 ? 'fast_scan' : (rand < 0.7 ? 'careful_read' : 'touchpad');
            }
        }

        const scrollDistance = distance || U().randomInt(200, 500);
        const actualDistance = direction === 'down' ? scrollDistance : -scrollDistance;

        // 根据模式选择缓动函数和步数
        let steps, easeFn, stepDelayBase;
        switch (scrollMode) {
            case 'fast_scan':
                // 快速扫视：步数少，ease-in 缓动（先慢后快）
                steps = U().randomInt(4, 8);
                easeFn = (t) => t * t; // ease-in
                stepDelayBase = U().randomInt(15, 25);
                break;
            case 'careful_read':
                // 仔细阅读：步数多，ease-out 缓动（先快后慢）
                steps = U().randomInt(10, 18);
                easeFn = (t) => 1 - Math.pow(1 - t, 3); // ease-out
                stepDelayBase = U().randomInt(30, 50);
                break;
            case 'touchpad':
                // 触控板模拟：多段小滚动，线性缓动
                steps = U().randomInt(8, 15);
                easeFn = (t) => t; // linear
                stepDelayBase = U().randomInt(20, 35);
                break;
            default:
                steps = U().randomInt(6, 12);
                easeFn = (t) => 1 - Math.pow(1 - t, 3);
                stepDelayBase = U().randomInt(20, 40);
        }

        // 偶尔回滚行为（8%概率，在阅读模式下更高）
        const willScrollBack = Math.random() < (scrollMode === 'careful_read' ? 0.12 : 0.08);
        const scrollBackAt = willScrollBack ? randomFloat(0.3, 0.7) : -1;
        let scrolledBack = false;

        for (let i = 0; i < steps; i++) {
            const t1 = i / steps;
            const t2 = (i + 1) / steps;
            const stepDistance = actualDistance * (easeFn(t2) - easeFn(t1));
            const jitter = U().randomInt(-5, 5);

            // 回滚行为触发
            if (willScrollBack && !scrolledBack && t1 >= scrollBackAt) {
                scrolledBack = true;
                // 向上滚动一小段
                const backDistance = actualDistance * randomFloat(0.1, 0.25);
                const backSteps = U().randomInt(2, 4);
                for (let j = 0; j < backSteps; j++) {
                    const backStep = -backDistance / backSteps;
                    const wheelDeltaY = backStep > 0 ? U().randomInt(80, 120) : U().randomInt(-120, -80);
                    const wheelEvent = new WheelEvent('wheel', {
                        bubbles: true, cancelable: true, composed: true,
                        deltaY: wheelDeltaY, deltaMode: 0,
                        clientX: U().randomInt(100, window.innerWidth - 100),
                        clientY: U().randomInt(100, window.innerHeight - 100)
                    });
                    trustedDispatchEvent(document, wheelEvent);
                    window.scrollBy({ top: backStep, behavior: 'auto' });
                    await new Promise(r => setTimeout(r, U().randomInt(15, 30)));
                }
                // 回滚后短暂停顿
                await U().humanSleep(200, 100);
            }

            const wheelDeltaY = stepDistance > 0 ? U().randomInt(80, 150) : U().randomInt(-150, -80);
            const wheelEvent = new WheelEvent('wheel', {
                bubbles: true, cancelable: true, composed: true,
                deltaY: wheelDeltaY, deltaMode: 0,
                clientX: U().randomInt(100, window.innerWidth - 100),
                clientY: U().randomInt(100, window.innerHeight - 100)
            });
            trustedDispatchEvent(document, wheelEvent);

            window.scrollBy({ top: stepDistance + jitter, behavior: 'auto' });

            // 步数越多，延迟越小（模拟触控板连续滚动）
            const stepDelay = stepDelayBase + (i * 3) + U().randomInt(-3, 3);
            await new Promise(r => setTimeout(r, stepDelay));

            // 触控板模式下更频繁的停顿
            const pauseProb = scrollMode === 'touchpad' ? 0.18 : 0.12;
            if (Math.random() < pauseProb) {
                const pauseDuration = scrollMode === 'careful_read' ?
                    U().randomInt(500, 1200) : U().randomInt(300, 600);
                await U().humanSleep(pauseDuration, pauseDuration * 0.3);
            }
        }
    };

    // 导出反检测模块（非枚举）
    const BossAntiDetection = {
        randomFloat,
        simulateHumanClick,
        simulateMouseMovement,
        simulateReading,
        getRandomPause,
        startIdleMouseMovement,
        simulateFocusChanges,
        startRAFDefense,
        updateMousePos,
        getLastMousePos,
        trustedDispatchEvent,
        // Fitts' Law 相关
        calculateFittsDuration,
        generateInertiaDrift,
        simulateHesitation,
        // 打字/滚动模拟（增强版）
        simulateTyping,
        simulateScroll,
        // 兼容旧名（指向增强版）
        simulateHumanTyping: simulateTyping,
        simulateHumanScroll: simulateScroll,
        // 工具函数
        isChineseText,
        splitIntoSegments,
        dispatchKeyEvents,
        getRandomCharNear
    };

    if (!window.BossAntiDetection) {
        Object.defineProperty(window, 'BossAntiDetection', {
            value: BossAntiDetection,
            enumerable: false,
            configurable: false,
            writable: false
        });
    }

})();
