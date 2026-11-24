const urlParams = new URLSearchParams(location.search);
const VIEW_PARAM = urlParams.get("view");
const ROLE_PARAM = urlParams.get("role");
const IS_PROJECTOR_VIEW = VIEW_PARAM === "projector";
const LEGACY_FIREBASE_ROLE =
  !IS_PROJECTOR_VIEW && (ROLE_PARAM === "display" || ROLE_PARAM === "controller") ? ROLE_PARAM : null;

const CONFIG = {
  videos: ["video/Montaj after scanned.mp4", "video/Mid_video_compressed.mp4"],
  testMode: false,
  holdMs: 700,
  scanMs: 4200,
  tolerance: 2.2,
  lines: ["SCANNING…", "VERIFYING…", "ACCESS GRANTED"]
};
const FINAL_VIDEO = "video/majlis-animated-electronic-sound.mp4";
const SYNC_CHANNEL = "touch-of-excellence-sync";
const SYNC_MSG_KEY = "touch-of-excellence-sync-msg";
const SYNC_STATE_KEY = "touch-of-excellence-sync-state";

function createStaticSync(role) {
  const senderId = `${role}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC_CHANNEL) : null;
  const seenIds = new Set();
  let seq = 0;

  function markSeen(id) {
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    if (seenIds.size > 200) {
      const oldest = seenIds.values().next().value;
      seenIds.delete(oldest);
    }
    return true;
  }

  function send(type, payload = {}, { persist = false } = {}) {
    const msg = {
      id: `${senderId}-${++seq}-${Date.now()}`,
      sender: senderId,
      type,
      ts: Date.now(),
      ...payload
    };
    if (persist) {
      try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(msg)); } catch (e) {}
    }
    try { channel?.postMessage(msg); } catch (e) {}
    try { localStorage.setItem(SYNC_MSG_KEY, JSON.stringify(msg)); } catch (e) {}
    return msg;
  }

  function onMessage(handler) {
    const handle = raw => {
      if (!raw || raw.sender === senderId || !markSeen(raw.id)) return;
      handler(raw);
    };
    channel?.addEventListener("message", event => handle(event.data));
    window.addEventListener("storage", event => {
      if (event.key !== SYNC_MSG_KEY || !event.newValue) return;
      try { handle(JSON.parse(event.newValue)); } catch (e) {}
    });
  }

  function readState() {
    try {
      const raw = localStorage.getItem(SYNC_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return { send, onMessage, readState };
}

function showScreen(id) {
  ["prep", "hand", "scan", "end"].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("on", s === id || (id === "scan" && s === "hand"));
  });
}

function renderFingerIndicators(fps, cntEl, states = [], countOverride = null) {
  let confirmed = 0;
  fps.forEach((finger, i) => {
    const st = states[i] || "waiting";
    finger.classList.remove("ok", "err");
    if (st === "confirmed") {
      finger.classList.add("ok");
      confirmed++;
    } else if (st === "failed") {
      finger.classList.add("err");
    }
    const lbl = finger.querySelector(".lbl");
    if (lbl) lbl.textContent = st === "confirmed" ? "Confirmed" : st === "failed" ? "Not detected" : "Waiting…";
  });
  if (cntEl) cntEl.textContent = `${countOverride ?? confirmed} / 5`;
}

if (IS_PROJECTOR_VIEW) {
  /* ===== Static GitHub Pages Projector View (?view=projector) ===== */
  document.body.classList.add("projector-view");
  const $ = id => document.getElementById(id);
  const intro = $("intro");
  const vid = $("vid");
  const endVideo = $("endVideo");
  const scanSound = $("scanSound");
  const slines = $("slines");
  const cnt = $("cnt");
  const bEnter = $("bEnter");
  const projectorHint = $("projectorHint");
  const fps = [...document.querySelectorAll("#hand .fp")];
  const sync = createStaticSync("projector");

  let activeStageKey = "";
  let scanTimers = [];
  let pendingResume = null;

  function clearScanTimers() {
    scanTimers.forEach(clearTimeout);
    scanTimers = [];
  }

  function clearAutoplayPrompt() {
    pendingResume = null;
    if (projectorHint) projectorHint.hidden = true;
  }

  function attemptPlay(mediaEl, retryFn) {
    const p = mediaEl.play();
    if (p && p.then) {
      p.then(() => {
        if (pendingResume === retryFn) clearAutoplayPrompt();
      }).catch(() => {
        pendingResume = retryFn;
        if (projectorHint) projectorHint.hidden = false;
      });
    }
  }

  function stopAllMedia() {
    clearScanTimers();
    clearAutoplayPrompt();
    intro.pause();
    intro.classList.remove("intro-playing");
    intro.onended = null;
    intro.onerror = null;

    vid.pause();
    vid.classList.remove("on");
    vid.onended = null;
    vid.onerror = null;

    endVideo.pause();
    endVideo.onended = null;
    endVideo.onerror = null;
    endVideo.onloadedmetadata = null;
    $("end")?.classList.remove("video-active");

    try { scanSound.pause(); scanSound.currentTime = 0; } catch (e) {}
  }

  function playIntroMedia(startAt = 0) {
    stopAllMedia();
    if (bEnter) {
      bEnter.classList.add("projector-pressed");
      bEnter.textContent = "ENTER ✓";
    }
    showScreen(null);
    intro.currentTime = Math.max(0, Number(startAt) || 0);
    intro.classList.add("intro-playing");
    intro.onended = () => intro.pause();
    attemptPlay(intro, () => playIntroMedia(intro.currentTime));
  }

  function playMontageMedia(index, startAt = 0) {
    const src = CONFIG.videos[index];
    if (!src) return playEndMedia();
    stopAllMedia();
    showScreen("none");
    const targetHref = new URL(src, document.baseURI).href;
    if (vid.src !== targetHref) {
      vid.src = src;
      vid.load();
    }
    const seekAndPlay = () => {
      try {
        if (startAt > 0.2 && Number.isFinite(vid.duration)) {
          vid.currentTime = Math.min(startAt, Math.max(0, vid.duration - 0.1));
        } else {
          vid.currentTime = 0;
        }
      } catch (e) {}
      attemptPlay(vid, () => playMontageMedia(index, vid.currentTime));
    };
    vid.classList.add("on");
    vid.onended = () => vid.pause();
    if (vid.readyState >= 1) seekAndPlay();
    else {
      vid.onloadedmetadata = () => {
        vid.onloadedmetadata = null;
        seekAndPlay();
      };
      attemptPlay(vid, () => playMontageMedia(index, vid.currentTime));
    }
  }

  function playEndMedia() {
    stopAllMedia();
    showScreen("end");
    endVideo.src = FINAL_VIDEO;
    endVideo.onloadedmetadata = () => {
      const startAt = Math.min(1, Math.max(0, endVideo.duration - 0.25));
      try { endVideo.currentTime = startAt; } catch (e) {}
      attemptPlay(endVideo, () => playEndMedia());
    };
    endVideo.onplaying = () => $("end")?.classList.add("video-active");
    endVideo.onended = () => endVideo.pause();
    endVideo.onerror = () => $("end")?.classList.remove("video-active");
    endVideo.load();
  }

  function applyStage(msg) {
    if (!msg || !msg.stage) return;
    const key = `${msg.runId || ""}|${msg.stage}|${msg.videoIndex ?? ""}`;
    if (msg.stage === "end-skip") {
      if (Number.isFinite(endVideo.duration)) {
        try { endVideo.currentTime = Math.max(0, endVideo.duration - 0.05); } catch (e) {}
      }
      endVideo.pause();
      return;
    }
    if (key === activeStageKey && msg.stage !== "prep") return;
    activeStageKey = key;

    if (msg.stage === "prep") {
      stopAllMedia();
      $("hand")?.classList.remove("locked");
      renderFingerIndicators(fps, cnt, [], 0);
      if (bEnter) {
        bEnter.classList.remove("projector-pressed");
        bEnter.textContent = "ENTER";
      }
      showScreen("prep");
      return;
    }

    if (msg.stage === "intro") {
      playIntroMedia(msg.currentTime || 0);
      return;
    }

    if (msg.stage === "hand") {
      stopAllMedia();
      $("hand")?.classList.remove("locked");
      renderFingerIndicators(fps, cnt, msg.fingers || [], msg.count ?? 0);
      showScreen("hand");
      return;
    }

    if (msg.stage === "scan") {
      stopAllMedia();
      $("hand")?.classList.add("locked");
      renderFingerIndicators(fps, cnt, ["confirmed", "confirmed", "confirmed", "confirmed", "confirmed"], 5);
      showScreen("scan");
      try {
        scanSound.currentTime = 0;
        scanSound.play().catch(() => {});
      } catch (e) {}
      const lines = CONFIG.lines;
      if (slines) slines.textContent = lines[0];
      const stepMs = CONFIG.scanMs / lines.length;
      lines.slice(1).forEach((line, idx) => {
        scanTimers.push(setTimeout(() => { if (slines) slines.textContent = line; }, stepMs * (idx + 1)));
      });
      return;
    }

    if (msg.stage === "play") {
      playMontageMedia(Number(msg.videoIndex || 0), msg.currentTime || 0);
      return;
    }

    if (msg.stage === "end") {
      playEndMedia();
    }
  }

  ["click", "keydown"].forEach(ev => {
    document.addEventListener(ev, () => {
      if (pendingResume) {
        const fn = pendingResume;
        clearAutoplayPrompt();
        fn();
      }
    });
  });

  sync.onMessage(msg => {
    if (msg.type === "operator-hello") {
      sync.send("projector-hello");
      return;
    }
    if (msg.type === "stage") {
      applyStage(msg);
      return;
    }
    if (msg.type === "fingers") {
      if (activeStageKey.endsWith("|scan|")) return;
      $("hand")?.classList.remove("locked");
      renderFingerIndicators(fps, cnt, msg.fingers || [], msg.count ?? 0);
    }
  });

  const saved = sync.readState();
  if (saved && saved.type === "stage" && Date.now() - (saved.ts || 0) < 6 * 3600 * 1000) {
    applyStage(saved);
  } else {
    showScreen("prep");
  }

  sync.send("projector-hello");
  window.addEventListener("pagehide", () => sync.send("projector-bye"));
} else if (!LEGACY_FIREBASE_ROLE) {
  /* ===== Static GitHub Pages Operator View (/) ===== */
  document.body.classList.add("operator-view");
  const $ = id => document.getElementById(id);
  const vid = $("vid");
  const intro = $("intro");
  const scanSound = $("scanSound");
  const endVideo = $("endVideo");
  const pads = [...document.querySelectorAll(".pad")];
  const fps = [...document.querySelectorAll(".fp")];
  const skipVideoButton = $("skipVideo");
  const openProjectorButton = $("openProjector");
  const sync = createStaticSync("operator");
  const desktopPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  let ceremonyRunId = Date.now();
  let state = "prep";
  let urls = CONFIG.videos.slice();
  let currentVideoIndex = 0;
  let holdT = null;
  let taps = 0;
  let waitingForLandscape = false;
  let finalVideoStarted = false;
  let prevOn = new Set();
  let lastScanSignature = "";
  let projectorWin = null;
  let projectorConnected = false;

  function syncMute() {
    const mute = projectorConnected;
    intro.muted = mute;
    vid.muted = mute;
    endVideo.muted = mute;
    scanSound.muted = mute;
  }

  function updateProjectorStatus(connected) {
    projectorConnected = connected;
    syncMute();
    const pmsg = $("pmsg");
    if (pmsg) pmsg.textContent = connected ? "Projector window connected ✓" : "";
  }

  function broadcastCurrentStage({ persist = true } = {}) {
    const payload = { runId: ceremonyRunId, stage: state };
    if (state === "intro") {
      payload.currentTime = intro.currentTime || 0;
    } else if (state === "play") {
      payload.videoIndex = currentVideoIndex;
      payload.currentTime = vid.currentTime || 0;
    }
    sync.send("stage", payload, { persist });
  }

  function setFp(i, cls, txt) {
    fps[i].classList.remove("ok", "err");
    if (cls) fps[i].classList.add(cls);
    fps[i].querySelector(".lbl").textContent = txt;
  }

  function publishLiveScan(fingers, phase = "scanning") {
    const count = fingers.filter(value => value === "confirmed").length;
    const signature = `${ceremonyRunId}|${phase}|${fingers.join(",")}`;
    if (signature === lastScanSignature) return;
    lastScanSignature = signature;
    sync.send("fingers", { runId: ceremonyRunId, fingers, count, phase });
  }

  skipVideoButton.hidden = true;
  skipVideoButton.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    if (state === "play") {
      playFrom(currentVideoIndex + 1);
    } else if (state === "end") {
      if (endVideo && Number.isFinite(endVideo.duration)) {
        endVideo.currentTime = Math.max(0, endVideo.duration - 0.05);
        endVideo.pause();
      }
      $("endVideoHint").textContent = "";
      skipVideoButton.hidden = true;
      sync.send("stage", { runId: ceremonyRunId, stage: "end-skip" });
    }
  });

  if (openProjectorButton) {
    openProjectorButton.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (projectorWin && !projectorWin.closed) {
        projectorWin.focus();
        return;
      }
      const projUrl = new URL(location.href);
      projUrl.searchParams.delete("role");
      projUrl.searchParams.set("view", "projector");
      projectorWin = window.open(projUrl.toString(), "touchOfExcellenceProjector", "width=1280,height=720");
      if (projectorWin) {
        updateProjectorStatus(true);
        setTimeout(() => broadcastCurrentStage({ persist: true }), 250);
      }
    });
  }

  /* ---- Step 1: ENTER plays intro; scanner follows ---- */
  function beginScan() {
    if (state !== "intro" && state !== "prep") return;
    intro.pause();
    intro.classList.remove("intro-playing");
    enter();
  }
  intro.addEventListener("ended", beginScan);
  intro.addEventListener("error", beginScan);

  $("bEnter").onclick = async () => {
    if (state !== "prep") return;
    const btn = $("bEnter");
    btn.disabled = true;
    btn.textContent = "LOADING…";
    try { await document.documentElement.requestFullscreen(); } catch (e) {}
    try { await navigator.wakeLock.request("screen"); } catch (e) {}
    state = "intro";
    syncMute();
    intro.currentTime = 0;
    intro.classList.add("intro-playing");
    sync.send("stage", { runId: ceremonyRunId, stage: "intro", currentTime: 0 }, { persist: true });
    const attempt = intro.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        btn.disabled = false;
        btn.textContent = "PLAY INTRO";
      });
    }
  };

  document.addEventListener("click", () => {
    if (state === "intro" && intro.paused && intro.classList.contains("intro-playing")) {
      intro.play().catch(() => {});
    }
  });

  async function enter() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    try { await navigator.wakeLock.request("screen"); } catch (e) {}
    resetHand();
  }

  function resetHand({ newRun = false } = {}) {
    skipVideoButton.hidden = true;
    lastScanSignature = "";
    if (newRun) ceremonyRunId = Date.now();
    currentVideoIndex = 0;
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("portrait").catch(() => {}); } catch (e) {}
    finalVideoStarted = false;
    endVideo.pause();
    endVideo.removeAttribute("src");
    endVideo.load();
    $("end").classList.remove("video-active");
    $("endVideoHint").textContent = "";
    vid.pause();
    vid.classList.remove("on");
    $("hand").classList.remove("locked");
    prevOn = new Set();
    fps.forEach((f, i) => setFp(i, "", "Waiting…"));
    $("cnt").textContent = "0 / 5";
    state = "hand";
    showScreen("hand");
    enforceOrientationImpl();
    sync.send("stage", { runId: ceremonyRunId, stage: "hand" }, { persist: true });
  }

  /* ---- Step 2: five-finger detection ---- */
  function evalTouches(touches) {
    const c = pads.map(p => {
      const b = p.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 };
    });
    const on = new Set();
    [...touches].forEach(t => {
      let best = 0, bd = 1e9;
      c.forEach((p, i) => {
        const d = Math.hypot(t.clientX - p.x, t.clientY - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < c[best].r * CONFIG.tolerance) on.add(best);
    });
    fps.forEach((f, i) => {
      if (on.has(i)) setFp(i, "ok", "Confirmed");
      else if (prevOn.has(i)) {
        setFp(i, "err", "Not detected");
        setTimeout(() => {
          if (!prevOn.has(i) && fps[i].classList.contains("err")) {
            setFp(i, "", "Waiting…");
            const refreshed = pads.map((_, index) => (fps[index].classList.contains("ok") ? "confirmed" : "waiting"));
            publishLiveScan(refreshed, "scanning");
          }
        }, 850);
      }
    });
    prevOn = on;
    $("cnt").textContent = `${on.size} / 5`;
    const liveStates = pads.map((_, i) => (on.has(i) ? "confirmed" : "waiting"));
    pads.forEach((_, i) => { if (!on.has(i) && fps[i].classList.contains("err")) liveStates[i] = "failed"; });
    publishLiveScan(liveStates, on.size === 5 ? "verifying" : "scanning");
    if (on.size === 5) {
      if (!holdT) holdT = setTimeout(trigger, CONFIG.holdMs);
    } else {
      clearTimeout(holdT);
      holdT = null;
    }
  }

  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(ev =>
    document.addEventListener(ev, e => {
      if (state !== "hand" || (e.target.closest && e.target.closest("button"))) return;
      e.preventDefault();
      evalTouches(e.touches);
    }, { passive: false })
  );

  /* ---- Step 3: cinematic scan, montages, then final slide ---- */
  function trigger() {
    if (state !== "hand") return;
    holdT = null;
    state = "scan";
    publishLiveScan(["confirmed", "confirmed", "confirmed", "confirmed", "confirmed"], "complete");
    sync.send("stage", { runId: ceremonyRunId, stage: "scan" }, { persist: true });
    try { scanSound.currentTime = 0; scanSound.play().catch(() => {}); } catch (e) {}
    $("hand").classList.add("locked");
    fps.forEach((f, i) => setFp(i, "ok", "Confirmed"));
    showScreen("scan");
    const L = CONFIG.lines;
    const el = $("slines");
    let i = 0;
    el.textContent = L[0];
    const iv = setInterval(() => { if (++i < L.length) el.textContent = L[i]; }, CONFIG.scanMs / L.length);
    setTimeout(() => {
      clearInterval(iv);
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
      if (desktopPointer.matches || !window.matchMedia("(orientation: portrait)").matches) {
        waitingForLandscape = false;
        playFrom(0);
        return;
      }
      const continueToVideo = () => {
        if (state !== "scan" || window.matchMedia("(orientation: portrait)").matches) return;
        waitingForLandscape = false;
        window.removeEventListener("orientationchange", continueToVideo);
        window.removeEventListener("resize", continueToVideo);
        playFrom(0);
      };
      waitingForLandscape = true;
      $("orientationTitle").textContent = "ROTATE TO LANDSCAPE";
      $("orientationMessage").textContent = "Scanning complete. The montage is ready.";
      $("orientationHint").textContent = "Turn your iPad horizontally to continue.";
      enforceOrientationImpl();
      window.addEventListener("orientationchange", continueToVideo);
      window.addEventListener("resize", continueToVideo);
    }, CONFIG.scanMs);
  }

  function playFrom(i) {
    waitingForLandscape = false;
    $("orientationWarning").classList.remove("visible");
    $("orientationWarning").setAttribute("aria-hidden", "true");
    enforceOrientationImpl();
    while (i < urls.length && !urls[i]) i++;
    if (i >= urls.length) return finish();

    currentVideoIndex = i;
    state = "play";
    skipVideoButton.hidden = false;
    showScreen("none");
    sync.send("stage", { runId: ceremonyRunId, stage: "play", videoIndex: i, currentTime: 0 }, { persist: true });

    vid.onended = () => playFrom(i + 1);
    vid.onerror = () => {
      console.warn("Video could not be played:", urls[i]);
      playFrom(i + 1);
    };
    const targetHref = new URL(urls[i], document.baseURI).href;
    if (vid.src !== targetHref) {
      vid.src = urls[i];
      vid.load();
    } else {
      try { vid.currentTime = 0; } catch (e) {}
    }
    vid.classList.add("on");
    const playAttempt = vid.play();
    if (playAttempt && playAttempt.catch) {
      playAttempt.catch(err => console.warn("Playback needs a user tap:", err));
    }
  }

  function finish() {
    vid.pause();
    vid.classList.remove("on");
    state = "end";
    skipVideoButton.hidden = false;
    showScreen("end");
    sync.send("stage", { runId: ceremonyRunId, stage: "end" }, { persist: true });
    startFinalPresentation();
  }

  function startFinalPresentation() {
    if (finalVideoStarted) return;
    finalVideoStarted = true;
    $("end").classList.remove("video-active");
    $("endVideoHint").textContent = "Loading final presentation…";
    endVideo.pause();
    endVideo.src = FINAL_VIDEO;
    endVideo.currentTime = 0;
    endVideo.onloadedmetadata = async () => {
      const startAt = Math.min(1, Math.max(0, endVideo.duration - 0.25));
      try { endVideo.currentTime = startAt; } catch (e) {}
      try {
        await endVideo.play();
        $("end").classList.add("video-active");
        $("endVideoHint").textContent = "";
      } catch (err) {
        $("endVideoHint").textContent = "Tap to play the final presentation";
      }
    };
    endVideo.oncanplay = () => {
      if (endVideo.currentTime < 0.9) {
        try { endVideo.currentTime = Math.min(1, Math.max(0, endVideo.duration - 0.25)); } catch (e) {}
      }
    };
    endVideo.onended = () => {
      endVideo.pause();
      $("endVideoHint").textContent = "";
      skipVideoButton.hidden = true;
    };
    endVideo.onerror = () => {
      $("endVideoHint").textContent = "Final video could not load. Showing the original poster.";
      $("end").classList.remove("video-active");
      skipVideoButton.hidden = true;
    };
    endVideo.load();
  }

  endVideo.addEventListener("click", async () => {
    if (state !== "end") return;
    try {
      if (endVideo.currentTime < 1) endVideo.currentTime = 1;
      await endVideo.play();
      $("end").classList.add("video-active");
      $("endVideoHint").textContent = "";
    } catch (e) {
      $("endVideoHint").textContent = "Tap to play the final presentation";
    }
  });

  function skipToVideo(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    clearTimeout(holdT);
    holdT = null;
    waitingForLandscape = false;
    $("orientationWarning").classList.remove("visible");
    $("orientationWarning").setAttribute("aria-hidden", "true");
    $("hand").classList.remove("locked");
    playFrom(0);
  }
  $("skipT").addEventListener("click", skipToVideo);
  $("skipOverlay").addEventListener("click", skipToVideo);

  document.addEventListener("click", () => { if (state === "play" && vid.paused) vid.play().catch(() => {}); });
  $("restart").onclick = () => {
    if (++taps >= 3) { taps = 0; resetHand({ newRun: true }); }
    setTimeout(() => { taps = 0; }, 1500);
  };
  addEventListener("keydown", e => {
    if (!CONFIG.testMode) return;
    if (e.key === "t" && state === "hand") trigger();
    if (e.key === "r") resetHand({ newRun: true });
  });

  function enforceOrientationImpl() {
    const warning = $("orientationWarning");
    if (!warning) return;
    if (desktopPointer.matches) {
      warning.classList.remove("visible");
      warning.setAttribute("aria-hidden", "true");
      return;
    }
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const showWarning = (state === "hand" && !portrait) || (state === "scan" && waitingForLandscape);
    warning.classList.toggle("visible", showWarning);
    warning.setAttribute("aria-hidden", String(!showWarning));
    if (state === "hand") {
      $("orientationTitle").textContent = "PLEASE ROTATE YOUR iPAD";
      $("orientationMessage").textContent = "The hand scanner runs in portrait mode.";
      $("orientationHint").textContent = "Turn your iPad vertically to continue.";
    }
  }
  window.addEventListener("resize", enforceOrientationImpl, { passive: true });
  window.addEventListener("orientationchange", enforceOrientationImpl);
  screen.orientation?.addEventListener?.("change", enforceOrientationImpl);
  enforceOrientationImpl();

  sync.onMessage(msg => {
    if (msg.type === "projector-hello") {
      updateProjectorStatus(true);
      broadcastCurrentStage({ persist: true });
    } else if (msg.type === "projector-bye") {
      updateProjectorStatus(false);
    }
  });

  sync.send("stage", { runId: ceremonyRunId, stage: "prep" }, { persist: true });
  sync.send("operator-hello");
} else {
  /* ===== Legacy Two-Device Firebase Mode (?role=display or ?role=controller) ===== */
  (async () => {
    const [
      { initializeApp },
      { getAuth, signInAnonymously },
      { getDatabase, ref, set, onValue }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js")
    ]);

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
    const ROLE = LEGACY_FIREBASE_ROLE;

    async function publishStage(stage, videoIndex = 0) {
      const message = document.getElementById(ROLE === "display" ? "displayStatus" : "pmsg");
      if (!firebaseReady) {
        const detail = firebaseAuthError ? ` (${firebaseAuthError.code || "auth-error"}: ${firebaseAuthError.message})` : "";
        const text = "Firebase sign-in failed" + detail;
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
        if (message && ROLE === "controller" && stage === "waiting") {
          message.textContent = "Firebase connected ✓ Projector sync is ready.";
        }
        return true;
      } catch (error) {
        const detail = `${error.code || "database-error"}: ${error.message || "Unknown database error"}`;
        if (message) message.textContent = "DATABASE WRITE FAILED — " + detail;
        return false;
      }
    }

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
      const videos = CONFIG.videos;
      const finalSrc = FINAL_VIDEO;
      let armed = false;
      let pending = null;
      let activeRun = null;
      let playing = false;
      let displayStage = "waiting";
      let latestRemoteScan = null;
      let displayScanTimers = [];
      let scanAnimatingRunId = null;
      const displayScanLines = document.getElementById("slines");
      const displayFingerIndicators = [...document.querySelectorAll("#hand .fp")];
      const displayFingerCount = document.getElementById("cnt");

      function showStatus(message) { status.textContent = message; status.hidden = false; }
      function hideStatus() { status.hidden = true; }
      function setDisplayControls(mode) {
        panel.classList.toggle("video-playing", mode === "presentation" || mode === "end");
        const visible = armed && (mode === "scanning" || mode === "presentation");
        displayControls.hidden = !visible;
        displayControls.setAttribute("aria-hidden", String(!visible));
        skipScanButton.hidden = !visible || mode !== "scanning";
        skipDisplayVideoButton.hidden = !visible || mode !== "presentation";
        panel.classList.toggle("controls-active", visible);
      }
      function resetDisplayScanUI() {
        document.getElementById("hand")?.classList.remove("locked");
        renderFingerIndicators(displayFingerIndicators, displayFingerCount, [], 0);
        const mirrorButton = document.getElementById("bEnter");
        if (mirrorButton) {
          mirrorButton.classList.remove("projector-pressed");
          mirrorButton.textContent = "ENTER";
        }
      }
      function startProjectorScanAnimation() {
        if (scanAnimatingRunId === activeRun && document.getElementById("scan")?.classList.contains("on")) return;
        scanAnimatingRunId = activeRun;
        displayScanTimers.forEach(clearTimeout);
        displayScanTimers = [];
        document.getElementById("hand")?.classList.add("locked");
        renderFingerIndicators(displayFingerIndicators, displayFingerCount, ["confirmed", "confirmed", "confirmed", "confirmed", "confirmed"], 5);
        showScreen("scan");
        if (displayScanLines) displayScanLines.textContent = "SCANNING…";
        status.hidden = true;
        displayScanTimers.push(setTimeout(() => { if (displayScanLines) displayScanLines.textContent = "VERIFYING…"; }, 1400));
        displayScanTimers.push(setTimeout(() => { if (displayScanLines) displayScanLines.textContent = "ACCESS GRANTED"; }, 2800));
      }
      function renderRemoteScanStatus(data) {
        if (!data) return;
        latestRemoteScan = data;
        const hasActiveScan = data.phase === "verifying" || data.phase === "complete" || Number(data.count) > 0;
        if (displayStage !== "scanning") {
          const canAdoptScan =
            (data.runId === activeRun && (displayStage === "intro" || (displayStage === "waiting" && hasActiveScan))) ||
            (!activeRun && hasActiveScan);
          if (!canAdoptScan) return;
          activeRun = data.runId;
          displayStage = "scanning";
          playing = false;
          displayVideo.pause();
          finalVideo.pause();
          displayVideo.hidden = true;
          finalVideo.hidden = true;
          resetDisplayScanUI();
          showScreen("hand");
          setDisplayControls("scanning");
        } else if (data.runId !== activeRun) {
          if (!hasActiveScan) return;
          activeRun = data.runId;
          scanAnimatingRunId = null;
          resetDisplayScanUI();
        }
        if (data.phase === "complete") {
          startProjectorScanAnimation();
          return;
        }
        scanAnimatingRunId = null;
        document.getElementById("hand")?.classList.remove("locked");
        showScreen("hand");
        const states = Array.isArray(data.fingers) ? data.fingers : [];
        const count = Number(data.count) || 0;
        renderFingerIndicators(displayFingerIndicators, displayFingerCount, states, count);
        if (data.phase === "verifying") showStatus("Five fingers detected — verifying…");
        else showStatus("LIVE SCAN — " + count + " / 5 fingers detected");
      }
      async function reportIntroFinished(runId) {
        try {
          await set(ceremonyRef, { stage: "introFinished", videoIndex: 0, runId, updatedAt: Date.now(), source: "display", project: firebaseConfig.projectId });
        } catch (error) {
          showStatus("Intro finished, but the iPad could not be notified.");
        }
      }
      async function playIntro(runId) {
        if (!armed || runId !== activeRun) return;
        showScreen(null);
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
        displayVideo.onerror = () => showStatus("INTRO VIDEO FAILED TO LOAD — check images/intro.mp4");
        displayVideo.src = introSrc;
        displayVideo.load();
        try { await displayVideo.play(); hideStatus(); } catch (error) { showStatus("Tap the screen to start the intro video"); }
      }
      async function playFinal() {
        displayStage = "end";
        playing = true;
        pending = { stage: "end", runId: activeRun };
        hideStatus();
        showScreen(null);
        displayVideo.pause();
        displayVideo.hidden = true;
        finalVideo.hidden = false;
        if (activeRun) {
          set(ceremonyRef, { stage: "end", videoIndex: videos.length, runId: activeRun, updatedAt: Date.now(), source: "display", project: firebaseConfig.projectId }).catch(() => {});
        }
        finalVideo.onended = () => finalVideo.pause();
        finalVideo.onerror = () => showStatus("FINAL VIDEO FAILED TO LOAD");
        finalVideo.src = finalSrc;
        finalVideo.onloadedmetadata = async () => {
          const startAt = Math.min(1, Math.max(0, finalVideo.duration - 0.25));
          try { finalVideo.currentTime = startAt; } catch (error) {}
          try { await finalVideo.play(); hideStatus(); } catch (error) { showStatus("Tap the screen to start the final presentation"); }
        };
        finalVideo.load();
      }
      async function playVideo(index, runId) {
        if (!armed || runId !== activeRun) return;
        if (index >= videos.length) { setDisplayControls("end"); return playFinal(); }
        setDisplayControls("presentation");
        hideStatus();
        playing = true;
        pending = { stage: "presentation", videoIndex: index, runId };
        finalVideo.pause();
        finalVideo.hidden = true;
        displayVideo.hidden = false;
        displayVideo.onended = () => playVideo(index + 1, runId);
        displayVideo.onerror = () => showStatus("MONTAGE VIDEO FAILED TO LOAD");
        displayVideo.src = videos[index];
        displayVideo.load();
        try { await displayVideo.play(); hideStatus(); } catch (error) { showStatus("Tap the screen to resume the montage"); }
      }
      function handleStage(data) {
        if (!data) { showStatus("Waiting for the iPad controller…"); return; }
        if (data.stage === "waiting") {
          displayStage = "waiting";
          latestRemoteScan = null;
          scanAnimatingRunId = null;
          displayScanTimers.forEach(clearTimeout);
          displayScanTimers = [];
          activeRun = data.runId;
          pending = null;
          playing = false;
          displayVideo.pause();
          finalVideo.pause();
          displayVideo.hidden = true;
          finalVideo.hidden = true;
          resetDisplayScanUI();
          showScreen("prep");
          setDisplayControls("waiting");
          showStatus("Waiting for the iPad controller…");
          return;
        }
        if (data.stage === "intro") {
          displayStage = "intro";
          scanAnimatingRunId = null;
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
        if (data.stage === "introFinished" && data.runId === activeRun) {
          displayStage = "scanning";
          scanAnimatingRunId = null;
          resetDisplayScanUI();
          showScreen("hand");
          playing = false;
          displayVideo.pause();
          displayVideo.hidden = true;
          setDisplayControls("scanning");
          if (latestRemoteScan?.runId === activeRun) renderRemoteScanStatus(latestRemoteScan);
          else showStatus("Five-finger scan in progress on the iPad…");
          return;
        }
        if (data.stage === "scanning") {
          displayStage = "scanning";
          if (data.runId !== activeRun) {
            activeRun = data.runId;
            latestRemoteScan = null;
            scanAnimatingRunId = null;
            displayScanTimers.forEach(clearTimeout);
            displayScanTimers = [];
            playing = false;
            displayVideo.pause();
            finalVideo.pause();
            displayVideo.hidden = true;
            finalVideo.hidden = true;
            resetDisplayScanUI();
          }
          setDisplayControls("scanning");
          if (latestRemoteScan?.runId === activeRun) renderRemoteScanStatus(latestRemoteScan);
          else {
            document.getElementById("hand")?.classList.remove("locked");
            showScreen("hand");
            showStatus("LIVE SCAN — waiting for fingers…");
          }
          return;
        }
        if (data.stage === "presentation") {
          displayStage = "presentation";
          setDisplayControls("presentation");
          if (data.runId !== activeRun || !playing) {
            showScreen(null);
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
        try { await set(projectorReadyRef, { ready: true, updatedAt: Date.now() }); } catch (error) { return; }
        armed = true;
        gate.hidden = true;
        if (pending && pending.stage === "intro") playIntro(pending.runId);
        else if (pending && pending.stage === "presentation") playVideo(Number(pending.videoIndex || 0), pending.runId);
        else if (!playing) showStatus("Projector connected. Waiting for the iPad…");
      });
      panel.addEventListener("click", () => {
        if (!armed || !displayVideo.paused || !finalVideo.paused) return;
        if (pending && pending.stage === "intro") playIntro(pending.runId);
        else if (pending && (pending.stage === "presentation" || pending.stage === "end")) {
          if (finalVideo.hidden) playVideo(Number(pending.videoIndex || 0), pending.runId);
          else finalVideo.play().catch(() => showStatus("Tap again to play the final presentation"));
        }
      });
      if (!firebaseReady) {
        showStatus("Firebase sign-in failed.");
        enable.disabled = true;
      } else {
        set(projectorReadyRef, { ready: false, updatedAt: Date.now() }).catch(() => {});
        onValue(ceremonyRef, snapshot => handleStage(snapshot.val()));
        onValue(scanStatusRef, snapshot => renderRemoteScanStatus(snapshot.val()));
      }
    } else {
      const $ = id => document.getElementById(id);
      const vid = $("vid"), intro = $("intro"), scanSound = $("scanSound");
      const pads = [...document.querySelectorAll(".pad")], fps = [...document.querySelectorAll(".fp")];
      let prevOn = new Set(), state = "prep", urls = CONFIG.videos.slice(), holdT = null, taps = 0;
      let currentVideoIndex = 0, lastScanSignature = "", finalVideoStarted = false;
      const endVideo = $("endVideo");
      const setFp = (i, cls, txt) => { fps[i].classList.remove("ok", "err"); if (cls) fps[i].classList.add(cls); fps[i].querySelector(".lbl").textContent = txt; };
      const publishLiveScan = (fingers, phase = "scanning") => {
        if (!firebaseReady) return;
        const count = fingers.filter(v => v === "confirmed").length;
        const sig = `${ceremonyRunId}|${phase}|${fingers.join(",")}`;
        if (sig === lastScanSignature) return;
        lastScanSignature = sig;
        set(scanStatusRef, { runId: ceremonyRunId, fingers, count, phase, updatedAt: Date.now(), source: "controller" }).catch(() => {});
      };
      $("bEnter").onclick = async () => {
        if (state !== "prep" || $("bEnter").disabled) return;
        $("bEnter").disabled = true;
        $("bEnter").textContent = "INTRO PLAYING ON PROJECTOR";
        state = "intro";
        $("pmsg").textContent = "Playing intro on projector…";
        await publishStage("intro");
      };
      function resetHand({ newRun = false } = {}) {
        lastScanSignature = "";
        if (newRun) ceremonyRunId = Date.now();
        publishStage("scanning");
        publishLiveScan(["waiting", "waiting", "waiting", "waiting", "waiting"], "scanning");
        finalVideoStarted = false;
        endVideo.pause();
        $("end").classList.remove("video-active");
        $("hand").classList.remove("locked");
        prevOn = new Set();
        fps.forEach((f, i) => setFp(i, "", "Waiting…"));
        $("cnt").textContent = "0 / 5";
        state = "hand";
        showScreen("hand");
      }
      function evalTouches(touches) {
        const c = pads.map(p => { const b = p.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 }; });
        const on = new Set();
        [...touches].forEach(t => {
          let best = 0, bd = 1e9;
          c.forEach((p, i) => { const d = Math.hypot(t.clientX - p.x, t.clientY - p.y); if (d < bd) { bd = d; best = i; } });
          if (bd < c[best].r * CONFIG.tolerance) on.add(best);
        });
        fps.forEach((f, i) => { if (on.has(i)) setFp(i, "ok", "Confirmed"); else if (prevOn.has(i)) setFp(i, "err", "Not detected"); });
        prevOn = on;
        $("cnt").textContent = `${on.size} / 5`;
        const liveStates = pads.map((_, i) => (on.has(i) ? "confirmed" : fps[i].classList.contains("err") ? "failed" : "waiting"));
        publishLiveScan(liveStates, on.size === 5 ? "verifying" : "scanning");
        if (on.size === 5) { if (!holdT) holdT = setTimeout(() => { state = "scan"; publishLiveScan(["confirmed", "confirmed", "confirmed", "confirmed", "confirmed"], "complete"); publishStage("scanning"); showScreen("scan"); }, CONFIG.holdMs); }
        else { clearTimeout(holdT); holdT = null; }
      }
      ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(ev =>
        document.addEventListener(ev, e => { if (state !== "hand" || e.target.closest?.("button")) return; e.preventDefault(); evalTouches(e.touches); }, { passive: false })
      );
      $("restart").onclick = () => { if (++taps >= 3) { taps = 0; resetHand({ newRun: true }); } setTimeout(() => { taps = 0; }, 1500); };
      if (firebaseReady) {
        $("bEnter").disabled = true;
        onValue(projectorReadyRef, s => { const ready = s.val() === true || s.val()?.ready === true; $("bEnter").disabled = !ready; if (ready && state === "prep") $("pmsg").textContent = "Projector ready ✓"; });
        publishStage("waiting");
        onValue(ceremonyRef, s => {
          const d = s.val();
          if (!d || d.runId !== ceremonyRunId) return;
          if (d.stage === "introFinished" && state === "intro") resetHand();
          else if (d.stage === "presentation" && d.source === "display") { state = "play"; showScreen("end"); $("endVideoHint").textContent = "Presentation playing on projector…"; }
          else if (d.stage === "end" && d.source === "display") { state = "end"; $("endVideoHint").textContent = ""; }
        });
      }
    }
  })();
}
