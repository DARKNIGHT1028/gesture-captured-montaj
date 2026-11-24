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
const scanStatusRef = ref(firebaseDb, "events/touch-of-excellence/scanStatus");
const projectorReadyRef = ref(firebaseDb, "events/touch-of-excellence/projectorReady");
let firebaseReady = false;
let firebaseAuthError = null;
try {
  const credential = await signInAnonymously(firebaseAuth);
  firebaseReady = true;
  console.info("Firebase anonymous sign-in succeeded. UID:", credential.user.uid);
} catch (error) {
  firebaseAuthError = error;
  console.error("Firebase sign-in failed:", error.code, error.message, error);
}
let ceremonyRunId = Date.now();
async function publishStage(stage, videoIndex = 0) {
  const message = document.getElementById(ROLE === "display" ? "displayStatus" : "pmsg");
  if (!firebaseReady) {
    const detail = firebaseAuthError ? ` (${firebaseAuthError.code || "auth-error"}: ${firebaseAuthError.message})` : "";
    const text = "Firebase sign-in failed" + detail;
    console.error(text);
    if (message) message.textContent = text;
    return false;
  }
  try {
    await set(ceremonyRef, {
      stage,
      videoIndex,
      runId: ceremonyRunId,
      updatedAt: Date.now(),
      source: ROLE,
      project: firebaseConfig.projectId
    });
    console.info("Firebase database write succeeded:", stage, "at", ceremonyRef.toString());
    if (message && ROLE === "controller") {
      message.textContent = "Firebase connected ✓ Projector sync is ready.";
    }
    return true;
  } catch (error) {
    const detail = `${error.code || "database-error"}: ${error.message || "Unknown database error"}`;
    console.error("Firebase database write failed:", detail, error);
    if (message) {
      message.textContent = "DATABASE WRITE FAILED — " + detail;
    }
    return false;
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
  const displayControls = document.getElementById("displayControls");
  const skipScanButton = document.getElementById("displaySkipScan");
  const skipDisplayVideoButton = document.getElementById("displaySkipVideo");
  const introSrc = "images/intro.mp4";
  // Warm all presentation videos into this laptop's local browser cache.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./service-worker.js").then(async registration => {
      await navigator.serviceWorker.ready;
      const worker = registration.active || navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        const data = event.data || {};
        if (data.type === "progress") {
          showStatus(data.error
            ? "Offline cache could not save " + data.file + ". Keep a stable connection before the ceremony."
            : "Preparing offline videos… " + data.done + "/" + data.total);
        } else if (data.type === "complete") {
          showStatus(data.done === data.total
            ? "Videos saved on this laptop ✓ Ready for weak or disconnected internet."
            : "Offline video cache incomplete (" + data.done + "/" + data.total + "). Keep internet available for missing videos.");
        }
      };
      worker.postMessage({ type: "CACHE_MEDIA" }, [channel.port2]);
    }).catch(error => {
      console.warn("Offline media cache setup failed:", error);
      showStatus("Offline video preparation unavailable. Check internet before the ceremony.");
    });
  }
  const videos = [
    "video/Montaj after scanned.mp4",
    "video/Mid_video_compressed.mp4"
  ];
  const finalSrc = "video/majlis-animated-electronic-sound.mp4";
  let armed = false;
  let pending = null;
  let activeRun = null;
  let playing = false;
  let displayStage = "waiting";
  let latestRemoteScan = null;
  let displayScanTimers = [];
  const displayScanLines = document.getElementById("slines");
  function startProjectorScanAnimation() {
    displayScanTimers.forEach(clearTimeout);
    displayScanTimers = [];
    mirrorScreen("scan");
    if (displayScanLines) displayScanLines.textContent = "SCANNING…";
    status.hidden = true;
    displayScanTimers.push(setTimeout(() => { if (displayScanLines) displayScanLines.textContent = "VERIFYING…"; }, 1400));
    displayScanTimers.push(setTimeout(() => { if (displayScanLines) displayScanLines.textContent = "ACCESS GRANTED"; }, 2800));
  }
  const displayFingerIndicators = [...document.querySelectorAll("#hand .fp")];
  const displayFingerCount = document.getElementById("cnt");

  function renderRemoteScanStatus(data) {
    if (!data || data.runId !== activeRun || displayStage !== "scanning") return;
    latestRemoteScan = data;
    if (data.phase === "complete") {
      startProjectorScanAnimation();
      return;
    }
    const states = Array.isArray(data.fingers) ? data.fingers : [];
    displayFingerIndicators.forEach((finger, index) => {
      const state = states[index] || "waiting";
      finger.classList.remove("ok", "err");
      if (state === "confirmed") finger.classList.add("ok");
      if (state === "failed") finger.classList.add("err");
      const label = finger.querySelector(".lbl");
      if (label) label.textContent = state === "confirmed" ? "Confirmed" : state === "failed" ? "Not detected" : "Waiting…";
    });
    if (displayFingerCount) displayFingerCount.textContent = (Number(data.count) || 0) + " / 5";
    if (data.phase === "complete") showStatus("FIVE-FINGER SCAN COMPLETE ✓ 5 / 5");
    else if (data.phase === "verifying") showStatus("Five fingers detected — verifying…");
    else showStatus("LIVE SCAN — " + (Number(data.count) || 0) + " / 5 fingers detected");
  }

  function setDisplayControls(mode) {
    const visible = armed && (mode === "scanning" || mode === "presentation");
    displayControls.hidden = !visible;
    displayControls.setAttribute("aria-hidden", String(!visible));
    skipScanButton.hidden = !visible || mode !== "scanning";
    skipDisplayVideoButton.hidden = !visible || mode !== "presentation";
    panel.classList.toggle("controls-active", visible);
  }
  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
  }
  function hideStatus() { status.hidden = true; }
  function mirrorScreen(screenName) {
    ["prep", "hand", "scan", "end"].forEach(name => {
      const el = document.getElementById(name);
      if (el) el.classList.toggle("on", name === screenName);
    });
  }

  async function reportIntroFinished(runId) {
    try {
      await set(ceremonyRef, {
        stage: "introFinished",
        videoIndex: 0,
        runId,
        updatedAt: Date.now(),
        source: "display",
        project: firebaseConfig.projectId
      });
    } catch (error) {
      console.error("Could not report intro completion:", error.code, error.message);
      showStatus("Intro finished, but the iPad could not be notified. Check database write permissions.");
    }
  }
  async function playIntro(runId) {
    if (!armed || runId !== activeRun) return;
    mirrorScreen(null);
    playing = true;
    pending = { stage: "intro", runId };
    finalVideo.pause();
    finalVideo.hidden = true;
    displayVideo.hidden = false;
    displayVideo.onended = () => {
      if (runId !== activeRun) return;
      playing = false;
      displayVideo.pause();
      displayVideo.hidden = true;
      showStatus("Intro complete. Starting five-finger scan on the iPad…");
      reportIntroFinished(runId);
    };
    displayVideo.onerror = () => {
      showStatus("INTRO VIDEO FAILED TO LOAD — check images/intro.mp4");
      console.error("Could not load intro video:", introSrc, displayVideo.error);
    };
    displayVideo.src = introSrc;
    displayVideo.load();
    try {
      await displayVideo.play();
      hideStatus();
    } catch (error) {
      showStatus("Tap the screen to start the intro video");
      console.error("Intro playback blocked:", error);
    }
  }
  async function playFinal() {
    playing = true;
    mirrorScreen(null);
    displayVideo.pause();
    displayVideo.hidden = true;
    finalVideo.hidden = false;
    finalVideo.onended = () => finalVideo.pause();
    finalVideo.onerror = () => showStatus("FINAL VIDEO FAILED TO LOAD — check video/majlis-animated-electronic-sound.mp4");
    finalVideo.src = finalSrc;
    finalVideo.load();
    try {
      await finalVideo.play();
      hideStatus();
    } catch (error) {
      showStatus("Tap the screen to start the final presentation");
      console.error("Final video playback blocked:", error);
    }
  }
  async function playVideo(index, runId) {
    if (!armed || runId !== activeRun) return;
    if (index >= videos.length) { setDisplayControls("end"); return playFinal(); }
    setDisplayControls("presentation");
    playing = true;
    pending = { stage: "presentation", videoIndex: index, runId };
    finalVideo.pause();
    finalVideo.hidden = true;
    displayVideo.hidden = false;
    displayVideo.onended = () => playVideo(index + 1, runId);
    displayVideo.onerror = () => {
      console.error("Could not load presentation video:", videos[index], displayVideo.error);
      showStatus("MONTAGE VIDEO FAILED TO LOAD — check the video file path and format");
    };
    displayVideo.src = videos[index];
    displayVideo.load();
    try {
      await displayVideo.play();
      hideStatus();
    } catch (error) {
      showStatus("Tap the screen to resume the montage");
      console.error("Montage playback blocked:", error);
    }
  }
  function handleStage(data) {
    if (!data) {
      showStatus("Waiting for the iPad controller…");
      return;
    }
    if (data.stage === "waiting") {
      displayStage = "waiting";
      latestRemoteScan = null;
      displayScanTimers.forEach(clearTimeout);
      displayScanTimers = [];
      activeRun = data.runId;
      pending = null;
      playing = false;
      displayVideo.pause();
      finalVideo.pause();
      displayVideo.hidden = true;
      finalVideo.hidden = true;
      mirrorScreen("prep");
      setDisplayControls("waiting");
      showStatus("Waiting for the iPad controller…");
      return;
    }
    if (data.stage === "intro") {
      const mirrorButton = document.getElementById("bEnter");
      if (mirrorButton) { mirrorButton.classList.add("projector-pressed"); mirrorButton.textContent = "ENTER ✓"; }
      if (data.runId !== activeRun || !playing || pending?.stage !== "intro") {
        activeRun = data.runId;
        pending = data;
        playing = false;
        if (armed) playIntro(data.runId);
        else showStatus("Ready. Enable projector playback to play the intro.");
      }
      return;
    }
    if (data.stage === "introFinished") {
      if (data.runId === activeRun) {
        displayStage = "scanning";
        mirrorScreen("hand");
        const mirrorButton = document.getElementById("bEnter");
        if (mirrorButton) { mirrorButton.classList.remove("projector-pressed"); mirrorButton.textContent = "ENTER"; }
        playing = false;
        displayVideo.pause();
        displayVideo.hidden = true;
        setDisplayControls("scanning");
        showStatus("Five-finger scan in progress on the iPad…");
      }
      return;
    }
    if (data.stage === "scanning") {
      if (data.runId === activeRun) {
        displayStage = "scanning";
        // Mirror either the live hand or the cinematic access-granted scan animation.
        if (latestRemoteScan?.runId === data.runId && latestRemoteScan.phase === "complete") {
          startProjectorScanAnimation();
        } else {
          mirrorScreen("hand");
          showStatus("LIVE SCAN — waiting for fingers…");
        }
        setDisplayControls("scanning");
      }
      return;
    }
    if (data.stage === "presentation") {
      displayStage = "presentation";
      setDisplayControls("presentation");
      if (data.runId !== activeRun || !playing) {
        mirrorScreen(null);
        activeRun = data.runId;
        pending = data;
        if (armed) playVideo(Number(data.videoIndex || 0), data.runId);
        else showStatus("Ready. Enable projector playback to begin the montage.");
      }
    }
  }

  skipScanButton.addEventListener("click", async event => {
    event.preventDefault(); event.stopPropagation();
    if (!armed || !activeRun) return;
    const runId = activeRun;
    pending = { stage: "presentation", videoIndex: 0, runId };
    playing = true;
    setDisplayControls("presentation");
    try {
      await set(ceremonyRef, { stage: "presentation", videoIndex: 0, runId, updatedAt: Date.now(), source: "display", project: firebaseConfig.projectId });
    } catch (error) {
      playing = false;
      pending = { stage: "scanning", runId };
      setDisplayControls("scanning");
      showStatus(`Could not skip scan — ${error.code || error.message}`);
      return;
    }
    playVideo(0, runId);
  });
  skipDisplayVideoButton.addEventListener("click", event => {
    event.preventDefault(); event.stopPropagation();
    if (!armed || !pending || pending.stage !== "presentation") return;
    playVideo(Number(pending.videoIndex || 0) + 1, pending.runId);
  });
  enable.addEventListener("click", async () => {
    try { await document.documentElement.requestFullscreen(); } catch (error) {}
    try { await set(projectorReadyRef, { ready: true, updatedAt: Date.now() }); }
    catch (error) { showStatus(`PROJECTOR READY SIGNAL FAILED — ${error.code || error.message}`); return; }
    armed = true;
    gate.hidden = true;
    showStatus("Projector playback enabled. Waiting for the iPad…");
    if (pending && pending.stage === "intro") playIntro(pending.runId);
    else if (pending && pending.stage === "presentation") playVideo(Number(pending.videoIndex || 0), pending.runId);
    else if (!playing) showStatus("Projector connected. Waiting for the iPad…");
  });
  panel.addEventListener("click", () => {
    if (!armed) return;
    if (!displayVideo.paused || !finalVideo.paused) return;
    if (pending && pending.stage === "intro") playIntro(pending.runId);
    else if (pending && pending.stage === "presentation") {
      if (finalVideo.hidden) playVideo(Number(pending.videoIndex || 0), pending.runId);
      else finalVideo.play().catch(() => showStatus("Tap again to play the final presentation"));
    }
  });
  if (!firebaseReady) {
    showStatus(firebaseAuthError ? `Firebase sign-in failed — ${firebaseAuthError.code || "auth-error"}: ${firebaseAuthError.message}` : "Firebase sign-in failed. Check Authentication settings.");
    enable.disabled = true;
  } else {
    set(projectorReadyRef, { ready: false, updatedAt: Date.now() }).catch(error => showStatus(`Could not reset projector readiness — ${error.code || error.message}`));
    onValue(ceremonyRef, snapshot => handleStage(snapshot.val()), error => {
      console.error(error);
      showStatus(`DATABASE READ FAILED — ${error.code || "database-error"}: ${error.message || "Check database rules and URL"}`);
    });
    onValue(scanStatusRef, snapshot => renderRemoteScanStatus(snapshot.val()), error => {
      console.error("Live scan status listener failed:", error);
      showStatus(`LIVE SCAN SYNC FAILED — ${error.code || "database-error"}`);
    });
  }
} else {
/* ===== TOUCH OF EXCELLENCE – settings (edit here) ===== */
const CONFIG = {
  videos: ['video/Montaj after scanned.mp4', 'video/Mid_video_compressed.mp4'], // sequential post-scan videos
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
function publishLiveScan(fingers, phase = "scanning") {
  if (ROLE !== "controller" || !firebaseReady) return;
  const count = fingers.filter(value => value === "confirmed").length;
  const signature = ceremonyRunId + "|" + phase + "|" + fingers.join(",");
  if (signature === lastScanSignature) return;
  lastScanSignature = signature;
  set(scanStatusRef, { runId: ceremonyRunId, fingers, count, phase, updatedAt: Date.now(), source: "controller" })
    .catch(error => console.error("Could not publish live scan status:", error.code, error.message));
}
let state = 'prep', urls = CONFIG.videos.slice(), loaded = true, holdT = null, taps = 0, waitingForLandscape = false;
let currentVideoIndex = 0;
let lastScanSignature = "";
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
  if (state !== 'prep' || (ROLE === "controller" && $('bEnter').disabled)) return;
  if (ROLE === 'controller') await publishStage('intro');
  const btn = $('bEnter');
  btn.disabled = true;
  btn.textContent = 'LOADING…';
  try { await document.documentElement.requestFullscreen(); } catch (e) {}
  try { await navigator.wakeLock.request('screen'); } catch (e) {}
  if (ROLE === 'controller') {
    intro.pause();
    intro.classList.remove('intro-playing');
    state = 'intro';
    await publishStage('intro');
    btn.textContent = 'INTRO PLAYING ON PROJECTOR';
    return;
  }
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
  skipVideoButton.hidden = true;
  lastScanSignature = "";
  publishLiveScan(["waiting", "waiting", "waiting", "waiting", "waiting"], "scanning");
  currentVideoIndex = 0;
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); } catch (e) {}
  finalVideoStarted = false;
  endVideo.pause();
  endVideo.removeAttribute('src');
  endVideo.load();
  $('end').classList.remove('video-active');
  $('endVideoHint').textContent = '';
  vid.pause(); vid.classList.remove('on'); $('hand').classList.remove('locked');
  prevOn = new Set(); fps.forEach((f, i) => setFp(i, '', 'Waiting…')); $('cnt').textContent = '0 / 5';
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
    else if (prevOn.has(i)) {
      setFp(i, 'err', 'Not detected');
      setTimeout(() => {
        if (!prevOn.has(i) && fps[i].classList.contains('err')) {
          setFp(i, '', 'Waiting…');
          const refreshed = pads.map((_, index) => fps[index].classList.contains('ok') ? "confirmed" : "waiting");
          publishLiveScan(refreshed, "scanning");
        }
      }, 850);
    }
  });
  prevOn = on;
  $('cnt').textContent = on.size + ' / 5';
  const liveStates = pads.map((_, i) => on.has(i) ? "confirmed" : "waiting");
  pads.forEach((_, i) => { if (!on.has(i) && fps[i].classList.contains("err")) liveStates[i] = "failed"; });
  publishLiveScan(liveStates, on.size === 5 ? "verifying" : "scanning");
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
  publishLiveScan(["confirmed", "confirmed", "confirmed", "confirmed", "confirmed"], "complete");
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
    $('pmsg').textContent = firebaseAuthError ? `Firebase sign-in failed — ${firebaseAuthError.code || "auth-error"}: ${firebaseAuthError.message}` : 'Firebase sign-in failed. Check Authentication settings.';
  } else {
    const enterButton = $('bEnter');
    enterButton.disabled = true;
    $('pmsg').textContent = "Waiting for laptop to enable projector playback…";
    onValue(projectorReadyRef, snapshot => {
      const value = snapshot.val();
      const ready = value === true || value?.ready === true;
      enterButton.disabled = !ready;
      if (ready && state === "prep") $('pmsg').textContent = "Projector ready ✓ You can press ENTER.";
      else if (!ready && state === "prep") $('pmsg').textContent = "Waiting for laptop to enable projector playback…";
    }, error => { $('pmsg').textContent = `PROJECTOR READY CHECK FAILED — ${error.code || error.message}`; });
    publishStage('waiting');
    onValue(ceremonyRef, snapshot => {
      const data = snapshot.val();
      if (!data || data.runId !== ceremonyRunId) return;
      if (data.stage === 'introFinished' && state === 'intro') {
        beginScan();
      } else if (data.stage === 'presentation' && data.source === 'display' && (state === 'hand' || state === 'scan')) {
        // Projector operator skipped the physical scan: synchronize the iPad controller.
        clearTimeout(holdT);
        holdT = null;
        state = 'play';
        playFrom(Number(data.videoIndex || 0));
      }
    }, error => {
      console.error("Controller could not listen for intro completion:", error.code, error.message);
      $('pmsg').textContent = `PROJECTOR SYNC ERROR — ${error.code || "database-error"}: ${error.message || "Unknown error"}`;
    });
  }
}
