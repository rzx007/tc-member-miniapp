# TC造型小程序｜当前开发配置

## 当前状态

- 已完成黑白视觉的小程序原生页面：欢迎、会员列表与统计、会员详情、新增会员、充值、消费。
- 项目 AppID 已切换为 `wx9f6091cc5772dcd4`。
- 新 AppID 的云环境 ID 尚未取得，`miniprogram/app.js` 中环境 ID 当前为空。
- `miniprogram/config.js` 当前为 `useMockAuth: true`、`useCloudData: false`，可继续使用本地模拟数据预览。
- 原云环境 `cloud1-5g2lsqgd13734a50` 和原 AppID 的数据未删除，但不能直接作为新 AppID 的员工身份来源。

## 查看访客欢迎页

把 `miniprogram/config.js` 的 `mockRole` 临时改成 `visitor`，重新编译。访客只看到欢迎页。

## 配置充值活动

充值档位在 `miniprogram/config.js` 的 `rechargePresets` 中维护，金额单位为分：

```js
{ id: "r1000-g200", amountFen: 100000, giftFen: 20000 }
```

以上表示实收 1000 元、赠送余额 200 元。建议配置 3 或 6 个档位，页面按每行 3 个排列。手工修改充值金额或赠送金额后，将自动取消已选活动档位。

## 配置正式 OpenID 白名单并启用云数据

1. 使用有 `wx9f6091cc5772dcd4` 开发权限的微信账号登录开发者工具，并为该 AppID 创建云环境。
2. 将新环境 ID 填入 `miniprogram/app.js`，部署 `tcService`。
3. 切换 `useMockAuth: false`，重新收集新 AppID 下的员工 OpenID，并部署白名单。
4. 初始化集合并设置为“所有用户不可读写”，验证后切换 `useCloudData: true`。

## 数据一致性

`tcService` 使用数据库事务处理手机号占位、会员编号递增、余额更新、交易流水和审计日志。交易请求 ID 直接作为流水文档 ID，网络重试不会重复入账。

正式云数据库不会写入模拟会员，需要从空库开始录入或另行导入旧数据。
