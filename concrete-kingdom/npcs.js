import * as THREE from 'three';

/**
 * Ambient pedestrian system.
 * Spawns walkers on sidewalks that move along simple paths.
 */
export class PedestrianSystem {
  constructor(scene, buildings) {
    this.scene = scene;
    this.buildings = buildings;
    this.pedestrians = [];
    this.maxPeds = 15;

    // Sidewalk waypoints (corners of the intersection)
    this.waypoints = [
      new THREE.Vector3(-7, 0, -7), new THREE.Vector3(7, 0, -7),
      new THREE.Vector3(-7, 0, 7), new THREE.Vector3(7, 0, 7),
      new THREE.Vector3(-7, 0, -14), new THREE.Vector3(7, 0, -14),
      new THREE.Vector3(-7, 0, 14), new THREE.Vector3(7, 0, 14),
      new THREE.Vector3(-14, 0, -7), new THREE.Vector3(-14, 0, 7),
      new THREE.Vector3(14, 0, -7), new THREE.Vector3(14, 0, 7),
    ];

    this.spawnTimer = 0;
    this._spawnInitial();
  }

  _spawnInitial() {
    for (let i = 0; i < 8; i++) {
      this._spawnPedestrian();
    }
  }

  _spawnPedestrian() {
    if (this.pedestrians.length >= this.maxPeds) return;

    const startIdx = Math.floor(Math.random() * this.waypoints.length);
    const start = this.waypoints[startIdx].clone();
    start.x += (Math.random() - 0.5) * 1;
    start.z += (Math.random() - 0.5) * 1;

    // Random color for clothing
    const colors = [0x44aaff, 0xff6644, 0x44ff66, 0xff44aa, 0xffff44, 0xaa44ff, 0x44ffaa, 0xff8844];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Simple humanoid (box body + sphere head)
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.2), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xdaa06a, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), headMat);
    head.position.y = 0.9;
    group.add(head);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.7 });
    const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 4), legMat);
    lLeg.position.set(-0.08, 0.15, 0);
    group.add(lLeg);
    const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 4), legMat);
    rLeg.position.set(0.08, 0.15, 0);
    group.add(rLeg);

    group.position.copy(start);
    group.position.y = 0;
    this.scene.add(group);

    // Pick a random nearby waypoint as target
    let targetIdx = Math.floor(Math.random() * this.waypoints.length);
    if (targetIdx === startIdx) targetIdx = (targetIdx + 1) % this.waypoints.length;
    const target = this.waypoints[targetIdx].clone();
    target.x += (Math.random() - 0.5) * 1;
    target.z += (Math.random() - 0.5) * 1;

    this.pedestrians.push({
      mesh: group,
      start: start,
      target: target,
      speed: 0.8 + Math.random() * 0.6,
      progress: Math.random(), // start at random point along path
      rotY: Math.atan2(target.x - start.x, target.z - start.z),
      animTime: Math.random() * 10,
    });
  }

  update(dt, playerPos) {
    // Spawn new pedestrians periodically
    this.spawnTimer += dt;
    if (this.spawnTimer > 3 && this.pedestrians.length < this.maxPeds) {
      this.spawnTimer = 0;
      // Only spawn if player is nearby (within 30 units of a waypoint)
      const nearWaypoint = this.waypoints.some(wp => wp.distanceTo(playerPos) < 30);
      if (nearWaypoint) this._spawnPedestrian();
    }

    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const ped = this.pedestrians[i];
      ped.animTime += dt;

      // Move toward target
      const dir = new THREE.Vector3().subVectors(ped.target, ped.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 0.3) {
        // Reached target, pick a new one or despawn
        if (Math.random() < 0.3 || this.pedestrians.length > this.maxPeds) {
          this.scene.remove(ped.mesh);
          this.pedestrians.splice(i, 1);
          continue;
        }
        // Pick new target
        const waypoints = this.waypoints;
        const tIdx = Math.floor(Math.random() * waypoints.length);
        ped.target.copy(waypoints[tIdx]);
        ped.target.x += (Math.random() - 0.5) * 1.5;
        ped.target.z += (Math.random() - 0.5) * 1.5;
      }

      // Move
      const moveDir = dir.clone().normalize();
      const speed = ped.speed * dt;
      ped.mesh.position.x += moveDir.x * speed;
      ped.mesh.position.z += moveDir.z * speed;

      // Face movement direction
      ped.rotY = Math.atan2(moveDir.x, moveDir.z);
      ped.mesh.rotation.y = ped.rotY;

      // Simple walk animation (leg bob)
      const legSwing = Math.sin(ped.animTime * 5) * 0.3;
      ped.mesh.children[1].rotation.x = legSwing; // left leg
      ped.mesh.children[2].rotation.x = -legSwing; // right leg

      // Despawn if too far from player
      if (ped.mesh.position.distanceTo(playerPos) > 50) {
        this.scene.remove(ped.mesh);
        this.pedestrians.splice(i, 1);
      }
    }
  }
}
