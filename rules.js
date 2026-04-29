"use strict"

// ============================================================
// Age of Innovation — rules.js
// RTT module skeleton (Phase 0 / Step 0.1)
// ============================================================

// --------------- RTT module API ---------------

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
 * @param {number} seed   - MLCG random seed
 * @param {string} scenario
 * @param {object} options - values from create.html form
 * @returns {object} G
 */
exports.setup = function (seed, scenario, options) {
	const roles = exports.roles(scenario, options)
	const G = {
		// --- RTT required fields ---
		seed,
		active: roles[0],
		result: null,
		log: [],
		undo: [],

		// --- Game metadata ---
		scenario,
		options: {
			players: roles.length,
			map: options.map || "standard",
			fire_ice: !!options.fire_ice,
		},

		// --- Game progress ---
		state: "select-factions",
		round: 0,
		turn: 0,
		turn_order: roles.slice(),
		next_turn_order: [],

		// --- Per-player state (populated during faction selection) ---
		factions: {},   // role → faction data

		// --- Board state (populated after setup completes) ---
		map: null,      // hex key → { color, building, faction }
		cult: {         // faction → { FIRE, WATER, EARTH, AIR }
			FIRE:  {},
			WATER: {},
			EARTH: {},
			AIR:   {},
		},

		// --- Available tiles ---
		bonus_tiles: [],    // available bonus tiles this game
		scoring_tiles: [],  // 6 scoring tiles for rounds 1-6
		favor_tiles: {},    // favor tile counts
		town_tiles: [],     // available town tiles
	}

	return G
}

/**
 * Return the view object visible to the given role.
 * V.actions is only present when it is that role's turn.
 * @param {object} state  - current G
 * @param {string} role   - role name, e.g. "Player 1"
 * @returns {object} V
 */
exports.view = function (state, role) {
	const V = {
		log: state.log,
		prompt: _prompt_for(state, role),
		round: state.round,
		turn: state.turn,
		state: state.state,
		active: state.active,
		factions: state.factions,
		map: state.map,
		cult: state.cult,
		scoring_tiles: state.scoring_tiles,
		bonus_tiles: state.bonus_tiles,
	}

	// Only expose actions to the active player
	if (state.active === role) {
		V.actions = _actions_for(state, role)
	}

	return V
}

/**
 * Apply an action sent by a player.
 * @param {object} state
 * @param {string} role
 * @param {string} action  - action verb
 * @param          arg     - action argument (type depends on action)
 * @returns {object} modified state
 */
exports.action = function (state, role, action, arg) {
	if (state.active !== role)
		throw new Error("It is not your turn.")

	// Dispatch
	switch (action) {
		default:
			throw new Error(`Unknown action: ${action}`)
	}
}

// ============================================================
// Internal helpers
// ============================================================

function _prompt_for(state, role) {
	if (state.result)
		return "The game is over."
	if (state.active !== role)
		return `Waiting for ${state.active}.`
	switch (state.state) {
		case "select-factions":
			return "Choose your faction."
		default:
			return "Take your action."
	}
}

function _actions_for(state, role) {
	switch (state.state) {
		case "select-factions":
			return { select_faction: 1 }
		default:
			return {}
	}
}
