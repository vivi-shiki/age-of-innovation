"use strict"

// ============================================================
// Age of Innovation — data/map.js
// Terra Mystica standard map, converted to JavaScript.
// Source: terra-mystica/src/Game/Constants.pm (@base_map)
//         terra-mystica/src/map.pm (setup_base_map, setup_direct_adjacencies)
// ============================================================

// ── Raw map data ─────────────────────────────────────────────────────────────
// Nine rows (A–I), each token is a terrain colour or 'x' (river).
// Rows are listed top-to-bottom; within a row, left-to-right (col 0 …).
// This matches the @base_map constant in terra-mystica verbatim.

const RAW_ROWS = [
	// Row A (ri=0) — 13 land, 0 river
	"brown gray green blue yellow red brown black red green blue red black",
	// Row B (ri=1) — 6 land, 6 river
	"yellow x x brown black x x yellow black x x yellow",
	// Row C (ri=2) — 5 land, 8 river
	"x x black x gray x green x green x gray x x",
	// Row D (ri=3) — 8 land, 4 river
	"green blue yellow x x red blue x red x red brown",
	// Row E (ri=4) — 11 land, 2 river
	"black brown red blue black brown gray yellow x x green black blue",
	// Row F (ri=5) — 7 land, 5 river
	"gray green x x yellow green x x x brown gray brown",
	// Row G (ri=6) — 7 land, 6 river
	"x x x gray x red x green x yellow black blue yellow",
	// Row H (ri=7) — 8 land, 4 river
	"yellow blue brown x x x blue black x gray brown gray",
	// Row I (ri=8) — 12 land, 1 river
	"red black gray blue red green yellow brown gray x blue green red",
]

// Terrain colour names used by this game
const TERRAIN_COLORS = new Set(["yellow", "brown", "black", "blue", "green", "gray", "red"])

const ROW_LABELS = "ABCDEFGHI".split("")

// ── Build hex registry & reverse map ─────────────────────────────────────────
// MAP_HEXES : key  → { color, row, col }   (col = position index in row, 0-based)
// REVERSE_MAP: row → col → key

const MAP_HEXES = {}       // e.g.  "A1" → { color:"brown", row:0, col:0 }
const REVERSE_MAP = {}     // e.g.  REVERSE_MAP[0][0] === "A1"

let _river = 0

for (let ri = 0; ri < RAW_ROWS.length; ri++) {
	REVERSE_MAP[ri] = {}
	const tokens = RAW_ROWS[ri].split(" ")
	let landIdx = 1     // 1-based land-hex column within this row

	for (let ci = 0; ci < tokens.length; ci++) {
		const color = tokens[ci]
		let key

		if (color === "x") {
			// River / water hex
			key = `r${_river++}`
			MAP_HEXES[key] = { color: "white", row: ri, col: ci, river: true }
		} else {
			// Land hex
			key = `${ROW_LABELS[ri]}${landIdx++}`
			MAP_HEXES[key] = { color, row: ri, col: ci, river: false }
		}

		REVERSE_MAP[ri][ci] = key
	}
}

// ── Compute direct adjacencies ────────────────────────────────────────────────
// Hexagonal offset grid (same algorithm as setup_direct_adjacencies in map.pm):
//   • Same-row neighbours: (row, col±1)
//   • For even rows (0, 2, 4 …): diagonal offset = col - 1
//     neighbours at (row±1, diagCol) and (row±1, diagCol+1)
//   • For odd rows  (1, 3, 5 …): no offset
//     neighbours at (row±1, col) and (row±1, col+1)

const ADJACENCY = {}    // key → string[]

for (const [coord, hex] of Object.entries(MAP_HEXES)) {
	const { row, col } = hex
	ADJACENCY[coord] = []

	const add = (r, c) => {
		const key = REVERSE_MAP[r]?.[c]
		if (key !== undefined) ADJACENCY[coord].push(key)
	}

	// Horizontal neighbours
	add(row, col + 1)
	add(row, col - 1)

	// Diagonal neighbours — even rows shift left by 1
	const dc = (row % 2 === 0) ? col - 1 : col
	add(row - 1, dc)
	add(row - 1, dc + 1)
	add(row + 1, dc)
	add(row + 1, dc + 1)
}

// ── Exports ───────────────────────────────────────────────────────────────────

/** Total number of map rows (A … I). */
const MAP_ROWS = RAW_ROWS.length          // 9

/** Maximum number of column positions in any row. */
const MAP_COLS = Math.max(...RAW_ROWS.map(r => r.split(" ").length))  // 13

/** Number of river (water) hexes on the standard map. */
const RIVER_COUNT = _river                // 36

/** All terrain colour names. */
const TERRAIN_COLORS_EXPORT = Array.from(TERRAIN_COLORS)

/** The terraforming colour wheel (order matters for distance calc). */
const COLOR_WHEEL = ["yellow", "brown", "black", "blue", "green", "gray", "red"]

module.exports = {
	MAP_HEXES,
	REVERSE_MAP,
	ADJACENCY,
	ROW_LABELS,
	MAP_ROWS,
	MAP_COLS,
	RIVER_COUNT,
	TERRAIN_COLORS: TERRAIN_COLORS_EXPORT,
	COLOR_WHEEL,
}
