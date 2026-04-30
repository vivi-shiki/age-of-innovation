# Step 3.3 — 游戏状态机（行动队列与阶段）

> **目标**：实现核心行动调度、阶段转换与玩家回合管理，覆盖从 `initial-bonus` 到 `finish` 的完整游戏流程。  
> **对应原文件**：`src/acting.pm`、`src/commands.pm`（pass/leech）、`src/income.pm`  
> **交付**：`rules.js`（新增 11 个内部函数 + 视图/动作/提示更新 + `exports._test` 扩展）  
> **测试**：`test/test-step-3.3.js`（82 项，全部通过）

---

## 新增导入

本步骤无新增导入；`SCORING_TILES`、`BONUS_TILES`、`FAVOR_TILES`、`POWER_ACTIONS` 均已在 Step 3.2 中导入。

---

## 新增状态字段

`G.turn_player`（null | string）— 记录当前主行动（full-turn）玩家，用于在 leech 决策打断期间区分真正的回合持有者。

`G.result` — setup() 中初始化为 `null`；`_begin_finish` 中设为按 VP 降序排列的角色名数组。

---

## 函数一览

### `_action_pick_bonus(G, role, tile_name)`

**阶段**：`"initial-bonus"`  
**参数**：奖励牌名称字符串（如 `"BON3"`）

**验证（任意一项失败即抛出）：**

| 错误消息 | 触发条件 |
|---------|---------|
| `Not in bonus tile selection phase.` | `G.state !== "initial-bonus"` |
| `Bonus tile name must be a non-empty string.` | tile_name 不是非空字符串 |
| `Unknown bonus tile: '…'.` | tile_name 不存在于 `BONUS_TILES` |
| `Bonus tile '…' is not available.` | `G.pool[tile_name] < 1` |

**副作用（验证通过后）：**

1. `fs.bonus_tile = tile_name`，`G.pool[tile_name]--`
2. 弹出 `G.action_queue[0]`
3. 若队列非空：`G.active = queue[0].role`
4. 若队列为空：调用 `_begin_income(G)`

---

### `_begin_income(G)`

将游戏过渡到 `"income"` 阶段。

**关键行为：**

- **首次调用（`G.round === 0` → 1）**：强制所有玩家 `fs.passed = true`，使刚选出的奖励牌收入立即生效。此行为与 Perl 源码中 `if ($game{round} == 0) { $faction->{passed} = 1 }` 等价。
- `G.round++`
- 更新 `G.current_scoring_tile = G.scoring_tiles[G.round - 1]`
- 重置所有力量行动为可用（`G.pool[ACT*] = 1`）
- 清除所有玩家 `fs.income_taken = false`
- 构建收入队列：按 `G.turn_order` 为每位玩家添加 `{role, type: "income"}` 条目
- `G.state = "income"`，`G.active = queue[0].role`

---

### `_calc_income(G, role)` → `object`

计算单个派系的完整收入，返回资源增量对象（如 `{ C: 3, W: 2, PW: 1 }`）。

**收入来源（按顺序叠加）：**

| 来源 | 条件 | 计算公式 |
|------|------|---------|
| 建筑收入 | 始终 | `FACTIONS[name].buildings[B].income[res][fs.buildings[B]]` |
| 优待牌收入 | 持有 FAV 牌时始终生效 | `FAVOR_TILES[tile].income` |
| 奖励牌收入 | **仅当 `fs.passed === true`** | `BONUS_TILES[tile].income` |
| 轮次计分牌收入 | 第 1–5 轮（第 6 轮不生效） | `floor(fs[cult] / req) × income` |

> **轮次 1 特殊处理**：`_begin_income` 在首轮时将所有玩家标记为 `passed=true`，确保刚选出的奖励牌收入被正确计算。

---

### `_action_income(G, role)`

**阶段**：`"income"`  
**参数**：无

**验证：**

| 错误消息 | 触发条件 |
|---------|---------|
| `Not in income phase.` | `G.state !== "income"` |
| `Income already taken this round.` | `fs.income_taken === true` |

**副作用：**

1. `_gain(fs, _calc_income(G, role))` — 应用全部收入
2. `fs.income_taken = true`
3. 弹出队列；若队列为空则调用 `_begin_play(G)`

---

### `_begin_play(G)`

将游戏过渡到 `"play"` 阶段。

**操作：**

1. `G.state = "play"`，`G.action_queue = []`
2. 重置所有玩家标志：`fs.passed = false`，`fs.income_taken = false`，`fs.actions_used = []`
3. `G.turn_player = G.turn_order[0]`，`G.active = G.turn_player`

---

### `_advance_play(G)`

在 play 阶段推进活跃玩家，按优先级处理：

1. **优先**：若 `G.action_queue` 非空（待处理 leech 决策），则 `G.active = queue[0].role`
2. 在 `G.turn_order` 中从 `G.turn_player` 位置开始**循环**查找下一个未 pass 的玩家
3. 若所有玩家均已 pass，调用 `_end_round(G)`

> `G.turn_player` 的作用：当 leech 决策打断主回合时，`G.active` 切换到需要做决策的玩家，但 `G.turn_player` 保存原始主行动玩家的位置，确保 leech 解决后能正确找到下一个主行动玩家。

---

### `_calc_pass_vp(G, role)` → `number`

计算玩家 pass 时从奖励牌和优待牌获得的 VP。

**计算规则：**

- 遍历 `fs.bonus_tile` 和 `fs.favor_tiles` 中的 `pass_vp` 字段
- 键名为 `"ship"` 时，使用 `fs.ship_level` 作为下标；其余键名使用 `fs.buildings[type]`
- VP 值 = `pass_vp[type][level]`，多来源叠加

**示例：**
- BON9（`pass_vp: { D: [0,1,2,3,...] }`）持有者有 3 个居所 → 3 VP
- FAV12（`pass_vp: { TP: [0,2,3,3,4] }`）+ 2 个交易站 → 3 VP

---

### `_action_leech(G, role, amount)`

**阶段**：`"play"`（action_queue 头为 leech 条目时）  
**参数**：`amount` — 接受的权力数量（0 = 拒绝）

**验证：**

| 错误消息 | 触发条件 |
|---------|---------|
| `Not in play phase.` | `G.state !== "play"` |
| `No pending leech decision.` | `action_queue[0]` 不是 leech 条目 |

**权力接受逻辑（参考 Perl `command_leech`）：**

1. `amount` 被 coerce 为非负整数（字符串 `"decline"` 等价于 0）
2. 实际接受量 `actual = min(amount, entry.amount, fs.VP + 1)` — VP 上限：付出 actual-1 VP，需 VP ≥ actual-1
3. `gained = _gain_power(fs, actual)` — 实际获得权力（可能因碗满而减少）
4. `vp_cost = max(0, gained - 1)`；`fs.VP -= vp_cost`
5. 移除队列条目，调用 `_advance_play(G)`

---

### `_action_pass(G, role, tile_name)`

**阶段**：`"play"`  
**参数**：第 1–5 轮必须提供新奖励牌名；第 6 轮可省略

**验证：**

| 错误消息 | 触发条件 |
|---------|---------|
| `Not in play phase.` | `G.state !== "play"` |
| `Must specify a bonus tile when passing.` | round < 6 且 tile_name 为空/非字符串 |
| `Unknown bonus tile: '…'.` | tile_name 不存在于 BONUS_TILES |
| `Bonus tile '…' is not available.` | `G.pool[tile_name] < 1` |

**副作用顺序：**

1. **award pass VP**：`VP += _calc_pass_vp(G, role)`
2. **归还旧奖励牌**：`G.pool[fs.bonus_tile]++`，`fs.bonus_tile = null`
3. **取新奖励牌**（仅 round < 6）：`G.pool[tile_name]--`，`fs.bonus_tile = tile_name`
4. **标记已 pass**：`fs.passed = true`，`G.next_turn_order.push(role)`
5. **推进回合**：`G.turn_player = role`，调用 `_advance_play(G)`

> **第 6 轮**：不取新奖励牌，旧牌仍需归还资源池（状态整洁性），无需指定 tile_name。

---

### `_end_round(G)`

轮次结束处理：

- 若 `G.round >= 6`：调用 `_begin_finish(G)` → 游戏结束
- 否则：`G.turn_order = G.next_turn_order.slice()`（pass 顺序成为下轮行动顺序），`G.next_turn_order = []`，调用 `_begin_income(G)`

> **pass 顺序决定下轮主动玩家**：第一个 pass 的玩家在 `G.next_turn_order` 中排第一，成为下轮第一位行动的玩家。

---

### `_begin_finish(G)`

游戏结束：

1. `G.state = "finish"`，`G.active = null`
2. `G.result = G.turn_order` 按 VP 降序排列的副本

---

## 视图与动作更新

### `exports.view`

新增字段 `result: state.result`，正常游戏中为 `null`，游戏结束后为角色名数组。

### `_actions_for` 新增分支

| 阶段 | 返回内容 |
|------|---------|
| `"initial-bonus"` | `{ pick_bonus: [可用牌名数组] }` |
| `"income"` | `{ income: 1 }` |
| `"play"`（leech 待决） | `{ leech: entry.amount }` |
| `"play"`（主行动）| `{ pass: [可用牌名] }`（第 6 轮为 `null`） |

### `_prompt_for` 新增分支

| 阶段 | 提示文字 |
|------|---------|
| `"initial-bonus"` | `"Choose your starting bonus tile."` |
| `"income"` | `"Take your income."` |
| `"play"`（leech 待决）| 含 leech 数量和 VP 代价的说明 |
| `"play"`（主行动）| `"Take your action."` |
| `"finish"` | `"The game is over."` |

---

## 阶段转换图

```
select-factions
     ↓  (所有玩家选派系)
initial-dwellings
     ↓  (蛇形放置完毕)
initial-bonus
     ↓  (逆序选奖励牌，全部选完)
income (round 1)               ← _begin_income 触发，force passed=true
     ↓  (所有玩家取收入)
play (round 1)                 ← _begin_play 触发，passed 重置为 false
     ↓  (所有玩家 pass)         leech 决策插入 action_queue，_advance_play 调度
income (round 2)               ← _end_round → _begin_income
     ↓  ...（第 2–5 轮循环）
income (round 6)
     ↓  (所有玩家取收入)
play (round 6)
     ↓  (所有玩家 pass，无需新奖励牌)
finish                         ← _end_round → _begin_finish
```

---

## 测试说明

测试文件：`test/test-step-3.3.js`（82 项测试，全部通过）

| 组 | 覆盖内容 | 测试数 |
|----|---------|-------|
| 1 | pick_bonus 验证错误 | 6 |
| 2 | pick_bonus 正常路径 | 7 |
| 3 | _calc_income 建筑收入 | 4 |
| 4 | _calc_income 优待/奖励/计分牌收入 | 6 |
| 5 | income 动作验证 | 3 |
| 6 | income 动作正常路径 | 5 |
| 7 | income → play 过渡 | 5 |
| 8 | leech 动作 | 9 |
| 9 | pass 动作验证 | 6 |
| 10 | pass VP、牌交换、顺序 | 7 |
| 11 | _calc_pass_vp | 4 |
| 12 | 轮次转换 | 6 |
| 13 | _begin_finish & 结束状态 | 7 |
| 14 | JSON 安全性 | 2 |
| 15 | 端到端迷你游戏 | 5 |

---

## 与 Perl 源码对照

| JS 函数 | Perl 对应 |
|---------|----------|
| `_begin_income` | `acting.pm::in_income()` + round-0 特殊处理 |
| `_calc_income` | `income.pm::faction_income()` |
| `_action_income` | `income.pm::take_income_for_faction()` |
| `_begin_play` | `acting.pm::in_income_terrain_unlock()` → `command_start()` |
| `_advance_play` | `acting.pm::in_play()` + `maybe_advance_to_next_player()` |
| `_action_leech` | `commands.pm::command_leech()` |
| `_action_pass` | `commands.pm::command_pass()` |
| `_calc_pass_vp` | `scoring.pm::do_pass_vp()` |
| `_end_round` | `acting.pm::in_play()` 末段 |
| `_begin_finish` | `commands.pm::command_finish()` |

---

## 注意事项

1. **SPADE 收入**：部分计分牌（SCORE2, SCORE6, SCORE8）的收入为 `{ SPADE: 1 }`，当前实现通过 `_gain` 将 SPADE 累积到 `fs.SPADE`，但不强制玩家在收入阶段使用它（此逻辑在 Step 3.4 实现）。

2. **CULT_P 计分牌**：SCORE9 使用 `cult: 'CULT_P'`，收入阶段 `fs.CULT_P` 为 0，计算结果自然为 0，无需特殊处理。

3. **第 1 轮奖励牌收入**：通过强制 `passed = true` 而非特判轮次来处理。这使逻辑统一：无论哪一轮，`passed === true` 总意味着当前持有的 BON 牌收入生效。

4. **第 6 轮免除牌交换**：pass 时不取新奖励牌，旧牌仍归还资源池以保持状态整洁。
