# birdybird perf bench

_Captured 2026-04-22T11:11:26.286Z_

## WebGL2 (default)

- renderer: **WebGL2**  |  water: **iFFT**
- canvas: 1280x720
- geometries: 413, textures: 26, programs: 36

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 117.7 | 96.2 | 8.50 | 10.40 | 11.40 | 444 | 9257862 |
| air-over-ocean | 179.7 | 144.9 | 5.56 | 6.90 | 7.70 | 159 | 138472 |
| skim-ocean | 192.4 | 158.7 | 5.20 | 6.30 | 7.50 | 161 | 146660 |
| submerged | 328.6 | 232.6 | 3.04 | 4.30 | 5.30 | 79 | 142964 |
| inside-forest | 67.5 | 60.6 | 14.82 | 16.50 | 18.30 | 1417 | 10279456 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -2.5 | +5.7 | +48.1 | +6.5 | +14.2 |
| air-over-ocean | -1.9 | +19.9 | +64.9 | +14.1 | +13.6 |
| skim-ocean | -12.1 | -4.7 | +33.7 | +1.5 | -5.7 |
| submerged | +3.2 | +10.9 | +49.2 | -0.2 | +0.5 |
| inside-forest | -2.5 | -3.0 | +9.4 | +0.1 | -2.2 |

### Ranked bottlenecks per scenario

- **air-over-land**: clouds (+48.1), terrain chunks (+14.2), buildings (+6.5), rr-forest (+5.7), water plane (+-2.5)
- **air-over-ocean**: clouds (+64.9), rr-forest (+19.9), buildings (+14.1), terrain chunks (+13.6), water plane (+-1.9)
- **skim-ocean**: clouds (+33.7), buildings (+1.5), rr-forest (+-4.7), terrain chunks (+-5.7), water plane (+-12.1)
- **submerged**: clouds (+49.2), rr-forest (+10.9), water plane (+3.2), terrain chunks (+0.5), buildings (+-0.2)
- **inside-forest**: clouds (+9.4), buildings (+0.1), terrain chunks (+-2.2), water plane (+-2.5), rr-forest (+-3.0)

## WebGPU

- renderer: **WebGPU**  |  water: **iFFT (WebGPU)**
- canvas: 1280x720
- geometries: 169, textures: 31, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 61.9 | 50.5 | 16.17 | 19.80 | 40.20 | 1068 | 13487521 |
| air-over-ocean | 123.3 | 71.4 | 8.11 | 14.00 | 19.70 | 7638 | 4723641 |
| skim-ocean | 97.7 | 50.3 | 10.24 | 19.90 | 30.60 | 17685 | 4740087 |
| submerged | 125.6 | 86.2 | 7.96 | 11.60 | 20.30 | 27267 | 4729327 |
| inside-forest | 67.1 | 52.6 | 14.89 | 19.00 | 39.20 | 33823 | 13547655 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -1.6 | +52.9 | -1.9 | -1.4 | -1.0 |
| air-over-ocean | +0.6 | +0.4 | +1.1 | -1.4 | +0.7 |
| skim-ocean | +21.6 | +25.1 | +24.7 | +23.9 | +22.7 |
| submerged | -0.3 | -10.1 | -0.6 | -2.7 | +0.2 |
| inside-forest | -6.5 | +37.0 | -7.5 | -7.0 | -6.1 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+52.9), terrain chunks (+-1.0), buildings (+-1.4), water plane (+-1.6), clouds (+-1.9)
- **air-over-ocean**: clouds (+1.1), terrain chunks (+0.7), water plane (+0.6), rr-forest (+0.4), buildings (+-1.4)
- **skim-ocean**: rr-forest (+25.1), clouds (+24.7), buildings (+23.9), terrain chunks (+22.7), water plane (+21.6)
- **submerged**: terrain chunks (+0.2), water plane (+-0.3), clouds (+-0.6), buildings (+-2.7), rr-forest (+-10.1)
- **inside-forest**: rr-forest (+37.0), terrain chunks (+-6.1), water plane (+-6.5), buildings (+-7.0), clouds (+-7.5)
