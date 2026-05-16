const db = wx.cloud.database();

Page({
  data: {
    pendingList: [], // 待审核
    activeList: [],  // 正式成员
  },

  onShow() {
    this.fetchMemberList();
  },

  fetchMemberList() {
    wx.showLoading({ title: '拉取名单...' });
    db.collection('users').orderBy('createTime', 'desc').get().then(res => {
      wx.hideLoading();
      const all = res.data;
      
      const pending = all.filter(u => u.status === 'pending');
      const active = all.filter(u => u.status !== 'pending');

      this.setData({
        pendingList: pending,
        activeList: active
      });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 🌟 核心修改：审批通过逻辑增加主管选项
  approveMember(e) {
    const { id, name } = e.currentTarget.dataset;

    wx.showActionSheet({
      itemList: ['设为正式销售 (Sales)', '设为业务主管 (Manager)', '设为管理员 (Admin)'],
      success: (res) => {
        let role = 'sales';
        if (res.tapIndex === 1) role = 'manager';
        if (res.tapIndex === 2) role = 'admin';
        
        wx.showLoading({ title: '授权中...' });
        db.collection('users').doc(id).update({
          data: {
            status: 'active', // 转正
            role: role
          }
        }).then((updateRes) => {
          wx.hideLoading();
          
          if (updateRes.stats && updateRes.stats.updated === 0) {
             wx.showModal({ title: '拦截', content: '数据库权限拦截了操作，请去修改 users 表权限', showCancel: false });
             return;
          }

          wx.showToast({ title: `${name} 已加入`, icon: 'success' });
          setTimeout(() => { this.fetchMemberList(); }, 800);
        }).catch(err => {
          wx.hideLoading();
          console.error(err);
        });
      }
    });
  },

  toggleMemberStatus(e) {
    const { id, name, currentstatus } = e.currentTarget.dataset;
    const newStatus = currentstatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'disabled' ? '禁用' : '恢复';

    wx.showModal({
      title: '操作确认',
      content: `确定要${actionText}员工 ${name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          db.collection('users').doc(id).update({
            data: { status: newStatus }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: `已${actionText}` });
            this.fetchMemberList(); 
          }).catch(err => {
            wx.hideLoading();
            console.error(err);
          });
        }
      }
    });
  },

  removeMember(e) {
    const { id, name, type } = e.currentTarget.dataset;
    const isPending = type === 'pending';

    wx.showModal({
      title: isPending ? '拒绝申请' : '移除员工',
      content: `确定要${isPending ? '拒绝' : '移除'} ${name} 吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在处理...' });
          db.collection('users').doc(id).remove().then((removeRes) => {
            wx.hideLoading();
            if (removeRes.stats && removeRes.stats.removed === 0) {
               wx.showToast({ title: '权限不足', icon: 'none' });
               return;
            }
            wx.showToast({ title: '操作成功', icon: 'success' });
            setTimeout(() => { this.fetchMemberList(); }, 800);
          });
        }
      }
    });
  }
});