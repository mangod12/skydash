// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock('../../stores/auditStore', () => ({ audit }));

import ReportGenerator from './ReportGenerator';
import { useMissionStore } from '../../stores/missionStore';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';

const T = new Date('2026-03-01T10:00:00Z');
const entities = [
  { id: 'e1', name: 'Alpha <b>', type: 'vehicle', threatLevel: 'high', confidence: 80 },
  { id: 'e2', name: 'Bravo', type: 'person', threatLevel: 'low', confidence: 60 },
  { id: 'e3', name: 'Charlie', type: 'person', threatLevel: 'critical', confidence: 90 },
];
const setup = () => {
  useMissionStore.setState({
    missions: [{ id: 'm1', name: 'Op "Mesa"', status: 'active', created_at: '2026-02-01T00:00:00Z', entityIds: ['e1', 'e2'], notes: [{ id: 'n1', content: 'Check <script>' }] }],
  });
  useIntelStore.setState({
    entities,
    relationships: [{ from: 'e1', to: 'e2', type: 'follows', confidence: 70 }],
    events: [
      { id: 'v1', entityId: 'e1', time: T, severity: 'high', description: 'seen' },
      { id: 'v2', entityId: 'e3', time: T, severity: 'low', description: 'other mission' },
    ],
  });
  useTelemetryStore.setState({ fleet: [{ drone_id: 'D1', altitude: 12.4, battery_voltage: NaN, ground_speed: 3.26 }] });
};

beforeEach(() => { audit.mockClear(); setup(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ReportGenerator', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ReportGenerator open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('general report covers all entities and counts high/critical', () => {
    render(<ReportGenerator open onClose={() => {}} />);
    expect(screen.getByText('General Intelligence Report')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
    expect(screen.getByText(/other mission/)).toBeTruthy();
    expect(screen.getByText(/high\/critical threats/).textContent).toContain('2 high/critical');
  });

  it('mission report scopes entities, events and notes', () => {
    render(<ReportGenerator open onClose={() => {}} missionId="m1" />);
    expect(screen.getByText('Op "Mesa"')).toBeTruthy();
    expect(screen.queryByText('Charlie')).toBeNull();
    expect(screen.queryByText(/other mission/)).toBeNull();
    expect(screen.getByText('seen', { exact: false })).toBeTruthy();
    expect(screen.getByText(/Check <script>/)).toBeTruthy();
    expect(screen.getByText(/--\[follows\]--/)).toBeTruthy();
  });

  it('shows placeholders and guards non-finite fleet numbers', () => {
    useIntelStore.setState({ entities: [], relationships: [], events: [] });
    useTelemetryStore.setState({ fleet: [{ drone_id: 'D1', altitude: 12.4, battery_voltage: NaN, ground_speed: 3.26 }] });
    render(<ReportGenerator open onClose={() => {}} />);
    expect(screen.getByText('No relationships recorded.')).toBeTruthy();
    expect(screen.getByText('No events recorded.')).toBeTruthy();
    expect(screen.getByText('No analyst notes.')).toBeTruthy();
    const line = screen.getByText(/D1 \|/).textContent;
    expect(line).toContain('ALT 12m');
    expect(line).not.toContain('NaN');
  });

  it('copy writes the plain-text report and audits', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ReportGenerator open onClose={() => {}} missionId="m1" />);
    fireEvent.click(screen.getByText('COPY'));
    const text = writeText.mock.calls[0][0];
    expect(text).toContain('MISSION: Op "Mesa"');
    expect(text).toContain('Entities: 2 |');
    expect(text).not.toContain('Charlie');
    expect(audit).toHaveBeenCalledWith('export', 'export', 'Copied report to clipboard');
  });

  it('HTML download escapes untrusted text', async () => {
    let blob;
    URL.createObjectURL = vi.fn((b) => { blob = b; return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ReportGenerator open onClose={() => {}} missionId="m1" />);
    fireEvent.click(screen.getByText('HTML'));
    expect(click).toHaveBeenCalled();
    const html = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(blob); });
    expect(html).toContain('Alpha &lt;b&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(audit).toHaveBeenCalledWith('export', 'export', 'Downloaded HTML report');
  });

  it('print and close call through', () => {
    const print = vi.fn(); window.print = print;
    const onClose = vi.fn();
    render(<ReportGenerator open onClose={onClose} />);
    fireEvent.click(screen.getByText('PRINT'));
    expect(print).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Close report'));
    expect(onClose).toHaveBeenCalled();
  });
});
