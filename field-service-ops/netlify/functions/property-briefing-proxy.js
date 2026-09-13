const { json, requireUser, requireShopMember, parseBody, cleanEnv } = require('./_lib/config');
const { decryptSpiKey } = require('./_lib/spi-crypto');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const body = parseBody(event);
    const { shopId, jobId, address } = body;
    if (!shopId || !jobId) return json(400, { error: 'missing_fields' });

    // Auth before any work (including unavailable briefing responses)
    const token = require('./_lib/config').getBearer(event);
    if (!token) return json(401, { error: 'unauthorized' });

    const { user, admin } = await requireUser(event);
    await requireShopMember(admin, user.id, shopId);

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select('id, shop_id, address')
      .eq('id', jobId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (jobErr || !job) return json(404, { error: 'job_not_found' });

    const { data: secretRow } = await admin
      .from('shop_spi_secrets')
      .select('ciphertext')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (!secretRow?.ciphertext) {
      return json(200, {
        groups: {
          parcel: { status: 'unavailable', message: 'SPI key not configured for this shop' },
          permits: { status: 'unavailable' },
          waterSewer: { status: 'coming_soon' },
        },
      });
    }

    let spiKey;
    try {
      spiKey = decryptSpiKey(secretRow.ciphertext);
    } catch {
      return json(500, { error: 'spi_decrypt_failed' });
    }

    const addr = address || job.address;
    const base = cleanEnv('SPI_BASE_URL') || 'https://deedscout.app';
    const url = `${base.replace(/\/$/, '')}/api/property?address=${encodeURIComponent(addr)}`;
    const res = await fetch(url, {
      headers: {
        'X-Api-Key': spiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return json(200, {
        groups: {
          parcel: { status: 'unavailable', message: `SPI upstream ${res.status}` },
          permits: { status: 'unavailable' },
          waterSewer: { status: 'coming_soon' },
        },
      });
    }

    const briefing = await res.json();
    return json(200, briefing);
  } catch (e) {
    const status = e.statusCode || 500;
    if (status === 401 || status === 403) {
      return json(status, { error: e.message });
    }
    return json(200, {
      groups: {
        parcel: { status: 'unavailable', message: e.message || 'Briefing unavailable' },
        permits: { status: 'unavailable' },
        waterSewer: { status: 'coming_soon' },
      },
    });
  }
};
