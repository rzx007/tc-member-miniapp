# 云数据库索引

在云开发控制台为以下集合建立索引：

| 集合 | 字段 | 排序 |
| --- | --- | --- |
| `members` | `status`, `createdAt` | 升序、降序 |
| `transactions` | `memberId`, `createdAt` | 升序、降序 |
| `transactions` | `type`, `createdAt` | 升序、升序 |

`member_phones` 使用手机号作为文档 `_id`，无需额外唯一索引；`transactions` 使用请求 ID 作为文档 `_id`，用于防止重复入账。
