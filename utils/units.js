// All weights are STORED in kilograms (SQLite + Supabase). Pounds are only a display/input conversion.
export const KG_PER_LB = 0.45359237;

export const kgToUnit = (kg, unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
export const unitToKg = (value, unit) => (unit === 'lb' ? value * KG_PER_LB : value);

const round1 = v => Math.round(v * 10) / 10;

export function makeFormatters(unit) {
  const valid = n => typeof n === 'number' && isFinite(n);
  return {
    unit,
    // "62.5 kg" / "135 lb"; bare=true drops the unit
    fmtW: (kg, bare = false) => {
      if (!valid(Number(kg)) || kg == null) return '—';
      const v = round1(kgToUnit(Number(kg), unit));
      return bare ? String(v) : `${v} ${unit}`;
    },
    // volume with k notation: "1.2k lb"
    fmtVol: (kg, bare = false) => {
      const v = kgToUnit(Number(kg) || 0, unit);
      const s = v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v));
      return bare ? s : `${s} ${unit}`;
    },
    // text for a weight <TextInput>; empty when no weight
    inputStr: kg => (!kg || kg <= 0 ? '' : String(round1(kgToUnit(Number(kg), unit)))),
    // text typed by the user -> kilograms for storage (0 if empty/invalid)
    parseKg: str => {
      const n = parseFloat(String(str == null ? '' : str).replace(',', '.'));
      return n > 0 ? unitToKg(n, unit) : 0;
    },
    toDisp: kg => (kg == null ? null : kgToUnit(Number(kg), unit)),
  };
}
