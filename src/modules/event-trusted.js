// ==========================================
// BOSS直聘 AI海投助手 - 事件可信性拦截
// MAIN world 脚本：在页面上下文中 hook 事件监听器
// 拦截 Event.prototype.isTrusted 原型 getter（非实例覆盖）
// ==========================================

(function() {
    'use strict';

    // 仅在顶层窗口执行
    if (window.top !== window.self) return;

    // ---- 方案：拦截原型级 isTrusted getter ----
    // 官方可通过 Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted').get.call(event) 检测
    // 如果仅在实例上覆盖，原型 getter 仍返回 false
    // 解决方案：hook 原型 getter，对已派发事件集合返回 true

    const trustedEvents = new WeakSet(); // 记录"可信"事件（由我们派发的）

    // 保存原始 getter
    const originalDescriptor = Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted');
    if (!originalDescriptor || !originalDescriptor.get) return; // 安全检查

    const originalGetter = originalDescriptor.get;

    // 拦截 Event.prototype.isTrusted
    Object.defineProperty(Event.prototype, 'isTrusted', {
        get: function() {
            // 如果是已标记的可信事件，返回 true
            if (trustedEvents.has(this)) return true;
            // 否则调用原始 getter
            return originalGetter.call(this);
        },
        configurable: true,
        enumerable: true
    });

    /**
     * 标记事件为可信（在 dispatchEvent 前调用）
     * @param {Event} event - 事件对象
     */
    const markTrusted = (event) => {
        if (event && typeof event === 'object') {
            trustedEvents.add(event);
        }
    };

    // ---- toString 伪装 ----
    // hook 后的 getter 需要伪装 toString
    const origToString = Function.prototype.toString;
    const nativeFunctionString = 'function get isTrusted() { [native code] }';

    // 保护 getter 的 toString
    try {
        const hookedGetter = Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted').get;
        hookedGetter.toString = () => nativeFunctionString;
        hookedGetter.toLocaleString = () => nativeFunctionString;
    } catch (e) { /* ignore */ }

    // ---- addEventListener 包装 ----
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const wrappedHandlers = new WeakMap();

    const wrappedAddEventListener = function(type, listener, options) {
        if (!listener || typeof listener !== 'function') {
            return originalAddEventListener.call(this, type, listener, options);
        }

        const wrapped = function(event) {
            markTrusted(event);
            return listener.call(this, event);
        };

        wrappedHandlers.set(listener, wrapped);
        return originalAddEventListener.call(this, type, wrapped, options);
    };

    EventTarget.prototype.addEventListener = wrappedAddEventListener;

    // toString 伪装
    EventTarget.prototype.addEventListener.toString = () =>
        'function addEventListener() { [native code] }';
    EventTarget.prototype.addEventListener.toLocaleString = () =>
        'function addEventListener() { [native code] }';

    // ---- removeEventListener 包装 ----
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    const wrappedRemoveEventListener = function(type, listener, options) {
        if (!listener) {
            return originalRemoveEventListener.call(this, type, listener, options);
        }
        const wrapped = wrappedHandlers.get(listener) || listener;
        return originalRemoveEventListener.call(this, type, wrapped, options);
    };

    EventTarget.prototype.removeEventListener = wrappedRemoveEventListener;
    EventTarget.prototype.removeEventListener.toString = () =>
        'function removeEventListener() { [native code] }';
    EventTarget.prototype.removeEventListener.toLocaleString = () =>
        'function removeEventListener() { [native code] }';

    // ---- Function.prototype.toString 全局保护 ----
    // 防止官方通过 toString.call(addEventListener) 检测
    Function.prototype.toString = function() {
        if (this === EventTarget.prototype.addEventListener) return 'function addEventListener() { [native code] }';
        if (this === EventTarget.prototype.removeEventListener) return 'function removeEventListener() { [native code] }';
        if (this === Function.prototype.toString) return 'function toString() { [native code] }';
        return origToString.call(this);
    };
    Function.prototype.toString.toString = () => 'function toString() { [native code] }';

    // ---- navigator.webdriver 保护 ----
    // Chrome 自动化环境下 navigator.webdriver 为 true，需隐藏
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true
        });
    } catch (e) { /* ignore */ }

    // ---- navigator.plugins 补全 ----
    // 真实浏览器有 plugins 数组，自动化环境通常为空
    try {
        if (!navigator.plugins || navigator.plugins.length === 0) {
            const fakePlugins = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ];
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const arr = [];
                    fakePlugins.forEach(p => {
                        arr.push(p);
                        arr[p.name] = p;
                    });
                    arr.length = fakePlugins.length;
                    arr.item = (i) => fakePlugins[i] || null;
                    arr.namedItem = (name) => fakePlugins.find(p => p.name === name) || null;
                    arr.refresh = () => {};
                    return arr;
                },
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ---- navigator.mimeTypes 补全 ----
    try {
        if (!navigator.mimeTypes || navigator.mimeTypes.length === 0) {
            const fakeMimeTypes = [
                { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }
            ];
            Object.defineProperty(navigator, 'mimeTypes', {
                get: () => {
                    const arr = [];
                    fakeMimeTypes.forEach(m => {
                        arr.push(m);
                        arr[m.type] = m;
                    });
                    arr.length = fakeMimeTypes.length;
                    arr.item = (i) => fakeMimeTypes[i] || null;
                    arr.namedItem = (type) => fakeMimeTypes.find(m => m.type === type) || null;
                    return arr;
                },
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ---- navigator.languages 一致性保护 ----
    // 确保 navigator.language 与 languages[0] 一致
    try {
        const origLanguages = navigator.languages;
        if (origLanguages && origLanguages.length > 0) {
            Object.defineProperty(navigator, 'language', {
                get: () => origLanguages[0],
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ---- navigator.connection 保护 ----
    // 某些自动化环境缺少 NetworkInformation
    try {
        if (!navigator.connection) {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 50,
                    downlink: 10,
                    saveData: false,
                    type: 'wifi'
                }),
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ---- navigator.permissions 保护 ----
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (desc) => {
                // 对于 notifications，返回 denied（模拟普通用户）
                if (desc && desc.name === 'notifications') {
                    return Promise.resolve({ state: 'denied', onchange: null });
                }
                return origQuery(desc);
            };
        }
    } catch (e) { /* ignore */ }

    // ---- chrome.runtime 保护 ----
    // 检测是否存在 chrome.runtime 暴露（Content Script 特征）
    try {
        if (chrome && chrome.runtime) {
            // 隐藏 chrome.runtime.id（Content Script 特有）
            Object.defineProperty(chrome.runtime, 'id', {
                get: () => undefined,
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ---- 检测自动化标志变量 ----
    // 清除 ChromeDriver/Puppeteer/Selenium 留下的标志
    try {
        // ChromeDriver 标志
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        // Puppeteer 标志
        delete window.__puppeteer_evaluation_script__;
        // Selenium 标志
        delete window.__selenium_unwrapped;
        delete window.__webdriver_evaluate;
        delete window.__driver_evaluate;
        // 通用自动化标志
        delete window.callPhantom;
        delete window._phantom;
        delete window.__nightmare;
        delete window.domAutomation;
        delete window.domAutomationController;
    } catch (e) { /* ignore */ }

    // ---- 暴露辅助接口 ----
    Object.defineProperty(window, '__bossEventInterception', {
        value: {
            markTrusted,
            isActive: true
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
})();
