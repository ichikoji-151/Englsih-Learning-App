// content/ 内の *.md を読み込み、public/words.db (SQLite) を生成するビルドスクリプト
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const CONTENT_DIR = path.join(__dirname, "..", "content");
const OUTPUT_DB = path.join(__dirname, "..", "public", "words.db");

// 見出し行（"- word：意味"）を word / meaning に分割する。
// ： と ； のどちらでも区切れるようにする（元データの表記ゆれ対応）。
function splitWordLine(line) {
  const match = line.match(/^-\s*(.+?)[：；](.+)$/);
  if (!match) return null;
  return { english: match[1].trim(), japanese: match[2].trim() };
}

function parseMarkdown(unitName, text) {
  const lines = text.split(/\r?\n/);

  const lessons = []; // { lessonNumber, words: [], grammarPoints: [] }
  let currentLesson = null;
  let currentSection = null; // "words" | "grammar" | null
  let currentGrammarPoint = null; // { phrase, noteLines: [] }

  function flushGrammarPoint() {
    if (currentGrammarPoint) {
      currentLesson.grammarPoints.push({
        phrase: currentGrammarPoint.phrase,
        note: currentGrammarPoint.noteLines.join("\n").trim(),
      });
      currentGrammarPoint = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const lessonMatch = line.match(/^#{1,2}\s*Lesson\s*(\d+)/i);
    if (lessonMatch) {
      flushGrammarPoint();
      currentLesson = { lessonNumber: Number(lessonMatch[1]), words: [], grammarPoints: [] };
      lessons.push(currentLesson);
      currentSection = null;
      continue;
    }

    if (!currentLesson) continue; // Lesson見出しより前の行は無視

    if (/^###\s*Words/i.test(line)) {
      flushGrammarPoint();
      currentSection = "words";
      continue;
    }
    if (/^###\s*Grammar/i.test(line)) {
      flushGrammarPoint();
      currentSection = "grammar";
      continue;
    }

    if (currentSection === "words") {
      const word = splitWordLine(line);
      if (word) currentLesson.words.push(word);
      continue;
    }

    if (currentSection === "grammar") {
      if (/^-\s/.test(line)) {
        flushGrammarPoint();
        currentGrammarPoint = { phrase: line.replace(/^-\s*/, "").trim(), noteLines: [] };
      } else if (currentGrammarPoint && line.trim()) {
        currentGrammarPoint.noteLines.push(line.trim());
      }
      continue;
    }
  }
  flushGrammarPoint();

  return { unitName, lessons };
}

function buildDatabase(units) {
  if (fs.existsSync(OUTPUT_DB)) fs.unlinkSync(OUTPUT_DB);
  fs.mkdirSync(path.dirname(OUTPUT_DB), { recursive: true });

  const db = new Database(OUTPUT_DB);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE units (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE lessons (
      id INTEGER PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      lesson_number INTEGER NOT NULL
    );
    CREATE TABLE words (
      id INTEGER PRIMARY KEY,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id),
      english TEXT NOT NULL,
      japanese TEXT NOT NULL
    );
    CREATE TABLE grammar_points (
      id INTEGER PRIMARY KEY,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id),
      phrase TEXT NOT NULL,
      note TEXT
    );
  `);

  const insertUnit = db.prepare("INSERT INTO units (name) VALUES (?)");
  const insertLesson = db.prepare("INSERT INTO lessons (unit_id, lesson_number) VALUES (?, ?)");
  const insertWord = db.prepare("INSERT INTO words (lesson_id, english, japanese) VALUES (?, ?, ?)");
  const insertGrammar = db.prepare("INSERT INTO grammar_points (lesson_id, phrase, note) VALUES (?, ?, ?)");

  let wordCount = 0;
  let grammarCount = 0;

  for (const unit of units) {
    const unitId = insertUnit.run(unit.unitName).lastInsertRowid;
    for (const lesson of unit.lessons) {
      const lessonId = insertLesson.run(unitId, lesson.lessonNumber).lastInsertRowid;
      for (const w of lesson.words) {
        insertWord.run(lessonId, w.english, w.japanese);
        wordCount++;
      }
      for (const g of lesson.grammarPoints) {
        insertGrammar.run(lessonId, g.phrase, g.note);
        grammarCount++;
      }
    }
  }

  db.close();
  console.log(`✔ ${OUTPUT_DB} を生成しました（words: ${wordCount}件, grammar: ${grammarCount}件）`);
}

function main() {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`content/ に .md ファイルが見つかりません: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const units = files.map((file) => {
    const unitName = path.basename(file, ".md");
    const text = fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");
    return parseMarkdown(unitName, text);
  });

  buildDatabase(units);
}

main();
