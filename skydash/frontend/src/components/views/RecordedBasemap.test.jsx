// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordedBasemapLayer, { RecordedBasemapControl } from './RecordedBasemap';
vi.mock('react-leaflet', () => ({ TileLayer: props => <div data-testid="external-tile-layer">{props.url}</div> }));
afterEach(cleanup);
describe('recorded review external basemap privacy controls', () => {
  it('renders no external tile layer while disabled, and removes it when revoked', () => {
    const { rerender } = render(<RecordedBasemapLayer enabled={false} />); expect(screen.queryByTestId('external-tile-layer')).toBeNull();
    rerender(<RecordedBasemapLayer enabled />); expect(screen.getByTestId('external-tile-layer').textContent).toContain('https://');
    rerender(<RecordedBasemapLayer enabled={false} />); expect(screen.queryByTestId('external-tile-layer')).toBeNull();
  });
  it('requires explicit per-map checkbox, names disclosure and never claims offline protection', () => {
    const change = vi.fn(); const { rerender } = render(<RecordedBasemapControl enabled={false} onChange={change} label="test replay" />);
    expect(screen.getByLabelText('Allow external basemap for test replay').checked).toBe(false); expect(screen.getByText(/It is not an offline or air-gapped mode/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Allow external basemap for test replay')); expect(change).toHaveBeenCalledWith(true);
    rerender(<RecordedBasemapControl enabled onChange={change} label="test replay" />); expect(screen.getByRole('status').textContent).toContain('cannot recall requests already made');
    fireEvent.click(screen.getByLabelText('Allow external basemap for test replay')); expect(change).toHaveBeenLastCalledWith(false);
  });
});
