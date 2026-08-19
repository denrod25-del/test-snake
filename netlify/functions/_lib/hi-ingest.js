const crypto = require('crypto');
const { createSupabaseAdminClient } = require('./config');

const PBC_PARCELS_URL = 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/Parcels/labels/MapServer/0/query';
const PBC_WATER_URL = 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/Ags/5/MapServer/8/query';

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function normalizeAddress(value) {
  return String(value || '').trim().toUpperCase()
    .replace(/\bNORTH\b/g, 'N').replace(/\bSOUTH\b/g, 'S').replace(/\bEAST\b/g, 'E').replace(/\bWEST\b/g, 'W')
    .replace(/\bSTREET\b/g, 'ST').replace(/\bAVENUE\b/g, 'AVE').replace(/\bROAD\b/g, 'RD').replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bTRAIL\b/g, 'TRL').replace(/\bBOULEVARD\b/g, 'BLVD').replace(/[.,#]/g, ' ').replace(/\s+/g, ' ');
}

function asDate(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function numberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function attr(feature, alias, fullName) {
  const a = feature?.properties || feature?.attributes || {};
  return a[fullName] ?? a[alias] ?? null;
}

async function fetchGeoJson(url, params) {
  const qs = new URLSearchParams({ ...params, f: 'geojson' });
  const resp = await fetch(`${url}?${qs.toString()}`, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!resp.ok) throw new Error(`ArcGIS ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const body = await resp.json();
  if (!body || !Array.isArray(body.features)) throw new Error('ArcGIS response missing features');
  return body;
}

async function startRun(sb, sourceKey, sourceUrl, version = null) {
  const { data, error } = await sb.from('hi_ingestion_runs').insert({ source_key: sourceKey, source_url: sourceUrl, dataset_version: version, status: 'running' }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function finishRun(sb, runId, stats, errorMessage = null) {
  await sb.from('hi_ingestion_runs').update({
    completed_at: new Date().toISOString(), records_read: stats.read || 0,
    records_inserted: stats.inserted || 0, records_updated: stats.updated || 0,
    records_rejected: stats.rejected || 0, status: errorMessage ? 'failed' : 'completed', error: errorMessage,
  }).eq('id', runId);
}

async function saveRawBatch(sb, sourceKey, dataset, features, idFn) {
  if (!features.length) return;
  const now = new Date().toISOString();
  const rows = features.map((feature) => ({
    source_key: sourceKey,
    dataset,
    source_record_id: String(idFn(feature)),
    retrieved_at: now,
    payload: feature,
    content_hash: hash(feature),
  }));
  const { error } = await sb.from('hi_raw_records').upsert(rows, {
    onConflict: 'source_key,dataset,source_record_id,content_hash', ignoreDuplicates: true,
  });
  if (error) throw error;
}

async function ingestParcelBatch({ offset = 0, pageSize = 250 } = {}) {
  const sb = createSupabaseAdminClient();
  const runId = await startRun(sb, 'pbc_parcels', PBC_PARCELS_URL, `offset:${offset}`);
  const stats = { read: 0, inserted: 0, updated: 0, rejected: 0 };

  try {
    const fields = [
      'PAO.PARCELS.OBJECTID','PAO.PARCELS.PARID','PAO.PARCELS.ACRES',
      'PAO.PROPINFO_PUB.STREET_NUMBER','PAO.PROPINFO_PUB.STREET_NAME','PAO.PROPINFO_PUB.STREET_SUFFIX_ABBR',
      'PAO.PROPINFO_PUB.SITE_ADDR_STR','PAO.PROPINFO_PUB.MUNICIPALITY','PAO.PROPINFO_PUB.CITYNAME','PAO.PROPINFO_PUB.ZIP1',
      'PAO.PROPINFO_PUB.PROPERTY_USE','PAO.PROPINFO_PUB.SALE_DATE','PAO.PROPINFO_PUB.PRICE',
      'PAO.PROPINFO_PUB.TOTAL_MARKET','PAO.PROPINFO_PUB.ASSESSED_VAL','PAO.PROPINFO_PUB.TOTAL_TAXABLE'
    ].join(',');

    const body = await fetchGeoJson(PBC_PARCELS_URL, {
      where: '1=1', outFields: fields, returnGeometry: 'true', outSR: '4326',
      orderByFields: 'PAO.PARCELS.OBJECTID ASC', resultOffset: String(offset), resultRecordCount: String(Math.min(pageSize, 1000)),
    });

    stats.read = body.features.length;
    const valid = body.features.filter((f) => attr(f, 'PARID', 'PAO.PARCELS.PARID') && attr(f, 'OBJECTID', 'PAO.PARCELS.OBJECTID') != null);
    stats.rejected = body.features.length - valid.length;

    await saveRawBatch(sb, 'pbc_parcels', 'parcel_labels', valid, (f) => attr(f, 'OBJECTID', 'PAO.PARCELS.OBJECTID'));

    const rows = valid.map((feature) => {
      const siteAddress = attr(feature, 'SITE_ADDR_STR', 'PAO.PROPINFO_PUB.SITE_ADDR_STR');
      return {
        parcel_id: String(attr(feature, 'PARID', 'PAO.PARCELS.PARID')).replace(/[^0-9A-Za-z]/g, '').toUpperCase(),
        site_address: siteAddress,
        site_address_normalized: normalizeAddress(siteAddress),
        street_number: attr(feature, 'STREET_NUMBER', 'PAO.PROPINFO_PUB.STREET_NUMBER')?.toString() || null,
        street_name: attr(feature, 'STREET_NAME', 'PAO.PROPINFO_PUB.STREET_NAME'),
        street_suffix: attr(feature, 'STREET_SUFFIX_ABBR', 'PAO.PROPINFO_PUB.STREET_SUFFIX_ABBR'),
        city: attr(feature, 'CITYNAME', 'PAO.PROPINFO_PUB.CITYNAME'),
        municipality: attr(feature, 'MUNICIPALITY', 'PAO.PROPINFO_PUB.MUNICIPALITY'),
        postal_code: attr(feature, 'ZIP1', 'PAO.PROPINFO_PUB.ZIP1'),
        property_use_description: attr(feature, 'PROPERTY_USE', 'PAO.PROPINFO_PUB.PROPERTY_USE'),
        acres: numberOrNull(attr(feature, 'ACRES', 'PAO.PARCELS.ACRES')),
        market_value: numberOrNull(attr(feature, 'TOTAL_MARKET', 'PAO.PROPINFO_PUB.TOTAL_MARKET')),
        assessed_value: numberOrNull(attr(feature, 'ASSESSED_VAL', 'PAO.PROPINFO_PUB.ASSESSED_VAL')),
        taxable_value: numberOrNull(attr(feature, 'TOTAL_TAXABLE', 'PAO.PROPINFO_PUB.TOTAL_TAXABLE')),
        last_sale_date: asDate(attr(feature, 'SALE_DATE', 'PAO.PROPINFO_PUB.SALE_DATE')),
        last_sale_price: numberOrNull(attr(feature, 'PRICE', 'PAO.PROPINFO_PUB.PRICE')),
        geometry: feature.geometry,
        source_record_id: String(attr(feature, 'OBJECTID', 'PAO.PARCELS.OBJECTID')),
      };
    });

    if (rows.length) {
      const { data, error } = await sb.rpc('hi_upsert_properties_batch', { p_rows: rows });
      if (error) throw error;
      stats.updated = Number(data || rows.length);
    }

    const nextOffset = offset + body.features.length;
    const completed = body.features.length < Math.min(pageSize, 1000);
    await sb.from('hi_ingestion_cursors').upsert({
      source_key: 'pbc_parcels', cursor_value: nextOffset, completed,
      last_run_at: new Date().toISOString(), metadata: { page_size: pageSize },
    }, { onConflict: 'source_key' });

    await finishRun(sb, runId, stats);
    return { ...stats, offset, nextOffset, completed };
  } catch (err) {
    await finishRun(sb, runId, stats, String(err?.message || err));
    throw err;
  }
}

async function ingestWaterServiceAreas() {
  const sb = createSupabaseAdminClient();
  const runId = await startRun(sb, 'pbc_water_service_areas', PBC_WATER_URL);
  const stats = { read: 0, inserted: 0, updated: 0, rejected: 0 };
  try {
    const body = await fetchGeoJson(PBC_WATER_URL, {
      where: '1=1', outFields: 'OBJECTID,UTILITY_NAME,UTILITY_AREA,UTILITY_PHONE',
      returnGeometry: 'true', outSR: '4326', orderByFields: 'OBJECTID ASC', resultRecordCount: '1000',
    });
    stats.read = body.features.length;
    const valid = body.features.filter((f) => attr(f, 'OBJECTID', 'OBJECTID') != null && attr(f, 'UTILITY_NAME', 'UTILITY_NAME'));
    stats.rejected = body.features.length - valid.length;

    await saveRawBatch(sb, 'pbc_water_service_areas', 'water_service_areas', valid, (f) => attr(f, 'OBJECTID', 'OBJECTID'));
    const rows = valid.map((feature) => ({
      name: attr(feature, 'UTILITY_NAME', 'UTILITY_NAME'),
      phone: attr(feature, 'UTILITY_PHONE', 'UTILITY_PHONE'),
      source_record_id: String(attr(feature, 'OBJECTID', 'OBJECTID')),
      geometry: feature.geometry,
    }));

    if (rows.length) {
      const { data, error } = await sb.rpc('hi_replace_utility_service_areas_batch', { p_rows: rows });
      if (error) throw error;
      stats.updated = Number(data || rows.length);
    }

    await sb.from('hi_ingestion_cursors').upsert({
      source_key: 'pbc_water_service_areas', cursor_value: body.features.length, completed: true,
      last_run_at: new Date().toISOString(), metadata: { feature_count: body.features.length },
    }, { onConflict: 'source_key' });

    await finishRun(sb, runId, stats);
    return { ...stats, completed: true };
  } catch (err) {
    await finishRun(sb, runId, stats, String(err?.message || err));
    throw err;
  }
}

module.exports = { PBC_PARCELS_URL, PBC_WATER_URL, ingestParcelBatch, ingestWaterServiceAreas, normalizeAddress };
