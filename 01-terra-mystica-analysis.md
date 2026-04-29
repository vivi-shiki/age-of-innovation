# Terra Mystica 项目深度分析

> 本文档对 terra-mystica 开源项目进行全面解析，作为迁移到 RTT 服务器的参考基础。

---

## 一、项目概述

Terra Mystica 是 Jens Snellman 开发的完整在线桌游平台，支持最受欢迎的重度桌游玩法之一——《神秘大地》（Terra Mystica）及其扩展《火与冰》（Fire & Ice）。

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端语言 | Perl（PSGI/FastCGI，基于 Plack 框架） |
| OOP 框架 | Moose（Perl 面向对象）|
| 数据库 | PostgreSQL（完整规范化设计）|
| 前端库 | Prototype.js 1.7.1（AJAX 封装） |
| 地图渲染 | HTML Canvas API（程序化绘图）|
| 入口点 | `app.psgi`（Web）/ `app.fcgi`（FastCGI）/ `tracker.pl`（CLI）|

### 核心特性

- **完整规则强制校验**：所有游戏操作在服务端完整验证
- **异步对局**：Play-by-web 模式，无实时连接要求
- **命令流设计**：全游戏状态可由命令文本流完全重建（确定性回放）
- **20 种基础派系 + 扩展**：每种派系有独特规则
- **ELO 评分系统**：完整玩家排名
- **地图编辑器**：支持自定义地图变体

---

## 二、目录结构详解

```
terra-mystica/
├── src/                    # 核心游戏引擎（Perl）
│   ├── tracker.pl          # CLI 入口：读取 gameid → 评估游戏 → 输出 JSON
│   ├── tracker.pm          # 游戏状态引擎（主模块）
│   ├── acting.pm           # 状态机 & 行动队列管理（Moose）
│   ├── commands.pm         # 所有命令执行器（>1000行）
│   ├── scoring.pm          # 积分计算（轮次 + 最终）
│   ├── resources.pm        # 资源系统（收入/消耗/转换）
│   ├── income.pm           # 收入阶段逻辑
│   ├── map.pm              # 六边形地图系统
│   ├── towns.pm            # 城镇判定系统
│   ├── buildings.pm        # 建筑代码别名映射
│   ├── cults.pm            # 崇拜轨道设置
│   ├── ledger.pm           # 游戏历史账本（Moose）
│   ├── Game/
│   │   ├── Constants.pm    # 全局常量、积分配置、动作配置
│   │   ├── Events.pm       # 事件追踪（Moose）
│   │   ├── Factions.pm     # 派系初始化
│   │   └── Factions/       # 20 个基础派系 + 扩展（每个独立文件）
│   ├── Server/             # HTTP 路由 & 请求处理器（12+ 模块）
│   ├── DB/                 # 数据库访问层（12 模块）
│   ├── Util/               # 工具类（加密、配置、HTTP 工具等）
│   └── Analyze/            # ELO 评分、胜率预测
├── pages/
│   ├── content/            # 页面模板（纯 Perl 脚本，20+页面）
│   └── layout/             # 公共布局（侧栏、顶栏）
├── stc/                    # 前端静态资源
│   ├── game.js             # 游戏主渲染（Canvas 地图、建筑、崇拜轨道）
│   ├── common.js           # 公共工具（AJAX、CSRF、标签管理）
│   ├── map.js              # 地图查看 & 编辑
│   ├── style.css           # 主样式表
│   └── ...（其他功能页面 JS）
├── schema/
│   └── schema.sql          # PostgreSQL 数据库 Schema
├── config/
│   └── config-example.json # 配置示例
└── test/
    ├── testgame1.txt        # 完整5人游戏测试样本
    ├── testgame2.txt
    └── testgame3.txt
```

---

## 三、数据库 Schema

### 核心表结构

```sql
-- 用户账户
player (username PK, password, displayname)
email  (address UNIQUE, player FK, is_primary, validated)

-- 游戏实例
game (
    id TEXT PK,
    write_id TEXT,              -- 追加写入令牌
    finished BOOL,
    aborted BOOL,
    player_count INT,
    round INT,                  -- 当前轮次 (0-6)
    turn INT,
    commands TEXT,              -- 游戏命令流（核心！）
    game_options TEXT[],
    base_map FK,
    metadata JSON,
    last_update TIMESTAMP
)

-- 玩家-游戏关联
game_player (game FK, player FK, sort_key, index)

-- 派系分配
game_role (
    game FK,
    faction TEXT,               -- 派系名（如 'swarmlings'）
    faction_player FK,
    action_required BOOL,       -- 是否等待此玩家行动
    leech_required BOOL,        -- 是否等待征服收入决策
    vp INT,
    rank INT,
    dropped BOOL
)

-- 聊天记录
chat_message (id UUID, game FK, faction, message, posted_at)

-- 评分
player_ratings (player FK, rating INT)

-- 地图变体
map_variant (id, terrain TEXT, vp_variant)
```

### 关键设计：命令流存储

Terra Mystica 将**完整命令文本**存储在 `game.commands` 字段，而非游戏状态快照。  
每次需要展示游戏时，服务端从头重建游戏状态：

```
commands = """
setup Nomads
setup Swarmlings
Nomads: Build A5
Swarmlings: Build B4
Nomads: income
Swarmlings: income
...
"""
```

这保证了游戏状态的完全确定性和可回放性，但每次请求都有 O(n) 的重建成本。

---

## 四、游戏状态机（acting.pm）

### 游戏阶段序列

```
wait-for-players
    ↓  （所有玩家就位）
select-factions
    ↓  （所有派系选定）
post-setup
    ↓  （初始化设置）
initial-dwellings
    ↓  （玩家轮流放置起始居所×2）
initial-bonus
    ↓  （逆序选取起始奖励牌）
income          ←────────────────────┐
    ↓                                │
use-income-spades（使用收入铲子）     │
    ↓                                │
income-terrain-unlock（解锁地形）     │
    ↓                                │
play（6轮正式游戏轮次）               │
    ↓  （本轮所有玩家均 Pass）        │
───────────────────────────────────┘
    ↓  （6轮结束）
finish（最终计分）
```

### 行动队列机制

acting.pm 维护一个 **行动队列**（`action_required` 列表），每条记录包含：
- `type`：`full`（完整行动）/ `leech`（征服收入决策）/ `subaction`
- `faction`：需要行动的派系名
- 附加参数（如 leech 的金额、来源派系）

状态机逻辑（`what_next()`）每次处理完一个命令后检查队列，决定下一个需要行动的玩家。

---

## 五、游戏核心机制

### 5.1 资源系统

**资源类型：**

| 代码 | 名称 | 说明 |
|------|------|------|
| C | 金币 | 通用货币 |
| W | 工人 | 建造消耗 |
| P | 祭司 | 发送到崇拜轨道 |
| PW | 权力 | 三碗系统（P1/P2/P3） |
| VP | 胜利点 | 最终获胜依据 |
| SPADE | 铲子 | 地形改造次数 |
| FREE_TF | 免费改造 | 特殊能力 |
| KEY | 钥匙 | 崇拜轨道第10格特殊资源 |

**权力三碗系统：**
```
P1（空碗）→ P2（半碗）→ P3（满碗）
每获得 N 点权力：从 P1 移 N 枚到 P2，P2 移满再到 P3
消耗权力：从 P3 取，烧毁时从 P2 取（P2→P1，VP-1/枚）
```

**资源转换汇率（默认）：**
```
3 PW → 1 C（权力转金币）
1 W  → 1 C（工人转金币）
1 P  → 1 C（祭司转金币）
3 C  → 1 VP（金币转胜利点）
```

### 5.2 建筑系统

**建筑类型（升级链）：**
```
D（居所）→ TP（交易站）→ TE（庙宇）→ SH（强化建筑，与TE互斥）
                       ↘ SA（圣地，与TE互斥）
```

**建筑等级与收入：**每种派系对每类建筑有不同的收入曲线（建造数量越多，收入越高）。

**建筑强度（征服收入计算）：**
```
D = 1, TP/TE = 2, SH/SA = 3
```

**地形改造（Terraforming）：**
```
7色环形：黄→棕→黑→蓝→绿→灰→红→黄
改造成本 = 颜色距离 × 铲子成本
```

### 5.3 征服收入（Leeching）

当某玩家建造/升级建筑时，相邻格子的其他派系可以"征服"权力：
1. 计算每个相邻派系的最大可征服量（建筑强度总和）
2. 对每个可征收派系，系统排队一个 `leech` 行动
3. 玩家决定：接受全部 / 接受部分 / 拒绝
4. 接受 N 点权力：移动 N 枚令牌（P1→P2），支付 VP（N-1 点）

### 5.4 崇拜轨道

**4 种基础崇拜：** FIRE、WATER、EARTH、AIR  
每种轨道 0-10 格，到达特定格位获得奖励：
- 第 3 格：+1 权力
- 第 5 格：+2 权力  
- 第 7 格：+2 权力
- 第10格：+3 权力（需消耗 KEY，且最多1人到达）

**晋升方式：**
- 发送祭司（每次消耗 1 P，前进 2/2/1 步）
- 某些派系能力可额外前进
- 部分奖励牌和收入轨道可提供崇拜前进

### 5.5 城镇系统

形成城镇的条件：
- 权力 ≥ 7
- 建筑数量 ≥ 4
- 所有建筑必须相互相邻（连通）

城镇形成时立即：
- 从城镇牌堆取一张城镇牌（提供即时奖励和持续收入）
- 不同城镇牌提供不同奖励（权力/金币/祭司/胜利点等）

### 5.6 轮次计分

每轮开始有 1 张**轮次计分牌**，在该轮内每次触发特定行为时积分：
- 建造居所 +VP
- 升级交易站 +VP
- 升级庙宇/修道院 +VP
- 发展地形 +VP（崇拜前进）

### 5.7 最终计分

第 6 轮结束后：
1. **资源转换**：剩余 W/P/C 按汇率转 VP
2. **网络排名**：最大连通建筑群 → 18/12/6 VP
3. **崇拜轨道排名**：每条轨道 → 8/4/2 VP（并列共享）

---

## 六、派系系统

### 20 种基础派系

| 派系 | 颜色 | 地形 | 特色机制 |
|------|------|------|---------|
| Nomads | 黄色 | 沙漠 | 无固定地形，可任意建造 |
| Alchemists | 黑色 | 沼泽 | 可将 VP 换资源 |
| Darklings | 黑色 | 沼泽 | 祭司换铲子 |
| Swarmlings | 黑色 | 沼泽 | 超便宜居所，扩张快 |
| Engineers | 灰色 | 山地 | 廉价桥梁，桥接相邻 |
| Dwarves | 灰色 | 山地 | 隧道穿越，无航运 |
| Fakirs | 黄色 | 沙漠 | 低铲子成本，移动能力 |
| Halflings | 棕色 | 平原 | 极多居所，超收入 |
| Auren | 绿色 | 森林 | 远程传送，好友效果 |
| Witches | 绿色 | 森林 | 快速建造，低 TF 成本 |
| Giants | 红色 | 火山 | 建筑更强，隐藏力量 |
| Chaosmagicians | 红色 | 火山 | 特殊初放，复杂能力 |
| Cultists | 棕色 | 平原 | 征收转崇拜，无需祭司 |
| Mermaids | 蓝色 | 湖泊 | 河流城镇，水上特权 |
| Riverwalkers | 蓝色 | 湖泊 | 沿河移动，特殊建造 |
| Shapeshifters | 棕色 | 平原 | 变色能力，灵活建造 |
| Icemaidens | 蓝色 | 湖泊 | 火与冰扩展 |
| Yetis | 白色 | 冻原 | 火与冰扩展 |
| Acolytes | 白色 | 冻原 | 火与冰扩展 |
| Dragonlords | 红色 | 火山 | 特殊权力消耗建造 |

### 派系数据结构（Perl `%faction`）

```perl
{
  name => 'swarmlings',
  color => 'black',             # 本色地形颜色
  C => 10, W => 5,              # 初始资源
  P1 => 4, P2 => 3, P3 => 0,   # 初始权力三碗
  VP => 20,                      # 起始胜利点
  
  buildings => {
    D  => { level => 0, max_level => 8, advance_cost => {W:1,C:2},
            income => {W: [1,2,3,4,5,6,7,8]} },
    TP => { level => 0, max_level => 4, ... },
    TE => { level => 0, max_level => 3, ... },
    SH => { level => 0, max_level => 1, ... },
    SA => { level => 0, max_level => 1, ... },
  },
  
  dig => { level => 1, max_level => 2,
           cost => [{W:3},{W:2},{W:1}] },   # 铲子升级
  ship => { level => 0, max_level => 3,
            cost => [{C:4},{C:4},{C:4}] },   # 航运升级
  
  FIRE => 0, WATER => 0, EARTH => 0, AIR => 0,  # 崇拜初值
  
  exchange_rates => { PW => {C:1}, W => {C:1}, P => {C:1}, C => {VP:3} },
  
  locations => [],              # 已建造位置列表
}
```

---

## 七、地图系统

### 六边形地图

Terra Mystica 使用偏移坐标系（offset coordinates），地图格用字母+数字命名（如 A1、B3）。

- 标准地图约 9 行 × 13 列（113 个可用格）
- 每格有颜色（7 种地形颜色 + 河流 white）
- 河流格用 `r0, r1, r2...` 命名

### 邻接关系

```perl
$map{A1}{adjacent} = { B1 => 1, A2 => 1, ... }

# 航运范围（跨河）：range 字段
$map{A1}{range} = {
  0 => { B1 => 1, C3 => 2 },    # 直接相邻（距离1/2）
  1 => { r0 => 1, D4 => 3 },    # 跨河（通过河流格）
}
```

### Canvas 六边形渲染

```javascript
// game.js 中的六边形计算
var hex_size = 35;
var hex_width = Math.cos(Math.PI / 6) * hex_size * 2;
var hex_height = Math.sin(Math.PI / 6) * hex_size + hex_size;

function hexCenter(row, col) {
    var x_offset = row % 2 ? hex_width / 2 : 0;
    var x = 5 + hex_size + col * hex_width + x_offset;
    var y = 5 + hex_size + row * hex_height;
    return [x, y];
}
```

### 地图变体

通过 `map_variant` 表存储地图的地形字符串编码，支持官方变体和玩家自定义地图。

---

## 八、前端架构

### 通信协议（AJAX POST）

```
客户端 → /app/append-game/
POST: { gameid, commands: "Swarmlings: Build A5", csrf-token }

← JSON 响应:
{
  "map":    { "A1": {color, building, ...}, ... },
  "factions": { "swarmlings": {...}, ... },
  "action_required": [
    { "type": "full",  "faction": "nomads" },
    { "type": "leech", "faction": "swarmlings", "amount": 1 }
  ],
  "pool": {...},
  "ledger": [...],
  "round": 1,
  "turn": 5,
  "finished": false,
  "error": []
}
```

### 命令格式

玩家操作以**纯文本命令**提交：
```
Swarmlings: Build A5
Nomads: Dig 2. Build B6. Pass Bon3
Swarmlings: Leech 2 from Nomads
Auren: Upgrade G4 to TP. +2tw
Fakirs: Action ACT4
Nomads: Convert 3C to 1VP
Swarmlings: Send P to FIRE
```

### 渲染流程

1. 接收 JSON → 解析 `action_required` 队列
2. 判断当前登录玩家是否需要行动
3. 高亮可操作格子（可建造/可改造/可征服）
4. 渲染 Canvas 地图（`drawMap()`）
5. 更新侧边栏（派系资源、VP、崇拜轨道）
6. 渲染账本历史（`drawLedger()`）

---

## 九、命令解析器

命令文本由 `tracker.pm::clean_commands()` 解析：

```
输入文本 → 清理 → 分词 → 派发到 command_* 函数

"Nomads: Build A5. Upgrade A5 to TP"
→ [ ["nomads"], "build", "a5" ]
→ [ ["nomads"], "upgrade", "a5", "tp" ]

"Swarmlings: Leech 1 from Nomads"
→ [ ["swarmlings"], "leech", "1", "from", "nomads" ]

"Swarmlings: Dig 2. Build B6"
→ [ ["swarmlings"], "dig", "2" ]
→ [ ["swarmlings"], "build", "b6" ]
```

---

## 十、测试结构

3 个测试游戏文本（`test/testgame1-3.txt`），包含完整游戏命令流，可作为：
- 规则正确性验证的回归样本
- 边界情况（早 pass、泥池转换、特殊派系）的覆盖
- 移植验证的 golden output 测试

---

## 十一、与迁移相关的关键特征

| 特征 | 说明 | 迁移影响 |
|------|------|---------|
| **纯命令流设计** | 状态完全由命令文本重建 | → 可移植为 RTT replay 机制 |
| **同步 AJAX** | 无实时连接，每次刷新即响应 | → RTT WebSocket 替换 |
| **Perl 全量重建** | 每请求从头重建游戏 | → RTT 按动作增量更新 |
| **PostgreSQL** | 存储命令流 + 元数据 | → RTT SQLite 存储 JSON 状态 |
| **Canvas 绘图** | 无贴图，程序化渲染 | → 可直接复用地图绘制逻辑 |
| **纯文本命令** | 玩家输入命令字符串 | → 改为 RTT actions 对象格式 |
| **多人（2-5）** | 动态角色数 | → RTT 支持动态 roles |
| **CSRF 保护** | 前端 token 机制 | → RTT 服务端已处理 |
| **评分系统** | ELO + 统计 | → 不迁移（RTT 有自己的系统）|
| **邮件通知** | 更新通知邮件 | → 不迁移（RTT 内置）|
