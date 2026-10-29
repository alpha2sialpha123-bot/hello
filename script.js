(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("matrix"), ctx = canvas.getContext("2d");
  let drops = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drops = Array(Math.ceil(innerWidth / 16)).fill(0).map(() => Math.random() * -30);
  }
  function draw() {
    ctx.fillStyle = "rgba(1,7,4,.13)"; ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.font = "13px monospace";
    drops.forEach((y,i) => {
      ctx.fillStyle = Math.random() > .97 ? "#c2ffdc" : "#00b85d";
      ctx.fillText(String.fromCharCode(0x30A0 + Math.random()*96), i*16, y*16);
      if (y*16 > innerHeight && Math.random() > .97) drops[i] = 0;
      drops[i] += .65 + Math.random()*.6;
    });
    requestAnimationFrame(draw);
  }
  resize(); draw(); addEventListener("resize", resize);

  const terminal = $("terminal");
  const fileRows = [...document.querySelectorAll(".file-row")];
  let audioCtx = null, soundEnabled = false, unlocked = false, started = false;
  let alarmActive = false;
  const finalAlarm = $("finalAlarm");
  const lines = [
    ["تهيئة واجهة الفحص الافتراضية...", ""],
    ["جارٍ تشغيل الماسح البصري...", "good"],
    ["تحليل مؤشرات الواجهة...", ""],
    ["إنشاء اتصال تجريبي مشفّر...", "good"],
    ["جارٍ فحص البنية الافتراضية...", ""],
    ["تم العثور على حزم بيانات تجريبية", "warn"],
    ["جارٍ تجهيز عملية النقل المرئي...", ""],
    ["تنبيه: نشاط رقمي غير معتاد", "warn"],
    ["جارٍ التحقق من الحزم...", ""],
    ["اكتملت مراحل المحاكاة", "good"]
  ];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function initAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    unlocked = true;
    return true;
  }
  function tone(freq=700, duration=.12, type="sine", volume=.045, endFreq=null, delay=0) {
    if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + duration + .03);
  }
  function scanSound() {
    // Brighter, more audible synthetic scanner chirps
    tone(980,.16,"square",.085,640);
    tone(1450,.14,"sawtooth",.065,880,.18);
    tone(1120,.12,"square",.075,720,.38);
  }
  function clickSound() { tone(1150,.045,"square",.035,780); }
  function warningSound() {
    tone(740,.30,"sawtooth",.105,480);
    tone(520,.32,"sawtooth",.105,350,.32);
    tone(740,.30,"sawtooth",.105,480,.68);
  }
  function transferSound() {
    // Faster digital pulses to make the simulated transfer clearly audible
    for (let i=0; i<5; i++) {
      tone(380 + (i%3)*170,.13,"square",.065,760,.16*i);
    }
    tone(660,.42,"triangle",.075,1120,.82);
  }
  // Play the user's alarm.mp3 when the final screen appears.
  // Browsers may block audible autoplay until the visitor interacts with the page.
  function startAlarm() {
    if (alarmActive || !finalAlarm) return;

    alarmActive = true;
    finalAlarm.loop = true;
    finalAlarm.volume = 0.8;

    try { finalAlarm.currentTime = 0; } catch (_) {}

    const playAttempt = finalAlarm.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(error => {
        alarmActive = false;
        console.warn("تعذر التشغيل التلقائي لـ alarm.mp3. قد يحتاج المتصفح إلى تفاعل من المستخدم.", error);
      });
    }
  }

  function stopAlarm() {
    alarmActive = false;
    if (finalAlarm) {
      finalAlarm.pause();
      try { finalAlarm.currentTime = 0; } catch (_) {}
    }
  }
  function finalSound() {
    tone(110,.65,"sawtooth",.14,48);
    tone(460,.38,"square",.12,150,.08);
    tone(980,.22,"sawtooth",.09,460,.42);
  }
  function setSoundNote() {
    const note = $("soundNote");
    if (!note) return;
    note.innerHTML = soundEnabled
      ? '<span class="sound-dot"></span> المؤثرات الصوتية مفعّلة'
      : '<span class="sound-dot"></span> اضغط مرة واحدة في أي مكان لتفعيل الأصوات؛ يبدأ الفحص تلقائياً';
  }
  function unlockAudio() {
    if (unlocked) return;
    if (initAudio()) {
      soundEnabled = true;
      setSoundNote();
      scanSound();
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      if (started) {
        if ($("finalScreen").classList.contains("show")) startAlarm();
        else transferSound();
      }
    }
  }
  document.addEventListener("pointerdown", unlockAudio, {once:false});
  document.addEventListener("keydown", unlockAudio, {once:false});
  // Escape is a simple emergency stop for the sound.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      soundEnabled = false;
      stopAlarm();
      setSoundNote();
      if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
    }
  });

  function log(text, type="") {
    const el = document.createElement("div");
    el.className = "line " + type;
    el.textContent = text;
    terminal.appendChild(el);
    while (terminal.children.length > 7) terminal.removeChild(terminal.firstChild);
    clickSound();
  }
  function alertBox(title, text, danger=false) {
    $("alertTitle").textContent = title;
    $("alertText").textContent = text;
    $("alertPanel").classList.toggle("danger", danger);
  }
  async function start() {
    if (started) return;
    started = true;
    await sleep(180);
    $("faceStatus").textContent = "رسم شبكة النقاط...";
    $("scanState").textContent = "جارٍ الفحص";
    $("linkMetric").textContent = "نشط";
    $("subtitle").textContent = "تم رصد نشاط غير معتاد...";
    alertBox("تنبيه أمني", "بدأ الفحص التلقائي. يرجى الانتظار.");
    if (soundEnabled) scanSound();
    let p = 0, lineIndex = 0;
    while (p < 100) {
      p = Math.min(100, p + (p < 45 ? 8 : p < 82 ? 11 : 18));
      $("progressFill").style.width = p + "%";
      $("percent").textContent = String(p).padStart(2,"0") + "%";
      $("progressNumber").textContent = p + "%";
      $("progressLabel").textContent = p < 30 ? "تهيئة الماسح..." : p < 60 ? "تحليل الحزم الافتراضية..." : p < 90 ? "محاكاة نقل البيانات..." : "إنهاء العملية...";
      $("faceMetric").textContent = Math.min(100, p + 4) + "%";
      $("faceStatus").textContent = p < 25 ? "تحديد نقاط الوجه..." : p < 50 ? "مطابقة الشبكة البصرية..." : p < 78 ? "تحليل المعالم الرقمية..." : "إنهاء المسح...";
      $("scannerLabel").textContent = p < 30 ? "جارٍ مسح المعالم..." : p < 65 ? "تحليل الشبكة البصرية..." : "إنهاء الفحص...";
      if (lineIndex < lines.length && (lineIndex === 0 || p >= (lineIndex * 10))) {
        log(lines[lineIndex][0], lines[lineIndex][1]); lineIndex++;
      }
      const fIndex = Math.min(fileRows.length-1, Math.floor(p/27));
      fileRows.forEach((row,i) => {
        row.classList.toggle("active", i === fIndex && p < 100);
        row.classList.toggle("done", i < fIndex || p === 100);
        row.querySelector(".file-status").textContent = i < fIndex || p === 100 ? "اكتمل" : i === fIndex ? "معالجة" : "انتظار";
      });
      if (p >= 60 && p < 80) {
        alertBox("تنبيه", "جارٍ إنهاء مراحل المعالجة...", true);
        if (p === 61 && soundEnabled) transferSound();
      }
      if (p >= 90) {
        $("flash").classList.remove("hit"); void $("flash").offsetWidth; $("flash").classList.add("hit");
        if (p < 100 && soundEnabled && p > 90) warningSound();
      }
      await sleep(p < 65 ? 260 : 190);
    }
    $("scanState").textContent = "اكتمل";
    $("scannerLabel").textContent = "اكتملت العملية";
    alertBox("اكتملت العملية", "انتهت مراحل المعالجة.", true);
    await sleep(450);
    $("finalScreen").classList.add("show");
    if (soundEnabled) finalSound();
    startAlarm();
  }
  setSoundNote();
  start();
})();
