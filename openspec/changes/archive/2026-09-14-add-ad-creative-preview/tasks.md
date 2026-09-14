## 1. Creatives in the snapshot

- [x] 1.1 Write and observe failing provider tests for a single image, a carousel, a video with its poster, an ad with no describable creative and a malformed creative.
- [x] 1.2 Read the creative fields while listing ads and resolve video sources, extending the snapshot with creatives.

## 2. Creative storage

- [x] 2.1 Write and observe failing tests for the model, the digest key, the size limits, the reuse of an already stored file and a download failure leaving the row without a key.
- [x] 2.2 Add the `AdCreative` model with its migration, the file-copying port and its S3 adapter.

## 3. Import writes creatives

- [x] 3.1 Write and observe failing import-job tests for creating, replacing and orphaning creatives across repeat imports without touching metrics.
- [x] 3.2 Write the creatives inside the publishing transaction, copying files before it.

## 4. Reading creatives

- [x] 4.1 Write and observe failing API tests for creatives listed with an ad set's ads, the file endpoint, its content type and its 404 for an unreachable or unknown creative.
- [x] 4.2 Add the creative list to the ads response and the file endpoint with its OpenAPI description, and wire them into the container.
- [x] 4.3 Run `npm test` to green.

## 5. Preview dialog

- [x] 5.1 Write and observe failing widget tests for opening an ad row, showing an image, playing a video, paging through the ad set, an ad with no creative and closing by keyboard.
- [x] 5.2 Build the dialog and make ad rows open it, adding every visible string to `ru.ts`.
- [x] 5.3 Run `npm run test:web` and `npm run build:web` to green.

## 6. Close out

- [x] 6.1 Run `openspec validate add-ad-creative-preview --strict`, `npm test` and `npm run test:web` to green.

## 7. Provider-rendered video preview

- [x] 7.1 Write and observe failing provider tests for reading an ad's rendered preview and for a refusal leaving no link.
- [x] 7.2 Write and observe failing API tests for the preview endpoint, its reach, its 404 without a connection and the absence of credentials in the response.
- [x] 7.3 Write and observe failing dialog tests for a video without a stored file being shown through the provider's rendering.
- [x] 7.4 Implement the provider call, the use case, the endpoint and the dialog, and run `npm test`, `npm run build`, `npm run test:web` to green.

## 8. Creatives on demand

- [x] 8.1 Write and observe failing provider tests for reading one ad's creatives on its own.
- [x] 8.2 Write and observe failing application and API tests for fetching an ad's creatives on first view, reusing the stored ones afterwards, and answering with what is stored when no connection remains.
- [x] 8.3 Take creatives out of the import and off the worker, and serve them from the new endpoint.
- [x] 8.4 Ask for an ad's creatives when the dialog opens, and run `npm test`, `npm run build`, `npm run test:web` to green.
