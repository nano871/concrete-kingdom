import * as THREE from 'three';

/**
 * Cell-based world streaming with smooth terrain, unique districts, and vehicle spawning.
 */
export class WorldStream {
  constructor(scene) {
    this.scene = scene;
    this.cells = {};
    this.loadedCells = {};
    this.cellSize = 100;
    this.loadRadius = 2;
    this.playerCell = null;
    this.totalCells = 0;

    // Terrain noise seed
    this._noiseSeed = Math.random() * 1000;

    // Materials
    this.roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 });
    this.grassMat = new THREE.MeshStandardMaterial({ color: 0x4a8a4a, roughness: 0.9 });
    this.sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
  }

  defineCell(cellX, cellZ, data = {}) {
    const key = `${cellX},${cellZ}`;
    this.cells[key] = {
      x: cellX, z: cellZ,
      density: data.density || 0.3,
      roadType: data.roadType || 'grid',
      hasPark: data.hasPark || false,
      district: data.district || 'mixed',
      landmarkType: data.landmarkType || null,
      terrainHeight: data.terrainHeight || 0,
      buildings: data.buildings || null,
    };
    this.totalCells++;
  }

  defineMap(cellsArray) {
    for (const c of cellsArray) this.defineCell(c.x, c.z, c);
  }

  /** Smooth terrain height — flat city center, hills on outskirts. */
  _getTerrainHeight(worldX, worldZ) {
    const dx = worldX / 80;
    const dz = worldZ / 80;
    // Distance from center in cell units
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Expand flat zone to 1.8 cell radius — center 3x3 stays flat for clean roads
    if (dist < 1.8) return 0;

    // Layered sine waves for smooth rolling hills - no jagged steps
    const h1 = Math.sin(dx * 0.8 + this._noiseSeed) * Math.cos(dz * 0.7 + this._noiseSeed) * 4;
    const h2 = Math.sin(dx * 1.5 + dz * 1.2 + this._noiseSeed * 2) * 2.5;
    const h3 = Math.cos(dx * 0.3 - dz * 0.5 + this._noiseSeed * 0.5) * 3;

    // Scale by distance from center (flat in city, hills outside)
    const scale = Math.max(0, (dist - 1.5) / 2);
    return (h1 + h2 + h3) * Math.min(1, scale);
  }

  _buildCell(cell) {
    const group = new THREE.Group();
    const ox = cell.x * this.cellSize;
    const oz = cell.z * this.cellSize;

    // Ground with terrain height
    this._addTerrain(group, cell, ox, oz);

    // Roads (follow terrain)
    this._addRoads(group, cell, ox, oz);

    // Park
    if (cell.hasPark) this._addPark(group, ox, oz);

    // Buildings (varies by district)
    this._addBuildings(group, cell, ox, oz);

    // Landmark
    if (cell.landmarkType) this._addLandmark(group, cell.landmarkType, ox, oz);

    // Foliage for non-city cells
    if (Math.abs(cell.x) > 1 || Math.abs(cell.z) > 1) {
      this._addFoliage(group, ox, oz, cell.density);
    }

    return group.children.length > 1 ? group : null;
  }

  _addTerrain(group, cell, ox, oz) {
    const segs = 24; // subdivisions for smoothness
    const geo = new THREE.PlaneGeometry(this.cellSize, this.cellSize, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) + ox;
      const pz = pos.getZ(i) + oz;
      const h = this._getTerrainHeight(px, pz);
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals(); // smooth lighting

    // Choose material (no grass - urban ground everywhere)
    const mesh = new THREE.Mesh(geo, this.groundMat);
    mesh.receiveShadow = true;
    group.add(mesh);

    // Store terrain height for building placement
    cell._terrainBase = this._getTerrainHeight(ox + this.cellSize / 2, oz + this.cellSize / 2);
  }

  _getTerrainAt(ox, oz, x, z) {
    return this._getTerrainHeight(ox + x, oz + z);
  }

  _addRoads(group, cell, ox, oz) {
    if (cell.roadType === 'none') return;

    const roadColor = 0x333333;
    const roadMat = new THREE.MeshStandardMaterial({ color: roadColor, roughness: 0.9 });
    const swMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.8 });

    // Main N-S and E-W roads through cell center
    const roadGeo = (w, h) => new THREE.PlaneGeometry(w, h);
    const ns = new THREE.Mesh(roadGeo(12, this.cellSize), roadMat);
    ns.rotation.x = -Math.PI / 2;
    const nsH = this._getTerrainAt(ox, oz, 0, 0);
    ns.position.set(ox, nsH + 0.04, oz);
    group.add(ns);

    const ew = new THREE.Mesh(roadGeo(this.cellSize, 12), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(ox, nsH + 0.04, oz);
    group.add(ew);

    // Lane markings (center dashed lines)
    if (cell.roadType === 'grid') {
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xcccc44, transparent: true, opacity: 0.4 });
      // N-S dashed line
      for (let z = -40; z <= 40; z += 6) {
        const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.5), lineMat);
        dot.rotation.x = -Math.PI / 2;
        const dh = this._getTerrainAt(ox, oz, 0, z);
        dot.position.set(ox, dh + 0.06, oz + z);
        group.add(dot);
      }
      // E-W dashed line
      for (let x = -40; x <= 40; x += 6) {
        const dot = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.15), lineMat);
        dot.rotation.x = -Math.PI / 2;
        const dh = this._getTerrainAt(ox, oz, x, 0);
        dot.position.set(ox + x, dh + 0.03, oz);
        group.add(dot);
      }
    }
  }

  _addBuildings(group, cell, ox, oz) {
    const district = cell.district;
    const isCity = Math.abs(cell.x) <= 1 && Math.abs(cell.z) <= 1;

    if (cell.buildings) {
      for (const b of cell.buildings) {
        const h = isCity ? b.h || 10 : 4 + Math.random() * 6;
        const mesh = this._makeBuilding(b.w || 8, h, b.d || 8, b.color || 0x888888, district);
        const bh = this._getTerrainAt(ox, oz, b.x, b.z);
        mesh.position.set(ox + b.x, bh + h / 2, oz + b.z);
        mesh.castShadow = true;
        group.add(mesh);
      }
      return;
    }

    // Procedural buildings based on district type
    const count = isCity ? Math.floor(Math.random() * 6 * cell.density) : Math.floor(Math.random() * 3 * cell.density);
    const colors = {
      residential: [0x7a6a5a, 0x8a7a6a, 0x6a5a4a, 0x9a8a7a],
      industrial: [0x4a4a5a, 0x5a5a6a, 0x6a6a7a, 0x555566],
      entertainment: [0x884466, 0x664488, 0x886644, 0x448866],
      commercial: [0x6a7a8a, 0x7a8a9a, 0x5a6a7a, 0x8a9aaa],
      mixed: [0x5a5a6a, 0x6a5a4a, 0x4a5a6a, 0x7a6a5a],
    };
    const pal = colors[district] || colors.mixed;

    for (let i = 0; i < count; i++) {
      const w = 4 + Math.random() * 8;
      const d = 4 + Math.random() * 8;
      let h;
      switch (district) {
        case 'residential': h = 3 + Math.random() * 5; break;
        case 'industrial': h = 6 + Math.random() * 10; break;
        case 'entertainment': h = 8 + Math.random() * 12; break;
        case 'commercial': h = 6 + Math.random() * 15; break;
        default: h = 4 + Math.random() * 12;
      }

      const color = pal[Math.floor(Math.random() * pal.length)];
      const side = Math.floor(Math.random() * 4);
      let bx, bz;
      switch (side) {
        case 0: bx = -20 - Math.random() * 20; bz = -20 - Math.random() * 20; break;
        case 1: bx = 20 + Math.random() * 20; bz = -20 - Math.random() * 20; break;
        case 2: bx = -20 - Math.random() * 20; bz = 20 + Math.random() * 20; break;
        case 3: bx = 20 + Math.random() * 20; bz = 20 + Math.random() * 20; break;
      }

      const mesh = this._makeBuilding(w, h, d, color, district);
      const bh = this._getTerrainAt(ox, oz, bx, bz);
      mesh.position.set(ox + bx, bh + h / 2, oz + bz);
      mesh.castShadow = true;
      group.add(mesh);

      // Windows (emissive at night)
      if (isCity) {
        const winMat = new THREE.MeshStandardMaterial({
          color: 0x222233, emissive: 0xffdd88, emissiveIntensity: 0.15 + Math.random() * 0.2,
        });
        for (let row = 0; row < Math.min(Math.floor(h / 3), 3); row++) {
          for (let col = 0; col < 2; col++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), winMat);
            win.position.set((col - 0.5) * 3, -h / 2 + 1.5 + row * 3, d / 2 + 0.01);
            mesh.add(win);
          }
        }
      }
    }
  }

  _makeBuilding(w, h, d, color, district) {
    const group = new THREE.Group();
    const isTall = h > 10;

    // Main body
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: district === 'industrial' ? 0.9 : 0.6,
      metalness: district === 'commercial' ? 0.3 : 0.1,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.castShadow = true;
    group.add(body);

    // ── 3D window frames (recessed boxes on front/back faces) ──
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x222233, emissive: 0xffdd88, emissiveIntensity: 0.2,
      roughness: 0.1, metalness: 0.5,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x444455, roughness: 0.6, metalness: 0.2,
    });
    const stories = Math.min(Math.floor(h / 3), 5);
    const windowsPerSide = Math.floor(w / 2.5);
    for (let story = 0; story < stories; story++) {
      for (let wi = 0; wi < windowsPerSide; wi++) {
        const wx = -w / 2 + (wi + 0.5) * (w / (windowsPerSide + 0.5));
        const wy = -h / 2 + 1.5 + story * (h / stories) + 0.3;
        // Window glass (recessed)
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), windowMat);
        win.position.set(wx, wy, d / 2 + 0.005);
        group.add(win);
        // Window frame (raised border)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.03), frameMat);
        frame.position.set(wx, wy, d / 2 + 0.01);
        group.add(frame);
        // Mirror on back face
        const winB = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), windowMat);
        winB.position.set(wx, wy, -d / 2 - 0.005);
        winB.rotation.y = Math.PI;
        group.add(winB);
        const frameB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.03), frameMat);
        frameB.position.set(wx, wy, -d / 2 - 0.01);
        group.add(frameB);
      }
    }

    // ── Horizontal ledges between floors ──
    if (stories > 1) {
      const ledgeMat = new THREE.MeshStandardMaterial({
        color: 0x555566, roughness: 0.7,
      });
      for (let s = 1; s < stories; s++) {
        const ly = -h / 2 + s * (h / stories);
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, d + 0.1), ledgeMat);
        ledge.position.y = ly;
        group.add(ledge);
      }
    }

    // ── Roof parapet ──
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.9 });
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.15, d + 0.3), roofMat);
    parapet.position.y = h / 2 + 0.075;
    group.add(parapet);

    // ── Roof details ──
    if (isTall) {
      // AC unit
      const acMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), acMat);
      ac.position.set(w * 0.2, h / 2 + 0.2, 0);
      group.add(ac);
      // Antenna
      const antMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.4, 4), antMat);
      ant.position.set(-w * 0.3, h / 2 + 0.3, d * 0.2);
      group.add(ant);
    }

    // ── Entrance (at ground level, front face) ──
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.02), doorMat);
    door.position.set(0, -h / 2 + 0.35, d / 2 + 0.005);
    group.add(door);

    return group;
  }

  _addPark(group, ox, oz) {
    const centerH = this._getTerrainHeight(ox, oz);
    const park = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.9 })
    );
    park.rotation.x = -Math.PI / 2;
    park.position.set(ox, centerH + 0.02, oz);
    group.add(park);

    for (let i = 0; i < 8; i++) {
      const tx = ox + (Math.random() - 0.5) * 24;
      const tz = oz + (Math.random() - 0.5) * 24;
      const th = this._getTerrainHeight(tx, tz);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.07, 1.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
      );
      trunk.position.set(tx, th + 0.75, tz);
      group.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a6a2a })
      );
      crown.position.set(tx, th + 2, tz);
      crown.scale.y = 0.6;
      group.add(crown);
    }
  }

  _addFoliage(group, ox, oz, density) {
    const count = Math.floor(5 * density);
    for (let i = 0; i < count; i++) {
      const tx = ox + (Math.random() - 0.5) * 90;
      const tz = oz + (Math.random() - 0.5) * 90;
      // Skip if near road (center)
      if (Math.abs(tx) < 6 && Math.abs(tz) < 6) continue;
      const th = this._getTerrainHeight(tx, tz);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.05, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
      );
      trunk.position.set(tx, th + 0.6, tz);
      group.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 4, 3),
        new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x2a6a2a : 0x3a7a3a })
      );
      crown.position.set(tx, th + 1.8, tz);
      crown.scale.y = 0.6;
      group.add(crown);
    }
  }

  _addLandmark(group, type, ox, oz) {
    const h = this._getTerrainHeight(ox, oz);
    if (type === 'bank') {
      const mesh = this._makeBuilding(14, 18, 12, 0x887744, 'commercial');
      mesh.position.set(ox, h + 9, oz);
      group.add(mesh);
    } else if (type === 'mall') {
      const mesh = this._makeBuilding(24, 12, 18, 0x7788aa, 'commercial');
      mesh.position.set(ox, h + 6, oz);
      group.add(mesh);
    } else if (type === 'station') {
      const mesh = this._makeBuilding(10, 8, 20, 0x556677, 'industrial');
      mesh.position.set(ox, h + 4, oz);
      group.add(mesh);
    }
  }

  update(playerPos) {
    const cx = Math.floor(playerPos.x / this.cellSize);
    const cz = Math.floor(playerPos.z / this.cellSize);
    const newKey = `${cx},${cz}`;
    if (newKey === this.playerCell && Object.keys(this.loadedCells).length > 0) return;
    this.playerCell = newKey;

    const needed = new Set();
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
        needed.add(`${cx + dx},${cz + dz}`);
      }
    }

    for (const key of Object.keys(this.loadedCells)) {
      if (!needed.has(key)) {
        this.scene.remove(this.loadedCells[key]);
        delete this.loadedCells[key];
      }
    }

    for (const key of needed) {
      if (this.loadedCells[key]) continue;
      if (!this.cells[key]) continue;
      const group = this._buildCell(this.cells[key]);
      if (group) {
        this.loadedCells[key] = group;
        this.scene.add(group);
      }
    }
  }

  getLoadedCount() { return Object.keys(this.loadedCells).length; }
}
