import * as THREE from 'three';
import { buildWorld } from './world.js';
import { PlayerController, KEYS, STATE } from './player.js';
import { PoliceController } from './police.js';
import { BusinessSystem } from './business.js';
import { Vehicle } from './vehicle.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PedestrianSystem } from './npcs.js';
import { TrafficSystem } from './traffic.js';
import { CombatSystem } from './combat.js';
import { MissionManager } from './missions.js';
import { MissionMenu } from './mission_menu.js';

// ── Setup ──
const scene = new THREE.Scene();

// Cloud sky background
const textureLoader = new THREE.TextureLoader();
const skyTex = textureLoader.load('/textures/sky_clouds.jpg');
skyTex.magFilter = THREE.LinearFilter;
skyTex.minFilter = THREE.LinearMipmapLinearFilter;
scene.background = skyTex;
scene.fog = new THREE.Fog(0x87CEEB, 50, 100);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;
document.body.prepend(renderer.domElement);

// ── Post-processing (bloom + glow) ──
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15,   // strength
  0.4,    // radius
  0.85    // threshold
);
composer.addPass(bloomPass);

// ── Lighting ──
const ambient = new THREE.AmbientLight(0x8888bb, 1.0);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x88ccff, 0x664422, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffeedd, 2.5);
sun.position.set(10, 20, 5);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x88bbff, 0.6);
fill.position.set(-10, 5, -5);
scene.add(fill);

// ── World ──
const { buildings } = buildWorld(scene);

// ── Player ──
const player = new PlayerController(scene, camera);
player.setBuildings(buildings);

// ── Police ──
const police = new PoliceController(scene);

// ── Businesses ──
const businesses = new BusinessSystem(scene);

// ── Vehicle ──
const vehicle = new Vehicle(scene);
vehicle.linkPlayer(player.mesh);
vehicle.setBuildings(buildings);

// ── Ambient NPCs & Traffic ──
const pedestrians = new PedestrianSystem(scene, buildings);
const traffic = new TrafficSystem(scene);

// ── Combat system ──
const combat = new CombatSystem(scene, camera, player);

// ── Mission manager ──
const missions = new MissionManager(scene);

// ── Mission menu ──
const missionMenu = new MissionMenu();
missionMenu.onStart = (missionId) => {
  const m = missions.missions[missionId];
  if (m && m.state === 'available') {
    m.state = 'active';
    missions.activeMission = m;
    document.getElementById('status').textContent = `MISSION: ${m.title}`;
    missionMenu.hide();
  }
};

// Mouse combat controls
KEYS['mousedown'] = false;
KEYS['space'] = false;
document.addEventListener('mousedown', (e) => { if (e.button === 2) KEYS['mousedown'] = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 2) KEYS['mousedown'] = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());
// Left click shoots
document.addEventListener('mousedown', (e) => { if (e.button === 0 && combat.isAiming()) KEYS[' '] = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) KEYS[' '] = false; });

// ── Game state ──
let inVehicle = false;
let vehicleInput = { forward: false, backward: false, left: false, right: false, brake: false };
let money = 0;
let passiveIncome = 0;
let inBank = false;
let vaultLooted = false;

// ── Bank interior scene ──
let bankInterior = new THREE.Group();
function buildBankInterior() {
  // Floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  bankInterior.add(floor);

  // Walls (marble/gold)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xccbb88, roughness: 0.4, metalness: 0.1 });
  // Back wall
  const bw = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 0.3), wallMat);
  bw.position.set(0, 2.5, -6);
  bankInterior.add(bw);
  // Side walls
  for (const x of [-7, 7]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 12), wallMat);
    sw.position.set(x, 2.5, 0);
    bankInterior.add(sw);
  }

  // Vault door (large metal circle)
  const vaultMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.3, metalness: 0.8 });
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16), vaultMat);
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, 1.8, -5.8);
  bankInterior.add(vault);

  // Vault handle
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), handleMat);
  handle.position.set(0.5, 2, -5.7);
  handle.rotation.z = 0.2;
  bankInterior.add(handle);

  // Gold bars on floor
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc44, metalness: 0.9, roughness: 0.2 });
  for (let i = 0; i < 8; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), goldMat);
    bar.position.set(-3 + (i % 4) * 0.8, 0.05, 2 + Math.floor(i / 4) * 0.3);
    bar.rotation.y = Math.random() * 0.3;
    bankInterior.add(bar);
  }

  // Teller counter
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.6 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 1), counterMat);
  counter.position.set(3, 0.6, -4);
  bankInterior.add(counter);

  // Ceiling lights
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xffffff, emissiveIntensity: 0.3 });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6), ceilMat);
  light.position.set(0, 4.9, 0);
  bankInterior.add(light);

  bankInterior.visible = false;
  scene.add(bankInterior);
}

// ── Bank exterior sign ──
const bankSignTex = textureLoader.load('/textures/bank_facade.jpg');
const signMat = new THREE.MeshBasicMaterial({ map: bankSignTex });
const bankSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), signMat);
bankSign.position.set(-18, 8, 23.5);
scene.add(bankSign);

buildBankInterior();

// ── Gun Shop interior ──
let inGunShop = false;
const gunShopInterior = new THREE.Group();
function buildGunShopInterior() {
  // Floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  gunShopInterior.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xccbb88, roughness: 0.4 });
  const walls = [
    { x: 0, z: -3, sx: 8, sz: 0.3 },
    { x: -4, z: 0, sx: 0.3, sz: 6 },
    { x: 4, z: 0, sx: 0.3, sz: 6 },
  ];
  for (const w of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w.sx, 3, w.sz), wallMat);
    wall.position.set(w.x, 1.5, w.z);
    gunShopInterior.add(wall);
  }

  // Counter
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.6 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), counterMat);
  counter.position.set(0, 0.5, -2.5);
  gunShopInterior.add(counter);

  // Display case with weapons
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.2, roughness: 0 });
  const display = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.6), glassMat);
  display.position.set(0, 0.8, -2.7);
  gunShopInterior.add(display);

  // Guns on wall
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
  for (let i = -1; i <= 1; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.1), gunMat);
    g.position.set(i * 1.5, 2, -2.8);
    gunShopInterior.add(g);
  }

  // Sign
  const signMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.4), signMat);
  sign.position.set(0, 2.8, -2.9);
  gunShopInterior.add(sign);

  gunShopInterior.visible = false;
  scene.add(gunShopInterior);
}
buildGunShopInterior();

// ── Interact prompt (HTML overlay) ──
const interactPrompt = document.createElement('div');
interactPrompt.style.cssText = `
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7); border: 1px solid #ffaa44;
  padding: 8px 16px; border-radius: 4px;
  color: #ffaa44; font-size: 14px; font-family: monospace;
  display: none; pointer-events: none; z-index: 100;
`;
interactPrompt.textContent = '[E] Interact';
document.body.appendChild(interactPrompt);

// ── Day/Night cycle ──
let isNight = false;
let dayNightTimer = 0;
const DAY_LENGTH = 120;

// ── Game loop ──
let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;
const fpsDisplay = document.getElementById('fps');

function getVehicleDist() {
  return player.pos.distanceTo(vehicle.pos);
}

function gameLoop(time) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // ── Day/night ──
  dayNightTimer += dt;
  if (dayNightTimer > DAY_LENGTH) {
    dayNightTimer = 0;
    isNight = !isNight;
    scene.background = isNight ? new THREE.Color(0x0a0a14) : skyTex;
    scene.fog.color.setHex(isNight ? 0x0a0a14 : 0x87CEEB);
    sun.intensity = isNight ? 1.2 : 2.5;
    ambient.intensity = 1.2;
  }

  // ── Heat system ──
  const ownedCount = businesses.getOwnedBusinesses().length;
  const passiveHeat = Math.min(1, ownedCount * 0.25);
  if (STATE.heat > 0 && !KEYS['e'] && !KEYS['r']) {
    STATE.heat = Math.max(0, STATE.heat - dt * 0.3);
  }
  if (passiveHeat > 0) {
    STATE.heat = Math.max(STATE.heat, passiveHeat);
  }
  STATE.heat = Math.min(3, STATE.heat);
  police.setHeat(Math.floor(STATE.heat));

  // ── Passive income from owned businesses ──
  passiveIncome = ownedCount * 2; // $2/second per business
  money += passiveIncome * dt;

  // ── E key: interact / enter-exit vehicle / takeover / bank ──
  const nearVehicle = getVehicleDist() < 3 && !vehicle.occupied;
  const nearBusiness = businesses.update(player.pos);

  // Bank entrance detection
  const bankPos = new THREE.Vector3(-18, 0, 23);
  const nearBank = player.pos.distanceTo(bankPos) < 4;
  const nearVault = player.pos.distanceTo(new THREE.Vector3(-18, 1.8, -18)) < 2.5;

  // Gun shop entrance detection
  const gunShopPos = new THREE.Vector3(26, 0, -5.5);
  const nearGunShop = player.pos.distanceTo(gunShopPos) < 4;

  if (KEYS['e'] && !player._eWasPressed) {
    if (inVehicle) {
      vehicle.exit();
      inVehicle = false;
      player.mesh.visible = true;
      player.pos.copy(vehicle.pos).add(new THREE.Vector3(2, 1.8, 0));
      interactPrompt.style.display = 'none';
    } else if (nearVehicle) {
      vehicle.enter();
      inVehicle = true;
      player.mesh.visible = false;
      interactPrompt.style.display = 'none';
    } else if (inGunShop) {
      // Exit gun shop
      inGunShop = false;
      gunShopInterior.visible = false;
      player.mesh.visible = true;
      player.pos.set(26, 1.8, -3);
      interactPrompt.style.display = 'none';
    } else if (nearGunShop && !inGunShop) {
      // Enter gun shop
      inGunShop = true;
      gunShopInterior.visible = true;
      player.mesh.visible = false;
      player.camera.position.set(26, 5, -1);
      player.camera.lookAt(26, 2, -3);
      interactPrompt.textContent = '[E] Exit Shop  |  [1] Buy Pistol $200  |  [2] Buy Rifle $800';
      interactPrompt.style.display = 'block';
    } else if (missions.update(player.pos)) {
      // Near mission marker
      const marker = missions.nearbyMarker;
      if (marker) {
        interactPrompt.textContent = `[E] Start: ${marker.mission.title}`;
        interactPrompt.style.display = 'block';
        if (KEYS['e'] && !player._eWasPressed) {
          const result = missions.startMission();
          if (result) {
            document.getElementById('status').textContent = `MISSION: ${result.title}`;
            setTimeout(() => {}, 500);
          }
        }
      }
    } else if (inBank && nearVault && !vaultLooted) {
      // Rob the vault
      const haul = 500 + Math.floor(Math.random() * 1000);
      money += haul;
      vaultLooted = true;
      STATE.heat = Math.min(3, STATE.heat + 2);
      document.body.style.border = '3px solid #ffdd00';
      document.getElementById('status').textContent = `+$${haul} VAULT LOOTED!`;
      setTimeout(() => document.body.style.border = '', 1000);
    } else if (inBank) {
      // Exit bank
      inBank = false;
      bankInterior.visible = false;
      player.mesh.visible = true;
      player.pos.set(-18, 1.8, 20);
      player.camera.position.set(-18, 6, 27);
      interactPrompt.style.display = 'none';
    } else if (nearBank && !inBank) {
      // Enter bank
      inBank = true;
      bankInterior.visible = true;
      player.mesh.visible = false;
      player.camera.position.set(-18, 5, -15);
      player.camera.lookAt(-18, 2, -5);
      interactPrompt.textContent = vaultLooted ? '[E] Exit Bank' : '[E] Rob Vault  |  [E] Exit';
      interactPrompt.style.display = 'block';
    } else if (nearBusiness) {
      const result = businesses.takeover();
      if (result === 'captured') {
        STATE.heat = Math.min(3, STATE.heat + 0.5);
        document.body.style.border = '3px solid #44ff44';
        setTimeout(() => document.body.style.border = '', 500);
      }
    }
  }
  player._eWasPressed = KEYS['e'];

  // ── Update interact prompt ──
  if (inBank) {
    // prompt already set on entry
  } else if (inGunShop) {
    // prompt already set on entry
  } else if (inVehicle) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Exit Vehicle';
  } else if (nearVehicle) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Enter Vehicle';
  } else if (nearBank) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Enter Bank';
  } else if (nearGunShop) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Enter Gun Shop';
  } else if (nearBusiness && !KEYS['e']) {
    interactPrompt.style.display = 'block';
    const bizStatus = nearBusiness.state === 'player-owned' ? 'OWNED' : `${(nearBusiness.captureProgress * 100).toFixed(0)}%`;
    interactPrompt.textContent = `[E] Takeover (${bizStatus})  |  [R] Rob $50-200`;
  } else {
    interactPrompt.style.display = 'none';
  }

  // ── Update ──
  if (inBank) {
    // Freeze player, interior camera
    document.getElementById('status').textContent = vaultLooted
      ? `$${money} | VAULT EMPTY | HT: ${STATE.heat}`
      : `$${money} | INSIDE BANK | HT: ${STATE.heat}`;
  } else if (inGunShop) {
    const weaponStatus = combat.isArmed() ? `ARMED: ${combat.equipped.toUpperCase()}` : 'UNARMED';
    document.getElementById('status').textContent = `$${money} | GUN SHOP | ${weaponStatus}`;
  } else if (inVehicle) {
    // Vehicle mode: map WASD to vehicle input
    vehicleInput.forward = KEYS['w'];
    vehicleInput.backward = KEYS['s'];
    vehicleInput.left = KEYS['a'];
    vehicleInput.right = KEYS['d'];
    vehicleInput.brake = KEYS[' '];
    vehicle.update(vehicleInput, dt);

    // Camera follows vehicle (third-person chase)
    const vPos = vehicle.pos;
    const vRot = vehicle.rotY;
    const camDist = 8;
    const camHeight = 4;
    const camX = vPos.x + Math.sin(vRot) * camDist;
    const camZ = vPos.z + Math.cos(vRot) * camDist;
    const targetCam = new THREE.Vector3(camX, vPos.y + camHeight, camZ);
    camera.position.lerp(targetCam, Math.min(1, 8 * dt));
    camera.lookAt(vPos.x, vPos.y + 1, vPos.z);

    police.setPlayerPos(vPos);
    document.getElementById('status').textContent =
      `VEHICLE | $${money} | SPD: ${(vehicle.getSpeed() * 3.6).toFixed(0)} km/h | HT: ${STATE.heat}`;
    document.getElementById('pos').textContent =
      `${vPos.x.toFixed(1)}, ${vPos.y.toFixed(1)}, ${vPos.z.toFixed(1)}`;
  } else if (!inBank && !inGunShop && !missionMenu.visible) {
    // On-foot mode
    player.update(dt);
    police.setPlayerPos(player.pos);
    const activeM = missions.getActiveMission();
    const missionStr = activeM ? ` | MISS: ${activeM.title}` : '';
    document.getElementById('status').textContent =
      `$${money} | SPD: ${STATE.speed.toFixed(1)} | HT: ${STATE.heat}${missionStr}`;
    if (combat.isAiming()) {
      document.getElementById('status').textContent += ` | AMMO: ${combat.getAmmoDisplay()}`;
    }
  }

  // ── Q vault ──
  if (KEYS['q'] && !player._qWasPressed && !inVehicle) {
    player.vault();
  }
  player._qWasPressed = KEYS['q'];

  // ── M mission menu ──
  if (KEYS['m'] && !player._mWasPressed) {
    missionMenu.toggle(missions);
  }
  player._mWasPressed = KEYS['m'];

  // ── R robbery ──
  if (KEYS['r'] && !player._rWasPressed && !inVehicle) {
    const nearbyBiz = businesses.nearbyBusiness;
    if (nearbyBiz && nearbyBiz.state !== 'player-owned') {
      const loot = 50 + Math.floor(Math.random() * 150);
      money += loot;
      STATE.heat = Math.min(3, STATE.heat + 1);
      document.body.style.border = '3px solid #ffaa44';
      document.getElementById('status').textContent = `+$${loot} LOOTED!`;
      setTimeout(() => {
        document.body.style.border = '';
      }, 800);
      if (nearbyBiz.state === 'neutral') {
        nearbyBiz.state = 'contested';
      }
    }
  }
  player._rWasPressed = KEYS['r'];

  // ── Weapon purchase (number keys) ──
  if (inGunShop) {
    if (KEYS['1'] && !player._1WasPressed) {
      const result = combat.buyWeapon('pistol');
      document.getElementById('status').textContent = result === 'bought' ? 'PURCHASED PISTOL' : result === 'already owned' ? 'ALREADY OWNED' : 'NEED $200';
      setTimeout(() => document.getElementById('status').textContent = '', 1500);
    }
    if (KEYS['2'] && !player._2WasPressed) {
      const result = combat.buyWeapon('rifle');
      document.getElementById('status').textContent = result === 'bought' ? 'PURCHASED RIFLE' : result === 'already owned' ? 'ALREADY OWNED' : 'NEED $800';
      setTimeout(() => document.getElementById('status').textContent = '', 1500);
    }
  }
  player._1WasPressed = KEYS['1'];
  player._2WasPressed = KEYS['2'];

  // ── Sync money with combat system ──
  combat.syncMoney(money);

  // ── Police update ──
  police.update(dt);

  // ── Ambient NPCs & Traffic update ──
  pedestrians.update(dt, player.pos);
  traffic.update(dt, player.pos);

  // ── Combat update ──
  combat.update(dt, KEYS);

  // ── Render frame ──
  composer.render();

  // ── FPS ──
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsDisplay.textContent = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
}

// ── Window resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ── Start ──
gameLoop(performance.now());
