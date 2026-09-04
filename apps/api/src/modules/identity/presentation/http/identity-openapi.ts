import { z } from "zod";
import { avatarUploadBody } from "#shared/presentation/avatar.js";
import { ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { loginSchema, refreshSchema, registerSchema, updateProfileSchema } from "./identity-schemas.js";

const tokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

const accessToken = z.object({ accessToken: z.string() });

const profile = z.object({
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  avatarPath: z.string().nullable(),
  phone: z.string().nullable(),
  telegram: z.string().nullable(),
});

export const identityComponents: ComponentDocs = {
  TokenPair: tokenPair,
  AccessToken: accessToken,
  Profile: profile,
};

export const authDoc: RouteDoc = {
  tag: "Authentication",
  tagDescription: "Registering against an invitation, signing in, and the tokens that follow",
  operations: [
    {
      method: "post",
      path: "/register",
      summary: "Register against an invitation",
      description: "Redeems an invitation code. A client invitation also carries the contact and the first project.",
      open: true,
      body: registerSchema,
      success: { status: 201, description: "The session, also set as cookies", schema: ref("TokenPair") },
      errors: [400, 403, 409, 429],
    },
    {
      method: "post",
      path: "/login",
      summary: "Exchange credentials for a session",
      open: true,
      body: loginSchema,
      success: { status: 200, description: "The session, also set as cookies", schema: ref("TokenPair") },
      errors: [400, 401, 429],
    },
    {
      method: "post",
      path: "/refresh",
      summary: "Renew the access token",
      description: "Reads the refresh token from its cookie, falling back to the body.",
      open: true,
      body: refreshSchema,
      bodyRequired: false,
      success: { status: 200, description: "A fresh access token", schema: ref("AccessToken") },
      errors: [400, 401, 429],
    },
    {
      method: "post",
      path: "/logout",
      summary: "End the session",
      open: true,
      body: refreshSchema,
      bodyRequired: false,
      success: { status: 204, description: "The session is over and its cookies are cleared" },
      errors: [400, 401, 429],
    },
  ],
};

export const userDoc: RouteDoc = {
  tag: "Profile",
  tagDescription: "The signed-in user's own name, contact details, password and avatar",
  operations: [
    {
      method: "get",
      path: "/profile",
      summary: "Read the signed-in user's profile",
      success: { status: 200, description: "The profile, with the avatar as a data URL", schema: ref("Profile") },
      errors: [401, 404],
    },
    {
      method: "patch",
      path: "/profile",
      summary: "Change the profile, and optionally the password",
      body: updateProfileSchema,
      success: { status: 200, description: "A fresh access token carrying the new name", schema: ref("AccessToken") },
      errors: [400, 401, 403, 404],
    },
    {
      method: "put",
      path: "/avatar",
      summary: "Save the avatar",
      description: "A PNG of up to 1 MB, with the avatar configuration that generated it.",
      bodyType: "multipart/form-data",
      body: avatarUploadBody,
      success: { status: 204, description: "The avatar is stored" },
      errors: [400, 401],
    },
  ],
};
