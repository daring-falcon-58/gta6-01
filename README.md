# SOLMAR BAY — an open-world crime game (make.fun gta6-01)

You are **Danny Cross**, a wheelman fresh out of the Bay City lockup. Fixer
**Lena Voss** has five jobs for you across Solmar Bay — a sun-soaked coastal
city that is entirely original: its streets, towers, beach, pier, people,
cars, story, sound and music are all built for this entry. Nothing here comes
from Rockstar Games or any other commercial game.

## What is in the game

- **A city on foot and by car** — a procedural grid city (towers, plaza,
  beach, ocean, pier, palms, street lights) you explore walking or driving.
- **Traffic and pedestrians** — 14 cars looping the road grid, 26 walkers on
  the sidewalks who flee gunfire; parked cars to steal (press E).
- **Wanted system and police** — 0–5 stars. Crimes raise the heat; cruisers
  chase and ram, officers close in on foot at 3+ stars; hide and the heat
  cools. Get caught and you are BUSTED.
- **Missions and a story** — five jobs from Lena Voss (pickup, steal a sports
  car, payback against a rival crew, a getaway, a final heist), with a beacon,
  HUD objective text and cash rewards.
- **Combat** — punch (F) and a hitscan pistol (mouse click) with tracers;
  rival gang members chase and fight back.
- **HUD with a minimap** — cash, health, wanted stars, ammo, speed, mission
  objective, and a live top-down minimap (roads, beach, player arrow,
  traffic, police, rivals, mission marker).
- **Start and save** — title screen with New Game / Continue, pause menu,
  autosave + localStorage save (cash, mission, health, position).
- **Polish** — third-person chase camera with mouse orbit, synthesized
  WebAudio sound (engine, sirens, gunshots, pickups) and a looping BAY FM
  bassline (R to switch, M to mute), day sun + shadows, screen-space
  crosshair, toast messages.

## Controls

WASD move / drive · SHIFT sprint · E enter / steal car · SPACE brake / jump ·
mouse orbit + aim · CLICK shoot · F punch · R radio · M mute · P pause ·
ENTER start.

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
`vehicles`, `pedestrians`, `police`, `missions`, `combat`, `hud`, `audio`,
`input`, `save`, `shots`, `rng`). MIT licensed.
