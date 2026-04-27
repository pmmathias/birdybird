# birdybird perf bench

_Captured 2026-04-27T06:01:50.292Z_

## WebGL2 (default)

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 334, textures: 50, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 47.4 | 33.7 | 21.11 | 29.70 | 30.60 | 855 | 6381201 |
| air-over-ocean | 49.1 | 36.9 | 20.36 | 27.10 | 28.30 | 4887 | 4727309 |
| skim-ocean | 49.2 | 36.9 | 20.31 | 27.10 | 28.00 | 9045 | 4743727 |
| submerged | 49.2 | 37.2 | 20.31 | 26.90 | 27.70 | 12833 | 4731145 |
| inside-forest | 48.4 | 34.1 | 20.65 | 29.30 | 30.20 | 15768 | 5561957 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -0.0 | +1.2 | -0.3 | +0.2 | +0.0 |
| air-over-ocean | +0.1 | +0.3 | +0.3 | +0.3 | +0.3 |
| skim-ocean | +0.2 | -8.5 | -0.8 | -0.0 | -0.1 |
| submerged | -4.3 | -0.5 | -0.2 | -0.5 | -0.2 |
| inside-forest | -2.2 | +0.4 | +0.1 | +0.3 | +0.1 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+1.2), buildings (+0.2), terrain chunks (+0.0), water plane (+-0.0), clouds (+-0.3)
- **air-over-ocean**: clouds (+0.3), rr-forest (+0.3), terrain chunks (+0.3), buildings (+0.3), water plane (+0.1)
- **skim-ocean**: water plane (+0.2), buildings (+-0.0), terrain chunks (+-0.1), clouds (+-0.8), rr-forest (+-8.5)
- **submerged**: terrain chunks (+-0.2), clouds (+-0.2), rr-forest (+-0.5), buildings (+-0.5), water plane (+-4.3)
- **inside-forest**: rr-forest (+0.4), buildings (+0.3), terrain chunks (+0.1), clouds (+0.1), water plane (+-2.2)

## WebGPU

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 124, textures: 51, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 43.6 | 31.3 | 22.92 | 31.90 | 34.00 | 777 | 8584923 |
| air-over-ocean | 48.6 | 37.0 | 20.56 | 27.00 | 28.40 | 4587 | 4725701 |
| skim-ocean | 49.2 | 36.9 | 20.34 | 27.10 | 27.80 | 8721 | 4742109 |
| submerged | 48.6 | 36.5 | 20.59 | 27.40 | 28.70 | 12489 | 4730339 |
| inside-forest | 48.3 | 34.5 | 20.72 | 29.00 | 30.10 | 15430 | 5879793 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -0.0 | +4.8 | -0.1 | +0.2 | -0.1 |
| air-over-ocean | +0.5 | +0.4 | +0.3 | +0.4 | +0.5 |
| skim-ocean | -0.1 | -4.0 | -5.5 | -0.4 | -0.2 |
| submerged | -0.4 | +0.4 | +0.3 | +0.3 | +0.4 |
| inside-forest | +0.2 | +0.7 | -2.8 | +0.2 | +0.3 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+4.8), buildings (+0.2), water plane (+-0.0), terrain chunks (+-0.1), clouds (+-0.1)
- **air-over-ocean**: terrain chunks (+0.5), water plane (+0.5), buildings (+0.4), rr-forest (+0.4), clouds (+0.3)
- **skim-ocean**: water plane (+-0.1), terrain chunks (+-0.2), buildings (+-0.4), rr-forest (+-4.0), clouds (+-5.5)
- **submerged**: rr-forest (+0.4), terrain chunks (+0.4), buildings (+0.3), clouds (+0.3), water plane (+-0.4)
- **inside-forest**: rr-forest (+0.7), terrain chunks (+0.3), water plane (+0.2), buildings (+0.2), clouds (+-2.8)
