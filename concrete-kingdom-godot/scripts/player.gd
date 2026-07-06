extends CharacterBody3D

## Third-person player controller.

@export var walk_speed: float = 6.0
@export var sprint_speed: float = 12.0
@export var jump_velocity: float = 7.0
@export var acceleration: float = 15.0
@export var friction: float = 0.88
@export var mouse_sensitivity: float = 0.003

@onready var camera_pivot = $CameraPivot
@onready var camera = $CameraPivot/Camera3D

var _target_velocity = Vector3.ZERO
var _pitch = 0.0
var _yaw = 0.0
var _mouse_captured = false
var _nearby_business = null
var _in_vehicle = false
var _current_vehicle = null


func _ready():
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_mouse_captured = true


func _input(event):
	if event is InputEventMouseMotion and _mouse_captured:
		_yaw -= event.relative.x * mouse_sensitivity
		_pitch -= event.relative.y * mouse_sensitivity
		_pitch = clamp(_pitch, -0.5, 1.0)

	if event.is_action_pressed("ui_cancel"):
		if _mouse_captured:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			_mouse_captured = false
		else:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			_mouse_captured = true

	if event.is_action_pressed("interact"):
		if not _in_vehicle:
			if _nearby_business != null:
				var result = _nearby_business.takeover()
				if result == 1:  # CAPTURED
					GameState.heat = mini(3, GameState.heat + 1)
					GameState.owned_businesses += 1

			var vehicle = _find_nearby_vehicle()
			if vehicle != null:
				_enter_vehicle(vehicle)
		else:
			_exit_vehicle()

	if event.is_action_pressed("vault") and not _in_vehicle:
		_vault()


func _physics_process(delta):
	if _in_vehicle:
		return

	camera_pivot.rotation = Vector3(_pitch, _yaw, 0)

	var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()

	var sprinting = Input.is_action_pressed("sprint") and is_on_floor()
	var speed = sprint_speed if sprinting else walk_speed

	if dir.length() > 0:
		_target_velocity = dir * speed
	else:
		_target_velocity = Vector3.ZERO

	var vel = velocity
	vel.x = move_toward(vel.x, _target_velocity.x, acceleration * delta)
	vel.z = move_toward(vel.z, _target_velocity.z, acceleration * delta)

	if Input.is_action_just_pressed("jump") and is_on_floor():
		vel.y = jump_velocity

	vel.y += get_gravity().y * delta

	velocity = vel
	move_and_slide()

	GameState.player_position = global_position
	_nearby_business = _find_nearby_business()


func _find_nearby_business():
	var businesses = get_tree().get_nodes_in_group("businesses")
	for biz in businesses:
		if biz.has_method("takeover"):
			if global_position.distance_to(biz.global_position) < 4.0:
				return biz
	return null


func _find_nearby_vehicle():
	var vehicles = get_tree().get_nodes_in_group("vehicles")
	for veh in vehicles:
		if veh.has_method("enter") and not veh.occupied:
			if global_position.distance_to(veh.global_position) < 3.0:
				return veh
	return null


func _enter_vehicle(vehicle):
	_in_vehicle = true
	_current_vehicle = vehicle
	vehicle.enter()
	visible = false
	camera_pivot.reparent(vehicle.camera_mount)
	camera_pivot.position = Vector3.ZERO


func _exit_vehicle():
	if _current_vehicle == null:
		return
	_in_vehicle = false
	var exit_pos = _current_vehicle.global_position + _current_vehicle.transform.basis.x * 2
	global_position = exit_pos
	visible = true
	_current_vehicle.exit()
	_current_vehicle = null
	camera_pivot.reparent(self)
	camera_pivot.position = Vector3.ZERO


func _vault():
	if not is_on_floor():
		return
	var forward = -transform.basis.z
	velocity = Vector3(forward.x * 4, 5, forward.z * 4)


func is_in_vehicle():
	return _in_vehicle
