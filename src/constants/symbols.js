export const DERIV_SYMBOLS = [
  // 1-Second Volatility Indices
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', defaultChecked: true, category: 'Continuous (1s)' },
  { symbol: '1HZ150V', name: 'Volatility 150 (1s) Index', category: 'Continuous (1s)' },
  { symbol: '1HZ250V', name: 'Volatility 250 (1s) Index', category: 'Continuous (1s)' },

  // Standard Volatility Indices
  { symbol: 'R_10', name: 'Volatility 10 Index', category: 'Continuous' },
  { symbol: 'R_25', name: 'Volatility 25 Index', category: 'Continuous' },
  { symbol: 'R_50', name: 'Volatility 50 Index', category: 'Continuous' },
  { symbol: 'R_75', name: 'Volatility 75 Index', category: 'Continuous' },
  { symbol: 'R_100', name: 'Volatility 100 Index', category: 'Continuous' },

  // Jump Indices
  { symbol: 'JD10', name: 'Jump 10 Index', category: 'Jump Indices' },
  { symbol: 'JD25', name: 'Jump 25 Index', category: 'Jump Indices' },
  { symbol: 'JD50', name: 'Jump 50 Index', category: 'Jump Indices' },
  { symbol: 'JD75', name: 'Jump 75 Index', category: 'Jump Indices' },
  { symbol: 'JD100', name: 'Jump 100 Index', category: 'Jump Indices' },

  // Step Indices
  { symbol: 'stpRNG', name: 'Step Index', category: 'Step Indices' },
  { symbol: 'stpRNG2', name: 'Step Index 200', category: 'Step Indices' },
  { symbol: 'stpRNG5', name: 'Step Index 500', category: 'Step Indices' },

  // Crash / Boom Indices
  { symbol: 'BOOM300N', name: 'Boom 300 Index', category: 'Crash / Boom' },
  { symbol: 'BOOM500', name: 'Boom 500 Index', category: 'Crash / Boom' },
  { symbol: 'BOOM1000', name: 'Boom 1000 Index', category: 'Crash / Boom' },
  { symbol: 'CRASH300N', name: 'Crash 300 Index', category: 'Crash / Boom' },
  { symbol: 'CRASH500', name: 'Crash 500 Index', category: 'Crash / Boom' },
  { symbol: 'CRASH1000', name: 'Crash 1000 Index', category: 'Crash / Boom' }
];

export const getSymbolDisplayName = (symbol, dynamicSymbols = []) => {
  if (dynamicSymbols && dynamicSymbols.length > 0) {
    const dynamicMatch = dynamicSymbols.find(s => s.symbol === symbol);
    if (dynamicMatch && (dynamicMatch.display_name || dynamicMatch.name)) {
      return dynamicMatch.display_name || dynamicMatch.name;
    }
  }
  const defaultMatch = DERIV_SYMBOLS.find(s => s.symbol === symbol);
  return defaultMatch ? defaultMatch.name : symbol;
};
