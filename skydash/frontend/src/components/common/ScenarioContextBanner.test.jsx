// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ScenarioContextBanner from './ScenarioContextBanner';
import { useScenarioStore, getInitialScenarioState } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';
import { getScenarioById, getFleetPresetById, buildScenarioFrame, formatScenarioTime } from '../../utils/scenarioEngine';

beforeEach(() => {
  useScenarioStore.setState(getInitialScenarioState());
  useUIStore.setState({ activeView: 'dashboard' });
});
afterEach(cleanup);

describe('ScenarioContextBanner', () => {
  it('renders nothing while the scenario is idle', () => {
    const { container } = render(<ScenarioContextBanner />);
    expect(container.textContent).toBe('');
  });

  it('shows status, elapsed time, scenario, fleet preset and scorecard when running', () => {
    useScenarioStore.setState({ status: 'running', elapsedSeconds: 125 });
    render(<ScenarioContextBanner />);
    const s = useScenarioStore.getState();
    const frame = buildScenarioFrame(s);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('RUNNING')).toBeTruthy();
    expect(screen.getByText(`T+${formatScenarioTime(125)}`)).toBeTruthy();
    expect(screen.getByText(getScenarioById(s.activeScenarioId).name)).toBeTruthy();
    expect(screen.getByText(getFleetPresetById(s.selectedFleetPresetId).name)).toBeTruthy();
    expect(screen.getByText(`${frame.scorecard.coverage}%`)).toBeTruthy();
    expect(screen.getByText(`${frame.scorecard.riskReduced}%`)).toBeTruthy();
    expect(screen.getByText('0 injects')).toBeTruthy();
  });

  it('counts injected events', () => {
    useScenarioStore.setState({ status: 'running', elapsedSeconds: 60, injectedEvents: [{ id: 'x', injectedAt: 10 }, { id: 'y', injectedAt: 20 }] });
    render(<ScenarioContextBanner />);
    expect(screen.getByText('2 injects')).toBeTruthy();
  });

  it('shows the paused and complete states', () => {
    useScenarioStore.setState({ status: 'paused', elapsedSeconds: 10 });
    const { unmount } = render(<ScenarioContextBanner />);
    expect(screen.getByText('PAUSED')).toBeTruthy();
    unmount();
    useScenarioStore.setState({ status: 'complete' });
    render(<ScenarioContextBanner />);
    expect(screen.getByText('COMPLETE')).toBeTruthy();
  });

  it('opens the scenario lab from the button', () => {
    useScenarioStore.setState({ status: 'paused' });
    render(<ScenarioContextBanner />);
    fireEvent.click(screen.getByText('OPEN LAB'));
    expect(useUIStore.getState().activeView).toBe('scenario');
  });
});
