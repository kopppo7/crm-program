Page({
  data: {
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    },
    smartText: '', // 🌟 新增：用于绑定智能解析输入框的内容
    salesList: [], 
    selectedSales: null 
  },

  onLoad() {
    this.fetchSalesList();
  },

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

    // 🌟 将输入的文本同步到 data，以便后续清空
    this.setData({ smartText: text });

    const nameMatch = text.match(/Full name:\s*(.*)/i);
    const cityMatch = text.match(/City:\s*(.*)/i);
    const phoneMatch = text.match(/Phone number:\s*(.*)/i);
    const payloadMatch = text.match(/น้ำหนักบรรทุกสูงสุดที่คุณต้องการคือเท่าไหร่\?:\s*(.*)/);
    const timelineMatch = text.match(/คุณวางแผนจะสั่งซื้ออุปกรณ์นี้เมื่อไหร่\?:\s*(.*)/);

    // 🌟 核心修改：定义一个辅助函数。如果没匹配到，或者匹配到了但内容全是空格/为空，强制返回 'none'
    const parseValue = (match) => {
      if (match && match[1] && match[1].trim() !== '') {
        return match[1].trim();
      }
      return 'none';
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
    if (!this.data.customer.name || !this.data.customer.phone) {
      return wx.showToast({ title: '姓名和电话不能为空', icon: 'none' });
    }
    if (!this.data.selectedSales) {
      return wx.showToast({ title: '请选择要分配的销售', icon: 'none' });
    }

    wx.showLoading({ title: '正在分配...' });

    wx.cloud.database().collection('customers').add({
      data: {
        ...this.data.customer,
        assigned_sales_id: this.data.selectedSales._openid, //[cite: 11]
        sales_name: this.data.selectedSales.name, //[cite: 11]
        status: 'pending', //[cite: 11]
        createTime: wx.cloud.database().serverDate() //[cite: 11]
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({ title: '分配成功', icon: 'success' });
      
      // 🌟 核心修改：成功后清空表单、销售选择以及信息粘贴区域[cite: 11]
      this.setData({
        customer: {
          name: '',
          phone: '',
          city: '',
          payload: '',
          timeline: ''
        },
        selectedSales: null,
        smartText: '' // 🌟 这里会清空 WXML 中绑定了 value="{{smartText}}" 的 textarea
      });

    }).catch(err => {
      wx.hideLoading();
      console.error('入库失败', err);
      wx.showToast({ title: '分配失败，请重试', icon: 'none' });
    });
  }
});