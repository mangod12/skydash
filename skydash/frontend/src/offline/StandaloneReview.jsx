import OffsetTimeInput from './OffsetTimeInput';
import SourceIntervalInspection from './SourceIntervalInspection';
import GuidedDiscussionTrial from './GuidedDiscussionTrial';
import DiscussionIntake from './DiscussionIntake';
import ChecklistCombination from './ChecklistCombination';
import ReceivedDiscussionComparison from './ReceivedDiscussionComparison';
import ReceivedDiscussionOriginals from './ReceivedDiscussionOriginals';
import DiscussionOriginalsHandoff from './DiscussionOriginalsHandoff';
import OriginalChecklistPrint from './OriginalChecklistPrint';
import ChecklistReviewComparison from './ChecklistReviewComparison';
import InstructorDiscussionAgenda from './InstructorDiscussionAgenda';
import InstructorCombination from './InstructorCombination';
import InstructorOriginalHandoff from './InstructorOriginalHandoff';
import { useRef, useState } from 'react';
import StandaloneHandoffNavigation from './StandaloneHandoffNavigation';
import { navigateStandaloneHandoff } from './standaloneHandoffNavigation';
import StandaloneReportTools from './StandaloneReportTools';
import ReviewComparisonPrint from './ReviewComparisonPrint';
import TrainingLineagePrint from './TrainingLineagePrint';
import CaseComparisonPrint from './CaseComparisonPrint';
import ConversionReproduction from './ConversionReproduction';
import TrainingComparisonPrint from './TrainingComparisonPrint';
import TrainingIntakePrint from './TrainingIntakePrint';
import PrivateDebriefPrint from './PrivateDebriefPrint';
import FlightLogReplay from '../components/views/FlightLogReplay';
export default function StandaloneReview() {
  const [session, setSession] = useState(0), [toolsVisible,setToolsVisible] = useState(true), root = useRef(null);
  return <div ref={root} className="flex h-full flex-col bg-zinc-950 text-zinc-100"><header className="shrink-0 border-b border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-xs"><h1 className="font-semibold text-cyan-200">SkyDash / standalone recorded review</h1><p className="mt-1 text-zinc-300">Local files and fabricated examples, not live telemetry or aircraft control. Backend connections and background tiles are unavailable. No external fonts, service worker or automatic upload. Optional device-local snapshot saves require explicit consent; downloads contain private coordinates/reviews. Keep backups and confirm the audience yourself. Not authentication, certification, completion or readiness evidence.</p><StandaloneHandoffNavigation onChoose={task=>{setToolsVisible(true);navigateStandaloneHandoff(root.current,task);}} /><button type="button" className="mt-2 rounded border border-cyan-800 px-2 py-1" aria-expanded={toolsVisible} aria-controls="standalone-local-handoff-tools" onClick={()=>setToolsVisible(value=>!value)}>{toolsVisible?'Hide local handoff tools':'Show local handoff tools'}</button><span className="ml-2 text-zinc-400">Reclaim replay space without clearing tool selections or prepared work.</span></header><StandaloneReportTools hidden={!toolsVisible}><GuidedDiscussionTrial onChoose={task=>navigateStandaloneHandoff(root.current,task)} /><DiscussionOriginalsHandoff /><DiscussionIntake /><ReceivedDiscussionOriginals /><ReceivedDiscussionComparison /><OriginalChecklistPrint /><ChecklistReviewComparison /><ChecklistCombination /><InstructorDiscussionAgenda /><InstructorCombination /><InstructorOriginalHandoff /><ReviewComparisonPrint /><TrainingLineagePrint /><CaseComparisonPrint /><ConversionReproduction /><TrainingComparisonPrint /><TrainingIntakePrint /><PrivateDebriefPrint /></StandaloneReportTools><main className="min-h-[6rem] flex-1"><FlightLogReplay SourceTimeInput={OffsetTimeInput} SourceInterval={SourceIntervalInspection} key={session} backLabel="Start a new local review" backDestination="new empty local review" onBack={() => setSession(value => value + 1)} /></main></div>;
}
