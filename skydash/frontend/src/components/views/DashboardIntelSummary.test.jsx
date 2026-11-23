// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import DashboardIntelSummary from './DashboardIntelSummary';

const entity = (id, extra = {}) => ({ id, name: id, confidence: 90, threatLevel: 'low', ...extra });
const critical = () => ({ severity: 'critical', time: Date.now() });
afterEach(cleanup);

it('uses singular and plural nouns in finding text', () => {
  const one = render(
    <DashboardIntelSummary entities={[entity('A', { confidence: 40 })]} events={[critical()]} relationships={[]} />,
  );
  expect(one.container.textContent).toContain('1 critical event in last 30 minutes');
  expect(one.container.textContent).toContain('1 entity below 60% confidence');
  one.unmount();
  const many = render(
    <DashboardIntelSummary
      entities={[entity('A', { confidence: 40 }), entity('B', { confidence: 50 })]}
      events={[critical(), critical()]}
      relationships={[]}
    />,
  );
  expect(many.container.textContent).toContain('2 critical events in last 30 minutes');
  expect(many.container.textContent).toContain('2 entities below 60% confidence');
});
