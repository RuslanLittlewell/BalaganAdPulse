import { createContext, useContext } from "react";
import { Circle, Document, Font, Image, Line, Page, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import inter400 from "../fonts/inter-400-normal.woff?url";
import inter400Italic from "../fonts/inter-400-italic.woff?url";
import inter700 from "../fonts/inter-700-normal.woff?url";
import inter700Italic from "../fonts/inter-700-italic.woff?url";
import oswald400 from "../fonts/oswald-400-normal.woff?url";
import oswald700 from "../fonts/oswald-700-normal.woff?url";
import { t } from "@/shared/config/index.js";
import type { Block, Run } from "../model/rich-text.js";
import { Logo } from "./Logo.js";
import { PANEL, panelTitleSize } from "../model/layout.js";
import type { ChartPoint, ReportDeck, Slide } from "../model/slides.js";

export interface ReportFonts {
  body: string;
  display: string;
}

let registrations = 0;

export function registerReportFonts(): ReportFonts {
  registrations += 1;
  const fonts = { body: `Inter-${registrations}`, display: `Oswald-${registrations}` };
  Font.register({
    family: fonts.body,
    fonts: [
      { src: inter400 }, { src: inter400Italic, fontStyle: "italic" },
      { src: inter700, fontWeight: 700 }, { src: inter700Italic, fontWeight: 700, fontStyle: "italic" },
    ],
  });
  Font.register({ family: fonts.display, fonts: [{ src: oswald400 }, { src: oswald700, fontWeight: 700 }] });
  Font.registerHyphenationCallback((word) => [word]);
  return fonts;
}

const FontsContext = createContext<ReportFonts>({ body: "Helvetica", display: "Helvetica" });
const useDisplay = () => ({ fontFamily: useContext(FontsContext).display });

const WIDTH = 960;
const HEIGHT = 540;
const ACCENT = "#5B8FA8";

const s = StyleSheet.create({
  page: { width: WIDTH, height: HEIGHT, backgroundColor: "#FFFFFF", color: "#111111", flexDirection: "row" },
  coverTitle: { fontWeight: 700, fontSize: 70, lineHeight: 1.05, textTransform: "uppercase" },
  coverLeft: { width: WIDTH / 2 - 40, paddingLeft: 58, paddingTop: 48, paddingBottom: 40, justifyContent: "space-between" },
  coverPeriod: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  rule: { width: 1, height: 100, backgroundColor: "#111111" },
  bullet: { width: 9, height: 9, backgroundColor: "#111111", marginBottom: 6 },
  coverRight: { flex: 1, backgroundColor: "#111111" },
  panel: { width: PANEL.width, backgroundColor: "#000000", paddingLeft: PANEL.left, paddingRight: PANEL.right, justifyContent: "center" },
  panelTitle: { fontWeight: 700, fontSize: 50, color: "#FFFFFF", lineHeight: 1.05, textTransform: "uppercase" },
  panelNote: { fontSize: 18, color: "#9A9A9A", marginTop: 12 },
  content: { flex: 1, paddingLeft: 64, paddingRight: 64, justifyContent: "center" },
  strong: { fontWeight: 700, fontSize: 20 },
  note: { fontSize: 13, marginTop: 8, lineHeight: 1.4 },
  heading: { fontWeight: 400, fontSize: 40, lineHeight: 1.1 },
  wide: { width: WIDTH, paddingLeft: 66, paddingTop: 70, paddingRight: 66 },
  paragraph: { fontSize: 12.5, lineHeight: 1.45, marginBottom: 8 },
});

function Cover({ page, slide, picture }: { page: { fontFamily: string }; slide: Extract<Slide, { kind: "cover" }>; picture?: string }) {
  return (
    <Page size={[WIDTH, HEIGHT]} style={[s.page, page]}>
      <View style={s.coverLeft}>
        <Logo width={118} />
        <Text style={[s.coverTitle, useDisplay()]}>{`${t("report.pdf.title")}\n${slide.client}`}</Text>
        <View style={s.coverPeriod}>
          <View style={s.rule} />
          <View style={s.bullet} />
          <Text style={{ fontSize: 20 }}>{`${t("report.pdf.for")} ${slide.period}`}</Text>
        </View>
      </View>
      <View style={s.coverRight}>
        {picture ? <Image src={picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </View>
    </Page>
  );
}

function Panel({ title, note }: { title: string; note?: string }) {
  return (
    <View style={s.panel}>
      <Text style={[s.panelTitle, useDisplay(), { fontSize: panelTitleSize(title) }]}>{title}</Text>
      {note ? <Text style={s.panelNote}>{note}</Text> : null}
    </View>
  );
}

function Summary({ page, slide }: { page: { fontFamily: string }; slide: Extract<Slide, { kind: "summary" }> }) {
  return (
    <Page size={[WIDTH, HEIGHT]} style={[s.page, page]}>
      <Panel title={t("report.pdf.summary").replace(" ", "\n")} note={t("report.pdf.digest")} />
      <View style={s.content}>
        <Text style={{ ...s.strong, fontSize: 24, marginBottom: 34 }}>{slide.direction}</Text>
        <Text style={s.strong}>{slide.spend}</Text>
        <Text style={{ ...s.note, width: 230 }}>{slide.budgetNote}</Text>
        <Text style={{ ...s.strong, marginTop: 56 }}>{slide.leads}</Text>
        <Text style={s.note}>{slide.contacts ? `${slide.cost}\n${slide.contacts}` : slide.cost}</Text>
      </View>
    </Page>
  );
}

const CHART = { width: 380, height: 190, top: 24, bottom: 22, side: 26 };

function Chart({ title, points }: { title: string; points: ChartPoint[] }) {
  const highest = Math.max(0, ...points.map((point) => point.value ?? 0)) || 1;
  const usable = CHART.height - CHART.top - CHART.bottom;
  const x = (index: number) =>
    points.length === 1 ? CHART.width / 2 : CHART.side + (index / (points.length - 1)) * (CHART.width - CHART.side * 2);
  const y = (value: number) => CHART.top + usable - (value / highest) * usable * 0.85;
  const drawn = points.flatMap((point, index) => (point.value === null ? [] : [{ x: x(index), y: y(point.value), point }]));
  const grid = [0, 0.25, 0.5, 0.75, 1].map((share) => CHART.top + usable * share);

  return (
    <View style={{ width: CHART.width }}>
      <Text style={{ fontSize: 13, color: "#777777", marginBottom: 10 }}>{title}</Text>
      <View style={{ width: CHART.width, height: CHART.height, position: "relative" }}>
        <Svg width={CHART.width} height={CHART.height}>
          {grid.map((level) => (
            <Line key={level} x1={0} y1={level} x2={CHART.width} y2={level} stroke="#DDDDDD" strokeWidth={0.7} />
          ))}
          <Polyline points={drawn.map((entry) => `${entry.x},${entry.y}`).join(" ")} stroke={ACCENT} strokeWidth={1.6} fill="none" />
          {drawn.map((entry) => <Circle key={entry.x} cx={entry.x} cy={entry.y} r={4} fill={ACCENT} />)}
        </Svg>
        {drawn.map((entry) => (
          <Text key={`label-${entry.x}`} style={{ position: "absolute", left: entry.x - 40, width: 80, top: entry.y - 18, fontSize: 9, color: ACCENT, textAlign: "center" }}>
            {entry.point.label}
          </Text>
        ))}
        {points.map((point, index) => (
          <Text key={`month-${point.caption}-${index}`} style={{ position: "absolute", left: x(index) - 40, width: 80, top: CHART.height - 14, fontSize: 9, textAlign: "center" }}>
            {point.caption}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Trends({ page, slide }: { page: { fontFamily: string }; slide: Extract<Slide, { kind: "trends" }> }) {
  return (
    <Page size={[WIDTH, HEIGHT]} style={[s.page, page]}>
      <View style={s.wide}>
        <Text style={[s.heading, useDisplay(), { width: 720 }]}>{t("report.pdf.trends")}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 46, width: 820 }}>
          <Chart title={t("report.pdf.trend.leads")} points={slide.leads} />
          <Chart title={t("report.pdf.trend.cost")} points={slide.cost} />
        </View>
      </View>
    </Page>
  );
}

function Ad({ page, slide, picture }: { page: { fontFamily: string }; slide: Extract<Slide, { kind: "ad" }>; picture?: string }) {
  return (
    <Page size={[WIDTH, HEIGHT]} style={[s.page, page]}>
      <View style={s.wide}>
        <Text style={[s.heading, useDisplay(), { width: 420 }]}>{t("report.pdf.ads")}</Text>
        <View style={{ flexDirection: "row", marginTop: 40, height: 262 }}>
          <View style={{ width: 262, height: 262, backgroundColor: "#E6E6E6" }}>
            {picture ? <Image src={picture} style={{ width: 262, height: 262, objectFit: "cover" }} /> : null}
          </View>
          <View style={{ width: 300, backgroundColor: "#F2F2F2", paddingLeft: 50, justifyContent: "center" }}>
            <Text style={{ fontWeight: 700, fontSize: 17 }}>{t("report.pdf.result")}</Text>
            <Text style={{ fontSize: 17, color: "#444444", marginTop: 34 }}>{slide.result}</Text>
            <Text style={{ fontSize: 10, color: "#888888", marginTop: 18, paddingRight: 24 }}>{slide.name}</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, index) => (
        <Text key={index} style={{ fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? "italic" : "normal" }}>{run.text}</Text>
      ))}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => block.kind === "paragraph" ? (
        <Text key={index} style={s.paragraph}><Runs runs={block.runs} /></Text>
      ) : (
        <View key={index} style={{ marginBottom: 6 }}>
          {block.items.map((item, position) => (
            <View key={position} style={{ flexDirection: "row" }}>
              <Text style={{ ...s.paragraph, width: 24, flexShrink: 0, fontWeight: 700 }}>{block.ordered ? `${position + 1}.` : "•"}</Text>
              <View style={{ flex: 1 }}><Blocks blocks={item} /></View>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function TextSlide({ page, slide }: { page: { fontFamily: string }; slide: Extract<Slide, { kind: "text" }> }) {
  return (
    <Page size={[WIDTH, HEIGHT]} style={[s.page, page]}>
      <Panel title={slide.title} />
      <View style={s.content}>
        <Blocks blocks={slide.blocks} />
      </View>
    </Page>
  );
}

export function ReportDocument({ deck, pictures, fonts }: {
  deck: ReportDeck;
  pictures: ReadonlyMap<string, string>;
  fonts: ReportFonts;
}) {
  return (
    <FontsContext.Provider value={fonts}>
      <Document title={deck.fileName.replace(/\.pdf$/, "")} author={t("report.pdf.brand")}>
        {deck.slides.map((slide, index) => {
          const page = { fontFamily: fonts.body };
          switch (slide.kind) {
            case "cover": return <Cover key={index} page={page} slide={slide} picture={slide.pictureKey ? pictures.get(slide.pictureKey) : undefined} />;
            case "summary": return <Summary key={index} page={page} slide={slide} />;
            case "trends": return <Trends key={index} page={page} slide={slide} />;
            case "ad": return <Ad key={index} page={page} slide={slide} picture={pictures.get(slide.adId)} />;
            case "text": return <TextSlide key={index} page={page} slide={slide} />;
          }
        })}
      </Document>
    </FontsContext.Provider>
  );
}
