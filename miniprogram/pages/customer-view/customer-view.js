const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    customerList: [],
    searchKeyword: '',
    
    salesOptions: [{ _openid: 'all', name: '全部销售' }],
    selectedSalesIndex: 0,
    
    statusFilterOptions: [
      { value: 'all', label: '全部状态' },
      { value: 'pending', label: '未处理(待办)' },
      { value: 'following', label: '跟进中' },
      { value: 'won', label: '已成交' },
      { value: 'lost', label: '战败/无效' }
    ],
    selectedStatusIndex: 0,

    statusMap: {
      'pending': '未处理',
      'Contacted': '初步沟通',
      'FollowUp': '再次跟进',
      'Strong Intent': '意向强烈',
      'Quoted': '已报价/发资料',
      'Demo Scheduled': '约定看机',
      'Closed Won': '✅ 已成交',
      'Closed Lost': '❌ 战败',
      'Invalid': '无效线索'
    },

    // 分页核心变量
    page: 0,
    pageSize: 20,
    hasMore: true,
    isLoading: false
  },

  onLoad() {
    this.fetchSalesList();
  },

  onShow() {
    this.fetchData(true); // 每次显示页面强制刷新第一页
  },

  fetchSalesList() {
    db.collection('users').where({ role: 'sales' }).get().then(res => {
      const list = [{ _openid: 'all', name: '全部销售' }].concat(res.data);
      this.setData({ salesOptions: list });
    }).catch(err => console.error('获取销售列表失败', err));
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value.trim() }); },
  onSearch() { this.fetchData(true); },
  clearSearch() { this.setData({ searchKeyword: '' }, () => { this.fetchData(true); }); },
  onSalesChange(e) { this.setData({ selectedSalesIndex: e.detail.value }, () => { this.fetchData(true); }); },
  onStatusFilterChange(e) { this.setData({ selectedStatusIndex: e.detail.value }, () => { this.fetchData(true); }); },

  // 滑动到底部触发
  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 }, () => {
        this.fetchData(false); // 传 false 表示追加数据，不重置
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

    const selectedSales = this.data.salesOptions[this.data.selectedSalesIndex];
    if (selectedSales._openid !== 'all') {
      conditions.push({ assigned_sales_id: selectedSales._openid });
    }

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
      .skip(this.data.page * this.data.pageSize) // 跳过前几页的数据
      .limit(this.data.pageSize)                 // 获取当前页数据
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

  goToDetail(e) {
    wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` });
  }
})