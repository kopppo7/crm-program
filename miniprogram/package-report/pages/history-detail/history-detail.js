const db = wx.cloud.database();

Page({
  data: {
    reportId: '',
    type: 'daily',
    report: null,
    formattedText: '',
    isTodosCleared: false // 🌟 用于控制待办字体的颜色
  },

  onLoad(options) {
    this.setData({
      reportId: options.id,
      type: options.type
    });
    this.fetchDetail();
  },

  // 🌟 跳转到修改页，并带上当前报告的 ID
  goToEdit() {
    wx.navigateTo({
      url: `/package-report/pages/daily-report/daily-report?editId=${this.data.reportId}`
    });
  },

  async fetchDetail() {
    wx.showLoading({ title: 'กำลังโหลด...' /* 泰语：加载中 */ });
    try {
      const collectionName = this.data.type === 'daily' ? 'report_daily' : 'report_weekly';
      const res = await db.collection(collectionName).doc(this.data.reportId).get();
      let data = res.data;

      // 🌟 1. 遗留待办智能变色：判断是否包含“已清空”
      let isTodosCleared = false;
      if (data.pending_todos && data.pending_todos.includes('已清空')) {
        isTodosCleared = true;
      }

      // 🌟 2. 格式化审批历史的时间戳 (倒序，最新的在上面)
      if (data.approval_history && data.approval_history.length > 0) {
        data.approval_history = data.approval_history.map(item => {
          let d = new Date(item.time);
          item.formattedTime = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          return item;
        });
        data.approval_history.reverse(); 
      }

      // 智能清理残余数据
      const cleanStr = (str) => {
        if (!str) return '';
        let s = str.replace(/【undefined】\s*/g, '').trim();
        return (s === '无' || s === '0') ? '' : s;
      };

      let textToShow = '';

      if (this.data.type === 'daily') {
        wx.setNavigationBarTitle({ title: 'รายละเอียดรายงาน' });
        data.list_calls = cleanStr(data.list_calls);
        data.list_visit = cleanStr(data.list_visit);
        data.list_video = cleanStr(data.list_video);
        data.detail_other = cleanStr(data.detail_other);

        let index = 1;
        if (data.list_calls) { textToShow += `${index}. ลูกค้าที่คุยเกิน 2 นาที:\n${data.list_calls}\n\n`; index++; } 
        if (data.count_line > 0) { textToShow += `${index}. เพื่อนใหม่ใน Line OA: ${data.count_line} คน\n\n`; index++; } 
        if (data.list_visit) { textToShow += `${index}. ลูกค้าที่เชิญมาดูรถ:\n${data.list_visit}\n\n`; index++; } 
        if (data.list_video) { textToShow += `${index}. ลูกค้าที่ดูรถผ่านวิดีโอ:\n${data.list_video}\n\n`; index++; } 
        if (data.detail_other) { textToShow += `${index}. งานอื่นๆ:\n${data.detail_other}\n\n`; index++; } 

      } else {
        wx.setNavigationBarTitle({ title: 'รายละเอียดแผนงาน' });
        data.plan_other = cleanStr(data.plan_other);

        let index = 1;
        if (data.plan_calls > 0) { textToShow += `${index}. เป้าหมายโทรศัพท์ (>2 นาที): ${data.plan_calls} คน\n`; index++; } 
        if (data.plan_line > 0) { textToShow += `${index}. เป้าหมายเพิ่มเพื่อน Line: ${data.plan_line} คน\n`; index++; } 
        if (data.plan_visit > 0) { textToShow += `${index}. เป้าหมายเชิญมาดูรถ: ${data.plan_visit} คน\n`; index++; } 
        if (data.plan_video > 0) { textToShow += `${index}. เป้าหมายดูรถผ่านวิดีโอ: ${data.plan_video} คน\n\n`; index++; } 
        if (data.plan_other) { textToShow += `${index}. งานอื่นๆ:\n${data.plan_other}`; index++; } 
      }

      this.setData({
        report: data,
        formattedText: textToShow.trim() || 'ไม่มีข้อมูลรายละเอียด',
        isTodosCleared: isTodosCleared // 🌟 绑定到视图供颜色控制使用
      });

    } catch (err) {
      console.error('获取详情失败', err);
      wx.showToast({ title: 'โหลดไม่สำเร็จ', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});