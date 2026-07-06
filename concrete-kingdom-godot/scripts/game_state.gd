extends Node

# Global game state — Autoload singleton

var heat: int = 0
var health: int = 100
var owned_businesses: int = 0
var total_income: int = 0
var is_night: bool = false
var day_cycle_timer: float = 0.0
const DAY_LENGTH: float = 120.0

var player_position: Vector3 = Vector3.ZERO
