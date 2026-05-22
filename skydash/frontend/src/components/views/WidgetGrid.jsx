import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, X, Plus, RotateCcw } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import WidgetRenderer, { WIDGET_LABELS } from './DashboardWidgets';
import { AddWidgetPicker, ResizeHandle } from './WidgetControls';
import { useWidgetStore } from '../../stores/widgetStore';

const ROW_H = 48;
const COLS = 12;
const EASE = [0.16, 1, 0.3, 1];

/* ─── Draggable Widget Cell ────────────────────────────── */

function WidgetCell({ widget, editMode, onSwapDrag }) {
  const removeWidget = useWidgetStore((s) => s.removeWidget);

  const style = {
    gridColumn: `${widget.x} / span ${widget.w}`,
    gridRow: `${widget.y} / span ${widget.h}`,
    minHeight: widget.h * ROW_H,
  };

  const handleDragStart = useCallback((e) => {
    if (!editMode) return;
    e.dataTransfer.setData('text/plain', widget.id);
    e.dataTransfer.effectAllowed = 'move';
  }, [editMode, widget.id]);

  const handleDragOver = useCallback((e) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [editMode]);

  const handleDrop = useCallback((e) => {
    if (!editMode) return;
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== widget.id) onSwapDrag(sourceId, widget.id);
  }, [editMode, widget.id, onSwapDrag]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: EASE }}
      style={style}
      className="group relative"
      draggable={editMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <GlassCard
        className={`!p-3 h-full flex flex-col ${editMode ? 'ring-1 ring-indigo-500/20 hover:ring-indigo-500/40' : ''}`}
        animate={false}
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {editMode && <GripVertical size={12} className="text-zinc-600 cursor-grab active:cursor-grabbing" />}
            <span className="text-[8px] font-semibold tracking-[0.12em] text-zinc-600">
              {WIDGET_LABELS[widget.type] || widget.type.toUpperCase()}
            </span>
          </div>
          {editMode && (
            <button onClick={() => removeWidget(widget.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
              <X size={10} />
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <WidgetRenderer type={widget.type} config={widget.config} />
        </div>
        {editMode && <ResizeHandle widgetId={widget.id} currentW={widget.w} currentH={widget.h} />}
      </GlassCard>
    </motion.div>
  );
}

/* ─── Main Grid ────────────────────────────────────────── */

export default function WidgetGrid() {
  const widgets = useWidgetStore((s) => s.widgets);
  const editMode = useWidgetStore((s) => s.editMode);
  const toggleEditMode = useWidgetStore((s) => s.toggleEditMode);
  const addWidget = useWidgetStore((s) => s.addWidget);
  const moveWidget = useWidgetStore((s) => s.moveWidget);
  const resetLayout = useWidgetStore((s) => s.resetLayout);
  const [pickerOpen, setPickerOpen] = useState(false);

  const maxRow = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);

  const handleSwapDrag = useCallback((sourceId, targetId) => {
    const source = widgets.find((w) => w.id === sourceId);
    const target = widgets.find((w) => w.id === targetId);
    if (!source || !target) return;
    moveWidget(sourceId, target.x, target.y);
    moveWidget(targetId, source.x, source.y);
  }, [widgets, moveWidget]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">WIDGET DASHBOARD</span>
          <div className="flex items-center gap-2 relative">
            {editMode && (
              <>
                <button onClick={resetLayout}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono text-zinc-500 border border-white/[0.06] hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                  <RotateCcw size={10} /> RESET
                </button>
                <button onClick={() => setPickerOpen((p) => !p)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono text-zinc-500 border border-white/[0.06] hover:border-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                  <Plus size={10} /> ADD
                </button>
              </>
            )}
            <button onClick={toggleEditMode}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono transition-all ${editMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 border border-white/[0.06] hover:border-white/[0.12] hover:text-zinc-300'}`}>
              {editMode ? 'DONE' : 'EDIT'}
            </button>
            <AnimatePresence>
              {pickerOpen && <AddWidgetPicker onAdd={(type) => addWidget(type)} onClose={() => setPickerOpen(false)} />}
            </AnimatePresence>
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${maxRow}, ${ROW_H}px)` }}>
          <AnimatePresence mode="popLayout">
            {widgets.map((w) => (
              <WidgetCell key={w.id} widget={w} editMode={editMode} onSwapDrag={handleSwapDrag} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
