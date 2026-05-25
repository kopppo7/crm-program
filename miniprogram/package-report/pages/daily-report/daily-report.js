const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();

Page({
  data: {
    currentLang: 'zh',
    reportDate: '',
    
    // 用于动态控制详情框是否显示的变量
    countNew: 0,
    countFollow: 0,
    countSelf: 0
  },

  onShow() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    this.initTodayDate();
  },

  // 自动获取今天日期并设为默认值
  initTodayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    this.setData({ reportDate: `${y}-${m}-${day}` });
  },

  // 🌟 核心逻辑：动态监听数字框输入，以便控制详情框的展示
  onCountInput(e) {
    const type = e.currentTarget.dataset.type; // 获取是哪个输入框
    const value = parseInt(e.detail.value) || 0; // 转为数字，空则为 0
    this.setData({
      [type]: value
    });
  },

  // 拦截提交并弹出确认框
  submitForm(e) {
    const formData = e.detail.value;
    const cNew = parseInt(formData.countNew) || 0;
    const cFollow = parseInt(formData.countFollow) || 0;
    const cSelf = parseInt(formData.countSelf) || 0;

    const lang = this.data.currentLang;
    
    // 组装双语确认文案
    const title = lang === 'zh' ? '提交确认' : 'ยืนยันการส่ง';
    const content = lang === 'zh' 
      ? `您今天处理了 ${cNew} 个新客户，${cFollow} 个跟进客户，${cSelf} 个扩展客户，确认提交吗？`
      : `คุณจัดการลูกค้าใหม่ ${cNew} คน, ลูกค้าที่ติดตาม ${cFollow} คน, ลูกค้าที่หาเพิ่ม ${cSelf} คน ยืนยันการส่งหรือไม่?`;

    // 弹出确认弹窗
    wx.showModal({
      title: title,
      content: content,
      confirmColor: '#10b981', // 绿色确认按钮
      success: (res) => {
        if (res.confirm) {
          // 点击确定后，真正执行入库操作
          this.executeSubmit(formData);
        }
      }
    });
  },

  // 真正的写数据库逻辑
  async executeSubmit(formData) {
    const { countNew, countFollow, countSelf, detailNew, detailFollow, detailSelf, detailOther } = formData;
    const dateStr = this.data.reportDate;

    wx.showLoading({ title: '数据保存中...', mask: true });

    try {
      const myOpenId = wx.getStorageSync('myOpenId') || '';
      
      const userRes = await db.collection('users').where({ _openid: myOpenId }).get();
      const salesName = userRes.data.length > 0 ? userRes.data[0].name : '未知销售';

      // 强力写入云数据库
      await db.collection('report_daily').add({
        data: {
          sales_id: myOpenId,
          sales_name: salesName,
          report_date: dateStr,            
          count_new: Number(countNew) || 0,       
          count_follow: Number(countFollow) || 0, 
          count_self: Number(countSelf) || 0,     
          // 如果数字是 0，因为详情框被隐藏了，formData里可能取不到值，这里做个默认空字符串兜底
          detail_new: detailNew || '',                  
          detail_follow: detailFollow || '',            
          detail_self: detailSelf || '',
          detail_other: detailOther || '', // 其他日常工作                 
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ 
        title: this.data.currentLang === 'zh' ? '日报提交成功！' : 'ส่งรายงานสำเร็จแล้ว!', 
        icon: 'success',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('提交日报失败:', err);
      wx.showModal({ title: '提交失败', content: '网络错误，请稍后再试', showCancel: false });
    }
  }
});