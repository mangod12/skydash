import { useState } from 'react';
import StandaloneReportTools from './StandaloneReportTools';
import ConversionReproduction from './ConversionReproduction';
import TrainingComparisonPrint from './TrainingComparisonPrint';
import TrainingIntakePrint from './TrainingIntakePrint';
import PrivateDebriefPrint from './PrivateDebriefPrint';
import FlightLogReplay from '../components/views/FlightLogReplay';
export default function StandaloneReview() {
  const [session, setSession] = useState(0);
  return <div className="flex h-full flex-col bg-zinc-950 text-zinc-100"><header className="shrink-0 border-b border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-xs"><h1 className="font-semibold text-cyan-200">SkyDash / standalone recorded review</h1><p className="mt-1 text-zinc-300">Local files and fabricated examples, not live telemetry or aircraft control. Backend connections and background tiles are unavailable. No external fonts, service worker or automatic upload. Optional device-local snapshot saves require explicit consent; downloads contain private coordinates/reviews. Keep backups and confirm the audience yourself. Not authentication, certification, completion or readiness evidence.</p></header><StandaloneReportTools><ConversionReproduction /><TrainingComparisonPrint /><TrainingIntakePrint /><PrivateDebriefPrint /></StandaloneReportTools><main className="min-h-0 flex-1"><FlightLogReplay key={session} backLabel="Start a new local review" backDestination="new empty local review" onBack={() => setSession(value => value + 1)} /></main></div>;
}
