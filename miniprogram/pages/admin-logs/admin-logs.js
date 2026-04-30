const db = wx.cloud.database();

Page({
  data: {
    logs: [],
    isLoading: false
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '操作日志 / ประวัติการทำงาน' });
    this.fetchAdminLogs();
  },

  fetchAdminLogs() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    // 🌟 正则匹配抓取所有的分配动作
    db.collection('follow_up_logs').where({
      note: db.RegExp({
        regexp: '【主管操作】|\\[แอดมิน\\]',
        options: 'i'
      })
    })
    .orderBy('createTime', 'desc')
    .limit(50)
    .get()
    .then(res => {
      const formattedLogs = res.data.map(log => {
        if (log.createTime) {
          const d = new Date(log.createTime);
          log.timeStr = `${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)} ${('0'+d.getHours()).slice(-2)}:${('0'+d.getMinutes()).slice(-2)}`;
        }
        return log;
      });

      this.setData({ logs: formattedLogs, isLoading: false });
      wx.hideNavigationBarLoading();
    })
    .catch(err => {
      console.error('获取日志失败', err);
      this.setData({ isLoading: false });
      wx.hideNavigationBarLoading();
    });
  },

  // 点击穿透到详情页
  goToDetail(e) {
    const customerId = e.currentTarget.dataset.cid;
    if (customerId) {
      wx.navigateTo({
        url: `/pages/customer-detail/customer-detail?id=${customerId}`
      });
    }
  }
});