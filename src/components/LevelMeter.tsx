import styles from './LevelMeter.module.css';

interface LevelMeterProps {
  level: number;
  title: string;
  /** XP into the current level, 0–99. */
  progress: number;
  /** `banner` is the dashboard card; `compact` fits the navbar. */
  variant?: 'banner' | 'compact';
}

/** The RPG level badge and its glowing XP bar. */
export function LevelMeter({
  level,
  title,
  progress,
  variant = 'banner',
}: LevelMeterProps) {
  return (
    <div
      className={`${styles.meter} ${styles[variant]}`.trim()}
      role="group"
      aria-label={`Level ${level} — ${title}`}
    >
      <span className={styles.badge} aria-hidden="true">
        Lv {level}
      </span>
      <span className={styles.title}>{title}</span>
      <span
        className={styles.track}
        role="progressbar"
        aria-label="XP menuju level berikutnya"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${progress} dari 100 XP`}
      >
        <span className={styles.fill} style={{ width: `${progress}%` }} />
      </span>
      <span className={styles.count}>{progress}/100 XP</span>
    </div>
  );
}
