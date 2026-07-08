// ===== 状態（今どんな問題を出しているか、を覚えておく変数） =====
let db = null;
let mode = "input"; // "input" または "choice"
let currentWord = null; // { id, english, japanese }
let currentChoices = []; // choiceモードのときの4択（日本語の配列）

// ===== 起動処理 =====
async function init() {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
  });
  const response = await fetch("words.db");
  const buffer = await response.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));

  document.getElementById("mode-input-btn").addEventListener("click", () => setMode("input"));
  document.getElementById("mode-choice-btn").addEventListener("click", () => setMode("choice"));
  document.getElementById("submit-btn").addEventListener("click", handleSubmitTyped);
  document.getElementById("answer-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmitTyped();
  });
  document.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleSubmitChoice(btn.textContent));
  });
  document.getElementById("next-btn").addEventListener("click", nextQuestion);

  setMode("input");
}

// ===== DBへの問い合わせ（SQLはここに書く） =====
function queryAll(sql) {
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(row.map((v, i) => [columns[i], v])));
}

function getRandomWord() {
  const rows = queryAll("SELECT id, english, japanese FROM words ORDER BY RANDOM() LIMIT 1");
  return rows[0];
}

function getRandomDistractors(excludeId, limit = 3) {
  const rows = queryAll(
    `SELECT japanese FROM words WHERE id != ${excludeId} ORDER BY RANDOM() LIMIT ${limit}`
  );
  return rows.map((r) => r.japanese);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ===== 画面の切り替え =====
function setMode(newMode) {
  mode = newMode;
  document.getElementById("input-mode-ui").hidden = mode !== "input";
  document.getElementById("choice-mode-ui").hidden = mode !== "choice";
  nextQuestion();
}

function nextQuestion() {
  currentWord = getRandomWord();
  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("next-btn").hidden = true;

  if (mode === "input") {
    document.getElementById("prompt").textContent = currentWord.japanese;
    document.getElementById("answer-input").value = "";
    document.getElementById("answer-input").focus();
  } else {
    document.getElementById("prompt").textContent = currentWord.english;
    const distractors = getRandomDistractors(currentWord.id, 3);
    currentChoices = shuffle([currentWord.japanese, ...distractors]);
    const buttons = document.querySelectorAll(".choice-btn");
    buttons.forEach((btn, i) => {
      btn.textContent = currentChoices[i];
      btn.disabled = false;
    });
  }
}

function showFeedback(isCorrect, correctAnswer) {
  const el = document.getElementById("feedback");
  el.textContent = isCorrect ? "正解！" : `不正解… 正解は「${correctAnswer}」`;
  el.className = isCorrect ? "correct" : "incorrect";
  document.getElementById("next-btn").hidden = false;
}

// ===== ここから先はTODO：あなたが実装するパート =====
//
// パターン1（日本語表示 → 英語をテキスト入力）の正誤判定をする関数です。
// userInput   : ユーザーがテキストボックスに入力した文字列（例: " Fuselage " のように前後に空白や大文字小文字の違いがあるかもしれない）
// correctAnswer: 正解の英単語（words.english の値。例: "fuselage"）
//
// 要件：
//   1. 大文字・小文字の違いは区別しない（"Fuselage" でも正解にする）
//   2. 前後の余分な空白は無視する
//   3. 上記を満たしたうえで完全一致していれば true、そうでなければ false を返す
//
// ヒント：文字列には .trim() と .toLowerCase() というメソッドがあります。
function isAnswerCorrect(userInput, correctAnswer) {
  // TODO: ここを実装してください
  return false;
}

function handleSubmitTyped() {
  const userInput = document.getElementById("answer-input").value;
  const correct = isAnswerCorrect(userInput, currentWord.english);
  showFeedback(correct, currentWord.english);
}

function handleSubmitChoice(selectedJapanese) {
  document.querySelectorAll(".choice-btn").forEach((btn) => (btn.disabled = true));
  const correct = selectedJapanese === currentWord.japanese;
  showFeedback(correct, currentWord.japanese);
}

init();
