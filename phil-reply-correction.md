Hi Phil,

Apologies — I was overstating that. You're right, your map has
standard normal-map coloration and `normalMap(texture(...), NMS)` is
the correct way to use it. What we actually hit was specific to our
setup, not your module:

We were using `MeshBasicNodeMaterial` (unlit) for the water instead of
`MeshStandardNodeMaterial`, and we UV-scaled the plane by ×4 for
repeat-tiling across a larger horizontal area. In that combination the
tangent-space decoding inside `normalMap()` didn't drive our custom
`colorNode` the way we'd expected — so we fell back to reading the RGB
texels directly and treating them as axis-aligned world-space offsets
(which works because the water plane is axis-aligned in world after
the -π/2 X-rotation). The problem is on our side; nothing to change in
Ocean4 or your docs.

Also — thank you for calling out Attila's contribution. I'll add him
to the credits overlay in the next deploy; `src/vendor/Ocean4.js`
already carries his line in the header but he should be named in the
visible credits too.

On the iPhone crash at "Flugelschlag!": thanks for trying it! That
screen is the tilt-calibration prompt, which needs DeviceMotion
permission. On older iOS versions that permission request sometimes
doesn't surface the dialog, or WebGPU init fails silently and we never
recover to the WebGL2 fallback on the mobile path. I'll dig in. If
you're up for it, could you tell me which iOS version + iPhone model?
That helps a lot.

Thanks again for Ocean4 — and for the pointer to Attila.

Cheers,
Mathias
