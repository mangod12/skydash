#!/usr/bin/env node
// Explicit loopback serving of a bounded verified in-memory static snapshot only.
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readVerifiedOfflineSite } from './offline-review-distribution.mjs';
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const scope = 'Only the checked in-memory HTML/JS/CSS snapshot is served on IPv4 loopback. No directory listing, recordings, manifest, guide, backend, writes, automatic browser opening, update, upload or sharing. You explicitly chose to trust executable assets; byte agreement is not authenticated source/build, malware screening, supply-chain attestation or a certified air gap. Other local software, browser profiles/extensions and external links remain outside this server. Keep private work separately and stop the server when finished. Browser-local libraries depend on profile and exact hostname/port, not a backup.';
export async function serveOfflineReview(input, { trustExecutableAssets = false, expectedManifestSha256 = '', port = 8088 } = {}) {
  if (trustExecutableAssets !== true || !Number.isInteger(port) || port < 0 || port > 65535 || (expectedManifestSha256 !== '' && !pin(expectedManifestSha256))) throw Error('Explicit trust and valid options required.');
  // A single bounded read/validation supplies exactly the bytes subsequently served.
  // Disk changes after startup never enter this server's snapshot.
  const { receipt, entries } = await readVerifiedOfflineSite(input, expectedManifestSha256);
  const files = new Map(entries.map(([path, bytes]) => ['/' + path.slice('site/'.length), Buffer.from(bytes)]));
  let origin;
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000, keepAliveTimeout: 1000 }, (request, response) => {
    const finish = (status, text, extra = {}) => { const body = Buffer.from(text); response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length, ...extra }); response.end(request.method === 'HEAD' ? undefined : body); };
    if (request.headers.host !== origin.slice('http://'.length) || (request.headers.origin !== undefined && request.headers.origin !== origin) || (request.headers['sec-fetch-site'] !== undefined && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) return finish(403, 'Refused.');
    if (!['GET', 'HEAD'].includes(request.method)) return finish(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
    // No URL normalization/decoding, query aliases, traversal, fallback routes or disk access.
    const path = request.url === '/' ? '/offline-review.html' : request.url, bytes = files.get(path);
    if (!bytes) return finish(404, 'Not found.');
    const type = path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8';
    response.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': bytes.length });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  server.maxRequestsPerSocket = 100;
  // Do not echo raw request bytes or private paths on malformed HTTP.
  server.on('clientError', (_error, socket) => socket.destroy());
  await new Promise((yes, no) => { server.once('error', no); server.listen(port, '127.0.0.1', () => { server.removeListener('error', no); origin = 'http://127.0.0.1:' + server.address().port; yes(); }); });
  let closing;
  const close = () => closing ||= new Promise((yes, no) => { server.close(error => error ? no(error) : yes()); server.closeAllConnections(); });
  return { server, close, receipt: { format: 'skydash-standalone-loopback-session-v1', url: origin + '/offline-review.html', exact_manifest_sha256: receipt.exact_manifest_sha256, expected_manifest_digest_matched: receipt.expected_manifest_digest_matched, served_file_count: files.size, scope } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log('Usage: node scripts/serve-offline-review.mjs EXTRACTED_DIR --trust-executable-assets [--expect-manifest-sha256 HEX] [--port 8088]\nRun only this separate trusted checkout after independently trusting the source/build. Validate all bounded extracted distribution originals before listening; optional independent complete-inventory pin before parse. Serve only checked HTML/JS/CSS bytes from memory, IPv4 loopback only, exact paths and GET/HEAD only. No directory listing, recordings, browser launch, installation, storage, backend or updates. Port 1..65535, default8088; no fallback if busy. Stop with Ctrl+C. Origin changes affect optional device-local libraries. Unsigned assets/hash agreement are not authenticated trusted code, malware screening or certified isolation. Other local software/browser extensions remain outside this server.');
  else {
    const options = {}, seen = new Set(); let valid = args[0] && !args[0].startsWith('-');
    for (let i = 1; i < args.length && valid; i++) {
      const flag = args[i]; if (seen.has(flag)) { valid = false; break; } seen.add(flag);
      if (flag === '--trust-executable-assets') options.trustExecutableAssets = true;
      else if (flag === '--expect-manifest-sha256' && pin(args[i + 1])) options.expectedManifestSha256 = args[++i];
      else if (flag === '--port' && /^[1-9][0-9]{0,4}$/.test(args[i + 1] || '') && Number(args[i + 1]) <= 65535) options.port = Number(args[++i]);
      else valid = false;
    }
    if (!valid || !options.trustExecutableAssets) { console.error('Expected explicit extracted directory, trust acknowledgement and supported options. Use --help.'); process.exitCode = 1; }
    else serveOfflineReview(args[0], options).then(({ server, close, receipt }) => {
      const stop = () => close().catch(() => { process.exitCode = 1; });
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      server.on('error', () => { console.error('Local review server failed. Stop and inspect trusted assets/setup before restarting. Private paths/content not echoed.'); process.exitCode = 1; stop(); });
      console.log(JSON.stringify(receipt, null, 2));
    }).catch(() => { console.error('Local review server refused before listening. Check explicit trust, exact bounded distribution originals, independent pin, port and loopback availability. No alternate port, browser launch or success output. Private paths/content not echoed.'); process.exitCode = 1; });
  }
}
