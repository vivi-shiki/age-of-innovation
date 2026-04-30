"use strict"

// ============================================================
// Age of Innovation — test/test-step-2.1.js
// Verifies the full game-state structure produced by setup().
// Focus: G layout, map init, tile pool counts, scoring selection.
// Run: node test/test-step-2.1.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))

const { MAP_HEXES } = require(path.join(__dirname, "..", "data", "map.js"))
const {
    BONUS_TILES, FAVOR_TILES, TOWN_TILES, SCORING_TILES,
    BONUS_TILE_NAMES, FAVOR_TILE_NAMES, TOWN_TILE_NAMES, SCORING_TILE_NAMES,
} = require(path.join(__dirname, "..", "data", "tiles.js"))
const { POWER_ACTIONS } = require(path.join(__dirname, "..", "data", "constants.js"))
const { BASE_FACTIONS, FIRE_ICE_FACTIONS } = require(path.join(__dirname, "..", "data", "factions.js"))

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
    try {
        fn()
        console.log(`  ✓ ${name}`)
        passed++
    } catch (err) {
        console.error(`  ✗ ${name}`)
        console.error(`    ${err.message}`)
        failed++
        failures.push({ name, err })
    }
}

function group(label, fn) {
    console.log(`\n── ${label}`)
    fn()
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SEED     = 42
const SCENARIO = "Standard"
const OPTS_4P  = { players: "4", map: "standard" }
const OPTS_2P  = { players: "2", map: "standard" }
const OPTS_5P  = { players: "5", map: "standard" }
const OPTS_FI  = { players: "4", map: "standard", fire_ice: true }

let G4, G2, G5, GFI

// ─────────────────────────────────────────────────────────────────────────────
group("0: setup() does not throw", () => {
    test("4-player game", () => { G4 = RULES.setup(SEED, SCENARIO, OPTS_4P); assert.ok(G4) })
    test("2-player game", () => { G2 = RULES.setup(SEED, SCENARIO, OPTS_2P); assert.ok(G2) })
    test("5-player game", () => { G5 = RULES.setup(SEED, SCENARIO, OPTS_5P); assert.ok(G5) })
    test("fire_ice option", () => { GFI = RULES.setup(SEED, SCENARIO, OPTS_FI); assert.ok(GFI) })
})

// ─────────────────────────────────────────────────────────────────────────────
group("1: All required top-level fields are present", () => {
    const REQUIRED = [
        // RTT
        "seed", "active", "result", "log", "undo",
        // metadata
        "scenario", "options",
        // progress
        "state", "round", "turn", "action_queue",
        // turn order
        "turn_order", "next_turn_order",
        // factions
        "available_factions", "factions",
        // board
        "map", "bridges",
        // tiles
        "pool",
        // scoring
        "scoring_tiles", "current_scoring_tile",
    ]
    for (const field of REQUIRED) {
        test(`G has '${field}'`, () => assert.ok(field in G4, `Missing field: ${field}`))
    }
})

// ─────────────────────────────────────────────────────────────────────────────
group("2: RTT required fields", () => {
    test("seed is a positive number (MLCG advanced it during setup)", () => {
        assert.strictEqual(typeof G4.seed, "number")
        assert.ok(G4.seed > 0)
    })
    test("active is 'Player 1'", () => assert.strictEqual(G4.active, "Player 1"))
    test("result is null", () => assert.strictEqual(G4.result, null))
    test("log is an empty array", () => {
        assert.ok(Array.isArray(G4.log))
        assert.strictEqual(G4.log.length, 0)
    })
    test("undo is an array", () => assert.ok(Array.isArray(G4.undo)))
})

// ─────────────────────────────────────────────────────────────────────────────
group("3: Game metadata", () => {
    test("scenario matches", () => assert.strictEqual(G4.scenario, SCENARIO))
    test("options.players === 4 for 4-player game", () => assert.strictEqual(G4.options.players, 4))
    test("options.players === 2 for 2-player game", () => assert.strictEqual(G2.options.players, 2))
    test("options.map === 'standard'", () => assert.strictEqual(G4.options.map, "standard"))
    test("options.fire_ice is false for base game", () => assert.strictEqual(G4.options.fire_ice, false))
    test("options.fire_ice is true when set", () => assert.strictEqual(GFI.options.fire_ice, true))
})

// ─────────────────────────────────────────────────────────────────────────────
group("4: Game-progress fields", () => {
    test("state is 'select-factions'", () => assert.strictEqual(G4.state, "select-factions"))
    test("round === 0", () => assert.strictEqual(G4.round, 0))
    test("turn === 0", () => assert.strictEqual(G4.turn, 0))
    test("action_queue is an empty array", () => {
        assert.ok(Array.isArray(G4.action_queue))
        assert.strictEqual(G4.action_queue.length, 0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("5: Turn order", () => {
    test("turn_order has 4 entries for 4-player game", () => assert.strictEqual(G4.turn_order.length, 4))
    test("turn_order has 2 entries for 2-player game", () => assert.strictEqual(G2.turn_order.length, 2))
    test("turn_order matches roles()", () => {
        const roles = RULES.roles(SCENARIO, OPTS_4P)
        assert.deepStrictEqual(G4.turn_order, roles)
    })
    test("turn_order is a copy (mutating it does not affect roles)", () => {
        const copy = G4.turn_order.slice()
        G4.turn_order.push("Extra")
        assert.deepStrictEqual(G4.turn_order.slice(0, 4), copy)
        G4.turn_order.pop() // restore
    })
    test("next_turn_order is an empty array", () => {
        assert.ok(Array.isArray(G4.next_turn_order))
        assert.strictEqual(G4.next_turn_order.length, 0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("6: Available factions", () => {
    test("available_factions is an array", () => assert.ok(Array.isArray(G4.available_factions)))
    test("base game has exactly 14 available factions", () => {
        assert.strictEqual(G4.available_factions.length, BASE_FACTIONS.length)
    })
    test("fire_ice game has 20 available factions", () => {
        assert.strictEqual(GFI.available_factions.length, BASE_FACTIONS.length + FIRE_ICE_FACTIONS.length)
    })
    test("available_factions all are strings", () => {
        assert.ok(G4.available_factions.every(f => typeof f === "string"))
    })
    test("available_factions contains no duplicates", () => {
        assert.strictEqual(new Set(G4.available_factions).size, G4.available_factions.length)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("7: Per-player factions (empty at game start)", () => {
    test("factions is a non-null object", () => {
        assert.strictEqual(typeof G4.factions, "object")
        assert.ok(G4.factions !== null)
    })
    test("factions is empty at game start (no faction selected yet)", () => {
        assert.strictEqual(Object.keys(G4.factions).length, 0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("8: Map initialization", () => {
    const EXPECTED_HEX_COUNT = Object.keys(MAP_HEXES).length

    test("map is a non-null object", () => {
        assert.ok(G4.map !== null && typeof G4.map === "object")
    })
    test(`map has ${EXPECTED_HEX_COUNT} hexes (same as MAP_HEXES)`, () => {
        assert.strictEqual(Object.keys(G4.map).length, EXPECTED_HEX_COUNT)
    })
    test("every MAP_HEXES key is present in G.map", () => {
        for (const key of Object.keys(MAP_HEXES))
            assert.ok(key in G4.map, `Missing hex: ${key}`)
    })
    test("every hex has a 'color' string field", () => {
        for (const [k, cell] of Object.entries(G4.map))
            assert.ok(typeof cell.color === "string" && cell.color.length > 0, `${k}.color invalid`)
    })
    test("every hex has a 'river' boolean field", () => {
        for (const [k, cell] of Object.entries(G4.map))
            assert.strictEqual(typeof cell.river, "boolean", `${k}.river must be boolean`)
    })
    test("every hex has building === null at start", () => {
        for (const [k, cell] of Object.entries(G4.map))
            assert.strictEqual(cell.building, null, `${k}.building should be null`)
    })
    test("every hex has faction === null at start", () => {
        for (const [k, cell] of Object.entries(G4.map))
            assert.strictEqual(cell.faction, null, `${k}.faction should be null`)
    })
    test("every hex has town === false at start", () => {
        for (const [k, cell] of Object.entries(G4.map))
            assert.strictEqual(cell.town, false, `${k}.town should be false`)
    })
    test("hex colors match MAP_HEXES (deep copy, correct values)", () => {
        for (const [k, hex] of Object.entries(MAP_HEXES))
            assert.strictEqual(G4.map[k].color, hex.color, `${k} color mismatch`)
    })
    test("G.map is an independent deep copy (mutation does not affect MAP_HEXES)", () => {
        const original = G4.map["A1"].color
        G4.map["A1"].color = "__mutated__"
        assert.notStrictEqual(MAP_HEXES["A1"].color, "__mutated__")
        G4.map["A1"].color = original // restore
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("9: Bridges", () => {
    test("bridges is an empty array", () => {
        assert.ok(Array.isArray(G4.bridges))
        assert.strictEqual(G4.bridges.length, 0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("10: Pool — power actions", () => {
    const ACT_NAMES = Object.keys(POWER_ACTIONS)

    test("pool is a non-null object", () => {
        assert.ok(G4.pool !== null && typeof G4.pool === "object")
    })
    test(`pool has all ${ACT_NAMES.length} power actions`, () => {
        for (const name of ACT_NAMES)
            assert.ok(name in G4.pool, `Pool missing ${name}`)
    })
    test("every power action starts with count 1", () => {
        for (const name of ACT_NAMES)
            assert.strictEqual(G4.pool[name], 1, `${name} should be 1`)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("11: Pool — favor tiles", () => {
    test("pool has all 12 favor tiles", () => {
        for (const name of FAVOR_TILE_NAMES)
            assert.ok(name in G4.pool, `Pool missing ${name}`)
    })
    test("FAV1-FAV4 each have count 1 (rare tiles)", () => {
        for (const name of ["FAV1", "FAV2", "FAV3", "FAV4"])
            assert.strictEqual(G4.pool[name], 1, `${name} should have count 1`)
    })
    test("FAV5-FAV12 each have count 3 (common tiles)", () => {
        for (const name of ["FAV5","FAV6","FAV7","FAV8","FAV9","FAV10","FAV11","FAV12"])
            assert.strictEqual(G4.pool[name], 3, `${name} should have count 3`)
    })
    test("favor tile counts use tile.count field when present", () => {
        for (const [name, tile] of Object.entries(FAVOR_TILES)) {
            const expected = tile.count ?? 3
            assert.strictEqual(G4.pool[name], expected, `${name}: expected count ${expected}`)
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("12: Pool — town tiles (base game)", () => {
    const BASE_TOWNS = TOWN_TILE_NAMES.filter(n => !TOWN_TILES[n].option)
    const OPT_TOWNS  = TOWN_TILE_NAMES.filter(n =>  TOWN_TILES[n].option)

    test("base-game town tiles (TW1-TW5) are in pool", () => {
        for (const name of BASE_TOWNS)
            assert.ok(name in G4.pool, `Pool missing ${name}`)
    })
    test("TW1-TW5 each have count 2", () => {
        for (const name of BASE_TOWNS) {
            const expected = TOWN_TILES[name].count ?? 2
            assert.strictEqual(G4.pool[name], expected, `${name}: expected ${expected}`)
        }
    })
    test("option-gated town tiles are NOT in base-game pool", () => {
        for (const name of OPT_TOWNS)
            assert.ok(!(name in G4.pool) || G4.pool[name] === 0,
                `${name} must not appear in base-game pool`)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("13: Pool — bonus tile selection", () => {
    const BASE_BONUS = BONUS_TILE_NAMES.filter(n => !BONUS_TILES[n].option)

    function bonusInPool(G) {
        return BONUS_TILE_NAMES.filter(n => G.pool[n] > 0)
    }

    test("4-player game has player_count+3 = 7 bonus tiles in pool", () => {
        assert.strictEqual(bonusInPool(G4).length, 4 + 3)
    })
    test("2-player game has player_count+3 = 5 bonus tiles in pool", () => {
        assert.strictEqual(bonusInPool(G2).length, 2 + 3)
    })
    test("5-player game has player_count+3 = 8 bonus tiles in pool", () => {
        assert.strictEqual(bonusInPool(G5).length, 5 + 3)
    })
    test("all selected bonus tiles have count exactly 1", () => {
        for (const name of BONUS_TILE_NAMES) {
            if (G4.pool[name]) assert.strictEqual(G4.pool[name], 1, `${name} must be 1`)
        }
    })
    test("option-gated BON10 not in base-game pool", () => {
        assert.ok(!G4.pool["BON10"], "BON10 must not appear in base game pool")
    })
    test("base-game eligible bonus tiles are a subset of BON1-BON9", () => {
        for (const name of bonusInPool(G4))
            assert.ok(BASE_BONUS.includes(name), `${name} is not a valid base bonus tile`)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("14: Scoring tiles selection", () => {
    const VALID = new Set(SCORING_TILE_NAMES)

    test("scoring_tiles is an array", () => assert.ok(Array.isArray(G4.scoring_tiles)))
    test("scoring_tiles has exactly 6 entries", () => {
        assert.strictEqual(G4.scoring_tiles.length, 6, `Expected 6, got ${G4.scoring_tiles.length}`)
    })
    test("all scoring tile names are valid", () => {
        for (const name of G4.scoring_tiles)
            assert.ok(VALID.has(name), `Unknown scoring tile: ${name}`)
    })
    test("no duplicate scoring tiles", () => {
        assert.strictEqual(new Set(G4.scoring_tiles).size, 6)
    })
    test("current_scoring_tile is null at game start", () => {
        assert.strictEqual(G4.current_scoring_tile, null)
    })
    test("option-gated SCORE9 not selected in base game", () => {
        assert.ok(!G4.scoring_tiles.includes("SCORE9"),
            "SCORE9 requires temple-scoring-tile option and must not appear in base game")
    })
    test("base game always has exactly 6 tiles from SCORE1-SCORE8", () => {
        const base = G4.scoring_tiles.filter(n => n !== "SCORE9")
        assert.strictEqual(base.length, 6)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("15: view() exposes correct G fields", () => {
    const V = RULES.view(G4, "Player 1")
    const VP = RULES.view(G4, "Player 2")

    test("view() returns an object", () => assert.ok(V && typeof V === "object"))
    test("view() includes log", () => assert.ok(Array.isArray(V.log)))
    test("view() includes prompt string", () => assert.ok(typeof V.prompt === "string"))
    test("view() includes state", () => assert.strictEqual(V.state, "select-factions"))
    test("view() includes map (not null)", () => assert.ok(V.map !== null))
    test("view() includes bridges array", () => assert.ok(Array.isArray(V.bridges)))
    test("view() includes pool object", () => assert.ok(V.pool && typeof V.pool === "object"))
    test("view() includes scoring_tiles", () => assert.ok(Array.isArray(V.scoring_tiles)))
    test("view() includes available_factions", () => assert.ok(Array.isArray(V.available_factions)))
    test("view() exposes actions to active player", () => {
        assert.ok(V.actions !== undefined && typeof V.actions === "object")
    })
    test("view() does NOT expose actions to passive player", () => {
        assert.strictEqual(VP.actions, undefined)
    })
    test("view() does not mutate state", () => {
        const snap = JSON.stringify(G4)
        RULES.view(G4, "Player 1")
        RULES.view(G4, "Player 2")
        assert.strictEqual(JSON.stringify(G4), snap)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("16: Determinism & JSON safety", () => {
    test("same seed produces identical state", () => {
        const G4b = RULES.setup(SEED, SCENARIO, OPTS_4P)
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(G4)),
            JSON.parse(JSON.stringify(G4b))
        )
    })
    test("different seeds produce different G.seed values after MLCG", () => {
        const GA = RULES.setup(1,   SCENARIO, OPTS_4P)
        const GB = RULES.setup(999, SCENARIO, OPTS_4P)
        assert.notStrictEqual(GA.seed, GB.seed)
    })
    test("different seeds may produce different scoring tile order", () => {
        const GA = RULES.setup(1,   SCENARIO, OPTS_4P)
        const GB = RULES.setup(999, SCENARIO, OPTS_4P)
        // With a large enough seed difference the shuffle result will differ
        assert.notDeepStrictEqual(GA.scoring_tiles, GB.scoring_tiles)
    })
    test("G survives JSON round-trip without loss", () => {
        const copy = JSON.parse(JSON.stringify(G4))
        assert.deepStrictEqual(copy, G4)
    })
    test("setup() with fire_ice option produces different available_factions", () => {
        assert.notDeepStrictEqual(G4.available_factions, GFI.available_factions)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Summary

const line = "─".repeat(52)
console.log(`\n${line}`)
console.log(`  Step 2.1 results: ${passed} passed, ${failed} failed`)

if (failures.length > 0) {
    console.log("\nFailed tests:")
    for (const { name, err } of failures)
        console.log(`  ✗ ${name}\n    ${err.message}`)
}

if (failed > 0) process.exit(1)
