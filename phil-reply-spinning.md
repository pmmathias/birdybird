Hi Phil,

Great news that the calibration fix got you past the Flugelschlag
screen! And your "spinning in place, standing vertically" description
was again a perfect diagnostic — it told me exactly what was broken.

The bird spawns at altitude with velocity = 0. Without any flap (on
mobile: a shake gesture), it stalls instantly and falls to the ground,
transitioning into GROUNDED mode. In ground mode the tilt input maps to
yaw-in-place turning, and the bird's model stands upright — which is
exactly the "spin in place, standing vertically" you saw. So the bird
never actually flew; it crashed within a second or two and you were
standing on the grass.

Fixed (deployed just now): the bird now spawns with ~18 m/s forward
glide speed. That gives you ~10-15 seconds of airtime before you have
to flap, which should be plenty to learn the shake gesture.

To flap: shake the phone firmly (the wrist-flick motion from the
Flugelschlag calibration screen). Each shake gives a burst of forward
thrust and a bit of climb — a real bird's wingbeat.

Two other tips for mobile:
- Tilt left/right to steer (roll)
- Tilt forward to dive, back to climb
- W key (desktop) = dive; on mobile, tilting forward past the calibrated
  rest angle does the same

Also thanks for flagging the faint line in the upper-left corner —
that's our keyboard-debug HUD. It only appears if no DeviceMotion
events are firing within a window (so the code fell back to "assume
keyboard"). If your shakes ARE being detected it should be gone. If it
stays visible on retry, that would point to the motion-permission grant
not actually sticking on your iOS version, which would be worth knowing.

Could you try one more time? I also added a `?seed=N` URL param so
you and I end up on the same procedural world — before this every
browser got its own random terrain and I couldn't tell whether some
obstacle near your spawn was aggravating things. Here's a known-good
seed I've test-flown:

https://pmmathias.github.io/birdybird/?seed=42

Should see a clear glide, and if you can shake the phone, proper
powered flight.

Cheers,
Mathias
