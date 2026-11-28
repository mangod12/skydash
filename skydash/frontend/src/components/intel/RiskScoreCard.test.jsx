// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import RiskScoreCard from './RiskScoreCard';
import { useIntelStore } from '../../stores/intelStore';
import { calculateRiskScore, getRiskLevel } from '../../utils/riskScoring';

const entity = { id: 'e1', name: 'A', type: 'vehicle', threatLevel: 'high', confidence: 80 };
const rels = [{ from: 'e1', to: 'e2', type: 'follows', confidence: 70 }, { from: 'e3', to: 'e1', type: 'near', confidence: 50 }, { from: 'e2', to: 'e3', type: 'x', confidence: 10 }];

beforeEach(() => useIntelStore.setState({ entities: [entity], relationships: rels, events: [] }));
afterEach(cleanup);

describe('RiskScoreCard', () => {
  it('renders nothing for an unknown entity', () => {
    const { container } = render(<RiskScoreCard entityId="nope" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the computed score, level, confidence and relationship count', () => {
    const { score } = calculateRiskScore(entity, rels, [], [entity]);
    render(<RiskScoreCard entityId="e1" />);
    expect(screen.getByText(getRiskLevel(score).toUpperCase())).toBeTruthy();
    expect(screen.getByText(/CONF 80%/).textContent).toContain('2 REL');
    expect(screen.getByRole('group').getAttribute('aria-label')).toContain(`Risk score ${score} of 100`);
  });

  it('reveals the factor breakdown on hover and on keyboard focus', () => {
    render(<RiskScoreCard entityId="e1" />);
    const g = screen.getByRole('group');
    expect(screen.queryByText('FACTOR BREAKDOWN')).toBeNull();
    fireEvent.mouseEnter(g);
    expect(screen.getByText('FACTOR BREAKDOWN')).toBeTruthy();
    expect(screen.getByText('BASE THREAT')).toBeTruthy();
    expect(screen.getByText(/^x\d\.\d\d$/)).toBeTruthy();
    fireEvent.mouseLeave(g);
    expect(screen.queryByText('FACTOR BREAKDOWN')).toBeNull();
    expect(g.tabIndex).toBe(0);
    fireEvent.focus(g);
    expect(screen.getByText('FACTOR BREAKDOWN')).toBeTruthy();
    fireEvent.blur(g);
    expect(screen.queryByText('FACTOR BREAKDOWN')).toBeNull();
  });

  it('draws a trend line only with two or more history points', () => {
    const { container, rerender } = render(<RiskScoreCard entityId="e1" />);
    expect(container.querySelector('polyline')).toBeNull();
    rerender(<RiskScoreCard entityId="e1" trendHistory={[10, 20, 30]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
});
