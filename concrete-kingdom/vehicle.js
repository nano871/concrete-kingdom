import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Player vehicle with arcade handling.
 * Designed to feel fun, not realistic.
 */
export class Vehicle {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.wheels = [];

    // Physics state
    this.pos = new THREE.Vector3(8, 0.3, 18);  // spawn location
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotY = Math.PI; // facing negative Z initially
    this.steerAngle = 0;
    this.speed = 0;

    // Handling parameters — tuned for GTA-style arcade feel
    this.maxSpeed = 28;
    this.acceleration = 18;
    this.braking = 30;
    this.friction = 0.97;
    this.maxSteer = 0.8;      // wider turns
    this.steerSpeed = 5.0;    // faster response
    this.steerReturn = 5.0;   // snap back faster
    this.driftFactor = 0.95;  // more grip, less slide
    this.gripThreshold = 8;   // drift starts earlier

    // State
    this.occupied = false;
    this.playerRef = null;  // ref to the player mesh
    this.buildings = [];    // building meshes for collision
    this.modelLoaded = false;

    this._buildFallbackMesh(); // placeholder until GLTF loads
    this._loadModel();         // async GLTF load
  }

  _loadModel() {
    const loader = new GLTFLoader();
    loader.load('/models/porsche.gltf', (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.5, 0.5, 0.5); // adjust to game scale
      model.position.y = 0.3;
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Remove placeholder, add model
      this.scene.remove(this.mesh);
      this.mesh = model;
      this.modelLoaded = true;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.rotY;
      this.scene.add(this.mesh);
    }, undefined, (err) => {
      console.warn('Porsche model failed to load, using placeholder:', err);
    });
  }

  _buildFallbackMesh() {
    const group = new THREE.Group();

    // Main body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222, roughness: 0.3, metalness: 0.7,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 3.8), bodyMat);
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);

    // Cabin
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x222233, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.7,
    });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.8), cabinMat);
    cabin.position.set(0, 0.7, -0.3);
    group.add(cabin);

    // Bumpers
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x333333, roughness: 0.8,
    });
    for (const z of [-1.9, 1.9]) {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.15), bumperMat);
      bumper.position.set(0, 0.12, z);
      group.add(bumper);
    }

    // Headlights
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.5,
    });
    for (const x of [-0.5, 0.5]) {
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), lightMat);
      hl.position.set(x, 0.2, 1.92);
      hl.rotation.y = 0;
      group.add(hl);
    }

    // Taillights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.3,
    });
    for (const x of [-0.5, 0.5]) {
      const tl = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), tailMat);
      tl.position.set(x, 0.2, -1.92);
      tl.rotation.y = Math.PI;
      group.add(tl);
    }

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.9,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x888888, metalness: 0.5, roughness: 0.3,
    });

    const wheelPositions = [
      [-0.7, -0.1, 1.2], [0.7, -0.1, 1.2],  // front
      [-0.7, -0.1, -1.2], [0.7, -0.1, -1.2], // rear
    ];

    for (const [wx, wy, wz] of wheelPositions) {
      const wheelGroup = new THREE.Group();

      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.3, 0.15, 8),
        wheelMat
      );
      tire.rotation.x = Math.PI / 2;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.2, 0.16, 6),
        rimMat
      );
      rim.rotation.x = Math.PI / 2;
      wheelGroup.add(rim);

      // Hub detail
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.17, 6),
        rimMat
      );
      hub.rotation.x = Math.PI / 2;
      wheelGroup.add(hub);

      wheelGroup.position.set(wx, wy + 0.3, wz);
      this.wheels.push(wheelGroup);
      group.add(wheelGroup);
    }

    // Spoiler
    const spoilerMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.6,
    });
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), spoilerMat);
    spoiler.position.set(0, 0.75, -1.8);
    group.add(spoiler);

    // Wing stands
    for (const x of [-0.5, 0.5]) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.25, 4),
        spoilerMat
      );
      stand.position.set(x, 0.6, -1.8);
      group.add(stand);
    }

    group.position.copy(this.pos);
    group.rotation.y = this.rotY;
    this.mesh = group;
    this.scene.add(group);
  }

  /**
   * Spawn the player's character mesh at vehicle position when exiting.
   */
  linkPlayer(playerMesh) {
    this.playerRef = playerMesh;
  }

  /** Pass building meshes for collision detection. */
  setBuildings(buildings) {
    this.buildings = buildings;
  }

  /**
   * Enter the vehicle: hide player mesh, attach camera to vehicle.
   */
  enter() {
    if (this.occupied) return false;
    this.occupied = true;
    if (this.playerRef) this.playerRef.visible = false;
    return true;
  }

  /**
   * Exit the vehicle: show player mesh beside vehicle.
   */
  exit() {
    if (!this.occupied) return false;
    this.occupied = false;
    if (this.playerRef) {
      this.playerRef.visible = true;
      // Place player beside vehicle
      const exitOffset = new THREE.Vector3(2, 0, 0);
      exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY);
      this.playerRef.position.copy(this.pos).add(exitOffset);
      this.playerRef.position.y = 1.8; // standing height
    }
    return true;
  }

  /**
   * Update vehicle physics and visual.
   * @param {Object} input - { forward: bool, backward: bool, left: bool, right: bool, brake: bool }
   * @param {number} dt - delta time
   */
  update(input, dt) {
    if (!this.occupied) return;
    if (dt > 0.1) dt = 0.1;

    // ── Acceleration / Braking ──
    if (input.forward) {
      this.speed += this.acceleration * dt;
    } else if (input.backward && this.speed > 0) {
      this.speed -= this.braking * dt;
    } else if (input.backward && this.speed <= 0) {
      this.speed -= this.acceleration * 0.5 * dt;
    } else {
      this.speed *= this.friction;
    }
    this.speed = Math.max(-10, Math.min(this.maxSpeed, this.speed));

    // ── Steering (completely redesigned) ──
    const absSpeed = Math.abs(this.speed);
    const speedRatio = absSpeed / this.maxSpeed;

    // Build steering angle from input
    if (input.left) {
      this.steerAngle = Math.max(-this.maxSteer, this.steerAngle - this.steerSpeed * dt);
    } else if (input.right) {
      this.steerAngle = Math.min(this.maxSteer, this.steerAngle + this.steerSpeed * dt);
    } else {
      // Snap back to center quickly
      this.steerAngle *= (1 - this.steerReturn * dt);
      if (Math.abs(this.steerAngle) < 0.01) this.steerAngle = 0;
    }

    // Turn rate: strong at low speed (donuts), progressive at high speed
    // Base turn rate is always present even at 0 speed (can spin in place)
    const lowSpeedFactor = Math.max(0.3, 1 - speedRatio * 0.5);
    const highSpeedFactor = speedRatio * 1.5;
    const turnFactor = lowSpeedFactor * 0.08 + highSpeedFactor * 0.015;

    const turnAmount = -this.steerAngle * Math.max(2, absSpeed) * turnFactor * dt * (this.speed >= 0 ? 1 : -1);
    this.rotY += turnAmount;

    // ── Drift (only at high speed with strong steering) ──
    const driftAmount = (absSpeed > this.gripThreshold)
      ? (1 - this.driftFactor) * speedRatio * Math.abs(this.steerAngle) * 2
      : 0;

    // ── Move ──
    const forward = new THREE.Vector3(-Math.sin(this.rotY), 0, -Math.cos(this.rotY));
    const moveSpeed = this.speed * dt;
    this.pos.x += forward.x * moveSpeed;
    this.pos.z += forward.z * moveSpeed;

    // Drift slide
    if (driftAmount > 0.01 && Math.abs(this.steerAngle) > 0.05) {
      const right = new THREE.Vector3(Math.cos(this.rotY), 0, -Math.sin(this.rotY));
      this.pos.add(right.clone().multiplyScalar(-this.steerAngle * driftAmount * absSpeed * dt * 0.15));
    }

    // Bounds
    this.pos.x = Math.max(-58, Math.min(58, this.pos.x));
    this.pos.z = Math.max(-58, Math.min(58, this.pos.z));

    // ── Building collision ──
    const carRadius = 1.0;
    for (const b of this.buildings) {
      const bb = new THREE.Box3().setFromObject(b);
      const carBB = new THREE.Box3(
        new THREE.Vector3(this.pos.x - carRadius, 0, this.pos.z - carRadius),
        new THREE.Vector3(this.pos.x + carRadius, 2, this.pos.z + carRadius)
      );
      if (carBB.intersectsBox(bb)) {
        const center = new THREE.Vector3();
        bb.getCenter(center);
        const dx = this.pos.x - center.x;
        const dz = this.pos.z - center.z;
        const halfW = (bb.max.x - bb.min.x) / 2 + carRadius;
        const halfD = (bb.max.z - bb.min.z) / 2 + carRadius;
        if (Math.abs(dx) * halfD > Math.abs(dz) * halfW) {
          this.pos.x = center.x + Math.sign(dx) * halfW;
          this.speed *= 0.3; // slow down on impact
        } else {
          this.pos.z = center.z + Math.sign(dz) * halfD;
          this.speed *= 0.3;
        }
      }
    }

    // ── Visual update ──
    // — World bounds (keep car inside the walls) —
    this.pos.x = Math.max(-57, Math.min(57, this.pos.x));
    this.pos.z = Math.max(-57, Math.min(57, this.pos.z));

    this.mesh.position.set(this.pos.x, 0.3, this.pos.z);
    this.mesh.rotation.y = this.rotY;

    // Body lean during turns (visual only)
    const leanAngle = -this.steerAngle * speedRatio * 0.08;
    this.mesh.rotation.z = leanAngle;

    // Wheel spin (visual)
    const wheelSpin = this.speed * dt * 8;
    for (const wheel of this.wheels) {
      wheel.children[0].rotation.z += wheelSpin;
      wheel.children[1].rotation.z += wheelSpin;
      wheel.children[2].rotation.z += wheelSpin;
    }

    // Front wheel steering visual
    // Front wheels are indices 0 (left) and 1 (right)
    for (let i = 0; i < 2; i++) {
      if (this.wheels[i]) {
        this.wheels[i].rotation.y = this.steerAngle * 0.5;
      }
    }

    // Speed-based camera effects: FOV pulse (handled in main.js via getSpeed)
    return this.speed;
  }

  getSpeed() {
    return Math.abs(this.speed);
  }

  getPosition() {
    return this.pos;
  }

  getRotation() {
    return this.rotY;
  }
}
