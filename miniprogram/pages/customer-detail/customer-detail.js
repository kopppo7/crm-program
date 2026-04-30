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
    isAdmin: false // 🌟 新增：标记当前用户是否为管理员
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ customerId: options.id });
    } else {
      wx.showToast({ title: '参数错误，缺少客户ID', icon: 'none' });
    }
  },

  onShow() {
    wx.cloud.callFunction({
      name: 'login', // 🌟 确保你的云函数里有一个叫 login 的函数
      success: res => {
        console.log('✅ 腾讯服务器返回的真实 OpenID:', res.result.openid);
        // 你可以顺便更新一下缓存，确保之后逻辑正确
        wx.setStorageSync('myOpenId', res.result.openid);
      },
      fail: err => {
        console.error('❌ 获取失败，请检查云函数是否部署:', err);
      }
    });
    this.initLanguage();
    this.checkAdminRole(); // 🌟 校验当前用户的权限
    
    if (this.data.customerId) {
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

  // 🌟 新增：检查当前登录用户是否为 admin
  checkAdminRole() {
    const myOpenId = wx.getStorageSync('myOpenId');
    console.log("👉 小程序缓存里的 ID 是:", myOpenId); // 🌟 关键：看控制台输出了什么
    
    if (!myOpenId) {
      console.error("❌ 缓存中没有 myOpenId，请重新进入授权页录入身份");
      return;
    }
  
    db.collection('users').where({ _openid: myOpenId }).get().then(res => {
      console.log("👉 数据库查询结果:", res.data);
      if (res.data && res.data.length > 0) {
        const role = res.data[0].role;
        const isUserAdmin = (role === 'admin');
        
        this.setData({ isAdmin: isUserAdmin });

        // 🌟 性能优化：只有管理员才需要拉取销售列表用于重新分配
        if (isUserAdmin) {
          this.fetchSalesList();
        }
      }
    }).catch(err => console.error('检查权限失败', err));
  },

  // 拉取销售人员列表（仅管理员调用）
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
        console.error('获取客户详情失败', err);
        wx.hideLoading();
        wx.showToast({ title: '获取数据失败', icon: 'none' });
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
        let fetchedLogs = res.data;

        // 🌟 改进：检测历史记录中是否已经有“重新分配”的系统日志
        // 我们通过之前写死的关键词 【主管操作】 或 [แอดมิน] 来识别
        const hasReassignLog = fetchedLogs.some(log => 
          log.note && (log.note.includes('【主管操作】') || log.note.includes('[แอดมิน]'))
        );

        // 如果没有发生过重新分配，才在最底部显示初始录入记录
        if (!hasReassignLog) {
          let createDateStr = '';
          if (this.data.customer && this.data.customer.createTime) {
            const cd = new Date(this.data.customer.createTime);
            createDateStr = `${cd.getFullYear()}-${('0' + (cd.getMonth() + 1)).slice(-2)}-${('0' + cd.getDate()).slice(-2)}`;
          } else {
            createDateStr = 'Initial';
          }

          const initialLog = {
            _id: 'sys_init_001',
            createTimeStr: createDateStr,
            follow_type: this.data.currentLang === 'zh' ? '系统自动记录' : 'บันทึกระบบ',
            result_tag: 'pending',
            note: this.data.currentLang === 'zh' ? '线索成功录入并分配给销售' : 'รับข้อมูลลูกค้าและมอบหมายสำเร็จ',
            screenshot_files: []
          };

          fetchedLogs.push(initialLog); 
        }

        this.setData({ logs: fetchedLogs });
      }).catch(err => {
        console.error('获取时间轴失败', err);
      });
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
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '分配失败', icon: 'none' });
      console.error(err);
    });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    wx.navigateTo({ url: `/pages/follow-up/follow-up?id=${this.data.customerId}` });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.all;
    wx.previewImage({ current: current, urls: urls });
  }
});