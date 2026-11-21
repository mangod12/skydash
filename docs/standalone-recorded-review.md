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
