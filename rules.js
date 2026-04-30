"use strict"

// ============================================================
// Age of Innovation — rules.js
// RTT module — Phase 2 / Step 2.2: setup() + faction selection
// ============================================================

// ── Data imports ──────────────────────────────────────────────────────────────

const { MAP_HEXES } = require("./data/map.js")
const {
	BONUS_TILES, FAVOR_TILES, TOWN_TILES, SCORING_TILES,
	BONUS_TILE_NAMES, SCORING_TILE_NAMES,
} = require("./data/tiles.js")
const { POWER_ACTIONS } = require("./data/constants.js")
const { FACTIONS, BASE_FACTIONS, FIRE_ICE_FACTIONS } = require("./data/factions.js")

// ── RTT module API ────────────────────────────────────────────────────────────

exports.scenarios = ["Standard"]

/**
 * Return the list of player role names for the given options.
 * RTT calls this before setup() to build the roles list.
 */
exports.roles = function (scenario, options) {
	const count = Math.max(2, Math.min(5, parseInt(options.players) || 2))
	return Array.from({ length: count }, (_, i) => `Player ${i + 1}`)
}

/**
 * Initialise and return a fresh game state G.
 *
 * G layout  (Step 2.1 — full state structure):
 *
 *  RTT required  : seed, active, result, log, undo
 *  Game metadata : scenario, options
 *  Game progress : state, round, turn, action_queue
 *  Turn order    : turn_order, next_turn_order
 *  Factions      : available_factions, factions
 *  Board         : map, bridges
 *  Tile pool     : pool  (power actions + favor/town tiles + bonus tiles)
 *  Scoring       : scoring_tiles (6 drawn), current_scoring_tile
 *
 * @param {number} seed
 * @param {string} scenario
 * @param {object} options  - values from create.html
 * @returns {object} G
 */
exports.setup = function (seed, scenario, options) {
	const roles = exports.roles(scenario, options)

	const G = {
		// ── RTT required ────────────────────────────────────────────────────
		seed,
		active: roles[0],
		result: null,
		log: [],
		undo: [],

		// ── Game metadata ───────────────────────────────────────────────────
		scenario,
		options: {
			players: roles.length,
			map: options.map || "standard",
			fire_ice: !!options.fire_ice,
		},

		// ── Game progress ───────────────────────────────────────────────────
		state: "select-factions",
		round: 0,
		turn: 0,
		// Pending sub-actions inserted between normal turns (e.g. leech decisions).
		// Each entry: { role, type, data }
		action_queue: [],

		// ── Turn order ──────────────────────────────────────────────────────
		turn_order: roles.slice(),
		// Pass order accumulates here and becomes turn_order at round start.
		next_turn_order: [],

		// ── Faction selection ───────────────────────────────────────────────
		// Names of factions players may still choose from.
		available_factions: _available_factions(options),
		// Per-role faction state; populated when each player picks a faction.
		// Shape per entry (filled during select-factions phase):
		//   { faction_name, color, C, W, P, P1, P2, P3, VP,
		//     FIRE, WATER, EARTH, AIR,
		//     buildings: {D,TP,TE,SH,SA},
		//     dig_level, ship_level,
		//     favor_tiles, town_tiles,
		//     bonus_tile, passed, locations, towns, income_taken }
		factions: {},

		// ── Board ───────────────────────────────────────────────────────────
		// hex key → { color, river, building, faction, town }
		map: _init_map(),
		// Array of placed bridges: [{ from, to, faction }, ...]
		bridges: [],

		// ── Tile pool ───────────────────────────────────────────────────────
		// Counts of tiles/actions still available.
		// Power actions reset each round; others are consumed permanently.
		pool: _init_pool(options),

		// ── Scoring tiles ───────────────────────────────────────────────────
		// 6 tile names drawn at random; index 0 = round 1, index 5 = round 6.
		scoring_tiles: [],
		// Shortcut to scoring_tiles[round-1] once the game starts.
		current_scoring_tile: null,
	}

	// ── Random initialization (MLCG mutates G.seed) ──────────────────────────
	_init_scoring_tiles(G, options)
	_init_bonus_tiles(G, roles.length, options)

	return G
}

/**
 * Return the view object visible to the given role.
 * V.actions is only set when it is that role's turn.
 */
exports.view = function (state, role) {
	const V = {
		log: state.log,
		prompt: _prompt_for(state, role),
		round: state.round,
		turn: state.turn,
		state: state.state,
		active: state.active,
		available_factions: state.available_factions,
		factions: state.factions,
		map: state.map,
		bridges: state.bridges,
		pool: state.pool,
		scoring_tiles: state.scoring_tiles,
		current_scoring_tile: state.current_scoring_tile,
	}

	if (state.active === role) {
		V.actions = _actions_for(state, role)
	}

	return V
}

/**
 * Apply an action sent by a player.
 */
exports.action = function (state, role, action, arg) {
	if (state.active !== role)
		throw new Error("It is not your turn.")

	switch (action) {
		case "select_faction":
			return _action_select_faction(state, role, arg)
		default:
			throw new Error(`Unknown action: ${action}`)
	}
}

// ── MLCG random ───────────────────────────────────────────────────────────────
// Same algorithm as RTT's framework.js.  Mutates G.seed.

function _random(G, range) {
	// m = 2**35 − 31
	G.seed = G.seed * 200105 % 34359738337
	return G.seed % range
}

function _shuffle(G, list) {
	for (let i = list.length - 1; i > 0; i--) {
		const j = _random(G, i + 1)
		const tmp = list[j]; list[j] = list[i]; list[i] = tmp
	}
}

// ── Private setup helpers ─────────────────────────────────────────────────────

function _available_factions(options) {
	const names = BASE_FACTIONS.slice()
	if (options.fire_ice) {
		for (const name of FIRE_ICE_FACTIONS) names.push(name)
	}
	return names
}

function _init_map() {
	const map = {}
	for (const [key, hex] of Object.entries(MAP_HEXES)) {
		map[key] = {
			color:    hex.color,
			river:    hex.river,
			building: null,   // null | "D" | "TP" | "TE" | "SH" | "SA"
			faction:  null,   // null | role name, e.g. "Player 1"
			town:     false,  // true once this hex belongs to a formed town
		}
	}
	return map
}

function _init_pool(options) {
	const pool = {}

	// Power actions — shared, one use per round, reset at round start
	for (const name of Object.keys(POWER_ACTIONS)) {
		pool[name] = 1
	}

	// Favor tiles — permanent pool (counts from tile data; default 3)
	for (const [name, tile] of Object.entries(FAVOR_TILES)) {
		pool[name] = tile.count ?? 3
	}

	// Town tiles — permanent pool (default 2 per tile; option-gated tiles
	// are only included when the corresponding game option is active)
	for (const [name, tile] of Object.entries(TOWN_TILES)) {
		if (tile.option && !options[tile.option]) continue
		pool[name] = tile.count ?? 2
	}

	// Bonus tiles are added separately by _init_bonus_tiles() after shuffling.
	return pool
}

function _init_scoring_tiles(G, options) {
	const eligible = SCORING_TILE_NAMES.filter(name => {
		const tile = SCORING_TILES[name]
		return !tile.option || options[tile.option]
	})
	_shuffle(G, eligible)
	G.scoring_tiles = eligible.slice(0, 6)
}

function _init_bonus_tiles(G, player_count, options) {
	// Standard rule: player_count + 3 bonus tiles are available each game.
	const eligible = BONUS_TILE_NAMES.filter(name => {
		const tile = BONUS_TILES[name]
		return !tile.option || options[tile.option]
	})
	_shuffle(G, eligible)
	const selected = eligible.slice(0, player_count + 3)
	for (const name of selected) {
		G.pool[name] = 1
	}
}

// ── Faction selection ──────────────────────────────────────────────────────────

/**
 * Handle the select_faction action (state: "select-factions").
 * arg = faction name string, e.g. "swarmlings"
 */
function _action_select_faction(G, role, faction_name) {
	if (G.state !== "select-factions")
		throw new Error("Not in faction selection phase.")
	if (typeof faction_name !== "string" || !faction_name)
		throw new Error("Faction name must be a non-empty string.")
	if (!G.available_factions.includes(faction_name))
		throw new Error(`Faction '${faction_name}' is not available.`)
	if (role in G.factions)
		throw new Error(`${role} has already selected a faction.`)

	const faction_def = FACTIONS[faction_name]
	if (!faction_def)
		throw new Error(`Unknown faction: '${faction_name}'.`)

	// Create and store the faction state
	G.factions[role] = _init_faction_state(faction_name, faction_def)

	// Remove from pool of choosable factions
	G.available_factions = G.available_factions.filter(f => f !== faction_name)

	// Advance to next player, or transition to initial dwelling placement
	const idx = G.turn_order.indexOf(role)
	if (idx + 1 < G.turn_order.length) {
		G.active = G.turn_order[idx + 1]
	} else {
		_begin_initial_dwellings(G)
	}

	return G
}

/**
 * Build the initial faction state object from the faction definition.
 * Called once per player when they select their faction.
 *
 * State shape:
 *   { faction_name, color,
 *     C, W, P, P1, P2, P3, VP, KEY,
 *     FIRE, WATER, EARTH, AIR,
 *     buildings: {D,TP,TE,SH,SA},
 *     dig_level, ship_level,
 *     favor_tiles, town_tiles, bonus_tile,
 *     passed, income_taken, actions_used,
 *     locations, towns, bridges }
 */
function _init_faction_state(faction_name, faction_def) {
	const s = faction_def.start
	return {
		faction_name,
		color:  faction_def.color,   // null for pick_color factions

		// ── Resources ────────────────────────────────────────────────────
		C:   s.C,
		W:   s.W,
		P:   s.P   || 0,
		P1:  s.P1,
		P2:  s.P2,
		P3:  s.P3  || 0,
		VP:  s.VP,
		KEY: 0,

		// ── Cult tracks ──────────────────────────────────────────────────
		FIRE:  faction_def.cult_start.FIRE,
		WATER: faction_def.cult_start.WATER,
		EARTH: faction_def.cult_start.EARTH,
		AIR:   faction_def.cult_start.AIR,

		// ── Buildings on board (count currently built) ───────────────────
		buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },

		// ── Upgrade levels (from faction definition starting values) ──────
		dig_level:  faction_def.dig  ? faction_def.dig.level  : 0,
		ship_level: faction_def.ship ? faction_def.ship.level : 0,

		// ── Tiles held ────────────────────────────────────────────────────
		favor_tiles: [],
		town_tiles:  [],
		bonus_tile:  null,

		// ── Round / turn flags ────────────────────────────────────────────
		passed:       false,
		income_taken: false,
		actions_used: [],   // action keys used this round; reset each round

		// ── Board presence ────────────────────────────────────────────────
		locations: [],      // hex keys where this faction has built
		towns:     [],      // hex keys that are part of a formed town
		bridges:   [],      // placed bridges [{ from, to }, ...]
	}
}

/**
 * Transition from faction selection to initial dwelling placement.
 * Builds the snake-order action queue: P1 P2 … PN PN … P2 P1
 */
function _begin_initial_dwellings(G) {
	G.state = "initial-dwellings"
	const forward  = G.turn_order.slice()
	const backward = G.turn_order.slice().reverse()
	G.action_queue = [...forward, ...backward].map(role => ({
		role,
		type: "place-dwelling",
	}))
	G.active = G.action_queue[0].role
}

// ── Prompt & actions ──────────────────────────────────────────────────────────

function _prompt_for(state, role) {
	if (state.result)
		return "The game is over."
	if (state.active !== role)
		return `Waiting for ${state.active}.`
	switch (state.state) {
		case "select-factions":
			return "Choose your faction."
		case "initial-dwellings":
			return "Place a dwelling on your home terrain."
		default:
			return "Take your action."
	}
}

function _actions_for(state, role) {
	switch (state.state) {
		case "select-factions":
			return { select_faction: state.available_factions.slice() }
		case "initial-dwellings":
			return { place_dwelling: 1 }   // arg = hex key; validated in Step 3.2
		default:
			return {}
	}
}
