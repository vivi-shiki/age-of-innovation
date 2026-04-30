"use strict"

// ============================================================
// Age of Innovation — test/test-step-3.1.js
// Unit tests for the resource system helpers.
//
// Step 3.1 scope:
//   • _gain_power()         — three-bowl token movement
//   • _advance_cult()       — cult track advancement + power bonuses
//   • _gain()               — generic resource grant (routes PW / cult)
//   • _pay()                — resource deduction with atomic validation
//   • _terraform_distance() — circular distance on COLOR_WHEEL
//   • _terraform_cost()     — worker cost per terraform step
//
// All functions are exposed via RULES._test for unit testing.
// Run: node test/test-step-3.1.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))
const {
    _gain_power,
    _gain,
    _pay,
    _advance_cult,
    _terraform_distance,
    _terraform_cost,
} = RULES._test

const { FACTIONS } = require(path.join(__dirname, "..", "data", "factions.js"))
const { COLOR_WHEEL, CULT_TRACK_POWER_GAINS } = require(path.join(__dirname, "..", "data", "constants.js"))

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

// Minimal faction state for pure resource tests.
// Total tokens = P1 + P2 + P3 (bowl size is fixed per faction; we keep totals stable).
function make_fs(overrides = {}) {
    return Object.assign({
        C: 10, W: 5, P: 2,
        P1: 3, P2: 4, P3: 5,
        VP: 20, KEY: 0,
        FIRE: 0, WATER: 0, EARTH: 0, AIR: 0,
        buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
        dig_level: 0, ship_level: 0,
        favor_tiles: [], town_tiles: [], bonus_tile: null,
        passed: false, income_taken: false, actions_used: [],
        locations: [], towns: [], bridges: [],
    }, overrides)
}

// ─────────────────────────────────────────────────────────────────────────────
group("1: _gain_power — three-bowl token movement", () => {

    test("gain from P1 into P2 (P1 still has tokens)", () => {
        const fs = make_fs({ P1: 3, P2: 2, P3: 5 })
        _gain_power(fs, 2)
        assert.strictEqual(fs.P1, 1)
        assert.strictEqual(fs.P2, 4)
        assert.strictEqual(fs.P3, 5)
    })

    test("gain exhausts P1 then overflows into P3 from P2", () => {
        const fs = make_fs({ P1: 1, P2: 5, P3: 3 })
        _gain_power(fs, 3)
        // P1: 1→0, P2 gains 1 (=6), then 2 from P2→P3: P2=4, P3=5
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 4)
        assert.strictEqual(fs.P3, 5)
    })

    test("gain with P1=0 goes directly P2 → P3", () => {
        const fs = make_fs({ P1: 0, P2: 6, P3: 3 })
        _gain_power(fs, 3)
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 3)
        assert.strictEqual(fs.P3, 6)
    })

    test("overflow when all bowls depleted: excess silently discarded", () => {
        const fs = make_fs({ P1: 0, P2: 0, P3: 12 })
        const gained = _gain_power(fs, 5)
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 0)
        assert.strictEqual(fs.P3, 12)
        assert.strictEqual(gained, 0)
    })

    test("partial overflow: only what bowls can absorb is moved", () => {
        const fs = make_fs({ P1: 2, P2: 1, P3: 9 })
        // Move 5: P1→P2 moves 2 (remaining=3), P2→P3 moves 3 (P2 now has 3, need 3)
        // After P1→P2: P1=0, P2=3
        // P2→P3 moves 3: P2=0, P3=12
        const gained = _gain_power(fs, 5)
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 0)
        assert.strictEqual(fs.P3, 12)
        assert.strictEqual(gained, 5)
    })

    test("returns actual tokens promoted (no overflow)", () => {
        const fs = make_fs({ P1: 4, P2: 2, P3: 0 })
        const gained = _gain_power(fs, 3)
        assert.strictEqual(gained, 3)
    })

    test("returns actual tokens promoted (partial overflow)", () => {
        const fs = make_fs({ P1: 1, P2: 1, P3: 0 })
        // 1 from P1→P2 (P2=2), then 2 from P2→P3 (the 1 original + 1 just arrived)
        // = 3 tokens actually advanced; remaining 2 overflow and are discarded
        const gained = _gain_power(fs, 5)
        assert.strictEqual(gained, 3)
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 0)
        assert.strictEqual(fs.P3, 2)
    })

    test("gaining 0 power changes nothing", () => {
        const fs = make_fs({ P1: 3, P2: 4, P3: 5 })
        _gain_power(fs, 0)
        assert.strictEqual(fs.P1, 3)
        assert.strictEqual(fs.P2, 4)
        assert.strictEqual(fs.P3, 5)
    })

    test("total token count is preserved (no tokens created/destroyed)", () => {
        const fs = make_fs({ P1: 3, P2: 4, P3: 2 })
        const total_before = fs.P1 + fs.P2 + fs.P3
        _gain_power(fs, 5)
        assert.strictEqual(fs.P1 + fs.P2 + fs.P3, total_before)
    })

    test("total token count preserved under overflow", () => {
        const fs = make_fs({ P1: 0, P2: 0, P3: 8 })
        const total_before = fs.P1 + fs.P2 + fs.P3
        _gain_power(fs, 5)
        assert.strictEqual(fs.P1 + fs.P2 + fs.P3, total_before)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("2: _advance_cult — cult track advancement & bonuses", () => {

    test("normal advance without crossing a threshold", () => {
        const fs = make_fs({ FIRE: 0 })
        const steps = _advance_cult(fs, "FIRE", 2)
        assert.strictEqual(fs.FIRE, 2)
        assert.strictEqual(steps, 2)
    })

    test("track is capped at 10", () => {
        const fs = make_fs({ FIRE: 8, KEY: 2 })
        const steps = _advance_cult(fs, "FIRE", 5)
        assert.strictEqual(fs.FIRE, 10)
        assert.strictEqual(steps, 2)
    })

    test("no advancement past current value of 10", () => {
        const fs = make_fs({ WATER: 10, KEY: 2 })
        const steps = _advance_cult(fs, "WATER", 3)
        assert.strictEqual(fs.WATER, 10)
        assert.strictEqual(steps, 0)
    })

    // Threshold at 2 (crossing → position 3): gain PW:1
    test("crossing threshold 2→3: gain 1 power", () => {
        const fs = make_fs({ EARTH: 2, P1: 4, P2: 0, P3: 0 })
        _advance_cult(fs, "EARTH", 1)
        assert.strictEqual(fs.EARTH, 3)
        assert.strictEqual(fs.P2, 1)  // 1 token P1→P2
    })

    test("starting below 2, crossing to above 3: still gains PW:1", () => {
        const fs = make_fs({ AIR: 1, P1: 4, P2: 0, P3: 0 })
        _advance_cult(fs, "AIR", 3)  // 1→4
        assert.strictEqual(fs.AIR, 4)
        // Crossed threshold 2: PW+1 (P1→P2)
        assert.strictEqual(fs.P2, 1)
    })

    // Threshold at 4 (→5): gain PW:2
    test("crossing threshold 4→5: gain 2 power", () => {
        const fs = make_fs({ FIRE: 4, P1: 4, P2: 0, P3: 0 })
        _advance_cult(fs, "FIRE", 1)
        assert.strictEqual(fs.FIRE, 5)
        assert.strictEqual(fs.P2, 2)  // 2 from P1→P2
    })

    // Threshold at 6 (→7): gain PW:2
    test("crossing threshold 6→7: gain 2 power", () => {
        const fs = make_fs({ WATER: 6, P1: 4, P2: 0, P3: 0 })
        _advance_cult(fs, "WATER", 1)
        assert.strictEqual(fs.WATER, 7)
        assert.strictEqual(fs.P2, 2)
    })

    // Threshold at 9 (→10): gain PW:3, spend 1 KEY
    test("crossing 9→10 with KEY: gain 3 PW, spend 1 KEY", () => {
        const fs = make_fs({ FIRE: 9, P1: 5, P2: 0, P3: 0, KEY: 1 })
        _advance_cult(fs, "FIRE", 1)
        assert.strictEqual(fs.FIRE, 10)
        assert.strictEqual(fs.P2, 3)   // 3 PW gained (P1→P2)
        assert.strictEqual(fs.KEY, 0)  // 1 KEY spent
    })

    test("crossing 9→10 without KEY: capped at 9", () => {
        const fs = make_fs({ FIRE: 9, KEY: 0 })
        const steps = _advance_cult(fs, "FIRE", 1)
        assert.strictEqual(fs.FIRE, 9)
        assert.strictEqual(steps, 0)
    })

    test("crossing 8→10 without KEY: capped at 9 (partially advanced)", () => {
        const fs = make_fs({ EARTH: 8, KEY: 0, P1: 4, P2: 0, P3: 0 })
        const steps = _advance_cult(fs, "EARTH", 2)
        assert.strictEqual(fs.EARTH, 9)
        assert.strictEqual(steps, 1)
        // No threshold 9 crossed (stopped at 9, not at 10)
        assert.strictEqual(fs.P2, 0)  // threshold 6→7 not crossed in 8→9
    })

    test("advance from 0→10 with KEY: crosses all 4 thresholds", () => {
        // Crossing 3 (PW:1), 5 (PW:2), 7 (PW:2), 10 (PW:3) = total PW:8, KEY spends 1
        const fs = make_fs({ FIRE: 0, P1: 12, P2: 0, P3: 0, KEY: 1 })
        _advance_cult(fs, "FIRE", 10)
        assert.strictEqual(fs.FIRE, 10)
        // Total PW gained: 1+2+2+3 = 8 → all from P1 (12 available)
        assert.strictEqual(fs.P1, 4)   // 12 - 8 = 4
        assert.strictEqual(fs.P2, 8)
        assert.strictEqual(fs.P3, 0)
        assert.strictEqual(fs.KEY, 0)  // KEY spent
    })

    test("advance from 0→10 without KEY: crosses thresholds 3, 5, 7 only", () => {
        // PW: 1+2+2 = 5 (threshold 10 not crossed, stops at 9)
        const fs = make_fs({ WATER: 0, P1: 10, P2: 0, P3: 0, KEY: 0 })
        _advance_cult(fs, "WATER", 10)
        assert.strictEqual(fs.WATER, 9)
        assert.strictEqual(fs.P1, 5)   // 10 - 5 = 5
        assert.strictEqual(fs.P2, 5)   // 5 tokens moved P1→P2
    })

    test("advance does not re-trigger threshold already crossed", () => {
        // Start at 3 (already past threshold 2), advance 1 → 4: no bonus
        const fs = make_fs({ AIR: 3, P1: 4, P2: 0, P3: 0 })
        _advance_cult(fs, "AIR", 1)
        assert.strictEqual(fs.AIR, 4)
        assert.strictEqual(fs.P2, 0)  // no bonus (threshold 2 was already crossed)
    })

    test("WATER, EARTH, AIR tracks all work identically", () => {
        for (const cult of ["WATER", "EARTH", "AIR"]) {
            const fs = make_fs({ [cult]: 4, P1: 4, P2: 0, P3: 0 })
            _advance_cult(fs, cult, 1)
            assert.strictEqual(fs[cult], 5, `${cult} should advance to 5`)
            assert.strictEqual(fs.P2, 2, `${cult}: should gain 2 power at threshold 5`)
        }
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("3: _gain — generic resource grant", () => {

    test("gain coins", () => {
        const fs = make_fs({ C: 5 })
        _gain(fs, { C: 3 })
        assert.strictEqual(fs.C, 8)
    })

    test("gain workers", () => {
        const fs = make_fs({ W: 4 })
        _gain(fs, { W: 2 })
        assert.strictEqual(fs.W, 6)
    })

    test("gain priests", () => {
        const fs = make_fs({ P: 1 })
        _gain(fs, { P: 2 })
        assert.strictEqual(fs.P, 3)
    })

    test("gain VP", () => {
        const fs = make_fs({ VP: 20 })
        _gain(fs, { VP: 5 })
        assert.strictEqual(fs.VP, 25)
    })

    test("gain KEY", () => {
        const fs = make_fs({ KEY: 0 })
        _gain(fs, { KEY: 1 })
        assert.strictEqual(fs.KEY, 1)
    })

    test("PW routes through _gain_power (fills P1→P2 first)", () => {
        const fs = make_fs({ P1: 4, P2: 0, P3: 0 })
        _gain(fs, { PW: 2 })
        assert.strictEqual(fs.P1, 2)
        assert.strictEqual(fs.P2, 2)
    })

    test("FIRE routes through _advance_cult (with bonus)", () => {
        const fs = make_fs({ FIRE: 4, P1: 4, P2: 0, P3: 0 })
        _gain(fs, { FIRE: 1 })  // crosses threshold 5: gain PW:2
        assert.strictEqual(fs.FIRE, 5)
        assert.strictEqual(fs.P2, 2)
    })

    test("WATER routes through _advance_cult", () => {
        const fs = make_fs({ WATER: 0 })
        _gain(fs, { WATER: 2 })
        assert.strictEqual(fs.WATER, 2)
    })

    test("EARTH routes through _advance_cult", () => {
        const fs = make_fs({ EARTH: 0 })
        _gain(fs, { EARTH: 3 })
        assert.strictEqual(fs.EARTH, 3)
    })

    test("AIR routes through _advance_cult", () => {
        const fs = make_fs({ AIR: 0 })
        _gain(fs, { AIR: 1 })
        assert.strictEqual(fs.AIR, 1)
    })

    test("multiple resources in one call", () => {
        const fs = make_fs({ C: 3, W: 2, VP: 20 })
        _gain(fs, { C: 4, W: 1, VP: 3 })
        assert.strictEqual(fs.C, 7)
        assert.strictEqual(fs.W, 3)
        assert.strictEqual(fs.VP, 23)
    })

    test("zero amounts are ignored", () => {
        const fs = make_fs({ C: 5, W: 3 })
        _gain(fs, { C: 0, W: 0, VP: 0 })
        assert.strictEqual(fs.C, 5)
        assert.strictEqual(fs.W, 3)
    })

    test("undefined/falsy amounts are ignored", () => {
        const fs = make_fs({ C: 5 })
        _gain(fs, { C: undefined })
        assert.strictEqual(fs.C, 5)
    })

    test("gaining to a previously-undefined resource key works", () => {
        const fs = make_fs({})
        _gain(fs, { SPADE: 2 })
        assert.strictEqual(fs.SPADE, 2)
    })

    test("empty resource object changes nothing", () => {
        const fs = make_fs({ C: 10, W: 5 })
        _gain(fs, {})
        assert.strictEqual(fs.C, 10)
        assert.strictEqual(fs.W, 5)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("4: _pay — resource deduction with atomic validation", () => {

    test("pay coins: correctly deducted", () => {
        const fs = make_fs({ C: 10 })
        _pay(fs, { C: 3 })
        assert.strictEqual(fs.C, 7)
    })

    test("pay workers: correctly deducted", () => {
        const fs = make_fs({ W: 5 })
        _pay(fs, { W: 2 })
        assert.strictEqual(fs.W, 3)
    })

    test("pay priests: correctly deducted", () => {
        const fs = make_fs({ P: 3 })
        _pay(fs, { P: 1 })
        assert.strictEqual(fs.P, 2)
    })

    test("pay VP: correctly deducted", () => {
        const fs = make_fs({ VP: 15 })
        _pay(fs, { VP: 5 })
        assert.strictEqual(fs.VP, 10)
    })

    test("pay PW: deducted from P3, returned to P1", () => {
        const fs = make_fs({ P1: 2, P2: 3, P3: 7 })
        _pay(fs, { PW: 4 })
        assert.strictEqual(fs.P3, 3)   // 7 - 4 = 3
        assert.strictEqual(fs.P1, 6)   // 2 + 4 = 6
        assert.strictEqual(fs.P2, 3)   // unchanged
    })

    test("pay PW: total token count unchanged", () => {
        const fs = make_fs({ P1: 2, P2: 3, P3: 7 })
        const total = fs.P1 + fs.P2 + fs.P3
        _pay(fs, { PW: 4 })
        assert.strictEqual(fs.P1 + fs.P2 + fs.P3, total)
    })

    test("throws when not enough coins", () => {
        const fs = make_fs({ C: 2 })
        assert.throws(() => _pay(fs, { C: 5 }), /not enough C/i)
    })

    test("throws when not enough workers", () => {
        const fs = make_fs({ W: 1 })
        assert.throws(() => _pay(fs, { W: 3 }), /not enough W/i)
    })

    test("throws when not enough priests", () => {
        const fs = make_fs({ P: 0 })
        assert.throws(() => _pay(fs, { P: 1 }), /not enough P/i)
    })

    test("throws when not enough power in P3 (even if P1+P2 would cover it)", () => {
        const fs = make_fs({ P1: 5, P2: 5, P3: 2 })
        assert.throws(() => _pay(fs, { PW: 4 }), /not enough PW/i)
    })

    test("atomic validation: failed pay leaves ALL resources unchanged", () => {
        const fs = make_fs({ C: 10, W: 1 })
        // W is insufficient; C should NOT be deducted either
        assert.throws(() => _pay(fs, { C: 3, W: 5 }))
        assert.strictEqual(fs.C, 10, "C should be unchanged after failed pay")
        assert.strictEqual(fs.W, 1, "W should be unchanged after failed pay")
    })

    test("atomic validation: multiple-resource fail with first or last resource", () => {
        const fs = make_fs({ C: 10, W: 5, VP: 2 })
        // VP insufficient
        assert.throws(() => _pay(fs, { C: 1, W: 1, VP: 10 }))
        assert.strictEqual(fs.C, 10)
        assert.strictEqual(fs.W, 5)
        assert.strictEqual(fs.VP, 2)
    })

    test("zero amounts are skipped (no error from zero)", () => {
        const fs = make_fs({ C: 0 })
        assert.doesNotThrow(() => _pay(fs, { C: 0, W: 0 }))
    })

    test("paying exact amount succeeds", () => {
        const fs = make_fs({ C: 3 })
        _pay(fs, { C: 3 })
        assert.strictEqual(fs.C, 0)
    })

    test("multiple valid resources paid together", () => {
        const fs = make_fs({ C: 8, W: 4, P1: 3, P2: 2, P3: 6 })
        _pay(fs, { C: 3, W: 2, PW: 4 })
        assert.strictEqual(fs.C, 5)
        assert.strictEqual(fs.W, 2)
        assert.strictEqual(fs.P3, 2)
        assert.strictEqual(fs.P1, 7)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("5: _terraform_distance — circular color wheel", () => {

    // COLOR_WHEEL = ['yellow','brown','black','blue','green','gray','red']
    // Indices:        0        1       2       3      4       5      6

    test("same color → distance 0", () => {
        for (const color of COLOR_WHEEL) {
            assert.strictEqual(_terraform_distance(color, color), 0, `${color}→${color}`)
        }
    })

    test("adjacent neighbors → distance 1", () => {
        assert.strictEqual(_terraform_distance("yellow", "brown"), 1)
        assert.strictEqual(_terraform_distance("brown", "yellow"), 1)
        assert.strictEqual(_terraform_distance("brown", "black"), 1)
        assert.strictEqual(_terraform_distance("red", "yellow"), 1)  // circular wrap
        assert.strictEqual(_terraform_distance("yellow", "red"), 1)
    })

    test("two steps apart → distance 2", () => {
        assert.strictEqual(_terraform_distance("yellow", "black"), 2)
        assert.strictEqual(_terraform_distance("black", "yellow"), 2)
        assert.strictEqual(_terraform_distance("gray", "red"), 1)    // adjacent
        assert.strictEqual(_terraform_distance("yellow", "gray"), 2) // 0 and 5: |0-5|=5, 7-5=2
    })

    test("maximum distance is 3 (opposite sides of 7-color wheel)", () => {
        // yellow(0)→blue(3): |0-3|=3, 7-3=4, min=3
        assert.strictEqual(_terraform_distance("yellow", "blue"), 3)
        // yellow(0)→green(4): |0-4|=4, 7-4=3, min=3
        assert.strictEqual(_terraform_distance("yellow", "green"), 3)
    })

    test("distance is symmetric (same both ways)", () => {
        const colors = COLOR_WHEEL
        for (let i = 0; i < colors.length; i++) {
            for (let j = i + 1; j < colors.length; j++) {
                const d1 = _terraform_distance(colors[i], colors[j])
                const d2 = _terraform_distance(colors[j], colors[i])
                assert.strictEqual(d1, d2, `${colors[i]}↔${colors[j]} should be symmetric`)
            }
        }
    })

    test("all distances are 0–3 (no value exceeds 3)", () => {
        const colors = COLOR_WHEEL
        for (const a of colors) {
            for (const b of colors) {
                const d = _terraform_distance(a, b)
                assert.ok(d >= 0 && d <= 3, `${a}→${b}: distance ${d} out of range`)
            }
        }
    })

    test("throws for unknown from_color", () => {
        assert.throws(() => _terraform_distance("purple", "yellow"), /unknown terrain color/i)
    })

    test("throws for unknown to_color", () => {
        assert.throws(() => _terraform_distance("yellow", "orange"), /unknown terrain color/i)
    })

    test("specific distances match circular-wheel expectations", () => {
        // black(2) to gray(5): |2-5|=3, 7-3=4, min=3
        assert.strictEqual(_terraform_distance("black", "gray"), 3)
        // black(2) to blue(3): 1
        assert.strictEqual(_terraform_distance("black", "blue"), 1)
        // green(4) to red(6): |4-6|=2, 7-2=5, min=2
        assert.strictEqual(_terraform_distance("green", "red"), 2)
        // gray(5) to brown(1): |5-1|=4, 7-4=3, min=3
        assert.strictEqual(_terraform_distance("gray", "brown"), 3)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("6: _terraform_cost — worker cost to terraform", () => {

    // alchemists.dig.cost = [{W:3},{W:2},{W:1}]
    const alchemists_def = FACTIONS["alchemists"]

    test("same color → empty cost object", () => {
        const cost = _terraform_cost("yellow", "yellow", alchemists_def, 0)
        assert.deepStrictEqual(cost, {})
    })

    test("1 step at dig level 0 → W:3", () => {
        const cost = _terraform_cost("yellow", "brown", alchemists_def, 0)
        assert.deepStrictEqual(cost, { W: 3 })
    })

    test("1 step at dig level 1 → W:2", () => {
        const cost = _terraform_cost("yellow", "brown", alchemists_def, 1)
        assert.deepStrictEqual(cost, { W: 2 })
    })

    test("1 step at dig level 2 → W:1", () => {
        const cost = _terraform_cost("yellow", "brown", alchemists_def, 2)
        assert.deepStrictEqual(cost, { W: 1 })
    })

    test("2 steps at dig level 0 → W:6", () => {
        const cost = _terraform_cost("yellow", "black", alchemists_def, 0)
        assert.deepStrictEqual(cost, { W: 6 })
    })

    test("3 steps at dig level 0 → W:9 (max distance)", () => {
        const cost = _terraform_cost("yellow", "blue", alchemists_def, 0)
        assert.deepStrictEqual(cost, { W: 9 })
    })

    test("3 steps at dig level 1 → W:6", () => {
        const cost = _terraform_cost("yellow", "blue", alchemists_def, 1)
        assert.deepStrictEqual(cost, { W: 6 })
    })

    test("3 steps at dig level 2 → W:3", () => {
        const cost = _terraform_cost("yellow", "blue", alchemists_def, 2)
        assert.deepStrictEqual(cost, { W: 3 })
    })

    test("cost is symmetric (same in both directions)", () => {
        const a = _terraform_cost("black", "green", alchemists_def, 0)
        const b = _terraform_cost("green", "black", alchemists_def, 0)
        assert.deepStrictEqual(a, b)
    })

    test("another faction (engineers) uses own cost table", () => {
        const def = FACTIONS["engineers"]
        const cost0 = _terraform_cost("yellow", "brown", def, 0)
        // engineers.dig.cost[0] should be { W: 3 } (standard)
        assert.strictEqual(typeof cost0.W, "number")
        assert.ok(cost0.W > 0)
    })

    test("witches: 1 step at dig level 0", () => {
        const def = FACTIONS["witches"]
        const cost = _terraform_cost("green", "yellow", def, 0)
        assert.strictEqual(typeof cost.W, "number")
        assert.ok(cost.W > 0)
    })

    test("all factions with standard dig produce a non-empty cost object for non-same colors", () => {
        // Note: some factions use P (priests) per spade (darklings), not W.
        // Acolytes have an empty dig cost object (special volcano mechanics — skip).
        const test_pairs = [["yellow", "brown"], ["black", "blue"]]
        for (const faction_name of Object.keys(FACTIONS)) {
            const faction_def = FACTIONS[faction_name]
            if (!faction_def.dig) continue  // skip no-dig factions (e.g. riverwalkers)
            const cost_entry = faction_def.dig.cost[faction_def.dig.level] || {}
            if (Object.keys(cost_entry).length === 0) continue  // skip empty-cost factions (acolytes)
            for (const [from, to] of test_pairs) {
                const cost = _terraform_cost(from, to, faction_def, faction_def.dig.level)
                const keys = Object.keys(cost)
                assert.ok(keys.length > 0, `${faction_name}: ${from}→${to} should have a non-empty cost`)
                const total = Object.values(cost).reduce((s, v) => s + v, 0)
                assert.ok(total > 0, `${faction_name}: ${from}→${to} total cost should be positive`)
            }
        }
    })

    test("faction with dig:null uses fallback W:3 per spade", () => {
        // riverwalkers has dig: null
        const def = FACTIONS["riverwalkers"]
        if (!def) return  // skip if riverwalkers not in FACTIONS (shouldn't happen)
        const cost = _terraform_cost("yellow", "brown", def, 0)
        assert.deepStrictEqual(cost, { W: 3 })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("7: Integration — resource operations on real faction state", () => {

    function get_real_fs(faction_name) {
        let G = RULES.setup(42, "Standard", { players: "2", map: "standard" })
        G = RULES.action(G, "Player 1", "select_faction", faction_name)
        return G.factions["Player 1"]
    }

    test("_gain on real swarmlings faction state: gain C", () => {
        const fs = get_real_fs("swarmlings")
        const before = fs.C
        _gain(fs, { C: 5 })
        assert.strictEqual(fs.C, before + 5)
    })

    test("_pay on real swarmlings faction state: pay W", () => {
        const fs = get_real_fs("swarmlings")
        const before = fs.W
        _pay(fs, { W: 2 })
        assert.strictEqual(fs.W, before - 2)
    })

    test("_gain PW on real mermaids faction state (low P1)", () => {
        const fs = get_real_fs("mermaids")
        const total_before = fs.P1 + fs.P2 + fs.P3
        _gain_power(fs, 3)
        assert.strictEqual(fs.P1 + fs.P2 + fs.P3, total_before)  // total unchanged
    })

    test("_advance_cult on real alchemists (starts at FIRE:1, WATER:1)", () => {
        const fs = get_real_fs("alchemists")
        assert.strictEqual(fs.FIRE, 1)
        _advance_cult(fs, "FIRE", 1)
        assert.strictEqual(fs.FIRE, 2)
    })

    test("_advance_cult FIRE 1→3 on alchemists: crosses threshold 2 (PW+1)", () => {
        const fs = get_real_fs("alchemists")
        // alchemists FIRE starts at 1; advance 2 → FIRE=3, crossing threshold 2
        const p1_before = fs.P1
        _advance_cult(fs, "FIRE", 2)
        assert.strictEqual(fs.FIRE, 3)
        // PW:1 gained → 1 token moved P1→P2 (or P1→P2, or if P1=0 then P2→P3)
        // alchemists: P1=5, so 1 from P1→P2
        assert.strictEqual(fs.P1, p1_before - 1)
    })

    test("_terraform_cost from faction home terrain to another", () => {
        // alchemists: home = black; from yellow to black = dist 2. At dig_level 0: W=6
        const def = FACTIONS["alchemists"]
        const cost = _terraform_cost("yellow", "black", def, 0)
        assert.deepStrictEqual(cost, { W: 6 })
    })

    test("_pay throws on real faction with insufficient resource", () => {
        const fs = get_real_fs("engineers")
        // engineers start with low W (1 or 2)
        assert.throws(() => _pay(fs, { W: 20 }), /not enough W/i)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
group("8: Edge cases and boundary conditions", () => {

    test("_gain_power with amount=1 from full P1: promotes exactly 1", () => {
        const fs = make_fs({ P1: 5, P2: 0, P3: 0 })
        _gain_power(fs, 1)
        assert.strictEqual(fs.P1, 4)
        assert.strictEqual(fs.P2, 1)
    })

    test("_advance_cult: advancing 0 steps does nothing", () => {
        const fs = make_fs({ FIRE: 3 })
        const steps = _advance_cult(fs, "FIRE", 0)
        assert.strictEqual(fs.FIRE, 3)
        assert.strictEqual(steps, 0)
    })

    test("_pay: paying 0 of a missing resource does not throw", () => {
        const fs = make_fs({ SPADE: undefined })
        assert.doesNotThrow(() => _pay(fs, { SPADE: 0 }))
    })

    test("_terraform_distance: all pairs on 7-color wheel are deterministic", () => {
        // Just verify it doesn't throw and returns a valid number
        for (const a of COLOR_WHEEL) {
            for (const b of COLOR_WHEEL) {
                const d = _terraform_distance(a, b)
                assert.ok(Number.isInteger(d) && d >= 0 && d <= 3)
            }
        }
    })

    test("_gain_power: consecutive gains accumulate correctly", () => {
        const fs = make_fs({ P1: 6, P2: 0, P3: 0 })
        _gain_power(fs, 2)  // P1=4, P2=2
        _gain_power(fs, 2)  // P1=2, P2=4
        _gain_power(fs, 2)  // P1=0, P2=6
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 6)
        assert.strictEqual(fs.P3, 0)
    })

    test("_gain_power from P2→P3 only (after P1 exhausted)", () => {
        const fs = make_fs({ P1: 0, P2: 6, P3: 0 })
        _gain_power(fs, 3)
        assert.strictEqual(fs.P2, 3)
        assert.strictEqual(fs.P3, 3)
    })

    test("_pay then _gain_power is idempotent (tokens return to bowl 1)", () => {
        const fs = make_fs({ P1: 0, P2: 0, P3: 5 })
        _pay(fs, { PW: 3 })   // P3→P1: P1=3, P3=2
        assert.strictEqual(fs.P1, 3)
        assert.strictEqual(fs.P3, 2)
        _gain_power(fs, 3)    // P1→P2: P1=0, P2=3
        assert.strictEqual(fs.P1, 0)
        assert.strictEqual(fs.P2, 3)
    })

    test("_gain with negative amount field (should be skipped)", () => {
        const fs = make_fs({ C: 10 })
        _gain(fs, { C: -5 })  // negative skipped by amount <= 0 guard
        assert.strictEqual(fs.C, 10)
    })

    test("CULT_TRACK_POWER_GAINS thresholds match expected values in constants", () => {
        // Verify the constants we are relying on haven't changed
        assert.strictEqual(CULT_TRACK_POWER_GAINS.length, 4)
        assert.strictEqual(CULT_TRACK_POWER_GAINS[0].threshold, 2)
        assert.strictEqual(CULT_TRACK_POWER_GAINS[1].threshold, 4)
        assert.strictEqual(CULT_TRACK_POWER_GAINS[2].threshold, 6)
        assert.strictEqual(CULT_TRACK_POWER_GAINS[3].threshold, 9)
        assert.strictEqual(CULT_TRACK_POWER_GAINS[3].KEY, -1)
    })

    test("JSON round-trip of faction state after resource ops", () => {
        const fs = make_fs()
        _gain(fs, { C: 3, PW: 2, FIRE: 1 })
        _pay(fs, { W: 1 })
        const copy = JSON.parse(JSON.stringify(fs))
        assert.deepStrictEqual(copy, fs)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Summary

const line = "─".repeat(52)
console.log(`\n${line}`)
console.log(`  Step 3.1 results: ${passed} passed, ${failed} failed`)

if (failures.length > 0) {
    console.log("\nFailed tests:")
    for (const { name, err } of failures) {
        console.log(`  ✗ ${name}\n    ${err.message}`)
    }
}

if (failed > 0) process.exit(1)
