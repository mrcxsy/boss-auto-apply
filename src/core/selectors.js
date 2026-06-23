// ==========================================
// BOSS直聘 AI海投助手 - DOM选择器常量
// 防检测优化版：非枚举导出
// ==========================================

const SELECTORS = {
    jobCard: [
        '.job-card-wrapper',
        '.job-card-box',
        '[class*=job-card]',
        '.job-primary',
        'li.job-card',
        'div[data-jobid]'
    ],

    jobName: [
        '.job-name',
        '.job-title',
        '[class*=job-name]',
        '.job-card-left .name',
        'a .job-title'
    ],

    companyName: [
        '.company-name',
        '[class*=company-name]',
        '[class*=company-text]',
        '[class*=brand-name]',
        '.company-info a',
        '.company-info .name',
        'a[class*=company]'
    ],

    chatBtn: [
        'a.op-btn-chat',
        '.op-btn-chat',
        'a[class*=op-btn-chat]',
        '.btn-startchat',
        'button[class*=chat]'
    ],

    chatBtnTexts: [
        '立即沟通',
        '继续沟通',
        '立即打招呼',
        '继续打招呼',
        '聊一下',
        '立即聊一下'
    ],

    nextPage: [
        '.ui-icon-arrow-right',
        'a .ui-icon-arrow-right',
        'a[class*=next]',
        'button[class*=next]'
    ],

    chatInput: [
        '#chat-input',
        'div[contenteditable=true][class*=chat-input]',
        '[contenteditable=true]',
        'textarea[placeholder*="说点什么"]',
        'div[class*=chat-input]',
        'div[class*=input][contenteditable]',
        'textarea[class*=chat]'
    ],

    sendBtn: [
        '.btn-send',
        'button[class*=btn-send]',
        '.chat-send',
        'button[class*=send]',
        'button[class*=submit]',
        'div[class*=send-btn]'
    ],

    detailBox: [
        '.job-detail-box',
        '.job-detail',
        '[class*=job-detail]',
        '.detail-content'
    ],

    stayBtn: [
        'a.btn-cancel',
        'a[class*=cancel]',
        'button[class*=cancel]',
        '.dialog-close'
    ],

    chatBlockDialog: [
        '.dialog-box',
        '.dialog',
        '[class*=dialog]',
        '.modal'
    ],

    closeBtn: [
        'button.btn-close',
        '.dialog-close',
        '.close-btn',
        '.dialog [class*=close]',
        '.modal [class*=close]',
        '.btn-cancel',
        'a.btn-cancel'
    ],

    homeJobCard: [
        '[class*=recommend-card]',
        '[class*=geek-card]',
        '[class*=home-job]'
    ],

    homeJobName: [
        '[class*=job-title]',
        '[class*=job-name]',
        '[class*=title-text]'
    ],

    homeCompany: [
        '[class*=company-name]',
        '[class*=company-title]',
        '[class*=brand-name]'
    ],

    homeChatBtn: [
        '[class*=chat-btn]',
        '[class*=contact-btn]',
        'button[class*=chat]'
    ],

    jobArea: [
        '.job-area',
        '[class*=job-area]',
        '[class*=job-area] span',
        '.job-card-wrapper .job-area',
        '.info-public .job-area'
    ],

    salary: [
        '[class*=salary]',
        '.job-salary',
        '.job-card-box .money',
        '[class*=money]',
        '.job-card-left [class*=salary]',
        '.job-primary [class*=salary]'
    ],

    postTime: [
        '[class*=job-time]',
        '.job-time',
        '.job-info [class*=time]',
        '.job-card-footer [class*=time]',
        '[class*=post-time]',
        '[class*=publish-time]',
        '[class*=date]'
    ],

    hrActive: [
        '[class*=hr-active]',
        '[class*=active-time]',
        '[class*=last-active]',
        '.hr-info [class*=active]',
        '.job-card-wrapper [class*=active]',
        '[class*=active-status]',
        '.boss-name .active-text',
        '.hr-info-text',
        '[class*=online]',
        '.job-card-footer [class*=active]'
    ],

    jobDesc: [
        '.job-sec-text',
        '.job-detail-section .text',
        '[class*=job-sec] .text',
        '.detail-content .text',
        '[class*=job-detail] [class*=text]',
        '.job-detail .text',
        '[class*=desc]',
        '.job-sec .text'
    ]
};

// 城市代码映射
const CITY_CODES = {
    '北京': '101010100', '上海': '101020100', '广州': '101280100', '深圳': '101280600',
    '成都': '101270100', '杭州': '101210100', '南京': '101190100', '武汉': '101200100',
    '重庆': '101040100', '西安': '101110100', '苏州': '101190400', '天津': '101030100',
    '长沙': '101250100', '郑州': '101180100', '东莞': '101281600', '青岛': '101120200',
    '沈阳': '101070100', '宁波': '101210400', '昆明': '101290100', '大连': '101070200',
    '厦门': '101230200', '合肥': '101220100', '佛山': '101280300', '福州': '101230100',
    '哈尔滨': '101050100', '济南': '101120100', '温州': '101211000', '长春': '101060100',
    '石家庄': '101090100', '常州': '101191100', '泉州': '101230500', '南宁': '101300100',
    '贵阳': '101260100', '南昌': '101240100', '太原': '101100100', '烟台': '101120500',
    '嘉兴': '101210300', '南通': '101190500', '金华': '101210900', '珠海': '101280700',
    '惠州': '101280300', '徐州': '101190800', '海口': '101310100', '乌鲁木齐': '101130100',
    '绍兴': '101210500', '中山': '101281700', '台州': '101210600', '兰州': '101160100'
};

// 导出选择器（非枚举）
const BossSelectors = {
    SELECTORS,
    CITY_CODES
};

if (!window.BossSelectors) {
    Object.defineProperty(window, 'BossSelectors', {
        value: BossSelectors,
        enumerable: false,
        configurable: false,
        writable: false
    });
}
