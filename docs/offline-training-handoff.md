# Offline training package handoff

For a training reviewer receiving existing SkyDash case, notebook or paired-review exports. This is file validation and discussion preparation, not a flight log authenticity check, grade, certification or readiness decision. No hosted archive or backend deployment is needed. Use a checked-out copy of SkyDash with its frontend dependencies already installed; installation is a separate setup step that may need a network connection. The checks below run locally without network access.

## Keep originals before making the package

In recorded-flight replay, explicitly download the artifacts you intend to hand off:

- A review case includes exact primary CSV and its primary review. It excludes the notebook and comparison.
- A notebook source bundle includes exact primary CSV and applied saved copies, not other review panels or unsaved fields.
- A paired review bundle includes ordered primary/baseline sources and its supported review state. It excludes the notebook.
- If you mapped a numeric CSV, keep the untouched original, exported mapping recipe and exact converted CSV separately. These are not embedded as mapping originals in the above bundles.

These files can contain private notes, coordinates and readings, including outside a selected window. Confirm the audience before sharing. No command below sends them anywhere. Preserve each original; the HTML report cannot reopen a review or replace its source files.

## List the artifacts explicitly

Create a training manifest in the folder that owns its listed files. Use format `skydash-training-intake-manifest-v2`, with a `bundles` array in intended report order. Every entry must have exactly `kind`, `path` and `sha256`. Supported kinds are `case`, `notebook` and `paired`. Paths are relative to that manifest's folder. `sha256` is the expected hash of the complete original exported JSON, not the CSV fingerprint shown inside it.

Do not infer expectations from a filename, embedded hash or a successful earlier receipt. Obtain them through an independent trusted route. Computing a hash from a received file is useful for reproducibility, but it does not authenticate the file. If you also have an independent expectation for the complete manifest bytes, pass it separately with `--expect-sha256`.

V1 manifests still accept only notebook/paired. Use V2 explicitly to include a case, not a changed file extension or guessed kind. Both formats allow 1 to 20 unique canonical in-folder regular files, 20 MiB combined data and a 64 KiB manifest. Case/notebook files are limited to 2 MiB each; paired files to 4 MiB. Traversal, outside symlinks, duplicate aliases, unknown fields and unsupported formats fail.

## Check and read the report

From `skydash/frontend`, with `MANIFEST.json` replaced by your manifest path:

```sh
node scripts/verify-training-manifest.mjs MANIFEST.json
node scripts/report-training-intake.mjs MANIFEST.json > intake-report.html
```

The first command prints the machine-readable receipt. The second validates the originals again and prints one self-contained static HTML document. Open that HTML locally in a browser. No scripts, links, remote assets or external requests are needed. Narrow tables scroll horizontally; browser printing uses print styles. Neither command accepts a saved success receipt as a substitute for the original manifest and files.

Check the exit status. A failure emits no success receipt or partial HTML, though shell redirection may already have created an empty output file. The command itself writes nothing. If using npm instead of `node`, use the `--silent` option before redirecting so the npm banner does not become part of the HTML.

A completed structural check means all specified expected artifact bytes and nested source/model/review bounds agreed under this checkout. It does not verify who produced the evidence. The report separately names an unchecked external manifest expectation and any conversion lineage not checked.

## Optionally check original conversion relations

Create a separate lineage manifest with format `skydash-training-lineage-manifest-v1` and `conversions`, 1 to 20 ordered entries. Each entry has exactly `original`, `recipe` and `converted`; each of those has exactly `path` and independently expected complete-file `sha256`. Files are unique canonical regular files inside the lineage manifest's own folder. Original/converted inputs are at most 1 MiB each, recipes 64 KiB and lineage data 20 MiB total. Its manifest is at most 64 KiB. The two manifests keep separate folder roots and data budgets, at most 40 MiB combined plus the two manifests.

For all listed originals, first check whether you can truthfully confirm WGS84 decimal-degree coordinates. The recipe's declaration cannot do that for you. Only then run:

```sh
node scripts/report-training-intake.mjs MANIFEST.json --lineage-manifest LINEAGE.json --confirm-wgs84 > intake-with-lineage.html
```

Use `--expect-sha256` and `--expect-lineage-sha256` when you have independent expectations for the complete training and lineage manifests. To require an exact reproduced relation for every listed review-source role, add `--require-all-review-sources`; it refuses the whole report if any role is unlinked. Options must not repeat. Lineage-only options without a lineage manifest fail.

The command reproduces every conversion using the current adapter, checks all three expected raw-file hashes, validates all training originals and links only exact converted CSV bytes to each listed source role. Keep inputs unchanged during the check. Unlinked sources may be native CSV or missing lineage; do not infer their origin. Multiple original/recipe relations can yield identical converted bytes, so none is collapsed into a unique original, aircraft, person or flight. Unused relations remain visible. Conversion agreement is not proof of OEM compatibility, coordinate truth or authentic telemetry.

## Read evidence without adding it into a score

Bundle/copy ordinals are positions in the selected package, not verified chronology or student identity. Exact-source reuse is different from repeated complete artifacts. Repeated sources and overlapping/singleton copies are not independent flights or training completions. Never sum their samples, spans, distances, grades or completion counts. First/last source seconds have an unverified time basis; their span is not continuous observation. Every interval is unsampled, including intervals of 5 seconds or less, and a known channel cell does not mean a correct sensor.

The HTML omits filenames, paths, titles, private notes, marker text/IDs, criteria values, coordinates and individual readings. Hashes, counts, bounds, times and reuse patterns can still identify sensitive work. The report is editable and unsigned. It is not an authenticated history or custody record, a complete handoff certificate, a source backup, a reopenable bundle or a readiness assessment. Share only after reviewing its audience and retain the original package and validator checkout.

For exact schemas, limits and related tools, see [Flight-log training and review](flight-log-training.md).
