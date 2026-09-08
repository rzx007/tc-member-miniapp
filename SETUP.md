# TC造型小程序｜当前开发配置

## 当前状态

- 已完成黑白视觉的小程序原生页面：欢迎、会员列表与统计、会员详情、新增会员、充值、消费。
- 项目 AppID：`wx9f6091cc5772dcd4`。
- 云环境 ID：`cloud1-d0gxb0g2c9ca8ba41`。
- `miniprogram/config.js` 当前为 `useMockAuth: false`、`useCloudData: true`：新 AppID 的真实鉴权与真实云数据均已启用。
- `tcService` 已部署，新 AppID 的首位超级管理员已配置，5 个集合已完成初始化。
- 原云环境 `cloud1-5g2lsqgd13734a50` 和原 AppID 的数据未删除。

## 查看访客欢迎页

把 `miniprogram/config.js` 的 `mockRole` 临时改成 `visitor`，重新编译。访客只看到欢迎页。

## 配置充值活动

充值档位在 `miniprogram/config.js` 的 `rechargePresets` 中维护，金额单位为分：

```js
{ id: "r1000-g200", amountFen: 100000, giftFen: 20000 }
```

以上表示实收 1000 元、赠送余额 200 元。建议配置 3 或 6 个档位，页面按每行 3 个排列。手工修改充值金额或赠送金额后，将自动取消已选活动档位。

## 配置正式 OpenID 白名单并启用云数据

1. 新环境的 5 个集合已全部设为“所有用户不可读写”，客户端直接读取验证已被拒绝。
2. 其他员工需要在新 AppID 下重新收集 OpenID，再追加到 `tcService/config.js` 并部署。

## 数据一致性

`tcService` 使用数据库事务处理手机号占位、会员编号递增、余额更新、交易流水和审计日志。交易请求 ID 直接作为流水文档 ID，网络重试不会重复入账。

正式云数据库不会写入模拟会员，需要从空库开始录入或另行导入旧数据。
