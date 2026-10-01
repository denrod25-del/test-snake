const { requireShopApiKey, json } = require('./_lib/shop-auth');
const { resolveProperty, propertyWater } = require('./_lib/home-intelligence');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
  const auth = await requireShopApiKey(event);
  if (auth.error) return auth.error;

  try {
    const q = event.queryStringParameters || {};
    const property = await resolveProperty({ parcelId: q.parcel_id, address: q.address });
    if (!property) return json(404, { error: { code: 'PROPERTY_NOT_FOUND' } });

    const water = await propertyWater(property);
    const activeViolations = water.violations.filter(v => v.resolved !== true && !v.end_date);
    const pfasResults = water.results.filter(r => /PFAS|PFOA|PFOS|PFHx|PFNA|GenX/i.test(`${r.contaminant_name || ''} ${r.contaminant_code || ''}`));

    return json(200, {
      data: {
        property_id: property.id,
        parcel_id: property.parcel_id,
        utility: water.utility ? {
          name: water.utility.utility_name,
          phone: water.utility.utility_phone,
          pws_id: water.utility.epa_pws_id,
          match_method: 'official_service_polygon',
        } : null,
        public_water_system: water.pws ? {
          pws_id: water.pws.pws_id,
          name: water.pws.name,
          activity_status: water.pws.activity_status,
          system_type: water.pws.system_type,
          population_served: water.pws.population_served,
          primary_source: water.pws.primary_source,
        } : null,
        compliance: {
          active_violations: activeViolations.length,
          violations: water.violations,
        },
        pfas: {
          monitoring_available: pfasResults.length > 0,
          detected: pfasResults.some(r => Number(r.result_value) > 0),
          results: pfasResults,
          note: 'UCMR occurrence data is not by itself an MCL compliance determination.',
        },
        recent_results: water.results.slice(0, 100),
      },
      meta: {
        api_version: 'v1',
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('hi-water-v1', err);
    return json(500, { error: { code: 'INTERNAL_ERROR' } });
  }
};
