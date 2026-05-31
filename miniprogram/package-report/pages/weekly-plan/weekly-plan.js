const i18n = require('../../../utils/i18n.js');
const db = wx.cloud.database();

Page({
  data: {
    currentLang: 'zh',
    weekRange: '', // 显示用的时间段，如 2026-06-01 至 2026-06-07
    weekStart: ''  // 入库用的周一日期
  },

  onShow() {
    const lang = i18n.getLang();
    this.setData({ currentLang: lang });
    this.initCurrentWeek();
  },

  // 🌟 核心逻辑：自动计算出当前的周一到周日
  initCurrentWeek() {
    const today = new Date();
    const day = today.getDay();
    // 计算本周一
    const diffMonday = today.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diffMonday));
    // 计算本周日
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = ('0' + (d.getMonth() + 1)).slice(-2);
      const date = ('0' + d.getDate()).slice(-2);
      return `${y}-${m}-${date}`;
    };

    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);

    this.setData({ 
      weekStart: startStr,
      weekRange: `${startStr} 至 ${endStr}`
    });
  },

  // 提交表单
  async submitForm(e) {
    const { planCalls, planLine, planVisit, planVideo, planOther } = e.detail.value;

    // 必填项校验
    if (!planCalls || !planLine || !planVisit || !planVideo) {
      wx.showToast({ 
        title: this.data.currentLang === 'zh' ? '请将4个量化目标填写完整' : 'กรุณากรอกเป้าหมายเชิงปริมาณทั้ง 4 ข้อให้ครบถ้วน', 
        icon: 'none' 
      });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const myOpenId = wx.getStorageSync('myOpenId') || '';
      const userRes = await db.collection('users').where({ _openid: myOpenId }).get();
      const salesName = userRes.data.length > 0 ? userRes.data[0].name : '未知销售';

      // 写入最新的 5 项指标数据结构
      await db.collection('report_weekly').add({
        data: {
          sales_id: myOpenId,
          sales_name: salesName,
          week_start: this.data.weekStart, // 周一日期，方便排序
          week_range: this.data.weekRange, // 直观展示的日期范围
          plan_calls: Number(planCalls) || 0,
          plan_line: Number(planLine) || 0,
          plan_visit: Number(planVisit) || 0,
          plan_video: Number(planVideo) || 0,
          plan_other: planOther || '',
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