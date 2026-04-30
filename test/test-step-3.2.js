"use strict"

// ============================================================
// Age of Innovation — test/test-step-3.2.js
// Unit tests for map operations and initial dwelling placement.
//
// Step 3.2 scope:
//   • place_dwelling action — all validation paths + happy path
//   • Map & faction state after placement
//   • Action queue snake progression
//   • Phase transition to "initial-bonus" when queue empties
//   • _compute_leech — adjacent enemy buildings → queue entries
//   • _detect_towns — BFS connectivity + town formation threshold
//   • Full 2-player initial dwelling sequence (4 placements)
//   • JSON safety after placements
//
// Map constants used in this file (verified against data/map.js):
//   A1 = brown   adj: A2, B1
//   A5 = yellow  adj: A6, A4, B2, B3
//   A7 = brown   adj: A8, A6, r2, r3
//   B1 = yellow  adj: r0, A1, A2, r6, r7
//   E1 = black   adj: E2, D1, F1
//   E2 = brown   adj: E3, E1, D1, D2, F1, F2
//   E3 = red     adj: E4, E2, D2, D3, F2, r20
//   E4 = blue    adj: E5, E3, D3, r14, r20, r21
//
// Run: node test/test-step-3.2.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))
const {
    _action_place_dwelling,
    _compute_leech,
    _detect_towns,
} = RULES._test

const { FACTIONS } = require(path.join(__dirname, "..", "data", "factions.js"))
const { BUILDING_STRENGTH, DEFAULT_TOWN_SIZE, DEFAULT_TOWN_COUNT } =
    require(path.join(__dirname, "..", "data", "constants.js"))
const { MAP_HEXES, ADJACENCY } = require(path.join(__dirname, "..", "data", "map.js"))
const { TOWN_TILES } = require(path.join(__dirname, "..", "data", "tiles.js"))

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

/**
 * Build a 2-player game in initial-dwellings phase.
 *   Player 1 → halflings (home color: brown)
 *   Player 2 → nomads    (home color: yellow)
 */
function two_player_initial() {
    let G = RULES.setup(42, "Standard", { players: "2" })
    G = RULES.action(G, "Player 1", "select_faction", "halflings")
    G = RULES.action(G, "Player 2", "select_faction", "nomads")
    // State: "initial-dwellings"
    // action_queue: [P1, P2, P2, P1] (snake order)
    return G
}

/**
 * Build a minimal G-like object for low-level helper tests.
 * Only the fields used by _compute_leech and _detect_towns.
 */
function minimal_G() {
    const G = {
        action_queue: [],
        pool: {},
        factions: {
            "Player 1": {
                faction_name: "halflings",
                color: "brown",
                buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
                C: 15, W: 3, P: 0, P1: 3, P2: 9, P3: 0, VP: 20, KEY: 0,
                FIRE: 0, WATER: 0, EARTH: 0, AIR: 0,
                favor_tiles: [], town_tiles: [], locations: [], towns: [],
            },
            "Player 2": {
                faction_name: "nomads",
                color: "yellow",
                buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
                C: 15, W: 2, P: 0, P1: 5, P2: 7, P3: 0, VP: 20, KEY: 0,
                FIRE: 0, WATER: 0, EARTH: 0, AIR: 0,
                favor_tiles: [], town_tiles: [], locations: [], towns: [],
            },
        },
        // map: filled per test
        map: {},
    }

    // Populate map from real MAP_HEXES (shallow copy of cell shape)
    for (const [key, hex] of Object.entries(MAP_HEXES)) {
        G.map[key] = { color: hex.color, river: hex.river, building: null, faction: null, town: false }
    }

    // Pool: add town tiles
    for (const name of Object.keys(TOWN_TILES)) {
        G.pool[name] = TOWN_TILES[name].count ?? 2
    }

    return G
}

// ─────────────────────────────────────────────────────────────────────────────
group("1: place_dwelling — validation errors", () => {

    const G0 = two_player_initial()

    test("wrong phase throws 'Not in dwelling placement phase'", () => {
        const G = clone(G0)
        G.state = "select-factions"
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", "A1"),
            /not in dwelling placement phase/i
        )
    })

    test("not your turn throws 'It is not your turn'", () => {
        const G = clone(G0)
        // Player 2 is not active (Player 1 is first in snake order)
        assert.throws(
            () => RULES.action(G, "Player 2", "place_dwelling", "A1"),
            /not your turn/i
        )
    })

    test("non-string hex throws 'Invalid hex'", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", null),
            /invalid hex/i
        )
    })

    test("empty string hex throws 'Invalid hex'", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", ""),
            /invalid hex/i
        )
    })

    test("unknown hex key throws 'Invalid hex'", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", "Z99"),
            /invalid hex/i
        )
    })

    test("river hex throws 'Invalid hex'", () => {
        const G = clone(G0)
        // r0 is a river hex (B row, col 1)
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", "r0"),
            /invalid hex/i
        )
    })

    test("occupied hex throws 'already has a building'", () => {
        const G = clone(G0)
        G.map["A1"].building = "D"
        G.map["A1"].faction  = "Player 2"
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", "A1"),
            /already has a building/i
        )
    })

    test("wrong terrain color throws 'not your home terrain'", () => {
        const G = clone(G0)
        // Player 1 is halflings (brown), A5 is yellow
        assert.throws(
            () => RULES.action(G, "Player 1", "place_dwelling", "A5"),
            /not your home terrain/i
        )
    })

    test("error message includes hex name", () => {
        const G = clone(G0)
        try {
            RULES.action(G, "Player 1", "place_dwelling", "A5")
            assert.fail("should have thrown")
        } catch (err) {
            assert.ok(err.message.includes("A5"), `message: ${err.message}`)
        }
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("2: place_dwelling — map and faction state after success", () => {

    let G = two_player_initial()

    // Player 1 (halflings, brown) places at A1
    G = RULES.action(G, "Player 1", "place_dwelling", "A1")

    test("G.map[A1].building = 'D'", () => {
        assert.strictEqual(G.map["A1"].building, "D")
    })

    test("G.map[A1].faction = 'Player 1'", () => {
        assert.strictEqual(G.map["A1"].faction, "Player 1")
    })

    test("G.map[A1].town = false (no town during setup)", () => {
        assert.strictEqual(G.map["A1"].town, false)
    })

    test("fs.buildings.D incremented to 1", () => {
        assert.strictEqual(G.factions["Player 1"].buildings.D, 1)
    })

    test("fs.locations includes placed hex", () => {
        assert.ok(G.factions["Player 1"].locations.includes("A1"))
    })

    test("other map hexes remain unaffected", () => {
        assert.strictEqual(G.map["A2"].building, null)
        assert.strictEqual(G.map["B1"].building, null)
    })

    test("Player 2's faction state is unchanged", () => {
        assert.strictEqual(G.factions["Player 2"].buildings.D, 0)
        assert.deepStrictEqual(G.factions["Player 2"].locations, [])
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("3: place_dwelling — action queue progression", () => {

    let G = two_player_initial()

    test("initial action_queue length = 4 (2 players × 2 dwellings)", () => {
        assert.strictEqual(G.action_queue.length, 4)
    })

    test("initial queue front is Player 1", () => {
        assert.strictEqual(G.action_queue[0].role, "Player 1")
        assert.strictEqual(G.action_queue[0].type, "place-dwelling")
    })

    test("initial active = Player 1", () => {
        assert.strictEqual(G.active, "Player 1")
    })

    // P1 places → queue becomes [P2, P2, P1]
    G = RULES.action(G, "Player 1", "place_dwelling", "A1")

    test("after P1 places, queue length = 3", () => {
        assert.strictEqual(G.action_queue.length, 3)
    })

    test("after P1 places, active = Player 2", () => {
        assert.strictEqual(G.active, "Player 2")
    })

    // P2 places at A5 (yellow for nomads)
    G = RULES.action(G, "Player 2", "place_dwelling", "A5")

    test("after P2 first place, active = Player 2 again (snake)", () => {
        assert.strictEqual(G.active, "Player 2")
    })

    // P2 places second at B1 (yellow)
    G = RULES.action(G, "Player 2", "place_dwelling", "B1")

    test("after P2 second place, active = Player 1 (snake return)", () => {
        assert.strictEqual(G.active, "Player 1")
    })

    test("queue length = 1 (just P1's second dwelling)", () => {
        assert.strictEqual(G.action_queue.length, 1)
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("4: phase transition — initial-dwellings → initial-bonus", () => {

    function full_two_player_sequence() {
        let G = two_player_initial()
        G = RULES.action(G, "Player 1", "place_dwelling", "A1")   // P1 #1
        G = RULES.action(G, "Player 2", "place_dwelling", "A5")   // P2 #1
        G = RULES.action(G, "Player 2", "place_dwelling", "B1")   // P2 #2
        G = RULES.action(G, "Player 1", "place_dwelling", "A7")   // P1 #2
        return G
    }

    const G = full_two_player_sequence()

    test("state transitions to 'initial-bonus'", () => {
        assert.strictEqual(G.state, "initial-bonus")
    })

    test("action_queue is non-empty (reverse-order bonus picks)", () => {
        assert.ok(G.action_queue.length > 0)
    })

    test("action_queue entries have type 'pick-bonus'", () => {
        assert.ok(G.action_queue.every(e => e.type === "pick-bonus"))
    })

    test("bonus queue is in reverse turn order (P2 picks first)", () => {
        assert.strictEqual(G.action_queue[0].role, "Player 2")
        assert.strictEqual(G.action_queue[1].role, "Player 1")
    })

    test("active = Player 2 (first to pick bonus)", () => {
        assert.strictEqual(G.active, "Player 2")
    })

    test("all 4 dwellings appear on the map", () => {
        const built = Object.values(G.map).filter(c => c.building === "D")
        assert.strictEqual(built.length, 4)
    })

    test("each player has 2 dwellings and 2 locations", () => {
        assert.strictEqual(G.factions["Player 1"].buildings.D, 2)
        assert.strictEqual(G.factions["Player 2"].buildings.D, 2)
        assert.strictEqual(G.factions["Player 1"].locations.length, 2)
        assert.strictEqual(G.factions["Player 2"].locations.length, 2)
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("5: _compute_leech — adjacent enemy buildings", () => {

    test("no adjacent buildings → nothing pushed to queue", () => {
        const G = minimal_G()
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")   // A1 is empty, no adjacent buildings
        assert.strictEqual(G.action_queue.length, 0)
    })

    test("same-faction adjacent building → not pushed", () => {
        const G = minimal_G()
        G.map["A2"].building = "D"
        G.map["A2"].faction  = "Player 1"   // friendly
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue.length, 0)
    })

    test("enemy D (strength 1) adjacent → leech entry with amount 1", () => {
        const G = minimal_G()
        G.map["B1"].building = "D"
        G.map["B1"].faction  = "Player 2"
        G.action_queue = []
        // Player 1 just built at A1; B1 is adjacent to A1
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue.length, 1)
        assert.strictEqual(G.action_queue[0].type,      "leech")
        assert.strictEqual(G.action_queue[0].role,      "Player 2")
        assert.strictEqual(G.action_queue[0].amount,    1)
        assert.strictEqual(G.action_queue[0].from_role, "Player 1")
    })

    test("enemy TP (strength 2) → leech amount 2", () => {
        const G = minimal_G()
        G.map["B1"].building = "TP"
        G.map["B1"].faction  = "Player 2"
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue[0].amount, 2)
    })

    test("enemy TE (strength 2) → leech amount 2", () => {
        const G = minimal_G()
        G.map["A2"].building = "TE"
        G.map["A2"].faction  = "Player 2"
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue[0].amount, 2)
    })

    test("enemy SH (strength 3) → leech amount 3", () => {
        const G = minimal_G()
        G.map["B1"].building = "SH"
        G.map["B1"].faction  = "Player 2"
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue[0].amount, 3)
    })

    test("enemy SA (strength 3) → leech amount 3", () => {
        const G = minimal_G()
        G.map["A2"].building = "SA"
        G.map["A2"].faction  = "Player 2"
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue[0].amount, 3)
    })

    test("two adjacent enemy buildings → two queue entries", () => {
        // E2 is adj to both E1 and E3
        const G = minimal_G()
        G.map["E1"].building = "D"
        G.map["E1"].faction  = "Player 2"
        G.map["E3"].building = "TP"
        G.map["E3"].faction  = "Player 2"
        G.action_queue = []
        // Player 1 just built at E2 (both E1 and E3 are adjacent)
        _compute_leech(G, "Player 1", "E2")
        assert.strictEqual(G.action_queue.length, 2)
        const amounts = G.action_queue.map(e => e.amount).sort((a,b) => a-b)
        assert.deepStrictEqual(amounts, [1, 2])   // D=1, TP=2
    })

    test("two different enemy factions adjacent → entries for each", () => {
        const G = minimal_G()
        // Add a third faction
        G.factions["Player 3"] = { faction_name: "auren", color: "green", buildings: {D:0} }
        G.map["A2"].building = "D"
        G.map["A2"].faction  = "Player 2"
        G.map["B1"].building = "D"
        G.map["B1"].faction  = "Player 3"
        // A1 is adj to both A2 and B1
        G.action_queue = []
        _compute_leech(G, "Player 1", "A1")
        assert.strictEqual(G.action_queue.length, 2)
        const roles = G.action_queue.map(e => e.role).sort()
        assert.deepStrictEqual(roles, ["Player 2", "Player 3"])
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("6: _detect_towns — town NOT formed (threshold not met)", () => {

    test("single D building — count < 4, strength < 7 → no town", () => {
        const G = minimal_G()
        G.map["E1"].building = "D"
        G.map["E1"].faction  = "Player 1"
        G.factions["Player 1"].buildings.D = 1
        const before = clone(G.factions["Player 1"].town_tiles)
        _detect_towns(G, "Player 1", "E1")
        assert.deepStrictEqual(G.factions["Player 1"].town_tiles, before)
        assert.strictEqual(G.map["E1"].town, false)
    })

    test("4 adjacent D buildings (strength 4) — count ok but strength < 7 → no town", () => {
        const G = minimal_G()
        // E1, E2, E3, E4 are a horizontal chain
        for (const h of ["E1","E2","E3","E4"]) {
            G.map[h].building = "D"
            G.map[h].faction  = "Player 1"
        }
        G.factions["Player 1"].buildings.D = 4
        _detect_towns(G, "Player 1", "E1")
        assert.strictEqual(G.factions["Player 1"].town_tiles.length, 0)
    })

    test("high-strength cluster with only 3 buildings (count < 4) → no town", () => {
        const G = minimal_G()
        G.map["E1"].building = "SH"   // 3
        G.map["E2"].building = "SH"   // 3
        G.map["E3"].building = "SH"   // 3   total=9 but count=3
        for (const h of ["E1","E2","E3"]) G.map[h].faction = "Player 1"
        _detect_towns(G, "Player 1", "E1")
        assert.strictEqual(G.factions["Player 1"].town_tiles.length, 0)
    })

    test("club of 4 already marked as town → no second formation", () => {
        const G = minimal_G()
        for (const h of ["E1","E2","E3","E4"]) {
            G.map[h].building = "SH"   // each =3, total=12 >> 7
            G.map[h].faction  = "Player 1"
            G.map[h].town     = true   // already a town
        }
        G.factions["Player 1"].buildings.SH = 4
        // First tile should already be consumed
        G.factions["Player 1"].town_tiles = ["TW1"]
        G.pool["TW1"] = 1   // still has one tile in pool
        _detect_towns(G, "Player 1", "E1")
        // Should NOT consume another tile
        assert.strictEqual(G.factions["Player 1"].town_tiles.length, 1)
        assert.strictEqual(G.pool["TW1"], 1)
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("7: _detect_towns — town IS formed", () => {

    // Setup: E1(SH=3) E2(TP=2) E3(D=1) E4(D=1) → total strength=7, count=4
    function town_scenario() {
        const G = minimal_G()
        G.map["E1"].building = "SH"; G.map["E1"].faction = "Player 1"
        G.map["E2"].building = "TP"; G.map["E2"].faction = "Player 1"
        G.map["E3"].building = "D";  G.map["E3"].faction = "Player 1"
        G.map["E4"].building = "D";  G.map["E4"].faction = "Player 1"
        const fs = G.factions["Player 1"]
        fs.buildings.SH = 1; fs.buildings.TP = 1; fs.buildings.D = 2
        return G
    }

    test("town tile is added to fs.town_tiles", () => {
        const G = town_scenario()
        _detect_towns(G, "Player 1", "E1")
        assert.strictEqual(G.factions["Player 1"].town_tiles.length, 1)
    })

    test("tile awarded is a valid TOWN_TILES key", () => {
        const G = town_scenario()
        _detect_towns(G, "Player 1", "E1")
        const tile = G.factions["Player 1"].town_tiles[0]
        assert.ok(tile in TOWN_TILES, `expected valid tile, got ${tile}`)
    })

    test("pool count for awarded tile is decremented", () => {
        const G = town_scenario()
        const before_pool = Object.assign({}, G.pool)
        _detect_towns(G, "Player 1", "E1")
        const tile = G.factions["Player 1"].town_tiles[0]
        assert.strictEqual(G.pool[tile], before_pool[tile] - 1)
    })

    test("all 4 cluster hexes marked as town = true", () => {
        const G = town_scenario()
        _detect_towns(G, "Player 1", "E1")
        for (const h of ["E1","E2","E3","E4"]) {
            assert.strictEqual(G.map[h].town, true, `${h} not marked`)
        }
    })

    test("fs.towns contains all 4 hex keys", () => {
        const G = town_scenario()
        _detect_towns(G, "Player 1", "E1")
        const towns = G.factions["Player 1"].towns
        assert.strictEqual(towns.length, 4)
        for (const h of ["E1","E2","E3","E4"]) {
            assert.ok(towns.includes(h), `${h} not in towns`)
        }
    })

    test("tile gain is applied (VP increases)", () => {
        const G = town_scenario()
        const vp_before = G.factions["Player 1"].VP
        _detect_towns(G, "Player 1", "E1")
        const tile = G.factions["Player 1"].town_tiles[0]
        const expected_gain = TOWN_TILES[tile].gain.VP || 0
        assert.strictEqual(G.factions["Player 1"].VP, vp_before + expected_gain)
    })

    test("KEY gain is applied when tile has KEY", () => {
        const G = town_scenario()
        // Force TW1 to be the next tile (it gives KEY:1)
        // Clear all tiles in pool, keep only TW1
        for (const k of Object.keys(G.pool)) {
            if (k.startsWith("TW")) G.pool[k] = 0
        }
        G.pool["TW1"] = 1
        const key_before = G.factions["Player 1"].KEY
        _detect_towns(G, "Player 1", "E1")
        // TW1 gain: { KEY:1, VP:5, C:6 }
        assert.strictEqual(G.factions["Player 1"].KEY, key_before + 1)
    })

    test("disconnected friendly building not included in cluster", () => {
        const G = town_scenario()
        // Add a 5th building far away (not adjacent to the cluster)
        G.map["A1"].building = "D"
        G.map["A1"].faction  = "Player 1"
        G.factions["Player 1"].buildings.D++
        _detect_towns(G, "Player 1", "E1")
        // Town should still form from E1-E4 cluster
        assert.strictEqual(G.factions["Player 1"].town_tiles.length, 1)
        // A1 is NOT part of the town
        assert.strictEqual(G.map["A1"].town, false)
    })

    test("FAV5 effect: TOWN_SIZE-1 allows town at strength 6", () => {
        // Setup: 4 D buildings (strength 4) normally not a town at threshold 7
        // But let's use 1 SH + 1 TP + 2 D = 7 and verify it forms at threshold 6 → still 7 so let's use 3D+SA scenario
        // SA=3, D=1, D=1, D=1 → total=6, with TOWN_SIZE=-1 threshold = 6 → town forms
        const G = minimal_G()
        G.map["E1"].building = "SA"; G.map["E1"].faction = "Player 1"
        G.map["E2"].building = "D";  G.map["E2"].faction = "Player 1"
        G.map["E3"].building = "D";  G.map["E3"].faction = "Player 1"
        G.map["E4"].building = "D";  G.map["E4"].faction = "Player 1"
        const fs = G.factions["Player 1"]
        fs.buildings.SA = 1; fs.buildings.D = 3
        // Strength = 3+1+1+1 = 6, DEFAULT_TOWN_SIZE=7 → normally no town
        const before = fs.town_tiles.slice()
        _detect_towns(G, "Player 1", "E1")
        assert.deepStrictEqual(fs.town_tiles, before)   // no town without FAV5

        // Now apply FAV5 effect
        fs.TOWN_SIZE = -1
        _detect_towns(G, "Player 1", "E1")
        assert.strictEqual(fs.town_tiles.length, 1)     // town forms at threshold 6
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("8: full 2-player initial dwelling sequence", () => {

    // Play all 4 placements in snake order
    let G = two_player_initial()

    test("initial state = 'initial-dwellings'", () => {
        assert.strictEqual(G.state, "initial-dwellings")
    })

    test("queue is [P1, P2, P2, P1]", () => {
        const roles = G.action_queue.map(e => e.role)
        assert.deepStrictEqual(roles, ["Player 1", "Player 2", "Player 2", "Player 1"])
    })

    // Placement 1: Player 1 → A1 (brown)
    G = RULES.action(G, "Player 1", "place_dwelling", "A1")

    test("after P1 place 1: A1 has faction and building", () => {
        assert.strictEqual(G.map["A1"].building, "D")
        assert.strictEqual(G.map["A1"].faction,  "Player 1")
    })

    // Placement 2: Player 2 → A5 (yellow)
    G = RULES.action(G, "Player 2", "place_dwelling", "A5")

    test("after P2 place 1: A5 has faction and building", () => {
        assert.strictEqual(G.map["A5"].building, "D")
        assert.strictEqual(G.map["A5"].faction,  "Player 2")
    })

    // Placement 3: Player 2 → B1 (yellow) — second dwelling
    G = RULES.action(G, "Player 2", "place_dwelling", "B1")

    test("after P2 place 2: B1 has faction and building", () => {
        assert.strictEqual(G.map["B1"].building, "D")
        assert.strictEqual(G.map["B1"].faction,  "Player 2")
    })

    test("P2 now has 2 dwellings", () => {
        assert.strictEqual(G.factions["Player 2"].buildings.D, 2)
    })

    // Placement 4: Player 1 → A7 (brown) — second dwelling
    G = RULES.action(G, "Player 1", "place_dwelling", "A7")

    test("after P1 place 2: A7 has faction and building", () => {
        assert.strictEqual(G.map["A7"].building, "D")
        assert.strictEqual(G.map["A7"].faction,  "Player 1")
    })

    test("game transitions to 'initial-bonus'", () => {
        assert.strictEqual(G.state, "initial-bonus")
    })

    test("Player 1 locations = [A1, A7]", () => {
        assert.deepStrictEqual(G.factions["Player 1"].locations, ["A1", "A7"])
    })

    test("Player 2 locations = [A5, B1]", () => {
        assert.deepStrictEqual(G.factions["Player 2"].locations, ["A5", "B1"])
    })

    test("cannot place on an occupied hex", () => {
        // A1 is already occupied; constructing a fresh game to test
        const G2 = two_player_initial()
        const G3 = RULES.action(G2, "Player 1", "place_dwelling", "A1")
        // queue now front is Player 2; construct a G where P1 is active again
        // to re-test occupied validation
        const G4 = clone(G3)
        G4.active = "Player 1"
        assert.throws(
            () => _action_place_dwelling(G4, "Player 1", "A1"),
            /already has a building/i
        )
    })

})

// ─────────────────────────────────────────────────────────────────────────────
group("9: JSON safety", () => {

    test("G is fully serializable after 4 placements", () => {
        let G = two_player_initial()
        G = RULES.action(G, "Player 1", "place_dwelling", "A1")
        G = RULES.action(G, "Player 2", "place_dwelling", "A5")
        G = RULES.action(G, "Player 2", "place_dwelling", "B1")
        G = RULES.action(G, "Player 1", "place_dwelling", "A7")
        const s = JSON.stringify(G)
        const G2 = JSON.parse(s)
        assert.strictEqual(G2.state, "initial-bonus")
        assert.strictEqual(G2.factions["Player 1"].buildings.D, 2)
    })

    test("cloned G produces identical placement results", () => {
        const G0 = two_player_initial()
        const G1 = RULES.action(clone(G0), "Player 1", "place_dwelling", "A1")
        const G2 = RULES.action(clone(G0), "Player 1", "place_dwelling", "A1")
        assert.strictEqual(G1.factions["Player 1"].buildings.D,
                           G2.factions["Player 1"].buildings.D)
        assert.strictEqual(G1.map["A1"].building, G2.map["A1"].building)
    })

    test("different placement choices on cloned G are independent", () => {
        const G0 = two_player_initial()
        const Ga = RULES.action(clone(G0), "Player 1", "place_dwelling", "A1")
        const Gb = RULES.action(clone(G0), "Player 1", "place_dwelling", "A7")
        assert.strictEqual(Ga.map["A1"].building, "D")
        assert.strictEqual(Ga.map["A7"].building, null)
        assert.strictEqual(Gb.map["A7"].building, "D")
        assert.strictEqual(Gb.map["A1"].building, null)
    })

})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nresults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
if (failures.length > 0) {
    console.error("\nFailed tests:")
    for (const { name, err } of failures) {
        console.error(`  ✗ ${name}`)
        if (err.stack) console.error(`    ${err.stack.split("\n")[1].trim()}`)
    }
    process.exit(1)
} else {
    process.exit(0)
}
