App({
  onLaunch: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d1gdd35vq77ab5c2f', // 确保这里没填错
        traceUser: true,
      });
    }
  }
});
