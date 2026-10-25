// Explicit local retained-build reuse; static record integrity, not log honesty.
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { SOURCE, sha256 } from './package.mjs';
export async function retainedPreparation(directory, repository) {
  const artifacts = path.join(repository, 'tools/distribution/artifacts');
  if (!path.isAbsolute(directory) || path.dirname(path.resolve(directory)) !== path.resolve(artifacts) || !/^verify-[A-Za-z0-9]+$/.test(path.basename(directory)) || (await lstat(directory)).isSymbolicLink()) throw new Error('Reuse requires an explicit owned artifact directory.');
  const file = async (name, limit) => { const target = path.join(directory, name), stat = await lstat(target); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('Retained input is not an ordinary bounded file.'); const bytes = await readFile(target); if (bytes.length > limit) throw new Error('Retained input grew.'); return bytes; };
  const record = JSON.parse(await file('result.json', 2097152));
  if (record.compiler_source !== SOURCE || record.contract_revision !== '1.3' || !/^[a-f0-9]{40}$/.test(record.helper_source)) throw new Error('Retained source/contract identity mismatch.');
  const step = label => { const value = record.commands.find(item => item.label === label); if (!value || value.exit_code !== 0 || value.failure !== null || value.signal !== null) throw new Error('Retained preparation step did not pass.'); return value; };
  const log = async (entry, limit) => { const filename = path.basename(entry.path); if (path.resolve(repository, entry.path) !== path.join(directory, filename)) throw new Error('Retained log path escaped its directory.'); const bytes = await file(filename, limit); if (sha256(bytes) !== entry.sha256) throw new Error('Retained raw log hash mismatch.'); return bytes; };
  const tar = await log(step('source-archive').logs.stdout, 67108864);
  if (sha256(await file('source.tar', 67108864)) !== sha256(tar)) throw new Error('Retained source archive changed.');
  const preparation = step('prepare-and-offline-build');
  const stdout = (await log(preparation.logs.stdout, 2097152)).toString('utf8');
  await log(preparation.logs.stderr, 2097152);
  const files = new Map([['source.tar', tar]]);
  for (const name of ['naja', 'rust-licenses/COPYRIGHT', 'rust-licenses/LICENSE-APACHE', 'rust-licenses/LICENSE-MIT']) {
    const wanted = '/linux-build/' + name;
    const line = stdout.split(/\r?\n/).find(value => /^[a-f0-9]{64}  /.test(value) && value.endsWith(wanted));
    const bytes = await file('linux-build/' + name, name === 'naja' ? 33554432 : 2097152);
    if (!line || line.slice(0, 64) !== sha256(bytes)) throw new Error('Retained compiler/license hash mismatch.'); files.set('linux-build/' + name, bytes);
  }
  for (const name of ['dynamic.txt', 'program.txt', 'versions.txt', 'ldd.txt']) files.set('linux-build/' + name, await file('linux-build/' + name, 2097152));
  return { files, record: { directory: path.relative(repository, directory).replaceAll('\\', '/'), helper_source: record.helper_source, compiler_source: SOURCE, preparation_stdout_sha256: preparation.logs.stdout.sha256, preparation_stderr_sha256: preparation.logs.stderr.sha256, boundary: 'Explicit local static record/hash audit; no execution replay or independent log-authenticity claim.' } };
}
