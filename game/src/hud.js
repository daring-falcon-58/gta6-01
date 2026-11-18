// HUD: cash, wanted stars, health, ammo, mission objective, speed, toast
// messages — and the minimap, a live top-down canvas of the city with the
// player, traffic, police, rivals and the mission marker on it.
import { CITY } from './city.js';

export class HUD {
  constructor() {
    this.cashEl = document.getElementById('cash');
    this.wantedEl = document.getElementById('wanted');
    this.healthEl = document.getElementById('healthfill');
    this.ammoEl = document.getElementById('ammo');
    this.objTitle = document.getElementById('objTitle');
    this.objText = document.getElementById('objText');
    this.speedEl = document.getElementById('speed');
    this.msgEl = document.getElementById('msg');
    this.toastEl = document.getElementById('toast');
    this.crossEl = document.getElementById('crosshair');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this._msgTimer = 0;
    this._toastTimer = 0;
  }

  setObjective(title, text, progress) {
    this.objTitle.textContent = title;
    this.objText.textContent = progress ? `${text} — ${progress}` : text;
  }

  setCash(cash) { this.cashEl.textContent = `$ ${cash.toLocaleString('en-US')}`; }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < stars ? '★' : '☆';
    this.wantedEl.innerHTML = '';
    for (let i = 0; i < 5; i += 1) {
      const span = document.createElement('span');
      span.textContent = i < stars ? '★' : '☆';
      if (i < stars) span.className = 'lit';
      this.wantedEl.appendChild(span);
    }
    void s;
  }

  setHealth(h) { this.healthEl.style.width = `${Math.max(0, h)}%`; }

  setAmmo(ammo, inCar) {
    this.ammoEl.textContent = inCar ? 'IN CAR — E to exit' : `PISTOL — ${ammo} rounds`;
    this.crossEl.style.display = inCar ? 'none' : 'block';
  }

  setSpeed(kmh) {
    this.speedEl.innerHTML = kmh > 0 ? `${Math.round(kmh)}<small> km/h</small>` : '';
  }

  message(text, seconds) {
    this.msgEl.textContent = text;
    this._msgTimer = seconds || 3;
  }

  toast(text, seconds) {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this._toastTimer = seconds || 2.5;
  }

  tick(dt) {
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) this.msgEl.textContent = '';
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.style.display = 'none';
    }
  }

  // Top-down minimap: roads grey, beach sand, ocean blue, marker gold,
  // player white arrow, traffic yellow, police blue/red, rivals red.
  drawMinimap(world) {
    const ctx = this.mapCtx;
    const S = 200;
    const toMap = (x, z) => [((x + CITY.half) / (CITY.half * 2)) * S, ((z + CITY.half) / (CITY.half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#14301f';
    ctx.fillRect(0, 0, S, S);
    // Ocean + beach (south edge).
    const [, beachY] = toMap(0, CITY.beachZ);
    ctx.fillStyle = '#1d6fb8';
    ctx.fillRect(0, beachY + 8, S, S);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, beachY, S, 8);
    // Roads.
    ctx.strokeStyle = '#5a5f6b';
    ctx.lineWidth = 5;
    for (let a = -CITY.half; a <= CITY.half; a += CITY.block) {
      const [x1, y1] = toMap(a, -CITY.half);
      const [x2, y2] = toMap(a, CITY.half);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [hx1, hy1] = toMap(-CITY.half, a);
      const [hx2, hy2] = toMap(CITY.half, a);
      ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    };
    if (world.missionTarget) dot(world.missionTarget.x, world.missionTarget.z, 6, '#ffb03a');
    for (const c of world.trafficCars) dot(c.x, c.z, 2.5, '#f1c40f');
    for (const c of world.policeCars) dot(c.x, c.z, 3.5, '#ff3b30');
    for (const r of world.rivals) if (r.alive) dot(r.x, r.z, 3, '#ff5a4e');
    // Player arrow (white triangle, rotated to heading).
    const [px, py] = toMap(world.playerX, world.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(world.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 12);
  }
}
