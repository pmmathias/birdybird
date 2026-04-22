# birdybird perf bench

_Captured 2026-04-22T10:21:25.126Z_

## WebGL2 (default)

- renderer: **WebGL2**  |  water: **iFFT**
- canvas: 1280x720
- geometries: 518, textures: 26, programs: 35

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 68.3 | 59.2 | 14.65 | 16.90 | 18.80 | 1426 | 8316924 |
| air-over-ocean | 190.1 | 153.8 | 5.26 | 6.50 | 6.90 | 157 | 135348 |
| skim-ocean | 177.5 | 149.3 | 5.64 | 6.70 | 7.10 | 195 | 143608 |
| submerged | 359.8 | 256.4 | 2.78 | 3.90 | 7.80 | 98 | 141442 |
| inside-forest | 150.2 | 120.5 | 6.66 | 8.30 | 9.20 | 296 | 6252624 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -0.8 | +0.8 | +13.3 | +1.0 | +3.5 |
| air-over-ocean | +2.7 | -0.6 | +73.9 | +1.2 | +1.0 |
| skim-ocean | -1.7 | +0.5 | +90.8 | +9.1 | +2.9 |
| submerged | -6.1 | +19.8 | +85.5 | +22.4 | +24.6 |
| inside-forest | +6.1 | +14.6 | +82.5 | +3.8 | +11.4 |

### Ranked bottlenecks per scenario

- **air-over-land**: clouds (+13.3), terrain chunks (+3.5), buildings (+1.0), rr-forest (+0.8), water plane (+-0.8)
- **air-over-ocean**: clouds (+73.9), water plane (+2.7), buildings (+1.2), terrain chunks (+1.0), rr-forest (+-0.6)
- **skim-ocean**: clouds (+90.8), buildings (+9.1), terrain chunks (+2.9), rr-forest (+0.5), water plane (+-1.7)
- **submerged**: clouds (+85.5), terrain chunks (+24.6), buildings (+22.4), rr-forest (+19.8), water plane (+-6.1)
- **inside-forest**: clouds (+82.5), rr-forest (+14.6), terrain chunks (+11.4), water plane (+6.1), buildings (+3.8)

## WebGPU

- renderer: **WebGPU**  |  water: **iFFT (WebGPU)**
- canvas: 1280x720
- geometries: 235, textures: 31, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 62.1 | 34.8 | 16.10 | 28.70 | 35.40 | 1077 | 12525401 |
| air-over-ocean | 123.8 | 87.0 | 8.08 | 11.50 | 18.60 | 7791 | 4725273 |
| skim-ocean | 105.8 | 61.7 | 9.45 | 16.20 | 31.70 | 17982 | 4741739 |
| submerged | 125.8 | 61.3 | 7.95 | 16.30 | 21.00 | 27679 | 4730161 |
| inside-forest | 71.0 | 52.9 | 14.08 | 18.90 | 40.60 | 34247 | 12461583 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | +0.3 | +56.5 | -0.0 | +0.5 | +0.3 |
| air-over-ocean | +1.2 | +0.7 | +0.9 | +0.5 | +0.6 |
| skim-ocean | +13.7 | +17.3 | +17.9 | +17.8 | +17.2 |
| submerged | -0.0 | +0.1 | -0.6 | -22.4 | -2.4 |
| inside-forest | -6.9 | +6.4 | -1.7 | -6.8 | -6.9 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+56.5), buildings (+0.5), terrain chunks (+0.3), water plane (+0.3), clouds (+-0.0)
- **air-over-ocean**: water plane (+1.2), clouds (+0.9), rr-forest (+0.7), terrain chunks (+0.6), buildings (+0.5)
- **skim-ocean**: clouds (+17.9), buildings (+17.8), rr-forest (+17.3), terrain chunks (+17.2), water plane (+13.7)
- **submerged**: rr-forest (+0.1), water plane (+-0.0), clouds (+-0.6), terrain chunks (+-2.4), buildings (+-22.4)
- **inside-forest**: rr-forest (+6.4), clouds (+-1.7), buildings (+-6.8), terrain chunks (+-6.9), water plane (+-6.9)
