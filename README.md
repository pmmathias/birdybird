# birdybird

Mobile-first Prototyping-Sandbox für einen tilt-gesteuerten Vogelflug-Arcade-Modus.
Schwester-Repo zum [VogelSimulator](https://github.com/pmmathias/VogelSimulator) —
hier wird losgelöst vom Produktiv-Code experimentiert.

## Erster Test: Device Orientation

`index.html` misst live, ob `DeviceOrientationEvent` in verschiedenen Umgebungen
zuverlässig Daten liefert:

- iPhone Safari (Baseline)
- iPhone **Reddit-App In-App-Browser** (WKWebView — der kritische Test)
- Android Chrome

Angezeigt werden Pitch/Roll in Echtzeit, Update-Rate in Hz, Event-Zähler und
eine simple visuelle Rückmeldung (Vogel neigt sich mit dem Handy).

## Live

Nach Aktivierung von GitHub Pages (Settings → Pages → Source: `main` / root):
**https://pmmathias.github.io/birdybird/**

## Warum separates Repo?

Der VogelSimulator-Main-Branch und seine GitHub-Pages-Deploy-URL bleiben
unverändert. Hier kann ohne Rücksicht auf Stabilität experimentiert werden.
