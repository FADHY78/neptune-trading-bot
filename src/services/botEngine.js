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
    this.symbolTickBuffers = new Map();
    this.symbolDigitCounts = new Map();
    this.activeSymbol = '1HZ100V';
    
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

  recordTickDigit(digit, symbol = this.activeSymbol || '1HZ100V') {
    if (typeof digit !== 'number' || isNaN(digit)) return;
    
    // 1. Update main recent ticks
    this.recentTickDigits.push(digit);
    if (this.recentTickDigits.length > 100) {
      this.recentTickDigits.shift();
    }
    const counts = Array(10).fill(0);
    this.recentTickDigits.forEach(d => {
      if (d >= 0 && d <= 9) counts[d]++;
    });
    this.digitCounts = counts;

    // 2. Update per-symbol buffer
    if (symbol) {
      if (!this.symbolTickBuffers.has(symbol)) {
        this.symbolTickBuffers.set(symbol, []);
      }
      const buf = this.symbolTickBuffers.get(symbol);
      buf.push(digit);
      if (buf.length > 100) buf.shift();

      const sCounts = Array(10).fill(0);
      buf.forEach(d => {
        if (d >= 0 && d <= 9) sCounts[d]++;
      });
      this.symbolDigitCounts.set(symbol, sCounts);
    }

    this.notify();
  }

  loadHistoricalDigits(digits, symbol = this.activeSymbol || '1HZ100V') {
    if (!Array.isArray(digits) || digits.length === 0) return;
    const clean = digits.slice(-100);

    if (symbol) {
      this.symbolTickBuffers.set(symbol, clean);
      const sCounts = Array(10).fill(0);
      clean.forEach(d => {
        if (typeof d === 'number' && d >= 0 && d <= 9) sCounts[d]++;
      });
      this.symbolDigitCounts.set(symbol, sCounts);
    }

    this.recentTickDigits = clean;
    const counts = Array(10).fill(0);
    this.recentTickDigits.forEach(d => {
      if (typeof d === 'number' && d >= 0 && d <= 9) counts[d]++;
    });
    this.digitCounts = counts;
    this.log(`Loaded ${clean.length} live ticks for ${symbol || 'market'}.`, 'info');
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

    // Ensure live ticks are subscribed for all active symbols
    if (!config.simulationMode && derivApi.connected) {
      const activeSymbols = config.activeSymbols || ['1HZ100V'];
      activeSymbols.forEach(sym => derivApi.subscribeTick(sym));
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
      let symbol = this.selectNextSymbol();
      const strat = STRATEGY_PRESETS.find(s => s.id === this.config.strategyId) || STRATEGY_PRESETS[0];
      let targetDigit = this.selectDigit(strat);

      // Multi-Market Quantum Scanner for DIGITMATCH (Matches Sniper Pro)
      if (strat.contractType === 'DIGITMATCH' && this.config.tradingLogic !== 'specific') {
        const activeSyms = this.config.activeSymbols && this.config.activeSymbols.length > 0 
          ? this.config.activeSymbols 
          : ['1HZ100V', '1HZ75V', '1HZ50V', '1HZ25V', '1HZ10V'];

        const bestOpp = this.scanAllSymbolsForBestMatch(activeSyms, strat.digits || [0,1,2,3,4,5,6,7,8,9]);

        if (!bestOpp.confirmed && this.recentTickDigits.length >= 10) {
          const symName = getSymbolDisplayName(bestOpp.symbol, derivApi.availableSymbols);
          this.log(`🎯 Matches Quantum Radar: Scanning [${activeSyms.length} markets] — Best setup: ${symName} digit ${bestOpp.digit} (${bestOpp.confidence}% conf). Awaiting confluence trigger...`, 'cooldown');
          await this.sleep(1000);
          continue;
        }

        // Lock in the highest probability market & digit
        symbol = bestOpp.symbol;
        targetDigit = bestOpp.digit;
      }

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
      if (this.config.forceSymbolSwitch && strat.contractType !== 'DIGITMATCH') {
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

  /**
   * Quantum Statistical Multi-Model Evaluator for DIGITMATCH
   * Evaluates:
   * 1. 2-Gram & 1-Gram Markov Chain Transition Matrices
   * 2. Digit Delta / Velocity Oscillation Matrix
   * 3. Micro-Burst Volatility Clustering (last 10 ticks)
   * 4. Double-Tap / Repetition Inertia
   */
  evaluateMatchesModel(ticks, allowedDigits = [0,1,2,3,4,5,6,7,8,9]) {
    if (!Array.isArray(ticks) || ticks.length < 6) {
      return { digit: allowedDigits[0], confidence: 10, confirmed: false, score: 0, lastDigit: '-' };
    }

    const total = ticks.length;
    const last1 = ticks[total - 1];
    const last2 = ticks[total - 2];
    const last3 = ticks[total - 3];

    // Model 1: 2-Gram & 1-Gram Markov Transitions
    const markov2Counts = Array(10).fill(0);
    let markov2Total = 0;
    const markov1Counts = Array(10).fill(0);
    let markov1Total = 0;

    for (let i = 0; i < total - 2; i++) {
      if (ticks[i] === last2 && ticks[i + 1] === last1) {
        const next = ticks[i + 2];
        if (next >= 0 && next <= 9) {
          markov2Counts[next]++;
          markov2Total++;
        }
      }
    }

    for (let i = 0; i < total - 1; i++) {
      if (ticks[i] === last1) {
        const next = ticks[i + 1];
        if (next >= 0 && next <= 9) {
          markov1Counts[next]++;
          markov1Total++;
        }
      }
    }

    // Model 2: Digit Delta Velocity ((D_t - D_{t-1} + 10) % 10)
    const deltaCounts = Array(10).fill(0);
    let totalDeltas = 0;
    for (let i = Math.max(0, total - 20); i < total - 1; i++) {
      const d = (ticks[i + 1] - ticks[i] + 10) % 10;
      deltaCounts[d]++;
      totalDeltas++;
    }
    let dominantDelta = 0;
    let dominantDeltaCount = -1;
    deltaCounts.forEach((c, delta) => {
      if (c > dominantDeltaCount) {
        dominantDeltaCount = c;
        dominantDelta = delta;
      }
    });
    const deltaPredictedDigit = (last1 + dominantDelta) % 10;

    // Model 3: Micro-Burst Window (Last 10 ticks)
    const micro10 = ticks.slice(-10);
    const microCounts = Array(10).fill(0);
    micro10.forEach(d => { if (d >= 0 && d <= 9) microCounts[d]++; });

    // Model 4: Macro Frequency
    const macroCounts = Array(10).fill(0);
    ticks.forEach(d => { if (d >= 0 && d <= 9) macroCounts[d]++; });

    // Model 5: Double-Tap Inertia
    const isDoubleTap = (last1 === last2) || (last1 === last3);

    // Multi-Model Composite Scoring
    let bestDigit = allowedDigits[0];
    let highestScore = -1;

    allowedDigits.forEach(d => {
      const sMarkov2 = markov2Total > 0 ? (markov2Counts[d] / markov2Total) : 0;
      const sMarkov1 = markov1Total > 0 ? (markov1Counts[d] / markov1Total) : 0.1;
      const sDelta = (d === deltaPredictedDigit && totalDeltas > 0) ? (dominantDeltaCount / totalDeltas) : 0;
      const sMicro = microCounts[d] / Math.max(micro10.length, 1);
      const sMacro = macroCounts[d] / Math.max(ticks.length, 1);
      const sRepeat = (isDoubleTap && d === last1) ? 0.15 : (micro10.slice(-3).includes(d) ? 0.05 : 0);

      const compositeScore = 
        (sMarkov2 * 0.35) +
        (sMarkov1 * 0.25) +
        (sDelta * 0.20) +
        (sMicro * 0.15) +
        (sMacro * 0.05) +
        sRepeat;

      if (compositeScore > highestScore) {
        highestScore = compositeScore;
        bestDigit = d;
      }
    });

    const confidence = Math.min(Math.round(highestScore * 100 * 2.6), 99);
    const hasMarkov2 = markov2Counts[bestDigit] >= 2;
    const hasBurst = microCounts[bestDigit] >= 3;
    const hasHighConfidence = highestScore >= 0.30;
    const confirmed = hasMarkov2 || hasBurst || hasHighConfidence || total < 15;

    return {
      digit: bestDigit,
      confidence,
      confirmed,
      score: highestScore,
      lastDigit: last1
    };
  }

  scanAllSymbolsForBestMatch(activeSymbols, stratDigits) {
    let bestCandidate = null;

    activeSymbols.forEach(sym => {
      const ticks = this.symbolTickBuffers.get(sym) || (sym === this.activeSymbol ? this.recentTickDigits : []);
      if (ticks.length >= 6) {
        const evalRes = this.evaluateMatchesModel(ticks, stratDigits);
        if (!bestCandidate || evalRes.score > bestCandidate.score) {
          bestCandidate = {
            symbol: sym,
            ...evalRes
          };
        }
      }
    });

    if (!bestCandidate) {
      const fallbackSym = activeSymbols[0] || '1HZ100V';
      const evalRes = this.evaluateMatchesModel(this.recentTickDigits, stratDigits);
      return { symbol: fallbackSym, ...evalRes };
    }

    return bestCandidate;
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

    // Analyze Mode: Statistical Frequency & Absence Analysis
    if (this.digitCounts.some(c => c > 0)) {
      if (strat.contractType === 'DIGITDIFF') {
        // In Differs: We WIN when the exit digit is DIFFERENT from our target digit.
        // Highest probability: target the COLDEST digit (lowest frequency in last 100 ticks).
        // Tie-breaker: pick the digit absent for the longest duration (oldest last index).
        let minCount = Infinity;
        let candidates = [];
        digits.forEach(d => {
          const count = this.digitCounts[d] || 0;
          if (count < minCount) {
            minCount = count;
            candidates = [d];
          } else if (count === minCount) {
            candidates.push(d);
          }
        });

        if (candidates.length === 1) return candidates[0];

        // Break tie by selecting digit with longest absence
        let oldestIndex = Infinity;
        let bestCandidate = candidates[0];
        candidates.forEach(cand => {
          const lastIdx = this.recentTickDigits.lastIndexOf(cand);
          if (lastIdx < oldestIndex) {
            oldestIndex = lastIdx;
            bestCandidate = cand;
          }
        });
        return bestCandidate;
      } else if (strat.contractType === 'DIGITMATCH') {
        // Matches Sniper: Markov Transition & Micro-Burst Optimization
        const sniper = this.analyzeMatchesSniper(digits);
        return sniper.digit;
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
    if (!result || result.error) return;
    const profit = Number(result.profit) || 0;
    const exitDigit = result.exitDigit !== undefined && result.exitDigit !== null ? result.exitDigit : (result.exitTick ? parseInt(String(result.exitTick).slice(-1), 10) : '-');
    const won = Boolean(result.won);

    this.tradeCount++;
    this.lastExitDigit = exitDigit;
    this.sessionPnL += profit;

    if (!this.currentStreak) {
      this.currentStreak = { type: 'NONE', count: 0 };
    }

    if (won) {
      this.wins++;
      this.consecutiveLosses = 0;
      if (this.currentStreak.type === 'WIN') {
        this.currentStreak.count++;
      } else {
        this.currentStreak = { type: 'WIN', count: 1 };
      }

      if (this.config.soundEffects) sound.playWin();

      this.log(
        `CONTRACT WON! | Profit: +$${profit.toFixed(2)} | Total P&L: $${this.sessionPnL.toFixed(2)} | Exit Digit: ${exitDigit}`,
        'won'
      );

      // Reset stake on win
      this.currentStake = Number(this.config.initialStake) || 5;
    } else {
      this.losses++;
      this.consecutiveLosses++;
      this.lastLosingDigit = exitDigit;

      if (this.currentStreak.type === 'LOSS') {
        this.currentStreak.count++;
      } else {
        this.currentStreak = { type: 'LOSS', count: 1 };
      }

      if (this.config.soundEffects) sound.playLoss();

      // Martingale Calculation
      if (this.config.useMartingale) {
        let factor = Number(this.config.martingaleFactor) || 12;
        // For DIGITMATCH (~800% payout / 8.5x), adaptive 1.3x multiplier is mathematically optimal
        if (strat.contractType === 'DIGITMATCH') {
          factor = Math.min(factor, 1.3);
        }
        const maxStake = Number(this.config.maxStake) || 260;
        const nextStake = Math.min(this.currentStake * factor, maxStake);
        
        this.log(
          `CONTRACT LOST | Loss: -$${Math.abs(profit).toFixed(2)} | Exit Digit: ${exitDigit} | ${strat.contractType === 'DIGITMATCH' ? 'Adaptive Recovery (8x Payout)' : 'Martingale'}: Next Stake $${nextStake.toFixed(2)}`,
          'lost'
        );
        this.currentStake = nextStake;
      } else {
        this.log(
          `CONTRACT LOST | Loss: -$${Math.abs(profit).toFixed(2)} | Exit Digit: ${exitDigit}`,
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
