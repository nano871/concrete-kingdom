import * as THREE from 'three';

/**
 * Combat system: aiming, shooting, cover detection.
 */
export class CombatSystem {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.aiming = false;
    this.shootCooldown = 0;
    this.ammo = 30;
    this.maxAmmo = 30;

    // Weapon visual (attached to camera)
    this.weapon = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), bodyMat);
    body.position.set(0.3, -0.25, -0.4);
    this.weapon.add(body);

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.06, 6), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.3, -0.25, -0.5);
    this.weapon.add(barrel);

    this.weapon.visible = false;
    camera.add(this.weapon);

    // Muzzle flash
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0 });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4), this.flashMat);
    this.flash.position.set(0.3, -0.25, -0.52);
    camera.add(this.flash);
  }

  update(dt, keys) {
    this.aiming = keys['mousedown'] === true || false;

    // Show/hide weapon
    this.weapon.visible = this.aiming;
    if (this.aiming) {
      // Slight weapon sway
      this.weapon.position.x = 0.3 + Math.sin(performance.now() * 0.003) * 0.005;
      this.weapon.position.y = -0.25 + Math.sin(performance.now() * 0.004) * 0.005;
    }

    // Shooting
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (keys[' '] && this.aiming && this.shootCooldown <= 0 && this.ammo > 0) {
      this.shoot();
    }

    // Flash decay
    this.flashMat.opacity *= 0.85;
  }

  shoot() {
    this.ammo--;
    this.shootCooldown = 0.15; // fire rate

    // Muzzle flash
    this.flashMat.opacity = 1;

    // Raycast from camera center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);

    // Check hits against police cars and NPCs
    const hits = [];
    const targets = this.scene.children.filter(c =>
      c.userData && (c.userData.isPolice || c.userData.isNPC)
    );
    for (const t of targets) {
      const box = new THREE.Box3().setFromObject(t);
      const intersect = raycaster.ray.intersectsBox(box);
      if (intersect) hits.push({ distance: intersect.distance, object: t });
    }

    hits.sort((a, b) => a.distance - b.distance);
    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit.userData.isPolice) {
        // Damage police car (visual feedback)
        hit.material.color.setHex(0xff0000);
        setTimeout(() => hit.material.color.setHex(0x2244aa), 200);
      }
    }
  }

  isAiming() { return this.aiming; }

  getAmmoDisplay() { return `${this.ammo}/${this.maxAmmo}`; }
}
