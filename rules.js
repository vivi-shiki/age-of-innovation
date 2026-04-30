"use strict"

// ============================================================
// Age of Innovation — rules.js
// RTT module — Phase 3 / Step 3.3: state machine & action phases
// ============================================================

// ── Data imports ──────────────────────────────────────────────────────────────

const { MAP_HEXES, ADJACENCY } = require("./data/map.js")
const {
	BONUS_TILES, FAVOR_TILES, TOWN_TILES, SCORING_TILES,
	BONUS_TILE_NAMES, SCORING_TILE_NAMES,
} = require("./data/tiles.js")
const {
	POWER_ACTIONS,
	COLOR_WHEEL,
	CULT_TRACKS,
	CULT_TRACK_POWER_GAINS,
	BUILDING_STRENGTH,
	DEFAULT_TOWN_SIZE,
	DEFAULT_TOWN_COUNT,
} = require("./data/constants.js")
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
		next_turn_order: [],		// Active main-turn player during play phase (separate from leech-deciders).
		turn_player: null,
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
		// null = in progress; array of roles sorted by VP = game over
		result: null,
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
		result: state.result,
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
		case "select_faction":  return _action_select_faction(state, role, arg)
		case "place_dwelling":  return _action_place_dwelling(state, role, arg)
		case "pick_bonus":      return _action_pick_bonus(state, role, arg)
		case "income":          return _action_income(state, role)
		case "leech":           return _action_leech(state, role, arg)
		case "pass":            return _action_pass(state, role, arg)
		default: throw new Error(`Unknown action: ${action}`)
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

// ── Initial dwelling placement ────────────────────────────────────────────────

/**
 * Transition from initial dwelling placement to bonus-tile selection.
 * Players pick bonus tiles in reverse turn order.
 */
function _begin_initial_bonus(G) {
	G.state = "initial-bonus"
	const reverse_order = G.turn_order.slice().reverse()
	G.action_queue = reverse_order.map(role => ({ role, type: "pick-bonus" }))
	G.active = G.action_queue[0].role
}

/**
 * Handle the place_dwelling action (state: "initial-dwellings").
 * arg = hex key string, e.g. "A1"
 *
 * Validation:
 *   – must be in initial-dwellings phase
 *   – hex must be a non-empty string, must exist in G.map, must not be a river
 *   – hex must be empty (no existing building)
 *   – hex color must match the faction's home terrain color
 *
 * On success: places a D, updates faction state, advances the queue.
 * No leech or town-detection during initial placement (setup phase).
 */
function _action_place_dwelling(G, role, hex) {
	if (G.state !== "initial-dwellings")
		throw new Error("Not in dwelling placement phase.")
	if (typeof hex !== "string" || !hex)
		throw new Error("Invalid hex.")
	const cell = G.map[hex]
	if (!cell || cell.river)
		throw new Error("Invalid hex.")
	if (cell.building !== null)
		throw new Error(`Hex '${hex}' already has a building.`)

	const fs = G.factions[role]
	if (fs.color === null)
		throw new Error("Faction has not selected a home terrain color.")
	if (cell.color !== fs.color)
		throw new Error(`Hex '${hex}' is not your home terrain.`)

	// Place the dwelling
	cell.building = "D"
	cell.faction  = role
	fs.buildings.D++
	fs.locations.push(hex)

	// Advance the action queue
	G.action_queue.shift()
	if (G.action_queue.length > 0) {
		G.active = G.action_queue[0].role
	} else {
		_begin_initial_bonus(G)
	}

	return G
}

// ── Map operations ────────────────────────────────────────────────────────────

/**
 * Push leech decisions onto the action queue for every faction that has a
 * building adjacent to `hex` and is not the active faction.
 *
 * Each queued entry: { role, type: "leech", amount, from_role }
 * where `amount` = BUILDING_STRENGTH of the adjacent building.
 *
 * Called after any build/upgrade during the main play phase.
 * NOT called during initial dwelling placement.
 */
function _compute_leech(G, active_role, hex) {
	for (const adj of ADJACENCY[hex]) {
		const cell = G.map[adj]
		if (cell.building && cell.faction !== active_role) {
			G.action_queue.push({
				role: cell.faction,
				type: "leech",
				amount: BUILDING_STRENGTH[cell.building],
				from_role: active_role,
			})
		}
	}
}

/**
 * BFS from `hex` to find all connected same-faction buildings.
 * If the cluster meets the town conditions (count ≥ 4, strength ≥ 7 by
 * default, reduced by FAV5 via fs.TOWN_SIZE) and is not already a town,
 * form a new town: award a town tile, gain its reward, mark hexes.
 *
 * Town-size threshold can be modified per faction via FAV5:
 *   _gain(fs, { TOWN_SIZE: -1 }) stores –1 in fs.TOWN_SIZE;
 *   we add that delta to DEFAULT_TOWN_SIZE when checking.
 */
function _detect_towns(G, role, hex) {
	const cell = G.map[hex]
	if (!cell || !cell.building || cell.faction !== role) return

	const fs = G.factions[role]

	// BFS — find connected component of same-faction buildings
	const cluster = []
	const visited = new Set([hex])
	const queue   = [hex]
	let   total_strength = 0

	while (queue.length > 0) {
		const current = queue.shift()
		cluster.push(current)
		total_strength += BUILDING_STRENGTH[G.map[current].building]

		for (const adj of ADJACENCY[current]) {
			if (!visited.has(adj)) {
				visited.add(adj)
				const adj_cell = G.map[adj]
				if (adj_cell.building && adj_cell.faction === role) {
					queue.push(adj)
				}
			}
		}
	}

	// Town size requirement (FAV5 can reduce default by 1)
	const size_req  = DEFAULT_TOWN_SIZE + (fs.TOWN_SIZE || 0)
	if (cluster.length  < DEFAULT_TOWN_COUNT) return
	if (total_strength  < size_req)           return

	// Skip if this cluster already contains a formed-town hex
	if (cluster.some(h => G.map[h].town)) return

	// Claim a town tile from the pool
	const tile_name = Object.keys(TOWN_TILES).find(name => (G.pool[name] || 0) > 0)
	if (!tile_name) return   // pool exhausted (edge case: no tiles remain)

	G.pool[tile_name]--
	fs.town_tiles.push(tile_name)

	// Mark all cluster hexes as part of this town
	for (const h of cluster) {
		G.map[h].town = true
		if (!fs.towns.includes(h)) fs.towns.push(h)
	}

	// Apply the tile's immediate reward
	_gain(fs, TOWN_TILES[tile_name].gain)
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
		case "initial-bonus":
			return "Choose your starting bonus tile."
		case "income":
			return "Take your income."
		case "play": {
			const leech = state.action_queue.length > 0 && state.action_queue[0].type === "leech"
				? state.action_queue[0] : null
			if (leech)
				return `Leech: gain up to ${leech.amount} power? (Pay ${leech.amount - 1} VP for full amount, or decline.)`
			return "Take your action."
		}
		case "finish":
			return "The game is over."
		default:
			return "Take your action."
	}
}

function _actions_for(state, role) {
	switch (state.state) {
		case "select-factions":
			return { select_faction: state.available_factions.slice() }
		case "initial-dwellings":
			return { place_dwelling: 1 }
		case "initial-bonus": {
			const available = Object.keys(BONUS_TILES).filter(n => (state.pool[n] || 0) > 0)
			return { pick_bonus: available }
		}
		case "income":
			return { income: 1 }
		case "play": {
			if (state.action_queue.length > 0 && state.action_queue[0].type === "leech")
				return { leech: state.action_queue[0].amount }
			const avail = Object.keys(BONUS_TILES).filter(n => (state.pool[n] || 0) > 0)
			return { pass: state.round < 6 ? avail : null }
		}
		default:
			return {}
	}
}

// ── Initial bonus tile selection ──────────────────────────────────────────────

/**
 * Handle the pick_bonus action (state: "initial-bonus").
 * arg = bonus tile name string, e.g. "BON3"
 */
function _action_pick_bonus(G, role, tile_name) {
	if (G.state !== "initial-bonus")
		throw new Error("Not in bonus tile selection phase.")
	if (typeof tile_name !== "string" || !tile_name)
		throw new Error("Bonus tile name must be a non-empty string.")
	if (!BONUS_TILES[tile_name])
		throw new Error(`Unknown bonus tile: '${tile_name}'.`)
	if ((G.pool[tile_name] || 0) < 1)
		throw new Error(`Bonus tile '${tile_name}' is not available.`)

	G.factions[role].bonus_tile = tile_name
	G.pool[tile_name]--

	G.action_queue.shift()
	if (G.action_queue.length > 0) {
		G.active = G.action_queue[0].role
	} else {
		_begin_income(G)
	}

	return G
}

// ── Income phase ──────────────────────────────────────────────────────────────

/**
 * Transition to the income phase.
 *
 * Called after the initial-bonus phase and at the start of each subsequent
 * round.  When called for round 0 → 1 (first income), every player's `passed`
 * flag is forced true so their just-picked BON tile income is included—
 * mirroring the Perl code's `if ($game{round} == 0) { $faction->{passed} = 1 }`.
 */
function _begin_income(G) {
	// First income (round 0 → 1): force passed=true so BON tile income applies.
	if (G.round === 0) {
		for (const role of G.turn_order)
			G.factions[role].passed = true
	}

	G.round++
	G.current_scoring_tile = G.scoring_tiles[G.round - 1] || null

	// Reset power actions (one use per round)
	for (const name of Object.keys(POWER_ACTIONS))
		G.pool[name] = 1

	// Clear income flags
	for (const role of G.turn_order)
		G.factions[role].income_taken = false

	G.state        = "income"
	G.action_queue = G.turn_order.map(role => ({ role, type: "income" }))
	G.active       = G.action_queue[0].role
}

/**
 * Calculate total income for a faction.
 *
 * Income sources (in order):
 *  1. Building income  — FACTIONS[name].buildings[B].income[res][count]
 *  2. Favor tile income — FAVOR_TILES[tile].income (always applies)
 *  3. Bonus tile income — BONUS_TILES[tile].income (only if fs.passed === true)
 *  4. Scoring tile income — floor(fs[cult] / req) × income (rounds 1–5 only)
 *
 * @returns {object}  e.g. { C: 3, W: 2, P: 1, PW: 4 }
 */
function _calc_income(G, role) {
	const fs          = G.factions[role]
	const faction_def = FACTIONS[fs.faction_name]
	const income      = {}

	// 1. Building income
	for (const [b_type, b_def] of Object.entries(faction_def.buildings)) {
		const count = fs.buildings[b_type] || 0
		if (b_def.income) {
			for (const [res, arr] of Object.entries(b_def.income)) {
				const delta = arr[count] || 0
				if (delta) income[res] = (income[res] || 0) + delta
			}
		}
	}

	// 2. Favor tile income (always)
	for (const tile_name of fs.favor_tiles) {
		const tile = FAVOR_TILES[tile_name]
		if (tile && tile.income) {
			for (const [res, amt] of Object.entries(tile.income)) {
				if (amt) income[res] = (income[res] || 0) + amt
			}
		}
	}

	// 3. Bonus tile income (only when the player passed last round)
	if (fs.passed && fs.bonus_tile) {
		const tile = BONUS_TILES[fs.bonus_tile]
		if (tile && tile.income) {
			for (const [res, amt] of Object.entries(tile.income)) {
				if (amt) income[res] = (income[res] || 0) + amt
			}
		}
	}

	// 4. Scoring tile income (rounds 1–5 only; round 6 has no round income)
	if (G.round <= 5 && G.current_scoring_tile) {
		const scoring = SCORING_TILES[G.current_scoring_tile]
		if (scoring && scoring.cult && scoring.income) {
			const cult_val = fs[scoring.cult] || 0
			const mul      = Math.floor(cult_val / scoring.req)
			if (mul > 0) {
				for (const [res, per] of Object.entries(scoring.income)) {
					income[res] = (income[res] || 0) + mul * per
				}
			}
		}
	}

	return income
}

/**
 * Handle the income action (state: "income").
 * No arg required: the faction collects their computed income.
 */
function _action_income(G, role) {
	if (G.state !== "income")
		throw new Error("Not in income phase.")

	const fs = G.factions[role]
	if (fs.income_taken)
		throw new Error("Income already taken this round.")

	_gain(fs, _calc_income(G, role))
	fs.income_taken = true

	G.action_queue.shift()
	if (G.action_queue.length > 0) {
		G.active = G.action_queue[0].role
	} else {
		_begin_play(G)
	}

	return G
}

// ── Play phase ────────────────────────────────────────────────────────────────

/**
 * Transition from income to the play phase.
 * Resets per-round faction flags and sets G.active to the first player in turn order.
 */
function _begin_play(G) {
	G.state        = "play"
	G.action_queue = []

	for (const role of G.turn_order) {
		const fs      = G.factions[role]
		fs.passed       = false
		fs.income_taken = false
		fs.actions_used = []
	}

	G.turn_player = G.turn_order[0]
	G.active      = G.turn_player
}

/**
 * Advance the active player in the play phase.
 *
 * Priority:
 *  1. If action_queue has entries (pending leech decisions), G.active = queue head.
 *  2. Find the next non-passed player in circular turn order after G.turn_player.
 *  3. If all players have passed, call _end_round.
 */
function _advance_play(G) {
	if (G.action_queue.length > 0) {
		G.active = G.action_queue[0].role
		return
	}

	const order = G.turn_order
	const idx   = order.indexOf(G.turn_player)

	for (let i = 1; i <= order.length; i++) {
		const next = order[(idx + i) % order.length]
		if (!G.factions[next].passed) {
			G.turn_player = next
			G.active      = next
			return
		}
	}

	_end_round(G)
}

/**
 * Compute VP earned upon passing from bonus tile and favor tile pass_vp tables.
 * pass_vp entries are indexed by building count (or ship_level for the "ship" key).
 */
function _calc_pass_vp(G, role) {
	const fs = G.factions[role]
	let vp   = 0

	function apply(pass_vp) {
		for (const [btype, arr] of Object.entries(pass_vp)) {
			const level = (btype === "ship")
				? (fs.ship_level || 0)
				: (fs.buildings[btype] || 0)
			vp += arr[level] || 0
		}
	}

	if (fs.bonus_tile && BONUS_TILES[fs.bonus_tile].pass_vp)
		apply(BONUS_TILES[fs.bonus_tile].pass_vp)

	for (const tile_name of fs.favor_tiles) {
		const fav = FAVOR_TILES[tile_name]
		if (fav && fav.pass_vp) apply(fav.pass_vp)
	}

	return vp
}

/**
 * Handle the leech action (state: "play").
 * arg = power amount to accept (0 = decline).
 *
 * The accepted amount is clamped to the offered max and to what the player's
 * VP allows (VP cost = power gained − 1).  _gain_power may return fewer
 * tokens than requested (full bowls), so VP paid = actual tokens gained − 1.
 */
function _action_leech(G, role, amount) {
	if (G.state !== "play")
		throw new Error("Not in play phase.")

	const entry = G.action_queue[0]
	if (!entry || entry.type !== "leech")
		throw new Error("No pending leech decision.")

	amount = Math.max(0, Math.trunc(amount || 0))

	if (amount > 0) {
		const fs    = G.factions[role]
		let actual  = Math.min(amount, entry.amount)
		actual      = Math.min(actual, (fs.VP || 0) + 1)
		const gained  = _gain_power(fs, actual)
		const vp_cost = Math.max(0, gained - 1)
		if (vp_cost > 0) fs.VP = (fs.VP || 0) - vp_cost
	}

	G.action_queue.shift()
	_advance_play(G)
	return G
}

/**
 * Handle the pass action (state: "play").
 * arg = bonus tile name to take (required for rounds 1–5; omitted on round 6).
 *
 * Steps:
 *  1. Award pass VP from current bonus/favor tile pass_vp tables.
 *  2. Return current bonus tile to pool.
 *  3. Take the new bonus tile from pool (rounds 1–5 only).
 *  4. Mark faction as passed; append to G.next_turn_order.
 *  5. Advance to next non-passed player or end round.
 */
function _action_pass(G, role, tile_name) {
	if (G.state !== "play")
		throw new Error("Not in play phase.")

	const fs = G.factions[role]

	if (G.round < 6) {
		if (typeof tile_name !== "string" || !tile_name)
			throw new Error("Must specify a bonus tile when passing.")
		if (!BONUS_TILES[tile_name])
			throw new Error(`Unknown bonus tile: '${tile_name}'.`)
		if ((G.pool[tile_name] || 0) < 1)
			throw new Error(`Bonus tile '${tile_name}' is not available.`)
	}

	// 1. Award pass VP
	const vp = _calc_pass_vp(G, role)
	if (vp > 0) fs.VP = (fs.VP || 0) + vp

	// 2. Return old bonus tile to pool
	if (fs.bonus_tile) {
		G.pool[fs.bonus_tile] = (G.pool[fs.bonus_tile] || 0) + 1
		fs.bonus_tile = null
	}

	// 3. Take new bonus tile (rounds 1–5)
	if (G.round < 6 && tile_name) {
		G.pool[tile_name]--
		fs.bonus_tile = tile_name
	}

	// 4. Mark passed; track pass order for next round
	fs.passed = true
	G.next_turn_order.push(role)

	// 5. Advance play
	G.turn_player = role
	_advance_play(G)

	return G
}

/**
 * End the current round.
 * Transitions to finish (round 6) or starts the next income phase.
 */
function _end_round(G) {
	if (G.round >= 6) {
		_begin_finish(G)
		return
	}
	G.turn_order      = G.next_turn_order.slice()
	G.next_turn_order = []
	_begin_income(G)
}

/**
 * Transition to the finish state.
 * G.result = roles sorted descending by VP.
 */
function _begin_finish(G) {
	G.state  = "finish"
	G.active = null
	G.result = G.turn_order.slice().sort(
		(a, b) => (G.factions[b].VP || 0) - (G.factions[a].VP || 0)
	)
}

// ── Resource system ────────────────────────────────────────────────────────────

/**
 * Move `amount` power tokens through the three bowls: P1 → P2 → P3.
 * Fills P2 from P1 first; remainder fills P3 from P2.
 * Excess beyond available tokens is silently discarded.
 * Returns the number of tokens that actually advanced.
 */
function _gain_power(fs, amount) {
	let remaining = amount
	const from_p1 = Math.min(remaining, fs.P1)
	fs.P1 -= from_p1; fs.P2 += from_p1; remaining -= from_p1
	const from_p2 = Math.min(remaining, fs.P2)
	fs.P2 -= from_p2; fs.P3 += from_p2; remaining -= from_p2
	return amount - remaining  // actual tokens promoted
}

/**
 * Advance a faction on a single cult track by `amount` steps (max 10).
 * Triggers power-bowl gains when crossing thresholds: 3, 5, 7, 10.
 * Reaching 10 spends 1 KEY; if the faction holds no KEY the track caps at 9.
 * Returns the actual number of steps advanced (may be < amount).
 */
function _advance_cult(fs, cult, amount) {
	const old_val = fs[cult]
	let new_val = Math.min(10, old_val + amount)
	// Reaching the 10th square requires spending 1 KEY
	if (new_val === 10 && old_val < 10 && (fs.KEY || 0) < 1) {
		new_val = 9
	}
	fs[cult] = new_val
	for (const step of CULT_TRACK_POWER_GAINS) {
		if (old_val <= step.threshold && new_val > step.threshold) {
			if (step.PW) _gain_power(fs, step.PW)
			if (step.KEY) fs.KEY = (fs.KEY || 0) + step.KEY  // step.KEY = −1 → spend
		}
	}
	return new_val - old_val
}

/**
 * Grant resources to a faction.
 *   PW                → _gain_power (three-bowl fill)
 *   FIRE/WATER/EARTH/AIR → _advance_cult (with power bonuses)
 *   All other keys    → added directly (C, W, P, VP, KEY, SPADE, …)
 *
 * @param {object} fs       faction state (G.factions[role])
 * @param {object} resources  e.g. { C: 2, PW: 3, FIRE: 1 }
 */
function _gain(fs, resources) {
	for (const [type, amount] of Object.entries(resources)) {
		if (!amount || amount <= 0) continue
		if (type === "PW") {
			_gain_power(fs, amount)
		} else if (CULT_TRACKS.includes(type)) {
			_advance_cult(fs, type, amount)
		} else {
			fs[type] = (fs[type] || 0) + amount
		}
	}
}

/**
 * Deduct resources from a faction; power (PW) is spent from bowl 3 (P3 → P1).
 * Validates ALL resources atomically before any deduction.
 * Throws if any resource is insufficient (no partial payment).
 *
 * @param {object} fs       faction state (G.factions[role])
 * @param {object} resources  e.g. { C: 3, W: 1, PW: 4 }
 */
function _pay(fs, resources) {
	// Validate first (atomic)
	for (const [type, amount] of Object.entries(resources)) {
		if (!amount || amount <= 0) continue
		const have = (type === "PW") ? (fs.P3 || 0) : (fs[type] || 0)
		if (have < amount)
			throw new Error(`Not enough ${type}: need ${amount}, have ${have}.`)
	}
	// Deduct (only reached when all checks pass)
	for (const [type, amount] of Object.entries(resources)) {
		if (!amount || amount <= 0) continue
		if (type === "PW") {
			fs.P3 -= amount
			fs.P1 += amount  // spent power tokens return to bowl 1
		} else {
			fs[type] -= amount
		}
	}
}

/**
 * Circular distance between two terrain colors on the COLOR_WHEEL (length 7).
 * Returns the shortest path in either direction (0–3).
 * Throws if either color is unknown.
 */
function _terraform_distance(from_color, to_color) {
	if (from_color === to_color) return 0
	const a = COLOR_WHEEL.indexOf(from_color)
	const b = COLOR_WHEEL.indexOf(to_color)
	if (a === -1) throw new Error(`Unknown terrain color: '${from_color}'.`)
	if (b === -1) throw new Error(`Unknown terrain color: '${to_color}'.`)
	const d = Math.abs(a - b)
	return Math.min(d, COLOR_WHEEL.length - d)
}

/**
 * Worker cost to terraform a hex from `from_color` to `to_color`.
 * Multiplies the faction's dig.cost[dig_level] entry by the terrain distance.
 * Returns {} when colors are already the same.
 *
 * @param {string} from_color   current hex terrain color
 * @param {string} to_color     target terrain color
 * @param {object} faction_def  FACTIONS[faction_name]
 * @param {number} dig_level    current dig upgrade level (0, 1, or 2)
 * @returns {object} e.g. { W: 6 }
 */
function _terraform_cost(from_color, to_color, faction_def, dig_level) {
	const dist = _terraform_distance(from_color, to_color)
	if (dist === 0) return {}
	const cost_per_spade = (faction_def.dig && faction_def.dig.cost[dig_level]) || { W: 3 }
	const total = {}
	for (const [res, amt] of Object.entries(cost_per_spade)) {
		if (amt > 0) total[res] = amt * dist
	}
	return total
}

// ── Test-only exports ─────────────────────────────────────────────────────────
// Not part of the RTT API; exposed so unit tests can call internal helpers.
exports._test = {
	_gain_power,
	_gain,
	_pay,
	_advance_cult,
	_terraform_distance,
	_terraform_cost,
	_action_place_dwelling,
	_compute_leech,
	_detect_towns,
	// Step 3.3
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
}
