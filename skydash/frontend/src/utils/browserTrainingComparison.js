import { checkBrowserTrainingIntake } from './browserTrainingIntake';
import { compareCheckedTrainingPackages } from './trainingPackageComparison';
import { renderTrainingComparison } from './trainingComparisonHtml';
export async function browserTrainingComparison(left, right) {
  // Each side keeps its own filenames, independently obtained expectation and20MiB budget.
  const a = await checkBrowserTrainingIntake(left.manifest, left.files, left.expected ?? '');
  const b = await checkBrowserTrainingIntake(right.manifest, right.files, right.expected ?? '');
  const data = compareCheckedTrainingPackages(a, b);
  return { html: renderTrainingComparison(data), leftDigest: a.exact_manifest_sha256, rightDigest: b.exact_manifest_sha256 };
}
