import type { QuestionAttempt, TopicStat } from '../types/attempt';
import { createId } from '../utils/id';

const KEY = 'student-tasks:attempts'; // samakan prefix dengan repository lain
const WEAK_ACCURACY = 0.6;
const MIN_ATTEMPTS = 3;
const MAX_STORED = 2000; // jaga agar LocalStorage tidak penuh

function readAll(): QuestionAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QuestionAttempt[];
  } catch {
    return [];
  }
}

export function recordAttempts(
  entries: Omit<QuestionAttempt, 'id' | 'at'>[],
): void {
  const at = new Date().toISOString();
  const next = [...readAll(), ...entries.map((e) => ({ ...e, id: createId(), at }))];
  localStorage.setItem(KEY, JSON.stringify(next.slice(-MAX_STORED)));
}

export function topicStats(materialId?: string | null): TopicStat[] {
  const map = new Map<string, { attempts: number; correct: number }>();
  for (const a of readAll()) {
    if (materialId !== undefined && a.materialId !== materialId) continue;
    const s = map.get(a.topic) ?? { attempts: 0, correct: 0 };
    s.attempts += 1;
    if (a.correct) s.correct += 1;
    map.set(a.topic, s);
  }
  return [...map].map(([topic, s]) => ({
    topic, ...s, accuracy: s.correct / s.attempts,
  }));
}

export function weakTopics(materialId?: string | null): TopicStat[] {
  return topicStats(materialId)
    .filter((s) => s.attempts >= MIN_ATTEMPTS && s.accuracy < WEAK_ACCURACY)
    .sort((a, b) => a.accuracy - b.accuracy);
}