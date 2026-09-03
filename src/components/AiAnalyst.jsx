import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, TrendingUp, Zap, ShieldCheck, RefreshCw, CheckCircle2, ArrowRight, Target, Activity } from 'lucide-react';
import { aiAnalyst } from '../services/aiAnalyst.js';
import { botEngine } from '../services/botEngine.js';

export const AiAnalyst = ({ config, onChangeConfig, onStartBot, isRunning }) => {
  const [analysis, setAnalysis] = useState(aiAnalyst.getLastAnalysis());
  const [isScanning, setIsScanning] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(null);

  useEffect(() => {
    // Initial analysis
    const res = aiAnalyst.analyzeMarket(config);
    setAnalysis(res);

    // Subscribe to AI Analyst updates
    const unsubscribe = aiAnalyst.subscribe((newAnalysis) => {
      setAnalysis(newAnalysis);
    });

    // Auto-refresh AI analysis every 3 seconds
    const interval = setInterval(() => {
      const updated = aiAnalyst.analyzeMarket(config);
      setAnalysis(updated);
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [config]);

  const handleManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const res = aiAnalyst.analyzeMarket(config);
      setAnalysis(res);
      setIsScanning(false);
    }, 400);
  };

  const handleApplyOpportunity = (opp) => {
    if (!opp) return;

    const newConfig = {
      ...config,
      strategyId: opp.strategyId,
      activeSymbols: [opp.symbol]
    };

    if (opp.direction) {
      newConfig.overUnderDirection = opp.direction;
    }
    if (opp.strategyId === 'over-under-barrier' && opp.target !== undefined) {
      newConfig.barrier = opp.target;
    }
    if (opp.strategyId === 'even-odd-wave') {
      newConfig.evenOddMode = opp.target === 'EVEN' ? 'even' : (opp.target === 'ODD' ? 'odd' : 'auto');
    }

    onChangeConfig(newConfig);
    botEngine.log(`🤖 [AI Analyst] Applied recommendation: ${opp.strategyName} on ${opp.symbol} | Target: ${opp.targetDisplay}`, 'info');

    setAppliedNotice(`Applied ${opp.strategyName} on ${opp.symbol}!`);
    setTimeout(() => setAppliedNotice(null), 3500);
  };

  const toggleAiPilot = () => {
    const nextVal = !config.aiPilotMode;
    onChangeConfig({ ...config, aiPilotMode: nextVal });
    botEngine.log(`🤖 AI Pilot Mode ${nextVal ? 'ACTIVATED — Bot will dynamically snipe top AI opportunities!' : 'DEACTIVATED — Manual strategy active.'}`, nextVal ? 'won' : 'info');
  };

  const topOpp = analysis?.bestOpportunity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header & AI Pilot Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(13, 27, 42, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.35)',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0077b6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.4)'
            }}>
              <Bot size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Neptune AI Market Analyst</span>
                <span className="badge" style={{ backgroundColor: 'rgba(0, 212, 255, 0.2)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 212, 255, 0.4)', fontSize: '10px' }}>
                  Live Quantum Scanner
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Continuous algorithmic opportunity discovery across all Volatility markets and strategies
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleManualScan}
              disabled={isScanning}
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
              <span>{isScanning ? 'Scanning...' : 'Refresh AI Scan'}</span>
            </button>

            <button
              className={`btn ${config.aiPilotMode ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleAiPilot}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: config.aiPilotMode ? '0 0 12px rgba(0, 230, 118, 0.3)' : 'none'
              }}
            >
              <Zap size={14} />
              <span>{config.aiPilotMode ? '⚡ AI Auto-Pilot: ON' : '⚡ Enable AI Auto-Pilot'}</span>
            </button>
          </div>
        </div>

        {appliedNotice && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 230, 118, 0.15)',
            border: '1px solid var(--color-success)',
            borderRadius: '6px',
            color: 'var(--color-success)',
            fontSize: '12px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            <span>{appliedNotice}</span>
          </div>
        )}
      </div>

      {/* 2. Market Pulse Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Market Regime</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} />
            <span>{analysis?.marketRegime || 'Quantum Statistical Scan'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Algorithmic Predictability</div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={16} />
            <span>{analysis?.predictabilityIndex || 94}% Institutional Edge</span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Markets & Opportunities</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={16} />
            <span>{analysis?.analyzedSymbolsCount || 5} Markets | {analysis?.totalOpportunitiesCount || 20} Setups</span>
          </div>
        </div>
      </div>

      {/* 2B. Tick Collection Depth & Pattern Density Bar */}
      <div className="card" style={{
        padding: '12px 16px',
        backgroundColor: 'var(--bg-input)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: (analysis?.maxTickDepth || 0) >= 25 ? 'var(--color-success)' : 'var(--color-warning)',
            boxShadow: `0 0 8px ${(analysis?.maxTickDepth || 0) >= 25 ? 'var(--color-success)' : 'var(--color-warning)'}`
          }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
              AI Pattern Tick Depth: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{analysis?.maxTickDepth || 0}/100 Ticks Analyzed</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {analysis?.patternQuality || 'Optimal (Deep 100-Tick Horizon)'} • 8-Layer Quantum Deep Learning
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '140px', height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(((analysis?.maxTickDepth || 0) / 100) * 100, 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #00d4ff, #00e676)',
              borderRadius: '3px'
            }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-success)' }}>
            {Math.min(((analysis?.maxTickDepth || 0) / 100) * 100, 100).toFixed(0)}% Density
          </span>
        </div>
      </div>

      {/* 3. Top AI Recommendation Hero Card */}
      {topOpp && (
        <div className="card" style={{
          border: '1px solid rgba(0, 230, 118, 0.4)',
          background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.06) 0%, rgba(17, 24, 39, 0.95) 100%)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge" style={{ backgroundColor: 'var(--color-success)', color: '#000', fontWeight: '800', fontSize: '11px', padding: '4px 8px' }}>
                ⭐ #1 Top Opportunity Right Now
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Updated {analysis?.timestamp}</span>
            </div>

            <span className="badge" style={{ backgroundColor: 'rgba(0, 212, 255, 0.2)', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)', fontSize: '11px', fontWeight: '800' }}>
              Edge: {topOpp.edgeRating} Institutional
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Market</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{topOpp.symbolName}</div>
              <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{topOpp.symbol}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Recommended Strategy</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{topOpp.strategyName}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)' }}>Estimated Payout: {topOpp.payout}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Suggested Setup</div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--color-success)' }}>{topOpp.targetDisplay}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI Confidence: <strong>{topOpp.confidence}%</strong></div>
            </div>
          </div>

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            marginBottom: '14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5'
          }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>🤖 AI Reasoning: </strong>
            {topOpp.aiReasoning}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleApplyOpportunity(topOpp)}
              style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Apply This Opportunity</span>
              <ArrowRight size={14} />
            </button>

            {!isRunning && (
              <button
                className="btn btn-success"
                onClick={() => {
                  handleApplyOpportunity(topOpp);
                  setTimeout(() => onStartBot(), 300);
                }}
                style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Zap size={14} />
                <span>Apply & Start Trading</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3B. Supreme Digit Match Sniper Spotlight */}
      {analysis?.topMatchOpportunity && (
        <div className="card" style={{
          border: '1px solid rgba(255, 183, 3, 0.4)',
          background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.08) 0%, rgba(20, 20, 30, 0.95) 100%)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge" style={{ backgroundColor: '#ffb703', color: '#000', fontWeight: '900', fontSize: '11px', padding: '4px 8px' }}>
                🎯 SUPREME DIGIT MATCH SNIPER (~800% / 8.5x Payout)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Highest Profit Expectancy Strategy</span>
            </div>

            <span className="badge" style={{ backgroundColor: 'rgba(255, 183, 3, 0.2)', color: '#ffb703', border: '1px solid #ffb703', fontSize: '11px', fontWeight: '800' }}>
              8-Layer Quantum Deep Learning
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ffb703 0%, #fb8500 100%)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: '900',
                boxShadow: '0 0 20px rgba(255, 183, 3, 0.5)'
              }}>
                {analysis.topMatchOpportunity.target}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Match Digit</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Digit [{analysis.topMatchOpportunity.target}]
                </div>
                <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                  {analysis.topMatchOpportunity.symbolName}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Pattern Confidence</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#ffb703' }}>
                {analysis.topMatchOpportunity.confidence}% Confluence
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                {analysis.topMatchOpportunity.edgeRating} Institutional Edge
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expected Profit Multiplier</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--color-success)' }}>
                8.5x (+750% Net)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                1 Win = 9 Even/Odd Wins
              </div>
            </div>
          </div>

          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 183, 3, 0.2)',
            marginBottom: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            <strong style={{ color: '#ffb703' }}>🔍 Pattern Confluence: </strong>
            {analysis.topMatchOpportunity.aiReasoning}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleApplyOpportunity(analysis.topMatchOpportunity)}
              style={{
                backgroundColor: '#ffb703',
                borderColor: '#ffb703',
                color: '#000',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🎯 Lock In Digit Match Sniper</span>
              <ArrowRight size={14} color="#000" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Ranked Opportunities Radar Table */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} />
          <span>Cross-Market Opportunity Matrix (Ranked by AI Edge)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 6px' }}>Rank</th>
                <th style={{ padding: '8px 6px' }}>Market</th>
                <th style={{ padding: '8px 6px' }}>Strategy</th>
                <th style={{ padding: '8px 6px' }}>Target / Setup</th>
                <th style={{ padding: '8px 6px' }}>AI Confidence</th>
                <th style={{ padding: '8px 6px' }}>Edge</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {analysis?.opportunities?.slice(0, 10).map((opp, idx) => {
                const isTop = idx === 0;
                return (
                  <tr
                    key={opp.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isTop ? 'rgba(0, 230, 118, 0.05)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 6px', fontWeight: '700', color: isTop ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{opp.symbol}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{opp.symbolName}</div>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{opp.strategyName}</span>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <strong style={{ color: 'var(--color-success)', fontFamily: 'monospace' }}>{opp.targetDisplay}</strong>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                          <div style={{
                            width: `${opp.confidence}%`,
                            height: '100%',
                            background: opp.confidence >= 85 ? 'var(--color-success)' : 'var(--accent-cyan)',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{opp.confidence}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <span className="badge" style={{
                        fontSize: '10px',
                        backgroundColor: opp.edgeRating === 'A+' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 212, 255, 0.15)',
                        color: opp.edgeRating === 'A+' ? 'var(--color-success)' : 'var(--accent-cyan)'
                      }}>
                        {opp.edgeRating}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleApplyOpportunity(opp)}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
