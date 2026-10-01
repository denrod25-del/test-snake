#!/usr/bin/env node
/**
 * Streaming EPA importer for Home Intelligence V1.
 *
 * Inputs are EXTRACTED files from official EPA ZIP downloads.
 * This intentionally does not unzip inside a Netlify request.
 *
 * Usage examples:
 *   node scripts/home-intelligence/import-epa.mjs sdwa-pws ./SDWA_PUB_WATER_SYSTEMS.csv
 *   node scripts/home-intelligence/import-epa.mjs sdwa-violations ./SDWA_VIOLATIONS_ENFORCEMENT.csv
 *   node scripts/home-intelligence/import-epa.mjs ucmr5 ./UCMR5_All.txt
 *
 * Required env:
 *   SUPABASE_URL=https://wmkbksqztpofxoqbyrdd.supabase.co
 *   SUPABASE_SERVICE_KEY=<server-side service key>
 *
 * Optional:
 *   HI_IMPORT_BATCH_SIZE=500
 */

import fs from 'node:fs';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function parseDelimitedLine(line, delimiter = ',') {
  // CSV parser with RFC4180-style quoted field support. UCMR text uses tabs.
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

export function rowObject(headers, values) {
  return Object.fromEntries(headers.map((h, i) => [String(h || '').trim(), values[i] ?? '']));
}

function pick(row, ...names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] !== '') return row[name];
  }
  return '';
}

function mmddyyyyToIso(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function numericText(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : '';
}

export function mapSdwaPws(row) {
  return {
    pws_id: pick(row, 'PWSID'),
    source_snapshot: pick(row, 'SUBMISSIONYEARQUARTER'),
    pws_name: pick(row, 'PWS_NAME'),
    activity_status: pick(row, 'PWS_ACTIVITY_CODE'),
    system_type: pick(row, 'PWS_TYPE_CODE'),
    population_served: numericText(pick(row, 'POPULATION_SERVED_COUNT')),
    primary_source: pick(row, 'PRIMARY_SOURCE_CODE'),
    owner_type: pick(row, 'OWNER_TYPE_CODE'),
    primacy_agency: pick(row, 'PRIMACY_AGENCY_CODE'),
    source_record_id: `${pick(row, 'SUBMISSIONYEARQUARTER')}:${pick(row, 'PWSID')}`,
  };
}

export function mapSdwaViolation(row) {
  const rtc = mmddyyyyToIso(pick(row, 'CALCULATED_RTC_DATE'));
  return {
    pws_id: pick(row, 'PWSID'),
    source_snapshot: pick(row, 'SUBMISSIONYEARQUARTER'),
    violation_id: pick(row, 'VIOLATION_ID'),
    violation_code: pick(row, 'VIOLATION_CODE'),
    contaminant_code: pick(row, 'CONTAMINANT_CODE'),
    begin_date: mmddyyyyToIso(pick(row, 'NON_COMPL_PER_BEGIN_DATE')),
    end_date: mmddyyyyToIso(pick(row, 'NON_COMPL_PER_END_DATE')),
    resolved: Boolean(rtc || pick(row, 'ENF_ACTION_CATEGORY') === 'Resolving'),
  };
}

export function mapUcmr5(row) {
  const pwsId = pick(row, 'PWSID', 'PWS ID');
  const contaminantName = pick(row, 'Contaminant', 'ContaminantName', 'Contaminant Name');
  const sampleDate = pick(row, 'CollectionDate', 'SampleDate', 'Sample Collection Date');
  const result = pick(row, 'AnalyticalResultSign', 'Analytical Result Sign');
  const value = pick(row, 'AnalyticalResultValue', 'Analytical Result Value');
  const unit = pick(row, 'AnalyticalResultUnit', 'Analytical Result Unit');
  const location = pick(row, 'SamplingPointID', 'Sampling Point ID', 'SamplePointID');
  const method = pick(row, 'MethodID', 'Method ID');
  const hash = crypto.createHash('sha256').update([pwsId, location, contaminantName, sampleDate, result, value, unit, method].join('|')).digest('hex');
  return {
    pws_id: pwsId,
    sample_location_id: location,
    contaminant_code: pick(row, 'ContaminantCode', 'Contaminant Code'),
    contaminant_name: contaminantName,
    sample_date: mmddyyyyToIso(sampleDate),
    result_value: numericText(value),
    result_operator: result,
    unit,
    detection_limit: numericText(pick(row, 'MRL', 'MinimumReportingLevel', 'Minimum Reporting Level')),
    source_record_id: hash,
  };
}

function clientFromEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function importFile(kind, filePath) {
  const configs = {
    'sdwa-pws': { delimiter: ',', map: mapSdwaPws, rpc: 'hi_ingest_sdwa_pws_batch' },
    'sdwa-violations': { delimiter: ',', map: mapSdwaViolation, rpc: 'hi_ingest_sdwa_violation_batch' },
    'ucmr5': { delimiter: '\t', map: mapUcmr5, rpc: 'hi_ingest_ucmr5_batch' },
  };
  const config = configs[kind];
  if (!config) throw new Error(`Unknown import kind: ${kind}`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const sb = clientFromEnv();
  const batchSize = Math.max(10, Math.min(Number(process.env.HI_IMPORT_BATCH_SIZE || 500), 2000));
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let headers = null;
  let batch = [];
  let read = 0;
  let accepted = 0;
  let rejected = 0;

  async function flush() {
    if (!batch.length) return;
    const { data, error } = await sb.rpc(config.rpc, { p_rows: batch });
    if (error) throw error;
    accepted += Number(data || batch.length);
    batch = [];
  }

  for await (const line of rl) {
    if (!headers) {
      headers = parseDelimitedLine(line.replace(/^\uFEFF/, ''), config.delimiter).map(v => v.trim());
      continue;
    }
    if (!line.trim()) continue;
    read++;
    const row = rowObject(headers, parseDelimitedLine(line, config.delimiter));

    // Filter SDWA and UCMR to Florida. PWS IDs are state-prefixed; UCMR also
    // commonly includes a State field. Keep only Florida for V1.
    const pwsId = pick(row, 'PWSID', 'PWS ID');
    const state = pick(row, 'State', 'STATE', 'PRIMACY_AGENCY_CODE');
    if (!(String(pwsId).startsWith('FL') || state === 'FL')) continue;

    const mapped = config.map(row);
    if (!mapped.pws_id || (kind === 'sdwa-pws' && !mapped.source_snapshot) || (kind === 'ucmr5' && !mapped.contaminant_name)) {
      rejected++;
      continue;
    }
    batch.push(mapped);
    if (batch.length >= batchSize) await flush();
  }
  await flush();

  console.log(JSON.stringify({ kind, filePath, read, accepted, rejected }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , kind, filePath] = process.argv;
  if (!kind || !filePath) {
    console.error('Usage: node scripts/home-intelligence/import-epa.mjs <sdwa-pws|sdwa-violations|ucmr5> <file>');
    process.exit(2);
  }
  importFile(kind, filePath).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
