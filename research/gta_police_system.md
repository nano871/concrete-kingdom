# GTA V Police / Wanted System — Technical Breakdown

## Overview

GTA V's 5-star wanted system uses a "heat" mechanic managed by an invisible **AI Director** that scales police aggression and spawn rates based on the player's current wanted level. The system is designed to create cinematic chases while preventing unfair spawn-camping.

## Star Levels & Spawn Mechanics

| Stars | Response | Max Active Cops | Special Units |
|-------|----------|-----------------|---------------|
| 1★ | 1 patrol car, 2 officers | 3 units | None |
| 2★ | 2 cars, light chase | 5 units | None |
| 3★ | Heavy pursuit, roadblocks | 8 units | Police helicopters, roadblock spike strips |
| 4★ | Full tactical response | 12 units | NOOSE/SWAT vans, more helis |
| 5★ | Maximum force | ~15+ units | Military (no tanks in V), constant heli coverage |

### Spawn Rules
- Police spawn **off-screen only** — never within ~200m of the player's camera. The engine uses a "spawn budget" that prioritizes cops that can reach the player fastest.
- **Spawn cap** prevents more than ~15 aggressive units on screen at once. Beyond that, the director queues replacements when existing cops are destroyed or outrun.
- The director uses **region-aware spawning**: rural areas get slower response times and fewer units than Los Santos.

## AI Director Logic

The director evaluates three factors to decide intensity:
1. **Time since last crime committed** — heat decays as a hidden "investigation" timer.
2. **Line-of-sight state** — if cops lose visual contact, a search phase begins with a shrinking search radius.
3. **Player velocity/vehicle** — helicopters prioritize fast vehicles; roadblocks are placed ahead of the player's direction of travel.

### How Cops Lose Interest
- **Break line-of-sight + stay hidden** for ~10 seconds → cops enter "searching" mode.
- **Stay out of LOS for ~30-40 seconds** → investigation ends, stars flash and clear.
- **Chop shop repaint** (Los Santos Customs) instantly clears wanted level once the player is out of LOS.
- **Underground/subway tunnels** break helicopter tracking.

## Helicopter Behavior
- Helis at 3★+ use spotlight tracking — **stay in the light = cops always know your position**.
- The AI chopper maintains ~50-80m altitude and leads your predicted path. It calls in roadblocks ahead.
- Helis have a "battery" timer — they periodically retreat to refuel, buying the player a window.

## Roadblocks (3★+)
- 3★: Single police car blocking road, one officer deploying spike strips.
- 4★: 2-3 cars forming a V-barrier, NOOSE van blocking alternate escape routes.
- 5★: Multi-layer roadblocks with military presence.

**Source references:**
- Wikipedia — GTA V gameplay descriptions (wanted meter, star level behavior)
- Rockstar Games Newswire — game design commentary
- GTAForums community data-mining of spawn tables and AI behavior flags
- Kotaku — "The Mystery of GTA V's Six-Star Wanted Level" (Patricia Hernandez, 2015)
