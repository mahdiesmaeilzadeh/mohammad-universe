console.log("Mohammad Universe v5 audio + bass debug loaded");

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

  let ambient = null;
  let ambientPermanentlyStopped = false;
  let firstSongStart = true;
  let audioGraphReady = false;
  let analyser = null;
  let audioContext = null;
  let sourceNode = null;
  let reactionFrame = null;

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
    if (!ambientPermanentlyStopped) {
      ambient = startStarAmbience(audioContext);
    }
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

      if (!ambientPermanentlyStopped) {
        ambientPermanentlyStopped = true;
        if (ambient) ambient.fadeOutAndStop(1.15);
      }

      try {
        await setupSongAudioGraph();

        if (isFirstStart) {
          mainSong.volume = 0;
        }

        await mainSong.play();
        playSongBtn.textContent = "❚❚";
        startMusicReaction();

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
      stopMusicReaction();
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
    stopMusicReaction();
  });

  songProgress.addEventListener("input", function () {
    if (!mainSong.duration) return;
    mainSong.currentTime = (Number(songProgress.value) / 100) * mainSong.duration;
  });

  async function setupSongAudioGraph() {
    if (audioGraphReady) return;
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(mainSong);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    audioGraphReady = true;
  }

  function startMusicReaction() {
    if (!analyser || reactionFrame) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    let envelope = 0;

    function frame() {
      analyser.getByteFrequencyData(bins);

      // Focus on low frequencies, then gate background energy so only real kicks/bass
      // produce visible motion. This keeps the scene cinematic rather than "visualizer-like".
      let sum = 0;
      const end = Math.min(16, bins.length);
      for (let i = 1; i < end; i++) sum += bins[i];
      const rawBass = sum / ((end - 1) * 255);

      const gated = Math.max(0, Math.min(1, (rawBass - 0.085) / 0.40));
      const target = Math.pow(gated, 1.22);
      const response = target > envelope ? 0.34 : 0.095;
      envelope += (target - envelope) * response;

      // Max zoom is about 1.05%, with a restrained warm light pulse.
      const scale = 1 + envelope * 0.0105;
      const brightness = 1 + envelope * 0.060;
      const saturate = 1 + envelope * 0.075;
      const starBrightness = 1 + envelope * 0.16;
      const glow = envelope * 0.18;

      const root = document.documentElement.style;
      root.setProperty("--bass-scale", scale.toFixed(4));
      root.setProperty("--bass-brightness", brightness.toFixed(3));
      root.setProperty("--bass-saturate", saturate.toFixed(3));
      root.setProperty("--bass-star-brightness", starBrightness.toFixed(3));
      root.setProperty("--bass-glow", glow.toFixed(3));

      reactionFrame = requestAnimationFrame(frame);
    }

    frame();
  }

  function stopMusicReaction() {
    if (reactionFrame) {
      cancelAnimationFrame(reactionFrame);
      reactionFrame = null;
    }

    const root = document.documentElement.style;
    root.setProperty("--bass-scale", "1");
    root.setProperty("--bass-brightness", "1");
    root.setProperty("--bass-saturate", "1");
    root.setProperty("--bass-star-brightness", "1");
    root.setProperty("--bass-glow", "0");
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

function startStarAmbience(ctx) {
  if (!ctx) return null;

  const master = ctx.createGain();
  const padGain = ctx.createGain();
  const padFilter = ctx.createBiquadFilter();
  const pad1 = ctx.createOscillator();
  const pad2 = ctx.createOscillator();

  let stopped = false;
  let timer = null;

  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.72, ctx.currentTime + 0.75);
  master.connect(ctx.destination);

  // Barely audible atmospheric bed underneath the "diring-diring" bells.
  padFilter.type = "lowpass";
  padFilter.frequency.value = 480;
  padFilter.Q.value = 0.55;

  padGain.gain.value = 0.018;
  pad1.type = "sine";
  pad2.type = "triangle";
  pad1.frequency.value = 65.41;  // C2
  pad2.frequency.value = 98.00;  // G2-ish

  pad1.connect(padFilter);
  pad2.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(master);

  pad1.start();
  pad2.start();

  const bellNotes = [523.25, 659.25, 783.99, 880.00, 1046.50, 1174.66];

  function bell(frequency, when, level) {
    if (stopped) return;

    const gain = ctx.createGain();
    const tone = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;

    tone.type = "sine";
    overtone.type = "sine";
    tone.frequency.setValueAtTime(frequency, when);
    overtone.frequency.setValueAtTime(frequency * 2.01, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.55);

    tone.connect(gain);
    overtone.connect(gain);

    if (panner) {
      panner.pan.value = Math.random() * 1.1 - 0.55;
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }

    tone.start(when);
    overtone.start(when);
    tone.stop(when + 1.65);
    overtone.stop(when + 1.65);
  }

  function sparklePair(immediate) {
    if (stopped) return;
    const now = ctx.currentTime + (immediate ? 0.035 : 0.01);
    const idx = Math.floor(Math.random() * bellNotes.length);
    const first = bellNotes[idx];
    const second = bellNotes[(idx + 2) % bellNotes.length];

    bell(first, now, 0.032);
    bell(second, now + 0.26 + Math.random() * 0.13, 0.021);
  }

  function scheduleNext() {
    if (stopped) return;
    const delay = 1700 + Math.random() * 1900;
    timer = setTimeout(function () {
      sparklePair(false);
      scheduleNext();
    }, delay);
  }

  // The very first "diring-diring" lands right on the sky reveal.
  sparklePair(true);
  scheduleNext();

  return {
    fadeOutAndStop: function (seconds) {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);

      const now = ctx.currentTime;
      const end = now + seconds;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, end);

      setTimeout(function () {
        try { pad1.stop(); } catch (e) {}
        try { pad2.stop(); } catch (e) {}
        try { master.disconnect(); } catch (e) {}
      }, seconds * 1000 + 120);
    }
  };
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
