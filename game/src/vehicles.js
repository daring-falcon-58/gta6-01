// Vehicles: box-built original cars (sedan, taxi, pickup, sports, police
// cruiser), arcade driving for the player, and traffic that loops the road
// grid with simple spacing. Stealing a car is the genre's signature move.
import * as THREE from 'three';
import { mulberry32, pick, range, clamp, angleLerp } from './rng.js';
import { collideCircle, clampToCity, CITY } from './city.js';

export const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0x95a5a6, 0x1a1a1a, 0xecf0f1, 0x16a085];

export function buildCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.1, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, kind === 'pickup' ? 1.4 : 2.2), glassMat);
  cabin.position.set(0, 1.1, kind === 'pickup' ? 0.8 : -0.1);
  g.add(body, cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xaa8800 }));
    sign.position.set(0, 1.5, -0.1);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2244ff, emissiveIntensity: 0.8 }));
    bar.position.set(0, 1.45, -0.1);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    stripe.position.y = 0.72;
    g.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, kind) {
    this.kind = kind || 'sedan';
    this.mesh = buildCarMesh(color, this.kind);
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.maxSpeed = this.kind === 'sports' ? 34 : this.kind === 'police' ? 36 : 24;
    this.accel = this.kind === 'sports' ? 16 : 11;
    this.alive = true;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Arcade drive: W/S throttle, A/D steer (steering scales with speed),
  // Space handbrake. Returns true on a hard collision (for crash sound).
  drive(dt, input, colliders) {
    const ax = input.axis();
    const braking = input.down('Space');
    if (ax.y > 0) this.speed += this.accel * dt;
    else if (ax.y < 0) this.speed -= this.speed > 0.5 ? this.accel * 1.4 * dt : 6 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    if (braking) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 26 * dt);
    this.speed = clamp(this.speed, -9, this.maxSpeed);
    const steerTarget = -ax.x * (this.speed >= 0 ? 1 : -1) * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * dt * Math.sign(this.speed || 1);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const before = { x: this.x, z: this.z };
    const fixed = collideCircle(colliders, nx, nz, 2.1);
    const clamped = clampToCity(fixed.x, fixed.z);
    const hit = Math.hypot(clamped.x - nx, clamped.z - nz) > 0.05 || Math.hypot(before.x - clamped.x, before.z - clamped.z) < Math.abs(this.speed) * dt * 0.5;
    if (hit && Math.abs(this.speed) > 6) this.speed *= 0.4;
    this.x = clamped.x; this.z = clamped.z;
    this.sync();
    return hit && Math.abs(this.speed) > 4;
  }
}

export class Traffic {
  constructor(scene, colliders, seed) {
    this.colliders = colliders;
    this.cars = [];
    const rng = mulberry32(seed);
    // Traffic loops: each car patrols one road line, turning at random
    // intersections onto the crossing road.
    for (let i = 0; i < 14; i += 1) {
      const axis = rng() < 0.5 ? 'x' : 'z';
      const at = Math.round(range(rng, -4, 4)) * CITY.block;
      const along = range(rng, -180, 180);
      const color = pick(rng, CAR_COLORS);
      const kind = rng() < 0.15 ? 'taxi' : rng() < 0.12 ? 'pickup' : 'sedan';
      const car = new Car(scene, axis === 'x' ? along : at, axis === 'x' ? at : along, axis === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), color, kind);
      car.speed = range(rng, 7, 11);
      car.axis = axis;
      car.at = at;
      car.dir = Math.sign(Math.sin(car.heading) || Math.cos(car.heading)) || 1;
      car.kind = kind;
      this.cars.push(car);
    }
    // Parked cars the player can steal (near the start, clearly visible).
    // One guaranteed red sports car by Aurora Tower — JOB 2's target.
    this.parked = [];
    const sports = new Car(scene, 68, 70, 0.5, 0xc0392b, 'sports');
    sports.speed = 0;
    this.parked.push(sports);
    const spots = [[8, 34, 0.4], [-14, 34, -0.3], [34, 8, 1.2], [6, -14, 2.1], [-34, -6, -1.4], [48, 48, 0.9]];
    for (const [x, z, h] of spots) {
      const car = new Car(scene, x, z, h, pick(rng, CAR_COLORS), 'sedan');
      car.speed = 0;
      this.parked.push(car);
    }
  }

  nearestParked(x, z, maxD) {
    let best = null; let bestD = maxD;
    for (const car of this.parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  step(dt, playerCar) {
    for (const car of this.cars) {
      // Advance along its road; at an intersection, sometimes turn.
      const speed = car.speed;
      if (car.axis === 'x') {
        car.x += Math.sin(car.heading) * speed * dt;
        car.z += (car.at - car.z) * Math.min(1, dt * 2);
        if (Math.abs(car.x) > 196) car.heading = -car.heading;
        const nearJunction = Math.abs(((car.x % CITY.block) + CITY.block) % CITY.block) < speed * dt + 0.4;
        if (nearJunction && Math.random() < 0.25) {
          car.axis = 'z'; car.at = Math.round(car.x / CITY.block) * CITY.block;
          car.heading = Math.random() < 0.5 ? 0 : Math.PI;
        }
      } else {
        car.z += Math.cos(car.heading) * speed * dt;
        car.x += (car.at - car.x) * Math.min(1, dt * 2);
        if (Math.abs(car.z) > 196) car.heading = Math.PI - car.heading;
        const nearJunction = Math.abs(((car.z % CITY.block) + CITY.block) % CITY.block) < speed * dt + 0.4;
        if (nearJunction && Math.random() < 0.25) {
          car.axis = 'x'; car.at = Math.round(car.z / CITY.block) * CITY.block;
          car.heading = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // Gentle separation from the player's car so traffic never overlaps it.
      if (playerCar) {
        const dx = car.x - playerCar.x; const dz = car.z - playerCar.z;
        const d = Math.hypot(dx, dz);
        if (d < 5 && d > 0.01) { car.x += (dx / d) * (5 - d) * 0.5; car.z += (dz / d) * (5 - d) * 0.5; }
      }
      car.sync();
    }
  }

  reset(seed) {
    // Traffic is rebuilt by main on reset; this keeps the API honest.
    void seed;
  }
}
