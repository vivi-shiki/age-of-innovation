# Step 3.1 — 资源系统

> **目标**：实现资源帮助函数；这些函数是后续所有派系行动（建造、升级、改造、收入）的基础。  
> **对应原文件**：`src/resources.pm`  
> **交付**：`rules.js`（内部函数 + `exports._test` 暴露）  
> **测试**：`test/test-step-3.1.js`（93 项，全部通过）

---

## 函数一览

### `_gain_power(fs, amount)`

将权力令牌从低碗向高碗推进，模拟 Terra Mystica 的三碗系统：

```
P1（空碗）→ P2（半碗）→ P3（满碗）
```

- 先从 P1 推入 P2，再用剩余量从 P2 推入 P3。
- P1/P2 令牌不足时，溢出量静默丢弃（碗只有固定数量的令牌）。
- 返回实际推进的令牌数量（可能 < amount）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `fs` | object | 派系运行时状态（`G.factions[role]`）|
| `amount` | number | 要推进的权力点 |
| 返回值 | number | 实际推进的令牌数 |

---

### `_advance_cult(fs, cult, amount)`

在指定崇拜轨道上前进 `amount` 步，上限为 10。

- 越过阈值时触发权力奖励（通过 `_gain_power`）：

| 越过阈值 | 权力奖励 | 其他 |
|---------|---------|------|
| 2 → 3  | +1 PW  | —    |
| 4 → 5  | +2 PW  | —    |
| 6 → 7  | +2 PW  | —    |
| 9 → 10 | +3 PW  | 消耗 1 KEY |

- 到达第 10 格需要持有并消耗 1 个 KEY；若无 KEY 则封顶在 9，不继续前进。
- 返回实际前进步数（`new_val - old_val`）。

---

### `_gain(fs, resources)`

通用资源发放函数，按资源类型分派：

| 资源键 | 处理方式 |
|--------|---------|
| `PW` | `_gain_power(fs, amount)` — 三碗推进 |
| `FIRE` / `WATER` / `EARTH` / `AIR` | `_advance_cult(fs, cult, amount)` — 含阈值奖励 |
| 其余（`C`, `W`, `P`, `VP`, `KEY`, `TOWN_SIZE`, …）| 直接加法：`fs[type] += amount` |

- 非正数量（≤ 0 或缺失）直接跳过，不做任何操作。
- `TOWN_SIZE: -1` 等特殊键通过直接加法写入 `fs`，引擎层后续读取使用。

---

### `_pay(fs, resources)`

**原子扣除**资源，先验证所有入口再批量扣减：

- 阶段 1（验证）：对所有资源检查充足性；任意一项不足则整体报错，**不执行任何扣减**。
- 阶段 2（扣减）：全部通过后才实际扣减——保证原子性，不存在半途失败的部分扣减。
- `PW` 从 P3 扣除，扣除的令牌归还 P1，符合游戏规则的权力消耗语义。

**Throws**: `"Not enough {type}: need {need}, have {have}."`

---

### `_terraform_distance(from_color, to_color)`

计算两种地形颜色在改造色轮（7 色环）上的最短弧长，范围 0–3。

色轮顺序（循环）：
```
yellow → brown → black → blue → green → gray → red → yellow
```

- 相同颜色返回 0。
- 距离取两个方向弧长的最小值（最大 3）。
- 未知颜色抛出 `"Unknown terrain color: '...'"`。

---

### `_terraform_cost(from_color, to_color, faction_def, dig_level)`

计算将一个格子从 `from_color` 改造到 `to_color` 的花费对象。

- 花费 = `_terraform_distance × dig.cost[dig_level]`（每铲花费）。
- `dig.cost[level]` 可以是任意资源类型，函数逐键乘以距离：

| 派系 | `dig.cost[0]` | 含义 |
|------|--------------|------|
| 标准派系 | `{ W: 3 }` | 每铲花 3 W |
| 暗灵（Darklings）| `{ P: 1 }` | 每铲花 1 P（祭司）|
| 变化者（Shapeshifters）| `{ W: 3 }` | 固定 3 W/铲 |
| 轻使（Acolytes）| `{}` | 火山机制，零花费 |

- 同色（距离 0）返回 `{}`，即零花费。

---

## 验收测试（93 项，全部通过）

| 测试组 | 项数 | 覆盖内容 |
|--------|------|---------|
| 1: `_gain_power` | 12 | 正常推进、P1 耗尽后继续推 P3、P2 已满溢出、所有碗全满、返回值 |
| 2: `_advance_cult` | 20 | 正常前进、阈值权力奖励（3/5/7/10）、KEY 消耗、无 KEY 封顶在 9、一次越过多阈值、返回值 |
| 3: `_gain` | 14 | PW 路由、崇拜路由、普通资源加法、多资源同时发放、零量/负量跳过 |
| 4: `_pay` | 16 | 正常扣减、PW 从 P3 扣除返还 P1、各资源不足时报错（原子性）、多资源同时校验 |
| 5: `_terraform_distance` | 18 | 同色为 0、相邻为 1、跨环（取短路）、最大距离 3、未知颜色报错 |
| 6: `_terraform_cost` | 13 | 同色返回 {}、标准铲费乘距离、暗灵祭司花费、轻使零花费、升级等级影响费用 |

---

## Test-only 暴露

所有函数通过 `exports._test` 暴露给测试文件（不属于 RTT 公开 API）：

```javascript
exports._test = {
    _gain_power,
    _gain,
    _pay,
    _advance_cult,
    _terraform_distance,
    _terraform_cost,
}
```

---

## 与原 Perl 的主要差异

1. **原子性保证**：Perl 中 `pay()` 通常由调用方预先校验，JS 版本在 `_pay` 内部实现原子两阶段校验。
2. **溢出令牌静默丢弃**：`_gain_power` 不会凭空增加令牌总数；超出碗容量的量被忽略，符合实物桌游语义。
3. **`_terraform_cost` 通用化**：不假设花费只有 W，直接按 `dig.cost[level]` 的键值对乘以距离，兼容所有派系特殊铲费。
4. **`TOWN_SIZE` 通过 `_gain` 写入**：FAV5 的 `{ TOWN_SIZE: -1 }` 作为普通资源处理，存入 `fs.TOWN_SIZE`，城镇判定时读取。
