extends CharacterBody3D

## Arcade-style player vehicle with enter/exit and drift.

@export var max_speed: float = 28.0
@export var acceleration: float = 18.0
@export var braking: float = 30.0
@export var friction: float = 0.97
@export var max_steer: float = 0.6
@export var steer_speed: float = 2.5
@export var steer_return: float = 4.0
@export var drift_factor: float = 0.92
@export var grip_threshold: float = 10.0

@onready var camera_mount = $CameraMount
@onready var body_mesh = $Body

var occupied: bool = false
var _speed = 0.0
var _steer_angle = 0.0
var _rot_y = 0.0


func _ready():
	_rot_y = rotation.y
	add_to_group("vehicles")


func _physics_process(delta):
	if not occupied:
		return

	var forward_input = Input.get_axis("move_back", "move_forward")
	var steer_input = Input.get_axis("move_right", "move_left")
	var braking_input = Input.is_action_pressed("brake")

	if forward_input > 0:
		_speed += acceleration * delta
	elif forward_input < 0 and _speed > 0:
		_speed -= braking * delta
	elif forward_input < 0 and _speed <= 0:
		_speed -= acceleration * 0.5 * delta
	elif braking_input:
		_speed *= 0.92
	else:
		_speed *= friction

	_speed = clamp(_speed, -10.0, max_speed)

	if abs(steer_input) > 0.01:
		_steer_angle = move_toward(_steer_angle, -steer_input * max_steer, steer_speed * delta)
	else:
		_steer_angle = move_toward(_steer_angle, 0, steer_return * delta)

	var speed_ratio = abs(_speed) / max_speed
	var steer_effect = minf(1.0, speed_ratio * 1.5 + 0.2)

	_rot_y += _steer_angle * steer_effect * abs(_speed) * 0.04 * delta

	var drift_amount = (1.0 - drift_factor) * speed_ratio * 0.5 if abs(_speed) > grip_threshold else 0.0

	var forward = Vector3(-sin(_rot_y), 0, -cos(_rot_y))
	var right = Vector3(cos(_rot_y), 0, -sin(_rot_y))

	var vel = forward * _speed

	if drift_amount > 0 and abs(_steer_angle) > 0.05:
		vel += right * (-_steer_angle * drift_amount * _speed * 0.3)

	velocity = Vector3(vel.x, 0, vel.z)
	move_and_slide()

	rotation = Vector3(0, _rot_y, 0)

	var lean = -_steer_angle * speed_ratio * 0.08
	body_mesh.rotation = Vector3(0, 0, lean)


func enter():
	occupied = true


func exit():
	occupied = false
	_speed = 0


func get_speed():
	return abs(_speed)
