import AsciiTable from "ascii-table";
import { numeric } from "ts-math";

export function toAsciiTable(arrays: number[][], heading: string[], decimals: number[] | null = null) {
  const rows = numeric.transpose(
    arrays.map((a: number[], i: number) =>
      a.map((v) => (typeof v === "number" ? v.toFixed(decimals ? (decimals as any)[i] : 2) : v))
    ) as any[][]
  );
  var table = AsciiTable.factory({
    heading: ["index", ...heading],
    rows: rows.map((d: any, i: number) => [i, ...d]),
  });
  table.setBorder(" ");
  arrays.forEach((a: number[], i: number) => {
    table.setAlign(i + 1, AsciiTable.RIGHT);
  });
  return table;
}
