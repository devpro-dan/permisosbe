export function formatDate(v: string | undefined | null): string {
  if (!v) return '-';
  const [y, m, d] = v.split('T')[0].split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(v: string | undefined | null): string {
  if (!v) return '-';
  const datePart = v.split('T')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}
