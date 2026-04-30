# Step 3.4 — 收入阶段（Income Phase）

> **目标**：为收入计算提供全面的专项测试覆盖，验证所有收入来源在不同条件下的正确性。  
> **对应原文件**：`src/income.pm`  
> **实现位置**：`rules.js`（`_calc_income`、`_action_income`、`_begin_income` 在 Step 3.3 中已实现）  
> **测试**：`test/test-step-3.4.js`（60 项，全部通过）

---

## 概述

Step 3.4 本身不新增业务逻辑——核心函数 `_calc_income`、`_action_income`、`_begin_income` 已在 Step 3.3 中一并实现。本步骤的重点是对收入系统进行**专项、系统性测试**，覆盖原 Step 3.3 测试中相对较浅的角落：

- 每种建筑类型在每个数量级下的精确收入值（覆盖数组索引边界）
- 多来源叠加的精确数学运算
- `passed` 条件对奖励牌的精确控制
- 计分牌乘数（`floor(cult / req)`）及第6轮豁免

---

## 收入来源一览

`_calc_income(G, role)` 按以下顺序叠加四类收入，返回 `{ C, W, P, PW, … }` 增量对象：

| 编号 | 来源 | 触发条件 | 计算公式 |
|------|------|---------|---------|
| 1 | 建筑收入 | 始终 | `faction_def.buildings[B].income[res][count]` |
| 2 | 优待牌（FAV）收入 | 持有时始终 | `FAVOR_TILES[tile].income` 直接叠加 |
| 3 | 奖励牌（BON）收入 | **仅当 `fs.passed === true`** | `BONUS_TILES[tile].income` |
| 4 | 计分牌（SCORE）收入 | **第1–5轮**，且 `current_scoring_tile` 非 null | `Math.floor(fs[cult] / req) × income` |

---

## 建筑收入详解

每个建筑类型有一个收入数组，**以当前已建数量为索引**（0-based）。

### 示例（halflings）：

| 建筑类型 | 收入资源 | 数组 `[count=0..max]` |
|---------|---------|----------------------|
| D | W | `[1, 2, 3, 4, 5, 6, 7, 8, 8]` |
| TP | C | `[0, 2, 4, 6, 8]` |
| TP | PW | `[0, 1, 2, 4, 6]` |
| TE | P | `[0, 1, 2, 3]` |
| SH | PW | `[0, 2]` |
| SA | P | `[0, 1]` |

> **注意**：D 在 count=0 时仍有基础收入（W:1），这对应派系面板上的"初始收入轨道位置"。  
> 不同派系的数值不同（如 swarmlings D count=0 → W:2）。

---

## 奖励牌收入条件

奖励牌（BON）收入**仅在 `fs.passed === true` 时**计入，否则跳过。

**首轮特殊处理**：`_begin_income` 在首次调用时（`G.round === 0` 时）强制所有玩家 `passed = true`，确保刚选出的奖励牌收入在第1轮生效。

```
第1轮 income：passed 强制 true → BON 收入生效
后续轮次：passed 由上一轮是否 pass 产生
```

---

## 计分牌收入乘数

```javascript
// SCORE*.cult = 崇拜轨道名（FIRE / WATER / EARTH / AIR）
// SCORE*.req  = 每多少点产生一份收入
// SCORE*.income = 每份收入的资源量
const mul = Math.floor(fs[scoring.cult] / scoring.req)
// 示例：SCORE3 cult=WATER req=4 income={P:1}
//   WATER=8 → floor(8/4)=2 → P:2
```

**第6轮跳过**（`G.round > 5`）：第6轮只有最终计分，不执行计分牌收入。

---

## 函数签名（已在 Step 3.3 实现）

### `_calc_income(G, role)` → `object`

纯计算函数，不修改状态。返回所有来源叠加后的收入增量。

```
_calc_income(G, "Player 1")
// → { W: 3, C: 2, PW: 1 }
```

### `_begin_income(G)`

进入 income 阶段的过渡函数，每轮（含首轮）在 `pick_bonus` 完成后或 `_end_round` 中调用。

副作用：
1. 首轮（`round === 0`）：强制 `fs.passed = true` for all roles
2. `G.round++`
3. `G.current_scoring_tile = G.scoring_tiles[G.round - 1]`
4. 重置力量行动：`G.pool["ACT*"] = 1`
5. 清除 `fs.income_taken = false`
6. 构建队列并进入 `"income"` 阶段

### `_action_income(G, role)`

处理 income 动作（无参数）。

验证：

| 错误 | 触发条件 |
|------|---------|
| `Not in income phase.` | `G.state !== "income"` |
| `Income already taken this round.` | `fs.income_taken === true` |

副作用：
1. `_gain(fs, _calc_income(G, role))`
2. `fs.income_taken = true`
3. 弹出队列头，推进到下一玩家；若队列空则调用 `_begin_play(G)`

---

## 测试结构（60 项）

| 组别 | 内容 | 测试数 |
|------|------|--------|
| 1 | halflings D 轨道（count 0–8 边界）| 5 |
| 2 | halflings TP / TE / SH / SA 轨道 | 8 |
| 3 | 多建筑类型叠加 + 跨派系对比 | 3 |
| 4 | FAV 收入：单牌、有/无收入牌、多牌叠加 | 8 |
| 5 | BON 收入：passed=true/false 各种情况 | 6 |
| 6 | SCORE 收入：乘数、上限、第5/6轮、null tile | 9 |
| 7 | 四类来源全部叠加精确验证 | 1 |
| 8 | `_begin_income` 初始化行为 | 5 |
| 9 | `_action_income` 验证错误 | 3 |
| 10 | `_action_income` 资源实际增加 | 4 |
| 11 | `_action_income` 阶段转换 | 5 |
| 12 | JSON 序列化安全 | 2 |
| **合计** | | **60** |

---

## 关键边界案例

### 1. BON 收入在首轮总是生效

```javascript
// _begin_income 首次调用（round=0→1）时
if (G.round === 0) {
    for (const role of G.turn_order)
        G.factions[role].passed = true  // 强制 true
}
```

### 2. 计分牌收入第6轮豁免

```javascript
if (G.round <= 5 && G.current_scoring_tile) {
    // 计算 scoring 收入
}
// round=6 时此块被跳过
```

### 3. income 数组越界安全

```javascript
const delta = arr[count] || 0  // arr[count] undefined → 0
```
当 count 超出数组长度（理论上不应发生）时，安全返回 0。

### 4. 多 FAV 牌叠加

```javascript
for (const tile_name of fs.favor_tiles) {
    const tile = FAVOR_TILES[tile_name]
    if (tile && tile.income) {
        for (const [res, amt] of Object.entries(tile.income)) {
            if (amt) income[res] = (income[res] || 0) + amt
        }
    }
}
// FAV7(W:1,PW:1) + FAV8(PW:4) + FAV9(C:3)
// → C:3, W:1, PW:5
```

### 5. 计分牌乘数示例

| 计分牌 | cult | req | cult 值 | 乘数 | 收入 |
|--------|------|-----|---------|------|------|
| SCORE3 | WATER | 4 | 0 | 0 | — |
| SCORE3 | WATER | 4 | 4 | 1 | P:1 |
| SCORE3 | WATER | 4 | 8 | 2 | P:2 |
| SCORE3 | WATER | 4 | 10 | 2 | P:2 |
| SCORE4 | FIRE | 2 | 4 | 2 | W:2 |
| SCORE5 | FIRE | 4 | 4 | 1 | PW:4 |

---

## 验收标准

- [x] `test/test-step-3.4.js` 全部 60 项测试通过  
- [x] 不同建造等级返回正确收入（边界值覆盖）  
- [x] 优待牌叠加收入精确计算  
- [x] 奖励牌仅在 `passed=true` 时生效，`passed=false` 时不生效  
- [x] 计分牌乘数 `floor(cult/req)` 在各崇拜值下计算正确  
- [x] 第6轮计分牌收入被跳过，第5轮正常生效  
- [x] `_begin_income` 力量行动重置、income_taken 清除、首轮 passed 强制  
- [x] `_action_income` 验证错误、资源实际增加、阶段转换均正确  
- [x] JSON 序列化/反序列化安全
