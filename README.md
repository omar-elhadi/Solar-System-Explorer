# Interactive Solar System

A minimalist, canvas-based visualization of our solar system. Explore the Sun and all eight planets with smooth orbital animations, zoom-to-focus interactions, and detailed informational panels.

## Demo
![]('./public/demo.png')
![]('./public/demo_details.png')

## Features

- Animated orbital motion for all eight planets with accurate relative speeds
- Click any planet or the Sun to view detailed info (diameter, distance, orbital period, atmosphere, moons, fun facts)
- Scroll to zoom, click planets to focus with cinematic camera transitions
- Pre-rendered planet textures with surface details (Earth's continents, Jupiter's bands, Saturn's rings, etc.)
- Play/pause and adjustable speed controls (0.1× – 10×)
- Toggleable labels and orbital paths
- Asteroid belt visualization
- Sidebar planet legend for quick navigation

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- HTML5 Canvas (2D context)

## Performance

Built for efficiency — runs smoothly even on modest hardware:

- Star field and planet textures are pre-rendered to offscreen canvases once
- Main render loop uses only `drawImage` calls per frame
- DPR capped at 2×, frame rate limited to 60fps
- Canvas created with `alpha: false` for faster compositing
- No per-frame gradient or trigonometric calculations for static elements

## Running Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is generated in `dist/`.

## Controls

| Input | Action |
|-------|--------|
| Click planet / Sun | Focus & show info panel |
| Scroll | Zoom in / out |
| Click empty space | Reset to overview |
| Play / Pause button | Toggle orbital animation |
| Speed controls | Adjust simulation speed |
| Labels / Orbits toggles | Show or hide UI layers |

## Project Structure

```
src/
├── App.tsx           # Main component, canvas rendering, interactions
├── main.tsx          # Entry point
├── index.css         # Tailwind + custom animations
└── data/
    └── planets.ts    # Planet data and types
```
