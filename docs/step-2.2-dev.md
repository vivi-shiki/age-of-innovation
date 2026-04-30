# Step 2.2 — Faction Selection & Phase Transition

## Overview

Step 2.2 extends the game-state skeleton created in Step 2.1 with the first
player-facing action: **faction selection**. After all players have chosen their
faction the engine automatically transitions to the **initial dwelling
placement** phase.

Reference source: `src/Acting.pm` (select_faction, start_game) and
`src/Setup.pm` (faction state initialization) in the original Terra Mystica
Perl codebase.

---

## State Machine

```
setup()
  │
  └─► state: "select-factions"
        active: turn_order[0]          ← Player 1 goes first
        ↓  [each player: select_faction]
        ↓  active advances: Player 1 → Player 2 → … → Player N
        ↓  after Player N selects:
      state: "initial-dwellings"
        active: turn_order[0]
        action_queue: snake order      ← P1 P2 … PN  PN … P2 P1
```

---

## API

### `exports.action(G, role, "select_faction", faction_name) → G`

Called once per player during the `"select-factions"` phase.

**Arguments**

| Param          | Type   | Description                                 |
|----------------|--------|---------------------------------------------|
| `faction_name` | string | Key from `FACTIONS`, e.g. `"swarmlings"`    |

**Validation (throws on failure)**

| Error message (regex)             | Condition                                                            |
|-----------------------------------|----------------------------------------------------------------------|
| `Not in faction selection phase.` | `G.state !== "select-factions"`                                      |
| `Faction name must be a non-empty string.` | `typeof faction_name !== "string"` or empty               |
| `Faction '…' is not available.`   | Name not in `G.available_factions` (covers unknown name, F&I factions without option, already-taken factions) |
| `… has already selected a faction.` | `role in G.factions` (secondary guard; in practice `active !== role` fires first) |
| `It is not your turn.`            | Checked by `exports.action` before dispatch, `G.active !== role`    |

**Side effects on G**

1. `G.factions[role]` ← `_init_faction_state(faction_name, faction_def)`
2. `G.available_factions` ← filtered list excluding `faction_name`
3. `G.active` ← `turn_order[idx + 1]`  
   OR if all players have selected: `_begin_initial_dwellings(G)`

---

## Internal Functions

### `_init_faction_state(faction_name, faction_def) → Object`

Builds the per-player runtime state from the static faction definition.
The returned object has **no overlap** with tile definitions or static data —
the engine reads `FACTIONS[fs.faction_name]` at runtime for any static
data it needs (exchange rates, building costs, etc.).

```
Field          Source
─────────────  ─────────────────────────────────────────────────────────
faction_name   passed in
color          faction_def.color  (null for pick_color factions)
C              faction_def.start.C
W              faction_def.start.W
P              faction_def.start.P  || 0
P1             faction_def.start.P1
P2             faction_def.start.P2
P3             faction_def.start.P3 || 0
VP             faction_def.start.VP
KEY            0
FIRE           faction_def.cult_start.FIRE
WATER          faction_def.cult_start.WATER
EARTH          faction_def.cult_start.EARTH
AIR            faction_def.cult_start.AIR
buildings      { D:0, TP:0, TE:0, SH:0, SA:0 }   (count on board)
dig_level      faction_def.dig  ? faction_def.dig.level  : 0
ship_level     faction_def.ship ? faction_def.ship.level : 0
favor_tiles    []
town_tiles     []
bonus_tile     null
passed         false
income_taken   false
actions_used   []                                 (reset each round)
locations      []                                 (hex keys with buildings)
towns          []                                 (hex keys in formed towns)
bridges        []                                 ([{ from, to }, …])
```

**Special cases**

- **Riverwalkers / Shapeshifters** (`pick_color: true`): `color` is `null`.
  A future `pick_color` action (Step 3.x) will set it.
- **Factions with `dig: null`** (Riverwalkers): `dig_level = 0`.
- **Mermaids**: `ship.level = 1`, so `ship_level` starts at 1.
- **Dwarves / Fakirs**: `ship.max_level = 0`; they cannot upgrade shipping.
  `ship_level` is still read from `faction_def.ship.level` (= 0).

### `_begin_initial_dwellings(G)`

Transitions from faction selection to initial dwelling placement.

```javascript
G.state       = "initial-dwellings"
G.action_queue = [...turn_order, ...turn_order.slice().reverse()]
                 .map(role => ({ role, type: "place-dwelling" }))
G.active       = G.action_queue[0].role        // turn_order[0]
```

**Snake order** — each player places exactly 2 dwellings:

| Players | Queue                              |
|---------|------------------------------------|
| 2       | 1 2 2 1                            |
| 3       | 1 2 3 3 2 1                        |
| 4       | 1 2 3 4  4 3 2 1                   |
| 5       | 1 2 3 4 5  5 4 3 2 1               |

The actual `place_dwelling` action is implemented in Step 3.2.

---

## `_actions_for` / `_prompt_for` Changes

| State               | `actions_for` result                             | `prompt_for` result (active role)      |
|---------------------|--------------------------------------------------|----------------------------------------|
| `"select-factions"` | `{ select_faction: G.available_factions.slice() }` | `"Choose your faction."`             |
| `"initial-dwellings"` | `{ place_dwelling: 1 }`                        | `"Place a dwelling on your home terrain."` |

The `select_faction` value is an **array** of available faction name strings,
not a scalar — this is the full option list the client should render.

---

## Test Coverage

File: [test/test-step-2.2.js](../test/test-step-2.2.js) — **183 tests**

| Group | Description                                          | Tests |
|-------|------------------------------------------------------|-------|
| 1     | `select_faction` — basic success (4-player)          | 7     |
| 2     | `select_faction` — all validation error paths        | 9     |
| 3     | Faction state shape — all required fields            | 29    |
| 4     | Resource init — spot-check 8 factions × 13 fields   | 104   |
| 5     | Sequential selection — 4-player turn order           | 7     |
| 6     | Phase transition / action_queue snake order          | 7     |
| 7     | `view()` during and after faction selection          | 5     |
| 8     | Special faction edge cases                           | 7     |
| 9     | Immutability and JSON safety                         | 4     |
| 10    | 2-player full selection cycle (end-to-end)           | 6     |

### Regression results (all prior steps)

| Step | Tests |
|------|-------|
| 0.1  | 26 ✓  |
| 1.1  | 41 ✓  |
| 1.2  | 631 ✓ |
| 1.3  | 442 ✓ |
| 2.1  | 102 ✓ |
| 2.2  | 183 ✓ |

---

## Next Steps

**Step 3.1** — Resource system helpers: power gain (`_gain_power`), worker
spend, exchange rates (alchemists).

**Step 3.2** — Map operations and initial dwelling placement (`place_dwelling`
action): validate home terrain color, mark hex, check adjacency for leech.

**Step 3.3** — Bonus tile selection (reverse order after initial dwellings),
then round 1 income and the main game loop.
