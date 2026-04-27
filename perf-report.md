# birdybird perf bench

_Captured 2026-04-27T07:20:35.975Z_

## WebGL2 (default)

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 260, textures: 51, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 46.1 | 30.2 | 21.68 | 33.10 | 35.00 | 804 | 7174263 |
| air-over-ocean | 49.8 | 38.5 | 20.07 | 26.00 | 26.60 | 4746 | 4726115 |
| skim-ocean | 49.7 | 38.0 | 20.11 | 26.30 | 27.60 | 8928 | 4742569 |
| submerged | 49.5 | 37.9 | 20.22 | 26.40 | 27.40 | 12715 | 4730571 |
| inside-forest | 49.1 | 36.0 | 20.38 | 27.80 | 29.70 | 15677 | 5737841 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | -0.8 | +2.1 | -0.6 | -0.2 | -0.2 |
| air-over-ocean | -0.1 | -0.1 | -0.2 | -0.1 | -0.0 |
| skim-ocean | -0.1 | -11.1 | -1.7 | -0.2 | +0.0 |
| submerged | -0.0 | -2.0 | -0.8 | -0.3 | -0.7 |
| inside-forest | +0.1 | +0.1 | +0.2 | +0.1 | -7.7 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+2.1), buildings (+-0.2), terrain chunks (+-0.2), clouds (+-0.6), water plane (+-0.8)
- **air-over-ocean**: terrain chunks (+-0.0), buildings (+-0.1), water plane (+-0.1), rr-forest (+-0.1), clouds (+-0.2)
- **skim-ocean**: terrain chunks (+0.0), water plane (+-0.1), buildings (+-0.2), clouds (+-1.7), rr-forest (+-11.1)
- **submerged**: water plane (+-0.0), buildings (+-0.3), terrain chunks (+-0.7), clouds (+-0.8), rr-forest (+-2.0)
- **inside-forest**: clouds (+0.2), rr-forest (+0.1), water plane (+0.1), buildings (+0.1), terrain chunks (+-7.7)

## WebGPU

- renderer: **WebGPU**  |  water: **iFFT ×3 (WebGPU)**
- canvas: 1280x720
- geometries: 91, textures: 51, programs: null

### Baseline FPS per scenario

| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |
|---|---|---|---|---|---|---|---|
| air-over-land | 42.7 | 32.3 | 23.43 | 31.00 | 32.40 | 780 | 9282075 |
| air-over-ocean | 49.3 | 38.0 | 20.29 | 26.30 | 27.80 | 4527 | 4728437 |
| skim-ocean | 46.8 | 35.3 | 21.39 | 28.30 | 32.60 | 8619 | 4744867 |
| submerged | 48.6 | 37.7 | 20.57 | 26.50 | 27.40 | 12480 | 4731715 |
| inside-forest | 44.8 | 26.6 | 22.30 | 37.60 | 48.60 | 15382 | 6260495 |

### Bottleneck toggles (Δ fps when subsystem is hidden)

| scenario | water | forest | clouds | houses | terrain |
|---|---|---|---|---|---|
| air-over-land | +0.1 | +6.0 | -0.6 | -0.2 | -0.6 |
| air-over-ocean | -0.6 | +0.1 | +0.1 | +0.2 | -1.0 |
| skim-ocean | +2.5 | +2.4 | +1.4 | +2.2 | +1.6 |
| submerged | +0.9 | -1.2 | -0.1 | +0.5 | -0.8 |
| inside-forest | +3.3 | +1.6 | +0.5 | +0.8 | -2.9 |

### Ranked bottlenecks per scenario

- **air-over-land**: rr-forest (+6.0), water plane (+0.1), buildings (+-0.2), clouds (+-0.6), terrain chunks (+-0.6)
- **air-over-ocean**: buildings (+0.2), clouds (+0.1), rr-forest (+0.1), water plane (+-0.6), terrain chunks (+-1.0)
- **skim-ocean**: water plane (+2.5), rr-forest (+2.4), buildings (+2.2), terrain chunks (+1.6), clouds (+1.4)
- **submerged**: water plane (+0.9), buildings (+0.5), clouds (+-0.1), terrain chunks (+-0.8), rr-forest (+-1.2)
- **inside-forest**: water plane (+3.3), rr-forest (+1.6), buildings (+0.8), clouds (+0.5), terrain chunks (+-2.9)
