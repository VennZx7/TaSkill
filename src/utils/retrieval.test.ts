import { describe, expect, it } from 'vitest';
import { retrieveRelevantContext, selectCoverageContext } from './retrieval';

describe('local material retrieval', () => {
  it('prefers passages that match the question over unrelated sections', () => {
    const unrelated = Array.from(
      { length: 28 },
      (_, index) => `Bagian umum ${index}. Materi membahas jadwal, bacaan, dan catatan kelas. ${'pengantar kuliah '.repeat(32)}`,
    );
    unrelated[21] = `Integral parsial substitusi trigonometri. Teknik ini memecah integral menjadi dua fungsi dan memakai identitas trigonometri. ${'pembahasan integral '.repeat(35)}`;

    const retrieved = retrieveRelevantContext(unrelated.join('\n\n'), 'Jelaskan integral parsial dan substitusi trigonometri.', {
      maxChars: 2_800,
      maxChunks: 4,
    });

    expect(retrieved).toContain('Integral parsial substitusi trigonometri');
    expect(retrieved).toContain('[Bagian materi');
  });

  it('samples from across a long document for quiz and flashcard coverage', () => {
    const sections = Array.from(
      { length: 24 },
      (_, index) => `Subbab ${index + 1}. ${'Penjelasan konsep dan contoh belajar. '.repeat(18)}`,
    );
    sections[0] = `Pembuka penting. ${'konsep dasar '.repeat(28)}`;
    sections[23] = `Kesimpulan akhir dokumen. ${'rangkuman akhir '.repeat(28)}`;

    const selected = selectCoverageContext(sections.join('\n\n'), 4_200);

    expect(selected.length).toBeLessThanOrEqual(4_200);
    expect(selected).toContain('Pembuka penting');
    expect(selected).toContain('Kesimpulan akhir dokumen');
  });
});
