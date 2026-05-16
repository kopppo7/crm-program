Page({
  data: {
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    },
    smartText: '', // 🌟 用于绑定智能解析输入框的内容
    salesList: [],
    selectedSales: null
  },

  onLoad() {
    this.fetchSalesList();
  },
  fetchSalesList() {
    wx.cloud.database().collection('users')
      .where({
        role: 'sales',
        status: 'active' // 🌟 核心修改：只查询状态为“正常(active)”的销售
      })
      .get()
      .then(res => {
        this.setData({
          salesList: res.data
        });
      })
      .catch(err => {
        console.error('获取销售列表失败', err);
      });
  },
  // 监听智能解析粘贴
  handleSmartParse(e) {
    const text = e.detail.value;
    if (!text) return;

    // 将输入的文本同步到 data，以便后续清空
    this.setData({
      smartText: text
    });

    const nameMatch = text.match(/Full name:\s*(.*)/i);
    const cityMatch = text.match(/City:\s*(.*)/i);
    const phoneMatch = text.match(/Phone number:\s*(.*)/i);
    const payloadMatch = text.match(/น้ำหนักบรรทุกสูงสุดที่คุณต้องการคือเท่าไหร่\?:\s*(.*)/);
    const timelineMatch = text.match(/คุณวางแผนจะสั่งซื้ออุปกรณ์นี้เมื่อไหร่\?:\s*(.*)/);

    // 🌟 修改1：解析时如果不匹配或为空，直接返回空字符串 ''，不再返回 'none'
    const parseValue = (match) => {
      if (match && match[1] && match[1].trim() !== '') {
        return match[1].trim();
      }
      return '';
    };

    this.setData({
      'customer.name': parseValue(nameMatch),
      'customer.city': parseValue(cityMatch),
      'customer.phone': parseValue(phoneMatch),
      'customer.payload': parseValue(payloadMatch),
      'customer.timeline': parseValue(timelineMatch),
    });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`customer.${field}`]: e.detail.value
    });
  },

  onSalesChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedSales: this.data.salesList[index]
    });
  },

  submitCustomer() {
    // 🌟 修改2：除了手机号，其他都可以为空。只拦截没有手机号的情况
    if (!this.data.customer.phone || this.data.customer.phone.trim() === '') {
      return wx.showToast({
        title: '手机号不能为空',
        icon: 'none'
      });
    }
    if (!this.data.selectedSales) {
      return wx.showToast({
        title: '请选择要分配的销售',
        icon: 'none'
      });
    }

    wx.showLoading({
      title: '正在分配...'
    });

    // 🌟 修改3：在提交入库前，遍历表单，把所有没填的空项变成 'none'
    let finalCustomerData = {};
    for (let key in this.data.customer) {
      let val = this.data.customer[key];
      // 如果没有值或者全是空格，则赋值为 'none'，否则保留原本填入的值
      finalCustomerData[key] = (val && val.trim() !== '') ? val.trim() : 'none';
    }

    wx.cloud.database().collection('customers').add({
      data: {
        ...finalCustomerData, // 传入清洗后的数据
        assigned_sales_id: this.data.selectedSales._openid,
        sales_name: this.data.selectedSales.name,
        status: 'pending',
        createTime: wx.cloud.database().serverDate()
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({
        title: '分配成功',
        icon: 'success'
      });

      // 成功后清空表单、销售选择以及信息粘贴区域
      this.setData({
        customer: {
          name: '',
          phone: '',
          city: '',
          payload: '',
          timeline: ''
        },
        selectedSales: null,
        smartText: ''
      });

    }).catch(err => {
      wx.hideLoading();
      console.error('入库失败', err);
      wx.showToast({
        title: '分配失败，请重试',
        icon: 'none'
      });
    });
  }
});