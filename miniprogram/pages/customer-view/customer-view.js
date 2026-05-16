const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js'); // 🌟 引入多语言

Page({
  data: {
    customerList: [],
    searchKeyword: '',
    selectedDate: '', // 🌟 新增：存放选中的具体日期
    
    salesOptions: [],
    selectedSalesIndex: 0,
    
    statusFilterOptions: [],
    selectedStatusIndex: 0,

    t: {}, 
    currentLang: 'zh',
    statusMap: {},
    isCalling: false, // 🌟 拨号防刷新锁

    page: 0,
    pageSize: 20,
    hasMore: true,
    isLoading: false
  },

  onLoad() {
    this.fetchSalesList();
  },

  onShow() {
    this.initLanguage(); // 🌟 初始化语言
    
    // 如果是因为拨打完电话切回来的，拦截刷新，保持阅读位置
    if (this.data.isCalling) {
      this.setData({ isCalling: false });
      return; 
    }
    this.fetchData(true); 
  },

  // 🌟 初始化语言与动态下拉菜单
  initLanguage() {
    const lang = i18n.getLang();
    const trans = i18n.t();
    this.setData({
      currentLang: lang,
      t: trans,
      statusMap: trans.status 
    });
    
    wx.setNavigationBarTitle({ title: lang === 'zh' ? '全部客户' : 'ลูกค้าทั้งหมด' });

    // 动态生成状态筛选字典
    const statusFilters = lang === 'zh' ? [
      { value: 'all', label: '全部状态' },
      { value: 'pending', label: '未处理(待办)' },
      { value: 'following', label: '跟进中' },
      { value: 'won', label: '已成交' },
      { value: 'lost', label: '战败/无效' }
    ] : [
      { value: 'all', label: 'สถานะทั้งหมด' },
      { value: 'pending', label: 'รอดำเนินการ' },
      { value: 'following', label: 'กำลังติดตาม' },
      { value: 'won', label: 'ปิดการขาย' },
      { value: 'lost', label: 'ปฏิเสธ/ไม่มีประโยชน์' }
    ];

    // 更新状态菜单，如果你已经获取了销售列表，顺便更新一下“全部销售”的翻译
    let updatedSales = this.data.salesOptions;
    if (updatedSales.length > 0) {
      updatedSales[0].name = lang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด';
    }

    this.setData({ 
      statusFilterOptions: statusFilters,
      salesOptions: updatedSales
    });
  },

  fetchSalesList() {
    db.collection('users').where({ role: 'sales' }).get().then(res => {
      const allText = this.data.currentLang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด';
      const list = [{ _openid: 'all', name: allText }].concat(res.data);
      this.setData({ salesOptions: list });
    }).catch(err => console.error('获取销售列表失败', err));
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value.trim() }); },
  onSearch() { this.fetchData(true); },
  clearSearch() { this.setData({ searchKeyword: '' }, () => { this.fetchData(true); }); },
  onSalesChange(e) { this.setData({ selectedSalesIndex: e.detail.value }, () => { this.fetchData(true); }); },
  onStatusFilterChange(e) { this.setData({ selectedStatusIndex: e.detail.value }, () => { this.fetchData(true); }); },

  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchData(false); 
      });
    }
  },

  fetchData(reset = false) {
    if (reset) this.setData({ page: 0, hasMore: true, customerList: [] });
    if (!this.data.hasMore || this.data.isLoading) return;

    this.setData({ isLoading: true });
    if (reset) wx.showLoading({ title: this.data.currentLang === 'zh' ? '加载中...' : 'กำลังโหลด...' });
    
    let conditions = [];
    // 🌟 新增：如果有选中某一天，查询该日 00:00:00 到 23:59:59 的所有客户
    if (this.data.selectedDate) {
      // 将 YYYY-MM-DD 替换为 YYYY/MM/DD 以完美兼容苹果 iOS 手机的底层日期解析
      const dateStr = this.data.selectedDate.replace(/-/g, '/');
      const startOfDay = new Date(`${dateStr} 00:00:00`);
      const endOfDay = new Date(`${dateStr} 23:59:59`);
      
      conditions.push({
        createTime: _.gte(startOfDay).and(_.lte(endOfDay))
      });
    }

    if (this.data.salesOptions.length > 0) {
      const selectedSales = this.data.salesOptions[this.data.selectedSalesIndex];
      if (selectedSales._openid !== 'all') {
        conditions.push({ assigned_sales_id: selectedSales._openid });
      }
    }

    if (this.data.statusFilterOptions.length > 0) {
      const selectedStatusVal = this.data.statusFilterOptions[this.data.selectedStatusIndex].value;
      if (selectedStatusVal === 'pending') {
        conditions.push({ status: 'pending' });
      } else if (selectedStatusVal === 'following') {
        conditions.push({ status: _.in(['Contacted', 'Strong Intent', 'Quoted', 'Demo Scheduled']) });
      } else if (selectedStatusVal === 'won') {
        conditions.push({ status: 'Closed Won' });
      } else if (selectedStatusVal === 'lost') {
        conditions.push({ status: _.in(['Closed Lost', 'Invalid']) });
      }
    }

    if (this.data.searchKeyword) {
      const regex = db.RegExp({ regexp: this.data.searchKeyword, options: 'i' });
      conditions.push(
        _.or([
          { name: regex }, { phone: regex }, { city: regex }, { payload: regex }, { timeline: regex }
        ])
      );
    }

    let queryObj = conditions.length > 0 ? _.and(conditions) : {};

    db.collection('customers')
      .where(queryObj)
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize)
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
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  },

  // 🌟 纯英文拨打确认，且开启防刷新锁
  makePhoneCall(e) { 
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum) return;

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

  goToDetail(e) {
    wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` });
  },
  onSalesChange(e) { this.setData({ selectedSalesIndex: e.detail.value }, () => { this.fetchData(true); }); },
  onStatusFilterChange(e) { this.setData({ selectedStatusIndex: e.detail.value }, () => { this.fetchData(true); }); },

  // 🌟 新增：日期选择事件
  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value }, () => {
      this.fetchData(true); 
    });
  },

  // 🌟 新增：清除日期恢复全部
  clearDate() {
    this.setData({ selectedDate: '' }, () => {
      this.fetchData(true);
    });
  },
})