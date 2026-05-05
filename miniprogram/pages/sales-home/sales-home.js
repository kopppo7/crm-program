const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    isVisitor: true,
    t: {},
    currentLang: 'th', // 默认泰文
    todoCount: 0       // 🌟 新增：用于存储待办数量的变量
  },

  onShow() {
    this.initLanguage();
    this.fetchTodoCount(); // 🌟 新增：每次显示页面拉取待办数量
    this.checkUserRole();
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

  // 🌟 新增：检查当前用户的身份
  checkUserRole() {
    const myOpenId = wx.getStorageSync('myOpenId');
    
    // 如果没有 OpenID，说明根本没登录，绝对是访客
    if (!myOpenId) {
      this.setData({ isVisitor: true });
      return;
    }

    db.collection('users').where({ _openid: myOpenId }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const role = res.data[0].role;
        // 如果是管理员或销售，就不是访客 (isVisitor 设为 false)
        if (role === 'admin' || role === 'sales') {
          this.setData({ isVisitor: false });
        } else {
          this.setData({ isVisitor: true });
        }
      } else {
        // 数据库里没这个人，也是访客
        this.setData({ isVisitor: true });
      }
    }).catch(err => {
      console.error('身份验证失败', err);
      this.setData({ isVisitor: true });
    });
  },
  
  // 🌟 新增核心功能：拉取今日待办数量
  fetchTodoCount() {
    const myOpenId = wx.getStorageSync('myOpenId');
    if (!myOpenId) return;

    const d = new Date();
    const year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if (month < 10) month = '0' + month;
    if (day < 10) day = '0' + day;
    const todayStr = `${year}-${month}-${day}`;

    // 使用聚合查询 .count() 快速获取数量，不消耗性能
    db.collection('customers').where(_.and([
      { assigned_sales_id: myOpenId },
      { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
      _.or([
        { next_follow_up: _.lte(todayStr) },
        { next_follow_up: '' },
        { next_follow_up: null },
        { next_follow_up: _.exists(false) },
        { status: 'pending' },
        { status: 'No Answer' }
      ])
    ])).count().then(res => {
      this.setData({ todoCount: res.total });
    }).catch(err => {
      console.error('获取待办数量失败:', err);
    });
  },

  goToTodo() {
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=todo' });
  },

  goToLearningManual() {
    // 必须以 / 开头，加上分包的 root 路径
    wx.navigateTo({
      url: '/package-learning/pages/manual-list/manual-list'
    });
  },

  goToAll() {
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=all' });
  }
});