const db = wx.cloud.database();

Page({
  data: {
    currentTab: 'daily', // daily 或 weekly
    listData: [],
    isLoading: false
  },

  onShow() {
    wx.setNavigationBarTitle({
      title: 'ประวัติรายงาน' // 泰语：历史汇报记录
    });
    this.fetchData();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.currentTab === tab) return;
    this.setData({ currentTab: tab, listData: [] });
    this.fetchData();
  },

  async fetchData() {
    this.setData({ isLoading: true });
    wx.showLoading({ title: 'กำลังโหลด...' /* 泰语：加载中 */ });

    try {
      const myOpenId = wx.getStorageSync('myOpenId');
      const collectionName = this.data.currentTab === 'daily' ? 'report_daily' : 'report_weekly';
      
      // 拉取当前销售自己提交的数据
      const res = await db.collection(collectionName)
        .where({ sales_id: myOpenId })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get();

      this.setData({
        listData: res.data,
        isLoading: false
      });
    } catch (err) {
      console.error('获取历史记录失败', err);
      wx.showToast({ title: 'ข้อผิดพลาดเครือข่าย' /* 泰语：网络错误 */, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    // 跳转到极简纯净版详情页 (下一步马上创建)
    wx.navigateTo({
      url: `/package-report/pages/history-detail/history-detail?id=${id}&type=${this.data.currentTab}`
    });
  }
});