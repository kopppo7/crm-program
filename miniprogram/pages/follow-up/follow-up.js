const i18n = require('../../utils/i18n.js');
const db = wx.cloud.database();

Page({
  data: {
    t: {},
    customerId: '',
    
    // --- 沟通方式 ---
    followTypes: [], // 中/泰双语的沟通方式数组
    selectedType: '',
    
    // --- 跟进结果 ---
    statusOptions: [], // 包含 label 和 value 的对象数组，解决 undefined 问题
    selectedStatus: '', // 存在数据库里的英文状态 (例如: Contacted)
    selectedStatusLabel: '', // 显示在页面上的中/泰文字
    
    // --- 表单内容 ---
    lostReason: '',
    nextFollowUp: '',
    note: '',
    tempImgPaths: [],
    today: '' // 用于限制下次跟进时间不能选过去
  },

  onLoad(options) {
    this.setData({ 
      customerId: options.id || '',
      today: this.formatDate(new Date()) // 把今天设为日历的最小日期
    });
    this.initLanguage();
  },

  // 1. 初始化语言和下拉菜单选项
  initLanguage() {
    const t = i18n.t();
    const lang = i18n.getLang();

    // 动态生成沟通方式菜单
    const types = lang === 'zh' 
      ? ['电话沟通', 'Line', '线下拜访']
      : ['โทรศัพท์ (Phone)', 'Line', 'พบปะลูกค้า (Visit)'];

    // 动态生成状态选项菜单 (严格匹配 range-key="label")
    const rawStatuses = ['Contacted', 'Strong Intent', 'Quoted', 'Demo Scheduled', 'Closed Won', 'Closed Lost', 'Invalid'];
    const options = rawStatuses.map(status => {
      return {
        value: status,
        label: t.status[status] || status
      };
    });

    this.setData({ 
      t: t,
      followTypes: types,
      statusOptions: options
    });
    wx.setNavigationBarTitle({ title: t.fuTitle });
  },

  // 2. 选择沟通方式
  onTypeChange(e) {
    const index = e.detail.value;
    this.setData({ selectedType: this.data.followTypes[index] });
  },

  // 3. 选择跟进状态
  onStatusChange(e) {
    const index = e.detail.value;
    const selected = this.data.statusOptions[index];
    this.setData({ 
      selectedStatus: selected.value,
      selectedStatusLabel: selected.label
    });
  },

  // 4. 输入战败原因
  onLostReasonInput(e) {
    this.setData({ lostReason: e.detail.value });
  },

  // 5. 选择下次跟进日期
  onDateChange(e) {
    this.setData({ nextFollowUp: e.detail.value });
  },

  // 6. 输入沟通简述
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // 7. 图片操作：选择图片
  chooseImage() {
    const remainCount = 3 - this.data.tempImgPaths.length;
    if (remainCount <= 0) return;
    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath);
        this.setData({ tempImgPaths: this.data.tempImgPaths.concat(tempFiles) });
      }
    });
  },

  // 8. 图片操作：删除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imgs = this.data.tempImgPaths;
    imgs.splice(index, 1);
    this.setData({ tempImgPaths: imgs });
  },

  // 9. 图片操作：全屏预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.tempImgPaths
    });
  },

  // 10. 格式化日期辅助函数 (YYYY-MM-DD)
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  // 11. 最终提交保存记录
  submitFollowUp() {
    if (!this.data.selectedType) return wx.showToast({ title: '请选择沟通方式', icon: 'none' });
    if (!this.data.selectedStatus) return wx.showToast({ title: '请选择跟进结果', icon: 'none' });
    if (!this.data.note) return wx.showToast({ title: '请填写简述', icon: 'none' });

    wx.showLoading({ title: '保存中...' });
    const db = wx.cloud.database();
    
    // 如果状态是成交、战败、无效，强制清空下次跟进时间，让它彻底从待办消失
    let finalNextDate = this.data.nextFollowUp;
    if (['Closed Won', 'Closed Lost', 'Invalid'].includes(this.data.selectedStatus)) {
      finalNextDate = ''; 
    }

    // 第一步：更新 customers 主表中的【客户状态】和【下次跟进时间】
    db.collection('customers').doc(this.data.customerId).update({
      data: {
        status: this.data.selectedStatus,
        next_follow_up: finalNextDate || '', // 统一使用带下划线的 next_follow_up
        updateTime: db.serverDate()
      }
    }).then(() => {
      // 第二步：新增一条记录到你截图里的 follow_up_logs 表中
      return db.collection('follow_up_logs').add({
        data: {
          customer_id: this.data.customerId, // 严格匹配你截图里的字段
          follow_type: this.data.selectedType,
          result_tag: this.data.selectedStatus,
          lost_reason: this.data.lostReason || '',
          note: this.data.note,
          sales_id: wx.getStorageSync('myOpenId') || '', 
          screenshot_files: this.data.tempImgPaths || [],
          createTimeStr: this.formatDate(new Date()),
          createTime: db.serverDate()
        }
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: this.data.t.fuSuccess || '保存成功' });
      // 延迟返回，给系统刷新数据库的时间
      setTimeout(() => {
        wx.navigateBack(); 
      }, 1000);
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络超时，请重试', icon: 'none' });
      console.error('保存跟进失败:', err);
    });
  }

  
});
