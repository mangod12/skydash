// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ScenarioSummaryCard from './ScenarioSummaryCard';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useUIStore } from '../../stores/uiStore';
import { DEFAULT_SCENARIO_ID, getScenarioById } from '../../utils/scenarioEngine';

beforeEach(() => useScenarioStore.setState({ status: 'idle', elapsedSeconds: 0, injectedEvents: [] }));
afterEach(cleanup);

describe('ScenarioSummaryCard', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<ScenarioSummaryCard />);
    expect(container.textContent).toBe('');
  });

  it.each(['running', 'paused', 'complete'])('shows the %s status and scenario name', (status) => {
    useScenarioStore.setState({ status, elapsedSeconds: 30 });
    render(<ScenarioSummaryCard />);
    expect(screen.getByText(status.toUpperCase())).toBeTruthy();
    expect(screen.getByText(getScenarioById(DEFAULT_SCENARIO_ID).name)).toBeTruthy();
    expect(screen.getByText('COVERAGE')).toBeTruthy();
    expect(screen.getByText('GRADE')).toBeTruthy();
  });

  it('opens the scenario lab', () => {
    const setActiveView = vi.fn();
    useUIStore.setState({ setActiveView });
    useScenarioStore.setState({ status: 'running' });
    render(<ScenarioSummaryCard />);
    fireEvent.click(screen.getByText('OPEN LAB'));
    expect(setActiveView).toHaveBeenCalledWith('scenario');
  });
});
