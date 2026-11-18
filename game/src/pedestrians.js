// Pedestrians: sidewalk walkers with their own colours and paces. They
// stroll their block, cross at corners, and flee when shots are fired or
// police chase past. Knocking one down raises the wanted level.
import * as THREE from 'three';
import { mulberry32, pick, range } from './rng.js';
import { buildCharacter } from './player.js';
import { CITY } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];

export class Pedestrians {
  constructor(scene, seed) {
    this.list = [];
    const rng = mulberry32(seed);
    for (let i = 0; i < 26; i += 1) {
      const mesh = buildCharacter(pick(rng, SHIRTS), 0x333333);
      mesh.scale.setScalar(0.92);
      scene.add(mesh);
      const axis = rng() < 0.5 ? 'x' : 'z';
      const road = Math.round(range(rng, -4, 4)) * CITY.block;
      const along = range(rng, -180, 180);
      this.list.push({
        mesh,
        x: axis === 'x' ? along : road + 7,
        z: axis === 'x' ? road + 7 : along,
        axis, road,
        dir: rng() < 0.5 ? 1 : -1,
        speed: range(rng, 1.2, 2.4),
        phase: rng() * 6,
        fleeing: 0,
        down: false,
      });
    }
  }

  // A gunshot or a crash at (x,z) sends nearby walkers running.
  scare(x, z, radius) {
    for (const p of this.list) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) p.fleeing = 3;
    }
  }

  step(dt, time) {
    for (const p of this.list) {
      if (p.down) continue;
      const speed = p.fleeing > 0 ? p.speed * 3.2 : p.speed;
      p.fleeing = Math.max(0, p.fleeing - dt);
      if (p.axis === 'x') {
        p.x += p.dir * speed * dt;
        if (p.x > 196) { p.x = 196; p.dir = -1; }
        if (p.x < -196) { p.x = -196; p.dir = 1; }
        p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.z += p.dir * speed * dt;
        if (p.z > 196) { p.z = 196; p.dir = -1; }
        if (p.z < -196) { p.z = -196; p.dir = 1; }
        p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
      p.phase += dt * speed * 2;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.05, p.z);
      p.mesh.userData.armL.rotation.x = Math.sin(p.phase) * 0.5;
      p.mesh.userData.armR.rotation.x = -Math.sin(p.phase) * 0.5;
      void time;
    }
  }

  // The player (on foot or in a car) ran one over.
  nearestDownable(x, z, maxD) {
    let best = null; let bestD = maxD;
    for (const p of this.list) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
