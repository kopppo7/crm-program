const i18n = require('../../utils/i18n.js'); 
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    isCalling: false,
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
    localizedStatusMap: {} 
  },

  onShow() {
    this.initLanguage();

    const currentId = wx.getStorageSync('myOpenId');
    if (!currentId) {
      return wx.showToast({ title: '身份丢失', icon: 'none' });
    }

    // 从拨号界面返回时同样刷新待办，避免状态停留旧数据。
    if (this.data.isCalling) {
      this.setData({ isCalling: false });
    }

    this.setData({ myOpenId: currentId }, () => {
      // fetchData(true) 内会统一刷新未接电话角标，避免重复查询两次
      this.fetchData(true);
    });
  },

  initLanguage() {
    const lang = i18n.getLang();
    this.setData({
      currentLang: lang,
      t: i18n.t()
    });
    wx.setNavigationBarTitle({ title: lang === 'zh' ? '今日待办' : 'งานวันนี้' });
    this.fetchStatusDict(lang);
  },

  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict').where({ type: 'customer_status', status: 'active' }).get();
      const dictMap = {};
      res.data.forEach(item => {
        dictMap[item.value] = lang === 'zh' ? item.label_zh : item.label_th;
      });
      this.setData({ localizedStatusMap: dictMap });
    } catch (e) {
      console.error('获取字典失败', e);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;
    this.setData({ activeTab: tab, page: 0, hasMore: true }, () => {
      this.fetchData(true);
    });
  },

  fetchNoAnswerCount() {
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
    ])).count()
      .then(res => this.setData({ noAnswerCount: res.total }))
      .catch(err => {
        console.error('获取未接电话数量失败', err);
        this.setData({ noAnswerCount: 0 });
      });
  },

  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value.trim() }); },
  onSearch() { this.fetchData(true); },
  clearSearch() { this.setData({ searchKeyword: '' }, () => this.fetchData(true)); },

  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ page: this.data.page + 1 }, () => this.fetchData(false));
    }
  },

  fetchData(reset = false) {
    if (this.data.isLoading) return;
    let currentPage = this.data.page;

    if (reset) {
      currentPage = 0;
      this.setData({ page: 0, hasMore: true, customerList: [] });
      this.fetchNoAnswerCount(); 
    }
    if (!reset && !this.data.hasMore) return;

    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();

    const todayStr = this.getTodayString();
    let andConditions = [{ assigned_sales_id: this.data.myOpenId }];

    if (this.data.searchKeyword) {
      const regex = db.RegExp({ regexp: this.data.searchKeyword, options: 'i' });
      andConditions.push(_.or([{ name: regex }, { phone: regex }, { city: regex }, { payload: regex }]));
    }

    if (this.data.activeTab === 'all_todo') {
      andConditions.push({
        status: _.nin(['Closed Won', 'Closed Lost', 'Invalid', 'No Answer'])
      });

      // 今日待办统一时间墙：
      // 1. 未设置 next_follow_up：立即进入今日待办
      // 2. next_follow_up <= 今天：进入今日待办
      // 3. next_follow_up > 今天：不提前显示，即使状态是 pending 也一样
      andConditions.push(
        _.or([
          { next_follow_up: _.lte(todayStr) },
          { next_follow_up: '' },
          { next_follow_up: null },
          { next_follow_up: _.exists(false) }
        ])
      );
    } else if (this.data.activeTab === 'no_answer') {
      andConditions.push({ status: 'No Answer' });
      andConditions.push(
        _.or([
          { next_follow_up: _.lte(todayStr) },
          { next_follow_up: '' },
          { next_follow_up: null },
          { next_follow_up: _.exists(false) }
        ])
      );
    }

    db.collection('customers').where(_.and(andConditions)).orderBy('createTime', 'desc')
      .skip(currentPage * this.data.pageSize).limit(this.data.pageSize).get()
      .then(res => {
        const validData = res.data.filter(item => {
          if (['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            return false;
          }

          const hasNextFollowUp =
            item.next_follow_up &&
            item.next_follow_up !== 'none';

          if (this.data.activeTab === 'no_answer') {
            if (item.status !== 'No Answer') return false;
            return !hasNextFollowUp || item.next_follow_up <= todayStr;
          }

          if (item.status === 'No Answer') return false;

          // 空日期立即进入今日待办；未来日期绝不提前出现。
          return !hasNextFollowUp || item.next_follow_up <= todayStr;
        });

        const newData = validData.map(item => {
          const createDateStr = item.createTime
            ? this.formatDate(new Date(item.createTime))
            : todayStr;

          item.formattedCreateTime = createDateStr;

          const hasNextFollowUp =
            item.next_follow_up &&
            item.next_follow_up !== 'none';

          // 没有指定下次跟进时间时：
          // 管理员重新处理客户优先用 last_reprocess_time / updateTime 判断是否逾期。
          // 这样 9月9日打回当天不显示逾期，9月10日仍未处理才显示逾期。
          const fallbackTime =
            item.last_reprocess_time ||
            item.updateTime ||
            item.createTime;

          const fallbackDate = fallbackTime
            ? this.formatDate(new Date(fallbackTime))
            : todayStr;

          const compareDate = hasNextFollowUp
            ? item.next_follow_up
            : fallbackDate;

          item.isOverdue =
            !!compareDate &&
            compareDate < todayStr &&
            !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status);

          // 有日期显示具体日期；无日期明确显示“今日”
          item.todoDisplayDate = hasNextFollowUp
            ? item.next_follow_up
            : (this.data.currentLang === 'zh' ? '今日' : 'วันนี้');

          // 未接电话状态：直接使用客户主表的 last_follow_up_time。
          // 销售每次提交跟进时都会更新该字段，因此无需逐个查询 follow_up_logs，
          // 避免增加额外数据库压力。
          item.lastCallDisplay =
            item.status === 'No Answer' && item.last_follow_up_time
              ? this.formatDateTime(item.last_follow_up_time)
              : '';

          item.lastCallTimestamp =
            item.status === 'No Answer' && item.last_follow_up_time
              ? new Date(item.last_follow_up_time).getTime()
              : 0;

          if (!Number.isFinite(item.lastCallTimestamp)) {
            item.lastCallTimestamp = 0;
          }

          // last_reprocess_time 仅用于判断重新处理后的逾期起点，
          // 今日待办列表不再显示“已驳回/重新处理”状态。
          return item;
        });

        this.setData({
          customerList: reset ? newData : this.data.customerList.concat(newData),
          hasMore: res.data.length === this.data.pageSize,
          isLoading: false
        });
        wx.hideNavigationBarLoading();
      })
      .catch(err => {
        console.error('获取今日待办失败', err);
        this.setData({ isLoading: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '待办加载失败', icon: 'none' });
      });
  },

  formatDate(date) {
    return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;
  },

  formatDateTime(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  getTodayString() { return this.formatDate(new Date()); },

  makePhoneCall(e) {
    const phoneNum = String(e.currentTarget.dataset.phone || '');
    const status = e.currentTarget.dataset.status || '';
    const lastCallTimestamp = Number(e.currentTarget.dataset.lastCallTs || 0);

    if (!phoneNum || phoneNum.trim() === '') {
      return wx.showToast({
        title: this.data.currentLang === 'zh' ? '没有电话号码' : 'ไม่มีหมายเลขโทรศัพท์',
        icon: 'none'
      });
    }

    const doCall = () => {
      this.setData({ isCalling: true });

      wx.makePhoneCall({
        phoneNumber: phoneNum,
        fail: () => {
          this.setData({ isCalling: false });
        }
      });
    };

    const showNormalConfirm = () => {
      wx.showModal({
        title: this.data.currentLang === 'zh' ? '拨打确认' : 'ยืนยันการโทร',
        content: this.data.currentLang === 'zh'
          ? `是否呼叫 ${phoneNum}？`
          : `ต้องการโทร ${phoneNum} หรือไม่?`,
        confirmText: this.data.currentLang === 'zh' ? '确认拨打' : 'โทร',
        cancelText: this.data.currentLang === 'zh' ? '取消拨打' : 'ยกเลิก',
        success: (res) => {
          if (res.confirm) {
            doCall();
          }
        }
      });
    };

    // 仅对“未接电话”状态做2小时校验
    if (
      status === 'No Answer' &&
      lastCallTimestamp > 0
    ) {
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const elapsed = Date.now() - lastCallTimestamp;

      if (elapsed >= 0 && elapsed < TWO_HOURS) {
        const remainingMinutes = Math.max(
          1,
          Math.ceil((TWO_HOURS - elapsed) / 60000)
        );

        const lastCallText = this.formatDateTime(lastCallTimestamp);

        wx.showModal({
          title: this.data.currentLang === 'zh'
            ? '拨打间隔提醒'
            : 'แจ้งเตือนช่วงเวลาการโทร',
          content: this.data.currentLang === 'zh'
            ? `距离上次拨打时间不满2小时，是否确认拨打？\n上次拨打：${lastCallText}\n约${remainingMinutes}分钟后满2小时`
            : `เวลาจากการโทรครั้งล่าสุดยังไม่ครบ 2 ชั่วโมง ยืนยันว่าจะโทรหรือไม่?\nโทรล่าสุด: ${lastCallText}\nอีกประมาณ ${remainingMinutes} นาทีจะครบ 2 ชั่วโมง`,
          confirmText: this.data.currentLang === 'zh' ? '确认拨打' : 'ยืนยันโทร',
          cancelText: this.data.currentLang === 'zh' ? '取消拨打' : 'ยกเลิก',
          confirmColor: '#ef4444',
          success: (res) => {
            if (res.confirm) {
              doCall();
            }
          }
        });

        return;
      }
    }

    // 非未接电话，或距离上次拨打已满2小时，走普通拨打确认
    showNormalConfirm();
  },

  goToDetail(e) { wx.navigateTo({ url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}` }); }
});