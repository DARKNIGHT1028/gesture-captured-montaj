/* ===== TOUCH OF EXCELLENCE – settings (edit here) ===== */
const CONFIG = {
  videos: ['video/montage-after-scan.mp4'], // plays after the scan; the Majlis slide appears when it ends
  testMode: false,    // false = the five-finger scan is the ONLY way forward. true = show SKIP (TEST) button + keys t / r
  holdMs: 700,        // how long all five fingers must stay down
  scanMs: 4200,       // length of the scanning animation
  tolerance: 2.2,     // how forgiving a finger position is (bigger = easier)
  lines: ['SCANNING…', 'VERIFYING…', 'ACCESS GRANTED']
};

const $ = id => document.getElementById(id);
const vid = $('vid'), pads = [...document.querySelectorAll('.pad')], fps = [...document.querySelectorAll('.fp')];
let prevOn = new Set();
function setFp(i, cls, txt) { fps[i].classList.remove('ok', 'err'); if (cls) fps[i].classList.add(cls); fps[i].querySelector('.lbl').textContent = txt; }
let state = 'prep', urls = [], loaded = false, holdT = null, taps = 0, waitingForLandscape = false;

function show(id) {
  ['prep', 'hand', 'scan', 'end'].forEach(s =>
    $(s).classList.toggle('on', s === id || (id === 'scan' && s === 'hand')));
}

/* ---- Step 1: ENTER loads the video into memory (no buffering later), unlocks playback, opens the scanner ---- */
let startupPromise = null;
$('bEnter').onclick = async () => {
  if (startupPromise) return; // Ignore rapid/repeated taps while startup is running.
  const btn = $('bEnter');
  btn.disabled = true;
  btn.textContent = 'LOADING…';
  $('pmsg').textContent = 'Preparing the montage…';

  startupPromise = (async () => {
    // Use the original video URL directly. Avoid downloading a second full copy
    // into a Blob, which can stall or consume extra memory on some devices.
    urls = CONFIG.videos.slice();
    if (urls.length) {
      vid.pause();
      vid.src = urls[0];
      vid.preload = 'auto';
      vid.load();

      // Wait briefly for the browser to recognise the video, but never trap
      // the ENTER button indefinitely if the network is slow.
      await new Promise(resolve => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          vid.removeEventListener('loadedmetadata', done);
          vid.removeEventListener('canplay', done);
          vid.removeEventListener('error', done);
          clearTimeout(fallback);
          resolve();
        };
        const fallback = setTimeout(done, 9000);
        vid.addEventListener('loadedmetadata', done, { once: true });
        vid.addEventListener('canplay', done, { once: true });
        vid.addEventListener('error', done, { once: true });
        if (vid.readyState >= 1) done();
      });
    }
    await enter();
  })();

  try {
    await startupPromise;
  } catch (err) {
    console.error('Startup error:', err);
    $('pmsg').textContent = 'Could not prepare the video. Please tap ENTER to try again.';
  } finally {
    startupPromise = null;
    btn.disabled = false;
    btn.textContent = 'ENTER';
  }
};
async function enter() {
  try { await document.documentElement.requestFullscreen(); } catch (e) {}
  // Begin in landscape; the scanner requests portrait when it opens.
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  try { await navigator.wakeLock.request('screen'); } catch (e) {}
  const first = urls.find(Boolean);           // unlock the video element inside this tap
  if (first) { vid.src = first; vid.play().then(() => { vid.pause(); vid.currentTime = 0; }).catch(() => {}); }
  resetHand();
}
function resetHand() {
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

  state = 'play';
  show('none');
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
    const startAt = Math.min(10, Math.max(0, endVideo.duration - 0.25));
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
    if (endVideo.currentTime < 9.9) {
      try { endVideo.currentTime = Math.min(10, Math.max(0, endVideo.duration - 0.25)); } catch (e) {}
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
    if (endVideo.currentTime < 10) endVideo.currentTime = 10;
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
