// Combat: hitscan pistol shots and punches, rival gang members for JOB 3,
// and the shared damage numbers. A shot is a ray from the camera through
// the crosshair; a punch is a short-range arc in front of the player.
import * as THREE from 'three';
import { buildCharacter } from './player.js';
import { mulberry32, pick } from './rng.js';

const RIVAL_SHIRTS = [0x8e1f1f, 0x5b1f8e, 0x1f2a8e];

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.rivals = [];
    this.tracers = [];
    this.flash = 0;
  }

  spawnRivals(x, z, count, seed) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i += 1) {
      const mesh = buildCharacter(pick(rng, RIVAL_SHIRTS), 0x222222);
      const rx = x + (rng() - 0.5) * 18;
      const rz = z + (rng() - 0.5) * 18;
      mesh.position.set(rx, 0, rz);
      this.scene.add(mesh);
      this.rivals.push({ mesh, x: rx, z: rz, hp: 3, alive: true, speed: 3.4, attackCd: 0 });
    }
  }

  clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }

  // Hitscan shot from the camera. Returns the rival hit (or null).
  shoot(camera, player, audio, onRivalDown) {
    if (player.ammo <= 0 || player.shootCd > 0) return null;
    player.ammo -= 1;
    player.shootCd = 0.28;
    this.flash = 0.06;
    audio.shoot();
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let best = null; let bestD = 90;
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const to = new THREE.Vector3(r.x, 1.2, r.z).sub(origin);
      const along = to.dot(dir);
      if (along < 1 || along > bestD) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < 1.4) { best = r; bestD = along; }
    }
    if (best) {
      best.hp -= 1;
      if (best.hp <= 0) {
        best.alive = false;
        best.mesh.rotation.x = -Math.PI / 2;
        best.mesh.position.y = 0.3;
        onRivalDown();
      }
    }
    // Tracer line for feedback.
    const end = origin.clone().addScaledVector(dir, best ? bestD : 60);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.09 });
    return best;
  }

  punch(player, rivals, peds, onRivalDown) {
    if (player.punchCd > 0) return null;
    player.punchCd = 0.45;
    const fx = Math.sin(player.heading); const fz = Math.cos(player.heading);
    let hit = null;
    for (const r of rivals) {
      if (!r.alive) continue;
      const dx = r.x - player.x; const dz = r.z - player.z;
      if (Math.hypot(dx, dz) < 2.4 && dx * fx + dz * fz > 0) { hit = r; break; }
    }
    if (hit) {
      hit.hp -= 1;
      hit.x += fx * 1.5; hit.z += fz * 1.5;
      hit.mesh.position.set(hit.x, 0, hit.z);
      if (hit.hp <= 0) {
        hit.alive = false;
        hit.mesh.rotation.x = -Math.PI / 2;
        hit.mesh.position.y = 0.3;
        onRivalDown();
      }
      return hit;
    }
    for (const p of peds.list) {
      if (p.down) continue;
      const dx = p.x - player.x; const dz = p.z - player.z;
      if (Math.hypot(dx, dz) < 2.2 && dx * fx + dz * fz > 0) {
        p.down = true;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.3;
        return p;
      }
    }
    return null;
  }

  // Rivals chase and punch the player; returns damage dealt this frame.
  step(dt, player) {
    let damage = 0;
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const dx = player.x - r.x; const dz = player.z - r.z;
      const d = Math.hypot(dx, dz);
      r.attackCd = Math.max(0, r.attackCd - dt);
      if (d > 1.8) {
        r.x += (dx / d) * r.speed * dt;
        r.z += (dz / d) * r.speed * dt;
        r.mesh.rotation.y = Math.atan2(dx, dz);
        r.mesh.position.set(r.x, 0, r.z);
      } else if (r.attackCd === 0) {
        r.attackCd = 0.9;
        damage += 8;
      }
    }
    for (const t of this.tracers) t.ttl -= dt;
    for (const t of this.tracers.filter((t) => t.ttl <= 0)) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
    }
    this.tracers = this.tracers.filter((t) => t.ttl > 0);
    this.flash = Math.max(0, this.flash - dt);
    return damage;
  }
}
