// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EntityTypeCards from './EntityTypeCards';

afterEach(cleanup);
const e = (type, name, threatLevel, confidence) => ({ type, name, threatLevel, confidence });

describe('EntityTypeCards', () => {
  it('renders nothing but the header for no entities', () => {
    render(<EntityTypeCards entities={[]} />);
    expect(screen.getByText('ENTITY TYPE BREAKDOWN')).toBeTruthy();
    expect(screen.queryByText('PERSONS')).toBeNull();
  });

  it('counts per type, averages confidence and picks the top threat', () => {
    render(<EntityTypeCards entities={[
      e('person', 'Low One', 'low', 60), e('person', 'Crit One', 'critical', 80), e('vehicle', 'Van', 'none', 50),
    ]} />);
    expect(screen.getByText('PERSONS')).toBeTruthy();
    expect(screen.getByText('VEHICLES')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
    expect(screen.getByText('Crit One')).toBeTruthy();
  });

  it('treats unknown threat levels as none and bad confidence as 0', () => {
    render(<EntityTypeCards entities={[e('device', 'Odd', 'bogus', 'abc'), e('device', 'Odd2', undefined, NaN)]} />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Threat levels: 2 none' })).toBeTruthy();
  });

  it('labels the threat bar for non-visual users', () => {
    render(<EntityTypeCards entities={[e('building', 'HQ', 'high', 90), e('building', 'Depot', 'low', 70)]} />);
    expect(screen.getByRole('img', { name: 'Threat levels: 1 high, 1 low' })).toBeTruthy();
  });

  it('falls back to the event style for unknown types', () => {
    render(<EntityTypeCards entities={[e('mystery', 'X', 'low', 10)]} />);
    expect(screen.getByText('EVENTS')).toBeTruthy();
  });
});
