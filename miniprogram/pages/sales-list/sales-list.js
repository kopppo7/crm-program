const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js'); 

Page({
  data: {
    isCalling: false,
    currentType: 'todo',
    customerList: [],
    searchKeyword: '', 
    myOpenId: '',
    page: 0,
    pageSize: 20,
    hasMore: true,
    isLoading: false,

    t: {}, 
    currentLang: 'zh',
    statusMap: {} 
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ currentType: options.type });
    }
  },

  onShow() {
    this.initLanguage();
  
    // 🌟 改进二：如果是因为拨号返回，直接拦截刷新
    if (this.data.isCalling) {
      this.setData({ isCalling: false }); // 重置状态
      return; 
    }
  
    const salesId = wx.getStorageSync('myOpenId');
    this.setData({ myOpenId: salesId }, () => {
      this.fetchData(true); 
    });
  },

  initLanguage() {
    const lang = i18n.getLang();
    const trans = i18n.t();
    this.setData({
      currentLang: lang,
      t: trans,
      statusMap: trans.status 
    });
    const titleObj = {
      'zh': { todo: '今日待办', all: '我的客户' },
      'th': { todo: 'งานวันนี้', all: 'ลูกค้าของฉัน' }
    };
    wx.setNavigationBarTitle({ title: titleObj[lang][this.data.currentType] });
  },

  switchLang() {
    const newLang = this.data.currentLang === 'zh' ? 'th' : 'zh';
    i18n.setLang(newLang); 
    this.initLanguage();   
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value.trim() }); },
  onSearch() { this.fetchData(true); },
  clearSearch() { this.setData({ searchKeyword: '' }, () => { this.fetchData(true); }); },

  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchData(false);
      });
    }
  },

  fetchData(reset = false) {
    if (reset) {
      this.setData({ page: 0, hasMore: true, customerList: [] });
    }
    
    if (!this.data.hasMore || this.data.isLoading) return;

    this.setData({ isLoading: true });
    if (reset) wx.showLoading({ title: '加载中' });

    let conditions = [];
    conditions.push({ assigned_sales_id: this.data.myOpenId });

    // === 核心：今日待办的过滤逻辑 ===
    if (this.data.currentType === 'todo') {
      const todayStr = this.getTodayString();
      
      // 1. 踢出已经完结的客户（成交、战败、无效）
      conditions.push({ 
        status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) 
      });

      // 2. 只保留：下次跟进日期在今天及以前的、或者没填日期的、或者刚分配还是pending的
      conditions.push(
        _.or([
          { next_follow_up: _.lte(todayStr) }, // 约定的日期 <= 今天
          { next_follow_up: _.eq('') },        
          { next_follow_up: _.exists(false) }, 
          { status: 'pending' },
          { status: 'No Answer' } // 保留未接通客户高频显示逻辑           
        ])
      );
    }

    if (this.data.searchKeyword) {
      const regex = db.RegExp({ regexp: this.data.searchKeyword, options: 'i' });
      conditions.push(
        _.or([
          { name: regex }, { phone: regex }, { city: regex }, { payload: regex }
        ])
      );
    }

    db.collection('customers')
      .where(_.and(conditions))
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const todayStr = this.getTodayString();

        // 🌟 改进一 & 改进二：数据二次加工，计算时间与逾期状态
        const newData = res.data.map(item => {
          // 格式化创建/分配时间
          let createDateStr = '';
          if (item.createTime) {
            const cd = new Date(item.createTime);
            const cy = cd.getFullYear();
            const cm = ('0' + (cd.getMonth() + 1)).slice(-2);
            const cday = ('0' + cd.getDate()).slice(-2);
            createDateStr = `${cy}-${cm}-${cday}`;
          }
          item.formattedCreateTime = createDateStr || todayStr;

          // 判断是否逾期 (时间早于今天，且未完结的客户)
          let compareDate = item.next_follow_up || createDateStr;
          if (compareDate && compareDate < todayStr && !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            item.isOverdue = true;
          } else {
            item.isOverdue = false;
          }
          
          return item;
        });

        this.setData({
          customerList: reset ? newData : this.data.customerList.concat(newData),
          hasMore: res.data.length === this.data.pageSize,
          isLoading: false
        });
        if (reset) wx.hideLoading();
      })
      .catch(err => {
        this.setData({ isLoading: false });
        if (reset) wx.hideLoading();
        console.error(err);
      });
  },

  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if (month < 10) month = '0' + month;
    if (day < 10) day = '0' + day;
    return `${year}-${month}-${day}`;
  },

  makePhoneCall(e) { 
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum) {
      wx.showToast({ title: 'No phone number', icon: 'none' });
      return;
    }
  
    // 🌟 改进一：自定义英文提示，去除模拟字样
    wx.showModal({
      title: 'Call Confirmation',
      content: 'Do you want to call ' + phoneNum + '?',
      confirmText: 'Call',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          // 🌟 改进二：标记正在拨号，防止返回时刷新列表
          this.setData({ isCalling: true });
          
          wx.makePhoneCall({ 
            phoneNumber: phoneNum,
            fail: () => {
              // 如果拨打失败（例如用户在系统层级取消），也要重置状态
              this.setData({ isCalling: false });
            }
          });
        }
      }
    });
  },

  goToFollowUp(e) { wx.navigateTo({ url: `/pages/follow-up/follow-up?id=${e.currentTarget.dataset.id}` }); },
  goToDetail(e) { wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` }); }
})