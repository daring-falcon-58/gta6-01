// Keyboard + mouse input, with a virtual stick the screenshot autopilot
// drives through the same path as a real player (no special-casing).
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.virtual = null; // {x, y} screen-space steering vector, or null
    this._pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    // Clicks on menus/buttons are UI, not gunfire: the New Game button
    // must not fire the pistol (it did — phantom shot + wanted star).
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !(e.target.closest && e.target.closest('.screen, button'))) {
        this.mouseDown = true; this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }

  down(code) { return this.keys.has(code); }

  // True once, on the frame the key was pressed.
  pressed(code) { return this._pressed.has(code); }

  axis() {
    let x = 0; let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.virtual) { x = this.virtual.x; y = this.virtual.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  setVirtual(x, y) {
    this.virtual = x === null ? null : { x, y };
  }

  endFrame() {
    this._pressed.clear();
    this.mouseClicked = false;
  }
}
