const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    activeTab: 'all_customers', // all_customers 或 key_customers
    customerList: [],
    searchKeyword: '',
    selectedDate: '', 
    salesOptions: [],
    selectedSalesIndex: 0,
    statusFilterOptions: [],
    selectedStatusIndex: 0,

    t: {},
    currentLang: 'zh',
    isCalling: false, 
    myOpenId: '',
    isAdmin: false,

    page: 0,
    pageSize: 20,
    hasMore: true,
    isLoading: false,
    localizedStatusMap: {} 
  },

  onShow() {
    this.initLanguage(); 
    if (this.data.isCalling) {
      this.setData({ isCalling: false });
      return;
    }

    let currentId = wx.getStorageSync('myOpenId');
    if (!currentId) return;
    this.setData({ myOpenId: currentId }, () => {
      db.collection('users').where({ _openid: currentId }).get().then(res => {
        const isUserAdmin = res.data && res.data.length > 0 && res.data[0].role === 'admin';
        this.setData({ isAdmin: isUserAdmin });
        if (isUserAdmin) this.fetchSalesList();
        
        // 动态修改标题
        const titleStr = isUserAdmin ? (this.data.currentLang === 'zh' ? '全部客户' : 'ลูกค้าทั้งหมด') : (this.data.currentLang === 'zh' ? '我的客户' : 'ลูกค้าของฉัน');
        wx.setNavigationBarTitle({ title: titleStr });

        this.fetchData(true); 
      }).catch(() => this.fetchData(true));
    });
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang, t: i18n.t() });
    
    let updatedSales = this.data.salesOptions;
    if (updatedSales.length > 0) {
      updatedSales[0].name = lang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด';
      this.setData({ salesOptions: updatedSales });
    }
    this.fetchStatusDict(lang);
  },

  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict').where({ type: 'customer_status', status: 'active' }).orderBy('sort', 'asc').get();
      const dictMap = {};
      const dynamicFilters = [
        { value: 'all', label: lang === 'zh' ? '全部状态' : 'สถานะทั้งหมด' },
        { value: 'overdue', label: lang === 'zh' ? '已逾期 (需立即处理)' : 'เลยกำหนด (ต้องจัดการ)' }
      ];

      res.data.forEach(item => {
        const label = lang === 'zh' ? item.label_zh : item.label_th;
        dictMap[item.value] = label;
        dynamicFilters.push({ value: item.value, label: label });
      });
      
      this.setData({ localizedStatusMap: dictMap, statusFilterOptions: dynamicFilters });
    } catch (e) { console.error('获取动态状态字典失败', e); }
  },

  fetchSalesList() {
    db.collection('users').where({ role: 'sales' }).get().then(res => {
      const list = [{ _openid: 'all', name: this.data.currentLang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด' }].concat(res.data);
      this.setData({ salesOptions: list });
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;
    this.setData({ activeTab: tab, page: 0, hasMore: true }, () => this.fetchData(true));
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value.trim() }); },
  onSearch() { this.fetchData(true); },
  clearSearch() { this.setData({ searchKeyword: '' }, () => this.fetchData(true)); },
  onSalesChange(e) { this.setData({ selectedSalesIndex: e.detail.value }, () => this.fetchData(true)); },
  onStatusFilterChange(e) { this.setData({ selectedStatusIndex: e.detail.value }, () => this.fetchData(true)); },
  onDateChange(e) { this.setData({ selectedDate: e.detail.value }, () => this.fetchData(true)); },
  clearDate() { this.setData({ selectedDate: '' }, () => this.fetchData(true)); },

  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 }, () => this.fetchData(false));
    }
  },

  fetchData(reset = false) {
    if (this.data.isLoading) return;
    if (reset) this.setData({ page: 0, hasMore: true, customerList: [] });
    if (!reset && !this.data.hasMore) return;

    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    const todayStr = this.getTodayString();
    let andConditions = [];

    // 1. 归属过滤
    if (!this.data.isAdmin) {
      andConditions.push({ assigned_sales_id: this.data.myOpenId });
    } else if (this.data.selectedSalesIndex > 0) {
      andConditions.push({ assigned_sales_id: this.data.salesOptions[this.data.selectedSalesIndex]._openid });
    }

    // 2. Tab过滤（重点客户）
    if (this.data.activeTab === 'key_customers') {
      andConditions.push({ is_key_customer: true });
    }

    // 3. 搜索框
    if (this.data.searchKeyword) {
      const regex = db.RegExp({ regexp: this.data.searchKeyword, options: 'i' });
      andConditions.push(_.or([{ name: regex }, { phone: regex }, { city: regex }]));
    }

    // 4. 状态过滤
    if (this.data.selectedStatusIndex > 0) {
      const selectedStatus = this.data.statusFilterOptions[this.data.selectedStatusIndex].value;
      if (selectedStatus === 'pending') {
        andConditions.push({ status: _.in(['pending', '', null]) });
      } else if (selectedStatus === 'overdue') {
        const todayStart = new Date(todayStr + 'T00:00:00+07:00');
        andConditions.push({ status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) });
        andConditions.push(
          _.or([
            { next_follow_up: _.lt(todayStr).and(_.neq('')) },
            _.and([
              _.or([{ next_follow_up: '' }, { next_follow_up: _.exists(false) }, { next_follow_up: null }]),
              { createTime: _.lt(todayStart) }
            ])
          ])
        );
      } else {
        andConditions.push({ status: selectedStatus });
      }
    }

    // 5. 日期过滤
    if (this.data.selectedDate) {
      const start = new Date(this.data.selectedDate + 'T00:00:00+07:00');   
      const end = new Date(this.data.selectedDate + 'T23:59:59+07:00');   
      andConditions.push(
        _.or([
          { last_follow_up_time: _.gte(start).and(_.lte(end)) }, 
          _.and([ { last_follow_up_time: _.exists(false) }, { updateTime: _.gte(start).and(_.lte(end)) } ])
        ])
      );
    }

    db.collection('customers').where(andConditions.length > 0 ? _.and(andConditions) : {})
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize).limit(this.data.pageSize).get()
      .then(res => {
        const newData = res.data.map(item => {
          let createDateStr = item.createTime ? this.formatDate(new Date(item.createTime)) : todayStr;
          item.formattedCreateTime = createDateStr;

          const ut = item.last_follow_up_time || item.updateTime;
          if (ut) {
            const ud = new Date(ut);
            item.formattedUpdateTime = `${ud.getFullYear()}-${('0' + (ud.getMonth() + 1)).slice(-2)}-${('0' + ud.getDate()).slice(-2)} ${('0' + ud.getHours()).slice(-2)}:${('0' + ud.getMinutes()).slice(-2)}`;
          } else { item.formattedUpdateTime = ''; }

          let compareDate = item.next_follow_up || createDateStr;
          item.isOverdue = (compareDate && compareDate < todayStr && !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status));
          return item;
        });

        this.setData({
          customerList: reset ? newData : this.data.customerList.concat(newData),
          hasMore: res.data.length === this.data.pageSize,
          isLoading: false
        });
        wx.hideNavigationBarLoading();
      })
      .catch(err => { this.setData({ isLoading: false }); wx.hideNavigationBarLoading(); });
  },

  formatDate(date) {
    return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;
  },

  getTodayString() { return this.formatDate(new Date()); },

  makePhoneCall(e) {
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum || phoneNum.trim() === '') return wx.showToast({ title: '没有电话号码', icon: 'none' });
    wx.showModal({
      title: '拨打确认',
      content: '是否呼叫 ' + phoneNum + '？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ isCalling: true });
          wx.makePhoneCall({ phoneNumber: phoneNum, fail: () => this.setData({ isCalling: false }) });
        }
      }
    });
  },

  goToDetail(e) { wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` }); }
});