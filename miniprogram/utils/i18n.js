const zh = {
  // --- 销售主页 ---
  homeTitle: "销售工作台",
  homeTodo: "今日待办",
  homeAll: "我的客户",
  
  // --- 销售列表页 ---
  searchPlaceholder: "搜索姓名、电话、城市、需求...",
  emptyTodo: "太棒了，今天的待办都清空啦！",
  emptyData: "暂无客户数据",
  loading: "加载中...",
  loadMore: "上拉加载更多",
  noMore: "— 到底啦 —",
  btnFollowUp: "写跟进",
  lblPhone: "电话",
  lblCity: "城市",
  lblPayload: "需求",
  lblNextTime: "约定跟进",
  lblOverdue: "已逾期",
  lblFirstAssign: "首次分配",
  status: {
    'pending': '待处理',          // 保持不动
    'FollowUp': '再次跟进',        // 系统自动判断展示用，销售不可选
    'Quoted': '已发资料',
    'Considering': '还在考虑 (需写明原因)', // 🌟 新增
    'Busy': '不方便接电话',
    'No Answer': '未接电话 (需重拨)',
    'Demo Scheduled': '约定看机',
    'Closed Won': '✅ 已成交',
    'Closed Lost': '❌ 明确拒绝',
    'Invalid': '无效线索 (空号/错误)'
  },

  // --- 授权中转页 (index) ---
  idxTitle: "身份验证",
  idxChecking: "正在识别身份...",
  idxNoAuth: "尚未开通账号",
  idxInputPlaceholder: "请输入真实姓名",
  idxSubmitBtn: "提交申请加入",
  idxPending: "申请已提交，等待主管审批",
  idxRefreshBtn: "刷新审核状态",
  idxAuthLoading: "权限核验中...",

   // --- 客户详情/时间轴页 ---
   cdTitle: "客户详情",
   cdBaseInfo: "基本信息",
   cdName: "姓名",
   cdPhone: "电话",
   cdCity: "城市",
   cdPayload: "需求",
   cdModel: "意向机型",
   cdTimelineProj: "预计购买",
   cdTimeline: "跟进时间轴",
   cdEmptyTimeline: "暂无跟进记录，赶快去联系客户吧！",
   cdBtnFollowUp: "新增跟进",
 
   // --- 写跟进页 ---
   fuTitle: "记录跟进详情",
   fuType: "沟通方式",
   fuTypePlaceholder: "请选择沟通方式 ▾",
   fuResult: "跟进结果",
   fuResultPlaceholder: "请选择跟进结果 ▾",
   fuLostReason: "战败原因",
   fuLostPlaceholder: "例如：觉得价格贵、已买其他品牌",
   fuNextTime: "下次跟进",
   fuDatePlaceholder: "点击选择日期 ▾",
   fuNote: "沟通简述",
   fuNotePlaceholder: "简单记录一下沟通内容及客户痛点...",
   fuUpload: "上传截图",
   fuSubmit: "保存记录",
   fuSuccess: "保存成功",
   // --- 🎯 客户画像模块 (中文) ---
   profileTitle: '🎯 客户画像',
   profileDesc: '完善画像，提高精准推荐与成交率',
   profileClickToExpand: '点击展开查看或编辑详细画像...',
   profileDemand: '需求内容',
   profileDemandSub: '(需要什么样的产品)',
   profileMotivation: '购买动机',
   profileMotivationSub: '(为什么要使用这个设备)',
   profileUserType: '谁使用',
   profileUserTypeSub: '(公司 / 个人)',
   profileScenario: '使用场景',
   profileScenarioSub: '(在哪里收货、什么场景下使用)',
   profileTimeframe: '采购时间',
   profileTimeframeSub: '(准备什么时候买)',
   profileBudget: '预算区间',
   profileBudgetSub: '(经济承受能力)',
   unknown: '未知',
   edit: '编辑',
   collapse: '收起 ᐱ',
   expand: '展开 ᐯ',
   editProfileTitle: '编辑客户画像',
   cancel: '取消',
   saveProfile: '保存画像',
   // --- 管理后台 (Admin Home) ---
   adminTitle: "Agritech 管理后台",
   adminDistribute: "分配客户",
   adminDistributeDesc: "录入并下发线索",
   adminView: "查看客户",
   adminViewDesc: "监控销售跟进进度",
   adminMember: "团队成员管理",
   adminMemberDesc: "人员与权限设置",
   adminLog: "操作日志",
   adminLogDesc: "重分配与操作审计",
   adminStats: "销售数据统计",
   adminStatsDesc: "查看各销售处理数据统计"
};

const th = {
  // --- 销售主页 ---
  homeTitle: "หน้าหลักฝ่ายขาย",
  homeTodo: "งานวันนี้",
  homeAll: "ลูกค้าของฉัน",
  homeStudy: "คู่มือการศึกษา",
  
  // --- 销售列表页 ---
  searchPlaceholder: "ค้นหาชื่อ, เบอร์โทร, เมือง, ความต้องการ...",
  emptyTodo: "เยี่ยมมาก! งานวันนี้เสร็จหมดแล้ว",
  emptyData: "ไม่มีข้อมูลลูกค้า",
  loading: "กำลังโหลด...",
  loadMore: "เลื่อนขึ้นเพื่อโหลดเพิ่ม",
  noMore: "— หมดแล้ว —",
  btnFollowUp: "บันทึกติดตาม",
  lblPhone: "เบอร์โทร",
  lblCity: "เมือง",
  lblPayload: "ความต้องการ",
  lblNextTime: "นัดหมายครั้งต่อไป",
  lblOverdue: "เลยกำหนด",
  lblFirstAssign: "เวลาที่ได้รับ",
  status: {
    'pending': 'รอดำเนินการ',
    'FollowUp': 'ติดตามอีกครั้ง', 
    'Quoted': 'ส่งข้อมูลแล้ว',
    'Considering': 'กำลังตัดสินใจ (โปรดระบุเหตุผล)', // 🌟 新增
'Busy': 'ไม่สะดวกรับสาย',
    'No Answer': 'ไม่รับสาย (ต้องโทรซ้ำ)',
    'Demo Scheduled': 'นัดดูเครื่อง',
    'Closed Won': '✅ ปิดการขาย',
    'Closed Lost': '❌ ปฏิเสธอย่างชัดเจน',
    'Invalid': 'เบอร์ผิด/ไม่มีความต้องการ'
  },

  // --- 授权中转页 (index) ---
  idxTitle: "ยืนยันตัวตน",
  idxChecking: "กำลังตรวจสอบสิทธิ์...",
  idxNoAuth: "ยังไม่มีบัญชีใช้งาน",
  idxInputPlaceholder: "กรุณากรอกชื่อจริง",
  idxSubmitBtn: "ส่งคำขอเข้าใช้งาน",
  idxPending: "ส่งคำขอแล้ว รอการอนุมัติ",
  idxRefreshBtn: "คลิกเพื่อรีเฟรชสถานะ",
  idxAuthLoading: "กำลังตรวจสอบ...",

  // --- 客户详情/时间轴页 ---
  cdTitle: "รายละเอียดลูกค้า",
  cdBaseInfo: "ข้อมูลพื้นฐาน",
  cdName: "ชื่อ",
  cdPhone: "เบอร์โทร",
  cdCity: "เมือง",
  cdPayload: "ความต้องการ",
  cdModel: "รุ่นที่สนใจ",
  cdTimelineProj: "คาดว่าจะซื้อ",
  cdTimeline: "ไทม์ไลน์การติดตาม",
  cdEmptyTimeline: "ยังไม่มีบันทึกการติดตาม รีบติดต่อลูกค้าเลย!",
  cdBtnFollowUp: "เพิ่มการติดตาม",

  // --- 写跟进页 ---
  fuTitle: "บันทึกรายละเอียด",
  fuType: "ช่องทางการติดต่อ",
  fuTypePlaceholder: "กรุณาเลือกช่องทาง ▾",
  fuResult: "ผลการติดตาม",
  fuResultPlaceholder: "กรุณาเลือกผลการติดตาม ▾",
  fuLostReason: "สาเหตุที่ปฏิเสธ",
  fuLostPlaceholder: "เช่น: ราคาสูงไป, ซื้อแบรนด์อื่นแล้ว",
  fuNextTime: "ติดตามครั้งต่อไป",
  fuDatePlaceholder: "คลิกเลือกวันที่ ▾",
  fuNote: "สรุปการสนทนา",
  fuNotePlaceholder: "บันทึกสรุปการพูดคุยและปัญหาของลูกค้า...",
  fuUpload: "อัปโหลดภาพ",
  fuSubmit: "บันทึกข้อมูล",
  fuSuccess: "บันทึกสำเร็จ",
  // --- 🎯 客户画像模块 (泰文) ---
  profileTitle: '🎯 ข้อมูลลูกค้า (Profile)',
  profileDesc: 'กรอกข้อมูลให้ครบถ้วนเพื่อเพิ่มโอกาสในการขาย',
  profileClickToExpand: 'คลิกเพื่อดูหรือแก้ไขข้อมูลลูกค้า...',
  profileDemand: 'ความต้องการ',
  profileDemandSub: '(ต้องการสินค้าประเภทใด)',
  profileMotivation: 'แรงจูงใจในการซื้อ',
  profileMotivationSub: '(ทำไมถึงต้องการใช้เครื่องจักรนี้)',
  profileUserType: 'ผู้ใช้งาน',
  profileUserTypeSub: '(บริษัท / บุคคลทั่วไป)',
  profileScenario: 'สถานที่และลักษณะการใช้งาน',
  profileScenarioSub: '(รับสินค้าที่ไหน ใช้งานในสภาพแวดล้อมใด)',
  profileTimeframe: 'ระยะเวลาที่คาดว่าจะซื้อ',
  profileTimeframeSub: '(วางแผนจะซื้อเมื่อไหร่)',
  profileBudget: 'งบประมาณ',
  profileBudgetSub: '(ความสามารถในการจ่าย)',
  unknown: 'ไม่ระบุ',
  edit: 'แก้ไข',
  collapse: 'ย่อ ᐱ',
  expand: 'ขยาย ᐯ',
  editProfileTitle: 'แก้ไขข้อมูลลูกค้า',
  cancel: 'ยกเลิก',
  saveProfile: 'บันทึกข้อมูล',
  // --- 管理后台 (Admin Home) ---
  adminTitle: "ระบบจัดการ Agritech",
  adminDistribute: "มอบหมายลูกค้า",
  adminDistributeDesc: "เพิ่มข้อมูลและมอบหมายลูกค้า",
  adminView: "ดูข้อมูลลูกค้า",
  adminViewDesc: "ตรวจสอบความคืบหน้าของฝ่ายขาย",
  adminMember: "จัดการสมาชิกทีม",
  adminMemberDesc: "ตั้งค่าบุคลากรและสิทธิ์การใช้งาน",
  adminLog: "ประวัติการใช้งาน",
  adminLogDesc: "ตรวจสอบการมอบหมายใหม่และประวัติการทำงาน",
  adminStats: "สถิติข้อมูลการขาย",
  adminStatsDesc: "ดูสถิติการทำงานของฝ่ายขายแต่ละคน"
};

module.exports = {
  getLang: function() {
    return wx.getStorageSync('language') || 'th';
  },
  setLang: function(lang) {
    wx.setStorageSync('language', lang);
  },
  t: function() {
    const lang = this.getLang();
    return lang === 'zh' ? zh : th;
  }
};