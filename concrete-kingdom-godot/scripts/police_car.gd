extends CharacterBody3D

## Police car AI: patrol → chase → search.

enum AIState { PATROL, CHASE, SEARCH }

@export var patrol_speed: float = 3.0
@export var chase_speed: float = 10.0
@export var search_speed: float = 4.0
@export var detection_range: float = 15.0
@export var lose_range: float = 40.0
@export var chase_duration: float = 15.0
@export var search_duration: float = 8.0

var state: AIState = AIState.PATROL
var _patrol_target = Vector3.ZERO
var _state_timer = 0.0
var _rot_y = 0.0

@onready var _body_mesh = $Body
@onready var _light_bar = $Body/LightBar


func _ready():
	_rot_y = rotation.y
	_patrol_target = _random_patrol_target()
	add_to_group("police")
	_update_light_color(Color(0.13, 0.27, 0.67))


func _physics_process(delta):
	var player_pos = GameState.player_position
	var heat_level = GameState.heat
	var dist = global_position.distance_to(player_pos)

	var effective_range = detection_range - (3 - heat_level) * 5
	if heat_level > 0 and dist < effective_range:
		if state != AIState.CHASE:
			state = AIState.CHASE
			_state_timer = 0
			_update_light_color(Color.RED)
	elif state == AIState.CHASE:
		_state_timer += delta
		if _state_timer > chase_duration or dist > lose_range:
			state = AIState.SEARCH
			_state_timer = 0
			_update_light_color(Color.ORANGE)
	elif state == AIState.SEARCH:
		_state_timer += delta
		if _state_timer > search_duration:
			state = AIState.PATROL
			_patrol_target = _random_patrol_target()
			_update_light_color(Color(0.13, 0.27, 0.67))

	var target
	var speed

	match state:
		AIState.CHASE:
			target = player_pos
			speed = minf(14.0, chase_speed + heat_level * 3)
		AIState.SEARCH:
			var angle = Time.get_ticks_usec() * 0.000001
			var search_radius = 5 + heat_level * 5
			target = Vector3(
				player_pos.x + cos(angle * 0.5) * search_radius,
				0,
				player_pos.z + sin(angle * 0.5) * search_radius
			)
			speed = search_speed
		_: # PATROL
			target = _patrol_target
			speed = patrol_speed
			if global_position.distance_to(_patrol_target) < 3:
				_patrol_target = _random_patrol_target()

	var dir = (target - global_position).normalized()
	var target_rot = atan2(dir.x, dir.z)
	var diff = angle_difference(target_rot, _rot_y)
	_rot_y += diff * 4 * delta

	var vel = Vector3(-sin(_rot_y) * speed, 0, -cos(_rot_y) * speed)
	velocity = vel
	move_and_slide()

	rotation = Vector3(0, _rot_y, 0)


func _random_patrol_target():
	return Vector3(randf_range(-35, 35), 0, randf_range(-35, 35))


func _update_light_color(color):
	var mat = StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission = color
	_light_bar.material_override = mat
