'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Plus, Trash2, X, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';
import { fetchRobotDesigns, createRobotDesign, deleteRobotDesign, RobotDesign } from '@/lib/user-robot-designs';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ModalShell } from '@/components/ui/modal-shell';

const PAGE_SIZE = 8;

export default function RobotsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [designs, setDesigns] = useState<RobotDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  useEffect(() => {
    fetchRobotDesigns()
      .then(setDesigns)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const resetCreateFlow = () => {
    setShowCreateModal(false);
    setNameInput('');
    setDescInput('');
  };

  const handleCreate = async () => {
    const name = nameInput.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    try {
      const newDesign = await createRobotDesign({ name, description: descInput.trim() || undefined });
      setDesigns(prev => [newDesign, ...prev]);
      resetCreateFlow();
      router.push(`/robots/${newDesign.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create robot design.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      message: 'Are you sure you want to delete this robot design? Uploaded mesh files will also be removed. This cannot be undone.',
      confirmLabel: 'Delete Robot',
      danger: true,
    });
    if (!ok) return;
    const prevDesigns = designs;
    setDesigns(prev => prev.filter(d => d.id !== id));
    try {
      await deleteRobotDesign(id);
    } catch (e: any) {
      setDesigns(prevDesigns);
      toast.error(e.message || 'Failed to delete robot design.');
    }
  };

  const filteredDesigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
  }, [designs, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDesigns.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginatedDesigns = useMemo(
    () => filteredDesigns.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [filteredDesigns, clampedPage]
  );

  return (
    <div className="space-y-8 font-sans pb-4">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-display font-normal text-sand-50 tracking-tight">
            Robots
          </h1>
          <p className="text-sand-500 text-sm sm:text-base">
            Upload 3D models and build URDF descriptions by hand
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative order-2 sm:order-1">
            <Search className="h-3.5 w-3.5 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search robots"
              className="w-full sm:w-48 md:w-64 pl-9 pr-8 py-2.5 border border-sand-700 bg-sand-950 text-sand-50 text-xs focus:outline-none focus:border-emerald-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-500 hover:text-sand-200 cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="order-1 sm:order-2 btn-emerald-primary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create New Robot
          </button>
        </div>
      </div>

      {showCreateModal && (
        <ModalShell onClose={resetCreateFlow} title="Create New Robot" icon={Bot}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-sand-300 font-bold mb-1">Robot Name:</label>
              <input
                type="text"
                required
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Mobile Delivery Rover"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>
            <div>
              <label className="block text-sand-300 font-bold mb-1">Description:</label>
              <input
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Optional"
                className="w-full px-3.5 py-2.5 rounded-lg border border-sand-700 bg-sand-950 text-sand-50 focus:outline-none focus:border-emerald-primary"
              />
            </div>
            <p className="text-sand-500">You&apos;ll upload mesh files and wire up links/joints in the builder.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetCreateFlow}
                className="px-4 py-2 bg-sand-800 hover:bg-sand-700 text-sand-300 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!nameInput.trim() || isCreating}
                onClick={handleCreate}
                className="btn-emerald-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isCreating ? 'Creating...' : 'Create & Open Builder'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {isLoading ? (
        <div className="minimal-card p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto text-sand-500 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 border border-rose-200 p-4 text-rose-700 text-xs">
          <span className="font-bold">Couldn&apos;t load robots: </span>{loadError}
        </div>
      ) : filteredDesigns.length > 0 ? (
        <div className="minimal-card overflow-hidden">
          <div className="h-[calc(100vh-15rem)] min-h-64 max-h-160 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-sand-925 border-b border-sand-700 text-sand-300 font-semibold text-xs uppercase tracking-wide">
                  <th className="py-3.5 px-4">Robot</th>
                  <th className="py-3.5 px-4">Links</th>
                  <th className="py-3.5 px-4">Joints</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-700">
                {paginatedDesigns.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-sand-925 transition-colors cursor-pointer"
                    onClick={() => router.push(`/robots/${d.id}`)}
                  >
                    <td className="py-4 px-4 max-w-72">
                      <div className="font-bold text-base text-sand-50 truncate">{d.name}</div>
                    </td>
                    <td className="py-4 px-4 text-sand-300">{d.links.length}</td>
                    <td className="py-4 px-4 text-sand-300">{d.joints.length}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-2 text-rose-700 hover:bg-rose-50 border border-rose-200 font-bold transition-all cursor-pointer"
                          title="Delete Robot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-sand-800 bg-sand-925/60 text-xs">
            <span className="text-sand-500">
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filteredDesigns.length)} of {filteredDesigns.length} robot{filteredDesigns.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
                className="p-1.5 bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-sand-300 font-bold">Page {clampedPage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage >= totalPages}
                className="p-1.5 bg-sand-800 hover:bg-sand-700 text-sand-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-sand-700"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : searchQuery.trim() ? (
        <div className="minimal-card p-12 text-center space-y-4">
          <Search className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Robots Match &quot;{searchQuery}&quot;</h3>
            <p className="text-xs text-sand-500 max-w-md mx-auto">
              Try a different name, or clear the search to see all robots.
            </p>
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="btn-secondary-light py-2.5 px-5 text-xs cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="minimal-card p-12 text-center space-y-4">
          <Bot className="h-10 w-10 mx-auto text-sand-600" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-sand-50">No Robots Created Yet</h3>
            <p className="text-xs text-sand-500 max-w-md mx-auto">
              Create a robot to upload mesh files and build a URDF description by hand.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
