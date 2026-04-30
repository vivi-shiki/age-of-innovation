# Step 1.3 — 牌组与常量数据

> **目标**：将 terra-mystica 的奖励牌、好感牌、城镇牌、计分牌和全局常量移植为 JavaScript。  
> **来源**：`terra-mystica/src/Game/Constants.pm`、`src/Game/Factions.pm`  
> **交付**：`age-of-innovation/data/tiles.js`、`age-of-innovation/data/constants.js`  
> **测试**：`test/test-step-1.3.js`（442 项，全部通过）

---

## 一、tiles.js

### 导出 API

```javascript
const {
    BONUS_TILES,        // Record<string, BonusTile>
    FAVOR_TILES,        // Record<string, FavorTile>
    TOWN_TILES,         // Record<string, TownTile>
    SCORING_TILES,      // Record<string, ScoringTile>
    BONUS_TILE_NAMES,   // string[]  — 10 items
    FAVOR_TILE_NAMES,   // string[]  — 12 items
    TOWN_TILE_NAMES,    // string[]  — 8 items
    SCORING_TILE_NAMES, // string[]  — 9 items
} = require('./data/tiles.js')
```

---

### 1.1 奖励牌（BON1-BON10）

**字段说明：**

| 字段 | 类型 | 含义 |
|------|------|------|
| `income` | `{ resource: amount }` | 每轮收入（在 pass 之后的轮次才生效） |
| `action` | `{ cost, gain, subaction? }` | 每轮可用动作（持牌期间） |
| `pass_vp` | `{ building: number[] }` | 传牌时按建筑数量得 VP（索引=建筑数） |
| `special` | `{ ship: 1 }` | 标记舰船奖励效果 |
| `option` | `string` | 需要此游戏选项才加入牌堆 |

**数据一览：**

| 牌名 | 收入 | 动作 | 传牌 VP | 备注 |
|------|------|------|---------|------|
| BON1 | C:2  | 1 SPADE | — | subaction: dig/transform/build |
| BON2 | C:4  | CULT +1 | — | |
| BON3 | C:6  | — | — | |
| BON4 | PW:3 | — | — | special: ship |
| BON5 | PW:3, W:1 | — | — | |
| BON6 | W:2  | — | SA/SH: [0,4] | |
| BON7 | W:1  | — | TP: [0,2,4,6,8] | |
| BON8 | P:1  | — | — | |
| BON9 | C:2  | — | D: [0,1,...,8] | |
| BON10| PW:3 | — | ship: [0,3,...,15] | option: shipping-bonus |

**pass_vp 数组规则**：索引 = 建筑数，值 = VP。BON9.pass_vp.D[3] = 3 表示拥有 3 座居所时传牌得 3 VP。  
数组始终从 `0` 开始（0 座建筑 → 0 VP）且非递减。

**默认池数量**：每种奖励牌各 1 张（BON10 需 shipping-bonus 选项）。

---

### 1.2 好感牌（FAV1-FAV12）

**字段说明：**

| 字段 | 类型 | 含义 |
|------|------|------|
| `gain` | `{ resource: amount }` | 取牌即时获得 |
| `income` | `{ resource: amount }` | 每轮收入叠加（空对象表示无） |
| `count` | `number` | 牌堆中的初始数量（缺省为 3） |
| `action` | `{ cost, gain }` | 每轮可用动作 |
| `vp` | `{ building: vp }` | 建造特定建筑时即得 VP |
| `pass_vp` | `{ building: number[] }` | 传牌时按建筑数量得 VP |

**数据一览：**

| 牌名 | 即时获得 | 收入 | 数量 | 其他 |
|------|---------|------|------|------|
| FAV1 | FIRE:3 | — | 1 | |
| FAV2 | WATER:3 | — | 1 | |
| FAV3 | EARTH:3 | — | 1 | |
| FAV4 | AIR:3 | — | 1 | |
| FAV5 | FIRE:2, TOWN_SIZE:-1 | — | 3 | 城镇要求-1 |
| FAV6 | WATER:2 | — | 3 | action: CULT+1 |
| FAV7 | EARTH:2 | W:1, PW:1 | 3 | |
| FAV8 | AIR:2 | PW:4 | 3 | |
| FAV9 | FIRE:1 | C:3 | 3 | |
| FAV10 | WATER:1 | — | 3 | vp: TP→3 |
| FAV11 | EARTH:1 | — | 3 | vp: D→2 |
| FAV12 | AIR:1 | — | 3 | pass_vp: TP:[0,2,3,3,4] |

**注意**：FAV5 的 `TOWN_SIZE:-1` 表示该玩家的城镇强度要求减 1（默认 7 → 6）。

默认池数量：FAV1-FAV4 各 1 张，FAV5-FAV12 各 3 张。

---

### 1.3 城镇牌（TW1-TW8）

**字段说明：**

| 字段 | 类型 | 含义 |
|------|------|------|
| `gain` | `{ resource: amount }` | 形成城镇时立即获得 |
| `count` | `number` | 牌堆中的数量（缺省为 2，1 表示仅 1 张）|
| `option` | `string` | 需要此游戏选项才加入牌堆 |

**数据一览：**

| 牌名 | KEY | VP | 其他获得 | 数量 | 选项 |
|------|-----|----|---------|------|------|
| TW1 | 1 | 5 | C:6 | 2 | — |
| TW2 | 1 | 7 | W:2 | 2 | — |
| TW3 | 1 | 9 | P:1 | 2 | — |
| TW4 | 1 | 6 | PW:8 | 2 | — |
| TW5 | 1 | 8 | 各崇拜+1 | 2 | — |
| TW6 | 2 | 2 | 各崇拜+2 | 1 | mini-expansion-1 |
| TW7 | 1 | 4 | GAIN_SHIP, carpet_range | — | mini-expansion-1 |
| TW8 | 1 | 11 | — | 1 | mini-expansion-1 |

---

### 1.4 计分牌（SCORE1-SCORE9）

**字段说明：**

| 字段 | 类型 | 含义 |
|------|------|------|
| `vp` | `{ trigger: amount }` | 触发 VP 奖励 |
| `vp_display` | `string` | 人类可读描述 |
| `vp_mode` | `'gain' \| 'build'` | 触发时机 |
| `cult` | `string` | 影响轮次收入的崇拜轨道（或 CULT_P）|
| `req` | `number` | 获得轮次收入所需的崇拜等级步数 |
| `income` | `{ resource: amount }` | 每满足 `req` 步就获得此收入 |
| `option` | `string` | 需要此选项才加入牌堆 |

**轮次收入公式**：`income × floor(cult_level / req)`

**vp.TW 说明**：SCORE2 使用 `{ TW: 5 }` 作为简化表示，意为"每形成任意城镇（TW1-TW8）得 5 VP"。引擎层负责匹配前缀 `TW` 到所有城镇牌事件。

**数据一览：**

| 牌名 | VP 触发 | 模式 | 崇拜轨道 | 要求步数 | 轮次收入 |
|------|--------|------|---------|---------|---------|
| SCORE1 | SPADE→2 | gain | EARTH | 1 | C:1 |
| SCORE2 | TW→5 | gain | EARTH | 4 | SPADE:1 |
| SCORE3 | D→2 | build | WATER | 4 | P:1 |
| SCORE4 | SA/SH→5 | build | FIRE | 2 | W:1 |
| SCORE5 | D→2 | build | FIRE | 4 | PW:4 |
| SCORE6 | TP→3 | build | WATER | 4 | SPADE:1 |
| SCORE7 | SA/SH→5 | build | AIR | 2 | W:1 |
| SCORE8 | TP→3 | build | AIR | 4 | SPADE:1 |
| SCORE9 | TE→4 | build | CULT_P | 1 | C:2 |

**CULT_P**（SCORE9）：`cult: 'CULT_P'` 表示统计本轮发送到崇拜轨道的祭司数量而非崇拜值。  
**option**：SCORE9 需要 `temple-scoring-tile` 游戏选项。

---

## 二、constants.js

### 导出 API

```javascript
const {
    BUILDING_STRENGTH,        // { D:1, TP:2, TE:2, SH:3, SA:3 }
    BUILDING_ALIASES,         // { DWELLING:'D', ... }
    RESOURCE_ALIASES,         // { PRIEST:'P', ... }
    DEFAULT_EXCHANGE_RATES,   // { PW:{C:1,...}, W:{C:1}, P:{C:1,W:1}, C:{VP:3} }
    CULT_TRACKS,              // ['FIRE','WATER','EARTH','AIR']
    CULT_TRACK_POWER_GAINS,   // threshold-based PW bonuses
    COLOR_WHEEL,              // ['yellow','brown','black','blue','green','gray','red']
    DEFAULT_TOWN_SIZE,        // 7
    DEFAULT_TOWN_COUNT,       // 4
    DEFAULT_BRIDGE_COUNT,     // 3
    POWER_ACTIONS,            // ACT1-ACT6 (shared pool)
    FACTION_ACTIONS,          // ACTA/ACTE/ACTC/ACTG/ACTN/ACTS/ACTW/ACTH1-6
    FINAL_SCORING,            // network, cults, and F&I options
} = require('./data/constants.js')
```

---

### 2.1 建筑系统

```javascript
// 征收收入计算时每座建筑贡献的"强度"
BUILDING_STRENGTH = { D: 1, TP: 2, TE: 2, SH: 3, SA: 3 }

// 命令解析时的别名（大写）
BUILDING_ALIASES = {
    DWELLING: 'D',
    'TRADING POST': 'TP',
    TEMPLE: 'TE',
    STRONGHOLD: 'SH',
    SANCTUARY: 'SA',
}
```

---

### 2.2 资源别名

```javascript
RESOURCE_ALIASES = {
    PRIEST: 'P', PRIESTS: 'P',
    POWER: 'PW',
    WORKER: 'W', WORKERS: 'W',
    COIN: 'C', COINS: 'C',
}
```

---

### 2.3 默认兑换汇率

```javascript
DEFAULT_EXCHANGE_RATES = {
    PW: { C: 1, W: 3, P: 5 },  // 1 PW 烧毁 → 1 C；3 PW 烧毁 → 1 W；5 PW → 1 P
    W:  { C: 1 },               // 1 W → 1 C
    P:  { C: 1, W: 1 },         // 1 P → 1 C 或 1 W（暗灵用祭司挖掘时独立走此路径）
    C:  { VP: 3 },              // 3 C → 1 VP
}
```

**Alchemists 覆盖**：`C: { VP: 2 }` 和 `VP: { C: 1 }`（额外反向兑换）。  
各派系的 `exchange_rates` 字段（在 factions.js 中）会在引擎初始化时与此默认值合并。

---

### 2.4 崇拜轨道

```javascript
CULT_TRACKS = ['FIRE', 'WATER', 'EARTH', 'AIR']

// 跨越阈值时获得的权力
CULT_TRACK_POWER_GAINS = [
    { threshold: 2, PW: 1 },        // 到达 3：+1 PW
    { threshold: 4, PW: 2 },        // 到达 5：+2 PW
    { threshold: 6, PW: 2 },        // 到达 7：+2 PW
    { threshold: 9, PW: 3, KEY: -1 }, // 到达 10：+3 PW，消耗 1 KEY
]
```

**判断逻辑**：`old <= threshold && new > threshold` 则触发。  
**到达 10 的限制**：每条轨道只有一名玩家可以到达第 10 格；到达后所有其他玩家的上限被设为 9。

---

### 2.5 地形颜色轮

```javascript
COLOR_WHEEL = ['yellow', 'brown', 'black', 'blue', 'green', 'gray', 'red']
```

改造距离 = 两种颜色在轮上的最短弧长（循环，最大距离 = 3）。

---

### 2.6 城镇与桥梁默认值

```javascript
DEFAULT_TOWN_SIZE   = 7   // 城镇所需最低建筑强度总和（FAV5 可将派系值降为 6）
DEFAULT_TOWN_COUNT  = 4   // 城镇所需最少建筑数
DEFAULT_BRIDGE_COUNT = 3  // 每个派系最多可放置 3 座桥
```

---

### 2.7 权力动作（ACT1-ACT6）

共享权力动作池，每轮每个动作只能使用一次（由池中取出，round end 归还）。

| 动作 | 费用 | 获得 | 备注 |
|------|------|------|------|
| ACT1 | PW:3 | BRIDGE:1 | subaction: bridge |
| ACT2 | PW:3 | P:1 | |
| ACT3 | PW:4 | W:2 | |
| ACT4 | PW:4 | C:7 | |
| ACT5 | PW:4 | SPADE:1 | subaction: dig/transform/build |
| ACT6 | PW:6 | SPADE:2 | subaction: dig/transform×2/build |

**注意**：Migration plan 示例中 ACT4 写的是 `SPADE:1`，ACT5 写的是 `SPADE:2`，与 Perl 原码不符。实际按 Perl 值：ACT4 得 `C:7`，ACT5 得 `SPADE:1`。

---

### 2.8 派系特殊动作（ACTA-ACTH6）

不占用共享权力池，由各派系的要塞（SH）或好感牌（FAV6）解锁。

| 动作 | 解锁来源 | dont_block | 描述 |
|------|---------|-----------|------|
| ACTA | Auren SH | — | 同一崇拜轨道 +2 步 |
| ACTE | Engineers SH | ✓ | 花 W:2 建桥（不消耗本轮行动）|
| ACTG | Giants SH | — | 免费 2 铲 |
| ACTS | Swarmlings SH | — | 免费升级 TP |
| ACTN | Nomads SH | — | 免费改造 + 建造（需邻接）|
| ACTW | Witches SH | — | 免费在任意己方地形建居所 |
| ACTC | Chaos Magicians SH | — | 获得额外 2 个行动 |
| ACTH1-2 | Shapeshifters SH | ✓ | 花 PW:3 变色（需 ALLOW_SHAPESHIFT）|
| ACTH3-4 | — | ✓ | 花 PW:4 变色 |
| ACTH5-6 | Shapeshifters SH | ✓ | 花 PW:5 变色（FAV6 格动作）|

**dont_block**：设为 `true` 的动作不消耗主行动名额，可叠加在正常行动之上。

---

### 2.9 最终计分

```javascript
FINAL_SCORING = {
    network: { points: [18, 12, 6], label: 'network' },
    cults:   { points: [8, 4, 2] },
    // Fire & Ice 可选最终计分（需 fire-and-ice-final-scoring 选项）
    'connected-distance':     { ... },
    'connected-sa-sh-distance': { ... },
    'building-on-edge':       { ... },
    'connected-clusters':     { ... },
}
```

**并列处理**：若多名玩家名次相同，所有并列者共享对应档位 VP 之和的均值（例如两人并列 1 名各得 (18+12)/2 = 15 VP）。

---

## 三、测试覆盖（442 项，全部通过）

| 测试组 | 项数 | 覆盖内容 |
|--------|------|---------|
| 1: tiles.js module shape | 8 | 导出类型与数组类型 |
| 2: BONUS_TILES 计数与结构 | 12 | 10 张牌、income 字段存在 |
| 3: BONUS_TILES 具体值 | 42 | 每张牌核心字段精确值、pass_vp 规律 |
| 4: FAVOR_TILES 计数与结构 | 29 | 12 张牌、gain/income/count 规则 |
| 5: FAVOR_TILES 具体值 | 37 | cult 值、特殊机制（TOWN_SIZE、action、vp、pass_vp）|
| 6: TOWN_TILES 计数与结构 | 25 | 8 张牌、KEY 数量、option 分类 |
| 7: TOWN_TILES 具体值 | 18 | 每张牌 VP 值与特殊获得 |
| 8: SCORING_TILES 计数与结构 | 47 | 9 张牌、必填字段、vp_mode 合法值 |
| 9: SCORING_TILES 具体值 | 36 | cult/req/income/vp_mode 精确值 |
| 10: constants.js module shape | 10 | 导出类型 |
| 11: BUILDING_STRENGTH | 6 | 5 种建筑强度 |
| 12: BUILDING_ALIASES / RESOURCE_ALIASES | 12 | 别名对照 |
| 13: DEFAULT_EXCHANGE_RATES | 8 | 汇率值 |
| 14: CULT_TRACKS | 5 | 崇拜轨道 |
| 15: CULT_TRACK_POWER_GAINS | 11 | 4 个阈值权力奖励 |
| 16: COLOR_WHEEL | 10 | 7 种颜色、顺序 |
| 17: 城镇桥梁默认值 | 3 | SIZE/COUNT/BRIDGE |
| 18: POWER_ACTIONS | 32 | ACT1-6 费用/获得/subbaction |
| 19: FACTION_ACTIONS | 33 | 13 个特殊动作 |
| 20: FINAL_SCORING | 18 | 标准+F&I 计分类别 |
| **合计** | **442** | **全部通过 ✅** |

---

## 四、来源对照

| JS 导出 | Perl 来源 |
|---------|----------|
| `BONUS_TILES` | `%tiles` (BON* 条目) in `Game/Constants.pm` |
| `FAVOR_TILES` | `%tiles` (FAV* 条目) in `Game/Constants.pm` |
| `TOWN_TILES` | `%tiles` (TW* 条目) in `Game/Constants.pm` |
| `SCORING_TILES` | `%tiles` (SCORE* 条目) in `Game/Constants.pm` |
| `BUILDING_STRENGTH` | `%building_strength` in `Game/Constants.pm` |
| `BUILDING_ALIASES` | `%building_aliases` in `Game/Constants.pm` |
| `RESOURCE_ALIASES` | `%resource_aliases` in `Game/Constants.pm` |
| `DEFAULT_EXCHANGE_RATES` | `%base_exchange_rates` in `Game/Factions.pm` |
| `CULT_TRACKS` | `@cults` in `Game/Constants.pm` |
| `CULT_TRACK_POWER_GAINS` | `maybe_gain_power_from_cult()` in `resources.pm` |
| `COLOR_WHEEL` | `@colors` in `Game/Constants.pm` |
| `POWER_ACTIONS` | `%actions` (ACT1-6) in `Game/Constants.pm` |
| `FACTION_ACTIONS` | `%actions` (ACTA/C/E/G/N/S/W + ACTH*) in `Game/Constants.pm` |
| `FINAL_SCORING` | `%final_scoring` in `Game/Constants.pm` |

---

## 五、与原始 Perl 的主要差异

1. **SCORE2.vp 简化**：Perl 用 `map(("TW$_", 5), 1..8)` 展开为 TW1–TW8 各 5 VP，JS 用 `{ TW: 5 }` 前缀匹配，由引擎处理展开。

2. **actions 拆分**：Perl 的 `%actions` 同时包含 BON/FAV 关联的动作（BON1、BON2、FAV6）和派系特殊动作（ACTA 等）。JS 中：
   - BON1/BON2/FAV6 的动作直接嵌入各自的 tile 对象
   - ACTA 等独立放在 `FACTION_ACTIONS`

3. **init_tiles() 内联**：Perl 的 `init_tiles()` 在运行时将 `%actions` 的部分条目注入到对应 tile 对象。JS 直接在定义时写入，无需运行时合并。

4. **CULT_TRACK_POWER_GAINS 表驱动**：Perl 用多个 `if` 分支表达，JS 改为对象数组，便于迭代处理。
