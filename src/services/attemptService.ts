// services/attemptService.ts
import type { QuestionAttempt, TopicStat } from '../types/attempt';
import { createId } from '../utils/id';

const KEY = 'student-tasks:attempts';
const WEAK_ACCURACY = 0.6;
const MIN_ATTEMPTS = 3;
const MAX_STORED = 2000;

function readAll(): QuestionAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QuestionAttempt[];
  } catch {
    return [];
  }
}

export function recordAttempts(entries: Omit<QuestionAttempt, 'id' | 'at'>[]): void {
  if (entries.length === 0) return;
  const at = new Date().toISOString();
  const next = [...readAll(), ...entries.map((e) => ({ ...e, id: createId(), at }))];
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(-MAX_STORED)));
  } catch {
    // Best-effort: gagal menyimpan statistik tidak boleh menggagalkan kuis.
  }
}

export function topicStats(): TopicStat[] {
  // Kunci huruf kecil supaya "Fotosintesis" dan "fotosintesis " tergabung.
  const map = new Map<string, TopicStat>();
  for (const a of readAll()) {
    const key = `${a.materialId ?? ''}|${a.topic.trim().toLowerCase()}`;
    const s = map.get(key) ?? {
      materialId: a.materialId, topic: a.topic.trim(), attempts: 0, correct: 0, accuracy: 0,
    };
    s.attempts += 1;
    if (a.correct) s.correct += 1;
    s.accuracy = s.correct / s.attempts;
    map.set(key, s);
  }
  return [...map.values()];
}

/** Hanya topik dari materi tersimpan, karena kuis latihan butuh teks materinya. */
export function weakTopics(): TopicStat[] {
  return topicStats()
    .filter((s) => s.materialId !== null && s.attempts >= MIN_ATTEMPTS && s.accuracy < WEAK_ACCURACY)
    .sort((a, b) => a.accuracy - b.accuracy);
}