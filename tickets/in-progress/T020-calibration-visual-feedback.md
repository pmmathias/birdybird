# T020: Calibration Screen — Visual Tilt Feedback
**Priority:** P0 | **Phase:** Mobile UX | **Size:** M
**Depends on:** —

## Description

Phil Crowther testete birdybird auf iPhone 13 (iOS 26 Beta) und meldet:
"the bank control seems backward — when I tilt the phone left, the
bird goes right". Das ist genau der Fall, gegen den der Calibration-
Wizard gebaut wurde — verschiedene iOS-Geräte/-Versionen kodieren das
DeviceOrientation-`gamma` mit unterschiedlichem Vorzeichen, deshalb
lernt der Wizard pro Schritt, welche Auslenkung welcher Intent ist
(left/right/climb/dive/flap).

Hypothese: der Wizard hat bei Phil entweder den Schritt falsch
zugeordnet (Auslenkung war zu klein oder mehrdeutig) oder Phil ist
ohne sauberes Verständnis durchgeklickt, was sein Tilt im jeweiligen
Schritt sein soll. Es gibt aktuell **kein optisches Feedback**, das
zeigt, *was* der Wizard im Live-Stream der Sensor-Daten gerade als
"links" oder "rechts" interpretiert.

## Goal

Im Calibration-Screen (Step "tilt left", "tilt right", "climb", "dive")
ein deutliches Live-Feedback einblenden, das zeigt:

1. **Welche Auslenkung gerade gemessen wird** (numerisch + visuell):
   eine horizontale/vertikale Bar oder ein Tilt-Indikator-Vogelchen,
   das mit der Phone-Bewegung mit-bankt.
2. **In welche Richtung das System die Auslenkung interpretieren
   würde**: ein klarer Pfeil/Label "→ wird als RECHTS erkannt",
   getriggert sobald der Schwellenwert überschritten ist.
3. **Eine eindeutige Zuordnung der Step-Anweisung**: "Halte das Handy
   so wie jetzt → tilte nach LINKS" — und zeige, ob das System die
   Tilt aktuell wirklich als LINKS sieht. Wenn nicht (Phone meldet
   z.B. positives gamma statt negatives), erkennt der User sofort:
   "ah, mein Phone kodiert das andersrum, der Wizard wird das jetzt
   richtig lernen".

## Acceptance Criteria

- [ ] Wizard-Schritte left/right/climb/dive zeigen eine Live-Visualisierung
      der aktuellen DeviceOrientation-Werte (gamma, beta).
- [ ] Bei Erreichen des Schwellenwerts wird die erkannte Richtung
      explizit gelabelt (z.B. "→ wird als RECHTS gewertet").
- [ ] Confirm-Button wird erst aktiv, wenn die erkannte Richtung mit
      der vom Step geforderten Richtung übereinstimmt — verhindert
      Mis-Calibration durch Mehrdeutigkeit.
- [ ] Step-Anweisung ist visuell unmissverständlich: Pfeil oder
      animiertes Phone-Icon zeigt die geforderte Bewegung.
- [ ] Nach Abschluss der Kalibrierung: kurzer "Try it" Test-Step, in
      dem der User links/rechts/oben/unten tilten kann und ein
      Vorschau-Vogel im Wizard mitbankt — verifiziert dass die
      gelernte Mapping wirklich passt, *bevor* das Spiel startet.

## Notes

- Datei: `src/ui/CalibrationWizard.js` (328 Zeilen)
- Mobile-Input-Mapping: `src/core/MobileInput.js`
- Bestehender Skip-Param: `?skipcalib=1` bleibt für Dev-Zwecke
- Visuelles Vorbild: Audio-Calibration in Spielen ("hörst du den Beep
  in deinem linken Lautsprecher? Tippe Ja/Nein") — gleiche Idee, nur
  für Tilt-Achsen.
