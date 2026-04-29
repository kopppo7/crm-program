const db = wx.cloud.database();

Page({
  data: {
    pendingList: [], // 待审核
    activeList: [],  // 正式成员
  },

  onShow() {
    this.fetchMemberList();
  },

  // 1. 获取名单
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

  // 2. 审批通过逻辑
  approveMember(e) {
    const { id, name } = e.currentTarget.dataset;

    wx.showActionSheet({
      itemList: ['设为正式销售 (Sales)', '设为管理员 (Admin)'],
      success: (res) => {
        const role = res.tapIndex === 0 ? 'sales' : 'admin';
        
        wx.showLoading({ title: '授权中...' });
        db.collection('users').doc(id).update({
          data: {
            status: 'active', // 转正
            role: role
          }
        }).then((updateRes) => {
          wx.hideLoading();
          
          // 如果修改条数为 0，说明第一步的权限没改对！
          if (updateRes.stats && updateRes.stats.updated === 0) {
             wx.showModal({ title: '拦截', content: '数据库权限拦截了操作，请去修改 users 表权限', showCancel: false });
             return;
          }

          wx.showToast({ title: `${name} 已加入`, icon: 'success' });
          
          // 延迟 800 毫秒刷新，给数据库同步的时间，确保页面能马上看到他掉进正式名单
          setTimeout(() => {
            this.fetchMemberList(); 
          }, 800);
        }).catch(err => {
          wx.hideLoading();
          console.error(err);
        });
      }
    });
  },

  // 3. 移除或拒绝逻辑
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
            setTimeout(() => {
              this.fetchMemberList();
            }, 800);
          });
        }
      }
    });
  }
});
