import { clsx } from 'clsx';
import { BRAND } from '../../brand';

export default function BrandMark({ compact = false, centered = false, className }) {
  return (
    <div className={clsx('min-w-0', centered && 'text-center', className)}>
      <div className={clsx(
        'font-bold text-indigo-400 drop-shadow-[0_0_14px_rgba(99,102,241,0.35)]',
        compact ? 'text-xs tracking-[0.16em]' : 'text-3xl tracking-[0.3em]',
      )}>
        {compact ? BRAND.shortName : BRAND.wordmark}
      </div>
      {!compact && (
        <div className="text-[10px] tracking-[0.34em] text-zinc-600 mt-2 uppercase">
          {BRAND.category}
        </div>
      )}
    </div>
  );
}

