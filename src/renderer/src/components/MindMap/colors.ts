/** Fill class per the CMYK ink semantics — cyan/magenta/overprint communicate state, nothing else. */
export function inkFillClass(touched: boolean, dirty: boolean): string {
  if (touched && dirty) return 'fill-ink-overprint'
  if (touched) return 'fill-ink-cyan'
  if (dirty) return 'fill-ink-magenta'
  return 'fill-base-700'
}
