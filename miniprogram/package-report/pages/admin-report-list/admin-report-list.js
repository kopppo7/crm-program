const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentLang: 'zh',
    currentTab: 'daily',
    salesOptions: [],
    salesIndex: 0,
    filterDate: '', 
    dataList: [],
    isRefreshing: false
  },

  onLoad() {
    this.initDefaultDate(); // 🌟 开启默认当天
    this.fetchSalesList();
  },

  onShow() {
    this.setData({ currentLang: i18n.getLang() });
    this.fetchData();
  },

  // 🌟 锁定默认日期为今天
  initDefaultDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    this.setData({ filterDate: `${y}-${m}-${day}` });
  },

  async fetchSalesList() {
    try {
      const res = await db.collection('users').where({ role: 'sales' }).get();
      const list = [{ _openid: 'ALL', name: this.data.currentLang === 'zh' ? '👥 全部销售' : '👥 全部的销售' }];
      res.data.forEach(u => list.push({ _openid: u._openid, name: u.name }));
      this.setData({ salesOptions: list });
    } catch (err) {
      console.error('获取销售列表失败', err);
    }
  },

  async fetchData() {
    wx.showLoading({ title: '拉取数据中...' });
    try {
      const activeTab = this.data.currentTab;
      const targetCollection = activeTab === 'daily' ? 'report_daily' : 'report_weekly';
      
      let query = {};
      const selectedSales = this.data.salesOptions[this.data.salesIndex];
      if (selectedSales && selectedSales._openid !== 'ALL') {
        query.sales_id = selectedSales._openid;
      }
      if (activeTab === 'daily' && this.data.filterDate) {
        query.report_date = this.data.filterDate;
      }

      const res = await db.collection(targetCollection)
        .where(query)
        .orderBy('createTime', 'desc')
        .limit(50)
        .get();

      // 🌟 格式化提交时间
      const formattedData = res.data.map(item => {
        if (item.createTime) {
          const d = new Date(item.createTime);
          item.submitTime = `${('0'+d.getHours()).slice(-2)}:${('0'+d.getMinutes()).slice(-2)}`;
        } else {
          item.submitTime = '--:--';
        }
        return item;
      });

      this.setData({ dataList: formattedData });
    } catch (err) {
      console.error('加载失败', err);
    } finally {
      wx.hideLoading();
      this.setData({ isRefreshing: false });
    }
  },

  // 🌟 新增：点击卡片跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = this.data.currentTab;
    wx.navigateTo({
      url: `/package-report/pages/report-detail/report-detail?id=${id}&type=${type}`
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab, dataList: [] }, () => {
      this.fetchData();
    });
  },
  onSalesChange(e) { this.setData({ salesIndex: e.detail.value }, () => this.fetchData()); },
  onDateChange(e) { this.setData({ filterDate: e.detail.value }, () => this.fetchData()); },
  onRefresh() { this.setData({ isRefreshing: true }); this.fetchData(); }
});