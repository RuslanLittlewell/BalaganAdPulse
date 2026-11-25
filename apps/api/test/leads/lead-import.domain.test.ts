import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/shared/domain/index.js';
import {
  importKeyOf,
  matchCampaign,
  matchColumn,
  normalizedRow,
  parseCsv,
  planImport,
  sheetExportUrl,
  submittedAtOf,
  tableOf,
  type CampaignCatalog,
  type ImportRow,
} from '../../src/modules/leads/domain/lead-import.js';

const NOW = new Date('2026-11-25T12:00:00.000Z');

function row(fields: Partial<ImportRow>): ImportRow {
  return normalizedRow({
    name: null, phone: null, email: null, submittedAt: null, campaign: null, status: null,
    utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
    pageUrl: null, referrer: null, answers: [], ...fields,
  });
}

const catalog: CampaignCatalog = {
  campaigns: [
    { id: 'c-ct', name: 'US | CT | Leads', externalId: '120251441942930251' },
    { id: 'c-oh', name: 'US | OH | Leads', externalId: '120251860075170251' },
    { id: 'c-twin-1', name: 'Twin', externalId: null },
    { id: 'c-twin-2', name: 'twin ', externalId: null },
  ],
  adSets: new Map([['120251442209330251', 'c-ct']]),
  ads: new Map([['120251497757350251', { campaignId: 'c-oh', adId: 'ad-denis' }]]),
};

describe('reading CSV', () => {
  it('reads an Excel file with semicolons, quotes, line breaks inside values and a byte order mark', () => {
    const text = '﻿Имя;Телефон;Комментарий\r\n"Иван; старший";+7 900 000-00-00;"Сказал ""перезвонить""\nвечером"\r\n';

    expect(parseCsv(text)).toEqual([
      ['Имя', 'Телефон', 'Комментарий'],
      ['Иван; старший', '+7 900 000-00-00', 'Сказал "перезвонить"\nвечером'],
    ]);
  });

  it('picks the separator that the header row uses outside quotes', () => {
    expect(parseCsv('"a,b"\tc\n1\t2')).toEqual([['a,b', 'c'], ['1', '2']]);
    expect(parseCsv('name,phone\nAnn,1')).toEqual([['name', 'phone'], ['Ann', '1']]);
  });

  it('drops blank rows and pads short rows to the header', () => {
    expect(tableOf('name,phone,email\nAnn,1\n,,\n\nBob,2,b@x.io\n')).toEqual({
      columns: ['name', 'phone', 'email'],
      rows: [['Ann', '1', ''], ['Bob', '2', 'b@x.io']],
    });
  });

  it('refuses an empty table and a table over 5000 rows', () => {
    const reason = (text: string) => {
      try {
        tableOf(text);
        return null;
      } catch (error) {
        return (error as AppError).details;
      }
    };
    expect(reason('name,phone\n')).toEqual([{ code: 'EMPTY' }]);
    expect(reason(`name\n${'Ann\n'.repeat(5001)}`)).toEqual([{ code: 'TOO_MANY_ROWS' }]);
    expect(reason(`name\n${'Ann\n'.repeat(5000)}`)).toBeNull();
  });
});

describe('a Google Sheet link', () => {
  const id = '1IQ75C3r1XUbf9xdW-TEf-h4ieLz-5O250UEZJUXc_J0';

  it('becomes the CSV export address of the tab it points to', () => {
    expect(sheetExportUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=469362598#gid=469362598`))
      .toBe(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=469362598`);
    expect(sheetExportUrl(`https://docs.google.com/spreadsheets/u/1/d/${id}/edit#gid=7`))
      .toBe(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=7`);
    expect(sheetExportUrl(`https://docs.google.com/spreadsheets/d/${id}`))
      .toBe(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`);
  });

  it('is refused for any other address', () => {
    expect(sheetExportUrl('https://evil.example.com/spreadsheets/d/abcdefghijkl/edit')).toBeNull();
    expect(sheetExportUrl(`https://docs.google.com/document/d/${id}/edit`)).toBeNull();
    expect(sheetExportUrl('ftp://docs.google.com/spreadsheets/d/abcdefghijkl')).toBeNull();
    expect(sheetExportUrl('not a link')).toBeNull();
  });
});

describe('a submission date', () => {
  it('reads ISO dates with and without a zone and dotted dates as UTC', () => {
    expect(submittedAtOf('2026-09-22T06:38:09+03:00', NOW)?.toISOString()).toBe('2026-09-22T03:38:09.000Z');
    expect(submittedAtOf('2026-11-20T03:46:21.657Z', NOW)?.toISOString()).toBe('2026-11-20T03:46:21.657Z');
    expect(submittedAtOf('2026-09-22 06:38', NOW)?.toISOString()).toBe('2026-09-22T06:38:00.000Z');
    expect(submittedAtOf('22.09.2026 6:38', NOW)?.toISOString()).toBe('2026-09-22T06:38:00.000Z');
    expect(submittedAtOf('1.10.2026', NOW)?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('reads nothing from an impossible, far past, future or foreign date', () => {
    for (const text of ['31.02.2026', '2026-13-01', '01.01.1999', '01.01.2027', '09/22/2026', 'вчера', '', null]) {
      expect(submittedAtOf(text, NOW), String(text)).toBeNull();
    }
  });
});

describe('finding a campaign', () => {
  it('links a campaign by its ID, an ad set ID or an ad ID inside the value', () => {
    expect(matchCampaign('120251441942930251', catalog)).toEqual({ campaignId: 'c-ct', adId: null });
    expect(matchCampaign('120251442209330251', catalog)).toEqual({ campaignId: 'c-ct', adId: null });
    expect(matchCampaign('ag:120251497757350251', catalog)).toEqual({ campaignId: 'c-oh', adId: 'ad-denis' });
  });

  it('prefers a campaign ID over an ad ID in the same value', () => {
    expect(matchCampaign('ag:120251497757350251 120251441942930251', catalog)).toEqual({ campaignId: 'c-ct', adId: null });
  });

  it('falls back to a single campaign of that name', () => {
    expect(matchCampaign('  us | oh | LEADS ', catalog)).toEqual({ campaignId: 'c-oh', adId: null });
    expect(matchCampaign('Twin', catalog)).toBeNull();
    expect(matchCampaign('120248687922870485', catalog)).toBeNull();
    expect(matchCampaign(null, catalog)).toBeNull();
  });
});

describe('finding a board column', () => {
  const own = [{ id: 'col-measure', name: 'Замер' }, { id: 'col-own-target', name: 'Целевой' }];

  it('names a fixed stage by its key or its Russian or English name', () => {
    expect(matchColumn('Qualified', [])).toBe('QUALIFIED');
    expect(matchColumn(' квалифицированный ', [])).toBe('QUALIFIED');
    expect(matchColumn('Квал. лид', [])).toBe('QUALIFIED');
    expect(matchColumn('КП', [])).toBe('PROPOSAL');
    expect(matchColumn('new', [])).toBe('NEW');
  });

  it('prefers the board’s own column of that name and finds nothing for other text', () => {
    expect(matchColumn('замер', own)).toBe('col-measure');
    expect(matchColumn('Целевой', own)).toBe('col-own-target');
    expect(matchColumn('В работе', own)).toBeNull();
    expect(matchColumn(null, own)).toBeNull();
  });
});

describe('planning an import', () => {
  const plan = (rows: ImportRow[], extra: Partial<Parameters<typeof planImport>[0]> = {}) => planImport({
    projectId: 'p1', rows, catalog, contacts: { emails: new Set(), phones: new Set() }, claimed: new Set(), choices: [], now: NOW, ...extra,
  });

  it('skips rows already on the board, repeated in the table or without contact, and counts each', () => {
    const result = plan([
      row({ name: 'On board by phone', phone: '+1 (571) 594-6216' }),
      row({ name: 'On board by email', email: 'KNOWN@example.com' }),
      row({ name: 'First', email: 'ann@example.com' }),
      row({ name: 'Repeat', email: 'Ann@Example.com' }),
      row({ name: '', phone: '', email: '' }),
      row({ name: 'Second', phone: '+12035175705' }),
    ], { contacts: { emails: new Set(['known@example.com']), phones: new Set(['15715946216']) } });

    expect(result.leads.map((lead) => lead.row.name)).toEqual(['First', 'Second']);
    expect(result.skipped).toEqual({ onBoard: 2, repeated: 1, empty: 1 });
  });

  it('skips a row imported before', () => {
    const imported = row({ name: 'Name only' });

    expect(plan([imported], { claimed: new Set([importKeyOf('p1', imported)]) }).skipped.onBoard).toBe(1);
  });

  it('groups the leads by campaign value and applies the choices made for values', () => {
    const result = plan([
      row({ name: 'A', campaign: '120251441942930251' }),
      row({ name: 'B', campaign: '120248687922870485' }),
      row({ name: 'C', campaign: '120248687922870485' }),
      row({ name: 'D', utmCampaign: 'US | OH | Leads' }),
      row({ name: 'E' }),
    ], { choices: [{ value: '120248687922870485', campaignId: 'c-oh' }] });

    expect(result.leads.map((lead) => [lead.row.name, lead.campaignId])).toEqual([
      ['A', 'c-ct'], ['B', 'c-oh'], ['C', 'c-oh'], ['D', 'c-oh'], ['E', null],
    ]);
    expect(result.campaigns).toEqual([
      { value: '120251441942930251', leads: 1, campaignId: 'c-ct' },
      { value: '120248687922870485', leads: 2, campaignId: 'c-oh' },
      { value: 'US | OH | Leads', leads: 1, campaignId: 'c-oh' },
      { value: null, leads: 1, campaignId: null },
    ]);
  });

  it('refuses a chosen campaign outside the project', () => {
    expect(() => plan([row({ name: 'A' })], { choices: [{ value: null, campaignId: 'elsewhere' }] })).toThrow(AppError);
  });

  it('places each lead in the column its status names, a picked column or the first column', () => {
    const result = plan([
      row({ name: 'Qualified', status: 'Qualified' }),
      row({ name: 'Working', status: 'В работе' }),
      row({ name: 'Working too', status: 'В работе' }),
      row({ name: 'Unknown', status: 'Позже' }),
      row({ name: 'None' }),
    ], { own: [{ id: 'col-measure', name: 'Замер' }], placements: [{ value: 'В работе', columnId: 'col-measure' }] });

    expect(result.leads.map((lead) => [lead.row.name, lead.column])).toEqual([
      ['Qualified', 'QUALIFIED'], ['Working', 'col-measure'], ['Working too', 'col-measure'], ['Unknown', 'NEW'], ['None', 'NEW'],
    ]);
    expect(result.statuses).toEqual([
      { value: 'Qualified', leads: 1, columnId: 'QUALIFIED' },
      { value: 'В работе', leads: 2, columnId: 'col-measure' },
      { value: 'Позже', leads: 1, columnId: null },
    ]);
  });

  it('lets a picked column override the column a status names', () => {
    const result = plan([row({ name: 'Qualified', status: 'Qualified' })], { placements: [{ value: 'Qualified', columnId: 'PROPOSAL' }] });

    expect(result.leads[0]?.column).toBe('PROPOSAL');
    expect(result.statuses).toEqual([{ value: 'Qualified', leads: 1, columnId: 'PROPOSAL' }]);
  });

  it('refuses a picked column that is not on the board', () => {
    expect(() => plan([row({ name: 'A', status: 'x' })], { placements: [{ value: 'x', columnId: 'elsewhere' }] })).toThrow(AppError);
  });

  it('dates a lead by its row and counts the rows that arrive at the import time', () => {
    const result = plan([
      row({ name: 'Dated', submittedAt: '2026-09-22T06:38:09+03:00' }),
      row({ name: 'Undated', submittedAt: 'soon' }),
    ]);

    expect(result.leads.map((lead) => lead.submittedAt.toISOString())).toEqual(['2026-09-22T03:38:09.000Z', NOW.toISOString()]);
    expect(result.undated).toBe(1);
  });

  it('cuts long values and drops empty answers', () => {
    const cut = row({ name: 'x'.repeat(300), answers: [{ question: 'Q?', values: [' yes ', ''] }, { question: 'Empty', values: [' '] }] });

    expect(cut.name).toHaveLength(200);
    expect(cut.answers).toEqual([{ question: 'Q?', values: ['yes'] }]);
  });
});
