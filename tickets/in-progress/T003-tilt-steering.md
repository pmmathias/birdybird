# T003: Tilt-Steuerung + Smoothing + Kalibrierung
**Priority:** P0 | **Phase:** 0 | **Size:** M
**Depends on:** T002

## Description

Erste echte Steuerungs-Klasse (`TiltInput.js`), die DeviceOrientation-Events
in saubere Roll/Pitch-Werte für das Flugmodell umwandelt.

## Anforderungen

### Permission-Flow
- iOS 13+ requestPermission hinter einem Start-Button ("Tap to fly")
- Android / Desktop: automatischer Listener
- Fallback-Anzeige wenn denied oder unsupported

### Daten-Pipeline
- `beta` (pitch) und `gamma` (roll) aus DeviceOrientationEvent
- **Kalibrierung**: beim Start aktuellen Tilt als "Nullpunkt" merken → Spieler darf das Handy so halten wie es bequem ist
- **Dead-Zone** ±3° um Nullpunkt (kein Mikro-Drift)
- **Smoothing** via Low-Pass-Filter (α ≈ 0.15), um Jitter bei <30 Hz zu dämpfen
- **Clamping**: max ±30° pitch, ±45° roll

### Output-API
- `tilt.roll` (-1 bis 1, normalisiert)
- `tilt.pitch` (-1 bis 1, normalisiert)
- `tilt.calibrate()` — neu kalibrieren
- `tilt.active` — Permission erteilt + Events kommen rein?

### Touch-Fallback (für Geräte ohne Gyro)
- Virtual-Joystick links unten wenn kein Tilt verfügbar

## Acceptance Criteria

- [ ] `TiltInput.js` als ES-Modul
- [ ] Permission-Button wird korrekt angezeigt auf iOS 13+
- [ ] Demo-Seite mit sichtbarem Bird-Avatar der sauber auf Tilt reagiert
- [ ] Kalibrierung funktioniert (Handy in beliebiger Haltung aktivieren)
- [ ] Keine spürbaren Ruckler bei normalem Handling
