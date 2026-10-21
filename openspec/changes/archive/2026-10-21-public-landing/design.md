## Context

One Express process serves `/api` and the built SPA, behind nginx on the VPS, from one image built
by `apps/api/Dockerfile.prod`. Google's reviewers and its automated checks read the home page and
the privacy policy; a page whose text appears only after JavaScript runs reads to them as empty.

## Goals / Non-Goals

**Goals:**

- Static HTML pages whose text is in the document as served.
- One build and one deployment with the rest of the app.

**Non-Goals:**

- A marketing site for the agency; balagan.pro stays where it is.
- Signing in or any API on the landing host.

## Decisions

- **Astro, static output.** Every page is rendered at build time into plain HTML; the only
  script is the background animation, which the text does not depend on.
- **Served by the API process, chosen by host.** A request whose host is `LANDING_HOST` (default
  `bi.balagan.pro`) is answered from the landing's build; a path it does not have answers the
  landing's 404 page. Any other host reaches the API and the SPA unchanged. nginx forwards
  `bi.balagan.pro` to the same upstream, so no new container or port is needed.
- **Palette copied, not imported.** The landing defines the web app's colour tokens itself: the web
  app's stylesheet carries shadcn and the app's type scale, which the landing does not want.
- **Backgrounds ported, not shared.** The opening uses the sign-in page's LightRays shader and its
  handwritten Balagan signature; the rest of the page uses the app's GradientWaves. Both shaders
  run from small framework-free scripts, since the landing has no React. Motion stops for visitors
  who ask for reduced motion, and the page reads the same without WebGL.
- **Reveal on scroll, never hide without scripts.** Sections and cards are hidden only once the
  reveal script has run and marked the document, so a reader without scripts sees everything.
- **Russian first, English alongside.** The pages are in Russian for clients, with an English
  section for Google's reviewers.

## Risks / Trade-offs

- The shaders and the signature exist twice. It changes rarely; a change to one is a deliberate choice for the other.
- The privacy policy states commitments (who processes the data, deletion on request) that the
  agency must confirm before the page goes live.
