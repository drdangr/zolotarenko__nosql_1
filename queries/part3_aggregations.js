// queries/part3_aggregations.js
// Частина 3 — Аналітика через Aggregation Pipeline.
// Запуск: mongosh "ВАШ_URI" --file queries/part3_aggregations.js

const spotify = db.getSiblingDB("spotify");

// ───────────────────────────────────────────────────────────────
// Завдання 1. Топ-10 виконавців за середньою популярністю
// Беремо лише виконавців, у яких >= 5 треків.
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 1. Топ-10 виконавців за середньою популярністю ===");

printjson(
  spotify.tracks.aggregate([
    { $unwind: "$artists" },
    {
      $group: {
        _id: "$artists",
        tracks_count: { $sum: 1 },
        avg_popularity: { $avg: "$popularity" }
      }
    },
    { $match: { tracks_count: { $gte: 5 } } },
    {
      $project: {
        _id: 0,
        artist: "$_id",
        tracks_count: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] }
      }
    },
    { $sort: { avg_popularity: -1 } },
    { $limit: 10 }
  ]).toArray()
);

// ───────────────────────────────────────────────────────────────
// Завдання 2. Розподіл треків за настроєм
// Поріг для valence та energy — 0.5 (>= 0.5 — високий, < 0.5 — низький).
//   високий valence + висока energy  -> happy
//   низький valence + висока energy  -> angry
//   високий valence + низька energy  -> calm
//   низький valence + низька energy  -> sad
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 2. Розподіл треків за настроєм ===");

printjson(
  spotify.tracks.aggregate([
    {
      $addFields: {
        mood: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: ["$audio_features.valence", 0.5] },
                    { $gte: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "happy"
              },
              {
                case: {
                  $and: [
                    { $lt: ["$audio_features.valence", 0.5] },
                    { $gte: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "angry"
              },
              {
                case: {
                  $and: [
                    { $gte: ["$audio_features.valence", 0.5] },
                    { $lt: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "calm"
              }
            ],
            default: "sad"
          }
        }
      }
    },
    { $group: { _id: "$mood", tracks_count: { $sum: 1 } } },
    { $project: { _id: 0, mood: "$_id", tracks_count: 1 } },
    { $sort: { tracks_count: -1 } }
  ]).toArray()
);

// ───────────────────────────────────────────────────────────────
// Завдання 3. Найбільш «танцювальний» жанр
// Групуємо за жанром, рахуємо середні danceability / energy / valence.
// Залишаємо жанри з >= 100 треків.
// ───────────────────────────────────────────────────────────────
print("\n=== Завдання 3. Найбільш «танцювальний» жанр ===");

printjson(
  spotify.tracks.aggregate([
    {
      $group: {
        _id: "$track_genre",
        avg_danceability: { $avg: "$audio_features.danceability" },
        avg_energy: { $avg: "$audio_features.energy" },
        avg_valence: { $avg: "$audio_features.valence" },
        tracks_count: { $sum: 1 }
      }
    },
    { $match: { tracks_count: { $gte: 100 } } },
    {
      $project: {
        _id: 0,
        genre: "$_id",
        avg_danceability: { $round: ["$avg_danceability", 3] },
        avg_energy: { $round: ["$avg_energy", 3] },
        avg_valence: { $round: ["$avg_valence", 3] },
        tracks_count: 1
      }
    },
    { $sort: { avg_danceability: -1 } },
    { $limit: 10 }
  ]).toArray()
);
