console.log("Mohammad Universe v7 loaded");

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

    // One-time longer shine/chime, timed exactly with the sky reveal.
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
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.18;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    audioGraphReady = true;
  }

  function startMusicReaction() {
    if (!analyser || reactionFrame) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    const hzPerBin = audioContext.sampleRate / analyser.fftSize;

    // Kick/sub-bass area only. Keeping this narrow prevents vocals,
    // snares and bright percussion from causing fake "bass" pulses.
    const bassStartBin = Math.max(1, Math.floor(40 / hzPerBin));
    const bassEndBin = Math.min(
      analyser.frequencyBinCount - 1,
      Math.ceil(140 / hzPerBin)
    );

    let envelope = 0;
    let previousEnvelope = 0;
    let loudnessFloor = 0.10;
    let attackAverage = 0.010;
    let lastBeatAt = -Infinity;
    let lastFrameAt = performance.now();
    let pulse = 0;

    // Let the detector hear a short piece of the song before it starts
    // deciding what counts as an unusual bass attack.
    const readyAt = performance.now() + 550;

    function getBassEnergy() {
      let energy = 0;
      let weightTotal = 0;

      for (let i = bassStartBin; i <= bassEndBin; i++) {
        const value = bins[i] / 255;
        const hz = i * hzPerBin;

        // Most kick fundamentals live around 55-105 Hz.
        let weight = 1;
        if (hz >= 55 && hz <= 105) {
          weight = 1.45;
        } else if (hz > 105) {
          weight = 0.72;
        }

        energy += value * value * weight;
        weightTotal += weight;
      }

      return Math.sqrt(energy / Math.max(1, weightTotal));
    }

    function frame(now) {
      analyser.getByteFrequencyData(bins);

      const rawBass = getBassEnergy();

      // Envelope follower. Fast enough to capture the front edge of a kick,
      // slow enough that tiny FFT changes do not look like beats.
      const envelopeSpeed = rawBass > envelope ? 0.62 : 0.16;
      envelope += (rawBass - envelope) * envelopeSpeed;

      const attack = Math.max(0, envelope - previousEnvelope);
      previousEnvelope = envelope;

      const dt = Math.min(50, Math.max(8, now - lastFrameAt));
      lastFrameAt = now;

      // Visual punch dies quickly after every hit.
      pulse *= Math.exp(-dt / 145);

      // Slowly track overall bass loudness and the normal amount of movement.
      loudnessFloor += (envelope - loudnessFloor) * 0.010;

      const attackThreshold = Math.max(
        0.022,
        attackAverage * 1.65
      );

      const enoughBass =
        envelope > Math.max(0.12, loudnessFloor * 0.76);

      const realAttack = attack > attackThreshold;
      const cooldownPassed = (now - lastBeatAt) > 320;

      if (
        now >= readyAt &&
        enoughBass &&
        realAttack &&
        cooldownPassed
      ) {
        // Strength is based on how sharp the bass hit was, not how long
        // the bass note stays loud.
        const strength = clamp01(
          0.50 +
          ((attack - attackThreshold) / 0.095) * 0.50
        );

        pulse = Math.max(pulse, strength);
        lastBeatAt = now;
      }

      // Update this after detection so the current kick cannot raise its own
      // threshold before being evaluated.
      attackAverage += (attack - attackAverage) * 0.020;

      // One quick camera punch centered around the moon. No permanent zoom.
      const shaped = Math.pow(clamp01(pulse), 0.82);
      const scale = 1 + shaped * 0.0125;
      const brightness = 1 + shaped * 0.036;
      const saturate = 1 + shaped * 0.035;
      const starBrightness = 1 + shaped * 0.095;
      const glow = shaped * 0.11;

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

function playShineSound(ctx) {
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  const dry = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  const highpass = ctx.createBiquadFilter();

  // One reveal effect only: about 3.5 seconds, no loop/ambient bed.
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.72, now + 0.06);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);

  dry.gain.value = 0.42;
  wet.gain.value = 0.24;
  delay.delayTime.value = 0.19;
  feedback.gain.value = 0.28;

  highpass.type = "highpass";
  highpass.frequency.value = 760;
  highpass.Q.value = 0.45;

  master.connect(dry);
  dry.connect(ctx.destination);

  master.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(highpass);
  highpass.connect(wet);
  wet.connect(ctx.destination);

  // Rising glassy chimes: "shine", not a short single ding.
  const notes = [
    { f: 783.99,  t: 0.00, level: 0.11,  decay: 2.55 },
    { f: 1046.50, t: 0.18, level: 0.10,  decay: 2.65 },
    { f: 1318.51, t: 0.39, level: 0.085, decay: 2.70 },
    { f: 1567.98, t: 0.68, level: 0.070, decay: 2.65 },
    { f: 2093.00, t: 1.02, level: 0.050, decay: 2.30 }
  ];

  notes.forEach(function (note, index) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === "function"
      ? ctx.createStereoPanner()
      : null;

    osc.type = "sine";
    overtone.type = "sine";
    osc.frequency.setValueAtTime(note.f, now + note.t);
    overtone.frequency.setValueAtTime(note.f * 2.003, now + note.t);

    gain.gain.setValueAtTime(0.0001, now + note.t);
    gain.gain.exponentialRampToValueAtTime(
      note.level,
      now + note.t + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + note.t + note.decay
    );

    osc.connect(gain);
    overtone.connect(gain);

    if (panner) {
      panner.pan.value = -0.45 + index * 0.22;
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }

    osc.start(now + note.t);
    overtone.start(now + note.t);
    osc.stop(now + note.t + note.decay + 0.1);
    overtone.stop(now + note.t + note.decay + 0.1);
  });

  // Soft high-frequency sparkle tail.
  const bufferLength = Math.floor(ctx.sampleRate * 2.7);
  const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferLength; i++) {
    noiseData[i] =
      (Math.random() * 2 - 1) *
      Math.exp(-i / (bufferLength * 0.28));
  }

  const noise = ctx.createBufferSource();
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();

  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 5200;
  noiseFilter.Q.value = 1.1;

  noiseGain.gain.setValueAtTime(0.0001, now + 0.12);
  noiseGain.gain.exponentialRampToValueAtTime(0.018, now + 0.42);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);

  noise.buffer = noiseBuffer;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  noise.start(now + 0.12);
  noise.stop(now + 2.85);

  setTimeout(function () {
    try { master.disconnect(); } catch (e) {}
  }, 3900);
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
