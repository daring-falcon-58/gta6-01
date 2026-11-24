// SOLMAR BAY — bootstrap, game loop and wiring. The game object owns the
// world (city, player, traffic, peds, police, missions, combat, HUD,
// audio) and exposes itself as window.__solmar for play-tests; the
// screenshot stager drives it through the same step() the loop uses.
import * as THREE from 'three';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { buildCity, CITY, districtAt, collideCircle, clampToCity } from './city.js';
import { Player } from './player.js';
import { Traffic, CAR_COLORS, CAR_NAMES, Car } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Helicopter } from './helicopter.js';
import { Dispatch } from './dispatch.js';
import { Pickups } from './pickups.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { clamp, angleLerp } from './rng.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);

class Game {
  constructor() {
    this.seed = SEED;
    this.state = 'title'; // title | playing | paused | over
    this.cash = 0;
    this.time = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.36;
    this.camDist = 8;
    this.playerCar = null;
    this.crimeCooldown = 0;
    this.saveTimer = 0;
    this.overReason = '';

    this.input = new Input();
    this.audio = new AudioEngine();
    this.hud = new HUD();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fd0e8);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 8, 40);

    this.city = buildCity(this.scene, this.seed);
    this.player = new Player(this.scene, this.city.colliders);
    this.traffic = new Traffic(this.scene, this.city.colliders, this.seed);
    this.peds = new Pedestrians(this.scene, this.seed);
    this.police = new Police(this.scene);
    this.heli = new Helicopter(this.scene);
    this.dispatch = new Dispatch();
    this.pickups = new Pickups(this.scene);
    this.meridianCar = null; // JOB 6's fleeing target car
    this.missions = new Missions(this.city.landmarks);
    this.combat = new Combat(this.scene);

    // Mission beacon: a gold pillar of light + ring at the target.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.visible = false;
    this.scene.add(this.beaconRing);

    // Title screen wiring.
    this.save = loadSave();
    const btnContinue = document.getElementById('btnContinue');
    if (this.save && this.save.cash >= 0) {
      btnContinue.style.display = '';
      btnContinue.addEventListener('click', () => this.continueGame());
    }
    document.getElementById('btnStart').addEventListener('click', () => this.newGame());
    document.getElementById('btnResume').addEventListener('click', () => this.resume());
    document.getElementById('btnQuit').addEventListener('click', () => this.toTitle());
    document.getElementById('btnRetry').addEventListener('click', () => this.retry());
    document.getElementById('btnOverTitle').addEventListener('click', () => this.toTitle());
    window.addEventListener('resize', () => this.onResize());

    window.__solmar = this;
    window.__shotReady = false;

    if (SHOT) {
      // Screenshot mode: stage the scene, render once, signal ready.
      stageShot(SHOT, this);
      this.render();
      window.__shotReady = true;
    } else {
      this.renderer.setAnimationLoop(() => this.frame());
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- lifecycle -------------------------------------------------------
  reset(seed) {
    this.seed = seed;
    this.cash = 0;
    this.time = 0;
    this.playerCar = null;
    this.police.clear();
    this.heli.clear();
    this.dispatch.clear();
    this.pickups.clear();
    this.clearMeridianCar();
    this.combat.clearRivals();
    this.missions.index = 0;
    this.missions.done = false;
    this.missions.state = 'idle';
    this.player.reset(0, 24);
    this.camYaw = Math.PI;
    this.beacon.visible = false;
    this.beaconRing.visible = false;
    this.hud.setWanted(0);
    this.hud.setCash(0);
    this.hud.setHealth(100);
    this.hud.setArmour(0);
    this.hud.setAmmo(60, false, 'pistol', 0);
    this.hud.setDispatch([], 0);
    this.hud.setVehicle(null, 0);
    this.hud.setWeapons('pistol', 60, 0, false);
    this.hud.setRespect(0, 0);
    this.hud.setDistrict('Marina Plaza', 'FRI 17:41');
    this.hud.dialogueEl.style.display = 'none';
  }

  clearMeridianCar() {
    if (this.meridianCar) {
      this.scene.remove(this.meridianCar.mesh);
      this.meridianCar = null;
    }
  }

  // JOB 6's target: a purple syndicate Meridian GT that flees the docks.
  syncMeridianCar() {
    const m = this.missions.current();
    const active = this.missions.state === 'active' && m && m.id === 'meridian';
    if (!active) {
      this.clearMeridianCar();
      return;
    }
    if (!this.meridianCar) {
      const L = this.city.landmarks.docks;
      this.meridianCar = new Car(this.scene, L.x, L.z, 0.5, 0x8e44ad, 'sports');
    }
  }

  newGame() {
    clearSave();
    this.reset(this.seed);
    this.startRun();
  }

  continueGame() {
    const s = this.save;
    this.reset(this.seed);
    this.cash = s.cash || 0;
    this.missions.index = Math.min(s.missionIndex || 0, this.missions.list.length - 1);
    this.player.reset(s.x ?? 0, s.z ?? 24);
    this.player.health = s.health || 100;
    this.startRun();
    this.hud.message(`Welcome back, Danny. Cash $${this.cash}.`, 4);
  }

  startRun() {
    this.state = 'playing';
    document.getElementById('title').style.display = 'none';
    document.getElementById('over').style.display = 'none';
    document.getElementById('pause').style.display = 'none';
    this.audio.ensure();
    if (this.missions.state === 'idle') this.missions.start();
    this.syncMissionHUD();
    const m = this.missions.current();
    if (m) this.hud.showDialogue('LENA VOSS', 'FIXER', m.brief, 6);
  }

  resume() {
    this.state = 'playing';
    document.getElementById('pause').style.display = 'none';
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause').style.display = 'flex';
    this.saveNow();
  }

  toTitle() {
    this.saveNow();
    this.state = 'title';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('over').style.display = 'none';
    document.getElementById('title').style.display = 'flex';
    const btnContinue = document.getElementById('btnContinue');
    this.save = loadSave();
    if (this.save) btnContinue.style.display = '';
  }

  retry() {
    // After busted/wasted: keep cash and mission progress, respawn at the
    // plaza with half health and no wanted level.
    this.police.clear();
    this.heli.clear();
    this.dispatch.clear();
    this.clearMeridianCar();
    this.player.reset(0, 24);
    this.player.health = 50;
    this.playerCar = null;
    this.missions.restart();
    this.state = 'playing';
    document.getElementById('over').style.display = 'none';
    this.syncMissionHUD();
  }

  gameOver(reason, text) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overReason = reason;
    this.audio.busted();
    this.heli.clear();
    document.getElementById('overTitle').textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
    document.getElementById('overText').textContent = text;
    document.getElementById('over').style.display = 'flex';
    this.saveNow();
  }

  saveNow() {
    writeSave({
      cash: this.cash,
      missionIndex: this.missions.index,
      health: this.player.health,
      x: this.player.x,
      z: this.player.z,
    });
  }

  // ---- car enter / exit -------------------------------------------------
  enterCar(car) {
    this.playerCar = car;
    this.player.onFoot = false;
    this.player.mesh.visible = false;
    this.player.x = car.x; this.player.z = car.z;
    // Stealing a parked car is a crime — unless it is the mission sports car.
    if (this.traffic.parked.includes(car)) {
      this.traffic.parked = this.traffic.parked.filter((c) => c !== car);
      this.police.addHeat(12);
      this.hud.message('Car stolen! The cops noticed.', 3);
      this.audio.pickup();
    }
    this.hud.setAmmo(this.player.ammo, true, this.player.weapon, this.player.smgAmmo);
  }

  exitCar() {
    if (!this.playerCar) return;
    const car = this.playerCar;
    this.playerCar = null;
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    this.player.x = car.x - Math.sin(car.heading) * 2.4;
    this.player.z = car.z - Math.cos(car.heading) * 2.4;
    this.player.heading = car.heading;
    this.hud.setAmmo(this.player.ammo, false, this.player.weapon, this.player.smgAmmo);
  }

  // ---- per-frame --------------------------------------------------------
  frame() {
    const dt = Math.min(0.05, this.clockDelta());
    // State keys are handled here, not in step(), because step() never runs
    // while paused or on the title screen — otherwise the keypress would be
    // cleared by endFrame() before any step could read it.
    if (this.state === 'paused' && (this.input.pressed('KeyP') || this.input.pressed('Escape'))) {
      this.resume();
    } else if (this.state === 'playing' && (this.input.pressed('KeyP') || this.input.pressed('Escape'))) {
      this.pause();
    } else if (this.state === 'title' && this.input.pressed('Enter')) {
      this.newGame();
    } else if (this.state === 'over' && this.input.pressed('Enter')) {
      this.retry();
    } else if (this.state === 'playing') {
      this.step(dt);
    } else if (this.state === 'title') {
      this.stepAmbient(dt);
    }
    this.render();
    this.input.endFrame();
  }

  clockDelta() {
    const now = performance.now() / 1000;
    if (this._last === undefined) this._last = now;
    const dt = now - this._last;
    this._last = now;
    return dt || 0.016;
  }

  stepAmbient(dt) {
    // The title screen lives over a moving city: traffic rolls on, and
    // the minimap draws so the title shot is not an empty circle.
    this.time += dt;
    this.traffic.step(dt, null);
    this.peds.step(dt, this.time);
    this.hud.drawMinimap({
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: Math.PI - this.player.heading,
      missionTarget: null,
      trafficCars: this.traffic.cars,
      policeCars: this.police.cars,
      rivals: this.combat.rivals,
    });
    this.updateCamera(dt);
  }

  step(dt) {
    this.time += dt;
    const input = this.input;
    const committingCrime = this.crimeCooldown > 0;
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);

    // Global keys.
    if (input.pressed('KeyM')) {
      this.hud.message(this.audio.toggleMute() ? 'Sound muted' : 'Sound on', 2);
    }
    if (input.pressed('KeyR')) {
      this.hud.message(this.audio.toggleRadio() ? 'BAY FM on' : 'BAY FM off', 2);
    }
    // Weapon slots: 1 fists, 2 pistol, 3 SMG (only once the cache is found).
    if (input.pressed('Digit1')) this.player.weapon = 'fists';
    if (input.pressed('Digit2')) this.player.weapon = 'pistol';
    if (input.pressed('Digit3') && this.player.hasSmg) this.player.weapon = 'smg';

    // Mouse orbit: drag to swing the chase camera.
    if (input.mouseDown) {
      this.camYaw -= (input.mouseX - (this._lastMouseX ?? input.mouseX)) * 0.004;
      this.camPitch = clamp(this.camPitch + (input.mouseY - (this._lastMouseY ?? input.mouseY)) * 0.002, 0.12, 1.1);
    }
    this._lastMouseX = input.mouseX;
    this._lastMouseY = input.mouseY;

    // Enter / exit cars.
    if (input.pressed('KeyE')) {
      if (this.playerCar) this.exitCar();
      else {
        const car = this.traffic.nearestParked(this.player.x, this.player.z, 6);
        if (car) this.enterCar(car);
        else {
          const moving = this.traffic.cars.find((c) => Math.hypot(c.x - this.player.x, c.z - this.player.z) < 5);
          if (moving) { this.enterCar(moving); this.traffic.cars = this.traffic.cars.filter((c) => c !== moving); }
          else this.hud.message('No car nearby — find a parked one.', 2);
        }
      }
    }

    // Driving or walking.
    if (this.playerCar) {
      const crashed = this.playerCar.drive(dt, input, this.city.colliders);
      if (crashed) this.audio.crash();
      this.player.x = this.playerCar.x; this.player.z = this.playerCar.z;
      this.player.heading = this.playerCar.heading;
      // Running over a pedestrian is a crime.
      const hit = this.peds.nearestDownable(this.playerCar.x, this.playerCar.z, 2.6);
      if (hit && Math.abs(this.playerCar.speed) > 4) {
        hit.down = true;
        hit.mesh.rotation.x = -Math.PI / 2;
        hit.mesh.position.y = 0.3;
        this.police.addHeat(20);
        this.crimeCooldown = 8;
        this.hud.message('You hit a pedestrian!', 2);
      }
    } else {
      this.player.step(dt, input, this.camYaw);
      // Punch and shoot.
      if (input.pressed('KeyF')) {
        const hit = this.combat.punch(this.player, this.combat.rivals, this.peds, () => this.onRivalDown());
        this.audio.punch();
        if (hit && hit.mesh && this.peds.list.includes(hit)) {
          this.police.addHeat(14);
          this.crimeCooldown = 8;
        }
      }
      if (input.mouseClicked || input.mouseDown) {
        if (this.player.weapon !== 'fists') {
          const hit = this.combat.shoot(this.camera, this.player, this.audio, () => this.onRivalDown());
          if (hit || this.player.ammo < 60) {
            this.police.addHeat(10);
            this.crimeCooldown = 8;
            this.peds.scare(this.player.x, this.player.z, 30);
          }
        }
      }
    }

    // Street pickups: armour vests and the SMG cache.
    const got = this.pickups.step(dt, this.player.x, this.player.z);
    if (got === 'armour') {
      this.player.armour = Math.min(100, this.player.armour + 50);
      this.hud.message('Armour vest +50', 2);
      this.audio.pickup();
    } else if (got === 'smg') {
      this.player.hasSmg = true;
      this.player.smgAmmo += 120;
      this.player.weapon = 'smg';
      this.hud.message('SMG found — press 3 to switch, 120 rounds', 3);
      this.audio.pickup();
    }

    // World systems.
    this.traffic.step(dt, this.playerCar);
    this.peds.step(dt, this.time);
    const dmg = this.combat.step(dt, this.player);
    if (dmg > 0 && this.player.damage(dmg)) this.gameOver('wasted', 'The rivals got the better of you.');
    // Dispatch: the farthest cruiser sets a roadblock ahead of the player.
    const px = this.playerCar ? this.playerCar.x : this.player.x;
    const pz = this.playerCar ? this.playerCar.z : this.player.z;
    const heading = this.playerCar ? this.playerCar.heading : this.player.heading;
    const rbCar = this.dispatch.pickRoadblock(this.police.cars, px, pz);
    const roadblock = rbCar ? {
      car: rbCar,
      x: px + Math.sin(heading) * 45,
      z: pz + Math.cos(heading) * 45,
    } : null;
    const busted = this.police.step(dt, this.player, this.playerCar, committingCrime, roadblock);
    if (busted) this.gameOver('busted', 'The Solmar Bay PD caught up with you.');
    // CONDOR-1: air support deploys at 4 stars, stands down below that.
    if (this.police.wanted >= 4) {
      this.heli.deploy();
      this.heli.step(dt, px, pz);
    } else if (this.heli.active) {
      this.heli.clear();
    }

    // JOB 6's target car: spawns at the docks and flees the player.
    this.syncMeridianCar();
    if (this.meridianCar) {
      const t = this.meridianCar;
      const dx = t.x - px; const dz = t.z - pz;
      const d = Math.hypot(dx, dz) || 1;
      t.heading = Math.atan2(dx / d, dz / d);
      const nx = t.x + Math.sin(t.heading) * 12 * dt;
      const nz = t.z + Math.cos(t.heading) * 12 * dt;
      const fixed = collideCircle(this.city.colliders, nx, nz, 2.1);
      const clamped = clampToCity(fixed.x, fixed.z);
      t.x = clamped.x; t.z = clamped.z;
      t.sync();
    }

    // Missions.
    if (this.missions.state === 'active') {
      const m = this.missions.current();
      if (m && m.rivals && this.combat.rivals.length === 0 && !m.spawned) {
        m.spawned = true;
        this.combat.spawnRivals(m.target.x, m.target.z, m.rivals, this.seed + 11);
      }
      const res = this.missions.step(dt, {
        player: this.player, playerCar: this.playerCar, wanted: this.police.wanted,
        targetCar: this.meridianCar,
      });
      if (res === 'done') {
        const reward = this.missions.list[this.missions.index - 1].reward;
        this.cash += reward;
        this.audio.cash();
        this.audio.missionDone();
        this.hud.toast(`MISSION COMPLETE  +$${reward}`, 3);
        this.hud.message(this.missions.done ? 'Story complete — Solmar Bay is yours, Danny.' : 'Next job from Lena Voss…', 4);
        this.combat.clearRivals();
        this.clearMeridianCar();
        if (!this.missions.done) {
          this.missions.start();
          this.syncMissionHUD();
          const nm = this.missions.current();
          if (nm) this.hud.showDialogue('LENA VOSS', 'FIXER', nm.brief, 6);
        } else {
          this.syncMissionHUD();
        }
      } else if (res === 'retarget') {
        this.syncMissionHUD();
        this.hud.message('Now deliver it!', 3);
      } else if (res === 'ram') {
        this.audio.crash();
        this.hud.toast(`TARGET ${this.missions.current().targetCondition}% CONDITION`, 2);
        this.syncMissionHUD();
      } else if (res === 'failed') {
        this.hud.toast('OUT OF TIME — RUN IT AGAIN', 3);
        this.missions.restart();
        this.clearMeridianCar();
        this.syncMissionHUD();
      }
    }

    // Beacon follows the mission target.
    const target = this.missions.state === 'active' ? this.missions.target : null;
    if (target) {
      this.beacon.visible = true;
      this.beaconRing.visible = true;
      this.beacon.position.set(target.x, 30, target.z);
      this.beaconRing.position.set(target.x, 0.15, target.z);
      const pulse = 1 + Math.sin(this.time * 3) * 0.15;
      this.beaconRing.scale.set(pulse, pulse, 1);
    } else {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
    }

    // HUD + audio: every panel is fed live numbers each frame.
    const speedKmh = this.playerCar ? Math.abs(this.playerCar.speed) * 3.6 : this.player.speed * 3.6;
    this.hud.setCash(this.cash);
    this.hud.setWanted(this.police.wanted);
    this.hud.setHealth(this.player.health);
    this.hud.setArmour(this.player.armour);
    this.hud.setAmmo(this.player.ammo, !!this.playerCar, this.player.weapon, this.player.smgAmmo);
    this.hud.setWeapons(this.player.weapon, this.player.ammo, this.player.smgAmmo, this.player.hasSmg);
    this.hud.setDispatch(this.dispatch.board(this.police.cars, px, pz, this.heli.active), this.police.wanted);
    this.hud.setStage(this.missions.state === 'active' ? this.missions.stageText() : '', this.missions.state === 'active' ? this.missions.nextText() : '');
    // Clock: the story opens Friday 17:41; one game minute per 2 seconds.
    const mins = 17 * 60 + 41 + Math.floor(this.time / 2);
    const clock = `FRI ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.hud.setDistrict(districtAt(px, pz), clock);
    this.hud.setRadio(this.audio.musicOn);
    this.hud.setVehicle(
      this.playerCar ? CAR_NAMES[this.playerCar.kind] || 'Street Car' : null,
      this.playerCar ? this.playerCar.condition : 0,
    );
    this.hud.setRespect(this.missions.index, this.cash);
    this.hud.setSpeed(speedKmh);
    this.hud.tick(dt);
    this.audio.update(clamp(speedKmh / 120, 0, 1), this.police.wanted);
    this.hud.drawMinimap({
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: Math.PI - this.player.heading,
      missionTarget: target,
      trafficCars: this.traffic.cars,
      policeCars: this.police.cars,
      rivals: this.combat.rivals,
    });

    // Autosave every 20s of play.
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.saveNow(); }

    this.updateCamera(dt);
    if (this.player.health <= 0 && this.state === 'playing') {
      this.gameOver('wasted', 'Danny Cross is down.');
    }
  }

  onRivalDown() {
    this.missions.rivalsDown += 1;
    this.audio.pickup();
  }

  syncMissionHUD() {
    const m = this.missions.current();
    if (!m || this.missions.done) {
      this.hud.setObjective('SOLMAR BAY — STORY COMPLETE', 'All eight jobs done. Free-roam the city, Danny.', '');
      return;
    }
    this.hud.setObjective(m.title, m.text, this.missions.progressText());
  }

  updateCamera(dt) {
    const px = this.player.x;
    const pz = this.player.z;
    // Chase camera: behind the player/car, height by pitch.
    const dist = this.playerCar ? this.camDist + 2 : this.camDist;
    const cx = px - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const cz = pz - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const cy = 2 + dist * Math.sin(this.camPitch) + (this.playerCar ? 1.5 : 0);
    const target = new THREE.Vector3(
      THREE.MathUtils.lerp(this.camera.position.x, cx, Math.min(1, dt * 5)),
      THREE.MathUtils.lerp(this.camera.position.y, cy, Math.min(1, dt * 5)),
      THREE.MathUtils.lerp(this.camera.position.z, cz, Math.min(1, dt * 5)),
    );
    this.camera.position.copy(target);
    const lookY = this.playerCar ? 1.5 : 1.6;
    this.camera.lookAt(px, lookY, pz);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
