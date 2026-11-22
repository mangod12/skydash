// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import StandaloneReportTools from './StandaloneReportTools';
afterEach(cleanup);
const open = element => { element.open = true; fireEvent(element, new Event('toggle', { bubbles: false })); };
it('keeps only one direct report disclosure open without remounting or clearing other tool inputs/results', () => {
  render(<StandaloneReportTools><details><summary>First tool</summary><input aria-label="First selection" defaultValue="retained" /><p>Prepared result</p></details><details><summary>Second tool</summary><input aria-label="Second selection" defaultValue="second" /></details></StandaloneReportTools>);
  const a=screen.getByText('First tool').parentElement,b=screen.getByText('Second tool').parentElement,input=screen.getByLabelText('First selection'); open(a); expect(a.open).toBe(true); fireEvent.change(input,{target:{value:'edited'}}); open(b); expect(a.open).toBe(false); expect(b.open).toBe(true); expect(input.value).toBe('edited'); expect(screen.getByText('Prepared result')).toBeTruthy(); open(a); expect(b.open).toBe(false); expect(screen.getByLabelText('First selection')).toBe(input);
});
it('ignores closing events and nested details rather than closing their parent or unrelated controls', () => {
  render(<StandaloneReportTools><details open><summary>Parent tool</summary><details><summary>Nested choice</summary></details></details><details><summary>Other tool</summary></details></StandaloneReportTools>);
  const parent=screen.getByText('Parent tool').parentElement,child=screen.getByText('Nested choice').parentElement,other=screen.getByText('Other tool').parentElement;open(child);expect(parent.open).toBe(true);expect(child.open).toBe(true);fireEvent(other,new Event('toggle',{bubbles:false}));expect(parent.open).toBe(true);
});

it('hiding the handoff area preserves the exact open disclosure, selected input, consent and prepared result nodes',()=>{
 const content=<details open><summary>Kept tool</summary><input aria-label="Kept selection" defaultValue="original"/><input aria-label="Kept consent" type="checkbox"/><p>Kept prepared result</p></details>,view=render(<StandaloneReportTools>{content}</StandaloneReportTools>),root=screen.getByLabelText('Standalone original report tools'),field=screen.getByLabelText('Kept selection'),consent=screen.getByLabelText('Kept consent'),result=screen.getByText('Kept prepared result');fireEvent.change(field,{target:{value:'edited'}});fireEvent.click(consent);view.rerender(<StandaloneReportTools hidden>{content}</StandaloneReportTools>);expect(root.hidden).toBe(true);expect(field.value).toBe('edited');expect(consent.checked).toBe(true);expect(screen.getByText('Kept tool').parentElement.open).toBe(true);view.rerender(<StandaloneReportTools>{content}</StandaloneReportTools>);expect(root.hidden).toBe(false);expect(screen.getByLabelText('Kept selection')).toBe(field);expect(screen.getByText('Kept prepared result')).toBe(result);expect(consent.checked).toBe(true);
});
