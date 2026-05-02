const cloud = require('wx-server-sdk')
// 🌟 必须初始化，env 不要写死，用 DYNAMIC_TYPE_CA_ENV 最稳妥
cloud.init({ env: cloud.DYNAMIC_TYPE_CA_ENV })

exports.main = async (event, context) => {
  // 获取微信上下文
  const wxContext = cloud.getWXContext()

  // 🌟 核心：必须确保有返回值，且不能包含无法序列化的对象
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    env: wxContext.ENV
  }
}