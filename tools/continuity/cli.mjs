#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { acquireReservation, assessResume, classifyOutcome, inspectReservation, recordVerificationAudit, releaseReservation, snapshot, writeCheckpoint } from './local.mjs';
import { schemas } from './schemas.mjs';

export function main(args = process.argv.slice(2)) {
  try {
    const [command, ...rest] = args;
    const options = {};
    for (let index = 0; index < rest.length; index += 2) {
      if (!['--root', '--input'].includes(rest[index]) || !rest[index + 1] || Object.hasOwn(options, rest[index])) throw new Error('Expected unique --root DIRECTORY / --input PRIVATE_JSON options');
      options[rest[index]] = rest[index + 1];
    }
    if (command === 'help' || !command) {
      console.log('Usage: node tools/continuity/cli.mjs COMMAND [--root DIRECTORY] [--input PRIVATE_JSON]\nCommands: status, snapshot, schemas, acquire, audit-verification, checkpoint, assess, release, classify\nNo provider is launched; no lock is reclaimed. Input/output tokens, audits and checkpoints are private.');
      return 0;
    }
    const repo = options['--root'] ?? process.cwd();
    const input = options['--input'] ? JSON.parse(readFileSync(options['--input'], 'utf8').replace(/^\uFEFF/, '')) : {};
    let result;
    switch (command) {
      case 'status': {
        result = inspectReservation(repo);
        if (result.reservation) { const { nonce, ...publicIdentity } = result.reservation; result.reservation = publicIdentity; }
        break;
      }
      case 'snapshot': result = snapshot(repo); break;
      case 'schemas': result = schemas; break;
      case 'acquire': result = acquireReservation(repo, input); break;
      case 'audit-verification': result = recordVerificationAudit(repo, input.token, input.details); break;
      case 'checkpoint': result = writeCheckpoint(repo, input.token, input.details); break;
      case 'assess': result = assessResume(repo, input); break;
      case 'release': result = releaseReservation(repo, input.token); break;
      case 'classify': result = classifyOutcome(input); break;
      default: throw new Error('Unknown command; run help');
    }
    console.log(JSON.stringify(result, null, 2));
    return command === 'assess' && !result.ready ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({ error: error.code ?? 'INVALID_REQUEST', message: error.message }));
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
