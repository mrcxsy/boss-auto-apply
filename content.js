// ==========================================
// BOSS直聘 AI海投助手 v1.19.0
// 主入口文件 - 加载所有模块并初始化
// ==========================================

(function() {
    'use strict';

    /**
     * 初始化反检测功能
     */
    const initAntiDetection = () => {
        const signal = BossUtils.getAbortSignal();

        // 1. 随机鼠标移动（接入AbortController）
        BossAntiDetection.startIdleMouseMovement(signal);

        // 2. 模拟页面焦点变化（接入AbortController）
        BossAntiDetection.simulateFocusChanges(signal);

        // 3. rAF时间戳检测防御（接入AbortController）
        if (typeof BossAntiDetection.startRAFDefense === 'function') {
            BossAntiDetection.startRAFDefense(signal);
        }
    };

    /**
     * 检测环境风险
     */
    const checkEnvironmentRisk = () => {
        const risks = [];
        if (navigator.webdriver) risks.push('navigator.webdriver is true');
        if (!window.chrome || !window.chrome.runtime) risks.push('Chrome runtime not found');
        if (window.screen.width < 1024 || window.screen.height < 768) risks.push('Low screen resolution');
        if (!navigator.language.includes('zh')) risks.push('Non-Chinese language');

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const validTimezones = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi', 'Asia/Harbin', 'Asia/Kashgar'];
        if (!validTimezones.some(tz => timezone.includes(tz))) {
            risks.push('Non-Chinese timezone: ' + timezone);
        }

        if (risks.length > 0) BossUtils.safeLog('环境风险: ' + risks.join(', '));

        return {
            hasRisk: risks.length > 0,
            risks,
            score: Math.max(0, 100 - risks.length * 20)
        };
    };

    /**
     * 检查并执行待发送消息（页面跳转后恢复）
     */
    const checkPendingMessage = async () => {
        try {
            BossUtils.safeLog('=== checkPendingMessage 开始 ===');

            // 直接从 storage 读取
            const result = await chrome.storage.local.get('_pendingGreetingMessage');
            BossUtils.safeLog('storage 读取结果: ' + JSON.stringify(result));

            const pending = result._pendingGreetingMessage;
            BossUtils.safeLog('pending 对象: ' + JSON.stringify(pending));

            if (pending && pending.message) {
                // 检查是否过期（超过120秒视为过期）
                const age = Date.now() - pending.timestamp;
                BossUtils.safeLog('消息年龄: ' + age + 'ms (' + (age / 1000).toFixed(1) + '秒)');

                if (age > 120000) {
                    BossUtils.safeLog('消息已过期，清除');
                    await chrome.storage.local.remove('_pendingGreetingMessage');
                    logPrint('log-auto', '⚠ 待发送消息已过期', 'info');
                    return;
                }

                BossUtils.safeLog('检测到待发送消息，准备自动发送');
                logPrint('log-auto', '📝 检测到待发送消息，准备自动发送...', 'info');

                // 等待页面完全加载
                await BossUtils.sleep(2000);

                BossUtils.safeLog('调用 autoSendGreetingMessage...');
                const sendResult = await BossAutomation.autoSendGreetingMessage();
                BossUtils.safeLog('自动发送结果: ' + sendResult);
            } else {
                BossUtils.safeLog('没有待发送消息');
            }

            BossUtils.safeLog('=== checkPendingMessage 完成 ===');
        } catch (e) {
            BossUtils.safeLog('checkPendingMessage 错误: ' + e.message);
            BossUtils.safeLog('错误堆栈: ' + e.stack);
            logPrint('log-auto', '❌ 检查待发送消息失败: ' + e.message, 'fail');
        }
    };

    /**
     * 初始化应用
     */
    const init = async () => {
        try {
            BossUtils.safeLog('=== content.js init 开始 ===');
            BossUtils.safeLog('当前URL: ' + window.location.href);

            // 环境风险检测
            checkEnvironmentRisk();

            // 加载配置
            await loadConfig();
            BossUtils.safeLog('配置加载完成');

            // 加载运行日志
            await BossUtils.loadRunLogs();
            BossUtils.safeLog('运行日志加载完成');

            // 初始化行为配置文件
            await BossUtils.initBehaviorProfile();

            // 初始化反检测功能
            initAntiDetection();

            // 注入UI
            BossUtils.safeLog('准备注入UI...');
            if (document.body) {
                injectUI();
                BossUtils.safeLog('UI注入完成');

                // 检查是否在聊天页面
                const isChat = window.location.href.includes('/web/geek/chat');
                BossUtils.safeLog('是否在聊天页面: ' + isChat);

                if (!isChat) {
                    initAutoHaiTou();
                }

                // 恢复运行日志到页面
                BossUtils.restoreRunLogs();
                BossUtils.safeLog('运行日志恢复完成');
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    injectUI();
                    const isChat = window.location.href.includes('/web/geek/chat');
                    if (!isChat) {
                        initAutoHaiTou();
                    }
                    BossUtils.restoreRunLogs();
                });
            }

            // 检查是否有待发送消息（页面跳转后恢复）
            BossUtils.safeLog('准备检查待发送消息...');
            await checkPendingMessage();
            BossUtils.safeLog('=== content.js init 完成 ===');
        } catch (e) {
            BossUtils.safeLog('init 错误: ' + e.message);
            BossUtils.safeLog('错误堆栈: ' + e.stack);
        }
    };

    init();

})();
