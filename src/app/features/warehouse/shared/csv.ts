/** Downloads rows as a UTF-8 CSV file that opens correctly in Excel (Arabic included). */
export function downloadCsv(fileName: string, headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): void {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const content = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
