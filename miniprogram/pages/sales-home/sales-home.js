const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    isVisitor: true,
    isDisabled: false, // 🌟 极简状态：标记是否被禁用
    t: {},
    currentLang: 'th', 
    todoCount: 0       
  },

  onShow() {
    this.initLanguage();
    this.fetchTodoCount(); 
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

  switchLang() {
    const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
    i18n.setLang(newLang); 
    this.initLanguage();   
  },

  checkUserRole() {
    const myOpenId = wx.getStorageSync('myOpenId');
    if (!myOpenId) {
      this.setData({ isVisitor: true });
      return;
    }

    db.collection('users').where({ _openid: myOpenId }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        this.setData({ 
          isDisabled: user.status === 'disabled', // 🌟 获取禁用状态
          isVisitor: !(user.role === 'admin' || user.role === 'sales')
        });
      } else {
        this.setData({ isVisitor: true });
      }
    }).catch(err => {
      console.error('身份验证失败', err);
      this.setData({ isVisitor: true });
    });
  },
  
  fetchTodoCount() {
    const myOpenId = wx.getStorageSync('myOpenId');
    if (!myOpenId) return;

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

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
    }).catch(err => console.error('获取待办失败:', err));
  },

  // 🌟 新增：跳转到工作汇报分包的菜单页
  goToWorkReport() {
    if (this.checkDisabled()) return; // 🌟 拦截被禁用的账号
    // 跳转到我们即将新建的分包路径中
    wx.navigateTo({ url: '/package-report/pages/report-menu/report-menu' });
  },

  // 🌟 极简拦截器：判断被禁用的弹窗提示
  checkDisabled() {
    if (this.data.isDisabled) {
      wx.showModal({
        title: this.data.currentLang === 'zh' ? '提示' : 'เตือน',
        content: this.data.currentLang === 'zh' ? '账号已被禁用，请联系管理员' : 'บัญชีของคุณถูกระงับ',
        showCancel: false
      });
      return true; // 返回 true 表示应该拦截
    }
    return false; // 正常
  },

  goToTodo() {
    if (this.checkDisabled()) return; // 🌟 拦截：如果是禁用状态，直接退出函数
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=todo' });
  },

  goToLearningManual() {
    if (this.checkDisabled()) return; // 🌟 拦截
    wx.navigateTo({ url: '/package-learning/pages/manual-list/manual-list' });
  },

  goToAll() {
    if (this.checkDisabled()) return; // 🌟 拦截
    wx.navigateTo({ url: '/pages/sales-list/sales-list?type=all' });
  }
});