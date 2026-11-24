// The wanted system: 0–5 stars. Crimes raise it; police cruisers spawn
// and ram the player, and on-foot officers close in at higher levels.
// Hide (no crime, out of sight) and it cools down; get caught and it is
// over — BUSTED.
import * as THREE from 'three';
import { clamp, angleLerp } from './rng.js';
import { buildCarMesh } from './vehicles.js';
import { buildCharacter } from './player.js';

const MAX_COPS = 6;

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.heat = 0; // continuous 0..100, stars = ceil(heat/20)
    this.coolTimer = 0;
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = Math.ceil(this.heat / 20);
    if (stars > this.wanted) this.wanted = stars;
    this.coolTimer = 8;
  }

  clear() {
    this.heat = 0; this.wanted = 0; this.coolTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = []; this.officers = [];
  }

  _spawnCar(x, z) {
    const mesh = buildCarMesh(0x111111, 'police');
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0 };
    this.cars.push(car);
    return car;
  }

  _spawnOfficer(x, z) {
    const mesh = buildCharacter(0x1a2a44, 0x1a2a44);
    this.scene.add(mesh);
    const off = { mesh, x, z, heading: 0, speed: 5.4 };
    this.officers.push(off);
    return off;
  }

  // dt step: spawn to match wanted, chase the player, cool down when hidden.
  // roadblock is {car, x, z} or null: that cruiser drives to the point
  // ahead of the player and waits there instead of chasing.
  step(dt, player, playerCar, committingCrime, roadblock) {
    if (committingCrime) this.coolTimer = 8;
    else this.coolTimer = Math.max(0, this.coolTimer - dt);
    if (this.coolTimer === 0 && this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 2.5);
      const stars = Math.ceil(this.heat / 20);
      if (stars < this.wanted) this.wanted = stars;
    }

    const wantCars = this.wanted >= 1 ? Math.min(this.wanted + 1, MAX_COPS) : 0;
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    while (this.cars.length < wantCars) {
      const a = Math.random() * Math.PI * 2;
      this._spawnCar(px + Math.cos(a) * 55, pz + Math.sin(a) * 55);
    }
    while (this.cars.length > wantCars) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    const wantOfficers = this.wanted >= 3 ? Math.min(this.wanted - 1, 4) : 0;
    while (this.officers.length < wantOfficers) {
      const a = Math.random() * Math.PI * 2;
      this._spawnOfficer(px + Math.cos(a) * 22, pz + Math.sin(a) * 22);
    }
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }

    // Cruiser chase: steer toward the player, ram at close range.
    // The roadblock unit instead holds the point ahead of the player.
    for (const c of this.cars) {
      const isBlock = roadblock && roadblock.car === c;
      const tx = isBlock ? roadblock.x : px;
      const tz = isBlock ? roadblock.z : pz;
      const dx = tx - c.x; const dz = tz - c.z;
      const dist = Math.hypot(dx, dz);
      const target = Math.atan2(dx, dz);
      c.heading = angleLerp(c.heading, target, Math.min(1, dt * 2.2));
      const top = isBlock ? 18 : 14 + this.wanted * 3.2;
      c.speed = isBlock && dist < 6 ? Math.max(0, c.speed - 20 * dt) : Math.min(top, c.speed + 12 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      if (dist < 3.4 && !isBlock) {
        // Ram: shove the player's car, or hurt the player on foot.
        if (playerCar) {
          playerCar.speed *= 0.55;
          playerCar.x += Math.sin(c.heading) * 2.2;
          playerCar.z += Math.cos(c.heading) * 2.2;
          playerCar.sync();
        } else {
          this.bustTimer += dt;
        }
      }
    }

    // Officers on foot close in; touching the player for 1.2s busts them.
    let touching = false;
    for (const o of this.officers) {
      const dx = player.x - o.x; const dz = player.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.6) {
        o.heading = Math.atan2(dx, dz);
        o.x += Math.sin(o.heading) * o.speed * dt;
        o.z += Math.cos(o.heading) * o.speed * dt;
      } else {
        touching = true;
      }
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
    }
    if (touching && !playerCar) this.bustTimer += dt;
    else if (this.cars.every((c) => Math.hypot(px - c.x, pz - c.z) > 4)) this.bustTimer = Math.max(0, this.bustTimer - dt);
    return this.bustTimer > 1.2;
  }
}
