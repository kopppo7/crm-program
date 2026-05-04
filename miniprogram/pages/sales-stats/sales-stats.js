const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    salesStats: [],
    todayStr: '',
    tomorrowStr: '', // 🌟 新增明天的日期变量
    isLoading: true
  },

  onLoad() {
    this.initDates();
    this.fetchData();
  },

  onPullDownRefresh() {
    this.fetchData().then(() => {
      wx.stopPullDownRefresh(); 
    });
  },

  initDates() {
    // 计算今天
    const d = new Date();
    const year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if (month < 10) month = '0' + month;
    if (day < 10) day = '0' + day;
    const todayStr = `${year}-${month}-${day}`;

    // 🌟 计算明天
    const d2 = new Date();
    d2.setDate(d2.getDate() + 1); // 日期加 1 天
    const tYear = d2.getFullYear();
    let tMonth = d2.getMonth() + 1;
    let tDay = d2.getDate();
    if (tMonth < 10) tMonth = '0' + tMonth;
    if (tDay < 10) tDay = '0' + tDay;
    const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;

    this.setData({ todayStr, tomorrowStr });
  },

  async fetchData() {
    wx.showNavigationBarLoading();
    this.setData({ isLoading: true });

    try {
      const usersRes = await db.collection('users').where({ role: 'sales' }).get();
      const salesList = usersRes.data;

      const today = this.data.todayStr;
      const tomorrow = this.data.tomorrowStr; // 🌟 拿到明天的日期字符串
      let statsArr = [];

      for (let sales of salesList) {
        const openid = sales._openid || sales.openid; 
        if (!openid) continue;

        // A：名下总客户数 (移动到名字后面)
        const totalRes = await db.collection('customers')
          .where({ assigned_sales_id: openid })
          .count();

        // B：今日跟进次数（今天实际写的跟进记录）
        const todayRes = await db.collection('follow_up_logs')
          .where({ 
            sales_id: openid,
            createTimeStr: today 
          })
          .count();

        // 🌟 C：新增 今日待办剩余（状态未结案，且约定时间刚好是今天）
        const todayTasksRes = await db.collection('customers').where(_.and([
          { assigned_sales_id: openid },
          { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
          { next_follow_up: today } 
        ])).count();

        // D：明日计划跟进
        const tomorrowRes = await db.collection('customers').where(_.and([
          { assigned_sales_id: openid },
          { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
          { next_follow_up: tomorrow } 
        ])).count();

        // E：逾期待办数量
        const overdueRes = await db.collection('customers').where(_.and([
          { assigned_sales_id: openid },
          { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
          { next_follow_up: _.lt(today) },
          { next_follow_up: _.neq('') },
          { next_follow_up: _.neq(null) }
        ])).count();

        statsArr.push({
          name: sales.name || '未知销售',
          avatarText: (sales.name || 'S').substring(0, 1).toUpperCase(),
          totalCustomers: totalRes.total,
          todayFollowUps: todayRes.total,
          todayRemaining: todayTasksRes.total, // 🌟 新增的数据
          tomorrowFollowUps: tomorrowRes.total,
          overdueCount: overdueRes.total
        });
      }

      statsArr.sort((a, b) => b.todayFollowUps - a.todayFollowUps);

      this.setData({ salesStats: statsArr, isLoading: false });

    } catch (err) {
      console.error('统计数据拉取失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading();
    }
  }
});