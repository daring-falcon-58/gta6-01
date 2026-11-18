// Screenshot staging behind ?shot=start|drive|chase|mission&seed=N.
// Each scene plays the real rules forward from a fresh world on a fixed
// seed, steered through the game's own input path — so every frame is
// what a short game really looks like, and the same seed gives the same
// frame. The caller renders one frame and then sets window.__shotReady.
import { mulberry32 } from './rng.js';

const STEP = 1 / 60;

function runSteps(game, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.state !== 'playing') break;
    if (steer) steer(game, i * STEP);
    game.step(STEP);
    game.input.endFrame();
  }
  game.input.setVirtual(null);
}

// Drive straight down the road the car sits on: the car is placed on a
// road centre line heading along it, so holding W with no steering keeps
// it on the asphalt and the chase camera behind it stays clear of
// buildings. Steering toward a road axis from a sidewalk start drove the
// car into a block and buried the camera in a tower.
function driveForward(game) {
  return () => {
    const car = game.playerCar;
    if (!car) return;
    game.camYaw = car.heading;
    game.input.setVirtual(0, 1);
  };
}

/**
 * Set the game to the named scene and leave it ready to render.
 * start: title over a living city. drive: behind the wheel in traffic.
 * chase: 3 wanted stars with police closing in. mission: on foot at the
 * docks with JOB 3 live and rivals in frame.
 */
export function stageShot(name, game) {
  const rng = mulberry32(game.seed * 7 + 3);
  game.reset(game.seed);
  if (name === 'drive') {
    game.startRun();
    // Steal the nearest parked car through the real key path, then place
    // it on the road centre line heading east so the drive stays on
    // asphalt (and clear of the plaza, so no mission toast fires).
    const car = game.traffic.nearestParked(game.player.x, game.player.z, 60);
    if (car) {
      game.player.x = car.x - 3; game.player.z = car.z;
      game.enterCar(car);
      car.x = -60; car.z = 40; car.heading = Math.PI / 2; car.speed = 0;
      car.sync();
      game.player.x = car.x; game.player.z = car.z;
      game.camYaw = car.heading;
    }
    runSteps(game, 6, driveForward(game));
  } else if (name === 'chase') {
    game.startRun();
    const car = game.traffic.nearestParked(game.player.x, game.player.z, 60);
    if (car) {
      game.player.x = car.x - 3; game.player.z = car.z;
      game.enterCar(car);
      car.x = -60; car.z = 40; car.heading = Math.PI / 2; car.speed = 0;
      car.sync();
      game.player.x = car.x; game.player.z = car.z;
      game.camYaw = car.heading;
    }
    game.police.addHeat(55);
    runSteps(game, 5, driveForward(game));
    void rng;
  } else if (name === 'mission') {
    game.startRun();
    // Jump to JOB 3 (Payback) at the docks with rivals spawned.
    game.missions.index = 2;
    game.missions.start();
    game.combat.spawnRivals(game.city.landmarks.docks.x, game.city.landmarks.docks.z, 4, game.seed + 11);
    game.player.x = game.city.landmarks.docks.x + 14;
    game.player.z = game.city.landmarks.docks.z + 10;
    game.player.heading = Math.atan2(
      game.city.landmarks.docks.x - game.player.x,
      game.city.landmarks.docks.z - game.player.z,
    );
    game.camYaw = game.player.heading;
    for (let i = 0; i < Math.round(2.5 / STEP); i += 1) {
      game.step(STEP);
      game.input.endFrame();
    }
  } else {
    // start: the title screen over a living city, traffic rolling.
    game.state = 'title';
    for (let i = 0; i < Math.round(1.2 / STEP); i += 1) game.stepAmbient(STEP);
    game.state = 'title';
  }
  game.hud.setObjective(game.missions.current() ? game.missions.current().title : 'SOLMAR BAY',
    game.missions.current() ? game.missions.current().text : 'Press ENTER to start.',
    game.missions.progressText());
}
