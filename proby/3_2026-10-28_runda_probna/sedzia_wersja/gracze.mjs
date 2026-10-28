// Mecz modeli (próba 28.10): wywołanie Claude Code i Codexa bez narzędzi, polecenie na stdin, jedna odpowiedź JSON.
// Odcięcie od narzędzi i sposób wywołania przeniesione z sędziego Statków (C:\Projects\Statki\game\mcp\players.js),
// sprawdzonego w meczu 15.10.2026: Claude z pustą listą narzędzi i MCP (dowód w zdarzeniu init), Codex z wyłączonymi
// narzędziami i własnym CODEX_HOME (bez globalnego AGENTS.md); każde wywołanie w pustym katalogu tymczasowym.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SYSTEM_LINE = 'You are a player in a real-time 1v1 arena shooter. You have no tools. Answer only with one JSON object with your order.';
const LIMIT_RE = /usage limit|rate.?limit|limit (has been )?reached|hit your limit|limit will reset|quota|too many requests|\b429\b/i;

function runCli(exe, args, input, { timeoutMs, env = process.env }) {
  const cwd = mkdtempSync(join(tmpdir(), 'mecz-ai-'));
  const started = Date.now();
  return new Promise(ok => {
    const p = spawn(exe, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, finished = false;
    const timer = setTimeout(() => { timedOut = true; p.kill(); }, timeoutMs);
    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });
    const done = code => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      ok({ code, stdout, stderr, timedOut, ms: Date.now() - started });
    };
    p.on('error', e => { stderr += String(e); done(-1); });
    p.on('close', done);
    p.stdin.end(input);
  });
}
const jsonLines = s => s.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
// najszerszy obiekt JSON w tekście odpowiedzi (model może dodać zdanie przed nim; zagnieżdżone obiekty to części rozkazu)
export function parseAnswer(text) {
  const t = String(text ?? '').replace(/```(?:json)?/g, '');
  for (let i = t.indexOf('{'); i >= 0; i = t.indexOf('{', i + 1)) {
    for (let j = t.lastIndexOf('}'); j > i; j = t.lastIndexOf('}', j - 1)) {
      try { const o = JSON.parse(t.slice(i, j + 1)); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch { /* krótszy */ }
    }
  }
  return null;
}

const CLAUDE_EXE = join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
const claudeArgs = effort => ['-p', '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
  '--output-format', 'stream-json', '--verbose', '--system-prompt', SYSTEM_LINE, '--effort', effort];
function readClaude(run) {
  const ev = jsonLines(run.stdout), init = ev.find(e => e.type === 'system' && e.subtype === 'init'), result = ev.find(e => e.type === 'result');
  const proof = init ? { tools: init.tools, mcp_servers: init.mcp_servers } : null;
  if (init && (init.tools?.length || init.mcp_servers?.length)) throw new Error('claude: narzędzia albo MCP niepuste ' + JSON.stringify(proof));
  const base = { model: init?.model ?? null, proof, usage: result?.usage ?? null };
  const text = result?.result ?? '';
  if (LIMIT_RE.test(text) && result?.is_error) return { ...base, outcome: 'limit', error: text.slice(0, 300) };
  if (run.timedOut) return { ...base, outcome: 'timeout' };
  if (!result || result.is_error) return { ...base, outcome: 'cli_error', error: (text || run.stderr).slice(0, 300) };
  const output = parseAnswer(text);
  return output ? { ...base, outcome: 'ok', output, text } : { ...base, outcome: 'invalid', text };
}

const CODEX_JS = join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
export const CODEX_HOME = join(process.env.LOCALAPPDATA || tmpdir(), 'Statki', 'codex-home');
const CODEX_DISABLED = ['shell_tool', 'unified_exec', 'apps', 'plugins', 'multi_agent', 'view_image', 'browser_use', 'computer_use', 'goals'];
function codexArgs(effort) {
  const f = join(tmpdir(), 'mecz-ai-codex-instructions.txt');
  writeFileSync(f, SYSTEM_LINE);
  return [CODEX_JS, 'exec', '--ignore-user-config', '--skip-git-repo-check', '-s', 'read-only', '--json',
    ...CODEX_DISABLED.flatMap(x => ['--disable', x]), '-c', 'web_search="disabled"', '-c', 'agents.enabled=false',
    '-c', 'project_doc_max_bytes=0', '-c', `model_instructions_file='${f.split('\\').join('/')}'`, '-c', `model_reasoning_effort="${effort}"`, '-'];
}
function readCodex(run) {
  const ev = jsonLines(run.stdout);
  const items = ev.filter(e => e.type === 'item.completed' || e.type === 'item.started').map(e => e.item);
  const tools = items.filter(i => i && !['agent_message', 'reasoning'].includes(i.type));
  if (tools.length) throw new Error('codex: użycie narzędzi ' + tools.map(i => i.type).join(', '));
  const done = ev.find(e => e.type === 'turn.completed'), failure = ev.find(e => e.type === 'turn.failed' || e.type === 'error');
  const base = { model: null, proof: { toolItems: 0 }, usage: done?.usage ?? null };
  const msg = JSON.stringify(failure ?? '') + run.stderr;
  if ((failure || !done) && LIMIT_RE.test(msg)) return { ...base, outcome: 'limit', error: msg.slice(0, 300) };
  if (run.timedOut) return { ...base, outcome: 'timeout' };
  if (failure || !done) return { ...base, outcome: 'cli_error', error: msg.slice(0, 300) };
  const text = items.filter(i => i?.type === 'agent_message').at(-1)?.text ?? '';
  const output = parseAnswer(text);
  return output ? { ...base, outcome: 'ok', output, text } : { ...base, outcome: 'invalid', text };
}

// gracz: decide(prompt, timeoutMs) → { outcome, output?, text?, model, proof, usage, raw }
export function modelPlayer(kind, { effort = 'medium' } = {}) {
  if (kind === 'codex' && !existsSync(join(CODEX_HOME, 'auth.json'))) throw new Error('codex: brak logowania w ' + CODEX_HOME);
  const exec = kind === 'claude'
    ? (input, t) => runCli(CLAUDE_EXE, claudeArgs(effort), input, { timeoutMs: t })
    : (input, t) => runCli(process.execPath, codexArgs(effort), input, { timeoutMs: t, env: { ...process.env, CODEX_HOME } });
  const read = kind === 'claude' ? readClaude : readCodex;
  return { kind, async decide(prompt, timeoutMs) { const raw = await exec(prompt, timeoutMs); return { ...read(raw), raw }; } };
}
