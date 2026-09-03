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

  recordTickDigit(digit, symbol = this.activeSymbol || '1HZ100V', quote = 0) {
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

    // 2. Update per-symbol buffer & rich tick data
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

      // Rich tick tracking
      if (!this.symbolRichTicks) {
        this.symbolRichTicks = new Map();
      }
      if (!this.symbolRichTicks.has(symbol)) {
        this.symbolRichTicks.set(symbol, []);
      }
      const richList = this.symbolRichTicks.get(symbol);
      const prevTick = richList.length > 0 ? richList[richList.length - 1] : null;
      const numQuote = Number(quote) || 0;
      const priceDelta = prevTick && numQuote > 0 ? numQuote - prevTick.quote : 0;
      const direction = priceDelta > 0 ? 'UP' : (priceDelta < 0 ? 'DOWN' : 'FLAT');

      richList.push({
        quote: numQuote,
        lastDigit: digit,
        priceDelta,
        direction,
        epoch: Date.now()
      });
      if (richList.length > 100) richList.shift();
    }

    this.notify();
  }

  loadHistoricalDigits(digits, symbol = this.activeSymbol || '1HZ100V', prices = []) {
    if (!Array.isArray(digits) || digits.length === 0) return;
    const clean = digits.slice(-100);

    if (symbol) {
      this.symbolTickBuffers.set(symbol, clean);
      const sCounts = Array(10).fill(0);
      clean.forEach(d => {
        if (typeof d === 'number' && d >= 0 && d <= 9) sCounts[d]++;
      });
      this.symbolDigitCounts.set(symbol, sCounts);

      // Initialize rich list
      if (!this.symbolRichTicks) this.symbolRichTicks = new Map();
      const richList = [];
      const cleanPrices = Array.isArray(prices) ? prices.slice(-clean.length) : [];
      for (let i = 0; i < clean.length; i++) {
        const q = cleanPrices[i] || 0;
        const prevQ = i > 0 ? cleanPrices[i - 1] : q;
        const pDelta = q - prevQ;
        const dir = pDelta > 0 ? 'UP' : (pDelta < 0 ? 'DOWN' : 'FLAT');
        richList.push({
          quote: q,
          lastDigit: clean[i],
          priceDelta: pDelta,
          direction: dir,
          epoch: Date.now() - (clean.length - i) * 1000
        });
      }
      this.symbolRichTicks.set(symbol, richList);
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

      // Deep Tick Multi-Market Quantum Scanner for DIGITMATCH
      if (strat.contractType === 'DIGITMATCH' && this.config.tradingLogic !== 'specific') {
        const activeSyms = this.config.activeSymbols && this.config.activeSymbols.length > 0 
          ? this.config.activeSymbols 
          : ['1HZ100V', '1HZ75V', '1HZ50V', '1HZ25V', '1HZ10V'];

        const bestOpp = this.scanAllSymbolsForBestMatch(activeSyms, strat.digits || [0,1,2,3,4,5,6,7,8,9]);

        if (!bestOpp.confirmed && this.recentTickDigits.length >= 10) {
          const symName = getSymbolDisplayName(bestOpp.symbol, derivApi.availableSymbols);
          this.log(`🎯 Quantum Scanner [${symName}]: ${bestOpp.summary || 'Analyzing ticks'} — Target: ${bestOpp.digit} (${bestOpp.confidence}% conf). Awaiting confluence...`, 'cooldown');
          await this.sleep(1000);
          continue;
        }

        // Lock in the highest probability market & digit
        symbol = bestOpp.symbol;
        targetDigit = strat.bulkCount > 1 ? bestOpp.rankedDigits.slice(0, strat.bulkCount) : bestOpp.digit;
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
      const targetDisplay = Array.isArray(targetDigit) ? `[${targetDigit.join(', ')}]` : targetDigit;
      this.log(`PURCHASING ON ${symbol} (${symbolName}) | Contract: ${strat.contractType} | Target: ${targetDisplay} | Stake: $${this.currentStake.toFixed(2)}${strat.bulkCount > 1 ? ` (Bulk ${strat.bulkCount}x Split)` : ''}`, 'purchasing');
      
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
   * Deep Quantum Multi-Model Evaluator for DIGITMATCH
   * Evaluates:
   * 1. Order-3 (Tri-Gram) & Order-2 (Di-Gram) Markov Transitions
   * 2. Quote Directional Movement Correlation (UP / DOWN)
   * 3. Parity (Even / Odd) Persistence Wave Resonance
   * 4. Digit Delta Modulo Jump Velocity Oscillator
   * 5. Micro-Burst Momentum & Double-Tap Inertia
   */
  evaluateMatchesModel(ticks, allowedDigits = [0,1,2,3,4,5,6,7,8,9], symbol = '1HZ100V') {
    if (!Array.isArray(ticks) || ticks.length < 6) {
      const fallbackList = allowedDigits.slice(0, 3);
      return {
        digit: allowedDigits[0],
        rankedDigits: fallbackList,
        rankedScores: fallbackList.map(d => ({ digit: d, score: 0.1 })),
        confidence: 10,
        confirmed: false,
        score: 0,
        lastDigit: '-',
        summary: 'Awaiting ticks'
      };
    }

    const total = ticks.length;
    const last1 = ticks[total - 1];
    const last2 = ticks[total - 2];
    const last3 = ticks[total - 3];
    const last4 = ticks[total - 4];

    // Rich tick metadata
    const richList = this.symbolRichTicks?.get(symbol) || [];
    const lastRich = richList.length > 0 ? richList[richList.length - 1] : null;
    const currentDirection = lastRich?.direction || 'FLAT';
    const currentParity = last1 % 2 === 0 ? 'EVEN' : 'ODD';

    // Model 1: Order-3 (Tri-Gram) Markov Transition: P(D_t | D_{t-3}, D_{t-2}, D_{t-1})
    const markov3Counts = Array(10).fill(0);
    let markov3Total = 0;
    if (total >= 10 && last4 !== undefined) {
      for (let i = 0; i < total - 3; i++) {
        if (ticks[i] === last3 && ticks[i + 1] === last2 && ticks[i + 2] === last1) {
          const next = ticks[i + 3];
          if (next >= 0 && next <= 9) {
            markov3Counts[next]++;
            markov3Total++;
          }
        }
      }
    }

    // Model 2: Order-2 (Di-Gram) Markov Transition: P(D_t | D_{t-2}, D_{t-1})
    const markov2Counts = Array(10).fill(0);
    let markov2Total = 0;
    for (let i = 0; i < total - 2; i++) {
      if (ticks[i] === last2 && ticks[i + 1] === last1) {
        const next = ticks[i + 2];
        if (next >= 0 && next <= 9) {
          markov2Counts[next]++;
          markov2Total++;
        }
      }
    }

    // Model 3: Order-1 (Uni-Gram) Markov Transition: P(D_t | D_{t-1})
    const markov1Counts = Array(10).fill(0);
    let markov1Total = 0;
    for (let i = 0; i < total - 1; i++) {
      if (ticks[i] === last1) {
        const next = ticks[i + 1];
        if (next >= 0 && next <= 9) {
          markov1Counts[next]++;
          markov1Total++;
        }
      }
    }

    // Model 4: Quote Directional Movement Correlation (P(D | Direction = UP / DOWN))
    const dirCounts = Array(10).fill(0);
    let dirTotal = 0;
    if (richList.length >= 10) {
      for (let i = 0; i < richList.length - 1; i++) {
        if (richList[i].direction === currentDirection) {
          const nextD = richList[i + 1].lastDigit;
          if (nextD >= 0 && nextD <= 9) {
            dirCounts[nextD]++;
            dirTotal++;
          }
        }
      }
    }

    // Model 5: Parity Continuation Resonance
    let parityContinuations = 0;
    let parityTransitions = 0;
    for (let i = 0; i < total - 1; i++) {
      const p1 = ticks[i] % 2;
      const p2 = ticks[i + 1] % 2;
      if (p1 === p2) parityContinuations++;
      else parityTransitions++;
    }
    const parityPrefersSame = parityContinuations >= parityTransitions;

    // Model 6: Digit Delta Velocity ((D_t - D_{t-1} + 10) % 10)
    const deltaCounts = Array(10).fill(0);
    let totalDeltas = 0;
    for (let i = Math.max(0, total - 25); i < total - 1; i++) {
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

    // Model 7: Micro-Burst Window (Last 10 ticks)
    const micro10 = ticks.slice(-10);
    const microCounts = Array(10).fill(0);
    micro10.forEach(d => { if (d >= 0 && d <= 9) microCounts[d]++; });

    // Model 8: Macro Frequency
    const macroCounts = Array(10).fill(0);
    ticks.forEach(d => { if (d >= 0 && d <= 9) macroCounts[d]++; });

    // Model 9: Double-Tap & Sibling Resonance
    const isDoubleTap = (last1 === last2) || (last1 === last3);

    // Multi-Model Composite Scoring for all allowed digits
    const scoredList = allowedDigits.map(d => {
      const sMarkov3 = markov3Total > 0 ? (markov3Counts[d] / markov3Total) : 0;
      const sMarkov2 = markov2Total > 0 ? (markov2Counts[d] / markov2Total) : 0;
      const sMarkov1 = markov1Total > 0 ? (markov1Counts[d] / markov1Total) : 0.1;
      const sDirection = dirTotal > 0 ? (dirCounts[d] / dirTotal) : 0.1;
      const sDelta = (d === deltaPredictedDigit && totalDeltas > 0) ? (dominantDeltaCount / totalDeltas) : 0;
      const sMicro = microCounts[d] / Math.max(micro10.length, 1);
      const sMacro = macroCounts[d] / Math.max(ticks.length, 1);

      // Parity matching bonus
      const dParity = d % 2 === 0 ? 'EVEN' : 'ODD';
      const sParity = (parityPrefersSame && dParity === currentParity) ? 0.08 : (!parityPrefersSame && dParity !== currentParity ? 0.08 : 0);

      // Repeat / Double-tap bonus
      const sRepeat = (isDoubleTap && d === last1) ? 0.18 : (micro10.slice(-3).includes(d) ? 0.06 : 0);

      const compositeScore = 
        (sMarkov3 * 0.25) +
        (sMarkov2 * 0.20) +
        (sDirection * 0.15) +
        (sDelta * 0.15) +
        (sMarkov1 * 0.10) +
        (sMicro * 0.10) +
        (sMacro * 0.05) +
        sParity +
        sRepeat;

      return {
        digit: d,
        score: compositeScore
      };
    });

    scoredList.sort((a, b) => b.score - a.score);

    const best = scoredList[0];
    const confidence = Math.min(Math.round(best.score * 100 * 2.8), 99);
    const hasMarkov3 = markov3Counts[best.digit] >= 1;
    const hasMarkov2 = markov2Counts[best.digit] >= 2;
    const hasBurst = microCounts[best.digit] >= 3;
    const hasHighConfidence = best.score >= 0.28;
    const confirmed = hasMarkov3 || hasMarkov2 || hasBurst || hasHighConfidence || total < 15;

    const summary = `Trend: ${currentDirection} | Parity: ${currentParity} | Micro: ${microCounts[best.digit]}/10`;

    return {
      digit: best.digit,
      rankedDigits: scoredList.map(s => s.digit),
      rankedScores: scoredList,
      confidence,
      confirmed,
      score: best.score,
      lastDigit: last1,
      direction: currentDirection,
      parity: currentParity,
      summary
    };
  }

  scanAllSymbolsForBestMatch(activeSymbols, stratDigits) {
    let bestCandidate = null;

    activeSymbols.forEach(sym => {
      const ticks = this.symbolTickBuffers.get(sym) || (sym === this.activeSymbol ? this.recentTickDigits : []);
      if (ticks.length >= 6) {
        const evalRes = this.evaluateMatchesModel(ticks, stratDigits, sym);
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
      const evalRes = this.evaluateMatchesModel(this.recentTickDigits, stratDigits, fallbackSym);
      return { symbol: fallbackSym, ...evalRes };
    }

    return bestCandidate;
  }

  selectDigit(strat) {
    const digits = strat.digits || [0,1,2,3,4,5,6,7,8,9];
    const bulkCount = Number(strat.bulkCount) || 1;

    if (this.config.tradingLogic === 'specific') {
      const selected = this.config.selectedDigits || [4];
      if (bulkCount > 1) {
        return selected.slice(0, bulkCount);
      }
      return selected[Math.floor(Math.random() * selected.length)];
    }

    if (this.config.tradingLogic === 'random') {
      if (bulkCount > 1) {
        const shuffled = [...digits].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, bulkCount);
      }
      return digits[Math.floor(Math.random() * digits.length)];
    }

    // Analyze Mode: Quantum Multi-Model Analysis
    if (this.digitCounts.some(c => c > 0)) {
      if (strat.contractType === 'DIGITDIFF') {
        // In Differs: target coldest digits with longest absence
        let sortedCold = [...digits].sort((a, b) => {
          const countA = this.digitCounts[a] || 0;
          const countB = this.digitCounts[b] || 0;
          if (countA !== countB) return countA - countB;
          const idxA = this.recentTickDigits.lastIndexOf(a);
          const idxB = this.recentTickDigits.lastIndexOf(b);
          return idxA - idxB;
        });

        if (bulkCount > 1) {
          return sortedCold.slice(0, bulkCount);
        }
        return sortedCold[0];
      } else if (strat.contractType === 'DIGITMATCH') {
        // Matches Sniper & Bulk: Top quantum ranked digits
        const sniper = this.evaluateMatchesModel(this.recentTickDigits, digits);
        if (bulkCount > 1) {
          return sniper.rankedDigits.slice(0, bulkCount);
        }
        return sniper.digit;
      }
    }

    if (bulkCount > 1) {
      return digits.slice(0, bulkCount);
    }
    return digits[Math.floor(Math.random() * digits.length)];
  }

  async simulateTrade(symbol, strat, targetDigit, stake) {
    await this.sleep(1200);

    const exitDigit = Math.floor(Math.random() * 10);
    this.recordTickDigit(exitDigit, symbol);

    const targets = Array.isArray(targetDigit) ? targetDigit : [targetDigit];
    const isBulk = targets.length > 1;
    let won = false;
    let profit = 0;

    if (strat.contractType === 'DIGITMATCH') {
      won = targets.includes(exitDigit);
      if (won) {
        const stakePer = stake / targets.length;
        const payout = stakePer * 8.5; // ~850% payout on winning contract
        profit = payout - stake;
      } else {
        profit = -stake;
      }
    } else if (strat.contractType === 'DIGITDIFF') {
      won = !targets.includes(exitDigit);
      profit = won ? (stake * 0.09) : -stake;
    } else if (strat.contractType === 'DIGITOVER') {
      const barrier = parseInt(strat.barrier || '4', 10);
      won = (exitDigit > barrier);
      profit = won ? (stake * 0.09) : -stake;
    } else if (strat.contractType === 'DIGITUNDER') {
      const barrier = parseInt(strat.barrier || '4', 10);
      won = (exitDigit < barrier);
      profit = won ? (stake * 0.09) : -stake;
    }

    return {
      won,
      profit,
      exitDigit,
      exitTick: `1245.${Math.floor(100 + Math.random()*800)}${exitDigit}`,
      contractId: Math.floor(100000000 + Math.random()*900000000),
      isBulk
    };
  }

  async executeLiveTrade(symbol, strat, targetDigit, stake) {
    try {
      const targets = Array.isArray(targetDigit) ? targetDigit : [targetDigit];
      const isBulk = targets.length > 1;

      // Handle Bulk Parallel Contract Purchases
      if (isBulk) {
        const count = targets.length;
        const stakePerContract = Math.max(Number((stake / count).toFixed(2)), 0.35);
        this.log(`🚀 Executing Bulk Trade (${count} Parallel Contracts) on ${symbol} | Targets: [${targets.join(', ')}] | Stake each: $${stakePerContract.toFixed(2)}`, 'purchasing');

        const buyPromises = targets.map(digit => {
          let barrier = digit;
          if (strat.contractType === 'DIGITOVER' || strat.contractType === 'DIGITUNDER') {
            barrier = strat.barrier !== undefined ? strat.barrier : (this.config.barrier !== undefined ? this.config.barrier : 4);
          }
          return derivApi.buyContract({
            symbol,
            contractType: strat.contractType,
            stake: stakePerContract,
            barrier: barrier
          });
        });

        const buyResults = await Promise.all(buyPromises);
        const contractIds = buyResults.map(r => r.contract_id || r.contractId);
        this.log(`Bulk contracts confirmed! IDs: [${contractIds.join(', ')}]`, 'info');

        // Refresh live balance in background after contract purchase
        derivApi.checkServerSession().catch(() => {});

        // Await proposal open contract result for all contracts
        const results = await Promise.all(buyResults.map(buyRes => {
          if (buyRes.won !== undefined && buyRes.profit !== undefined) {
            return Promise.resolve(buyRes);
          }
          const cId = buyRes.contract_id || buyRes.contractId;
          return new Promise(resolve => {
            const handler = (res) => {
              if (res.contractId === cId) {
                derivApi.off('onContractResult', handler);
                resolve(res);
              }
            };
            derivApi.on('onContractResult', handler);
          });
        }));

        const winningContract = results.find(r => r.won);
        const won = Boolean(winningContract);
        const totalStakePaid = stakePerContract * count;
        let netProfit = 0;

        if (won) {
          const winningPayout = Number(winningContract.payout) || (stakePerContract * 8.5);
          netProfit = winningPayout - totalStakePaid;
        } else {
          netProfit = -totalStakePaid;
        }

        const firstResult = results[0] || {};
        return {
          won,
          profit: netProfit,
          exitDigit: firstResult.exitDigit,
          exitTick: firstResult.exitTick,
          contractId: contractIds.join(', '),
          isBulk: true,
          bulkCount: count
        };
      }

      // Single Contract Execution
      let barrier = targets[0];
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
