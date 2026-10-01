import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDelimitedLine,
  rowObject,
  mapSdwaPws,
  mapSdwaViolation,
  mapUcmr5,
} from '../../scripts/home-intelligence/import-epa.mjs';

describe('Home Intelligence EPA import mapping', () => {
  it('parses quoted CSV fields', () => {
    const values = parseDelimitedLine('FL1234567,"CITY OF TEST, FL",A', ',');
    assert.deepEqual(values, ['FL1234567', 'CITY OF TEST, FL', 'A']);
  });

  it('maps SDWA public water system snapshots', () => {
    const row = rowObject(
      ['SUBMISSIONYEARQUARTER','PWSID','PWS_NAME','PWS_ACTIVITY_CODE','PWS_TYPE_CODE','POPULATION_SERVED_COUNT','PRIMARY_SOURCE_CODE','OWNER_TYPE_CODE','PRIMACY_AGENCY_CODE'],
      ['2026Q3','FL1234567','TEST WATER','A','CWS','10000','GW','L','FL'],
    );
    const mapped = mapSdwaPws(row);
    assert.equal(mapped.pws_id, 'FL1234567');
    assert.equal(mapped.source_snapshot, '2026Q3');
    assert.equal(mapped.primary_source, 'GW');
    assert.equal(mapped.population_served, '10000');
  });

  it('marks a violation resolved when EPA has an RTC date', () => {
    const mapped = mapSdwaViolation({
      SUBMISSIONYEARQUARTER: '2026Q3',
      PWSID: 'FL1234567',
      VIOLATION_ID: 'V-1',
      VIOLATION_CODE: 'MCL',
      CONTAMINANT_CODE: '1005',
      NON_COMPL_PER_BEGIN_DATE: '01/15/2026',
      NON_COMPL_PER_END_DATE: '02/15/2026',
      CALCULATED_RTC_DATE: '03/01/2026',
    });
    assert.equal(mapped.begin_date, '2026-01-15');
    assert.equal(mapped.resolved, true);
  });

  it('maps UCMR occurrence data without calling it a violation', () => {
    const mapped = mapUcmr5({
      PWSID: 'FL1234567',
      Contaminant: 'PFOA',
      CollectionDate: '06/01/2025',
      AnalyticalResultSign: '=',
      AnalyticalResultValue: '2.1',
      AnalyticalResultUnit: 'ng/L',
      SamplingPointID: 'EP001',
      MRL: '4.0',
    });
    assert.equal(mapped.contaminant_name, 'PFOA');
    assert.equal(mapped.result_value, '2.1');
    assert.equal(mapped.sample_date, '2025-06-01');
    assert.ok(mapped.source_record_id.length >= 32);
    assert.equal(Object.hasOwn(mapped, 'violation'), false);
  });
});
