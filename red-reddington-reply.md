# Reply draft — thank-you to red-reddington

**Thread:** https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610

---

## Draft (English)

> Thank you so much @red-reddington — this made my day. Releasing it under MIT
> is incredibly generous, and it's exactly the kind of openness that makes the
> Three.js community feel like a good place to build.
>
> You're already in the in-app credits next to @phil_crowther's ocean module
> (https://pmmathias.github.io/birdybird/ → Credits). Linked your CodePen
> profile as you suggested — happy to tweak the wording if you'd like something
> different.
>
> And thanks for the W/S-invert tip — noted, definitely adding it as a setting.
> That kind of UX hint from someone who actually tried the thing is gold.
>
> Quick note: birdybird is a hobby project built almost entirely with
> [Claude Code](https://claude.ai/code) as the pair-programming partner, and
> everything is open source. If anyone else here wants to poke at how we
> integrated your forest, the repo is at
> https://github.com/pmmathias/birdybird — `src/world/ProceduralForest.js`.
>
> We're currently running a clean-room version I sketched up from your
> discourse description (worked nicely, 2800 trees in 8 draw calls on a 6 km
> world) and now with your MIT blessing we'll probably study the real CodePen
> source to pick up the per-tree culling trick on mobile.
>
> Go build something great right back at you — and thanks again 🌳🦅

---

## Notes for us

- Phil = CC BY-NC-SA 3.0 (non-commercial share-alike), red-reddington = MIT.
  Two different licenses coexisting in the same project is fine as long as we
  respect each.
- Credits card in `index.html` now lists red-reddington with his CodePen
  profile, per his preference over the discourse thread.
- Follow-up tickets worth opening:
  - `T00X` — W/S invert toggle in settings (nod to his feedback)
  - `T00X` — Port real red-reddington forest source + per-tree culling
