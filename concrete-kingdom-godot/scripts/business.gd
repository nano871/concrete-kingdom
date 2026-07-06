extends Area3D

## Capturable business in the world.

enum OwnerState { NEUTRAL, PLAYER_OWNED, FACTION_OWNED }
enum TakeoverResult { PROGRESS, CAPTURED, ALREADY_OWNED, NONE }

var business_name: String = "Property"
var income: int = 10
var owner_state: OwnerState = OwnerState.NEUTRAL

var capture_progress = 0.0
var player_nearby = false

var _ring_mat = null
var _ring_mesh = null
var _label_mat = null
var _label_mesh = null


func _ready():
	add_to_group("businesses")

	_ring_mat = StandardMaterial3D.new()
	_ring_mat.albedo_color = Color(0.53, 0.53, 0.53)
	_ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_ring_mat.alpha = 0.2

	_ring_mesh = MeshInstance3D.new()
	var torus = TorusMesh.new()
	torus.inner_radius = 1.2
	torus.outer_radius = 1.5
	torus.rings = 12
	torus.ring_segments = 24
	_ring_mesh.mesh = torus
	_ring_mesh.material_override = _ring_mat
	_ring_mesh.rotation = Vector3(PI / 2, 0, 0)
	_ring_mesh.position = Vector3(0, 0.05, 0)
	add_child(_ring_mesh)

	_label_mat = StandardMaterial3D.new()
	_label_mat.albedo_color = Color(1, 0.67, 0.27)
	_label_mat.emission = Color(1, 0.67, 0.27)
	_label_mat.emission_energy_multiplier = 0.2

	_label_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(0.1, 0.4, 0.1)
	_label_mesh.mesh = box
	_label_mesh.material_override = _label_mat
	_label_mesh.position = Vector3(0, 3, 0)
	add_child(_label_mesh)

	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func set_business_name(name: String):
	business_name = name


func takeover():
	if not player_nearby:
		return TakeoverResult.NONE
	if owner_state == OwnerState.PLAYER_OWNED:
		return TakeoverResult.ALREADY_OWNED

	capture_progress += 0.33

	if capture_progress >= 1.0:
		owner_state = OwnerState.PLAYER_OWNED
		capture_progress = 0
		_ring_mat.albedo_color = Color(0.27, 1, 0.27)
		_ring_mat.alpha = 0.6
		return TakeoverResult.CAPTURED

	return TakeoverResult.PROGRESS


func _on_body_entered(body):
	if body is CharacterBody3D and body.has_method("is_in_vehicle"):
		player_nearby = true
		_ring_mat.alpha = 0.6
		if owner_state == OwnerState.PLAYER_OWNED:
			_ring_mat.albedo_color = Color(0.27, 1, 0.27)
		else:
			_ring_mat.albedo_color = Color(1, 0.67, 0.27)


func _on_body_exited(body):
	if body is CharacterBody3D and body.has_method("is_in_vehicle"):
		player_nearby = false
		_ring_mat.alpha = 0.2
		if owner_state == OwnerState.PLAYER_OWNED:
			_ring_mat.albedo_color = Color(0.27, 0.67, 0.27)
		else:
			_ring_mat.albedo_color = Color(0.53, 0.53, 0.53)
