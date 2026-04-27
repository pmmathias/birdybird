# birdybird perf bench

_Captured 2026-04-27T07:38:40.455Z_

## WebGL2 (default)

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 455, textures: 51, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 44.9 | 29.8 | 22.26 | 33.60 | 35.60 | 681 | 8257253 |
| air-over-ocean | 49.2 | 37.5 | 20.34 | 26.70 | 28.90 | 4584 | 4724567 |
| skim-ocean | 47.3 | 34.7 | 21.14 | 28.80 | 30.80 | 8700 | 4740997 |
| submerged | 49.7 | 37.2 | 20.12 | 26.90 | 28.00 | 12289 | 4729783 |
| inside-forest | 48.1 | 35.0 | 20.79 | 28.60 | 29.70 | 15266 | 6163199 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | +0.4 | +4.3 | -0.4 | +0.3 | -0.2 |
| air-over-ocean | +0.4 | +0.2 | -0.7 | +0.2 | -0.0 |
| skim-ocean | +0.8 | -7.6 | -8.3 | +0.1 | -0.0 |
| submerged | -0.3 | -0.6 | -0.4 | -0.4 | -0.5 |
| inside-forest | +0.3 | +1.2 | -0.0 | -8.5 | -2.8 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+4.3), water plane (+0.4), buildings (+0.3), terrain chunks (+-0.2), clouds (+-0.4)
- **air-over-ocean**: water plane (+0.4), buildings (+0.2), rr-forest (+0.2), terrain chunks (+-0.0), clouds (+-0.7)
- **skim-ocean**: water plane (+0.8), buildings (+0.1), terrain chunks (+-0.0), rr-forest (+-7.6), clouds (+-8.3)
- **submerged**: water plane (+-0.3), clouds (+-0.4), buildings (+-0.4), terrain chunks (+-0.5), rr-forest (+-0.6)
- **inside-forest**: rr-forest (+1.2), water plane (+0.3), clouds (+-0.0), terrain chunks (+-2.8), buildings (+-8.5)

## WebGPU

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 681, textures: 51, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 44.0 | 29.0 | 22.71 | 34.50 | 36.10 | 786 | 8103855 |
| air-over-ocean | 48.9 | 38.3 | 20.45 | 26.10 | 27.10 | 4695 | 4722525 |
| skim-ocean | 48.3 | 37.9 | 20.69 | 26.40 | 27.80 | 8784 | 4738983 |
| submerged | 45.3 | 27.6 | 22.08 | 36.20 | 45.90 | 12164 | 4728779 |
| inside-forest | 40.1 | 28.4 | 24.92 | 35.20 | 36.60 | 14877 | 5331657 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | +0.5 | +4.8 | +1.4 | +1.3 | +1.4 |
| air-over-ocean | +0.1 | +0.1 | +0.0 | +0.0 | -1.6 |
| skim-ocean | -0.2 | -8.5 | -0.7 | -6.1 | -16.8 |
| submerged | +2.5 | +2.4 | +2.6 | +2.1 | -6.9 |
| inside-forest | -0.3 | +0.2 | +0.3 | +0.5 | +0.6 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+4.8), clouds (+1.4), terrain chunks (+1.4), buildings (+1.3), water plane (+0.5)
- **air-over-ocean**: rr-forest (+0.1), water plane (+0.1), clouds (+0.0), buildings (+0.0), terrain chunks (+-1.6)
- **skim-ocean**: water plane (+-0.2), clouds (+-0.7), buildings (+-6.1), rr-forest (+-8.5), terrain chunks (+-16.8)
- **submerged**: clouds (+2.6), water plane (+2.5), rr-forest (+2.4), buildings (+2.1), terrain chunks (+-6.9)
- **inside-forest**: terrain chunks (+0.6), buildings (+0.5), clouds (+0.3), rr-forest (+0.2), water plane (+-0.3)
