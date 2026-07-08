import * as THREE from 'three';

/**
 * Civilian traffic with multiple vehicle types.
 */
const VEHICLE_TYPES = {
  sedan: { w: 0.9, h: 0.25, d: 1.8, cabinH: 0.15, cabinD: 0.9, speed: [3, 7], colorRange: [0x4488cc, 0xcc4444, 0xcccccc, 0x444444, 0x88cc44] },
  suv: { w: 1.1, h: 0.3, d: 2.0, cabinH: 0.2, cabinD: 1.0, speed: [2, 5], colorRange: [0x444444, 0x555555, 0x666666, 0xcc4444, 0x4488cc] },
  sport: { w: 0.8, h: 0.2, d: 1.6, cabinH: 0.1, cabinD: 0.7, speed: [5, 10], colorRange: [0xff4444, 0xffaa00, 0xffff44, 0x44ff44, 0xff44ff] },
  truck: { w: 1.0, h: 0.35, d: 2.4, cabinH: 0.18, cabinD: 0.8, speed: [2, 4], colorRange: [0x334466, 0x444444, 0x555555, 0x6688aa, 0xcc6644] },
};

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.maxCars = 12;
    this.isNight = false;
    this.spawnTimer = 0;

    this.roads = [
      { start: new THREE.Vector3(0, 0, 55), end: new THREE.Vector3(0, 0, -55) },
      { start: new THREE.Vector3(0, 0, -55), end: new THREE.Vector3(0, 0, 55) },
      { start: new THREE.Vector3(55, 0, 0), end: new THREE.Vector3(-55, 0, 0) },
      { start: new THREE.Vector3(-55, 0, 0), end: new THREE.Vector3(55, 0, 0) },
    ];
  }

  _spawnCar() {
    if (this.cars.length >= this.maxCars) return;

    const road = this.roads[Math.floor(Math.random() * this.roads.length)];
    const types = Object.keys(VEHICLE_TYPES);
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const type = VEHICLE_TYPES[typeKey];
    const color = type.colorRange[Math.floor(Math.random() * type.colorRange.length)];
    const speed = type.speed[0] + Math.random() * (type.speed[1] - type.speed[0]);

    const group = new THREE.Group();

    // Main body
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(type.w, type.h, type.d), bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    body.userData = { isTraffic: true };
    group.add(body);

    // Cabin (windshield area)
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x222233, roughness: 0.2, metalness: 0.3,
      transparent: true, opacity: 0.5,
    });
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(type.w * 0.8, type.cabinH, type.cabinD), cabinMat
    );
    cabin.position.set(0, 0.2 + type.h / 2 + type.cabinH / 2, -type.d * 0.1);
    group.add(cabin);

    // Wheels (dark cylinders on sides)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const wx of [-type.w / 2 - 0.02, type.w / 2 + 0.02]) {
      for (const wz of [-type.d * 0.3, type.d * 0.3]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 6), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.1, wz);
        group.add(wheel);
      }
    }

    // Headlights (small emissive spheres)
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.03 });
    for (const wx of [-type.w * 0.25, type.w * 0.25]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4), lightMat);
      hl.position.set(wx, 0.15, -type.d / 2 - 0.02);
      group.add(hl);
    }

    // Taillights
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 0.02 });
    for (const wx of [-type.w * 0.25, type.w * 0.25]) {
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4), tailMat);
      tl.position.set(wx, 0.15, type.d / 2 + 0.02);
      group.add(tl);
    }

    // Position at start of road with lane offset
    const laneOffset = (Math.random() - 0.5) * 3;
    const alongZ = Math.abs(road.start.x - road.end.x) < 0.1;
    const pos = road.start.clone();
    if (alongZ) { pos.x += laneOffset; } else { pos.z += laneOffset; }

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
      type: typeKey,
    });
  }

  update(dt, playerPos) {
    // Time-of-day traffic density
    const nightMult = this.isNight ? 0.4 : 1.0;
    const effectiveMax = Math.floor(this.maxCars * nightMult);

    this.spawnTimer += dt;
    const spawnInterval = this.isNight ? 5 : 2;
    if (this.spawnTimer > spawnInterval && this.cars.length < effectiveMax) {
      this.spawnTimer = 0;
      if (playerPos.distanceTo(new THREE.Vector3(0, 0, 0)) < 60) {
        this._spawnCar();
      }
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const dir = new THREE.Vector3().subVectors(car.end, car.start).normalize();
      car.pos.x += dir.x * car.speed * dt;
      car.pos.z += dir.z * car.speed * dt;
      car.mesh.position.copy(car.pos);

      const distToEnd = car.pos.distanceTo(car.end);
      if (distToEnd < 2) {
        this.scene.remove(car.mesh);
        this.cars.splice(i, 1);
      }
    }
  }
}
