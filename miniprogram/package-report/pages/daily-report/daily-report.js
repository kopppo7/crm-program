const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();

Page({
  data: {
    currentLang: 'zh',
    reportDate: '',
    
    // 🌟 新增：结构化列表数据
    listCallsArr: [],
    listVisitArr: [],
    listVideoArr: [],

    // 🌟 新增：弹窗控制数据
    activeModal: '', // 当前打开的弹窗类型: 'call', 'visit', 'video'
    editIndex: -1,   // -1表示新增，>=0表示修改
    tempPhone: '',
    tempIntent: '',
    tempDate: '',
    tempNote: ''
  },

  onShow() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    this.initTodayDate();
  },

  initTodayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    this.setData({ reportDate: `${y}-${m}-${day}` });
  },

  // ================= 弹窗交互逻辑 =================
  openModal(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      activeModal: type,
      editIndex: -1,tempPhone: '', tempIntent: '', tempDate: '', tempNote: ''
    });
  },

  closeModal() {
    this.setData({ activeModal: '' });
  },

  onModalInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onTempDateChange(e) {
    this.setData({ tempDate: e.detail.value });
  },

  saveModal() {
    const { activeModal, editIndex, tempPhone, tempIntent, tempDate, tempNote, currentLang } = this.data;
    
    if (!tempPhone.trim()) {
      return wx.showToast({ title: currentLang === 'zh' ? '请填写电话' : 'กรุณากรอกหมายเลขโทรศัพท์', icon: 'none' });
    }

    let newItem = { phone: tempPhone.trim() };
    let targetArr = [];
    let key = '';

    if (activeModal === 'call') {
      if (!tempIntent.trim()) return wx.showToast({ title: currentLang === 'zh' ? '请填写意向' : 'กรุณากรอกข้อมูล', icon: 'none' });
      newItem.intent = tempIntent.trim();
      targetArr = this.data.listCallsArr;
      key = 'listCallsArr';
    } else if (activeModal === 'visit') {
      if (!tempDate) return wx.showToast({ title: currentLang === 'zh' ? '请选择日期' : 'กรุณาเลือกวันที่', icon: 'none' });
      newItem.date = tempDate;
      targetArr = this.data.listVisitArr;
      key = 'listVisitArr';
    } else if (activeModal === 'video') {
      if (!tempNote.trim()) return wx.showToast({ title: currentLang === 'zh' ? '请填写说明' : 'กรุณากรอกคำอธิบาย', icon: 'none' });
      newItem.note = tempNote.trim();
      targetArr = this.data.listVideoArr;
      key = 'listVideoArr';
    }

    if (editIndex > -1) {
      targetArr[editIndex] = newItem; // 修改
    } else {
      targetArr.push(newItem); // 新增
    }

    this.setData({ [key]: targetArr, activeModal: '' });
  },

  editItem(e) {
    const type = e.currentTarget.dataset.type;
    const index = e.currentTarget.dataset.index;
    let item = {};
    if (type === 'call') item = this.data.listCallsArr[index];
    if (type === 'visit') item = this.data.listVisitArr[index];
    if (type === 'video') item = this.data.listVideoArr[index];

    this.setData({
      activeModal: type,
      editIndex: index,
      tempPhone: item.phone || '',
      tempIntent: item.intent || '',
      tempDate: item.date || '',
      tempNote: item.note || ''
    });
  },

  deleteItem(e) {
    const type = e.currentTarget.dataset.type;
    const index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: this.data.currentLang === 'zh' ? '删除确认' : 'ยืนยันการลบ',
      content: this.data.currentLang === 'zh' ? '确定要删除这条记录吗？' : 'แน่ใจหรือว่าต้องการลบ?',
      success: (res) => {
        if (res.confirm) {
          let targetArr = [];
          let key = '';
          if (type === 'call') { targetArr = this.data.listCallsArr; key = 'listCallsArr'; }
          if (type === 'visit') { targetArr = this.data.listVisitArr; key = 'listVisitArr'; }
          if (type === 'video') { targetArr = this.data.listVideoArr; key = 'listVideoArr'; }

          targetArr.splice(index, 1);
          this.setData({ [key]: targetArr });
        }
      }
    });
  },

  // ================= 提交入库逻辑 =================
  submitForm(e) {
    const formData = e.detail.value;
    const lang = this.data.currentLang;
    
    wx.showModal({
      title: lang === 'zh' ? '提交确认' : 'ยืนยันการส่ง',
      content: lang === 'zh' ? `确认提交 ${this.data.reportDate} 的工作日报吗？` : `ยืนยันการส่งรายงานหรือไม่?`,
      confirmColor: '#10b981', 
      success: (res) => {
        if (res.confirm) {
          this.executeSubmit(formData);
        }
      }
    });
  },

  

  async executeSubmit(formData) {
    const { countLine, detailOther } = formData;
    const dateStr = this.data.reportDate;

    // 🌟 核心：将数组转化为规整的文本，让云数据库和 Vue 后台原样接收，不用改表结构！
    const formattedCalls = this.data.listCallsArr.map(i => `电话:${i.phone} 意向:${i.intent}`).join('\n');
    const formattedVisit = this.data.listVisitArr.map(i => `电话:${i.phone} 日期:${i.date}`).join('\n');
    const formattedVideo = this.data.listVideoArr.map(i => `电话:${i.phone} 情况:${i.note}`).join('\n');

    wx.showLoading({ title: '数据保存中...', mask: true });

    try {
      const myOpenId = wx.getStorageSync('myOpenId') || '';
      const userRes = await db.collection('users').where({ _openid: myOpenId }).get();
      const salesName = userRes.data.length > 0 ? userRes.data[0].name : '未知销售';

      await db.collection('report_daily').add({
        data: {
          sales_id: myOpenId,
          sales_name: salesName,
          report_date: dateStr,            
          list_calls: formattedCalls,       
          count_line: Number(countLine) || 0, 
          list_visit: formattedVisit,     
          list_video: formattedVideo,                  
          detail_other: detailOther || '',              
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: this.data.currentLang === 'zh' ? '日报提交成功！' : 'ส่งรายงานสำเร็จแล้ว!', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('提交日报失败:', err);
      wx.showModal({ title: '提交失败', content: '网络错误，请稍后再试', showCancel: false });
    }
  }
});