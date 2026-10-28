// Mecz modeli (próba 28.10): wywołanie Claude Code i Codexa bez narzędzi, polecenie na stdin, jedna odpowiedź JSON.
// Odcięcie od narzędzi i sposób wywołania przeniesione z sędziego Statków (C:\Projects\Statki\game\mcp\players.js),
// sprawdzonego w meczu 15.10.2026: Claude z pustą listą narzędzi i MCP (dowód w zdarzeniu init), Codex z wyłączonymi
// narzędziami i własnym, nowym na każdy mecz CODEX_HOME (bez globalnego AGENTS.md); każde wywołanie w pustym katalogu.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
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
// rozkaz: jeden obiekt JSON i nic więcej; dozwolony jest tylko blok kodu markdown wokół niego (audyt r3 pkt 2: wcześniej
// sędzia szukał obiektu w tekście i wykonywał też fragment uszkodzonej odpowiedzi)
export function parseAnswer(text) {
  const t = String(text ?? '').trim(), fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(t);
  try { const o = JSON.parse(fence ? fence[1] : t); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

// modele grające domyślnie (zobowiązanie zapisuje je jawnie, sędzia podaje je CLI i unieważnia mecz przy innym modelu)
export const DEFAULT_MODELS = { claude: 'claude-opus-5-5', codex: 'gpt-6.1-sol', stub: 'stub' };
// awaria wywołania (dostawca albo CLI): mecz zostaje unieważniony (OWNER_ACCEPTED 28.10, AUDYT_r3.md); 'invalid' to błąd
// modelu (zła odpowiedź), nie awaria: odpowiedź jest odrzucana, poprzedni rozkaz trwa
export const FAILURES = ['limit', 'timeout', 'cli_error', 'no_proof'];

const CLAUDE_EXE = join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
// (--setting-sources project,local: bez ustawień użytkownika, czyli bez jego wtyczek i haków; katalog roboczy jest pusty)
const claudeArgs = (effort, model) => ['-p', '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
  '--setting-sources', 'project,local', '--model', model, '--output-format', 'stream-json', '--verbose', '--system-prompt', SYSTEM_LINE, '--effort', effort];
function readClaude(run) {
  const ev = jsonLines(run.stdout), init = ev.find(e => e.type === 'system' && e.subtype === 'init'), result = ev.find(e => e.type === 'result');
  const proof = init ? { tools: init.tools, mcp_servers: init.mcp_servers, plugins: init.plugins ?? null, skills: init.skills ?? null } : null;
  if (init && (init.tools?.length || init.mcp_servers?.length)) throw new Error('claude: narzędzia albo MCP niepuste ' + JSON.stringify(proof));
  const base = { model: init?.model ?? null, proof, usage: result?.usage ?? null };
  const text = result?.result ?? '';
  if (LIMIT_RE.test(text) && result?.is_error) return { ...base, outcome: 'limit', error: text.slice(0, 300) };
  if (run.timedOut) return { ...base, outcome: 'timeout' };
  if (!result || result.is_error || run.code !== 0) return { ...base, outcome: 'cli_error', error: (text || run.stderr).slice(0, 300) };
  if (!init) return { ...base, outcome: 'no_proof', error: 'brak zdarzenia init (dowodu izolacji i modelu)' };
  const output = parseAnswer(text);
  return output ? { ...base, outcome: 'ok', output, text } : { ...base, outcome: 'invalid', text };
}

const CODEX_JS = join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
// logowanie Codexa (z sędziego Statków); mecz gra na NOWYM katalogu CODEX_HOME, do którego kopiujemy tylko auth.json
export const CODEX_LOGIN = join(process.env.LOCALAPPDATA || tmpdir(), 'Statki', 'codex-home');
export function freshCodexHome(name) {
  const home = join(process.env.LOCALAPPDATA || tmpdir(), 'scribe-mecz-ai', 'codex-home', name);
  if (existsSync(home)) throw new Error('codex: katalog ' + home + ' już istnieje (każdy mecz dostaje nowy)');
  mkdirSync(home, { recursive: true });
  copyFileSync(join(CODEX_LOGIN, 'auth.json'), join(home, 'auth.json'));
  return home;
}
// (funkcje z narzędziami albo z wpływem na kontekst, które pokazuje `codex features list` w wersji 0.162.1)
const CODEX_DISABLED = ['shell_tool', 'unified_exec', 'apps', 'plugins', 'multi_agent', 'view_image', 'browser_use', 'browser_use_external', 'computer_use',
  'goals', 'image_generation', 'hooks', 'memories', 'sleep_tool', 'skill_search', 'tool_suggest', 'code_mode_host', 'in_app_browser',
  'workspace_dependencies', 'skill_mcp_dependency_install'];
const codexArgs = (effort, model, instructions) => [CODEX_JS, 'exec', '--ignore-user-config', '--skip-git-repo-check', '-s', 'read-only', '--json', '-m', model,
  ...CODEX_DISABLED.flatMap(x => ['--disable', x]), '-c', 'web_search="disabled"', '-c', 'agents.enabled=false',
  '-c', 'project_doc_max_bytes=0', '-c', `model_instructions_file='${instructions.split('\\').join('/')}'`, '-c', `model_reasoning_effort="${effort}"`, '-'];
function readCodex(run) {
  const ev = jsonLines(run.stdout);
  const items = ev.filter(e => e.type === 'item.completed' || e.type === 'item.started').map(e => e.item);
  const tools = items.filter(i => i && !['agent_message', 'reasoning'].includes(i.type));
  if (tools.length) throw new Error('codex: użycie narzędzi ' + tools.map(i => i.type).join(', '));
  // (zdarzenie error bez turn.failed bywa ponowieniem połączenia: o awarii decyduje brak zakończonej tury)
  const done = ev.find(e => e.type === 'turn.completed'), failed = ev.find(e => e.type === 'turn.failed'), errors = ev.filter(e => e.type === 'error');
  const base = { model: run.session?.model ?? null, proof: { toolItems: 0, errors: errors.length, session: run.session ?? null }, usage: done?.usage ?? null };
  const msg = JSON.stringify(failed ?? errors.at(-1) ?? '') + run.stderr;
  if ((failed || !done) && LIMIT_RE.test(msg)) return { ...base, outcome: 'limit', error: msg.slice(0, 300) };
  if (run.timedOut) return { ...base, outcome: 'timeout' };
  if (failed || !done || run.code !== 0) return { ...base, outcome: 'cli_error', error: msg.slice(0, 300) };
  if (!run.session?.model) return { ...base, outcome: 'no_proof', error: 'brak zapisu sesji z modelem' };
  const text = ev.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text ?? '';
  const output = parseAnswer(text);
  return output ? { ...base, outcome: 'ok', output, text } : { ...base, outcome: 'invalid', text };
}

// dowód modelu z zapisu sesji Codexa (wyjście --json go nie podaje): plik sesji tego wątku, session_meta o tym samym id
// i turn_context; trafia do surowego wyjścia, więc sprawdzenie po meczu czyta go z zapisu
function codexSession(stdout, home) {
  const id = jsonLines(stdout).find(e => e.type === 'thread.started')?.thread_id;
  if (!id) return null;
  try {
    const dir = join(home, 'sessions'), files = readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith(`${id}.jsonl`));
    if (files.length !== 1) return null;
    const lines = jsonLines(readFileSync(join(dir, files[0]), 'utf8'));
    const meta = lines.find(l => l.type === 'session_meta' && l.payload?.id === id)?.payload, tc = lines.find(l => l.type === 'turn_context')?.payload;
    if (!meta || !tc?.model) return null;
    // (kontekst, który CLI dodało poza poleceniem: rola, długość i początek każdej wiadomości)
    const context = lines.filter(l => l.type === 'response_item' && l.payload?.type === 'message' && l.payload.role !== 'assistant')
      .map(l => ({ role: l.payload.role, chars: l.payload.content.reduce((a, c) => a + (c.text?.length ?? 0), 0), start: l.payload.content[0]?.text?.slice(0, 40) ?? '' }));
    return { id, cli: meta.cli_version ?? null, model: tc.model, effort: tc.effort ?? tc.reasoning_effort ?? null, sandbox: tc.sandbox_policy?.type ?? null, context };
  } catch { return null; }
}
// odczyt surowego wyjścia CLI: ten sam dla gry i dla sprawdzenia po meczu (sprawdzenie czyta zapisane wyjście)
export const readers = { claude: readClaude, codex: readCodex };

// gracz: decide(prompt, timeoutMs) → { outcome, output?, text?, model, proof, usage, raw }
export function modelPlayer(kind, { effort = 'medium', model = DEFAULT_MODELS[kind], home = null } = {}) {
  if (kind === 'codex' && !existsSync(join(home ?? '', 'auth.json'))) throw new Error('codex: brak logowania w ' + home);
  const exec = kind === 'claude'
    ? (input, t) => runCli(CLAUDE_EXE, claudeArgs(effort, model), input, { timeoutMs: t })
    : async (input, t) => {
      const dir = mkdtempSync(join(tmpdir(), 'mecz-ai-instr-')), f = join(dir, 'instructions.txt');
      writeFileSync(f, SYSTEM_LINE);
      try {
        const raw = await runCli(process.execPath, codexArgs(effort, model, f), input, { timeoutMs: t, env: { ...process.env, CODEX_HOME: home } });
        return { ...raw, session: codexSession(raw.stdout, home) };
      } finally { rmSync(dir, { recursive: true, force: true }); }
    };
  return {
    kind,
    async decide(prompt, timeoutMs) {
      const raw = await exec(prompt, timeoutMs);
      return { ...readers[kind](raw), raw };
    },
  };
}
// wersje CLI (do zobowiązania przed meczem)
export async function cliVersions() {
  const v = async (exe, args, env) => (await runCli(exe, args, '', { timeoutMs: 30000, env })).stdout.trim();
  return { claude: await v(CLAUDE_EXE, ['--version']), codex: await v(process.execPath, [CODEX_JS, '--version'], { ...process.env, CODEX_HOME: CODEX_LOGIN }) };
}
