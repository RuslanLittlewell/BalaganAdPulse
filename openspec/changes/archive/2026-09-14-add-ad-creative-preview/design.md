## Context

The Meta import already walks `campaigns`, `adsets` and `ads` edges and writes one atomic snapshot inside a transaction (`PrismaImportJobs.complete`). Ads carry a name, a format and a status but nothing visual. The system already stores binary files in S3-compatible storage through `putObject`/`getObject`, and already serves them behind reach checks, as task images do. The campaign screen renders ad sets in `PerformanceTable`, expanding into ad rows that are inert.

## Goals / Non-Goals

**Goals:** one creative record per visible asset of an ad; a preview that survives token expiry and deletion at the provider; files served under the ad's own reach; a dialog that pages through an ad set's ads; video played from the stored copy.

**Non-Goals:** editing or uploading creatives, creative-level performance figures beyond what ads already carry, previews for channels other than Meta, Meta's own rendered ad preview iframe, and re-fetching a creative outside the daily import.

## Decisions

Model a creative as one visual asset rather than one Meta creative object: `AdCreative` holds `adId`, the provider's creative identifier, a `position` for carousel order, a kind of `IMAGE` or `VIDEO`, optional title and body text, an object-storage key for the file, a second key for a video's poster, the content type and the byte size. A carousel becomes several rows sharing a creative identifier and differing in position, which is what the dialog pages through and what the table counts.

Ask Meta for `creative{id,thumbnail_url,image_url,video_id,object_story_spec}` while listing ads, then resolve a video's file with one extra `/{video_id}?fields=source,picture` request per distinct video. Carousel frames come from `object_story_spec.link_data.child_attachments`. An ad whose creative cannot be described yields no rows rather than failing the import: the hierarchy and the metrics matter more than a picture.

Copy files during the import, before the transaction that publishes the snapshot, and address each stored object by a digest of its provider URL. An unchanged creative therefore resolves to a key that already exists and is not fetched again. Images are copied up to 10 MB and videos up to 25 MB; a larger video keeps its poster and is marked `oversized`, and the dialog offers Ads Manager for it. A file that fails to download leaves its row without a key, so the next import retries it while the rest of the snapshot stays intact.

Serve a creative through `GET /api/ad-creatives/:id/file`, which resolves the ad, then the ad set, then the campaign's project and applies the same reach filter the campaign endpoints use; an unreachable creative answers 404. The browser reads it as a blob, as it already does for task images, so no provider link and no public object ever reaches the page. List creatives with the ads themselves: `GET /api/ad-sets/:id/ads` gains a `creatives` array per ad, which keeps the dialog's paging free of further requests.

## Risks / Trade-offs

- Copying files makes an import slower and the bucket larger → the size limits bound both, and a digest key makes repeat imports free.
- A blob request loads a video whole before it plays → acceptable for a 25 MB ceiling on a preview; a Range-served stream is the way out if the ceiling is ever raised.
- Meta's creative shapes are many and change over time → the provider reads the few documented fields and treats anything else as "no creative", never as a failure.
- Stored copies outlive the provider's own deletion → that is the point of the feature, and files are removed with the ad, the campaign and the project by the same cascade.
