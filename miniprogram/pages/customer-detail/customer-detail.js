const db = wx.cloud.database();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    customerId: '', 
    customer: {},   
    logs: [],       
    t: {},
    currentLang: 'zh',
    salesList: [], 
    isAdmin: false,

    isProfileExpanded: false,
    showProfileModal: false, 
    editProfileForm: {},

    showGlobalTransModal: false,
    globalTransText: '',

    localizedStatusMap: {} // 🌟 新增：存放动态拉取的双语字典映射
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
    wx.showNavigationBarLoading();

    // 直接拿大门(index.js)发给我们的身份牌，不要再去调用微信服务器覆盖了！
    const myOpenId = wx.getStorageSync('myOpenId');
    if (myOpenId) {
      this.checkAdminRole(myOpenId);
    } else {
      wx.hideNavigationBarLoading();
      wx.showToast({ title: '身份丢失，请重新进入', icon: 'none' });
    }

    if (this.data.customerId) {
      this.fetchCustomerDetail().then(() => {
        this.fetchFollowUpLogs();
      });
    }
  },

  checkAdminRole(myOpenId) {
    if (!myOpenId) return;
    db.collection('users').where({ _openid: myOpenId }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const role = res.data[0].role;
        const isUserAdmin = (role === 'admin');
        
        this.setData({ isAdmin: isUserAdmin });
        if (isUserAdmin) {
          this.fetchSalesList();
        }
      }
      wx.hideNavigationBarLoading();
    }).catch(err => {
      console.error('检查权限失败', err);
      wx.hideNavigationBarLoading();
    });
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({
      currentLang: lang,
      t: i18n.t()
    });
    wx.setNavigationBarTitle({ title: lang === 'zh' ? '客户详情' : 'รายละเอียดลูกค้า' });

    // 🌟 核心升级：动态拉取云端系统状态字典
    this.fetchStatusDict(lang);
  },

  // 🌟 核心升级：从 system_dict 拉取动态字典并生成映射表
  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict')
        .where({ type: 'customer_status', status: 'active' })
        .orderBy('sort', 'asc')
        .get();

      const dictMap = {};
      res.data.forEach(item => {
        dictMap[item.value] = lang === 'zh' ? item.label_zh : item.label_th;
      });
      
      this.setData({ localizedStatusMap: dictMap });
    } catch (e) {
      console.error('获取动态状态字典失败', e);
    }
  },

  fetchSalesList() {
    db.collection('users').where({ role: 'sales' }).get().then(res => {
      this.setData({ salesList: res.data });
    }).catch(err => console.error('获取销售列表失败', err));
  },

  fetchCustomerDetail() {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '加载中...' });
      db.collection('customers').doc(this.data.customerId).get().then(res => {
        this.setData({ customer: res.data });
        wx.hideLoading();
        resolve(res.data);
      }).catch(err => {
        wx.hideLoading();
        reject(err);
      });
    });
  },
  
  fetchFollowUpLogs() {
    db.collection('follow_up_logs')
      .where({ customer_id: this.data.customerId })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => { 
        let fetchedLogs = res.data.map(log => {
          if (log.createTime) {
            log.displayTime = this.formatDateTime(log.createTime);
          } else {
            log.displayTime = log.createTimeStr || '';
          }
          return log;
        });

        const hasReassignLog = fetchedLogs.some(log => 
          log.note && (log.note.includes('【主管操作】') || log.note.includes('[แอดมิน]'))
        );

        if (!hasReassignLog) {
          let createDateStr = '';
          if (this.data.customer && this.data.customer.createTime) {
            createDateStr = this.formatDateTime(this.data.customer.createTime);
          } else {
            createDateStr = 'Initial';
          }

          fetchedLogs.push({
            _id: 'sys_init_001',
            displayTime: createDateStr, 
            createTimeStr: createDateStr,
            follow_type: this.data.currentLang === 'zh' ? '系统自动记录' : 'บันทึกระบบ',
            result_tag: 'pending',
            note: this.data.currentLang === 'zh' ? '线索成功录入并分配给销售' : 'รับข้อมูลลูกค้าและมอบหมายสำเร็จ',
            screenshot_files: []
          });
        }
        this.setData({ logs: fetchedLogs });
      });
  },

  formatDateTime(dateStrOrObj) {
    if (!dateStrOrObj) return '';
    const date = new Date(dateStrOrObj);
    if (isNaN(date.getTime())) return dateStrOrObj;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onReassignChange(e) {
    const index = e.detail.value;
    const newSales = this.data.salesList[index];
    const oldSalesName = this.data.customer.sales_name || this.data.customer.assigned_sales_name || '未分配';
    if (newSales._openid === this.data.customer.assigned_sales_id) {
      return wx.showToast({ title: '该客户已属于此人', icon: 'none' });
    }

    wx.showModal({
      title: this.data.currentLang === 'zh' ? '确认重新分配' : 'ยืนยันการมอบหมาย',
      content: this.data.currentLang === 'zh' 
        ? `确定将该客户从【${oldSalesName}】重新分配给【${newSales.name}】吗？`
        : `ยืนยันการมอบหมายลูกค้าจาก [${oldSalesName}] ให้กับ [${newSales.name}] หรือไม่?`,
      success: (res) => {
        if (res.confirm) {
          this.executeReassign(newSales, oldSalesName);
        }
      }
    });
  },

  executeReassign(newSales, oldSalesName) {
    wx.showLoading({ title: '分配中...' });
    db.collection('customers').doc(this.data.customerId).update({
      data: {
        assigned_sales_id: newSales._openid,
        sales_name: newSales.name,
        updateTime: db.serverDate()
      }
    }).then(() => {
      return db.collection('follow_up_logs').add({
        data: {
          customer_id: this.data.customerId,
          follow_type: this.data.currentLang === 'zh' ? '系统自动记录' : 'บันทึกระบบ',
          result_tag: this.data.customer.status, 
          note: this.data.currentLang === 'zh' 
            ? `【主管操作】将客户从 ${oldSalesName} 重新分配给了 ${newSales.name}`
            : `[แอดมิน] เปลี่ยนผู้รับผิดชอบจาก ${oldSalesName} เป็น ${newSales.name}`,
          sales_id: wx.getStorageSync('myOpenId') || 'admin',
          screenshot_files: [],
          createTimeStr: this.formatDate(new Date()),
          createTime: db.serverDate()
        }
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '分配成功', icon: 'success' });
      this.fetchCustomerDetail().then(() => {
        this.fetchFollowUpLogs();
      });
    });
  },

  makePhoneCall(e) {
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum || phoneNum === 'undefined') return;
    wx.makePhoneCall({ phoneNumber: phoneNum });
  },

  goToFollowUp() {
    if (!this.data.customerId) return;
    wx.navigateTo({ url: `/pages/follow-up/follow-up?id=${this.data.customerId}` });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.all;
    wx.previewImage({ current: current, urls: urls });
  },

  toggleProfile() {
    this.setData({ isProfileExpanded: !this.data.isProfileExpanded });
  },

  openProfileModal() {
    const currentProfile = this.data.customer.profile || {};
    this.setData({
      editProfileForm: JSON.parse(JSON.stringify(currentProfile)),
      showProfileModal: true
    });
  },

  closeProfileModal() {
    this.setData({ showProfileModal: false });
  },

  onProfileInput(e) {
    const field = e.currentTarget.dataset.field; 
    const value = e.detail.value;
    this.setData({ [`editProfileForm.${field}`]: value });
  },

  saveProfile() {
    wx.showLoading({ title: '保存中...', mask: true });
    db.collection('customers').doc(this.data.customerId).update({
      data: {
        profile: this.data.editProfileForm,
        updateTime: db.serverDate()
      }
    }).then(() => {
      this.setData({
        'customer.profile': this.data.editProfileForm,
        showProfileModal: false
      });
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    });
  },

  copyAllContext() {
    const p = this.data.customer.profile || {};
    let text = `【客户画像】\n需求: ${p.demand || '未填'}\n动机: ${p.motivation || '未填'}\n使用者: ${p.userType || '未填'}\n场景: ${p.scenario || '未填'}\n时间: ${p.timeframe || '未填'}\n预算: ${p.budget || '未填'}\n\n【跟进记录】\n`;
    
    this.data.logs.forEach(log => {
      // 🌟 核心升级：一键复制导出的文案，也升级为从动态字典中读取
      const statusStr = this.data.localizedStatusMap[log.result_tag] || log.result_tag;
      text += `[${log.createTimeStr}] 状态:${statusStr}\n内容: ${log.note}\n`;
      if (log.lost_reason) text += `原因: ${log.lost_reason}\n`;
      text += `---\n`;
    });

    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制全局档案', icon: 'none' })
    });
  },

  openGlobalTransModal() {
    this.setData({
      showGlobalTransModal: true,
      globalTransText: this.data.customer.translated_context || ''
    });
  },

  closeGlobalTransModal() {
    this.setData({ showGlobalTransModal: false });
  },

  onGlobalTransInput(e) {
    this.setData({ globalTransText: e.detail.value });
  },

  saveGlobalTranslation() {
    wx.showLoading({ title: '保存中...', mask: true });
    db.collection('customers').doc(this.data.customerId).update({
      data: {
        translated_context: this.data.globalTransText,
        updateTime: db.serverDate()
      }
    }).then(() => {
      this.setData({
        'customer.translated_context': this.data.globalTransText,
        showGlobalTransModal: false
      });
      wx.hideLoading();
      wx.showToast({ title: '中文档案保存成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error(err);
    });
  }
});