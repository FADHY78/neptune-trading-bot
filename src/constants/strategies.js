export const STRATEGY_PRESETS = [
  {
    id: 'differs-combo-9',
    category: 'Differs',
    name: 'Differs Quantum Ultimate (Payout 9%)',
    contractType: 'DIGITDIFF',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 9,
    popular: true,
    symbolRotation: true,
    description: 'High win-rate quantitative DIGITDIFF strategy targeting coldest statistical digits with automated symbol rotation.'
  },
  {
    id: 'matches-sniper-76',
    category: 'Matches',
    name: 'Matches Sniper Pro (Payout ~800% / 8.5x)',
    contractType: 'DIGITMATCH',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 800,
    bulkCount: 1,
    popular: true,
    symbolRotation: false,
    description: 'High-conviction DIGITMATCH sniper powered by the Golden Strike 10/10 Protocol, 6-layer quantum confluence, and millisecond tick dispatch.'
  },
  {
    id: 'even-odd-wave',
    category: 'Even / Odd',
    name: 'Even / Odd Parity Wave (Payout ~95% / 1.95x)',
    contractType: 'DIGITEVEN',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 95,
    popular: true,
    symbolRotation: false,
    description: 'Scans tick streams for even/odd parity persistence waves, Markov run lengths, and oscillator momentum to snipe high-probability even or odd contracts.'
  },
  {
    id: 'over-under-barrier',
    category: 'Over / Under',
    name: 'Over / Under Adaptive Barrier (Payout ~95% - 150%)',
    contractType: 'DIGITOVER',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    barrier: '4',
    payout: 100,
    popular: true,
    symbolRotation: false,
    description: 'User-directed Over or Under barrier strategy. Scans multi-market tick momentum, velocity direction, and distribution skew to snipe high-probability entries.'
  }
];
