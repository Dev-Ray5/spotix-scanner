'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Search, ChevronRight, Save, Trash2, Camera,
  CheckCircle, XCircle, AlertTriangle, ArrowLeft, UserPlus,
  Loader2, RefreshCw, ScanFace, X, RotateCcw,
} from 'lucide-react';
import type { Guest } from '../../types/guest';
import { useFaceRecognition } from '../../lib/useFaceRecognition';
import FaceMarker, { FaceHintBar } from '../../components/scanner/FaceMarker';

const FASTIFY_URL = 'http://127.0.0.1:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuestFormData {
  fullName: string;
  email: string;
  ticketId: string;
  ticketType: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  faceEmbedding: number[] | null;
}

const EMPTY_FORM: GuestFormData = {
  fullName: '', email: '', ticketId: '', ticketType: '',
  checkedIn: false, checkedInAt: null, checkedInBy: null, faceEmbedding: null,
};

interface Toast { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastCounter = 0;

// ─── Face Enroll Modal ────────────────────────────────────────────────────────

function FaceEnrollModal({ onCapture, onClose }: { onCapture: (e: number[]) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capRef    = useRef(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { faceState, isReady, loadError, startDetection, stopDetection, captureEmbedding, retry } = useFaceRecognition();

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      }).catch(err => console.error('[Enroll] Camera error:', err));
    return () => {
      cancelled = true; stopDetection();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (faceState !== 'ready' || capRef.current) return;
    timerRef.current = setTimeout(async () => {
      if (!videoRef.current || capRef.current) return;
      capRef.current = true;
      const embedding = await captureEmbedding(videoRef.current);
      if (embedding) onCapture(embedding);
      capRef.current = false;
    }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [faceState]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ScanFace size={16} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">Enroll Face</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"><X size={14} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <FaceMarker videoRef={videoRef} faceState={faceState} isReady={isReady} loadError={loadError}
            onRetry={retry} onStartDetection={startDetection} onStopDetection={stopDetection} />
          <FaceHintBar faceState={faceState} />
          <p className="text-xs text-white/20 text-center">Hold still — face will be captured automatically</p>
        </div>
      </div>
    </div>
  );
}

// ─── Uncheck-in Warning Modal ─────────────────────────────────────────────────

function UncheckInModal({ guestName, onConfirm, onCancel }: { guestName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-400/10 flex items-center justify-center">
            <AlertTriangle size={28} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Remove Check-in?</h3>
            <p className="text-sm text-white/40 mt-2">This will mark <span className="text-white/70 font-medium">{guestName}</span> as not checked in.</p>
            <p className="text-xs text-amber-400/80 mt-3 bg-amber-400/5 border border-amber-400/20 rounded-xl px-3 py-2">
              If this ticket is presented at the gate again, it will be accepted.
            </p>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.10] transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors">Remove Check-in</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Warning Modal ─────────────────────────────────────────────────────

function DeleteModal({ guestName, onConfirm, onCancel }: { guestName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center">
            <Trash2 size={28} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Delete Guest?</h3>
            <p className="text-sm text-white/40 mt-2"><span className="text-white/70 font-medium">{guestName}</span> will be permanently removed from the registry.</p>
            <p className="text-xs text-red-400/80 mt-3 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">This cannot be undone.</p>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.10] transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Guest Detail Panel ───────────────────────────────────────────────────────

function GuestDetailPanel({ guest, isNew, onSave, onDelete, onClose, addToast }: {
  guest: Guest | null; isNew: boolean;
  onSave: (data: GuestFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  addToast: (type: Toast['type'], message: string) => void;
}) {
  const [form, setForm]                       = useState<GuestFormData>(EMPTY_FORM);
  const [saving, setSaving]                   = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [showFaceModal, setShowFaceModal]     = useState(false);
  const [showUncheckModal, setShowUncheckModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dirty, setDirty]                     = useState(false);

  useEffect(() => {
    if (guest) {
      setForm({
        fullName: guest.fullName, email: guest.email,
        ticketId: guest.ticketId, ticketType: guest.ticketType,
        checkedIn: guest.checkedIn, checkedInAt: guest.checkedInAt,
        checkedInBy: guest.checkedInBy, faceEmbedding: guest.faceEmbedding,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setDirty(false);
  }, [guest, isNew]);

  const update = (key: keyof GuestFormData, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.ticketId.trim() || !form.ticketType.trim()) {
      addToast('error', 'All fields except face embedding are required'); return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setDirty(false);
      addToast('success', isNew ? 'Guest added successfully' : 'Guest updated successfully');
    } catch (err: any) {
      addToast('error', err?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!guest) return;
    setDeleting(true);
    try {
      await onDelete(guest.id);
      addToast('success', 'Guest deleted');
    } catch (err: any) {
      addToast('error', err?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDeleteModal(false); }
  };

  const handleFaceCapture = (embedding: number[]) => {
    update('faceEmbedding', embedding);
    setShowFaceModal(false);
    addToast('success', 'Face captured — save to apply');
  };

  const handleUncheckConfirm = () => {
    setForm(prev => ({ ...prev, checkedIn: false, checkedInAt: null, checkedInBy: null }));
    setDirty(true);
    setShowUncheckModal(false);
  };

  const inputCls = 'w-full bg-[#0f0f0f] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/40 transition-colors';
  const labelCls = 'text-xs text-white/40 uppercase tracking-wider font-medium';

  return (
    <>
      {/* Panel header — fixed */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          {isNew
            ? <><UserPlus size={15} className="text-brand-400" /><span className="text-sm font-semibold text-white">New Guest</span></>
            : <><Users size={15} className="text-white/50" /><span className="text-sm font-semibold text-white truncate max-w-[200px]">{guest?.fullName}</span></>
          }
          {dirty && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" title="Unsaved changes" />}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">

        {!isNew && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
            form.checkedIn ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-white/[0.02] border-white/[0.06]'
          }`}>
            <div className="flex items-center gap-2">
              {form.checkedIn ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-white/20" />}
              <div>
                <p className={`text-xs font-medium ${form.checkedIn ? 'text-emerald-400' : 'text-white/30'}`}>
                  {form.checkedIn ? 'Checked In' : 'Not Checked In'}
                </p>
                {form.checkedIn && form.checkedInAt && (
                  <p className="text-[10px] text-white/20 mt-0.5">
                    {new Date(form.checkedInAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {form.checkedInBy ? ` · ${form.checkedInBy}` : ''}
                  </p>
                )}
              </div>
            </div>
            {form.checkedIn && (
              <button onClick={() => setShowUncheckModal(true)} className="flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-400 transition-colors">
                <RotateCcw size={11} /> Undo
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Full Name</label>
          <input type="text" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="e.g. Adaeze Okonkwo" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="guest@example.com" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Ticket ID</label>
          <input type="text" value={form.ticketId} onChange={e => update('ticketId', e.target.value)}
            placeholder="e.g. TKT-001" disabled={!isNew}
            className={`${inputCls} font-mono ${!isNew ? 'opacity-50 cursor-not-allowed' : ''}`} />
          {!isNew && <p className="text-[10px] text-white/20">Ticket ID cannot be changed after creation</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Ticket Type</label>
          <input type="text" value={form.ticketType} onChange={e => update('ticketType', e.target.value)} placeholder="e.g. VIP, Regular, Early Bird" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Face Recognition</label>
          <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f0f] border border-white/[0.08] rounded-xl">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${form.faceEmbedding ? 'bg-emerald-400/10' : 'bg-white/[0.04]'}`}>
              <ScanFace size={14} className={form.faceEmbedding ? 'text-emerald-400' : 'text-white/20'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60">{form.faceEmbedding ? 'Face data enrolled' : 'No face data'}</p>
              {form.faceEmbedding && <p className="text-[10px] text-white/20 mt-0.5">128-dimensional embedding</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {form.faceEmbedding && (
                <button onClick={() => update('faceEmbedding', null)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">Clear</button>
              )}
              <button onClick={() => setShowFaceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium hover:bg-brand-500/20 transition-colors">
                <Camera size={11} />{form.faceEmbedding ? 'Re-enroll' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions — fixed at bottom */}
      <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0 flex flex-col gap-2">
        <button onClick={handleSave} disabled={saving || !dirty}
          className="w-full py-3 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-600 transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> {isNew ? 'Add Guest' : 'Save Changes'}</>}
        </button>
        {!isNew && guest && (
          <button onClick={() => setShowDeleteModal(true)} disabled={deleting}
            className="w-full py-2.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400/70 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center justify-center gap-2">
            {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete Guest</>}
          </button>
        )}
      </div>

      {showFaceModal   && <FaceEnrollModal onCapture={handleFaceCapture} onClose={() => setShowFaceModal(false)} />}
      {showUncheckModal && <UncheckInModal guestName={form.fullName} onConfirm={handleUncheckConfirm} onCancel={() => setShowUncheckModal(false)} />}
      {showDeleteModal && guest && <DeleteModal guestName={guest.fullName} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagePage() {
  const router = useRouter();

  const [guests, setGuests]         = useState<Guest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew]           = useState(false);
  const [toasts, setToasts]         = useState<Toast[]>([]);

  const selectedGuest = guests.find(g => g.id === selectedId) ?? null;

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const loadGuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FASTIFY_URL}/api/guests`);
      if (res.ok) setGuests(await res.json() as Guest[]);
    } catch { addToast('error', 'Failed to load guests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGuests(); }, [loadGuests]);

  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    return g.fullName.toLowerCase().includes(q) || g.ticketId.toLowerCase().includes(q)
      || g.email.toLowerCase().includes(q) || g.ticketType.toLowerCase().includes(q);
  });

  const handleSave = async (data: GuestFormData) => {
    if (isNew) {
      const res = await fetch(`${FASTIFY_URL}/api/guests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed to create guest'); }
      const created = await res.json() as Guest;
      setGuests(prev => [created, ...prev]);
      setSelectedId(created.id);
      setIsNew(false);
    } else if (selectedGuest) {
      const res = await fetch(`${FASTIFY_URL}/api/guests/${selectedGuest.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed to update guest'); }
      const updated = await res.json() as Guest;
      setGuests(prev => prev.map(g => g.id === updated.id ? updated : g));
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${FASTIFY_URL}/api/guests/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete guest');
    setGuests(prev => prev.filter(g => g.id !== id));
    setSelectedId(null);
    setIsNew(false);
  };

  const showPanel = isNew || selectedId !== null;

  return (
    // ── Full-screen container — NO overflow on this element ──────────────────
    <div className="h-screen bg-[#0f0f0f] flex flex-col overflow-hidden">

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border animate-fade-in pointer-events-auto ${
            t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            t.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                   'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {t.type === 'success' && <CheckCircle size={14} />}
            {t.type === 'error'   && <XCircle size={14} />}
            {t.type === 'warning' && <AlertTriangle size={14} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Top bar — fixed height, never scrolls */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0f0f0f] flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors" title="Back to Dashboard">
            <ArrowLeft size={15} />
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
        <div className="w-7 h-7 rounded-lg overflow-hidden">
          <img src="/logo.png" alt="Spotix" className="w-full h-full object-cover" />
        </div>
          <span className="text-sm font-semibold text-white">Manage Registry</span>
          <span className="text-xs text-white/20 hidden sm:block">{guests.length} guest{guests.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadGuests} disabled={loading}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setIsNew(true); setSelectedId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors">
            <Plus size={13} /> Add Guest
          </button>
        </div>
      </header>

      {/* Body — fills remaining height, children manage their own scroll */}
      <div className="flex-1 flex min-h-0">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={`flex flex-col bg-[#0f0f0f] border-r border-white/[0.06] flex-shrink-0 ${showPanel ? 'w-72' : 'w-full'}`}>

          {/* Search — fixed within sidebar */}
          <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, ticket ID, email..."
                className="w-full bg-[#141414] border border-white/[0.06] rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-white/20 outline-none focus:border-brand-500/30 transition-colors" />
            </div>
          </div>

          {/* Guest list — THIS is the scroll container for the list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-40 gap-2">
                <Loader2 size={16} className="animate-spin text-white/20" />
                <span className="text-xs text-white/20">Loading...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <Users size={24} className="text-white/10" />
                <p className="text-xs text-white/20">{search ? 'No results found' : 'No guests yet'}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filtered.map(guest => (
                  <button key={guest.id} onClick={() => { setSelectedId(guest.id); setIsNew(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] ${
                      selectedId === guest.id ? 'bg-brand-500/5 border-r-2 border-brand-500' : ''
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      guest.checkedIn ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.06] text-white/40'
                    }`}>
                      {guest.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white truncate">{guest.fullName}</span>
                        {guest.faceEmbedding && <ScanFace size={10} className="text-brand-400/60 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-white/30 font-mono truncate">{guest.ticketId}</span>
                        <span className="text-white/10">·</span>
                        <span className="text-[10px] text-white/20 truncate">{guest.ticketType}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {guest.checkedIn && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      <ChevronRight size={12} className="text-white/10" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stats footer — fixed within sidebar */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex-shrink-0 grid grid-cols-3 divide-x divide-white/[0.06]">
            {[
              { label: 'Total',      value: guests.length,                              color: 'text-white/60'    },
              { label: 'Checked In', value: guests.filter(g => g.checkedIn).length,     color: 'text-emerald-400' },
              { label: 'With Face',  value: guests.filter(g => g.faceEmbedding).length, color: 'text-brand-400'   },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center px-2">
                <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
                <p className="text-[9px] text-white/20 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Detail panel ─────────────────────────────────────────────────── */}
        {showPanel && (
          // flex-col + min-h-0 so inner scroll works correctly
          <main className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d]">
            <GuestDetailPanel
              guest={isNew ? null : selectedGuest}
              isNew={isNew}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={() => { setSelectedId(null); setIsNew(false); }}
              addToast={addToast}
            />
          </main>
        )}
      </div>
    </div>
  );
}