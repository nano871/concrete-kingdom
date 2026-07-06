import * as THREE from 'three';

/**
 * Civilian traffic system.
 * Spawns cars that drive along the road network.
 */
export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.maxCars = 8;
    this.spawnTimer = 0;

    // Road paths: { start, end, direction }
    this.roads = [
      // N-S road (x=0)
      { start: new THREE.Vector3(0, 0, 55), end: new THREE.Vector3(0, 0, -55) },
      { start: new THREE.Vector3(0, 0, -55), end: new THREE.Vector3(0, 0, 55) },
      // E-W road (z=0)
      { start: new THREE.Vector3(55, 0, 0), end: new THREE.Vector3(-55, 0, 0) },
      { start: new THREE.Vector3(-55, 0, 0), end: new THREE.Vector3(55, 0, 0) },
    ];

    // Car colors
    this.colors = [0x4488cc, 0xcc4444, 0x44cc44, 0xcccc44, 0xcccccc, 0x444444, 0xcc88cc, 0x88cc44];
  }

  _spawnCar() {
    if (this.cars.length >= this.maxCars) return;

    const road = this.roads[Math.floor(Math.random() * this.roads.length)];
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    const speed = 3 + Math.random() * 4;

    // Build simple car mesh
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 1.6), bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    group.add(body);

    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.4 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.8), cabinMat);
    cabin.position.set(0, 0.4, -0.1);
    group.add(cabin);

    // Position at start of road with slight lane offset
    const laneOffset = (Math.random() - 0.5) * 2.5;
    const pos = road.start.clone();
    // Determine which axis the road runs along
    const alongZ = Math.abs(road.start.x - road.end.x) < 0.1;
    if (alongZ) {
      pos.x += laneOffset;
    } else {
      pos.z += laneOffset;
    }

    // Direction
    const dir = new THREE.Vector3().subVectors(road.end, road.start).normalize();
    const rotY = Math.atan2(dir.x, dir.z);

    group.position.copy(pos);
    group.rotation.y = rotY;
    this.scene.add(group);

    this.cars.push({
      mesh: group,
      pos: pos.clone(),
      start: road.start.clone(),
      end: road.end.clone(),
      speed: speed,
      rotY: rotY,
      alongZ: alongZ,
      laneOffset: laneOffset,
    });
  }

  update(dt, playerPos) {
    this.spawnTimer += dt;
    if (this.spawnTimer > 2 && this.cars.length < this.maxCars) {
      this.spawnTimer = 0;
      if (playerPos.distanceTo(new THREE.Vector3(0, 0, 0)) < 40) {
        this._spawnCar();
      }
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const dir = new THREE.Vector3().subVectors(car.end, car.start).normalize();
      car.pos.x += dir.x * car.speed * dt;
      car.pos.z += dir.z * car.speed * dt;
      car.mesh.position.copy(car.pos);

      // Check if reached end of road
      const distToEnd = car.pos.distanceTo(car.end);
      if (distToEnd < 2) {
        this.scene.remove(car.mesh);
        this.cars.splice(i, 1);
      }
    }
  }
}
