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
  const { data: matches, error: utilityError } = await client
    .rpc('hi_resolve_water_utility', { p_property_id: property.id });
  if (utilityError) throw utilityError;

  const utility = matches?.[0] || null;
  const pwsId = utility?.epa_pws_id || null;
  let pws = null;
  let violations = [];
  let results = [];

  if (pwsId) {
    const [pwsQuery, violationQuery, resultQuery] = await Promise.all([
      client.from('hi_public_water_systems').select('*').eq('pws_id', pwsId).maybeSingle(),
      client.from('hi_water_violations').select('*').eq('pws_id', pwsId).order('begin_date', { ascending: false }).limit(100),
      client.from('hi_water_results').select('*').eq('pws_id', pwsId).order('sample_date', { ascending: false }).limit(250),
    ]);
    if (pwsQuery.error) throw pwsQuery.error;
    if (violationQuery.error) throw violationQuery.error;
    if (resultQuery.error) throw resultQuery.error;
    pws = pwsQuery.data || null;
    violations = violationQuery.data || [];
    results = resultQuery.data || [];
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
