import * as THREE from 'three';
import { TextureLoader } from 'three';

const texLoader = new TextureLoader();

/**
 * Build the graybox district: street grid + buildings + roads + props.
 */
export function buildWorld(scene) {
  const group = new THREE.Group();

  // Pre-load building textures
  const textures = {
    warehouse: texLoader.load('/textures/warehouse.jpg'),
    bar: texLoader.load('/textures/bar.jpg'),
    office: texLoader.load('/textures/office.jpg'),
    storefront: texLoader.load('/textures/storefront.jpg'),
    bank: texLoader.load('/textures/bank_facade.jpg'),
  };

  // ── Ground base ──
  const groundGeo = new THREE.PlaneGeometry(120, 120);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a, roughness: 0.95, metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ── Roads (asphalt strips) ──
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x333333, roughness: 0.9, metalness: 0,
  });

  // North-South road (z-axis, centered at x=0)
  const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 80), roadMat);
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.set(0, 0.01, 0);
  group.add(nsRoad);

  // East-West road (x-axis, centered at z=0)
  const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(80, 12), roadMat);
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.position.set(0, 0.01, 0);
  group.add(ewRoad);

  // ── Sidewalks ──
  const swMat = new THREE.MeshStandardMaterial({
    color: 0x666666, roughness: 0.8, metalness: 0,
  });
  // Sidewalk strips along N-S road (east and west edges)
  for (const z of [-40, -20, 0, 20, 40]) {
    for (const x of [-7, 7]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 14), swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(x, 0.02, z);
      group.add(sw);
    }
  }
  // Sidewalk strips along E-W road
  for (const x of [-40, -20, 0, 20, 40]) {
    for (const z of [-7, 7]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.5), swMat);
      sw.rotation.x = -Math.PI / 2;
      sw.position.set(x, 0.02, z);
      group.add(sw);
    }
  }

  // ── Lane markings (dashed white center line on N-S road) ──
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  for (let z = -38; z <= 38; z += 4) {
    // Dashed center line (N-S)
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.8), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    group.add(dash);

    // Dashed center line (E-W)
    const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.15), dashMat);
    dash2.rotation.x = -Math.PI / 2;
    dash2.position.set(z, 0.03, 0);
    group.add(dash2);
  }

  // Solid lane edges (N-S)
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x999999 });
  for (const x of [-3, 3]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 80), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.03, 0);
    group.add(edge);
  }
  for (const z of [-3, 3]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.1), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.03, z);
    group.add(edge);
  }

  // ── Crosswalks at intersection ──
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  for (let i = -3; i <= 3; i++) {
    // E-W crosswalk (north side of intersection)
    const cw1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.5), crossMat);
    cw1.rotation.x = -Math.PI / 2;
    cw1.position.set(i, 0.03, 6);
    group.add(cw1);
    // South side
    const cw2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.5), crossMat);
    cw2.rotation.x = -Math.PI / 2;
    cw2.position.set(i, 0.03, -6);
    group.add(cw2);
    // N-S crosswalk (east side)
    const cw3 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.2), crossMat);
    cw3.rotation.x = -Math.PI / 2;
    cw3.position.set(6, 0.03, i);
    group.add(cw3);
    // West side
    const cw4 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.2), crossMat);
    cw4.rotation.x = -Math.PI / 2;
    cw4.position.set(-6, 0.03, i);
    group.add(cw4);
  }

  // ── Buildings ──
  const buildingData = [
    { x: -18, z: -14, w: 8, d: 10, h: 12, color: 0x888888, tex: textures.warehouse, name: 'Warehouse' },
    { x: 14, z: -14, w: 7, d: 8, h: 15, color: 0x888888, tex: textures.bar, name: 'Bar' },
    { x: -14, z: 16, w: 9, d: 9, h: 10, color: 0x888888, tex: textures.storefront, name: 'Apartment' },
    { x: 16, z: 16, w: 6, d: 6, h: 18, color: 0x888888, tex: textures.office, name: 'Office' },
    { x: -18, z: 18, w: 12, d: 10, h: 14, color: 0x888888, tex: textures.bank, name: 'Bank' },
    { x: 26, z: -20, w: 6, d: 5, h: 9, color: 0x888888, tex: textures.storefront, name: 'Shop' },
    { x: -26, z: -22, w: 5, d: 6, h: 8, color: 0x888888, tex: textures.storefront, name: 'Laundry' },
    { x: 24, z: 22, w: 6, d: 6, h: 10, color: 0x888888, tex: textures.storefront, name: 'Cafe' },
    { x: -26, z: 24, w: 5, d: 5, h: 8, color: 0x888888, tex: textures.storefront, name: 'Bodega' },
    // Gun shop
    { x: 26, z: -8, w: 6, d: 5, h: 8, color: 0x888888, tex: textures.storefront, name: 'Gun Shop' },
  ];

  const interiors = [];
  buildingData.forEach((b) => {
    const mesh = createBuilding(b.w, b.h, b.d, b.color, b.tex);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { name: b.name, isBuilding: true };
    group.add(mesh);
    interiors.push(mesh);
  });

  // ── Street props (lamp posts along roads) ──
  for (let i = -6; i <= 6; i += 2) {
    if (i === 0) continue;
    addLampPost(group, i * 2.5, 0, -14);
    addLampPost(group, i * 2.5, 0, 14);
    addLampPost(group, -14, 0, i * 2.5);
    addLampPost(group, 14, 0, i * 2.5);
  }

  // ── Trees along streets ──
  const treePositions = [
    [-9, -14], [9, -14], [-9, 14], [9, 14],
    [-14, -9], [-14, 9], [14, -9], [14, 9],
    [-20, -14], [20, -14], [-20, 14], [20, 14],
  ];
  for (const [tx, tz] of treePositions) {
    addTree(group, tx, tz);
  }

  // ── District boundaries ──
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x222233, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
  });
  for (const x of [-40, 40]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 80), wallMat);
    w.position.set(x, 3, 0);
    group.add(w);
  }
  for (const z of [-40, 40]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(80, 6, 0.5), wallMat);
    w.position.set(0, 3, z);
    group.add(w);
  }

  scene.add(group);
  return { buildings: interiors, buildingData };
}

function addTree(group, x, z) {
  // Trunk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.8, 6), trunkMat);
  trunk.position.set(x, 0.9, z);
  trunk.castShadow = true;
  group.add(trunk);

  // Canopy
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.8 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 5), leafMat);
  crown.position.set(x, 2.2, z);
  crown.scale.y = 0.7;
  crown.castShadow = true;
  group.add(crown);
}

function createBuilding(w, h, d, color, texture) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.1,
    map: texture || undefined,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  // Roof
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x333344, roughness: 0.9,
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, d * 0.9), roofMat);
  roof.position.y = h / 2 + 0.15;
  mesh.add(roof);

  // Windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e, emissive: 0x111122, emissiveIntensity: 0.2,
  });
  for (let row = 0; row < Math.floor(h / 3); row++) {
    for (let col = 0; col < 3; col++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), winMat);
      win.position.set((col - 1) * 2, -h / 2 + 2 + row * 3, d / 2 + 0.01);
      mesh.add(win);
      const win2 = win.clone();
      win2.position.z = -d / 2 - 0.01;
      win2.rotation.y = Math.PI;
      mesh.add(win2);
    }
  }

  // Door
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), doorMat);
  door.position.set(0, -h / 2 + 1.1, d / 2 + 0.01);
  mesh.add(door);

  return mesh;
}

function addLampPost(group, x, y, z) {
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x555555, roughness: 0.6, metalness: 0.4,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.5, 6), poleMat);
  pole.position.set(x, 1.75, z);
  group.add(pole);

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffdd88, emissive: 0xffdd88, emissiveIntensity: 0.3,
  });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6), lightMat);
  light.position.set(x, 3.5, z);
  group.add(light);

  const pl = new THREE.PointLight(0xffdd88, 0.5, 10);
  pl.position.set(x, 3.0, z);
  group.add(pl);
}
