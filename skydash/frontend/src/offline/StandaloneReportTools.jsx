// One report disclosure at a time, without unmounting selections or prepared results.
export default function StandaloneReportTools({ children }) {
  const opened = event => {
    const current = event.target;
    if (current.tagName !== 'DETAILS' || current.parentElement !== event.currentTarget || !current.open) return;
    for (const panel of event.currentTarget.children) if (panel !== current && panel.tagName === 'DETAILS') panel.open = false;
  };
  return <div aria-label="Standalone original report tools" className="max-h-[70svh] min-h-0 shrink overflow-y-auto" onToggleCapture={opened}>{children}</div>;
}
