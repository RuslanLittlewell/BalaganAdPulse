declare module "react17" {
  export { default } from "react";
}

declare module "react-dom17/server" {
  export function renderToStaticMarkup(element: unknown): string;
}
