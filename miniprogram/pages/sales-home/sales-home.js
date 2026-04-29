const i18n = require('../../utils/i18n.js');

Page({
  data: {
    t: {},
    currentLang: 'th' // 默认泰文
  },

  onShow() {
    this.initLanguage();
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({
      currentLang: lang,
      t: i18n.t()
    });
    wx.setNavigationBarTitle({ title: this.data.t.homeTitle });
  },

  // 核心：点击切换语言
  switchLang() {
    const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
    i18n.setLang(newLang); // 存入全局缓存
    this.initLanguage();   // 立刻刷新当前页面文字
  },

  goToTodo() {
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=todo' });
  },

  goToAll() {
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=all' });
  }
});
