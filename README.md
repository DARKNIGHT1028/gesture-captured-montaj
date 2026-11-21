# TOUCH OF EXCELLENCE – Gesture Captured Montage

An interactive, gesture-controlled presentation experience created for **SK Taman Jasmin's Majlis Apresiasi Kecemerlangan (MAKSEM) 2026**, taking place on **28 November 2026**.

Designed to run in a web browser on an iPad and be mirrored to a projector. Guests enter the experience, complete a five-finger hand scan, watch the achievement montage, and finish on the event appreciation slide.

## Features

- Five-finger touch verification with fingertip status feedback.
- Animated scanning sequence with visual confirmation.
- Full-screen montage playback.
- Final MAKSEM 2026 event slide.
- Built with HTML, CSS and JavaScript; no database or framework required.

## Project files

- `index.html` – presentation screens and hand scanner.
- `style.css` – visual design and animations.
- `script.js` – touch detection, scan flow and video playback.
- `images/poster.jpg` – final event slide.
- `video/montage-after-scan.mp4` – montage video played after the scan.

Keep the video folder name and filename unchanged because they are referenced in `script.js`.

## Run and present

Open the site through GitHub Pages or serve the project folder using a local web server. For the ceremony, use the iPad in landscape orientation, mirror it to the projector, turn off Multitasking Gestures, and set Auto-Lock to Never. Test the five-finger gesture and video playback on the actual iPad before the event.

In `script.js`, keep `testMode: false` for the ceremony. Set it to `true` only when testing; this enables a skip button and keyboard shortcuts.

## Links

- **Repository:** https://github.com/DARKNIGHT1028/gesture-captured-montaj
- **GitHub Pages:** https://darknight1028.github.io/gesture-captured-montaj/ (available after Pages is enabled and deployment completes)

---

Created for **SK Taman Jasmin – MAKSEM 2026**.
