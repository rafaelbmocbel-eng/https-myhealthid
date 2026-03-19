/**
 * Export an array of objects to CSV and trigger download.
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[], columns?: { key: string; label: string }[]) {
  if (!rows.length) return;

  const cols = columns ?? Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  const separator = ';';

  const header = cols.map(c => `"${c.label}"`).join(separator);
  const body = rows.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(separator)
  ).join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
