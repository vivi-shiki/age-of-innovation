# Step 1.2 — 派系数据移植

> **目标**：将 terra-mystica 20 个派系从 Perl 结构体移植为 JavaScript 对象。  
> **来源**：`terra-mystica/src/Game/Factions/*.pm`（每个派系一个文件）  
> **交付**：`age-of-innovation/data/factions.js`  
> **测试**：`test/test-step-1.2.js`（631 项，全部通过）

---

## 数据结构

### 顶层字段

每个派系对象包含以下字段：

```javascript
{
    display: String,          // 显示名称（英文，与原游戏一致）
    color: String | null,     // 家乡地形颜色；null = 开局时由玩家选择
    faction_board_id: Number | null,  // terra-mystica 内部 ID（Fire&Ice 派系为 null）
    expansion: String,        // 仅 Fire&Ice 派系存在，值为 "fire_ice"
    pick_color: Boolean,      // true = 开局时选择家乡地形
    start: { C, W, P, P1, P2, P3, VP },  // 初始资源
    cult_start: { FIRE, WATER, EARTH, AIR }, // 初始崇拜进度
    ship: { level, max_level, advance_cost?, advance_gain? },
    dig:  { level, max_level, cost[], advance_cost?, advance_gain?, gain? } | null,
    teleport: { ... },        // 仅 Dwarves / Fakirs
    special: { ... },         // 派系特殊能力（可选）
    leech_effect: { taken, not_taken },  // 仅 Cultists / Shapeshifters
    exchange_rates: { ... },  // 仅 Alchemists
    buildings: { D, TP, TE, SH, SA },
}
```

### 建筑字段

```javascript
buildings: {
    D:  { advance_cost, income: { W: [9 items] } },
    TP: { advance_cost, income: { C: [5 items], PW: [5 items] } },
    TE: { advance_cost, income: { P: [4 items], PW?: [4 items] } },
    SH: { advance_cost, income: { PW|C|P: [2 items] }, advance_gain?: [...] },
    SA: { advance_cost, income: { P: [2 items] } },
}
```

建筑 income 数组含义：索引 = 建筑数量（0 = 无该建筑，1 = 1 座，…）。  
例如 `D.income.W = [1, 2, 3, 4, 5, 6, 7, 8, 8]` → 最多 8 座 D 时收入 8W，索引 0 为基础（起始）收入。

---

## 派系一览

### 基础游戏（14 个）

| 键名 | 显示名 | 地形 | Board ID | 初始 C | 初始 W | P1 | P2 | 崇拜起始 |
|------|--------|------|----------|--------|--------|----|----|----------|
| alchemists | Alchemists | black | 11 | 15 | 3 | 5 | 7 | FIRE+WATER=1 |
| auren | Auren | green | 13 | 15 | 3 | 5 | 7 | WATER+AIR=1 |
| chaosmagicians | Chaos Magicians | red | 3 | 15 | 4 | 5 | 7 | FIRE=2 |
| cultists | Cultists | brown | 10 | 15 | 3 | 5 | 7 | FIRE+EARTH=1 |
| darklings | Darklings | black | 12 | 15 | 1 | 5 | 7 | WATER+EARTH=1 |
| dwarves | Dwarves | gray | 7 | 15 | 3 | 5 | 7 | EARTH=2 |
| engineers | Engineers | gray | 8 | 10 | 2 | 3 | 9 | 全 0 |
| fakirs | Fakirs | yellow | 1 | 15 | 3 | 7 | 5 | FIRE+AIR=1 |
| giants | Giants | red | 4 | 15 | 3 | 5 | 7 | FIRE+AIR=1 |
| halflings | Halflings | brown | 9 | 15 | 3 | 3 | 9 | EARTH+AIR=1 |
| mermaids | Mermaids | blue | 6 | 15 | 3 | 3 | 9 | WATER=2 |
| nomads | Nomads | yellow | 2 | 15 | 2 | 5 | 7 | FIRE+EARTH=1 |
| swarmlings | Swarmlings | blue | 5 | 20 | 8 | 3 | 9 | 全 1 |
| witches | Witches | green | 14 | 15 | 3 | 5 | 7 | AIR=2 |

### Fire & Ice 扩展（6 个）

| 键名 | 显示名 | 地形 | P1 | P2 | 崇拜起始 |
|------|--------|------|----|----|----------|
| riverwalkers | Riverwalkers | null (可选) | 10 | 2 | FIRE+AIR=1 |
| shapeshifters | Shapeshifters | null (可选) | 4 | 4 | FIRE+WATER=1 |
| acolytes | Acolytes | volcano | 6 | 6 | 全 3 |
| icemaidens | Ice Maidens | ice | 6 | 6 | WATER+AIR=1 |
| yetis | Yetis | ice | 0 | 12 | EARTH+AIR=1 |
| dragonlords | Dragonlords | volcano | 4 | 4 | FIRE=2 |

---

## 特殊机制说明

### 船只 (ship)

- **Dwarves / Fakirs**：`max_level = 0`，无法航行，改用 `teleport`
- **Mermaids**：`level = 1`（开局即可航行），`max_level = 5`
- **Riverwalkers**：`level = max_level = 1`（固定，不能升级）
- 其余标准派系：`level = 0`，`max_level = 3`

### 挖掘 (dig)

- **Riverwalkers**：`dig = null`，无挖掘动作，靠祭司解锁地形
- **Darklings**：`max_level = 0`（无法升级），每次挖掘花费 1 名祭司（得 1 铲 + 2 VP）
- **Fakirs**：`max_level = 1`（最多升一级）
- **Acolytes / Dragonlords**：`max_level = 0`，挖掘产生 `VOLCANO_TF`（火山地形转换）而非铲子
- **Shapeshifters**：`max_level = 0`，固定花费 W3 得 1 铲

### 传送 (teleport)

仅 Dwarves（túnel）和 Fakirs（地毯）有此字段：
- Dwarves：`type="tunnel"`，费用 W2/W1，得 VP4
- Fakirs：`type="carpet"`，费用 P1/P1，得 VP4；升级扩大范围

### 特殊能力 (special)

| 派系 | 特殊效果 |
|------|----------|
| alchemists | SH 建成后，建城时每铲 +2 PW |
| swarmlings | 每获得城镇牌 → 得 3 W |
| witches | 每获得城镇牌 → 得 5 VP |
| halflings | 每用铲 → 得 1 VP |
| engineers | 开局预解锁工程师桥梁动作（ACTE=1）|
| acolytes | 铲子事件 → 转化为崇拜进步 |
| dragonlords | 铲子事件 → 补充 P1 令牌 |
| riverwalkers | 铲子事件 → 不做任何事；祭司事件 → 解锁地形 |
| yetis | 所有动力动作折扣 1 PW |

### 特殊税收 (leech_effect)

| 派系 | 被汲取时（取）| 被汲取时（不取）|
|------|--------------|----------------|
| cultists | 崇拜轨 +1 | PW +1 |
| shapeshifters | 花 1 P3 令牌换 VP | PW +1 |

### 货币兑换 (exchange_rates)

只有 **Alchemists** 有此机制：可随时以 1 VP 换 1 C，或以 1 C 换 2 VP。

---

## 建筑特色汇总

### 非标准建造费用

| 派系 | 建筑 | 标准费用 | 实际费用 |
|------|------|---------|----------|
| swarmlings | D | W1+C2 | W2+C3 |
| swarmlings | TP | W2+C3 | W3+C4 |
| swarmlings | TE | W2+C5 | W3+C6 |
| swarmlings | SH | W4+C6 | W5+C8 |
| swarmlings | SA | W4+C6 | W5+C8 |
| engineers | D | W1+C2 | W1+C1 |
| engineers | TP | W2+C3 | W1+C2 |
| engineers | TE | W2+C5 | W1+C4 |
| engineers | SH | W4+C6 | W3+C6 |
| engineers | SA | W4+C6 | W3+C6 |
| chaosmagicians | SH | W4+C6 | W4+C4 |
| halflings | SH | W4+C6 | W4+C8 |
| nomads | SH | W4+C6 | W4+C8 |
| fakirs | SH | W4+C6 | W4+C10 |
| darklings | SA | W4+C6 | W4+C10 |
| acolytes | SH | W4+C6 | W4+C8 |
| acolytes | SA | W4+C6 | W4+C8 |
| dragonlords | SH | W4+C6 | W4+C8 |
| dragonlords | SA | W4+C6 | W4+C8 |

### SH 特殊解锁

| 派系 | SH 建成解锁效果 |
|------|----------------|
| alchemists | 立得 PW×12 |
| auren | ACTA 动作 + 1 恩赐牌 |
| chaosmagicians | ACTC 动作 |
| cultists | 立得 VP×7 |
| dwarves | 隧道等级升 1（GAIN_TELEPORT）|
| fakirs | 地毯等级升 1（GAIN_TELEPORT）|
| giants | ACTG 动作（双铲）|
| halflings | 立得 3 铲 |
| mermaids | 船级升 1（GAIN_SHIP）|
| nomads | ACTN 动作（沙移）|
| swarmlings | ACTS 动作 |
| witches | ACTW 动作（廉价建居所）|
| darklings | CONVERT_W_TO_P ×3（3 W → 3 P）|
| acolytes | 祭司置于崇拜轨时额外奖励（PRIEST_CULT_BONUS）|
| yetis | 本回合所有动力动作均可复用（ALLOW_REUSE_ACTS）|
| dragonlords | 得与玩家数等量的 P1 令牌 |
| riverwalkers | 得 2 座桥（BRIDGE ×2）|
| shapeshifters | ACTH5 + ACTH6 变形动作 |

---

## 导出 API

```javascript
const { FACTIONS, BASE_FACTIONS, FIRE_ICE_FACTIONS, FACTION_COUNT } = require("./data/factions.js")

FACTIONS          // Record<string, FactionDef>  — 20 个派系定义
BASE_FACTIONS     // string[]  — 14 个基础游戏派系键名
FIRE_ICE_FACTIONS // string[]  — 6 个 Fire & Ice 派系键名
FACTION_COUNT     // 20
```

---

## 测试覆盖（631 项全通过）

| 测试组 | 项数 | 覆盖内容 |
|--------|------|---------|
| Group 1: Module shape | 5 | 导出结构、计数 |
| Group 2: Required fields | 20 | 每派系必填字段存在 |
| Group 3: start resources | 100 | C/W/P/P1/P2/P3/VP 完整性、VP=20、P3=0 |
| Group 4: cult_start | 55 | 四轨都存在、值域、具体派系值 |
| Group 5: color | 23 | 颜色合法性、pick_color 一致性 |
| Group 6: faction_board_id | 3 | 基础派系有数字 ID，F&I 为 null，ID 唯一 |
| Group 7: ship | 25 | level≤max_level，特殊派系船级 |
| Group 8: dig | 85 | 字段完整性、level≤max_level、cost 长度、特殊派系 |
| Group 9: teleport | 3 | Dwarves/Fakirs 有 teleport，其余无 |
| Group 10: buildings | 300 | 五类建筑都存在、advance_cost、income、数组长度 |
| Group 11: mechanisms | 5 | leech_effect、exchange_rates |
| Group 12: resource spot-checks | 5 | 关键资源数值验证 |
| Group 13: income spot-checks | 10 | 具体 income 数组值验证 |
| Group 14: F&I tags | 6 | expansion 标记、颜色分类 |

---

## 来源对照

```
Perl 源文件                      → JS 键名
src/Game/Factions/Alchemists.pm → alchemists
src/Game/Factions/Auren.pm      → auren
src/Game/Factions/Chaosmagicians.pm → chaosmagicians
src/Game/Factions/Cultists.pm   → cultists
src/Game/Factions/Darklings.pm  → darklings
src/Game/Factions/Dwarves.pm    → dwarves
src/Game/Factions/Engineers.pm  → engineers
src/Game/Factions/Fakirs.pm     → fakirs
src/Game/Factions/Giants.pm     → giants
src/Game/Factions/Halflings.pm  → halflings
src/Game/Factions/Mermaids.pm   → mermaids
src/Game/Factions/Nomads.pm     → nomads
src/Game/Factions/Swarmlings.pm → swarmlings
src/Game/Factions/Witches.pm    → witches
src/Game/Factions/Riverwalkers.pm   → riverwalkers  (riverwalkers_v5)
src/Game/Factions/Shapeshifters.pm  → shapeshifters  (shapeshifters_v5)
src/Game/Factions/Acolytes.pm       → acolytes        ($acolytes，最终版)
src/Game/Factions/Icemaidens.pm     → icemaidens      ($icemaidens，最终版)
src/Game/Factions/Yetis.pm          → yetis           ($yetis，最终版)
src/Game/Factions/Dragonlords.pm    → dragonlords     ($dragonlords，最终版)
```

> 每个 F&I Perl 文件包含多个 playtest 版本（v1/v2/v3/v4/v5）。  
> 本移植采用**最终版（第一个变量，无 playtest 后缀）**。

---

## 与原始 Perl 的主要差异

1. **结构重命名**：Perl 的顶层资源键（`C`、`W`、`P1`、`P2`）收入 `start{}` 和 `cult_start{}` 子对象，便于后续引擎直接赋值到游戏状态。

2. **special 规范化**：各派系 `special` 的格式在 Perl 中不完全统一（有些用 `map` 展开 TW1–TW8），JS 中统一用简洁对象表示（`TW: { W: 3 }`），引擎层负责展开。

3. **VP 终止动作名称保留**：`ACTA`、`ACTC`、`ACTG`、`ACTN`、`ACTS`、`ACTW`、`ACTH5`、`ACTH6` 等符号名直接携带，引擎层解析具体动作。

4. **Riverwalkers locked_terrain 简化**：Perl 原码通过 `map` 动态生成7组地形解锁费规则。JS 版本仅保留 `special.P.UNLOCK_TERRAIN=1` 标记，具体解锁逻辑由引擎负责。
