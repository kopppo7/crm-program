const i18n = require('../../../utils/i18n.js');

Page({
  data: {
    t: {},
    images: []
  },

  onLoad(options) {
    // 🌟 接收三个维度的参数
    const { folder, title, type } = options; 
    
    wx.setNavigationBarTitle({ title: title || '详情' });
    this.initLanguage();

    let renderImages = [];

    // ==========================================
    // 场景 A：来自【产品介绍】模块 -> 显示单张长图
    // ==========================================
    if (type === 'product_introduction') {
      // 1. 建立英文 ID 到您存储桶里真实中文文件名的映射
      const fileNameMap = {
        'CrawlerTransporter': '运输车.png',
        'SmallExcavator': '挖掘机.png',
        'PowerTiller': '微耕机.png',
        'Harvester': '收割机.png',
        'LawnMower': '割草机.png'
      };

      // 2. 根据传过来的 folder (英文ID) 拿到对应的中文文件名
      const exactFileName = fileNameMap[folder];

      // 3. 极其重要：因为文件名是中文，必须用 encodeURIComponent 转码，否则图片绝对加载不出来！
      const encodedFileName = encodeURIComponent(exactFileName);

      // 4. 拼装最终的安全网址
      const imageUrl = `https://sales-manual-1428539261.cos.ap-bangkok.myqcloud.com/ProductIntroduction/${encodedFileName}`;
      
      renderImages = [imageUrl];
    }
    // ==========================================
    // 场景 B：来自【产品资料】模块 -> 显示多张详情图
    // ==========================================
    else if (type === 'product_info') {
      // 强烈建议在腾讯云新建一个纯英文的 ProductInfo 文件夹，里面再放四种产品的子文件夹
      const baseUrl = `https://sales-manual-1428539261.cos.ap-bangkok.myqcloud.com/ProductInfo/${folder}/`;
      
      // 假设每个产品资料有 1 到 5 张图（这里可以根据你的实际张数调整，也可以写多一点，加载不出来的会静默失效不影响整体）
      const fileNames = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'];
      renderImages = fileNames.map(name => baseUrl + name);
    }

    this.setData({
      images: renderImages
    });
  },

  initLanguage() {
    this.setData({ t: i18n.t() });
  },

  previewImage(e) {
    const currentUrl = e.currentTarget.dataset.src;
    wx.previewImage({
      current: currentUrl,
      urls: this.data.images
    });
  }
});