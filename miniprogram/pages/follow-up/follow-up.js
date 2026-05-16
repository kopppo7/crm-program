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
    tempImgPaths: [], 
    tempAudioFiles: [], // 🌟 新增：存储录音文件的临时路径和名称[cite: 2]
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
    
    // 🌟 核心修改：将销售可选的状态严格限制为这7个真实跟进结果
    // 注意：绝对不要在这里放 'pending' 或 'FollowUp'
    const rawStatuses = [
      'Quoted',          // 已发资料
      'Considering',     // 还在考虑
      'No Answer',       // 未接电话
      'Demo Scheduled',  // 约定看机
      'Closed Won',      // 已成交
      'Closed Lost',     // 明确拒绝
      'Invalid'          // 无效线索
    ];
    
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

  chooseAudio() {
    // 只要已经有录音了，就不让再选了
    if (this.data.tempAudioFiles.length >= 1) return; 
    
    wx.chooseMessageFile({
      count: 1, // 强制只选 1 个
      type: 'file',
      extension: ['m4a', 'mp3', 'wav', 'aac', 'amr'],
      success: (res) => {
        const files = res.tempFiles.map(f => ({ path: f.path, name: f.name }));
        this.setData({ tempAudioFiles: files }); // 直接覆盖保存
      },
      fail: (err) => {
        console.log('用户取消或选择失败', err);
      }
    });
  },

  removeAudio(e) {
    const index = e.currentTarget.dataset.index;
    const audios = this.data.tempAudioFiles;
    audios.splice(index, 1);
    this.setData({ tempAudioFiles: audios });
  },
  
  // --- 🌟 终极防卡死版：核心提交逻辑 ---
  async submitFollowUp() {
    if (!this.data.selectedType) return wx.showToast({ title: '请选择沟通方式', icon: 'none' });
    if (!this.data.selectedStatus) return wx.showToast({ title: '请选择跟进结果', icon: 'none' });
    if (!this.data.note) return wx.showToast({ title: '请填写简述', icon: 'none' });

    wx.showLoading({ title: '准备数据...', mask: true });

    try {
      // 这里的初始化很重要，确保环境正确
      wx.cloud.init({
        env: 'cloud1-d1gdd35vq77ab5c2f',
        traceUser: true
      });

      let cloudFileIDs = [];
      let cloudAudioIDs = []; 
      
      const totalImgs = this.data.tempImgPaths.length;
      const totalAudios = this.data.tempAudioFiles.length;

      // 🌟 1. 纯净版：上传图片
      if (totalImgs > 0) {
        for (let i = 0; i < totalImgs; i++) {
          // 不再展示百分比，改为展示张数，释放 UI 性能
          wx.showLoading({ title: `上传图片 ${i + 1}/${totalImgs}`, mask: true });
          
          let filePath = this.data.tempImgPaths[i];
          const extension = filePath.split('.').pop() || 'jpg'; 
          const cloudPath = `follow_ups/${Date.now()}-img${i}.${extension}`; 
          
          // 尝试压缩
          try {
            const compressRes = await wx.compressImage({ src: filePath, quality: 20 });
            filePath = compressRes.tempFilePath; 
          } catch (compressErr) {
            console.warn('图片压缩失败', compressErr);
          }

          // 核心修复：直接使用原生 await，绝不混用 success/fail 回调
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            config: { env: 'cloud1-d1gdd35vq77ab5c2f' }
          });
          
          cloudFileIDs.push(uploadRes.fileID); 
        }
      }

      // 🌟 2. 跨国直飞版：直接上传录音到曼谷 COS 服务器
      if (totalAudios > 0) {
        wx.showLoading({ title: '连接曼谷服务器...', mask: true });
        
        // 1. 先向云函数申请上传通行证
        const authRes = await wx.cloud.callFunction({ name: 'getCosAuth' });
        const auth = authRes.result;

        wx.showLoading({ title: '极速直传录音...', mask: true });
        
        for (let j = 0; j < totalAudios; j++) {
          let fileObj = this.data.tempAudioFiles[j];
          let filePath = fileObj.path;
          let extension = fileObj.name.split('.').pop() || 'm4a';
          const cloudPath = `follow_ups_audio/${Date.now()}-audio${j}.${extension}`; 

          // 2. 绕过微信云环境，使用最底层的 wx.uploadFile 直连你的泰国存储桶
          await new Promise((resolve, reject) => {
            wx.uploadFile({
              url: 'https://sales-manual-1428539261.cos.ap-bangkok.myqcloud.com',
              name: 'file', // COS 接口强制要求叫 file
              filePath: filePath,
              formData: {
                'key': cloudPath,
                'policy': auth.policy,
                'q-sign-algorithm': auth.qSignAlgorithm,
                'q-ak': auth.qAk,
                'q-key-time': auth.qKeyTime,
                'q-signature': auth.signature
              },
              success: (res) => {
                // COS 成功状态码为 200 或 204
                if(res.statusCode === 200 || res.statusCode === 204){
                   resolve(res);
                } else {
                   reject(new Error('COS拒载: ' + res.data));
                }
              },
              fail: (err) => reject(err)
            });
          });
          
          // 3. 既然是直连网盘，咱们入库就直接存带有 https 的真实外网直链！
          const fullUrl = `https://sales-manual-1428539261.cos.ap-bangkok.myqcloud.com/${cloudPath}`;
          
          cloudAudioIDs.push({
            fileID: fullUrl, 
            name: fileObj.name
          }); 
        }
      }

      wx.showLoading({ title: '保存记录...', mask: true });

      // 3. 客户状态流转逻辑
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

      // 4. 更新数据库
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
          audio_files: cloudAudioIDs, 
          createTimeStr: this.formatDate(new Date()),
          createTime: db.serverDate()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 1000);

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

  onTypeChange(e) { this.setData({ selectedType: this.data.followTypes[e.detail.value] }); },
  onStatusChange(e) { 
    const selected = this.data.statusOptions[e.detail.value];
    this.setData({ selectedStatus: selected.value, selectedStatusLabel: selected.label }); 
  },
  onLostReasonInput(e) { this.setData({ lostReason: e.detail.value }); },
  onDateChange(e) { this.setData({ nextFollowUp: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); }
});