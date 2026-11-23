// Danny Cross on foot: third-person walker with a simple box-built
// character, sprint, jump, punch and pistol; E steals the nearest car.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { collideCircle, clampToCity } from './city.js';

export function buildCharacter(colorShirt, colorPants) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: colorShirt, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: colorPants, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.36), shirt);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.75;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshStandardMaterial({ color: 0x223344 }));
  cap.position.y = 1.98;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), shirt);
  armL.position.set(-0.46, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.46;
  g.add(legs, torso, head, cap, armL, armR);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export class Player {
  constructor(scene, colliders) {
    this.colliders = colliders;
    this.mesh = buildCharacter(0xffb03a, 0x2e4a6b);
    scene.add(this.mesh);
    this.x = 0; this.z = 24;
    this.heading = Math.PI; // facing the plaza
    this.y = 0; this.vy = 0;
    this.health = 100;
    this.armour = 0; // vest pickup soaks damage before health does
    this.ammo = 60;
    this.smgAmmo = 0;
    this.hasSmg = false;
    this.weapon = 'pistol'; // fists | pistol | smg
    this.speed = 0;
    this.punchCd = 0;
    this.shootCd = 0;
    this.onFoot = true;
    this.walkPhase = 0;
  }

  reset(x, z) {
    this.x = x; this.z = z; this.heading = Math.PI;
    this.health = 100; this.armour = 0; this.ammo = 60;
    this.smgAmmo = 0; this.hasSmg = false; this.weapon = 'pistol';
    this.onFoot = true; this.y = 0; this.vy = 0;
    this.mesh.visible = true;
  }

  // dt seconds of on-foot movement. Returns the move direction for the camera.
  step(dt, input, camYaw) {
    const ax = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? 9 : 5.2;
    let mx = 0; let mz = 0;
    if (ax.x !== 0 || ax.y !== 0) {
      // Movement is camera-relative: W walks away from the camera
      // (camera->player direction is (sin(camYaw), cos(camYaw))), D strafes
      // right along (-cos(camYaw), sin(camYaw)).
      const sin = Math.sin(camYaw); const cos = Math.cos(camYaw);
      mx = sin * ax.y - cos * ax.x;
      mz = cos * ax.y + sin * ax.x;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      this.heading = Math.atan2(mx, mz);
    }
    const nx = this.x + mx * speed * dt;
    const nz = this.z + mz * speed * dt;
    const fixed = collideCircle(this.colliders, nx, nz, 0.6);
    const clamped = clampToCity(fixed.x, fixed.z);
    this.x = clamped.x; this.z = clamped.z;
    this.speed = (ax.x !== 0 || ax.y !== 0) ? speed : 0;
    if (this.speed > 0) this.walkPhase += dt * this.speed * 1.6;

    // Jump with Space.
    if (input.pressed('Space') && this.y === 0) this.vy = 7;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = this.speed > 0 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    this.mesh.position.y = this.y + Math.abs(Math.sin(this.walkPhase)) * (this.speed > 0 ? 0.06 : 0);
  }

  // Armour absorbs 60% of each hit; the rest reaches health.
  damage(amount) {
    const soaked = Math.min(this.armour, amount * 0.6);
    this.armour = Math.max(0, this.armour - soaked);
    this.health = clamp(this.health - (amount - soaked), 0, 100);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }
}
