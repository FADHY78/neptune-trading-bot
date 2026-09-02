import { derivApi } from './derivWs.js';
import { STRATEGY_PRESETS } from '../constants/strategies.js';
import { getSymbolDisplayName } from '../constants/symbols.js';
import { sound } from './sound.js';

export class NeptuneBotEngine {
  constructor() {
    this.running = false;
    this.paused = false;
    this.config = null;
    
    // Trading Stats
    this.sessionPnL = 0;
    this.tradeCount = 0;
    this.wins = 0;
    this.losses = 0;
    this.consecutiveLosses = 0;
    this.currentStreak = { type: 'NONE', count: 0 };
    this.currentStake = 5;
    this.lastExitDigit = null;
    this.lastLosingDigit = null;
    this.symbolIndex = 0;
    
    // Digit Frequency Stats (last 100 ticks)
    this.recentTickDigits = [];
    this.digitCounts = Array(10).fill(0);
    
    // Terminal Logs
    this.logs = [];
    
    // Listeners
    this.subscribers = new Set();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach(fn => {
      try { fn(state); } catch(e) { console.error('Error notifying subscriber:', e); }
    });
  }

  getState() {
    return {
      running: this.running,
      paused: this.paused,
      sessionPnL: this.sessionPnL,
      tradeCount: this.tradeCount,
      wins: this.wins,
      losses: this.losses,
      consecutiveLosses: this.consecutiveLosses,
      currentStreak: this.currentStreak,
      currentStake: this.currentStake,
      lastExitDigit: this.lastExitDigit,
      digitCounts: [...this.digitCounts],
      logs: [...this.logs]
    };
  }

  log(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const entry = { id: Date.now() + Math.random(), timestamp, text, type };
    this.logs.push(entry);
    
    // Keep max 500 logs
    if (this.logs.length > 500) {
      this.logs.shift();
    }
    
    this.notify();
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  resetSession() {
    this.sessionPnL = 0;
    this.tradeCount = 0;
    this.wins = 0;
    this.losses = 0;
    this.consecutiveLosses = 0;
    this.currentStreak = { type: 'NONE', count: 0 };
    this.currentStake = this.config ? Number(this.config.initialStake) : 5;
    this.lastExitDigit = null;
    this.lastLosingDigit = null;
    this.log('Session metrics & trade counters reset.', 'info');
  }

  recordTickDigit(digit) {
    if (typeof digit !== 'number' || isNaN(digit)) return;
    this.recentTickDigits.push(digit);
    if (this.recentTickDigits.length > 100) {
      this.recentTickDigits.shift();
    }
    
    // Recompute counts
    const counts = Array(10).fill(0);
    this.recentTickDigits.forEach(d => {
      if (d >= 0 && d <= 9) counts[d]++;
    });
    this.digitCounts = counts;
    this.notify();
  }

  start(config) {
    if (this.running) return;
    this.config = config;
    this.running = true;
    this.paused = false;
    this.currentStake = Number(config.initialStake) || 5;

    const modeText = config.simulationMode ? 'SIMULATOR MODE (No Token Required)' : 'DERIV LIVE WS MODE';
    this.log(`Starting Neptune Trading Bot [${modeText}]...`, 'purchasing');

    const strat = STRATEGY_PRESETS.find(s => s.id === config.strategyId) || STRATEGY_PRESETS[0];
    this.log(`Selected Strategy: ${strat.name}`, 'info');
    this.log(`Initial Stake: $${this.currentStake.toFixed(2)} | Take Profit: $${config.takeProfit} | Stop Loss: $${config.stopLoss}`, 'info');

    // Subscribe to Deriv tick stream if online
    if (!config.simulationMode && derivApi.connected) {
      const activeSymbols = config.activeSymbols || ['1HZ100V'];
      activeSymbols.forEach(sym => derivApi.subscribeTick(sym));
      derivApi.on('onTick', (tickData) => this.recordTickDigit(tickData.lastDigit));
    }

    // Start Trading Loop
    this.runLoop();
  }

  stop(reason = 'User stopped trading bot.') {
    if (!this.running) return;
    this.running = false;
    this.log(`BOT STOPPED: ${reason}`, 'alert');
    this.notify();
  }

  async runLoop() {
    while (this.running) {
      if (this.paused) {
        await this.sleep(1000);
        continue;
      }

      // Check Take Profit & Stop Loss
      if (this.sessionPnL >= Number(this.config.takeProfit)) {
        if (this.config.soundEffects) sound.playWin();
        this.stop(`🎯 TAKE PROFIT TARGET REACHED! (P&L: +$${this.sessionPnL.toFixed(2)})`);
        break;
      }

      if (this.sessionPnL <= Number(this.config.stopLoss)) {
        if (this.config.soundEffects) sound.playLoss();
        this.stop(`🛑 STOP LOSS TRIGGERED. (P&L: -$${Math.abs(this.sessionPnL).toFixed(2)})`);
        break;
      }

      if (this.consecutiveLosses >= Number(this.config.maxConsecLoss)) {
        if (this.config.soundEffects) sound.playLoss();
        this.stop(`⚠️ MAX CONSECUTIVE LOSS LIMIT (${this.config.maxConsecLoss}) REACHED.`);
        break;
      }

      // Select symbol & digit
      const symbol = this.selectNextSymbol();
      const strat = STRATEGY_PRESETS.find(s => s.id === this.config.strategyId) || STRATEGY_PRESETS[0];
      const targetDigit = this.selectDigit(strat);

      // Filters
      if (this.config.avoidLastExitDigit && targetDigit === this.lastExitDigit) {
        this.log(`Filter: Skipping target digit ${targetDigit} (matches last exit digit).`, 'cooldown');
        await this.sleep(1000);
        continue;
      }

      if (this.config.avoidLastLosingDigit && targetDigit === this.lastLosingDigit) {
        this.log(`Filter: Skipping target digit ${targetDigit} (matches last losing digit).`, 'cooldown');
        await this.sleep(1000);
        continue;
      }

      // Execute Trade
      const symbolName = getSymbolDisplayName(symbol, derivApi.availableSymbols);
      this.log(`PURCHASING ON ${symbol} (${symbolName}) | Contract: ${strat.contractType} | Target: ${targetDigit} | Stake: $${this.currentStake.toFixed(2)}`, 'purchasing');
      
      let result;
      if (this.config.simulationMode) {
        result = await this.simulateTrade(symbol, strat, targetDigit, this.currentStake);
      } else {
        result = await this.executeLiveTrade(symbol, strat, targetDigit, this.currentStake);
      }

      if (!this.running) break;

      // If trade failed due to network/API error, pause and retry next cycle without taking false loss or applying Martingale
      if (result.error) {
        this.log(`Trade skipped: ${result.message}. Pausing for 5s...`, 'cooldown');
        await this.sleep(5000);
        continue;
      }

      // Handle Result
      this.handleTradeResult(result, strat);

      // Refresh live balance after trade completion
      if (!this.config.simulationMode) {
        derivApi.checkServerSession().catch(() => {});
      }

      // Cooldown
      const cooldownSec = Number(this.config.postTradeCooldown) || 5;
      if (cooldownSec > 0 && this.running) {
        this.log(`Cooldown for ${cooldownSec}s...`, 'cooldown');
        await this.sleep(cooldownSec * 1000);
      }

      // Symbol rotation
      if (this.config.forceSymbolSwitch) {
        this.symbolIndex = (this.symbolIndex + 1) % (this.config.activeSymbols?.length || 1);
      }
    }
  }

  selectNextSymbol() {
    const active = this.config.activeSymbols && this.config.activeSymbols.length > 0
      ? this.config.activeSymbols
      : ['1HZ100V'];
    return active[this.symbolIndex % active.length];
  }

  selectDigit(strat) {
    const digits = strat.digits || [0,1,2,3,4,5,6,7,8,9];

    if (this.config.tradingLogic === 'specific') {
      const selected = this.config.selectedDigits || [4];
      return selected[Math.floor(Math.random() * selected.length)];
    }

    if (this.config.tradingLogic === 'random') {
      return digits[Math.floor(Math.random() * digits.length)];
    }

    // Analyze Mode: frequency-based selection tailored to strategy type
    if (this.digitCounts.some(c => c > 0)) {
      if (strat.contractType === 'DIGITDIFF') {
        // Differs: Target the least frequent digit (coldest)
        let minCount = Infinity;
        let candidate = digits[0];
        digits.forEach(d => {
          if (this.digitCounts[d] < minCount) {
            minCount = this.digitCounts[d];
            candidate = d;
          }
        });
        return candidate;
      } else if (strat.contractType === 'DIGITMATCH') {
        // Matches: Target the most frequent digit (hottest)
        let maxCount = -1;
        let candidate = digits[0];
        digits.forEach(d => {
          if (this.digitCounts[d] > maxCount) {
            maxCount = this.digitCounts[d];
            candidate = d;
          }
        });
        return candidate;
      }
    }

    return digits[Math.floor(Math.random() * digits.length)];
  }

  async simulateTrade(symbol, strat, targetDigit, stake) {
    // Simulate trade ticks
    await this.sleep(1500);

    const exitDigit = Math.floor(Math.random() * 10);
    this.recordTickDigit(exitDigit);

    let won = false;
    let payoutRate = (strat.payout || 9) / 100;

    if (strat.contractType === 'DIGITDIFF') {
      won = (exitDigit !== targetDigit);
    } else if (strat.contractType === 'DIGITMATCH') {
      won = (exitDigit === targetDigit);
    } else if (strat.contractType === 'DIGITOVER') {
      const barrier = parseInt(strat.barrier || '4', 10);
      won = (exitDigit > barrier);
    } else if (strat.contractType === 'DIGITUNDER') {
      const barrier = parseInt(strat.barrier || '4', 10);
      won = (exitDigit < barrier);
    } else {
      won = (exitDigit !== targetDigit);
    }

    const profit = won ? (stake * payoutRate) : (-stake);

    return {
      won,
      profit,
      exitDigit,
      exitTick: `1245.${Math.floor(100 + Math.random()*800)}${exitDigit}`,
      contractId: Math.floor(100000000 + Math.random()*900000000)
    };
  }

  async executeLiveTrade(symbol, strat, targetDigit, stake) {
    try {
      // Determine barrier based on strategy contract type
      let barrier = targetDigit;
      if (strat.contractType === 'DIGITOVER' || strat.contractType === 'DIGITUNDER') {
        barrier = strat.barrier !== undefined ? strat.barrier : (this.config.barrier !== undefined ? this.config.barrier : 4);
      }

      const buyRes = await derivApi.buyContract({
        symbol,
        contractType: strat.contractType,
        stake,
        barrier: barrier
      });

      const contractId = buyRes.contract_id || buyRes.contractId;
      this.log(`Contract purchase confirmed! ID: ${contractId}`, 'info');

      // Refresh live balance in background after contract purchase
      derivApi.checkServerSession().catch(() => {});

      // If already resolved by the server proxy (Digit Atlas pattern)
      if (buyRes.won !== undefined && buyRes.profit !== undefined) {
        return {
          won: buyRes.won,
          profit: buyRes.profit,
          exitDigit: buyRes.exitDigit,
          exitTick: buyRes.exitTick,
          contractId: contractId
        };
      }

      // Wait for proposal open contract result (in direct WS mode)
      return new Promise((resolve) => {
        const handler = (res) => {
          if (res.contractId === contractId) {
            derivApi.off('onContractResult', handler);
            resolve({
              won: res.won,
              profit: res.profit,
              exitDigit: res.exitDigit,
              exitTick: res.exitTick,
              contractId: res.contractId
            });
          }
        };
        derivApi.on('onContractResult', handler);
      });
    } catch (e) {
      this.log(`Contract Execution Error: ${e.message}`, 'alert');
      return { error: true, message: e.message };
    }
  }

  handleTradeResult(result, strat) {
    this.tradeCount++;
    this.lastExitDigit = result.exitDigit;
    this.sessionPnL += result.profit;

    if (result.won) {
      this.wins++;
      this.consecutiveLosses = 0;
      if (this.currentStreak.type === 'WIN') {
        this.currentStreak.count++;
      } else {
        this.currentStreak = { type: 'WIN', count: 1 };
      }

      if (this.config.soundEffects) sound.playWin();

      this.log(
        `CONTRACT WON! | Profit: +$${result.profit.toFixed(2)} | Total P&L: $${this.sessionPnL.toFixed(2)} | Exit Digit: ${result.exitDigit}`,
        'won'
      );

      // Reset stake on win
      this.currentStake = Number(this.config.initialStake) || 5;
    } else {
      this.losses++;
      this.consecutiveLosses++;
      this.lastLosingDigit = result.exitDigit;

      if (this.currentStreak.type === 'LOSS') {
        this.currentStreak.count++;
      } else {
        this.currentStreak = { type: 'LOSS', count: 1 };
      }

      if (this.config.soundEffects) sound.playLoss();

      // Martingale Calculation
      if (this.config.useMartingale) {
        const factor = Number(this.config.martingaleFactor) || 12;
        const maxStake = Number(this.config.maxStake) || 260;
        const nextStake = Math.min(this.currentStake * factor, maxStake);
        
        this.log(
          `CONTRACT LOST | Loss: -$${Math.abs(result.profit).toFixed(2)} | Exit Digit: ${result.exitDigit} | Martingale: Next Stake $${nextStake.toFixed(2)}`,
          'lost'
        );
        this.currentStake = nextStake;
      } else {
        this.log(
          `CONTRACT LOST | Loss: -$${Math.abs(result.profit).toFixed(2)} | Exit Digit: ${result.exitDigit}`,
          'lost'
        );
      }
    }

    this.notify();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const botEngine = new NeptuneBotEngine();
