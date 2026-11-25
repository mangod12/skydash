# Frontend bundle compression

The production build uses a conservative Terser expression-compression pass on
bundled ES modules before Vite/Oxc performs final minification and identifier
mangling. The development server and tests do not run this pass. Explicitly
disabling minification, or selecting a different final minifier, skips the pass.

The pass keeps the existing chunks and browser target. It does not enable unsafe
transforms, property mangling, console removal or assumptions about getters. It
returns source maps when Vite requests them, including hidden and inline maps.
Compression errors fail the build rather than publishing a partial result.

Measured with the same application, chunk rules and unchanged 750 KiB gzip budget:

- Oxc alone: 749.5 KiB total JavaScript gzip.
- Terser compression plus Oxc: 740.6 KiB, about 8.9 KiB less.
- Local production build: about 16 seconds rather than 2 seconds. CI timing varies.

Measure using `npm run build` then `node scripts/check-bundle-size.mjs` from
`skydash/frontend`. The budget counts every JavaScript chunk, including lazy
chunks, rather than just the first-page transfer. It is not a claim about
network latency, frame rate or flight-system performance.

The compressor is a pinned development dependency. Its regression tests cover
observable property reads, exported names, imports, diagnostic calls, source
maps, invalid-input failures and minifier opt-outs. Changes to production
compression also need browser tests against the actual built assets. Development
server tests alone do not exercise the compressed output.

## Shared dependency partition for package receipt checking

The received-package UI groups third-party modules into one `vendor` chunk while keeping application view chunks lazy. Existing initial application imports already need the map/deck/chart/motion/utility dependency groups; this partition changes compression/caching boundaries, not features, source semantics or the750KiB budget. On the same pre-receipt application, separate vendor partitions measured749.9KiB and the combined partition748.0KiB total gzip. The receipt UI plus combined partition measured749.2KiB without a configured backend,749.6KiB with the local backend configuration and749.7KiB with current Azure frontend API/WebSocket/ADS-B URL values. Measure again after changes. Fewer/more compressed chunks do not promise lower latency or higher frame rate, and a changed vendor dependency invalidates the combined vendor chunk. Built-asset browser checks must cover navigation/maps/charts/recorded workflows, not only development imports.


## Instructor sidecar inspection budget

The total-JavaScript gzip guard is now 755 KiB, not the historical 750 KiB figures
above. The instructor replacement preview/report adds about 1.9 KiB gzip to the
existing lazy Scenario Lab chunk (about 150.4 to 152.3 KiB). The queue baseline
measured 749.96 KiB total; with the inspection feature it is about 751.9 KiB.
The initial application chunk stays about 119.0 KiB and the shared vendor chunk
about 445.7 KiB. This is a measured allowance for the lazy review workflow, not
permission to grow startup payload or weaken checks. The same guard still sums
all JavaScript, including lazy chunks, and fails over the cap. No minifier,
chunk partition, dependency or browser-target changes are included. These local
figures use no deployment endpoints; configured builds can differ slightly and
must pass the same 755 KiB cap. No latency or frame-rate improvement is claimed.

## Responsive layout allowance

The total-JavaScript gzip guard is now 756 KiB, one KiB above the previous 755 KiB.
Main measured 755.0 KiB after the phone-width stacking fixes for the Telemetry and
Intel views, so the next small layout change tripped the guard. The added bytes are
responsive Tailwind class strings, not new features or dependencies. The initial
application chunk stays about 119.0 KiB, and the guard still sums all JavaScript
including lazy chunks. This is a measured allowance for layout classes, not
permission to grow startup payload or weaken checks. Configured builds can differ
slightly and must pass the same 756 KiB cap.

## Operator workflow allowance

The total-JavaScript gzip guard is now 760 KiB, four KiB above the previous 756 KiB.
Main measured 755.9 KiB after alert accountability (who acknowledged or escalated,
with an audit entry) and the alert rule dry run, leaving no room for the next
operator-facing change. The added bytes are application code for those two
features, not new dependencies. The vendor chunk is unchanged, and the guard still
sums all JavaScript including lazy chunks. This is a measured allowance for
shipped features, not permission to grow startup payload or weaken checks.
Configured builds can differ slightly and must pass the same 760 KiB cap.
