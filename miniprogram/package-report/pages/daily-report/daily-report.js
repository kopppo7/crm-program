const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command; 

Page({
  data: {
    currentLang: 'zh',
    reportDate: '',
    editId: '', 
    
    // 数据回填用
    detailOther: '', // 🌟 已删除 countLine 字段

    listCallsArr: [],
    listVisitArr: [],
    listVideoArr: [],

    activeModal: '', 
    editIndex: -1,   
    tempPhone: '',
    tempIntent: '',
    tempDate: '',
    tempNote: ''
  },

  onLoad(options) {
    if (options.editId) {
      this.setData({ editId: options.editId });
      this.loadEditData(options.editId);
    }
  },

  onShow() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    if (!this.data.editId) {
      this.initTodayDate();
    }
  },

  initTodayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    this.setData({ reportDate: `${y}-${m}-${day}` });
  },

  async loadEditData(id) {
    wx.showLoading({ title: 'กำลังโหลดข้อมูล...' }); 
    try {
      const res = await db.collection('report_daily').doc(id).get();
      const data = res.data;

      const parseStringToArray = (str, type) => {
        if (!str || str === '无' || str.trim() === '') return [];
        return str.split('\n').map(line => {
          let phone = (line.match(/电话:([^\s]+)/) || [])[1] || '';
          if (type === 'call') return { phone, intent: (line.match(/说明:(.+)/) || [])[1] || '' };
          if (type === 'visit') return { phone, date: (line.match(/日期:([^\s]+)/) || [])[1] || '' };
          if (type === 'video') return { phone, note: (line.match(/情况:(.+)/) || [])[1] || '' };
          return null;
        }).filter(item => item && item.phone); 
      };

      this.setData({
        reportDate: data.report_date,
        detailOther: data.detail_other || '', // 🌟 已删除 count_line 的回填
        listCallsArr: parseStringToArray(data.list_calls, 'call'),
        listVisitArr: parseStringToArray(data.list_visit, 'visit'),
        listVideoArr: parseStringToArray(data.list_video, 'video')
      });
    } catch (err) {
      console.error('加载重填数据失败', err);
    }
    wx.hideLoading();
  },

  // ================= 弹窗交互逻辑 =================
  preventClose() {
    return;
  },

  openModal(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      activeModal: type,
      editIndex: -1, tempPhone: '', tempIntent: '', tempDate: '', tempNote: ''
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
      if (!tempIntent.trim()) return wx.showToast({ title: currentLang === 'zh' ? '请填写说明' : 'กรุณากรอกคำอธิบาย', icon: 'none' });
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
      targetArr[editIndex] = newItem; 
    } else {
      targetArr.push(newItem); 
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

  // ================= 提交入库与拦截逻辑 =================
  async submitForm(e) {
    const formData = e.detail.value;
    const lang = this.data.currentLang;
    const dateStr = this.data.reportDate;

    if (!this.data.editId) {
      wx.showLoading({ title: '正在校验...', mask: true });
      try {
        const myOpenId = wx.getStorageSync('myOpenId') || '';
        const checkRes = await db.collection('report_daily').where({
          sales_id: myOpenId,
          report_date: dateStr 
        }).get();
        
        wx.hideLoading();

        if (checkRes.data.length > 0) {
          const existingRecord = checkRes.data[0];
          if (existingRecord.approval_status === 'rejected') {
            return wx.showModal({
              title: lang === 'zh' ? '拦截提示' : 'ไม่สามารถส่งได้',
              content: lang === 'zh' ? '您今日的汇报已被驳回，请前往历史记录中修改重交。' : 'รายงานของวันนี้ถูกปฏิเสธ โปรดไปที่ประวัติเพื่อแก้ไขและส่งใหม่',
              showCancel: false
            });
          } else {
            return wx.showModal({
              title: lang === 'zh' ? '请勿重复提交' : 'ไม่สามารถส่งได้',
              content: lang === 'zh' ? '您今日已提交过汇报，请勿重复提交。' : 'คุณส่งรายงานของวันนี้แล้ว โปรดอย่าส่งซ้ำ',
              showCancel: false
            });
          }
        }
      } catch (err) {
        wx.hideLoading();
        console.error('查重失败:', err);
        return wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    }

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
    // 🌟 已删除 formData 中的 countLine 解构
    const { detailOther } = formData;
    const dateStr = this.data.reportDate;

    const formattedCalls = this.data.listCallsArr.map(i => `电话:${i.phone} 说明:${i.intent}`).join('\n');
    const formattedVisit = this.data.listVisitArr.map(i => `电话:${i.phone} 日期:${i.date}`).join('\n');
    const formattedVideo = this.data.listVideoArr.map(i => `电话:${i.phone} 情况:${i.note}`).join('\n');

    wx.showLoading({ title: 'กำลังบันทึก...', mask: true }); 

    try {
      const myOpenId = wx.getStorageSync('myOpenId') || '';
      const userRes = await db.collection('users').where({ _openid: myOpenId }).get();
      const salesName = userRes.data.length > 0 ? userRes.data[0].name : '未知销售';

      let pendingTodosText = '';
      try {
        const todoRes = await db.collection('customers').where({
          assigned_sales_id: myOpenId,
          next_follow_up: _.neq('').and(_.lte(dateStr)),
          status: _.nin(['Closed Won', 'Closed Lost', 'Invalid'])
        }).get();

        if (todoRes.data.length > 0) {
          pendingTodosText = todoRes.data.map(c => `【${c.name || '未命名'}】电话:${c.phone} (应跟进:${c.next_follow_up})`).join('\n');
        } else {
          pendingTodosText = '已清空';
        }
      } catch (e) {
        console.error('抓取今日未处理代办失败', e);
        pendingTodosText = '抓取未处理代办失败';
      }

      const submitData = {
        sales_id: myOpenId,
        sales_name: salesName,
        report_date: dateStr,            
        list_calls: formattedCalls,       
        // 🌟 已删除入库的 count_line 属性
        list_visit: formattedVisit,     
        list_video: formattedVideo,                  
        detail_other: detailOther || '',  
        pending_todos: pendingTodosText,
        approval_status: 'pending' 
      };

      if (this.data.editId) {
        await db.collection('report_daily').doc(this.data.editId).update({
          data: submitData
        });
      } else {
        submitData.createTime = db.serverDate();
        await db.collection('report_daily').add({
          data: submitData
        });
      }

      wx.hideLoading();
      wx.showToast({ title: this.data.currentLang === 'zh' ? '日报提交成功！' : 'ส่งรายงานสำเร็จแล้ว!', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('提交失败:', err);
      wx.showModal({ title: '提交失败', content: '网络错误，请稍后再试', showCancel: false });
    }
  }
});