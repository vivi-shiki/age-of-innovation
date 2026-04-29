"use strict"

// ============================================================
// Age of Innovation — data/factions.js
// All 20 faction definitions, translated from terra-mystica Perl.
// Sources: terra-mystica/src/Game/Factions/*.pm
//
// Fields per faction:
//   display          – localised display name
//   color            – home terrain colour (null = pick at start)
//   faction_board_id – integer id used by terra-mystica UI (null for F&I)
//   expansion        – "fire_ice" for Fire & Ice factions, undefined otherwise
//   pick_color       – true if player picks home terrain before/after setup
//   start            – starting resources: C, W, P (priests), P1/P2/P3 (power bowls), VP
//   cult_start       – starting cult track positions: FIRE, WATER, EARTH, AIR
//   ship             – { level, max_level, advance_cost, advance_gain }
//   dig              – { level, max_level, cost[], advance_cost, advance_gain[] }
//   teleport         – (Dwarves/Fakirs only) { level, max_level, type, cost[], gain[], advance_gain[] }
//   special          – faction-specific passive bonus object
//   leech_effect     – (Cultists/Shapeshifters) { taken, not_taken }
//   exchange_rates   – (Alchemists) { C:{VP:2}, VP:{C:1} }
//   buildings        – { D, TP, TE, SH, SA }
//     each: { advance_cost, income, advance_gain? }
// ============================================================

const FACTIONS = {

    // ── Alchemists ────────────────────────────────────────────────────────────
    alchemists: {
        display: "Alchemists",
        color: "black",
        faction_board_id: 11,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 1, EARTH: 0, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // When SH is built: gain 12 PW. SPADE in a town gives +2 PW.
        special: {
            mode: "gain",
            SPADE: { PW: 2 },
            enable_if: { SH: 1 },
        },
        exchange_rates: {
            C: { VP: 2 },
            VP: { C: 1 },
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 7, 11 ], PW: [ 0, 1, 2, 3, 4 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { PW: 12 } ], income: { C: [ 0, 6 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Auren ────────────────────────────────────────────────────────────────
    auren: {
        display: "Auren",
        color: "green",
        faction_board_id: 13,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 1, EARTH: 0, AIR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: gain ACTA special action + 1 favour tile
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { ACTA: 1, GAIN_FAVOR: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 8 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Chaos Magicians ───────────────────────────────────────────────────────
    chaosmagicians: {
        display: "Chaos Magicians",
        color: "red",
        faction_board_id: 3,
        start: { C: 15, W: 4, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 2, WATER: 0, EARTH: 0, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            // Each TE advances: gain 2 favour tiles
            TE: { advance_cost: { W: 2, C: 5 }, advance_gain: [ { GAIN_FAVOR: 2 }, { GAIN_FAVOR: 2 }, { GAIN_FAVOR: 2 } ], income: { P: [ 0, 1, 2, 3 ] } },
            // SH is cheaper than standard; unlock: ACTC special action
            SH: { advance_cost: { W: 4, C: 4 }, advance_gain: [ { ACTC: 1 } ], income: { W: [ 0, 2 ] } },
            // SA also gains 2 favour tiles
            SA: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { GAIN_FAVOR: 2 } ], income: { P: [ 0, 1 ] } },
        },
    },

    // ── Cultists ──────────────────────────────────────────────────────────────
    cultists: {
        display: "Cultists",
        color: "brown",
        faction_board_id: 10,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 0, EARTH: 1, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // When a neighbour leeches power: taken → gain 1 cult step, not_taken → gain 1 PW
        leech_effect: {
            taken: { CULT: 1 },
            not_taken: { PW: 1 },
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            SH: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { VP: 7 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 8 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Darklings ─────────────────────────────────────────────────────────────
    darklings: {
        display: "Darklings",
        color: "black",
        faction_board_id: 12,
        start: { C: 15, W: 1, P: 1, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 1, EARTH: 1, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        // Dig costs 1 priest and gives 1 spade + 2 VP; cannot upgrade dig level
        dig: {
            level: 0, max_level: 0,
            cost: [ { P: 1 } ],
            gain: [ { SPADE: 1, VP: 2 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: convert 3 workers to priests
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { CONVERT_W_TO_P: 3 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 10 }, income: { P: [ 0, 2 ] } },
        },
    },

    // ── Dwarves ───────────────────────────────────────────────────────────────
    dwarves: {
        display: "Dwarves",
        color: "gray",
        faction_board_id: 7,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 2, AIR: 0 },
        // No sailing ability
        ship: { level: 0, max_level: 0 },
        teleport: {
            level: 0, max_level: 1,
            type: "tunnel",
            cost: [ { W: 2 }, { W: 1 } ],
            gain: [ { VP: 4 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 3, 5, 7, 10 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: upgrade tunnel level
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { GAIN_TELEPORT: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Engineers ─────────────────────────────────────────────────────────────
    engineers: {
        display: "Engineers",
        color: "gray",
        faction_board_id: 8,
        start: { C: 10, W: 2, P: 0, P1: 3, P2: 9, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 0, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // Start with engineer bridge action pre-unlocked
        special: { ACTE: 1 },
        buildings: {
            // All buildings cheaper than standard
            D:  { advance_cost: { W: 1, C: 1 }, income: { W: [ 0, 1, 2, 2, 3, 4, 4, 5, 6 ] } },
            TP: { advance_cost: { W: 1, C: 2 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 1, C: 4 }, income: { P: [ 0, 1, 1, 2 ], PW: [ 0, 0, 5, 5 ] } },
            SH: { advance_cost: { W: 3, C: 6 }, income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 3, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Fakirs ────────────────────────────────────────────────────────────────
    fakirs: {
        display: "Fakirs",
        color: "yellow",
        faction_board_id: 1,
        start: { C: 15, W: 3, P: 0, P1: 7, P2: 5, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 0, EARTH: 0, AIR: 1 },
        // No sailing ability
        ship: { level: 0, max_level: 0 },
        teleport: {
            level: 0, max_level: 1,
            type: "carpet",
            cost: [ { P: 1 }, { P: 1 } ],
            gain: [ { VP: 4 }, { VP: 4 } ],
            advance_gain: [ { carpet_range: 1 } ],
        },
        // Dig maximum level is 1 (not 2)
        dig: {
            level: 0, max_level: 1,
            cost: [ { W: 3 }, { W: 2 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: upgrade carpet level
            SH: { advance_cost: { W: 4, C: 10 }, advance_gain: [ { GAIN_TELEPORT: 1 } ], income: { P: [ 0, 1 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Giants ────────────────────────────────────────────────────────────────
    giants: {
        display: "Giants",
        color: "red",
        faction_board_id: 4,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 0, EARTH: 0, AIR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: ACTG special action (giants double-spade)
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { ACTG: 1 } ], income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Halflings ─────────────────────────────────────────────────────────────
    halflings: {
        display: "Halflings",
        color: "brown",
        faction_board_id: 9,
        start: { C: 15, W: 3, P: 0, P1: 3, P2: 9, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 1, AIR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 1, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // Each spade used in a town scores +1 VP
        special: { mode: "gain", SPADE: { VP: 1 } },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: immediately gain 3 spades (and build 1 dwelling)
            SH: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { SPADE: 3 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Mermaids ──────────────────────────────────────────────────────────────
    mermaids: {
        display: "Mermaids",
        color: "blue",
        faction_board_id: 6,
        start: { C: 15, W: 3, P: 0, P1: 3, P2: 9, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 2, EARTH: 0, AIR: 0 },
        // Ship starts at level 1 (already has sailing) and can reach level 5
        ship: {
            level: 1, max_level: 5,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 0 }, { VP: 2 }, { VP: 3 }, { VP: 4 }, { VP: 5 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: advance ship for free
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { GAIN_SHIP: 1 } ], income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 4, C: 8 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Nomads ────────────────────────────────────────────────────────────────
    nomads: {
        display: "Nomads",
        color: "yellow",
        faction_board_id: 2,
        start: { C: 15, W: 2, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 0, EARTH: 1, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 7, 11 ], PW: [ 0, 1, 2, 3, 4 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: ACTN special action (nomad sand move)
            SH: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { ACTN: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Swarmlings ────────────────────────────────────────────────────────────
    swarmlings: {
        display: "Swarmlings",
        color: "blue",
        faction_board_id: 5,
        start: { C: 20, W: 8, P: 0, P1: 3, P2: 9, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 1, EARTH: 1, AIR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // Each town tile gains 3 workers (TW1..TW8 → W:3)
        special: { mode: "gain", TW: { W: 3 } },
        buildings: {
            D:  { advance_cost: { W: 2, C: 3 }, income: { W: [ 2, 3, 4, 5, 6, 7, 8, 9, 9 ] } },
            TP: { advance_cost: { W: 3, C: 4 }, income: { PW: [ 0, 2, 4, 6, 8 ], C: [ 0, 2, 4, 6, 9 ] } },
            TE: { advance_cost: { W: 3, C: 6 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: ACTS special action
            SH: { advance_cost: { W: 5, C: 8 }, advance_gain: [ { ACTS: 1 } ], income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 5, C: 8 }, income: { P: [ 0, 2 ] } },
        },
    },

    // ── Witches ───────────────────────────────────────────────────────────────
    witches: {
        display: "Witches",
        color: "green",
        faction_board_id: 14,
        start: { C: 15, W: 3, P: 0, P1: 5, P2: 7, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 0, AIR: 2 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 2, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // Each town tile scores +5 VP (TW1..TW8 → VP:5)
        special: { mode: "gain", TW: { VP: 5 } },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: ACTW special action (free tree planting)
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { ACTW: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // Fire & Ice expansion factions
    // ════════════════════════════════════════════════════════════════════════════

    // ── Riverwalkers ──────────────────────────────────────────────────────────
    riverwalkers: {
        display: "Riverwalkers",
        // Home terrain is chosen at game start
        color: null,
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,
        start: { C: 15, W: 3, P: 0, P1: 10, P2: 2, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 0, EARTH: 0, AIR: 1 },
        // River adjacency: ship always at level 1 (locked), can never advance
        ship: { level: 1, max_level: 1 },
        // No explicit dig action; terrain unlocked by spending priests
        dig: null,
        // Gaining a spade does nothing; gaining a priest unlocks a terrain type
        special: {
            mode: "replace",
            SPADE: {},
            P: { UNLOCK_TERRAIN: 1 },
        },
        // Forbidden power/bonus actions that produce spades
        action_restrict: { BON1: true, ACT5: true, ACT6: true },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 3, 4, 5, 5, 6, 7 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 1, 2 ], PW: [ 0, 0, 5, 5 ] } },
            // SH unlock: gain 2 bridge tokens
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { BRIDGE: 2 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Shapeshifters ─────────────────────────────────────────────────────────
    shapeshifters: {
        display: "Shapeshifters",
        color: null,
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,
        start: { C: 15, W: 3, P: 0, P1: 4, P2: 4, P3: 0, VP: 20 },
        cult_start: { FIRE: 1, WATER: 1, EARTH: 0, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        // Dig cannot be upgraded
        dig: {
            level: 0, max_level: 0,
            cost: [ { W: 3 } ],
            gain: [ { SPADE: 1 } ],
        },
        // When leech is offered: taken → spend P3 token for VP, not_taken → gain 1 PW
        leech_effect: {
            taken: { GAIN_P3_FOR_VP: 1 },
            not_taken: { PW: 1 },
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 8 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: gain ACTH5 + ACTH6 (shapeshift actions)
            SH: { advance_cost: { W: 3, C: 6 }, advance_gain: [ { ACTH5: 1, ACTH6: 1 } ], income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Acolytes ─────────────────────────────────────────────────────────────
    acolytes: {
        display: "Acolytes",
        // Volcano terrain — home tile is special fire-mountain type
        color: "volcano",
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,   // secondary terrain picked post-setup
        start: { C: 15, W: 3, P: 0, P1: 6, P2: 6, P3: 0, VP: 20 },
        // Very high starting cult values
        cult_start: { FIRE: 3, WATER: 3, EARTH: 3, AIR: 3 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        // Dig replaces terrain with volcano (not standard spades)
        dig: {
            level: 0, max_level: 0,
            cost: [ {} ],
            gain: [ { VOLCANO_TF: 1 } ],
        },
        // Spades gained → converted to cult advances instead
        special: { mode: "gain", SPADE: { SPADE: -1, CULT: 1 } },
        // Volcano tile effect when activated
        volcano_effect: { not_home: { LOSE_CULT: 3 }, home: { LOSE_CULT: 4 } },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 0, 1, 2, 3, 3, 4, 5, 6, 6 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: priests placed on cults give +1 bonus
            SH: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { PRIEST_CULT_BONUS: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 8 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Ice Maidens ───────────────────────────────────────────────────────────
    icemaidens: {
        display: "Ice Maidens",
        color: "ice",
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,
        start: { C: 15, W: 3, P: 0, P1: 6, P2: 6, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 1, EARTH: 0, AIR: 1 },
        // Start with one favour tile
        special: { GAIN_FAVOR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 1, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH: at end of round, score VP per temple (pass scoring)
            SH: { advance_cost: { W: 4, C: 6 }, income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Yetis ─────────────────────────────────────────────────────────────────
    yetis: {
        display: "Yetis",
        color: "ice",
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,
        start: { C: 15, W: 3, P: 0, P1: 0, P2: 12, P3: 0, VP: 20 },
        cult_start: { FIRE: 0, WATER: 0, EARTH: 1, AIR: 1 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        dig: {
            level: 0, max_level: 2,
            cost: [ { W: 3 }, { W: 2 }, { W: 1 } ],
            advance_cost: { W: 1, C: 5, P: 1 },
            advance_gain: [ { VP: 6 }, { VP: 6 } ],
        },
        // All power actions cost 1 less PW; SH/SA count as base strength 4
        special: { discount: { ACT1: { PW: 1 }, ACT2: { PW: 1 }, ACT3: { PW: 1 }, ACT4: { PW: 1 }, ACT5: { PW: 1 }, ACT6: { PW: 1 } } },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] } },
            // TP gives 2×PW per level instead of 1×
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 2, 4, 6, 8 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: all power actions can be reused in same round
            SH: { advance_cost: { W: 4, C: 6 }, advance_gain: [ { ALLOW_REUSE_ACTS: 1 } ], income: { PW: [ 0, 4 ] } },
            SA: { advance_cost: { W: 4, C: 6 }, income: { P: [ 0, 1 ] } },
        },
    },

    // ── Dragonlords ───────────────────────────────────────────────────────────
    dragonlords: {
        display: "Dragonlords",
        color: "volcano",
        faction_board_id: null,
        expansion: "fire_ice",
        pick_color: true,   // secondary terrain picked post-setup
        start: { C: 15, W: 3, P: 0, P1: 4, P2: 4, P3: 0, VP: 20 },
        cult_start: { FIRE: 2, WATER: 0, EARTH: 0, AIR: 0 },
        ship: {
            level: 0, max_level: 3,
            advance_cost: { C: 4, P: 1 },
            advance_gain: [ { VP: 2 }, { VP: 3 }, { VP: 4 } ],
        },
        // Dig replaces terrain with volcano (not standard spades); cannot upgrade
        dig: {
            level: 0, max_level: 0,
            cost: [ {} ],
            gain: [ { VOLCANO_TF: 1 } ],
        },
        // Spades gained → converted to P1 token (power bowl refund)
        special: { mode: "gain", SPADE: { SPADE: -1, P1: 1 } },
        // Volcano tile effect when activated
        volcano_effect: { not_home: { LOSE_PW_TOKEN: 1 }, home: { LOSE_PW_TOKEN: 2 } },
        buildings: {
            D:  { advance_cost: { W: 1, C: 2 }, income: { W: [ 0, 1, 2, 3, 3, 4, 5, 6, 6 ] } },
            TP: { advance_cost: { W: 2, C: 3 }, income: { C: [ 0, 2, 4, 6, 8 ], PW: [ 0, 1, 2, 4, 6 ] } },
            TE: { advance_cost: { W: 2, C: 5 }, income: { P: [ 0, 1, 2, 3 ] } },
            // SH unlock: gain P1 tokens equal to player count
            SH: { advance_cost: { W: 4, C: 8 }, advance_gain: [ { P1_PER_PLAYER: 1 } ], income: { PW: [ 0, 2 ] } },
            SA: { advance_cost: { W: 4, C: 8 }, income: { P: [ 0, 1 ] } },
        },
    },

}

// ── Convenience lookups ───────────────────────────────────────────────────────

/** Names of all base game factions (no expansion). */
const BASE_FACTIONS = Object.keys(FACTIONS).filter(k => !FACTIONS[k].expansion)

/** Names of all Fire & Ice expansion factions. */
const FIRE_ICE_FACTIONS = Object.keys(FACTIONS).filter(k => FACTIONS[k].expansion === "fire_ice")

/** Total faction count. */
const FACTION_COUNT = Object.keys(FACTIONS).length

module.exports = {
    FACTIONS,
    BASE_FACTIONS,
    FIRE_ICE_FACTIONS,
    FACTION_COUNT,
}
