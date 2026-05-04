const db = wx.cloud.database();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    authStatus: 'checking', 
    tempOpenId: '',
    applyName: '',
    currentLang: 'th',
    t: {}
  },

  onLoad() {
    this.initLanguage();
    this.getOpenID();
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({
      currentLang: lang,
      t: i18n.t()
    });
    wx.setNavigationBarTitle({ title: lang === 'zh' ? '身份验证' : 'ยืนยันตัวตน' });
  },

  switchLang() {
    const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
    i18n.setLang(newLang);
    this.initLanguage();
  },

  getOpenID() {
    wx.cloud.callFunction({
      name: 'login',
      config: {
        env: 'cloud1-d1gdd35vq77ab5c2f' 
      },
      success: res => {
        const id = res.result.openid;
        // const id = 'o6WpV3bCQ3YezfL7drNZ19N4XAwg'  // 泰1
        // const id = 'o6WpV3ZD942ytdWL-5wcwrsDR0wI';  // k
        this.setData({ tempOpenId: id });
        wx.setStorageSync('myOpenId', id);
        this.checkAuth();
      },
      fail: err => {
        this.setData({ authStatus: 'unregistered' });
        console.error('❌ login云函数调用失败:', err);
      }
    });
  },

  // 权限核验核心逻辑
  checkAuth(e) {
    // 老板你的专属 ID，请确保大小写正确 (上次抓虫记得是 WwDZ 哦，你这里传的又是 WWDZ)
    const myBossId = "o6WpV3RofitWWDZTrwXnsR_KxKBQ"; 
    const currentId = (this.data.tempOpenId || "").trim();

    if (currentId === myBossId) {
      wx.reLaunch({ url: '/pages/admin-home/admin-home' });
      return;
    }

    // 如果是手动点击刷新，弹出 loading
    if (e && e.type === 'tap') {
      wx.showLoading({ title: this.data.currentLang === 'zh' ? '刷新中...' : 'กำลังรีเฟรช...' });
    }

    db.collection('users').where({
      openid: currentId
    }).get().then(res => {
      if (e && e.type === 'tap') wx.hideLoading(); // 隐藏手动刷新的 loading

      if (res.data.length > 0) {
        const user = res.data[0];
        if (user.status === 'pending') {
          this.setData({ authStatus: 'pending' });
          if (e && e.type === 'tap') {
            wx.showToast({ title: this.data.currentLang === 'zh' ? '还在审核中哦' : 'รอการอนุมัติ', icon: 'none' });
          }
        } else if (user.role === 'admin') {
          wx.reLaunch({ url: '/pages/admin-home/admin-home' });
        } else {
          wx.reLaunch({ url: '/pages/sales-home/sales-home' });
        }
      } else {
        this.setData({ authStatus: 'unregistered' });
      }
    }).catch(err => {
      if (e && e.type === 'tap') wx.hideLoading();
      this.setData({ authStatus: 'unregistered' });
    });
  },

  onNameInput(e) {
    this.setData({ applyName: e.detail.value.trim() });
  },

  submitApplication() {
    if (!this.data.applyName) {
      return wx.showToast({ title: this.data.currentLang === 'zh' ? '请输入姓名' : 'กรุณากรอกชื่อ', icon: 'none' });
    }

    wx.showLoading({ title: '提交中...' });
    db.collection('users').add({
      data: {
        name: this.data.applyName,
        openid: this.data.tempOpenId,
        role: 'sales',
        status: 'pending',
        createTime: db.serverDate()
      }
    }).then(() => {
      wx.hideLoading();
      this.setData({ authStatus: 'pending' });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    });
  },

  goToVisitor() {
    wx.reLaunch({ url: '/pages/sales-home/sales-home' });
  }
});
