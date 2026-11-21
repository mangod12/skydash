import { syntheticTrainingOriginals } from './syntheticTrainingOriginals';
import { browserTrainingArchive } from './browserTrainingArchive';
export async function browserSyntheticTrainingStarter() {
  const { files, training } = await syntheticTrainingOriginals();
  const file = (name,text) => { const bytes=new TextEncoder().encode(text); return {name,size:bytes.byteLength,arrayBuffer:async()=>bytes}; };
  // Acknowledgement here covers only these fixed fabricated originals, never caller files.
  const result = await browserTrainingArchive(file('training.json',training),['case','notebook','paired'].map(kind=>file(kind+'.json',files[kind+'.json'])),{includeSensitiveOriginals:true});
  return result;
}
