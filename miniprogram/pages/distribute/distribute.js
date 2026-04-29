Page({
  data: {
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    },
    salesList: [], // 存储从数据库拉取的销售列表
    selectedSales: null // 当前选中的销售对象
  },

  onLoad() {
    // 页面加载时自动获取销售列表
    this.fetchSalesList();
  },

  // 连接云数据库，拉取销售人员
  fetchSalesList() {
    wx.cloud.database().collection('users')
      .where({
        role: 'sales'
      })
      .get()
      .then(res => {
        this.setData({
          salesList: res.data
        });
      })
      .catch(err => {
        console.error('获取销售列表失败', err);
        wx.showToast({ title: '网络异常', icon: 'none' });
      });
  },

  // 监听智能解析粘贴
  handleSmartParse(e) {
    const text = e.detail.value;
    if (!text) return;

    const nameMatch = text.match(/Full name:\s*(.*)/i);
    const cityMatch = text.match(/City:\s*(.*)/i);
    const phoneMatch = text.match(/Phone number:\s*(.*)/i);
    const payloadMatch = text.match(/น้ำหนักบรรทุกสูงสุดที่คุณต้องการคือเท่าไหร่\?:\s*(.*)/);
    const timelineMatch = text.match(/คุณวางแผนจะสั่งซื้ออุปกรณ์นี้เมื่อไหร่\?:\s*(.*)/);

    this.setData({
      'customer.name': nameMatch ? nameMatch[1].trim() : this.data.customer.name,
      'customer.city': cityMatch ? cityMatch[1].trim() : this.data.customer.city,
      'customer.phone': phoneMatch ? phoneMatch[1].trim() : this.data.customer.phone,
      'customer.payload': payloadMatch ? payloadMatch[1].trim() : this.data.customer.payload,
      'customer.timeline': timelineMatch ? timelineMatch[1].trim() : this.data.customer.timeline,
    });
  },

  // 监听手动修改输入框
  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`customer.${field}`]: e.detail.value
    });
  },

  // 监听下拉框选择销售
  onSalesChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedSales: this.data.salesList[index]
    });
  },

  // 提交并存入数据库
  submitCustomer() {
    // 基础校验
    if (!this.data.customer.name || !this.data.customer.phone) {
      return wx.showToast({ title: '姓名和电话不能为空', icon: 'none' });
    }
    if (!this.data.selectedSales) {
      return wx.showToast({ title: '请选择要分配的销售', icon: 'none' });
    }

    wx.showLoading({ title: '正在分配...' });

    // 写入 customers 集合
    wx.cloud.database().collection('customers').add({
      data: {
        ...this.data.customer,
        assigned_sales_id: this.data.selectedSales.openid, // 绑定销售的唯一ID
        sales_name: this.data.selectedSales.name, // 冗余存一下名字方便后续展示
        status: 'pending', // 初始状态为待跟进
        createTime: wx.cloud.database().serverDate() // 记录录入时间
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({ title: '分配成功', icon: 'success' });
      
      // 延迟 1.5 秒后返回主页工作台
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      wx.hideLoading();
      console.error('入库失败', err);
      wx.showToast({ title: '分配失败，请重试', icon: 'none' });
    });
  }
})
