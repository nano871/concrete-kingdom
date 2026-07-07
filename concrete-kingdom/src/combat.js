import * as THREE from 'three';

/**
 * Combat system: aiming, shooting, weapons, purchases.
 */
const WEAPONS = {
  pistol: { name: 'Pistol', damage: 25, fireRate: 0.15, ammo: 30, maxAmmo: 30, price: 200, range: 30 },
  rifle: { name: 'Rifle', damage: 40, fireRate: 0.08, ammo: 60, maxAmmo: 60, price: 800, range: 60 },
};

export class CombatSystem {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.aiming = false;
    this.shootCooldown = 0;
    this.owned = []; // list of owned weapon ids
    this.equipped = null; // currently equipped weapon id
    this.currentAmmo = 0;
    this.currentMaxAmmo = 0;
    this.money = 0; // linked from main

    // Muzzle flash (on camera)
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0 });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4), this.flashMat);
    this.flash.position.set(0.3, -0.25, -0.52);
    camera.add(this.flash);
  }

  buyWeapon(weaponId) {
    const w = WEAPONS[weaponId];
    if (!w) return 'no such weapon';
    if (this.owned.includes(weaponId)) return 'already owned';
    if (this.money < w.price) return 'not enough money';
    this.money -= w.price;
    this.owned.push(weaponId);
    this.equip(weaponId);
    return 'bought';
  }

  equip(weaponId) {
    if (!this.owned.includes(weaponId)) return;
    this.equipped = weaponId;
    const w = WEAPONS[weaponId];
    this.currentAmmo = w.ammo;
    this.currentMaxAmmo = w.maxAmmo;
  }

  getWeaponList() {
    return Object.entries(WEAPONS).map(([id, w]) => ({
      id, name: w.name, price: w.price,
      owned: this.owned.includes(id),
      equipped: this.equipped === id,
    }));
  }

  update(dt, keys) {
    this.aiming = keys['mousedown'] === true || false;

    // Shooting
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (keys[' '] && this.aiming && this.shootCooldown <= 0 && this.currentAmmo > 0 && this.equipped) {
      this.shoot();
    }

    // Flash decay
    this.flashMat.opacity *= 0.85;
  }

  shoot() {
    this.currentAmmo--;
    const w = WEAPONS[this.equipped];
    this.shootCooldown = w.fireRate;

    // Muzzle flash
    this.flashMat.opacity = 1;

    // Sound
    this._audio?.gunshot();

    // Raycast
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
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
    if (hits.length > 0 && hits[0].distance < w.range) {
      const hit = hits[0].object;
      if (hit.userData.isPolice) {
        hit.material.color.setHex(0xff0000);
        setTimeout(() => hit.material.color.setHex(0x2244aa), 200);
      }
    }
  }

  isAiming() { return this.aiming; }
  isArmed() { return this.equipped !== null; }
  getAmmoDisplay() { return this.equipped ? `${this.currentAmmo}/${this.currentMaxAmmo}` : 'NO WEAPON'; }
  syncMoney(m) { this.money = m; }
}
