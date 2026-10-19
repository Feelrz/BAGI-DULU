import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
export async function moduleUrl(path) {
  const url = new URL(path, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  let code = ts.transpileModule(await readFile(url, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...code.matchAll(/from ['"]([.][^'"]+)['"]/g)]) {
    const dependency = await moduleUrl(new URL(match[1] + '.ts', url).href);
    code = code.replace(match[0], 'from ' + JSON.stringify(dependency));
  }
  const result = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  cache.set(url.href, result); return result;
}
