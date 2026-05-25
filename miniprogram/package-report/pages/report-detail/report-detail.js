const db = wx.cloud.database();

Page({
  data: {
    reportId: '',
    type: 'daily', // daily 或 weekly
    report: null,
    combinedText: '', // 拼接好的泰文原文，方便一键复制
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
      const data = res.data;
      
      // 🌟 智能拼接员工填写的所有的文本，方便您一次性复制去翻译
      let textToCopy = '';
      if (this.data.type === 'daily') {
        if (data.detail_new) textToCopy += `【新客户】：\n${data.detail_new}\n\n`;
        if (data.detail_follow) textToCopy += `【跟进客户】：\n${data.detail_follow}\n\n`;
        if (data.detail_self) textToCopy += `【自拓客户】：\n${data.detail_self}\n\n`;
        if (data.detail_other) textToCopy += `【其他工作】：\n${data.detail_other}`;
      } else {
        textToCopy = `【日常统筹计划】：\n${data.routine_plan || '无'}`;
      }

      this.setData({
        report: data,
        combinedText: textToCopy.trim() || '该员工未填写任何文字详情。',
        translatedText: data.translated_text || '' // 读取以前存过的翻译
      });
    } catch (err) {
      console.error('获取详情失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 一键复制原文
  copyOriginalText() {
    if (!this.data.combinedText || this.data.combinedText.includes('未填写任何文字')) {
      wx.showToast({ title: '没有可复制的内容', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.combinedText,
      success: () => {
        wx.showToast({ title: '已复制，快去翻译吧', icon: 'none' });
      }
    });
  },

  // 保存中文存档
  async saveTranslation() {
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      const collectionName = this.data.type === 'daily' ? 'report_daily' : 'report_weekly';
      // 将中文翻译存入数据库专属字段 translated_text 中
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