import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertRulesStore, isDefaultRule } from './alertRulesStore';

const store = useAlertRulesStore;

// Snapshot the initial default rules
const defaultRules = store.getState().rules.map((r) => ({ ...r }));

beforeEach(() => {
  store.setState({ rules: defaultRules.map((r) => ({ ...r })) });
});

describe('alertRulesStore', () => {
  it('has 6 default rules loaded', () => {
    expect(store.getState().rules).toHaveLength(6);
  });

  it('isDefaultRule identifies built-in rules', () => {
    expect(isDefaultRule('bat-30')).toBe(true);
    expect(isDefaultRule('geo-any')).toBe(true);
    expect(isDefaultRule('custom-xyz')).toBe(false);
  });

  it('toggleRule flips enabled state', () => {
    const id = 'bat-30';
    const before = store.getState().rules.find((r) => r.id === id).enabled;
    store.getState().toggleRule(id);
    const after = store.getState().rules.find((r) => r.id === id).enabled;
    expect(after).toBe(!before);
  });

  it('updateRule changes config', () => {
    store.getState().updateRule('bat-30', { config: { threshold: 25 } });
    const rule = store.getState().rules.find((r) => r.id === 'bat-30');
    expect(rule.config.threshold).toBe(25);
  });

  it('addRule adds a custom rule with generated id', () => {
    store.getState().addRule({ name: 'Custom Rule', type: 'proximity', enabled: true, config: { radius: 100 }, severity: 'warning', cooldownMs: 30000 });
    const rules = store.getState().rules;
    expect(rules.length).toBe(7);
    const custom = rules[rules.length - 1];
    expect(custom.name).toBe('Custom Rule');
    expect(custom.id).toMatch(/^rule-/);
  });

  it('removeRule removes a rule by id', () => {
    // Add custom rule first, then remove it
    store.getState().addRule({ name: 'Temp', type: 'proximity', enabled: true, config: {}, severity: 'info', cooldownMs: 10000 });
    const added = store.getState().rules[store.getState().rules.length - 1];
    store.getState().removeRule(added.id);
    expect(store.getState().rules.find((r) => r.id === added.id)).toBeUndefined();
    expect(store.getState().rules).toHaveLength(6);
  });
});
