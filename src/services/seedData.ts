import type { Item, Subtask, TaskPriority, ItemType, TaskStatus } from '../types/item';
import { createId } from '../utils/id';

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Builds an ISO-8601 string with an explicit +07:00 offset at an exact WIB
 * wall-clock time, relative to `now`. Offsets are whole days, and WIB has no
 * daylight saving, so a day offset is exact.
 */
function wibISO(now: number, dayOffset: number, hour: number, minute = 0): string {
  const shifted = new Date(now + dayOffset * DAY_MS + WIB_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(hour)}:${pad(minute)}:00+07:00`
  );
}

function subtasks(titles: Array<[string, boolean]>): Subtask[] {
  return titles.map(([title, isCompleted]) => ({ id: createId(), title, isCompleted }));
}

interface Seed {
  type: ItemType;
  title: string;
  course: string;
  description: string;
  dayOffset: number;
  hour: number;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks?: Array<[string, boolean]>;
}

/** Deadlines are spread across overdue, due today, and the coming weeks. */
const SEEDS: Seed[] = [
  {
    type: 'assignment',
    title: 'Tugas 4 — Matriks dan Determinan',
    course: 'Aljabar Linear',
    description: 'Kerjakan soal 1–20 pada Bab 4. Sertakan langkah penyelesaian lengkap.',
    dayOffset: -2,
    hour: 23,
    priority: 'High',
    status: 'In Progress',
  },
  {
    type: 'assignment',
    title: 'Modul Jaringan Komputer — Topologi dan OSI Layer',
    course: 'Jaringan Komputer',
    description: 'Modul 3. Jelaskan perbedaan model OSI dan model TCP/IP dalam bentuk tabel.',
    dayOffset: -1,
    hour: 21,
    priority: 'Medium',
    status: 'To Do',
  },
  {
    type: 'assignment',
    title: 'Praktikum Laboratorium Komputer — Pengukuran R',
    course: 'Fisika Dasar',
    description: 'Laporan praktikum minggu ke-5. Jangan lupa lampirkan data logger.',
    dayOffset: 0,
    hour: 23,
    priority: 'High',
    status: 'In Progress',
  },
  {
    type: 'exam',
    title: 'Ujian Tengah Semester Pemrograman Web',
    course: 'Pemrograman Web',
    description: 'UTS mencakup HTML, CSS, dan JavaScript fundamentals. Bawa laptop.',
    dayOffset: 0,
    hour: 8,
    priority: 'High',
    status: 'In Progress',
    subtasks: [
      ['Bab 1: Struktur Dokumen HTML', true],
      ['Bab 2: Selector dan Layout CSS', true],
      ['Bab 3: DOM dan Event Handler', false],
      ['Latihan soal UTS', false],
    ],
  },
  {
    type: 'assignment',
    title: 'Kuis Pemrograman Berorientasi Objek — Inheritance & Polymorphism',
    course: 'Pemrograman Berorientasi Objek',
    description: 'Kuis tertutup, 30 menit. Materi bab 5 dan 6.',
    dayOffset: 1,
    hour: 7,
    priority: 'High',
    status: 'To Do',
  },
  {
    type: 'assignment',
    title: 'Tugas Basis Data — Normalisasi sampai 3NF',
    course: 'Basis Data',
    description: 'Rancang skema dari study case rental mobil, normalisasi sampai 3NF.',
    dayOffset: 2,
    hour: 22,
    priority: 'Medium',
    status: 'To Do',
  },
  {
    type: 'exam',
    title: 'UTS Fisika Dasar',
    course: 'Fisika Dasar',
    description: 'Bab 1–4: Besaran dan satuan, kinematika, dinamika, usaha dan energi.',
    dayOffset: 3,
    hour: 8,
    priority: 'High',
    status: 'To Do',
    subtasks: [
      ['Bab 1: Besaran dan Satuan', true],
      ['Bab 2: Kinematika', false],
      ['Bab 3: Dinamika', false],
      ['Bab 4: Usaha dan Energi', false],
    ],
  },
  {
    type: 'assignment',
    title: 'Tugas Kalkulus Lanjut — Integral Wajib',
    course: 'Kalkulus Lanjut',
    description: 'Soal 1–12 teknik integral. Tulis langkah dan hasil akhir.',
    dayOffset: 5,
    hour: 23,
    priority: 'Medium',
    status: 'To Do',
  },
  {
    type: 'exam',
    title: 'Ujian Tengah Semester Kalkulus Lanjut',
    course: 'Kalkulus Lanjut',
    description: 'UTS derivatif dan integral. Wajib membawa kalkulator ilmiah.',
    dayOffset: 6,
    hour: 8,
    priority: 'High',
    status: 'To Do',
    subtasks: [
      ['Bab 1: Limit dan Kontinuitas', true],
      ['Bab 2: Turunan', false],
      ['Bab 3: Integral', false],
      ['Latihan soal UTS', false],
    ],
  },
  {
    type: 'assignment',
    title: 'Tugas Struktur Data — Implementasi Tree Biner',
    course: 'Struktur Data',
    description: 'Implementasi insert, search, dan delete pada BST lengkap dengan analisis kompleksitas.',
    dayOffset: 9,
    hour: 20,
    priority: 'Medium',
    status: 'To Do',
  },
  {
    type: 'assignment',
    title: 'Esai Teori Ekonomi Makro — Hicksian dan Keynesian',
    course: 'Teori Ekonomi Makro',
    description: 'Esai 1.500 kata. Bandingkan model AS-AD dan model IS-LM.',
    dayOffset: 11,
    hour: 21,
    priority: 'Low',
    status: 'To Do',
  },
  {
    type: 'exam',
    title: 'Ujian Akhir Semester Struktur Data',
    course: 'Struktur Data',
    description: 'UAS mencakup seluruh bab, plus soal analisis algoritma.',
    dayOffset: 14,
    hour: 8,
    priority: 'High',
    status: 'To Do',
    subtasks: [
      ['Bab 1: Array dan Linked List', true],
      ['Bab 2: Stack dan Queue', true],
      ['Bab 3: Tree dan Graph', false],
      ['Bab 4: Sorting dan Searching', false],
      ['Latihan soal UAS', false],
    ],
  },
  {
    type: 'assignment',
    title: 'Tugas Mikrokebizarro — Elastisitas Permintaan',
    course: 'Mikroekonomi',
    description: 'Hitung elastisitas harga untuk lima 상품 pada Tabel 2.',
    dayOffset: 16,
    hour: 22,
    priority: 'Low',
    status: 'To Do',
  },
  {
    type: 'assignment',
    title: 'Tugas 2 — Aljabar Linear',
    course: 'Aljabar Linear',
    description: 'Soal 1–15 tentang ruang vektor dan basis.',
    dayOffset: -6,
    hour: 21,
    priority: 'Medium',
    status: 'Done',
  },
];

/**
 * A realistic Indonesian student's schedule, dated relative to now so every
 * visual tier (overdue, due today, upcoming) is exercised on first load.
 */
export function buildSeedItems(now: number = Date.now()): Item[] {
  return SEEDS.map((seed) => {
    const createdAt = new Date(now - 14 * DAY_MS).toISOString();
    return {
      id: createId(),
      type: seed.type,
      title: seed.title,
      course: seed.course,
      description: seed.description,
      deadline: wibISO(now, seed.dayOffset, seed.hour),
      priority: seed.priority,
      status: seed.status,
      subtasks: seed.subtasks ? subtasks(seed.subtasks) : [],
      createdAt,
      updatedAt: createdAt,
    };
  });
}
