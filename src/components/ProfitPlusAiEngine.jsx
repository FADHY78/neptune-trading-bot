import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ProfitPlusAiEngine = ({
  strategy = 'Matches',
  prediction = 6,
  confidence = 81.7,
  activeSymbolName = 'Vol 10 (1s)',
  variance = 1.2,
  currentPrice = 18.91691,
  frequencyPatternPct = 6.0,
  isCalculating = false,
  onTriggerAnalysis
}) => {
  const [internalCalculating, setInternalCalculating] = useState(isCalculating);
  const [progress, setProgress] = useState(82);

  // Trigger brief calculation animation on command
  const handleCalculate = () => {
    setInternalCalculating(true);
    setProgress(15);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => setInternalCalculating(false), 250);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 80);

    onTriggerAnalysis?.();
  };

  useEffect(() => {
    if (isCalculating) {
      setInternalCalculating(true);
      setProgress(40);
    }
  }, [isCalculating]);

  return (
    <div className="profit-card profit-card-highlight">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(0, 212, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Cpu size={16} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
            AI Analysis Engine
          </span>
        </div>

        <button
          onClick={handleCalculate}
          disabled={internalCalculating}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: '600'
          }}
          title="Run AI Neural Scan"
        >
          <RefreshCw size={13} className={internalCalculating ? 'spin' : ''} />
          <span>{internalCalculating ? 'Analyzing...' : 'Scan'}</span>
        </button>
      </div>

      {/* Calculating Progress Mode (Image 2) */}
      {internalCalculating ? (
        <div style={{ padding: '16px 8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text-bright-blue)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} className="spin" color="var(--accent-cyan)" />
              <span>Calculating Probabilities</span>
            </div>
            <span className="font-mono">{progress}%</span>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        /* Result Mode (Image 1) */
        <>
          <div className="ai-stat-columns">
            {/* Strategy */}
            <div className="ai-stat-box">
              <span className="ai-stat-label">Strategy</span>
              <span className="ai-stat-val" style={{ color: '#60a5fa' }}>{strategy || 'Matches'}</span>
            </div>

            {/* Prediction */}
            <div className="ai-stat-box" style={{ borderColor: 'rgba(0, 212, 255, 0.4)', background: 'rgba(0, 212, 255, 0.08)' }}>
              <span className="ai-stat-label">Prediction</span>
              <span className="ai-stat-val" style={{ color: 'var(--accent-cyan)', fontSize: '22px' }}>
                {prediction !== undefined && prediction !== null ? prediction : '6'}
              </span>
            </div>

            {/* Confidence */}
            <div className="ai-stat-box">
              <span className="ai-stat-label">Confidence</span>
              <span className="ai-stat-val" style={{ color: 'var(--color-success)' }}>
                {typeof confidence === 'number' ? `${confidence.toFixed(1)}%` : `${confidence || 81.7}%`}
              </span>
            </div>
          </div>

          {/* AI Narrative Analysis Card */}
          <div className="ai-insight-box">
            <Zap size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Advanced neural network analysis on <strong>{activeSymbolName}</strong> (variance: {variance}) identifies digit <strong>{prediction}</strong> with <strong>{typeof confidence === 'number' ? confidence.toFixed(1) : confidence}%</strong> confidence. Multi-layer analysis: Frequency patterns ({frequencyPatternPct.toFixed(1)}%), market volatility modeling, and price correlation. Current price: {typeof currentPrice === 'number' ? currentPrice.toFixed(5) : currentPrice}. AI algorithms strongly favor digit <strong>{prediction}</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
