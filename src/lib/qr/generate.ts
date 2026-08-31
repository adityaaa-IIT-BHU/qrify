import QRCode from "qrcode";
import { signQrToken } from "@/lib/qr/token";

export function buildApplyUrl(qrTokenId: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/j/${signQrToken(qrTokenId)}`;
}

export async function renderQrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}

export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
