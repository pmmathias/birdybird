Hi Phil,

Perfect detail — you gave me exactly the info I needed. Bug found and fixed
(deployed a few minutes ago):

On iOS 13.4+, `DeviceOrientationEvent.requestPermission()` and
`DeviceMotionEvent.requestPermission()` are **separate** permissions. The
"Motion & Orientation Access" dialog you said yes to was granting only
orientation. Without the motion permission, `devicemotion` events never
fired → the shake-detection Promise on the Flugelschlag screen had no
fallback and simply hung. You didn't miss an instruction; the app was
genuinely stuck.

Fix is two parts: (a) we now request both permissions explicitly, and
(b) the shake step has an 8-second timeout + a "Skip" button so no one
ever gets stranded there again. Could you give it another try when you
have a moment? Same URL — you may need to re-install the home-screen
icon since iOS caches aggressively.

Thanks also for pointing me to Attila's work — just saw his full-featured
WebGPU iFFT ocean demo (cascaded spectra, foam, the works). That thing is
stunning. Credits overlay now links his GitHub (github.com/Spiri0) and
that demo alongside your materials.

Cheers,
Mathias
