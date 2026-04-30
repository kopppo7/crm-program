const db = wx.cloud.database();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    customerId: '', 
    customer: {},   
    logs: [],       
    t: {},
    currentLang: 'zh'
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ customerId: options.id });
    } else {
      wx.showToast({ title: '参数错误，缺少客户ID', icon: 'none' });
    }
  },

  onShow() {
    this.initLanguage();
    if (this.data.customerId) {
      // 🌟 改进：使用 Promise 链式调用，确保先拿到客户信息，再处理时间轴
      this.fetchCustomerDetail().then(() => {
        this.fetchFollowUpLogs();
      });
    }
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({
      currentLang: lang,
      t: i18n.t()
    });
    wx.setNavigationBarTitle({ title: lang === 'zh' ? '客户详情' : 'รายละเอียดลูกค้า' });
  },

  // 将请求改为 Promise 以便顺序执行
  fetchCustomerDetail() {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '加载中...' });
      db.collection('customers').doc(this.data.customerId).get().then(res => {
        this.setData({ customer: res.data });
        wx.hideLoading();
        resolve(res.data);
      }).catch(err => {
        console.error('获取客户详情失败', err);
        wx.hideLoading();
        wx.showToast({ title: '获取数据失败', icon: 'none' });
        reject(err);
      });
    });
  },

  // 🌟 改进二：时间轴优化逻辑
  fetchFollowUpLogs() {
    db.collection('follow_up_logs')
      .where({
        customer_id: this.data.customerId
      })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        let fetchedLogs = res.data;

        // 🌟 CRM 高级体验：如果没有获取到客户真实的创建时间，用今天兜底
        let createDateStr = '';
        if (this.data.customer && this.data.customer.createTime) {
          const cd = new Date(this.data.customer.createTime);
          createDateStr = `${cd.getFullYear()}-${('0' + (cd.getMonth() + 1)).slice(-2)}-${('0' + cd.getDate()).slice(-2)}`;
        } else {
          createDateStr = 'Initial';
        }

        // 自动在数组末尾（时间轴最底端）追加一条“系统初始分配”记录
        const initialLog = {
          _id: 'sys_init_001',
          createTimeStr: createDateStr,
          follow_type: this.data.currentLang === 'zh' ? '系统自动记录' : 'บันทึกระบบ',
          result_tag: 'pending',
          note: this.data.currentLang === 'zh' ? '线索成功录入并分配给销售' : 'รับข้อมูลลูกค้าและมอบหมายสำเร็จ',
          screenshot_files: []
        };

        fetchedLogs.push(initialLog); // 追加初始记录

        this.setData({ logs: fetchedLogs });
      }).catch(err => {
        console.error('获取时间轴失败', err);
      });
  },

  makePhoneCall(e) {
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum || phoneNum === 'undefined') return;

    wx.showModal({
      title: 'Call Confirmation',
      content: 'Do you want to call ' + phoneNum + '?',
      confirmText: 'Call',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: phoneNum });
        }
      }
    });
  },

  goToFollowUp() {
    if (!this.data.customerId) return;
    wx.navigateTo({ 
      url: `/pages/follow-up/follow-up?id=${this.data.customerId}` 
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.all;
    wx.previewImage({ current: current, urls: urls });
  }
}); 