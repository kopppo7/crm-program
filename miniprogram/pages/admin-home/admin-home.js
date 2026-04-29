Page({
  data: {
    // 类似于 Vue 的 data 或 React 的 state
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: ''
    }
  },

  // 监听文本框输入/粘贴，执行智能解析
  handleSmartParse(e) {
    const text = e.detail.value;
    if (!text) return;

    // 正则提取逻辑，适配你提供的中英泰混合文本
    const nameMatch = text.match(/Full name:\s*(.*)/i);
    const cityMatch = text.match(/City:\s*(.*)/i);
    const phoneMatch = text.match(/Phone number:\s*(.*)/i);
    // 泰文匹配需要精准对应你表单里的问题
    const payloadMatch = text.match(/น้ำหนักบรรทุกสูงสุดที่คุณต้องการคือเท่าไหร่\?:\s*(.*)/);
    const timelineMatch = text.match(/คุณวางแผนจะสั่งซื้ออุปกรณ์นี้เมื่อไหร่\?:\s*(.*)/);

    // 小程序更新数据必须用 this.setData，类似 React
    this.setData({
      'customer.name': nameMatch ? nameMatch[1].trim() : this.data.customer.name,
      'customer.city': cityMatch ? cityMatch[1].trim() : this.data.customer.city,
      'customer.phone': phoneMatch ? phoneMatch[1].trim() : this.data.customer.phone,
      'customer.payload': payloadMatch ? payloadMatch[1].trim() : this.data.customer.payload,
      'customer.timeline': timelineMatch ? timelineMatch[1].trim() : this.data.customer.timeline,
    });
  },

  // 允许你手动修改解析有误的字段（类似 Vue 的 v-model 拆解）
  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`customer.${field}`]: e.detail.value
    });
  },

  goToCustomerView() {
    wx.navigateTo({
      url: '/pages/customer-view/customer-view',
    })
  },
  
  goToDistribute() {
    wx.navigateTo({
      url: '/pages/distribute/distribute',
    })
  },

  // 测试提交
  submitCustomer() {
    console.log("最终准备分发的数据：", this.data.customer);
    // 这里下一步会接上云数据库的写入操作
  },

  goToMemberMgmt() {
    wx.navigateTo({ url: '/pages/member-mgmt/member-mgmt' });
  }
  
})
