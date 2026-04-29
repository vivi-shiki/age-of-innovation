# Step 0.1 开发文档 — 项目初始化与 RTT 注册

> **阶段**：0（基础骨架）  
> **步骤**：0.1  
> **状态**：✅ 完成  
> **测试**：26 / 26 通过

---

## 目标

创建模组最小完整结构，使 RTT 服务器可识别、加载并显示 Age of Innovation 游戏条目，同时通过验收测试。

---

## 交付文件

| 文件 | 说明 |
|------|------|
| `title.sql` | 向 RTT `titles` 表注册模组 |
| `about.html` | 游戏介绍落地页（服务器启动时读取） |
| `create.html` | 建局选项表单（玩家数/地图/扩展） |
| `rules.js` | RTT 规则引擎骨架（完整 API 契约实现） |
| `play.html` | 客户端页面（引用 RTT client.js 和 play.js） |
| `play.js` | 客户端渲染桩（`on_init` / `on_update`） |
| `play.css` | 游戏基础样式（布局、颜色变量） |
| `test/test-step-0.1.js` | Step 0.1 全部验收测试 |

---

## 关键设计决策

### RTT API 契约

`rules.js` 完整实现了 RTT 要求的四个导出：

```javascript
exports.scenarios = ["Standard"]
exports.roles    = function(scenario, options) { … }
exports.setup    = function(seed, scenario, options) { … }
exports.view     = function(state, role) { … }
exports.action   = function(state, role, action, arg) { … }
```

`roles` 设计为**函数**而非数组，因为 Age of Innovation 是 2–5 人游戏，玩家数量由 `create.html` 表单动态传入。RTT 服务器同时支持函数和数组形式。

### 游戏状态结构（G）

`setup()` 返回的状态对象包含所有 RTT 必需字段：

| 字段 | 说明 |
|------|------|
| `seed` | 随机种子（确保可重放） |
| `active` | 当前活跃玩家角色名（字符串） |
| `result` | 游戏结果（`null` 表示进行中） |
| `log` | 游戏日志数组 |
| `undo` | 撤销栈 |

此外预留了游戏进度字段：`state`、`round`、`turn`、`turn_order`、`factions`、`map`、`cult`、`scoring_tiles` 等，供后续阶段填充。

### 视图隔离

`view()` 严格遵守 RTT 协议：
- 活跃玩家的视图包含 `actions` 对象
- 非活跃玩家的视图**不包含** `actions`
- `view()` 不修改游戏状态（只读）

### 错误策略

`action()` 在以下情况抛出明确错误：
- 非活跃玩家调用时：`"It is not your turn."`
- 未知动作名时：`"Unknown action: ${action}"`

---

## create.html 表单字段

| name | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `players` | `<select>` | `4` | 玩家数量（2-5） |
| `map` | `<select>` | `standard` | 地图选择 |
| `fire_ice` | `checkbox` | unchecked | Fire & Ice 扩展派系 |

---

## 部署步骤

```bash
# 1. 创建符号链接（Windows，需管理员权限）
mklink /J server\public\age-of-innovation path\to\age-of-innovation

# 2. 向数据库注册模组
sqlite3 server/db < age-of-innovation/title.sql
```

title.sql 内容：
```sql
insert or ignore into titles (title_id, title_name, bgg)
values ('age-of-innovation', 'Age of Innovation', 363433);
```

---

## 测试说明

测试文件：`test/test-step-0.1.js`

```bash
node test/test-step-0.1.js
```

### 测试覆盖范围

| 类别 | 测试数 | 说明 |
|------|--------|------|
| API 导出形态 | 5 | scenarios/roles/setup/view/action 均存在且类型正确 |
| `roles()` 行为 | 4 | 人数范围、默认值、输入边界 |
| `setup()` 返回值 | 8 | RTT 必需字段、确定性、JSON 序列化 |
| `view()` 行为 | 6 | log/prompt 存在、actions 隔离、状态不变性 |
| `action()` 错误处理 | 2 | 非活跃玩家、未知动作 |
| **合计** | **26** | 全部通过 ✅ |

### 关键断言

```javascript
// setup() 是确定性的
assert.deepStrictEqual(setup(SEED, …), setup(SEED, …))

// view() 不修改状态
const before = JSON.stringify(G)
view(G, ACTIVE)
assert.strictEqual(JSON.stringify(G), before)

// 非活跃玩家无 actions
assert.strictEqual(view(G, PASSIVE).actions, undefined)
```

---

## 验收标准（已满足）

- [x] RTT 服务器启动时不报错（`require()` 不抛异常）
- [x] 可在大厅看到游戏条目（title.sql 注册正确）
- [x] 可点击"创建游戏"（create.html 格式正确）
- [x] `setup()` 返回包含所有 RTT 必需字段的状态
- [x] `view()` 为活跃玩家返回 `actions`，为其他人不返回
- [x] `action()` 对非法调用抛出错误
- [x] 26 项测试全部通过

---

## 已知限制（留待后续步骤）

- `setup()` 尚未初始化游戏地图和牌组（`G.map = null`）
- `action()` 仅有错误处理，无实际动作实现
- `play.js` 的 `on_update()` 只渲染占位文字，无实际棋盘
- 派系选择逻辑待 Step 1.2（派系数据）完成后实现
