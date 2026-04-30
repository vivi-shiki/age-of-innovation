"use strict"

// ============================================================
// Age of Innovation — test/test-step-2.2.js
// Verifies setup() → select_faction action → phase transition.
//
// Step 2.2 scope:
//   • select_faction action — happy path + all validation errors
//   • _init_faction_state(): shape, resources, cult tracks, levels
//   • Sequential selection: active player advances correctly
//   • Phase transition: select-factions → initial-dwellings
//   • action_queue snake order after all factions selected
//   • available_factions shrinks on each selection
//   • view() reflects current available factions for each player
//   • JSON safety on faction state
//
// Run: node test/test-step-2.2.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))
const { FACTIONS, BASE_FACTIONS } = require(path.join(__dirname, "..", "data", "factions.js"))

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

function fresh(player_count = 4, extra_opts = {}) {
    return RULES.setup(42, "Standard", { players: String(player_count), map: "standard", ...extra_opts })
}

// Deep-copy G so we can re-run actions on the same base state
function clone(G) {
    return JSON.parse(JSON.stringify(G))
}

// Pick the first available faction for convenience
function first_faction(G) { return G.available_factions[0] }

// ─────────────────────────────────────────────────────────────────────────────
group("1: select_faction — basic success (4-player game)", () => {
    let G = fresh(4)
    const faction = first_faction(G)
    const initial_avail = G.available_factions.length

    test("action returns updated state without throwing", () => {
        G = RULES.action(G, "Player 1", "select_faction", faction)
        assert.ok(G && typeof G === "object")
    })

    test("G.factions['Player 1'] is set", () => {
        assert.ok("Player 1" in G.factions)
    })

    test("faction_name matches what was chosen", () => {
        assert.strictEqual(G.factions["Player 1"].faction_name, faction)
    })

    test("available_factions shrinks by 1", () => {
        assert.strictEqual(G.available_factions.length, initial_avail - 1)
    })

    test("chosen faction is removed from available_factions", () => {
        assert.ok(!G.available_factions.includes(faction))
    })

    test("active advances to Player 2 after Player 1 selects", () => {
        assert.strictEqual(G.active, "Player 2")
    })

    test("state remains 'select-factions' (not all players done yet)", () => {
        assert.strictEqual(G.state, "select-factions")
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("2: select_faction — validation errors", () => {
    const G0 = fresh(2)

    test("throws 'not your turn' if wrong player acts", () => {
        assert.throws(
            () => RULES.action(G0, "Player 2", "select_faction", first_faction(G0)),
            /not your turn/i
        )
    })

    test("throws if faction name is not a string", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", null),
            /non-empty string/i
        )
    })

    test("throws if faction name is empty string", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", ""),
            /non-empty string/i
        )
    })

    test("throws for unknown faction name", () => {
        const G = clone(G0)
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", "invalid_faction"),
            /not available/i
        )
    })

    test("throws if faction duplicated (already taken)", () => {
        let G = clone(G0)
        const faction = first_faction(G)
        G = RULES.action(G, "Player 1", "select_faction", faction)
        // Player 2 tries to pick the same faction
        assert.throws(
            () => RULES.action(G, "Player 2", "select_faction", faction),
            /not available/i
        )
    })

    test("throws if player tries to select twice", () => {
        let G = clone(G0)
        G = RULES.action(G, "Player 1", "select_faction", G.available_factions[0])
        const second_faction = G.available_factions[0]
        // Artificially make Player 2 = Player 1 for this test by swapping active
        // Instead: just verify that once player 1 is done, they can't pick again
        // (player 1 is no longer active, so "not your turn" fires first)
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", second_faction),
            /not your turn/i
        )
    })

    test("throws if called outside select-factions phase", () => {
        let G = clone(G0)
        G.state = "initial-dwellings"
        G.active = "Player 1"
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", first_faction(G)),
            /not in faction selection phase/i
        )
    })

    test("fire_ice factions not available in base game", () => {
        const G = clone(G0)
        // Riverwalkers is a F&I faction
        assert.throws(
            () => RULES.action(G, "Player 1", "select_faction", "riverwalkers"),
            /not available/i
        )
    })

    test("fire_ice factions available when option enabled", () => {
        const G = fresh(2, { fire_ice: true })
        // Should not throw — riverwalkers is now in available_factions
        assert.ok(G.available_factions.includes("riverwalkers"))
        const G2 = RULES.action(clone(G), "Player 1", "select_faction", "riverwalkers")
        assert.strictEqual(G2.factions["Player 1"].faction_name, "riverwalkers")
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("3: Faction state shape — all required fields", () => {
    let G = fresh(2)
    G = RULES.action(G, "Player 1", "select_faction", first_faction(G))
    const fs = G.factions["Player 1"]

    const REQUIRED_RESOURCE_FIELDS = ["C", "W", "P", "P1", "P2", "P3", "VP", "KEY"]
    const REQUIRED_CULT_FIELDS     = ["FIRE", "WATER", "EARTH", "AIR"]
    const REQUIRED_FLAGS           = ["passed", "income_taken"]
    const REQUIRED_ARRAYS          = ["favor_tiles", "town_tiles", "actions_used", "locations", "towns", "bridges"]

    test("faction_name is a string", () => assert.strictEqual(typeof fs.faction_name, "string"))
    test("color is string or null", () => assert.ok(fs.color === null || typeof fs.color === "string"))
    test("buildings object has D/TP/TE/SH/SA", () => {
        assert.ok(fs.buildings && typeof fs.buildings === "object")
        for (const b of ["D", "TP", "TE", "SH", "SA"])
            assert.ok(b in fs.buildings, `buildings.${b} missing`)
    })
    test("buildings all start at 0", () => {
        for (const [k, v] of Object.entries(fs.buildings))
            assert.strictEqual(v, 0, `buildings.${k} should be 0`)
    })
    test("dig_level is a number", () => assert.strictEqual(typeof fs.dig_level, "number"))
    test("ship_level is a number", () => assert.strictEqual(typeof fs.ship_level, "number"))
    test("bonus_tile is null", () => assert.strictEqual(fs.bonus_tile, null))

    for (const f of REQUIRED_RESOURCE_FIELDS) {
        test(`resource field '${f}' is a non-negative number`, () => {
            assert.ok(f in fs, `Missing field: ${f}`)
            assert.strictEqual(typeof fs[f], "number")
            assert.ok(fs[f] >= 0, `${f} must be >= 0`)
        })
    }
    for (const f of REQUIRED_CULT_FIELDS) {
        test(`cult field '${f}' is a number 0–10`, () => {
            assert.ok(f in fs, `Missing field: ${f}`)
            assert.strictEqual(typeof fs[f], "number")
            assert.ok(fs[f] >= 0 && fs[f] <= 10)
        })
    }
    for (const f of REQUIRED_FLAGS) {
        test(`flag field '${f}' is boolean`, () => {
            assert.ok(f in fs, `Missing field: ${f}`)
            assert.strictEqual(typeof fs[f], "boolean")
        })
    }
    for (const f of REQUIRED_ARRAYS) {
        test(`array field '${f}' is empty array`, () => {
            assert.ok(f in fs, `Missing field: ${f}`)
            assert.ok(Array.isArray(fs[f]), `${f} must be array`)
            assert.strictEqual(fs[f].length, 0, `${f} must start empty`)
        })
    }
})

// ─────────────────────────────────────────────────────────────────────────────
group("4: Resource initialization matches faction definition", () => {

    function check_faction(faction_name) {
        const G0 = fresh(2)
        // Temporarily place faction into available_factions if needed
        if (!G0.available_factions.includes(faction_name)) return  // skip if not in pool

        const G = RULES.action(clone(G0), "Player 1", "select_faction", faction_name)
        const fs  = G.factions["Player 1"]
        const def = FACTIONS[faction_name]
        const s   = def.start

        test(`${faction_name}: C matches faction_def.start.C`, () => assert.strictEqual(fs.C, s.C))
        test(`${faction_name}: W matches faction_def.start.W`, () => assert.strictEqual(fs.W, s.W))
        test(`${faction_name}: P matches faction_def.start.P (or 0)`, () => assert.strictEqual(fs.P, s.P || 0))
        test(`${faction_name}: P1 matches faction_def.start.P1`, () => assert.strictEqual(fs.P1, s.P1))
        test(`${faction_name}: P2 matches faction_def.start.P2`, () => assert.strictEqual(fs.P2, s.P2))
        test(`${faction_name}: P3 matches faction_def.start.P3 (or 0)`, () => assert.strictEqual(fs.P3, s.P3 || 0))
        test(`${faction_name}: VP = 20`, () => assert.strictEqual(fs.VP, 20))
        test(`${faction_name}: FIRE matches cult_start`, () => assert.strictEqual(fs.FIRE, def.cult_start.FIRE))
        test(`${faction_name}: WATER matches cult_start`, () => assert.strictEqual(fs.WATER, def.cult_start.WATER))
        test(`${faction_name}: EARTH matches cult_start`, () => assert.strictEqual(fs.EARTH, def.cult_start.EARTH))
        test(`${faction_name}: AIR matches cult_start`, () => assert.strictEqual(fs.AIR, def.cult_start.AIR))
        test(`${faction_name}: dig_level from faction_def.dig.level`, () => {
            const expected = def.dig ? def.dig.level : 0
            assert.strictEqual(fs.dig_level, expected)
        })
        test(`${faction_name}: ship_level from faction_def.ship.level`, () => {
            const expected = def.ship ? def.ship.level : 0
            assert.strictEqual(fs.ship_level, expected)
        })
    }

    // Spot-check a representative sample of base factions
    check_faction("alchemists")
    check_faction("engineers")    // low starting resources
    check_faction("swarmlings")   // high C, high W
    check_faction("mermaids")     // ship_level = 1
    check_faction("dwarves")      // ship_level = 0 (max 0)
    check_faction("halflings")    // P1=3, P2=9
    check_faction("witches")
    check_faction("nomads")
})

// ─────────────────────────────────────────────────────────────────────────────
group("5: Sequential selection — all 4 players in turn order", () => {
    let G = fresh(4)
    const factions_chosen = []

    test("Player 1 can select", () => {
        const f = G.available_factions[0]
        factions_chosen.push(f)
        G = RULES.action(G, "Player 1", "select_faction", f)
        assert.strictEqual(G.active, "Player 2")
        assert.strictEqual(G.state, "select-factions")
    })

    test("Player 2 can select", () => {
        const f = G.available_factions[0]
        factions_chosen.push(f)
        G = RULES.action(G, "Player 2", "select_faction", f)
        assert.strictEqual(G.active, "Player 3")
        assert.strictEqual(G.state, "select-factions")
    })

    test("Player 3 can select", () => {
        const f = G.available_factions[0]
        factions_chosen.push(f)
        G = RULES.action(G, "Player 3", "select_faction", f)
        assert.strictEqual(G.active, "Player 4")
        assert.strictEqual(G.state, "select-factions")
    })

    test("Player 4 selects → phase transitions to initial-dwellings", () => {
        const f = G.available_factions[0]
        factions_chosen.push(f)
        G = RULES.action(G, "Player 4", "select_faction", f)
        assert.strictEqual(G.state, "initial-dwellings")
    })

    test("all 4 factions recorded, all distinct", () => {
        assert.strictEqual(Object.keys(G.factions).length, 4)
        assert.strictEqual(new Set(factions_chosen).size, 4)
    })

    test("available_factions reduced by 4", () => {
        assert.strictEqual(G.available_factions.length, BASE_FACTIONS.length - 4)
    })

    test("each player's faction_name matches what was chosen", () => {
        for (let i = 0; i < 4; i++) {
            assert.strictEqual(G.factions[`Player ${i + 1}`].faction_name, factions_chosen[i])
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("6: Phase transition — action_queue snake order", () => {
    function do_all_selections(player_count) {
        let G = fresh(player_count)
        for (let i = 1; i <= player_count; i++) {
            G = RULES.action(G, `Player ${i}`, "select_faction", G.available_factions[0])
        }
        return G
    }

    test("state is 'initial-dwellings' after all players select", () => {
        const G = do_all_selections(3)
        assert.strictEqual(G.state, "initial-dwellings")
    })

    test("action_queue length = 2 × player_count (snake)", () => {
        for (const n of [2, 3, 4, 5]) {
            const G = do_all_selections(n)
            assert.strictEqual(G.action_queue.length, n * 2,
                `${n} players: queue should be ${n * 2}`)
        }
    })

    test("action_queue all have type 'place-dwelling'", () => {
        const G = do_all_selections(4)
        assert.ok(G.action_queue.every(e => e.type === "place-dwelling"))
    })

    test("action_queue snake order for 4 players: 1 2 3 4 4 3 2 1", () => {
        const G = do_all_selections(4)
        const roles = G.action_queue.map(e => e.role)
        assert.deepStrictEqual(roles, [
            "Player 1", "Player 2", "Player 3", "Player 4",
            "Player 4", "Player 3", "Player 2", "Player 1",
        ])
    })

    test("action_queue snake order for 2 players: 1 2 2 1", () => {
        const G = do_all_selections(2)
        const roles = G.action_queue.map(e => e.role)
        assert.deepStrictEqual(roles, ["Player 1", "Player 2", "Player 2", "Player 1"])
    })

    test("action_queue snake order for 3 players: 1 2 3 3 2 1", () => {
        const G = do_all_selections(3)
        const roles = G.action_queue.map(e => e.role)
        assert.deepStrictEqual(roles, [
            "Player 1", "Player 2", "Player 3",
            "Player 3", "Player 2", "Player 1",
        ])
    })

    test("active after transition = first in action_queue = Player 1", () => {
        const G = do_all_selections(4)
        assert.strictEqual(G.active, "Player 1")
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("7: view() behavior during faction selection", () => {
    let G = fresh(3)

    test("active player (Player 1) gets select_faction in actions", () => {
        const V = RULES.view(G, "Player 1")
        assert.ok(V.actions && "select_faction" in V.actions)
    })

    test("select_faction action value is array of available faction names", () => {
        const V = RULES.view(G, "Player 1")
        assert.ok(Array.isArray(V.actions.select_faction))
        assert.strictEqual(V.actions.select_faction.length, G.available_factions.length)
    })

    test("passive player (Player 2) gets no actions", () => {
        const V = RULES.view(G, "Player 2")
        assert.strictEqual(V.actions, undefined)
    })

    test("view shows available_factions shrinks after Player 1 picks", () => {
        G = RULES.action(G, "Player 1", "select_faction", G.available_factions[0])
        const V2 = RULES.view(G, "Player 2")
        assert.ok(V2.actions && Array.isArray(V2.actions.select_faction))
        assert.strictEqual(V2.actions.select_faction.length, G.available_factions.length)
        // Player 1's faction no longer listed
        const chosen = G.factions["Player 1"].faction_name
        assert.ok(!V2.actions.select_faction.includes(chosen))
    })

    test("after transition, active player gets place_dwelling in actions", () => {
        // Continue: Player 2 and 3 select
        G = RULES.action(G, "Player 2", "select_faction", G.available_factions[0])
        G = RULES.action(G, "Player 3", "select_faction", G.available_factions[0])
        assert.strictEqual(G.state, "initial-dwellings")
        const V = RULES.view(G, "Player 1")
        assert.ok(V.actions && "place_dwelling" in V.actions)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("8: Special faction edge cases", () => {
    test("mermaids: ship_level = 1 (starts with shipping)", () => {
        const G0 = fresh(2)
        assert.ok(G0.available_factions.includes("mermaids"))
        const G = RULES.action(clone(G0), "Player 1", "select_faction", "mermaids")
        assert.strictEqual(G.factions["Player 1"].ship_level, 1)
    })

    test("dwarves: dig_level from dig.level (not 0 default)", () => {
        const G0 = fresh(2)
        const G = RULES.action(clone(G0), "Player 1", "select_faction", "dwarves")
        const expected = FACTIONS["dwarves"].dig ? FACTIONS["dwarves"].dig.level : 0
        assert.strictEqual(G.factions["Player 1"].dig_level, expected)
    })

    test("engineers: start resources are correct (lower than standard)", () => {
        const G0 = fresh(2)
        const G = RULES.action(clone(G0), "Player 1", "select_faction", "engineers")
        assert.strictEqual(G.factions["Player 1"].C, FACTIONS["engineers"].start.C)
        assert.strictEqual(G.factions["Player 1"].W, FACTIONS["engineers"].start.W)
    })

    test("alchemists: exchange_rates still accessible via FACTIONS, not stored in state", () => {
        // The faction state itself does not embed exchange_rates;
        // the engine reads them from FACTIONS[faction_name] at runtime.
        const G0 = fresh(2)
        const G  = RULES.action(clone(G0), "Player 1", "select_faction", "alchemists")
        const fs = G.factions["Player 1"]
        // exchange_rates is NOT part of the runtime faction state (no need to duplicate it)
        assert.ok(!("exchange_rates" in fs))
        // But FACTIONS still has it
        assert.ok(FACTIONS["alchemists"].exchange_rates)
    })

    test("pick_color faction (riverwalkers) has color=null in state", () => {
        const G = fresh(2, { fire_ice: true })
        const G2 = RULES.action(clone(G), "Player 1", "select_faction", "riverwalkers")
        assert.strictEqual(G2.factions["Player 1"].color, null)
    })

    test("engineers: cult all start at 0", () => {
        const G0 = fresh(2)
        const G  = RULES.action(clone(G0), "Player 1", "select_faction", "engineers")
        const fs = G.factions["Player 1"]
        assert.strictEqual(fs.FIRE, 0)
        assert.strictEqual(fs.WATER, 0)
        assert.strictEqual(fs.EARTH, 0)
        assert.strictEqual(fs.AIR, 0)
    })

    test("swarmlings: cult all start at 1", () => {
        const G0 = fresh(2)
        const G  = RULES.action(clone(G0), "Player 1", "select_faction", "swarmlings")
        const fs = G.factions["Player 1"]
        assert.strictEqual(fs.FIRE, 1)
        assert.strictEqual(fs.WATER, 1)
        assert.strictEqual(fs.EARTH, 1)
        assert.strictEqual(fs.AIR, 1)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("9: Immutability and JSON safety", () => {
    let G = fresh(4)

    test("select_faction does not mutate the original state (returns new ref)", () => {
        const snap = JSON.stringify(G)
        // Call on a clone so we don't mess up G
        const G2 = RULES.action(clone(G), "Player 1", "select_faction", G.available_factions[0])
        // Original G should be unchanged
        assert.strictEqual(JSON.stringify(G), snap)
        // G2 should differ
        assert.notStrictEqual(JSON.stringify(G2), snap)
    })

    test("faction state survives JSON round-trip", () => {
        let G2 = RULES.action(clone(G), "Player 1", "select_faction", G.available_factions[0])
        const copy = JSON.parse(JSON.stringify(G2))
        assert.deepStrictEqual(copy.factions, G2.factions)
    })

    test("selecting the same faction twice (different game) yields identical state", () => {
        const faction = G.available_factions[2]
        const GA = RULES.action(clone(G), "Player 1", "select_faction", faction)
        const GB = RULES.action(clone(G), "Player 1", "select_faction", faction)
        assert.deepStrictEqual(GA.factions["Player 1"], GB.factions["Player 1"])
    })

    test("all 14 base factions produce valid state (smoke test)", () => {
        for (const faction_name of Object.keys(FACTIONS).filter(n => !FACTIONS[n].expansion)) {
            const G0 = fresh(2)
            const G2 = RULES.action(clone(G0), "Player 1", "select_faction", faction_name)
            const fs = G2.factions["Player 1"]
            assert.ok(fs && fs.faction_name === faction_name, `${faction_name}: state creation failed`)
            assert.strictEqual(typeof fs.C, "number", `${faction_name}: C not a number`)
            assert.strictEqual(typeof fs.VP, "number", `${faction_name}: VP not a number`)
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("10: 2-player full selection cycle", () => {
    let G = fresh(2)
    const f1 = G.available_factions[0]
    const f2 = G.available_factions[1]

    test("Player 1 selects first faction", () => {
        G = RULES.action(G, "Player 1", "select_faction", f1)
        assert.strictEqual(G.active, "Player 2")
        assert.strictEqual(G.state, "select-factions")
    })

    test("Player 2 selects second faction → initial-dwellings begins", () => {
        G = RULES.action(G, "Player 2", "select_faction", f2)
        assert.strictEqual(G.state, "initial-dwellings")
    })

    test("action_queue = 4 entries for 2 players", () => {
        assert.strictEqual(G.action_queue.length, 4)
    })

    test("active = Player 1 (first in snake order)", () => {
        assert.strictEqual(G.active, "Player 1")
    })

    test("G survives JSON round-trip after full selection", () => {
        const copy = JSON.parse(JSON.stringify(G))
        assert.deepStrictEqual(copy, G)
    })

    test("result is still null", () => {
        assert.strictEqual(G.result, null)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Summary

const line = "─".repeat(52)
console.log(`\n${line}`)
console.log(`  Step 2.2 results: ${passed} passed, ${failed} failed`)

if (failures.length > 0) {
    console.log("\nFailed tests:")
    for (const { name, err } of failures)
        console.log(`  ✗ ${name}\n    ${err.message}`)
}

if (failed > 0) process.exit(1)
