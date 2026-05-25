const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();

Page({
  data: {
    currentLang: 'zh',
    weekStartDate: ''
  },

  onShow() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    this.initDefaultWeek();
  },

  // 自动计算本周一
  initDefaultWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));
    
    const y = monday.getFullYear();
    const m = ('0' + (monday.getMonth() + 1)).slice(-2);
    const d = ('0' + monday.getDate()).slice(-2);
    
    this.setData({ weekStartDate: `${y}-${m}-${d}` });
  },

  onDateChange(e) {
    this.setData({ weekStartDate: e.detail.value });
  },

  // 提交表单
  async submitForm(e) {
    // 🌟 核心修改：只提取我们要的3个核心模块数据
    const { dailyCustomerCount, weeklyDealCount, routinePlan } = e.detail.value;
    const weekStart = this.data.weekStartDate;

    if (!weekStart) {
      wx.showToast({ title: this.data.currentLang === 'zh' ? '请选择当前周' : 'โปรดเลือกสัปดาห์', icon: 'none' });
      return;
    }
    if (!dailyCustomerCount || !routinePlan.trim()) {
      wx.showToast({ title: this.data.currentLang === 'zh' ? '请将量化目标与日常计划填写完整' : 'กรุณากรอกเป้าหมายและแผนงานให้ครบถ้วน', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const myOpenId = wx.getStorageSync('myOpenId') || '';
      const userRes = await db.collection('users').where({ _openid: myOpenId }).get();
      const salesName = userRes.data.length > 0 ? userRes.data[0].name : '未知销售';

      // 🌟 写入更精简的数据库结构
      await db.collection('report_weekly').add({
        data: {
          sales_id: myOpenId,
          sales_name: salesName,
          week_start: weekStart, // 1. 当前周
          plan_daily_customers: Number(dailyCustomerCount), // 2. 每天处理客户数
          plan_weekly_deals: Number(weeklyDealCount) || 0,  // 2. 预计成单数
          routine_plan: routinePlan,                        // 3. 日常笼统计划
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: this.data.currentLang === 'zh' ? '计划提交成功！' : 'ส่งแผนงานสำเร็จแล้ว!', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('提交周计划失败:', err);
      wx.showModal({ title: '提交失败', content: '网络错误，请稍后再试', showCancel: false });
    }
  }
});