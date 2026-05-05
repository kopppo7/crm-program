const i18n = require('../../../utils/i18n.js');

Page({
  data: {
    moduleId: '',
    t: {},
    baseUrl: 'https://sales-manual-1428539261.cos.ap-bangkok.myqcloud.com/%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%9C%E0%B8%A5%E0%B8%B4%E0%B8%95%E0%B8%A0%E0%B8%B1%E0%B8%93%E0%B8%91%E0%B9%8C%E4%BA%A7%E5%93%81%E8%B5%84%E6%96%99/',
    images: []
  },

  onLoad(options) {
    const id = options.id || 'product_info';
    this.setData({ moduleId: id });
    this.loadContent(id);
  },

  onShow() {
    this.initLanguage();
  },

  initLanguage() {
    const t = i18n.t();
    this.setData({ t: t });
    
    // 根据当前模块 ID 动态设置多语言标题
    let pageTitle = '';
    if (this.data.moduleId === 'product_info') {
      pageTitle = t.modProdTitle;
    } else if (this.data.moduleId === 'sales_script') {
      pageTitle = t.modSalesTitle;
    }
    
    wx.setNavigationBarTitle({ title: pageTitle });
  },

  loadContent(id) {
    if (id === 'product_info') {
      const fileNames = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']; 
      const fullUrls = fileNames.map(name => this.data.baseUrl + name);
      this.setData({ images: fullUrls });
    }
  },

  previewImage(e) {
    const currentUrl = e.currentTarget.dataset.src;
    wx.previewImage({
      current: currentUrl,     
      urls: this.data.images   
    });
  }
});