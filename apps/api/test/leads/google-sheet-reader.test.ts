import { describe, expect, it } from 'vitest';
import { GoogleSheetReader } from '../../src/modules/leads/infrastructure/google-sheet-reader.js';

const ADDRESS = 'https://docs.google.com/spreadsheets/d/abcdefghijkl/export?format=csv';

function answering(response: () => Response) {
  const asked: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    asked.push(String(input));
    return response();
  }) as typeof fetch;
  return { reader: new GoogleSheetReader(fetcher), asked };
}

async function refusal(reader: GoogleSheetReader) {
  try {
    await reader.read(ADDRESS);
    return null;
  } catch (error) {
    return (error as { details?: unknown }).details;
  }
}

describe('reading a Google Sheet', () => {
  it('returns the CSV text of the export address', async () => {
    const { reader, asked } = answering(() => new Response('name,phone\nAnn,1\n', { headers: { 'content-type': 'text/csv; charset=utf-8' } }));

    expect(await reader.read(ADDRESS)).toBe('name,phone\nAnn,1\n');
    expect(asked).toEqual([ADDRESS]);
  });

  it('calls a sheet closed when Google answers with a sign-in page or refuses access', async () => {
    expect(await refusal(answering(() => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } })).reader)).toEqual([{ code: 'CLOSED' }]);
    expect(await refusal(answering(() => new Response('', { status: 403 })).reader)).toEqual([{ code: 'CLOSED' }]);
    expect(await refusal(answering(() => new Response('', { status: 404 })).reader)).toEqual([{ code: 'CLOSED' }]);
  });

  it('reports Google out of reach on a failure or a server error', async () => {
    const failing = new GoogleSheetReader((async () => { throw new TypeError('fetch failed'); }) as typeof fetch);

    expect(await refusal(failing)).toEqual([{ code: 'UNREACHABLE' }]);
    expect(await refusal(answering(() => new Response('', { status: 500 })).reader)).toEqual([{ code: 'UNREACHABLE' }]);
  });

  it('stops reading past 10 MB', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(97);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });

    expect(await refusal(answering(() => new Response(body, { headers: { 'content-type': 'text/csv' } })).reader)).toEqual([{ code: 'TOO_LARGE' }]);
  });
});
