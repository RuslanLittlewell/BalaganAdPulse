import { z } from 'zod';
import type { RouteDoc } from '#shared/presentation/openapi.js';
import { allowSitesSchema, websiteKeySchema, websiteLeadSchema } from './website-intake-schemas.js';

const accepted = z.object({ ok: z.literal(true) });

const marquizSubmission = z.object({
  contacts: z.object({ name: z.string(), phone: z.string(), email: z.string() }).partial(),
  answers: z.array(z.object({ q: z.string(), a: z.union([z.string(), z.array(z.string())]) })),
  quiz: z.object({ id: z.string(), name: z.string() }).partial(),
  created: z.string(),
  extra: z.object({
    href: z.string(),
    referrer: z.string(),
    utm: z.object({ source: z.string(), medium: z.string(), campaign: z.string(), content: z.string(), term: z.string() }).partial(),
  }).partial(),
}).partial();

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
    {
      method: 'post',
      path: '/marquiz/:key',
      summary: 'Receive a Marquiz quiz submission by webhook',
      description: "The address carries the project's website key, since Marquiz cannot send headers. The request is server-to-server, so the key's list of allowed sites does not apply. Unknown fields are ignored, and the same submission delivered again answers success without creating a second lead.",
      open: true,
      body: marquizSubmission,
      success: { status: 200, description: 'The submission was accepted', schema: accepted },
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
