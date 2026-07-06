extends Node3D

## Main game controller — day/night cycle, heat system, police spawning.

@export var sun: DirectionalLight3D

const DAY_SKY = Color(0.1, 0.1, 0.18)
const NIGHT_SKY = Color(0.04, 0.04, 0.08)

var _player = null
var _police_container = null


func _ready():
	_player = $Player
	_police_container = $PoliceContainer

	var police_scene = preload("res://scenes/police_car.tscn")
	for i in range(2):
		var police = police_scene.instantiate()
		police.position = Vector3(randf_range(-15, 15), 0, randf_range(-15, 15))
		_police_container.add_child(police)


func _process(delta):
	GameState.day_cycle_timer += delta
	if GameState.day_cycle_timer > GameState.DAY_LENGTH:
		GameState.day_cycle_timer = 0
		GameState.is_night = not GameState.is_night

	var target_sky = NIGHT_SKY if GameState.is_night else DAY_SKY
	var env = get_viewport().world_3d.environment
	if env:
		env.background_color = env.background_color.lerp(target_sky, delta * 2)
	if sun:
		sun.light_energy = move_toward(sun.light_energy, 0.2 if GameState.is_night else 1.2, delta * 2)
		sun.rotation.x += delta * 0.1

	var passive_heat = GameState.owned_businesses * 0.25
	GameState.heat = maxi(GameState.heat, mini(3, int(passive_heat)))

	if not Input.is_action_pressed("interact"):
		GameState.heat = maxi(0, GameState.heat - 1)
