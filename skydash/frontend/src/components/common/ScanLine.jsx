/**
 * Ambient scan line effect — thin horizontal line that sweeps down periodically
 * Adds "system active" feel like JARVIS/military HUD
 */
export default function ScanLine() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      <div
        className="absolute left-0 right-0 h-[1px] opacity-[0.04]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)',
          animation: 'scan-line 6s linear infinite',
        }}
      />
    </div>
  );
}
