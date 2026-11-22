import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMZ-C5iBo9goWwHbR9Yc2Zi160Q4LYTvM",
  authDomain: "hand-gestured-synchronous.firebaseapp.com",
  databaseURL: "https://hand-gestured-synchronous-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hand-gestured-synchronous",
  storageBucket: "hand-gestured-synchronous.firebasestorage.app",
  messagingSenderId: "391216540504",
  appId: "1:391216540504:web:2857cf693a728aa0c1d32d",
  measurementId: "G-YK5JMZNR8X"
};
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firebaseDb = getDatabase(firebaseApp);
const ceremonyRef = ref(firebaseDb, "events/touch-of-excellence");
let firebaseReady = false;
try {
  await signInAnonymously(firebaseAuth);
  firebaseReady = true;
} catch (error) {
  console.error("Firebase sign-in failed:", error);
}
let ceremonyRunId = Date.now();
async function publishStage(stage, videoIndex = 0) {
  if (!firebaseReady) {
    console.error("Firebase is not connected; stage update was not sent.");
    const message = document.getElementById("pmsg");
    if (message) message.textContent = "Connection to the projector is unavailable. Check Firebase Authentication and Database Rules.";
    return;
  }
  try {
    await set(ceremonyRef, { stage, videoIndex, runId: ceremonyRunId, updatedAt: Date.now() });
  } catch (error) {
    console.error("Could not send stage update:", error);
  }
}

const ROLE = new URLSearchParams(location.search).get("role") === "display" ? "display" : "controller";

if (ROLE === "display") {
  document.body.classList.add("display-mode");
  const panel = document.getElementById("displayScreen");
  const status = document.getElementById("displayStatus");
  const displayVideo = document.getElementById("displayVideo");
  const finalVideo = document.getElementById("displayFinalVideo");
  const enable = document.getElementById("enableDisplay");
  const gate = document.getElementById("displayGate");
  const videos = [
    "video/Copy of Montaj  Gimik Majlis Apresiasi (Edisi 1.0) (1).mp4",
    "video/montage-after-scan.mp4"
  ];
  const finalSrc = "video/majlis-animated-electronic-sound.mp4";
  let armed = false;
  let pending = null;
  let activeRun = null;
  let playing = false;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
  }
  function hideStatus() { status.hidden = true; }

  async function playFinal() {
    playing = true;
    displayVideo.pause();
    displayVideo.hidden = true;
    finalVideo.hidden = false;
    finalVideo.src = finalSrc;
    finalVideo.currentTime = 0;
    finalVideo.onended = () => finalVideo.pause();
    try {
      await finalVideo.play();
      hideStatus();
    } catch (error) {
      showStatus("Tap the screen to start the final presentation");
    }
  }
  async function playVideo(index, runId) {
    if (!armed || runId !== activeRun) return;
    if (index >= videos.length) return playFinal();
    playing = true;
    finalVideo.pause();
    finalVideo.hidden = true;
    displayVideo.hidden = false;
    displayVideo.src = videos[index];
    displayVideo.currentTime = 0;
    displayVideo.onended = () => playVideo(index + 1, runId);
    displayVideo.onerror = () => {
      console.error("Could not load presentation video:", videos[index]);
      playVideo(index + 1, runId);
    };
    try {
      await displayVideo.play();
      hideStatus();
    } catch (error) {
      showStatus("Tap the screen to resume the presentation");
    }
  }
  function handleStage(data) {
    if (!data) {
      showStatus("Waiting for the iPad controller…");
      return;
    }
    if (data.stage === "waiting") {
      activeRun = data.runId;
      playing = false;
      displayVideo.pause();
      finalVideo.pause();
      displayVideo.hidden = true;
      finalVideo.hidden = true;
      showStatus("Waiting for the iPad controller…");
      return;
    }
    if (data.stage === "intro") {
      showStatus("The introduction is playing on the iPad…");
      return;
    }
    if (data.stage === "scanning") {
      showStatus("Five-finger scan in progress…");
      return;
    }
    if (data.stage === "presentation") {
      if (data.runId !== activeRun || !playing) {
        activeRun = data.runId;
        pending = data;
        if (armed) playVideo(Number(data.videoIndex || 0), data.runId);
        else showStatus("Ready. Enable projector playback to begin.");
      }
    }
  }

  enable.addEventListener("click", async () => {
    try { await document.documentElement.requestFullscreen(); } catch (error) {}
    armed = true;
    gate.hidden = true;
    if (pending && pending.stage === "presentation") playVideo(Number(pending.videoIndex || 0), pending.runId);
    else if (!playing) showStatus("Projector connected. Waiting for the iPad…");
  });
  panel.addEventListener("click", () => {
    if (!armed) return;
    if (!displayVideo.paused || !finalVideo.paused) return;
    if (pending && pending.stage === "presentation") {
      if (finalVideo.hidden) playVideo(0, pending.runId);
      else finalVideo.play().catch(() => showStatus("Tap again to play the final presentation"));
    }
  });
  if (!firebaseReady) {
    showStatus("Firebase sign-in failed. Enable Anonymous sign-in and check your database rules.");
    enable.disabled = true;
  } else {
    onValue(ceremonyRef, snapshot => handleStage(snapshot.val()), error => {
      console.error(error);
      showStatus("Cannot connect to Firebase. Check your database rules and internet connection.");
    });
  }
} else {
/* ===== TOUCH OF EXCELLENCE – settings (edit here) ===== */
const CONFIG = {
  videos: ['video/Copy of Montaj  Gimik Majlis Apresiasi (Edisi 1.0) (1).mp4', 'video/montage-after-scan.mp4'], // sequential post-scan videos
  testMode: false,    // false = the five-finger scan is the ONLY way forward. true = show SKIP (TEST) button + keys t / r
  holdMs: 700,        // how long all five fingers must stay down
  scanMs: 4200,       // length of the scanning animation
  tolerance: 2.2,     // how forgiving a finger position is (bigger = easier)
  lines: ['SCANNING…', 'VERIFYING…', 'ACCESS GRANTED']
};

const $ = id => document.getElementById(id);
const vid = $('vid'), intro = $('intro'), scanSound = $('scanSound'), pads = [...document.querySelectorAll('.pad')], fps = [...document.querySelectorAll('.fp')];
let prevOn = new Set();
function setFp(i, cls, txt) { fps[i].classList.remove('ok', 'err'); if (cls) fps[i].classList.add(cls); fps[i].querySelector('.lbl').textContent = txt; }
let state = 'prep', urls = CONFIG.videos.slice(), loaded = true, holdT = null, taps = 0, waitingForLandscape = false;
let currentVideoIndex = 0;
const skipVideoButton = $('skipVideo');
const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
skipVideoButton.hidden = !desktopPointer.matches;
desktopPointer.addEventListener?.('change', e => { skipVideoButton.hidden = !e.matches; });
skipVideoButton.addEventListener('click', e => {
  e.preventDefault(); e.stopPropagation();
  if (state === 'play') playFrom(currentVideoIndex + 1);
  else if (state === 'end') {
    if (endVideo && Number.isFinite(endVideo.duration)) {
      endVideo.currentTime = Math.max(0, endVideo.duration - 0.05);
      endVideo.pause();
    }
    $('endVideoHint').textContent = '';
  }
});

function show(id) {
  ['prep', 'hand', 'scan', 'end'].forEach(s =>
    $(s).classList.toggle('on', s === id || (id === 'scan' && s === 'hand')));
}

/* ---- Step 1: ENTER plays the intro; scanner opens after intro ends ---- */
function beginScan() {
  intro.pause();
  intro.classList.remove('intro-playing');
  enter();
}
intro.addEventListener('ended', beginScan);
intro.addEventListener('error', beginScan);
$('bEnter').onclick = async () => {
  if (state !== 'prep') return;
  if (ROLE === 'controller') await publishStage('intro');
  const btn = $('bEnter');
  btn.disabled = true;
  btn.textContent = 'LOADING…';
  try { await document.documentElement.requestFullscreen(); } catch (e) {}
  try { await navigator.wakeLock.request('screen'); } catch (e) {}
  intro.currentTime = 0;
  intro.classList.add('intro-playing');
  const attempt = intro.play();
  if (attempt && attempt.catch) attempt.catch(() => {
    btn.disabled = false;
    btn.textContent = 'PLAY INTRO';
  });
};
document.addEventListener('click', () => {
  if (state === 'prep' && intro.paused && intro.classList.contains('intro-playing')) intro.play().catch(() => {});
});
async function enter() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  try { await navigator.wakeLock.request('screen'); } catch (e) {}
  resetHand();
}
function resetHand() {
  if (ROLE === 'controller') publishStage('waiting');
  skipVideoButton.hidden = true;
  currentVideoIndex = 0;
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); } catch (e) {}
  finalVideoStarted = false;
  endVideo.pause();
  endVideo.removeAttribute('src');
  endVideo.load();
  $('end').classList.remove('video-active');
  $('endVideoHint').textContent = '';
  vid.pause(); vid.classList.remove('on'); $('hand').classList.remove('locked');
  prevOn = new Set(); fps.forEach((f, i) => setFp(i, '', 'Loading…')); $('cnt').textContent = '0 / 5';
  state = 'hand'; show('hand'); enforceOrientationImpl();
}

/* ---- Step 2: five-finger detection ---- */
function evalTouches(touches) {
  const c = pads.map(p => { const b = p.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 }; });
  const on = new Set();
  [...touches].forEach(t => {
    let best = 0, bd = 1e9;
    c.forEach((p, i) => { const d = Math.hypot(t.clientX - p.x, t.clientY - p.y); if (d < bd) { bd = d; best = i; } });
    if (bd < c[best].r * CONFIG.tolerance) on.add(best);
  });
  fps.forEach((f, i) => {
    if (on.has(i)) setFp(i, 'ok', 'Confirmed');
    else if (prevOn.has(i)) { setFp(i, 'err', 'Error'); setTimeout(() => { if (!on.has(i) && !prevOn.has(i) && fps[i].classList.contains('err')) setFp(i, '', 'Loading…'); }, 900); }
  });
  prevOn = on;
  $('cnt').textContent = on.size + ' / 5';
  if (on.size === 5) { if (!holdT) holdT = setTimeout(trigger, CONFIG.holdMs); }
  else { clearTimeout(holdT); holdT = null; }
}
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev =>
  document.addEventListener(ev, e => {
    if (state !== 'hand' || (e.target.closest && e.target.closest('button'))) return;
    e.preventDefault(); evalTouches(e.touches);
  }, { passive: false }));

/* ---- Step 3: cinematic scan, then the video, then the Majlis slide ---- */
function trigger() {
  if (state !== 'hand') return;
  holdT = null; state = 'scan';
  if (ROLE === 'controller') publishStage('scanning');
  try { scanSound.currentTime = 0; scanSound.play().catch(() => {}); } catch (e) {}
  $('hand').classList.add('locked'); fps.forEach((f, i) => setFp(i, 'ok', 'Confirmed')); show('scan');
  const L = CONFIG.lines, el = $('slines'); let i = 0; el.textContent = L[0];
  const iv = setInterval(() => { if (++i < L.length) el.textContent = L[i]; }, CONFIG.scanMs / L.length);
  setTimeout(() => {
    clearInterval(iv);
    // Release portrait lock after the scan. Keep the scan screen visible until
    // the operator turns the iPad back to landscape for the montage.
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    const continueToVideo = () => {
      if (state !== 'scan' || window.matchMedia('(orientation: portrait)').matches) return;
      waitingForLandscape = false;
      window.removeEventListener('orientationchange', continueToVideo);
      window.removeEventListener('resize', continueToVideo);
      playFrom(0);
    };
    if (window.matchMedia('(orientation: portrait)').matches) {
      waitingForLandscape = true;
      $('orientationTitle').textContent = 'ROTATE TO LANDSCAPE';
      $('orientationMessage').textContent = 'Scanning complete. The montage is ready.';
      $('orientationHint').textContent = 'Turn your iPad horizontally to continue.';
      enforceOrientationImpl();
      window.addEventListener('orientationchange', continueToVideo);
      window.addEventListener('resize', continueToVideo);
    } else {
      waitingForLandscape = false;
      playFrom(0);
    }
  }, CONFIG.scanMs);
}
function playFrom(i) {
  waitingForLandscape = false;
  $('orientationWarning').classList.remove('visible');
  $('orientationWarning').setAttribute('aria-hidden', 'true');
  enforceOrientationImpl();
  while (i < urls.length && !urls[i]) i++;
  if (i >= urls.length) return finish();

  currentVideoIndex = i;
  state = 'play';
  skipVideoButton.hidden = true;
  show('none');
  // The iPad is only the controller. The projector device owns all video playback.
  if (ROLE === 'controller') {
    publishStage('presentation', i);
    return;
  }
  vid.onended = () => playFrom(i + 1);
  vid.onerror = () => {
    console.warn('Video could not be played:', urls[i]);
    playFrom(i + 1);
  };
  if (vid.src !== new URL(urls[i], document.baseURI).href) {
    vid.src = urls[i];
    vid.load();
  }
  vid.classList.add('on');
  const playAttempt = vid.play();
  if (playAttempt && playAttempt.catch) {
    playAttempt.catch(err => {
      console.warn('Playback needs a user tap:', err);
      // Keep the video screen active; the existing tap-to-resume handler retries.
    });
  }
}
function finish() {
  vid.pause();
  vid.classList.remove('on');
  state = 'end';
  skipVideoButton.hidden = !desktopPointer.matches;
  show('end');
  startFinalPresentation();
}

const endVideo = $('endVideo');
const FINAL_VIDEO = 'video/majlis-animated-electronic-sound.mp4';
let finalVideoStarted = false;
function startFinalPresentation() {
  if (finalVideoStarted) return;
  finalVideoStarted = true;
  $('end').classList.remove('video-active');
  $('endVideoHint').textContent = 'Loading final presentation…';
  endVideo.pause();
  endVideo.src = FINAL_VIDEO;
  endVideo.currentTime = 0;
  endVideo.onloadedmetadata = async () => {
    const startAt = Math.min(1, Math.max(0, endVideo.duration - 0.25));
    try { endVideo.currentTime = startAt; } catch (e) {}
    try {
      await endVideo.play();
      $('end').classList.add('video-active');
      $('endVideoHint').textContent = '';
    } catch (err) {
      $('endVideoHint').textContent = 'Tap to play the final presentation';
    }
  };
  endVideo.oncanplay = () => {
    if (endVideo.currentTime < 0.9) {
      try { endVideo.currentTime = Math.min(1, Math.max(0, endVideo.duration - 0.25)); } catch (e) {}
    }
  };
  endVideo.onended = () => {
    endVideo.pause(); // Hold on the final frame after the animated presentation.
    $('endVideoHint').textContent = '';
  };
  endVideo.onerror = () => {
    $('endVideoHint').textContent = 'Final video could not load. Showing the original poster.';
    $('end').classList.remove('video-active');
  };
  endVideo.load();
}
endVideo.addEventListener('click', async () => {
  if (state !== 'end') return;
  try {
    if (endVideo.currentTime < 1) endVideo.currentTime = 1;
    await endVideo.play();
    $('end').classList.add('video-active');
    $('endVideoHint').textContent = '';
  } catch (e) {
    $('endVideoHint').textContent = 'Tap to play the final presentation';
  }
});

/* ---- Desktop test shortcut ---- */
// The skip button is available on desktop browsers only (CSS pointer/hover check).
// It is deliberately kept out of the iPad/touchscreen ceremony interface.
function skipToVideo(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  clearTimeout(holdT);
  holdT = null;
  waitingForLandscape = false;
  $('orientationWarning').classList.remove('visible');
  $('orientationWarning').setAttribute('aria-hidden', 'true');
  $('hand').classList.remove('locked');
  state = 'play';
  show('none');
  playFrom(0);
}
$('skipT').addEventListener('click', skipToVideo);
$('skipOverlay').addEventListener('click', skipToVideo);

/* ---- Helpers ---- */
document.addEventListener('click', () => { if (state === 'play' && vid.paused) vid.play(); });
$('restart').onclick = () => { if (++taps >= 3) { taps = 0; resetHand(); } setTimeout(() => taps = 0, 1500); };
addEventListener('keydown', e => {            // desktop testing, only when testMode is true
  if (!CONFIG.testMode) return;
  if (e.key === 't' && state === 'hand') trigger();
  if (e.key === 'r' && loaded) resetHand();
});

/* ---- Portrait only for the hand scan; montage and final slide stay landscape ---- */
function enforceOrientationImpl() {
  const warning = $('orientationWarning');
  if (!warning) return;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const showWarning = (state === 'hand' && !portrait) || (state === 'scan' && waitingForLandscape);
  warning.classList.toggle('visible', showWarning);
  warning.setAttribute('aria-hidden', String(!showWarning));
  if (state === 'hand') {
    $('orientationTitle').textContent = 'PLEASE ROTATE YOUR iPAD';
    $('orientationMessage').textContent = 'The hand scanner runs in portrait mode.';
    $('orientationHint').textContent = 'Turn your iPad vertically to continue.';
  }
}
window.addEventListener('resize', enforceOrientationImpl, { passive: true });
window.addEventListener('orientationchange', enforceOrientationImpl);
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', enforceOrientationImpl);
enforceOrientationImpl();

  if (!firebaseReady) {
    $('bEnter').disabled = true;
    $('pmsg').textContent = 'Firebase connection failed. Enable Anonymous sign-in and check your database rules before starting.';
  } else {
    publishStage('waiting');
  }
}
