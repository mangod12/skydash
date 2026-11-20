import GlassCard from '../common/GlassCard';

export default function CommsLog() {
  return (
    <GlassCard className="!p-3">
      <section aria-label="Communications log unavailable">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
          COMMS UNAVAILABLE
        </h3>
        <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
          <p>No communications source or received messages are supplied to this panel.</p>
          <p>No radio transcript, callsign, contact report, clearance, weather observation or alert is inferred from telemetry. An empty panel does not mean radio silence or no operational activity.</p>
          <p>This is not a recorded-flight debrief or an aircraft command channel. Use the separately recorded source and review artifacts for training discussion.</p>
        </div>
      </section>
    </GlassCard>
  );
}
