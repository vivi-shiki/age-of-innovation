# Step 3.2 — 地图操作与初始居所放置

> **目标**：实现初始居所放置动作、征收收入计算、城镇检测函数，完成建局阶段的关闭逻辑。  
> **对应原文件**：`src/commands.pm`（build）、`src/towns.pm`、`src/acting.pm`  
> **交付**：`rules.js`（新增 4 个内部函数 + 动作分发 + `exports._test` 扩展）  
> **测试**：`test/test-step-3.2.js`（67 项，全部通过）

---

## 新增导入

在 Step 3.1 的基础上，新增以下导入：

```javascript
// data/map.js  — 邻接关系
const { MAP_HEXES, ADJACENCY } = require("./data/map.js")

// data/constants.js  — 建筑强度与城镇阈值
const {
    BUILDING_STRENGTH,     // { D:1, TP:2, TE:2, SH:3, SA:3 }
    DEFAULT_TOWN_SIZE,     // 7
    DEFAULT_TOWN_COUNT,    // 4
} = require("./data/constants.js")
```

---

## 函数一览

### `_begin_initial_bonus(G)`

将游戏从 `"initial-dwellings"` 阶段过渡到 `"initial-bonus"` 阶段。

- 按**逆序回合顺序**建立行动队列（最后一个完成选人的玩家先拿）。
- 设置 `G.active` 为队列头部。

| 玩家数 | bonus 选牌顺序 |
|--------|---------------|
| 2      | P2 → P1       |
| 3      | P3 → P2 → P1  |
| 4      | P4 → P3 → P2 → P1 |
| …      | …             |

---

### `_action_place_dwelling(G, role, hex)`

`"initial-dwellings"` 阶段的动作处理函数，对应 `exports.action` 中的 `place_dwelling` 分支。

**验证（任意一项失败即抛出）：**

| 错误消息 | 触发条件 |
|---------|---------|
| `Not in dwelling placement phase.` | `G.state !== "initial-dwellings"` |
| `Invalid hex.` | hex 不是非空字符串、不存在于 G.map、或是河流格 |
| `Hex '…' already has a building.` | 目标格已有建筑 |
| `Hex '…' is not your home terrain.` | 格子颜色不匹配派系本色（`fs.color`）|

**副作用（验证通过后）：**

1. `G.map[hex].building = "D"`，`G.map[hex].faction = role`
2. `fs.buildings.D++`，`fs.locations.push(hex)`
3. 弹出 `G.action_queue[0]`（已处理的队列项）
4. 若队列非空：`G.active = queue[0].role`
5. 若队列为空：调用 `_begin_initial_bonus(G)` 过渡阶段

**注意**：初始放置阶段**不调用** `_compute_leech` 和 `_detect_towns`，游戏规则规定建局期间无征收和城镇判定。

---

### `_compute_leech(G, active_role, hex)`

当某玩家在 `hex` 建造/升级后，计算相邻格子的征收收入并压入行动队列。

**逻辑：**

```
for each adj in ADJACENCY[hex]:
    cell = G.map[adj]
    if cell.building exists AND cell.faction ≠ active_role:
        push { role: cell.faction, type: "leech",
               amount: BUILDING_STRENGTH[cell.building],
               from_role: active_role }
```

**征收量**：等于相邻建筑的强度（D=1, TP=2, TE=2, SH=3, SA=3）。

**调用时机**：仅在正式游戏的 `play` 阶段调用，**不在**初始建局阶段调用。

---

### `_detect_towns(G, role, hex)`

在 `hex` 处建造/升级后，检测是否因此形成了新城镇（BFS 连通性检测）。

**算法：**

1. 从 `hex` 出发，BFS 遍历所有与其属于同一派系且直接相邻的建筑，构成"连通组"（cluster）。
2. 统计连通组的总建筑数量（count）和总建筑强度（total_strength）。
3. 计算本派系的城镇强度阈值：`size_req = DEFAULT_TOWN_SIZE + (fs.TOWN_SIZE || 0)`  
   （FAV5 好感牌将 `fs.TOWN_SIZE` 设为 -1，使阈值从 7 降至 6）。
4. **城镇形成条件**（同时满足）：
   - `count ≥ DEFAULT_TOWN_COUNT`（≥ 4 座建筑）
   - `total_strength ≥ size_req`（强度达标）
   - 连通组内**没有任何**已标记为城镇的格子（防止重复判定）

**城镇形成时的副作用：**

1. 从 `G.pool` 中取第一张可用的城镇牌（`pool[name] > 0`），`pool[name]--`
2. 将牌名压入 `fs.town_tiles`
3. 连通组所有格子标记 `G.map[h].town = true`
4. 连通组所有格子写入 `fs.towns`
5. 调用 `_gain(fs, TOWN_TILES[tile_name].gain)` 发放即时奖励

**边界情况**：若城镇牌池已耗尽（极端情况），静默跳过，不形成城镇。

---

## 动作分发

`exports.action` 新增分支：

```javascript
case "place_dwelling":
    return _action_place_dwelling(state, role, arg)
```

---

## `exports._test` 扩展

Step 3.2 新增 3 个测试导出：

```javascript
exports._test = {
    // …原有 Step 3.1 函数…
    _action_place_dwelling,   // 可绕过 action() 的 active 校验直接测试
    _compute_leech,
    _detect_towns,
}
```

---

## G 状态变化摘要

| 时机 | G 字段 | 变化 |
|------|--------|------|
| 初始居所放置 | `map[hex].building` | `null → "D"` |
| 初始居所放置 | `map[hex].faction` | `null → role` |
| 初始居所放置 | `factions[role].buildings.D` | `+1` |
| 初始居所放置 | `factions[role].locations` | `push(hex)` |
| 初始居所放置 | `action_queue` | `shift()` |
| 队列耗尽 | `state` | `"initial-dwellings" → "initial-bonus"` |
| 队列耗尽 | `action_queue` | 重建为逆序 `pick-bonus` 队列 |
| 征收计算 | `action_queue` | `push({ type:"leech", … })` |
| 城镇形成 | `map[hex].town` | `false → true`（整个连通组）|
| 城镇形成 | `factions[role].town_tiles` | `push(tile_name)` |
| 城镇形成 | `factions[role].towns` | `push(…hex keys…)` |
| 城镇形成 | `pool[tile_name]` | `-1` |
| 城镇形成 | `factions[role].VP/KEY/C/…` | 按城镇牌 gain 发放 |

---

## 地图常量参考

测试文件使用的格子（均经 `data/map.js` 验证）：

| 格键 | 颜色 | 直接相邻格 |
|------|------|-----------|
| A1 | brown | A2, B1 |
| A5 | yellow | A6, A4, B2, B3 |
| A7 | brown | A8, A6, r2, r3 |
| B1 | yellow | r0, A1, A2, r6, r7 |
| E1 | black | E2, D1, F1 |
| E2 | brown | E3, E1, D1, D2, F1, F2 |
| E3 | red | E4, E2, D2, D3, F2, r20 |
| E4 | blue | E5, E3, D3, r14, r20, r21 |

> E1–E2–E3–E4 构成连续相邻的横向四格链，是城镇检测测试的主要场景。

---

## 测试覆盖（67 项，全部通过）

| 测试组 | 项数 | 覆盖内容 |
|--------|------|---------|
| 1: `place_dwelling` 验证错误 | 9 | 阶段错误、非本人回合、非字符串 hex、空字符串、未知 hex、河流格、已被占用、颜色不符、报错信息含 hex 名 |
| 2: 放置后地图与派系状态 | 7 | building/faction/town 字段、buildings.D 计数、locations 数组、其他格未影响、对手状态不变 |
| 3: 行动队列推进 | 8 | 初始队列长度4、队首为 P1、active 正确、P1 放置后队列长度3、active 变 P2、蛇形 P2 第二次后 active 变 P1 |
| 4: 阶段过渡 | 7 | state="initial-bonus"、队列非空、队列类型 pick-bonus、逆序顺序、active=P2、4座 D 在地图上、建筑计数 |
| 5: `_compute_leech` | 9 | 无相邻建筑、同派系不计入、D/TP/TE/SH/SA 各强度、两座相邻产生两条、不同派系各自入队 |
| 6: `_detect_towns` 不触发 | 4 | 单 D 不足、4D 强度不足7、三强建筑数少于4、已是城镇不重复判定 |
| 7: `_detect_towns` 触发 | 9 | 牌加入 town_tiles、牌名有效、池计数减1、四格标记 town、towns 数组正确、VP 奖励、KEY 奖励、断开建筑不计入聚类、FAV5 阈值降至6 |
| 8: 完整2人初始居所序列 | 11 | 状态/队列初始值、四次放置结果、状态过渡、locations 数组、占用格再放置报错 |
| 9: JSON 安全 | 3 | 4次放置后可序列化、克隆结果相同、克隆分叉独立 |

---

## 与原 Perl 的主要差异

1. **`_compute_leech` 不直接触发征收结算**：Perl 会立即询问玩家；JS 版本将征收决策压入 `action_queue`，由后续阶段（Step 3.3）处理。

2. **城镇牌顺序**：Perl 中玩家可选择城镇牌，JS 版本当前实现为自动取池中第一张可用牌（保持实现简单，可在 Step 3.6 扩展为玩家选择）。

3. **初始放置不含征收/城镇**：严格遵循游戏规则，`_action_place_dwelling` 不调用 `_compute_leech` 和 `_detect_towns`，与 Perl 的 `command_build` 区别处理初始建局和正式建造两种情形的逻辑保持一致。

4. **FAV5 效果存储于 `fs.TOWN_SIZE`**：通过 `_gain(fs, { TOWN_SIZE: -1 })` 写入，`_detect_towns` 读取时叠加到默认阈值，无需额外特判逻辑。
