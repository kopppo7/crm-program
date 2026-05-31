const i18n = require('../../utils/i18n.js'); 

Page({
  data: {
    isCalling: false,
    currentType: 'todo',
    activeTab: 'all_todo', 
    noAnswerCount: 0,      
    
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
  
    if (this.data.isCalling) {
      this.setData({ isCalling: false }); 
      return; 
    }
  
    let currentId = this.data.myOpenId;
    if (!currentId) {
      currentId = wx.getStorageSync('myOpenId');
    }

    if (!currentId) {
      console.warn('⚠️ 未获取到身份 ID，取消加载');
      return;
    }

    this.setData({ myOpenId: currentId }, () => {
      setTimeout(() => {
        this.fetchNoAnswerCount(); 
        this.fetchData(true); 
      }, 500);
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

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;
    this.setData({ activeTab: tab }, () => {
      this.fetchData(true);
    });
  },

  // 🌟 修复 2：改用最稳妥的对象级 _.and + _.or，杜绝底层查询报错
  fetchNoAnswerCount() {
    const db = wx.cloud.database();
    const _ = db.command;
    const todayStr = this.getTodayString();

    db.collection('customers').where(_.and([
      { assigned_sales_id: this.data.myOpenId },
      { status: 'No Answer' },
      _.or([
        { next_follow_up: _.lte(todayStr) },
        { next_follow_up: '' },
        { next_follow_up: null },
        { next_follow_up: _.exists(false) }
      ])
    ])).count().then(res => {
      this.setData({ noAnswerCount: res.total });
    }).catch(err => console.error('获取未接数量失败', err));
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
      this.setData({ page: 0, hasMore: true });
      this.fetchNoAnswerCount(); 
    }
    
    if (!reset && !this.data.hasMore) return;

    this.setData({ isLoading: true });
    if (reset) {
      wx.showNavigationBarLoading();
    }

    const db = wx.cloud.database();
    const _ = db.command;
    const todayStr = this.getTodayString();

    let conditions = [];
    conditions.push({ assigned_sales_id: this.data.myOpenId });

    if (this.data.currentType === 'todo') {
      if (this.data.activeTab === 'all_todo') {
        conditions.push({ 
          status: _.nin(['Closed Won', 'Closed Lost', 'Invalid', 'No Answer']) 
        });
        conditions.push(
          _.or([
            { next_follow_up: _.lte(todayStr) }, 
            { next_follow_up: '' },              
            { next_follow_up: null },            
            { next_follow_up: _.exists(false) }, 
            { status: 'pending' }              
          ])
        );
      } else if (this.data.activeTab === 'no_answer') {
        // 🌟 修复 2同步：统一改为最稳健的对象级 or
        conditions.push({ status: 'No Answer' });
        conditions.push(
          _.or([
            { next_follow_up: _.lte(todayStr) },
            { next_follow_up: '' },
            { next_follow_up: null },
            { next_follow_up: _.exists(false) }
          ])
        );
      }
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
        
        // 🌟 修复 1：仅对 'todo' 待办列表施加严格拦截，绝不误伤 '全部客户' 列表
        const validData = res.data.filter(item => {
          if (this.data.currentType === 'todo') {
            // 在待办列表中，隐藏掉已经被关闭的客户
            if (['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) return false;
            
            let compareDate = item.next_follow_up;
            if (!compareDate) {
              if (item.createTime) {
                const cd = new Date(item.createTime);
                compareDate = `${cd.getFullYear()}-${('0' + (cd.getMonth() + 1)).slice(-2)}-${('0' + cd.getDate()).slice(-2)}`;
              } else {
                compareDate = todayStr;
              }
            }

            if (this.data.activeTab === 'no_answer') {
              return item.status === 'No Answer' && compareDate <= todayStr;
            } else {
              return item.status !== 'No Answer' && (compareDate <= todayStr || item.status === 'pending');
            }
          }
          // 如果是 "我的客户" 页面，必须一律放行，显示所有历史数据！
          return true; 
        });

        // 格式化过检的数据
        const newData = validData.map(item => {
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
    // 🌟 修复 3：拦截前端转义造成的 "undefined" 和 "null" 字符串陷阱
    if (!phoneNum || phoneNum === 'undefined' || phoneNum === 'null' || phoneNum.trim() === '') {
      return wx.showToast({ title: '没有电话号码', icon: 'none' });
    }
  
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