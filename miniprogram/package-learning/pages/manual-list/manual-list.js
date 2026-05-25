const i18n = require('../../../utils/i18n.js');

Page({
  data: {
    currentLang: 'zh',
    t: {},
    moduleList: []
  },

  onShow() {
    this.initLanguage();
    // 🌟 每次显示页面时，从数据库拉取最新列表
    this.fetchModuleList();
  },

  initLanguage() {
    const lang = i18n.getLang();
    const t = i18n.t();
    wx.setNavigationBarTitle({ title: t.manualTitle });
    this.setData({ currentLang: lang, t: t });
  },

  // 🌟 新增：从数据库拉取模块列表的函数
  async fetchModuleList() {
    wx.showLoading({ title: '加载中...' });
    try {
      const db = wx.cloud.database();
      // 按 sort 字段升序排列，方便我们以后在 PC 端控制模块的显示顺序
      const res = await db.collection('manual_modules').orderBy('sort', 'asc').get();
      
      const lang = this.data.currentLang;
      
      // 处理双语显示逻辑
      const formattedList = res.data.map(item => {
        return {
          id: item._id, // 数据库的唯一 ID
          // 如果当前是中文，主标题显示中文，副标题显示泰文；反之亦然
          titleMain: lang === 'zh' ? item.title_zh : item.title_th,
          titleSub: lang === 'zh' ? item.title_th : item.title_zh,
          desc: lang === 'zh' ? item.desc_zh : item.desc_th,
          target_url: item.target_url // 从数据库读取该模块要跳转的页面路径
        };
      });

      this.setData({ moduleList: formattedList });
    } catch (err) {
      console.error('拉取模块列表失败:', err);
    } finally {
      wx.hideLoading();
    }
  },

  goToDetail(e) {
    const moduleId = e.currentTarget.dataset.id;
    // 从我们刚才格式化的列表中，找到点击的这个模块
    const selectedModule = this.data.moduleList.find(m => m.id === moduleId);
    
    if (selectedModule && selectedModule.target_url) {
      // 如果数据库里配置了跳转路径，直接跳转
      wx.navigateTo({ url: selectedModule.target_url });
    } else {
      // 如果没配置路径，提示开发中
      wx.showToast({ title: this.data.t.modDevToast || '正在开发中...', icon: 'none' });
    }
  }
});