#!/usr/bin/env node
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkDiscussionIntakeFiles,parseDiscussionIntakeArguments} from './check-discussion-intake.mjs';
import {renderDiscussionIntakeReport} from '../src/utils/discussionIntakeReport.js';
export {renderDiscussionIntakeReport};
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: node scripts/report-discussion-intake.mjs INPUT1.zip [INPUT2.zip ... INPUT10.zip] [--expect-input-N-archive-sha256 HEX] [--expect-input-N-source-sha256 HEX] [--expect-input-N-checklist-sha256 HEX] [--expect-input-N-instructor-sha256 HEX] > intake.html\nSame explicit canonical no-symlink regular inputs,20MiB total/2MiB per ZIP, ordinal pins and all-original checks as check-discussion-intake. Fresh originals only, no imported receipt or saved JSON result. Privacy-limited sensitive static HTML, desktop/mobile/A4, no scripts/external assets/original words/paths/coordinates/readings. No cross-original training totals or identity inference. No writes except your explicit redirection, extraction, network or sharing. Exit 0 all checked; exit 2 valid partial/all-refused HTML; exit 1 configuration/build failure with no report. Check exit status and refused rows; redirection can leave an empty or partial file. Use npm run --silent report-discussion-intake when redirecting npm output.');return;}
 const report=await checkDiscussionIntakeFiles(parseDiscussionIntakeArguments(args));process.stdout.write(renderDiscussionIntakeReport(report));if(report.refused_archives){console.error('Some selected inputs were refused. Inspect every refused position in the HTML. No private diagnostics or originals output.');process.exitCode=2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('Discussion intake report configuration/build refused. No report issued. Check explicit bounded original inputs and supported independent expectations. No private paths or content echoed. Check exit status; redirection can leave an empty report.');process.exitCode=1;});
