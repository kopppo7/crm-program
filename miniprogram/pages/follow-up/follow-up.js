const i18n = require('../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentLang: 'zh', // 🌟 显式声明语言环境，供 WXML 使用
    isProfileExpanded: true,
    profile: {
      demand: '', motivation: '', userType: '', scenario: '', timeframe: ''
    },
    t: {},
    customerId: '',
    followTypes: [],
    selectedType: '',
    statusOptions: [],     // 🌟 现在这里将接收云端传来的 {label, value} 对象数组
    selectedStatus: '',    // 存入底层数据库的真实英文 key (如 'Closed Won')
    selectedStatusLabel: '', // 展示给销售看的中/泰文
    lostReason: '',
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
      if (res.data.profile) {
        this.setData({ profile: res.data.profile });
      }
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
    const types = lang === 'zh' ? ['电话沟通', 'Line', '线下拜访'] : ['โทรศัพท์ (Phone)', 'Line', 'พบปะลูกค้า (Visit)'];
    
    this.setData({
      t: t,
      followTypes: types,
      currentLang: lang // 🌟 确保保存当前语言状态
    });
    
    wx.setNavigationBarTitle({
      title: t.fuTitle || (lang === 'zh' ? '记录跟进详情' : 'บันทึกรายละเอียด')
    });

    // 🌟 核心升级：废弃本地硬编码状态，动态拉取系统字典
    this.fetchStatusDict(lang);
  },

  // 🌟 核心升级：从 system_dict 拉取动态字典并生成下拉选项
  async fetchStatusDict(lang) {
    try {
      const res = await db.collection('system_dict')
        .where({ type: 'customer_status', status: 'active' })
        .orderBy('sort', 'asc')
        .get();

      const options = res.data.map(item => ({
        value: item.value, // 底层存入数据的真实 key
        label: lang === 'zh' ? item.label_zh : item.label_th // 界面显示的动态语言
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
      fail: (err) => {
        console.log('用户取消选择', err);
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

    // 🚨 核心流转规则依然基于英文 value 进行判断，丝毫不受多语言影响
    if (this.data.selectedStatus === 'No Answer') {
      if (this.data.todayNoAnswerCount === 0) {
        finalNote = '今日首次联系，客户未接听 (系统快捷记录)';
      } else {
        if (!finalNote) return wx.showToast({
          title: '请填写具体未接情况',
          icon: 'none'
        });
        requireImage = true;
      }
    } else {
      if (!finalNote) return wx.showToast({
        title: '请填写简述',
        icon: 'none'
      });
    }

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

      const custRes = await db.collection('customers').doc(this.data.customerId).get();
      const oldCustomer = custRes.data;
      let currentNoAnswerCount = oldCustomer.no_answer_count || 0;
      
      // 🌟 获取底层的英文 key 作为最终状态
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
          if (this.data.todayNoAnswerCount === 0) {
            finalNextDate = this.data.today;
          } else {
            let tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            finalNextDate = this.formatDate(tomorrow);
          }
        }
      } else {
        currentNoAnswerCount = 0;
        if (['Closed Won', 'Closed Lost', 'Invalid'].includes(finalStatus)) finalNextDate = '';
      }

      await db.collection('customers').doc(this.data.customerId).update({
        data: {
          status: finalStatus,
          no_answer_count: currentNoAnswerCount, 
          next_follow_up: finalNextDate || '',
          updateTime: db.serverDate(),
          last_follow_up_time: db.serverDate(),
          profile: this.data.profile 
        }
      });

      if (finalStatus === 'No Answer' && this.data.todayNoAnswerCount === 1 && this.data.todayFirstLogId) {
        await db.collection('follow_up_logs').doc(this.data.todayFirstLogId).update({
          data: {
            note: finalNote, 
            screenshot_files: cloudFileIDs, 
            createTime: db.serverDate() 
          }
        });
      } else {
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

  // 🌟 这里完美兼容了对象数组结构，将分离 value 和 label
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

  onDateChange(e) { 
    let dateStr = e.detail.value; 
    let parts = dateStr.split('-');
    let year = parseInt(parts[0], 10);
    
    if (year < 2000) {
      year += 543;
    } else if (year > 2400) {
      year -= 543;
    }
    
    const fixedDate = `${year}-${parts[1]}-${parts[2]}`;
    this.setData({ nextFollowUp: fixedDate }); 
  },
  
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    });
  }
});