import { prisma } from "#shared/infrastructure/prisma.js";
import { config } from "#shared/infrastructure/config.js";
import { ProviderError } from "#modules/integrations/domain/integration.js";
import { AesCredentialCipher } from "#modules/integrations/infrastructure/credential-cipher.js";
import { GoogleOAuth, SEARCH_CONSOLE_SCOPE } from "#modules/integrations/infrastructure/google-oauth.js";
import { PrismaGoogleAuthorizations } from "#modules/integrations/infrastructure/prisma-google-authorizations.js";
import {
  createPageCheck,
  createReadUseCases,
  createSearchImport,
  createSeoRouter,
  createSeoWorker,
  createSiteUseCases,
  SeoProviderError,
  type SeoErrorCode,
} from "#modules/seo/index.js";
import { ChromeUxClient } from "#modules/seo/infrastructure/chrome-ux-client.js";
import { FetchedOrigins } from "#modules/seo/infrastructure/fetched-origins.js";
import { HtmlPageParser, XmlSitemapParser } from "#modules/seo/infrastructure/page-reader.js";
import { PageSpeedClient } from "#modules/seo/infrastructure/page-speed-client.js";
import { PrismaCheckJobs } from "#modules/seo/infrastructure/prisma-check-jobs.js";
import { PrismaImportJobs } from "#modules/seo/infrastructure/prisma-import-jobs.js";
import { PrismaSeoReads } from "#modules/seo/infrastructure/prisma-seo-reads.js";
import { PrismaSiteRepository } from "#modules/seo/infrastructure/prisma-site-repository.js";
import { SafeFetcher } from "#modules/seo/infrastructure/safe-fetcher.js";
import { SearchConsoleClient } from "#modules/seo/infrastructure/search-console-client.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";

const IMPORT_TIMEOUT_MS = 15 * 60_000;
const CHECK_BUDGET_MS = 45 * 60_000;
const CHECK_TIMEOUT_MS = 60 * 60_000;
const CHECKS_AT_ONCE = 2;

export function checkerUserAgent(): string {
  return `AdPulseBot/1.0 (+https://${config.landingHost ?? "bi.balagan.pro"})`;
}

const SEO_CODES: readonly SeoErrorCode[] = ["TOKEN", "ACCESS", "PROVIDER", "INVALID_DATA", "CONFIGURATION"];

async function translated<T>(work: () => Promise<T> | T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    const code = SEO_CODES.find((candidate) => candidate === error.code) ?? "PROVIDER";
    throw new SeoProviderError(code, error.retryAfterMs, error.detail);
  }
}

export function seoCipher(cipher: AesCredentialCipher) {
  return {
    encrypt: (token: string, projectId: string) => cipher.encrypt(token, projectId),
    decrypt: (value: string, projectId: string) => {
      try {
        return cipher.decrypt(value, projectId);
      } catch {
        throw new SeoProviderError("CONFIGURATION");
      }
    },
  };
}

export function wireSeo(
  { unitOfWork, clock, audit }: Kernel,
  { projectRepository }: Pick<ClientsAndProjects, "projectRepository">,
) {
  const oauth = config.googleAds ? new GoogleOAuth(config.googleAds) : null;
  const console = oauth
    ? new SearchConsoleClient({
        consentUrl: (state) => oauth.authorizeUrl(state, SEARCH_CONSOLE_SCOPE),
        accessToken: (refreshToken, signal) => translated(() => oauth.accessToken(refreshToken, signal)),
      })
    : null;
  const sites = new PrismaSiteRepository(prisma, unitOfWork);
  const cipher = seoCipher(new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY));
  const fetcher = new SafeFetcher(checkerUserAgent());
  const crux = config.googleApiKey ? new ChromeUxClient(config.googleApiKey) : null;
  const importJobs = new PrismaImportJobs(prisma);
  const checkJobs = new PrismaCheckJobs(prisma);
  const siteUseCases = createSiteUseCases({
    sites,
    signIns: new PrismaGoogleAuthorizations(prisma),
    cipher,
    console,
    projects: projectRepository,
    clock,
    unitOfWork,
    audit,
  });
  const reads = createReadUseCases({
    sites,
    projects: projectRepository,
    reads: new PrismaSeoReads(prisma),
    vitalsConfigured: crux !== null,
  });
  return {
    seoRouter: createSeoRouter(siteUseCases, reads),
    seoWorker: createSeoWorker({
      clock,
      loops: [{
        jobs: importJobs,
        run: createSearchImport({ jobs: importJobs, cipher, console, crux, origins: new FetchedOrigins(fetcher), clock }),
        concurrency: 1,
        timeoutMs: IMPORT_TIMEOUT_MS,
      }, {
        jobs: checkJobs,
        run: createPageCheck({
          jobs: checkJobs,
          fetcher,
          pages: new HtmlPageParser(),
          sitemaps: new XmlSitemapParser(),
          console,
          cipher,
          pageSpeed: config.googleApiKey ? new PageSpeedClient(config.googleApiKey) : null,
          clock,
          pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          budgetMs: CHECK_BUDGET_MS,
        }),
        concurrency: CHECKS_AT_ONCE,
        timeoutMs: CHECK_TIMEOUT_MS,
      }],
    }),
  };
}

export type Seo = ReturnType<typeof wireSeo>;
