const cloud = require('wx-server-sdk');
const crypto = require('crypto'); 

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  // ⚠️ 请把这里替换为你刚刚在腾讯云后台拿到的真实密钥！
const SecretId = process.env.TENCENT_SECRET_ID;
const SecretKey = process.env.TENCENT_SECRET_KEY;
  
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 900; // 这个签名 15 分钟内有效，过期作废，极度安全
  const keyTime = `${now};${exp}`;
  
  // 按照腾讯云底层协议计算 HMAC 签名
  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest('hex');
  const policyObj = {
    expiration: new Date(exp * 1000).toISOString(),
    conditions: [
      { 'q-sign-algorithm': 'sha1' },
      { 'q-ak': secretId },
      { 'q-sign-time': keyTime }
    ]
  };
  
  const policyStr = JSON.stringify(policyObj);
  const policyBase64 = Buffer.from(policyStr).toString('base64');
  
  const stringToSign = crypto.createHash('sha1').update(policyStr).digest('hex');
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');
  
  // 将计算好的签名和凭证打包发给前端小程序
  return {
    policy: policyBase64,
    signature: signature,
    qSignAlgorithm: 'sha1',
    qAk: secretId,
    qKeyTime: keyTime
  };
}