// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ setView: () => {} }),
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('../map/ScenarioOverlay', () => ({ default: () => null }));
vi.mock('./ExerciseReviewPanel', () => ({ default: () => <div data-testid="review" /> }));
vi.mock('./SearchGridPlanner', () => ({ default: ({ onBack }) => <button onClick={onBack}>planner-back</button> }));
vi.mock('./FlightLogReplay', () => ({ default: ({ onBack }) => <button onClick={onBack}>log-back</button> }));

import ScenarioLabView from './ScenarioLabView';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useScenarioStore.getState().resetLab();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const launch = () => fireEvent.click(screen.getByText('LAUNCH'));

describe('ScenarioLabView', () => {
  it('starts idle with LAUNCH, injects disabled and fleet changeable', () => {
    render(<ScenarioLabView />);
    expect(screen.getByText('IDLE')).toBeTruthy();
    expect(screen.getByText('LAUNCH')).toBeTruthy();
    expect(screen.getByText('WIND SHIFT').closest('button').disabled).toBe(true);
    expect(screen.queryByText('RESET TO CHANGE FLEET')).toBeNull();
  });

  it('launch runs the scenario, toggles to PAUSE, and pausing holds it', () => {
    render(<ScenarioLabView />);
    launch();
    expect(screen.getByText('RUNNING')).toBeTruthy();
    expect(screen.getByText('RESET TO CHANGE FLEET')).toBeTruthy();
    fireEvent.click(screen.getByText('PAUSE'));
    expect(screen.getByText('PAUSED')).toBeTruthy();
    expect(screen.getByText('LAUNCH')).toBeTruthy();
  });

  it('advances simulated time once per second at the chosen speed', () => {
    render(<ScenarioLabView />);
    launch();
    act(() => { vi.advanceTimersByTime(3000); });
    const at3 = useScenarioStore.getState().elapsedSeconds;
    expect(at3).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('1X'));
    expect(useScenarioStore.getState().speed).toBe(2);
    fireEvent.click(screen.getByText('2X'));
    fireEvent.click(screen.getByText('4X'));
    expect(useScenarioStore.getState().speed).toBe(1);
  });

  it('STEP +30S seeks forward and RESET returns to idle at zero', () => {
    render(<ScenarioLabView />);
    fireEvent.click(screen.getByText('STEP +30S'));
    expect(useScenarioStore.getState().elapsedSeconds).toBe(30);
    fireEvent.click(screen.getByText('RESET'));
    expect(useScenarioStore.getState().elapsedSeconds).toBe(0);
    expect(useScenarioStore.getState().status).toBe('idle');
  });

  it('injects an event once while running and then shows it as ACTIVE', () => {
    render(<ScenarioLabView />);
    launch();
    const btn = screen.getByText('SIGNAL LOSS').closest('button');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(useScenarioStore.getState().injectedEvents).toHaveLength(1);
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('ACTIVE').closest('button').disabled).toBe(true);
  });

  it('opens the planner and flight log, pausing first, and returns on back', () => {
    render(<ScenarioLabView />);
    launch();
    fireEvent.click(screen.getByText('SEARCH GRID PLANNER'));
    expect(useScenarioStore.getState().status).toBe('paused');
    fireEvent.click(screen.getByText('planner-back'));
    expect(screen.getByText('Scenario Lab')).toBeTruthy();
    fireEvent.click(screen.getByText('FLIGHT LOG REPLAY'));
    expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    fireEvent.click(screen.getByText('log-back'));
    expect(useUIStore.getState().recordedReviewOpen).toBe(false);
  });

  it('clears the recorded-review flag when unmounted', () => {
    const { unmount } = render(<ScenarioLabView />);
    fireEvent.click(screen.getByText('FLIGHT LOG REPLAY'));
    expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    unmount();
    expect(useUIStore.getState().recordedReviewOpen).toBe(false);
  });
});
