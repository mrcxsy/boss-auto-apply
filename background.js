// ==========================================
// BOSS直聘 AI海投助手 - 后台 Service Worker
// 处理API请求和基本消息
// ==========================================

// 消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.type === 'ATTACH_DEBUGGER') {
            sendResponse({ success: true });
            return true;
        }

        if (request.type === 'INJECT_INTERCEPTOR') {
            const tabId = sender.tab ? sender.tab.id : request.tabId;
            if (tabId) {
                injectMAIN(tabId)
                    .then(() => sendResponse({ success: true }))
                    .catch(e => sendResponse({ success: false, error: e.message }));
            } else {
                sendResponse({ success: false, error: 'No tabId' });
            }
            return true;
        }

        if (request.type === 'api_request') {
            const { apiUrl, apiKey, model, messages } = request.payload;

            // 超时控制：30秒
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({ model, messages, temperature: 0.7 }),
                signal: controller.signal
            })
            .then(res => {
                clearTimeout(timeoutId);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.choices && data.choices[0]) {
                    sendResponse({ success: true, content: data.choices[0].message.content });
                } else {
                    sendResponse({
                        success: false,
                        error: data.error ? data.error.message : 'API返回异常'
                    });
                }
            })
            .catch(err => {
                clearTimeout(timeoutId);
                const errMsg = err.name === 'AbortError' ? '请求超时(30秒)' : '网络错误: ' + err.message;
                sendResponse({ success: false, error: errMsg });
            });
            return true;
        }
    } catch (e) {
        sendResponse({ success: false, error: e.message });
    }
});

/**
 * 注入MAIN世界脚本
 */
async function injectMAIN(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
                const INSTALLED_KEY = Symbol.for('__boss_ai_installed_v2');
                if (window[INSTALLED_KEY]) return;
                window[INSTALLED_KEY] = true;
            }
        });
    } catch (e) {
        // 静默处理
    }
}
