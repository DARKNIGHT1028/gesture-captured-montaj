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
$('bEnter').onclick = async () => {
  const btn = $('bEnter');
  if (!loaded) {
    btn.disabled = true;
    for (let i = 0; i < CONFIG.videos.length; i++) {
      $('pmsg').textContent = `Loading ${i + 1} / ${CONFIG.videos.length}…`;
      try {
        const r = await fetch(CONFIG.videos[i]);
        if (!r.ok) throw 0;
        urls.push(URL.createObjectURL(await r.blob()));
      } catch (e) { urls.push(null); $('pmsg').textContent = 'Not found: ' + CONFIG.videos[i]; }
    }
    loaded = true; btn.disabled = false;
  }
  enter();
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
  vid.pause(); vid.classList.remove('on'); $('hand').classList.remove('locked');
  prevOn = new Set(); fps.forEach((f, i) => setFp(i, '', 'Loading…')); $('cnt').textContent = '0 / 5';
  state = 'hand'; show('hand');
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
      enforceOrientation();
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
  enforceOrientationImpl();
  while (i < urls.length && !urls[i]) i++;
  if (i >= urls.length) return finish();
  state = 'play'; show('none');
  vid.onended = vid.onerror = () => playFrom(i + 1);
  vid.src = urls[i]; vid.classList.add('on');
  vid.play().catch(() => {});                  // if blocked, tap the screen to resume
}
function finish() { vid.classList.remove('on'); state = 'end'; show('end'); }

/* ---- Test mode ---- */
if (!CONFIG.testMode) document.querySelectorAll('.test').forEach(b => b.remove());
else $('skipT').onclick = trigger;

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
