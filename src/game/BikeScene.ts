import * as Phaser from 'phaser';
import { LevelConfig, BikeModel, PlayerStats, VehicleArchetype } from '../types/game';
import { ALL_LEVELS, ALL_BIKES } from './levels';
import { checkCollision, checkNearMiss, calculateNearMissBonus } from './rules';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

export interface TrafficVehicle {
  sprite: Phaser.GameObjects.Container;
  type: VehicleArchetype;
  lane: number;
  speedKmh: number;
  width: number;
  height: number;
  nearMissed: boolean;
  changingLane: boolean;
  targetLaneX: number;
}

export interface GameCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onGameOver: (finalStats: { distance: number; score: number; nearMisses: number }) => void;
  onVictory: (finalStats: { distance: number; score: number; nearMisses: number; timeElapsed: number }) => void;
}

export class BikeScene extends Phaser.Scene {
  private levelConfig!: LevelConfig;
  private bikeModel!: BikeModel;
  private callbacks!: GameCallbacks;

  // Road & Rendering
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private roadOffset: number = 0;
  private roadWidth: number = 320;
  private roadX: number = 60; // centered in 440 width: (440 - 320) / 2 = 60
  private laneWidth: number = 80;

  // Player Bike
  private bikeContainer!: Phaser.GameObjects.Container;
  private bikeGraphics!: Phaser.GameObjects.Graphics;
  private bikeHeadlight!: Phaser.GameObjects.Graphics;
  private shieldGraphics!: Phaser.GameObjects.Graphics;
  private playerX: number = 220;
  private playerY: number = 620;
  private playerTargetX: number = 220;
  private playerSpeedKmh: number = 0;
  private currentAngle: number = 0;

  // Boost & Nitro
  private nitroCharge: number = 100;
  private isBoosting: boolean = false;
  private isBraking: boolean = false;
  private isSteeringLeft: boolean = false;
  private isSteeringRight: boolean = false;

  // Shield
  private shieldTimeRemaining: number = 0;

  // Traffic
  private trafficVehicles: TrafficVehicle[] = [];
  private lastTrafficSpawnDistance: number = 0;

  // Stats
  private distanceTraveledMeters: number = 0;
  private score: number = 0;
  private nearMissCount: number = 0;
  private comboStreak: number = 0;
  private comboTimer: number = 0;
  private elapsedTimeSeconds: number = 0;

  // State flags
  private isRunning: boolean = false;
  private isCrashed: boolean = false;
  private isCompleted: boolean = false;

  // Input keys
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  // Particle emitters / text popups
  private exhaustParticles: Array<{ x: number; y: number; life: number; maxLife: number; vx: number; vy: number; color: number }> = [];
  private particleGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('BikeScene');
  }

  public init(data?: { levelConfig?: LevelConfig; bikeModel?: BikeModel; callbacks?: GameCallbacks }) {
    this.levelConfig = data?.levelConfig || ALL_LEVELS[0];
    this.bikeModel = data?.bikeModel || ALL_BIKES[0];
    this.callbacks = data?.callbacks || {
      onStatsUpdate: () => {},
      onGameOver: () => {},
      onVictory: () => {},
    };

    this.roadWidth = this.levelConfig.lanes * 70;
    this.roadX = (440 - this.roadWidth) / 2;
    this.laneWidth = this.roadWidth / this.levelConfig.lanes;

    this.playerX = 220;
    this.playerTargetX = 220;
    this.playerSpeedKmh = 60;
    this.distanceTraveledMeters = 0;
    this.score = 0;
    this.nearMissCount = 0;
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.nitroCharge = 100;
    this.isRunning = true;
    this.isCrashed = false;
    this.isCompleted = false;
    this.shieldTimeRemaining = 1.5; // brief 1.5s spawn shield
    this.elapsedTimeSeconds = 0;
  }

  public create() {
    // Background layer
    this.createBackground();

    // Road layer
    this.roadGraphics = this.add.graphics();

    // Particle graphics
    this.particleGraphics = this.add.graphics();

    // Build player bike container
    this.createPlayerBike();

    // Setup input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    // Touch / pointer drag steering on game canvas
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isRunning || this.isCrashed) return;
      if (pointer.isDown) {
        // Clamp to road boundaries
        const minX = this.roadX + 16;
        const maxX = this.roadX + this.roadWidth - 16;
        this.playerTargetX = Phaser.Math.Clamp(pointer.x, minX, maxX);
      }
    });

    // Spawn initial vehicles ahead
    this.spawnTrafficVehicle(180);
    this.spawnTrafficVehicle(340);

    // Start audio
    sound.startEngine();
  }

  private createBackground() {
    const bg = this.add.graphics();
    const theme = this.levelConfig.theme;

    let topColor = 0x090d16;
    let bottomColor = 0x0f172a;
    let grassColor = 0x064e3b;

    if (theme === 'sunset') {
      topColor = 0x4c0519;
      bottomColor = 0x831843;
      grassColor = 0x1c1917;
    } else if (theme === 'dawn') {
      topColor = 0x1e1b4b;
      bottomColor = 0xc2410c;
      grassColor = 0x1e293b;
    } else if (theme === 'cyber') {
      topColor = 0x1e1b4b;
      bottomColor = 0x4a044e;
      grassColor = 0x050515;
    } else if (theme === 'rain') {
      topColor = 0x0f172a;
      bottomColor = 0x1e293b;
      grassColor = 0x0f231e;
    }

    // Roadside shoulder fills
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, 440, 780);

    // Subtle roadside terrain texture
    bg.fillStyle(grassColor, 0.4);
    bg.fillRect(0, 0, 440, 780);
  }

  private createPlayerBike() {
    this.bikeContainer = this.add.container(this.playerX, this.playerY);

    // Headlight cone
    this.bikeHeadlight = this.add.graphics();
    this.bikeHeadlight.fillStyle(0xffffff, 0.12);
    this.bikeHeadlight.beginPath();
    this.bikeHeadlight.moveTo(0, -20);
    this.bikeHeadlight.lineTo(-50, -180);
    this.bikeHeadlight.lineTo(50, -180);
    this.bikeHeadlight.closePath();
    this.bikeHeadlight.fill();
    this.bikeContainer.add(this.bikeHeadlight);

    // Bike Body Graphics
    this.bikeGraphics = this.add.graphics();
    this.drawBikeModel();
    this.bikeContainer.add(this.bikeGraphics);

    // Shield Aura Graphics
    this.shieldGraphics = this.add.graphics();
    this.bikeContainer.add(this.shieldGraphics);
  }

  private drawBikeModel() {
    this.bikeGraphics.clear();
    const colorHex = parseInt(this.bikeModel.color.replace('#', '0x'), 16);
    const accentHex = parseInt(this.bikeModel.accentColor.replace('#', '0x'), 16);

    // Shadow
    this.bikeGraphics.fillStyle(0x000000, 0.45);
    this.bikeGraphics.fillEllipse(0, 6, 26, 46);

    // Rear Tire
    this.bikeGraphics.fillStyle(0x18181b, 1);
    this.bikeGraphics.fillRoundedRect(-5, 12, 10, 20, 3);

    // Front Tire
    this.bikeGraphics.fillStyle(0x18181b, 1);
    this.bikeGraphics.fillRoundedRect(-4, -26, 8, 18, 3);

    // Twin Exhausts
    this.bikeGraphics.fillStyle(0x71717a, 1);
    this.bikeGraphics.fillRect(-8, 16, 3, 10);
    this.bikeGraphics.fillRect(5, 16, 3, 10);

    // Chassis Frame
    this.bikeGraphics.fillStyle(0x27272a, 1);
    this.bikeGraphics.fillRoundedRect(-7, -10, 14, 26, 4);

    // Fairing & Tank (Custom color)
    this.bikeGraphics.fillStyle(colorHex, 1);
    this.bikeGraphics.fillTriangle(0, -24, -10, 4, 10, 4);
    this.bikeGraphics.fillRoundedRect(-9, -8, 18, 16, 4);

    // Accent Stripes
    this.bikeGraphics.fillStyle(accentHex, 1);
    this.bikeGraphics.fillRect(-8, -4, 16, 3);

    // Rider Torso (Black leather racing suit)
    this.bikeGraphics.fillStyle(0x09090b, 1);
    this.bikeGraphics.fillRoundedRect(-8, -2, 16, 14, 4);

    // Rider Helmet with Neon Visor
    this.bikeGraphics.fillStyle(accentHex, 1);
    this.bikeGraphics.fillCircle(0, -6, 6);
    this.bikeGraphics.fillStyle(0x000000, 0.85);
    this.bikeGraphics.fillEllipse(0, -7, 8, 4);

    // Handlebars & Mirrors
    this.bikeGraphics.fillStyle(0xa1a1aa, 1);
    this.bikeGraphics.fillRect(-13, -15, 26, 2);
    // Mirror tips
    this.bikeGraphics.fillRect(-14, -17, 2, 4);
    this.bikeGraphics.fillRect(12, -17, 2, 4);

    // Tail Brake Light
    this.bikeGraphics.fillStyle(0xef4444, 1);
    this.bikeGraphics.fillRoundedRect(-5, 20, 10, 3, 1);
  }

  private drawShield() {
    this.shieldGraphics.clear();
    if (this.shieldTimeRemaining > 0) {
      const alpha = 0.4 + 0.3 * Math.sin(this.time.now * 0.015);
      this.shieldGraphics.lineStyle(3, 0x38bdf8, alpha);
      this.shieldGraphics.strokeCircle(0, 0, 32);
      this.shieldGraphics.fillStyle(0x38bdf8, alpha * 0.2);
      this.shieldGraphics.fillCircle(0, 0, 32);

      // Rotating shield energy nodes
      const nodeAngle = (this.time.now * 0.005) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = nodeAngle + (i * Math.PI * 2) / 3;
        const nx = Math.cos(a) * 32;
        const ny = Math.sin(a) * 32;
        this.shieldGraphics.fillStyle(0xfacc15, 0.9);
        this.shieldGraphics.fillCircle(nx, ny, 3);
      }
    }
  }

  public update(time: number, delta: number) {
    if (!this.isRunning || this.isCrashed || this.isCompleted) return;

    const dtSeconds = Math.min(delta / 1000, 0.05);
    this.elapsedTimeSeconds += dtSeconds;

    // Handle shield countdown
    if (this.shieldTimeRemaining > 0) {
      this.shieldTimeRemaining = Math.max(0, this.shieldTimeRemaining - dtSeconds);
    }
    this.drawShield();

    // 1. Process Steering & Acceleration Inputs
    this.handleControls(dtSeconds);

    // 2. Physics & Kinematics
    this.updateBikePhysics(dtSeconds);

    // 3. Render Road Scrolling
    this.renderRoad();

    // 4. Update & Spawn Traffic
    this.updateTraffic(dtSeconds);

    // 5. Update Particle Exhaust & Effects
    this.updateParticles(dtSeconds);

    // 6. Check Distance & Objectives
    this.checkMilestones();

    // 7. Push telemetry to React HUD
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

  private handleControls(dt: number) {
    // Keyboard inputs
    const isLeftPressed =
      this.isSteeringLeft ||
      (this.cursors && (this.cursors.left.isDown || this.keyA?.isDown));
    const isRightPressed =
      this.isSteeringRight ||
      (this.cursors && (this.cursors.right.isDown || this.keyD?.isDown));
    const isUpPressed =
      this.cursors && (this.cursors.up.isDown || this.keyW?.isDown);
    const isDownPressed =
      this.isBraking ||
      (this.cursors && (this.cursors.down.isDown || this.keyS?.isDown));
    const isBoostTriggered =
      this.isBoosting ||
      (this.keySpace?.isDown || this.keyShift?.isDown);

    // Lateral Steering
    const steerSpeed = (this.bikeModel.handling / 100) * 260;
    if (isLeftPressed) {
      this.playerTargetX -= steerSpeed * dt;
    }
    if (isRightPressed) {
      this.playerTargetX += steerSpeed * dt;
    }

    // Clamp to road shoulders
    const minX = this.roadX + 8;
    const maxX = this.roadX + this.roadWidth - 8;
    this.playerTargetX = Phaser.Math.Clamp(this.playerTargetX, minX, maxX);

    // Acceleration & Braking
    const accelRate = (this.bikeModel.acceleration / 100) * 55;
    const maxSpeed = this.bikeModel.maxSpeedKmh;

    if (isBoostTriggered && this.nitroCharge > 5) {
      // NITRO BOOST
      this.playerSpeedKmh = Math.min(maxSpeed * 1.25, this.playerSpeedKmh + accelRate * 2.2 * dt);
      this.nitroCharge = Math.max(0, this.nitroCharge - 28 * dt);
      sound.playNitro();
      this.spawnNitroParticles();
    } else {
      // Natural nitro regeneration
      this.nitroCharge = Math.min(100, this.nitroCharge + 10 * dt);

      if (isDownPressed) {
        // BRAKING
        this.playerSpeedKmh = Math.max(45, this.playerSpeedKmh - 120 * dt);
        sound.playBrake();
      } else if (isUpPressed || true) {
        // Auto-cruising throttle up to top speed
        if (this.playerSpeedKmh < maxSpeed) {
          this.playerSpeedKmh = Math.min(maxSpeed, this.playerSpeedKmh + accelRate * dt);
        }
      }
    }

    // Audio update
    const speedRatio = this.playerSpeedKmh / maxSpeed;
    sound.updateEnginePitch(speedRatio, isBoostTriggered && this.nitroCharge > 5);
  }

  private updateBikePhysics(dt: number) {
    // Smooth lateral movement towards playerTargetX
    const dx = this.playerTargetX - this.playerX;
    this.playerX += dx * Math.min(1, dt * 14);

    // Calculate dynamic bike lean banking angle
    const targetAngle = Phaser.Math.Clamp((dx / 40) * 16, -18, 18);
    this.currentAngle = Phaser.Math.Linear(this.currentAngle, targetAngle, dt * 12);

    this.bikeContainer.setPosition(this.playerX, this.playerY);
    this.bikeContainer.setAngle(this.currentAngle);

    // Guardrail barrier collision check
    if (this.shieldTimeRemaining <= 0) {
      if (this.playerX <= this.roadX + 11 || this.playerX >= this.roadX + this.roadWidth - 11) {
        this.triggerCrash();
        return;
      }
    }

    // Distance progression (convert km/h to m/s: km/h / 3.6)
    const speedMs = this.playerSpeedKmh / 3.6;
    const distanceDelta = speedMs * dt;
    this.distanceTraveledMeters += distanceDelta;

    // Score from distance traveled with speed bonus
    this.score += Math.round(distanceDelta * (this.playerSpeedKmh / 75));

    // Combo timer decay
    if (this.comboStreak > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboStreak = 0;
      }
    }

    // Road scroll offset
    this.roadOffset = (this.roadOffset + distanceDelta * 8) % 80;
  }

  private renderRoad() {
    this.roadGraphics.clear();

    const roadL = this.roadX;
    const roadR = this.roadX + this.roadWidth;
    const roadH = 780;

    // Asphalt base
    this.roadGraphics.fillStyle(0x1e293b, 1);
    this.roadGraphics.fillRect(roadL, 0, this.roadWidth, roadH);

    // Guardrails / Sidewalk curbs
    this.roadGraphics.fillStyle(0x64748b, 1);
    this.roadGraphics.fillRect(roadL - 8, 0, 8, roadH);
    this.roadGraphics.fillRect(roadR, 0, 8, roadH);

    // Guardrail reflective markers
    const markerSpacing = 40;
    for (let y = (this.roadOffset % markerSpacing) - markerSpacing; y < roadH + markerSpacing; y += markerSpacing) {
      this.roadGraphics.fillStyle(0xfacc15, 0.9);
      this.roadGraphics.fillRect(roadL - 6, y, 4, 12);
      this.roadGraphics.fillRect(roadR + 2, y, 4, 12);
    }

    // Solid outer shoulder lines
    this.roadGraphics.fillStyle(0xf8fafc, 0.9);
    this.roadGraphics.fillRect(roadL + 4, 0, 3, roadH);
    this.roadGraphics.fillRect(roadR - 7, 0, 3, roadH);

    // Dashed Lane Dividers
    const dashLength = 28;
    const dashGap = 32;
    const dashCycle = dashLength + dashGap;
    const offset = (this.roadOffset % dashCycle) - dashCycle;

    this.roadGraphics.fillStyle(0xe2e8f0, 0.65);
    for (let laneIdx = 1; laneIdx < this.levelConfig.lanes; laneIdx++) {
      const dividerX = roadL + laneIdx * this.laneWidth;
      for (let y = offset; y < roadH + dashCycle; y += dashCycle) {
        this.roadGraphics.fillRect(dividerX - 1.5, y, 3, dashLength);
      }
    }
  }

  private updateTraffic(dt: number) {
    // 1. Check Spawning
    const spawnThresholdMeters = 30 / this.levelConfig.trafficDensity;
    if (this.distanceTraveledMeters - this.lastTrafficSpawnDistance > spawnThresholdMeters) {
      this.spawnTrafficVehicle();
      this.lastTrafficSpawnDistance = this.distanceTraveledMeters;
    }

    // 2. Move & Update Existing Vehicles
    const playerBox = {
      x: this.playerX,
      y: this.playerY,
      width: 20,
      height: 44,
    };

    for (let i = this.trafficVehicles.length - 1; i >= 0; i--) {
      const vehicle = this.trafficVehicles[i];

      // Relative motion: player is traveling at playerSpeedKmh, vehicle at vehicle.speedKmh
      // When player is faster, vehicle moves DOWN the screen towards player
      const relativeSpeedKmh = this.playerSpeedKmh - vehicle.speedKmh;
      const relativeSpeedMs = relativeSpeedKmh / 3.6;
      const pixelMovement = relativeSpeedMs * dt * 8; // scaling factor to pixels

      vehicle.sprite.y += pixelMovement;

      // Handle lane switching behavior
      if (vehicle.changingLane) {
        const dx = vehicle.targetLaneX - vehicle.sprite.x;
        vehicle.sprite.x += dx * Math.min(1, dt * 2.5);
        if (Math.abs(dx) < 2) {
          vehicle.changingLane = false;
        }
      }

      const vehicleBox = {
        x: vehicle.sprite.x,
        y: vehicle.sprite.y,
        width: vehicle.width,
        height: vehicle.height,
      };

      // 3. Collision Check (if no active shield)
      if (this.shieldTimeRemaining <= 0 && checkCollision(playerBox, vehicleBox)) {
        this.triggerCrash();
        return;
      }

      // 4. Near-Miss Check
      if (!vehicle.nearMissed && vehicle.sprite.y > this.playerY - 40 && vehicle.sprite.y < this.playerY + 50) {
        if (checkNearMiss(playerBox, vehicleBox)) {
          vehicle.nearMissed = true;
          this.triggerNearMiss(vehicle.sprite.x, vehicle.sprite.y);
        }
      }

      // 5. Cleanup vehicles that scrolled far off screen
      if (vehicle.sprite.y > 850 || vehicle.sprite.y < -300) {
        vehicle.sprite.destroy();
        this.trafficVehicles.splice(i, 1);
      }
    }
  }

  private spawnTrafficVehicle(customY?: number) {
    const lane = Phaser.Math.Between(0, this.levelConfig.lanes - 1);
    const laneCenterX = this.roadX + lane * this.laneWidth + this.laneWidth / 2;

    // Pick vehicle type from allowed types
    const archetype = Phaser.Utils.Array.GetRandom(this.levelConfig.allowedVehicles) as VehicleArchetype;
    const speed = Phaser.Math.Between(this.levelConfig.minSpeed, this.levelConfig.maxSpeed);

    const spawnY = customY !== undefined ? customY : -120;
    const vehicleContainer = this.add.container(laneCenterX, spawnY);
    const g = this.add.graphics();
    vehicleContainer.add(g);

    const { width, height } = this.drawVehicleGraphic(g, archetype);

    const trafficObj: TrafficVehicle = {
      sprite: vehicleContainer,
      type: archetype,
      lane,
      speedKmh: speed,
      width,
      height,
      nearMissed: false,
      changingLane: false,
      targetLaneX: laneCenterX,
    };

    // Chance to plan lane switch if level >= 6
    if (this.levelConfig.id >= 6 && Math.random() < 0.25) {
      const adjacentLane = lane > 0 && Math.random() < 0.5 ? lane - 1 : Math.min(this.levelConfig.lanes - 1, lane + 1);
      if (adjacentLane !== lane) {
        trafficObj.changingLane = true;
        trafficObj.targetLaneX = this.roadX + adjacentLane * this.laneWidth + this.laneWidth / 2;
      }
    }

    this.trafficVehicles.push(trafficObj);
  }

  private drawVehicleGraphic(g: Phaser.GameObjects.Graphics, type: VehicleArchetype): { width: number; height: number } {
    g.clear();
    let width = 34;
    let height = 64;
    let bodyColor = 0xef4444;

    switch (type) {
      case 'sportscar':
        width = 32;
        height = 62;
        bodyColor = 0xf59e0b;
        break;
      case 'suv':
        width = 38;
        height = 70;
        bodyColor = 0x3b82f6;
        break;
      case 'van':
        width = 40;
        height = 80;
        bodyColor = 0x10b981;
        break;
      case 'truck':
        width = 44;
        height = 110;
        bodyColor = 0x8b5cf6;
        break;
      case 'tanker':
        width = 46;
        height = 135;
        bodyColor = 0x94a3b8;
        break;
      case 'bus':
        width = 44;
        height = 130;
        bodyColor = 0xf97316;
        break;
      case 'police':
        width = 34;
        height = 66;
        bodyColor = 0x0284c7;
        break;
      default:
        // sedan
        width = 34;
        height = 64;
        bodyColor = 0x64748b;
        break;
    }

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-width / 2 - 2, -height / 2 + 4, width + 4, height, 4);

    // Tires
    g.fillStyle(0x18181b, 1);
    g.fillRect(-width / 2 - 3, -height / 2 + 10, 3, 14);
    g.fillRect(width / 2, -height / 2 + 10, 3, 14);
    g.fillRect(-width / 2 - 3, height / 2 - 24, 3, 14);
    g.fillRect(width / 2, height / 2 - 24, 3, 14);

    // Car Body
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 6);

    // Windshield & Rear glass
    g.fillStyle(0x0f172a, 0.9);
    g.fillRoundedRect(-width / 2 + 3, -height / 2 + 12, width - 6, 12, 2);
    g.fillRoundedRect(-width / 2 + 3, height / 2 - 20, width - 6, 8, 2);

    // Roof
    g.fillStyle(Phaser.Display.Color.IntegerToColor(bodyColor).darken(15).color, 1);
    g.fillRoundedRect(-width / 2 + 4, -height / 2 + 24, width - 8, height - 48, 3);

    // Headlights (facing downwards)
    g.fillStyle(0xfef08a, 1);
    g.fillRect(-width / 2 + 2, height / 2 - 3, 6, 3);
    g.fillRect(width / 2 - 8, height / 2 - 3, 6, 3);

    // Brake Lights (top facing player)
    g.fillStyle(0xef4444, 1);
    g.fillRect(-width / 2 + 2, -height / 2, 6, 3);
    g.fillRect(width / 2 - 8, -height / 2, 6, 3);

    // Police flashing lights if police
    if (type === 'police') {
      g.fillStyle(0xef4444, 1);
      g.fillRect(-6, -6, 5, 8);
      g.fillStyle(0x3b82f6, 1);
      g.fillRect(1, -6, 5, 8);
    }

    return { width, height };
  }

  private triggerNearMiss(x: number, y: number) {
    this.nearMissCount++;
    this.comboStreak++;
    this.comboTimer = 2.5;

    const bonus = calculateNearMissBonus(this.playerSpeedKmh, this.comboStreak);
    this.score += bonus;

    sound.playNearMiss();
    telegram.hapticImpact('light');

    // Float popup text
    const popup = this.add.text(x, y - 20, `+${bonus} NEAR MISS!`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 3,
    });
    popup.setOrigin(0.5);

    this.tweens.add({
      targets: popup,
      y: y - 65,
      alpha: 0,
      scale: 1.25,
      duration: 700,
      ease: 'Power2',
      onComplete: () => popup.destroy(),
    });

    // Spark burst
    for (let i = 0; i < 8; i++) {
      this.exhaustParticles.push({
        x: (this.playerX + x) / 2,
        y: this.playerY - 10,
        life: 0.35,
        maxLife: 0.35,
        vx: Phaser.Math.Between(-80, 80),
        vy: Phaser.Math.Between(-60, 40),
        color: 0xfacc15,
      });
    }
  }

  private triggerCrash() {
    this.isCrashed = true;
    this.isRunning = false;

    sound.playCrash();
    telegram.hapticImpact('heavy');
    telegram.hapticNotification('error');

    // Screen Shake
    this.cameras.main.shake(400, 0.035);

    // Bike spin out animation
    this.tweens.add({
      targets: this.bikeContainer,
      angle: 180,
      x: this.playerX + (this.currentAngle > 0 ? 50 : -50),
      duration: 500,
      ease: 'Cubic.easeOut',
    });

    // Heavy crash particle explosion
    for (let i = 0; i < 24; i++) {
      this.exhaustParticles.push({
        x: this.playerX,
        y: this.playerY,
        life: 0.7,
        maxLife: 0.7,
        vx: Phaser.Math.Between(-140, 140),
        vy: Phaser.Math.Between(-140, 140),
        color: Math.random() < 0.5 ? 0xef4444 : 0xf97316,
      });
    }

    // Delay 650ms before opening Game Over modal
    this.time.delayedCall(650, () => {
      this.callbacks.onGameOver({
        distance: Math.round(this.distanceTraveledMeters),
        score: this.score,
        nearMisses: this.nearMissCount,
      });
    });
  }

  private checkMilestones() {
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
  }

  private spawnNitroParticles() {
    for (let i = 0; i < 2; i++) {
      this.exhaustParticles.push({
        x: this.playerX + (Math.random() * 8 - 4),
        y: this.playerY + 24,
        life: 0.25,
        maxLife: 0.25,
        vx: (Math.random() * 20 - 10),
        vy: Phaser.Math.Between(120, 220),
        color: 0x38bdf8,
      });
    }
  }

  private updateParticles(dt: number) {
    this.particleGraphics.clear();

    for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
      const p = this.exhaustParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.life <= 0) {
        this.exhaustParticles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      const size = 3 * alpha;
      this.particleGraphics.fillStyle(p.color, alpha);
      this.particleGraphics.fillCircle(p.x, p.y, size);
    }
  }

  // --- External Control APIs called from React UI ---

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
    if (paused) {
      sound.stopEngine();
    } else {
      sound.startEngine();
    }
  }

  /**
   * Resumes the game after a verified Adsgram Rewarded Ad completion!
   * Restores the motorcycle to a safe center position, grants a 3.5s golden invulnerability shield,
   * and clears any traffic ahead to ensure zero unfair immediate re-crashes.
   */
  public continueFromRevive() {
    this.isCrashed = false;
    this.isRunning = true;

    // Reset bike to center lane
    this.playerX = 220;
    this.playerTargetX = 220;
    this.currentAngle = 0;
    this.bikeContainer.setPosition(220, this.playerY);
    this.bikeContainer.setAngle(0);

    // Safe moderate speed
    this.playerSpeedKmh = 70;

    // 3.5 seconds golden invulnerability shield
    this.shieldTimeRemaining = 3.5;

    // Clear vehicles near the player
    for (let i = this.trafficVehicles.length - 1; i >= 0; i--) {
      const v = this.trafficVehicles[i];
      if (v.sprite.y > this.playerY - 320 && v.sprite.y < this.playerY + 150) {
        v.sprite.destroy();
        this.trafficVehicles.splice(i, 1);
      }
    }

    sound.startEngine();
  }
}
