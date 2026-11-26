// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Slider, ModeChip, QuickBtn } from './CommandControls';

afterEach(cleanup);

describe('Slider', () => {
  const setup = (props = {}) => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Slider label="Speed" value={12} min={0} max={30} step={0.5} unit="m/s" onChange={onChange} onCommit={onCommit} {...props} />);
    return { onChange, onCommit, input: screen.getByLabelText('Speed') };
  };

  it('formats the value by step size', () => {
    setup();
    expect(screen.getByText('12.0 m/s')).toBeTruthy();
    cleanup();
    setup({ step: 1 });
    expect(screen.getByText('12 m/s')).toBeTruthy();
  });

  it('reports numeric changes while dragging', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('commits on pointer release', () => {
    const { onCommit, input } = setup();
    fireEvent.mouseUp(input);
    expect(onCommit).toHaveBeenCalledWith(12);
  });

  it('commits when a keyboard user releases an adjusting key', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ']) {
      const { onCommit, input } = setup();
      fireEvent.keyUp(input, { key });
      expect(onCommit, key).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('does not commit on unrelated keys such as Tab', () => {
    const { onCommit, input } = setup();
    fireEvent.keyUp(input, { key: 'Tab' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('works without an onCommit handler', () => {
    const { input } = setup({ onCommit: undefined });
    expect(() => fireEvent.keyUp(input, { key: 'ArrowRight' })).not.toThrow();
  });

  it('can be disabled', () => {
    const { input } = setup({ disabled: true });
    expect(input.disabled).toBe(true);
  });
});

describe('ModeChip and QuickBtn', () => {
  it('ModeChip exposes pressed state and ignores clicks when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ModeChip label="AUTO" active onClick={onClick} />);
    expect(screen.getByText('AUTO').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText('AUTO'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ModeChip label="AUTO" active={false} disabled onClick={onClick} />);
    fireEvent.click(screen.getByText('AUTO'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('QuickBtn fires onClick unless disabled', () => {
    const onClick = vi.fn();
    const Icon = () => <svg />;
    const { rerender } = render(<QuickBtn icon={Icon} label="RTL" onClick={onClick} />);
    fireEvent.click(screen.getByText('RTL'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<QuickBtn icon={Icon} label="RTL" disabled onClick={onClick} />);
    fireEvent.click(screen.getByText('RTL'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
