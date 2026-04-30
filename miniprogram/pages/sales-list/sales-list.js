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
  
    // 防止拨打电话返回时触发页面刷新
    if (this.data.isCalling) {
      this.setData({ isCalling: false }); 
      return; 
    }
  
    // 🌟 核心防御一：优先使用内存中已经存在的 myOpenId，避免从详情页返回时 Storage 读取发生竞态异常
    let currentId = this.data.myOpenId;
    if (!currentId) {
      currentId = wx.getStorageSync('myOpenId');
    }

    if (!currentId) {
      console.warn('⚠️ 未获取到身份 ID，取消加载');
      return;
    }

    this.setData({ myOpenId: currentId }, () => {
      // 🌟 核心防御二：增加短暂延迟，确保小程序的返回动画 (Pop 动画) 彻底结束后再发起请求，防止请求被系统静默挂起
      setTimeout(() => {
        this.fetchData(true); 
      }, 150);
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
    if (this.data.isLoading) return;

    let currentPage = this.data.page;

    if (reset) {
      currentPage = 0;
      // 🌟 核心防御三：【绝对不要】在这里使用 customerList: [] 清空列表！
      // 让旧数据保留在屏幕上，只重置页码参数。等新数据到了，直接覆盖。
      this.setData({ page: 0, hasMore: true });
    }
    
    if (!reset && !this.data.hasMore) return;

    this.setData({ isLoading: true });
    if (reset) {
      // 使用顶部导航栏的菊花图，不打断用户视觉
      wx.showNavigationBarLoading();
    }

    // 🌟 在函数内部初始化，防止页面切换导致上下文丢失
    const db = wx.cloud.database();
    const _ = db.command;

    let conditions = [];
    conditions.push({ assigned_sales_id: this.data.myOpenId });

    if (this.data.currentType === 'todo') {
      const todayStr = this.getTodayString();
      
      conditions.push({ 
        status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) 
      });

      conditions.push(
        _.or([
          { next_follow_up: _.lte(todayStr) }, 
          { next_follow_up: '' },              
          { next_follow_up: null },            
          { status: 'pending' },               
          { status: 'No Answer' }              
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
      .skip(currentPage * this.data.pageSize) 
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const todayStr = this.getTodayString();

        const newData = res.data.map(item => {
          let createDateStr = '';
          if (item.createTime) {
            const cd = new Date(item.createTime);
            const cy = cd.getFullYear();
            const cm = ('0' + (cd.getMonth() + 1)).slice(-2);
            const cday = ('0' + cd.getDate()).slice(-2);
            createDateStr = `${cy}-${cm}-${cday}`;
          }
          item.formattedCreateTime = createDateStr || todayStr;

          let compareDate = item.next_follow_up || createDateStr;
          if (compareDate && compareDate < todayStr && !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            item.isOverdue = true;
          } else {
            item.isOverdue = false;
          }
          return item;
        });

        this.setData({
          // 🌟 拿到真实数据后，再进行覆盖更新
          customerList: reset ? newData : this.data.customerList.concat(newData),
          hasMore: res.data.length === this.data.pageSize,
          isLoading: false
        });
        if (reset) wx.hideNavigationBarLoading();
      })
      .catch(err => {
        this.setData({ isLoading: false });
        if (reset) wx.hideNavigationBarLoading();
        console.error('查询列表失败:', err);
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
    if (!phoneNum) return wx.showToast({ title: 'No phone number', icon: 'none' });
  
    wx.showModal({
      title: 'Call Confirmation',
      content: 'Do you want to call ' + phoneNum + '?',
      confirmText: 'Call',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          this.setData({ isCalling: true });
          wx.makePhoneCall({ 
            phoneNumber: phoneNum,
            fail: () => { this.setData({ isCalling: false }); }
          });
        }
      }
    });
  },

  goToFollowUp(e) { wx.navigateTo({ url: `/pages/follow-up/follow-up?id=${e.currentTarget.dataset.id}` }); },
  goToDetail(e) { wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` }); }
});