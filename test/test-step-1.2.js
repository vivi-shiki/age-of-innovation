"use strict"

// ============================================================
// Age of Innovation — test/test-step-1.2.js
// Verifies data/factions.js — all 20 faction definitions.
// Run: node test/test-step-1.2.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const {
    FACTIONS,
    BASE_FACTIONS,
    FIRE_ICE_FACTIONS,
    FACTION_COUNT,
} = require(path.join(__dirname, "../data/factions.js"))

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
    try {
        fn()
        console.log(`  ✓ ${name}`)
        passed++
    } catch (err) {
        console.error(`  ✗ ${name}`)
        console.error(`    ${err.message}`)
        failed++
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_COLORS = new Set(["yellow", "brown", "black", "blue", "green", "gray", "red", "volcano", "ice", null])

function assertHasFields(obj, fields, ctx) {
    for (const f of fields) {
        assert.ok(f in obj, `${ctx}: missing field '${f}'`)
    }
}

function assertIncomeLength(arr, expected, ctx) {
    assert.strictEqual(arr.length, expected, `${ctx}: income array length should be ${expected}, got ${arr.length}`)
}

// ── Group 1: Module shape ─────────────────────────────────────────────────────

console.log("\nGroup 1: Module shape")

test("FACTIONS is an object", () => {
    assert.strictEqual(typeof FACTIONS, "object")
    assert.ok(FACTIONS !== null)
})

test("FACTION_COUNT is 20", () => {
    assert.strictEqual(FACTION_COUNT, 20)
    assert.strictEqual(Object.keys(FACTIONS).length, 20)
})

test("BASE_FACTIONS has 14 factions", () => {
    assert.strictEqual(BASE_FACTIONS.length, 14)
})

test("FIRE_ICE_FACTIONS has 6 factions", () => {
    assert.strictEqual(FIRE_ICE_FACTIONS.length, 6)
})

test("BASE_FACTIONS + FIRE_ICE_FACTIONS = all 20 factions", () => {
    assert.strictEqual(BASE_FACTIONS.length + FIRE_ICE_FACTIONS.length, FACTION_COUNT)
})

// ── Group 2: Required top-level fields ────────────────────────────────────────

console.log("\nGroup 2: Required top-level fields per faction")

const REQUIRED_FIELDS = ["display", "color", "faction_board_id", "start", "cult_start", "ship", "buildings"]

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: has all required top-level fields`, () => {
        assertHasFields(f, REQUIRED_FIELDS, name)
    })
}

// ── Group 3: start resources ──────────────────────────────────────────────────

console.log("\nGroup 3: start resource fields")

const START_FIELDS = ["C", "W", "P", "P1", "P2", "P3", "VP"]

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: start has all resource fields`, () => {
        assertHasFields(f.start, START_FIELDS, `${name}.start`)
    })

    test(`${name}: start.VP === 20`, () => {
        assert.strictEqual(f.start.VP, 20, `${name}.start.VP`)
    })

    test(`${name}: start.C >= 0 and start.W >= 0`, () => {
        assert.ok(f.start.C >= 0, `${name}.start.C must be non-negative`)
        assert.ok(f.start.W >= 0, `${name}.start.W must be non-negative`)
    })

    test(`${name}: start.P3 === 0`, () => {
        assert.strictEqual(f.start.P3, 0, `${name}.start.P3 should be 0`)
    })

    test(`${name}: start.P1 + start.P2 >= 8`, () => {
        // All factions have at least 8 total power tokens in bowls 1+2
        assert.ok(f.start.P1 + f.start.P2 >= 8, `${name}: P1+P2 should be >= 8`)
    })
}

// ── Group 4: cult_start ───────────────────────────────────────────────────────

console.log("\nGroup 4: cult_start values")

const CULTS = ["FIRE", "WATER", "EARTH", "AIR"]

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: cult_start has all four cults`, () => {
        assertHasFields(f.cult_start, CULTS, `${name}.cult_start`)
    })

    test(`${name}: cult_start values are 0–10`, () => {
        for (const c of CULTS) {
            const v = f.cult_start[c]
            assert.ok(v >= 0 && v <= 10, `${name}.cult_start.${c} = ${v} out of range`)
        }
    })
}

// Sum checks for well-known factions
test("swarmlings: all cults start at 1", () => {
    const cs = FACTIONS.swarmlings.cult_start
    for (const c of CULTS) assert.strictEqual(cs[c], 1, `swarmlings.cult_start.${c}`)
})

test("acolytes: all cults start at 3", () => {
    const cs = FACTIONS.acolytes.cult_start
    for (const c of CULTS) assert.strictEqual(cs[c], 3, `acolytes.cult_start.${c}`)
})

test("engineers: all cults start at 0", () => {
    const cs = FACTIONS.engineers.cult_start
    for (const c of CULTS) assert.strictEqual(cs[c], 0, `engineers.cult_start.${c}`)
})

test("witches: AIR starts at 2, rest 0", () => {
    const cs = FACTIONS.witches.cult_start
    assert.strictEqual(cs.AIR, 2)
    assert.strictEqual(cs.FIRE, 0)
    assert.strictEqual(cs.WATER, 0)
    assert.strictEqual(cs.EARTH, 0)
})

test("chaosmagicians: FIRE starts at 2, rest 0", () => {
    const cs = FACTIONS.chaosmagicians.cult_start
    assert.strictEqual(cs.FIRE, 2)
    assert.strictEqual(cs.WATER + cs.EARTH + cs.AIR, 0)
})

// ── Group 5: color ────────────────────────────────────────────────────────────

console.log("\nGroup 5: color field")

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: color is a valid value`, () => {
        assert.ok(VALID_COLORS.has(f.color), `${name}.color = "${f.color}" is not valid`)
    })
}

test("pick_color factions have color null, volcano, or ice", () => {
    for (const name of FIRE_ICE_FACTIONS) {
        const f = FACTIONS[name]
        if (f.pick_color) {
            assert.ok(
                f.color === null || f.color === "volcano" || f.color === "ice",
                `${name}: pick_color faction should have null/volcano/ice color, got "${f.color}"`
            )
        }
    }
})

test("base factions all have a fixed terrain color", () => {
    const FIXED_COLORS = new Set(["yellow", "brown", "black", "blue", "green", "gray", "red"])
    for (const name of BASE_FACTIONS) {
        const f = FACTIONS[name]
        assert.ok(FIXED_COLORS.has(f.color), `${name}: base faction should have fixed color, got "${f.color}"`)
    }
})

// ── Group 6: faction_board_id ─────────────────────────────────────────────────

console.log("\nGroup 6: faction_board_id")

test("base factions all have numeric faction_board_id", () => {
    for (const name of BASE_FACTIONS) {
        const id = FACTIONS[name].faction_board_id
        assert.strictEqual(typeof id, "number", `${name}.faction_board_id should be number, got ${typeof id}`)
    }
})

test("Fire & Ice factions have null faction_board_id", () => {
    for (const name of FIRE_ICE_FACTIONS) {
        assert.strictEqual(FACTIONS[name].faction_board_id, null, `${name}.faction_board_id should be null`)
    }
})

test("base faction board IDs are unique", () => {
    const ids = BASE_FACTIONS.map(n => FACTIONS[n].faction_board_id)
    const unique = new Set(ids)
    assert.strictEqual(unique.size, ids.length, "Duplicate faction_board_id values found")
})

// ── Group 7: ship ─────────────────────────────────────────────────────────────

console.log("\nGroup 7: ship")

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: ship.level <= ship.max_level`, () => {
        assert.ok(f.ship.level <= f.ship.max_level, `${name}: ship.level > ship.max_level`)
    })
}

test("dwarves: no shipping (max_level 0)", () => {
    assert.strictEqual(FACTIONS.dwarves.ship.max_level, 0)
    assert.strictEqual(FACTIONS.dwarves.ship.level, 0)
})

test("fakirs: no shipping (max_level 0)", () => {
    assert.strictEqual(FACTIONS.fakirs.ship.max_level, 0)
    assert.strictEqual(FACTIONS.fakirs.ship.level, 0)
})

test("mermaids: ship starts at level 1", () => {
    assert.strictEqual(FACTIONS.mermaids.ship.level, 1)
})

test("mermaids: ship max_level is 5", () => {
    assert.strictEqual(FACTIONS.mermaids.ship.max_level, 5)
})

test("riverwalkers: ship is locked at level 1 (level=max=1)", () => {
    const s = FACTIONS.riverwalkers.ship
    assert.strictEqual(s.level, 1)
    assert.strictEqual(s.max_level, 1)
})

// ── Group 8: dig ──────────────────────────────────────────────────────────────

console.log("\nGroup 8: dig")

for (const [name, f] of Object.entries(FACTIONS)) {
    if (f.dig === null) {
        test(`${name}: dig is explicitly null (no dig action)`, () => {
            assert.strictEqual(f.dig, null)
        })
        continue
    }

    test(`${name}: dig has level, max_level, cost`, () => {
        assertHasFields(f.dig, ["level", "max_level", "cost"], `${name}.dig`)
    })

    test(`${name}: dig.level <= dig.max_level`, () => {
        assert.ok(f.dig.level <= f.dig.max_level, `${name}: dig.level > dig.max_level`)
    })

    test(`${name}: dig.cost is an array of length max_level+1`, () => {
        assert.ok(Array.isArray(f.dig.cost), `${name}.dig.cost should be array`)
        assert.strictEqual(f.dig.cost.length, f.dig.max_level + 1,
            `${name}.dig.cost length should be max_level+1`)
    })
}

test("darklings: dig max_level is 0 (can't improve digging)", () => {
    assert.strictEqual(FACTIONS.darklings.dig.max_level, 0)
})

test("fakirs: dig max_level is 1", () => {
    assert.strictEqual(FACTIONS.fakirs.dig.max_level, 1)
})

test("acolytes: dig produces VOLCANO_TF, not SPADE", () => {
    assert.deepStrictEqual(FACTIONS.acolytes.dig.gain, [ { VOLCANO_TF: 1 } ])
})

test("dragonlords: dig produces VOLCANO_TF, not SPADE", () => {
    assert.deepStrictEqual(FACTIONS.dragonlords.dig.gain, [ { VOLCANO_TF: 1 } ])
})

// ── Group 9: teleport ─────────────────────────────────────────────────────────

console.log("\nGroup 9: teleport (Dwarves / Fakirs only)")

test("dwarves have a teleport (tunnel) field", () => {
    assert.ok("teleport" in FACTIONS.dwarves, "dwarves should have teleport field")
    assert.strictEqual(FACTIONS.dwarves.teleport.type, "tunnel")
})

test("fakirs have a teleport (carpet) field", () => {
    assert.ok("teleport" in FACTIONS.fakirs, "fakirs should have teleport field")
    assert.strictEqual(FACTIONS.fakirs.teleport.type, "carpet")
})

test("no other base faction has a teleport field", () => {
    for (const name of BASE_FACTIONS) {
        if (name === "dwarves" || name === "fakirs") continue
        assert.ok(!("teleport" in FACTIONS[name]), `${name} should not have teleport`)
    }
})

// ── Group 10: buildings ───────────────────────────────────────────────────────

console.log("\nGroup 10: buildings")

const BUILDING_TYPES = ["D", "TP", "TE", "SH", "SA"]
const INCOME_LENGTHS  = { D: 9, TP: 5, TE: 4, SH: 2, SA: 2 }

for (const [name, f] of Object.entries(FACTIONS)) {
    test(`${name}: has all five building types`, () => {
        assertHasFields(f.buildings, BUILDING_TYPES, `${name}.buildings`)
    })

    for (const btype of BUILDING_TYPES) {
        const b = f.buildings[btype]

        test(`${name}.${btype}: has advance_cost`, () => {
            assert.ok("advance_cost" in b, `${name}.buildings.${btype} missing advance_cost`)
            assert.ok(typeof b.advance_cost === "object" && b.advance_cost !== null)
        })

        test(`${name}.${btype}: has income`, () => {
            assert.ok("income" in b, `${name}.buildings.${btype} missing income`)
        })

        // Check primary income array length
        test(`${name}.${btype}: first income array has length ${INCOME_LENGTHS[btype]}`, () => {
            const incomeArrays = Object.values(b.income)
            const first = incomeArrays[0]
            assert.ok(Array.isArray(first), `${name}.${btype}.income first value should be array`)
            assertIncomeLength(first, INCOME_LENGTHS[btype], `${name}.${btype}.income`)
        })
    }
}

// ── Group 11: leech_effect & exchange_rates ───────────────────────────────────

console.log("\nGroup 11: faction-specific mechanisms")

test("cultists have leech_effect.taken.CULT = 1", () => {
    assert.strictEqual(FACTIONS.cultists.leech_effect.taken.CULT, 1)
})

test("cultists have leech_effect.not_taken.PW = 1", () => {
    assert.strictEqual(FACTIONS.cultists.leech_effect.not_taken.PW, 1)
})

test("shapeshifters have leech_effect", () => {
    assert.ok("leech_effect" in FACTIONS.shapeshifters)
})

test("alchemists have exchange_rates", () => {
    assert.ok("exchange_rates" in FACTIONS.alchemists)
    assert.deepStrictEqual(FACTIONS.alchemists.exchange_rates.C, { VP: 2 })
    assert.deepStrictEqual(FACTIONS.alchemists.exchange_rates.VP, { C: 1 })
})

test("no other faction has exchange_rates", () => {
    for (const [name, f] of Object.entries(FACTIONS)) {
        if (name === "alchemists") continue
        assert.ok(!("exchange_rates" in f), `${name} should not have exchange_rates`)
    }
})

// ── Group 12: specific resource spot-checks ───────────────────────────────────

console.log("\nGroup 12: specific resource spot-checks")

test("swarmlings start with C=20, W=8", () => {
    assert.strictEqual(FACTIONS.swarmlings.start.C, 20)
    assert.strictEqual(FACTIONS.swarmlings.start.W, 8)
})

test("engineers start with C=10, W=2", () => {
    assert.strictEqual(FACTIONS.engineers.start.C, 10)
    assert.strictEqual(FACTIONS.engineers.start.W, 2)
})

test("darklings start with P=1 (a priest)", () => {
    assert.strictEqual(FACTIONS.darklings.start.P, 1)
})

test("yetis start with P1=0, P2=12 (all power ready)", () => {
    assert.strictEqual(FACTIONS.yetis.start.P1, 0)
    assert.strictEqual(FACTIONS.yetis.start.P2, 12)
})

test("fakirs have P1=7 > P2=5 (most tokens in bowl 1)", () => {
    assert.strictEqual(FACTIONS.fakirs.start.P1, 7)
    assert.strictEqual(FACTIONS.fakirs.start.P2, 5)
})

// ── Group 13: building income spot-checks ─────────────────────────────────────

console.log("\nGroup 13: building income spot-checks")

test("swarmlings D income starts at W=2", () => {
    assert.strictEqual(FACTIONS.swarmlings.buildings.D.income.W[0], 2)
})

test("engineers D income starts at W=0", () => {
    assert.strictEqual(FACTIONS.engineers.buildings.D.income.W[0], 0)
})

test("engineers TE income has both P and PW arrays", () => {
    const te = FACTIONS.engineers.buildings.TE.income
    assert.ok(Array.isArray(te.P))
    assert.ok(Array.isArray(te.PW))
})

test("alchemists SH advance_gain = [{PW:12}]", () => {
    assert.deepStrictEqual(FACTIONS.alchemists.buildings.SH.advance_gain, [ { PW: 12 } ])
})

test("halflings SH advance_gain = [{SPADE:3}]", () => {
    assert.deepStrictEqual(FACTIONS.halflings.buildings.SH.advance_gain, [ { SPADE: 3 } ])
})

test("mermaids SH advance_gain = [{GAIN_SHIP:1}]", () => {
    assert.deepStrictEqual(FACTIONS.mermaids.buildings.SH.advance_gain, [ { GAIN_SHIP: 1 } ])
})

test("chaosmagicians SH advance_cost = {W:4, C:4} (discounted)", () => {
    assert.deepStrictEqual(FACTIONS.chaosmagicians.buildings.SH.advance_cost, { W: 4, C: 4 })
})

test("nomads TP income C=[0,2,4,7,11]", () => {
    assert.deepStrictEqual(FACTIONS.nomads.buildings.TP.income.C, [0, 2, 4, 7, 11])
})

test("dwarves TP income C=[0,3,5,7,10]", () => {
    assert.deepStrictEqual(FACTIONS.dwarves.buildings.TP.income.C, [0, 3, 5, 7, 10])
})

test("icemaidens D income grows to 9 (all 9 dwarfs produce W)", () => {
    const w = FACTIONS.icemaidens.buildings.D.income.W
    assert.strictEqual(w[8], 9)
})

// ── Group 14: Fire & Ice tag checks ───────────────────────────────────────────

console.log("\nGroup 14: Fire & Ice expansion tags")

const FI_NAMES = ["riverwalkers", "shapeshifters", "acolytes", "icemaidens", "yetis", "dragonlords"]

test("all six F&I factions exist in FIRE_ICE_FACTIONS list", () => {
    for (const n of FI_NAMES) {
        assert.ok(FIRE_ICE_FACTIONS.includes(n), `${n} should be in FIRE_ICE_FACTIONS`)
    }
})

test("all F&I factions have expansion='fire_ice'", () => {
    for (const n of FI_NAMES) {
        assert.strictEqual(FACTIONS[n].expansion, "fire_ice", `${n}.expansion`)
    }
})

test("no base faction has expansion field", () => {
    for (const n of BASE_FACTIONS) {
        assert.ok(!("expansion" in FACTIONS[n]), `${n} should not have expansion field`)
    }
})

test("acolytes and dragonlords have volcano terrain", () => {
    assert.strictEqual(FACTIONS.acolytes.color, "volcano")
    assert.strictEqual(FACTIONS.dragonlords.color, "volcano")
})

test("icemaidens and yetis have ice terrain", () => {
    assert.strictEqual(FACTIONS.icemaidens.color, "ice")
    assert.strictEqual(FACTIONS.yetis.color, "ice")
})

test("riverwalkers and shapeshifters have null terrain (player-chosen)", () => {
    assert.strictEqual(FACTIONS.riverwalkers.color, null)
    assert.strictEqual(FACTIONS.shapeshifters.color, null)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`)
if (failed > 0) process.exit(1)
