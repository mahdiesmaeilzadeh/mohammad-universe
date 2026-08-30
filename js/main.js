console.log("Mohammad Universe v7 track-synced bass map loaded");

document.addEventListener("DOMContentLoaded", function () {
  const introScene = document.getElementById("introScene");
  const transitionScene = document.getElementById("transitionScene");
  const skyScene = document.getElementById("skyScene");
  const transitionCopy = document.getElementById("transitionCopy");
  const enterUniverseBtn = document.getElementById("enterUniverseBtn");
  const revealMusicBtn = document.getElementById("revealMusicBtn");
  const skySurprise = document.getElementById("skySurprise");
  const musicPanel = document.getElementById("musicPanel");
  const closeMusicBtn = document.getElementById("closeMusicBtn");

  const mainSong = document.getElementById("mainSong");
  const playSongBtn = document.getElementById("playSongBtn");
  const songProgress = document.getElementById("songProgress");
  const currentTimeEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("duration");

  createStars(document.querySelector(".intro-stars"), 120, "white");
  createStars(document.querySelector(".transition-stars"), 80, "white");
  createStars(document.querySelector(".dynamic-stars"), 72, "orange");

  let firstSongStart = true;
  let audioContext = null;

  // This song now uses a precomputed kick/bass map generated from the actual
  // uploaded Hayede.mp3. No live FFT guessing = no false visual punches on
  // vocals, sustained bass notes, or unrelated low-frequency content.
  const bassHits = Array.isArray(window.MOHAMMAD_BASS_HITS)
    ? window.MOHAMMAD_BASS_HITS
    : [];
  const skyVisualEl = document.querySelector(".sky-visual");
  let beatMapFrame = null;
  let beatMapIndex = 0;
  let lastSongTime = 0;
  let hitCleanupTimer = null;

  enterUniverseBtn.addEventListener("click", async function () {
    // A user gesture is available here, so initialise/resume Web Audio now.
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      try { await audioContext.resume(); } catch (e) {}
    }

    switchScene(introScene, transitionScene);

    await runCinematicPhrase([
      "On the night",
      "you were",
      "born..."
    ]);

    await pause(760);

    await runCinematicPhrase([
      "the universe",
      "painted a sky",
      "like this."
    ]);

    // Let the copy disappear first, then fade the entire background to pure black.
    await pause(520);
    transitionScene.classList.add("blackout");
    await pause(1450);

    // Enter the sky scene while it is still black.
    switchScene(transitionScene, skyScene);
    await pause(180);

    // Start the first bell exactly as the moon/stars begin to fade in.
    playShineSound(audioContext);
    skyScene.classList.add("sky-revealed");
    transitionScene.classList.remove("blackout");

    await pause(3900);
    skySurprise.classList.add("visible");
  });

  revealMusicBtn.addEventListener("click", function () {
    musicPanel.classList.add("open");
  });

  closeMusicBtn.addEventListener("click", function () {
    musicPanel.classList.remove("open");
  });

  playSongBtn.addEventListener("click", async function () {
    if (mainSong.paused) {
      const isFirstStart = firstSongStart;


      try {
        if (isFirstStart) {
          mainSong.volume = 0;
        }

        await mainSong.play();
        playSongBtn.textContent = "❚❚";
        startBeatMapReaction();

        if (isFirstStart) {
          firstSongStart = false;
          fadeMediaVolume(mainSong, 0, 1, 1150);
        }
      } catch (error) {
        console.error("Could not play main song:", error);
      }
    } else {
      mainSong.pause();
      playSongBtn.textContent = "▶";
      stopBeatMapReaction();
    }
  });

  mainSong.addEventListener("loadedmetadata", function () {
    durationEl.textContent = formatTime(mainSong.duration);
  });

  mainSong.addEventListener("timeupdate", function () {
    if (!mainSong.duration) return;
    songProgress.value = (mainSong.currentTime / mainSong.duration) * 100;
    currentTimeEl.textContent = formatTime(mainSong.currentTime);
  });

  mainSong.addEventListener("ended", function () {
    playSongBtn.textContent = "▶";
    songProgress.value = 0;
    stopBeatMapReaction();
  });

  songProgress.addEventListener("input", function () {
    if (!mainSong.duration) return;
    mainSong.currentTime = (Number(songProgress.value) / 100) * mainSong.duration;
    syncBeatMapToCurrentTime();
  });

  mainSong.addEventListener("seeked", function () {
    syncBeatMapToCurrentTime();
  });

  function syncBeatMapToCurrentTime() {
    const target = Math.max(0, mainSong.currentTime - 0.06);
    let lo = 0;
    let hi = bassHits.length;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bassHits[mid].t < target) lo = mid + 1;
      else hi = mid;
    }

    beatMapIndex = lo;
    lastSongTime = mainSong.currentTime;
  }

  function startBeatMapReaction() {
    if (!bassHits.length || beatMapFrame) return;

    syncBeatMapToCurrentTime();
    const leadSeconds = 0.030;

    function frame() {
      if (mainSong.paused || mainSong.ended) {
        beatMapFrame = null;
        return;
      }

      const now = mainSong.currentTime;

      // If the user seeks or the browser makes a large playback jump, reset
      // the pointer so an old hit can never fire at the wrong time.
      if (now < lastSongTime - 0.12 || now > lastSongTime + 0.45) {
        syncBeatMapToCurrentTime();
      }

      while (beatMapIndex < bassHits.length && bassHits[beatMapIndex].t <= now + leadSeconds) {
        const hit = bassHits[beatMapIndex];

        // Only trigger if this frame is genuinely close to the mapped kick.
        // This protects against late frames after backgrounding / lag.
        if (hit.t >= now - 0.105) {
          triggerMappedBassHit(hit.s);
        }

        beatMapIndex += 1;
      }

      lastSongTime = now;
      beatMapFrame = requestAnimationFrame(frame);
    }

    beatMapFrame = requestAnimationFrame(frame);
  }

  function triggerMappedBassHit(strength) {
    if (!skyVisualEl) return;

    const s = Math.max(0.45, Math.min(1, Number(strength) || 0.65));

    // Keep the punch restrained: roughly 0.8% to 1.25% at the peak.
    // Stronger mapped kicks get slightly more warmth/glow, not a cartoon zoom.
    skyVisualEl.style.setProperty("--hit-scale", (1.006 + s * 0.0065).toFixed(4));
    skyVisualEl.style.setProperty("--hit-brightness", (1.018 + s * 0.030).toFixed(3));
    skyVisualEl.style.setProperty("--hit-saturate", (1.018 + s * 0.038).toFixed(3));
    skyVisualEl.style.setProperty("--hit-star-brightness", (1.04 + s * 0.10).toFixed(3));
    skyVisualEl.style.setProperty("--hit-glow", (0.045 + s * 0.105).toFixed(3));

    // Restart the short CSS animation even if hits occur close together.
    skyVisualEl.classList.remove("bass-hit");
    void skyVisualEl.offsetWidth;
    skyVisualEl.classList.add("bass-hit");

    if (hitCleanupTimer) clearTimeout(hitCleanupTimer);
    hitCleanupTimer = setTimeout(function () {
      skyVisualEl.classList.remove("bass-hit");
    }, 390);
  }

  function stopBeatMapReaction() {
    if (beatMapFrame) {
      cancelAnimationFrame(beatMapFrame);
      beatMapFrame = null;
    }

    if (hitCleanupTimer) {
      clearTimeout(hitCleanupTimer);
      hitCleanupTimer = null;
    }

    if (skyVisualEl) {
      skyVisualEl.classList.remove("bass-hit");
    }
  }

  async function runCinematicPhrase(lines) {
    transitionCopy.className = "transition-copy";
    transitionCopy.innerHTML = "";

    lines.forEach(function (line) {
      const el = document.createElement("div");
      el.className = "transition-line";
      el.textContent = line;
      transitionCopy.appendChild(el);
    });

    const lineEls = Array.from(transitionCopy.querySelectorAll(".transition-line"));

    for (let i = 0; i < lineEls.length; i++) {
      lineEls[i].classList.add("show");
      await pause(1080);
    }

    await pause(1250);
    transitionCopy.classList.add("fade-out");
    await pause(1080);
  }

  function switchScene(from, to) {
    from.classList.remove("active");
    to.classList.add("active");
  }
});

function createStars(container, count, tone) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";

    const size = Math.random() * 2.7 + .7;
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.left = (Math.random() * 100) + "%";
    star.style.top = (Math.random() * 100) + "%";
    star.style.animationDelay = (Math.random() * 3) + "s";
    star.style.animationDuration = (2.3 + Math.random() * 2.2) + "s";

    if (tone === "orange") {
      star.style.opacity = (.28 + Math.random() * .55).toFixed(2);
    }

    container.appendChild(star);
  }
}

function fadeMediaVolume(media, from, to, durationMs) {
  const startedAt = performance.now();
  media.volume = Math.max(0, Math.min(1, from));

  function step(now) {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    media.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return mins + ":" + secs;
}

function pause(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
function playShineSound(ctx) {

    if (!ctx) return;

    const now = ctx.currentTime;

    const master = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();

    master.gain.value = 0.32;

    delay.delayTime.value = 0.14;
    feedback.gain.value = 0.22;
    wet.gain.value = 0.22;

    master.connect(ctx.destination);

    master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);


    const notes = [
        { frequency: 1046.5, time: 0 },
        { frequency: 1568.0, time: 0.11 },
        { frequency: 2093.0, time: 0.23 }
    ];


    notes.forEach(function (note) {

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = note.frequency;

        gain.gain.setValueAtTime(
            0.0001,
            now + note.time
        );

        gain.gain.exponentialRampToValueAtTime(
            0.13,
            now + note.time + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + note.time + 1.15
        );

        osc.connect(gain);
        gain.connect(master);

        osc.start(now + note.time);
        osc.stop(now + note.time + 1.2);

    });
}

