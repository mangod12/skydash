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

## Read two checked package snapshots side by side

From `skydash/frontend`:

```sh
node scripts/report-training-comparison.mjs LEFT.json RIGHT.json > comparison.html
```

The command validates both original manifests and every listed original artifact with the current nested validators before printing one static offline HTML report. Optional `--expect-left-sha256 HEX` and `--expect-right-sha256 HEX` independently pin each complete raw manifest before its paths are parsed. Artifact expectations are still required within each manifest. No saved comparison/intake receipt can replace originals. Same canonical folder/size/kind/source/review limits as `compare-training-packages` apply, separately per side, at most40MiB combined data plus two64KiB manifests. Inputs must remain unchanged while checking. Check exit status: shell redirection can create an empty file even when validation fails; no partial HTML is printed.

The report separates complete-manifest byte equality, ordered kind/exact-artifact equality, kind/artifact occurrence inventory equality, and exact embedded CSV source occurrence inventory equality. The artifact and source sections retain every left/right bundle ordinal, kind and source role, including repeated artifacts and identical primary/baseline CSVs. Mobile columns stack; print keeps side-by-side references. Matching inventory with different artifact order is a sequence change, not absent work. Different complete JSON can mean formatting or private review changes while exact CSV remains unchanged. Equal source counts can hide role reassignment or different private reviews, so inspect every reference, not only the summary.

Left/right are selected snapshots, never verified earlier/later revisions, aircraft, flights, people or completion records. No guessed pairing, annotation diff/transfer, additions/deletions, combined samples/durations/flight totals, merged package, patch or conversion-lineage check is provided. An absent exact occurrence means only those bytes do not appear on that side. This report does not identify what changed inside a review. For an explicitly selected pair of case originals, the separate case-comparison command retains its own scope.

HTML has no scripts or external assets. It omits private paths/filenames/titles/notes/marker text and IDs/criteria/coordinates/readings, but hashes, counts and reuse patterns can still identify sensitive work. Review the audience before sharing; the command never uploads, shares, changes originals or writes files itself. Generated expectations and editable unsigned reports are not independent authentication, custody, source truth, source backups, complete handoff/workspace certificates, completion, grades or readiness.

## Read section-level flags for two explicit case originals

When an instructor deliberately selects two case originals, a separate command shows privacy-limited section flags:

```sh
node scripts/report-review-case-comparison.mjs LEFT-CASE.json RIGHT-CASE.json > case-comparison.html
```

This is separate from package occurrence matching: cases are never paired automatically by package order, filename, labels or local IDs. Both complete cases must pass the actual current case validators before any static HTML prints. Same regular UTF-8 file limit2MiB/case and optional independent `--expect-left-sha256 HEX` / `--expect-right-sha256 HEX` complete-artifact pins as `compare-review-cases`. Imported receipts cannot replace originals. Check exit status; redirection may leave an empty file on failure.

The report separates exact complete JSON byte equality, validated normalized-content equality, exact embedded source CSV equality and source filename metadata equality. Only exact source CSV equality allows changed/unchanged flags for title, analyst notes, whole instructor marker array, instructor discussion, envelope profile and envelope notes. Changed source bytes suppress every review flag, even with identical note text or IDs. Filename metadata never authenticates a source. Marker arrays compare whole after validator normalization; no per-event matching. Whitespace in private text remains content, while JSON formatting/object-key order alone can differ without normalized-content changes. Envelope changes do not create a grade.

The static offline report omits private text/paths/filenames/IDs/criteria values/coordinates/readings. Hashes and change patterns remain sensitive. Desktop/mobile/print retain the source gate and scope; there are no scripts/external assets, writes except explicit shell redirection, upload, sharing, patches, merges, annotation transfer or source repairs. It neither proves a revision chronology or authenticated edits/authorship/custody nor identifies who changed what private words. Preserve originals separately. No backup, flight/student identity, completion, certification or readiness claim.

## Optionally keep the checked originals together

After checking the report, `node scripts/package-training-intake.mjs MANIFEST.json --output NEW.zip` creates one new sensitive unencrypted ZIP of the exact original manifest/files plus a fresh report, receipt and guide. Optional `--lineage-manifest LINEAGE.json --confirm-wgs84` also validates and includes every listed original conversion input under its own folder. Independent complete-manifest pins and `--require-all-review-sources` work as described above. No imported success receipt substitutes for originals.

The explicit new output never overwrites originals or existing files. Keep inputs unchanged during checking. A failed write may leave an incomplete new ZIP without a success receipt. Confirm the audience and use a secure channel yourself; no upload or sharing occurs. The archive contains private coordinates/reviews and optional mapping originals, is not encrypted/signed or a complete backup, and proves no authorship, grade or readiness. Inspect its generated guide and revalidate extracted originals in a new private folder. Unsafe extraction names/collisions fail rather than silently renaming files. See the detailed archive section in the training guide for limits and restrictions.

## Try the complete handoff with fabricated examples first

From an installed checkout's `skydash/frontend`:

```sh
node scripts/create-training-example.mjs --output-dir NEW-FOLDER
```

This creates one new folder of fixed synthetic CSV/case/notebook/paired exports, an explicit mixed manifest, original synthetic mapping/recipe/converted files and their lineage manifest, a checked unencrypted handoff ZIP, an archive receipt and `EXAMPLE-GUIDE.txt`. It uses current app export functions and the same complete intake/lineage/archive checks, not handwritten success receipts. No user input file, folder scan, account or real telemetry is involved. The folder and its fixed files are new-only, owner-access modes0700/0600 where supported. Existing files/directories/symlinks are never overwritten; parent folders are not created implicitly. A failed run may leave a partial new folder and emits no success receipt. No upload, email, automatic opening or sharing occurs.

The primary CSV is shared across case/notebook/paired-primary. Only the paired-baseline source is reproduced from the explicit synthetic mapping input. The generator's WGS84 statement covers its own fixed fabricated coordinates, never any supplied OEM file. Native synthetic source roles remain unlinked and require-all deliberately fails. These are roles/views of fabricated sources, not independent real flights or completed training. All sample labels/reviews are marked synthetic. Generated hashes are local agreement examples, not independent authentication. No compatibility, student/aircraft identity, certification or readiness evidence is created.

Follow `EXAMPLE-GUIDE.txt` to revalidate originals and generate an intake report, or extract the ZIP into a separate new private folder and revalidate its original manifests/files. The ZIP contains only the explicitly listed training and lineage originals plus its fresh report/receipt/guide, not the full example directory or unsaved workspace. It is unencrypted, not a complete backup or automatically safe for real private data. Existing replay case/notebook/paired opening confirmations and exclusions still apply if you deliberately open these examples in the browser; keep other unsaved work separately first. The command itself opens nothing.


## Read explicit notebook or paired-original comparison reports

```sh
node scripts/report-review-comparison.mjs notebook LEFT-NOTEBOOK.json RIGHT-NOTEBOOK.json > notebook-comparison.html
node scripts/report-review-comparison.mjs paired LEFT-PAIRED.json RIGHT-PAIRED.json > paired-comparison.html
```

The explicit kind selects a fixed current comparator, not imported code or a receipt. Both complete original artifacts pass all current nested source/model/review validators before any static offline HTML prints. Regular strict UTF-8 originals,2MiB/notebook or4MiB/paired bundle. Optional nonrepeated `--expect-left-sha256 HEX` and `--expect-right-sha256 HEX` pin each complete raw artifact independently before parsing, not only its CSV. Generated expectations do not independently authenticate received files. Keep inputs unchanged while checking and check exit status; shell redirection can leave an empty output on failure. No partial report is printed.

Exact complete JSON bytes, normalized content and source-role equality are separate. JSON formatting/object-key order can change raw bytes without changing validated content. Text and normalized array order remain content. Left/right are explicitly selected snapshots, never authenticated earlier/later revisions. No automatic pairing by package order, filenames, labels or similarity.

Notebook reports compare saved copies only when exact embedded CSV bytes agree. Editable snapshot-local IDs associate copies using each side's ordinal, with position, inclusive-bound, label and notes flags. IDs/private values/bounds are omitted. Same local ID can have changed text/bounds; different IDs remain side-only even with identical contents. Side-only ordinals do not mean additions/deletions/missing work. A changed CSV suppresses all associations, copy flags and side-only ordinals. Counts/ordinals are snapshot references, not independent flights or training completions. Filename metadata is separate, never source truth.

Paired reports gate primary title/analyst notes/whole marker array/instructor discussion/envelope profile/notes on exact primary CSV equality. A changed baseline alone leaves primary flags comparable. Comparison notes/applied manual anchors require the same exact ordered primary AND baseline sources; either changed source suppresses both flags. Changed primary suppresses all primary and comparison flags. Filename/title metadata flags are text equality only. Identical A/B CSVs are not independent flights. No marker/event matching, alignment verification, annotation transfer, inferred edits, patches or merges occurs.

The static desktop/mobile/print HTML has no scripts, external assets, private paths/filenames/titles/IDs/labels/notes/criteria/coordinates/row bounds/anchor values/readings. Hashes/counts/change patterns remain sensitive, so inspect the audience before sharing. No upload, storage, sharing, backend writes or aircraft commands. Preserve original files separately. Editable unsigned HTML is not authenticated identity, authorship/history/custody, telemetry truth, source backup, complete handoff/workspace certificate, flight/student identity, completion, grade, certification or readiness.

## Check a received plain-file package in replay without opening its sources

In Flight Log Replay, expand **Prepare or check a local training package**, then **Check a received manifest and original files locally**. Select a received v1/v2 manifest and all and only its listed original JSON artifacts. Files may be selected in any order; checking preserves manifest order. This browser route requires exact plain filenames, no subfolders, path stripping, ZIP extraction, duplicate names, extras or manifest/artifact filename collision. Use the offline CLI for bounded folder paths instead. Limits remain64KiB manifest,1to20originals,2MiB case/notebook,4MiB paired,20MiB combined.

Optionally enter an independently obtained complete raw-manifest SHA-256. It is checked before JSON paths/kinds or original bytes are processed. Required manifest artifact hashes are checked against each complete raw artifact before nested validation. A pin match does not establish how you obtained the expectation, authenticated authorship, source truth or custody; hashes copied from a received package are not independent evidence. Legacyv1 accepts notebook/paired only; explicitv2 also accepts cases. Current app validators check every original's nested source/model/review bounds. Any failure refuses the whole success display, without echoing private review text.

Checking pauses only primary playback, leaves sources, notes, notebook, dirty review fields, primary cursor and independent comparison unchanged, and never opens/replaces a source or imports annotations. Selection/expectation edits stale the success display, even when changing back. Both creation and received controls lock during checking/workspace work. Clear removes only received selections and its display, not current workspace or the separate creator selection. Result ordinals/hashes are local snapshot references, never independent flights, grades or completion counts. No network, storage, upload, sharing, download, server save or aircraft command is triggered by this check. Filenames and hashes remain sensitive. The session-only display is not a saved receipt, reopenable package, source backup, complete handoff certificate or readiness assessment. Preserve originals and excluded work separately.

## Use the separate standalone recorded-review build

A trusted installed checkout can run `npm run build:offline-review` in `skydash/frontend` to prepare the separate `dist-offline-review` static assets. Serve only that generated directory on loopback and open `offline-review.html`. The profile starts directly in recorded review, has no configured backend/account, replaces external basemaps with an unavailable message, uses system/local fonts and blocks connection requests. The normal hosted app/backend are unchanged. It is not a certified air-gap boundary, signed distribution or complete backup; see [Standalone recorded review](standalone-recorded-review.md) for preparation, local serving, privacy limits, explicit storage and preservation instructions.

A bounded standalone static build can also be prepared as a new checked ZIP for manual transfer, then byte-checked after extraction using a separate trusted checkout and optional independently obtained inventory digest. This never packages recordings or makes unsigned executable assets trusted. See the distribution section in [Standalone recorded review](standalone-recorded-review.md#prepare-a-checked-static-distribution-for-manual-transfer).

## Print a private instructor debrief from an original

When an instructor needs a readable review rather than the redacted validation/change summaries, use an explicit original kind and private-output acknowledgement:

```sh
npm run --silent report-private-debrief -- case ORIGINAL.json --include-private-review > private-debrief.html
npm run --silent report-private-debrief -- paired ORIGINAL.json --include-private-review --expect-sha256 HEX > private-paired-debrief.html
```

Replace paths and `HEX` yourself, using shell-safe quoting. The optional digest pins complete original raw bytes before parsing, not just embedded CSV. Obtain it independently. The command requires the acknowledgement every time because the output can include private source filenames/titles, analyst/instructor/comparison notes, instructor-marker context coordinates, criteria and applied manual-anchor text. It validates the whole strict UTF-8 regular original (case2MiB/paired4MiB), exact embedded sources, supported models and nested review/marker bounds before printing any HTML. Symlink/special inputs, invalid expectations or nested validation failures produce no partial report. No imported computed results or prior success receipts are accepted. Output is bounded8MiB, otherwise refused. No app bundle/backend deployment change.

The fixed chapters recompute existing primary analyst summary, source availability, instructor discussion and included evaluated-envelope report. Paired originals add the ordered A/B comparison, notes and applied anchors; identical sources remain explicitly not independent flights. Unknown channels remain unknown, source intervals remain unsampled and whole-log summary deltas are not better/worse. Manual anchors do not prove same events or synchronized physical time. No new scoring, flight/student identity or readiness inference occurs. Notebook copies and excluded panels are not silently included.

The HTML has desktop/mobile layouts, fixed section navigation and A4 print styles. Reviewer text is escaped, never HTML, scripts, external assets or instructions. Long reports can span many pages; inspect browser print preview before printing/saving a PDF yourself. Browser-generated PDF dates/metadata are not source observation, author or build evidence. The command prints only to stdout; saving is your explicit shell redirection. Check exit success and inspect the output before using it, since a failed redirected command can leave an empty file. No files are written by the report command, and no network, upload, storage, sharing, source replacement or aircraft command occurs.

This is sensitive, editable, unsigned readable output, not the privacy-reduced intake/change report, a reopenable source artifact, complete workspace backup, signed training record, authenticated authorship/custody, telemetry truth, certification, completion, grade, flight clearance or readiness evidence. Section-level privacy/exclusion statements apply to those sections only; other chapters can include private coordinates/notes. Preserve the original case/paired JSON, mapping originals/recipes, notebook, independent-window reviews, circle/actions/checklists/follow-up, cursors and unfinished drafts separately as needed. A case still excludes comparison; a paired report includes only its explicit ordered comparison. Confirm audiences and approved transport yourself.

### Print every applied saved notebook copy

The same sensitive-output command accepts an explicit exact-source notebook original:

```sh
npm run --silent report-private-debrief -- notebook NOTEBOOK.json --include-private-review > private-notebook.html
```

An optional `--expect-sha256 HEX` pins the complete raw 2MiB original before parsing. The current notebook/source/model/bounds validators run before any output, and a notebook must contain at least one applied saved copy. The report has a fixed saved-order index, all original row-reference groups and one chapter per applied copy. Every copy is independently recomputed from its inclusive original rows. It includes private saved labels/notes and every selected original coordinate/channel reading, preserving unknown cells, singleton zero span, original row/time numbering and gaps. Outside rows/readings and boundary-crossing intervals are excluded from each copy chapter; the separate reference map describes all source rows by membership without readings. Overlapping or repeated observations appear independently in each copy. Never add samples/spans/distances/extrema across copies or interpret reference counts as completion, flight coverage or grades.

Source filename and internal copy IDs are omitted from this notebook print profile, not anonymization. Labels/notes, coordinates, hashes, times and bounds can identify private work. Other case/paired print kinds retain their existing privacy scope. Only applied saved copies are included, not current unsaved window fields/results, pending previews, analyst/instructor/envelope panels or comparison sources/notes/anchors. The original notebook source-bundle JSON is needed to reopen its source/copies; the HTML does not contain exact source CSV bytes and cannot restore a workspace. Other exclusions, explicit private acknowledgement, static escaped text/CSP, shell-redirection/print safeguards and no automatic sharing remain unchanged. The existing 8MiB HTML bound applies to the entire report; large/repeated copy selections can be refused rather than partially printed. Long reports can span many pages; inspect the print preview and preserve originals separately.
