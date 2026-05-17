// queries/part2_queries.js
// Частина 2 — Запити до даних.
// Запуск: mongosh "ВАШ_URI" --file queries/part2_queries.js

const spotify = db.getSiblingDB("spotify");

// ───────────────────────────────────────────────────────────────
// Завдання 1. Треки для вечірки
// Високий danceability (> 0.7), висока energy (> 0.7),
// тривалість 3–5 хв (180000–300000 мс).
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 1. Треки для вечірки ===");

const partyFilter = {
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 }
};

print("Знайдено треків: " + spotify.tracks.countDocuments(partyFilter));
printjson(
  spotify.tracks
    .find(partyFilter, {
      _id: 0,
      track_name: 1,
      artists: 1,
      duration_sec: 1,
      "audio_features.danceability": 1,
      "audio_features.energy": 1
    })
    .sort({ popularity: -1 })
    .limit(5)
    .toArray()
);

// ───────────────────────────────────────────────────────────────
// Завдання 2. Виконавці, у яких усі треки популярні
// Артист популярний, якщо у нього >= 3 треки і мінімальна
// популярність його треків >= 60. Топ-20.
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 2. Виконавці, у яких усі треки популярні ===");

printjson(
  spotify.tracks.aggregate([
    // Один документ може мати кількох виконавців — розгортаємо масив.
    { $unwind: "$artists" },
    {
      $group: {
        _id: "$artists",
        tracks_count: { $sum: 1 },
        min_popularity: { $min: "$popularity" },
        avg_popularity: { $avg: "$popularity" }
      }
    },
    // Усі треки артиста популярні: мінімум 3 треки та min popularity >= 60.
    { $match: { tracks_count: { $gte: 3 }, min_popularity: { $gte: 60 } } },
    {
      $project: {
        _id: 0,
        artist: "$_id",
        tracks_count: 1,
        min_popularity: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] }
      }
    },
    { $sort: { avg_popularity: -1, tracks_count: -1 } },
    { $limit: 20 }
  ]).toArray()
);

// ───────────────────────────────────────────────────────────────
// Завдання 3. Нетипові треки
// Для кожного жанру: mean(tempo) через $avg та stdDev через
// $stdDevPop. Нетипові треки: tempo > mean + 2 * stdDev.
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 3. Нетипові треки (за темпом у межах жанру) ===");

printjson(
  spotify.tracks.aggregate([
    {
      $group: {
        _id: "$track_genre",
        avg_tempo: { $avg: "$audio_features.tempo" },
        std_tempo: { $stdDevPop: "$audio_features.tempo" },
        tracks: {
          $push: {
            _id: "$_id",
            track_name: "$track_name",
            popularity: "$popularity",
            artists: "$artists",
            audio_features: { tempo: "$audio_features.tempo" }
          }
        }
      }
    },
    {
      $addFields: {
        outlier_threshold: {
          $add: ["$avg_tempo", { $multiply: [2, "$std_tempo"] }]
        }
      }
    },
    {
      $project: {
        _id: 0,
        genre: "$_id",
        avg_tempo: { $round: ["$avg_tempo", 0] },
        outlier_threshold: { $round: ["$outlier_threshold", 1] },
        outlier_tracks: {
          $filter: {
            input: "$tracks",
            as: "t",
            cond: { $gt: ["$$t.audio_features.tempo", "$outlier_threshold"] }
          }
        }
      }
    },
    // Залишаємо лише жанри, де є хоча б один нетиповий трек.
    { $match: { "outlier_tracks.0": { $exists: true } } },
    { $sort: { genre: 1 } }
  ]).toArray()
);

// ───────────────────────────────────────────────────────────────
// Завдання 4. Треки для фонової роботи
// Тихі (loudness < -10), мало мовлення (speechiness < 0.1),
// переважно інструментальні (instrumentalness > 0.5),
// без explicit-контенту.
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 4. Треки для фонової роботи ===");

const focusFilter = {
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false
};

print("Знайдено треків: " + spotify.tracks.countDocuments(focusFilter));
printjson(
  spotify.tracks
    .find(focusFilter, {
      _id: 0,
      track_name: 1,
      artists: 1,
      track_genre: 1,
      "audio_features.loudness": 1,
      "audio_features.instrumentalness": 1
    })
    .limit(5)
    .toArray()
);
