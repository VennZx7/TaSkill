import type { ReactNode } from 'react';
import { Button } from './ui/Button';
import { AlertIcon, CheckCircleIcon, PlusIcon, SearchIcon } from './ui/icons';
import styles from './CollectionStates.module.css';

/** Copy for the two empty cases. They must read differently: "no results" is
 * not the same as "nothing here yet". */
export interface EmptyCopy {
  noItemsTitle: string;
  noItemsBody: string;
  noItemsAction: string;
  noResultsTitle: string;
  noResultsBody: string;
}

export const SCHEDULER_EMPTY: EmptyCopy = {
  noItemsTitle: 'Belum ada tugas atau ujian',
  noItemsBody: 'Tambahkan tugas pertama Anda beserta deadline-nya.',
  noItemsAction: 'Tambah item',
  noResultsTitle: 'Tidak ada item yang cocok',
  noResultsBody: 'Coba ubah atau reset filter untuk melihat item lainnya.',
};

export const VAULT_EMPTY: EmptyCopy = {
  noItemsTitle: 'Vault masih kosong',
  noItemsBody: 'Simpan catatan kuliah, tautan, atau dokumen referensi pertama Anda.',
  noItemsAction: 'Simpan materi',
  noResultsTitle: 'Tidak ada materi yang cocok',
  noResultsBody: 'Coba ubah kata kunci, tag, atau mata kuliah yang dipilih.',
};

export const FLASHCARD_EMPTY: EmptyCopy = {
  noItemsTitle: 'Belum ada deck flashcard',
  noItemsBody: 'Biarkan Gemini menyusun kartu tanya-jawab dari materi di Study Vault.',
  noItemsAction: 'Generate dengan AI',
  noResultsTitle: 'Tidak ada deck yang cocok',
  noResultsBody: 'Coba ubah kata kunci atau mata kuliah yang dipilih.',
};

interface CollectionStatesProps {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  isEmpty: boolean;
  isFiltered: boolean;
  empty: EmptyCopy;
  loading: ReactNode;
  onRetry: () => void;
  onCreate: () => void;
  children: ReactNode;
}

/**
 * Shared shell for every collection surface: while data is loading, broken, or
 * empty there is only one thing to show, so it is written once here.
 */
export function CollectionStates({
  status,
  error,
  isEmpty,
  isFiltered,
  empty,
  loading,
  onRetry,
  onCreate,
  children,
}: CollectionStatesProps) {
  if (status === 'loading') return <>{loading}</>;

  if (status === 'error') {
    return (
      <div className={`${styles.state} ${styles.errorState}`} role="alert">
        <span className={`${styles.iconWrap} ${styles.iconError}`}>
          <AlertIcon size={26} />
        </span>
        <h2 className={styles.heading}>Gagal memuat data</h2>
        <p className={styles.body}>{error ?? 'Terjadi kesalahan yang tidak diketahui.'}</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={styles.state}>
        <span className={styles.iconWrap}>
          {isFiltered ? <SearchIcon size={26} /> : <CheckCircleIcon size={26} />}
        </span>
        <h2 className={styles.heading}>
          {isFiltered ? empty.noResultsTitle : empty.noItemsTitle}
        </h2>
        <p className={styles.body}>{isFiltered ? empty.noResultsBody : empty.noItemsBody}</p>
        <div className={styles.actions}>
          {isFiltered ? null : (
            <Button variant="primary" onClick={onCreate}>
              <PlusIcon size={16} />
              {empty.noItemsAction}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
