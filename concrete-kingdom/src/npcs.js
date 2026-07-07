import * as THREE from 'three';

/**
 * Ambient pedestrian system with RDR2-style NPC reactivity.
 */
export class PedestrianSystem {
  constructor(scene, buildings) {
    this.scene = scene;
    this.buildings = buildings;
    this.pedestrians = [];
    this.maxPeds = 20; // increased from 15
    this.isNight = false;

    // District spawn weights (commercial gets more peds)
    this.districtWeights = {
      commercial: 1.5, entertainment: 1.8, residential: 1.0,
      industrial: 0.5, mixed: 1.0,
    };

    this.waypoints = [
      new THREE.Vector3(-7, 0, -7), new THREE.Vector3(7, 0, -7),
      new THREE.Vector3(-7, 0, 7), new THREE.Vector3(7, 0, 7),
      new THREE.Vector3(-7, 0, -14), new THREE.Vector3(7, 0, -14),
      new THREE.Vector3(-7, 0, 14), new THREE.Vector3(7, 0, 14),
      new THREE.Vector3(-14, 0, -7), new THREE.Vector3(-14, 0, 7),
      new THREE.Vector3(14, 0, -7), new THREE.Vector3(14, 0, 7),
    ];

    this.spawnTimer = 0;
    this._playerSpeed = 0;
    this._playerInVehicle = false;
    this._spawnInitial();
  }

  _spawnInitial() {
    for (let i = 0; i < 8; i++) this._spawnPedestrian();
  }

  _spawnPedestrian() {
    if (this.pedestrians.length >= this.maxPeds) return;
    const startIdx = Math.floor(Math.random() * this.waypoints.length);
    const start = this.waypoints[startIdx].clone();
    start.x += (Math.random() - 0.5) * 1;
    start.z += (Math.random() - 0.5) * 1;

    // District-based color palettes (Cyberpunk-style zone variety)
    const palettes = {
      commercial: [0x4488cc, 0x4466aa, 0x6688cc, 0x5588bb, 0x4477aa],
      entertainment: [0xff44aa, 0xff6644, 0xaa44ff, 0xff4488, 0x44ffaa],
      residential: [0x88aa88, 0x779977, 0x88bb88, 0x66aa66, 0x99bb99],
      industrial: [0x555555, 0x666666, 0x777777, 0x888888, 0x444444],
      mixed: [0x44aaff, 0xff6644, 0x44ff66, 0xff44aa, 0xaa44ff],
    };
    const district = this._currentDistrict || 'mixed';
    const palette = palettes[district] || palettes.mixed;
    const color = palette[Math.floor(Math.random() * palette.length)];

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.2), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xdaa06a, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), headMat);
    head.position.y = 0.9;
    group.add(head);

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

    let targetIdx = Math.floor(Math.random() * this.waypoints.length);
    if (targetIdx === startIdx) targetIdx = (targetIdx + 1) % this.waypoints.length;
    const target = this.waypoints[targetIdx].clone();
    target.x += (Math.random() - 0.5) * 1;
    target.z += (Math.random() - 0.5) * 1;

    this.pedestrians.push({
      mesh: group, start, target,
      speed: 0.8 + Math.random() * 0.6,
      progress: Math.random(),
      rotY: Math.atan2(target.x - start.x, target.z - start.z),
      animTime: Math.random() * 10,
      state: 'wander',
      alertTimer: 0,
      fleeTarget: null,
      fleeDir: null,
    });
  }

  update(dt, playerPos) {
    this.spawnTimer += dt;
    if (this.spawnTimer > 3 && this.pedestrians.length < this.maxPeds) {
      this.spawnTimer = 0;
      const nearWaypoint = this.waypoints.some(wp => wp.distanceTo(playerPos) < 30);
      if (nearWaypoint) this._spawnPedestrian();
    }

    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const ped = this.pedestrians[i];
      const distToPlayer = ped.mesh.position.distanceTo(playerPos);
      ped.animTime += dt;

      // ── React to player (RDR2-style) ──
      if (distToPlayer < 8 && this._playerSpeed > 5) {
        // Player moving fast nearby — flee
        ped.state = 'flee';
        const away = new THREE.Vector3().subVectors(ped.mesh.position, playerPos).normalize();
        ped.fleeTarget = ped.mesh.position.clone().add(away.multiplyScalar(5 + Math.random() * 5));
        ped.speed = 2 + Math.random();
      } else if (distToPlayer < 3 && this._playerSpeed <= 5) {
        ped.state = 'alert';
        ped.alertTimer = 1.0;
        // Face the player
        const lookDir = new THREE.Vector3().subVectors(playerPos, ped.mesh.position);
        ped.rotY = Math.atan2(lookDir.x, lookDir.z);
        ped.mesh.rotation.y = ped.rotY;
      } else if (ped.state === 'alert') {
        ped.alertTimer -= dt;
        if (ped.alertTimer <= 0) ped.state = 'wander';
      } else if (ped.state === 'flee') {
        if (distToPlayer > 20) { ped.state = 'wander'; continue; }
        const dir = new THREE.Vector3().subVectors(ped.fleeTarget, ped.mesh.position);
        dir.y = 0;
        if (dir.length() < 0.5) { ped.state = 'wander'; continue; }
        dir.normalize();
        ped.mesh.position.x += dir.x * ped.speed * dt;
        ped.mesh.position.z += dir.z * ped.speed * dt;
        ped.rotY = Math.atan2(dir.x, dir.z);
        ped.mesh.rotation.y = ped.rotY;
        continue;
      }

      // ── Normal wander behavior ──
      if (ped.state === 'wander') {
        const dir = new THREE.Vector3().subVectors(ped.target, ped.mesh.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist < 0.3) {
          if (Math.random() < 0.3 || this.pedestrians.length > this.maxPeds) {
            this.scene.remove(ped.mesh);
            this.pedestrians.splice(i, 1);
            continue;
          }
          const tIdx = Math.floor(Math.random() * this.waypoints.length);
          ped.target.copy(this.waypoints[tIdx]);
          ped.target.x += (Math.random() - 0.5) * 1.5;
          ped.target.z += (Math.random() - 0.5) * 1.5;
        }
        const moveDir = dir.clone().normalize();
        const speed = ped.speed * dt;
        ped.mesh.position.x += moveDir.x * speed;
        ped.mesh.position.z += moveDir.z * speed;
        ped.rotY = Math.atan2(moveDir.x, moveDir.z);
        ped.mesh.rotation.y = ped.rotY;
      }

      // Walk animation
      const legSwing = Math.sin(ped.animTime * 5) * 0.3;
      if (ped.mesh.children[1]) ped.mesh.children[1].rotation.x = legSwing;
      if (ped.mesh.children[2]) ped.mesh.children[2].rotation.x = -legSwing;

      if (ped.mesh.position.distanceTo(playerPos) > 50) {
        this.scene.remove(ped.mesh);
        this.pedestrians.splice(i, 1);
      }
    }
  }
}
