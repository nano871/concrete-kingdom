extends Node3D

## World builder: spawns the graybox district.

@onready var _business_scene := preload("res://scenes/business.tscn")


func _ready() -> void:
	_build_district()


func _build_district() -> void:
	# Ground plane
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(80, 80)
	var ground_mat := StandardMaterial3D.new()
	ground_mat.albedo_color = Color(0.16, 0.16, 0.16)
	ground_mat.roughness = 0.9
	ground.mesh = plane
	ground.material_override = ground_mat
	ground.rotation = Vector3(PI / 2, 0, 0)
	add_child(ground)

	# Buildings
	var building_data := [
		{"x": -12, "z": -8, "w": 8, "d": 10, "h": 12, "color": Color(0.29, 0.29, 0.35), "name": "Warehouse"},
		{"x": 10, "z": -10, "w": 7, "d": 8, "h": 15, "color": Color(0.23, 0.29, 0.42), "name": "Bar"},
		{"x": -8, "z": 12, "w": 9, "d": 9, "h": 10, "color": Color(0.35, 0.29, 0.23), "name": "Apartment"},
		{"x": 14, "z": 14, "w": 6, "d": 6, "h": 18, "color": Color(0.29, 0.23, 0.35), "name": "Office"},
	]

	for b in building_data:
		_create_building(b.x, b.z, b.w, b.d, b.h, b.color, b.name)

	# Lamp posts
	for i in range(-5, 6, 2):
		_spawn_lamp_post(Vector3(i * 3 - 15, 0, -18))
		_spawn_lamp_post(Vector3(i * 3 + 15, 0, 18))

	# Boundary walls
	var wall_mat := StandardMaterial3D.new()
	wall_mat.albedo_color = Color(0.13, 0.13, 0.2)
	wall_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wall_mat.alpha = 0.3

	for x_val in [-40, 40]:
		var wall := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.5, 6, 80)
		wall.mesh = box
		wall.material_override = wall_mat
		wall.position = Vector3(x_val, 3, 0)
		add_child(wall)

	for z_val in [-40, 40]:
		var wall := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(80, 6, 0.5)
		wall.mesh = box
		wall.material_override = wall_mat
		wall.position = Vector3(0, 3, z_val)
		add_child(wall)


func _create_building(x: float, z: float, w: float, d: float, h: float, color: Color, name: String) -> void:
	var building := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(w, h, d)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.7
	mat.metallic = 0.1
	building.mesh = box
	building.material_override = mat
	building.position = Vector3(x, h / 2, z)
	add_child(building)

	# Roof
	var roof := MeshInstance3D.new()
	var roof_box := BoxMesh.new()
	roof_box.size = Vector3(w * 0.9, 0.3, d * 0.9)
	var roof_mat := StandardMaterial3D.new()
	roof_mat.albedo_color = Color(0.2, 0.2, 0.27)
	roof_mat.roughness = 0.9
	roof.mesh = roof_box
	roof.material_override = roof_mat
	roof.position = Vector3(0, h / 2 + 0.15, 0)
	building.add_child(roof)

	# Business indicator — place at building entrance (Z+ face)
	var biz = _business_scene.instantiate()
	biz.position = Vector3(x, 0, z + d / 2 + 2)
	biz.call("set_business_name", name)
	add_child(biz)


func _spawn_lamp_post(pos: Vector3) -> void:
	# Pole
	var pole := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.bottom_radius = 0.12
	cyl.top_radius = 0.08
	cyl.height = 3.5
	var pole_mat := StandardMaterial3D.new()
	pole_mat.albedo_color = Color(0.33, 0.33, 0.33)
	pole_mat.roughness = 0.6
	pole_mat.metallic = 0.4
	pole.mesh = cyl
	pole.material_override = pole_mat
	pole.position = Vector3(pos.x, 1.75, pos.z)
	add_child(pole)

	# Light sphere
	var light_sphere := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.15
	sphere.height = 0.3
	var light_mat := StandardMaterial3D.new()
	light_mat.albedo_color = Color(1, 0.87, 0.53)
	light_mat.emission = Color(1, 0.87, 0.53)
	light_mat.emission_energy_multiplier = 0.3
	light_sphere.mesh = sphere
	light_sphere.material_override = light_mat
	light_sphere.position = Vector3(pos.x, 3.5, pos.z)
	add_child(light_sphere)

	# OmniLight
	var omni := OmniLight3D.new()
	omni.position = Vector3(pos.x, 3, pos.z)
	omni.light_color = Color(1, 0.87, 0.53)
	omni.light_energy = 0.5
	omni.omni_range = 10
	add_child(omni)
