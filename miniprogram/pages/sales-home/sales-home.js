const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    isVisitor: true,
    isDisabled: false, // 🌟 极简状态：标记是否被禁用
    t: {},
    currentLang: 'th',
    hasTodo: false
  },

  onShow() {
    this.initLanguage();
    this.fetchTodoAlert(); 
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
          isVisitor: !(user.role === 'admin' || user.role === 'sales' || user.role === 'manager')
        });
      } else {
        this.setData({ isVisitor: true });
      }
    }).catch(err => {
      console.error('身份验证失败', err);
      this.setData({ isVisitor: true });
    });
  },
  
  async fetchTodoAlert() {
    const myOpenId = wx.getStorageSync('myOpenId');

    if (!myOpenId) {
      this.setData({ hasTodo: false });
      return;
    }

    const d = new Date();
    const todayStr =
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

    // 首页只需要知道“有没有待办”，不再统计具体数量。
    // 使用已建立的组合索引：
    // assigned_sales_id ↑ + createTime ↓
    // 一旦找到任意一条符合今日待办条件的数据，就立即停止查询。
    const PAGE_SIZE = 20;
    const MAX_SCAN_ROUNDS = 20;

    try {
      let page = 0;
      let found = false;

      while (page < MAX_SCAN_ROUNDS && !found) {
        const res = await db.collection('customers')
          .where({
            assigned_sales_id: myOpenId
          })
          .orderBy('createTime', 'desc')
          .skip(page * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .get();

        const rows = Array.isArray(res.data) ? res.data : [];

        found = rows.some(item => {
          // 已终结客户不属于今日待办
          if (['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            return false;
          }

          const hasNextFollowUp =
            item.next_follow_up &&
            item.next_follow_up !== 'none';

          // 没有日期 -> 立即属于今日待办
          // 有日期且 <= 今天 -> 属于今日待办
          return !hasNextFollowUp || item.next_follow_up <= todayStr;
        });

        if (found || rows.length < PAGE_SIZE) {
          break;
        }

        page += 1;
      }

      this.setData({ hasTodo: found });
    } catch (err) {
      console.error('检查今日待办失败:', err);

      // 首页提示失败不应影响其他功能
      this.setData({ hasTodo: false });
    }
  },

  goToAddCustomer() {
    if (this.data.isDisabled) return;
    
    wx.navigateTo({ url: '/package-report/pages/sale-add-customer/sale-add-customer' });
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
    wx.navigateTo({ url: '/pages/customer-view/customer-view?type=all' });
  }
});