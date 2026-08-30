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
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.35;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    audioGraphReady = true;
  }

  function startMusicReaction() {
    if (!analyser || reactionFrame) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    const previousBins = new Uint8Array(analyser.frequencyBinCount);

    // We only inspect the musical bass/kick region instead of averaging all
    // of the lowest FFT bins. That prevents a constant bass line from holding
    // the image in a permanently "pushed" state.
    const hzPerBin = audioContext.sampleRate / analyser.fftSize;
    const bassStartBin = Math.max(1, Math.floor(45 / hzPerBin));
    const bassEndBin = Math.min(
      analyser.frequencyBinCount - 1,
      Math.ceil(180 / hzPerBin)
    );

    let energyAverage = 0.10;
    let fluxAverage = 0.012;
    let pulse = 0;
    let lastBeatAt = -Infinity;
    let lastFrameAt = performance.now();
    let warmupFrames = 0;

    function frame(now) {
      analyser.getByteFrequencyData(bins);

      let squaredEnergy = 0;
      let positiveFlux = 0;
      const count = Math.max(1, bassEndBin - bassStartBin + 1);

      for (let i = bassStartBin; i <= bassEndBin; i++) {
        const current = bins[i] / 255;
        const previous = previousBins[i] / 255;

        squaredEnergy += current * current;
        positiveFlux += Math.max(0, current - previous);
        previousBins[i] = bins[i];
      }

      const energy = Math.sqrt(squaredEnergy / count);
      const flux = positiveFlux / count;

      const dt = Math.min(50, Math.max(8, now - lastFrameAt));
      lastFrameAt = now;

      // Fast attack, natural decay. The pulse always falls back to zero even
      // when the song contains a continuous bass note.
      pulse *= Math.exp(-dt / 155);

      if (warmupFrames < 14) {
        energyAverage += (energy - energyAverage) * 0.18;
        fluxAverage += (flux - fluxAverage) * 0.18;
        warmupFrames += 1;
      } else {
        const fluxRatio = flux / Math.max(0.004, fluxAverage);
        const energyRatio = energy / Math.max(0.055, energyAverage);

        const transientEnough = fluxRatio > 1.55;
        const bassEnough = energy > 0.075 && energyRatio > 1.025;
        const cooldownPassed = (now - lastBeatAt) > 125;

        if (transientEnough && bassEnough && cooldownPassed) {
          const transientStrength = clamp01((fluxRatio - 1.55) / 2.25);
          const energyStrength = clamp01((energyRatio - 1.025) / 0.42);
          const beatStrength = clamp01(
            0.34 + transientStrength * 0.48 + energyStrength * 0.34
          );

          pulse = Math.max(pulse, beatStrength);
          lastBeatAt = now;
        }

        // Adaptive baselines follow the song slowly. They are deliberately
        // slower than an individual kick, which is what makes transients pop.
        fluxAverage += (flux - fluxAverage) * 0.045;
        energyAverage += (energy - energyAverage) * 0.022;
      }

      // Cinematic rather than equalizer-like: a small camera punch from the
      // moon area, a tiny warmth lift, and a restrained star/glow response.
      const shaped = Math.pow(clamp01(pulse), 0.82);
      const scale = 1 + shaped * 0.0125;
      const brightness = 1 + shaped * 0.042;
      const saturate = 1 + shaped * 0.052;
      const starBrightness = 1 + shaped * 0.12;
      const glow = shaped * 0.145;

      const root = document.documentElement.style;
      root.setProperty("--bass-scale", scale.toFixed(4));
      root.setProperty("--bass-brightness", brightness.toFixed(3));
      root.setProperty("--bass-saturate", saturate.toFixed(3));
      root.setProperty("--bass-star-brightness", starBrightness.toFixed(3));
      root.setProperty("--bass-glow", glow.toFixed(3));

      reactionFrame = requestAnimationFrame(frame);
    }

    reactionFrame = requestAnimationFrame(frame);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
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
