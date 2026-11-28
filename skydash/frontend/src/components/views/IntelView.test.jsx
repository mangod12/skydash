// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { stub } = vi.hoisted(() => ({ stub: (name) => ({ default: () => <div data-testid={name} /> }) }));
vi.mock('../intel/IntelPanel', () => stub('panel'));
vi.mock('../intel/EntityDetail', () => stub('detail'));
vi.mock('../intel/EntityComparison', () => stub('compare'));
vi.mock('../intel/TimelineView', () => stub('timeline'));
vi.mock('../intel/LinkGraph', () => stub('graph'));
vi.mock('../intel/PatternPanel', () => stub('patterns'));
vi.mock('../intel/IntelFeed', () => stub('feed'));
vi.mock('../intel/NaturalLanguageQuery', () => stub('nlq'));
vi.mock('../intel/AnomalyDetector', () => stub('anomaly'));
vi.mock('../intel/ReportExport', () => stub('export'));
vi.mock('../intel/OsintIngestPanel', () => stub('osint'));
vi.mock('../intel/TagCloud', () => stub('tags'));
vi.mock('../intel/ConnectionMatrix', () => stub('matrix'));

import IntelView from './IntelView';
import { useIntelStore } from '../../stores/intelStore';
import { useUIStore } from '../../stores/uiStore';

beforeEach(() => {
  useIntelStore.setState({ selectedEntityId: null, comparedEntities: [null, null] });
  useUIStore.setState({ activeView: 'intel' });
});
afterEach(cleanup);

describe('IntelView', () => {
  it('starts on the timeline tab with only it tabbable', () => {
    render(<IntelView />);
    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Timeline/ }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: /Matrix/ }).getAttribute('tabindex')).toBe('-1');
  });

  it('switches tabs on click', () => {
    render(<IntelView />);
    fireEvent.click(screen.getByRole('tab', { name: /Link Analysis/ }));
    expect(screen.getByTestId('graph')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Link Analysis/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('moves with arrow keys, wrapping, plus Home and End, and focuses the new tab', () => {
    render(<IntelView />);
    const tl = screen.getByRole('tab', { name: /Timeline/ });
    fireEvent.keyDown(tl, { key: 'ArrowRight' });
    expect(screen.getByTestId('graph')).toBeTruthy();
    expect(document.activeElement.id).toBe('intel-tab-graph');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    expect(screen.getByTestId('matrix')).toBeTruthy();
    fireEvent.keyDown(document.activeElement, { key: 'Home' });
    expect(screen.getByTestId('timeline')).toBeTruthy();
    fireEvent.keyDown(document.activeElement, { key: 'End' });
    expect(screen.getByTestId('matrix')).toBeTruthy();
    fireEvent.keyDown(document.activeElement, { key: 'x' });
    expect(screen.getByTestId('matrix')).toBeTruthy();
  });

  it('shows entity detail only when an entity is selected', () => {
    render(<IntelView />);
    expect(screen.queryByTestId('detail')).toBeNull();
    cleanup();
    useIntelStore.setState({ selectedEntityId: 'e1' });
    render(<IntelView />);
    expect(screen.getByTestId('detail')).toBeTruthy();
  });
});
