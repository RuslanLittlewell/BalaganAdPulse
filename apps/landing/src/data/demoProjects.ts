export const DEMO_PROJECTS = [
  { name: "Летний запуск", channel: "Meta", spend: 1240, leads: 86, kpi: 112 },
  { name: "Студия йоги", channel: "Google Ads", spend: 520, leads: 31, kpi: 84 },
  { name: "Онлайн-школа", channel: "Meta", spend: 2150, leads: 140, kpi: 103 },
  { name: "Автосалон", channel: "Google Ads", spend: 1780, leads: 18, kpi: 62 },
  { name: "Доставка цветов", channel: "Meta", spend: 640, leads: 57, kpi: 91 },
  { name: "Мебельная фабрика", channel: "Meta", spend: 860, leads: 42, kpi: null },
  { name: "Кофейня", channel: "Google Ads", spend: 310, leads: 24, kpi: null },
] as const satisfies readonly { name: string; channel: string; spend: number; leads: number; kpi: number | null }[];
