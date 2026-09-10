import type ExcelJS from "exceljs";

// Sizes each column so its header is fully visible on first open,
// bolds and wraps the header row (as a safety net if a user narrows
// a column manually), and freezes the header row so it stays put
// when scrolling. Existing widths are preserved when they are wider
// than the header requires -- e.g. "Feedback"/"Comments" columns
// that intentionally get width: 40 for prose stay that wide.
//
// Call once, after sheet.columns and sheet.addRow() have been set up
// and before the workbook is written.
export function finaliseTemplateSheet(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((col) => {
    if (!col) return;
    const header =
      typeof col.header === "string"
        ? col.header
        : Array.isArray(col.header)
          ? col.header.join(" ")
          : "";
    // +2 so the header does not butt right up to the column edge.
    const needed = header.length + 2;
    const current = col.width ?? 0;
    if (needed > current) col.width = needed;
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };

  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
