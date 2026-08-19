const { createSupabaseAdminClient } = require('./config');

function sb() {
  return createSupabaseAdminClient();
}

function normalizeAddress(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bTRAIL\b/g, 'TRL')
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ');
}

async function resolveProperty({ parcelId, address }) {
  const client = sb();

  if (parcelId) {
    const cleaned = String(parcelId).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const { data, error } = await client
      .from('hi_properties')
      .select('*')
      .eq('parcel_id', cleaned)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (address) {
    const normalized = normalizeAddress(address);
    const { data, error } = await client
      .from('hi_properties')
      .select('*')
      .eq('site_address_normalized', normalized)
      .limit(2);
    if (error) throw error;
    if (data?.length === 1) return data[0];
    if (data?.length > 1) {
      const err = new Error('AMBIGUOUS_PROPERTY');
      err.code = 'AMBIGUOUS_PROPERTY';
      throw err;
    }
  }

  return null;
}

async function propertyWater(property) {
  const client = sb();
  let utility = null;

  if (property?.centroid) {
    // Supabase/PostgREST cannot express the PostGIS spatial join cleanly here,
    // so V1 expects ingestion to materialize utility_id in metadata or a later RPC.
    // Fallback below joins using municipality only when an exact PWS mapping exists.
  }

  const utilityName = property?.water_utility_name || null;
  if (utilityName) {
    const { data } = await client
      .from('hi_utilities')
      .select('*')
      .eq('name', utilityName)
      .maybeSingle();
    utility = data || null;
  }

  const pwsId = utility?.epa_pws_id || null;
  let pws = null;
  let violations = [];
  let results = [];

  if (pwsId) {
    const [{ data: pwsData }, { data: v }, { data: r }] = await Promise.all([
      client.from('hi_public_water_systems').select('*').eq('pws_id', pwsId).maybeSingle(),
      client.from('hi_water_violations').select('*').eq('pws_id', pwsId).order('begin_date', { ascending: false }).limit(100),
      client.from('hi_water_results').select('*').eq('pws_id', pwsId).order('sample_date', { ascending: false }).limit(250),
    ]);
    pws = pwsData || null;
    violations = v || [];
    results = r || [];
  }

  return { utility, pws, violations, results };
}

function classifyScore(score) {
  if (score >= 85) return 'VERY_HIGH';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'ELEVATED';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

module.exports = {
  sb,
  normalizeAddress,
  resolveProperty,
  propertyWater,
  classifyScore,
};
