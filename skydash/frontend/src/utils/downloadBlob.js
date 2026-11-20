// Request a local file download. Browsers do not report whether the user saved it.
// Keep successful object URLs briefly alive; remove temporary DOM/URLs on failure.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  let anchor;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (failure) {
    anchor?.remove();
    URL.revokeObjectURL(url);
    throw failure;
  }
}
