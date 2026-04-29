# Age of Innovation — 迁移计划

> 将 terra-mystica 的游戏逻辑迁移为 RTT 服务器标准模组（`age-of-innovation`）  
> 目标路径：`server/public/age-of-innovation/`  
> 新项目开发目录：`age-of-innovation/`

---

## 迁移概述

### 核心思路

| 维度 | 原 terra-mystica | 新 age-of-innovation |
|------|-----------------|---------------------|
| 后端语言 | Perl | JavaScript（Node.js，RTT rules.js）|
| 数据库 | PostgreSQL + 命令流 | SQLite + JSON 状态（RTT 提供）|
| 通信协议 | AJAX POST 文本命令 | WebSocket 动作消息（RTT 提供）|
| 用户系统 | 自建（注册/登录/评分）| RTT 提供，不需重建 |
| 地图渲染 | Canvas 程序化绘图 | 保留 Canvas 绘图方式 |
| 实时性 | 异步（刷新轮询）| WebSocket 实时推送 |
| 排行榜/统计 | 自建 | 不迁移，使用 RTT 公共功能 |

### 不迁移的内容

- 用户注册 / 登录 / 密码重置
- ELO 评分 / 玩家统计 / 排行榜
- 邮件通知系统
- 地图编辑器
- 评论 / 博客 / 论坛

### 保留 & 重建的内容

- 全部游戏规则（20 种派系×全部特殊能力）
- 地图数据（六边形网格、地形、邻接关系）
- Canvas 绘图逻辑（六边形渲染、建筑符号）
- 崇拜轨道 / 城镇判定 / 积分系统

---

## 文件结构目标

```
age-of-innovation/
├── title.sql              # 模组注册
├── about.html             # 游戏介绍页
├── create.html            # 建局选项表单
├── play.html              # 游戏客户端页面
├── play.css               # 游戏样式
├── play.js                # 客户端渲染 + 交互
├── rules.js               # 游戏规则引擎（RTT API）
└── data/
    ├── map.js             # 地图格数据（地形、坐标、邻接）
    ├── factions.js        # 20 种派系全部数据
    ├── tiles.js           # 奖励牌/城镇牌/轮次计分牌数据
    └── constants.js       # 全局常量（建筑、崇拜、动作等）
├── test/
    ├── rules.test.js      # 游戏规则单元测试
    ├── setup.test.js      # 初始化测试
    ├── actions.test.js    # 动作处理测试
    ├── scoring.test.js    # 积分系统测试
    └── fixtures/
        ├── testgame1.json # 从 test/testgame1.txt 转换的黄金输出
        ├── testgame2.json
        └── testgame3.json
```

---

## 分步迁移计划

---

### 阶段 0：基础骨架搭建

#### Step 0.1：项目初始化与 RTT 注册

**目标**：创建模组最小完整结构，使 RTT 服务器可识别并加载。

**交付文件：**
- `title.sql` — 模组注册
- `about.html` — 简单介绍页
- `create.html` — 基础建局表单（玩家数量/派系选择/地图选择）
- `rules.js` — 最小骨架（只有 exports，无实际逻辑）
- `play.html` — 基础页面（引用 client.js, play.js）
- `play.js` — 桩函数 `on_init()` 和 `on_update()`

**具体内容：**

```sql
-- title.sql
insert or ignore into titles (title_id, title_name, bgg)
values ('age-of-innovation', 'Age of Innovation', 432);
```

```javascript
// rules.js 骨架
exports.scenarios = ["Standard"]
exports.roles = function(scenario, options) {
    const count = parseInt(options.players) || 2
    return Array.from({length: count}, (_, i) => `Player ${i+1}`)
}
exports.setup = function(seed, scenario, options) { /* ... */ }
exports.view  = function(state, role) { /* ... */ }
exports.action = function(state, role, action, arg) { /* ... */ }
```

```html
<!-- create.html 建局选项 -->
<select name="players">
  <option>2</option><option>3</option>
  <option>4</option><option>5</option>
</select>
<!-- 扩展选项（Fire & Ice） -->
<label><input type="checkbox" name="fire_ice"> Fire & Ice 扩展</label>
```

**验收标准**：RTT 服务器启动时不报错；可在大厅看到游戏；可点击"创建游戏"。

---

### 阶段 1：静态数据层

#### Step 1.1：地图数据移植

**目标**：将 terra-mystica 的 `map.pm` 地图定义转为 JavaScript。

**来源**：`src/map.pm`（`setup_base_map`、邻接关系）

**交付文件：** `data/map.js`

```javascript
// data/map.js
export const STANDARD_MAP = {
    // 每个格用行列编码（如 "A1"）
    "A1": { color: "yellow", row: 0, col: 0 },
    "A2": { color: "yellow", row: 0, col: 1 },
    "B1": { color: "brown",  row: 1, col: 0 },
    // ... 113 个地图格
    "r0": { color: "white",  row: 0, col: 0 },  // 河流格
    // ...
}

export const ADJACENCY = {
    "A1": ["r0", "B1", "A2"],
    "A2": ["A1", "B1", "B2", "A3"],
    // ...
}

// 船只/航运可达范围预计算
export const RIVER_RANGE = {
    "A1": { 0: ["B1", "A2"], 1: ["r0", "A3"] },
    // ...
}

export const MAP_ROWS = 9
export const MAP_COLS = 13
```

**关键挑战**：原始地图数据在 Perl 代码里以 `terrain` 字符串存储，需要手工或脚本提取对应的标准地图。

**验收标准**：
- 所有格子的邻接关系通过双向一致性测试
- 河流格数量与官方地图吻合
- 9行×13列格子均有正确颜色

---

#### Step 1.2：派系数据移植

**目标**：将 20 个派系从 Perl 结构体转为 JavaScript 对象。

**来源**：`src/Game/Factions/*.pm`（每个 `.pm` 文件）

**交付文件：** `data/factions.js`

```javascript
// data/factions.js
export const FACTIONS = {
    swarmlings: {
        display: "Swarmlings",
        color: "black",
        home_terrain: "swamp",
        start: { C: 10, W: 5, P1: 4, P2: 3, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 0, AIR: 0 },
        dig: {
            level: 1, max_level: 2,
            cost: [{ W: 3 }, { W: 2 }, { W: 1 }],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [{ VP: 6 }, { VP: 6 }]
        },
        ship: { level: 0, max_level: 3, ... },
        buildings: {
            D:  { max_level: 8, advance_cost: {W:1,C:2}, income: {W:[1,2,3,4,5,6,7,8]} },
            TP: { max_level: 4, advance_cost: {W:2,C:3}, income: {C:[0,2,3,5,6],PW:[0,1,2,4,6]} },
            TE: { max_level: 3, ... },
            SH: { max_level: 1, ... },
            SA: { max_level: 1, ... },
        },
        // 特殊能力（如 swarmlings 的廉价居所）
        special: { cheap_dwelling: { W: 1, C: 2 } }
    },
    dwarves: { ... },
    // ... 其余 18 种
}
```

**验收标准**：
- 20 种基础派系全部定义
- 每种派系的初始资源与官方规则一致
- 特殊能力标注完整

---

#### Step 1.3：牌组与常量数据

**目标**：移植奖励牌、城镇牌、轮次计分牌、动作牌数据。

**来源**：`src/Game/Constants.pm`

**交付文件：** `data/tiles.js`, `data/constants.js`

```javascript
// data/tiles.js
export const BONUS_TILES = {
    BON1: { income: { W: 1 },   bonus: null,      pass_gain: {} },
    BON3: { income: { C: 2 },   bonus: null,      pass_gain: {} },
    BON5: { income: { P: 1 },   bonus: { WS: 1 }, pass_gain: {} },
    // ...
}

export const FAVOR_TILES = {
    FAV1: { cost_gain: { FIRE: 1, VP: 3 }, income: {} },
    FAV3: { cost_gain: { EARTH: 1 },       income: { C: 1 } },
    // ...
}

export const TOWN_TILES = {
    TW1: { gain: { VP: 7 },        ongoing: null },
    TW3: { gain: { PW: 8, VP: 4 }, ongoing: null },
    // ...
}

export const SCORING_TILES = {
    SCORE1: { vp_for: "D",  vp: 2, cult_gain: {} },
    SCORE2: { vp_for: "TP", vp: 3, cult_gain: {} },
    // ...
}

// data/constants.js
export const BUILDING_STRENGTH = { D: 1, TP: 2, TE: 2, SH: 3, SA: 3 }
export const CULT_TRACKS = ["FIRE", "WATER", "EARTH", "AIR"]
export const TERRAIN_ORDER = ["yellow","brown","black","blue","green","gray","red"]
export const POWER_ACTIONS = {
    ACT1: { cost: { PW: 3 }, gain: { BRIDGE: 1 } },
    ACT2: { cost: { PW: 3 }, gain: { P: 1 } },
    ACT3: { cost: { PW: 4 }, gain: { W: 2 } },
    ACT4: { cost: { PW: 4 }, gain: { SPADE: 1 } },
    ACT5: { cost: { PW: 4 }, gain: { SPADE: 2 } },
    ACT6: { cost: { PW: 6 }, gain: { VP: 2, SPADE: 2 } },
}
```

**验收标准**：
- 所有牌组数量与规则书一致
- 积分配置与官方规则书对应

---

### 阶段 2：游戏状态与初始化

#### Step 2.1：游戏状态结构定义

**目标**：设计 RTT 规范的游戏状态对象 `G`，覆盖所有游戏数据。

**交付文件：** `rules.js`（状态定义部分）

```javascript
// G 游戏状态结构（setup() 返回值）
G = {
    // RTT 必需字段
    seed: 12345,
    active: "Player 1",         // 当前需要行动的玩家角色名
    result: null,               // 游戏结束时设为 "Player 1" 或 "Draw"
    log: [],
    undo: [],

    // 游戏进度
    round: 0,                   // 0=setup, 1-6=正式轮次
    phase: "select-factions",   // 当前阶段名
    
    // 多人行动队列（RTT 支持 active 为数组）
    action_queue: [],           // [{ role, type, data }, ...]

    // 地图
    map: {},                    // { "A1": { color, building, faction, town } }
    bridges: [],                // [{ from, to, faction }, ...]

    // 每个玩家的派系状态
    factions: {
        // 键名 = 玩家角色名
        "Player 1": {
            faction_name: "swarmlings",
            C: 10, W: 5, P1: 4, P2: 3, P3: 0, VP: 20,
            FIRE: 0, WATER: 0, EARTH: 0, AIR: 0,
            buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
            dig_level: 1,
            ship_level: 0,
            favor_tiles: [],
            town_tiles: [],
            bonus_tile: null,
            passed: false,
            locations: [],
            towns: [],
            income_taken: false,
        }
    },

    // 资源池
    pool: {
        ACT1: 1, ACT2: 1, ACT3: 1, ACT4: 1, ACT5: 1, ACT6: 1,
        BON1: 1, BON3: 1, BON5: 1, // ... 激活的 bonus tiles
        FAV1: 3, FAV3: 3,          // ... 每种 favor tile 3张
        TW1: 2, TW3: 2,            // ... 每种 town tile 2张
    },

    // 本轮计分牌
    scoring_tiles: [],          // 6 张，按轮次使用
    current_scoring_tile: null,

    // 轮次顺序
    turn_order: [],             // 角色名数组（本轮出牌顺序）
    next_turn_order: [],        // 下轮顺序（pass 顺序决定）
}
```

---

#### Step 2.2：`setup()` 函数实现

**目标**：实现 `exports.setup(seed, scenario, options)` —— 随机初始化完整游戏。

**逻辑：**
1. 根据 `options.players` 确定角色列表
2. 随机洗牌并选取 6 张计分牌
3. 随机洗牌并摆放奖励牌（玩家数+3张）
4. 初始化地图（从 `data/map.js` 深拷贝）
5. 初始化资源池（favor × 3 种 × 3 张 = ...）
6. 设置 `active = "Player 1"`，`phase = "select-factions"`

**验收标准**：
- `setup()` 返回的状态通过 JSON 序列化/反序列化后不变
- 不同 seed 产生不同的计分牌顺序
- 相同 seed 永远产生相同初始状态

---

### 阶段 3：核心规则引擎

#### Step 3.1：资源系统

**目标**：实现资源增减、转换、验证函数。  
**对应原文件**：`src/resources.pm`

**关键函数：**

```javascript
// rules.js 内部函数

function gain(faction, resources) {
    // { W: 2, C: 1, VP: 3, PW: 4 } → 逐项增加
    for (const [type, amount] of Object.entries(resources)) {
        if (type === "PW") gain_power(faction, amount)
        else if (type === "CULT") { /* 崇拜前进 */ }
        else faction[type] = (faction[type] || 0) + amount
    }
}

function pay(faction, resources) {
    // 校验资源充足再扣除
    for (const [type, amount] of Object.entries(resources)) {
        if ((faction[type] || 0) < amount)
            throw new Error(`Not enough ${type}`)
        faction[type] -= amount
    }
}

function gain_power(faction, amount) {
    // 权力三碗系统
    let remaining = amount
    while (remaining > 0 && faction.P1 > 0) {
        faction.P1--; faction.P2++; remaining--
    }
    while (remaining > 0 && faction.P2 > 0) {
        faction.P2--; faction.P3++; remaining--
    }
    // remaining > 0 表示碗满，溢出忽略或返回
}

function terraform_cost(from_color, to_color, dig_level) {
    const COLORS = ["yellow","brown","black","blue","green","gray","red"]
    const dist = Math.min(
        Math.abs(COLORS.indexOf(from_color) - COLORS.indexOf(to_color)),
        7 - Math.abs(COLORS.indexOf(from_color) - COLORS.indexOf(to_color))
    )
    const spade_cost = [3, 2, 1][dig_level]  // 根据挖掘等级
    return { W: dist * spade_cost }           // 简化，实际有更多变体
}

function advance_cult(G, role, cult, amount) {
    const faction = G.factions[role]
    const old_val = faction[cult]
    const new_val = Math.min(10, old_val + amount)
    faction[cult] = new_val
    // 检查路过 3/5/7/10 获得权力
    maybe_gain_power_from_cult(faction, cult, old_val, new_val)
}
```

**验收标准（测试优先）**：
- 权力三碗溢出处理
- 资源不足时 pay() 抛出错误
- 地形颜色距离计算（7色环形）
- 崇拜轨道权力奖励在正确区间触发

---

#### Step 3.2：地图操作与建筑

**目标**：实现建造、升级、改造、城镇检测函数。  
**对应原文件**：`src/commands.pm`（build/upgrade/transform）、`src/towns.pm`、`src/buildings.pm`

**关键函数：**

```javascript
function do_build(G, role, hex) {
    const faction = G.factions[role]
    const cell = G.map[hex]

    // 校验
    if (cell.building) throw new Error("Hex already has building")
    if (!is_reachable(G, role, hex)) throw new Error("Hex not reachable")

    // 改造（如需）
    if (cell.color !== faction_color(faction)) {
        do_transform(G, role, hex, faction_color(faction))
    }

    // 建造居所
    cell.building = "D"
    cell.faction = role
    faction.buildings.D++
    faction.locations.push(hex)

    // 结算：VP + 轮次计分牌
    const adv = faction_data(faction).buildings.D
    gain(faction, adv.advance_gain?.[faction.buildings.D - 1] || {})
    score_round_tile(G, role, "D")

    // 征收收入判定
    compute_leech(G, role, hex)

    // 城镇判定
    detect_towns(G, role, hex)
}

function do_upgrade(G, role, hex, to_type) {
    const faction = G.factions[role]
    const cell = G.map[hex]
    // 验证升级路径合法
    // 支付升级成本
    // 更新 cell.building
    // 结算 VP + 积分牌
    // 征收收入判定
    // 城镇判定
}

function compute_leech(G, active_role, hex) {
    // 遍历相邻格，找不同派系的建筑
    // 对每个可征收的对手，压入 action_queue { type: "leech", ... }
    for (const adj_hex of ADJACENCY[hex]) {
        const cell = G.map[adj_hex]
        if (cell.building && cell.faction !== active_role) {
            const amount = BUILDING_STRENGTH[cell.building]
            G.action_queue.push({
                role: cell.faction,
                type: "leech",
                amount,
                from: active_role,
                leech_id: G.leech_counter++
            })
        }
    }
}

function detect_towns(G, role, hex) {
    // BFS 找连通建筑组
    // 判断是否满足城镇条件（≥4建筑，总强度≥7）
    // 满足则取城镇牌，gain 奖励
}
```

**验收标准（测试优先）**：
- 建造后地图状态正确
- 不可达格子无法建造
- 颜色不符时自动触发改造逻辑
- 城镇检测：4个相邻建筑且强度≥7时触发
- 征收收入压入正确数量的队列项

---

#### Step 3.3：游戏状态机（行动队列与阶段）

**目标**：实现 `view()` 和 `action()` 的核心调度逻辑。  
**对应原文件**：`src/acting.pm`

**RTT 动作处理模式：**

```javascript
// rules.js - view()
exports.view = function(state, role) {
    const G = state
    const V = {
        log: G.log,
        prompt: "",
        // 游戏数据
        map: G.map,
        factions: G.factions,
        round: G.round,
        pool: G.pool,
        scoring_tiles: G.scoring_tiles,
    }

    // 判断当前 role 是否是活跃玩家
    const current = current_actor(G)
    if (current && current.role === role) {
        // 生成当前阶段可用动作
        V.actions = generate_actions(G, role, current)
        V.prompt = generate_prompt(G, role, current)
    } else {
        V.prompt = waiting_prompt(G, role)
    }

    return V
}

// 当前需要行动的玩家（从 action_queue 头部）
function current_actor(G) {
    if (G.action_queue.length > 0) return G.action_queue[0]
    return null  // 游戏等待中或结束
}

// 生成可用动作列表
function generate_actions(G, role, actor) {
    const actions = {}
    switch (actor.type) {
        case "full":         return generate_full_actions(G, role)
        case "leech":        return generate_leech_actions(G, role, actor)
        case "select-faction": return generate_faction_choices(G, role)
        case "place-initial-dwelling": return generate_initial_dwelling_spots(G, role)
        case "select-bonus":  return generate_bonus_choices(G, role)
        // ...
    }
    return actions
}
```

**游戏阶段调度：**

```javascript
// 每次 action() 后更新 action_queue
function advance_state(G) {
    // 移除已处理的队列项
    G.action_queue.shift()

    if (G.action_queue.length > 0) {
        // 队列还有待处理项（如多人 leech），继续
        G.active = G.action_queue[0].role
        return
    }

    // 队列空了，推进游戏阶段
    switch (G.phase) {
        case "select-factions":
            if (all_factions_selected(G)) {
                start_initial_dwellings(G)
            } else {
                queue_next_faction_selection(G)
            }
            break
        case "initial-dwellings":
            if (all_dwellings_placed(G)) {
                start_initial_bonus(G)
            } else {
                queue_next_initial_dwelling(G)
            }
            break
        case "play":
            if (all_passed(G)) {
                end_round(G)
            } else {
                queue_next_full_action(G)
            }
            break
        // ...
    }
}
```

**验收标准（测试优先）**：
- 阶段转换顺序正确：选派系 → 初放居所 → 选奖励 → 收入 → 行动轮
- 征收收入决策插入正确位置（活跃玩家行动后中断）
- 所有玩家 pass 后轮次结束
- 6轮后进入最终计分

---

#### Step 3.4：收入阶段

**目标**：实现轮次开始时的收入计算。  
**对应原文件**：`src/income.pm`

```javascript
function calculate_income(G, role) {
    const faction = G.factions[role]
    const data = faction_data(faction)
    const income = { C: 0, W: 0, P: 0, PW: 0 }

    // 建筑收入（每种建筑按当前等级）
    for (const [btype, info] of Object.entries(data.buildings)) {
        const level = faction.buildings[btype]
        if (level > 0) {
            const bld_income = info.income
            for (const [rtype, curve] of Object.entries(bld_income)) {
                income[rtype] = (income[rtype] || 0) + curve[level]
            }
        }
    }

    // 优待牌收入
    for (const fav_id of faction.favor_tiles) {
        const fav = FAVOR_TILES[fav_id]
        if (fav.income) merge_resources(income, fav.income)
    }

    // 奖励牌收入
    if (faction.bonus_tile) {
        merge_resources(income, BONUS_TILES[faction.bonus_tile].income)
    }

    return income
}
```

**验收标准（测试优先）**：
- 不同建造等级返回正确收入
- 优待牌叠加收入正确
- 未通过奖励（bonus coins）计入模拟正确

---

#### Step 3.5：积分系统

**目标**：实现轮次积分（轮次计分牌触发）和最终积分。  
**对应原文件**：`src/scoring.pm`

```javascript
// 触发轮次计分牌
function score_round_tile(G, role, trigger_type) {
    const tile = G.scoring_tiles[G.round - 1]
    if (!tile || tile.vp_for !== trigger_type) return
    gain(G.factions[role], { VP: tile.vp })
    log(G, `${role} scores ${tile.vp} VP from scoring tile`)
}

// 最终积分（第6轮结束）
function score_final(G) {
    // 资源转换
    for (const role of G.turn_order) {
        convert_resources_to_vp(G, role)
    }

    // 网络排名 (18/12/6 VP)
    score_ranking(G, "network",
        role => compute_network_size(G, role),
        [18, 12, 6])

    // 崇拜轨道排名（每种轨道 8/4/2 VP）
    for (const cult of CULT_TRACKS) {
        score_ranking(G, cult,
            role => G.factions[role][cult],
            [8, 4, 2])
    }
}

function score_ranking(G, name, value_fn, awards) {
    const sorted = G.turn_order
        .map(role => ({ role, value: value_fn(role) }))
        .sort((a, b) => b.value - a.value)
    // 并列共享 VP
    // ...
}

// BFS 计算最大连通网络
function compute_network_size(G, role) {
    const visited = new Set()
    let max_size = 0
    for (const hex of G.factions[role].locations) {
        if (!visited.has(hex)) {
            const size = bfs_component(G, role, hex, visited)
            max_size = Math.max(max_size, size)
        }
    }
    return max_size
}
```

**验收标准（测试优先）**：
- 轮次计分牌只在对应触发类型时结算
- 最终积分按正确比例排名结算（并列分摊处理）
- 网络 BFS 计算正确（含桥接情况）
- 资源转换 VP 不超过汇率

---

#### Step 3.6：特殊派系能力

**目标**：为每种派系实现其特殊机制。  
**对应原文件**：`src/Game/Factions/*.pm`（逐一移植）

按复杂度分批实现：

**第一批（规则简单）：**
- Halflings（极多居所收入）
- Witches（廉价改造）
- Nomads（无固定地形）

**第二批（中等复杂）：**
- Swarmlings（廉价居所）
- Dwarves（隧道穿越）
- Engineers（桥梁）
- Mermaids（河流城镇）

**第三批（高度特殊）：**
- Cultists（征收转崇拜）
- Chaosmagicians（特殊初放）
- Shapeshifters（变色）
- Riverwalkers（沿河移动）
- Dragonlords（权力建造）

**Fire & Ice 扩展（最后实现）：**
- Acolytes, Icemaidens, Yetis

---

### 阶段 4：前端实现

#### Step 4.1：Canvas 地图渲染

**目标**：将 `stc/game.js` 的 Canvas 六边形渲染逻辑移植为 RTT 兼容的 `play.js`。

**关键差异（原 → 新）：**

| 原始方式 | RTT 方式 |
|----------|----------|
| `new Ajax.Request(...)` | 全局 `view` 变量（RTT client.js 注入）|
| 响应时调用 `drawMap()` | `on_update()` 函数内调用绘制 |
| `state.map` 对象 | `view.map` 对象（同结构）|
| CSRF token 手动管理 | RTT 框架自动处理 |
| 命令文本输入框 | `send_action(verb, noun)` |

**play.js 框架：**

```javascript
// play.js — RTT 兼容的客户端

// RTT 框架注入：view（当前视图）、send_action()、action_button()

var canvas, ctx

function on_init(scenario, options, static_view) {
    canvas = document.getElementById("map-canvas")
    ctx = canvas.getContext("2d")
    setup_map_layout()
    setup_event_listeners()
}

function on_update() {
    // RTT 框架在每次 view 更新后调用
    draw_map()
    draw_cult_tracks()
    draw_faction_boards()
    update_action_panel()
}

function draw_map() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const [hex_id, cell] of Object.entries(view.map)) {
        draw_hex(hex_id, cell)
    }
    for (const bridge of view.bridges || []) {
        draw_bridge(bridge)
    }
}

function draw_hex(hex_id, cell) {
    const [x, y] = hex_center(hex_id)
    // 绘制六边形底色（地形颜色）
    // 绘制建筑符号
    // 绘制高亮（可操作格）
    // 绑定点击事件
}

// 点击格子 → 发送动作
function on_hex_click(hex_id) {
    if (view.actions?.build?.includes(hex_id)) {
        send_action("build", hex_id)
    } else if (view.actions?.transform?.includes(hex_id)) {
        send_action("transform", hex_id)
    }
    // ...
}

// RTT 框架的按钮 API
function update_action_panel() {
    document.getElementById("actions").innerHTML = ""
    if (view.actions?.pass) {
        action_button("pass", "Pass")
    }
    if (view.actions?.income) {
        action_button("income", "Take Income")
    }
    // ...
}
```

**验收标准**：
- 游戏地图正确渲染六边形格子
- 建筑符号正确显示（D/TP/TE/SH/SA）
- 点击格子发出正确的 websocket 动作
- 崇拜轨道和派系面板数据更新

---

#### Step 4.2：`play.html` 页面结构

**目标**：创建符合 RTT 规范的游戏页面。

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Age of Innovation</title>
    <link rel="stylesheet" href="/fonts/fonts.css">
    <link rel="stylesheet" href="/common/client.css">
    <link rel="stylesheet" href="play.css">
    <script defer src="/common/client.js"></script>
    <script defer src="play.js"></script>
</head>
<body>
    <header>
        <div id="toolbar">
            <details>
                <summary><img src="/images/cog.svg"></summary>
                <menu>
                    <li><a href="info/rules.html" target="_blank">规则书</a></li>
                </menu>
            </details>
        </div>
    </header>

    <aside>
        <div id="roles"></div>       <!-- RTT 框架填充玩家列表 -->
        <div id="faction-boards"></div>  <!-- 派系面板 -->
        <div id="log"></div>         <!-- RTT 框架填充游戏日志 -->
    </aside>

    <main>
        <div id="map-container">
            <canvas id="map-canvas" width="900" height="600"></canvas>
        </div>
        <div id="cult-tracks"></div>
        <div id="action-panel"></div>
        <div id="scoring-tiles"></div>
    </main>

    <footer id="status"></footer>     <!-- RTT 框架填充提示文字 -->
</body>
</html>
```

---

#### Step 4.3：play.css 样式

**目标**：为游戏界面提供基础样式，沿用 terra-mystica 的配色方案。

```css
/* 地形颜色 */
.terrain-yellow { fill: #e8c84a; }
.terrain-brown  { fill: #8b4513; }
.terrain-black  { fill: #2d2d2d; }
.terrain-blue   { fill: #4169e1; }
.terrain-green  { fill: #228b22; }
.terrain-gray   { fill: #708090; }
.terrain-red    { fill: #cc3300; }
.terrain-white  { fill: #87ceeb; }   /* 河流 */

/* 建筑符号（程序绘制，CSS 辅助） */
.building-symbol { font-family: monospace; }

/* 崇拜轨道 */
#cult-tracks { display: grid; grid-template-columns: repeat(4, 1fr); }
.cult-track .marker { border-radius: 50%; }
```

---

### 阶段 5：集成测试与回归验证

#### Step 5.1：黄金输出测试

**目标**：将 3 个测试游戏文本转换为可验证的黄金输出，作为回归测试基准。

**步骤：**
1. 手工或脚本解析 `test/testgame*.txt` → 提取逐步动作序列
2. 对每个动作，记录期望的游戏状态快照（key fields）
3. 编写测试用例：重放所有动作 → 对比最终状态

```javascript
// test/rules.test.js（用 Node.js 原生 test runner 或 Jest）

import { setup, action, view } from '../rules.js'
import testgame1 from './fixtures/testgame1.json' assert { type: 'json' }

describe("testgame1 replay", () => {
    let state
    beforeAll(() => {
        state = setup(testgame1.seed, "Standard", testgame1.options)
    })

    for (const step of testgame1.steps) {
        test(`Step ${step.seq}: ${step.role} ${step.action}`, () => {
            state = action(state, step.role, step.action, step.arg)
            // 检查关键状态字段
            expect(state.round).toBe(step.expected.round)
            expect(state.factions[step.role].VP).toBe(step.expected.vp)
        })
    }
})
```

---

#### Step 5.2：单元测试套件

按模块细分测试：

```javascript
// test/actions.test.js
describe("build action", () => {
    test("can build on home terrain without terraforming", ...)
    test("cannot build on occupied hex", ...)
    test("cannot build on unreachable hex", ...)
    test("triggers leech for adjacent opponents", ...)
    test("forms town when conditions met", ...)
})

// test/scoring.test.js
describe("final scoring", () => {
    test("network ranking 18/12/6 with no ties", ...)
    test("network ranking with ties distributes VP evenly", ...)
    test("cult ranking 8/4/2 per track", ...)
    test("resources convert at correct rates", ...)
})

// test/setup.test.js
describe("game setup", () => {
    test("same seed always produces same state", ...)
    test("different seeds produce different scoring tiles", ...)
    test("valid JSON serialization roundtrip", ...)
})
```

---

## 测试优先策略评估

以下步骤**高度推荐**采用测试驱动开发（TDD），先写测试再实现：

### 强烈推荐 TDD 的步骤

| 步骤 | 原因 | 测试重点 |
|------|------|---------|
| **Step 3.1 资源系统** | 权力三碗逻辑有微妙边界，资源转换汇率影响所有后续逻辑 | 三碗溢出、7色环形距离、崇拜轨道奖励触发 |
| **Step 3.2 建筑与征收** | 核心互动机制，征收计算错误会导致游戏完全失衡 | 邻接建筑发现、强度计算、队列压入 |
| **Step 3.5 积分系统** | 最终积分计算直接决定胜负，并列分摊逻辑复杂 | 并列排名VP分摊、不同排名梯次 |
| **Step 3.3 状态机** | 阶段转换错误难以调试，影响范围广 | 正常 → 征收 → 继续流程、所有pass后轮次结束 |

### 推荐 TDD 但非强制的步骤

| 步骤 | 推荐程度 | 说明 |
|------|---------|------|
| **Step 1.1 地图数据** | 中等 | 邻接关系静态数据，测试用于验证一致性 |
| **Step 3.4 收入系统** | 中等 | 逻辑相对线性，测试用于不同建造等级的收入验证 |
| **Step 3.6 派系能力** | 高 | 每种派系特殊能力独立，TDD 帮助逐个验证 |
| **Step 5.1 回归测试** | 极高 | 黄金输出测试是所有阶段集成验证的关键 |

### 不推荐 TDD 的步骤

| 步骤 | 原因 |
|------|------|
| **Step 0 骨架搭建** | 主要是文件配置，逻辑极简 |
| **Step 1.2/1.3 数据移植** | 主要是数据转录，人工校对即可 |
| **Step 4.1-4.3 前端渲染** | Canvas 渲染难以自动测试，视觉验证为主 |

---

## 技术风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 地图邻接数据转录错误 | 中 | 高 | 写邻接对称性自动验证 |
| 征收收入排队时序与原版不一致 | 高 | 中 | 用测试游戏文本逐步对照 |
| 特殊派系能力实现不完整 | 高 | 中 | 按批次实现，先上线基础派系 |
| 多人同时行动时 active 状态复杂 | 中 | 高 | 使用 action_queue + RTT active 数组 |
| Canvas 渲染与原版视觉差异 | 低 | 低 | 以功能完整为优先，视觉后期改进 |

---

## 阶段完成里程碑

| 里程碑 | 包含阶段 | 验收条件 |
|--------|---------|---------|
| **M0: 可识别模块** | 阶段0 | RTT 服务器可加载，大厅有游戏，可创建 |
| **M1: 数据完整** | 阶段1 | 地图、派系、牌组数据通过自动校验 |
| **M2: 可开始游戏** | 阶段2 | setup() 正常，可完成派系选择和初始设置 |
| **M3: 核心规则可玩** | 阶段3（3.1-3.5，基础派系）| 2人游戏可完整进行6轮并正确结算 |
| **M4: 全派系支持** | 阶段3（3.6）| 20种派系全部可选可玩 |
| **M5: 完整前端** | 阶段4 | Canvas 地图、崇拜轨道、派系面板正确渲染 |
| **M6: 测试完整** | 阶段5 | 3个测试游戏回归通过，单元测试覆盖率>80% |
