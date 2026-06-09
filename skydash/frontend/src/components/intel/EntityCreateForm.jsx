import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { toast } from '../common/Toast';
import { apiFetch } from '../../utils/api';
import { API_BASE } from '../../utils/runtimeConfig';

const API = API_BASE;
const TYPES = ['vehicle', 'person', 'building', 'device', 'event', 'organization'];
const THREATS = ['none', 'low', 'medium', 'high', 'critical'];
const THREAT_DOT = { none: 'bg-zinc-500', low: 'bg-emerald-500', medium: 'bg-amber-500', high: 'bg-red-500', critical: 'bg-red-600' };
const Label = ({ children }) => (
  <label className="block text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-1.5">{children}</label>
);
const inputCls = 'w-full px-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/30 transition-colors';
const INITIAL = { name: '', type: 'vehicle', threatLevel: 'none', confidence: 75, lat: '', lng: '', source: 'Manual Entry', tags: [], props: [] };

export default function EntityCreateForm({ open, onClose }) {
  const [form, setForm] = useState(INITIAL);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = useCallback((key, val) => setForm((f) => ({ ...f, [key]: val })), []);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  }, [tagInput, form.tags, set]);
  const removeTag = (t) => set('tags', form.tags.filter((x) => x !== t));
  const addProp = () => set('props', [...form.props, { key: '', value: '' }]);
  const removeProp = (i) => set('props', form.props.filter((_, j) => j !== i));
  const updateProp = (i, field, val) => set('props', form.props.map((p, j) => (j === i ? { ...p, [field]: val } : p)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    const properties = {};
    form.props.forEach(({ key, value }) => { if (key.trim()) properties[key.trim()] = value; });
    const coordinates = form.lat !== '' && form.lng !== '' ? [parseFloat(form.lat), parseFloat(form.lng)] : null;
    const payload = {
      name: form.name.trim(), type: form.type, threatLevel: form.threatLevel,
      confidence: form.confidence, source: form.source.trim() || 'Manual Entry',
      tags: form.tags, properties, ...(coordinates ? { coordinates } : {}),
    };
    try {
      const res = await apiFetch(`${API}/api/entities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const entity = { ...json.data, firstSeen: Date.now(), lastSeen: Date.now() };
        useIntelStore.getState().addEntity(entity);
        useIntelStore.getState().selectEntity(entity.id);
        toast('Entity created successfully', 'success');
        setForm(INITIAL); onClose();
      } else { toast(json.error || 'Failed to create entity', 'error'); }
    } catch {
      const entity = { ...payload, firstSeen: Date.now(), lastSeen: Date.now() };
      useIntelStore.getState().addEntity(entity);
      toast('Entity created locally (offline)', 'warning');
      setForm(INITIAL); onClose();
    } finally { setSubmitting(false); }
  };

  const close = () => { setForm(INITIAL); setTagInput(''); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <motion.form onSubmit={handleSubmit}
            initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-zinc-900/95 border border-white/[0.1] rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h2 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-400">CREATE ENTITY</h2>
              <button type="button" onClick={close} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={14} /></button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div>
                <Label>NAME</Label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Entity name..." className={inputCls} autoFocus required />
              </div>
              <div>
                <Label>TYPE</Label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
                  {TYPES.map((t) => <option key={t} value={t} className="bg-zinc-900">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <Label>THREAT LEVEL</Label>
                <div className="flex gap-3 flex-wrap">
                  {THREATS.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer group">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${form.threatLevel === t ? 'border-indigo-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                        {form.threatLevel === t && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </span>
                      <span className="text-[10px] text-zinc-400 tracking-wider uppercase">{t}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${THREAT_DOT[t]}`} />
                      <input type="radio" name="threat" value={t} checked={form.threatLevel === t} onChange={() => set('threatLevel', t)} className="sr-only" />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>CONFIDENCE</Label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={form.confidence} onChange={(e) => set('confidence', +e.target.value)}
                    className="flex-1 h-1 appearance-none bg-zinc-800 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                  <span className="text-xs font-mono tabular-nums text-indigo-400 w-8 text-right">{form.confidence}%</span>
                </div>
              </div>
              <div>
                <Label>COORDINATES (OPTIONAL)</Label>
                <div className="flex gap-2">
                  <input type="number" step="0.0001" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="Lat" className={inputCls} />
                  <input type="number" step="0.0001" value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="Lng" className={inputCls} />
                </div>
              </div>
              <div>
                <Label>SOURCE</Label>
                <input value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="Manual Entry" className={inputCls} />
              </div>
              <div>
                <Label>TAGS</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px]">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-indigo-200 transition-colors"><X size={8} /></button>
                    </span>
                  ))}
                </div>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Type tag, press Enter..." className={inputCls} />
              </div>
              <div>
                <Label>PROPERTIES</Label>
                <div className="space-y-1.5">
                  {form.props.map((p, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input value={p.key} onChange={(e) => updateProp(i, 'key', e.target.value)} placeholder="Key" className={`${inputCls} flex-1`} />
                      <input value={p.value} onChange={(e) => updateProp(i, 'value', e.target.value)} placeholder="Value" className={`${inputCls} flex-1`} />
                      <button type="button" onClick={() => removeProp(i)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addProp} className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-indigo-400 tracking-wider transition-colors">
                  <Plus size={10} /> ADD PROPERTY
                </button>
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
              <button type="button" onClick={close} className="px-4 py-1.5 text-[10px] tracking-wider text-zinc-500 hover:text-zinc-300 rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                CANCEL
              </button>
              <button type="submit" disabled={submitting || !form.name.trim()}
                className="px-4 py-1.5 text-[10px] tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
                {submitting ? 'CREATING...' : 'CREATE ENTITY'}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
