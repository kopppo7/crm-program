const i18n = require('../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentLang: 'zh',
    isProfileExpanded: true,
    profile: {
      demand: '', motivation: '', userType: '', scenario: '', timeframe: ''
    },
    t: {},
    customerId: '',
    
    // 🌟 移除了 followTypes 和 selectedType
    statusOptions: [],
    selectedStatus: '',
    selectedStatusLabel: '',
    
    transactionAmount: '', 
    isKeyCustomer: false,  
    keyCustomerReason: '', 
    
    nextFollowUp: '',
    note: '',
    tempImgPaths: [],
    today: '',
    todayFirstLogId: '',
    todayNoAnswerCount: 0 
  },

  onLoad(options) {
    const todayStr = this.formatDate(new Date());
    this.setData({ 
      customerId: options.id || '',
      today: todayStr 
    });
    this.initLanguage();
    this.checkTodayNoAnswer();
    this.fetchExistingProfile(); 
  },

  async fetchExistingProfile() {
    try {
      const res = await db.collection('customers').doc(this.data.customerId).get();
      const customerData = res.data;
      
      if (customerData.profile) {
        this.setData({ profile: customerData.profile });
      }
      
      this.setData({
        isKeyCustomer: customerData.is_key_customer || false,
        keyCustomerReason: customerData.key_customer_reason || ''
      });
    } catch (e) {
      console.error('拉取现有画像失败', e);
    }
  },

  toggleProfile() {
    this.setData({ isProfileExpanded: !this.data.isProfileExpanded });
  },

  onProfileInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`profile.${field}`]: e.detail.value
    });
  },

  async checkTodayNoAnswer() {
    try {
      const res = await db.collection('follow_up_logs').where({
        customer_id: this.data.customerId,
        result_tag: 'No Answer',
        createTimeStr: this.data.today
      }).get();
      this.setData({
        todayNoAnswerCount: res.data.length,
        todayFirstLogId: res.data.length > 0 ? res.data[0]._id : '' 
      });
    } catch (e) {
      console.error('查询未接次数失败', e);
    }
  },

  initLanguage() {
    const t = i18n.t();
    const lang = i18n.getLang();
    
    this.setData({
      t: t,
      currentLang: lang
    });
    wx.setNavigationBarTitle({
      title: t.fuTitle || (lang === 'zh' ? '记录跟进详情' : 'บันทึกรายละเอียด')
    });
    this.fetchStatusDict(lang);
  },

  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict')
        .where({ type: 'customer_status', status: 'active' })
        .orderBy('sort', 'asc')
        .get();

      // 🌟 核心修改 1：过滤掉 'pending'（待处理）状态
      const options = res.data
        .filter(item => item.value !== 'pending') 
        .map(item => ({
          value: item.value,
          label: lang === 'zh' ? item.label_zh : item.label_th 
        }));
        
      this.setData({ statusOptions: options });
    } catch (e) {
      console.error('获取动态状态字典失败', e);
    }
  },

  chooseImage() {
    const remainCount = 3 - this.data.tempImgPaths.length;
    if (remainCount <= 0) return;

    const lang = i18n.getLang();
    const itemList = lang === 'zh' ? ['拍照', '从手机相册选择'] : ['ถ่ายภาพ', 'เลือกจากอัลบั้มโทรศัพท์'];

    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        wx.chooseMedia({
          count: remainCount,
          mediaType: ['image'],
          sourceType: sourceType, 
          sizeType: ['compressed'],
          success: (mediaRes) => {
            const tempFiles = mediaRes.tempFiles.map(file => file.tempFilePath);
            this.setData({
              tempImgPaths: this.data.tempImgPaths.concat(tempFiles)
            });
          }
        });
      },
      fail: (err) => console.log('用户取消选择', err)
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imgs = this.data.tempImgPaths;
    imgs.splice(index, 1);
    this.setData({ tempImgPaths: imgs });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.tempImgPaths
    });
  },

  onKeyCustomerChange(e) { this.setData({ isKeyCustomer: e.detail.value }); },
  onKeyReasonInput(e) { this.setData({ keyCustomerReason: e.detail.value }); },
  onAmountInput(e) { this.setData({ transactionAmount: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },

  submitFollowUp() {
    if (!this.data.selectedStatus) return wx.showToast({ title: '请选择跟进结果', icon: 'none' });
    
    // 🌟 核心修改 2：删除了沟通方式的判断逻辑
    
    if (this.data.isKeyCustomer && !this.data.keyCustomerReason.trim()) {
      return wx.showToast({ title: '请填写重点原因', icon: 'none' });
    }
    if (this.data.selectedStatus === 'Closed Won' && !this.data.transactionAmount.trim()) {
      return wx.showToast({ title: '请填写成交金额', icon: 'none' });
    }

    let finalNote = this.data.note;
    let requireImage = false;

    if (this.data.selectedStatus === 'Invalid') {
      finalNote = '标记为无效线索'; 
    } else if (this.data.selectedStatus === 'No Answer') {
      if (this.data.todayNoAnswerCount === 0) {
        finalNote = '今日首次联系，客户未接听 (系统快捷记录)';
      } else {
        if (!finalNote) return wx.showToast({ title: '请填写具体未接情况', icon: 'none' });
        requireImage = true;
      }
    } else {
      if (!finalNote) return wx.showToast({ title: '请填写简述', icon: 'none' });
    }

    if (this.data.selectedStatus === 'Closed Won') {
       requireImage = true; 
    }

    if (requireImage && this.data.tempImgPaths.length === 0) {
      return wx.showToast({ title: '请上传相关凭证或截图', icon: 'none' });
    }

    // 🌟 核心修改 3：移除了所有的客户画像强制填写阻断拦截弹窗逻辑

    this.executeSubmit(finalNote);
  },

  async executeSubmit(finalNote) {
    wx.showLoading({ title: '准备数据...', mask: true });

    try {
      wx.cloud.init({ env: 'cloud1-d1gdd35vq77ab5c2f', traceUser: true });
      let cloudFileIDs = [];
      const totalImgs = this.data.tempImgPaths.length;

      if (totalImgs > 0) {
        for (let i = 0; i < totalImgs; i++) {
          wx.showLoading({ title: `上传图片 ${i + 1}/${totalImgs}`, mask: true });
          let filePath = this.data.tempImgPaths[i];
          const extension = filePath.split('.').pop() || 'jpg';
          const cloudPath = `follow_ups/${Date.now()}-img${i}.${extension}`;
          
          try {
            const compressRes = await wx.compressImage({ src: filePath, quality: 20 });
            filePath = compressRes.tempFilePath;
          } catch (compressErr) {
            console.warn('图片压缩失败', compressErr);
          }

          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            config: { env: 'cloud1-d1gdd35vq77ab5c2f' }
          });
          cloudFileIDs.push(uploadRes.fileID);
        }
      }

      wx.showLoading({ title: '保存记录...', mask: true });

      const custRes = await db.collection('customers').doc(this.data.customerId).get();
      const oldCustomer = custRes.data;
      let currentNoAnswerCount = oldCustomer.no_answer_count || 0;

      let finalStatus = this.data.selectedStatus; 
      let finalNextDate = this.data.nextFollowUp;

      if (finalStatus === 'No Answer') {
        // ==========================================
        // 新规则：
        // 1. 同一天仍然最多拨打 2 次：
        //    第1次未接 -> 当天继续拨打
        //    第2次未接 -> 自动安排到第二天
        // 2. 不再按“累计未接次数”判无效，
        //    改为累计 7 个不同自然日出现未接后转为无效线索。
        // ==========================================

        // 查询该客户历史上的未接电话记录
        const missedRes = await db.collection('follow_up_logs').where({
          customer_id: this.data.customerId,
          result_tag: 'No Answer'
        }).get();

        const missedDaySet = new Set(
          (missedRes.data || [])
            .map(item => item.createTimeStr)
            .filter(Boolean)
        );

        // 当前这次提交还没有写入日志，因此把今天主动加入统计
        missedDaySet.add(this.data.today);

        const missedDayCount = missedDaySet.size;

        // no_answer_count 现在保存“累计未接天数”
        currentNoAnswerCount = missedDayCount;

        if (missedDayCount >= 7) {
          finalStatus = 'Invalid';
          finalNextDate = '';

          wx.showModal({
            title: '系统提示',
            content: '累计7天未接听，已转为无效线索',
            showCancel: false
          });
        } else {
          // 保持原来的“当天两次未接”规则：
          // 0 = 当前是当天第1次未接，仍安排今天；
          // >=1 = 当前是当天第2次未接，安排第二天。
          if (this.data.todayNoAnswerCount === 0) {
            finalNextDate = this.data.today;
          } else {
            let tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            finalNextDate = this.formatDate(tomorrow);
          }
        }
      } else {
        // 一旦选择其他跟进结果，连续未接天数清零
        currentNoAnswerCount = 0;

        if (['Closed Won', 'Closed Lost', 'Invalid'].includes(finalStatus)) {
          finalNextDate = '';
        }
      }

      await db.collection('customers').doc(this.data.customerId).update({
        data: {
          status: finalStatus,
          no_answer_count: currentNoAnswerCount, 
          next_follow_up: finalNextDate || '',
          updateTime: db.serverDate(),
          last_follow_up_time: db.serverDate(),
          profile: this.data.profile,
          is_key_customer: this.data.isKeyCustomer,
          key_customer_reason: this.data.isKeyCustomer ? this.data.keyCustomerReason : ''
        }
      });

      let extendInfo = {};
      if (finalStatus === 'Closed Won') extendInfo.transaction_amount = this.data.transactionAmount;

      if (finalStatus === 'No Answer' && this.data.todayNoAnswerCount === 1 && this.data.todayFirstLogId) {
        await db.collection('follow_up_logs').doc(this.data.todayFirstLogId).update({
          data: {
            note: finalNote, 
            screenshot_files: cloudFileIDs, 
            createTime: db.serverDate() 
          }
        });
      } else {
        // 由于没有沟通方式了，这里使用保底的默认值填充
        const finalFollowType = this.data.currentLang === 'zh' ? '常规跟进' : 'ติดตามทั่วไป';
        await db.collection('follow_up_logs').add({
          data: {
            customer_id: this.data.customerId,
            follow_type: finalFollowType,
            result_tag: finalStatus,
            note: finalNote,
            sales_id: wx.getStorageSync('myOpenId') || '',
            screenshot_files: cloudFileIDs,
            audio_files: [],
            createTimeStr: this.data.today,
            createTime: db.serverDate(),
            ...extendInfo 
          }
        });
      }

      wx.hideLoading();
      
      if (finalStatus === 'Closed Won') {
        wx.showModal({
          title: this.data.currentLang === 'zh' ? '🎉 恭喜成交！' : '🎉 ยินดีด้วย!',
          content: this.data.currentLang === 'zh' ? '业绩+1，继续加油保持好状态！' : 'ปิดการขายได้แล้ว ทำได้ดีมาก!',
          showCancel: false,
          confirmColor: '#10b981',
          success: () => wx.navigateBack()
        });
      } else {
        wx.showToast({ title: '保存成功' });
        setTimeout(() => wx.navigateBack(), 1000);
      }

    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: '上传超时', content: '网络较慢，请再试一次', showCancel: false });
      console.error('❌ 上传或保存失败:', err);
    }
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onStatusChange(e) {
    const selected = this.data.statusOptions[e.detail.value];
    this.setData({
      selectedStatus: selected.value,
      selectedStatusLabel: selected.label
    });
  },
  
  onDateChange(e) { 
    let dateStr = e.detail.value; 
    let parts = dateStr.split('-');
    let year = parseInt(parts[0], 10);
    if (year < 2000) year += 543;
    else if (year > 2400) year -= 543;
    const fixedDate = `${year}-${parts[1]}-${parts[2]}`;
    this.setData({ nextFollowUp: fixedDate }); 
  }
});