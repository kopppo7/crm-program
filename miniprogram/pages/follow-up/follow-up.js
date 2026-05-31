const i18n = require('../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    isProfileExpanded: true,
    profile: {
      demand: '', motivation: '', userType: '', scenario: '', timeframe: ''
    },
    t: {},
    customerId: '',
    followTypes: [],
    selectedType: '',
    statusOptions: [],
    selectedStatus: '',
    selectedStatusLabel: '',
    lostReason: '',
    nextFollowUp: '',
    note: '',
    tempImgPaths: [],
    today: '',
    todayFirstLogId: '',
    todayNoAnswerCount: 0 // 🌟 记录今天未接次数的核心变量
  },

  onLoad(options) {
    const todayStr = this.formatDate(new Date());
    this.setData({ 
      customerId: options.id || '',
      today: todayStr 
    });
    this.initLanguage();
    this.checkTodayNoAnswer();
    this.fetchExistingProfile(); // 🌟 新增：拉取现有画像
  },

  // 🌟 新增：从数据库获取目前已有的画像数据
  async fetchExistingProfile() {
    try {
      const res = await db.collection('customers').doc(this.data.customerId).get();
      if (res.data.profile) {
        this.setData({ profile: res.data.profile });
      }
    } catch (e) {
      console.error('拉取现有画像失败', e);
    }
  },

  // 🌟 新增：切换展开/折叠
  toggleProfile() {
    this.setData({ isProfileExpanded: !this.data.isProfileExpanded });
  },

  // 🌟 新增：双向绑定输入值
  onProfileInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`profile.${field}`]: e.detail.value
    });
  },

  // 🌟 修改：去数据库查今天未接记录，顺便把它的 ID 拿过来
  async checkTodayNoAnswer() {
    try {
      const res = await db.collection('follow_up_logs').where({
        customer_id: this.data.customerId,
        result_tag: 'No Answer',
        createTimeStr: this.data.today
      }).get(); // 从 count() 改成 get()

      this.setData({
        todayNoAnswerCount: res.data.length,
        todayFirstLogId: res.data.length > 0 ? res.data[0]._id : '' // 把第一条的ID记下来
      });
    } catch (e) {
      console.error('查询未接次数失败', e);
    }
  },

  initLanguage() {
    const t = i18n.t();
    const lang = i18n.getLang();
    const types = lang === 'zh' ? ['电话沟通', 'Line', '线下拜访'] : ['โทรศัพท์ (Phone)', 'Line', 'พบปะลูกค้า (Visit)'];

    // 状态严格限制真实跟进结果
    const rawStatuses = [
      'Quoted',
      'Considering',
      'Busy',
      'No Answer',
      'Demo Scheduled',
      'Closed Won',
      'Closed Lost',
      'Invalid'
    ];

    const options = rawStatuses.map(status => ({
      value: status,
      label: t.status[status] || status
    }));
    this.setData({
      t: t,
      followTypes: types,
      statusOptions: options
    });
    wx.setNavigationBarTitle({
      title: t.fuTitle
    });
  },

  // --- 图片选择与预览逻辑 ---
  chooseImage() {
    const remainCount = 3 - this.data.tempImgPaths.length;
    if (remainCount <= 0) return;
    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          tempImgPaths: this.data.tempImgPaths.concat(tempFiles)
        });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imgs = this.data.tempImgPaths;
    imgs.splice(index, 1);
    this.setData({
      tempImgPaths: imgs
    });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.tempImgPaths
    });
  },

  // --- 🌟 核心提交逻辑（防作弊版） ---
  async submitFollowUp() {
    if (!this.data.selectedType) return wx.showToast({
      title: '请选择沟通方式',
      icon: 'none'
    });
    if (!this.data.selectedStatus) return wx.showToast({
      title: '请选择跟进结果',
      icon: 'none'
    });

    let finalNote = this.data.note;
    let requireImage = false;

    // 🌟 严查未接电话逻辑
    if (this.data.selectedStatus === 'No Answer') {
      if (this.data.todayNoAnswerCount === 0) {
        // 今天第1次没接：放行，系统自动代写说明
        finalNote = '今日首次联系，客户未接听 (系统快捷记录)';
      } else {
        // 今天第2次没接：强制开启截图和文字校验
        if (!finalNote) return wx.showToast({
          title: '请填写具体未接情况',
          icon: 'none'
        });
        requireImage = true;
      }
    } else {
      // 选了别的状态，也必须写字
      if (!finalNote) return wx.showToast({
        title: '请填写简述',
        icon: 'none'
      });
    }

    // 🌟 核心卡点：判定需要截图却没传图，直接驳回
    if (requireImage && this.data.tempImgPaths.length === 0) {
      return wx.showToast({
        title: '请上传通话记录截图证明',
        icon: 'none'
      });
    }

    wx.showLoading({
      title: '准备数据...',
      mask: true
    });

    try {
      wx.cloud.init({
        env: 'cloud1-d1gdd35vq77ab5c2f',
        traceUser: true
      });

      let cloudFileIDs = [];
      const totalImgs = this.data.tempImgPaths.length;

      // 🌟 上传图片
      if (totalImgs > 0) {
        for (let i = 0; i < totalImgs; i++) {
          wx.showLoading({
            title: `上传图片 ${i + 1}/${totalImgs}`,
            mask: true
          });

          let filePath = this.data.tempImgPaths[i];
          const extension = filePath.split('.').pop() || 'jpg';
          const cloudPath = `follow_ups/${Date.now()}-img${i}.${extension}`;

          try {
            const compressRes = await wx.compressImage({
              src: filePath,
              quality: 20
            });
            filePath = compressRes.tempFilePath;
          } catch (compressErr) {
            console.warn('图片压缩失败', compressErr);
          }

          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            config: {
              env: 'cloud1-d1gdd35vq77ab5c2f'
            }
          });
          cloudFileIDs.push(uploadRes.fileID);
        }
      }

      wx.showLoading({
        title: '保存记录...',
        mask: true
      });

      // 🌟 客户状态流转逻辑
      const custRes = await db.collection('customers').doc(this.data.customerId).get();
      const oldCustomer = custRes.data;
      let currentNoAnswerCount = oldCustomer.no_answer_count || 0;
      let finalStatus = this.data.selectedStatus;
      let finalNextDate = this.data.nextFollowUp;

      if (finalStatus === 'No Answer') {
        currentNoAnswerCount += 1;
        if (currentNoAnswerCount >= 5) {
          finalStatus = 'Invalid';
          finalNextDate = '';
          wx.showModal({
            title: '系统提示',
            content: '连续5次未接听，已转为无效线索',
            showCancel: false
          });
        } else {
          // 🌟 智能推迟时间轴
          if (this.data.todayNoAnswerCount === 0) {
            // 第1次没接：下次跟进依旧锁定今天
            finalNextDate = this.data.today;
          } else {
            // 第2次没接：延期至明天
            let tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            finalNextDate = this.formatDate(tomorrow);
          }
        }
      } else {
        currentNoAnswerCount = 0;
        if (['Closed Won', 'Closed Lost', 'Invalid'].includes(finalStatus)) finalNextDate = '';
      }

      // 更新客户资料主表
      // 更新客户资料主表
      await db.collection('customers').doc(this.data.customerId).update({
        data: {
          status: finalStatus,
          no_answer_count: currentNoAnswerCount, 
          next_follow_up: finalNextDate || '',
          updateTime: db.serverDate(),
          last_follow_up_time: db.serverDate(),
          profile: this.data.profile // 🌟 核心：将填写的画像随跟进记录一起保存到客户主表！
        }
      });
      // 🌟 核心升级：时间轴合并逻辑！
      if (finalStatus === 'No Answer' && this.data.todayNoAnswerCount === 1 && this.data.todayFirstLogId) {
        // 如果是今天第二次没接，直接“覆盖更新”第一次的那条自动记录，实现时间轴合并！
        await db.collection('follow_up_logs').doc(this.data.todayFirstLogId).update({
          data: {
            note: finalNote, // 覆盖为销售真正写的未接情况
            screenshot_files: cloudFileIDs, // 塞入截图
            createTime: db.serverDate() // 把这条记录的时间轴刷新到现在的最新一刻
          }
        });
      } else {
        // 🌟 其他情况（如第一次没接，或其他任何状态），正常新增一条时间轴记录
        await db.collection('follow_up_logs').add({
          data: {
            customer_id: this.data.customerId,
            follow_type: this.data.selectedType,
            result_tag: finalStatus,
            lost_reason: this.data.lostReason || '',
            note: finalNote,
            sales_id: wx.getStorageSync('myOpenId') || '',
            screenshot_files: cloudFileIDs,
            audio_files: [],
            createTimeStr: this.data.today,
            createTime: db.serverDate()
          }
        });
      }

      wx.hideLoading();
      wx.showToast({
        title: '保存成功'
      });
      setTimeout(() => wx.navigateBack(), 1000);

    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: '上传超时',
        content: '网络较慢，请再试一次',
        showCancel: false
      });
      console.error('❌ 上传或保存失败:', err);
    }
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onTypeChange(e) {
    this.setData({
      selectedType: this.data.followTypes[e.detail.value]
    });
  },
  onStatusChange(e) {
    const selected = this.data.statusOptions[e.detail.value];
    this.setData({
      selectedStatus: selected.value,
      selectedStatusLabel: selected.label
    });
  },
  onLostReasonInput(e) {
    this.setData({
      lostReason: e.detail.value
    });
  },
  // 🌟 修复：泰国佛历导致年份变成 1483 的微信底层 Bug
  onDateChange(e) { 
    let dateStr = e.detail.value; // 拿到微信传过来的异常日期，例如 "1483-05-29"
    let parts = dateStr.split('-');
    let year = parseInt(parts[0], 10);
    
    // 智能年份纠偏
    if (year < 2000) {
      // 苹果手机 Bug：误减了 543 年 (1483 + 543 = 2026)
      year += 543; 
    } else if (year > 2400) {
      // 部分安卓机 Bug：直接传了佛历年份 2569，减去 543 转回公历
      year -= 543; 
    }
    
    // 重新拼装正确的公历日期
    const fixedDate = `${year}-${parts[1]}-${parts[2]}`;
    
    this.setData({ nextFollowUp: fixedDate }); 
  },
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    });
  }
});