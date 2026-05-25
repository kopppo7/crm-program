const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    activeStats: [],     // 正常销售数据
    disabledStats: [],   // 被禁用销售数据
    showDisabled: false, // 是否展开禁用销售
    todayStr: '',
    tomorrowStr: '', 
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
    const d = new Date();
    const year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if (month < 10) month = '0' + month;
    if (day < 10) day = '0' + day;
    const todayStr = `${year}-${month}-${day}`;

    const d2 = new Date();
    d2.setDate(d2.getDate() + 1); 
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
      // 获取所有销售（包括正常的和被禁用的）
      const usersRes = await db.collection('users').where({ role: 'sales' }).get();
      const salesList = usersRes.data;

      const today = this.data.todayStr;
      const tomorrow = this.data.tomorrowStr;
      
      let activeArr = [];
      let disabledArr = [];

      for (let sales of salesList) {
        const openid = sales._openid || sales.openid;
        if (!openid) continue;

        const totalRes = await db.collection('customers')
          .where({ assigned_sales_id: openid })
          .count();

        const todayRes = await db.collection('follow_up_logs')
          .where({ 
            sales_id: openid,
            createTimeStr: today 
          })
          .count();

          const todayTasksRes = await db.collection('customers').where(_.and([
            { assigned_sales_id: openid },
            { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) }, // 排除已结案的
            _.or([
              { next_follow_up: today }, // 情况1：明确约定今天跟进的
              { status: 'pending' },     // 情况2：状态是“待处理”的新线索
              { next_follow_up: '' },    // 情况3：没有约定时间的老旧遗留线索
              { next_follow_up: null }
            ])
          ])).count();

        const tomorrowRes = await db.collection('customers').where(_.and([
          { assigned_sales_id: openid },
          { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
          { next_follow_up: tomorrow } 
        ])).count();

        const overdueRes = await db.collection('customers').where(_.and([
          { assigned_sales_id: openid },
          { status: _.nin(['Closed Won', 'Closed Lost', 'Invalid']) },
          { next_follow_up: _.lt(today) },
          { next_follow_up: _.neq('') },
          { next_follow_up: _.neq(null) }
        ])).count();

        const statData = {
          name: sales.name || '未知销售',
          avatarText: (sales.name || 'S').substring(0, 1).toUpperCase(),
          totalCustomers: totalRes.total,
          todayFollowUps: todayRes.total,
          todayRemaining: todayTasksRes.total,
          tomorrowFollowUps: tomorrowRes.total,
          overdueCount: overdueRes.total
        };

        // 🌟 核心判断：根据用户状态分流
        if (sales.status === 'disabled') {
          disabledArr.push(statData);
        } else {
          activeArr.push(statData);
        }
      }

      // 分别按今日跟进次数排序
      activeArr.sort((a, b) => b.todayFollowUps - a.todayFollowUps);
      disabledArr.sort((a, b) => b.todayFollowUps - a.todayFollowUps);

      this.setData({ 
        activeStats: activeArr, 
        disabledStats: disabledArr, 
        isLoading: false 
      });

    } catch (err) {
      console.error('统计数据拉取失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  // 🌟 新增：切换展开/折叠被禁用销售的方法
  toggleDisabled() {
    this.setData({
      showDisabled: !this.data.showDisabled
    });
  }
});