// Fixed navigation metadata only. No selected file names, private words or task results.
export const handoffTasks=Object.freeze([
 ['conversionChain','Verify a timestamp-to-numeric conversion chain','Check or recover','Check five exact source/recipe/intermediate/final files through both conversion stages without opening replay.'],
 ['discussionTrial','Start guided fabricated discussion trial','Start','Walk through existing tools with fabricated examples and manual follow-up flags.'],
 ['discussionExamples','Try fabricated discussion examples','Start','Inspect the fixed fabricated discussion ZIP examples before using real originals.'],
 ['discussionIntake','Check a queue of discussion ZIPs','Check or recover','Check each selected discussion ZIP independently and inspect fingerprint relations.'],
 ['discussionCompare','Compare two discussion ZIP snapshots','Compare','Compare two complete discussion originals snapshots without restoring replay.'],
 ['receivedDiscussion','Check or recover received discussion originals','Check or recover','Freshly check a complete discussion ZIP before separate original recovery.'],
 ['discussionOriginals','Keep checklist and original CSV together','Preserve originals','Prepare a manual handoff with exact chosen checklist and CSV originals.'],
 ['checklistPrint','Print a saved discussion checklist','Print privately','Prepare a private print from the exact source-bound saved checklist.'],
 ['checklistCombine','Combine two checklists explicitly','Combine explicitly','Choose complete checklist items and a whole title; no automatic application.'],
 ['checklistCompare','Compare two discussion checklists','Compare','Inspect exact-ID checklist field and original order differences.'],
 ['instructorAgenda','Build a checklist from instructor notes','Combine explicitly','Choose instructor notes for new Pending prompts, never transfer outcomes.'],
 ['combine','Combine two instructor reviews explicitly','Combine explicitly','Choose complete annotations and one whole summary; no inferred consensus.'],
 ['instructor','Keep CSV and instructor review together','Preserve originals','Prepare an original source and instructor sidecar pair for manual handoff.'],
 ['synthetic','Try fixed fabricated examples','Start','Try the fixed fabricated original training-package handoff examples.'],
 ['received','Check a received original ZIP','Check or recover','Check the complete original training-package ZIP without extracting it.'],
 ['recover','Recover one ZIP original for manual reopening','Check or recover','Choose one checked manifest ordinal for a separate original download.'],
 ['agenda','Prepare a private questions/follow-ups agenda','Print privately','Prepare a private agenda from explicitly selected received original reviews.'],
 ['packet','Prepare a private ZIP discussion packet','Print privately','Prepare a private print packet from all or selected received originals.'],
 ['compare','Compare two received ZIPs or reviews','Compare','Compare checked received training-package originals or review snapshots.'],
 ['originals','Prepare a ZIP from original files','Preserve originals','Check original training-package files before separate manual outputs.'],
 ['private','Print a private original debrief','Print privately','Prepare a private debrief print from complete original review files.']
].map(([id,label,group,description])=>Object.freeze({id,label,group,description})));
