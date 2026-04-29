# Step 1.1 开发文档 — 地图数据移植

> **阶段**：1（静态数据层）  
> **步骤**：1.1  
> **状态**：✅ 完成  
> **测试**：41 / 41 通过

---

## 目标

将 terra-mystica 的标准地图定义从 Perl（`src/Game/Constants.pm` 的 `@base_map` + `src/map.pm` 的邻接算法）完整迁移为 JavaScript，输出 `data/map.js`。

---

## 数据来源

| 原文件 | 内容 |
|--------|------|
| `terra-mystica/src/Game/Constants.pm` | `@base_map` 原始地形数组、`@colors` 颜色轮 |
| `terra-mystica/src/map.pm` | `setup_base_map()`（解析坐标）、`setup_direct_adjacencies()`（邻接计算） |

---

## 交付文件

| 文件 | 说明 |
|------|------|
| `data/map.js` | 标准地图完整数据模块 |
| `test/test-step-1.1.js` | Step 1.1 全部验收测试 |

---

## 地图结构

### 标准地图规格

| 属性 | 值 |
|------|----|
| 行数（ROW_LABELS） | 9（A–I） |
| 列位置数（MAP_COLS） | 13（每行最多 13 个位置） |
| 陆地格数 | 77 |
| 河流格数 | 36（r0–r35） |
| 总格数 | 113 |

### 各行陆地格分布

| 行 | 陆地格数 | 键名范围 | 备注 |
|----|----------|---------|------|
| A | 13 | A1–A13 | 顶行，无河流 |
| B | 6  | B1–B6  | 含 6 个河流格 |
| C | 5  | C1–C5  | 含 8 个河流格 |
| D | 8  | D1–D8  | 含 4 个河流格 |
| E | 11 | E1–E11 | 含 2 个河流格 |
| F | 7  | F1–F7  | 含 5 个河流格 |
| G | 7  | G1–G7  | 含 6 个河流格 |
| H | 8  | H1–H8  | 含 4 个河流格 |
| I | 12 | I1–I12 | 底行，含 1 个河流格 |

---

## 地图数据格式

### MAP_HEXES

每个格子用键值对表示：

```javascript
// 陆地格示例
"A1": { color: "brown", row: 0, col: 0, river: false }

// 河流格示例
"r0": { color: "white", row: 1, col: 1, river: true }
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `color` | string | 地形颜色（7 种陆地 + "white" 表示河流） |
| `row` | integer | 行索引（0-based，A=0 … I=8） |
| `col` | integer | 列位置索引（0-based，行内原始位置） |
| `river` | boolean | 是否为河流格 |

### REVERSE_MAP

通过行列坐标反查键名：

```javascript
REVERSE_MAP[0][0]  // → "A1"
REVERSE_MAP[1][1]  // → "r0"
```

### ADJACENCY

每个格子的直接邻接格列表（无序，双向一致）：

```javascript
ADJACENCY["A1"]  // → ["A2", "B1"]
ADJACENCY["r0"]  // → ["B1", "r1", ...]
```

---

## 邻接算法

移植自 `src/map.pm → setup_direct_adjacencies()`，采用**偏移六边形坐标**：

```javascript
// 同行邻居（左右）
add(row, col + 1)
add(row, col - 1)

// 斜向邻居：偶数行（A/C/E/G/I）左偏一格
const dc = (row % 2 === 0) ? col - 1 : col
add(row - 1, dc)     // 左上
add(row - 1, dc + 1) // 右上
add(row + 1, dc)     // 左下
add(row + 1, dc + 1) // 右下
```

**关键约定**：`col` 是行内的**原始列索引**（包含河流格的位置），不是陆地格的 1-based 计数。这确保邻接算法与 Perl 原版完全一致。

### 重要：B1 与 B2 不相邻

```
行B: yellow  x    x    brown black ...
col:   0     1    2    3     4
键:   B1    r0   r1    B2    B3
```

B1（col=0）的同行邻居是 r0（col=1），而不是 B2（col=3）。B1 到 B2 需要通过 r0、r1 中转，在规则层面属于"航运可达"而非"直接邻接"。

---

## 导出接口

```javascript
const {
    MAP_HEXES,    // { key: {color, row, col, river} }  — 全部113格
    REVERSE_MAP,  // { row: { col: key } }              — 坐标反查
    ADJACENCY,    // { key: string[] }                  — 邻接表
    ROW_LABELS,   // ["A","B","C","D","E","F","G","H","I"]
    MAP_ROWS,     // 9
    MAP_COLS,     // 13
    RIVER_COUNT,  // 36
    TERRAIN_COLORS, // ["yellow","brown","black","blue","green","gray","red"]
    COLOR_WHEEL,  // 地形颜色轮（顺序用于改造距离计算）
} = require("./data/map.js")
```

---

## 测试说明

测试文件：`test/test-step-1.1.js`

```bash
node test/test-step-1.1.js
```

### 测试覆盖范围

| 类别 | 测试数 | 主要断言 |
|------|--------|---------|
| 地图常量 | 5 | MAP_ROWS=9, MAP_COLS=13, RIVER_COUNT=36, ROW_LABELS, COLOR_WHEEL |
| 格子计数 | 4 | 总113格、陆地77格、河流36格、r0-r35连续 |
| 各行陆地格数 | 9 | 每行精确数量 |
| 地形颜色 | 3 | 陆地格颜色合法、河流格为white、TERRAIN_COLORS完整 |
| 坐标完整性 | 4 | row/col为整数、在范围内、REVERSE_MAP双向一致 |
| 邻接完整性 | 7 | 全覆盖、无重复、双向性、无自邻接、目标存在、边角格、最大6邻居 |
| 已知邻接验证 | 8 | 具体格子对的邻接正确性（含负例） |
| **合计** | **41** | 全部通过 ✅ |

### 关键断言

```javascript
// 双向邻接
for (const [key, neighbors] of Object.entries(ADJACENCY)) {
    for (const nb of neighbors)
        assert.ok(ADJACENCY[nb].includes(key))
}

// REVERSE_MAP 可逆
for (const [key, hex] of Object.entries(MAP_HEXES))
    assert.strictEqual(REVERSE_MAP[hex.row][hex.col], key)

// 精确格数
assert.strictEqual(LAND_KEYS.length, 77)
assert.strictEqual(RIVER_KEYS.length, 36)
```

---

## 验收标准（已满足）

- [x] 所有格子的邻接关系通过双向一致性测试
- [x] 河流格数量与官方地图吻合（36 格）
- [x] 9 行 × 13 列格子均有正确颜色
- [x] 各行陆地格数量与原始 `@base_map` 数据精确匹配
- [x] 所有邻接目标格均存在（无悬空引用）
- [x] 每格最多 6 个邻接格（六边形约束）
- [x] 41 项测试全部通过

---

## 下一步使用方式

后续 `rules.js` 在 `setup()` 中初始化地图状态：

```javascript
const { MAP_HEXES } = require("./data/map.js")

function setup(seed, scenario, options) {
    // 深拷贝地图，添加游戏状态
    const map = {}
    for (const [key, hex] of Object.entries(MAP_HEXES)) {
        map[key] = { ...hex, building: null, faction: null, bridge: [] }
    }
    return { …, map }
}
```

建造/改造时通过 `ADJACENCY[hex]` 查找合法建造位置，通过 `REVERSE_MAP` 从像素坐标转换回格子键名。
