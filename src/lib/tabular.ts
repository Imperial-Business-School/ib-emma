import { parseCsv } from "./csv";

// Reads an uploaded tabular file (either CSV or XLSX) into a
// string[][]. XLSX is detected by extension/MIME so users can upload
// either the .xlsx template we hand them or a CSV saved out from Excel.
export async function parseTabularFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const looksLikeXlsx =
    name.endsWith(".xlsx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!looksLikeXlsx) {
    return parseCsv(await file.text());
  }
  // Dynamic import so the ~1MB exceljs bundle only loads on xlsx
  // uploads and not on every hot page render.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // getCell is 1-indexed. actualCellCount tells us how many
    // columns this row uses; iterate up to that so trailing gaps
    // don't leak stale references.
    const width = row.actualCellCount || row.cellCount || 0;
    for (let c = 1; c <= width; c++) {
      const value = row.getCell(c).value;
      cells.push(value == null ? "" : String(value).trim());
    }
    rows.push(cells);
  });
  return rows;
}
