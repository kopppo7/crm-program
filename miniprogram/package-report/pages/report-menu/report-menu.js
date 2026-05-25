const i18n = require('../../../utils/i18n.js'); // 引入多语言配置

Page({
  data: {
    currentLang: 'zh'
  },

  onShow() {
    // 每次进页面，获取当前语言
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    
    wx.setNavigationBarTitle({
      title: lang === 'zh' ? '工作汇报' : 'รายงานการทำงาน'
    });
  },

  // 跳转到周计划填写页 (我们下一步要做)
  goToWeekly() {
    wx.navigateTo({ url: '/package-report/pages/weekly-plan/weekly-plan' });
  },

  // 跳转到日汇报填写页 (我们下一步要做)
  goToDaily() {
    wx.navigateTo({ url: '/package-report/pages/daily-report/daily-report' });
  }
});