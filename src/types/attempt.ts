export interface QuestionAttempt {
  id: string;
  quizId: string;
  questionId: string;
  materialId: string | null;
  topic: string;      // 'Umum' jika soal lama tidak punya topik
  correct: boolean;
  at: string;         // ISO
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;   // 0..1
}