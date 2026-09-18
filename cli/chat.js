#!/usr/bin/env node
/**
 * AG ⚡ FVD — OLLAMA CHAT CLI
 * Zero-dependency Node CLI for Ollama.
 *
 *   node cli/chat.js "your message"        one-shot
 *   node cli/chat.js                       interactive REPL
 *   node cli/chat.js --model qwen2.5:7b --url http://192.168.1.108:11434
 *
 * Alliance Gagnante — Francis Végiard Dev
 */
'use strict';

const readline = require('node:readline');

const args = process.argv.slice(2);
let model = null;
let baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) model = args[++i];
  else if (args[i] === '--url' && args[i + 1]) baseUrl = args[++i].replace(/\/+$/, '');
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node cli/chat.js [--model <name>] [--url <ollama base>] ["message"]');
    process.exit(0);
  } else positional.push(args[i]);
}

const PINK = '\x1b[38;5;198m';
const LIME = '\x1b[38;5;154m';
const YELLOW = '\x1b[38;5;226m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function pickModel() {
  if (model) return model;
  try {
    const r = await fetch(`${baseUrl}/api/tags`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    const names = (data.models || []).map(m => m.name).filter(Boolean);
    if (!names.length) die('No models installed. Run: ollama pull qwen2.5:7b');
    model = names[0];
    console.error(`${DIM}using model: ${model}${RESET}`);
    return model;
  } catch {
    die(`Ollama offline at ${baseUrl} — run \`ollama serve\``);
  }
}

function die(msg) {
  console.error(`${PINK}💥 ${msg}${RESET}`);
  process.exit(1);
}

async function streamChat(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let res;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`ollama status ${res.status}`);
  } catch {
    clearTimeout(timer);
    die(`Ollama offline at ${baseUrl} — run \`ollama serve\``);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let acc = '';
  process.stdout.write(`${LIME}🦙 ${RESET}`);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message && obj.message.content) {
            process.stdout.write(obj.message.content);
            acc += obj.message.content;
          }
          if (obj.error) throw new Error(obj.error);
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
    }
  } catch (e) {
    process.stdout.write('\n');
    die(e.message);
  } finally {
    clearTimeout(timer);
  }
  process.stdout.write('\n\n');
  return acc;
}

async function main() {
  await pickModel();

  if (positional.length) {
    // one-shot
    await streamChat([{ role: 'user', content: positional.join(' ') }]);
    return;
  }

  // REPL
  console.log(`${YELLOW}⚡ AG x FVD — OLLAMA CHAT CLI ⚡${RESET}`);
  console.log(`${DIM}model: ${model} — server: ${baseUrl}${RESET}`);
  console.log(`${DIM}type a message, Enter to send. "exit" or Ctrl+C to quit.${RESET}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${PINK}☠ you > ${RESET}`,
  });
  const messages = [];
  rl.prompt();

  let busy = false;
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text || busy) { rl.prompt(); return; }
    if (text === 'exit' || text === 'quit') { rl.close(); return; }
    busy = true;
    rl.pause();
    messages.push({ role: 'user', content: text });
    const reply = await streamChat(messages);
    if (reply) messages.push({ role: 'assistant', content: reply });
    busy = false;
    rl.resume();
    rl.prompt();
  });
  rl.on('close', () => {
    console.log(`${DIM}à+ 🤘${RESET}`);
    process.exit(0);
  });
}

main().catch(e => die(e.message));
