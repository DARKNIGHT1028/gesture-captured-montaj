# TOUCH OF EXCELLENCE

An interactive, gesture-led ceremony presentation with a separate iPad controller and projector display. Firebase Realtime Database synchronizes the stage between both devices.

## Open the website

- **iPad controller:** https://darknight1028.github.io/gesture-captured-montaj/
- **Projector display:** https://darknight1028.github.io/gesture-captured-montaj/?role=display

Open the controller URL on the iPad and the display URL on the laptop connected to the projector. On the laptop, click **ENABLE PROJECTOR PLAYBACK** once before the ceremony so the browser can allow video and sound.

## Ceremony flow

1. The iPad starts the intro video.
2. The intro ends and the five-finger scan begins on the iPad.
3. The iPad publishes the scan stage to Firebase.
4. After the scan and landscape transition, the projector plays the two presentation videos in order.
5. The projector plays the animated Majlis Apresiasi finale.

The iPad is the controller; presentation videos play on the projector device only.

## Firebase setup

This project uses Firebase Realtime Database and Firebase Anonymous Authentication.

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Anonymous**.
2. In **Realtime Database → Rules**, use the following authenticated-only baseline rules:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

3. Publish the rules. Both devices sign in anonymously before reading or writing the ceremony state.

These rules prevent unauthenticated access, but anonymous sign-in is not a private event invitation system: anyone who can load the public website can create an anonymous session. For a public production deployment, add stronger access control (for example, authenticated operator accounts and restricted rules).

## Project assets

Keep the existing folder names and filenames unchanged:

- `images/intro.mp4`
- `images/scan.wav`
- `video/Copy of Montaj  Gimik Majlis Apresiasi (Edisi 1.0) (1).mp4`
- `video/montage-after-scan.mp4`
- `video/majlis-animated-electronic-sound.mp4`
- `images/poster.jpg`

## Notes

- Both devices need an internet connection to synchronize through Firebase.
- Keep the laptop awake and the projector page open during the ceremony.
- Browser autoplay restrictions mean the projector needs one initial user click.
- Test the full sequence on the actual iPad, laptop, browser, speakers and projector before the event.

---
Made for the **Touch of Excellence** event.
