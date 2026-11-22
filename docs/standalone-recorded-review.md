# Standalone recorded-review build

This optional build starts directly in local CSV replay/debrief, separate from the full live dashboard. It includes the existing case/notebook/paired original readers, explicit CSV mapper, review/export tools and received plain-file package checker. It is not live telemetry, aircraft control, an authenticated training record or a readiness assessment. The normal app build, deployment and backend remain separate.

## Prepare on a trusted machine

From an installed trusted checkout, with the usual frontend dependencies installed:

```sh
cd skydash/frontend
npm run build:offline-review
```

Dependency installation may need internet access. Do that before moving the build into a disconnected environment. The command replaces only its generated `dist-offline-review` output directory, not input recordings or the default `dist` directory. Do not keep private originals or other work in a generated build directory. The build uses fixed no-backend/no-account/no-external-basemap modules even when deployment API/WebSocket/ADS-B environment values exist. No saved account token or user is read by this profile. No public-folder deployment configuration is copied.

Copy the complete generated directory, including `offline-review.html` and `assets`, to the intended machine through your approved process. Retain the trusted checkout/license notices separately. Generated assets are editable and unsigned, not independent authentication or a supply-chain guarantee. There is no service worker, installer, automatic update or remote asset cache.

## Serve only the generated directory on loopback

A browser supporting JavaScript modules, File/Blob APIs and Web Crypto is required. Python3 can serve the prebuilt assets, without Node or dependency installation on the review machine. From the repository root:

```sh
python3 -m http.server 8088 --bind 127.0.0.1 --directory skydash/frontend/dist-offline-review
```

Open `http://127.0.0.1:8088/offline-review.html`. If you copied only the generated directory, adjust `--directory` to that directory. Keep the server bound to loopback. Do not serve the checkout, a folder containing recordings, or a parent directory. Direct `file://` opening is not supported. Keep the local static server available for opening/reloading the app; no internet is needed for the built review workflows. Stop the server when finished. Loopback is not an authenticated boundary against other local software, browser profiles or extensions.

## What stays unavailable

- Backend archive, auth, live fleet, WebSocket and ADS-B connections have no configured endpoints. Existing server archive/save controls remain disabled. No backend is started or redeployed.
- All recorded basemap controls are replaced with an unavailable message. Source tracks/markers use blank local maps. No remote tile permission is offered.
- Styles use local/system fonts. The document policy blocks script/assets from other origins and all fetch/WebSocket connections. It is defense in depth, not a certified air-gap boundary. Ordinary external links, browser extensions, browser/system services and other apps remain outside this page's control. Disconnect/contain the machine according to your own policy when required.

No automatic storage, source opening or upload occurs at startup. File inputs read only deliberately selected originals. The optional existing device-local libraries still require explicit refresh/save actions and storage consent. These libraries belong to the browser profile and origin, including hostname/port. Changing origin or clearing browser data can make them unavailable; they are not backups. Source files and downloads are not copied into the static server directory by the app.

## Review and preserve work

Start with the fabricated sample or the synthetic starter kit described in [Offline training handoff](offline-training-handoff.md). Use normal checked import previews and confirm before replacing sources. Received package validation checks all originals without opening them into the workspace. Model, source-byte and bounds checks remain the same as the full app. They do not prove telemetry truth, compatibility, identity, custody, completed training, certification or grades.

**Start a new local review** proposes the existing source-open discard warning. Cancel keeps the current session; only explicit confirmation starts an empty local review. It does not delete downloaded files or saved local library records. Refresh/tab close can still discard unsaved work, and browser warnings are best-effort. There is no autosave or complete workspace recovery.

Download the individual artifacts you need and verify they were saved. No one artifact contains every panel, original mapping input/recipe, comparison, copy, cursor or draft. Existing export exclusions and guards still apply. Keep mapping originals, recipes and excluded work separately. Outputs contain private coordinates/reviews even outside the selected window. Review the audience and use your approved transport yourself; no sharing is automatic.

## Prepare a checked static distribution for manual transfer

From `skydash/frontend`, after building the standalone profile:

```sh
npm run offline-review-distribution -- create dist-offline-review --output /chosen/private/new-review.zip
```

Choose a new output path outside the build directory, replacing the example yourself. The command refuses existing files, symlink inputs, extra files, nested folders and unsupported build layouts. It accepts only the current single-JavaScript/single-CSS hashed-asset build plus `offline-review.html`, at most8MiB per asset/64KiB entry/16MiB total. It does not scan a checkout or include recordings, libraries, dependencies or license notices. Retain the trusted checkout and license notices separately. Files must stay unchanged during checking. The new mode0600 unencrypted ZIP has a fixed `site/` layout, a `START.txt` guide and `distribution.json` byte inventory. ZIP timestamps are fixed, not build dates. A failed write can leave an incomplete new output; no success receipt is issued. Successful JSON gives exact archive and manifest SHA-256, not private paths/content. Record expectations separately through a trusted route before transfer. No upload, sharing, extraction, execution, install or server startup occurs.

On the receiving machine, use your own trusted archive tool to extract into a new private directory. From a **separate trusted checkout**, not code received in that archive, check the extracted directory:

```sh
npm run offline-review-distribution -- verify /chosen/private/extracted-review --expect-manifest-sha256 HEX
```

Replace `HEX` with the complete independently obtained manifest digest. The optional pin is checked against raw manifest bytes before parsing. Verification reads only the fixed layout and requires all and only the inventory's exact files, byte sizes, hashes, ordinals and fixed guide. Extra/missing/changed files, symlinks, malformed inventory or unsupported layouts fail without success output. It does not extract or execute JavaScript. Without an independent expectation it still checks internal byte agreement, explicitly reporting that no independent manifest expectation was supplied. It does not inspect an archive directly. Changing build layout requires an explicit future format/tool update, not silently accepting arbitrary files.

The assets are executable and unsigned. A co-delivered editable manifest cannot authenticate itself, and matching hashes are not trusted code, a signature, malware inspection, a supply-chain attestation, a certified air gap or proof of the guide's claims. Independently assess and trust the source/build before serving it. After that decision, serve **only the extracted `site` directory** on loopback as above and open `offline-review.html`. Do not serve the extracted archive root or a parent. No one installs or updates it automatically. This distribution is not a recording handoff, complete workspace backup, training certificate or readiness assessment.

### Check the received ZIP before extracting anything

A separate trusted checkout can inspect the original ZIP directly, without decompressing, extracting or executing its files:

```sh
npm run verify-offline-archive -- /chosen/private/review.zip --expect-archive-sha256 HEX --expect-manifest-sha256 HEX
```

Use independently obtained complete archive and raw inventory digests in place of each `HEX`. Both expectations are optional and reported separately. The archive expectation is checked before ZIP parsing, and the inventory expectation before JSON parsing. A copied expectation inside the received package is not independent. This is an additional check, not an instruction to trust or execute received JavaScript.

Only the exact bounded stored-ZIP encoding emitted by this checkout's packager is supported: at most17MiB total, five fixed-layout entries with existing per-file/build limits, no compression/encryption/descriptors/ZIP64/extras/comments/trailing bytes. Every local/central header, CRC, size, offset and fixed timestamp must agree with the deterministic encoding; exact inventory and fixed guide checks remain required. Arbitrary ZIPs or archives rewritten by other tools are refused, even if an ordinary archive tool can open them. No general archive compatibility or malware-screening claim. Files must stay unchanged while checked.

A successful JSON receipt describes bytes inspected in memory and prints no private paths or asset content. It creates no files and never installs, serves, extracts, executes, uploads or shares anything. It does not authenticate a source/build or replace your decision about trusting executable code. If you then choose to extract with a trusted tool, still verify the extracted directory separately before serving only its `site` directory on loopback. Extraction and later changes can produce different on-disk bytes. Keep the trusted checkout and original expected digests separately.

## Serve a checked distribution snapshot from a trusted checkout

Instead of a general-purpose static server, an installed **separate trusted checkout** can verify an already extracted distribution and serve only its checked HTML, JavaScript and CSS bytes from memory:

```sh
node scripts/serve-offline-review.mjs /chosen/private/extracted-review --trust-executable-assets --expect-manifest-sha256 HEX --port 8088
```

Run from that trusted checkout's `skydash/frontend`. Node is needed for this optional route, with the same checkout/dependencies used by the distribution checker. `npm run serve:offline-review -- ...` invokes the same command. Replace the directory and independently obtained inventory digest yourself. The pin is optional, checked against complete raw inventory bytes before parsing and separately reported; a co-delivered inventory/hash does not authenticate itself. The exact bounded original extracted layout, fixed guide and all inventory bytes/hashes must pass the existing distribution checks before a socket opens. A ZIP, generated build alone, receipt or HTML report cannot substitute for the extracted originals.

`--trust-executable-assets` is mandatory because starting a browser will execute the assets. Make your own source/build trust decision first. A matching hash is not trusted code, a signature, malware screening, supply-chain attestation or certified isolation. This server does not execute the supplied JavaScript itself, inspect its behavior, install software, extract archives, launch a browser, authenticate a user or grant received code permission to run. It does not make an untrusted distribution safe.

The session receipt prints the exact `http://127.0.0.1:PORT/offline-review.html` to open yourself, inventory digest, independent-expectation status and scope. Only IPv4 loopback is supported, never a configurable public bind. Port defaults to8088; an explicitly chosen port must be1..65535 and a busy port fails without selecting another origin. Keep the hostname/port fixed if you intentionally use device-local libraries, which depend on browser profile and exact origin. They are not backups.

Only exact entry and hashed asset paths support GET/HEAD. No directory listing, arbitrary file routes, inventory, guide, recordings, query aliases, backend, uploads or filesystem writes are served. Foreign Host/Origin and cross-site request headers are refused; these checks are defense in depth, not authentication against other local software/profiles/extensions. Page connections/workers and framing are blocked by response policy, with no-store responses. Browser/system services, external links and other apps remain outside this server's control.

The server retains the single bounded checked byte snapshot in memory, not live disk files. Disk edits after startup never enter this session; stop and recheck/restart deliberately to serve changed assets. It logs no request paths or private contents. Press Ctrl+C to stop; SIGTERM also stops the session. A stopped server cannot open/reload the app, but does not delete downloaded originals, device-local libraries or work. Preserve private recordings and excluded work separately, outside the distribution/server directory. This optional server changes neither the normal hosted app nor the backend.

## Download a private printable debrief in the standalone browser

Expand **Print a private original debrief locally** in the standalone header. This separate tool uses an explicitly chosen exported original, never current replay fields. It does not pause/seek playback, replace sources, import annotations, discard work or touch the active review. Keep the replay visible or pause it yourself if desired.

Choose the exact kind, case, notebook source bundle or paired review, select its original JSON, optionally supply an independently obtained complete-original SHA-256, and explicitly acknowledge private reviewer text/coordinates/readings. Then choose **Check original for private print**. Complete raw-file expectation is checked before parsing, then the existing current source/model/review/bounds validators run. Limits are2MiB case/notebook,4MiB paired and8MiB generated HTML. Notebook prints every applied saved copy in order, not unsaved/current-window state. Inputs lock during checking. Any kind/file/hash/acknowledgement edit invalidates old success even if changed back; a failed check shows no report or private input diagnostics.

A success only enables **Download private debrief HTML**, with a fixed generic filename. No download, new tab or print dialog opens automatically, and private HTML is not inserted into the app page. Download only when ready, verify the saved file and open it locally yourself. It uses the same static escaped HTML renderer as the trusted-checkout private-debrief command, with desktop/mobile/A4 styles, no scripts/external assets and no network requests. Inspect long-page print preview before printing/saving PDF. **Clear print selections** releases only this tool's file/expectation/acknowledgement/result, never replay work. Closing the disclosure hides the tool; it does not clear a prepared result. Refresh/tab close drops its session-only selections/results; there is no automatic storage or upload.

Depending on kind, output contains private source filenames/titles, analyst/instructor/comparison notes, marker context/criteria/anchors or saved-copy labels/notes and selected coordinates/readings. It is not anonymized. Section-level exclusions apply only within each section; case excludes notebook/comparison, notebook excludes other review panels/comparison/current drafts, and paired excludes notebook. Preserve originals and excluded work separately. Unknown remains unknown, all intervals are unsampled, overlaps/repetition remain separate, and whole-log metrics must not be confused with selected windows or added across copies. Editable unsigned discussion output is not authenticated authorship/custody, telemetry truth, flight/student identity, grades, completion, certification, readiness, a source backup or reopenable workspace. An entered hash is not independent unless obtained through your trusted route. Confirm the sensitive audience and approved transport yourself. This tool is only in the separate standalone build, not the normal hosted app or backend.

### Print a whole explicit original training package in the browser

The same print tool's **Original training package** kind accepts a v1/v2 manifest and **all and only** its listed plain-file original JSON artifacts. Select the manifest separately from the multiple original-file picker. Files may be selected in any order, but the printed packet preserves manifest order. Plain exact filenames only, no subfolders, ZIPs, path stripping, missing/extra/duplicate names or manifest/artifact filename collision. Use the trusted-checkout CLI for folder-based paths instead. Limits remain64KiB manifest,1to20 original artifacts,2MiB case/notebook,4MiB paired and20MiB combined input; v1 excludes case and v2 explicitly includes it.

The optional input now means an independently obtained complete **manifest** digest, checked before parsing. Required artifact digests in that manifest are checked against each complete original before current nested source/model/review validation. Raw manifest bytes are checked again for consistency before reports, and every artifact is repinned before its individual private report. One invalid or changed artifact refuses the whole packet. No imported prior receipt, partial report or private-input diagnostic is displayed. The acknowledgement covers all originals. Editing the multi-file selection also invalidates success and resets acknowledgement.

After a complete check, the explicit download uses fixed `skydash-private-discussion.html`. It combines the same original discussion chapters, exact manifest/artifact digests, source-role reuse and repeated complete-artifact references as the trusted-checkout packet command. Every occurrence remains separate, with unique local section navigation. No automatic source pairing, annotation transfer, cross-copy sums, lineage check or flight/student/completion inference. HTML is limited16MiB total, with8MiB per original. Large notebook expansions can be refused even when input files fit their limits. Inspect the saved sensitive HTML and long-page print preview yourself. This is not a privacy-reduced report, authentication, source/workspace backup, complete handoff, grade or readiness assessment. Other print-tool privacy/exclusion/session/workspace protections above remain unchanged.

## Download a privacy-reduced intake report in the standalone browser

Expand **Print a privacy-reduced package intake report locally**. This separate tool checks the original training manifest and every listed original without opening anything into the replay workspace. It does not pause/seek, replace sources, import annotations or discard active work. Select the original manifest and all and only its exact plain-filename originals, no folders or ZIPs. Existing v1/v2 rules and current nested source/model/review bounds apply:1to20 originals,20MiB combined, case/notebook2MiB each, paired4MiB,64KiB manifest. Notebook originals require at least one applied saved copy. Previously generated receipts or reports cannot replace originals.

An optional independently obtained complete-manifest SHA-256 is checked against raw bytes before parsing. Required complete-artifact expectations come from manifest entries and are checked before nested parsing. A co-delivered hash is not independent authentication. Every selected original must pass before any HTML result is issued. Files are repinned before projection; changed bytes fail. Any selection/expectation edit invalidates the old result, even if reverted. Inputs lock while checking; failures show no private diagnostics or partial report.

Choose **Check originals for intake print**, then explicitly **Download privacy-reduced intake HTML**. No download, HTML insertion, new tab, print dialog, upload, storage or sharing happens automatically. The fixed generic filename is `skydash-training-intake.html`. Verify the saved output and open it yourself. The static escaped HTML shares the trusted-checkout intake renderer, at most8MiB, with no scripts or external assets. Inspect browser print preview before printing/saving PDF. Tables scroll horizontally on small screens. The trusted-checkout CLI retains its explicit optional conversion-lineage route; this browser report does not check conversion lineage and says so.

The output omits filenames, paths, titles, notes, marker text/IDs, criteria values, coordinates and individual readings. It retains hashes, counts, row bounds, source seconds, per-copy known/missing counts and exact source/artifact reuse. These can still identify sensitive work, not anonymization. Review the audience and approved transport yourself. Manifest/source roles, repeated artifacts and overlapping copies remain separate, never combined flights or totals. All intervals remain unsampled, unknown is not zero and known cells are not sensor correctness. Editable unsigned output is not authenticated authorship/custody, telemetry truth, identity, grades, completion, certification, readiness, a source backup or complete handoff certificate.

**Clear intake print selections** releases only this tool's selections/expectation/result, never replay work. Closing the disclosure only hides the tool; refresh/tab close drops its session-only selections/results. Preserve originals and excluded work separately. This optional tool is only in the standalone build, not the normal hosted app or backend. The shared CLI HTML renderer now also bounds output at8MiB and describes explicit save/download correctly; existing CLI lineage validation remains unchanged.

The standalone report disclosures share a bounded scrollable area. Opening one closes the other report disclosure without unmounting its selections/results. It does not clear prepared output or replay work. Nested choices do not close their parent. This keeps replay accessible on smaller screens even as report tools are added.

## Compare two original package snapshots in the standalone browser

Expand **Compare two original package snapshots locally**. Select a Left original training manifest and all its originals, then a Right manifest and all its originals. The sides are independent, including their plain filenames, optional independently obtained raw-manifest expectations and20MiB budgets. Identical filenames on opposite sides do not alias the files. Each side retains existing1to20 originals,64KiB manifest,2MiB case/notebook or4MiB paired and explicit v1/v2 rules. All and only listed plain files must be selected; no folders, ZIPs, receipts or reports. Every artifact and nested source/model/review must pass on both sides before one result. No conversion-lineage check is performed.

Optional complete-manifest expectations are checked before parsing each side; required entry digests are checked before nested parsing and artifacts are repinned before projection. Obtain expectations independently. Co-delivered hashes do not authenticate the package. Every selection/expectation edit stales the previous result, even when reverted. Inputs lock while checking. A failure returns no partial comparison or private diagnostics.

After **Check both packages for comparison**, explicitly choose **Download package comparison HTML**. The fixed generic filename is `skydash-package-comparison.html`. No automatic download, opening, new tab, HTML insertion, print dialog, upload, storage or sharing occurs. The current CLI comparison algorithm and static escaped renderer are shared; output is bounded at8MiB in browser and CLI. Verify the saved output, open it yourself and inspect browser print preview and audience. The static HTML contains no scripts or external assets.

The report distinguishes complete raw-manifest equality, ordered kind/artifact byte sequence, kind/artifact occurrence inventory and CSV-source occurrence inventory. It retains every ordinal and source-role reference, including repeated complete artifacts and identical primary/baseline bytes. Equal source occurrence counts can hide different reviews, ordering or role assignments. An unmatched exact-byte group is not proof of added/deleted or missing work. The tool never guesses pairings, compares annotation edits, merges, repairs or transfers reviews, or sums these references as independent flights, samples, spans, grades or completions. Left/Right do not prove earlier/later chronology, identity, custody, telemetry truth, completion, certification or readiness.

Private filenames, paths, titles, notes, marker text/IDs, criteria, coordinates and readings are omitted. Hashes, occurrence counts and reuse patterns remain sensitive, not anonymized. This editable unsigned output is not a source backup or complete handoff certificate. **Clear comparison print selections** releases only these print selections/results; closing the disclosure only hides them. Refresh/tab close drops them. Active replay/comparison sources, cursors and notes are untouched, no pause/seek or discard prompt is triggered. Preserve originals and excluded work separately. Only the separate standalone build includes this tool; the normal hosted app and backend do not change.

## Reproduce one numeric CSV conversion in the standalone browser

Expand **Reproduce a recorded CSV conversion locally**. Select the original numeric CSV, exported mapping recipe JSON and exact converted CSV. Original/converted files are bounded at1MiB each and recipe at64KiB. This tool reproduces every row using the current adapter and exact-header/order/model recipe validators shared with the trusted-checkout conversion CLI. It does not accept a conversion record or success receipt instead of those three originals. Generic numeric CSV only, not automatic manufacturer compatibility or binary MAVLink/ULog support.

Freshly confirm that this original's latitude/longitude columns are WGS84 decimal degrees. This is your statement, not independent verification, and a recipe cannot supply it. Every check consumes confirmation, including a failed check; check again only after fresh confirmation. A file/digest edit resets confirmation and invalidates the previous result, even when reverted. Inputs lock while checking. File reads start only after all three selections, valid optional expectations and explicit confirmation.

Optionally enter independently obtained complete raw-file SHA-256 expectations for any or all roles. All supplied expectations are checked before parsing/conversion. Complete raw bytes include BOM, whitespace and line endings; the converted file must match exactly, not merely contain numerically similar cells. The recipe may explicitly subtract numeric time origin, apply supported unit factors or exclude extra columns. No sorting, repair, interpolation, rounding or silent row skipping occurs. Fresh coordinate confirmation does not verify source units/datum or manufacturer compatibility.

Choose **Check exact conversion reproduction**, then explicitly **Download conversion check receipt**. The fixed generic filename is `skydash-conversion-check.json`. Output retains exact original/recipe/converted digests, per-role independent-expectation status, current model versions, confirmation supplied and reproduced sample count. Filenames, header names, recipe labels, coordinates, individual readings and original absolute timestamps are omitted. Hashes/counts remain sensitive, not anonymized. Verify the saved receipt and keep all three originals, conversion record and excluded work separately.

Nothing is opened into the replay workspace, paused, sought, replaced or discarded. No converted CSV is written by this checker, and no automatic download/opening, upload, storage or sharing occurs. **Clear conversion check selections** releases only this tool's selections/confirmation/result; closing the disclosure only hides it. Refresh/tab close drops its session state. This editable unsigned receipt is not authenticated authorship/custody, telemetry truth, verified units/datum/OEM compatibility, flight/student identity, grades, completion, certification, readiness, a package-lineage certificate or a source/recipe backup. Normal hosted app and backend behavior remain unchanged.


## Compare two explicit original case reviews in the browser

Expand **Compare two original case reviews locally**. Choose Left and Right complete original case JSON exports, at most2MiB each/4MiB combined. No automatic pairing from packages, labels or filenames, and Left/Right do not prove earlier/later chronology. Optional independently obtained complete-case SHA-256 expectations are checked before each original is parsed. Both current nested source/model/marker-bound/envelope validators must pass before one result. Receipts/reports cannot replace originals.

Choose **Check both original cases**, then explicitly **Download case comparison HTML**. The fixed generic filename is `skydash-case-comparison.html`. The same source-gated comparison and static escaped renderer are shared with the trusted-checkout CLI. HTML is bounded at8MiB. Complete-artifact byte agreement, validator-normalized content agreement, exact source CSV agreement and filename metadata agreement remain separate. JSON formatting/key order alone need not change normalized content; private-text whitespace still counts. Only equal exact source CSV bytes permit flags for title, analyst notes, whole normalized marker array, instructor discussion, envelope profile and envelope notes. A changed source suppresses every review flag even when labels/IDs/text match. No individual event pairing, private-word diff, authenticated edit history or readiness grade.

Every selection/hash edit invalidates the result, even if reverted. Inputs lock during checking; failure exposes no private diagnostics or partial report. No workspace import, pause/seek, source replacement, annotation transfer, merge, patch or discarded work. The report omits private text, paths, filenames, IDs, criteria, coordinates and readings; hashes/change patterns remain sensitive, not anonymized. No scripts/external assets, automatic download/opening, storage, upload or sharing. Verify the saved output, audience and print preview yourself. Clear releases only this tool's selections/results; closing hides them and refresh/tab close drops them. Preserve originals and excluded notebook/comparison work separately. Editable unsigned output is not source truth, authorship/custody, identity, certification, completion, a source backup, reopenable workspace or complete handoff certificate. Only the standalone build changes, not the normal hosted app or backend.


## Check reproduced conversion links to package review sources in the browser

Expand **Check conversion links to original review sources locally**. Select the original v1/v2 training manifest and all and only its JSON originals. Separately select a `skydash-training-lineage-manifest-v1` original and all and only its original CSV/recipe/converted files. Existing CLI lineage schema applies, with plain exact filenames only in the browser, no folders, ZIPs, aliases, duplicates, extra/missing selections or manifest/file collision. The two selections have independent filename maps, raw-manifest expectations and20MiB data budgets, at most40MiB plus two64KiB manifests. Training allows1to20 artifacts with2MiB case/notebook and4MiB paired limits. Lineage allows1to20 ordered relations and at most60 unique files, CSV1MiB each and recipe64KiB. Use the trusted-checkout CLI for folder paths.

Optionally enter independently obtained complete-manifest expectations for either selection. Each is checked before parsing that manifest; all required raw conversion/artifact digests must agree before nested validation. A co-delivered expectation does not authenticate itself. Freshly confirm WGS84 decimal-degree coordinates for **every listed original**, inspecting source units yourself. This is your statement, never supplied by manifests or recipes and not independent verification. Confirmation is consumed on every check, including refusal. Every selection/hash/coverage edit resets it and stales output, even when reverted. Inputs lock during checks.

Choose **Check originals and conversion links**. Every conversion must reproduce exact converted bytes using the current adapter/recipe validators; all original training artifacts must pass current nested source/model/review checks before any report. Only exact converted CSV bytes link to ordered case/notebook source or paired primary/baseline roles. Multiple relations yielding identical converted bytes remain separate; unused conversions and unlinked roles stay visible. Unlinked sources may be native CSV or missing lineage, not failed or missing work. No unique original, aircraft, flight, person, chronology, OEM compatibility or telemetry truth is inferred. Optional **Refuse the whole report unless every listed review-source role...** makes any unlinked role refuse the whole result. No summed samples, spans, flights, grades or completion counts.

Explicitly choose **Download source-link intake HTML** after success. The fixed generic filename is `skydash-training-source-links.html`; the bounded8MiB static escaped renderer and source-link projection are shared with the actual CLI. No partial report or private diagnostics on failure. Output omits filenames, paths, headers, recipe labels, notes, coordinates and readings, but hashes, counts, times and reuse/link patterns remain sensitive, not anonymized. Inspect the saved file, audience and print preview yourself. No scripts/external assets, automatic download/opening, upload, storage, sharing, source repair, converted CSV save, annotation transfer, replay import, pause/seek or discarded work. Clear only releases this tool; closing hides results and refresh/tab close drops them. Preserve all originals, recipes and excluded work separately. Editable unsigned output is not authenticated authorship/custody, verified units/datum, identity, completion, certification, readiness, a source/recipe backup, reopenable workspace or complete handoff certificate. Only the standalone build changes; the hosted app and backend do not.


## Compare two explicit original notebook or paired reviews

Expand **Compare two original notebook or paired reviews locally** and select the explicit kind before both originals. Notebook source bundles are2MiB each/4MiB combined; paired review bundles4MiB each/8MiB combined. Only two originals of the selected kind are accepted, never imported comparison receipts or reports. Optional independent complete-artifact SHA-256 expectations are checked before each original is parsed. Both current nested source/model/review/marker-bound/saved-copy/anchor validators must pass before one result. Every kind/file/hash edit stales output even if reverted. Changing kind clears both file selections and expectations. Inputs lock during checks.

Choose **Check both original notebook or paired reviews**, then explicitly **Download notebook or paired comparison HTML**. Fixed generic filenames are `skydash-notebook-comparison.html` and `skydash-paired-comparison.html`. The same pure comparison and bounded8MiB static escaped renderer are shared with the actual trusted-checkout CLI. Complete raw bytes, validator-normalized content, source bytes and metadata remain separate; formatting/key order alone need not change normalized content, but private text and normalized array order remain content.

Notebook: only exact embedded CSV equality permits saved-copy associations. Shared editable local IDs associate ordinal references and flags for position, inclusive bounds, label and notes, not authenticated copy identity or edit history. Different IDs remain side-only even with identical text/bounds. Side-only ordinals do not prove added/deleted/missing work; no similarity match is guessed. Changed source suppresses all associations, bounds/text/position flags and side-only ordinals.

Paired: exact primary CSV bytes alone gate the primary title/notes/whole marker-array/discussion/envelope flags. A baseline-only change does not suppress those primary flags. Both exact primary **and** baseline bytes in their ordered roles are required for comparison notes/applied-anchor flags. Either changed source suppresses those comparison flags, even with matching labels/text. No role swapping, event/row matching, annotation transfer or inferred clock synchronization. Filename/baseline-title flags are metadata only, values omitted, not identity/source truth.

No replay import, pause/seek, source replacement, repairs, patches, merges, discarded work or automatic download/opening/storage/upload/sharing. Output omits filenames, paths, titles, labels, notes, IDs, criteria, anchor values, coordinates, row bounds and readings. Hashes/counts/change patterns remain sensitive, not anonymized. Inspect saved output, audience and print preview yourself. Clear releases only this tool; closing hides prepared results and refresh/tab close drops them. Preserve originals and excluded work separately. Editable unsigned output is not verified chronology/authorship/custody, source truth, aircraft/flight/student identity, completion, grades, certification, readiness, a source backup or complete workspace/handoff certificate. Only the standalone build changes, not the normal hosted app/backend.


## Repeatable packaged-site regression check

From the repository root, after installing the root and frontend dependencies and Playwright Chromium:

```sh
npx playwright test e2e/offline-report-tools.spec.js
```

This test builds the current production standalone profile, creates fixed fabricated originals with the synthetic starter generator, packages and independently pins that build, checks its exact stored ZIP, and serves only the extracted site on an ephemeral IPv4 loopback port. It needs no backend, normal dev server, external account or real recordings. Only this test's freshly generated and fully checked archive is extracted by its test helper. This is not an arbitrary archive extraction feature.

One Chromium session goes offline after the page loads, then prepares private package, intake, package comparison, conversion, case comparison, lineage, notebook comparison and paired comparison downloads across all seven report drawers. Every HTML download must be byte-identical to the current CLI function on the same originals and independent pins. Conversion receipt reproduction fields must match the CLI, while its browser-specific format, expected-digest fields and scope remain distinct.

The check switches between every prepared drawer at desktop and mobile sizes, checks exclusive expansion and retained results, and clears only intake selections before rechecking the other six tools. Replay notes and independent clocks must remain unchanged. It checks replay geometry and overflow, page errors, external requests, fetch calls, storage writes and IndexedDB opens. Desktop/mobile screenshots and the generated synthetic downloads are Playwright test outputs. The temporary source/archive/site directory and server are cleaned up afterward. Screenshots still require human visual review; these browser checks are not a certified isolation boundary, authenticity, telemetry truth, OEM compatibility or readiness evidence. Existing nested validator/unit tests cover additional malformed originals and changed-source suppression cases.


## Download checked whole originals for manual handoff

Inside the existing privacy-reduced intake tool, a separate optional section prepares a **sensitive original ZIP**. This is not a redacted archive. Choose the original training manifest and all and only its original JSON files, with the same independent optional complete-manifest expectation as intake printing. Freshly acknowledge that whole originals contain private coordinates, notes, criteria and readings and that the ZIP is unencrypted. Choose **Prepare sensitive original ZIP**. Every current nested original validator must pass, every required artifact digest must match, and all copied manifest/original bytes are pinned again before any archive result. Receipt/report files never substitute for originals. No Node command is needed in this browser flow.

The acknowledgement is consumed on every preparation, including refusal. File/hash edits reset acknowledgement and stale both HTML and ZIP even when reverted. Inputs lock during checks. Closing or switching drawers preserves prepared results; clear releases only this intake tool's selections/results and refresh/tab close drops them. This does not pause, seek, open or replace replay sources or reviews. An HTML-only check does not authorize a ZIP and clears an old archive result.

After success, separately choose **Download sensitive original ZIP**. Generic filename: `skydash-sensitive-originals.zip`. The whole-ZIP SHA-256, byte size and archive-file count are displayed for checking saved bytes, not as proof it was saved or an independently authenticated expectation. Nothing is automatically downloaded, opened, uploaded, stored or shared. Review the audience and use approved secure transport yourself.

The fixed stored ZIP contains `training/` with the exact original manifest filename and every listed whole original, plus fresh `reports/intake-report.html`, an editable browser validation projection at `reports/validation.json`, and `reports/READ-ME.txt`. No readable private discussion packet or conversion lineage is added; the originals are still sensitive. Manifest order and exact plain filenames are retained without silent renaming. Unsafe paths, reserved portable names, trailing dots/spaces, case-insensitive or Unicode-normalization collisions and file/folder conflicts refuse the whole archive. Browser originals retain the existing1to20,20MiB total and2MiB case/notebook or4MiB paired limits. Output is at most30MiB. No ZIP input/extraction, folder scans or extra files.

Extract the saved ZIP yourself into a new private folder with a trusted archive tool. Revalidate the extracted original manifest and listed originals with a separate trusted SkyDash checkout and independently obtained expectations. Do not execute received code or trust co-delivered HTML/receipts as evidence. The archive is editable, unsigned and unencrypted; fixed ZIP timestamps are not observation or creation times. It proves no authorship/custody, source truth, units/datum, OEM compatibility, flight/student identity, grades, completion or readiness. Preserve original mapping inputs/recipes and all excluded workspace work separately. Repeated sources/copies are not independent flights or completion totals. This is not a complete backup, reopenable workspace or complete handoff certificate. Normal hosted app and backend behavior are unchanged.


## Recheck a received browser original ZIP without extracting it

A separate section inside the intake drawer accepts only the exact **sensitive original ZIP** produced by the browser flow above. Choose that complete original ZIP, at most30MiB, and optionally supply independently obtained complete-ZIP and original-manifest SHA-256 expectations. These are separate expectations. Choose **Check received original ZIP**. No automatic extraction, replay opening, source replacement, pause/seek or filesystem writes occur.

The complete-ZIP expectation is checked before ZIP parsing. Strict fixed stored encoding, every CRC/header/central-directory byte, safe unique portable paths, order, count, fixed timestamps, original layout and fixed guide must agree. Compressed, encrypted, ZIP64, commented, extra-entry, truncated, changed-header, arbitrary ZIP and other CLI archive layouts are refused. This is not a general ZIP reader or an extraction-safety certificate. A separate trusted archive tool is needed for other formats.

The original manifest expectation is checked before parsing its paths. Every original artifact expectation and current nested source/model/review validator runs freshly, within the same1to20,20MiB combined,2MiB case/notebook or4MiB paired limits. The saved HTML and validation projection are bounded inert bytes: not parsed, executed or trusted as evidence. Fresh intake HTML comes only from checked original manifest/files. Changing an embedded saved report alone can be ignored if no complete-ZIP expectation was supplied; supplying that independent expectation also pins those ignored bytes. The fixed generated guide must still match. No conversion lineage is checked.

After success choose **Download rechecked archive intake HTML** to request the generic `skydash-rechecked-archive-intake.html` download. Complete-ZIP and original-manifest digests and independent-expectation statuses are shown separately. Nothing automatically opens, downloads, extracts, stores, uploads or shares. Every file/hash edit stales old results even when reverted; inputs lock during checking, and no partial report or private diagnostics are issued on refusal. Closing or switching drawers preserves the prepared result. **Clear received ZIP check** releases only this selection and result, not the separate original-file preparation outputs or replay. Clearing original-file selections likewise does not erase this separate received-ZIP check. Refresh/tab close drops both.

The fresh HTML still omits private filenames/text/coordinates/readings, but hashes/counts/reuse patterns remain sensitive, not anonymized. Editable unsigned output is not authentication, trusted code, custody, verified units/datum, OEM compatibility, source truth, flight/student identity, grades, completion, readiness, backup or permission to extract/share. Preserve originals and excluded work, inspect the audience, and use your own trusted archive tool for any later manual extraction. Normal hosted app/backend behavior is unchanged.


## Try a fixed fabricated handoff directly in the browser

The intake drawer includes **Try the handoff with fixed fabricated examples first**. Choose **Prepare fixed synthetic handoff starter**, then separately **Download synthetic starter ZIP**. Generic filename: `skydash-synthetic-training-starter.zip`. No input file, account, local library or active replay state is read. This creates fixed fabricated case/notebook/paired originals and their manifest, not an export of your current work. Both source datasets and all review text are marked synthetic. No real recordings, people, timestamps or completed training are represented.

The seven-file stored ZIP uses the same original browser handoff format: original manifest and three JSON originals under `training/`, plus fresh intake HTML, editable validation projection and guide under `reports/`. Current nested validators run before preparation. Generated hashes are reproducibility fingerprints, not independent expectations or authentication. The browser starter includes no mapping originals/recipe/lineage or readable private discussion packet. The separate command-line starter retains its fuller mapping/lineage examples. The shared fixed original generator preserves those existing command-line files and archive bytes.

After saving, select that ZIP in the received original ZIP check below. Check it, then explicitly download the fresh intake HTML. Those saved reports/receipts are still untrusted; the receiving check derives its result from the original manifest and every original again. Do not copy a generated digest into an expectation field and call that independent authentication. For a synthetic demonstration, leaving independent expectations absent is honest and explicitly labeled.

Nothing is automatically downloaded, imported, opened, extracted, stored, uploaded or shared, and replay does not pause or seek. Preparing again invalidates the old starter first. Busy controls lock, and failures issue no partial ZIP or private diagnostics. Closing/switching drawers preserves the prepared starter; **Clear synthetic starter** clears only this starter, not selected real originals, other prepared results or replay. Refresh/tab close drops it. ZIP is unencrypted and unsigned. Fabricated examples prove no OEM compatibility, telemetry truth, authorship/custody, flight/student identity, grades, completion, certification, readiness, real-work backup or complete handoff. Preserve real originals and excluded work separately. Hosted app/backend behavior is unchanged.

## Prepare a private discussion packet from a received browser ZIP

The received-original ZIP checker can also prepare a fresh sensitive instructor discussion HTML packet directly from that ZIP's exact original manifest and all originals, without extracting files or opening them into replay. The accepted fixed stored ZIP format and bounds do not widen. Saved HTML and validation receipts stay inert and ignored; current nested validation and optional independent whole-ZIP/manifest expectations run again before any output.

Select the received browser ZIP and independently obtained expectations if available. Confirm the separate private-output acknowledgement, then choose **Prepare received ZIP private discussion**. This consumes acknowledgement on every attempt, including refusal, and invalidates prior received outputs before checking. It prepares fresh intake HTML and separate private discussion HTML only after every original passes. Download each explicitly. Acknowledgement edits, file or expectation edits invalidate both outputs even if reverted; ordinary intake checking consumes acknowledgement and never retains an old private packet. Clear received ZIP check drops both outputs and consent without clearing original-file preparation, synthetic starter, other tools or replay.

Private HTML is unencrypted and includes private names, source coordinates, notes, criteria, readings and the separate applied saved notebook copies/paired source roles in manifest order. Private rendering uses the same bounded browser packet generator as original-file printing, with at most16MiB of expanded child HTML before final wrapping. A large otherwise-valid ZIP can therefore be refused for private output without a partial packet. This is not privacy-reduced intake HTML. Verify saving, inspect the static HTML and browser print preview, review the audience and arrange secure transport separately. No automatic download/opening, extraction, storage, upload, sharing, pause/seek or replay changes.

Repeated sources, repeated artifacts and overlapping copies remain separate, never independent flights or combined sample/span/grade/completion totals. Unknown is not zero, intervals remain unsampled, and no conversion lineage, source authenticity, student identity, completion or readiness is established. Preserve originals and excluded work separately.

## Compare two received browser ZIP snapshots without extraction

In the original-package comparison drawer, a separate **Received ZIP snapshot comparison** accepts Left and Right exact browser original handoff ZIPs. Choose the files and, when available, independently obtained whole-ZIP and original-manifest SHA-256 expectations for each side. Choose **Check both received ZIP snapshots**, then explicitly download the fresh comparison HTML. This is not an arbitrary archive reader: each side retains the existing fixed stored ZIP,30MiB archive/20MiB original-data bounds, CRC/header/order/path checks, optional whole-ZIP pin before archive parsing, manifest pin before manifest parsing, required artifact pins and all current nested validators. Both sides must pass before any output, with no partial report or private diagnostics.

Originals stay in bounded memory and are rechecked by the same original-only comparison generator as plain-file comparison. Received HTML and receipts remain bounded inert bytes, never parsed, rendered or trusted. No private discussion HTML is generated. The downloaded HTML is byte-identical to the original-only CLI comparison for the same original bytes and manifest expectations; whole-ZIP fingerprints and their independent-pin statuses stay separately visible in the browser. Different saved reports/receipts can change whole-ZIP bytes while the original manifest/artifact comparison stays equal. No ZIP difference is treated as an annotation edit or missing work.

The HTML omits filenames, private names/text, coordinates and individual readings, but hashes, occurrence counts and role/reuse patterns remain sensitive, not anonymized. Caller-selected Left/Right snapshots do not establish chronology. Artifacts, saved copies and source roles remain separate, with no combined flight/sample/span/grade/completion totals, guessed pairs, repair, merge or conversion-lineage check. Unknown is not zero and intervals remain unsampled. No authenticity, source truth, student identity, completion, readiness, backup or extraction clearance claim.

Every file or expectation edit invalidates the previous comparison even if reverted; both sides and clear lock while checking. Closing or switching drawers preserves outputs. **Clear received ZIP comparison** affects only these ZIP selections/results; plain-file comparison, other prepared tools and replay remain unchanged. Clearing plain-file comparison leaves ZIP results intact. Refresh/tab close drops them. No extraction, import, pause/seek, automatic download/opening/storage, network, upload, sharing or aircraft commands. Verify saving and inspect the static HTML/print preview and audience yourself; preserve originals and excluded work separately.

### Compare two explicit original reviews inside the ZIP snapshots

For section-level review comparison without extracting files, change **Received ZIP comparison scope** from whole-package occurrences to case, notebook or paired originals. Enter each chosen original's explicit1-based ordinal in its original manifest. This is not a ZIP-entry number, a filename guess, an inferred match or an automatic latest revision. Both listed originals must match the chosen kind. Every original in both complete ZIPs must still pass current validation before the selected pair can produce a report, including unselected later originals.

Optional independent complete-artifact SHA-256 expectations are separate for Left and Right. Required artifact hashes in the checked manifests still run, but are not copied into these fields or described as independent expectations. Absent artifact expectations are labeled absent in HTML. Both ZIP/manifest pin checks still run independently; their fingerprints/status and explicit ordinal choices remain visible in the browser, while the downloaded original-only HTML is byte-identical to the existing case or notebook/paired CLI report for those chosen originals and optional artifact expectations.

Case review flags retain exact-source equality gates. Notebook/paired reports retain their existing per-source/per-copy/anchor restrictions and never guess copy pairs from labels, IDs or equal filenames. Source changes cannot imply unsupported review changes. No private names/text, coordinates or readings are printed. Hashes, row bounds, counts and comparison structure remain sensitive, not anonymized. There is no verified chronology, missing work, merged review, annotation transfer, completion, grade or readiness evidence.

Scope, ordinal and artifact-expectation edits invalidate the old output even if reverted. Missing/malformed/out-of-range ordinals, wrong listed kinds, wrong pins or any invalid original refuse the entire result without private diagnostics. Scope and selection fields lock while working. Downloads use a fixed kind-specific generic name, with no automatic opening, extraction, import, storage, network, upload, sharing or replay changes. Clear returns this separate ZIP comparison to whole-package mode and leaves plain-file comparison and other tools alone.

### Find checked manifest ordinals without exposing private filenames

Before choosing an explicit original review pair, use **Check Left ZIP original inventory** or **Check Right ZIP original inventory**. The selected side must pass the full strict ZIP/current-original checks, including all optional independent ZIP/manifest expectations and every listed nested original. Only after all pass does the side show the manifest ordinal, kind and complete-artifact SHA-256 for each original, in exact manifest order. No filenames, paths, labels, private review text, coordinates or readings are displayed. Ordinals are not ZIP-entry numbers. Digests and inventory structure remain sensitive, not anonymized.

Inventories never select a kind, fill an ordinal, pair originals or copy generated digests into independent expectation fields. They help the caller make explicit choices. Required manifest artifact hashes remain received byte declarations, not independent expectations. Changing the scope or selected pair leaves the inventories separate; the next comparison always freshly checks both complete ZIPs, never accepts an earlier inventory as success evidence and never reuses cached original approval.

Inventory checks invalidate any prior comparison before reading and clear the old inventory on that side. File or ZIP/manifest-expectation edits drop that side's inventory and any comparison, even when reverted, without clearing the other side's separately checked inventory. A refusal issues no partial inventory or private diagnostics. Inputs, scope, pair fields and all actions lock while checking. Clear drops both inventories and returns to whole-package mode; closing/switching drawers only hides them. No automatic download, opening, extraction, import, storage, network, upload, sharing, pause/seek, replay change or aircraft command. The inventory is neither a report download nor a complete backup, independent receipt, authenticity, chronology, source truth, identity, completion or readiness claim.

## Find a local handoff task without clearing work

The standalone header has a compact **Find a local handoff task** chooser. It opens and focuses one existing tool for fixed fabricated examples, received ZIP checks/private packets, two received ZIP or review comparisons, ZIP preparation from original files, or private original-file debrief printing. It neither adds another report drawer nor starts any check/preparation. The chooser resets after navigation and does not read selected files, load sample data, set consent, select review ordinals, fill expectations, download/open output or import anything into replay.

Navigation closes other direct report drawers but keeps their components mounted, file selections and prepared outputs retained. Manual disclosure navigation remains available and behaves the same. Keyboard focus moves to the chosen section after layout, without invoking its buttons; report areas can scroll while a small replay region remains visible even on shorter mobile viewports. No pause/seek, replay replacement, storage, network, upload, sharing or aircraft commands. The existing tool warnings, validation bounds, consent, stale-result and explicit download requirements still apply. A navigation choice is not a result or proof the handoff completed.

## Browse fixed handoff shortcuts by task

The optional **Browse and search tools** finder sits beside the existing quick
chooser, closed by default. It shows exactly twenty-two fixed handoff shortcuts,
not every replay feature and not private files or saved work. Filter by workflow
group and a case-insensitive literal substring in a fixed label, group or short
description. Fields are searched separately, with no joined-field matching,
regular expressions, file names, original review words or generated results.
The whole finder scrolls within40svh; the normal review stays mounted beneath it.

Opening, filtering, resetting and hiding the finder never navigate or read files.
Each **Open** button requests only its fixed existing route, then closes the
finder. The quick chooser keeps the same twenty values, labels and order and also
closes an open finder after an explicit choice. Existing route validation still
rejects unknown or missing targets. Navigation keeps selected file inputs and
prepared outputs mounted, opens/focuses the existing target, and supplies no
files, consent, pins, ordinals or choices. Private checks and explicit preparation,
download and import remain separate. Enter in the search field does not navigate.

Closing retains the in-tab finder query/group only; reset changes no work and
refresh drops the filter. No history, result indexing, automatic download, replay
changes, storage, network, backend writes, sharing or aircraft commands. A search
result is a shortcut description, never success evidence, a reviewed recording,
source trust, consent or completion. Fixed metadata contains no selected-file or
private-review information.

## Print only explicitly selected received-ZIP originals for a discussion

The received ZIP private packet tool defaults to **All listed originals**, preserving the whole-packet flow. To limit chapters, choose **Only explicit manifest ordinals** and enter unique comma-separated original ordinals, such as `1,3`. Nothing is preselected, guessed from filenames or copied from an inventory. Only numbers 1 through 20 are accepted, without duplicates, ranges or leading zeros; every ordinal must exist in the freshly checked manifest. Input order does not change manifest order. Chapters keep their original ordinal numbers, so a `3,1` choice prints Bundle 1 and Bundle 3, not a renumbered two-bundle manifest.

A successful received ZIP check shows its checked ordinal/kind/complete-artifact digest inventory directly above the private packet controls, without requiring another drawer or a second archive selection. Every original must validate first. It never displays private filenames, labels, notes, coordinates or readings; digests and inventory structure remain sensitive and are not independent expectations.

Packet scope/ordinal/acknowledgement edits retain this separate inventory while staling all output. ZIP or expectation edits drop it even if reverted. Every check/preparation drops the old inventory before fresh full validation, and a refusal leaves no partial inventory. Clear drops it; closing only hides it. No inventory is treated as permission, independent expected digests or cached approval for a later packet.

Scope or ordinal edits invalidate both received outputs and consume the private acknowledgement, including edits later reverted. A fresh acknowledgement is required before preparation and consumed by success or refusal. The entire strict ZIP, independent ZIP/manifest expectations and every listed original still pass current validation, including omitted originals. A bad unselected original refuses all output. Only the selected private chapters are rendered. Private expansion remains bounded to 16MiB with no partial report. This does not redact within a selected original: each selected notebook includes every applied saved copy, and each selected paired original includes both sources and its review. Shared source data or private text can still appear through a selected original.

The saved packet prominently identifies the explicit subset, its original ordinals, selected and full original counts, and the unchanged **complete original manifest** digest. Reuse references include only selected source roles/artifacts. Unselected private chapters and their reuse references are omitted. This is neither a new subset manifest nor a complete handoff, workspace backup, independent receipt, authentication, completion or readiness record. The separate fresh intake HTML still covers the whole original manifest. Downloads stay explicit; nothing is extracted, opened into replay, uploaded or shared, and other prepared tools/replay remain unchanged.

The same static packet renderer is available from a trusted checkout:

```sh
cd skydash/frontend
node scripts/report-private-training.mjs /approved/training.json --include-private-review --ordinals 1,3 > /approved/selected-discussion.html
```

Add `--expect-sha256 HEX` only with an independently obtained complete-manifest digest. Check command exit success, inspect the saved packet and print preview, and confirm the audience and transport yourself. Without `--ordinals`, the existing whole-original packet remains unchanged. Keep the complete original package and excluded work separately.

## Download one explicitly chosen received-ZIP original for manual reopening

The received ZIP checker also has a separate **Recover one explicit original for manual reopening** tool. Choose an original manifest ordinal from the freshly checked inventory, not a ZIP-entry number or guessed filename. No ordinal or consent is prefilled. A separate sensitive-output acknowledgement is required for each attempt. The optional complete-original digest must come from an independent route if used; the received inventory and manifest digests are not authentication.

Preparation freshly validates the full strict ZIP, all optional ZIP/manifest expectations and every listed original, including unselected originals. A selected independent artifact expectation is checked before nested model parsing. A bad unselected original still refuses the whole operation. Only after every check passes are that one original's complete, exact JSON bytes made ready for an explicit manual download. Its kind comes from the validated original manifest. The generic filename is `skydash-received-case-original.json`, `skydash-received-notebook-original.json` or `skydash-received-paired-original.json`, never a private received filename. Evidence shows the original ordinal/count, kind, byte count and complete original/ZIP/manifest digests. No saved report or receipt is accepted as an original.

The original is sensitive, unsigned and unencrypted. It can contain embedded recordings, source filenames, coordinates, analyst/instructor notes, criteria and comparison reviews. This is neither redaction nor a complete original-package handoff. Shared sources or excluded work are not recovered through an unselected original. Existing format exclusions remain: a portable case embeds converted CSV, not the mapping original/recipe; a notebook includes applied saved copies only. Preserve the whole original package and excluded work separately.

Downloading does not open or replace replay. After verifying the saved file, choose it yourself in the existing matching **Open review case JSON**, **Open notebook source bundle JSON** or **Open paired review bundle JSON** control. Inspect its existing original-validation/replacement preview and cancel or confirm there. Existing source/review replacement safeguards remain separate; cancelling preserves the current workspace. No automatic extraction to folders, file opening, storage, upload, sharing, aircraft commands, authentication, flight/student identity, grades, completion or readiness claim.

Every selected-original ordinal/expectation/acknowledgement edit invalidates its output even when reverted. Its own clear affects only that output. ZIP/ZIP-pin/manifest-pin edits and the received check clear also reset its selection, acknowledgement and bytes. Busy work locks received actions to prevent overlapping checks. Whole-packet and subset-packet prepared outputs, the checked inventory, other tools and replay otherwise remain independent. Closing hides this tool; refresh/tab close drops its session-only bytes.

## Private instructor discussion agenda from received originals

The received browser-ZIP checker also offers a separate private agenda. A new
sensitive-output acknowledgement is consumed on each preparation. It freshly
checks the entire bounded ZIP, independent ZIP/manifest expectations and every
listed original, then includes only undiscussed Question and Follow-up markers
from case or paired primary instructor timelines. Notebook originals still
validate, but have an explicit not-applicable chapter. No notebook notes,
Observation/discussed markers, summaries, analyst/envelope/action/checklist or
baseline/comparison notes are interpreted as tasks. Existing full private packets
and original recovery are separate and unchanged.

Every original retains its manifest ordinal and artifact hash. Eligible timelines
also retain source hashes and their own validated chronological positions/seconds. Repeated originals
are not deduplicated or combined into tasks, flights or a shared clock. Counts
are annotation counts only. No eligible markers is not verified completion or
absence of other work. No assignments, notifications, reminders or aircraft
commands. The HTML adds no coordinate/readings fields, but private note text can
contain sensitive data. It is escaped as text and never application instructions.
The static unsigned HTML is bounded to8MiB, not reopenable state, a complete
review, source backup, authentication, certification or readiness evidence.

Preparation does not download, open or share anything. Save with the separate
button, inspect saving/audience/exclusions and use secure transport yourself.
Agenda consent edits and its own clear drop its output only. ZIP/ZIP-pin/manifest
pin edits or received clear reset it; other packet scope edits retain it. Shared
busy locks prevent source changes during preparation. Closing hides it;
refresh/tab close drops it. No automatic storage, upload or sharing.

CLI parity for the same flat browser handoff originals, never received reports:

```sh
node scripts/report-training-agenda.mjs KIT/training.json --include-private-review --expect-sha256 INDEPENDENT_MANIFEST_SHA256 > NEW-PRIVATE-AGENDA.html
```

Run from `skydash/frontend`. Optional manifest expectation must come through an
independent trusted route. Check successful exit before using a redirected file;
failure can leave an empty file. Strict bounded regular no-symlink originals,
manifest/artifact pins and all nested validators apply before any HTML is issued.
The command does not extract a ZIP or write files itself. Preserve exact originals
and excluded work separately.


## Direct received-handoff task navigation

The existing local handoff chooser includes direct destinations for recovering
one original JSON, preparing the private questions/follow-ups agenda, and preparing
the full/subset private ZIP discussion packet. Each opens the same existing intake
drawer, scrolls its own section into view and places keyboard focus there. No new
drawer or workspace replacement is added. Navigation never reads a file, fills an
ordinal, expectation or consent, checks/prepares anything, downloads an output or
opens a source into replay. Existing file choices, independent consents, prepared
outputs and replay stay unchanged. The chooser resets to its prompt each time;
choose the same destination again to return to it. Refresh/tab close still drops
session-only selections and output.


## Check or recover received discussion originals separately

The standalone handoff chooser now has **Check or recover received discussion originals**. This is separate from the training-package ZIP checker. Select the fixed discussion ZIP created by the separate CSV/checklist handoff tool. Only its exact 4/5-entry stored encoding is supported, at most2MiB: source CSV1MiB, source-bound checklist128KiB, optional instructor256KiB, inert validation receipt64KiB and guide16KiB. Extra paths, duplicates, compressed/encrypted/ZIP64/link-style or changed local/central headers, CRC failures, comments and trailing bytes are refused. No arbitrary ZIP extraction is offered.

An optional independently obtained complete archive SHA-256 is checked before inspecting entries. Optional separate raw source/checklist/instructor expectations are checked before model parsing. A nonempty instructor pin with no instructor original is refused. Every complete original is freshly validated with current models and exact CSV binding, including the optional instructor when present. The received receipt and guide are never parsed, rendered, executed or accepted as success evidence. Their contents can be changed without affecting original validation, provided the supported ZIP encoding remains valid. The inventory exposes only hashes, bytes, counts and source span, still sensitive, not private words/IDs/statuses/rows/readings or filenames. No prompt/instructor lineage or outcomes are inferred. All intervals remain unsampled.

Checking never downloads, opens or replaces anything. After checking, explicitly choose one original role, acknowledge its complete sensitive raw content and use **Recheck and download selected discussion original**. Each download consumes consent, freshly validates every original again and pins the previously checked archive bytes before emitting exactly the chosen original under a fixed filename. BOM/CRLF/JSON formatting are retained. No automatic multi-file download, disk extraction, import, workspace change or restore occurs. Verify saving yourself. Protect unsaved work, choose the CSV manually in replay, then separately preview/import checklist and optional instructor JSON with their own confirmations. A checklist cannot supply instructor history, nor the reverse.

Every file/pin edit invalidates inventory even when reverted; changing output role clears consent. Clear affects only this tool. Closing hides its retained session state; refresh/tab close drops it. No active-workspace reads, pause/seek, storage, network, sharing, backend writes or aircraft commands. Optional pins and generated hashes do not establish independent authority, authorship, custody or telemetry truth. The unencrypted unsigned originals remain private; neither inventory nor download is a full workspace backup, approved operational procedure, grade, completion, certification or readiness. Existing sender guide instructions for trusted external extraction remain valid, but this new separate trusted receiver offers a bounded no-disk-extraction alternative. Preserve all originals and excluded work separately.


### Print a complete sensitive discussion packet directly from the checked ZIP

The received-discussion inventory now offers a separate **Prepare complete private discussion HTML** action. A fresh explicit acknowledgement covers every saved checklist title/ID/prompt/status/note and explicitly referenced original row/time/spacing, plus all included instructor IDs/text/discussed checkboxes/summary and held-original context coordinates/readings. The instructor chapter is absent-data-only when no instructor original exists. No prompt/marker mapping, common author, revision history or training outcome is inferred from shared CSV/IDs/words.

Every preparation consumes consent, freshly checks the complete ZIP and every original, pins the previously checked archive digest, then recomputes the private chapters from those exact originals using current models. Received receipt/guide remain inert and are never rendered or used as evidence. The checklist remains in saved order; instructor annotations use current-model time/ID order, not verified chronology. Same-time notes stay separate. All saved rows are included, no filters or truncation. Checklist chapter includes no coordinates/readings; optional instructor chapter does, explicitly. Marker context uses original held rows/age, with exact-time and gap warnings. Unknown is not zero, all intervals remain unsampled and known readings are not sensor correctness. Status/checkboxes are unverified annotations, not completion, grade, approved procedure or readiness.

The bounded2MiB static escaped HTML has desktop/mobile/A4 styles, no scripts, external assets, forms, links, signature/sign-off or progress score. Oversized output refuses the whole packet. Only a separate **Download complete private discussion HTML** click requests saving. Open locally and inspect browser print preview yourself before printing or saving PDF; long notes/page breaks vary by printer. Private words stay out of the on-screen prepared-count summary but appear in downloaded HTML. File/pin edits clear inventory and private output even if reverted; consent edits clear private output; private Clear affects only that output. Other original-role downloads/role choices stay separate. Closing retains session state, refresh/tab close loses it.

No automatic opening/printing, original extraction, replay import/replacement, active-workspace reads/changes, pause/seek, storage, network, upload/sharing, notifications, backend writes or aircraft commands. HTML is sensitive, unsigned, editable and not anonymized; it embeds no exact raw original payload and cannot restore a workspace. Preserve original ZIP/CSV/checklist/instructor and excluded analyst notes, notebook, comparison, mapping originals/recipes, unadded drafts, recovery and library separately. It does not authenticate custody/authorship, source truth, full handoff, completion, certification or flight clearance. Confirm the audience and transport yourself.

## Combine instructor originals directly from two received discussion ZIPs

In the standalone "Combine two instructor reviews explicitly" tool, choose the
"Two complete received discussion ZIPs" input route. The default original CSV plus
two instructor JSON route is unchanged. Switching input routes explicitly clears
all original/ZIP selections, pins, private acknowledgement, preview, decisions and
candidate, even when switching back. Clear drops those states for this tool only
and retains the selected route; other tools, active replay and saved downloads are
unchanged.

Choose two complete separate discussion-originals ZIPs, not training-package ZIPs.
Each must be the exact4/5-entry stored format, at most2MiB, with an actual instructor
original on **both** sides and the same complete raw CSV bytes. Equivalent parsed
samples with different CSV whitespace/line endings are refused. Explicitly
acknowledge display of both complete private instructor reviews, then validate.
Both whole archives, strict header/order/CRC reconstruction and every current
CSV/checklist/instructor original validate before any private preview. Both
checklists are checked even though their words/statuses/rows are excluded from
combination. Received guide/receipt remain inert bytes, never rendered/executed or
used as success evidence. There is no arbitrary archive extraction or raw-original
download, source repair, replay import or checklist-to-instructor mapping.

Optional independent complete-file SHA-256 expectations cover each archive,
source CSV, checklist and instructor original separately. Obtain them through a
separate trusted route, not from received/freshly calculated hashes. The checked
archive evidence shows the exact per-side archive/original fingerprints and
whether each actual caller expectation was supplied and matched. Whole-archive
pins and generated hashes are never promoted to independent raw-file pins. In the
existing three-original preview, source expectation is true only when a caller
source pin was actually checked on either of the identical sources; each instructor
expectation comes only from that side's actual raw-instructor pin. Both original
source hashes remain separately visible in the archive evidence.

The existing private combination decisions then apply without automatic marker or
summary choices. All current-model exact IDs and complete private notes/whole
summaries are shown literally. Same-ID disagreements require an explicit complete
Left marker, complete Right marker or omission; no field blending, auto-renaming,
checkbox OR, guessed similarity/time matching or chronology. Different IDs remain
separate even at equal times/with equal notes. The optional bulk action handles
only still-unresolved nonconflicting rows and never overrides explicit omissions
or disagreements. Choose one whole summary or explicitly empty. Every annotation
and summary must be resolved; the existing100-marker/256KiB candidate bounds apply.

Output is the same new source-bound instructor JSON, never repacked discussion
ZIPs, an altered checklist, an applied review or an authenticated history. Keep both
original ZIPs and the new candidate separately. If source CSV is needed for manual
reopening, use the separate trusted receiver's explicit selected-original download,
then manually choose CSV and preview/import the new instructor JSON with its own
confirmation. No automatic reopening, replacement, sharing or upload occurs.

Existing explicit decision-progress download/import still works. It binds choices
to the three complete raw CSV/Left-instructor/Right-instructor fingerprints, not
ZIP guide/receipt bytes or excluded checklists. Revalidate chosen archives first,
then inspect and explicitly restore a progress replacement preview; restoring does
not prepare/download a candidate or apply anything to replay. Altered raw originals
refuse the old plan. Identical raw originals inside different ZIP wrappers are not
authenticated archive identity or revision history. Every file/pin/acknowledgement
edit drops preview/choices/candidate even if reverted; validation consumes consent.

Private words may include coordinates/personal details. No original CSV coordinate/
channel readings are added to the private preview. Hashes/counts remain sensitive,
not authentication. Left/Right are chosen sides, not verified author identity,
authority, chronology, shared lineage or consensus. Absence is not a deletion
instruction. Statuses/discussed checkboxes remain unverified human annotations,
never approved procedure, competence, completion, grades, certification, flight
clearance or readiness. No source/original writes, repair, active-workspace reads/
changes, pause/seek, storage, network, backend writes, notifications or aircraft
commands. Excluded workspace data and unfinished drafts still need their own
preservation. Closing only hides session state; refresh/tab close drops it.

## Explicit whole-item discussion checklist reconciliation

Use **Combine two checklists explicitly** in the standalone handoff chooser.
This is a separate local file tool, never an automatic change to active replay or
its checklist. Default input is one complete original CSV (1MiB) and two complete
source-bound checklist JSON originals (128KiB each). Reusable templates are refused.
Alternatively select two complete received discussion ZIPs (2MiB each, exact stored
4/5-entry format). Both ZIPs and every original validate, including optional
instructor originals that are excluded from the checklist choices. Both4-entry,
both5-entry and mixed presence are supported. Different complete CSV bytes refuse
combination, even if parsed samples would match. Received guide/receipt are inert,
not instructions or evidence. No arbitrary extraction, original-role download,
source repair, instructor-to-checklist mapping or cross-source remapping occurs.

Explicit private acknowledgement is required before either route reads files.
Every preparation consumes it, locks inputs while checking, and either validates
all selected originals/current models or refuses the whole preview without private
diagnostics. Full private titles, exact IDs, prompts, human statuses, notes/reasons
and original row/time/spacing context are shown literally. Empty saved notes have
an explicit field label, distinct from literal placeholder words. No original
source coordinates/channel readings are added, though saved reviewer words may
contain them. Source row context is discussion context, never causation or proof;
all intervals remain unsampled, including those at or below5s.

Optional independent SHA-256 pins cover the three raw originals, or all eight
per-side archive/source/checklist/instructor files for ZIP input. Obtain pins by a
separate trusted route. An instructor pin on a ZIP requires an actual original.
Archive evidence keeps each actual caller pin separate. Whole-ZIP/generated hashes
are never relabeled independent raw-file pins. In the three-original section,
source expectation means an actual source pin checked on either identical CSV;
each checklist expectation comes only from that side's actual raw-checklist pin.
Fingerprints detect byte differences, not authorship or authority.

Every exact-ID row starts unresolved, including equal and one-sided items. Choose
one complete Left item, one complete Right item, or omission from the new candidate.
All prompt/status/note/reason/row fields stay together. No blending, status
precedence, checkbox OR, similar-word/time matching, auto-renaming, guessed
chronology, lineage or consensus. Absence is not deletion. An optional explicit
bulk action selects only still-unresolved equal/one-sided items. It never resolves
same-ID field disagreements or the title and never overwrites existing omissions.
Choose one exact whole Left or Right title separately, even when titles match.

Candidate order is deliberately Left original order, then Right-only IDs, skipping
omissions. A Right item choice does **not** move it to its Right original ordinal.
Original ordinals/order differences are shown separately; inspect the numbered
complete candidate before downloading. Every ID must be resolved. At most30 items
and128KiB of current-model JSON are permitted. Oversize refuses the whole candidate,
never silently dropping/truncating items. Zero chosen items is allowed only through
explicit choices and a title; zero is not evidence of review completeness.

**Prepare explicitly chosen checklist** validates a new source-bound review and
shows its exact title and complete new item order/status/notes/row references.
Only a separate **Download combined checklist JSON** click requests saving the
fixed-name `skydash-combined-discussion-checklist.json`. It is a new sensitive,
unsigned, editable review, not a decision log, authenticated revision/history,
backup, combined ZIP, reusable template or applied checklist. It preserves selected
human states as human states: Discussed/Not applicable are unverified reviewer
annotations, never competence, completion, applicability proof, approved procedure,
grades, certification, flight clearance or readiness. Confirm audience and secure
transport yourself. Keep both original reviews/ZIPs, exact CSV and excluded work.

If wanted, manually preview/import that new JSON in the existing discussion
checklist for its exact source; replacement has its own separate confirmation.
Candidate preparation/download never opens/applies it automatically. Every item or
title decision stales the candidate. Every file/pin/ack edit drops all private
choices/output even if reverted. Switching input routes clears both routes' files,
pins and private states; Clear retains the current route but clears this tool only.
Closing only hides session state. Only explicit decision-plan download/import below; refresh/tab
close drops unsaved decisions. No active workspace reads/changes, original/source writes,
pause/seek, storage, network, backend changes, notifications, upload/sharing or
aircraft commands.

### Save and resume explicit checklist reconciliation decisions

After freshly checking the original CSV and both source-bound checklists, the
separate **Download checklist decision progress** action can preserve incomplete
left/right/omit/unresolved choices and the separate whole-title choice. The
fixed-name `skydash-checklist-combination-decisions.json` uses
`skydash-checklist-combination-plan-v1`. It embeds no CSV, original checklist,
private prompt/note words or title text, but exact IDs, role-bound raw fingerprints
and decisions remain sensitive and identifying. It is unsigned editable progress,
not an audit, authenticated authorship, original backup, candidate or permission.

The three complete raw source/Left-checklist/Right-checklist fingerprints must
match in their original roles, and every exact unique current ID and present-side
choice must validate. All60 possible IDs remain represented, including unresolved
ones. Import is strict complete UTF-8 JSON, at most32KiB, with no extra fields or
unsupported versions. Raw whitespace-only original edits refuse prior progress.
Swapped roles refuse unless original bytes are identical. ZIP wrappers, received
receipt/guide bytes, excluded instructor originals and independently supplied
archive pins are not the plan identity; they must still validate separately in the
chosen ZIP route. Thus identical three raw originals can resume across direct-file
and ZIP input, without claiming authenticated archive identity or revision history.

First freshly validate originals with private-preview consent; a plan never
supplies files or consent. Choose the saved plan and inspect **every** proposed
item and title decision against current choices. Import only prepares a replacement
preview, it does not change choices or generate a candidate. **Keep current
checklist decisions** discards the preview without changes. **Restore reviewed
checklist decisions** explicitly replaces all current choices/title, including
unsaved choices, and drops any prepared candidate. Unresolved stays unresolved.
Then review the private original item/title words and separately prepare, inspect
and download a new candidate if wanted. No item fields, original files, active
checklist, replay/cursors or other tool change on restoration.

Every original/file pin/acknowledgement or item/title decision edit discards any
pending plan preview, even if reverted. Validation, clear and route changes also
clear the tool's private state as before. Plans are saved/read only by explicit
user file actions. No automatic persistence, download, import, candidate generation,
source writes, storage, network, upload/sharing, backend writes or aircraft commands.
Refresh/tab close drops unsaved local progress. Preserve all exact originals and
check the audience/secure transport of both plan and eventual candidate yourself.

## Independent multi-ZIP discussion intake

The local handoff chooser now has a separate discussion intake queue. Explicitly
select one to ten discussion-original ZIPs, at most 20 MiB total, then check. The
browser's selected positions become input ordinals, not author/student/flight
identities or revision chronology. Selected filename labels appear only in the
input list, never in the resulting inventory or JSON. This is not the separate
training-package ZIP format. Each input still needs the exact supported 4/5-entry
stored discussion layout at most 2 MiB and every current source-bound original.
Oversized individual inputs are refused before reading; batches over the total
bound or with malformed configuration/expectations refuse before any file read.

Each input has separate optional independent complete-file archive/CSV/checklist/
instructor SHA-256 expectations. Get them through a separate trusted route;
co-delivered or computed hashes do not authenticate themselves. An instructor pin
requires an actual instructor original on that input. Generated archive/source
fingerprints never populate expectation fields or become independent raw pins.

Checks run serially, retaining only fixed privacy-limited inventories. Damaged
headers/CRCs, unsupported layouts, invalid current originals/source bindings or
mismatched expectations refuse that input with generic diagnostics; later inputs
are still checked. Received guide/receipt bytes stay inert, never opened,
executed, rendered or treated as evidence. No partial inventory is supplied for a
refused input. Its refusal is not proof of an absent, empty, deleted or complete
review. An included zero-annotation instructor and absent instructor stay distinct.

Every checked input retains its own raw hashes/byte counts, caller-expectation
flags, source sample count/span, checklist prompt count and actual optional
instructor count. The report supplies no cross-original prompt/status/annotation
totals. Archive/source digest relations reference only the first earlier checked
selection ordinal with the same corresponding raw fingerprint. Different wrapper
bytes can still carry the same raw CSV; equivalent parsed samples with different
CSV bytes do not acquire a source relation. None of these relations proves
identity, lineage, consensus, custody, review/training completeness, competence,
grades, certification, readiness or authenticated history. Every interval remains
unsampled; span is not continuous observation.

Download `skydash-discussion-intake-v1` JSON separately with its fixed filename.
It preserves every input ordinal and generic refused row honestly. Any refusal
makes the report partial, not a successful check of those rejected originals.
The model explicitly projects allowed fields, not filenames, private titles/IDs/
prompts/notes/summary words, individual statuses/row/time references, coordinates,
readings, raw originals or private error text. Hash/count/span/selection relations
remain sensitive, not anonymized. The report is editable unsigned metadata, not
source truth, a complete workspace backup or permission to share. Confirm saving,
audience and secure transport yourself; preserve every exact input/excluded work.

File/pin edits discard the whole report even if reverted. Rechecking replaces it,
never merges old results. Reselecting files resets all independent expectations.
Busy locks inputs/actions; closing hides session state; refresh/tab close loses
it. Clear affects this queue only, not other prepared tools or saved downloads.
No automatic download, original extraction, private print, semantic field pairing,
repair, active-workspace read/change, pause/seek, storage, network, upload/sharing,
notification, backend write or aircraft command occurs. Use the separate receiver
and private tools with their own explicit consents and manual replay confirmations.

### Read-only discussion intake from a trusted checkout

From `skydash/frontend`, run:

```sh
npm run check-discussion-intake -- INPUT1.zip INPUT2.zip \
  --expect-input-1-archive-sha256 INDEPENDENT_COMPLETE_ZIP_SHA256 \
  --expect-input-2-source-sha256 INDEPENDENT_COMPLETE_RAW_CSV_SHA256
```

One to ten explicit paths precede optional flags. Prefix a filename beginning with
a dash with `./`. `N` in `--expect-input-N-ROLE-sha256` is the one-based selected
position, never chronology or identity; ROLE is archive/source/checklist/instructor.
Each pin is optional, independent and exactly 64 hex characters. Duplicate flags,
unknown flags/roles, indexes outside the selected list and malformed expectations
refuse configuration with no report. Whole-ZIP pins never become raw-file pins.

The command uses the same current privacy-limited browser intake model and report
format. Only canonical regular paths without symlinks, including parent paths,
can be read; each complete ZIP is at most 2 MiB, total at most 20 MiB. Content,
path/size or pin failure gives that input a generic refused row while later inputs
continue. Global count/total/configuration failure gives no report. No original
bytes/words/filenames/paths/private errors are printed and nothing is extracted,
written, repaired, imported, uploaded or shared. Fingerprints/counts/span remain
sensitive unsigned metadata with the same identity/history/outcome limits above.

Exit status matters:

- `0`: every selected complete archive checked. Not training completion/readiness.
- `2`: valid JSON report contains partial or all-refused entries. Inspect each row;
  do not treat nonzero status or saved JSON as validation of rejected originals.
- `1`: configuration/build failure, no report issued.

The command never saves output itself. Shell redirection is a separate save action
and can leave an empty or partial report. Check exit status and every refused row
before using output, confirm audience/secure transport, and retain every exact
input and excluded artifact separately. This is not a backup or permission to share.

### Read or print the selected discussion intake without private original words

From an installed trusted checkout's `skydash/frontend`:

```sh
node scripts/report-discussion-intake.mjs INPUT1.zip INPUT2.zip > intake.html
npm run --silent report-discussion-intake -- INPUT1.zip INPUT2.zip > intake.html
```

Replace the paths yourself. This checks every explicitly selected complete ZIP and every included original again with the current intake validators before printing one self-contained static HTML document. A saved JSON inventory, received receipt or earlier HTML is never accepted instead of originals. The same one-to-ten canonical no-symlink regular input paths, including parent paths,20MiB total/2MiB per ZIP and separate optional `--expect-input-N-archive-sha256`, `--expect-input-N-source-sha256`, `--expect-input-N-checklist-sha256` and `--expect-input-N-instructor-sha256` flags apply. Paths precede flags; `N` is the one-based selected position. Obtain expected complete-file digests independently. Generated hashes never populate expectations or authenticate authorship.

Check the process exit status before using the document: **0** means all selected archives structurally checked, **2** means valid partial/all-refused HTML, and **1** means configuration/build failure with no report. Shell redirection can still leave an empty or partial output file. A readable HTML file is not proof that every input checked. Refused positions remain explicit and generic with no verified inventory or private errors; later selected inputs continue independently. Over-limit or malformed batch configuration emits no partial document. The command itself writes nothing and performs no extraction, restoration, network, upload, sharing, backend write or aircraft command.

The readable per-input chapters retain exact complete-archive/raw-original fingerprints, separate caller-expectation flags, source sample bounds, per-original prompt/annotation counts, actual instructor inclusion and byte relations to the first earlier checked selected position. No cross-original prompt/status/time/training totals, automatic pairing, chronology, student/aircraft/flight identity, shared lineage or acceptance decision is inferred. Excluded instructor means not included, not an empty review. Source seconds have an unverified time basis; intervals remain unsampled, not observed elapsed flight time. Counts and human annotations do not prove completion or readiness.

The report omits original paths, filenames, titles, IDs, prompts, notes, summaries, coordinates, individual readings and private error diagnostics. Hashes, counts, bounds and reuse patterns remain sensitive, not anonymized. Desktop/mobile layout, a local position index and A4 print styles need no scripts or external assets. Open the HTML locally and inspect print preview yourself before printing or saving PDF. It is editable unsigned output, not authenticated history/custody, source truth, a source backup, a reopenable workspace, complete handoff certificate, grade, certification or flight clearance. Preserve every original and excluded artifact separately, review the audience and use approved transport yourself.

### Try fixed fabricated discussion examples before selecting real originals

Choose **Try fabricated discussion examples** in the local handoff chooser, or open the separate starter inside the discussion intake queue. **Prepare fixed synthetic discussion examples** builds three separate standard discussion-original ZIPs over one fixed fabricated CSV. Left and Right each contain a different complete source-bound checklist and instructor original; the third contains the Left checklist and explicitly omits instructor. These are five/five/four-entry discussion ZIPs, not the separate training-package ZIP format. The examples preserve the synthetic source gap and missing channel cells. Every prompt, note, title, instructor annotation and summary is labelled SYNTHETIC. There are no real recordings, people, timestamps, OEM compatibility claims or completed training.

Preparation reads no selected input, active review, local library, account or storage, and opens or downloads nothing. It uses current source/review validators and the standard original packer, then freshly checks all three complete ZIPs with the current intake model before returning any prepared examples. Failure leaves no partial output. Three selected examples reuse one exact fabricated source, not three independent flights. Generated hashes are reproducibility fingerprints, never independent expectations, authenticated authorship/history/custody or permission to share.

Download each fixed-name Left/Right/no-instructor ZIP and the separate `SKYDASH-SYNTHETIC-DISCUSSION-GUIDE.txt` only through their explicit actions. Confirm saving yourself. Then deliberately select the saved ZIPs in the intake queue, leaving independent expectation fields empty unless you actually obtained expectations independently. The two five-entry ZIPs are useful for the separate discussion snapshot comparison or explicit checklist/instructor reconciliation tools. Those tools retain their own private-preview acknowledgements, unresolved whole-item/title choices, candidate preparation and manual replacement confirmations. Instructor absence in the four-entry example is not an empty review, deletion or completion.

No file is automatically transferred to another tool. Generated hashes never populate expectation fields. Selecting fabricated examples does not apply their annotations to an active recording. The guide describes the incompatible archive kinds, literal private previews, raw-original recovery and each separate manual reopening/replacement step. Protect unsaved real work first. Synthetic human statuses/checkboxes are not detected events, approved procedures, operational preflight instructions, grades, certification, readiness or flight clearance.

Every preparation first discards only old starter output and locks its controls. Clear affects only this starter, not selected intake files/results, other prepared outputs, active reviews, clocks or saved downloads. Closing hides session state; refresh/tab close loses it. The ZIPs are unencrypted unsigned examples, not source backups or a full workspace. No extraction, automatic choice/candidate/import, source replacement, pause/seek, storage, network, upload/sharing, backend write or aircraft command occurs. Keep real originals and excluded work separately.

### Download a fresh readable intake snapshot from the browser

After explicitly checking a selected intake queue, **Recheck and download intake HTML** is a separate action. It first removes the old inventory, locks the queue and freshly reads every complete selected original ZIP using the current separate caller expectations. The resulting inventory replaces the old one. Only then is the fixed `skydash-discussion-intake.html` download requested. This is not a print dialog, automatic file opening, extraction, replay import, sharing or proof of saving/delivery. Check the destination yourself and deliberately open the saved HTML, then inspect browser print preview before printing or saving PDF.

The static HTML uses the same privacy-limited escaped renderer as the CLI report, with browser-specific preservation instructions rather than command exit-status/redirection claims. It contains sensitive per-original hashes, sample/span/prompt/annotation counts and raw-fingerprint selection-position relations, never filenames, private review words, individual source-row/status/annotation times, readings or coordinates. No cross-original training totals or inferred identity/history. Independent caller pins remain separate from generated fingerprints. Instructor absence is explicit, never empty/completed work. Partial/all-refused documents have a visible warning and generic refused rows, not fabricated inventory. Configuration or HTML preparation failure produces no document or private diagnostic. No scripts, external assets, sign-off fields or automatic printing/opening are included; narrow original tables scroll horizontally and A4 uses fixed columns. An already saved editable unsigned HTML snapshot never updates when files/pins change. Every current file/pin edit invalidates browser inventory and both download actions, even when reverted; a fresh check is required again. Real originals, other tools, existing saved outputs, the active case and both replay clocks remain separate. Keep all exact originals and excluded work yourself; this is not a backup, reopenable workspace, authenticated custody/history, training completion, certification or readiness.

### New-folder fixed discussion example for a self-hosted trial

From a trusted installed checkout, run `cd skydash/frontend && npm run create-discussion-example -- --output-dir /an/existing/canonical/parent/new-example`. The explicit new destination gets exactly five fixed files: standard Left, Right and no-instructor discussion ZIPs, a fresh metadata-only intake JSON and the same manual-route guide as the browser's fixed discussion starter. Each run uses the current complete-original packer and intake checker before creating the folder. Browser and CLI archives, guide and intake are byte-identical; the Left/Right ZIPs each contain five standard originals, the third four with explicit instructor absence. All three reuse one fabricated CSV with synthetic gaps/missing cells and SYNTHETIC review words, never independent flights, real people, historical recordings, actual OEM compatibility, completed training, grades or readiness.

The parent must exist with no symlinked ancestor. The destination must not already exist, even as an empty folder or symlink; no recursive parent creation, overwrites, extraction, implicit opening or private input flag exists. New directory0700/files0600 where supported. Exit0 emits a reproducibility receipt of fixed filenames, byte lengths and generated SHA-256 values, never the private destination path or review words. Exit1 emits a generic refusal and no success JSON. A failed write can leave a partial new folder; inspect that explicit destination, then choose a new name rather than assuming a partial folder is usable. Do not replace an existing destination to make a retry succeed.

The receipt, included JSON and generated hashes are not proof of actual delivery, independent receiver expectations, identity, authorship, provenance, custody or training. The JSON is a momentary check of the bundled originals, not a recoverable ZIP, saved decision plan or input to another checker. Follow the guide by deliberately selecting saved ZIPs into current intake/comparison tools and retaining each private-detail, unresolved-choice and replacement confirmation. Nothing reads an account/library/active workspace or applies to replay. Preserve real originals and unsaved work separately. No network, browser storage, sharing or new frontend payload is involved.

### Guided fabricated discussion trial

The standalone task chooser now starts with `Start guided fabricated discussion trial`. Its separate collapsed disclosure gives five instruction stages: deliberately prepare/save fixed examples; manually select/check each ZIP in intake; compare the separate Left/Right snapshots; make explicit whole-item checklist choices; optionally recover one original for manual reopening. Each button only opens and focuses its fixed existing tool. Return through the task chooser. No selected file, prepared output, independent expectation, consent, decision or candidate transfers between tools. Separate actual selection, checking, privacy consent, download and replacement confirmations remain required.

Manual `Flag for my follow-up` checkboxes are personal in-tab reminders about the instructions, never a completed task list, tool-use history, accepted training or a grade. Opening steps does not mark flags or infer progress. Hiding the guide preserves flags; clearing flags changes only the guide. Refresh/tab close loses them. No file/workspace/account/library reads, automatic preparation/download, extraction, import, storage, network, sharing, backend write or replay-clock changes occur. Existing selections, prepared results and unsaved real work remain separate. The examples reuse one fabricated source with gaps and missing cells, not independent flights or verified OEM compatibility. Preserve real originals and unsaved work; do not use the annotations as operational instructions, certification, readiness or flight clearance.

### Assemble a separate new-folder self-hosted discussion trial

After deliberately building the standalone profile from a trusted installed checkout (`npm run build:offline-review`), run `npm run create-discussion-trial -- --build-dir dist-offline-review --output-dir /an/existing/canonical/parent/new-trial` from `skydash/frontend`. The selected build must have the existing exact bounded standalone HTML/single-JS/single-CSS layout. This command copies but never executes or rebuilds those selected assets. It does not verify their version, agreement with the checkout, code trust, malware clearance or actual OEM compatibility. Only the installed trusted checkout's fixed synthetic generator runs.

The explicit new destination contains twelve mode0600 files under mode0700 directories where supported: `app/` is the unchanged standard five-file standalone distribution, `examples/` contains the unchanged three standard discussion ZIPs plus intake JSON and fixed guide, and the root adds `START-HERE.txt` and `trial.json`. The app is freshly validated before writing and checked again after writing; bounded no-follow reads compare every written file before success. `trial.json` inventories the eleven other files, not itself. Its generated/co-delivered hashes are not independent expectations, signatures, trusted code or delivery confirmation. Examples are freshly generated/currently checked, one reused fabricated CSV, not three independent flights or completed training. The included intake JSON is not a recoverable ZIP, saved decision plan or checker input.

The output parent must already exist with no symlinked ancestor. The destination must be outside the selected build and must not already exist, including as a folder, file or symlink. No recursive parent creation, reuse, overwrite, extraction, installation, implicit server/browser launch, selected recording/account/library/workspace reads, network, sharing, backend write or aircraft command. A failed write or written-file check can leave a partial new folder; exit1 has generic diagnostics and no success receipt. Inspect the explicit destination and choose a different new name rather than replacing existing work for a retry.

Read `START-HERE.txt`. Verify `app/` using the separate trusted checkout, independently choose to trust executable assets, then explicitly run the existing loopback server against only `app/`. It serves only the checked in-memory HTML/JS/CSS snapshot, never the trial root, examples, guide, inventory, checkout or recordings. No verifier, server, dependencies or license notices are delivered inside the trial folder; retain the trusted checkout and license notices separately. Open the actual returned local URL yourself and stop the server when done. Current builds provide the guided fabricated trial. Every file selection, privacy consent, whole-item choice, download and replacement confirmation remains manual. Preserve real originals and unsaved work. No authenticated authorship/custody, certification, grade, readiness or flight-clearance claim is made.

### Read-only whole-trial receiver check

Use `npm run verify-discussion-trial -- /path/to/new-trial [--expect-inventory-sha256 HEX] [--expect-app-manifest-sha256 HEX]` from a separate trusted installed checkout. The optional raw `trial.json` expectation is checked before JSON parsing or app/example processing. Obtain it independently; a fingerprint delivered with the folder cannot authenticate itself. The checker requires the exact canonical twelve-file current trial layout, bounded directories/regular files and no symlink aliases. It reads only fixed own paths and the existing app reader's fixed bounded layout, never a path selected by received inventory text. No extraction, writes, server/browser launch, install, import, network or sharing.

The app is checked by the unchanged distribution reader without treating its co-delivered inventory digest as an independent pin. Every example file must be byte-identical to the current trusted checkout's fixed synthetic generator. The three actual selected ZIPs then pass fresh current complete-original intake; their current result must match the fixed synthetic intake. Both guides, all eleven inventory entries, exact order/size/digests, false source-version/independent-expectation markers and the raw inventory's stability are checked. The inventory does not cover itself. This is deliberately a current fixed-fabricated-trial checker, not an arbitrary private-recording or general folder checker; older/incompatible generated templates may be refused rather than silently upgraded.

Exit0 emits a privacy-limited momentary JSON receipt with twelve files, three currently checked fixed examples and separate caller-inventory-pin/app-co-delivery status. App independent-pin status is true only when a separate caller app-manifest expectation was explicitly supplied and matched; source-version verification remains false. Even a fully repaired changed app and co-delivered inventories establish only structural byte agreement, never code trust, revision agreement, authenticated authorship, malware clearance, actual OEM compatibility or certified isolation. Only the trusted installed checkout's generator/validators execute. Independently trust source/build before any separate explicit server action. Exit1 emits generic diagnostics and no receipt; inspect status because shell redirection can leave an empty output. Inputs are never changed. Keep them unchanged during checking and preserve originals, excluded work and unsaved real reviews. No custody, delivery, training-completion, grade, certification, readiness or flight-clearance claim.

## Focus private combination decisions without losing hidden work

Both instructor and checklist combination tools now offer a view-only decision
queue after the existing fresh validation and explicit private-preview consent.
Show all IDs, unresolved IDs, same-ID field disagreements, chosen left/right IDs
or explicitly omitted IDs. A case-insensitive literal substring can narrow any
view by row ID or either original's saved note, prompt or reason. Searches do not
join words across fields and exclude whole titles/summaries, statuses, types,
times and source readings. At most ten rows are mounted per page. Existing row
labels and comparison order stay unchanged, including annotation labels on a filtered page. Same-ID field
changes do not include an order-only checklist difference; original ordinals and
order differences remain visible in each original item row.

Ranges distinguish matching IDs from the complete checked snapshot. An empty
view does not mean every decision is resolved, nor agreement or completeness.
Every original ID, including hidden pages and filtered-out rows, still enters the
existing unresolved/candidate-size gates. The whole title or summary remains a
separate explicit decision. The existing bulk action still covers all unresolved
nonconflicting IDs across the complete snapshot, not only the current view, and
never overwrites existing omissions or disagreements.

Changing a view or page changes no original, decision, private acknowledgement,
pending decision plan or prepared candidate. A decision edit still drops the
candidate and pending plan even when reverted. Changing an original/pin/consent
still drops the complete private snapshot, decisions and queue view. Close only
hides session state; reset decision view changes no decisions. Existing sidecar,
checklist and decision-plan formats, limits and downloads are unchanged. No new
storage, file reads, automatic choices/downloads, source evidence, replay changes,
network, sharing, backend writes or aircraft commands. No completion, shared
authorship, trusted identity, consensus or readiness claims are added.

The normal startup JavaScript and existing755KiB total-JS guard are unchanged;
this component is only in the explicit standalone recorded-review build. This
is a bounded rendering change, not a measured latency or frame-rate claim.

## Save only personal fabricated-trial follow-up

The guided fabricated discussion trial has five optional personal notes, at most
400 characters each, alongside its existing manual follow-up flags. Neither a
flag nor a note establishes that a tool was used, a trial completed or training
accepted. No source, review, consent, choice or replay state is read for these
personal fields.

Open **Save or resume personal trial follow-up** to request a separate local
`skydash-trial-followup.json` download after its sensitive-word acknowledgement.
It contains only the five fixed task IDs, manual flags and exact entered notes.
There are no original filenames, source hashes, accounts, tool-use timestamps,
review outcomes or completion fields. It is unencrypted, unsigned and editable.
Inspect your own words and confirm the audience; saving never uploads or shares.
Verify saving yourself and keep real originals and other unsaved work separately.

To resume, explicitly select that JSON. The reader accepts at most 16 KiB of
valid UTF-8 JSON, version 1 of `skydash-fabricated-trial-followup`, exactly the five
fixed ordered task records and bounded notes. Extra or missing fields, unknown or
duplicate/reordered tasks and unsupported versions are refused. All five selected
flags/notes are previewed as escaped text. A separate acknowledgement and
**Replace only personal trial follow-up** action replace only these personal
fields, never an active review or another tool's selected file, prepared result,
private consent, decision or clock. This is not a workspace backup or import.

Every flag/note edit and either personal clear invalidates any preview and its
acknowledgements, even if reverted. A newer selected file supersedes an earlier
pending read. Refusal leaves the current personal fields intact. Clear flags and
clear notes are independent. Closing the guide hides these values; refresh or tab
close loses them unless explicitly saved, and nothing auto-restores. No browser
storage, network, backend write or aircraft command is added.

## Focus original instructor annotations before building an agenda

After the existing fresh original CSV/sidecar validation and explicit private
preview consent, the instructor agenda tool displays ten original annotations
per page. Filter by the saved original kind, the original discussed checkbox, or
selected/not-selected for this agenda. A case-insensitive literal substring
search covers the original ID or saved note separately, not the summary, source
readings, times, edited agenda prompts or another tool. All original annotation
numbers and validated order are retained. These are view controls, not inferred
priority, verified discussion, completion, agreement or absence of follow-up.

Selections remain global and in the user's explicit agenda order, including
hidden rows. The separate editable agenda retains every selected prompt, full
original wording until explicitly edited, row-reference choice and title. The
existing30-prompt cap applies across all pages. There is no bulk or automatic
selection. Filtering, searching, paging and resetting the view do not change
choices, private consent, prepared source-bound checklist or reusable template.
A real title/prompt/order/reference/selection edit still invalidates prepared
output. Original file/hash/consent edits still remove the complete private
preview, choices and output, including when reverted; fresh validation starts a
new unfiltered first page with nothing selected.

The source-bound checklist still starts every explicitly chosen prompt Pending
with blank notes and only deliberately chosen held original rows. The separate
reusable template still excludes source/status/notes/references. Hidden originals
are not silently discarded or truncated. No active-review reads/changes, clock
changes, automatic downloads/imports, storage, network, backend writes, sharing,
new normal-startup payload, grades, certification or readiness claims are added.

## Read a fresh fixed-trial receiver check as offline HTML

From a separate trusted installed checkout's `skydash/frontend`, run
`node scripts/report-discussion-trial.mjs TRIAL-DIR [--expect-inventory-sha256 HEX] [--expect-app-manifest-sha256 HEX] > trial-check.html`.
For npm redirection use `npm run --silent report-discussion-trial -- TRIAL-DIR`.
This freshly checks the entire actual twelve-file fixed trial folder with the
same bounded canonical/no-symlink reader, current fixed synthetic generator and
complete-original intake as `verify-discussion-trial`. A saved receipt or JSON
inventory is not accepted as a replacement input. No selected executable assets
are run, no verifier is taken from the received folder and no files are changed.

Both JSON verification and HTML reporting accept either optional independent pin
or both, in either order, once each. The raw `trial.json` expectation is checked
before its JSON is parsed. The separate raw `app/distribution.json` expectation
is checked before selected application asset bytes are read. Obtain expectations
independently, never from the co-delivered inventory or this generated report.
Absent pins remain explicitly absent; a co-delivered match never fills them.
Default JSON fields and existing folder formats remain unchanged. A matched
caller value means byte agreement with that value, not authenticated authorship,
trusted code, verified source/build revision or malware clearance.

The self-contained static report shows the twelve-file/three-fixed-example scope,
both reproducibility fingerprints, separate actual caller-pin status, exact-byte
checks, unverified claims and manual preservation steps. Private paths, original
review words, coordinates and individual readings are omitted; hashes and
code-presence metadata can still be sensitive. No scripts, external assets,
sign-off controls or automatic opening/printing are included. Desktop/mobile and
A4 styles need no network. Inspect the audience and print preview yourself.

Exit0 means the complete fresh check and HTML preparation succeeded, never code
trust, delivery, accepted training or readiness. Exit1 refuses with no report and
generic diagnostics. Shell redirection is a separate save action and can leave
an empty or partial output, so inspect exit status and the result. Save the HTML
outside the checked trial folder so the exact twelve-file layout stays unchanged.
This editable unsigned snapshot never updates and is not a backup or reopenable
workspace.
Rerun current checks after changes; retain every exact input, the trusted checkout
and license notices, real originals and unsaved reviews separately. Independently
trust executable source/build before any separate explicit app-only loopback
server action. No writes by the command, extraction, installation, serving,
browser launch, import, replay changes, network, sharing, backend write or aircraft
command, and no grade, certification or flight-clearance claim is added.

## Read personal trial follow-up without reopening JSON

The guided fabricated discussion trial's personal follow-up disclosure can
prepare a readable sheet of all five manual flags and complete personal notes.
This uses only the same strict five-step personal-value model as the saved
follow-up JSON. It does not inspect originals, replay, tool results or actions.
The full literal preview comes first. A separate acknowledgement requests one
HTML download; the JSON-download acknowledgement never authorizes the HTML.
Every personal edit or clear, even when reverted, discards the prepared sheet
and its acknowledgement. Preparing again or selecting any saved follow-up JSON
also clears HTML-download authority. A pending JSON read blocks preparation.

The unsigned, unencrypted HTML preserves every personal note, including any
private names, claims or sensitive words typed into it. Inspect all five steps
and the audience yourself. Flags are personal reminders, never completion or
verified tool use. HTML escapes the original words, includes no scripts or
external assets, and has desktop, mobile and A4 styles. Saving, opening,
printing and sharing are manual. Check the saved file and print preview.
Nothing is automatically sent or applied to a review.

The readable sheet is a momentary snapshot, not a backup or reopenable
workspace. Use the separate personal follow-up JSON to resume these personal
values only; preserve every real original and unsaved review separately. No
source files, filenames, hashes, pins, accounts, privacy consents, decisions,
prepared tool results or replay state are automatically included. Notes may
nevertheless repeat any of those if typed by a person. No automatic reading,
storage, network, upload, sharing, import, replay change, backend write or
aircraft command, and no training-completion, grade, certification, readiness
or flight-clearance claim is added.

### Choose only specific personal steps for the readable sheet

The readable sheet defaults to all five instruction steps. For a partial sheet,
choose **Only explicit instruction step numbers**, then enter unique numbers
1 to 5 separated by commas, for example `5,1`. No ranges, duplicates, inferred
flagged steps or automatic selection. The prepared preview and HTML retain the
original instruction order and numbers, so that example includes steps 1 and 5,
not newly numbered steps 1 and 2. Only their complete notes and manual flag
states appear. An omitted step is never evidence that no other notes or
follow-up exist. Every selected note remains sensitive and must be inspected.

Scope and number edits discard the readable preview and its acknowledgement,
even when reverted, without changing personal values, JSON-download consent or
a saved-JSON replacement preview. Personal edits still discard all prepared
previews and acknowledgements, but retain the chosen sheet scope in the current
tab. A fresh preview and separate acknowledgement are always required. Selection
of any saved personal JSON discards the prepared sheet. The entire strict
bounded five-step personal model still validates before any subset is prepared;
there is no partial success for malformed hidden values.

The readable scope is not saved in JSON. The separate personal follow-up JSON
always includes all five flags and notes, including steps omitted from the
readable sheet. Its format and replacement behavior do not change. A partial
HTML sheet is not a redacted JSON backup, a reopenable subset, proof of absent
work, verified actions or a completed trial. No automatic sharing, import,
reading of other originals, replay changes or storage is added.

## Inspect one original source interval in the standalone app

After explicitly opening a primary CSV, the source panels include **Inspect one original source interval**. This separate plot does not crop or change the full-source chart, saved review window, criteria, notebook or comparison. Enter inclusive original source-second bounds and choose one of the three known channels, then explicitly inspect. Decimal bounds must satisfy `0 <= start <= end <= full source end`; one exact chosen time is allowed. Editing either bound or the channel discards the prepared interval, row actions and report consent immediately, even when changed back.

Every included known source value is plotted, without smoothing or downsampling. Original row numbers and source seconds remain unchanged. Unknown channel values are not zero; unknown rows and adjacent intervals over five seconds break visual connecting guides. A gap-only interval can contain no rows. No surrounding sample is borrowed, and no boundary observation is invented. The automatic Y axis uses only included known values, not safe limits; apparent slopes across different scales are not comparable. Dense points can overlap. On a narrow screen, scroll inside the plot to reach its full width.

The exact-row table pages at 20 rows. Paging changes neither plot nor export scope. Each row button, including an unknown-value row, pauses primary replay and seeks that exact original source time; a chart click chooses the nearest included original row with earlier ties. Empty intervals cannot seek. Preparing or seeking ends primary selected-window playback, not the saved review window itself. Independent comparison playback and review data are unchanged. An out-of-interval replay cursor and its held dot are not drawn. Inside the interval, a held sample remains at its original timestamp, not at the playback cursor. Gaps remain unsampled.

A separate one-use acknowledgement enables the complete interval text report. It includes **all included rows across every table page**, the exact CSV hash, original times and selected-channel values. Those can be sensitive. It omits coordinates, filenames, other channel readings, private notes and review content. The report is editable text, unsigned, not a saved case or a reopenable inspection. Keep the exact primary CSV separately and verify saving and the audience yourself. Interval choices are session-only, are never serialized into existing saved formats, and reset after a new primary source open, including identical bytes. Ordinary analyst-note edits do not reset this source-only inspection. No automatic upload, storage, source replacement, review mutation or backend call is added.

Use **Hide local handoff tools** in the standalone header to reclaim recorded-replay space. This hides the existing handoff area without unmounting its tools or clearing file selections, notes, consents, open disclosures or prepared outputs. **Show local handoff tools** restores it. Choosing any existing handoff shortcut also reveals it before navigating. Showing remains the default. The interval implementation is imported only by the standalone build; the normal app keeps its existing full-source plot and receives no interval-tool implementation or new dependency. The normal total-JavaScript guard remains 755 KiB, including all lazy chunks; startup behavior and archive availability are unchanged.

## Prepare an explicit-offset timestamp column for the numeric mapper

In the standalone page, expand **Prepare explicit-offset timestamp CSV for numeric mapping**, immediately before the existing numeric mapper. Choose an original comma-separated UTF-8 CSV, explicitly choose one timestamp column, and confirm that nominal UTC rebasing is the intended interpretation. No column, timestamp meaning, aircraft format, units, coordinate reference or source-clock accuracy is inferred. This is a separate local input, not an edit to the current replay. Preparing it pauses primary playback without seeking or changing either review or the independent comparison.

This deliberately restricted input profile accepts four-digit Gregorian dates, uppercase `T` and `Z`, `YYYY-MM-DDTHH:mm:ss`, optional 1 to 9 fractional-second digits, and either explicit `Z` or a signed `HH:mm` offset. Hours are 00 to 23, minutes and second labels 00 to 59; literal offset hours/minutes have the same syntactic bounds. Offsets are not verified against a location or time-zone database. Missing/local-only offsets, named zones, bracketed suffixes, surrounding whitespace, lowercase separators, `24:00`, leap-second labels and invalid dates are refused. This is not a complete ISO 8601 or RFC 3339 implementation. Numeric-offset subtraction and calendar/profile details are grounded in [RFC 3339 sections 4.2, 5.6 and 5.7](https://www.rfc-editor.org/info/rfc3339/). [RFC 9557 section 2](https://www.rfc-editor.org/rfc/rfc9557.pdf) updates the zero-offset conventions. Here `Z`, `+00:00` and `-00:00` have identical arithmetic; the preparation does not infer or preserve a source-local-zone assertion from those spellings.

**Nominal calendar differences are not measured physical elapsed time.** Every UTC calendar day is treated as 86,400 seconds. Leap seconds are neither reconstructed nor consulted, and clock accuracy or drift is unverified. For example, adjacent accepted civil labels around an inserted leap second do not recover that physical extra second. Integer nanosecond arithmetic subtracts the first represented instant before emitting decimal seconds; it does not first convert fractional epoch time to a floating-point number. Every represented instant must strictly increase in the original row order. Duplicate instants, reversal or any invalid selected row abort the entire preparation. Nothing is sorted, repaired, skipped, interpolated or silently truncated. The maximum nominal span is 21,600 seconds. Existing bounds remain: 1MiB input/output, 2 to 10,000 data rows, 3 to 64 columns, unique nonempty headers of at most 120 characters, and quoted single-line rather than multiline fields.

The selected header becomes `skydash_nominal_seconds`, starting at numeric zero. A collision with that header in another column refuses preparation. Every other decoded data-cell value, row order and column order remain, including private notes, coordinates, unknown fields and formula-like strings. Header labels are trimmed by the existing CSV reader. Quoting, BOM and line endings are normalized, so the intermediate is not byte-preserved. The preview displays only the first three rows, as literal text, while the download contains every row and column. It is not privacy-reduced. Do not open it as a spreadsheet: formula-like source cells are deliberately retained rather than silently changed.

Separate one-use acknowledgements request `skydash-nominal-time-input.csv` and `skydash-offset-time-record.txt`. The human text record includes exact input/output UTF-8 hashes, byte counts, chosen column ordinal, row count and nominal duration. It omits source filenames, original header labels, source dates and other cell values; hashes and shape may still be sensitive. Selecting another file, including a rejected file, clears the old prepared output and both export consents. Changing the column or interpretation also invalidates them, even when edited back. A blocked download consumes only its own acknowledgement and retains the prepared values for deliberate retry. Workspace or local processing disables actions. Nothing is automatically saved, uploaded, transferred to another tool or opened in replay. Verify actual saving and audience yourself.

One route is manual: select the saved intermediate in **Map another numeric CSV (explicit columns and units)**. The optional in-page handoff below can instead load that same prepared CSV after a separate replacement preview. Explicitly map `skydash_nominal_seconds` as time in seconds already starting at zero, choose the other field meanings/units, and confirm the coordinate reference there. Only that later explicit numeric mapping may omit unselected extra columns and validate a replay-shaped CSV. It still does not prove source-clock accuracy or physical elapsed time. Preparing/downloading either stage does not automatically replace the current replay or comparison.

Keep the exact original timestamp CSV, timestamp text record and intermediate CSV separately, plus the later numeric mapping recipe, numeric conversion record and final replay CSV. Existing numeric recipes, conversion reproduction, lineage checks and portable cases do not include or verify this timestamp stage. The text record is editable and unsigned, not a machine-readable recipe, authentication or a verified source chain. Timestamp preparation is session-only; starting a new local review or closing the page discards it. Ordinary replay source replacement does not select, transfer or clear this separate preparation input. The normal application does not include the timestamp-preparation implementation; its all-chunk JavaScript budget remains unchanged.

### Preserve and reproduce the timestamp-only preparation separately

After preparing the intermediate, a third independent one-use acknowledgement can save `skydash-offset-time-recipe.json`. This timestamp-only recipe contains the fixed recipe/arithmetic profile versions, selected zero-based column, exact original/intermediate hash claims, byte counts, row/column counts and nominal duration. It includes no filenames, source dates, original header labels or other cell values, but its fingerprints and shape are sensitive. Input/interpretation edits invalidate this export consent along with the prepared input. Downloading it consumes only its own consent. The earlier human text record remains a separate readable record, not a machine-readable recipe.

Inside the same timestamp disclosure, expand **Reproduce timestamp preparation from three exact files**. Manually select the exact original timestamp CSV, timestamp-only recipe and intermediate CSV. These selections are independent of the preparation input and current replay. Original/intermediate files are bounded at 1MiB each and recipe JSON at 64KiB; each must be valid UTF-8. No selected content executes. Freshly confirm the nominal timestamp interpretation for every new set of inputs or edited choice. The recipe cannot supply this confirmation. The actual adapter regenerates every intermediate row and column; all bytes must match exactly, including retained private/formula-like fields and CSV formatting. Numerically equivalent text, a changed private cell, BOM or line ending is not an exact match. Any failure refuses the complete relation receipt.

Optional full-file SHA-256 fields compare caller-supplied values before reproduction. Blank means no caller pin check for that role. Obtain expected values separately from a trusted source; the app cannot verify their origin. A self-consistent recipe and file set can be rewritten together, so recipe hash claims alone are not independent expectations or authentication. The result distinguishes matched caller values from roles with no caller value supplied.

The complete relation preview includes exact input/recipe/intermediate hashes, selected column ordinal, byte/row/column counts, nominal duration and caller-pin statuses. It omits filenames, original labels, absolute timestamps and other cell values. A separate one-use acknowledgement requests `skydash-offset-time-reproduction.json`. Protect its sensitive fingerprints and verify actual saving and audience. Changing any input, pin or interpretation clears the old result and consent, even when edited back. A rejected new file also clears that role's previous input and confirmation; failed or blocked exports do not create authority to retry automatically. Busy actions are disabled. The tool pauses primary playback without seeking or changing either review, and opens or transfers no file to the numeric mapper or replay. State is local to this page session, with no automatic storage, upload or sharing.

For read-only reproduction from a trusted checkout:

```sh
cd skydash/frontend
npm run verify-offset-time-input -- ORIGINAL.csv TIMESTAMP-RECIPE.json INTERMEDIATE.csv --confirm-nominal
```

The CLI reads only caller-selected bounded regular UTF-8 files, compiles the validator from this checkout, regenerates the intermediate with the same adapter, and checks exact raw-file hashes. It prints only the relation receipt, not filenames, original labels, dates, coordinates, other readings or private words. On failure it prints no partial receipt and does not echo private inputs. It writes no output files and makes no network or aircraft calls. The flag is a fresh caller statement about nominal-time interpretation, not verified clock accuracy or physical elapsed time. The CLI does not accept independent expected pins; compare its exact hashes against separately obtained expectations yourself.

Neither browser nor CLI reproduction changes the arithmetic limits described above. Both use nominal 86,400-second-day calendar differences, not leap-second-aware or measured physical elapsed time. This proves a reproducible relation among chosen bytes, not source authenticity, custody, manufacturer compatibility, source-clock accuracy, flight identity, grades or readiness. It does not add timestamp-stage verification to existing numeric mapping recipes, lineage tools or portable cases. Keep the exact original timestamp CSV, timestamp recipe, human record and intermediate, plus later numeric mapping recipe/record/final CSV, separately. A saved receipt is unsigned and editable, and cannot replace its three exact inputs.

### Optional explicit in-page handoff to the numeric mapper

After timestamp preparation, the standalone page can avoid saving and reselecting the intermediate. Check **Acknowledge complete prepared CSV mapper handoff** and choose **Review prepared CSV mapper handoff**. This consumes only that one-use acknowledgement, not the three independent CSV/record/recipe export consents. An exact immutable snapshot is checked locally before a separate replacement preview appears below. The check reparses the bounded CSV, validates the fixed header, canonical strictly increasing zero-origin nominal times and six-hour limit, checks captured byte/shape/profile claims and hashes the complete prepared text. A stale or invalid snapshot does not replace the current mapper input. The first three rows are previewed as literal text; every row and column transfers, including private coordinates, notes, unknown fields and formula-like strings. The preview is not privacy-reduced. Scroll its table horizontally on narrow screens.

While the snapshot is checked or its preview is pending, timestamp controls and the numeric mapper are disabled. The old numeric mapper stays mounted, including its selected input, field/unit choices, recipe label and pending recipe import, converted preview and pending replay-open confirmation. **Keep current numeric mapper input** cancels the handoff without clearing that work. Starting a new handoff requires a fresh request acknowledgement. Any preparation source/column/interpretation change, including editing back or selecting a rejected replacement, clears that acknowledgement with the old prepared result.

Only after reviewing the complete intermediate scope and checking **Acknowledge numeric mapper input replacement** can **Confirm replace numeric mapper input** discard old mapper work and load the fixed `skydash-nominal-time-input.csv` snapshot. It resets field selections, time unit/origin and WGS84 confirmation. Optional altitude/speed units return to the existing mapper defaults, metres and metres per second, with those optional fields unmapped. Check every meaning and unit explicitly. No field or unit is inferred from the timestamp preparation. Confirming this handoff opens the numeric mapper drawer and reveals its loaded input without focusing a field or queuing a delayed focus change. Cancel does not force that drawer open. It does not convert, download or open a replay. The existing numeric mapper still requires explicit conversion preview and its own review/open confirmation before replacing primary replay and clearing its reviews/comparison under the existing warning.

The handoff preview includes the exact prepared hash and original timestamp hash claim. It checks the prepared snapshot, not the original transformation, source clock, physical elapsed time, flight identity or authenticity. It does not carry timestamp provenance into existing numeric recipes, lineage tools or portable cases, and is not a replacement for the separate three-file reproduction above. Keep the exact original timestamp CSV, timestamp recipe/human record, intermediate and later numeric mapping recipe/record/final CSV separately. These hashes and metadata may be sensitive.

Timestamp preparation and a pending candidate are independent of ordinary replay source replacement. A raw-source open still resets the numeric mapper through its existing reset boundary; it does not silently reload an older accepted intermediate. A still-pending candidate remains an explicit choice, not an automatic transfer to that new mapper. Starting a new local review or closing the page discards session state. No file-input assignment, hidden download, automatic saving, storage, upload, sharing or aircraft/backend operation is added. The context and snapshot validator are standalone-only; the normal application retains its defaults. Its all-chunk JavaScript guard remains 755KiB, measured at 754.8KiB with unchanged 119.0KiB startup payload.

### Optional separate timestamp handoff to baseline B

The standalone page also supports a separate timestamp-prepared input for a two-flight comparison. Load primary A first. Prepare the timestamp CSV above, then open **Map another numeric CSV as baseline B**. Its **Use current prepared timestamp CSV for baseline B** section refers only to the latest successfully prepared intermediate, with row/column counts and exact prepared SHA-256. It is absent before a current preparation exists. A source, column or interpretation edit, including editing back or choosing a rejected file, clears that available preparation and the baseline request acknowledgement. Preparing again creates a fresh request even when the bytes match. Previously accepted A and B mapper inputs/drafts remain independent and are not cleared by a new preparation.

Check **Acknowledge prepared CSV request for baseline mapper**, then choose **Review prepared CSV for baseline mapper**. This consumes only B's one-use request choice. The primary A handoff request and three export acknowledgements are separate and remain unchanged. The same immutable, complete all-column snapshot checks apply. Every private coordinate, note, unknown column and formula-like cell transfers as literal data. This is not a privacy-reduced input. Requesting, canceling or applying this B handoff pauses comparison playback only, without seeking or pausing primary replay. While a handoff check or decision is pending, both numeric mapper fieldsets and timestamp preparation are disabled so neither input can silently change underneath the decision.

The separate **Replace baseline B numeric mapper input only?** preview is inside the B drawer. **Show pending baseline mapper handoff** deliberately reveals it if that drawer is closed. **Keep current baseline mapper input** keeps both existing mapper forms, input/field/unit choices, recipe label/import preview, conversion preview and any pending numeric open confirmation. Requesting again needs fresh B request consent. Only **Acknowledge baseline mapper input replacement** followed by **Confirm replace baseline mapper input** discards B mapper work and loads the checked intermediate. Primary A mapper work is unchanged. B field selections, time unit/origin and WGS84 confirmation start blank; optional unmapped altitude/speed fields keep the existing metres/metres-per-second defaults. Check every field meaning and unit afresh. Confirming reveals B's fresh mapper input, not a replay or a comparison replacement.

After that, B still needs its own **Preview mapped conversion**, **Review before opening mapped CSV** and **Use mapped CSV as baseline**. If a baseline already exists, the existing separate **Replace baseline with checked source** confirmation remains mandatory. Until that final source confirmation, baseline CSV, notes, applied anchors and comparison clock stay unchanged, as do primary source/reviews/clock and primary mapper drafts. Final checked baseline replacement resets only the existing B comparison state and its mapper under the existing warning. A later checked source reset does not silently revive an older accepted B handoff. A pending handoff can survive a checked source reset, but its remounted replacement acknowledgement starts unchecked and needs a fresh explicit decision. Starting a new local review discards the entire prepared-input/handoff state.

This does not align source clocks, verify physical elapsed time, establish independent flights or add timestamp provenance to numeric lineage/cases. Keep exact original timestamp CSV, timestamp recipe/human record, intermediate, later numeric recipe/record and final CSV separately for each source. No new storage, upload, sharing, download, aircraft command or backend action occurs automatically. Normal hosted app behavior remains unchanged.

### Check the complete timestamp-to-numeric conversion chain

**Verify a timestamp-to-numeric conversion chain** in the fixed local task chooser/finder opens **Reproduce a complete timestamp-to-numeric CSV chain**. This independent standalone tool checks one explicitly selected five-file relation without opening or pausing replay, changing either mapper/source, importing reviews or changing an existing comparison. The older timestamp-only and numeric-only checks remain separate and unchanged.

Choose the exact original timestamp CSV, timestamp-only recipe JSON, shared intermediate CSV, numeric mapping recipe JSON and final numeric CSV. Each CSV is bounded at 1MiB and each recipe at 64KiB. Selection retains handles and locally displays the selected filenames/claimed sizes, but does not read file contents. Supply optional independent complete-file SHA-256 expectations separately for any of the five roles. Blank means no expectation supplied for that role; recipe claims and co-delivered hashes are not independent expectations, and the app cannot verify where a caller expectation came from.

Both **Fresh chain nominal timestamp statement** and **Fresh chain WGS84 source statement** are required before **Check exact two-stage conversion chain**. They are caller statements, not independently checked clock/coordinate meanings, source units or datum. A recipe cannot supply them. Each check consumes both, including on failure. Every file or pin edit, even editing back or choosing a rejected replacement, clears both statements, the old result and receipt download consent. Changing either statement also invalidates result/download consent. Busy checking disables input/clear/check/download controls; a removed tool cannot restore a late result.

The checker captures all five handles, read methods, claimed sizes and expectations before awaiting a read. It freshly checks actual bounded bytes and all supplied raw-file pins before strict UTF-8 decoding, parsing either recipe or running either conversion model. It uses the existing timestamp-only reproduction on the complete original and intermediate, then the existing numeric reproduction on those **same exact intermediate bytes** and final CSV. Both stages must preserve the complete row count. A wrong original/recipe/intermediate pairing, altered extra private cell, different final formatting, invalid model/header order or failed second stage refuses the whole check. No partial first-stage receipt, normalization, repair or numeric-only approximation is accepted. Generic UI/CLI errors do not echo source contents or private diagnostics.

The prepared result shows metadata only: all five exact raw-file hashes and byte counts, matched-versus-absent caller expectations, model versions, original row/intermediate column counts, timestamp column ordinal, nominal span and converted sample count. It omits filenames, source header names, recipe labels, dates, coordinates, readings and other private values. These fingerprints and shape still identify sensitive work. The intermediate retains every non-timestamp cell; the later explicit numeric mapping may exclude extra columns or subtract its configured numeric origin. Nominal UTC calendar rebasing is not leap-second-aware physical elapsed time, source-clock accuracy, synchronization between flights or verified flight identity.

Only a separate **Acknowledge sensitive two-stage chain receipt** enables **Download chain relation receipt JSON**. It saves the fixed `skydash-two-stage-conversion-chain.json` metadata receipt. Download consumes only that one-use receipt consent; a blocked download keeps the checked result. No CSV or recipe is embedded or generated for download by this tool. Verify saving and audience yourself. This editable unsigned receipt does not add timestamp provenance to existing numeric lineage/cases and is not authentication, custody, source truth, OEM compatibility, a grade, completion, readiness, backup or a reopenable workspace. Preserve all five exact originals, both human conversion records and excluded review work separately. No automatic download, storage, upload, sharing, network, backend write or aircraft command is added. Hiding retains this in-tab work; clear releases only this checker; refresh/tab close loses it.

From a trusted installed checkout, run `cd skydash/frontend` then `npm run --silent verify-conversion-chain -- ORIGINAL.csv TIMESTAMP-RECIPE.json INTERMEDIATE.csv NUMERIC-RECIPE.json FINAL.csv --confirm-nominal --confirm-wgs84`. `--silent` suppresses npm's own command echo. The actual checker prints only the same metadata receipt or a generic error with no partial receipt or source/path text. It rejects empty, oversized, non-regular and symbolic-link file inputs and reads through bounded read-only handles. It neither writes outputs nor executes code from any selected file. The two flags are fresh caller statements on every invocation. This positional CLI route supplies no independent expected hashes and reports those five expectations as absent. The exported `verifyConversionChain(paths, options)` API accepts separate role-keyed `expected` pins, as does the browser. The receipt still does not authenticate the checkout or its co-delivered code.

The packaged browser regression creates both conversion stages using the actual preparation/mapper UI, then selects all five exact saved files in this independent checker. It covers wrong pins, consumed statements, full-result/receipt privacy, browser/actual-CLI receipt agreement, edit-back invalidation, altered intermediate refusal, explicit clear and desktop/mobile layouts. Exact primary case and comparison-review exports, clocks, notes, mapper draft/conversion/open confirmation and timestamp preparation remain unchanged. The normal app's build/JavaScript guard and default behavior are unchanged.

## Keep the complete two-stage source chain together

The complete-chain checker defaults to the existing metadata-only receipt. Before a new check, its output scope can instead be changed to **Prepare complete sensitive five-original ZIP**. This requires a third fresh statement about preparing full private originals, in addition to nominal timestamp and WGS84 statements. All three are consumed on every attempt. There is no automatic download, extraction, storage, upload or sharing. A separate one-use full-original download acknowledgement is required after successful preparation.

The unsigned, unencrypted seven-file ZIP keeps exact raw bytes under fixed paths: `originals/timestamp-source.csv`, `originals/timestamp-recipe.json`, `originals/shared-intermediate.csv`, `originals/numeric-mapping-recipe.json`, `originals/final-numeric.csv`, plus a freshly generated `validation.json` and fixed `HANDOFF.txt`. Original filenames are omitted, not the original contents. BOM, whitespace, line endings, timestamps, coordinates, header names, recipe labels and private/formula-like cells remain. All five handles/read methods/byte claims/pins are captured before awaiting a read. Only the privately copied bytes that actually passed both conversion stages enter the ZIP. The archive has its own generated SHA-256, not an independent expectation or signature.

Every file, pin or output-scope edit, including editing back, clears all three statements and any prepared output/download consent. Changing any preparation statement invalidates the result and download consent. Hiding keeps the prepared output only in this tab. Clear releases it and restores metadata-only mode. Failed checks produce no partial receipt or ZIP. Failed download initiation consumes only download consent and retains the checked output.

Recipients must extract using a separate trusted archive tool into a new private directory, never execute received code or trust the co-delivered guide/receipt as authority, and avoid formula-executing spreadsheets. Recheck all five extracted originals using trusted SkyDash code, both fresh semantic statements and optional separately obtained raw-file pins. The browser supports those independent pins; the positional `verify-conversion-chain` CLI does not. Separate received training/discussion ZIP tools do not accept this distinct layout. Opening a final CSV or preparing/mapping an original remains a separate manual decision that must protect current unsaved work.

This is a complete five-file conversion source chain, not a complete workspace backup or source-authenticity certificate. Human conversion records, reviews, markers, comparison, drafts, recovery and library/account state are excluded and must be kept separately. A self-consistent rewritten chain can match. No aircraft/OEM compatibility, clock/coordinate accuracy, identity, custody, grade, completion, readiness or flight-clearance claim follows. Existing numeric lineage/case formats stay unchanged and do not acquire timestamp provenance.

## Freshly check one received conversion-chain ZIP

Use **Check one received conversion-chain ZIP** in the fixed tool finder, or open **Check a received timestamp-to-numeric chain ZIP**. This independent tool checks the complete five-original archive from the preceding handoff tool. It does not automatically open replay, change either mapper/source/comparison, import a recipe/review, recover originals or extract files to disk. Existing tools and formats stay unchanged.

Selection alone reads nothing. Fresh nominal timestamp and WGS84 source-coordinate statements are both required before any archive read. Those statements must come from the recipient's own inspection of actual original column meanings and recipe choices with trusted software, never from the received guide, receipt or success claims. Nominal UTC calendar arithmetic assumes 86,400-second days, not leap-second-aware physical elapsed time or source-clock accuracy. Every check attempt consumes both statements. Every file or expectation edit, even editing back or rejecting an oversized replacement, clears both statements, checked output and download consent. Changing either statement also invalidates checked output.

Only the exact canonical seven-entry ordered stored ZIP is accepted, at most 4MiB: the five fixed `originals/` paths above, `validation.json` and `HANDOFF.txt`. CSV entries are bounded to 1MiB each, recipes 64KiB each, received validation receipt 64KiB and guide 16KiB. Entries must be nonempty. Exact re-encoding checks local/central headers, names/order, flags, sizes, CRCs and EOCD bytes. Other layouts, extra entries, renamed paths, links, compression, ZIP64, comments, extra fields and trailing data are refused. Originals require strict UTF-8; received receipt/guide contents are inert bounded bytes, never decoded, parsed, rendered, executed, used as model evidence or certified as accurate.

A separate optional complete-ZIP expectation is checked before entry decoding. All five optional complete raw-original expectations are captured before the first await and checked before recipe parsing/conversion models. Obtain them separately through a trusted route. A whole-ZIP expectation never supplies a raw-original expectation; generated/co-delivered fingerprints do not authenticate themselves. Only the five actual original entry snapshots feed the existing complete-chain checker. The timestamp source/recipe must reproduce the exact intermediate, and that SAME intermediate/numeric recipe must reproduce the exact final CSV. Matching values after normalization are insufficient. A self-consistent rewritten archive can still match.

Successful output is fresh metadata only: archive hash/bytes/file count/caller archive-pin status and the existing raw-file fingerprints, byte sizes, separate pin statuses, conversion model versions, row/column counts, timestamp column ordinal and nominal span. It contains no originals, received text, selected filename, source dates/coordinates/readings, headers or recipe labels. Fingerprints and shape remain sensitive. A separate one-use acknowledgement enables downloading `skydash-received-conversion-chain-receipt.json`. No automatic download occurs. Blocked download initiation consumes output consent but keeps checked metadata. Clear releases only this tool; hiding keeps this tab's state; refresh/close loses it.

From a trusted installed checkout's `skydash/frontend` directory, run `npm run --silent verify-received-conversion-chain -- CHAIN.zip --confirm-nominal --confirm-wgs84`. Use explicit safely quoted paths. The actual read-only CLI rejects symbolic-link/non-regular/empty/oversized input, reads through a bounded `O_NOFOLLOW` handle where available, bundles only this installed checkout's validator with no output build, and emits the same fresh metadata or a generic error without private source/path text or partial output. There is no filesystem extraction or output write. Both flags are fresh caller statements. This positional CLI supplies no independent archive or raw-original expectations, and all six statuses report absent. The exported `verifyReceivedConversionChain(path, options)` API and browser accept separate `expectedArchiveSha256` and role-keyed `expected` pins.

No identity, authenticity, custody, clock/unit/coordinate accuracy, OEM/aircraft compatibility, grade, completion, readiness or flight-clearance claim follows. Existing numeric lineage/cases do not gain timestamp provenance. Human conversion records, reviews, markers, comparison, drafts, recovery, library and account state are neither validated nor restored. Preserve originals and excluded work separately. This is not a complete workspace backup or an opening/import authorization. There are no account/workspace reads, pause/seek, repair, storage, network, upload, sharing, backend writes or aircraft commands.

### Fixed fabricated complete-chain practice

Inside the received conversion-chain checker, the separate practice section prepares three fixed exercises without reading the selected ZIP, current work, account or storage. It does not supply receiver selections, interpretation statements, expectations or results. Download each deliberately, inspect the actual originals with trusted software, then manually choose a saved ZIP in the separate checker. No automatic download, extraction, import, replay opening or sharing occurs.

MATCH-A and MATCH-B each reproduce both complete stages through the same intermediate. Their different fabricated source dates deliberately show that coherent byte agreement is not source authenticity. BAD-FINAL has all seven canonical entries and valid ZIP CRCs, but its final numeric CSV has an extra newline. Its copied success receipt does not make its actual final bytes match. A fresh receiving check must refuse it. These are fabricated variations, not recordings or independent flights.

The downloadable practice guide describes the first timestamp column, fixed explicit-offset January 2000 dates, nominal seconds 0,4,12, retained 8-second interval, fabricated WGS84 decimal-degree coordinates and excluded note column. Generator self-checks apply only to those known fixed inputs. A recipient still must inspect actual meanings and make both fresh statements independently. Generated/co-delivered hashes are reproducibility fingerprints, never independent expectations, identity, custody, OEM compatibility or authentication. The standard received-chain CLI can also check one deliberately selected saved ZIP with its own fresh flags.

Clear releases only prepared practice outputs, not receiver selections/statements/results or active work. Hiding retains tab-only practice; refresh/tab close loses it. The unsigned unencrypted examples are not workspace backups, operational instructions, grades, completion, readiness or flight clearance. Preserve all real originals, human conversion records and excluded workspace work separately. No network, storage, backend or aircraft effects.
