import { getOptionalRequestContext } from "../../../shared/presentation/request-context.js";
import type { RequestMetadata, RequestMetadataSource } from "../application/ports.js";

/**
 * Ambient request metadata, read here rather than in a use case.
 *
 * Threading an IP address through every service signature to reach the audit
 * writer would put transport detail in business code; keeping the lookup in
 * infrastructure keeps the use cases handed an answer instead of reaching for
 * one. A call with no request behind it — a seed, a background job — simply has
 * no metadata, and the event records nulls.
 */
export class AmbientRequestMetadata implements RequestMetadataSource {
  current(): RequestMetadata | undefined {
    const context = getOptionalRequestContext();
    if (!context) return undefined;
    return { requestId: context.requestId, ip: context.ip, userAgent: context.userAgent };
  }
}
