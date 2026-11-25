import type { SheetReader } from '../application/lead-import-use-cases.js';
import { IMPORT_BYTES_LIMIT, importRefused } from '../domain/lead-import.js';

const CLOSED = 'The sheet is not open to anyone with the link';

export class GoogleSheetReader implements SheetReader {
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = 15_000) {}

  async read(address: string): Promise<string> {
    let response: Response;
    try {
      response = await this.fetcher(address, { redirect: 'follow', signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw importRefused('UNREACHABLE', 'Google Sheets did not answer');
    }
    if ([401, 403, 404].includes(response.status)) throw importRefused('CLOSED', CLOSED);
    if (!response.ok) throw importRefused('UNREACHABLE', 'Google Sheets did not answer');
    if (/text\/html/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw importRefused('CLOSED', CLOSED);
    }
    return new TextDecoder('utf-8').decode(await this.bytesOf(response));
  }

  private async bytesOf(response: Response): Promise<Uint8Array> {
    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > IMPORT_BYTES_LIMIT) {
        await reader.cancel();
        throw importRefused('TOO_LARGE', 'The sheet is larger than 10 MB');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
}
