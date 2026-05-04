const db = wx.cloud.database();

Page({
  data: {
    logs: [],
    isLoading: false,
    userList: [{ name: '全部人员 / ทั้งหมด', _openid: 'all' }], 
    selectedIndex: 0,
    // 🌟 新增分页相关的状态变量
    page: 0,          // 当前页码（从0开始）
    pageSize: 20,     // 每次滑到底部拉取 20 条
    hasMore: true     // 标记数据库里是否还有更多数据没拉完
  },

  onLoad() {
    this.fetchUserList();
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '操作日志 / ประวัติการทำงาน' });
    // 每次显示页面时，重置分页并拉取最新
    this.resetAndFetch();
  },

  // 获取团队人员名单
  fetchUserList() {
    db.collection('users').get().then(res => {
      const users = res.data.map(u => ({
        name: u.name || '未知成员',
        _openid: u._openid || u.openid
      }));
      this.setData({
        userList: [{ name: '全部人员 / ทั้งหมด', _openid: 'all' }].concat(users)
      });
    }).catch(err => console.error('获取人员列表失败', err));
  },

  // 切换人员时触发
  onUserChange(e) {
    const index = e.detail.value;
    this.setData({ selectedIndex: index });
    this.resetAndFetch(); // 切换人员后，重置并重新拉取
  },

  // 🌟 新增：重置数据池并从头拉取
  resetAndFetch() {
    this.setData({
      logs: [],
      page: 0,
      hasMore: true
    });
    this.fetchLogs();
  },

  // 🌟 核心改造：带分页的拉取逻辑
  fetchLogs() {
    // 如果正在加载，或者已经没有更多数据了，就不要重复请求
    if (this.data.isLoading || !this.data.hasMore) return;
    
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    const selectedUser = this.data.userList[this.data.selectedIndex];
    let query = {};

    if (selectedUser._openid !== 'all') {
      query.sales_id = selectedUser._openid;
    }

    db.collection('follow_up_logs')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize) // 🌟 跳过已经加载过的数据
      .limit(this.data.pageSize)                 // 🌟 每次只拉取 20 条
      .get()
      .then(res => {
        const formattedLogs = res.data.map(log => {
          if (log.createTime) {
            const d = new Date(log.createTime);
            log.timeStr = `${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)} ${('0'+d.getHours()).slice(-2)}:${('0'+d.getMinutes()).slice(-2)}`;
          }
          return log;
        });

        // 将新拉取的数据拼接到旧数据的后面
        this.setData({ 
          logs: this.data.logs.concat(formattedLogs), 
          isLoading: false,
          page: this.data.page + 1, // 页码加 1
          hasMore: res.data.length === this.data.pageSize // 如果本次拉取不够 20 条，说明到底了
        });
        
        wx.hideNavigationBarLoading();
      })
      .catch(err => {
        console.error('获取日志失败', err);
        this.setData({ isLoading: false });
        wx.hideNavigationBarLoading();
      });
  },

  // 🌟 新增：微信小程序原生的“页面触底”事件
  onReachBottom() {
    if (this.data.hasMore) {
      this.fetchLogs(); // 只要还有数据，滑到底部就自动拉取下一页
    } else {
      wx.showToast({ title: '没有更多记录了', icon: 'none' });
    }
  },

  // 🌟 新增：下拉刷新页面事件
  onPullDownRefresh() {
    this.resetAndFetch();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  goToDetail(e) {
    const customerId = e.currentTarget.dataset.cid;
    if (customerId) {
      wx.navigateTo({
        url: `/pages/customer-detail/customer-detail?id=${customerId}`
      });
    }
  }
});