import qrcode from "qrcode-generator";

/**
 * Render a QR code for a terminal using half-block characters. The colours are
 * forced (black on white) so it scans on both light and dark terminal themes.
 */
export function qrText(data: string): string {
  const qr = qrcode(0, "M");
  qr.addData(data);
  qr.make();
  const size = qr.getModuleCount();
  const quiet = 2;
  const dark = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < size && c < size && qr.isDark(r, c);
  const lines: string[] = [];
  for (let r = -quiet; r < size + quiet; r += 2) {
    let line = "";
    for (let c = -quiet; c < size + quiet; c++) {
      const top = dark(r, c),
        bottom = dark(r + 1, c);
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push("\x1b[47m\x1b[30m" + line + "\x1b[0m");
  }
  return lines.join("\n");
}
