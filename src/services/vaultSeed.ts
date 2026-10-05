import type { VaultItem, VaultType } from '../types/vault';
import { createId } from '../utils/id';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Seed {
  title: string;
  course: string;
  type: VaultType;
  urlOrContent: string;
  tags: string[];
  isRead: boolean;
  dayOffset: number;
}

/**
 * A real student's saved material: lecture notes, a revision cheat sheet, past
 * exam papers, and the two links they actually bookmark. Kept in one file so it
 * can be deleted in a single step.
 */
const SEEDS: Seed[] = [
  {
    title: 'Catatan Bab 1 — Limit dan Kontinuitas',
    course: 'Kalkulus Lanjut',
    type: 'note',
    urlOrContent:
      'Limit fungsi: definisi formal epsilon-delta. Limit dari kiri dan kanan harus sama. Fungsi kontinu iff limit = nilai fungsi. Untuk x→a pada fungsi rasional, bentuk 0/0 harus dicoret dulu.',
    tags: ['limit', 'kontinuitas', 'uts'],
    isRead: false,
    dayOffset: -12,
  },
  {
    title: 'Rumus Turunan yang Sering Keluar',
    course: 'Kalkulus Lanjut',
    type: 'note',
    urlOrContent:
      'Turunan pangkat: n·x^(n-1). Rantai: (f(g(x)))′ = f′(g(x))·g′(x). Turunan implisit: turunkan kedua sisi lalu gunakan turunan y. Soal cerita wajib menulis turunan sebagai fungsi waktu.',
    tags: ['turunan', 'rumus', 'uts'],
    isRead: false,
    dayOffset: -9,
  },
  {
    title: 'Soal Past UTS Aljabar Linear 2024',
    course: 'Aljabar Linear',
    type: 'document',
    urlOrContent: 'Modul Latihan UTS — Bab 1 dan 2 (20 soal, pembahasan tersedia di kelas)',
    tags: ['uts', 'latihan', 'soal'],
    isRead: true,
    dayOffset: -7,
  },
  {
    title: 'Cheat Sheet Integral',
    course: 'Kalkulus Lanjut',
    type: 'note',
    urlOrContent:
      'Substitusi u untuk polinomial. Integral parsial untuk (polinomial × pangkat). Tabel integral dasar hafal. Selalu cek hasilnya dengan turunan.',
    tags: ['integral', 'rumus', 'uts'],
    isRead: false,
    dayOffset: -4,
  },
  {
    title: 'Kalkulus — Wikipedia (Bahasa Indonesia)',
    course: 'Kalkulus Lanjut',
    type: 'link',
    urlOrContent: 'https://id.wikipedia.org/wiki/Kalkulus',
    tags: ['referensi'],
    isRead: true,
    dayOffset: -3,
  },
  {
    title: 'Template Laporan Praktikum Laboratorium Komputer',
    course: 'Pemrograman Berorientasi Objek',
    type: 'document',
    urlOrContent: 'Judul, latar belakang, tujuan, tools, pembahasan, kesimpulan. Format wajib: Courier 12, spasi 1.5.',
    tags: ['praktikum', 'laporan'],
    isRead: false,
    dayOffset: -2,
  },
  {
    title: 'Catatan Bab 3 — Tree dan Graph',
    course: 'Struktur Data',
    type: 'note',
    urlOrContent:
      'BST: inorder traversal selalu terurut menaik. Heap: parent selalu lebih besar dari anak (max-heap). BFS butuh queue, DFS butuh stack atau rekursi.',
    tags: ['tree', 'graph', 'uas'],
    isRead: false,
    dayOffset: -1,
  },
];

export function buildSeedVaultItems(now: number = Date.now()): VaultItem[] {
  return SEEDS.map((seed) => ({
    id: createId(),
    title: seed.title,
    course: seed.course,
    urlOrContent: seed.urlOrContent,
    type: seed.type,
    tags: [...seed.tags],
    isRead: seed.isRead,
    createdAt: new Date(now + seed.dayOffset * DAY_MS).toISOString(),
  })).reverse();
}