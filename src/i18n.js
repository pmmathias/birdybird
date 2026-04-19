/**
 * Minimal i18n: DE/EN toggle with localStorage persistence.
 * Usage: import { t, lang, toggleLang } from './i18n.js';
 *        t('startScreen.title')  → "VogelSimulator"
 */

const strings = {
  de: {
    // Start screen
    'start.subtitle': 'Neige dein Gerät zum Steuern.\nSchütteln = Flügelschlag!',
    'start.hint': 'Neigen: Steuern · Schütteln: Flattern',
    'start.landscape': 'Drehe dein Gerät ins Querformat',
    'start.fsTitle': 'Fullscreen Setup',
    'start.fsDesc': 'Für das beste Erlebnis: App zum Homescreen hinzufügen — dann läuft sie im echten Vollbildmodus!',
    'start.fsStep1': 'Tippe auf den <b>Teilen</b>-Button unten in Safari',
    'start.fsStep2': 'Scrolle runter und tippe <b>„Zum Home-Bildschirm"</b>',
    'start.fsStep3': 'Tippe <b>„Hinzufügen"</b> — ein Icon erscheint auf dem Homescreen',
    'start.fsStep4': 'Öffne vom Homescreen — läuft im <b>echten Vollbild!</b>',
    'start.fsOnce': 'Das muss nur einmal gemacht werden.',
    'start.fsOk': 'Verstanden!',
    'start.fsBtn': 'Fullscreen Setup (empfohlen)',
    'start.fsStepLabel': 'Schritt',
    // Calibration
    'calib.profileFound': 'Kalibrierung vorhanden',
    'calib.profileQuestion': 'Letzte Kalibrierung verwenden\noder neu kalibrieren?',
    'calib.useProfile': 'Sofort spielen',
    'calib.redo': 'Neu kalibrieren',
    'calib.step': 'SCHRITT',
    'calib.rest.title': 'Gleitflug-Position',
    'calib.rest.text': 'Halte dein Handy ruhig so,\nwie du fliegen möchtest.',
    'calib.left.title': 'Linksflug',
    'calib.left.text': 'Neige für einen\nsanften Linksflug.',
    'calib.right.title': 'Scharfe Rechtskurve',
    'calib.right.text': 'Neige für eine\nscharfe Rechtskurve!',
    'calib.climb.title': 'Steigflug',
    'calib.climb.text': 'Neige für einen\nSteigflug nach oben.',
    'calib.dive.title': 'Sturzflug',
    'calib.dive.text': 'Neige für einen\nSturzflug nach unten.',
    'calib.shake.title': 'Flügelschlag!',
    'calib.shake.text': 'Schüttle dein Handy\nkräftig!',
    'calib.detected': 'Erkannt!',
    'calib.done': 'Kalibrierung fertig!',
    'calib.enjoy': 'Viel Spaß beim Fliegen!',
    // Controls overlay
    'controls.tilt': 'Neigen: Steuern',
    'controls.shake': 'Schütteln: Flattern',
    'controls.doubletap': '2× Tippen: Nullpunkt',
    'controls.recalib': 'Kalibrieren',
    // Orientation warning
    'orient.msg': 'Bitte drehe dein Gerät\nins <b>Querformat</b>',
    // HUD
    'hud.flying': 'FLYING',
    'hud.landing': 'LANDING...',
    'hud.walking': 'WALKING',
    'hud.takeoff': 'TAKING OFF...',
    // Fish
    'fish.catch1': 'Fisch gefangen!',
    'fish.catch2': 'Guter Fang!',
    'fish.catch3': 'Volltreffer!',
    'fish.catch4': 'Was für ein Sturzflug!',
    // Gyro permission
    'perm.denied': 'Gyroscop-Berechtigung verweigert — kann ohne nicht spielen.',
    // Blog link
    'blog.back': 'ki-mathias.de',
  },

  en: {
    'start.subtitle': 'Tilt your device to steer.\nShake = Flap wings!',
    'start.hint': 'Tilt: Steer · Shake: Flap',
    'start.landscape': 'Please rotate your device\nto <b>landscape</b>',
    'start.fsTitle': 'Fullscreen Setup',
    'start.fsDesc': 'For the best experience: add to home screen — runs in true fullscreen!',
    'start.fsStep1': 'Tap the <b>Share</b> button in Safari',
    'start.fsStep2': 'Scroll down and tap <b>"Add to Home Screen"</b>',
    'start.fsStep3': 'Tap <b>"Add"</b> — an icon appears on your home screen',
    'start.fsStep4': 'Open from home screen — runs in <b>true fullscreen!</b>',
    'start.fsOnce': 'You only need to do this once.',
    'start.fsOk': 'Got it!',
    'start.fsBtn': 'Fullscreen Setup (recommended)',
    'start.fsStepLabel': 'Step',
    'calib.profileFound': 'Calibration found',
    'calib.profileQuestion': 'Use previous calibration\nor recalibrate?',
    'calib.useProfile': 'Play now',
    'calib.redo': 'Recalibrate',
    'calib.step': 'STEP',
    'calib.rest.title': 'Glide Position',
    'calib.rest.text': 'Hold your phone steady in\nthe position you want to fly.',
    'calib.left.title': 'Turn Left',
    'calib.left.text': 'Tilt for a\ngentle left turn.',
    'calib.right.title': 'Sharp Right Turn',
    'calib.right.text': 'Tilt for a\nsharp right turn!',
    'calib.climb.title': 'Climb',
    'calib.climb.text': 'Tilt to\nclimb upward.',
    'calib.dive.title': 'Dive',
    'calib.dive.text': 'Tilt to\ndive downward.',
    'calib.shake.title': 'Flap Wings!',
    'calib.shake.text': 'Shake your phone\nvigorously!',
    'calib.detected': 'Detected!',
    'calib.done': 'Calibration complete!',
    'calib.enjoy': 'Enjoy flying!',
    'controls.tilt': 'Tilt: Steer',
    'controls.shake': 'Shake: Flap',
    'controls.doubletap': '2× Tap: Reset center',
    'controls.recalib': 'Calibrate',
    'orient.msg': 'Please rotate your device\nto <b>landscape</b>',
    'hud.flying': 'FLYING',
    'hud.landing': 'LANDING...',
    'hud.walking': 'WALKING',
    'hud.takeoff': 'TAKING OFF...',
    'fish.catch1': 'Fish caught!',
    'fish.catch2': 'Nice catch!',
    'fish.catch3': 'Bullseye!',
    'fish.catch4': 'What a dive!',
    'perm.denied': 'Gyroscope permission denied — cannot play without it.',
    'blog.back': 'ki-mathias.de',
  },
};

let _lang = localStorage.getItem('vogel_lang') || 'de';
const _listeners = [];

export function t(key) {
  return strings[_lang]?.[key] ?? strings.de[key] ?? key;
}

export function lang() {
  return _lang;
}

export function toggleLang() {
  _lang = _lang === 'de' ? 'en' : 'de';
  localStorage.setItem('vogel_lang', _lang);
  _listeners.forEach((fn) => fn(_lang));
}

export function onLangChange(fn) {
  _listeners.push(fn);
}
