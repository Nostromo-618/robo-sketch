# Robo-Sketch

A 3D third-person mech controller built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Drive a bipedal mech around a glowing arena of randomly placed obstacles, walk/run/jump with animation blending, and toggle between a smooth follow camera and an orbit inspector.

![Demo placeholder](docs/demo.png)

> Add a GIF or screenshot to `docs/demo.png` and it will render here.

## Features

- Third-person follow camera with damping, plus a free-orbit inspection mode (`C` to toggle).
- Keyboard-driven locomotion: walk, run, strafe, back-pedal, jump.
- Animation blending between `idle`, `walk`, `run` and a jump clip sourced from a rigged GLB.
- Physics: simple velocity + gravity, capsule-vs-AABB collision against neon obstacle boxes.
- Procedurally lit arena: directional sun, three coloured neon point lights, fog, glowing grid floor.
- Live HUD: position, speed gauge, active state, animation progress, camera-mode badge, key-state indicators.

## Controls

| Key                | Action            |
| ------------------ | ----------------- |
| `W` / `↑`          | Move forward      |
| `S` / `↓`          | Move backward     |
| `A` / `←`          | Strafe left       |
| `D` / `→`          | Strafe right      |
| `Shift`            | Run               |
| `Space`            | Jump              |
| `C`                | Toggle follow / orbit camera |

## Getting started

Prerequisites: Node.js ≥ 18 and a package manager (pnpm, npm, or yarn).

```bash
# install deps
npm install

# start dev server (prints http://localhost:5173)
npm run dev

# production build to ./dist
npm run build

# preview the production build
npm run preview
```

The dev server uses `--host`, so it will be reachable from other devices on your LAN as well.

## Assets

The mech character and merged animation file live in `public/`:

- `public/Meshy_AI_V02_Mech_biped_Character_output.glb` — rigged character mesh
- `public/Meshy_AI_V02_Mech_biped_Meshy_AI_Meshy_Merged_Animations.glb` — animation library

These files are tracked with **Git LFS** because they total ~75 MB and would otherwise exceed GitHub's per-file size guidance. To clone the repo with assets intact:

```bash
git lfs install
git clone <repo-url>
```

If you already cloned without LFS, run `git lfs pull` inside the repo.

## Project structure

```
.
├── index.html              # Vite entry HTML
├── src/
│   ├── main.js             # Scene, controls, physics, animation blending
│   └── style.css           # HUD, loader, key indicators
├── public/                 # Static assets served at /
├── vite.config.js
├── package.json
└── LICENSE
```

## Tech stack

- [three.js](https://threejs.org/) — WebGL rendering, GLTF loader, animation mixer
- [Vite](https://vitejs.dev/) — dev server + build
- Vanilla JS (ES modules), no framework

## License

[MIT](./LICENSE).
