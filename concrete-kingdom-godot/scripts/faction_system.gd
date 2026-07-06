extends Node

## Faction system — 3 factions with reputation tracking.
## Each faction has an opinion of the player based on actions.

signal reputation_changed(faction: String, old_value: int, new_value: int)
signal faction_hostile(faction: String)

const FACTIONS = ["mafia", "syndicate", "police"]
const MAX_REP = 100
const MIN_REP = -100
const HOSTILE_THRESHOLD = -50

var _reputation: Dictionary = {}  # faction -> int
var _hostile: Dictionary = {}     # faction -> bool

# Track per-business ownership for faction claims
var _faction_businesses: Dictionary = {}  # faction -> [business_ids]


func _ready():
	for f in FACTIONS:
		_reputation[f] = 0
		_hostile[f] = false
		_faction_businesses[f] = []


## Modify reputation with a faction. Returns new value.
func modify_reputation(faction: String, amount: int) -> int:
	if faction not in _reputation:
		return 0

	var old = _reputation[faction]
	_reputation[faction] = clamp(_reputation[faction] + amount, MIN_REP, MAX_REP)
	var new_val = _reputation[faction]

	reputation_changed.emit(faction, old, new_val)

	# Check hostility threshold
	if new_val <= HOSTILE_THRESHOLD and not _hostile[faction]:
		_hostile[faction] = true
		faction_hostile.emit(faction)
	elif new_val > HOSTILE_THRESHOLD and _hostile[faction]:
		_hostile[faction] = false

	return new_val


func get_reputation(faction: String) -> int:
	return _reputation.get(faction, 0)


func is_hostile(faction: String) -> bool:
	return _hostile.get(faction, false)


## Register that a faction "owns" a business.
func register_business_ownership(faction: String, business_id: String):
	if faction not in _faction_businesses:
		return
	_faction_businesses[faction].append(business_id)


## Unregister (player took it over).
func unregister_business_ownership(faction: String, business_id: String):
	if faction not in _faction_businesses:
		return
	_faction_businesses[faction].erase(business_id)


func get_faction_businesses(faction: String) -> Array:
	return _faction_businesses.get(faction, [])


## Get which faction is most hostile right now (for mission/director use).
func get_most_hostile_faction() -> String:
	var worst = ""
	var worst_val = 0
	for f in FACTIONS:
		if _reputation[f] < worst_val:
			worst_val = _reputation[f]
			worst = f
	return worst


## Get which faction likes the player most.
func get_most_friendly_faction() -> String:
	var best = ""
	var best_val = -100
	for f in FACTIONS:
		if _reputation[f] > best_val and _reputation[f] > 0:
			best_val = _reputation[f]
			best = f
	return best


## Get reputation description for HUD.
func get_rep_label(faction: String) -> String:
	var v = _reputation.get(faction, 0)
	if v <= -75: return "Wanted"
	elif v <= -50: return "Hostile"
	elif v <= -25: return "Suspicious"
	elif v < 25: return "Neutral"
	elif v < 50: return "Friendly"
	elif v < 75: return "Trusted"
	else: return "Allied"
