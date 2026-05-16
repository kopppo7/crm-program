const db = wx.cloud.database(); // 🌟 引入数据库 
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    userRole: '', // 🌟 新增：用于存放当前是 admin 还是 manager 
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    },
    t: {}, // 🌟 新增：用于存放语言字典
    currentLang: 'th' // 🌟 新增：当前语言，默认泰语
  },

  // 🌟 新增：每次显示页面时核验权限并初始化语言
  onShow() {
    this.initLanguage();
    this.checkUserRole();
  },
// 🌟 带日志的初始化语言方法
initLanguage() {
  try {
    const lang = i18n.getLang();
    const dictionary = i18n.t();


    this.setData({
      currentLang: lang,
      t: dictionary
    });
    
    if (this.data.t && this.data.t.adminTitle) {
      wx.setNavigationBarTitle({ title: this.data.t.adminTitle });
    } else {
      console.warn("⚠️ 警告：i18n字典中未找到 adminTitle 字段，请检查 i18n.js 是否配置正确");
      wx.setNavigationBarTitle({ title: '管理后台' });
    }
  } catch (error) {
    console.error("❌ 语言初始化发生崩溃，请检查 i18n 路径或语法:", error);
  }
},

// 🌟 带日志的切换语言方法
switchLang() {
  console.log("=== 触发点击切换语言 ===");
  console.log("点击前的语言状态:", this.data.currentLang);
  
  const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
  
  try {
    i18n.setLang(newLang); 
    console.log("成功写入新语言到缓存:", newLang);
    this.initLanguage(); // 重新刷新界面
  } catch (error) {
    console.error("❌ 切换语言执行失败:", error);
  }
},

  // 🌟 新增：点击切换语言
  switchLang() {
    const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
    i18n.setLang(newLang); 
    this.initLanguage();   
  },

  // 🌟 权限核验逻辑
  checkUserRole() {
    const myOpenId = wx.getStorageSync('myOpenId');
    if (!myOpenId) return;

    db.collection('users').where({ _openid: myOpenId }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        
        // 如果账号被禁用，拦截 [cite: 2]
        if (user.status === 'disabled') {
          wx.showModal({ title: this.data.currentLang === 'zh' ? '提示' : 'เตือน', content: this.data.currentLang === 'zh' ? '账号已被禁用' : 'บัญชีถูกระงับ', showCancel: false });
          return;
        }

        // 如果是一线销售误入了管理后台，直接踢回销售主页 [cite: 3]
        if (user.role !== 'admin' && user.role !== 'manager') {
          wx.reLaunch({ url: '/pages/index/index' }); // 踢回登录大门或销售主页 [cite: 3]
          return;
        }

        // 🌟 将身份存入 data，供 WXML 渲染使用 [cite: 3]
        this.setData({ userRole: user.role });
      }
    });
  },

  handleSmartParse(e) {
    const text = e.detail.value;
    if (!text) return;

    const nameMatch = text.match(/Full name:\s*(.*)/i);
    const cityMatch = text.match(/City:\s*(.*)/i);
    const phoneMatch = text.match(/Phone number:\s*(.*)/i);
    const payloadMatch = text.match(/น้ำหนักบรรทุกสูงสุดที่คุณต้องการคือเท่าไหร่\?:\s*(.*)/);
    const timelineMatch = text.match(/คุณวางแผนจะสั่งซื้ออุปกรณ์นี้เมื่อไหร่\?:\s*(.*)/);
    this.setData({
      'customer.name': nameMatch ? nameMatch[1].trim() : this.data.customer.name,
      'customer.city': cityMatch ? cityMatch[1].trim() : this.data.customer.city,
      'customer.phone': phoneMatch ? phoneMatch[1].trim() : this.data.customer.phone,
      'customer.payload': payloadMatch ? payloadMatch[1].trim() : this.data.customer.payload,
      'customer.timeline': timelineMatch ? timelineMatch[1].trim() : this.data.customer.timeline,
    });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`customer.${field}`]: e.detail.value
    });
  },

  goToCustomerView() {
    wx.navigateTo({ url: '/pages/customer-view/customer-view' })
  },
  
  goToDistribute() {
    wx.navigateTo({ url: '/pages/distribute/distribute' })
  },

  goToMemberMgmt() {
    wx.navigateTo({ url: '/pages/member-mgmt/member-mgmt' });
  },

  goToAdminLogs() {
    wx.navigateTo({ url: '/pages/admin-logs/admin-logs' });
  },

  submitCustomer() {
    console.log("最终准备分发的数据：", this.data.customer);
  },

  goToDailyStats() {
    wx.navigateTo({ url: '/pages/sales-stats/sales-stats' });
  }
})