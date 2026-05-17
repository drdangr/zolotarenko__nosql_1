// scripts/02_transform.js
// Трансформація плоскої колекції tracks_raw у документоорієнтовану
// схему tracks засобами Aggregation Pipeline.
// Запуск: mongosh "ВАШ_URI" --file scripts/02_transform.js

const spotify = db.getSiblingDB("spotify");

// (1) Перед трансформацією прибираємо стару колекцію tracks, якщо вона існує.
spotify.tracks.drop();

spotify.tracks_raw.aggregate([
  {
    // (2) Проєкція потрібних полів +
    // (3) розбиття рядка виконавців у масив artists +
    // (4) вкладений об'єкт audio_features та обчислювані поля.
    // (5) Зайві вихідні аудіофічі та artists_raw сюди не потрапляють —
    //     ми одразу формуємо фінальну форму документа.
    $project: {
      _id: 1,
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,

      // Розбиваємо рядок артистів по ";" і прибираємо пробіли навколо кожного імені.
      artists: {
        $map: {
          input: { $split: ["$artists", ";"] },
          as: "a",
          in: { $trim: { input: "$$a" } }
        }
      },

      // Вкладений об'єкт з усіма аудіо-характеристиками.
      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        loudness: "$loudness",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        key: "$key",
        mode: "$mode",
        time_signature: "$time_signature"
      },

      // Тривалість у секундах, округлена до одного знака.
      duration_sec: { $round: [{ $divide: ["$duration_ms", 1000] }, 1] },

      // Рівень популярності.
      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            { case: { $gte: ["$popularity", 40] }, then: "medium" }
          ],
          default: "low"
        }
      }
    }
  },

  // (6) Зберігаємо результат у колекцію tracks.
  { $out: "tracks" }
]);

// (7) Перевірка результату.
print("Кількість документів у tracks: " + spotify.tracks.countDocuments({}));
print("Приклад документа:");
printjson(spotify.tracks.findOne());
