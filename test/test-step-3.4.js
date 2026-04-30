"use strict"

// ============================================================
// Age of Innovation — test/test-step-3.4.js
// 专项测试：收入阶段（Step 3.4）
//
// 测试范围：
//   • 建筑收入（不同建造数量 × 不同建筑类型）
//   • 优待牌（FAV）收入叠加
//   • 奖励牌（BON）收入条件（passed=true 才生效）
//   • 轮次计分牌（SCORE）收入：乘数、上限、第6轮跳过
//   • 多来源叠加：建筑 + FAV + BON + SCORE 同时生效
//   • _begin_income：轮次计数、力量行动重置、首轮特殊处理
//   • _action_income：验证错误、资源实际增加、阶段转换
//   • JSON 序列化安全性
//
// 运行：node test/test-step-3.4.js
// ============================================================

const assert = require("assert")
const path   = require("path")

const RULES = require(path.join(__dirname, "..", "rules.js"))
const {
	_calc_income,
	_action_income,
	_begin_income,
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
 * 构建 2 人游戏（halflings, witches）到 income 阶段（round 1）。
 * halflings  → brown; P1   → A1 (brown), A7 (brown)
 * witches    → green; P2   → A3 (green), A10 (green)
 *
 * 蛇形顺序：P1 → P2 → P2 → P1
 */
function make_at_income() {
	let G = RULES.setup(1, "Standard", { players: "2" })
	G = RULES.action(G, "Player 1", "select_faction", "halflings")
	G = RULES.action(G, "Player 2", "select_faction", "witches")
	// 蛇形顺序：P1 → P2 → P2 → P1
	G = RULES.action(G, "Player 1", "place_dwelling", "A1")
	G = RULES.action(G, "Player 2", "place_dwelling", "A3")
	G = RULES.action(G, "Player 2", "place_dwelling", "A10")
	G = RULES.action(G, "Player 1", "place_dwelling", "A7")

	// 选奖励牌（逆序：P2 先选）
	const avail = Object.keys(BONUS_TILES).filter(n => (G.pool[n] || 0) > 0)
	G = RULES.action(G, "Player 2", "pick_bonus", avail[0])
	G = RULES.action(G, "Player 1", "pick_bonus", avail[1])
	// 此时处于 income 阶段，round=1
	return G
}

/** 构建一个"干净"的只含 half 派系的最小状态，便于精确设置建筑数量等属性 */
function make_faction_state(faction_name, overrides = {}) {
	const def = FACTIONS[faction_name]
	const fs = {
		faction_name,
		color: def.color,
		C: def.start.C,
		W: def.start.W,
		P: def.start.P || 0,
		P1: def.start.P1,
		P2: def.start.P2,
		P3: def.start.P3 || 0,
		VP: def.start.VP,
		KEY: 0,
		FIRE:  def.cult_start.FIRE,
		WATER: def.cult_start.WATER,
		EARTH: def.cult_start.EARTH,
		AIR:   def.cult_start.AIR,
		buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
		dig_level:  def.dig  ? def.dig.level  : 0,
		ship_level: def.ship ? def.ship.level : 0,
		favor_tiles: [],
		town_tiles:  [],
		bonus_tile:  null,
		passed:       false,
		income_taken: false,
		actions_used: [],
		locations: [],
		towns:     [],
		bridges:   [],
	}
	Object.assign(fs, overrides)
	return fs
}

/**
 * 构建一个最小 G（只含必要字段），用于直接调用 _calc_income。
 */
function make_minimal_G(faction_name, fs_overrides = {}, g_overrides = {}) {
	const fs = make_faction_state(faction_name, fs_overrides)
	const G = {
		round:                1,
		current_scoring_tile: null,
		scoring_tiles:        [],
		factions:             { "P1": fs },
	}
	Object.assign(G, g_overrides)
	return { G, fs }
}

// ─────────────────────────────────────────────────────────────────────────────

group("1: 建筑收入 — halflings D 轨道（不同建造数量）", () => {

	// halflings D income: { W: [1, 2, 3, 4, 5, 6, 7, 8, 8] }
	// D count=0 → W:1（初始轨道位置）
	// D count=1 → W:2
	// D count=3 → W:4
	// D count=8 → W:8

	test("D=0 时获得基础 W:1", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 1)
	})

	test("D=1 时获得 W:2", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 1, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 2)
	})

	test("D=2 时获得 W:3", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 2, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 3)
	})

	test("D=4 时获得 W:5", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 4, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 5)
	})

	test("D=8 时获得上限 W:8", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 8, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 8)
	})
})

group("2: 建筑收入 — halflings TP/TE/SH/SA 轨道", () => {

	// halflings TP income: { C: [0,2,4,6,8], PW: [0,1,2,4,6] }
	// halflings TE income: { P: [0,1,2,3] }
	// halflings SH income: { PW: [0,2] }
	// halflings SA income: { P: [0,1] }

	test("TP=0 时无 TP 收入", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C || 0, 0)
		assert.strictEqual(income.PW || 0, 0)
	})

	test("TP=1 时获得 C:2, PW:1", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 1, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C  || 0, 2)
		assert.strictEqual(income.PW || 0, 1)
	})

	test("TP=2 时获得 C:4, PW:2", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 2, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C  || 0, 4)
		assert.strictEqual(income.PW || 0, 2)
	})

	test("TP=4 时获得最大 C:8, PW:6", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 4, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C  || 0, 8)
		assert.strictEqual(income.PW || 0, 6)
	})

	test("TE=1 时获得 P:1", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 1, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 1)
	})

	test("TE=3 时获得 P:3（最大制裁规模）", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 3, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 3)
	})

	test("SH=1 时获得 PW:2", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 0, SH: 1, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.PW || 0, 2)
	})

	test("SA=1 时获得 P:1", () => {
		const { G } = make_minimal_G("halflings", { buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 1 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 1)
	})
})

group("3: 建筑收入 — 多建筑类型叠加", () => {

	// D=2(W:3) + TP=1(C:2, PW:1) + TE=1(P:1) + SH=1(PW:2) + SA=1(P:1)
	test("halflings D=2, TP=1, TE=1, SH=1, SA=1 全部叠加", () => {
		const { G } = make_minimal_G("halflings", {
			buildings: { D: 2, TP: 1, TE: 1, SH: 1, SA: 1 }
		})
		const income = _calc_income(G, "P1")
		// W from D: arr[2]=3
		assert.strictEqual(income.W || 0, 3)
		// C from TP: arr[1]=2
		assert.strictEqual(income.C || 0, 2)
		// PW from TP(1) + SH(2) = 3
		assert.strictEqual(income.PW || 0, 3)
		// P from TE(1) + SA(1) = 2
		assert.strictEqual(income.P || 0, 2)
	})

	// nomads TP income differs: { C: [0,2,4,7,11], PW: [0,1,2,3,4] }
	test("nomads TP=3 时获得 C:7, PW:3", () => {
		const { G } = make_minimal_G("nomads", { buildings: { D: 0, TP: 3, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C  || 0, 7)
		assert.strictEqual(income.PW || 0, 3)
	})

	// swarmlings D income: { W: [2,3,4,5,6,7,8,9,9] }
	test("swarmlings D=0 时基础收入 W:2", () => {
		const { G } = make_minimal_G("swarmlings", { buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 } })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.W || 0, 2)
	})
})

group("4: 优待牌（FAV）收入", () => {

	// FAV7: income { W:1, PW:1 }
	// FAV8: income { PW:4 }
	// FAV9: income { C:3 }
	// FAV12: income {} (only pass_vp)
	// FAV1-4 (cult): income {}

	test("无 FAV 牌时无 FAV 收入", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		// 只看 FAV 贡献 = 0
		const income_no_fav  = _calc_income(G, "P1")
		const G2 = clone(G)
		G2.factions["P1"].favor_tiles = ["FAV7"]
		const income_with_fav = _calc_income(G2, "P1")
		// FAV7 adds W:1, PW:1
		assert.strictEqual((income_with_fav.W  || 0) - (income_no_fav.W  || 0), 1)
		assert.strictEqual((income_with_fav.PW || 0) - (income_no_fav.PW || 0), 1)
	})

	test("FAV7 贡献 W:1, PW:1", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: ["FAV7"] })
		const base  = _calc_income(clone(G), "P1")
		G.factions["P1"].favor_tiles = []
		const no_fav = _calc_income(G, "P1")
		assert.strictEqual((base.W  || 0) - (no_fav.W  || 0), 1)
		assert.strictEqual((base.PW || 0) - (no_fav.PW || 0), 1)
	})

	test("FAV8 贡献 PW:4", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV8"]
		const with_fav = _calc_income(G, "P1")
		assert.strictEqual((with_fav.PW || 0) - (no_fav.PW || 0), 4)
	})

	test("FAV9 贡献 C:3", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV9"]
		const with_fav = _calc_income(G, "P1")
		assert.strictEqual((with_fav.C || 0) - (no_fav.C || 0), 3)
	})

	test("FAV12 无收入（只有 pass_vp）", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV12"]
		const with_fav = _calc_income(G, "P1")
		// FAV12 income is {}, so delta should be 0 for all resources
		assert.strictEqual((with_fav.C  || 0) - (no_fav.C  || 0), 0)
		assert.strictEqual((with_fav.W  || 0) - (no_fav.W  || 0), 0)
		assert.strictEqual((with_fav.P  || 0) - (no_fav.P  || 0), 0)
		assert.strictEqual((with_fav.PW || 0) - (no_fav.PW || 0), 0)
	})

	test("FAV1（cult 牌，income 为空）无额外收入", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV1"]
		const with_fav = _calc_income(G, "P1")
		assert.strictEqual((with_fav.C  || 0) - (no_fav.C  || 0), 0)
		assert.strictEqual((with_fav.W  || 0) - (no_fav.W  || 0), 0)
	})

	test("FAV7 + FAV8 叠加：W+1, PW+5", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV7", "FAV8"]
		const with_fav = _calc_income(G, "P1")
		assert.strictEqual((with_fav.W  || 0) - (no_fav.W  || 0), 1)
		assert.strictEqual((with_fav.PW || 0) - (no_fav.PW || 0), 5)
	})

	test("FAV9 + FAV7 + FAV8 三牌叠加：C+3, W+1, PW+5", () => {
		const { G } = make_minimal_G("halflings", { favor_tiles: [] })
		const no_fav = _calc_income(G, "P1")
		G.factions["P1"].favor_tiles = ["FAV9", "FAV7", "FAV8"]
		const with_fav = _calc_income(G, "P1")
		assert.strictEqual((with_fav.C  || 0) - (no_fav.C  || 0), 3)
		assert.strictEqual((with_fav.W  || 0) - (no_fav.W  || 0), 1)
		assert.strictEqual((with_fav.PW || 0) - (no_fav.PW || 0), 5)
	})
})

group("5: 奖励牌（BON）收入 — passed 条件", () => {

	// BON3: income { C: 6 }         — 最简单：只给金币
	// BON5: income { PW:3, W:1 }
	// BON8: income { P: 1 }

	test("passed=true 时 BON3（C:6）收入生效", () => {
		const { G } = make_minimal_G("halflings", { bonus_tile: "BON3", passed: true })
		const no_bon = _calc_income({ ...G, factions: { P1: { ...G.factions.P1, bonus_tile: null } } }, "P1")
		const with_bon = _calc_income(G, "P1")
		assert.strictEqual((with_bon.C || 0) - (no_bon.C || 0), BONUS_TILES.BON3.income.C)
	})

	test("passed=false 时 BON3 收入 **不** 生效", () => {
		const { G } = make_minimal_G("halflings", { bonus_tile: "BON3", passed: false })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.C || 0, 0)
	})

	test("passed=true 时 BON5（PW:3, W:1）收入生效", () => {
		const { G } = make_minimal_G("halflings", {
			bonus_tile: "BON5", passed: true,
			buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
		})
		const income = _calc_income(G, "P1")
		// Building W from D=0: 1; BON5 adds W:1 → total W = 2
		assert.strictEqual(income.PW || 0, 3)
		assert.strictEqual(income.W  || 0, 2)
	})

	test("passed=false 时 BON5 权力不给予", () => {
		const { G } = make_minimal_G("halflings", {
			bonus_tile: "BON5", passed: false,
			buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		})
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.PW || 0, 0)
	})

	test("passed=true 时 BON8（P:1）收入生效", () => {
		const { G } = make_minimal_G("halflings", {
			bonus_tile: "BON8", passed: true,
			buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 },
		})
		const income = _calc_income(G, "P1")
		// No TE/SA built, so P only from BON8
		assert.strictEqual(income.P || 0, 1)
	})

	test("没有 bonus_tile 时无奖励牌收入", () => {
		const { G } = make_minimal_G("halflings", { bonus_tile: null, passed: true })
		// No bonus tile → no bonus income (only building)
		const income = _calc_income(G, "P1")
		assert.ok((income.C || 0) === 0)   // only W from D, and no TP built
	})
})

group("6: 轮次计分牌（SCORE）收入", () => {

	// SCORE3: cult=WATER, req=4, income={ P:1 }
	//   → floor(WATER / 4) × P:1
	// SCORE4: cult=FIRE,  req=2, income={ W:1 }
	// SCORE5: cult=FIRE,  req=4, income={ PW:4 }

	test("SCORE3: WATER=0 → floor(0/4)=0, 无收入", () => {
		const { G } = make_minimal_G("halflings", { WATER: 0 }, {
			round: 1, current_scoring_tile: "SCORE3"
		})
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 0)
	})

	test("SCORE3: WATER=4 → floor(4/4)=1 → P:1", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 4, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 1, current_scoring_tile: "SCORE3" })
		const income = _calc_income(G, "P1")
		// P from TE/SA: 0; from SCORE3: 1
		assert.strictEqual(income.P || 0, 1)
	})

	test("SCORE3: WATER=8 → floor(8/4)=2 → P:2", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 8, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 1, current_scoring_tile: "SCORE3" })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 2)
	})

	test("SCORE3: WATER=10 → floor(10/4)=2 → P:2", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 10, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 1, current_scoring_tile: "SCORE3" })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 2)
	})

	test("SCORE4: FIRE=2, req=2 → floor(2/2)=1 → W:1", () => {
		const { G } = make_minimal_G("halflings", {
			FIRE: 2, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 2, current_scoring_tile: "SCORE4" })
		const income = _calc_income(G, "P1")
		// W from D=0: 1; W from SCORE4: 1; total 2
		assert.strictEqual(income.W || 0, 2)
	})

	test("SCORE5: FIRE=4, req=4 → floor(4/4)=1 → PW:4", () => {
		const { G } = make_minimal_G("halflings", {
			FIRE: 4, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 3, current_scoring_tile: "SCORE5" })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.PW || 0, 4)
	})

	test("第6轮：计分牌收入被跳过", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 8, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 6, current_scoring_tile: "SCORE3" })
		const income = _calc_income(G, "P1")
		// WATER=8 normally gives P:2, but round 6 skips scoring tile income
		assert.strictEqual(income.P || 0, 0)
	})

	test("第5轮：计分牌收入仍生效", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 4, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 5, current_scoring_tile: "SCORE3" })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 1)
	})

	test("current_scoring_tile=null 时无计分牌收入", () => {
		const { G } = make_minimal_G("halflings", {
			WATER: 8, buildings: { D: 0, TP: 0, TE: 0, SH: 0, SA: 0 }
		}, { round: 1, current_scoring_tile: null })
		const income = _calc_income(G, "P1")
		assert.strictEqual(income.P || 0, 0)
	})
})

group("7: 多来源叠加", () => {

	// 建筑(D=2→W:3) + FAV7(W:1,PW:1) + FAV9(C:3) + BON5(PW:3,W:1, passed)
	// + SCORE4(FIRE=4, req=2 → floor(4/2)=2 → W:2)
	// W  = 3 + 1 + 1 + 2 = 7  (building + FAV7 + BON5 + SCORE4×2)
	// PW = 1 + 3 = 4            (FAV7 + BON5)
	// C  = 3                    (FAV9)
	test("building + FAV + BON + SCORE 全部叠加计算正确", () => {
		const { G } = make_minimal_G("halflings", {
			buildings:   { D: 2, TP: 0, TE: 0, SH: 0, SA: 0 },
			favor_tiles: ["FAV7", "FAV9"],
			bonus_tile:  "BON5",
			passed:      true,
			FIRE:        4,
		}, { round: 2, current_scoring_tile: "SCORE4" })

		const income = _calc_income(G, "P1")
		// SCORE4: cult=FIRE, req=2 → floor(4/2)=2 → W:2
		assert.strictEqual(income.W  || 0, 7)   // D:3 + FAV7:1 + BON5:1 + SCORE4:2
		assert.strictEqual(income.PW || 0, 4)   // FAV7:1 + BON5:3
		assert.strictEqual(income.C  || 0, 3)   // FAV9:3
	})
})

group("8: _begin_income — 初始化行为", () => {

	test("首次调用（round=0）后 round=1", () => {
		const G = make_at_income()
		assert.strictEqual(G.round, 1)
	})

	test("首次收入时所有玩家 passed=true（传给 _calc_income 用）", () => {
		// 在 make_at_income() 调用时，pick_bonus 完成后 _begin_income 已调用
		// 但在进入 income action 之前，passed 应为 true（为首轮特殊处理）
		const G = make_at_income()
		// Players are now in income phase; income_taken=false; passed was forced true by _begin_income
		// However _begin_income forces passed=true only before income is taken,
		// so at this point fs.passed should still be true
		for (const role of G.turn_order) {
			// After _begin_income, passed is forced true for round 1
			// (it will be reset to false when _begin_play is called)
			assert.ok(G.factions[role].passed, `${role} should have passed=true for round 1 income`)
		}
	})

	test("_begin_income 重置力量行动为可用", () => {
		const G = make_at_income()
		// All power actions should be reset to 1 at round start
		const { POWER_ACTIONS } = require(path.join(__dirname, "..", "data", "constants.js"))
		for (const name of Object.keys(POWER_ACTIONS)) {
			assert.strictEqual(G.pool[name], 1, `${name} should be reset to 1`)
		}
	})

	test("_begin_income 清除 income_taken 标志", () => {
		const G = make_at_income()
		for (const role of G.turn_order) {
			assert.strictEqual(
				G.factions[role].income_taken,
				false,
				`${role}.income_taken should be false at start of income phase`
			)
		}
	})

	test("income 阶段 action_queue 按 turn_order 顺序", () => {
		const G = make_at_income()
		assert.strictEqual(G.state, "income")
		assert.strictEqual(G.action_queue.length, G.turn_order.length)
		for (let i = 0; i < G.turn_order.length; i++) {
			assert.strictEqual(G.action_queue[i].role, G.turn_order[i])
			assert.strictEqual(G.action_queue[i].type, "income")
		}
	})

	test("current_scoring_tile 在收入阶段已设置", () => {
		const G = make_at_income()
		// scoring_tiles[0] is set; current_scoring_tile should match
		assert.strictEqual(G.current_scoring_tile, G.scoring_tiles[0])
	})
})

group("9: _action_income — 验证错误", () => {

	test("非 income 阶段调用抛出错误", () => {
		const G = make_at_income()
		// Advance to play phase first
		let G2 = RULES.action(G, "Player 1", "income")
		G2 = RULES.action(G2, "Player 2", "income")
		// Now in play phase
		assert.throws(
			() => RULES.action(G2, "Player 1", "income"),
			/not in income phase/i
		)
	})

	test("不是当前玩家轮次时拒绝", () => {
		const G = make_at_income()
		// income queue = [P1, P2]; active = P1
		assert.throws(
			() => RULES.action(G, "Player 2", "income"),
			/not your turn/i
		)
	})

	test("收入已取过再次取出抛出错误", () => {
		const G = clone(make_at_income())
		_action_income(G, "Player 1")
		// Manually reset active so we can call _action_income again
		G.active = "Player 1"
		G.factions["Player 1"].income_taken = true
		assert.throws(
			() => _action_income(G, "Player 1"),
			/already taken/i
		)
	})
})

group("10: _action_income — 资源实际增加", () => {

	test("halflings 取收入后 W 增加正确（D=2, BON passed）", () => {
		const G     = make_at_income()
		const fs    = G.factions["Player 1"]
		const W_before = fs.W
		const income   = _calc_income(G, "Player 1")
		const G2       = RULES.action(G, "Player 1", "income")
		assert.strictEqual(G2.factions["Player 1"].W, W_before + (income.W || 0))
	})

	test("witches 取收入后资源增加正确", () => {
		const G     = make_at_income()
		const fs    = G.factions["Player 2"]
		const C_before = fs.C
		const income   = _calc_income(G, "Player 2")

		// Player 1 must go first (they're active)
		let G2 = RULES.action(G, "Player 1", "income")
		G2 = RULES.action(G2, "Player 2", "income")
		assert.ok(G2.factions["Player 2"].C >= C_before + (income.C || 0))
	})

	test("取收入后 income_taken 标志为 true", () => {
		const G  = clone(make_at_income())
		_action_income(G, "Player 1")
		assert.strictEqual(G.factions["Player 1"].income_taken, true)
	})

	test("取收入后队列推进到下一玩家", () => {
		const G  = clone(make_at_income())
		_action_income(G, "Player 1")
		assert.strictEqual(G.active, "Player 2")
	})
})

group("11: _action_income — 阶段转换", () => {

	test("所有玩家取收入后进入 play 阶段", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		assert.strictEqual(G.state, "play")
	})

	test("进入 play 阶段后 passed 重置为 false", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		assert.strictEqual(G.factions["Player 1"].passed, false)
		assert.strictEqual(G.factions["Player 2"].passed, false)
	})

	test("进入 play 阶段后 income_taken 重置为 false", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		// _begin_play resets income_taken
		assert.strictEqual(G.factions["Player 1"].income_taken, false)
		assert.strictEqual(G.factions["Player 2"].income_taken, false)
	})

	test("进入 play 阶段后 G.active = 首个 turn_order 玩家", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		assert.strictEqual(G.active, G.turn_order[0])
	})

	test("进入 play 阶段后 action_queue 清空", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		assert.strictEqual(G.action_queue.length, 0)
	})
})

group("12: JSON 序列化安全", () => {

	test("income 阶段 G 可以序列化/反序列化", () => {
		const G    = make_at_income()
		const copy = JSON.parse(JSON.stringify(G))
		assert.deepStrictEqual(copy.state, G.state)
		assert.deepStrictEqual(copy.round, G.round)
		assert.deepStrictEqual(copy.factions, G.factions)
	})

	test("取完收入后 G 可以序列化/反序列化", () => {
		let G = make_at_income()
		G = RULES.action(G, "Player 1", "income")
		G = RULES.action(G, "Player 2", "income")
		const copy = JSON.parse(JSON.stringify(G))
		assert.deepStrictEqual(copy.state, "play")
		assert.deepStrictEqual(copy.factions["Player 1"].income_taken, false)
	})
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(60))
if (failed === 0) {
	console.log(`All ${passed} tests passed.`)
} else {
	console.log(`${passed} passed, ${failed} failed.`)
	console.log("\nFailed tests:")
	for (const { name, err } of failures) {
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
	}
	process.exit(1)
}
