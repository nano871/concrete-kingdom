extends Node

## Wanted Level Director — manages 5-star police escalation.
## Controls heat level, spawns police units, manages chase intensity.
## Ported pattern from GTA V's wanted system architecture.

signal heat_changed(level: int)
signal star_earned(level: int)
signal star_lost(level: int)
signal player_busted()
signal player_escaped()

const MAX_STARS = 5
const STAR_DECAY_TIME = [0, 8.0, 12.0, 18.0, 25.0, 35.0]  # seconds per star to decay
const DETECTION_RANGE = [0, 15.0, 25.0, 35.0, 50.0, 80.0]

# Star level definitions
# 1★: Local patrol responds, 1 car
# 2★: 2 patrol cars, more aggressive
# 3★: Roadblocks, helicopter begins tracking
# 4★: Heavy response, 4+ cars, spike strips
# 5★: Maximum response, FIB/noose equivalents, everything

var wanted_level: int = 0          # 0-5
var star_progress: float = 0.0     # progress toward next star
var star_decay_timer: float = 0.0  # time since last offense
var is_searching: bool = false
var search_timer: float = 0.0
var player_last_known: Vector3 = Vector3.ZERO
var player_last_seen_time: float = 0.0
var total_offense_weight: float = 0.0

# Active police units
var active_units: Array = []
var max_units_per_star = [0, 1, 2, 4, 6, 10]
var helicopter_active: bool = false

var _player_pos: Vector3 = Vector3.ZERO
var _player_visible: bool = true
var _police_spawner = null
var _scene_tree = null


func _ready():
	_scene_tree = get_tree()


## Called each frame from main game loop.
func tick(delta: float, player_pos: Vector3, player_speed: float, in_vehicle: bool, is_committing_crime: bool):
	_player_pos = player_pos
	_player_visible = _check_visibility(player_pos, player_speed, in_vehicle)

	# If committing crime, increase star progress
	if is_committing_crime:
		star_progress += delta * 2.0
		total_offense_weight += delta * 3.0
		star_decay_timer = 0.0

	# Decay star progress when not doing crime
	if not is_committing_crime and wanted_level > 0:
		star_decay_timer += delta
		var decay_time = STAR_DECAY_TIME[wanted_level]
		if star_decay_timer >= decay_time:
			star_progress -= delta * 0.5
			if star_progress <= 0 and total_offense_weight > 0:
				total_offense_weight -= delta * 0.5
				if total_offense_weight <= 0:
					_lower_heat()

	# Check for star advancement
	if star_progress >= 1.0 and wanted_level < MAX_STARS:
		star_progress = 0.0
		_raise_heat()

	# Search mode: player broke line of sight
	if wanted_level > 0 and not _player_visible:
		is_searching = true
		search_timer += delta
		# After some time, player escapes
		if search_timer > 10.0 + wanted_level * 5.0:
			_player_escaped()
	else:
		is_searching = false
		search_timer = 0.0
		player_last_known = player_pos

	# Manage police unit count
	_manage_units()


func _check_visibility(pos: Vector3, speed: float, in_vehicle: bool) -> bool:
	# Simple visibility: cops can see you if you're moving fast or in open areas
	if speed > 15.0 and in_vehicle:
		return true
	if speed > 5.0:
		return true  # walking/running visible
	return false


func _raise_heat():
	wanted_level += 1
	star_progress = 0.0
	heat_changed.emit(wanted_level)
	star_earned.emit(wanted_level)

	# Spawn initial units for this level
	_ensure_unit_count()

	# Helicopter at 3 stars
	if wanted_level >= 3 and not helicopter_active:
		helicopter_active = true

	# Broadcast to all police units
	for unit in active_units:
		if unit.has_method("notify_heat_increase"):
			unit.notify_heat_increase(wanted_level)


func _lower_heat():
	var old_level = wanted_level
	wanted_level = max(0, wanted_level - 1)
	star_progress = 0.0
	star_decay_timer = 0.0

	if wanted_level != old_level:
		heat_changed.emit(wanted_level)
		star_lost.emit(old_level)

		# Helicopter leaves at 2 stars
		if wanted_level < 3 and helicopter_active:
			helicopter_active = false

		# Despawn excess units
		_trim_units()

		if wanted_level == 0:
			total_offense_weight = 0.0
			player_escaped.emit()
			# Despawn all units
			for unit in active_units:
				if is_instance_valid(unit):
					unit.queue_free()
			active_units.clear()


func _ensure_unit_count():
	var target = max_units_per_star[wanted_level]
	while active_units.size() < target:
		_spawn_police_unit()


func _trim_units():
	var target = max_units_per_star[wanted_level]
	while active_units.size() > target:
		var unit = active_units.pop_back()
		if is_instance_valid(unit):
			unit.queue_free()


func _manage_units():
	if not _scene_tree:
		return
	var target = max_units_per_star[wanted_level]
	
	# Clean up destroyed units
	active_units = active_units.filter(func(u): return is_instance_valid(u))

	# Spawn more if needed
	if wanted_level > 0 and active_units.size() < target:
		_spawn_police_unit()


func _spawn_police_unit():
	if not _scene_tree:
		return
	var police_scene = preload("res://scenes/police_car.tscn")
	if not police_scene:
		return
	var police = police_scene.instantiate()
	# Spawn at edge of district
	var angle = randf_range(0, TAU)
	var dist = randf_range(25, 35)
	var spawn_pos = _player_pos + Vector3(cos(angle) * dist, 0, sin(angle) * dist)
	spawn_pos.x = clamp(spawn_pos.x, -35, 35)
	spawn_pos.z = clamp(spawn_pos.z, -35, 35)
	police.position = spawn_pos
	
	var container = _scene_tree.get_current_scene().find_child("PoliceContainer", true, false)
	if container:
		container.add_child(police)
		active_units.append(police)


func _player_escaped():
	if wanted_level > 0:
		is_searching = false
		search_timer = 0.0
		wanted_level = 0
		total_offense_weight = 0.0
		heat_changed.emit(0)
		player_escaped.emit()
		# Despawn all
		for unit in active_units:
			if is_instance_valid(unit):
				unit.queue_free()
		active_units.clear()


## Called from outside when player does something heat-worthy.
func report_offense(weight: float):
	star_progress += weight * 0.3
	total_offense_weight += weight
	star_decay_timer = 0.0
	if wanted_level == 0 and total_offense_weight > 1.0:
		_raise_heat()


func get_active_unit_count() -> int:
	return active_units.size()


func reset():
	wanted_level = 0
	star_progress = 0.0
	star_decay_timer = 0.0
	is_searching = false
	helicopter_active = false
	for unit in active_units:
		if is_instance_valid(unit):
			unit.queue_free()
	active_units.clear()
	heat_changed.emit(0)
