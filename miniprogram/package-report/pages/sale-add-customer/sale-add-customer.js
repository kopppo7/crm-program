const db = wx.cloud.database();
const i18n = require('../../../utils/i18n.js'); // 确保这里的层级正确

Page({
  data: {
    currentLang: 'zh',
    sourceOptions: [],
    
    // 🌟 新增：产品品类字典与选中状态
    productCategoryOptions: [],
    selectedProductIndex: -1,

    form: {
      source: 'customer_call', // 🌟 默认选中客户致电 (升级为底层英文 Key)
      name: '',
      phone: '',
      product_category: '',    // 🌟 新增：产品品类字段
      payload: '',             // 需求机型 (细分型号)
      remark: ''
    },
    myOpenId: '',
    myName: ''
  },

  onLoad() {
    this.initLanguage();
    this.fetchCurrentUser();
  },

  initLanguage() {
    const lang = i18n.getLang();
    
    // 🌟 动态生成产品品类字典 (双语)
    const pDict = [
      { value: 'excavator', label: lang === 'zh' ? '挖掘机' : 'รถขุด' },
      { value: 'dumper', label: lang === 'zh' ? '履带运输车' : 'รถตีนตะขาบขนส่ง' },
      { value: 'lawn_mower', label: lang === 'zh' ? '割草机' : 'เครื่องตัดหญ้า' },
      { value: 'harvester', label: lang === 'zh' ? '收割机' : 'รถเกี่ยวข้าว' },
      { value: 'mini_tiller', label: lang === 'zh' ? '微耕机' : 'เครื่องไถนาขนาดเล็ก' },
      { value: 'wood_chipper', label: lang === 'zh' ? '碎枝机' : 'เครื่องบดกิ่งไม้' }
    ];

    this.setData({
      currentLang: lang,
      // 🌟 来源选项也同步为底层 Key
      sourceOptions: [
        { value: 'customer_call', label: lang === 'zh' ? '客户致电' : 'การโทรจากลูกค้า' },
        { value: 'independent_develop', label: lang === 'zh' ? '自主开发' : 'พัฒนาขึ้นเอง' }
      ],
      productCategoryOptions: pDict
    });

    wx.setNavigationBarTitle({
      title: lang === 'zh' ? '添加新客户' : 'เพิ่มลูกค้าใหม่'
    });
  },

  async fetchCurrentUser() {
    const openid = wx.getStorageSync('myOpenId');
    if (!openid) return wx.showToast({ title: '身份丢失，请重新进入', icon: 'none' });
    this.setData({ myOpenId: openid });

    try {
      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data && res.data.length > 0) {
        this.setData({ myName: res.data[0].name });
      }
    } catch (err) {
      console.error('获取当前用户信息失败', err);
    }
  },

  onSourceChange(e) {
    this.setData({ 'form.source': e.detail.value });
  },

  // 🌟 新增：绑定产品品类的下拉选择
  onProductCategoryChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedProductIndex: index,
      'form.product_category': this.data.productCategoryOptions[index].value
    });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async submitCustomer() {
    const { source, name, phone, product_category, payload, remark } = this.data.form;

    // 🌟 拦截判断加入“产品品类”
    if (!phone || phone.trim() === '') {
      return wx.showToast({ title: this.data.currentLang === 'zh' ? '请输入手机号' : 'กรุณากรอกเบอร์โทร', icon: 'none' });
    }
    if (!product_category) {
      return wx.showToast({ title: this.data.currentLang === 'zh' ? '请选择产品品类' : 'กรุณาเลือกหมวดหมู่สินค้า', icon: 'none' });
    }
    if (!payload || payload.trim() === '') {
      return wx.showToast({ title: this.data.currentLang === 'zh' ? '请输入需求机型' : 'กรุณากรอกรุ่นที่ต้องการ', icon: 'none' });
    }

    wx.showLoading({ title: this.data.currentLang === 'zh' ? '正在建档...' : 'กำลังสร้างแฟ้ม...' });

    try {
      const res = await db.collection('customers').add({
        data: {
          customer_source: source,
          name: name.trim() || '未命名', 
          phone: phone.trim(),
          product_category: product_category, // 🌟 存入大分类字典值 (Value Key)
          payload: payload.trim(),            // 存入手动输入的细分型号
          remark: remark.trim(),
          status: 'pending', 
          assigned_sales_id: this.data.myOpenId, 
          sales_name: this.data.myName || '未知',
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '建档成功', icon: 'success' });

      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/follow-up/follow-up?id=${res._id}`
        });
      }, 1000);

    } catch (err) {
      wx.hideLoading();
      console.error('添加客户失败', err);
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
    }
  }
});