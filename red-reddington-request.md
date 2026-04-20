# Permission request to red-reddington

**Thread:** https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610

**Demos:**
- L-system forest: https://codepen.io/the-red-reddington/full/JoXxmzY
- Custom per-tree culling: https://codepen.io/the-red-reddington/full/NPNJdoV

**License status:** None stated. Default = All Rights Reserved. Must ask.

---

## Draft reply (in English — discourse.threejs.org is English-language)

> Hi @red-reddington, this looks fantastic — especially the two-draw-call architecture and the per-tree CPU culling. Really impressive for mobile.
>
> I'm building **birdybird**, a small mobile-first bird-flight game in Three.js (tilt controls, open-source hobby project, runs on GitHub Pages). We already integrate @phil_crowther's iFFT ocean on the water side, and your procedural forest would be a huge upgrade over our current sprite-tree setup for the 6 km world we render.
>
> Before I start porting it, I wanted to ask directly: **would you be OK with us using your L-system forest code in a non-commercial open-source project, with attribution and a link back to this thread?** Happy to follow whatever license terms you prefer (MIT / CC-BY / custom / "sure, just credit me" — your call).
>
> If you'd rather keep it as a personal demo, no problem at all — I completely understand. Just thought it was worth asking.
>
> Repo: https://github.com/pmmathias/birdybird
> Live: https://pmmathias.github.io/birdybird/
>
> Thanks either way — and great work!

---

## Technical integration notes (for us)

**Feasibility: YES**
- Our `src/world/ForestPlacer.js` (173 LOC) + `src/world/TreeCluster.js` (426 LOC) are ~600 lines of sprite-based forest. Replaceable.
- Three.js r0.183 — compatible with instanced forest approach
- Forest is regenerated per biome via `world.regenerateForest(biome.forest)` → already modular
- Mobile perf budget: current system cut `TREE_CLUSTER_COUNT` 4000→2200 for FPS. 2 draw calls instead would be a huge win.

**Risks:**
- CodePen code may need adaptation (different module pattern, likely CDN Three.js)
- Mobile iFFT + procedural forest + existing terrain chunking might push GPU limits on older iPhones — need to profile
- Vertex shader LOD + chunked terrain: needs check that tree positions respect our `getTerrainHeight()` arcs

**Effort estimate if granted:** 1–2 days including integration, biome tinting, mobile profiling.
