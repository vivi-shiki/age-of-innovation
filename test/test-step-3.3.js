"use strict"

// ============================================================
// Age of Innovation — test/test-step-3.3.js
// Unit tests for the game state machine & action phases.
//
// Step 3.3 scope:
//   • pick_bonus action — validation + happy path (initial-bonus phase)
//   • _calc_income — building, favor, bonus, scoring-tile income
//   • income action — validation + happy path + phase transition
//   • _calc_pass_vp — bonus and favor tile pass VP
//   • leech action — accept / partial / decline / VP clamping
//   • pass action — validation + VP award + tile swap + round order
//   • _advance_play — circular order, leech priority
//   • Round transitions — end_round → next income / finish
//   • _begin_finish — result sorted by VP
//   • JSON safety after all phases
//   • End-to-end 2-player mini-game (1 round)
//
// Run:  node test/test-step-3.3.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))
const {
	_action_pick_bonus,
	_calc_income,
	_action_income,
	_begin_income,
	_begin_play,
	_action_leech,
	_calc_pass_vp,
	_action_pass,
	_advance_play,
	_end_round,
	_begin_finish,
} = RULES._test

const { FACTIONS }       = require(path.join(__dirname, "..", "data", "factions.js"))
const { BONUS_TILES, FAVOR_TILES, SCORING_TILES } =
	require(path.join(__dirname, "..", "data", "tiles.js"))

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

function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a 2-player game (halflings, nomads) fully through initial dwellings.
 * State on return: "initial-bonus", action_queue=[P2, P1].
 *   halflings → brown; placed at A1, A7
 *   nomads    → yellow; placed at A5, B1
 */
function make_at_initial_bonus() {
	let G = RULES.setup(42, "Standard", { players: "2" })
	G = RULES.action(G, "Player 1", "select_faction", "halflings")
	G = RULES.action(G, "Player 2", "select_faction", "nomads")
	// Snake order: P1 → P2 → P2 → P1
	G = RULES.action(G, "Player 1", "place_dwelling", "A1")
	G = RULES.action(G, "Player 2", "place_dwelling", "A5")
	G = RULES.action(G, "Player 2", "place_dwelling", "B1")
	G = RULES.action(G, "Player 1", "place_dwelling", "A7")
	return G
}

/** First available bonus tile name in the pool. */
function first_bon(G) {
	return Object.keys(BONUS_TILES).find(n => (G.pool[n] || 0) > 0)
}

/** First two available bonus tile names (distinct). */
function two_bon(G) {
	const avail = Object.keys(BONUS_TILES).filter(n => (G.pool[n] || 0) > 0)
	return [avail[0], avail[1]]
}

/**
 * Build game state at income phase (both players picked bonus tiles).
 * Returns G in "income" state, round 1.
 */
function make_at_income() {
	let G = make_at_initial_bonus()
	const [bon_p2, bon_p1] = two_bon(G)
	G = RULES.action(G, "Player 2", "pick_bonus", bon_p2)
	G = RULES.action(G, "Player 1", "pick_bonus", bon_p1)
	return G
}

/**
 * Build game state at play phase (both players took income).
 * Returns G in "play" state, round 1.
 */
function make_at_play() {
	let G = make_at_income()
	G = RULES.action(G, "Player 1", "income")
	G = RULES.action(G, "Player 2", "income")
	return G
}

// ─────────────────────────────────────────────────────────────────────────────
group("1: pick_bonus — validation errors", () => {

	test("wrong phase throws", () => {
		let G = RULES.setup(42, "Standard", { players: "2" })
		G = RULES.action(G, "Player 1", "select_faction", "halflings")
		G = RULES.action(G, "Player 2", "select_faction", "nomads")
		// Still in initial-dwellings phase
		assert.throws(
			() => RULES.action(G, "Player 1", "pick_bonus", "BON3"),
			/not in bonus tile/i
		)
	})

	test("non-string tile name throws", () => {
		const G = make_at_initial_bonus()
		assert.throws(
			() => _action_pick_bonus(G, "Player 2", null),
			/non-empty string/i
		)
	})

	test("empty string tile name throws", () => {
		const G = make_at_initial_bonus()
		assert.throws(
			() => _action_pick_bonus(G, "Player 2", ""),
			/non-empty string/i
		)
	})

	test("unknown tile name throws", () => {
		const G = make_at_initial_bonus()
		assert.throws(
			() => _action_pick_bonus(G, "Player 2", "BON99"),
			/unknown bonus tile/i
		)
	})

	test("tile not in pool throws", () => {
		const G = make_at_initial_bonus()
		// Find a tile that exists in BONUS_TILES but not in pool
		const not_in_pool = Object.keys(BONUS_TILES).find(n => !(G.pool[n] || 0))
		if (not_in_pool) {
			assert.throws(
				() => _action_pick_bonus(G, "Player 2", not_in_pool),
				/not available/i
			)
		}
	})

	test("not your turn throws", () => {
		const G = make_at_initial_bonus()
		// P2 is first in initial-bonus queue; P1 trying to act should fail
		assert.throws(
			() => RULES.action(G, "Player 1", "pick_bonus", first_bon(G)),
			/not your turn/i
		)
	})
})

group("2: pick_bonus — happy path", () => {

	test("tile removed from pool after pick", () => {
		const G0 = make_at_initial_bonus()
		const bon = first_bon(G0)
		const G   = clone(G0)
		_action_pick_bonus(G, "Player 2", bon)
		assert.strictEqual(G.pool[bon], 0)
	})

	test("tile assigned to faction", () => {
		const G0 = make_at_initial_bonus()
		const bon = first_bon(G0)
		const G   = clone(G0)
		_action_pick_bonus(G, "Player 2", bon)
		assert.strictEqual(G.factions["Player 2"].bonus_tile, bon)
	})

	test("queue advances to next player after P2 picks", () => {
		const G0 = make_at_initial_bonus()
		const bon = first_bon(G0)
		const G   = clone(G0)
		_action_pick_bonus(G, "Player 2", bon)
		assert.strictEqual(G.active, "Player 1")
		assert.strictEqual(G.action_queue[0].role, "Player 1")
	})

	test("after both pick bonus → transitions to income (state = 'income')", () => {
		const G = make_at_income()
		assert.strictEqual(G.state, "income")
	})

	test("after both pick → round incremented to 1", () => {
		const G = make_at_income()
		assert.strictEqual(G.round, 1)
	})

	test("after both pick → income queue has both players", () => {
		const G = make_at_income()
		assert.strictEqual(G.action_queue.length, 2)
		assert.ok(G.action_queue.every(e => e.type === "income"))
	})

	test("_actions_for in initial-bonus returns pick_bonus with available tiles", () => {
		const G  = make_at_initial_bonus()
		const V  = RULES.view(G, "Player 2")
		assert.ok(Array.isArray(V.actions.pick_bonus))
		assert.ok(V.actions.pick_bonus.length > 0)
		assert.ok(V.actions.pick_bonus.every(n => BONUS_TILES[n]))
	})
})

group("3: _calc_income — building income", () => {

	test("no buildings → only D[0] income applies", () => {
		const G = make_at_income()
		// halflings D income array: [1, 2, 3, 4, 5, 6, 7, 8, 8]
		// At D=0 → would give 1W (base). After initial placement D=2 → 3W.
		// Test with manually set D=0 to check array lookup
		const G2 = clone(G)
		G2.factions["Player 1"].buildings.D = 0
		const income = _calc_income(G2, "Player 1")
		// D[0] = 1 for halflings
		assert.strictEqual(income.W, 1)
	})

	test("halflings with 2D → W income = 3", () => {
		const G     = make_at_income()
		// Player 1 is halflings, placed 2 dwellings in initial-dwellings
		const fs    = G.factions["Player 1"]
		assert.strictEqual(fs.buildings.D, 2)
		const income = _calc_income(G, "Player 1")
		// D[2] = 3 for halflings, plus BON tile income (passed=true)
		// Just check the building portion is 3W (bonus is additive on top)
		const bon_tile = BONUS_TILES[fs.bonus_tile]
		const bon_W    = (bon_tile && bon_tile.income && bon_tile.income.W) ? bon_tile.income.W : 0
		assert.strictEqual(income.W, 3 + bon_W)
	})

	test("TP income included when TP count > 0", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].buildings.TP = 1
		const income = _calc_income(G2, "Player 1")
		// halflings TP[1]: C=2, PW=1
		const bon    = BONUS_TILES[G2.factions["Player 1"].bonus_tile]
		const bon_C  = (bon && bon.income && bon.income.C) ? bon.income.C : 0
		const bon_PW = (bon && bon.income && bon.income.PW) ? bon.income.PW : 0
		assert.ok((income.C || 0) >= 2 + bon_C)
		assert.ok((income.PW || 0) >= 1 + bon_PW)
	})

	test("multiple building types add up", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].buildings.D  = 3   // W[3] = 4
		G2.factions["Player 1"].buildings.TE = 2   // P[2] = 2
		const income = _calc_income(G2, "Player 1")
		assert.ok((income.W || 0) >= 4)   // At least 4W from 3D
		assert.ok((income.P || 0) >= 2)   // At least 2P from 2TE
	})
})

group("4: _calc_income — favor, bonus, scoring income", () => {

	test("favor tile FAV7 income: W:1 PW:1", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].favor_tiles = ["FAV7"]
		const baseIncome   = _calc_income(G, "Player 1")
		const withFav      = _calc_income(G2, "Player 1")
		assert.strictEqual((withFav.W || 0) - (baseIncome.W || 0), 1)
		assert.strictEqual((withFav.PW || 0) - (baseIncome.PW || 0), 1)
	})

	test("FAV9 income: C:3", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].favor_tiles = ["FAV9"]
		const baseIncome = _calc_income(G, "Player 1")
		const withFav    = _calc_income(G2, "Player 1")
		assert.strictEqual((withFav.C || 0) - (baseIncome.C || 0), 3)
	})

	test("bonus tile income applies when passed=true", () => {
		const G      = make_at_income()   // passed=true forced for round 1
		const fs     = G.factions["Player 1"]
		assert.ok(fs.passed)
		const income = _calc_income(G, "Player 1")
		const bon    = BONUS_TILES[fs.bonus_tile]
		if (bon && bon.income) {
			for (const [res, amt] of Object.entries(bon.income)) {
				assert.ok((income[res] || 0) > 0, `bonus ${res} income should be > 0`)
			}
		}
	})

	test("bonus tile income NOT applied when passed=false", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].passed = false
		const income = _calc_income(G2, "Player 1")
		// Use a known bonus tile with income and compare vs passed=true
		const bon = BONUS_TILES[G2.factions["Player 1"].bonus_tile]
		if (bon && bon.income && bon.income.W) {
			const income_passed = _calc_income(G, "Player 1")
			assert.ok((income_passed.W || 0) > (income.W || 0))
		}
	})

	test("scoring tile SCORE3 (cult:WATER req:4 income:P:1) — correct multiplier", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		// Force current scoring tile to SCORE3
		G2.current_scoring_tile = "SCORE3"
		G2.scoring_tiles[0]     = "SCORE3"
		// Set WATER cult level to 8 → floor(8/4) = 2 → 2P
		G2.factions["Player 1"].WATER = 8
		const income = _calc_income(G2, "Player 1")
		assert.ok((income.P || 0) >= 2)
	})

	test("scoring tile income skipped in round 6", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		G2.round               = 6
		G2.current_scoring_tile = "SCORE3"
		G2.factions["Player 1"].WATER = 8
		const base   = _calc_income(G, "Player 1")
		const r6     = _calc_income(G2, "Player 1")
		// P from scoring tile should not add in round 6
		const scoring = SCORING_TILES["SCORE3"]
		const mul     = Math.floor(8 / scoring.req)
		// r6.P should be base.P minus the scoring contribution
		assert.ok((r6.P || 0) < (base.P || 0) + mul * scoring.income.P)
	})
})

group("5: income action — validation", () => {

	test("income action in wrong phase throws", () => {
		const G = make_at_play()
		assert.throws(
			() => RULES.action(G, "Player 1", "income"),
			/not in income phase/i
		)
	})

	test("income taken twice throws", () => {
		const G  = make_at_income()
		const G2 = clone(G)
		_action_income(G2, "Player 1")
		// In G2, Player 1 already took income; they're no longer active, so test the flag
		G2.factions["Player 1"].income_taken = true
		G2.active = "Player 1"
		assert.throws(
			() => _action_income(G2, "Player 1"),
			/already taken/i
		)
	})

	test("not-your-turn check in exports.action", () => {
		const G = make_at_income()
		// income queue order = turn_order = [P1, P2]; active is P1
		assert.throws(
			() => RULES.action(G, "Player 2", "income"),
			/not your turn/i
		)
	})
})

group("6: income action — happy path", () => {

	test("halflings gain W from dwellings after taking income", () => {
		const G      = make_at_income()
		const before = G.factions["Player 1"].W
		const income = _calc_income(G, "Player 1")
		const G2     = clone(G)
		_action_income(G2, "Player 1")
		assert.strictEqual(G2.factions["Player 1"].W, before + (income.W || 0))
	})

	test("income_taken flag set after taking income", () => {
		const G = clone(make_at_income())
		_action_income(G, "Player 1")
		assert.ok(G.factions["Player 1"].income_taken)
	})

	test("queue advances to P2 after P1 takes income", () => {
		const G = clone(make_at_income())
		_action_income(G, "Player 1")
		assert.strictEqual(G.active, "Player 2")
	})

	test("both players can take income in sequence", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		// Both should have income_taken=true (but _begin_play resets it)
		// After both take income, we're in play phase
		assert.strictEqual(G.state, "play")
	})

	test("bonus tile C income added (BON3 = C:6)", () => {
		// Force player to have BON3 (C:6 income) and check income includes it
		const G = make_at_income()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON3"
		G2.factions["Player 1"].passed     = true
		const before = G2.factions["Player 1"].C
		const income = _calc_income(G2, "Player 1")
		_action_income(G2, "Player 1")
		assert.ok(G2.factions["Player 1"].C >= before + (BONUS_TILES.BON3.income.C || 0))
	})
})

group("7: income → play transition", () => {

	test("state = 'play' after both players take income", () => {
		const G = make_at_play()
		assert.strictEqual(G.state, "play")
	})

	test("passed flag reset to false in play phase", () => {
		const G = make_at_play()
		assert.strictEqual(G.factions["Player 1"].passed, false)
		assert.strictEqual(G.factions["Player 2"].passed, false)
	})

	test("active = turn_order[0] at start of play", () => {
		const G = make_at_play()
		assert.strictEqual(G.active, G.turn_order[0])
	})

	test("power actions reset to 1 at round start", () => {
		const G = make_at_income()
		// Simulate a power action being used in a prior round
		const G2 = clone(G)
		G2.pool["ACT1"] = 0
		_action_income(G2, "Player 1")
		_action_income(G2, "Player 2")
		// After income phase starts (begin_income), ACT1 should be reset
		// Already happened when _begin_income was called from _action_pick_bonus
		assert.strictEqual(G.pool["ACT1"], 1)
	})

	test("_actions_for in income phase returns {income: 1}", () => {
		const G = make_at_income()
		const V = RULES.view(G, "Player 1")
		assert.deepStrictEqual(V.actions, { income: 1 })
	})
})

group("8: leech action", () => {

	test("leech outside play phase throws", () => {
		const G = make_at_income()
		const G2 = clone(G)
		G2.action_queue.push({ role: "Player 1", type: "leech", amount: 2, from_role: "Player 2" })
		G2.active = "Player 1"
		assert.throws(() => _action_leech(G2, "Player 1", 2), /not in play/i)
	})

	test("leech with no pending entry throws", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.action_queue = []   // no leech entry
		assert.throws(() => _action_leech(G2, "Player 1", 1), /no pending leech/i)
	})

	test("decline (amount=0) does not change resources", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 3, from_role: "Player 2" }]
		G2.active = "Player 1"
		const before_P3 = G2.factions["Player 1"].P3
		const before_VP = G2.factions["Player 1"].VP
		_action_leech(G2, "Player 1", 0)
		assert.strictEqual(G2.factions["Player 1"].P3, before_P3)
		assert.strictEqual(G2.factions["Player 1"].VP,  before_VP)
	})

	test("accept 1 power — no VP cost", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 3, from_role: "Player 2" }]
		G2.active = "Player 1"
		// halflings start: P1=3, P2=9, P3=0
		const before_VP = G2.factions["Player 1"].VP
		_action_leech(G2, "Player 1", 1)
		// 1 power gained, VP cost = max(0, 1-1) = 0
		assert.strictEqual(G2.factions["Player 1"].VP, before_VP)
	})

	test("accept 3 power — costs 2 VP", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].P1 = 0
		G2.factions["Player 1"].P2 = 0
		G2.factions["Player 1"].P3 = 0
		G2.factions["Player 1"].P1 = 0; G2.factions["Player 1"].P2 = 5
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 3, from_role: "Player 2" }]
		G2.active = "Player 1"
		const before_VP = G2.factions["Player 1"].VP
		_action_leech(G2, "Player 1", 3)
		// 3 power moved from P2 to P3; cost = 3-1 = 2 VP
		assert.strictEqual(G2.factions["Player 1"].VP, before_VP - 2)
	})

	test("VP clamp (insufficient VP allows only partial)", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].VP = 1   // Can pay at most 1 VP → max accept = 2
		G2.factions["Player 1"].P2 = 5
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 4, from_role: "Player 2" }]
		G2.active = "Player 1"
		_action_leech(G2, "Player 1", 4)   // Wants 4, but VP only allows 2
		// actual = min(4, VP+1=2) = 2; gain 2 power; cost = 1 VP
		assert.ok(G2.factions["Player 1"].VP >= 0)
	})

	test("after leech resolved, queue entry removed", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 2, from_role: "Player 2" }]
		G2.active = "Player 1"
		G2.turn_player = "Player 1"
		_action_leech(G2, "Player 1", 0)
		assert.strictEqual(G2.action_queue.length, 0)
	})

	test("after leech resolved with no more entries, advances to next player", () => {
		const G = make_at_play()
		const G2 = clone(G)
		// P1 was main turn player, leech pending for P2
		G2.turn_player = "Player 1"
		G2.factions["Player 1"].passed = true    // P1 passed
		G2.action_queue = [{ role: "Player 2", type: "leech", amount: 2, from_role: "Player 1" }]
		G2.active = "Player 2"
		_action_leech(G2, "Player 2", 0)
		// After P2's leech is resolved, find next non-passed after P1 → P2
		assert.strictEqual(G2.active, "Player 2")
	})

	test("string 'decline' arg coerces to 0 (no effect)", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.action_queue = [{ role: "Player 1", type: "leech", amount: 3, from_role: "Player 2" }]
		G2.active = "Player 1"
		G2.turn_player = "Player 1"
		const before_VP = G2.factions["Player 1"].VP
		_action_leech(G2, "Player 1", "decline")   // should coerce to 0
		assert.strictEqual(G2.factions["Player 1"].VP, before_VP)
	})
})

group("9: pass action — validation", () => {

	test("pass outside play phase throws", () => {
		const G = make_at_income()
		assert.throws(
			() => _action_pass(G, "Player 1", "BON3"),
			/not in play/i
		)
	})

	test("pass without tile name in round 1 throws", () => {
		const G = make_at_play()
		assert.throws(
			() => RULES.action(G, "Player 1", "pass", null),
			/must specify/i
		)
	})

	test("pass with empty string throws", () => {
		const G = make_at_play()
		assert.throws(
			() => RULES.action(G, "Player 1", "pass", ""),
			/must specify/i
		)
	})

	test("pass with unknown tile throws", () => {
		const G = make_at_play()
		assert.throws(
			() => RULES.action(G, "Player 1", "pass", "BON99"),
			/unknown bonus tile/i
		)
	})

	test("pass with unavailable tile throws", () => {
		const G  = make_at_play()
		const bon = G.factions["Player 1"].bonus_tile   // already held by P1
		// find a tile not in pool
		const none = Object.keys(BONUS_TILES).find(n => !(G.pool[n] || 0))
		if (none) {
			assert.throws(
				() => RULES.action(G, "Player 1", "pass", none),
				/not available/i
			)
		}
	})

	test("not-your-turn check", () => {
		const G   = make_at_play()
		const bon = first_bon(G)
		// Player 2 is not active (P1 is active at start of play)
		assert.throws(
			() => RULES.action(G, "Player 2", "pass", bon),
			/not your turn/i
		)
	})
})

group("10: pass action — VP, tile swap, turn order", () => {

	test("BON9 pass VP: D-count indexed", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON9"
		G2.factions["Player 1"].buildings.D = 3   // pass_vp.D[3] = 3
		const other_bon = Object.keys(BONUS_TILES).find(
			n => n !== "BON9" && (G2.pool[n] || 0) > 0
		)
		if (!other_bon) return   // skip if no alternate tiles
		const before_vp = G2.factions["Player 1"].VP
		_action_pass(G2, "Player 1", other_bon)
		// BON9 pass_vp.D = [0,1,2,3,4,5,6,7,8]; D=3 → 3 VP
		assert.strictEqual(G2.factions["Player 1"].VP, before_vp + 3)
	})

	test("no pass VP when bonus tile has no pass_vp", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON3"   // no pass_vp
		const other_bon = Object.keys(BONUS_TILES).find(
			n => n !== "BON3" && (G2.pool[n] || 0) > 0
		)
		if (!other_bon) return
		const before_vp = G2.factions["Player 1"].VP
		_action_pass(G2, "Player 1", other_bon)
		assert.strictEqual(G2.factions["Player 1"].VP, before_vp)
	})

	test("old bonus tile returned to pool after pass", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		const old_bon = G2.factions["Player 1"].bonus_tile
		const new_bon = first_bon(G2)
		_action_pass(G2, "Player 1", new_bon)
		assert.strictEqual(G2.pool[old_bon], 1)
	})

	test("new bonus tile removed from pool and assigned to faction", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		const new_bon = first_bon(G2)
		_action_pass(G2, "Player 1", new_bon)
		assert.strictEqual(G2.factions["Player 1"].bonus_tile, new_bon)
		assert.strictEqual(G2.pool[new_bon], 0)
	})

	test("passed flag set to true after passing", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		_action_pass(G2, "Player 1", first_bon(G2))
		assert.strictEqual(G2.factions["Player 1"].passed, true)
	})

	test("first to pass added to next_turn_order", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		_action_pass(G2, "Player 1", first_bon(G2))
		assert.deepStrictEqual(G2.next_turn_order, ["Player 1"])
	})

	test("FAV12 pass_vp applied (TP indexed)", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].favor_tiles = ["FAV12"]
		G2.factions["Player 1"].buildings.TP = 2   // FAV12.pass_vp.TP[2] = 3
		const other_bon = first_bon(G2)
		const before_vp = G2.factions["Player 1"].VP
		_action_pass(G2, "Player 1", other_bon)
		assert.strictEqual(G2.factions["Player 1"].VP, before_vp + 3)
	})
})

group("11: _calc_pass_vp", () => {

	test("BON7 pass VP: TP-count indexed", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON7"
		G2.factions["Player 1"].buildings.TP = 3   // [0,2,4,6,8][3] = 6
		assert.strictEqual(_calc_pass_vp(G2, "Player 1"), 6)
	})

	test("BON10 pass VP: ship indexed", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON10"
		G2.factions["Player 1"].ship_level = 2   // [0,3,6,9,12,15][2] = 6
		assert.strictEqual(_calc_pass_vp(G2, "Player 1"), 6)
	})

	test("no pass VP tiles → 0", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile = "BON3"   // no pass_vp
		G2.factions["Player 1"].favor_tiles = []
		assert.strictEqual(_calc_pass_vp(G2, "Player 1"), 0)
	})

	test("bonus + favor pass VP stacks", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].bonus_tile  = "BON9"    // D indexed
		G2.factions["Player 1"].buildings.D = 2          // D[2] = 2
		G2.factions["Player 1"].favor_tiles = ["FAV12"]  // TP indexed
		G2.factions["Player 1"].buildings.TP = 1         // TP[1] = 2
		// BON9.D[2]=2 + FAV12.TP[1]=2 = 4
		assert.strictEqual(_calc_pass_vp(G2, "Player 1"), 4)
	})
})

group("12: round transitions", () => {

	test("all pass → end round → income phase (round 2)", () => {
		let G = make_at_play()
		const [bon_p1, bon_p2] = two_bon(G)
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		assert.strictEqual(G.state, "income")
		assert.strictEqual(G.round, 2)
	})

	test("pass order becomes next round's turn_order", () => {
		let G = make_at_play()
		const [bon_p1, bon_p2] = two_bon(G)
		// P1 passes first, then P2 → P1 is first player next round
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		// In income phase (round 2), active = P1 (first in new turn_order)
		assert.strictEqual(G.active, "Player 1")
		assert.strictEqual(G.turn_order[0], "Player 1")
	})

	test("second player to pass becomes second in next turn_order", () => {
		let G = make_at_play()
		const [bon_p2, bon_p1] = two_bon(G)
		// Active is P1; give turn to P2 (P1 passes first but need P2 to pass first)
		// Actually P1 is active first; let P1 pass first then P2
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		assert.strictEqual(G.turn_order[1], "Player 2")
	})

	test("bonus tiles from new pass preserved for round 2 income", () => {
		let G = make_at_play()
		const [bon_p1, bon_p2] = two_bon(G)
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		// In income phase, both factions have new bonus tiles (from passing)
		assert.strictEqual(G.factions["Player 1"].bonus_tile, bon_p1)
		assert.strictEqual(G.factions["Player 2"].bonus_tile, bon_p2)
	})

	test("passed=true in income after end-round (BON income applies)", () => {
		let G = make_at_play()
		const [bon_p1, bon_p2] = two_bon(G)
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		// In income phase, factions still have passed=true from last round
		assert.strictEqual(G.factions["Player 1"].passed, true)
		assert.strictEqual(G.factions["Player 2"].passed, true)
	})

	test("after taking income in round 2, passed resets in play", () => {
		let G = make_at_play()
		const [bon_p1, bon_p2] = two_bon(G)
		G = RULES.action(G, "Player 1", "pass", bon_p1)
		G = RULES.action(G, "Player 2", "pass", bon_p2)
		// Now in income round 2
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		// Now in play round 2
		assert.strictEqual(G.state, "play")
		assert.strictEqual(G.factions["Player 1"].passed, false)
	})
})

group("13: _begin_finish & finish state", () => {

	test("state = 'finish' after 6 rounds", () => {
		const G = make_at_play()
		const G2 = clone(G)
		G2.round = 6
		G2.factions["Player 1"].passed = false
		G2.factions["Player 2"].passed = false
		// P1 passes in round 6 (no tile needed)
		G2.turn_player = "Player 1"
		_action_pass(G2, "Player 1", null)
		// P2 still hasn't passed — state remains "play"
		assert.strictEqual(G2.state, "play")
		assert.strictEqual(G2.active, "Player 2")
		// P2 passes → all passed → finish
		_action_pass(G2, "Player 2", null)
		assert.strictEqual(G2.state, "finish")
	})

	test("_begin_finish sets G.result to sorted roles", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].VP = 30
		G2.factions["Player 2"].VP = 25
		_begin_finish(G2)
		assert.deepStrictEqual(G2.result, ["Player 1", "Player 2"])
	})

	test("_begin_finish with higher VP first", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		G2.factions["Player 1"].VP = 10
		G2.factions["Player 2"].VP = 40
		_begin_finish(G2)
		assert.deepStrictEqual(G2.result, ["Player 2", "Player 1"])
	})

	test("active = null after finish", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		_begin_finish(G2)
		assert.strictEqual(G2.active, null)
	})

	test("view() returns result in finish state", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		_begin_finish(G2)
		const V = RULES.view(G2, "Player 1")
		assert.ok(Array.isArray(V.result))
	})

	test("prompt = 'The game is over.' for all players in finish state", () => {
		const G  = make_at_play()
		const G2 = clone(G)
		_begin_finish(G2)
		const V1 = RULES.view(G2, "Player 1")
		const V2 = RULES.view(G2, "Player 2")
		assert.ok(/game is over/i.test(V1.prompt))
		assert.ok(/game is over/i.test(V2.prompt))
	})

	test("round 6 pass → finish after all pass", () => {
		let G = make_at_play()
		const G2 = clone(G)
		G2.round = 6
		G2.turn_player = "Player 1"
		_action_pass(G2, "Player 1", null)
		// P2 not yet passed, should be income or play?  When P1 passes, P2 is next
		// then P2 passes → _end_round → round>=6 → finish
		const bon_p2 = null // round 6
		if (G2.state !== "finish") {
			_action_pass(G2, "Player 2", null)
		}
		assert.strictEqual(G2.state, "finish")
	})
})

group("14: JSON safety", () => {

	test("G after income is JSON-round-trip safe", () => {
		const G   = make_at_income()
		const str = JSON.stringify(G)
		assert.ok(str.length > 0)
		const G2  = JSON.parse(str)
		assert.strictEqual(G2.state, G.state)
		assert.strictEqual(G2.round, G.round)
	})

	test("G after play transition is JSON-round-trip safe", () => {
		const G   = make_at_play()
		const str = JSON.stringify(G)
		const G2  = JSON.parse(str)
		assert.strictEqual(G2.state, "play")
		assert.ok(!G2.factions["Player 1"].passed)
	})
})

group("15: end-to-end mini-game (2 players, 1 round)", () => {

	test("complete 1-round game reaches income state in round 2", () => {
		let G = make_at_play()
		const [bon1, bon2] = two_bon(G)
		G = RULES.action(G, G.active, "pass", bon1)
		const next = G.active
		G = RULES.action(G, next, "pass", bon2)
		assert.strictEqual(G.state, "income")
		assert.strictEqual(G.round, 2)
	})

	test("view() always returns a valid prompt for each player", () => {
		let G = make_at_play()
		const V1 = RULES.view(G, "Player 1")
		const V2 = RULES.view(G, "Player 2")
		assert.ok(typeof V1.prompt === "string")
		assert.ok(typeof V2.prompt === "string")
	})

	test("view() returns actions only for active player in play phase", () => {
		const G  = make_at_play()
		const active = G.active
		const other  = G.turn_order.find(r => r !== active)
		const Va = RULES.view(G, active)
		const Vo = RULES.view(G, other)
		assert.ok(Va.actions && Va.actions.pass)
		assert.ok(!Vo.actions)
	})

	test("view() actions.pass contains available bonus tiles", () => {
		const G  = make_at_play()
		const Va = RULES.view(G, G.active)
		assert.ok(Array.isArray(Va.actions.pass))
		assert.ok(Va.actions.pass.every(n => BONUS_TILES[n]))
	})

	test("full sequence: setup → factions → dwellings → bonus → income → play", () => {
		let G = RULES.setup(100, "Standard", { players: "2" })
		assert.strictEqual(G.state, "select-factions")
		G = RULES.action(G, "Player 1", "select_faction", "halflings")
		G = RULES.action(G, "Player 2", "select_faction", "nomads")
		assert.strictEqual(G.state, "initial-dwellings")
		G = RULES.action(G, "Player 1", "place_dwelling", "A1")
		G = RULES.action(G, "Player 2", "place_dwelling", "A5")
		G = RULES.action(G, "Player 2", "place_dwelling", "B1")
		G = RULES.action(G, "Player 1", "place_dwelling", "A7")
		assert.strictEqual(G.state, "initial-bonus")
		const [b2, b1] = two_bon(G)
		G = RULES.action(G, "Player 2", "pick_bonus", b2)
		G = RULES.action(G, "Player 1", "pick_bonus", b1)
		assert.strictEqual(G.state, "income")
		G = RULES.action(G, G.active, "income")
		G = RULES.action(G, G.active, "income")
		assert.strictEqual(G.state, "play")
		assert.strictEqual(G.round, 1)
	})
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`)
console.log(`Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}`)
if (failures.length > 0) {
	console.log("\nFailed tests:")
	for (const f of failures) {
		console.log(`  ✗ ${f.name}`)
		console.log(`    ${f.err.message}`)
	}
	process.exitCode = 1
}
