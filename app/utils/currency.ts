export function convertToMinorUnits(amount: number | string): string {
  return Math.round(Number(amount) * 100).toString();
}
