const destinations = {
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
// Fixed local destinations only. Navigation never invokes a preparation/check/import action.
export function navigateStandaloneHandoff(root, task) {
  const label = Object.hasOwn(destinations,task) ? destinations[task] : null;
  if (!root || !label) return false;
  const section = root.querySelector('[aria-label="'+label+'"]'), disclosure = section?.closest('details');
  if (!section || !disclosure || disclosure.parentElement?.getAttribute('aria-label') !== 'Standalone original report tools') return false;
  for (const child of disclosure.parentElement.children) if (child.tagName === 'DETAILS') child.open = child === disclosure;
  section.setAttribute('tabindex','-1');
  // Wait for the opened disclosure to lay out before targeting its own scroll container.
  requestAnimationFrame(()=>{section.scrollIntoView({block:'start',inline:'nearest'});section.focus({preventScroll:true});});
  return true;
}
