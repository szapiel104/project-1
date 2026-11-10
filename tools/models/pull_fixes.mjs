#!/usr/bin/env node
/**
 * Poprawki modeli z edytora w podglądzie modeli (tabela model_fixes w Supabase) → src/data/modelFixes.json, skąd gra
 * stosuje je przy wczytaniu modeli (src/render/modelfix.ts). Uruchomienie: node tools/models/pull_fixes.mjs
 * Bez argumentów bierze wszystkie modele; z nazwami (np. armory barracks) tylko te.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://psccakqdinwqloozdsyf.supabase.co';
const KEY = 'sb_publishable_7YlZMQWsSgn7R6k8-1kFpw_uRpFkfhh';
const only = process.argv.slice(2);
const res = await fetch(`${BASE}/rest/v1/model_fixes?select=model,fixes,updated_at`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
if (!res.ok) { console.error(`Baza: ${res.status} ${await res.text()}`); process.exit(1); }
const rows = await res.json();
const file = new URL('../../src/data/modelFixes.json', import.meta.url);
const cur = JSON.parse(readFileSync(file, 'utf8'));
for (const r of rows) {
  if (only.length && !only.includes(r.model)) continue;
  cur[r.model] = r.fixes;
  console.log(`${r.model}: ${r.fixes.length} poprawek (${r.updated_at})`);
}
writeFileSync(file, JSON.stringify(cur, null, 1) + '\n');
