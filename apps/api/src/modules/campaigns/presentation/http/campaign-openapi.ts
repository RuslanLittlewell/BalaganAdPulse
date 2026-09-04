import { z } from "zod";
import { arrayOf, ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { CHANNELS, DELIVERY_STATUSES } from "../../domain/hierarchy.js";
import { rangeSchema } from "./campaign-schemas.js";

const measured = {
  spend: z.number(),
  impressions: z.number(),
  reach: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  revenue: z.number(),
};

const derived = {
  ctr: z.number().nullable(),
  cpc: z.number().nullable(),
  cpm: z.number().nullable(),
  cpa: z.number().nullable(),
  roas: z.number().nullable(),
  frequency: z.number().nullable(),
};

const performance = z.object({ ...measured, ...derived });

const measuredDay = z.object({ date: z.iso.date(), ...measured });

const campaign = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  channel: z.enum(CHANNELS),
  status: z.enum(DELIVERY_STATUSES),
  objective: z.string().nullable(),
  externalId: z.string().nullable(),
  position: z.int(),
  performance,
});

const adSet = z.object({
  id: z.uuid(),
  campaignId: z.uuid(),
  name: z.string(),
  audience: z.string().nullable(),
  status: z.enum(DELIVERY_STATUSES),
  externalId: z.string().nullable(),
  position: z.int(),
  performance,
});

const ad = z.object({
  id: z.uuid(),
  adSetId: z.uuid(),
  name: z.string(),
  format: z.string().nullable(),
  headline: z.string().nullable(),
  status: z.enum(DELIVERY_STATUSES),
  externalId: z.string().nullable(),
  position: z.int(),
  performance,
});

const campaignReference = z.object({
  id: z.uuid(),
  name: z.string(),
  channel: z.enum(CHANNELS),
});

const channelSummary = z.object({
  channel: z.enum(CHANNELS),
  campaigns: z.int(),
  performance,
});

export const campaignComponents: ComponentDocs = {
  Performance: performance,
  MeasuredDay: measuredDay,
  Campaign: campaign,
  AdSet: adSet,
  Ad: ad,
  CampaignReference: campaignReference,
  ChannelSummary: channelSummary,
};

const RANGE = "Figures are summed over the inclusive from/to range, which both endpoints require.";

export const campaignDoc: RouteDoc = {
  tag: "Campaigns",
  tagDescription: "The advertising hierarchy and the figures measured against it",
  operations: [
    {
      method: "get",
      path: "/:id",
      summary: "Read a campaign with its performance",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The campaign", schema: ref("Campaign") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/:id/ad-sets",
      summary: "List a campaign's ad sets with their performance",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The ad sets", schema: arrayOf(ref("AdSet")) },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/:id/daily",
      summary: "Read a campaign's daily figures",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "One entry per measured day, oldest first", schema: arrayOf(ref("MeasuredDay")) },
      errors: [400, 401, 403, 404],
    },
  ],
};

export const adSetDoc: RouteDoc = {
  tag: "Campaigns",
  operations: [
    {
      method: "get",
      path: "/:id/ads",
      summary: "List an ad set's ads with their performance",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The ads", schema: arrayOf(ref("Ad")) },
      errors: [400, 401, 403, 404],
    },
  ],
};

export const projectMetricDoc: RouteDoc = {
  tag: "Campaigns",
  operations: [
    {
      method: "get",
      path: "/campaigns/names",
      summary: "Name a project's campaigns",
      description: "Identity only, for pickers: no range and no figures.",
      success: { status: 200, description: "The campaigns", schema: arrayOf(ref("CampaignReference")) },
      errors: [401, 403, 404],
    },
    {
      method: "get",
      path: "/campaigns",
      summary: "List a project's campaigns with their performance",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The campaigns", schema: arrayOf(ref("Campaign")) },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/daily",
      summary: "Read a project's daily figures",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "One entry per measured day, oldest first", schema: arrayOf(ref("MeasuredDay")) },
      errors: [400, 401, 403, 404],
    },
    {
      method: "get",
      path: "/summary",
      summary: "Sum a project's performance",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The project's figures over the range", schema: ref("Performance") },
      errors: [400, 401, 403, 404],
    },
  ],
};

export const summaryDoc: RouteDoc = {
  tag: "Campaigns",
  operations: [
    {
      method: "get",
      path: "/channels",
      summary: "Sum performance per channel",
      description: `${RANGE} Channels are ordered by spend, heaviest first.`,
      query: rangeSchema,
      success: { status: 200, description: "One entry per channel that ran", schema: arrayOf(ref("ChannelSummary")) },
      errors: [400, 401, 403],
    },
    {
      method: "get",
      path: "/",
      summary: "Sum performance across everything this actor reaches",
      description: RANGE,
      query: rangeSchema,
      success: { status: 200, description: "The agency's figures over the range", schema: ref("Performance") },
      errors: [400, 401, 403],
    },
  ],
};
