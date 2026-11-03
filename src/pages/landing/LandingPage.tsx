import { BrandMarkIcon, CalendarIcon, CardsIcon, PlayIcon, SparkleIcon, VaultIcon } from '../../components/ui/icons';
import styles from './LandingPage.module.css';

interface LandingPageProps { onEnter: () => void }

const modules = [
  { title: 'Jadwal kuliah', text: 'Atur tugas, ujian, dan target belajarmu.', Icon: CalendarIcon, tone: 'purple' },
  { title: 'Study Vault', text: 'Simpan catatan dan dokumen per mata kuliah.', Icon: VaultIcon, tone: 'blue' },
  { title: 'Focus', text: 'Jaga ritme belajar dengan Pomodoro.', Icon: PlayIcon, tone: 'orange' },
  { title: 'Quiz & AI', text: 'Ubah materi jadi latihan dan flashcard.', Icon: SparkleIcon, tone: 'green' },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className={styles.landing}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandMark}><BrandMarkIcon size={22} /></span><span className={styles.brandName}>TaSkill</span></div>
        <button type="button" className={styles.enterGhost} onClick={onEnter}>Masuk ke aplikasi</button>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.kicker}><SparkleIcon size={16} /> Teman belajar harianmu</span>
            <h1 className={styles.title}>Atur tugas, kuis &amp; fokus <span className={styles.titleShift}>tanpa ribet.</span></h1>
            <p className={styles.subtitle}>Jadwal, materi, dan latihan dalam satu tempat. Bikin kegiatan kuliah terasa lebih ringan dan terarah.</p>
            <div className={styles.ctaRow}>
              <button type="button" className={styles.ctaPrimary} onClick={onEnter}>Mulai Sekarang <span aria-hidden="true">→</span></button>
              <button type="button" className={styles.ctaGhost} onClick={onEnter}>Lihat Dashboard</button>
            </div>
          </div>

          <div className={styles.heroPanel} aria-label="Pratinjau TaSkill">
            <div className={styles.previewHead}><span className={styles.previewIcon}><CalendarIcon size={19} /></span><div><strong>Rencana hari ini</strong><small>Belajar selangkah demi selangkah</small></div><span className={styles.streak}>🔥 5 hari</span></div>
            <article className={styles.previewTask}><span className={styles.taskMark} /><div className={styles.panelText}><strong>Tugas 3 — Matriks dan Determinan</strong><span>Kalkulus Lanjut · Hari ini, 23.00</span></div><span className={styles.due}>Hari ini</span></article>
            <article className={styles.previewTask}><span className={`${styles.taskMark} ${styles.markGold}`} /><div className={styles.panelText}><strong>Persiapan UTS Fisika Dasar</strong><span>4 dari 8 topik selesai</span></div><span className={styles.dueSoft}>50%</span></article>
            <div className={styles.previewProgress}><div className={styles.progressLabel}><span><CardsIcon size={15} /> Level 4 · Tekun</span><strong>72/100 XP</strong></div><div className={styles.progressTrack}><span /></div></div>
          </div>
        </section>

        <section className={styles.features}>
          <header className={styles.featuresHeader}><span className={styles.featuresKicker}>SATU RUANG UNTUK BELAJAR</span><h2 className={styles.featuresTitle}>Kuliah lebih teratur, belajar lebih seru.</h2></header>
          <div className={styles.featureGrid}>
            {modules.map(({ title, text, Icon, tone }) => (
              <article className={styles.featureCard} key={title}>
                <span className={`${styles.featureIcon} ${styles[tone]}`}><Icon size={22} /></span>
                <h3 className={styles.featureName}>{title}</h3><p className={styles.featureDesc}>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}><span>TaSkill · Belajar dengan lebih terarah</span><button type="button" className={styles.footerCta} onClick={onEnter}>Masuk ke aplikasi →</button></footer>
    </div>
  );
}

export default LandingPage;
