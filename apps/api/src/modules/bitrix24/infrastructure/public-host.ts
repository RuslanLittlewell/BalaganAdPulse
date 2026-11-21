import dns from "node:dns";

type Lookup = (host: string) => Promise<Array<{ address: string }>>;

const systemLookup: Lookup = (host) => dns.promises.lookup(host, { all: true, verbatim: true });

export function createPublicHostCheck(isReserved: (address: string) => boolean, lookup: Lookup = systemLookup) {
  return async (host: string): Promise<boolean> => {
    try {
      const addresses = await lookup(host);
      return addresses.length > 0 && addresses.every(({ address }) => !isReserved(address));
    } catch {
      return false;
    }
  };
}
