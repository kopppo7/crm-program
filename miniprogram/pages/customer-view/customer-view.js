const db = wx.cloud.database();
const _ = db.command;
const i18n = require('../../utils/i18n.js'); // 🌟 引入多语言

Page({
  data: {
    customerList: [],
    searchKeyword: '',
    selectedDate: '', 

    salesOptions: [],
    selectedSalesIndex: 0,

    statusFilterOptions: [],
    selectedStatusIndex: 0,

    t: {},
    currentLang: 'zh',
    statusMap: {},
    isCalling: false, 

    page: 0,
    pageSize: 20,
    hasMore: true,
    isLoading: false,
    
    localizedStatusMap: {} // 🌟 新增：存放从数据库拉取的动态双语字典映射
  },

  onLoad() {
    this.fetchSalesList();
  },

  onShow() {
    this.initLanguage(); 

    if (this.data.isCalling) {
      this.setData({
        isCalling: false
      });
      return;
    }
    this.fetchData(true);
  },

  initLanguage() {
    const lang = i18n.getLang();
    const trans = i18n.t();
    this.setData({
      currentLang: lang,
      t: trans,
      statusMap: trans.status
    });

    wx.setNavigationBarTitle({
      title: lang === 'zh' ? '全部客户' : 'ลูกค้าทั้งหมด'
    });

    let updatedSales = this.data.salesOptions;
    if (updatedSales.length > 0) {
      updatedSales[0].name = lang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด';
    }

    this.setData({
      salesOptions: updatedSales
    });

    // 🌟 核心升级：动态拉取系统状态字典并生成下拉筛选菜单
    this.fetchStatusDict(lang);
  },

  // 🌟 核心升级：从 system_dict 拉取动态字典并生成筛选器
  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict')
        .where({ type: 'customer_status', status: 'active' })
        .orderBy('sort', 'asc')
        .get();

      const dictMap = {};
      // 🌟 保留顶部的两个特殊筛选逻辑：全部、逾期
      const dynamicFilters = [
        { value: 'all', label: lang === 'zh' ? '全部状态' : 'สถานะทั้งหมด' },
        { value: 'overdue', label: lang === 'zh' ? '已逾期 (需立即处理)' : 'เลยกำหนด (ต้องจัดการ)' }
      ];

      res.data.forEach(item => {
        const label = lang === 'zh' ? item.label_zh : item.label_th;
        dictMap[item.value] = label;
        // 将数据库中的字典项按顺序加入到顶部的下拉筛选菜单中
        dynamicFilters.push({ value: item.value, label: label });
      });
      
      this.setData({ 
        localizedStatusMap: dictMap,
        statusFilterOptions: dynamicFilters
      });
    } catch (e) {
      console.error('获取动态状态字典失败', e);
    }
  },

  fetchSalesList() {
    db.collection('users').where({
      role: 'sales'
    }).get().then(res => {
      const allText = this.data.currentLang === 'zh' ? '全部销售' : 'พนักงานขายทั้งหมด';
      const list = [{
        _openid: 'all',
        name: allText
      }].concat(res.data);
      this.setData({
        salesOptions: list
      });
    }).catch(err => console.error('获取销售列表失败', err));
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value.trim()
    });
  },
  onSearch() {
    this.fetchData(true);
  },
  clearSearch() {
    this.setData({
      searchKeyword: ''
    }, () => {
      this.fetchData(true);
    });
  },
  onSalesChange(e) {
    this.setData({
      selectedSalesIndex: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },
  onStatusFilterChange(e) {
    this.setData({
      selectedStatusIndex: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },

  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.fetchData(false);
      });
    }
  },

  fetchData(isRefresh = false) {
    if (isRefresh) {
      this.setData({
        page: 0,
        hasMore: true,
        customerList: []
      });
    }
    if (!this.data.hasMore || this.data.isLoading) return;

    this.setData({
      isLoading: true
    });
    wx.showNavigationBarLoading();

    let conditions = {};
    const todayStr = this.getTodayString();

    if (this.data.searchKeyword) {
      conditions = _.or([{
          name: db.RegExp({ regexp: this.data.searchKeyword, options: 'i' })
        },
        {
          phone: db.RegExp({ regexp: this.data.searchKeyword, options: 'i' })
        },
        {
          city: db.RegExp({ regexp: this.data.searchKeyword, options: 'i' })
        }
      ]);
    }

    if (this.data.selectedSalesIndex > 0) {
      const selectedSales = this.data.salesOptions[this.data.selectedSalesIndex];
      conditions.assigned_sales_id = selectedSales._openid;
    }

    // 🌟 动态状态筛选逻辑适配
    if (this.data.selectedStatusIndex > 0) {
      const selectedStatus = this.data.statusFilterOptions[this.data.selectedStatusIndex].value;
      if (selectedStatus === 'pending') {
        conditions.status = _.in(['pending', '', null]);
      } else if (selectedStatus === 'overdue') {
        const todayStart = new Date(todayStr + 'T00:00:00+07:00');
        conditions.status = _.nin(['Closed Won', 'Closed Lost', 'Invalid']);
        conditions = _.and([
          conditions,
          _.or([
            { next_follow_up: _.lt(todayStr).and(_.neq('')) },
            _.and([
              _.or([{ next_follow_up: '' }, { next_follow_up: _.exists(false) }, { next_follow_up: null }]),
              { createTime: _.lt(todayStart) }
            ])
          ])
        ]);
      } else {
        // 如果选中其他的云端字典状态，直接精确匹配 value
        conditions.status = selectedStatus;
      }
    }

    if (this.data.selectedDate) {
      const start = new Date(this.data.selectedDate + 'T00:00:00+07:00');   
      const end = new Date(this.data.selectedDate + 'T23:59:59+07:00');   

      conditions = _.and([
        conditions, 
        _.or([
          { last_follow_up_time: _.gte(start).and(_.lte(end)) }, 
          _.and([
            { last_follow_up_time: _.exists(false) }, 
            { updateTime: _.gte(start).and(_.lte(end)) }
          ])
        ])
      ]);
    }

    db.collection('customers').where(conditions)
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
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

          const ut = item.last_follow_up_time || item.updateTime;

          if (ut) {
            const ud = new Date(ut);
            const uy = ud.getFullYear();
            const um = ('0' + (ud.getMonth() + 1)).slice(-2);
            const uday = ('0' + ud.getDate()).slice(-2);
            const uh = ('0' + ud.getHours()).slice(-2);
            const umin = ('0' + ud.getMinutes()).slice(-2);

            item.formattedUpdateTime = `${uy}-${um}-${uday} ${uh}:${umin}`;
          } else {
            item.formattedUpdateTime = '';
          }

          let compareDate = item.next_follow_up || createDateStr;
          if (compareDate && compareDate < todayStr && !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            item.isOverdue = true;
          } else {
            item.isOverdue = false;
          }

          return item;
        });

        this.setData({
          customerList: isRefresh ? newData : this.data.customerList.concat(newData),
          page: this.data.page + 1,
          hasMore: res.data.length === this.data.pageSize,
          isLoading: false
        });

        wx.hideNavigationBarLoading();
        if (isRefresh) wx.stopPullDownRefresh();
      })
      .catch(err => {
        console.error('拉取客户数据失败:', err);
        this.setData({
          isLoading: false
        });
        wx.hideNavigationBarLoading();
        if (isRefresh) wx.stopPullDownRefresh();
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  },

  makePhoneCall(e) {
    const phoneNum = String(e.currentTarget.dataset.phone);
    if (!phoneNum || phoneNum === 'undefined' || phoneNum === 'null' || phoneNum.trim() === '') {
      return wx.showToast({ title: '没有电话号码', icon: 'none' });
    }

    wx.showModal({
      title: 'Call Confirmation',
      content: 'Do you want to call ' + phoneNum + '?',
      confirmText: 'Call',
      cancelText: 'Cancel',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isCalling: true
          });
          wx.makePhoneCall({
            phoneNumber: phoneNum,
            fail: () => {
              this.setData({
                isCalling: false
              });
            }
          });
        }
      }
    });
  },

  goToDetail(e) {
    wx.navigateTo({
      url: `/pages/customer-detail/customer-detail?id=${e.currentTarget.dataset.id}`
    });
  },
  onSalesChange(e) {
    this.setData({
      selectedSalesIndex: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },
  onStatusFilterChange(e) {
    this.setData({
      selectedStatusIndex: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },

  onDateChange(e) {
    this.setData({
      selectedDate: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },

  clearDate() {
    this.setData({
      selectedDate: ''
    }, () => {
      this.fetchData(true);
    });
  },
});