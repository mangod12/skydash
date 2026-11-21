import { expect,it } from 'vitest';
import { privatePacketOrdinals,parsePrivatePacketOrdinals } from './privatePacketOrdinals';
it('requires explicit unique numeric bounded ordinals, keeps original manifest order without mutating input',()=>{
  expect(privatePacketOrdinals(null,3)).toBeNull();
  const input=[3,1];expect(privatePacketOrdinals(input,3)).toEqual([1,3]);expect(input).toEqual([3,1]);
  expect(parsePrivatePacketOrdinals(' 3 , 1 ')).toEqual([1,3]);
  for(const input of [undefined,[],[0],[21],[-1],[1.2],['1'],[1,1],[null],Array(21).fill(1)])expect(()=>privatePacketOrdinals(input)).toThrow();
  expect(()=>privatePacketOrdinals([4],3)).toThrow();
  for(const text of ['', '1,', ',1', '1,,2','1-3','01','+1','1.0','1e0','1 2','1,1','0','21','1;2','<script>'])expect(()=>parsePrivatePacketOrdinals(text)).toThrow();
});
