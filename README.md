# SOLMAR BAY — an open-world crime game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/daring-falcon-58/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/daring-falcon-58/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

You are **Danny Cross**, a wheelman fresh out of the Bay City lockup. Fixer
**Lena Voss** has eight jobs for you across Solmar Bay — a sun-soaked coastal
city at golden hour that is entirely original: its streets, towers, beach,
pier, people, cars, story, sound and music are all built for this entry.
Nothing here comes from Rockstar Games or any other commercial game.

## What is in the game

- **A city on foot and by car** — a procedural grid city (towers, plaza,
  beach, ocean, pier, palms, street lights) you explore walking or driving.
- **Traffic and pedestrians** — 14 cars looping the road grid, 26 walkers on
  the sidewalks who flee gunfire; parked cars to steal (press E).
- **Wanted system and police** — 0–5 stars. Crimes raise the heat; cruisers
  chase and ram, officers close in on foot at 3+ stars, and at 4 stars the
  SBPD air unit CONDOR-1 deploys with a searchlight cone. The dispatch
  board lists every responding unit by callsign, role (RAMMING / PURSUE /
  ROADBLOCK / SPOTLIGHT) and distance; the farthest cruiser sets a
  roadblock ahead of you. Hide and the heat cools. Get caught and you are
  BUSTED.
- **Missions and a story** — eight jobs from Lena Voss (pickup, steal a sports
  car, payback against a rival crew, a getaway, a pier heist, wrecking a
  fleeing Meridian GT by ramming, a timed three-drop courier run, and the
  last score at the docks), with a beacon, HUD objective + stage + next
  step, fixer dialogue briefings, and cash rewards.
- **Combat** — punch (F) and hitscan guns (mouse click) with tracers; rival
  gang members chase and fight back. Weapon slots (1/2/3): fists, P9
  pistol, and an SMG found in the garage cache. Armour vests on the street
  soak damage before health does.
- **HUD with a minimap** — cash, health, armour, wanted stars, ammo, weapon
  slots, speed, vehicle name + condition, respect rank, district + clock,
  radio station, mission objective with stage and next step, SBPD dispatch
  board, fixer dialogue, and a live top-down minimap (roads, beach, player
  arrow, traffic, police, rivals, mission marker).
- **Start and save** — title screen with New Game / Continue, pause menu,
  autosave + localStorage save (cash, mission, health, position).
- **Polish** — third-person chase camera with mouse orbit, synthesized
  WebAudio sound (engine, sirens, gunshots, pickups) and a looping BAY FM
  bassline (R to switch, M to mute), golden-hour dusk sun + gradient sky +
  long shadows, screen-space crosshair, toast messages.

## Controls

WASD move / drive · SHIFT sprint · E enter / steal car · SPACE brake / jump ·
mouse orbit + aim · CLICK shoot · F punch · 1/2/3 weapons · R radio · M mute ·
P pause · ENTER start.

## Run it

Serve `game/` with any static server and open `index.html` in desktop
Chrome — no network requests, no build step:

```
node serve.ts            # serves game/ on http://localhost:8080
```

Screenshots are staged scenes of the real game (`?shot=start|drive|chase|mission&seed=N`).

## Tech

three.js r187 vendored as `game/vendor/three.module.min.js`; the game's own
source is split by job under `game/src/` (`main`, `city`, `player`,
`vehicles`, `pedestrians`, `police`, `helicopter`, `dispatch`, `pickups`,
`missions`, `combat`, `hud`, `audio`, `input`, `save`, `shots`, `rng`). MIT licensed.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
