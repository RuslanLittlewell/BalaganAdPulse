import { getOptionalRequestContext } from "../../../shared/presentation/request-context.js";
import type { RequestMetadata, RequestMetadataSource } from "../application/ports.js";

export class AmbientRequestMetadata implements RequestMetadataSource {
  current(): RequestMetadata | undefined {
    const context = getOptionalRequestContext();
    if (!context) return undefined;
    return { requestId: context.requestId, ip: context.ip, userAgent: context.userAgent };
  }
}
