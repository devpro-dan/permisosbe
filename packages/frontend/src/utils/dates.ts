export function isWeekend(date: string): boolean {
  const day = new Date(date + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(date: string, days: number, feriados?: string[]): string {
  const feriadosSet = new Set(feriados || []);
  const d = new Date(date + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().split('T')[0];
    if (d.getDay() !== 0 && d.getDay() !== 6 && !feriadosSet.has(iso)) {
      added++;
    }
  }
  return d.toISOString().split('T')[0];
}
