const STORAGE_KEY = 'neptune_bot_config';
const DISCLAIMER_KEY = 'neptune_disclaimer_accepted';

export const DEFAULT_CONFIG = {
  apiToken: '',
  appId: '1089',
  simulationMode: false,
  strategyId: 'differs-combo-9',
  currency: 'USD',
  initialStake: 5,
  takeProfit: 100,
  stopLoss: -100,
  maxConsecLoss: 4,
  activeSymbols: ['1HZ100V'],
  tradingLogic: 'analyze', // 'analyze', 'random', 'specific'
  selectedDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  forceSymbolSwitch: true,
  fastExecution: true, // Millisecond Turbo Execution
  decisionInterval: 1,
  postTradeCooldown: 1,
  avoidLastLosingDigit: false,
  avoidLastExitDigit: false,
  useMartingale: true,
  martingaleFactor: 12,
  maxStake: 260,
  soundEffects: true
};

export const loadStoredConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (parsed.apiToken && parsed.apiToken.includes('a9e587db13e86cfdad0bc1aae8af0d9cb004f1777dea2c4bed46cb69fe64977a')) {
      parsed.apiToken = '';
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (e) {
    console.error('Failed to load config from storage', e);
    return DEFAULT_CONFIG;
  }
};

export const saveStoredConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config to storage', e);
  }
};

export const isDisclaimerAccepted = () => {
  return localStorage.getItem(DISCLAIMER_KEY) === 'true';
};

export const setDisclaimerAccepted = () => {
  localStorage.setItem(DISCLAIMER_KEY, 'true');
};
