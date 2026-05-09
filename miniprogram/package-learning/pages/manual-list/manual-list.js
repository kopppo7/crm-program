const i18n = require('../../../utils/i18n.js');

Page({
  data: {
    currentLang: 'zh',
    t: {},
    moduleList: []
  },

  onShow() {
    this.initLanguage();
  },

  initLanguage() {
    const lang = i18n.getLang();
    const t = i18n.t();
    
    wx.setNavigationBarTitle({ title: t.manualTitle });

    this.setData({
      currentLang: lang,
      t: t,
      // 🌟 动态生成模块列表，为了保持双语 UI 的高级感，副标题自动取另一种语言
      moduleList: [
        {
          id: 'product_introduction', // 🌟 新增模块
          titleMain: t.modIntroTitle,
          titleSub: lang === 'zh' ? 'แนะนำผลิตภัณฑ์' : '产品介绍',
          icon: '🚜',
          desc: t.modIntroDesc,
          iconBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          iconColor: '#d97706'
        },
        {
          id: 'product_info',
          titleMain: t.modProdTitle,
          titleSub: lang === 'zh' ? 'ข้อมูลผลิตภัณฑ์' : '产品资料',
          icon: '🚜',
          desc: t.modProdDesc,
          iconBg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', 
          iconColor: '#0284c7' 
        },
        {
          id: 'sales_script',
          titleMain: t.modSalesTitle,
          titleSub: lang === 'zh' ? 'บทสนทนาการขาย' : '销售话术',
          icon: '💬',
          desc: t.modSalesDesc,
          iconBg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          iconColor: '#059669'
        }
      ]
    });
  },

  goToDetail(e) {
    const moduleId = e.currentTarget.dataset.id;
    if (moduleId === 'product_introduction' || moduleId === 'product_info') { 
      // 🌟 跳转到新增的产品选择列表页
      wx.navigateTo({ url: `/package-learning/pages/product-intro-menu/product-intro-menu?type=${moduleId}` });
    } else if(moduleId === 'sales_script') {
      return wx.showToast({ title: this.data.t.modDevToast, icon: 'none' });
    }
  }
});