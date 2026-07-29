export function isWeekend(date: string): boolean {
  const day = new Date(date + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      added++;
    }
  }
  return d.toISOString().split('T')[0];
}
