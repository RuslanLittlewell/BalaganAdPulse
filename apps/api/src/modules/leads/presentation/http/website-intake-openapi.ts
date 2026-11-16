import { z } from 'zod';
import type { RouteDoc } from '#shared/presentation/openapi.js';
import { allowSitesSchema, websiteKeySchema, websiteLeadSchema } from './website-intake-schemas.js';

const accepted = z.object({ ok: z.literal(true) });

export const websiteIntakeDoc: RouteDoc = {
  tag: 'Website lead intake',
  tagDescription:
    "Public endpoints that take leads from a client's website. A request carries the project's website key and comes from a site on the key's list, or comes from a server with the key in a bearer header.",
  operations: [
    {
      method: 'get',
      path: '/script.js',
      summary: 'The script a site adds to collect UTM tags and send form leads',
      open: true,
      success: { status: 200, description: 'JavaScript', contentType: 'application/javascript' },
    },
    {
      method: 'post',
      path: '/leads',
      summary: 'Send a lead from a website',
      description: 'The body is JSON and may be sent as text/plain to avoid a preflight request. A filled honeypot or a repeated id answers success without creating a lead.',
      open: true,
      body: websiteLeadSchema,
      success: { status: 202, description: 'The lead was accepted', schema: accepted },
      errors: [400, 403, 429],
    },
  ],
};

export const websiteKeyDoc: RouteDoc = {
  tag: 'Website keys',
  tagDescription:
    "The one key per project that lets the project's site send leads, with the sites allowed to use it. Admins and managers see, create, replace and remove it.",
  operations: [
    {
      method: 'get',
      path: '/:id/website-key',
      summary: "Read a project's website key",
      success: { status: 200, description: 'The key, or null when the project has none', schema: websiteKeySchema.nullable() },
      errors: [401, 403, 404],
    },
    {
      method: 'put',
      path: '/:id/website-key',
      summary: "Create a project's website key",
      description: 'An existing key is returned unchanged.',
      success: { status: 200, description: 'The existing key; 201 when it was created', schema: websiteKeySchema },
      errors: [401, 403, 404],
    },
    {
      method: 'post',
      path: '/:id/website-key/rotate',
      summary: 'Replace the key; the old one stops working at once',
      success: { status: 200, description: 'The new key', schema: websiteKeySchema },
      errors: [401, 403, 404],
    },
    {
      method: 'put',
      path: '/:id/website-key/sites',
      summary: 'Replace the list of sites allowed to use the key',
      body: allowSitesSchema,
      success: { status: 200, description: 'The key with its new list', schema: websiteKeySchema },
      errors: [400, 401, 403, 404],
    },
    {
      method: 'delete',
      path: '/:id/website-key',
      summary: 'Remove the key',
      success: { status: 204, description: 'The key no longer accepts leads' },
      errors: [401, 403, 404],
    },
  ],
};
