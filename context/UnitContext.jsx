import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../utils/database';
import { makeFormatters } from '../utils/units';

const UnitContext = createContext(null);

export function UnitProvider({ children }) {
  const [unit, setUnitState] = useState('kg');

  useEffect(() => {
    getSetting('weight_unit', 'kg').then(v => setUnitState(v === 'lb' ? 'lb' : 'kg')).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    ...makeFormatters(unit),
    setUnit: async u => {
      const next = u === 'lb' ? 'lb' : 'kg';
      setUnitState(next);
      await setSetting('weight_unit', next);
    },
  }), [unit]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnit() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnit must be used within UnitProvider');
  return ctx;
}
