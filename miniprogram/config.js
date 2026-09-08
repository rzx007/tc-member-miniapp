module.exports = {
  // 云环境和员工 OpenID 配置完成前保持 true，方便在开发者工具里体验全部流程。
  useMockAuth: true,
  mockRole: "employee",

  // 完成 tcService 部署、OpenID 白名单和数据库初始化后改为 true。
  useCloudData: false,

  // 充值活动配置：amountFen 为实收金额，giftFen 为赠送余额，单位均为分。
  // 调整活动时只修改这里；建议保留 3 或 6 个档位，页面会按每行 3 个排列。
  rechargePresets: [
    { id: "r300", amountFen: 30000, giftFen: 0 },
    { id: "r500", amountFen: 50000, giftFen: 0 },
    { id: "r1000-g200", amountFen: 100000, giftFen: 20000 },
  ],
};
