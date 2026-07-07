import * as THREE from 'three';

/**
 * Cell-based world streaming system.
 * Only loads cells near the player for performance.
 */
export class WorldStream {
  constructor(scene) {
    this.scene = scene;
    this.cells = {};      // "x,z" -> cell data
    this.loadedCells = {}; // "x,z" -> THREE.Group
    this.cellSize = 100;   // units per cell
    this.loadRadius = 2;   // cells to load around player (2 = 5x5 grid)
    this.playerCell = null;
    this.totalCells = 0;
    this.maxHeight = 15;

    // Shared materials
    this.roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 });
    this.sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
    this.buildingColors = [
      0x4a4a5a, 0x3a4a6a, 0x5a4a3a, 0x4a3a5a, 0x555566,
      0x4a5a5a, 0x5a5a4a, 0x6a4a4a, 0x4a5a6a, 0x6a5a4a,
    ];
  }

  /**
   * Define cells of the world. Each cell is 100x100 units.
   * cellX, cellZ are grid coordinates (0,0 is center).
   * density: 0-1, how many buildings to place
   * roadType: 'none', 'grid', 'main'
   */
  defineCell(cellX, cellZ, data = {}) {
    const key = `${cellX},${cellZ}`;
    this.cells[key] = {
      x: cellX, z: cellZ,
      density: data.density || 0.3,
      roadType: data.roadType || 'grid',
      hasPark: data.hasPark || false,
      landmarkType: data.landmarkType || null, // 'bank', 'mall', 'station'
      buildings: data.buildings || null, // custom building positions
    };
    this.totalCells++;
  }

  /** Define the entire map at once. */
  defineMap(cellsArray) {
    for (const c of cellsArray) {
      this.defineCell(c.x, c.z, c);
    }
  }

  /** Update streaming based on player position. */
  update(playerPos) {
    const cx = Math.floor(playerPos.x / this.cellSize);
    const cz = Math.floor(playerPos.z / this.cellSize);
    const newKey = `${cx},${cz}`;
    if (newKey === this.playerCell) return; // no movement
    this.playerCell = newKey;

    // Cells that should be loaded
    const needed = new Set();
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
        needed.add(`${cx + dx},${cz + dz}`);
      }
    }

    // Unload cells no longer needed
    for (const key of Object.keys(this.loadedCells)) {
      if (!needed.has(key)) {
        this.scene.remove(this.loadedCells[key]);
        delete this.loadedCells[key];
      }
    }

    // Load new cells
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

  /** Build a cell's geometry (ground, roads, buildings). */
  _buildCell(cell) {
    const group = new THREE.Group();
    const ox = cell.x * this.cellSize;
    const oz = cell.z * this.cellSize;

    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.cellSize, this.cellSize), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(ox, 0, oz);
    group.add(ground);

    // Roads
    this._addRoads(group, cell, ox, oz);

    // Buildings
    this._addBuildings(group, cell, ox, oz);

    // Park
    if (cell.hasPark) {
      this._addPark(group, ox, oz);
    }

    // Landmark
    if (cell.landmarkType) {
      this._addLandmark(group, cell.landmarkType, ox, oz);
    }

    return group.children.length > 1 ? group : null;
  }

  _addRoads(group, cell, ox, oz) {
    if (cell.roadType === 'none') return;

    // Main roads along edges (N-S and E-W through center)
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, this.cellSize), this.roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(ox, 0.01, oz);
    group.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.cellSize, 12), this.roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(ox, 0.01, oz);
    group.add(ewRoad);

    // Sidewalks
    if (cell.roadType === 'grid' || cell.roadType === 'main') {
      const swMat = this.sidewalkMat;
      for (const z of [-40, -20, 0, 20, 40]) {
        for (const x of [-7, 7]) {
          const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 14), swMat);
          sw.rotation.x = -Math.PI / 2;
          sw.position.set(ox + x, 0.02, oz + z);
          group.add(sw);
        }
      }
      for (const x of [-40, -20, 0, 20, 40]) {
        for (const z of [-7, 7]) {
          const sw = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.5), swMat);
          sw.rotation.x = -Math.PI / 2;
          sw.position.set(ox + x, 0.02, oz + z);
          group.add(sw);
        }
      }
    }
  }

  _addBuildings(group, cell, ox, oz) {
    if (cell.buildings) {
      // Custom building positions
      for (const b of cell.buildings) {
        const mesh = this._makeBuilding(b.w || 8, b.h || 10, b.d || 8, b.color || 0x888888);
        mesh.position.set(ox + b.x, b.h / 2, oz + b.z);
        mesh.castShadow = true;
        group.add(mesh);
      }
      return;
    }

    // Procedural buildings
    const count = Math.floor(Math.random() * 4 * cell.density);
    for (let i = 0; i < count; i++) {
      const w = 4 + Math.random() * 6;
      const d = 4 + Math.random() * 6;
      const h = 5 + Math.random() * 15;
      const color = this.buildingColors[Math.floor(Math.random() * this.buildingColors.length)];
      
      // Place in quadrants (avoiding road center at 0,0)
      let bx, bz;
      const side = Math.floor(Math.random() * 4);
      switch (side) {
        case 0: bx = -20 - Math.random() * 20; bz = -20 - Math.random() * 20; break;
        case 1: bx = 20 + Math.random() * 20; bz = -20 - Math.random() * 20; break;
        case 2: bx = -20 - Math.random() * 20; bz = 20 + Math.random() * 20; break;
        case 3: bx = 20 + Math.random() * 20; bz = 20 + Math.random() * 20; break;
      }

      const mesh = this._makeBuilding(w, h, d, color);
      mesh.position.set(ox + bx, h / 2, oz + bz);
      mesh.castShadow = true;
      group.add(mesh);

      // Windows (simple)
      const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: 0x111122, emissiveIntensity: 0.2 });
      for (let row = 0; row < Math.floor(h / 3) && row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), winMat);
          win.position.set((col - 0.5) * 3, -h / 2 + 1.5 + row * 3, d / 2 + 0.01);
          mesh.add(win);
        }
      }
    }
  }

  _makeBuilding(w, h, d, color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    // Roof
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.9 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, d * 0.9), roofMat);
    roof.position.y = h / 2 + 0.15;
    mesh.add(roof);
    return mesh;
  }

  _addPark(group, ox, oz) {
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.9 });
    const park = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), greenMat);
    park.rotation.x = -Math.PI / 2;
    park.position.set(ox, 0.02, oz);
    group.add(park);

    // A few trees
    for (let i = 0; i < 5; i++) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 1.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
      );
      trunk.position.set(ox + (Math.random() - 0.5) * 20, 0.75, oz + (Math.random() - 0.5) * 20);
      group.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a6a2a })
      );
      crown.position.copy(trunk.position);
      crown.position.y = 2;
      crown.scale.y = 0.6;
      group.add(crown);
    }
  }

  _addLandmark(group, type, ox, oz) {
    if (type === 'bank') {
      const mesh = this._makeBuilding(14, 18, 12, 0x887744);
      mesh.position.set(ox, 9, oz);
      group.add(mesh);
    } else if (type === 'mall') {
      const mesh = this._makeBuilding(24, 12, 18, 0x7788aa);
      mesh.position.set(ox, 6, oz);
      group.add(mesh);
    } else if (type === 'station') {
      const mesh = this._makeBuilding(10, 8, 20, 0x556677);
      mesh.position.set(ox, 4, oz);
      group.add(mesh);
    }
  }

  /** Get total loaded cell count for debug. */
  getLoadedCount() { return Object.keys(this.loadedCells).length; }
}
