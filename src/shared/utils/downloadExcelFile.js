import { triggerBlobDownload } from "./blobDownload";

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Excel's own "SpreadsheetML" (Excel 2003 XML) format -- the <?mso-application?> processing
// instruction makes Excel open this natively with no format/extension-mismatch warning, unlike a
// CSV or HTML table just renamed to .xls. Needs no third-party library: the only real xlsx-writer
// on npm (SheetJS's `xlsx` package) carries an unpatched high-severity Prototype
// Pollution/ReDoS advisory, not worth taking on for a write-only export that never parses
// untrusted files.
export function downloadExcelFile(fileName, headers, rows) {
  const cell = (value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  const row = (cells) => `<Row>${cells.map(cell).join("")}</Row>`;
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Sheet1">
  <Table>
   ${row(headers)}
   ${rows.map(row).join("\n   ")}
  </Table>
 </Worksheet>
</Workbook>`;

  triggerBlobDownload(new Blob([xml], { type: "application/vnd.ms-excel" }), fileName);
}
