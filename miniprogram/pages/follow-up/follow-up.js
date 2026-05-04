const i18n = require('../../utils/i18n.js');
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
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
    tempImgPaths: [], // 这里存的是临时路径 wxfile://[cite: 8]
    today: '' 
  },

  onLoad(options) {
    this.setData({ 
      customerId: options.id || '',
      today: this.formatDate(new Date()) 
    });
    this.initLanguage();
  },

  initLanguage() {
    const t = i18n.t();
    const lang = i18n.getLang();
    const types = lang === 'zh' ? ['电话沟通', 'Line', '线下拜访'] : ['โทรศัพท์ (Phone)', 'Line', 'พบปะลูกค้า (Visit)'];
    const rawStatuses = ['Contacted', 'Strong Intent', 'Quoted', 'Demo Scheduled', 'Closed Won', 'Closed Lost', 'Invalid', 'No Answer'];
    const options = rawStatuses.map(status => ({ value: status, label: t.status[status] || status }));
    this.setData({ t: t, followTypes: types, statusOptions: options });
    wx.setNavigationBarTitle({ title: t.fuTitle });
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
        this.setData({ tempImgPaths: this.data.tempImgPaths.concat(tempFiles) });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imgs = this.data.tempImgPaths;
    imgs.splice(index, 1);
    this.setData({ tempImgPaths: imgs });
  },

  previewImage(e) {
    wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.tempImgPaths });
  },

  // --- 核心提交逻辑：先上传图片，再保存记录 ---
  async submitFollowUp() {
    if (!this.data.selectedType) return wx.showToast({ title: '请选择沟通方式', icon: 'none' });
    if (!this.data.selectedStatus) return wx.showToast({ title: '请选择跟进结果', icon: 'none' });
    if (!this.data.note) return wx.showToast({ title: '请填写简述', icon: 'none' });

    wx.showLoading({ title: '准备数据...', mask: true });

    try {
      wx.cloud.init({
        env: 'cloud1-d1gdd35vq77ab5c2f',
        traceUser: true
      });

      let cloudFileIDs = [];
      const totalImgs = this.data.tempImgPaths.length;

      if (totalImgs > 0) {
        for (let i = 0; i < totalImgs; i++) {
          let filePath = this.data.tempImgPaths[i];
          const extension = filePath.split('.').pop(); 
          const cloudPath = `follow_ups/${Date.now()}-${i}.${extension}`; 
          
          // 极限压缩！强行把图片质量压到 20%
          try {
            const compressRes = await wx.compressImage({
              src: filePath,
              quality: 20 
            });
            filePath = compressRes.tempFilePath; 
          } catch (compressErr) {
            console.warn('图片压缩失败，将使用原体积上传', compressErr);
          }

          // 🌟 核心修复：用 new Promise 手动包装，强制获取 UploadTask 对象
          const uploadRes = await new Promise((resolve, reject) => {
            const uploadTask = wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: filePath,
              config: {
                env: 'cloud1-d1gdd35vq77ab5c2f' 
              },
              success: res => resolve(res), // 上传成功时放行
              fail: err => reject(err)      // 上传失败时抛出错误
            });

            // 因为加了 success/fail，此时的 uploadTask 才是真正的任务对象，可以监听进度了
            uploadTask.onProgressUpdate((res) => {
              const overallProgress = Math.round(((i * 100) + res.progress) / totalImgs);
              wx.showLoading({ 
                title: `上传中 ${overallProgress}%`, 
                mask: true 
              });
            });
          });

          // 把成功上传拿到的 fileID 存起来
          cloudFileIDs.push(uploadRes.fileID); 
        }
      }

      // 图片传完了，提示保存数据库
      wx.showLoading({ title: '保存记录...', mask: true });

      // 2. 获取旧数据处理逻辑 (5次未接通判定)
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
          wx.showModal({ title: '系统提示', content: '连续5次未接听，已转为无效线索', showCancel: false });
        } else {
          finalNextDate = this.formatDate(new Date()); 
        }
      } else {
        currentNoAnswerCount = 0;
        if (['Closed Won', 'Closed Lost', 'Invalid'].includes(finalStatus)) finalNextDate = '';
      }

      // 3. 更新主表与插入日志
      await db.collection('customers').doc(this.data.customerId).update({
        data: {
          status: finalStatus,
          no_answer_count: currentNoAnswerCount, 
          next_follow_up: finalNextDate || '',
          updateTime: db.serverDate()
        }
      });

      await db.collection('follow_up_logs').add({
        data: {
          customer_id: this.data.customerId,
          follow_type: this.data.selectedType,
          result_tag: finalStatus,
          lost_reason: this.data.lostReason || '',
          note: this.data.note,
          sales_id: wx.getStorageSync('myOpenId') || '',
          screenshot_files: cloudFileIDs, 
          createTimeStr: this.formatDate(new Date()),
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 1000);

    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: '网络超时，请切换WiFi或4G重试', content: err.message, showCancel: false });
      console.error('❌ 上传或保存失败:', err);
    }
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onTypeChange(e) { this.setData({ selectedType: this.data.followTypes[e.detail.value] }); },
  onStatusChange(e) { 
    const selected = this.data.statusOptions[e.detail.value];
    this.setData({ selectedStatus: selected.value, selectedStatusLabel: selected.label }); 
  },
  onLostReasonInput(e) { this.setData({ lostReason: e.detail.value }); },
  onDateChange(e) { this.setData({ nextFollowUp: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); }
});