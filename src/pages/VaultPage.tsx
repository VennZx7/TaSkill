import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { VaultFilterBar } from '../components/VaultFilterBar';
import { VaultFormModal } from '../components/VaultFormModal';
import { VaultView } from '../components/VaultView';
import { Button } from '../components/ui/Button';
import { PlusIcon } from '../components/ui/icons';
import { useToast } from '../components/ui/Toast';
import { useVault } from '../context/VaultContext';
import { TaskServiceError, ValidationError } from '../services/errors';
import type { VaultDraft, VaultItem } from '../types/vault';
import styles from './VaultPage.module.css';

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  if (error instanceof ValidationError) return 'Data materi tidak valid.';
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

export function VaultPage() {
  const {
    status,
    error,
    visibleItems,
    filters,
    search,
    courseOptions,
    tagOptions,
    isFiltered,
    reload,
    setFilters,
    setSearch,
    clearFilters,
    create,
    update,
    setRead,
    remove,
  } = useVault();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [deleting, setDeleting] = useState<VaultItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: VaultItem) => {
    setEditing(item);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (draft: VaultDraft) => {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await update(editing.id, draft);
        toast('Materi berhasil diperbarui.');
      } else {
        await create(draft);
        toast('Materi berhasil disimpan.');
      }
      setFormOpen(false);
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await remove(deleting.id);
      toast('Materi berhasil dihapus.');
      setDeleting(null);
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRead = async (item: VaultItem) => {
    try {
      await setRead(item.id, !item.isRead);
      toast(
        item.isRead
          ? `"${item.title}" ditandai belum dibaca.`
          : `"${item.title}" ditandai sudah dibaca.`,
      );
    } catch (caught) {
      toast({ message: messageOf(caught), tone: 'error' });
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.heading}>Study Vault</h2>
          <p className={styles.subheading}>
            Catatan kuliah, tautan, dan dokumen yang disimpan untuk dibaca ulang.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon size={16} />
          Simpan materi
        </Button>
      </div>

      <VaultFilterBar
        filters={filters}
        search={search}
        courseOptions={courseOptions}
        tagOptions={tagOptions}
        resultCount={visibleItems.length}
        isFiltered={isFiltered}
        onChange={setFilters}
        onSearch={setSearch}
        onClear={clearFilters}
      />

      <VaultView
        status={status}
        error={error}
        items={visibleItems}
        isFiltered={isFiltered}
        onRetry={() => void reload()}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setDeleting}
        onToggleRead={(item) => void handleToggleRead(item)}
      />

      <VaultFormModal
        open={formOpen}
        item={editing}
        saving={saving}
        formError={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={(draft) => void handleSubmit(draft)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus materi?"
        message={deleting ? `"${deleting.title}" akan dihapus permanen dari vault.` : ''}
        confirmLabel="Hapus"
        pending={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}