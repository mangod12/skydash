const destinations = {
  discussionTrial: 'Guided fabricated discussion trial',
  discussionExamples: 'Fixed synthetic discussion starter',
  discussionIntake: 'Discussion originals intake queue',
  checklistCombine: 'Checklist review combination tool',
  discussionCompare: 'Received discussion snapshot comparison',
  receivedDiscussion: 'Received discussion originals ZIP',
  discussionOriginals: 'Discussion originals handoff',
  checklistPrint: 'Original checklist print tool',
  checklistCompare: 'Checklist review comparison tool',
  instructorAgenda: 'Instructor discussion agenda tool',
  combine: 'Instructor review combination tool',
  instructor: 'Instructor original pair handoff',
  synthetic: 'Fixed synthetic handoff starter',
  received: 'Received original ZIP check',
  recover: 'Received ZIP selected original download',
  agenda: 'Received ZIP private discussion agenda',
  packet: 'Received ZIP private discussion packet',
  compare: 'Received ZIP snapshot comparison',
  originals: 'Privacy-reduced intake print tool',
  private: 'Private original print tool'
};
const navigationRequests = new WeakMap();
// Fixed local destinations only. Navigation never invokes a preparation/check/import action.
export function navigateStandaloneHandoff(root, task) {
  const label = Object.hasOwn(destinations,task) ? destinations[task] : null;
  if (!root || !label) return false;
  const section = root.querySelector('[aria-label="'+label+'"]'), disclosure = section?.closest('details');
  if (!section || !disclosure || disclosure.parentElement?.getAttribute('aria-label') !== 'Standalone original report tools') return false;
  const owner = root.ownerDocument, focusAtRequest = owner.activeElement, request = {};
  navigationRequests.set(root, request);
  for (const child of disclosure.parentElement.children) if (child.tagName === 'DETAILS') child.open = child === disclosure;
  section.setAttribute('tabindex','-1');
  // Layout may settle after the user has already focused an input. Never redirect
  // their next keystrokes, target a closed/removed tool, or replay an older request.
  requestAnimationFrame(()=>{
    if (navigationRequests.get(root)!==request || !root.isConnected || !root.contains(section) || !disclosure.open) return;
    const active = owner.activeElement;
    if (active && active!==section && (section.contains(active) || active!==focusAtRequest && active!==owner.body && active!==owner.documentElement)) return;
    section.scrollIntoView({block:'start',inline:'nearest'});
    section.focus({preventScroll:true});
  });
  return true;
}
