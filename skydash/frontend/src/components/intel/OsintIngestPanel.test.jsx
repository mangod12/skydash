// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ API_BASE: 'https://configured.test/prefix' }));
vi.mock('../../utils/runtimeConfig', () => config);
vi.mock('../../utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../common/Toast', () => ({ toast: vi.fn() }));
import OsintIngestPanel from './OsintIngestPanel';
import { useIntelStore } from '../../stores/intelStore';
import { apiFetch } from '../../utils/api';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('intel shared runtime API routing', () => {
  it('uses the configured runtime base for all intel snapshot requests', async () => {
    apiFetch.mockImplementation(async url => ({ ok: true, json: async () => ({ success: true,
      data: url.includes('/graph') ? { nodes: [], edges: [] } : [] }) }));
    expect(await useIntelStore.getState().fetchIntel()).toBe(true);
    expect(apiFetch.mock.calls.map(([url]) => url)).toEqual([
      'https://configured.test/prefix/api/entities',
      'https://configured.test/prefix/api/entities/graph',
      'https://configured.test/prefix/api/timeline?limit=200',
    ]);
  });

  it('uses the same configured runtime base for OSINT preview', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [], metadata: { mode: 'preview', count: 0 } }) });
    render(<OsintIngestPanel />);
    fireEvent.click(screen.getByText('PREVIEW', { exact: true }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    expect(apiFetch.mock.calls[0][0]).toBe('https://configured.test/prefix/api/connectors/shodan/ingest?dry_run=true&query=webcam&limit=5');
    await screen.findByText('PREVIEW / 0');
  });
});
