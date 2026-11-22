import QRCode from "qrcode";
import type { QrRenderer } from "../application/ports.js";

export class SvgQrRenderer implements QrRenderer {
  svg(text: string): Promise<string> {
    return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
  }
}
