const i18n = require('../../../utils/i18n.js');

Page({
  data: {
    t: {},
    products: [],
    moduleType: '' // 🌟 新增：用来记录当前处于哪个大模块下
  },

  onLoad(options) {
    // 接收上一个页面传来的 type（例如：product_introduction 或 product_info）
    this.setData({ moduleType: options.type || 'product_introduction' });
  },

  onShow() {
    const t = i18n.t();
    const type = this.data.moduleType;
    
    this.setData({
      t: t,
      products: [
        { id: 'CrawlerTransporter', name: t.prodCrawler || '履带运输车', icon: '🚚' },
        { id: 'SmallExcavator', name: t.prodExcavator || '小型挖掘机', icon: '🏗️' },
        { id: 'PowerTiller', name: t.prodTiller || '微耕机', icon: '🌱' },
        { id: 'Harvester', name: t.prodHarvester || '收割机', icon: '🌾' }
      ]
    });

    // 🌟 动态标题：如果是从产品资料进来的，就显示产品资料的标题
    const title = type === 'product_info' ? (t.modProdTitle || '产品资料') : (t.modIntroTitle || '产品介绍');
    wx.setNavigationBarTitle({ title: title });
  },

  selectProduct(e) {
    const id = e.currentTarget.dataset.id;     // 产品ID（如 CrawlerTransporter）
    const name = e.currentTarget.dataset.name; // 产品名称
    const type = this.data.moduleType;         // 模块类型

    // 🌟 将 type 和 folder 一起传给终极详情页！
    wx.navigateTo({
      url: `/package-learning/pages/manual-detail/manual-detail?folder=${id}&title=${name}&type=${type}`
    });
  }
});