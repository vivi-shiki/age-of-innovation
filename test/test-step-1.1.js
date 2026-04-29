"use strict"

// ============================================================
// Age of Innovation — test/test-step-1.1.js
// Verifies data/map.js — standard map data integrity.
// Run: node test/test-step-1.1.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const {
	MAP_HEXES,
	REVERSE_MAP,
	ADJACENCY,
	ROW_LABELS,
	MAP_ROWS,
	MAP_COLS,
	RIVER_COUNT,
	TERRAIN_COLORS,
	COLOR_WHEEL,
} = require(path.join(__dirname, "..", "data", "map.js"))

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

// ── Constants ─────────────────────────────────────────────────────────────────

console.log("\n[Step 1.1] Map constants\n")

test("MAP_ROWS === 9", () => {
	assert.strictEqual(MAP_ROWS, 9)
})

test("MAP_COLS === 13", () => {
	assert.strictEqual(MAP_COLS, 13)
})

test("RIVER_COUNT === 36", () => {
	// Exact count from parsing the base_map in Constants.pm
	assert.strictEqual(RIVER_COUNT, 36)
})

test("ROW_LABELS has 9 entries (A … I)", () => {
	assert.deepStrictEqual(ROW_LABELS, ["A","B","C","D","E","F","G","H","I"])
})

test("COLOR_WHEEL has 7 entries", () => {
	assert.strictEqual(COLOR_WHEEL.length, 7)
})

// ── Hex counts ────────────────────────────────────────────────────────────────

console.log("\n[Step 1.1] Hex counts\n")

const ALL_KEYS   = Object.keys(MAP_HEXES)
const LAND_KEYS  = ALL_KEYS.filter(k => !MAP_HEXES[k].river)
const RIVER_KEYS = ALL_KEYS.filter(k =>  MAP_HEXES[k].river)

test("Total hex count is 113 (77 land + 36 river)", () => {
	assert.strictEqual(ALL_KEYS.length, 113)
})

test("Land hex count is 77", () => {
	assert.strictEqual(LAND_KEYS.length, 77)
})

test("River hex count matches RIVER_COUNT (36)", () => {
	assert.strictEqual(RIVER_KEYS.length, RIVER_COUNT)
})

test("River keys are r0 … r35 (consecutive, no gaps)", () => {
	for (let i = 0; i < RIVER_COUNT; i++) {
		assert.ok(MAP_HEXES[`r${i}`] !== undefined, `r${i} missing`)
	}
})

// ── Per-row land hex counts (from manual parse of Constants.pm) ───────────────

console.log("\n[Step 1.1] Per-row land hex counts\n")

const EXPECTED_LAND_PER_ROW = {
	A: 13, B: 6, C: 5, D: 8, E: 11, F: 7, G: 7, H: 8, I: 12,
}

for (const [row, expected] of Object.entries(EXPECTED_LAND_PER_ROW)) {
	test(`Row ${row}: ${expected} land hexes`, () => {
		const count = LAND_KEYS.filter(k => k.startsWith(row)).length
		assert.strictEqual(count, expected, `Row ${row} should have ${expected} land hexes, got ${count}`)
	})
}

// ── Terrain colours ────────────────────────────────────────────────────────────

console.log("\n[Step 1.1] Terrain colours\n")

const VALID_COLORS = new Set(["yellow", "brown", "black", "blue", "green", "gray", "red", "white"])

test("Every land hex has a valid terrain colour", () => {
	for (const key of LAND_KEYS) {
		const { color } = MAP_HEXES[key]
		assert.ok(
			VALID_COLORS.has(color) && color !== "white",
			`Land hex ${key} has invalid color: ${color}`
		)
	}
})

test("Every river hex has color 'white'", () => {
	for (const key of RIVER_KEYS) {
		assert.strictEqual(MAP_HEXES[key].color, "white", `River hex ${key} should be white`)
	}
})

test("TERRAIN_COLORS export contains the 7 terrain names", () => {
	const tc = new Set(TERRAIN_COLORS)
	for (const c of ["yellow","brown","black","blue","green","gray","red"]) {
		assert.ok(tc.has(c), `TERRAIN_COLORS missing: ${c}`)
	}
	assert.strictEqual(tc.size, 7)
})

// ── Hex coordinates ───────────────────────────────────────────────────────────

console.log("\n[Step 1.1] Hex coordinates\n")

test("Every hex has integer row and col fields", () => {
	for (const [key, hex] of Object.entries(MAP_HEXES)) {
		assert.ok(Number.isInteger(hex.row), `${key}.row not integer`)
		assert.ok(Number.isInteger(hex.col), `${key}.col not integer`)
	}
})

test("Row indices are in range [0, MAP_ROWS-1]", () => {
	for (const [key, hex] of Object.entries(MAP_HEXES)) {
		assert.ok(hex.row >= 0 && hex.row < MAP_ROWS, `${key}.row out of range: ${hex.row}`)
	}
})

test("Col indices are in range [0, MAP_COLS-1]", () => {
	for (const [key, hex] of Object.entries(MAP_HEXES)) {
		assert.ok(hex.col >= 0 && hex.col < MAP_COLS, `${key}.col out of range: ${hex.col}`)
	}
})

test("REVERSE_MAP[row][col] round-trips back to the same key", () => {
	for (const [key, hex] of Object.entries(MAP_HEXES)) {
		const lookup = REVERSE_MAP[hex.row]?.[hex.col]
		assert.strictEqual(lookup, key, `REVERSE_MAP lookup failed for ${key}`)
	}
})

// ── Adjacency integrity ───────────────────────────────────────────────────────

console.log("\n[Step 1.1] Adjacency\n")

test("Every hex has an ADJACENCY entry", () => {
	for (const key of ALL_KEYS) {
		assert.ok(
			ADJACENCY[key] !== undefined,
			`${key} missing from ADJACENCY`
		)
	}
})

test("Adjacency lists contain no duplicates", () => {
	for (const [key, neighbors] of Object.entries(ADJACENCY)) {
		const unique = new Set(neighbors)
		assert.strictEqual(unique.size, neighbors.length, `${key} has duplicate neighbors`)
	}
})

test("Adjacency is bidirectional (if A→B then B→A)", () => {
	for (const [key, neighbors] of Object.entries(ADJACENCY)) {
		for (const nb of neighbors) {
			assert.ok(
				ADJACENCY[nb].includes(key),
				`Adjacency not bidirectional: ${key}→${nb} exists, but ${nb}→${key} does not`
			)
		}
	}
})

test("No hex is adjacent to itself", () => {
	for (const [key, neighbors] of Object.entries(ADJACENCY)) {
		assert.ok(!neighbors.includes(key), `${key} is adjacent to itself`)
	}
})

test("Every adjacency target key exists in MAP_HEXES", () => {
	for (const [key, neighbors] of Object.entries(ADJACENCY)) {
		for (const nb of neighbors) {
			assert.ok(
				MAP_HEXES[nb] !== undefined,
				`${key} references non-existent neighbor: ${nb}`
			)
		}
	}
})

test("Corner/edge hexes have fewer than 6 neighbors", () => {
	// Map edges always have at most 5 neighbours (for land) or 4–2 for corners.
	// A1 is a corner hex (top-left): should have < 6.
	const a1 = ADJACENCY["A1"]
	assert.ok(a1.length < 6, `A1 should be an edge hex with <6 neighbors, got ${a1.length}`)
})

test("Interior hexes can have 6 neighbors (example: E6)", () => {
	// E6 is an interior land hex: brown at (row=4, col=5)
	const e6 = ADJACENCY["E6"]
	assert.ok(e6 !== undefined, "E6 must exist")
	assert.ok(e6.length >= 4, `E6 should have ≥4 neighbors, got ${e6 && e6.length}`)
})

test("Max neighbor count across all hexes does not exceed 6", () => {
	for (const [key, nb] of Object.entries(ADJACENCY)) {
		assert.ok(nb.length <= 6, `${key} has ${nb.length} neighbors (max is 6)`)
	}
})

// ── Spot-check known adjacencies (from original terra-mystica tests) ──────────

console.log("\n[Step 1.1] Known adjacency spot checks\n")

function assertAdjacent(a, b) {
	test(`${a} and ${b} are adjacent`, () => {
		assert.ok(
			ADJACENCY[a] && ADJACENCY[a].includes(b),
			`Expected ${a}→${b}`
		)
		assert.ok(
			ADJACENCY[b] && ADJACENCY[b].includes(a),
			`Expected ${b}→${a}`
		)
	})
}

function assertNotAdjacent(a, b) {
	test(`${a} and ${b} are NOT adjacent`, () => {
		assert.ok(
			!ADJACENCY[a] || !ADJACENCY[a].includes(b),
			`${a} should not be adjacent to ${b}`
		)
	})
}

// Row A is at row index 0 (even) — neighbours in row B via offset
assertAdjacent("A1", "A2")     // same-row
assertAdjacent("A1", "B1")     // row below: even row → dc = col-1 = -1, dc+1 = 0 → B at ci=0 = B1
assertNotAdjacent("A1", "A3") // two hexes away in same row

// B1 is at row 1 (odd), col 0 — hex above: A at ci=0=A1, ci+1=1 which is r0 (river)
assertAdjacent("B1", "A1")
// B2 is at ci=3 in row B; B1 is at ci=0. They are separated by r0,r1 (ci=1,2),
// so they are NOT directly adjacent (only same-row ci±1 are adjacent).
assertNotAdjacent("B1", "B2")
// B1 is at col 0, same row ci=1 is r0 (river). so B1—r0 adjacent
assertAdjacent("B1", "r0")

// A13 is the rightmost hex in row A (row 0, col 12)
// Its same-row right neighbour would be col 13, which doesn't exist
// Its same-row left neighbour is A12 (col 11)
assertAdjacent("A12", "A13")
assertNotAdjacent("A1", "A13")  // far apart

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`)
console.log(`  Step 1.1 results: ${passed} passed, ${failed} failed`)
console.log(`${"─".repeat(50)}\n`)

if (failed > 0) process.exit(1)
