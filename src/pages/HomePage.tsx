import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar } from '../components/FilterBar';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { ItemFormModal } from '../components/ItemFormModal';
import { KanbanView } from '../components/KanbanView';
import { ListView } from '../components/ListView';
import { SmartDashboard } from '../components/SmartDashboard';
import { ViewToggle } from '../components/ViewToggle';
import { Button } from '../components/ui/Button';
import { PlusIcon } from '../components/ui/icons';
import { useToast } from '../components/ui/Toast';
import { useItems } from '../context/ItemContext';
import { useViewMode } from '../hooks/useViewMode';
import { TaskServiceError, ValidationError } from '../services/errors';
import type { Item, ItemDraft, TaskStatus } from '../types/item';
import styles from './HomePage.module.css';

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  if (error instanceof ValidationError) return 'Data item tidak valid.';
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

export function TaskPage() {
  const {
    status,
    error,
    visibleItems,
    dashboard,
    filters,
    search,
    courseOptions,
    isFiltered,
    reload,
    setFilters,
    setSearch,
    clearFilters,
    create,
    update,
    setStatus,
    remove,
  } = useItems();
  const toast = useToast();
  const { viewMode, setView } = useViewMode();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: Item) => {
    setDetail(null);
    setEditing(item);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (draft: ItemDraft) => {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await update(editing.id, draft);
        toast('Item berhasil diperbarui.');
      } else {
        await create(draft);
        toast('Item berhasil ditambahkan.');
      }
      setFormOpen(false);
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (item: Item, next: TaskStatus) => {
    if (next === item.status) return;
    try {
      await setStatus(item.id, next);
      toast(`"${item.title}" dipindahkan ke ${next}.`);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await remove(deleting.id);
      toast('Item berhasil dihapus.');
      setDeleting(null);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SmartDashboard
        dueToday={dashboard.dueToday}
        overdue={dashboard.overdue}
        upcomingExams={dashboard.upcomingExams}
      />

      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Semua item</h2>
        <div className={styles.toolbarActions}>
          <ViewToggle viewMode={viewMode} onChange={setView} />
          <Button variant="primary" onClick={openCreate}>
            <PlusIcon size={16} />
            Tambah item
          </Button>
        </div>
      </div>

      <FilterBar
        filters={filters}
        search={search}
        courseOptions={courseOptions}
        resultCount={visibleItems.length}
        isFiltered={isFiltered}
        onChange={setFilters}
        onSearch={setSearch}
        onClear={clearFilters}
      />

      {viewMode === 'kanban' ? (
        <KanbanView
          status={status}
          error={error}
          items={visibleItems}
          isFiltered={isFiltered}
          onRetry={() => void reload()}
          onCreate={openCreate}
          onOpen={setDetail}
          onEdit={openEdit}
          onDelete={setDeleting}
          onStatusChange={(item, next) => void handleStatusChange(item, next)}
        />
      ) : (
        <ListView
          status={status}
          error={error}
          items={visibleItems}
          isFiltered={isFiltered}
          onRetry={() => void reload()}
          onCreate={openCreate}
          onOpen={setDetail}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <ItemFormModal
        open={formOpen}
        item={editing}
        saving={saving}
        formError={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={(draft) => void handleSubmit(draft)}
      />

      <ItemDetailModal item={detail} onClose={() => setDetail(null)} onEdit={openEdit} />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus item?"
        message={deleting ? `"${deleting.title}" akan dihapus permanen.` : ''}
        confirmLabel="Hapus"
        pending={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
