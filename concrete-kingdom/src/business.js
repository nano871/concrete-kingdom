import * as THREE from 'three';

/**
 * Business takeover points in the world.
 * Each business can be: neutral, owned (by which faction), or player-owned.
 */
export class BusinessSystem {
  constructor(scene) {
    this.scene = scene;
    this.businesses = [];
    this.highlighted = null;
    this.nearbyBusiness = null;

    const businessData = [
      { x: -12, z: -8, name: 'Warehouse', type: 'smuggling' },
      { x: 10, z: -10, name: 'Bar', type: 'front' },
      { x: -8, z: 12, name: 'Apartment', type: 'safehouse' },
      { x: 14, z: 14, name: 'Office', type: 'legit' },
    ];

    businessData.forEach((b) => this._createBusiness(b, scene));
  }

  _createBusiness(data, scene) {
    // Indicator ring on ground
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.2,
      roughness: 0.5,
      metalness: 0.3,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 12, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(data.x, 0.05, data.z);
    scene.add(ring);

    // Floating label indicator (simple box)
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xffaa44,
      emissiveIntensity: 0.2,
    });
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), labelMat);
    label.position.set(data.x, 3, data.z);
    scene.add(label);

    const business = {
      ...data,
      ring,
      label,
      state: 'neutral', // neutral | contested | player-owned | faction-owned
      owner: null,      // null | 'player' | 'mafia' | 'syndicate'
      income: 10,
      guards: 0,
      captureProgress: 0,
      playerNearby: false,
    };

    this.businesses.push(business);
    return business;
  }

  update(playerPos) {
    this.nearbyBusiness = null;

    for (const b of this.businesses) {
      const dx = playerPos.x - b.x;
      const dz = playerPos.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      b.playerNearby = dist < 4;

      if (b.playerNearby) {
        this.nearbyBusiness = b;
        // Highlight ring
        b.ring.material.color.setHex(b.state === 'player-owned' ? 0x44ff44 : 0xffaa44);
        b.ring.material.opacity = 0.6;
        b.label.material.emissiveIntensity = 0.8;
      } else {
        b.ring.material.color.setHex(
          b.state === 'player-owned' ? 0x44aa44 :
          b.state === 'faction-owned' ? 0xaa4444 : 0x888888
        );
        b.ring.material.opacity = 0.2;
        b.label.material.emissiveIntensity = 0.2;
      }
    }

    return this.nearbyBusiness;
  }

  /**
   * Attempt to take over the nearby business.
   */
  takeover() {
    const b = this.nearbyBusiness;
    if (!b) return null;
    if (b.state === 'player-owned') return 'already-owned';

    // Simple capture: 3-second progress per visit
    b.captureProgress += 0.33;

    if (b.captureProgress >= 1.0) {
      b.state = 'player-owned';
      b.owner = 'player';
      b.captureProgress = 0;
      b.ring.material.color.setHex(0x44ff44);
      return 'captured';
    }

    return 'progress';
  }

  getOwnedBusinesses() {
    return this.businesses.filter((b) => b.state === 'player-owned');
  }

  getTotalIncome() {
    return this.getOwnedBusinesses().reduce((sum, b) => sum + b.income, 0);
  }
}
