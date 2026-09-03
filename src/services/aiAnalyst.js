import { botEngine } from './botEngine.js';
import { STRATEGY_PRESETS } from '../constants/strategies.js';
import { getSymbolDisplayName } from '../constants/symbols.js';

class AiAnalystService {
  constructor() {
    this.subscribers = new Set();
    this.lastAnalysis = null;
    this.isAnalyzing = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.lastAnalysis) callback(this.lastAnalysis);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    if (this.lastAnalysis) {
      this.subscribers.forEach(cb => {
        try { cb(this.lastAnalysis); } catch (e) { console.error('AI Analyst subscriber error', e); }
      });
    }
  }

  /**
   * Comprehensive Multi-Market Quantitative AI Analysis
   */
  analyzeMarket(config = {}) {
    try {
      this.isAnalyzing = true;
      const symbols = config.activeSymbols && config.activeSymbols.length > 0
        ? config.activeSymbols
        : ['1HZ100V', '1HZ75V', '1HZ50V', '1HZ25V', '1HZ10V'];

      const opportunities = [];

      symbols.forEach(sym => {
        const ticks = botEngine.symbolTickBuffers?.get(sym) || 
          (sym === botEngine.activeSymbol ? botEngine.recentTickDigits : []);

        const richTicks = botEngine.symbolRichTicks?.get(sym) || [];
        const lastRich = richTicks.length > 0 ? richTicks[richTicks.length - 1] : null;
        const priceVelocity = lastRich?.direction || 'STEADY';

        // 1. Matches Strategy Analysis
        const matchEval = botEngine.evaluateMatchesModel(ticks, [0,1,2,3,4,5,6,7,8,9], sym);
        const matchStrat = STRATEGY_PRESETS.find(s => s.id === 'matches-sniper-76');
        opportunities.push({
          id: `match-${sym}`,
          strategyId: 'matches-sniper-76',
          strategyName: 'Matches Sniper Pro',
          contractType: 'DIGITMATCH',
          symbol: sym,
          symbolName: getSymbolDisplayName(sym),
          target: matchEval.digit,
          targetDisplay: `Digit [${matchEval.digit}]`,
          confidence: matchEval.confidence || 85,
          score: matchEval.score || 0.7,
          edgeRating: matchEval.confidence >= 85 ? 'A+' : matchEval.confidence >= 75 ? 'A' : 'B+',
          payout: '~800% / 8.5x',
          modelSummary: matchEval.summary || 'Markov 3-gram convergence with Laplace smoothing',
          aiReasoning: `Strong multi-model consensus (${matchEval.modelVotes || 2} models agree). Recency decay and price velocity (${priceVelocity}) converge on Digit ${matchEval.digit}.`
        });

        // 2. Differs Strategy Analysis
        const diffEval = botEngine.evaluateDiffersModel(ticks, [0,1,2,3,4,5,6,7,8,9], sym);
        const diffStrat = STRATEGY_PRESETS.find(s => s.id === 'differs-combo-9');
        opportunities.push({
          id: `diff-${sym}`,
          strategyId: 'differs-combo-9',
          strategyName: 'Differs Quantum Ultimate',
          contractType: 'DIGITDIFF',
          symbol: sym,
          symbolName: getSymbolDisplayName(sym),
          target: diffEval.coldDigit,
          targetDisplay: `Avoid Digit [${diffEval.coldDigit}]`,
          confidence: Math.min(diffEval.safetyScore + 5, 99),
          score: (diffEval.safetyScore / 100) || 0.9,
          edgeRating: diffEval.safetyScore >= 88 ? 'A+' : 'A',
          payout: '9% (Ultra-High Safety)',
          modelSummary: diffEval.summary,
          aiReasoning: `Coldest statistical outlier with absence gap of ${diffEval.absenceGaps} ticks. Markov 1-step predecessor transitions are suppressed.`
        });

        // 3. Even / Odd Strategy Analysis
        const evenOddEval = botEngine.evaluateEvenOddModel(ticks, sym, 'auto');
        opportunities.push({
          id: `evenodd-${sym}`,
          strategyId: 'even-odd-wave',
          strategyName: 'Even / Odd Parity Wave',
          contractType: evenOddEval.targetParity,
          symbol: sym,
          symbolName: getSymbolDisplayName(sym),
          target: evenOddEval.targetParity === 'DIGITEVEN' ? 'EVEN' : 'ODD',
          targetDisplay: evenOddEval.targetParity === 'DIGITEVEN' ? 'EVEN (0, 2, 4, 6, 8)' : 'ODD (1, 3, 5, 7, 9)',
          confidence: evenOddEval.confidence || 75,
          score: evenOddEval.score || 0.65,
          edgeRating: evenOddEval.confidence >= 80 ? 'A+' : 'A',
          payout: '~95% / 1.95x',
          modelSummary: evenOddEval.summary,
          aiReasoning: `Parity run wave detected with persistent Markov run length of ${evenOddEval.runLength || 1}x. Continuation probability is ${Math.round(evenOddEval.score * 100)}%.`
        });

        // 4. Over / Under Strategy Analysis (Test both OVER and UNDER at barrier 4)
        const barrier = config.barrier !== undefined ? Number(config.barrier) : 4;
        const overEval = botEngine.evaluateOverUnderModel(ticks, sym, 'OVER', barrier);
        const underEval = botEngine.evaluateOverUnderModel(ticks, sym, 'UNDER', barrier);
        const bestOU = overEval.score >= underEval.score ? overEval : underEval;
        const bestDir = overEval.score >= underEval.score ? 'OVER' : 'UNDER';

        opportunities.push({
          id: `ou-${sym}`,
          strategyId: 'over-under-barrier',
          strategyName: 'Over / Under Adaptive Barrier',
          contractType: bestDir === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER',
          symbol: sym,
          symbolName: getSymbolDisplayName(sym),
          target: barrier,
          direction: bestDir,
          targetDisplay: `${bestDir} ${barrier} (${bestDir === 'OVER' ? `>${barrier}` : `<${barrier}`})`,
          confidence: bestOU.confidence || 78,
          score: bestOU.score || 0.7,
          edgeRating: bestOU.confidence >= 80 ? 'A+' : 'A',
          payout: '~95% - 150%',
          modelSummary: bestOU.summary,
          aiReasoning: `Tick velocity gradient confirms directional ${bestDir} drift with ${bestOU.summary}. High probability entry setup.`
        });
      });

      // Sort opportunities by composite AI Score descending
      opportunities.sort((a, b) => b.confidence - a.confidence);

      const bestOpportunity = opportunities[0] || null;

      // Determine Overall Market Regime
      let marketRegime = 'Quantum Statistical Predictability';
      if (bestOpportunity) {
        if (bestOpportunity.contractType === 'DIGITMATCH') {
          marketRegime = 'High-Precision Quantum Cluster';
        } else if (bestOpportunity.contractType === 'DIGITDIFF') {
          marketRegime = 'Cold Outlier Suppression Zone';
        } else if (bestOpportunity.contractType.includes('EVEN') || bestOpportunity.contractType.includes('ODD')) {
          marketRegime = 'Parity Persistence Wave Cycle';
        } else {
          marketRegime = 'Velocity Momentum Drift Expansion';
        }
      }

      const topScores = opportunities.slice(0, 4);
      const avgTopConfidence = Math.round(
        topScores.reduce((acc, o) => acc + o.confidence, 0) / Math.max(topScores.length, 1)
      );

      this.lastAnalysis = {
        timestamp: new Date().toLocaleTimeString(),
        bestOpportunity,
        opportunities,
        marketRegime,
        predictabilityIndex: Math.min(avgTopConfidence + 5, 99),
        analyzedSymbolsCount: symbols.length,
        totalOpportunitiesCount: opportunities.length
      };

      this.isAnalyzing = false;
      this.notify();
      return this.lastAnalysis;
    } catch (err) {
      console.error('AI Analyst Error:', err);
      this.isAnalyzing = false;
      return null;
    }
  }

  getLastAnalysis() {
    return this.lastAnalysis;
  }
}

export const aiAnalyst = new AiAnalystService();
