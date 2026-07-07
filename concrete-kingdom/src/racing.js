import * as THREE from 'three';

/**
 * Street racing system — checkpoints, opponents, betting, rewards.
 */
export class StreetRace {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.checkpoints = [];
    this.currentCp = 0;
    this.timer = 0;
    this.bet = 0;
    this.finished = false;
    this.opponentCar = null;

    // Checkpoint positions (along roads in the city)
    this.cpPositions = [
      new THREE.Vector3(0, 0, -30),   // Start/finish line
      new THREE.Vector3(30, 0, -30),
      new THREE.Vector3(30, 0, 0),
      new THREE.Vector3(30, 0, 30),
      new THREE.Vector3(0, 0, 30),
      new THREE.Vector3(-30, 0, 30),
      new THREE.Vector3(-30, 0, 0),
      new THREE.Vector3(-30, 0, -30),
      new THREE.Vector3(0, 0, -30),   // Back to start
    ];

    this._createCheckpoints();
    this._createRaceStart();
  }

  _createCheckpoints() {
    this.checkpoints = [];
    for (const pos of this.cpPositions) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x44ff44, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 16), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos);
      ring.position.y = 0.1;
      ring.visible = false;
      this.scene.add(ring);
      this.checkpoints.push({ mesh: ring, pos, passed: false });
    }
  }

  _createRaceStart() {
    const pos = this.cpPositions[0];
    // Glowing start marker
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff44ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    this.startMarker = new THREE.Mesh(new THREE.RingGeometry(1, 1.6, 16), mat);
    this.startMarker.rotation.x = -Math.PI / 2;
    this.startMarker.position.copy(pos);
    this.startMarker.position.y = 0.05;
    this.scene.add(this.startMarker);

    // Sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0xff44ff });
    this.startSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), signMat);
    this.startSign.position.set(pos.x, 3, pos.z);
    this.scene.add(this.startSign);
  }

  /** Start a race with a bet amount. */
  start(betAmount) {
    if (this.active) return;
    this.active = true;
    this.bet = betAmount;
    this.currentCp = 0;
    this.timer = 0;
    this.finished = false;

    // Show checkpoints
    for (const cp of this.checkpoints) {
      cp.mesh.visible = true;
      cp.mesh.material.color.setHex(0xff4444);
      cp.passed = false;
    }
    // First checkpoint glows green
    this.checkpoints[0].mesh.material.color.setHex(0x44ff44);

    this.startMarker.visible = false;
    this.startSign.visible = false;

    return { bet: betAmount };
  }

  /** Check if the player passes a checkpoint. */
  update(playerPos, dt) {
    if (!this.active || this.finished) return;

    this.timer += dt;
    const cp = this.checkpoints[this.currentCp];
    if (!cp) return;

    const dist = playerPos.distanceTo(cp.pos);
    if (dist < 3) {
      cp.passed = true;
      cp.mesh.material.color.setHex(0x44ff44);
      cp.mesh.material.opacity = 0.2; // dim after passing

      this.currentCp++;
      if (this.currentCp >= this.checkpoints.length) {
        // Finished! All checkpoints passed
        this._finish();
      } else {
        // Next checkpoint glows
        this.checkpoints[this.currentCp].mesh.material.color.setHex(0x44ff44);
        this.checkpoints[this.currentCp].mesh.material.opacity = 0.6;
      }
    }
  }

  _finish() {
    this.finished = true;
    this.active = false;

    // Calculate reward based on time
    const timeBonus = Math.max(0, 60 - this.timer) * 10;
    const reward = this.bet * 2 + Math.floor(timeBonus);

    // Hide checkpoints
    for (const cp of this.checkpoints) {
      cp.mesh.visible = false;
    }

    // Show start marker again
    this.startMarker.visible = true;
    this.startSign.visible = true;

    return { time: this.timer, reward };
  }

  getProgress() {
    if (!this.active) return null;
    return {
      checkpoint: this.currentCp,
      total: this.checkpoints.length,
      time: this.timer,
    };
  }

  /** Clean up. */
  destroy() {
    for (const cp of this.checkpoints) {
      this.scene.remove(cp.mesh);
    }
    if (this.startMarker) this.scene.remove(this.startMarker);
    if (this.startSign) this.scene.remove(this.startSign);
  }
}
