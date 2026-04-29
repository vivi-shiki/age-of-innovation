"use strict"

// ============================================================
// Age of Innovation — test/test-step-0.1.js
// Verifies the module skeleton (Step 0.1) satisfies RTT API contract.
// Run: node test/test-step-0.1.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		console.log(`  ✓  ${name}`)
		passed++
	} catch (err) {
		console.error(`  ✗  ${name}`)
		console.error(`     ${err.message}`)
		failed++
	}
}

// ── exports shape ─────────────────────────────────────────────────────────────

console.log("\n[Step 0.1] RTT API contract — exports\n")

test("exports.scenarios is an array with at least one entry", () => {
	assert.ok(Array.isArray(RULES.scenarios), "scenarios must be an array")
	assert.ok(RULES.scenarios.length >= 1, "scenarios must not be empty")
})

test("exports.roles is a function", () => {
	assert.strictEqual(typeof RULES.roles, "function")
})

test("exports.setup is a function", () => {
	assert.strictEqual(typeof RULES.setup, "function")
})

test("exports.view is a function", () => {
	assert.strictEqual(typeof RULES.view, "function")
})

test("exports.action is a function", () => {
	assert.strictEqual(typeof RULES.action, "function")
})

// ── roles() ───────────────────────────────────────────────────────────────────

console.log("\n[Step 0.1] exports.roles()\n")

test("roles() with players=2 returns 2 distinct strings", () => {
	const roles = RULES.roles("Standard", { players: "2" })
	assert.strictEqual(roles.length, 2)
	assert.ok(roles.every(r => typeof r === "string"), "roles must be strings")
	assert.strictEqual(new Set(roles).size, 2, "roles must be distinct")
})

test("roles() with players=5 returns 5 entries", () => {
	const roles = RULES.roles("Standard", { players: "5" })
	assert.strictEqual(roles.length, 5)
})

test("roles() clamps players to [2, 5]", () => {
	const lo = RULES.roles("Standard", { players: "1" })
	assert.strictEqual(lo.length, 2, "min 2 players")

	const hi = RULES.roles("Standard", { players: "9" })
	assert.strictEqual(hi.length, 5, "max 5 players")
})

test("roles() falls back to 2 when players is missing", () => {
	const roles = RULES.roles("Standard", {})
	assert.strictEqual(roles.length, 2)
})

// ── setup() ───────────────────────────────────────────────────────────────────

console.log("\n[Step 0.1] exports.setup()\n")

const SEED     = 42
const SCENARIO = "Standard"
const OPTS_4P  = { players: "4", map: "standard" }

let G
test("setup() returns an object without throwing", () => {
	G = RULES.setup(SEED, SCENARIO, OPTS_4P)
	assert.ok(G !== null && typeof G === "object")
})

test("G has RTT-required field: seed", () => {
	assert.strictEqual(G.seed, SEED)
})

test("G has RTT-required field: active (a string in roles list)", () => {
	const roles = RULES.roles(SCENARIO, OPTS_4P)
	assert.ok(typeof G.active === "string", "active must be a string")
	assert.ok(roles.includes(G.active), `active "${G.active}" must be a role`)
})

test("G has RTT-required field: result === null at game start", () => {
	assert.strictEqual(G.result, null)
})

test("G has RTT-required field: log (empty array)", () => {
	assert.ok(Array.isArray(G.log))
})

test("G has RTT-required field: undo (array)", () => {
	assert.ok(Array.isArray(G.undo))
})

test("setup() is deterministic – same seed produces identical state", () => {
	const G2 = RULES.setup(SEED, SCENARIO, OPTS_4P)
	assert.deepStrictEqual(JSON.parse(JSON.stringify(G)), JSON.parse(JSON.stringify(G2)))
})

test("setup() with different seeds may differ (sanity check, non-fatal)", () => {
	// This checks that seed is actually stored; full randomness tested elsewhere.
	const G3 = RULES.setup(SEED + 1, SCENARIO, OPTS_4P)
	assert.notStrictEqual(G.seed, G3.seed)
})

test("G survives JSON round-trip without loss", () => {
	const json  = JSON.stringify(G)
	const G2    = JSON.parse(json)
	assert.deepStrictEqual(G2, G)
})

// ── view() ────────────────────────────────────────────────────────────────────

console.log("\n[Step 0.1] exports.view()\n")

const roles4 = RULES.roles(SCENARIO, OPTS_4P)
const ACTIVE  = roles4[0]
const PASSIVE = roles4[1]

test("view() returns an object", () => {
	const V = RULES.view(G, ACTIVE)
	assert.ok(V !== null && typeof V === "object")
})

test("view() includes 'log' array", () => {
	const V = RULES.view(G, ACTIVE)
	assert.ok(Array.isArray(V.log))
})

test("view() includes 'prompt' string", () => {
	const V = RULES.view(G, ACTIVE)
	assert.ok(typeof V.prompt === "string" && V.prompt.length > 0)
})

test("view() for active player includes 'actions' object", () => {
	const V = RULES.view(G, ACTIVE)
	assert.ok(
		V.actions !== undefined && typeof V.actions === "object",
		"active player must have actions"
	)
})

test("view() for passive player does NOT include 'actions'", () => {
	const V = RULES.view(G, PASSIVE)
	assert.strictEqual(V.actions, undefined, "passive player must not have actions")
})

test("view() does not mutate game state", () => {
	const before = JSON.stringify(G)
	RULES.view(G, ACTIVE)
	RULES.view(G, PASSIVE)
	assert.strictEqual(JSON.stringify(G), before, "view() must be read-only")
})

// ── action() ─────────────────────────────────────────────────────────────────

console.log("\n[Step 0.1] exports.action()\n")

test("action() throws when called by non-active player", () => {
	assert.throws(
		() => RULES.action(G, PASSIVE, "select_faction", "swarmlings"),
		/not your turn/i
	)
})

test("action() throws on unknown action name", () => {
	assert.throws(
		() => RULES.action(G, ACTIVE, "nonexistent_action", null),
		/unknown action/i
	)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`)
console.log(`  Step 0.1 results: ${passed} passed, ${failed} failed`)
console.log(`${"─".repeat(50)}\n`)

if (failed > 0) process.exit(1)
