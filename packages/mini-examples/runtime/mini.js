"use strict";
const root = document.getElementById("app"),
  kind = document.body.dataset.app;
const $ = (s) => document.querySelector(s);
let cleanup = () => {};
function render(html) {
  cleanup();
  cleanup = () => {};
  root.innerHTML = html;
}
function track(name, props = {}) {
  const context = globalThis.firsttryContext;
  if (globalThis.firsttryNative && context)
    globalThis.firsttryNative.postMessage(
      JSON.stringify({
        method: "analytics.track",
        nonce: context.nonce,
        id: crypto.randomUUID(),
        name,
        props,
      }),
    );
}
function button(label, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}
function result(title, score, replay) {
  render(
    `<p>Nicely done</p><h1>${title}</h1><div class="large">${score}</div><p>Try another round, or close to discover something new.</p><div id="replay"></div>`,
  );
  $("#replay").append(button("Play again", replay));
  track("round_completed", {
    scoreBucket: typeof score === "number" && score > 10 ? "high" : "medium",
  });
}
function colorClash() {
  let score = 0,
    remaining = 30;
  const colors = [
    ["PURPLE", "#9751ed"],
    ["BLUE", "#2594ed"],
    ["ORANGE", "#ec790e"],
    ["GREEN", "#299b4b"],
  ];
  let answer = 0;
  render(
    '<div class="stats"><span id="timer">00:30</span><span id="score">Score 0</span></div><h1>Match the COLOR</h1><div class="word" id="word"></div><div class="grid" id="choices"></div><p>Tap the color, not the word.</p><label class="muted"><input id="assist" type="checkbox"> Show color name hint</label><p id="hint" aria-live="polite"></p>',
  );
  function next() {
    answer = Math.floor(Math.random() * 4);
    const word = $("#word");
    word.textContent = colors[Math.floor(Math.random() * 4)][0];
    word.style.color = colors[answer][1];
    $("#hint").textContent = $("#assist").checked
      ? "Ink color: " + colors[answer][0]
      : "";
  }
  colors.forEach(([name, color], i) => {
    const b = button(name, () => {
      score = Math.max(0, score + (i === answer ? 1 : -1));
      $("#score").textContent = "Score " + score;
      next();
    });
    b.style.background = color;
    $("#choices").append(b);
  });
  $("#assist").addEventListener("change", () => {
    $("#hint").textContent = $("#assist").checked
      ? "Ink color: " + colors[answer][0]
      : "";
  });
  next();
  const end = performance.now() + 30000;
  const timer = setInterval(() => {
    remaining = Math.max(0, Math.ceil((end - performance.now()) / 1000));
    $("#timer").textContent = "00:" + String(remaining).padStart(2, "0");
    if (remaining === 0) result("Colors conquered", score, colorClash);
  }, 150);
  cleanup = () => clearInterval(timer);
}
function reflex() {
  render(
    '<p>THE REACTION CHALLENGE</p><h1>Ready. Set. Tap.</h1><p>Wait until the panel turns green. Early taps reset the round.</p><button class="panel" id="target" style="width:100%;min-height:230px">Tap to start</button><p id="reaction" aria-live="polite"></p>',
  );
  let state = "idle",
    start = 0,
    timeout;
  const target = $("#target");
  target.addEventListener("click", () => {
    if (state === "idle") {
      state = "wait";
      target.textContent = "Wait for green…";
      target.style.background = "#a52f49";
      timeout = setTimeout(
        () => {
          state = "go";
          start = performance.now();
          target.textContent = "TAP NOW";
          target.style.background = "#07a160";
        },
        1500 + Math.random() * 2000,
      );
    } else if (state === "wait") {
      clearTimeout(timeout);
      state = "idle";
      target.textContent = "Too soon! Tap to retry";
      target.style.background = "#ffffff17";
    } else {
      const ms = Math.round(performance.now() - start);
      state = "idle";
      target.textContent = ms + " ms — tap to retry";
      target.style.background = "#ffffff17";
      $("#reaction").textContent =
        ms < 300 ? "Lightning quick!" : "Nice! Can you beat that?";
      track("round_completed", { scoreBucket: ms < 300 ? "high" : "medium" });
    }
  });
  cleanup = () => clearTimeout(timeout);
}
function spinner() {
  render(
    '<p>A LITTLE HELP DECIDING</p><h1>Leave it to chance.</h1><p>One option per line. Your choices stay in this mini-app.</p><textarea id="options" maxlength="500" aria-label="Choices">Take a walk\nRead a book\nMake some tea</textarea><div class="wheel" id="wheel"></div><button id="spin">Spin the wheel</button><p class="result" id="result" aria-live="polite"></p>',
  );
  let turns = 0,
    timeout;
  $("#spin").addEventListener("click", () => {
    const opts = $("#options")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (opts.length < 2) {
      $("#result").textContent = "Add at least two options.";
      return;
    }
    $("#spin").disabled = true;
    $("#result").textContent = "Choosing…";
    turns += 1080 + Math.random() * 360;
    $("#wheel").style.transform = `rotate(${turns}deg)`;
    timeout = setTimeout(() => {
      $("#result").textContent = opts[Math.floor(Math.random() * opts.length)];
      $("#spin").disabled = false;
      track("task_completed", { completed: true });
    }, 1700);
  });
  cleanup = () => clearTimeout(timeout);
}
function focus() {
  render(
    '<p>ONE THING AT A TIME</p><h1>Find your focus.</h1><label>Choose your sprint<select id="minutes"><option value="5">5 minutes</option><option value="1">1 minute</option></select></label><div class="large" id="clock">05:00</div><button id="start">Start sprint</button><p id="status" aria-live="polite">Keep this mini-app open. The sprint pauses in the background.</p>',
  );
  let remaining = 300,
    running = false,
    timer,
    last = 0;
  $("#minutes").addEventListener("change", () => {
    running = false;
    remaining = Number($("#minutes").value) * 60;
    show();
  });
  function show() {
    $("#clock").textContent =
      String(Math.floor(remaining / 60)).padStart(2, "0") +
      ":" +
      String(remaining % 60).padStart(2, "0");
    $("#start").textContent = running ? "Pause" : "Start sprint";
  }
  $("#start").addEventListener("click", () => {
    running = !running;
    last = Date.now();
    show();
  });
  const visibility = () => {
    if (document.hidden) {
      running = false;
      show();
    }
  };
  document.addEventListener("visibilitychange", visibility);
  timer = setInterval(() => {
    if (running && Date.now() - last >= 1000) {
      last = Date.now();
      remaining = Math.max(0, remaining - 1);
      show();
      if (!remaining) {
        running = false;
        $("#status").textContent = "Sprint complete. Take a breath.";
        track("task_completed", { completed: true });
      }
    }
  }, 200);
  cleanup = () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visibility);
  };
}
function quiz() {
  const qs = [
    ["Which planet is called the Red Planet?", ["Mars", "Venus", "Jupiter"], 0],
    [
      "What does HTML describe?",
      ["Page structure", "A database", "A network cable"],
      0,
    ],
    ["Which animal is a mammal?", ["Shark", "Dolphin", "Octopus"], 1],
    ["How many sides does a hexagon have?", ["Five", "Six", "Eight"], 1],
  ];
  let n = 0,
    score = 0;
  function next() {
    if (n === qs.length) {
      result("Curiosity rewarded", score, quiz);
      return;
    }
    const [question, options, answer] = qs[n];
    render(
      `<p>QUESTION ${n + 1} OF ${qs.length}</p><h1>${question}</h1><div class="grid" id="answers"></div>`,
    );
    options.forEach((text, i) =>
      $("#answers").append(
        button(text, () => {
          if (i === answer) score++;
          n++;
          next();
        }),
      ),
    );
  }
  next();
}
function meme() {
  render(
    '<p>A TINY CREATIVE BREAK</p><h1>Meme Remix</h1><label>Pick a template<select id="template"><option value="😅">The awkward moment</option><option value="😎">Small victory</option><option value="🤔">Deep thoughts</option></select></label><input id="caption" aria-label="Caption" maxlength="100" placeholder="When your code works on the first try"><div class="meme"><span id="caption-out">When your code works on the first try</span><span class="emoji" id="face">😅</span><small>FIRSTTRY MEME REMIX</small></div><button id="done">Looks good!</button><p id="notice" aria-live="polite">Local preview only. No upload or public posting.</p>',
  );
  $("#caption").addEventListener("input", () => {
    $("#caption-out").textContent =
      $("#caption").value || "When your code works on the first try";
  });
  $("#template").addEventListener("change", () => {
    $("#face").textContent = $("#template").value;
  });
  $("#done").addEventListener("click", () => {
    $("#notice").textContent =
      "Remix complete. Make another or explore a new mini-app.";
    track("task_completed", { completed: true });
  });
}
(
  ({
    "color-clash": colorClash,
    "tap-reflex": reflex,
    "decision-spinner": spinner,
    "focus-sprint": focus,
    "tiny-quiz": quiz,
    "meme-remix": meme,
  })[kind] || colorClash
)();
document.addEventListener("visibilitychange", () => {
  if (document.hidden && kind === "color-clash") {
    render(
      '<h1>Round paused</h1><p>Start a fresh round when you are ready.</p><div id="restart"></div>',
    );
    $("#restart").append(button("Start again", colorClash));
  }
});
