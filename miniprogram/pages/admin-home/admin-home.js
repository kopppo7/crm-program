Page({
  data: {
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    }
  },

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

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`customer.${field}`]: e.detail.value
    });
  },

  goToCustomerView() {
    wx.navigateTo({ url: '/pages/customer-view/customer-view' })
  },
  
  goToDistribute() {
    wx.navigateTo({ url: '/pages/distribute/distribute' })
  },

  goToMemberMgmt() {
    wx.navigateTo({ url: '/pages/member-mgmt/member-mgmt' });
  },

  // 🌟 新增的跳转方法
  goToAdminLogs() {
    wx.navigateTo({ url: '/pages/admin-logs/admin-logs' });
  },

  submitCustomer() {
    console.log("最终准备分发的数据：", this.data.customer);
  }
})