import styles from './LandingPage.module.css';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className={styles.landing}>
      <div className={styles.bgGrid} aria-hidden="true" />
      <div className={styles.bgAurora} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
              <defs>
                <linearGradient id="lp-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--hue-a)" />
                  <stop offset="0.5" stopColor="var(--hue-b)" />
                  <stop offset="1" stopColor="var(--hue-d)" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#lp-g)" />
              <path
                d="M16 7.6 18.3 13.7 24.4 16 18.3 18.3 16 24.4 13.7 18.3 7.6 16 13.7 13.7Z"
                fill="var(--primary-label)"
              />
            </svg>
          </span>
          <span className={styles.brandName}>TaSkill</span>
          <span className={styles.brandTag}>Y2K • Glass • Focus</span>
        </div>
        <button type="button" className={styles.enterGhost} onClick={onEnter}>
          Masuk ke App
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.kicker}>
              <span className={styles.kickerDot} />
              <span>STUDENT OS</span>
            </div>
            <h1 className={styles.title}>
              Atur tugas, kuis & fokus
              <span className={styles.titleShift}>tanpa berantakan</span>
            </h1>
            <p className={styles.subtitle}>
              Satu ruang buat jadwal, study vault, pomodoro, quiz, dan AI assistant. Dibangun
              buat workflow harian, bukan cuma demo.
            </p>
            <div className={styles.ctaRow}>
              <button type="button" className={styles.ctaPrimary} onClick={onEnter}>
                Mulai Sekarang
                <span className={styles.ctaArrow}>→</span>
              </button>
              <button type="button" className={styles.ctaGhost} onClick={onEnter}>
                Lihat Dashboard
              </button>
            </div>
            <div className={styles.metaRow}>
              <div className={styles.metaPill}>
                <span className={styles.metaLabel}>MODE</span>
                <span className={styles.metaValue}>FOCUS / STUDY</span>
              </div>
              <div className={styles.metaPill}>
                <span className={styles.metaLabel}>UI</span>
                <span className={styles.metaValue}>GLASSMORPHISM • Y2K</span>
              </div>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelFrame}>
              <div className={styles.panelHeader}>
                <div className={styles.panelDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <span className={styles.panelTitle}>TASK_STREAM</span>
                <span className={styles.panelStatus}>LIVE</span>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.panelRow}>
                  <span className={styles.panelTag}>ASSIGN</span>
                  <div className={styles.panelText}>
                    <span className={styles.panelMain}>Tugas 3 — Matriks & Determinan</span>
                    <span className={styles.panelSub}>Kalkulus Lanjut • Due 23 Okt</span>
                  </div>
                  <span className={styles.panelChip}>URGENT</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelTag}>EXAM</span>
                  <div className={styles.panelText}>
                    <span className={styles.panelMain}>UTS Fisika Dasar</span>
                    <span className={styles.panelSub}>Persiapan • 12 subtask</span>
                  </div>
                  <span className={styles.panelChipSoft}>SOON</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelTag}>FOCUS</span>
                  <div className={styles.panelText}>
                    <span className={styles.panelMain}>Pomodoro 25m</span>
                    <span className={styles.panelSub}>Deep work session</span>
                  </div>
                  <span className={styles.panelChipSoft}>RUNNING</span>
                </div>
                <div className={styles.panelDivider} />
                <div className={styles.panelStats}>
                  <div className={styles.statBlock}>
                    <span className={styles.statNum}>3</span>
                    <span className={styles.statLabel}>DUE TODAY</span>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statNum}>1</span>
                    <span className={styles.statLabel}>OVERDUE</span>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statNum}>2</span>
                    <span className={styles.statLabel}>UPCOMING</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.panelGlow} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.features}>
          <header className={styles.featuresHeader}>
            <span className={styles.featuresKicker}>MODULES</span>
            <h2 className={styles.featuresTitle}>Semua yang kamu butuhin</h2>
          </header>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}>
                <span className={styles.featureIcon}>▦</span>
                <span className={styles.featureIndex}>01</span>
              </div>
              <h3 className={styles.featureName}>Dashboard & Jadwal</h3>
              <p className={styles.featureDesc}>
                Due today, overdue, upcoming. List/Kanban, filter & search yang nyambung.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}>
                <span className={styles.featureIcon}>⧉</span>
                <span className={styles.featureIndex}>02</span>
              </div>
              <h3 className={styles.featureName}>Study Vault</h3>
              <p className={styles.featureDesc}>
                Kumpulin materi, tag, pin, dan simpan referensi buat review cepat.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}>
                <span className={styles.featureIcon}>◷</span>
                <span className={styles.featureIndex}>03</span>
              </div>
              <h3 className={styles.featureName}>Pomodoro Focus</h3>
              <p className={styles.featureDesc}>
                Sesi fokus terstruktur, break yang sehat, tanpa distraksi berlebihan.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureTop}>
                <span className={styles.featureIcon}>◇</span>
                <span className={styles.featureIndex}>04</span>
              </div>
              <h3 className={styles.featureName}>Quiz & AI Assistant</h3>
              <p className={styles.featureDesc}>
                Bikin kuis dari materi, belajar interaktif, dibantu AI buat klarifikasi.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>TaSkill</span>
          <span className={styles.footerText}>Built for focused study • Y2K glass interface</span>
          <button type="button" className={styles.footerCta} onClick={onEnter}>
            Masuk
          </button>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
