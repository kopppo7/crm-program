const db = wx.cloud.database();

Page({
  data: {
    reportId: '',
    type: 'daily', // daily 或 weekly
    report: null,
    combinedText: '', // 拼接好的排版原文，方便一键复制发送
    translatedText: '' // 绑定的中文翻译内容
  },

  onLoad(options) {
    this.setData({
      reportId: options.id,
      type: options.type
    });
    this.fetchDetail();
  },

  async fetchDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const collectionName = this.data.type === 'daily' ? 'report_daily' : 'report_weekly';
      const res = await db.collection(collectionName).doc(this.data.reportId).get();
      let data = res.data;
      
      // 🌟 1. 智能清理：把历史遗留的【undefined】删掉，把纯空格和'无'转成空
      const cleanStr = (str) => {
        if (!str) return '';
        let s = str.replace(/【undefined】\s*/g, '').trim();
        return (s === '无' || s === '0') ? '' : s;
      };

      if (this.data.type === 'daily') {
        data.list_calls = cleanStr(data.list_calls);
        data.list_visit = cleanStr(data.list_visit);
        data.list_video = cleanStr(data.list_video);
        data.detail_other = cleanStr(data.detail_other);
      } else {
        data.plan_other = cleanStr(data.plan_other);
      }

      // 🌟 2. 智能组装：有数据才拼接，且序号自动排队递增
      let textToCopy = '';
      
      if (this.data.type === 'daily') {
        textToCopy = `【工作日报】 - ${data.sales_name}\n`;
        textToCopy += `汇报日期：${data.report_date}\n`;
        textToCopy += `----------------------\n`;
        
        let index = 1; // 动态序号
        if (data.list_calls) { textToCopy += `${index}. 聊过2分钟以上的客户：\n${data.list_calls}\n\n`; index++; }
        if (data.count_line > 0) { textToCopy += `${index}. LineOA新增好友：${data.count_line} 人\n\n`; index++; }
        if (data.list_visit) { textToCopy += `${index}. 邀约到店看车：\n${data.list_visit}\n\n`; index++; }
        if (data.list_video) { textToCopy += `${index}. 视频看车客户：\n${data.list_video}\n\n`; index++; }
        if (data.detail_other) { textToCopy += `${index}. 其他工作内容：\n${data.detail_other}\n\n`; index++; }
        
      } else {
        textToCopy = `【周工作计划】 - ${data.sales_name}\n`;
        textToCopy += `计划周期：${data.week_range || data.week_start}\n`;
        textToCopy += `----------------------\n`;
        
        let index = 1;
        if (data.plan_calls > 0) { textToCopy += `${index}. 计划通话(>2分钟)：${data.plan_calls} 个\n`; index++; }
        if (data.plan_line > 0) { textToCopy += `${index}. 计划新增Line好友：${data.plan_line} 人\n`; index++; }
        if (data.plan_visit > 0) { textToCopy += `${index}. 计划邀约到店：${data.plan_visit} 个\n`; index++; }
        if (data.plan_video > 0) { textToCopy += `${index}. 计划视频看车：${data.plan_video} 个\n\n`; index++; }
        if (data.plan_other) { textToCopy += `${index}. 其他工作安排：\n${data.plan_other}`; index++; }
      }

      // 覆盖赋值，这样 WXML 里渲染的也是清理过 【undefined】 的干净数据
      this.setData({
        report: data,
        combinedText: textToCopy.trim() || '未提交有效内容',
        translatedText: data.translated_text || '' 
      });
    } catch (err) {
      console.error('获取详情失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 一键复制排版好的文本
  copyOriginalText() {
    if (!this.data.combinedText) {
      wx.showToast({ title: '没有可复制的内容', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.combinedText,
      success: () => {
        wx.showToast({ title: '已复制，可直接发送', icon: 'none' });
      }
    });
  },

  // 保存中文存档
  async saveTranslation() {
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      const collectionName = this.data.type === 'daily' ? 'report_daily' : 'report_weekly';
      await db.collection(collectionName).doc(this.data.reportId).update({
        data: {
          translated_text: this.data.translatedText
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '中文存档已保存', icon: 'success' });
    } catch (err) {
      console.error('保存翻译失败', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});