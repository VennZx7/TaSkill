import type { VaultFilters } from '../context/VaultContext';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';
import { SearchIcon } from './ui/icons';
import styles from './VaultFilterBar.module.css';

interface VaultFilterBarProps {
  filters: VaultFilters;
  search: string;
  courseOptions: string[];
  tagOptions: string[];
  resultCount: number;
  isFiltered: boolean;
  onChange: (filters: Partial<VaultFilters>) => void;
  onSearch: (search: string) => void;
  onClear: () => void;
}

export function VaultFilterBar({
  filters,
  search,
  courseOptions,
  tagOptions,
  resultCount,
  isFiltered,
  onChange,
  onSearch,
  onClear,
}: VaultFilterBarProps) {
  return (
    <div className={styles.row}>
      <div className={`${styles.item} ${styles.searchItem}`}>
        <Input
          label="Cari materi"
          type="search"
          value={search}
          placeholder="Judul, isi, atau tag…"
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className={styles.item}>
        <Select
          label="Tag"
          value={filters.tag}
          onChange={(event) => onChange({ tag: event.target.value })}
        >
          <option value="">Semua tag</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.item}>
        <Select
          label="Mata kuliah"
          value={filters.course}
          onChange={(event) => onChange({ course: event.target.value })}
        >
          <option value="">Semua mata kuliah</option>
          {courseOptions.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </Select>
      </div>

      {isFiltered ? (
        <Button variant="ghost" onClick={onClear}>
          Reset filter
        </Button>
      ) : null}

      <span className={styles.count}>
        {isFiltered ? <SearchIcon size={14} /> : null}
        {resultCount} materi
      </span>
    </div>
  );
}