import * as THREE from 'three';

const KEYS = {};
const MOUSE = { dx: 0, dy: 0, locked: false };
const STATE = {
  grounded: true,
  sprinting: false,
  speed: 0,
  health: 100,
  heat: 0,
  heatTimer: 0,
};

export { KEYS, MOUSE, STATE };

/**
 * Third-person player controller with physics-like feel.
 */
export class PlayerController {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Body (invisible collider capsule proxy)
    this.height = 1.8;
    this.radius = 0.4;
    this.pos = new THREE.Vector3(0, this.height, 20);

    // Visual avatar (simple humanoid from primitives)
    this.mesh = new THREE.Group();
    this.limbs = {};

    // Body (leather jacket)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), bodyMat);
    body.position.y = 0.35;
    body.castShadow = true;
    this.mesh.add(body);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdaa06a, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), headMat);
    head.position.y = 0.85;
    head.castShadow = true;
    this.mesh.add(head);

    // Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hairMat);
    hair.position.set(0, 0.95, -0.08);
    hair.scale.set(1, 0.4, 0.7);
    this.mesh.add(hair);

    // Left arm
    const armMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    this.limbs.lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 6), armMat);
    this.limbs.lArm.position.set(-0.4, 0.3, 0);
    this.limbs.lArm.rotation.order = 'ZYX';
    this.mesh.add(this.limbs.lArm);

    // Right arm
    this.limbs.rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 6), armMat);
    this.limbs.rArm.position.set(0.4, 0.3, 0);
    this.limbs.rArm.rotation.order = 'ZYX';
    this.mesh.add(this.limbs.rArm);

    // Pistol on right hand
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.6 });
    const slideMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.2 });
    this.gun = new THREE.Group();
    // Gun body
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.1), gunMat);
    gunBody.castShadow = true;
    this.gun.add(gunBody);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.06, 6), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.08);
    this.gun.add(barrel);
    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), gunMat);
    grip.position.set(0, -0.04, 0.02);
    this.gun.add(grip);
    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.07), slideMat);
    slide.position.set(0, 0.04, -0.02);
    this.gun.add(slide);

    this.gun.position.set(0.05, -0.05, 0.05);
    this.gun.rotation.x = -0.3;
    this.limbs.rArm.add(this.gun);

    // Legs (blue jeans)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.7 });
    this.limbs.lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.5, 6), legMat);
    this.limbs.lLeg.position.set(-0.15, -0.25, 0);
    this.mesh.add(this.limbs.lLeg);
    this.limbs.rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.5, 6), legMat);
    this.limbs.rLeg.position.set(0.15, -0.25, 0);
    this.mesh.add(this.limbs.rLeg);

    this.mesh.castShadow = true;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);

    // Shadow indicator
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.15,
    });
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 12),
      shadowMat
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    // Physics state
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.moveDir = new THREE.Vector3(0, 0, 0);
    this.cameraOffset = new THREE.Vector3(-5, 4, 5);
    this.cameraLookTarget = new THREE.Vector3(0, 1.5, 0);

    // Camera orbit
    this.theta = 0;
    this.phi = 0.6;
    this.distance = 7;
    this.lookHeight = 1.5;

    // Constants
    this.walkSpeed = 6;
    this.sprintSpeed = 12;
    this.jumpForce = 7;
    this.gravity = -22;
    this.acceleration = 15;
    this.friction = 0.88;

    // Animation
    this._animTime = 0;
    this._meshOffsetY = 1.25; // lower mesh so feet touch ground

    // Collision
    this.buildings = [];
    this.interiorTrigger = null;

    // Mouse
    this._setupControls();
  }

  _setupControls() {
    document.addEventListener('keydown', (e) => {
      KEYS[e.key.toLowerCase()] = true;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (MOUSE.locked) document.exitPointerLock();
        else document.body.requestPointerLock();
      }
    });
    document.addEventListener('keyup', (e) => {
      KEYS[e.key.toLowerCase()] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        MOUSE.dx += e.movementX;
        MOUSE.dy += e.movementY;
        MOUSE.locked = true;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      MOUSE.locked = !!document.pointerLockElement;
    });
  }

  setBuildings(buildings) {
    this.buildings = buildings;
  }

  update(dt) {
    if (dt > 0.1) dt = 0.1; // clamp on tab-switch

    // ── Camera orbit ──
    if (MOUSE.locked) {
      this.theta -= MOUSE.dx * 0.003;
      this.phi = Math.max(0.1, Math.min(1.3, this.phi + MOUSE.dy * 0.003));
      MOUSE.dx = 0;
      MOUSE.dy = 0;
    }

    // ── Input direction (relative to camera) ──
    const forward = new THREE.Vector3(
      -Math.sin(this.theta), 0, -Math.cos(this.theta)
    );
    const right = new THREE.Vector3(
      Math.cos(this.theta), 0, -Math.sin(this.theta)
    );

    this.moveDir.set(0, 0, 0);
    if (KEYS['w']) this.moveDir.add(forward);
    if (KEYS['s']) this.moveDir.sub(forward);
    if (KEYS['a']) this.moveDir.sub(right);
    if (KEYS['d']) this.moveDir.add(right);

    STATE.sprinting = KEYS['shift'] && STATE.grounded;
    const speed = STATE.sprinting ? this.sprintSpeed : this.walkSpeed;

    if (this.moveDir.length() > 0) {
      this.moveDir.normalize();
      // Acceleration towards target direction
      const targetVel = this.moveDir.clone().multiplyScalar(speed);
      this.velocity.x += (targetVel.x - this.velocity.x) * Math.min(1, this.acceleration * dt);
      this.velocity.z += (targetVel.z - this.velocity.z) * Math.min(1, this.acceleration * dt);
    } else {
      // Friction
      this.velocity.x *= this.friction;
      this.velocity.z *= this.friction;
    }

    STATE.speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);

    // ── Jump ──
    if (KEYS[' '] && STATE.grounded) {
      this.velocity.y = this.jumpForce;
      STATE.grounded = false;
    }

    // ── Gravity ──
    this.velocity.y += this.gravity * dt;

    // ── Move and collide ──
    const newPos = this.pos.clone();
    newPos.x += this.velocity.x * dt;
    newPos.y += this.velocity.y * dt;
    newPos.z += this.velocity.z * dt;

    // Ground check
    if (newPos.y <= this.height) {
      newPos.y = this.height;
      this.velocity.y = 0;
      STATE.grounded = true;
    }

    // Building collision (simple AABB from below)
    for (const b of this.buildings) {
      const bb = new THREE.Box3().setFromObject(b);
      const playerBB = new THREE.Box3(
        new THREE.Vector3(newPos.x - this.radius, newPos.y - this.height, newPos.z - this.radius),
        new THREE.Vector3(newPos.x + this.radius, newPos.y, newPos.z + this.radius)
      );
      if (playerBB.intersectsBox(bb)) {
        // Push out (simple axis-based push)
        const center = new THREE.Vector3();
        bb.getCenter(center);
        const dx = newPos.x - center.x;
        const dz = newPos.z - center.z;
        const halfW = (bb.max.x - bb.min.x) / 2 + this.radius;
        const halfD = (bb.max.z - bb.min.z) / 2 + this.radius;

        if (Math.abs(dx) * halfD > Math.abs(dz) * halfW) {
          newPos.x = center.x + Math.sign(dx) * halfW;
          this.velocity.x = 0;
        } else {
          newPos.z = center.z + Math.sign(dz) * halfD;
          this.velocity.z = 0;
        }
      }
    }

    // District bounds
    newPos.x = Math.max(-245, Math.min(245, newPos.x));
    newPos.z = Math.max(-245, Math.min(245, newPos.z));

    this.pos.copy(newPos);

    // ── Update mesh ──
    this.mesh.position.set(this.pos.x, this.pos.y - this._meshOffsetY, this.pos.z);
    // Face movement direction
    if (STATE.speed > 0.5) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    }

    // ── Update shadow ──
    this.shadow.position.set(this.pos.x, 0.05, this.pos.z);

    // ── Limb animation (run cycle) ──
    if (STATE.speed > 1 && this.limbs.lArm) {
      this._animTime += dt * STATE.speed * 1.5;
      const swing = Math.sin(this._animTime) * 0.5;
      this.limbs.lArm.rotation.x = swing;
      this.limbs.rArm.rotation.x = -swing;
      this.limbs.lLeg.rotation.x = -swing * 0.7;
      this.limbs.rLeg.rotation.x = swing * 0.7;
    } else if (this.limbs.lArm) {
      // Idle: limbs hang naturally
      this.limbs.lArm.rotation.x *= 0.9;
      this.limbs.rArm.rotation.x *= 0.9;
      this.limbs.lLeg.rotation.x *= 0.9;
      this.limbs.rLeg.rotation.x *= 0.9;
    }

    // ── Update camera ──
    const camPos = new THREE.Vector3(
      this.pos.x + this.distance * Math.sin(this.theta) * Math.cos(this.phi),
      this.pos.y + this.distance * Math.sin(this.phi),
      this.pos.z + this.distance * Math.cos(this.theta) * Math.cos(this.phi)
    );
    this.camera.position.lerp(camPos, Math.min(1, 12 * dt));
    this.camera.lookAt(
      this.pos.x,
      this.pos.y + this.lookHeight,
      this.pos.z
    );

    // ── Update HUD ──
    document.getElementById('pos').textContent =
      `${this.pos.x.toFixed(1)}, ${(this.pos.y - this.height).toFixed(1)}, ${this.pos.z.toFixed(1)}`;
    document.getElementById('status').textContent =
      `SPD: ${STATE.speed.toFixed(1)} | HT: ${STATE.health} | HEAT: ${STATE.heat}`;

    return this.pos;
  }

  /**
   * Simple vault: move up and forward quickly.
   */
  vault() {
    if (!STATE.grounded) return;
    const dir = new THREE.Vector3(
      -Math.sin(this.theta), 0, -Math.cos(this.theta)
    );
    this.velocity.y = 5;
    this.velocity.x += dir.x * 4;
    this.velocity.z += dir.z * 4;
    STATE.grounded = false;
  }
}
