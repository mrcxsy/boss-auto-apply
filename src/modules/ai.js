// ==========================================
// BOSS直聘 AI海投助手 - AI功能模块
// 支持多模型切换
// ==========================================

/**
 * 发送API请求（带重试）
 * @param {object} options - API请求参数
 * @param {number} maxRetries - 最大重试次数（默认1，即共请求2次）
 */
const sendApiRequest = (options, maxRetries = 1) => {
    const attempt = (retriesLeft) => {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({
                    type: 'api_request',
                    payload: options
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        if (retriesLeft > 0) {
                            setTimeout(() => attempt(retriesLeft - 1).then(resolve), 1000);
                        } else {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                        }
                        return;
                    }
                    if (response && response.success) {
                        resolve({ success: true, content: response.content });
                    } else {
                        const errMsg = response?.error || '请求失败';
                        // 超时或网络错误时重试
                        if (retriesLeft > 0 && (errMsg.includes('超时') || errMsg.includes('网络错误'))) {
                            setTimeout(() => attempt(retriesLeft - 1).then(resolve), 1500);
                        } else {
                            resolve({ success: false, error: errMsg });
                        }
                    }
                });
            } catch (e) {
                if (retriesLeft > 0) {
                    setTimeout(() => attempt(retriesLeft - 1).then(resolve), 1000);
                } else {
                    resolve({ success: false, error: e.message });
                }
            }
        });
    };
    return attempt(maxRetries);
};

// AI深度匹配日志（最近10条）
const __aiDeepMatchLogs = [];
const __AI_DEEP_MATCH_LOGS_KEY = '_aiDeepMatchLogs';
const __AI_DEEP_MATCH_LOGS_MAX = 10;

/**
 * 加载AI深度匹配日志（从storage恢复）
 */
const loadDeepMatchLogs = async () => {
    try {
        const result = await chrome.storage.local.get(__AI_DEEP_MATCH_LOGS_KEY);
        if (result[__AI_DEEP_MATCH_LOGS_KEY]) {
            __aiDeepMatchLogs.length = 0;
            result[__AI_DEEP_MATCH_LOGS_KEY].forEach(log => __aiDeepMatchLogs.push(log));
        }
    } catch (e) { BossUtils.safeLog('loadDeepMatchLogs失败: ' + e.message); }
};

/**
 * 保存AI深度匹配日志到storage
 */
const saveDeepMatchLogs = async () => {
    try {
        await chrome.storage.local.set({ [__AI_DEEP_MATCH_LOGS_KEY]: __aiDeepMatchLogs });
    } catch (e) { BossUtils.safeLog('saveDeepMatchLogs失败: ' + e.message); }
};

/**
 * 添加AI深度匹配日志
 * @param {object} logEntry - 日志条目
 */
const addDeepMatchLog = async (logEntry) => {
    __aiDeepMatchLogs.unshift(logEntry);  // 添加到开头
    // 限制日志数量
    while (__aiDeepMatchLogs.length > __AI_DEEP_MATCH_LOGS_MAX) {
        __aiDeepMatchLogs.pop();
    }
    await saveDeepMatchLogs();
};

/**
 * 获取AI深度匹配日志
 * @returns {Array} 日志数组
 */
const getDeepMatchLogs = () => __aiDeepMatchLogs;

/**
 * 导出AI深度匹配日志为JSON字符串
 * @returns {string} JSON字符串
 */
const exportDeepMatchLogs = () => {
    return JSON.stringify(__aiDeepMatchLogs, null, 2);
};

/**
 * 清空AI深度匹配日志
 */
const clearDeepMatchLogs = async () => {
    __aiDeepMatchLogs.length = 0;
    try {
        await chrome.storage.local.remove(__AI_DEEP_MATCH_LOGS_KEY);
    } catch (e) { BossUtils.safeLog('clearDeepMatchLogs失败: ' + e.message); }
};

/**
 * AI深度匹配（返回结构化JSON）
 * @param {string} jobName - 职位名称
 * @param {string} jobDesc - 职位描述（JD）
 * @param {object} userProfile - 用户画像 {positions, workSkills, workExperience, otherRequirements}
 * @returns {Promise<{isMatch: boolean, greetingMessage: string}>}
 */
const aiDeepMatch = async (jobName, jobDesc, userProfile) => {
    const model = getActiveAiModel();
    if (!model.apiKey) return { isMatch: false, greetingMessage: '' };

    const prompt = `你是一个招聘筛选助手。请根据以下信息判断该职位是否与用户匹配，并生成个性化打招呼语。

## 用户画像
- 期望岗位关键词：${userProfile.positions || '无'}
- 工作技能：${userProfile.workSkills || '无'}
- 工作经历：${userProfile.workExperience || '无'}
- 其它要求：${userProfile.otherRequirements || '无'}

## 职位信息
- 职位名称：${jobName}
- 职位描述：${(jobDesc || '').substring(0, 1500)}

## 匹配策略
采用乐观匹配原则：
- JD中明确拒绝用户要求的情况（如JD写"需出差"而用户要求"不出差"），才判定为不匹配
- JD中未提及的内容（如用户要求"双休"但JD未写明），默认视为可能满足，判定为匹配
- 只有岗位、技能、经验明显不匹配，或JD明确违反用户要求时，才判定为不匹配

## 要求
1. 判断该职位是否与用户匹配（考虑岗位、技能、经验、要求等因素）
2. 如果匹配，生成一段简洁、专业、有亲和力的打招呼语（30-80字）
3. 如果不匹配，打招呼语为空字符串

请严格按照以下JSON格式返回，不要包含任何其他内容：
{"isMatch": true/false, "greetingMessage": "打招呼语"}`;

    const startTime = Date.now();
    let logEntry = {
        timestamp: new Date().toISOString(),
        jobName: jobName,
        jobDesc: (jobDesc || '').substring(0, 500) + ((jobDesc || '').length > 500 ? '...' : ''),
        userProfile: userProfile,
        prompt: prompt,
        response: null,
        result: null,
        duration: 0,
        error: null
    };

    try {
        const result = await sendApiRequest({
            apiUrl: model.apiUrl,
            apiKey: model.apiKey,
            model: model.model,
            messages: [
                { role: 'system', content: '你是招聘筛选助手，只返回JSON格式结果。' },
                { role: 'user', content: prompt }
            ]
        });

        logEntry.duration = Date.now() - startTime;
        logEntry.response = result.content || '';

        if (result.success) {
            try {
                // 尝试解析JSON
                const content = (result.content || '').trim();
                // 提取JSON部分（可能被包裹在```json```中）
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const json = JSON.parse(jsonMatch[0]);
                    logEntry.result = {
                        isMatch: !!json.isMatch,
                        greetingMessage: json.greetingMessage || ''
                    };
                    await addDeepMatchLog(logEntry);
                    return logEntry.result;
                }
            } catch (parseErr) {
                // JSON解析失败，尝试提取关键信息
                const content = (result.content || '').trim();
                const isMatch = content.includes('"isMatch": true') || content.includes('"isMatch":true');
                logEntry.result = { isMatch, greetingMessage: '' };
                logEntry.error = 'JSON解析失败';
                await addDeepMatchLog(logEntry);
                return logEntry.result;
            }
        }
        logEntry.result = { isMatch: false, greetingMessage: '' };
        logEntry.error = 'API请求失败';
        await addDeepMatchLog(logEntry);
        return logEntry.result;
    } catch (e) {
        logEntry.duration = Date.now() - startTime;
        logEntry.result = { isMatch: false, greetingMessage: '' };
        logEntry.error = e.message || '未知错误';
        await addDeepMatchLog(logEntry);
        return logEntry.result;
    }
};

/**
 * AI扩展关键词
 */
const aiExpandKeywords = async (inputText) => {
    const model = getActiveAiModel();
    if (!model.apiKey) return [];

    const prompt = `你是招聘网站BOSS直聘的岗位名称专家，请根据用户输入的岗位名称，列出BOSS直聘上常见的相关职位名称。每行一个，不要序号和解释。

用户输入：${inputText}`;

    try {
        const result = await sendApiRequest({
            apiUrl: model.apiUrl,
            apiKey: model.apiKey,
            model: model.model,
            messages: [
                { role: 'system', content: '你是招聘岗位名称分析专家，只输出岗位名称，每行一个。' },
                { role: 'user', content: prompt }
            ]
        });

        if (result.success) {
            const lines = (result.content || '')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.match(/^\d+[.）)]/) && l.length > 1);
            return lines;
        }
        return [];
    } catch (e) {
        return [];
    }
};

// 导出AI模块（非枚举）
const BossAI = {
    sendApiRequest,
    aiDeepMatch,
    aiExpandKeywords,
    loadDeepMatchLogs,
    getDeepMatchLogs,
    exportDeepMatchLogs,
    clearDeepMatchLogs
};

if (!window.BossAI) {
    Object.defineProperty(window, 'BossAI', {
        value: BossAI,
        enumerable: false,
        configurable: false,
        writable: false
    });
}
