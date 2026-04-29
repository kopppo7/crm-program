const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js'); 

Page({
  data: {
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
    const salesId = wx.getStorageSync('myOpenId');
    this.setData({ myOpenId: salesId }, () => {
      this.fetchData(true); // 每次回到列表页都会重新拉取数据
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
          { status: 'pending' }              
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
        const newData = res.data;
        this.setData({
          customerList: reset ? newData : this.data.customerList.concat(newData),
          hasMore: newData.length === this.data.pageSize,
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

  makePhoneCall(e) { wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.phone }); },
  goToFollowUp(e) { wx.navigateTo({ url: `/pages/follow-up/follow-up?id=${e.currentTarget.dataset.id}` }); },
  goToDetail(e) { wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` }); }
})
