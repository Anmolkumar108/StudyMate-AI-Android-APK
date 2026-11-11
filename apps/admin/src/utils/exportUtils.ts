/**
 * Professional Excel & CSV Export Utilities for StudyMate Admin Console
 * Supports formatted Excel SpreadsheetML (.xls) with custom column widths,
 * header styling, alternating row colors, and UTF-8 BOM CSV exports.
 */

export interface ExportColumn {
  header: string;
  key: string;
  width?: number; // In Excel points/pixels (e.g. 120, 180, 240)
  type?: 'String' | 'Number' | 'DateTime';
}

/**
 * Format ISO datetime strings to clean, Excel-friendly readable format: "YYYY-MM-DD HH:MM:SS"
 */
export function formatDateTime(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(val);
  }
}

/**
 * Convert technical action names (e.g. "admin_login_success", "update_support_ticket")
 * into clean, readable labels ("Admin Login Success", "Update Support Ticket")
 */
export function formatActionLabel(action: string | null | undefined): string {
  if (!action) return '—';
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Escape XML special characters to prevent malformed SpreadsheetML
 */
function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape CSV cell value according to RFC 4180
 */
function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Trigger download of a Blob with the specified filename
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export data to formatted Excel SpreadsheetML (.xls)
 * Opens in Microsoft Excel with generous column widths, styled header row,
 * and readable fonts without truncating or clipping content.
 */
export function exportToExcel({
  filename,
  sheetName = 'Sheet1',
  columns,
  rows,
}: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
}): void {
  const cleanFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`;

  const columnsXml = columns
    .map((c) => `<Column ss:Width="${c.width || 140}" ss:AutoFitWidth="1"/>`)
    .join('\n      ');

  const headersXml = columns
    .map(
      (c) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`
    )
    .join('\n        ');

  const rowsXml = rows
    .map((row, idx) => {
      const styleId = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
      const cellsXml = columns
        .map((c) => {
          const rawVal = row[c.key];
          const isNum = typeof rawVal === 'number';
          const type = isNum ? 'Number' : 'String';
          const val = escapeXml(rawVal ?? '');
          return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${val}</Data></Cell>`;
        })
        .join('\n        ');

      return `      <Row ss:Height="24">\n        ${cellsXml}\n      </Row>`;
    })
    .join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>StudyMate AI Administrative Platform</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0284C7"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowEven">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowOdd">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table ss:DefaultRowHeight="22">
   ${columnsXml}
   <Row ss:Height="28" ss:StyleID="Header">
    ${headersXml}
   </Row>
${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, cleanFilename);
}

/**
 * Export data to clean UTF-8 CSV with BOM (\uFEFF)
 * Ensures Excel on Windows correctly detects character encoding and prevents corruption.
 */
export function exportToCsv({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
}): void {
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const headerLine = columns.map((c) => escapeCsv(c.header)).join(',');
  const rowLines = rows.map((row) =>
    columns.map((c) => escapeCsv(row[c.key] ?? '')).join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, cleanFilename);
}

