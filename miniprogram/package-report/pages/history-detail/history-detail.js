const db = wx.cloud.database();

Page({
  data: {
    reportId: '',
    type: 'daily',
    report: null,
    formattedText: ''
  },

  onLoad(options) {
    this.setData({
      reportId: options.id,
      type: options.type
    });
    this.fetchDetail();
  },

  async fetchDetail() {
    wx.showLoading({ title: 'กำลังโหลด...' /* 泰语：加载中 */ });
    try {
      const collectionName = this.data.type === 'daily' ? 'report_daily' : 'report_weekly';
      const res = await db.collection(collectionName).doc(this.data.reportId).get();
      let data = res.data;

      // 智能清理残余数据
      const cleanStr = (str) => {
        if (!str) return '';
        let s = str.replace(/【undefined】\s*/g, '').trim();
        return (s === '无' || s === '0') ? '' : s;
      };

      let textToShow = '';

      if (this.data.type === 'daily') {
        wx.setNavigationBarTitle({ title: 'รายละเอียดรายงาน' /* 泰语：汇报详情 */ });
        data.list_calls = cleanStr(data.list_calls);
        data.list_visit = cleanStr(data.list_visit);
        data.list_video = cleanStr(data.list_video);
        data.detail_other = cleanStr(data.detail_other);

        let index = 1;
        // 泰语：聊过2分钟以上的客户
        if (data.list_calls) { textToShow += `${index}. ลูกค้าที่คุยเกิน 2 นาที:\n${data.list_calls}\n\n`; index++; } 
        // 泰语：LineOA新增好友
        if (data.count_line > 0) { textToShow += `${index}. เพื่อนใหม่ใน Line OA: ${data.count_line} คน\n\n`; index++; } 
        // 泰语：邀约到店看车
        if (data.list_visit) { textToShow += `${index}. ลูกค้าที่เชิญมาดูรถ:\n${data.list_visit}\n\n`; index++; } 
        // 泰语：视频看车
        if (data.list_video) { textToShow += `${index}. ลูกค้าที่ดูรถผ่านวิดีโอ:\n${data.list_video}\n\n`; index++; } 
        // 泰语：其他工作
        if (data.detail_other) { textToShow += `${index}. งานอื่นๆ:\n${data.detail_other}\n\n`; index++; } 

      } else {
        wx.setNavigationBarTitle({ title: 'รายละเอียดแผนงาน' /* 泰语：计划详情 */ });
        data.plan_other = cleanStr(data.plan_other);

        let index = 1;
        // 泰语：计划通话(>2分钟)
        if (data.plan_calls > 0) { textToShow += `${index}. เป้าหมายโทรศัพท์ (>2 นาที): ${data.plan_calls} คน\n`; index++; } 
        // 泰语：计划新增Line好友
        if (data.plan_line > 0) { textToShow += `${index}. เป้าหมายเพิ่มเพื่อน Line: ${data.plan_line} คน\n`; index++; } 
        // 泰语：计划邀约到店
        if (data.plan_visit > 0) { textToShow += `${index}. เป้าหมายเชิญมาดูรถ: ${data.plan_visit} คน\n`; index++; } 
        // 泰语：计划视频看车
        if (data.plan_video > 0) { textToShow += `${index}. เป้าหมายดูรถผ่านวิดีโอ: ${data.plan_video} คน\n\n`; index++; } 
        // 泰语：其他工作
        if (data.plan_other) { textToShow += `${index}. งานอื่นๆ:\n${data.plan_other}`; index++; } 
      }

      this.setData({
        report: data,
        formattedText: textToShow.trim() || 'ไม่มีข้อมูลรายละเอียด' /* 泰语：暂无详细信息 */
      });

    } catch (err) {
      console.error('获取详情失败', err);
      wx.showToast({ title: 'โหลดไม่สำเร็จ' /* 泰语：加载失败 */, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});