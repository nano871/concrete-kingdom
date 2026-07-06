import * as THREE from 'three';

/**
 * Mission system with GTA-style glowing markers at building locations.
 */
export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.missions = {};
    this.activeMission = null;
    this.completed = [];
    this.markers = []; // { mesh, mission, position }
    this.nearbyMarker = null;

    this._defineMissions();
    this._createMarkers(scene);
  }

  _defineMissions() {
    const add = (data) => {
      data.state = data.required_missions && data.required_missions.length > 0 ? 'locked' : 'available';
      data.objectives = data.objectives.map(o => ({ ...o, completed: false, countCurrent: 0 }));
      this.missions[data.id] = data;
    };

    // Act 1
    add({
      id: 'm01_first_score', title: 'First Score',
      description: 'Knock over the corner store. Prove you\'ve got what it takes.',
      faction: 'neutral', required_missions: [],
      objectives: [
        { id: 'obj_go_bar', type: 'goto', targetId: 'Bar', pos: new THREE.Vector3(14, 0, -10), radius: 4, desc: 'Go to the bar' },
        { id: 'obj_take_bar', type: 'interact', targetId: 'Bar', desc: 'Take over the bar' },
        { id: 'obj_lose_heat', type: 'escape', desc: 'Lose the police (wait for heat to drop)' },
      ],
      rewardMoney: 500, rewardRep: { neutral: 10 },
    });

    add({
      id: 'm02_warehouse_job', title: 'Warehouse Job',
      description: 'The syndicate wants the warehouse. Take it.',
      faction: 'syndicate', required_missions: ['m01_first_score'],
      objectives: [
        { id: 'obj_go_wh', type: 'goto', targetId: 'Warehouse', pos: new THREE.Vector3(-18, 0, -9), radius: 4, desc: 'Drive to the warehouse' },
        { id: 'obj_breach', type: 'interact', targetId: 'Warehouse', desc: 'Breach the warehouse — alarms trigger' },
        { id: 'obj_survive', type: 'timed', count: 20, desc: 'Survive the police response (20s)' },
        { id: 'obj_loot', type: 'interact', targetId: 'Warehouse', desc: 'Grab the syndicate\'s shipment' },
        { id: 'obj_escape', type: 'escape', desc: 'Lose the cops and deliver the goods' },
      ],
      rewardMoney: 1200, rewardRep: { syndicate: 15 },
    });

    add({
      id: 'm03_apartment_heist', title: 'Apartment Heist',
      description: 'The Mafia has a safe in the apartment building. Hit it.',
      faction: 'mafia', required_missions: ['m01_first_score'],
      objectives: [
        { id: 'obj_go_apt', type: 'goto', targetId: 'Apartment', pos: new THREE.Vector3(-14, 0, 20), radius: 4, desc: 'Reach the apartment' },
        { id: 'obj_open_safe', type: 'interact', targetId: 'Apartment', desc: 'Crack the safe' },
        { id: 'obj_escape', type: 'escape', desc: 'Escape the area' },
      ],
      rewardMoney: 2000, rewardRep: { mafia: 20 },
    });

    // Act 2
    add({
      id: 'm04_office_takeover', title: 'Office Takeover',
      description: 'Take the office building. It\'s the key to the district.',
      faction: 'neutral', required_missions: ['m02_warehouse_job', 'm03_apartment_heist'],
      objectives: [
        { id: 'obj_go_off', type: 'goto', targetId: 'Office', pos: new THREE.Vector3(16, 0, 19), radius: 4, desc: 'Approach the office' },
        { id: 'obj_take_off', type: 'interact', targetId: 'Office', desc: 'Take over the office' },
      ],
      rewardMoney: 5000, rewardRep: { neutral: 30, syndicate: -10, mafia: -10 },
    });

    // Endgame
    add({
      id: 'm05_showdown', title: 'Concrete Kingdom',
      description: 'One faction stands in your way. End them. Own the district.',
      faction: 'neutral', required_missions: ['m04_office_takeover'],
      objectives: [
        { id: 'obj_repel', type: 'timed', count: 60, desc: 'Hold the district against all factions (60s)' },
        { id: 'obj_claim', type: 'goto', targetId: 'Office', pos: new THREE.Vector3(16, 0, 19), radius: 4, desc: 'Return to the office and claim the district' },
      ],
      rewardMoney: 10000, rewardRep: { neutral: 100 },
    });
  }

  _createMarkers(scene) {
    // Mission markers at each building location
    const locations = [
      { id: 'm01_first_score', pos: new THREE.Vector3(14, 0, -10), color: 0xffaa44 },
      { id: 'm02_warehouse_job', pos: new THREE.Vector3(-18, 0, -9), color: 0xff6644 },
      { id: 'm03_apartment_heist', pos: new THREE.Vector3(-14, 0, 20), color: 0xff6644 },
      { id: 'm04_office_takeover', pos: new THREE.Vector3(16, 0, 19), color: 0x44ffaa },
      { id: 'm05_showdown', pos: new THREE.Vector3(16, 0, 19), color: 0xff44ff },
    ];

    for (const loc of locations) {
      const mission = this.missions[loc.id];
      if (!mission) continue;

      // Glowing ring marker
      const ringMat = new THREE.MeshBasicMaterial({
        color: loc.color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(loc.pos);
      ring.position.y = 0.05;
      scene.add(ring);

      // Glow cylinder (light beam)
      const beamMat = new THREE.MeshBasicMaterial({
        color: loc.color,
        transparent: true,
        opacity: 0.15,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 4, 8), beamMat);
      beam.position.copy(loc.pos);
      beam.position.y = 2;
      scene.add(beam);

      this.markers.push({
        mesh: ring,
        beam: beam,
        mission: mission,
        position: loc.pos.clone(),
        color: loc.color,
      });
    }
  }

  update(playerPos) {
    this.nearbyMarker = null;

    // Check available missions first
    for (const marker of this.markers) {
      const m = marker.mission;
      if (m.state === 'completed' || m.state === 'active') continue;
      if (m.state === 'locked') {
        // Check if prerequisites are met
        const allDone = m.required_missions.every(req => this.completed.includes(req));
        m.state = allDone ? 'available' : 'locked';
      }
      if (m.state !== 'available') continue;

      const dist = playerPos.distanceTo(marker.position);
      if (dist < 3) {
        this.nearbyMarker = marker;
        // Highlight the marker
        marker.mesh.material.opacity = 1;
        marker.beam.material.opacity = 0.4;
        break;
      } else {
        marker.mesh.material.opacity = 0.6;
        marker.beam.material.opacity = 0.15;
      }
    }
    return this.nearbyMarker;
  }

  startMission() {
    if (!this.nearbyMarker) return null;
    const m = this.nearbyMarker.mission;
    if (m.state !== 'available') return null;

    m.state = 'active';
    this.activeMission = m;
    return m;
  }

  reportAction(actionType, targetId) {
    if (!this.activeMission) return;

    for (const obj of this.activeMission.objectives) {
      if (obj.completed) continue;
      switch (obj.type) {
        case 'goto':
          if (actionType === 'goto' && targetId === obj.targetId) obj.completed = true;
          break;
        case 'interact':
          if (actionType === 'interact' && targetId === obj.targetId) obj.completed = true;
          break;
        case 'escape':
          if (actionType === 'heat_dropped') obj.completed = true;
          break;
        case 'timed':
          obj.countCurrent = (obj.countCurrent || 0) + 1;
          if (obj.countCurrent >= obj.count) obj.completed = true;
          break;
      }
    }

    // Check all complete
    if (this.activeMission.objectives.every(o => o.completed)) {
      this.activeMission.state = 'completed';
      this.completed.push(this.activeMission.id);
      const reward = this.activeMission.rewardMoney;
      this.activeMission = null;
      return { completed: true, reward };
    }
    return { completed: false };
  }

  getActiveMission() { return this.activeMission; }
  getCompletedCount() { return this.completed.length; }
}
