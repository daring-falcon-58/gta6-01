// Street pickups: armour vests and one SMG cache, placed in the world
// as glowing markers the player walks over. Armour soaks damage before
// health does; the SMG is a faster-firing second gun with its own ammo.
// Pickups respawn after 45 seconds, so a long session never runs dry.
import * as THREE from 'three';

function vestMesh() {
  const g = new THREE.Group();
  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7, emissive: 0x1a5c2e, emissiveIntensity: 0.5 }),
  );
  vest.position.y = 0.9;
  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.6, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }),
  );
  crossV.position.set(0, 0.9, 0.28);
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.28, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }),
  );
  crossH.position.set(0, 0.9, 0.28);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  pole.position.y = 0.45;
  g.add(vest, crossV, crossH, pole);
  return g;
}

function smgCrateMesh() {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.8, emissive: 0x8a6d00, emissiveIntensity: 0.35 }),
  );
  crate.position.y = 0.5;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.24, 1.12),
    new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xaa8800, emissiveIntensity: 0.6 }),
  );
  stripe.position.y = 0.5;
  g.add(crate, stripe);
  return g;
}

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    // Spots sit on road lines and the plaza, never inside a tower's
    // footprint (blocks centre 20u off the road grid): the player can
    // always walk onto them.
    const spots = [
      { kind: 'armour', x: 14, z: 10, label: 'armour' },
      { kind: 'armour', x: -160, z: 120, label: 'armour' },
      { kind: 'armour', x: 40, z: 168, label: 'armour' },
      { kind: 'smg', x: 120, z: -120, label: 'smg' },
    ];
    for (const s of spots) {
      const mesh = s.kind === 'armour' ? vestMesh() : smgCrateMesh();
      mesh.position.set(s.x, 0, s.z);
      scene.add(mesh);
      this.items.push({ ...s, mesh, taken: false, respawn: 0 });
    }
  }

  clear() {
    for (const it of this.items) {
      it.taken = false; it.respawn = 0; it.mesh.visible = true;
    }
  }

  // Walk-over check. Returns the pickup taken this frame, or null.
  step(dt, px, pz) {
    for (const it of this.items) {
      if (it.taken) {
        it.respawn -= dt;
        if (it.respawn <= 0) { it.taken = false; it.mesh.visible = true; }
        continue;
      }
      if (Math.hypot(px - it.x, pz - it.z) < 2.4) {
        it.taken = true; it.respawn = 45; it.mesh.visible = false;
        return it.kind;
      }
    }
    return null;
  }
}
