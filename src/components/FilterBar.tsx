import { ITEM_TYPES, ITEM_TYPE_LABEL, TASK_STATUSES, type ItemType, type TaskStatus } from '../types/item';
import type { Filters } from '../context/ItemContext';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';
import { SearchIcon } from './ui/icons';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  filters: Filters;
  search: string;
  courseOptions: string[];
  resultCount: number;
  isFiltered: boolean;
  onChange: (filters: Partial<Filters>) => void;
  onSearch: (search: string) => void;
  onClear: () => void;
}

export function FilterBar({
  filters,
  search,
  courseOptions,
  resultCount,
  isFiltered,
  onChange,
  onSearch,
  onClear,
}: FilterBarProps) {
  return (
    <div className={styles.bar}>
      <div className={`${styles.item} ${styles.searchItem}`}>
        <Input
          label="Cari"
          type="search"
          value={search}
          placeholder="Judul atau mata kuliah…"
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className={styles.item}>
        <Select
          label="Jenis"
          value={filters.type}
          onChange={(event) => onChange({ type: event.target.value as ItemType | 'all' })}
        >
          <option value="all">Semua jenis</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {ITEM_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.item}>
        <Select
          label="Status"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value as TaskStatus | 'all' })}
        >
          <option value="all">Semua status</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
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
        {resultCount} item
      </span>
    </div>
  );
}
