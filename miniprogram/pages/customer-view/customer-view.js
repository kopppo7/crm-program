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
      this.setData({
        isCalling: false
      });
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

    wx.setNavigationBarTitle({
      title: lang === 'zh' ? '全部客户' : 'ลูกค้าทั้งหมด'
    });

    // 动态生成状态筛选字典
    // 🌟 核心修改 1：动态生成最新的状态筛选字典
    const statusFilters = lang === 'zh' ? [{
        value: 'all',
        label: '全部状态'
      },
      {
        value: 'pending',
        label: '待处理 (未联系)'
      },
      {
        value: 'no_answer',
        label: '未接通 (需重拨)'
      },
      {
        value: 'following',
        label: '跟进中 (进行中)'
      },
      {
        value: 'won',
        label: '已成交'
      },
      {
        value: 'lost',
        label: '拒绝 / 无效'
      }
    ] : [{
        value: 'all',
        label: 'สถานะทั้งหมด'
      },
      {
        value: 'pending',
        label: 'รอดำเนินการ'
      },
      {
        value: 'no_answer',
        label: 'ไม่รับสาย'
      },
      {
        value: 'following',
        label: 'กำลังติดตาม'
      },
      {
        value: 'won',
        label: 'ปิดการขาย'
      },
      {
        value: 'lost',
        label: 'ปฏิเสธ / ไม่มีประโยชน์'
      }
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

  // 🌟 完整版 fetchData (包含最新日期筛选与时间对齐逻辑)
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

    // 1. 关键字搜索条件
    if (this.data.searchKeyword) {
      conditions = _.or([{
          name: db.RegExp({
            regexp: this.data.searchKeyword,
            options: 'i'
          })
        },
        {
          phone: db.RegExp({
            regexp: this.data.searchKeyword,
            options: 'i'
          })
        },
        {
          city: db.RegExp({
            regexp: this.data.searchKeyword,
            options: 'i'
          })
        }
      ]);
    }

    // 2. 销售筛选条件
    if (this.data.selectedSalesIndex > 0) {
      const selectedSales = this.data.salesOptions[this.data.selectedSalesIndex];
      conditions.assigned_sales_id = selectedSales._openid;
    }

    // 3. 状态筛选条件
    if (this.data.selectedStatusIndex > 0) {
      const selectedStatus = this.data.statusFilterOptions[this.data.selectedStatusIndex].value;
      if (selectedStatus === 'pending') {
        conditions.status = _.in(['pending', '', null]);
      } else {
        conditions.status = selectedStatus;
      }
    }

    // 🌟 4. 终极日期筛选逻辑：精准查找这一天被跟进过，或新分配的客户
    if (this.data.selectedDate) {
      const start = new Date(this.data.selectedDate + 'T00:00:00+07:00'); // 泰国时区起点
      const end = new Date(this.data.selectedDate + 'T23:59:59+07:00');   // 泰国时区终点

      conditions = _.and([
        conditions, 
        _.or([
          // 情况A：真实的跟进时间刚好在选中日期 (首选匹配)
          { last_follow_up_time: _.gte(start).and(_.lte(end)) }, 
          
          // 情况B：严格兜底匹配！只有在“从来没有跟进过”的情况下，才允许去匹配更新/分配时间
          _.and([
            { last_follow_up_time: _.exists(false) }, // 强制要求不存在跟进记录
            { updateTime: _.gte(start).and(_.lte(end)) }
          ])
        ])
      ]);
    }

    const todayStr = this.getTodayString();

    // 5. 开始查询数据库
    db.collection('customers').where(conditions)
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        // 🌟 6. 数据处理：提取最新跟进时间并格式化
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

          // 🌟 优先读取专属跟进时间 last_follow_up_time
          const ut = item.last_follow_up_time || item.updateTime;

          if (ut) {
            const ud = new Date(ut);
            const uy = ud.getFullYear();
            const um = ('0' + (ud.getMonth() + 1)).slice(-2);
            const uday = ('0' + ud.getDate()).slice(-2);
            const uh = ('0' + ud.getHours()).slice(-2);
            const umin = ('0' + ud.getMinutes()).slice(-2);

            // 严格对齐 detail 页面的格式，只保留到分钟 (YYYY-MM-DD HH:mm)
            item.formattedUpdateTime = `${uy}-${um}-${uday} ${uh}:${umin}`;
          } else {
            // 如果从来没更新过，就显示为空
            item.formattedUpdateTime = '';
          }

          // 处理逾期标签逻辑
          let compareDate = item.next_follow_up || createDateStr;
          if (compareDate && compareDate < todayStr && !['Closed Won', 'Closed Lost', 'Invalid'].includes(item.status)) {
            item.isOverdue = true;
          } else {
            item.isOverdue = false;
          }

          return item;
        });

        // 7. 更新页面数据
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

  // 🌟 新增：日期选择事件
  onDateChange(e) {
    this.setData({
      selectedDate: e.detail.value
    }, () => {
      this.fetchData(true);
    });
  },

  // 🌟 新增：清除日期恢复全部
  clearDate() {
    this.setData({
      selectedDate: ''
    }, () => {
      this.fetchData(true);
    });
  },
})