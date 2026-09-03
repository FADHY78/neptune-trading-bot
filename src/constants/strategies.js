export const STRATEGY_PRESETS = [
  {
    id: 'differs-combo-9',
    category: 'Differs Strategies',
    name: 'Differs 15 Combo Ultimate (Payout 9%)',
    contractType: 'DIGITDIFF',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 9,
    symbolRotation: true,
    description: 'Trades DIGITDIFF on all digits 0-9. High win rate strategy with symbol rotation on loss.'
  },
  {
    id: 'differs-contraction-9',
    category: 'Differs Strategies',
    name: 'Differs Contraction Connector (Payout 9%)',
    contractType: 'DIGITDIFF',
    digits: [1, 2, 4, 5, 7, 8],
    payout: 9,
    symbolRotation: true,
    description: 'Analyzes market volatility contractions before placing DIGITDIFF contracts.'
  },
  {
    id: 'differs-combo-5',
    category: 'Differs Strategies',
    name: 'Differs 15 Combo Ultimate (Payout 5%)',
    contractType: 'DIGITDIFF',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 5,
    symbolRotation: true,
    description: 'Lower payout setting designed for higher contract safety buffers.'
  },
  {
    id: 'differs-middle5-9',
    category: 'Differs Strategies',
    name: 'Differs The Middle 5 Filter (Payout 9%)',
    contractType: 'DIGITDIFF',
    digits: [3, 4, 5, 6, 7],
    payout: 9,
    symbolRotation: true,
    description: 'Filters and trades specifically on middle range digits (3-7).'
  },
  {
    id: 'matches-sniper-76',
    category: 'Matches Strategies',
    name: 'Matches Sniper Pro (Payout ~800% / 8.5x)',
    contractType: 'DIGITMATCH',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 800,
    bulkCount: 1,
    popular: true,
    symbolRotation: false,
    description: 'High-conviction DIGITMATCH sniper powered by the Golden Strike 10/10 Protocol, Laplace-smoothed 3-Gram Markov transitions, exponential time-decay momentum, tick acceleration, and harmonic gap recurrence.'
  },
  {
    id: 'matches-dual-bulk',
    category: 'Bulk Strategies',
    name: 'Matches Dual-Cluster Bulk Matrix (Payout ~350% Net)',
    contractType: 'DIGITMATCH',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 350,
    bulkCount: 2,
    popular: true,
    symbolRotation: false,
    description: 'Ultra-strong dual-cluster DIGITMATCH strategy with Golden Strike 10/10 Protocol placing simultaneous contracts on the top 2 quantum digits. Delivers ~350% net ROI on any hit with multi-market confluence.'
  },
  {
    id: 'matches-triple-bulk',
    category: 'Bulk Strategies',
    name: 'Matches Triple-Hedge Bulk Blitz (Payout ~180% Net)',
    contractType: 'DIGITMATCH',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 180,
    bulkCount: 3,
    popular: true,
    symbolRotation: false,
    description: 'Maximum-probability bulk hedging strategy with Golden Strike 10/10 Protocol purchasing DIGITMATCH contracts across the top 3 statistical cluster digits for peak win frequency and +180% pure profit.'
  },
  {
    id: 'fold-max-over',
    category: 'Fold Strategies',
    name: 'Fold Max Over (Payout Rate 9% up to 70%)',
    contractType: 'DIGITOVER',
    digits: [4, 5, 6, 7, 8],
    barrier: '4',
    payout: 9,
    popular: true,
    symbolRotation: true,
    description: 'Popular high-frequency strategy purchasing DIGITOVER contracts with adaptive barrier levels.'
  },
  {
    id: 'custom-config',
    category: 'Custom',
    name: 'Custom Configuration',
    contractType: 'DIGITDIFF',
    digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payout: 9,
    symbolRotation: false,
    description: 'Fully customizable logic allowing manual selection of digit targets, barriers, and timing.'
  }
];
