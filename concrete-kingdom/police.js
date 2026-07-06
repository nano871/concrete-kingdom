import * as THREE from 'three';

/**
 * Police AI: patrol → detect player → chase → escape/search.
 * Patrol follows road-based waypoints along the city's road grid.
 * Chases use road-aware movement. Vehicles avoid building positions.
 */

// Road grid: main roads at x=0 (N-S) and z=0 (E-W).
// Secondary roads at x=±24 and z=±24. Bounds: ±55.
const ROAD_WAYPOINTS = [
  // Clockwise loop around inner city block on secondary roads
  { x: -24, z: -24 },
  { x: 0, z: -24 },
  { x: 24, z: -24 },
  { x: 24, z: 0 },
  { x: 24, z: 24 },
  { x: 0, z: 24 },
  { x: -24, z: 24 },
  { x: -24, z: 0 },
  // Cross through center on main axes
  { x: 0, z: 0 },
  { x: -55, z: 0 },
  { x: 0, z: 55 },
  { x: 55, z: 0 },
  { x: 0, z: -55 },
];

// Building positions that police should steer around
const BUILDING_POSITIONS = [
  { x: -18, z: -14 },
  { x: 14, z: -14 },
  { x: -14, z: 16 },
  { x: 16, z: 16 },
  { x: -18, z: 18 },
  // Additional buildings along secondary roads
  { x: 24, z: -10 },
  { x: 24, z: 10 },
  { x: -24, z: -10 },
  { x: -24, z: 10 },
  { x: 10, z: 24 },
  { x: -10, z: 24 },
  { x: 10, z: -24 },
  { x: -10, z: -24 },
];

const BUILDING_AVOID_RADIUS = 3;
const WAYPOINT_ARRIVAL_DIST = 4;

export class PoliceController {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.playerPos = new THREE.Vector3(0, 0, 0);
    this.heatTarget = 0;

    // Spawn 2 patrol cars at different points on the waypoint route
    this._spawnCar(ROAD_WAYPOINTS[0].x, ROAD_WAYPOINTS[0].z, 0, 0);
    this._spawnCar(ROAD_WAYPOINTS[4].x, ROAD_WAYPOINTS[4].z, Math.PI / 2, 4);
  }

  _spawnCar(x, z, rotY, startWaypointIdx) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2244aa, roughness: 0.5, metalness: 0.6,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.5), bodyMat);
    body.castShadow = true;

    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.5,
    });
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.6), lightMat);
    light.position.y = 0.4;
    body.add(light);

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.9,
    });
    for (let side = -1; side <= 1; side += 2) {
      for (let fore = -1; fore <= 1; fore += 2) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.22, 0.1, 8),
          wheelMat
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 0.6, -0.2, fore * 0.8);
        body.add(wheel);
      }
    }

    body.position.set(x, 0.25, z);
    body.rotation.y = rotY;
    this.scene.add(body);

    const car = {
      mesh: body,
      pos: new THREE.Vector3(x, 0, z),
      velocity: new THREE.Vector3(0, 0, 0),
      speed: 4 + Math.random() * 2,
      state: 'patrol', // patrol | chase | search
      waypointIndex: startWaypointIdx,
      patrolTarget: new THREE.Vector3(
        ROAD_WAYPOINTS[startWaypointIdx].x,
        0,
        ROAD_WAYPOINTS[startWaypointIdx].z
      ),
      chaseTimer: 0,
      searchTimer: 0,
      rotY,
    };

    this.cars.push(car);
    return car;
  }

  setPlayerPos(pos) {
    this.playerPos.copy(pos);
  }

  setHeat(level) {
    this.heatTarget = Math.max(0, Math.min(3, level));
  }

  /**
   * Snap a position to the nearest road axis.
   * Determines which road (x=0, z=0, x=±24, z=±24) is closest
   * and returns a point on that road.
   */
  _snapToRoad(pos) {
    const { x, z } = pos;

    // Distance to each road axis
    const dists = [
      { key: 'x0', dist: Math.abs(x), get: () => new THREE.Vector3(0, 0, z) },
      { key: 'z0', dist: Math.abs(z), get: () => new THREE.Vector3(x, 0, 0) },
      { key: 'x24', dist: Math.abs(x - 24), get: () => new THREE.Vector3(24, 0, z) },
      { key: 'x-24', dist: Math.abs(x + 24), get: () => new THREE.Vector3(-24, 0, z) },
      { key: 'z24', dist: Math.abs(z - 24), get: () => new THREE.Vector3(x, 0, 24) },
      { key: 'z-24', dist: Math.abs(z + 24), get: () => new THREE.Vector3(x, 0, -24) },
    ];

    let best = dists[0];
    for (let i = 1; i < dists.length; i++) {
      if (dists[i].dist < best.dist) best = dists[i];
    }

    return best.get();
  }

  /**
   * Compute a chase target that uses road-based movement:
   * first move to the player's nearest road point, then close in.
   */
  _roadChaseTarget(playerPos, carPos) {
    const playerRoad = this._snapToRoad(playerPos);
    const distToPlayerRoad = carPos.distanceTo(playerRoad);
    const distToPlayer = carPos.distanceTo(playerPos);

    // If far from the player's road, head to that road first
    if (distToPlayerRoad > 8 && distToPlayerRoad > distToPlayer * 0.5) {
      return playerRoad;
    }
    // Otherwise go straight for the player
    return playerPos.clone();
  }

  /**
   * Adjust a target position to steer around nearby buildings.
   * Uses a perpendicular offset to go around the building rather than through it.
   */
  _avoidBuildings(fromPos, target) {
    let adjusted = target.clone();

    for (const bldg of BUILDING_POSITIONS) {
      const bPos = new THREE.Vector3(bldg.x, 0, bldg.z);
      const distToBldg = adjusted.distanceTo(bPos);

      if (distToBldg < BUILDING_AVOID_RADIUS + 1) {
        // Direction from building to adjusted target
        const away = new THREE.Vector3()
          .subVectors(adjusted, bPos)
          .setY(0)
          .normalize();

        // Direction from car's current position to target
        const approachDir = new THREE.Vector3()
          .subVectors(target, fromPos)
          .setY(0);
        const approachLen = approachDir.length();
        if (approachLen < 0.01) continue;
        approachDir.normalize();

        // Perpendicular to the approach direction
        const perp = new THREE.Vector3(-approachDir.z, 0, approachDir.x);
        // Choose the perpendicular that moves away from the building
        const dot = perp.dot(away);
        const steerDir = dot >= 0 ? perp : perp.clone().negate();

        // Offset the target perpendicular to the approach direction
        const pushDist = (BUILDING_AVOID_RADIUS + 1.5) - distToBldg;
        adjusted.add(steerDir.multiplyScalar(pushDist));
      }
    }

    // Clamp to world bounds
    adjusted.x = Math.max(-55, Math.min(55, adjusted.x));
    adjusted.z = Math.max(-55, Math.min(55, adjusted.z));
    return adjusted;
  }

  /** Get next waypoint in the patrol sequence (loops at end). */
  _nextWaypoint(idx) {
    const next = (idx + 1) % ROAD_WAYPOINTS.length;
    return {
      index: next,
      pos: new THREE.Vector3(ROAD_WAYPOINTS[next].x, 0, ROAD_WAYPOINTS[next].z),
    };
  }

  /** Find the closest waypoint index to a given position. */
  _findNearestWaypoint(pos) {
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < ROAD_WAYPOINTS.length; i++) {
      const wp = ROAD_WAYPOINTS[i];
      const dx = pos.x - wp.x;
      const dz = pos.z - wp.z;
      const d = dx * dx + dz * dz;
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }
    return {
      index: bestIdx,
      pos: new THREE.Vector3(ROAD_WAYPOINTS[bestIdx].x, 0, ROAD_WAYPOINTS[bestIdx].z),
    };
  }

  update(dt) {
    if (dt > 0.1) dt = 0.1;

    const activeHeat = this.heatTarget;
    // GTA V style: search radius shrinks over time (cops lose interest)
    const searchRadius = Math.max(8, (5 + activeHeat * 8) - this._searchShrink * 0.5);
    this._searchShrink += dt;

    for (const car of this.cars) {
      const dx = this.playerPos.x - car.pos.x;
      const dz = this.playerPos.z - car.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // ── State transitions ──
      if (activeHeat > 0 && dist < 15 + (3 - activeHeat) * 5) {
        if (car.state !== 'chase') {
          car.state = 'chase';
          car.chaseTimer = 0;
          car.speed = 6 + activeHeat * 2;
        }
      } else if (car.state === 'chase') {
        car.chaseTimer += dt;
        if (car.chaseTimer > 15 || dist > 40) {
          car.state = 'search';
          car.searchTimer = 0;
          car.speed = 4;
        }
      } else if (car.state === 'search') {
        car.searchTimer += dt;
        if (car.searchTimer > 8) {
          car.state = 'patrol';
          // Resume patrol from the nearest waypoint
          const nearest = this._findNearestWaypoint(car.pos);
          car.waypointIndex = nearest.index;
          car.patrolTarget.copy(nearest.pos);
        }
      }

      // ── Determine target (STRICT road-only movement) ──
      let target;
      if (car.state === 'chase') {
        // Chase: navigate toward player via road waypoints, never leave roads
        const nearestToPlayer = this._findNearestWaypoint(this.playerPos);
        const distToTarget = car.pos.distanceTo(car.patrolTarget);

        // If we've reached our current waypoint, advance toward player's waypoint
        if (distToTarget < WAYPOINT_ARRIVAL_DIST || car.state !== car._lastState) {
          car._chaseTargetIdx = nearestToPlayer.index;
          // Head toward the waypoint nearest the player
          const next = this._nextWaypoint(car.waypointIndex);
          car.waypointIndex = next.index;
          car.patrolTarget.copy(next.pos);
        }
        target = car.patrolTarget;
        car.speed = Math.min(14, 6 + activeHeat * 3);
      } else if (car.state === 'search') {
        // Circle the last known player area using road-snapped positions
        const angle = performance.now() * 0.001 + this.cars.indexOf(car);
        const circleTarget = new THREE.Vector3(
          this.playerPos.x + Math.cos(angle * 0.5) * searchRadius,
          0,
          this.playerPos.z + Math.sin(angle * 0.5) * searchRadius
        );
        target = this._snapToRoad(circleTarget);
        car.speed = 4;
      } else {
        // Patrol: follow waypoints in sequence
        const td = car.pos.distanceTo(car.patrolTarget);
        if (td < WAYPOINT_ARRIVAL_DIST) {
          const next = this._nextWaypoint(car.waypointIndex);
          car.waypointIndex = next.index;
          car.patrolTarget.copy(next.pos);
        }
        // Use the raw waypoint for arrival check, but the building-avoided
        // version for actual steering
        target = this._avoidBuildings(car.pos, car.patrolTarget);
        car.speed = 3;
      }

      // Apply building avoidance (chase/search targets too)
      if (car.state !== 'patrol') {
        target = this._avoidBuildings(car.pos, target);
      }

      // ── Steering ──
      const dir = new THREE.Vector3(
        target.x - car.pos.x,
        0,
        target.z - car.pos.z
      );

      if (dir.length() > 0.01) {
        dir.normalize();

        const targetRot = Math.atan2(dir.x, dir.z);
        let diff = targetRot - car.rotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.rotY += diff * 4 * dt;

        // Move forward
        car.velocity.set(
          Math.sin(car.rotY) * car.speed,
          0,
          Math.cos(car.rotY) * car.speed
        );
        car.pos.add(car.velocity.clone().multiplyScalar(dt));
      }

      // Bounds
      car.pos.x = Math.max(-55, Math.min(55, car.pos.x));
      car.pos.z = Math.max(-55, Math.min(55, car.pos.z));

      // Update mesh
      car.mesh.position.set(car.pos.x, 0.25, car.pos.z);
      car.mesh.rotation.y = car.rotY;

      // State indicator light
      const lightColor = car.state === 'chase' ? 0xff0000 :
                         car.state === 'search' ? 0xff8800 : 0x2244aa;
      car.mesh.children[0].material.color.setHex(lightColor);
      car.mesh.children[0].material.emissive.setHex(lightColor);
    }
  }
}
