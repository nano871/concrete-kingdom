import * as THREE from 'three';
import { buildWorld } from './world.js';
import { PlayerController, KEYS, STATE } from './player.js';
import { PoliceController } from './police.js';
import { BusinessSystem } from './business.js';
import { Vehicle } from './vehicle.js';

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
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

// ── Lighting ──
const ambient = new THREE.AmbientLight(0x404055, 0.4);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x8888ff, 0x443322, 0.4);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
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

const fill = new THREE.DirectionalLight(0x4488ff, 0.3);
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
    sun.intensity = isNight ? 0.6 : 1.2;
    ambient.intensity = 0.6;
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
  } else if (inVehicle) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Exit Vehicle';
  } else if (nearVehicle) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Enter Vehicle';
  } else if (nearBank) {
    interactPrompt.style.display = 'block';
    interactPrompt.textContent = '[E] Enter Bank';
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
  } else if (!inBank) {
    // On-foot mode
    player.update(dt);
    police.setPlayerPos(player.pos);
    document.getElementById('status').textContent =
      `$${money} | SPD: ${STATE.speed.toFixed(1)} | HT: ${STATE.heat}`;
  }

  // ── Q vault ──
  if (KEYS['q'] && !player._qWasPressed && !inVehicle) {
    player.vault();
  }
  player._qWasPressed = KEYS['q'];

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

  // ── Police update ──
  police.update(dt);

  // ── Render frame ──
  renderer.render(scene, camera);

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
});

// ── Start ──
gameLoop(performance.now());
