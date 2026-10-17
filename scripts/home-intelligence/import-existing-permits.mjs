#!/usr/bin/env node
/**
 * Import existing DeedScout permit cache files into Home Intelligence V1.
 * Reuses the current permit-search data instead of waiting for new feeds.
 *
 * Usage:
 *   node scripts/home-intelligence/import-existing-permits.mjs
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'data/permits/sources.json');
const ACTIVE_PBC = new Set(['wpb', 'boca-raton', 'jupiter']);

function clean(v) {
  return v == null ? null : String(v).trim() || null;
}

function numeric(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function classifyPermit(p) {
  const text = [p.type, p.subtype, p.description].filter(Boolean).join(' ').toLowerCase();
  const rules = [
    { re: /water\s*heater|w\/h\b|hot\s*water\s*heater/, trade: 'plumbing', system: 'water_heater', action: /replace|change.?out/.test(text) ? 'replacement' : 'installation', confidence: 0.96 },
    { re: /repipe|re-pipe|whole\s*house\s*(pipe|piping)/, trade: 'plumbing', system: 'water_distribution', action: 'repipe', confidence: 0.96 },
    { re: /sewer|sanitary|building\s*drain/, trade: 'plumbing', system: 'sewer', action: /replace|repair/.test(text) ? 'repair_or_replacement' : 'work', confidence: 0.86 },
    { re: /backflow|backflow\s*prevent/, trade: 'plumbing', system: 'backflow', action: /replace/.test(text) ? 'replacement' : 'installation', confidence: 0.93 },
    { re: /water\s*filter|filtration|reverse\s*osmosis|\bro\b/, trade: 'plumbing', system: 'water_filtration', action: /replace/.test(text) ? 'replacement' : 'installation', confidence: 0.88 },
    { re: /roof/, trade: 'roofing', system: 'roof', action: /replace|reroof|re-roof/.test(text) ? 'replacement' : 'work', confidence: 0.86 },
    { re: /hvac|air\s*condition|a\/c\b|heat\s*pump/, trade: 'hvac', system: 'hvac', action: /replace|change.?out/.test(text) ? 'replacement' : 'work', confidence: 0.84 },
  ];
  const hit = rules.find(r => r.re.test(text));
  return hit || { trade: null, system: null, action: null, confidence: null };
}

function mapPermit(p) {
  const c = classifyPermit(p);
  const normalized = {
    permit_number: clean(p.permitNumber),
    parcel_id: clean(p.parcelId),
    property_address: clean(p.address),
    permit_type: clean(p.type),
    permit_subtype: clean(p.subtype),
    work_description: clean(p.description),
    trade: c.trade,
    system: c.system,
    action: c.action,
    classification_method: c.system ? 'rule_v1' : null,
    classification_confidence: c.confidence,
    application_date: clean(p.appliedDate),
    issue_date: clean(p.issuedDate),
    final_date: clean(p.finalDate),
    expiration_date: clean(p.expirationDate),
    status: clean(p.status),
    declared_value: numeric(p.valuation),
    contractor_license: clean(p.contractorLicense),
    contractor_name: clean(p.contractor),
    owner_builder: p.ownerBuilder == null ? null : Boolean(p.ownerBuilder),
  };
  normalized.source_record_hash = crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return normalized;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sources = manifest.sources.filter(s => ACTIVE_PBC.has(s.id) && s.status === 'active');
  const batchSize = 500;
  const summary = [];

  for (const source of sources) {
    const filePath = path.join(ROOT, source.dataFile);
    if (!fs.existsSync(filePath)) {
      summary.push({ source: source.id, status: 'missing-file' });
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
      summary.push({ source: source.id, status: 'empty-file' });
      continue;
    }
    const payload = JSON.parse(raw);
    const permits = Array.isArray(payload) ? payload : (payload.permits || payload.data || []);
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < permits.length; i += batchSize) {
      const rows = permits.slice(i, i + batchSize).map(mapPermit).filter(row => {
        if (!row.permit_number) { rejected++; return false; }
        return true;
      });
      if (!rows.length) continue;
      const { data, error } = await sb.rpc('hi_ingest_permit_batch', {
        p_jurisdiction_name: source.city || source.label,
        p_source_key: `permit_${source.id}`,
        p_rows: rows,
      });
      if (error) throw new Error(`${source.id}: ${error.message}`);
      accepted += Number(data || rows.length);
    }

    summary.push({ source: source.id, permits: permits.length, accepted, rejected });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
