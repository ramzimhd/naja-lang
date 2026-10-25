'use strict';
const core = require('./core.cjs');

function activate(context, suppliedVscode) {
  const vscode = suppliedVscode || require('vscode');
  const diagnostics = vscode.languages.createDiagnosticCollection('naja-cli-preview');
  const output = vscode.window.createOutputChannel('NAJA CLI Preview');
  const sessions = new core.Sessions();
  const configuration = uri => { const value = vscode.workspace.getConfiguration('naja', uri); return { compilerPath: value.get('compilerPath', ''), projectRoot: value.get('projectRoot', ''), windowsRunner: value.get('windowsRunner', 'disabled') }; };
  const invalidate = uri => { sessions.cancel(); if (uri) diagnostics.delete(uri); else diagnostics.clear(); };
  async function command(kind) {
    const ticket = sessions.begin();
    try {
      const document = vscode.window.activeTextEditor?.document;
      if (!document) throw new core.AdapterError('document', 'Select a saved, clean .naja file.');
      const item = core.snapshot(document), settings = configuration(document.uri);
      core.eligible(item, vscode.workspace.isTrusted);
      await core.compilerFile(settings.compilerPath);
      await core.assertDisk(item);
      const projectIdentity = await core.projectFingerprint(settings.projectRoot);
      let target = null;
      if (kind === 'build') {
        const selected = await vscode.window.showSaveDialog({ title: 'Select a new Linux ELF output file', saveLabel: 'Build to New File' });
        if (!selected) return;
        if (selected.scheme !== 'file' || selected.authority) throw new core.AdapterError('output', 'Build output must be a new local file.');
        target = selected.fsPath;
      }
      const plan = core.makePlan(kind, item, settings, { output: target });
      const current = async () => {
        if (!vscode.workspace.isTrusted || document.isClosed || !core.sameSnapshot(item, core.snapshot(document)) || JSON.stringify(settings) !== JSON.stringify(configuration(document.uri))) return false;
        await core.assertDisk(item); return true;
      };
      const stable = async () => await current() && projectIdentity === await core.projectFingerprint(settings.projectRoot);
      output.clear(); diagnostics.delete(document.uri);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `NAJA ${kind} (CLI preview)`, cancellable: true }, async (_, cancellation) => {
        const disposable = cancellation.onCancellationRequested(() => ticket.cancel());
        try {
          const result = await core.executeFresh(plan, ticket, stable);
          if (!ticket.current() || !vscode.workspace.isTrusted || !core.sameSnapshot(item, core.snapshot(document)) || JSON.stringify(settings) !== JSON.stringify(configuration(document.uri))) throw new core.AdapterError('stale', 'Compiler result became stale and was discarded.');
          if (kind === 'check') {
            let report;
            try { report = core.validateReport(result, item); } catch (error) { output.append(result.stdout.toString('utf8')); output.append(result.stderr.toString('utf8')); throw error; }
            diagnostics.set(document.uri, report.diagnostics.map(value => { const range = new vscode.Range(value.start.line, value.start.character, value.end.line, value.end.character); const diagnostic = new vscode.Diagnostic(range, value.message, vscode.DiagnosticSeverity.Error); diagnostic.code = value.code; diagnostic.source = 'NAJA native CLI'; return diagnostic; }));
            output.appendLine(`Check ${report.status}; ${report.diagnostics.length} diagnostics; ${report.omitted_diagnostics} omitted.`);
          } else {
            output.appendLine(`${kind} exited ${result.exitCode}.`);
            output.append(result.stdout.toString('utf8')); output.append(result.stderr.toString('utf8'));
            if (result.exitCode !== 0) throw new core.AdapterError('command', `NAJA ${kind} failed with exit ${result.exitCode}; inspect NAJA CLI Preview output.`);
          }
          output.show(true);
        } finally { disposable.dispose(); }
      });
    } catch (error) {
      if (['stale', 'cancelled'].includes(error.code)) output.appendLine('Command cancelled or stale; no diagnostics accepted.');
      else { output.appendLine(error instanceof core.AdapterError ? error.message : 'Compiler file or disk operation failed.'); output.show(true); await vscode.window.showErrorMessage(error instanceof core.AdapterError ? error.message : 'NAJA compiler or disk operation failed; inspect configuration and saved source.'); }
    } finally { ticket.dispose(); }
  }
  context.subscriptions.push(diagnostics, output, { dispose: () => sessions.cancel() });
  for (const kind of ['check', 'build', 'run']) context.subscriptions.push(vscode.commands.registerCommand(`naja.${kind}`, () => command(kind)));
  context.subscriptions.push(vscode.commands.registerCommand('naja.cancel', () => sessions.cancel()));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => invalidate()));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => invalidate()));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => invalidate()));
  return { cancel: () => sessions.cancel() };
}
module.exports = { activate };
