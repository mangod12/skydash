import { useState } from 'react';
import { FileText, Download, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';

function generateReport(entities, events, telemetry) {
  const now = new Date();
  const highThreats = entities.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical');

  let report = `SKYDASH INTELLIGENCE REPORT
${'='.repeat(50)}
Generated: ${format(now, 'yyyy-MM-dd HH:mm:ss')} UTC
Classification: UNCLASSIFIED

EXECUTIVE SUMMARY
${'-'.repeat(50)}
Total Entities Tracked: ${entities.length}
High/Critical Threats: ${highThreats.length}
Events Recorded: ${events.length}
Telemetry Samples: ${telemetry.length}

ENTITY INVENTORY
${'-'.repeat(50)}
`;

  entities.forEach((e, i) => {
    report += `\n${i + 1}. ${e.name} [${e.type.toUpperCase()}]
   Threat: ${e.threatLevel.toUpperCase()} | Confidence: ${e.confidence}%
   Source: ${e.source}
   Tags: ${e.tags?.join(', ') || 'none'}`;
    if (e.coordinates) {
      report += `\n   Location: ${e.coordinates[0].toFixed(6)}, ${e.coordinates[1].toFixed(6)}`;
    }
    if (e.properties) {
      Object.entries(e.properties).forEach(([k, v]) => {
        report += `\n   ${k}: ${v}`;
      });
    }
    report += '\n';
  });

  if (highThreats.length > 0) {
    report += `\nTHREAT ASSESSMENT\n${'-'.repeat(50)}\n`;
    highThreats.forEach((e) => {
      report += `  [!] ${e.name} - ${e.threatLevel.toUpperCase()} THREAT\n`;
    });
  }

  report += `\nEVENT LOG (Last ${Math.min(events.length, 20)})\n${'-'.repeat(50)}\n`;
  events.slice(0, 20).forEach((evt) => {
    report += `  ${format(evt.time, 'HH:mm:ss')} [${evt.severity.toUpperCase()}] ${evt.description}\n`;
  });

  report += `\n${'='.repeat(50)}\nEND OF REPORT\n`;
  return report;
}

function generateGeoJSON(entities) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: entities
      .filter((e) => e.coordinates)
      .map((e) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.coordinates[1], e.coordinates[0]],
        },
        properties: {
          id: e.id,
          name: e.name,
          type: e.type,
          threatLevel: e.threatLevel,
          confidence: e.confidence,
          source: e.source,
          tags: e.tags,
        },
      })),
  }, null, 2);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportExport() {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);
  const history = useTelemetryStore((s) => s.history);

  const handleExportReport = () => {
    const report = generateReport(entities, events, history);
    downloadFile(report, `skydash-report-${format(new Date(), 'yyyyMMdd-HHmm')}.txt`, 'text/plain');
  };

  const handleExportGeoJSON = () => {
    const geojson = generateGeoJSON(entities);
    downloadFile(geojson, `skydash-entities-${format(new Date(), 'yyyyMMdd-HHmm')}.geojson`, 'application/json');
  };

  const handleExportCSV = () => {
    const headers = 'Name,Type,Threat,Confidence,Source,Latitude,Longitude,Tags\n';
    const rows = entities.map((e) =>
      `"${e.name}","${e.type}","${e.threatLevel}",${e.confidence},"${e.source}",${e.coordinates?.[0] ?? ''},${e.coordinates?.[1] ?? ''},"${e.tags?.join(';') ?? ''}"`
    ).join('\n');
    downloadFile(headers + rows, `skydash-entities-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">EXPORT</h4>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleExportReport}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors group"
        >
          <FileText size={16} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" />
          <span className="text-[9px] font-semibold text-zinc-500 tracking-wider">REPORT</span>
        </button>
        <button
          onClick={handleExportGeoJSON}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors group"
        >
          <MapPin size={16} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          <span className="text-[9px] font-semibold text-zinc-500 tracking-wider">GEOJSON</span>
        </button>
        <button
          onClick={handleExportCSV}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors group"
        >
          <Download size={16} className="text-zinc-500 group-hover:text-cyan-400 transition-colors" />
          <span className="text-[9px] font-semibold text-zinc-500 tracking-wider">CSV</span>
        </button>
      </div>
    </div>
  );
}
