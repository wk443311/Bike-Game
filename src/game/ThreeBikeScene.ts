import * as THREE from 'three';
import { LevelConfig, BikeModel, PlayerStats, VehicleArchetype } from '../types/game';
import { calculateNearMissBonus } from './rules';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

export interface Traffic3DVehicle {
  group: THREE.Group;
  type: VehicleArchetype;
  lane: number;
  speedKmh: number;
  width: number;
  length: number;
  nearMissed: boolean;
  changingLane: boolean;
  targetLaneX: number;
  brakeLightMesh?: THREE.Mesh;
}

export interface Game3DCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onGameOver: (finalStats: { distance: number; score: number; nearMisses: number }) => void;
  onVictory: (finalStats: { distance: number; score: number; nearMisses: number; timeElapsed: number }) => void;
}

// Software WebGL probe
export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

export class ThreeBikeScene {
  private container: HTMLElement;
  private levelConfig: LevelConfig;
  private bikeModel: BikeModel;
  private callbacks: Game3DCallbacks;

  // Three.js Core
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // Road Dimensions
  private laneWidth: number = 3.6; // meters per lane
  private roadWidth: number = 14.4;
  private roadGroup!: THREE.Group;
  private roadSegments: THREE.Mesh[] = [];
  private guardrails: THREE.Group[] = [];
  private lampposts: THREE.Group[] = [];

  // Player Motorcycle
  private playerGroup!: THREE.Group;
  private bikeBodyMesh!: THREE.Mesh;
  private frontWheel!: THREE.Group;
  private rearWheel!: THREE.Group;
  private shieldMesh!: THREE.Group;
  private headlightSpot!: THREE.SpotLight;
  private playerX: number = 0;
  private playerTargetX: number = 0;
  private playerSpeedKmh: number = 60;
  private bikeRoll: number = 0;

  // Controls & States
  private isSteeringLeft: boolean = false;
  private isSteeringRight: boolean = false;
  private isBraking: boolean = false;
  private isBoosting: boolean = false;
  private nitroCharge: number = 100;
  private shieldTimeRemaining: number = 1.5;

  // Stats
  private distanceTraveledMeters: number = 0;
  private score: number = 0;
  private nearMissCount: number = 0;
  private comboStreak: number = 0;
  private comboTimer: number = 0;
  private elapsedTimeSeconds: number = 0;
  private isRunning: boolean = true;
  private isCrashed: boolean = false;
  private isCompleted: boolean = false;

  // Traffic
  private trafficVehicles: Traffic3DVehicle[] = [];
  private lastTrafficSpawnDistance: number = 0;

  // Particles
  private exhaustParticles: Array<{
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
    vx: number;
    vy: number;
    vz: number;
  }> = [];

  // Reusable scratch vectors for zero-GC loop
  private static _vec3 = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    levelConfig: LevelConfig,
    bikeModel: BikeModel,
    callbacks: Game3DCallbacks
  ) {
    this.container = container;
    this.levelConfig = levelConfig;
    this.bikeModel = bikeModel;
    this.callbacks = callbacks;

    this.roadWidth = this.levelConfig.lanes * this.laneWidth;

    this.initThree();
    this.buildEnvironment();
    this.buildPlayerMotorcycle();
    this.setupInputListeners();
    this.spawnInitialTraffic();

    sound.startEngine();
    this.startLoop();
  }

  private initThree() {
    const width = this.container.clientWidth || 440;
    const height = this.container.clientHeight || 780;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.2, 350);

    // Initial camera position behind motorcycle
    this.camera.position.set(0, 3.4, 5.8);
    this.camera.lookAt(0, 1.2, -10);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Apply Level Theme Fog and Background
    this.applyTheme();

    // Lighting Rig (Studio Warm Key + Cool Sky Fill)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x090d16, 0.9);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    dirLight.position.set(12, 28, 14);
    if (!isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 120;
      dirLight.shadow.camera.left = -20;
      dirLight.shadow.camera.right = 20;
      dirLight.shadow.camera.top = 30;
      dirLight.shadow.camera.bottom = -30;
    }
    this.scene.add(dirLight);

    window.addEventListener('resize', this.handleResize);
  }

  private applyTheme() {
    let fogColor = 0x090d16;
    let groundColor = 0x040810;

    switch (this.levelConfig.theme) {
      case 'sunset':
        fogColor = 0x581c87;
        groundColor = 0x3b0764;
        break;
      case 'dawn':
        fogColor = 0xc2410c;
        groundColor = 0x1c1917;
        break;
      case 'cyber':
        fogColor = 0x3b0764;
        groundColor = 0x050515;
        break;
      case 'rain':
        fogColor = 0x0f172a;
        groundColor = 0x090d16;
        break;
      case 'fog':
        fogColor = 0x334155;
        groundColor = 0x1e293b;
        break;
      default:
        // day
        fogColor = 0x1e293b;
        groundColor = 0x0a1120;
        break;
    }

    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, 0.012);
  }

  private buildEnvironment() {
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Procedural Asphalt Road Texture
    const roadTexture = this.generateRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.85,
      metalness: 0.1,
    });

    // Create 4 scrolling road plane tiles covering -120m to +30m
    const tileLength = 60;
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(this.roadWidth, tileLength);
      geo.rotateX(-Math.PI / 2);
      const roadTile = new THREE.Mesh(geo, roadMat);
      roadTile.position.set(0, 0, -i * tileLength + 15);
      roadTile.receiveShadow = !isSoftwareGl;
      this.roadGroup.add(roadTile);
      this.roadSegments.push(roadTile);
    }

    // Extended roadside terrain
    const terrainGeo = new THREE.PlaneGeometry(240, 240);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x0a1120,
      roughness: 0.95,
      metalness: 0.05,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(0, -0.05, -60);
    this.scene.add(terrain);

    // Build metallic guardrails along left and right highway shoulders
    this.buildGuardrails();
  }

  private generateRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark asphalt
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle grain noise
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#182234' : '#233048';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Solid white shoulder lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(14, 0, 6, 512);
    ctx.fillRect(512 - 20, 0, 6, 512);

    // Dashed Lane Dividers
    const lanes = this.levelConfig.lanes;
    const lanePx = (512 - 40) / lanes;
    ctx.fillStyle = '#e2e8f0';

    for (let l = 1; l < lanes; l++) {
      const x = 20 + l * lanePx;
      const dashH = 50;
      const gapH = 40;
      for (let y = 0; y < 512; y += dashH + gapH) {
        ctx.fillRect(x - 3, y, 6, dashH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  private buildGuardrails() {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.6,
      roughness: 0.5,
    });

    const railGeo = new THREE.BoxGeometry(0.12, 0.45, 180);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);

    const halfW = this.roadWidth / 2 + 0.3;

    // Left Rail
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-halfW, 0.5, -60);
    this.scene.add(leftRail);

    // Right Rail
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(halfW, 0.5, -60);
    this.scene.add(rightRail);

    // Posts along rails
    for (let z = 20; z >= -140; z -= 8) {
      const pL = new THREE.Mesh(postGeo, postMat);
      pL.position.set(-halfW, 0.4, z);
      this.scene.add(pL);

      const pR = new THREE.Mesh(postGeo, postMat);
      pR.position.set(halfW, 0.4, z);
      this.scene.add(pR);
    }
  }

  private buildPlayerMotorcycle() {
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0, 0, 0);
    this.scene.add(this.playerGroup);

    const bikeColor = new THREE.Color(this.bikeModel.color);
    const accentColor = new THREE.Color(this.bikeModel.accentColor);

    // --- Premium PBR Materials ---
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bikeColor,
      roughness: 0.12,
      metalness: 0.85,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.9,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.45,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.9,
    });
    const goldForkMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.15,
      metalness: 0.95,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.85,
    });
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.5,
      metalness: 0.8,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.25,
      metalness: 0.85,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.88,
      metalness: 0.05,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.1,
      metalness: 0.98,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.92,
    });
    const brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.18,
      metalness: 0.95,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.25,
      metalness: 0.7,
    });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff });
    const dashScreenMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });

    // 1. Twin-Spar Aluminum Perimeter Frame
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 1.1), frameMat);
    frameL.position.set(-0.2, 0.62, -0.05);
    frameL.rotation.x = 0.2;
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 1.1), frameMat);
    frameR.position.set(0.2, 0.62, -0.05);
    frameR.rotation.x = 0.2;
    this.playerGroup.add(frameL, frameR);

    // 2. Cast Engine Casing & Bronze Clutch Cover
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.55), engineMat);
    engineBlock.position.set(0, 0.45, -0.05);
    const clutchCover = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16).rotateZ(Math.PI / 2), bronzeMat);
    clutchCover.position.set(0.19, 0.42, 0.05);
    this.playerGroup.add(engineBlock, clutchCover);

    // Curved Racing Radiator behind front wheel
    const radMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.06), darkMetalMat);
    radMesh.position.set(0, 0.52, -0.42);
    this.playerGroup.add(radMesh);

    // 3. Sculpted Ergonomic Fuel Tank with Knee Indents
    const tankGroup = new THREE.Group();
    const tankMain = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.7), bodyMat);
    tankMain.position.set(0, 0.78, -0.05);
    tankGroup.add(tankMain);

    // Tank Racing Stripe
    const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.33, 0.72), accentMat);
    tankStripe.position.set(0, 0.79, -0.05);
    tankGroup.add(tankStripe);

    // Rubber Knee Grip Traction Pads (Left & Right)
    const kneePadL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.35), darkMetalMat);
    kneePadL.position.set(-0.22, 0.76, 0.02);
    const kneePadR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.35), darkMetalMat);
    kneePadR.position.set(0.22, 0.76, 0.02);
    tankGroup.add(kneePadL, kneePadR);

    // Billet Racing Fuel Filler Cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), chromeMat);
    cap.position.set(0, 0.95, -0.15);
    tankGroup.add(cap);
    this.playerGroup.add(tankGroup);

    // 4. Aerodynamic Front Fairing with Ram-Air Scoop & Downforce Winglets
    const noseGroup = new THREE.Group();
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.65, 8).rotateX(Math.PI / 2), bodyMat);
    nose.position.set(0, 0.82, -0.72);
    noseGroup.add(nose);

    // Central Ram-Air Intake Duct
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.1), darkMetalMat);
    intake.position.set(0, 0.8, -0.98);
    noseGroup.add(intake);

    // Twin Angular Headlights (LED DRLs)
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), ledMat);
    headL.position.set(-0.1, 0.84, -0.95);
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), ledMat);
    headR.position.set(0.1, 0.84, -0.95);
    noseGroup.add(headL, headR);

    // Downforce Aerodynamic Winglets (MotoGP Style)
    const wingletL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.22), carbonMat);
    wingletL.position.set(-0.3, 0.78, -0.75);
    wingletL.rotation.z = -0.15;
    const wingletR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.22), carbonMat);
    wingletR.position.set(0.3, 0.78, -0.75);
    wingletR.rotation.z = 0.15;
    noseGroup.add(wingletL, wingletR);

    // Bubble Racing Windscreen
    const screenGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.35, 12, 1, false, 0, Math.PI);
    screenGeo.rotateZ(Math.PI / 2);
    screenGeo.rotateX(0.5);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      roughness: 0.05,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.98, -0.62);
    noseGroup.add(screen);
    this.playerGroup.add(noseGroup);

    // 5. Cockpit: Clip-On Handlebars, Levers & Digital TFT Dash
    const cockpitGroup = new THREE.Group();
    // Triple Clamp
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.08), darkMetalMat);
    clamp.position.set(0, 0.88, -0.52);
    cockpitGroup.add(clamp);

    // Clip-On Bars
    const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8).rotateZ(Math.PI / 2), darkMetalMat);
    barL.position.set(-0.24, 0.87, -0.48);
    barL.rotation.y = 0.2;
    const barR = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8).rotateZ(Math.PI / 2), darkMetalMat);
    barR.position.set(0.24, 0.87, -0.48);
    barR.rotation.y = -0.2;
    cockpitGroup.add(barL, barR);

    // Brake & Clutch Levers
    const leverL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.02), chromeMat);
    leverL.position.set(-0.32, 0.86, -0.52);
    const leverR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.02), chromeMat);
    leverR.position.set(0.32, 0.86, -0.52);
    cockpitGroup.add(leverL, leverR);

    // Digital TFT Dashboard Display Cluster
    const tftHousing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.04), darkMetalMat);
    tftHousing.position.set(0, 0.94, -0.55);
    tftHousing.rotation.x = -0.4;
    const tftScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.09), dashScreenMat);
    tftScreen.position.set(0, 0.94, -0.53);
    tftScreen.rotation.x = -0.4;
    cockpitGroup.add(tftHousing, tftScreen);

    // Aerodynamic Winglet Mirrors
    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), carbonMat);
    mirrorL.position.set(-0.36, 1.02, -0.66);
    mirrorL.rotation.z = -0.25;
    const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), carbonMat);
    mirrorR.position.set(0.36, 1.02, -0.66);
    mirrorR.rotation.z = 0.25;
    cockpitGroup.add(mirrorL, mirrorR);
    this.playerGroup.add(cockpitGroup);

    // 6. Front Wheel Assembly: Gold USD Forks, Dual Rotors & Brembo Calipers
    this.frontWheel = new THREE.Group();
    // Gold Inverted Forks (Öhlins style)
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.65, 12), goldForkMat);
    forkL.position.set(-0.16, 0.58, -0.74);
    forkL.rotation.x = -0.22;
    const forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.65, 12), goldForkMat);
    forkR.position.set(0.16, 0.58, -0.74);
    forkR.rotation.x = -0.22;
    this.playerGroup.add(forkL, forkR);

    // Front Tire Hugger / Fender
    const fenderGeo = new THREE.BoxGeometry(0.24, 0.1, 0.5);
    const fender = new THREE.Mesh(fenderGeo, carbonMat);
    fender.position.set(0, 0.48, -0.8);
    this.playerGroup.add(fender);

    // Front Wheel (17" Racing Slick with 5-Spoke Mag Rim)
    const fTire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 20).rotateZ(Math.PI / 2), tireMat);
    const fRim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.15, 10).rotateZ(Math.PI / 2), carbonMat);
    
    // Dual Drilled Front Brake Discs
    const fDiscL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16).rotateZ(Math.PI / 2), brakeDiscMat);
    fDiscL.position.x = -0.09;
    const fDiscR = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16).rotateZ(Math.PI / 2), brakeDiscMat);
    fDiscR.position.x = 0.09;

    // Dual Red Brembo Radial Brake Calipers
    const fCalL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), caliperMat);
    fCalL.position.set(-0.11, 0.14, -0.06);
    const fCalR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), caliperMat);
    fCalR.position.set(0.11, 0.14, -0.06);

    this.frontWheel.add(fTire, fRim, fDiscL, fDiscR, fCalL, fCalR);
    this.frontWheel.position.set(0, 0.34, -0.8);
    this.playerGroup.add(this.frontWheel);

    // 7. Rear Assembly: Swingarm, Monoshock, Fat Slick & Akrapovič Muffler
    this.rearWheel = new THREE.Group();
    // Wide Rear Racing Slick (200/55)
    const rTire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 20).rotateZ(Math.PI / 2), tireMat);
    const rRim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.25, 10).rotateZ(Math.PI / 2), carbonMat);
    const rSprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16).rotateZ(Math.PI / 2), darkMetalMat);
    rSprocket.position.x = -0.13;
    const rDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).rotateZ(Math.PI / 2), brakeDiscMat);
    rDisc.position.x = 0.13;

    this.rearWheel.add(rTire, rRim, rSprocket, rDisc);
    this.rearWheel.position.set(0, 0.35, 0.68);
    this.playerGroup.add(this.rearWheel);

    // Aluminum Gull-Wing Swingarm
    const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.75), frameMat);
    swingarm.position.set(0, 0.42, 0.32);
    this.playerGroup.add(swingarm);

    // Visible Rear Racing Monoshock with Yellow Coil Spring
    const shockSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.8 }));
    shockSpring.position.set(0, 0.54, 0.2);
    shockSpring.rotation.x = 0.6;
    this.playerGroup.add(shockSpring);

    // Swept-Up High-Angle Titanium/Carbon Performance Exhaust
    const exhaustHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8).rotateX(Math.PI / 2), titaniumMat);
    exhaustHeader.position.set(0.18, 0.36, 0.3);
    exhaustHeader.rotation.x = -0.25;
    const exhaustCan = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 12).rotateX(Math.PI / 2), carbonMat);
    exhaustCan.position.set(0.22, 0.52, 0.62);
    exhaustCan.rotation.x = -0.45;
    // Slanted Carbon Tip
    const exhaustTip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.12, 12).rotateX(Math.PI / 2), titaniumMat);
    exhaustTip.position.set(0.24, 0.65, 0.88);
    exhaustTip.rotation.x = -0.45;
    this.playerGroup.add(exhaustHeader, exhaustCan, exhaustTip);

    // 8. Aerodynamic Monoposto Race Tail & Split LED Taillights
    const tailGroup = new THREE.Group();
    const tailCowl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 6).rotateX(-Math.PI / 2), bodyMat);
    tailCowl.position.set(0, 0.82, 0.55);
    tailCowl.rotation.x = 0.15;
    tailGroup.add(tailCowl);

    // Seat Cushion (Alcantara racing foam)
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.4), darkMetalMat);
    seat.position.set(0, 0.72, 0.2);
    tailGroup.add(seat);

    // Split LED Tail Light Strips (Twin horizontal red blades)
    const tailLightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    tailLightL.position.set(-0.08, 0.86, 0.94);
    const tailLightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    tailLightR.position.set(0.08, 0.86, 0.94);
    tailGroup.add(tailLightL, tailLightR);
    this.playerGroup.add(tailGroup);

    // 9. Professional Racing Rider in Tucked Position
    const riderGroup = new THREE.Group();
    // Torso with Shoulder Armor Sliders & Speed Hump
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.58), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.65 }));
    torso.position.set(0, 1.05, 0.08);
    torso.rotation.x = 0.42; // aggressive tuck

    // Shoulder Titanium Sliders
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), chromeMat);
    shoulderL.position.set(-0.21, 1.15, -0.05);
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), chromeMat);
    shoulderR.position.set(0.21, 1.15, -0.05);

    // Aerodynamic Speed Hump on back of leathers
    const speedHump = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
    speedHump.position.set(0, 1.22, 0.22);
    speedHump.rotation.x = 0.35;

    // Racing Helmet with Rear Aerodynamic Spoiler & Reflective Visor
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), accentMat);
    helmet.position.set(0, 1.38, -0.16);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.12), carbonMat);
    spoiler.position.set(0, 1.42, -0.02);
    spoiler.rotation.x = 0.3;

    // Iridescent Mirror Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.14), new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.95, roughness: 0.05 }));
    visor.position.set(0, 1.38, -0.28);

    // Arms gripping clip-ons
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.45, 8).rotateZ(0.5).rotateX(0.4), darkMetalMat);
    armL.position.set(-0.24, 0.96, -0.26);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.45, 8).rotateZ(-0.5).rotateX(0.4), darkMetalMat);
    armR.position.set(0.24, 0.96, -0.26);

    riderGroup.add(torso, shoulderL, shoulderR, speedHump, helmet, spoiler, visor, armL, armR);
    this.playerGroup.add(riderGroup);

    // 10. Forward Headlight & Dynamic Spotlight
    this.headlightSpot = new THREE.SpotLight(0xffffff, 5.5, 55, 0.42, 0.65);
    this.headlightSpot.position.set(0, 0.78, -0.9);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0, -30);
    this.scene.add(targetObj);
    this.headlightSpot.target = targetObj;
    this.playerGroup.add(this.headlightSpot);

    // 11. Invulnerability Energy Shield Mesh
    this.shieldMesh = new THREE.Group();
    const shieldGeo = new THREE.IcosahedronGeometry(1.65, 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const sCore = new THREE.Mesh(shieldGeo, shieldMat);
    const sRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    sRing.rotation.x = Math.PI / 2;
    this.shieldMesh.add(sCore, sRing);
    this.shieldMesh.position.set(0, 0.8, 0);
    this.playerGroup.add(this.shieldMesh);
  }

  private spawnInitialTraffic() {
    this.spawnTrafficVehicle(-35);
    this.spawnTrafficVehicle(-65);
    this.spawnTrafficVehicle(-95);
  }

  public spawnTrafficVehicle(customZ?: number) {
    const lane = Math.floor(Math.random() * this.levelConfig.lanes);
    const laneX = -this.roadWidth / 2 + lane * this.laneWidth + this.laneWidth / 2;

    const archetype = this.levelConfig.allowedVehicles[
      Math.floor(Math.random() * this.levelConfig.allowedVehicles.length)
    ];
    const speed = Math.floor(
      Math.random() * (this.levelConfig.maxSpeed - this.levelConfig.minSpeed) + this.levelConfig.minSpeed
    );

    const spawnZ = customZ !== undefined ? customZ : -110;

    const group = new THREE.Group();
    group.position.set(laneX, 0, spawnZ);
    this.scene.add(group);

    const { width, length, brakeLight } = this.buildVehicle3DMesh(group, archetype);

    const vehicleObj: Traffic3DVehicle = {
      group,
      type: archetype,
      lane,
      speedKmh: speed,
      width,
      length,
      nearMissed: false,
      changingLane: false,
      targetLaneX: laneX,
      brakeLightMesh: brakeLight,
    };

    if (this.levelConfig.id >= 5 && Math.random() < 0.3) {
      const adjLane = lane > 0 && Math.random() < 0.5 ? lane - 1 : Math.min(this.levelConfig.lanes - 1, lane + 1);
      if (adjLane !== lane) {
        vehicleObj.changingLane = true;
        vehicleObj.targetLaneX = -this.roadWidth / 2 + adjLane * this.laneWidth + this.laneWidth / 2;
      }
    }

    this.trafficVehicles.push(vehicleObj);
  }

  private buildVehicle3DMesh(
    group: THREE.Group,
    type: VehicleArchetype
  ): { width: number; length: number; brakeLight?: THREE.Mesh } {
    let width = 1.9;
    let length = 4.4;
    let height = 1.4;
    let bodyColorHex = 0xd97706;

    if (type === 'sportscar') {
      width = 2.0;
      length = 4.5;
      height = 1.15;
      bodyColorHex = 0xef4444;
    } else if (type === 'suv') {
      width = 2.1;
      length = 4.8;
      height = 1.7;
      bodyColorHex = 0x2563eb;
    } else if (type === 'truck') {
      width = 2.4;
      length = 7.5;
      height = 2.8;
      bodyColorHex = 0x7c3aed;
    } else if (type === 'tanker') {
      width = 2.5;
      length = 9.0;
      height = 2.7;
      bodyColorHex = 0x94a3b8;
    } else if (type === 'police') {
      width = 2.0;
      length = 4.6;
      height = 1.45;
      bodyColorHex = 0x0284c7;
    } else if (type === 'bus') {
      width = 2.6;
      length = 10.5;
      height = 3.1;
      bodyColorHex = 0xf97316;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColorHex,
      roughness: 0.3,
      metalness: 0.6,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.8,
    });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // Chassis Box
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(width, height * 0.55, length),
      bodyMat
    );
    chassis.position.y = height * 0.35;
    group.add(chassis);

    // Cabin / Roof
    const cabinLength = type === 'truck' || type === 'tanker' ? length * 0.35 : length * 0.6;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, height * 0.5, cabinLength),
      glassMat
    );
    cabin.position.set(0, height * 0.75, type === 'truck' || type === 'tanker' ? -length * 0.25 : -length * 0.05);
    group.add(cabin);

    // Wheels (4 cylinders)
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-width / 2, 0.36, -length * 0.35);
    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(width / 2, 0.36, -length * 0.35);
    const wRL = new THREE.Mesh(wheelGeo, wheelMat);
    wRL.position.set(-width / 2, 0.36, length * 0.35);
    const wRR = new THREE.Mesh(wheelGeo, wheelMat);
    wRR.position.set(width / 2, 0.36, length * 0.35);
    group.add(wFL, wFR, wRL, wRR);

    // Red Tail Lights (facing motorcycle player)
    const brakeLight = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.75, 0.1, 0.05),
      tailMat
    );
    brakeLight.position.set(0, height * 0.45, length / 2 + 0.02);
    group.add(brakeLight);

    // Police flashing lights
    if (type === 'police') {
      const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      redLight.position.set(-0.35, height * 1.05, -length * 0.05);
      const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
      blueLight.position.set(0.35, height * 1.05, -length * 0.05);
      group.add(redLight, blueLight);
    }

    return { width, length, brakeLight };
  }

  // Swipe & Touch Drag Steering State
  private isPointerDown: boolean = false;
  private pointerStartX: number = 0;
  private pointerStartTargetX: number = 0;

  private setupInputListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Fullscreen responsive swipe & touch drag
    window.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.closest('button')) return;
    if (!this.isRunning || this.isCrashed) return;

    this.isPointerDown = true;
    this.pointerStartX = e.clientX;
    this.pointerStartTargetX = this.playerTargetX;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown || !this.isRunning || this.isCrashed) return;
    const deltaX = e.clientX - this.pointerStartX;
    const screenWidth = this.container.clientWidth || window.innerWidth || 400;
    // Dragging across ~60% of the screen width smoothly traverses the full width of the highway
    const sensitivity = (this.roadWidth / (screenWidth * 0.6));
    const roadBoundary = this.roadWidth / 2 - 0.7;

    this.playerTargetX = THREE.MathUtils.clamp(
      this.pointerStartTargetX + deltaX * sensitivity,
      -roadBoundary,
      roadBoundary
    );
  };

  private handlePointerUp = () => {
    this.isPointerDown = false;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.isSteeringLeft = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.isSteeringRight = true;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') this.isBraking = true;
    if (e.key === ' ' || e.key === 'Shift') this.isBoosting = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this.isSteeringLeft = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this.isSteeringRight = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') this.isBraking = false;
    if (e.key === ' ' || e.key === 'Shift') this.isBoosting = false;
  };

  private handleResize = () => {
    if (this.isDestroyed || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private startLoop() {
    let lastTime = performance.now();

    const tick = () => {
      if (this.isDestroyed) return;

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (isSoftwareGl) {
        // Pace loop on software WebGL
        this.frameId = window.setTimeout(tick, 30);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 30);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number) {
    if (!this.isRunning || this.isCrashed || this.isCompleted) return;

    this.elapsedTimeSeconds += dt;

    // Shield countdown
    if (this.shieldTimeRemaining > 0) {
      this.shieldTimeRemaining = Math.max(0, this.shieldTimeRemaining - dt);
      this.shieldMesh.visible = true;
      this.shieldMesh.rotation.y += dt * 3;
      this.shieldMesh.rotation.x += dt * 1.5;
    } else {
      this.shieldMesh.visible = false;
    }

    // 1. Process Controls & Acceleration
    this.handleBikeKinematics(dt);

    // 2. Road Scrolling & World Shift
    const speedMs = this.playerSpeedKmh / 3.6;
    const distanceDelta = speedMs * dt;
    this.distanceTraveledMeters += distanceDelta;
    this.score += Math.round(distanceDelta * (this.playerSpeedKmh / 75));

    // Scroll road segments along +Z relative to bike
    for (const segment of this.roadSegments) {
      segment.position.z += distanceDelta;
      if (segment.position.z > 30) {
        segment.position.z -= 240; // loop back 4 * 60 = 240
      }
    }

    // Spin bike wheels
    this.frontWheel.rotation.x -= speedMs * dt * 2.5;
    this.rearWheel.rotation.x -= speedMs * dt * 2.5;

    // 3. Traffic Logic & Physics
    this.updateTraffic(dt, speedMs);

    // 4. Update 3D Camera Follow Rig
    this.updateCameraFollow(dt);

    // 5. Update Particle Effects
    this.updateParticles(dt);

    // 6. Check Level Goal
    if (this.distanceTraveledMeters >= this.levelConfig.targetDistance && !this.isCompleted) {
      this.isCompleted = true;
      this.isRunning = false;
      sound.playVictory();
      telegram.hapticNotification('success');
      this.callbacks.onVictory({
        distance: Math.round(this.distanceTraveledMeters),
        score: this.score,
        nearMisses: this.nearMissCount,
        timeElapsed: Math.round(this.elapsedTimeSeconds),
      });
    }

    // 7. Update HUD Telemetry
    this.callbacks.onStatsUpdate({
      score: this.score,
      distance: this.distanceTraveledMeters,
      speedKmh: Math.round(this.playerSpeedKmh),
      nearMisses: this.nearMissCount,
      coinsEarned: Math.floor(this.score / 25),
      timeElapsedSeconds: Math.round(this.elapsedTimeSeconds),
      nitroPercent: Math.round(this.nitroCharge),
    });
  }

  private handleBikeKinematics(dt: number) {
    const steerSpeed = (this.bikeModel.handling / 100) * 12;
    if (this.isSteeringLeft) this.playerTargetX -= steerSpeed * dt;
    if (this.isSteeringRight) this.playerTargetX += steerSpeed * dt;

    // Road boundaries: roadWidth / 2
    const roadBoundary = this.roadWidth / 2 - 0.7;
    this.playerTargetX = THREE.MathUtils.clamp(this.playerTargetX, -roadBoundary, roadBoundary);

    // Smooth lateral movement towards targetX
    const dx = this.playerTargetX - this.playerX;
    this.playerX += dx * Math.min(1, dt * 14);

    // Dynamic 3D Bike Banking / Lean Roll Angle
    const targetRoll = THREE.MathUtils.clamp((dx / 1.5) * 0.38, -0.42, 0.42);
    this.bikeRoll = THREE.MathUtils.damp(this.bikeRoll, targetRoll, 12, dt);

    this.playerGroup.position.x = this.playerX;
    this.playerGroup.rotation.z = -this.bikeRoll;
    this.playerGroup.rotation.y = -this.bikeRoll * 0.25;

    // Check guardrail collision if no active shield
    if (this.shieldTimeRemaining <= 0) {
      const guardrailThreshold = this.roadWidth / 2 - 0.75;
      if (Math.abs(this.playerX) >= guardrailThreshold) {
        this.triggerCrash();
        return;
      }
    }

    // Acceleration & Nitro
    const accelRate = (this.bikeModel.acceleration / 100) * 35;
    const maxSpeed = this.bikeModel.maxSpeedKmh;

    if (this.isBoosting && this.nitroCharge > 5) {
      this.playerSpeedKmh = Math.min(maxSpeed * 1.25, this.playerSpeedKmh + accelRate * 2.2 * dt);
      this.nitroCharge = Math.max(0, this.nitroCharge - 28 * dt);
      sound.playNitro();
      this.spawnNitroParticles();
    } else {
      this.nitroCharge = Math.min(100, this.nitroCharge + 10 * dt);
      if (this.isBraking) {
        this.playerSpeedKmh = Math.max(45, this.playerSpeedKmh - 95 * dt);
        sound.playBrake();
      } else {
        if (this.playerSpeedKmh < maxSpeed) {
          this.playerSpeedKmh = Math.min(maxSpeed, this.playerSpeedKmh + accelRate * dt);
        }
      }
    }

    sound.updateEnginePitch(this.playerSpeedKmh / maxSpeed, this.isBoosting && this.nitroCharge > 5);
  }

  private updateCameraFollow(dt: number) {
    // 3rd person elevated chase camera: smooth follow
    const targetCamX = this.playerX * 0.65;
    const targetCamY = 2.7 + (this.isBoosting ? 0.25 : 0);
    const targetCamZ = 4.5 + (this.isBoosting ? 0.35 : 0);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 8, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 8, dt);

    // Subtle camera roll tied to bike lean
    this.camera.rotation.z = -this.bikeRoll * 0.2;
    this.camera.lookAt(this.playerX * 0.35, 1.15, -12);
  }

  private updateTraffic(dt: number, playerSpeedMs: number) {
    // 1. Spawning
    const spawnThresholdMeters = 30 / this.levelConfig.trafficDensity;
    if (this.distanceTraveledMeters - this.lastTrafficSpawnDistance > spawnThresholdMeters) {
      this.spawnTrafficVehicle(-110);
      this.lastTrafficSpawnDistance = this.distanceTraveledMeters;
    }

    // 2. Move & Update Existing 3D Vehicles
    for (let i = this.trafficVehicles.length - 1; i >= 0; i--) {
      const v = this.trafficVehicles[i];

      // Relative motion in world coordinates:
      // Player is at Z = 0 moving forward. Relative approach speed = (playerSpeed - vehicleSpeed)
      const relSpeedKmh = this.playerSpeedKmh - v.speedKmh;
      const relSpeedMs = relSpeedKmh / 3.6;
      v.group.position.z += relSpeedMs * dt;

      // Lane change motion
      if (v.changingLane) {
        const dx = v.targetLaneX - v.group.position.x;
        v.group.position.x += dx * Math.min(1, dt * 2.5);
        if (Math.abs(dx) < 0.1) v.changingLane = false;
      }

      // 3. Collision Check (X & Z 3D Bounding Box)
      const dx = Math.abs(this.playerX - v.group.position.x);
      const dz = Math.abs(0 - v.group.position.z);

      const collisionThresholdX = (0.7 + v.width) / 2;
      const collisionThresholdZ = (1.8 + v.length) / 2;

      if (this.shieldTimeRemaining <= 0 && dx < collisionThresholdX && dz < collisionThresholdZ) {
        this.triggerCrash();
        return;
      }

      // 4. Near-Miss Check: tight alongside gap
      if (!v.nearMissed && dz < collisionThresholdZ + 0.8 && dx < collisionThresholdX + 0.85 && dx > collisionThresholdX - 0.2) {
        v.nearMissed = true;
        this.triggerNearMiss(v.group.position.x, v.group.position.z);
      }

      // 5. Cleanup vehicles that passed far behind or ahead
      if (v.group.position.z > 25 || v.group.position.z < -160) {
        this.scene.remove(v.group);
        this.trafficVehicles.splice(i, 1);
      }
    }
  }

  private triggerNearMiss(trafficX: number, trafficZ: number) {
    this.nearMissCount++;
    this.comboStreak++;
    this.comboTimer = 2.5;

    const bonus = calculateNearMissBonus(this.playerSpeedKmh, this.comboStreak);
    this.score += bonus;

    sound.playNearMiss();
    telegram.hapticImpact('light');

    // Spawn 3D spark particles
    for (let i = 0; i < 8; i++) {
      const pGeo = new THREE.SphereGeometry(0.06, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set((this.playerX + trafficX) / 2, 0.8, trafficZ);
      this.scene.add(p);
      this.exhaustParticles.push({
        mesh: p,
        life: 0.35,
        maxLife: 0.35,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        vz: (Math.random() - 0.5) * 4,
      });
    }
  }

  private triggerCrash() {
    this.isCrashed = true;
    this.isRunning = false;

    sound.playCrash();
    telegram.hapticImpact('heavy');
    telegram.hapticNotification('error');

    // Crash spinout in 3D
    this.playerGroup.rotation.z = Math.PI / 2;
    this.playerGroup.rotation.y = 0.8;
    this.playerGroup.position.y = 0.2;

    // Spawn 3D explosion debris
    for (let i = 0; i < 20; i++) {
      const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xef4444 : 0xf59e0b,
      });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.copy(this.playerGroup.position);
      p.position.y += 0.5;
      this.scene.add(p);
      this.exhaustParticles.push({
        mesh: p,
        life: 0.7,
        maxLife: 0.7,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 2,
        vz: (Math.random() - 0.5) * 8,
      });
    }

    setTimeout(() => {
      this.callbacks.onGameOver({
        distance: Math.round(this.distanceTraveledMeters),
        score: this.score,
        nearMisses: this.nearMissCount,
      });
    }, 650);
  }

  private spawnNitroParticles() {
    const pGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const p = new THREE.Mesh(pGeo, pMat);
    p.position.set(this.playerX + (Math.random() * 0.2 - 0.1), 0.4, 0.9);
    this.scene.add(p);
    this.exhaustParticles.push({
      mesh: p,
      life: 0.25,
      maxLife: 0.25,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: Math.random() * 8 + 4,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
      const p = this.exhaustParticles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.exhaustParticles.splice(i, 1);
      }
    }
  }

  // --- External Control APIs ---

  public setSteerLeft(active: boolean) {
    this.isSteeringLeft = active;
  }

  public setSteerRight(active: boolean) {
    this.isSteeringRight = active;
  }

  public setBrake(active: boolean) {
    this.isBraking = active;
  }

  public setBoost(active: boolean) {
    this.isBoosting = active;
  }

  public setPaused(paused: boolean) {
    this.isRunning = !paused;
    if (paused) sound.stopEngine();
    else sound.startEngine();
  }

  /**
   * Resumes gameplay after verified Adsgram Rewarded Ad completion!
   * Restores bike to center lane, equips 3.5s golden rotating shield, and clears traffic ahead.
   */
  public continueFromRevive() {
    this.isCrashed = false;
    this.isRunning = true;

    // Reset bike position & roll
    this.playerX = 0;
    this.playerTargetX = 0;
    this.bikeRoll = 0;
    this.playerGroup.position.set(0, 0, 0);
    this.playerGroup.rotation.set(0, 0, 0);

    this.playerSpeedKmh = 70;
    this.shieldTimeRemaining = 3.5;

    // Clear vehicles near the player
    for (let i = this.trafficVehicles.length - 1; i >= 0; i--) {
      const v = this.trafficVehicles[i];
      if (v.group.position.z > -45 && v.group.position.z < 15) {
        this.scene.remove(v.group);
        this.trafficVehicles.splice(i, 1);
      }
    }

    sound.startEngine();
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);

    sound.stopEngine();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
