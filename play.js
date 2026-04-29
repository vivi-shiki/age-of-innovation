"use strict"

/* globals send_action, action_button */

// ============================================================
// Age of Innovation — play.js
// Client-side stub (Phase 0 / Step 0.1)
// RTT framework calls on_init() once, then on_update() on every view change.
// ============================================================

let view = null

/**
 * Called once when the page loads.
 * @param {string} scenario
 * @param {object} options  - create.html form values
 * @param {object} static_view - static data from exports.static_view (if any)
 */
function on_init(scenario, options, static_view) { // eslint-disable-line no-unused-vars
	// Nothing to initialise yet – canvas will be set up in on_update
}

/**
 * Called every time the server pushes a new view.
 * The global `view` object is updated by client.js before this call.
 */
function on_update() { // eslint-disable-line no-unused-vars
	// Placeholder: display a waiting message until the game logic is ready
	const canvas = document.getElementById("map-canvas")
	if (!canvas) return

	const ctx = canvas.getContext("2d")
	canvas.width  = 640
	canvas.height = 480

	ctx.fillStyle = "#2d4a2d"
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	ctx.fillStyle = "#ffffff"
	ctx.font = "20px sans-serif"
	ctx.textAlign = "center"
	ctx.fillText("Age of Innovation — board rendering coming soon", canvas.width / 2, canvas.height / 2)

	// Show any available actions as buttons
	if (view && view.actions) {
		for (const act of Object.keys(view.actions)) {
			action_button(act, act.replace(/_/g, " "))
		}
	}
}
