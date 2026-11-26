// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ActivityItem from './ActivityItem';
import { useUIStore } from '../../stores/uiStore';

beforeEach(() => useUIStore.setState({ activeView: 'dashboard' }));
afterEach(cleanup);

const base = { action: 'Entity tagged', detail: 'Hostile', severity: 'warning', category: 'intel', icon: 'Shield', timestamp: new Date() };

describe('ActivityItem', () => {
  it('renders action, detail and a labelled severity', () => {
    render(<ActivityItem activity={base} />);
    expect(screen.getByText('Entity tagged')).toBeTruthy();
    expect(screen.getByText('Hostile')).toBeTruthy();
    expect(screen.getByLabelText('Severity: warning')).toBeTruthy();
  });

  it('falls back to info severity', () => {
    render(<ActivityItem activity={{ ...base, severity: 'odd' }} />);
    expect(screen.getByLabelText('Severity: info')).toBeTruthy();
  });

  it('is not a button when it has no target', () => {
    render(<ActivityItem activity={base} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens intel for an entity on click and on Enter/Space', () => {
    render(<ActivityItem activity={{ ...base, entityId: 'e1' }} />);
    const b = screen.getByRole('button');
    fireEvent.click(b);
    expect(useUIStore.getState().activeView).toBe('intel');
    useUIStore.setState({ activeView: 'dashboard' });
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(useUIStore.getState().activeView).toBe('intel');
    useUIStore.setState({ activeView: 'dashboard' });
    fireEvent.keyDown(b, { key: ' ' });
    expect(useUIStore.getState().activeView).toBe('intel');
  });

  it('opens missions for a mission target', () => {
    render(<ActivityItem activity={{ ...base, missionId: 'm1' }} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(useUIStore.getState().activeView).toBe('missions');
  });
});
