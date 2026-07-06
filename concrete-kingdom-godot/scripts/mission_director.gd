extends Node

## Mission Director — manages active, completed, and available missions.
## Data-driven: missions defined in configuration, not hardcoded.

signal mission_started(mission_id: String)
signal mission_updated(mission_id: String, objective_id: String)
signal mission_completed(mission_id: String)
signal mission_failed(mission_id: String)

class Mission:
	var id: String
	var title: String
	var description: String
	var faction: String          # which faction gives it
	var required_missions: Array # prerequisites
	var objectives: Array        # array of Objective
	var reward_money: int
	var reward_rep: Dictionary   # {faction: amount}
	var state: String            # locked, available, active, completed, failed

class Objective:
	var id: String
	var description: String
	var type: String             # goto, kill, collect, interact, protect, escape, timed
	var target_id: String        # business name, npc id, position key
	var position: Vector3        # for goto objectives
	var radius: float            # completion radius
	var count: int               # for collect/kill objectives (how many)
	var count_current: int       # current progress
	var completed: bool


var _missions: Dictionary = {}   # id -> Mission
var _active_mission: Mission = null
var _completed_missions: Array = []
var _player_ref = null


func _ready():
	_define_missions()


func set_player_ref(player):
	_player_ref = player


## Define all missions in the game. Data-driven.
func _define_missions():
	# ── Act 1: Rise ──
	_add_mission({
		"id": "m01_first_score",
		"title": "First Score",
		"description": "Knock over the corner store. Prove you've got what it takes.",
		"faction": "neutral",
		"required_missions": [],
		"objectives": [
			{"id": "obj_go_to_store", "type": "goto", "target_id": "Bar",
			 "position": Vector3(10, 0, -6), "radius": 4.0,
			 "description": "Go to the bar"},
			{"id": "obj_take_over", "type": "interact", "target_id": "Bar",
			 "description": "Take over the bar"},
			{"id": "obj_lose_heat", "type": "escape", 
			 "description": "Lose the police (wait for heat to drop)"},
		],
		"reward_money": 500,
		"reward_rep": {"neutral": 10},
	})

	_add_mission({
		"id": "m02_warehouse_job",
		"title": "Warehouse Job",
		"description": "The syndicate wants the warehouse. Take it.",
		"faction": "syndicate",
		"required_missions": ["m01_first_score"],
		"objectives": [
			# ACT 1: Setup — drive to warehouse
			{"id": "obj_go_to_wh", "type": "goto", "target_id": "Warehouse",
			 "position": Vector3(-18, 0, -9), "radius": 4.0,
			 "description": "Drive to the warehouse — check your gear"},
			# ACT 2: Escalation — alarms trigger, cops swarm
			{"id": "obj_breach", "type": "interact", "target_id": "Warehouse",
			 "description": "Breach the warehouse — alarms trigger"},
			{"id": "obj_survive", "type": "timed", "count": 20,
			 "description": "Survive the initial police response (20s)"},
			# ACT 3: Climax — get the goods, escape through the back
			{"id": "obj_loot", "type": "interact", "target_id": "Warehouse",
			 "description": "Grab the syndicate's shipment"},
			# ACT 4: Aftermath — escape the heat
			{"id": "obj_escape", "type": "escape",
			 "description": "Lose the cops and deliver the goods"},
		],
		"reward_money": 1200,
		"reward_rep": {"syndicate": 15},
	})

	_add_mission({
		"id": "m03_apartment_heist",
		"title": "Apartment Heist",
		"description": "The Mafia has a safe in the apartment building. Hit it. Split the take.",
		"faction": "mafia",
		"required_missions": ["m01_first_score"],
		"objectives": [
			{"id": "obj_go_apt", "type": "goto", "target_id": "Apartment",
			 "position": Vector3(-8, 0, 16.5), "radius": 4.0,
			 "description": "Reach the apartment"},
			{"id": "obj_open_safe", "type": "interact", "target_id": "Apartment",
			 "description": "Crack the safe"},
			{"id": "obj_escape", "type": "escape",
			 "description": "Escape the area"},
		],
		"reward_money": 2000,
		"reward_rep": {"mafia": 20},
	})

	# ── Act 2: Consolidate ──
	_add_mission({
		"id": "m04_office_takeover",
		"title": "Office Takeover",
		"description": "Take the office building. It's the key to the district.",
		"faction": "neutral",
		"required_missions": ["m02_warehouse_job", "m03_apartment_heist"],
		"objectives": [
			{"id": "obj_go_off", "type": "goto", "target_id": "Office",
			 "position": Vector3(14, 0, 17), "radius": 4.0,
			 "description": "Approach the office"},
			{"id": "obj_take_off", "type": "interact", "target_id": "Office",
			 "description": "Take over the office"},
		],
		"reward_money": 5000,
		"reward_rep": {"neutral": 30, "syndicate": -10, "mafia": -10},
	})

	# ── Endgame ──
	_add_mission({
		"id": "m05_showdown",
		"title": "Concrete Kingdom",
		"description": "One faction stands in your way. End them. Own the district.",
		"faction": "neutral",
		"required_missions": ["m04_office_takeover"],
		"objectives": [
			{"id": "obj_repel", "type": "timed", "count": 60,
			 "description": "Hold the district against all factions (60 seconds)"},
			{"id": "obj_claim", "type": "goto", "target_id": "Office",
			 "position": Vector3(14, 0, 17), "radius": 4.0,
			 "description": "Return to the office and claim the district"},
		],
		"reward_money": 10000,
		"reward_rep": {"neutral": 100},
	})


func _add_mission(data: Dictionary):
	var m = Mission.new()
	m.id = data["id"]
	m.title = data["title"]
	m.description = data["description"]
	m.faction = data.get("faction", "neutral")
	m.required_missions = data.get("required_missions", [])
	m.reward_money = data.get("reward_money", 0)
	m.reward_rep = data.get("reward_rep", {})
	m.state = "locked"

	for odata in data.get("objectives", []):
		var o = Objective.new()
		o.id = odata["id"]
		o.description = odata.get("description", "")
		o.type = odata.get("type", "goto")
		o.target_id = odata.get("target_id", "")
		o.position = odata.get("position", Vector3.ZERO)
		o.radius = odata.get("radius", 4.0)
		o.count = odata.get("count", 1)
		o.count_current = 0
		o.completed = false
		m.objectives.append(o)

	m.state = "available" if m.required_missions.is_empty() else "locked"
	_missions[m.id] = m


## Check prerequisites and unlock missions.
func refresh_available():
	for m in _missions.values():
		if m.state != "locked":
			continue
		var all_done = true
		for req in m.required_missions:
			if req not in _completed_missions:
				all_done = false
				break
		if all_done:
			m.state = "available"


## Start a mission by ID.
func start_mission(id: String) -> bool:
	var m = _missions.get(id)
	if not m or m.state != "available":
		return false

	m.state = "active"
	_active_mission = m
	mission_started.emit(m.id)
	return true


## Call this when the player does something that might progress an objective.
func report_action(action_type: String, target_id: String = "", count: int = 1):
	if not _active_mission:
		return

	for o in _active_mission.objectives:
		if o.completed:
			continue

		match o.type:
			"goto":
				if action_type == "goto" and target_id == o.target_id:
					o.completed = true
					mission_updated.emit(_active_mission.id, o.id)
			"interact":
				if action_type == "interact" and target_id == o.target_id:
					o.completed = true
					mission_updated.emit(_active_mission.id, o.id)
			"collect", "kill":
				if action_type == o.type and (target_id.is_empty() or target_id == o.target_id):
					o.count_current += count
					if o.count_current >= o.count:
						o.completed = true
						mission_updated.emit(_active_mission.id, o.id)
			"timed":
				o.count_current += count  # count is seconds passed
				if o.count_current >= o.count:
					o.completed = true
					mission_updated.emit(_active_mission.id, o.id)
			"escape":
				# Heat drops to 0
				if action_type == "heat_dropped":
					o.completed = true
					mission_updated.emit(_active_mission.id, o.id)

	_check_mission_complete()


## Check if all objectives are done → complete mission.
func _check_mission_complete():
	if not _active_mission:
		return
	for o in _active_mission.objectives:
		if not o.completed:
			return

	# All done
	_active_mission.state = "completed"
	_completed_missions.append(_active_mission.id)
	var reward = _active_mission.reward_money

	mission_completed.emit(_active_mission.id)
	_active_mission = null
	refresh_available()


## Force-fail the current mission.
func fail_mission():
	if not _active_mission:
		return
	var mid = _active_mission.id
	_active_mission.state = "failed"
	mission_failed.emit(mid)
	_active_mission = null


func get_active_mission():
	return _active_mission


func get_mission(id: String):
	return _missions.get(id)


func get_available_missions() -> Array:
	var result = []
	for m in _missions.values():
		if m.state == "available":
			result.append(m)
	return result


func get_completed_count() -> int:
	return _completed_missions.size()
