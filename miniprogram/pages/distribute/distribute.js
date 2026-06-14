const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    customer: {
      name: '',
      phone: '',
      city: '',
      payload: '',
      timeline: '',
      remark: '' 
    },
    smartText: '', 
    salesList: [],
    selectedSales: null
  },

  onLoad() {
    this.fetchSalesList();
  },
  
  fetchSalesList() {
    db.collection('users')
      .where({
        role: _.in(['sales', 'manager']), 
        status: 'active',
        name: _.nin(['kristin', 'chey'])  
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
  
  // 🌟 终极防报错版 AI 解析：完美兼容 Tab/换行/多空格，纯 ES5 护航
  handleSmartParse(e) {
    var text = e.detail.value;
    if (!text) return;

    this.setData({ smartText: text });

    var parsedName = '';
    var parsedPhone = '';
    var parsedCity = '';
    var parsedPayload = '';
    var parsedTimeline = '';

    // 【第一段】尝试 JSON 标准格式解析
    try {
      var jsonObj = JSON.parse(text);
      if (jsonObj && typeof jsonObj === 'object') {
        this.setData({
          'customer.name': jsonObj.name || '',
          'customer.phone': jsonObj.phone || '',
          'customer.city': jsonObj.city || '',
          'customer.payload': jsonObj.payload || '',
          'customer.timeline': jsonObj.timeline || ''
        });
        return; // 解析成功直接结束
      }
    } catch (err) {
      // 非 JSON 格式，进入下一步
    }

    // 【第二段】单行紧凑型解析
    // 🌟 核心修复：使用 \s+ 按照任意空白字符（空格、Tab、换行）进行强力切分
    var parts = text.trim().split(/\s+/);
    var phoneIndex = -1;

    // 寻找包含 p: 或者纯数字的片段（使用最原始的 for 循环防报错）
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.toLowerCase().indexOf('p:') === 0 || /\d{8,}/.test(p)) {
        phoneIndex = i;
        break;
      }
    }
    
    if (phoneIndex !== -1) {
      var phoneStr = parts[phoneIndex];
      // 提取电话号码
      parsedPhone = phoneStr.toLowerCase().indexOf('p:') === 0 ? phoneStr.substring(2) : phoneStr;
      
      // 电话后面的所有内容拼接为城市
      parsedCity = parts.slice(phoneIndex + 1).join(' ');
      
      // 电话前面的内容
      var befores = parts.slice(0, phoneIndex);
      if (befores.length > 0) {
        parsedPayload = befores[0]; // 第一个词识别为需求
        parsedName = befores.slice(1).join(' '); // 剩下的识别为姓名
      }
    }

    // 统一将解析结果写入表单
    this.setData({
      'customer.name': parsedName,
      'customer.phone': parsedPhone,
      'customer.city': parsedCity,
      'customer.payload': parsedPayload,
      'customer.timeline': parsedTimeline
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

    let finalCustomerData = {};
    for (let key in this.data.customer) {
      let val = this.data.customer[key];
      finalCustomerData[key] = (val && val.trim() !== '') ? val.trim() : 'none';
    }

    db.collection('customers').add({
      data: {
        ...finalCustomerData, 
        assigned_sales_id: this.data.selectedSales._openid,
        sales_name: this.data.selectedSales.name,
        status: 'pending',
        createTime: db.serverDate()
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({
        title: '分配成功',
        icon: 'success'
      });

      this.setData({
        customer: {
          name: '',
          phone: '',
          city: '',
          payload: '',
          timeline: '',
          remark: '' 
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