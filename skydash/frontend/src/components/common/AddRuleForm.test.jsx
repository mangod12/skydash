// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AddRuleForm from './AddRuleForm';

afterEach(cleanup);

const openForm = () => {
  const onAdd = vi.fn();
  render(<AddRuleForm onAdd={onAdd} />);
  fireEvent.click(screen.getByText('ADD RULE'));
  return onAdd;
};

describe('AddRuleForm', () => {
  it('starts collapsed and opens on click', () => {
    render(<AddRuleForm onAdd={() => {}} />);
    expect(screen.queryByPlaceholderText('Rule name...')).toBeNull();
    fireEvent.click(screen.getByText('ADD RULE'));
    expect(screen.getByPlaceholderText('Rule name...')).toBeTruthy();
  });

  it('keeps Create disabled and does not submit without a name', () => {
    const onAdd = openForm();
    const create = screen.getByText('CREATE RULE');
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Rule name...'), { target: { value: '   ' } });
    fireEvent.click(create);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('submits a trimmed rule with default config and warning cooldown', () => {
    const onAdd = openForm();
    fireEvent.change(screen.getByPlaceholderText('Rule name...'), { target: { value: '  Low pack  ' } });
    fireEvent.click(screen.getByText('CREATE RULE'));
    expect(onAdd).toHaveBeenCalledWith({
      name: 'Low pack',
      type: 'battery_low',
      enabled: true,
      config: { threshold: 25 },
      severity: 'warning',
      cooldownMs: 60000,
    });
    expect(screen.getByText('ADD RULE')).toBeTruthy();
  });

  it('uses type-specific config and a shorter cooldown for critical rules', () => {
    const onAdd = openForm();
    fireEvent.change(screen.getByPlaceholderText('Rule name...'), { target: { value: 'Too high' } });
    const [typeSelect, severitySelect] = screen.getAllByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'altitude_limit' } });
    fireEvent.change(severitySelect, { target: { value: 'critical' } });
    fireEvent.click(screen.getByText('CREATE RULE'));
    const rule = onAdd.mock.calls[0][0];
    expect(rule).toMatchObject({ type: 'altitude_limit', config: { maxAlt: 100 }, severity: 'critical', cooldownMs: 30000 });
  });

  it('closes without adding when cancelled', () => {
    const onAdd = openForm();
    fireEvent.click(screen.getByText('NEW RULE').nextSibling);
    expect(screen.getByText('ADD RULE')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
