export function exportCsvFile(name: string, headers: string[], rows: any[][]) {
  if (!rows.length) throw Error("No matching records to export.");
  const cell = (v: any) => {
    let text = String(v ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const csv =
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
