// queries/part4_indexes.js
// Частина 4 — Індекси та оптимізація.
// Запуск: mongosh "ВАШ_URI" --file queries/part4_indexes.js

const spotify = db.getSiblingDB("spotify");
const tracks = spotify.tracks;

// Допоміжна функція: друкує ключові поля з explain("executionStats").
function summarize(label, exp) {
  const stats = exp.executionStats;
  // Розгортаємо вкладені плани, щоб дістати назви стадій.
  function stages(plan, acc) {
    acc.push(plan.stage + (plan.indexName ? " (" + plan.indexName + ")" : ""));
    if (plan.inputStage) stages(plan.inputStage, acc);
    if (plan.inputStages) plan.inputStages.forEach(s => stages(s, acc));
    return acc;
  }
  print("\n--- " + label + " ---");
  print("Стадії плану : " + stages(exp.queryPlanner.winningPlan, []).join(" <- "));
  print("nReturned          : " + stats.nReturned);
  print("totalKeysExamined  : " + stats.totalKeysExamined);
  print("totalDocsExamined  : " + stats.totalDocsExamined);
  print("executionTimeMillis: " + stats.executionTimeMillis);
}

// ===============================================================
// Завдання 1. Аналіз запиту та індексація
// Запит: точний збіг (track_genre) + діапазон (danceability) + сортування.
// ===============================================================
print("\n############ ЗАВДАННЯ 1 ############");

const q1 = { track_genre: "pop", "audio_features.danceability": { $gte: 0.7 } };
const sort1 = { popularity: -1 };

// Прибираємо індекс, якщо лишився з попереднього запуску (ідемпотентність).
try { tracks.dropIndex("idx_part4_task1"); } catch (e) {}

// (a) ДО індексу.
summarize(
  "Завдання 1 — ДО індексу",
  tracks.find(q1).sort(sort1).explain("executionStats")
);

// (b) Створюємо складений індекс за правилом ESR:
//     Equality (track_genre) -> Sort (popularity) -> Range (danceability).
tracks.createIndex(
  { track_genre: 1, popularity: -1, "audio_features.danceability": 1 },
  { name: "idx_part4_task1" }
);
print("\nСтворено індекс idx_part4_task1: " +
  "{ track_genre: 1, popularity: -1, 'audio_features.danceability': 1 }");

// (c) ПІСЛЯ індексу.
summarize(
  "Завдання 1 — ПІСЛЯ індексу",
  tracks.find(q1).sort(sort1).explain("executionStats")
);

// ===============================================================
// Завдання 2. Індекс для пошуку музики для роботи
// Поля: audio_features.instrumentalness, audio_features.speechiness, explicit.
// ===============================================================
print("\n############ ЗАВДАННЯ 2 ############");

try { tracks.dropIndex("idx_part4_task2"); } catch (e) {}

// ESR: спершу рівність (explicit), потім діапазонні поля.
tracks.createIndex(
  { explicit: 1, "audio_features.instrumentalness": 1, "audio_features.speechiness": 1 },
  { name: "idx_part4_task2" }
);
print("Створено індекс idx_part4_task2: " +
  "{ explicit: 1, 'audio_features.instrumentalness': 1, 'audio_features.speechiness': 1 }");

const q2 = {
  explicit: false,
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 }
};

summarize(
  "Завдання 2 — пошук музики для роботи (з індексом)",
  tracks.find(q2).explain("executionStats")
);

// ===============================================================
// Завдання 3. Покривний запит (covered query)
// Припускаємо, що індекс із Завдання 1 існує.
// Запит: db.tracks.find({ track_genre: "pop", popularity: { $gte: 70 } })
// ===============================================================
print("\n############ ЗАВДАННЯ 3 ############");

const q3 = { track_genre: "pop", popularity: { $gte: 70 } };

// (a) Як у завданні — без проєкції (повертається _id і всі поля).
summarize(
  "Завдання 3 — без проєкції (як у завданні)",
  tracks.find(q3).explain("executionStats")
);

// (b) Для порівняння — з проєкцією лише полів індексу та без _id.
summarize(
  "Завдання 3 — проєкція {_id:0, track_genre:1, popularity:1}",
  tracks.find(q3, { _id: 0, track_genre: 1, popularity: 1 }).explain("executionStats")
);

print("\nГотово. Поточні індекси колекції tracks:");
printjson(tracks.getIndexes());
