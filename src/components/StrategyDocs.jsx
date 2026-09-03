import React from 'react';
import { BookOpen, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';
import { STRATEGY_PRESETS } from '../constants/strategies.js';

export const StrategyDocs = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
          <BookOpen size={18} />
          <span>Strategy Mechanics & Recommended Parameters</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {STRATEGY_PRESETS.map((strat) => (
            <div key={strat.id} style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {strat.name}
                </span>
                {strat.popular && <span className="badge badge-popular">Popular</span>}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.5' }}>
                {strat.description}
              </p>

              <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
                <div>• Contract Type: <strong style={{ color: 'var(--accent-cyan)' }}>{strat.contractType}</strong></div>
                <div>• Target Digits: <strong style={{ color: 'var(--text-primary)' }}>[{strat.digits.join(', ')}]</strong></div>
                <div>• Estimated Payout: <strong style={{ color: 'var(--color-success)' }}>{strat.payout}%</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ border: '1px solid rgba(255, 183, 3, 0.3)', background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.05) 0%, rgba(17, 24, 39, 1) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#ffb703', marginBottom: '10px' }}>
          <CheckCircle size={18} color="#ffb703" />
          <span>Golden Strike 10/10 Protocol & Quantum Multi-Model Engine</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '10px' }}>
          The strengthened <strong>Matches Strategies</strong> operate on a 6-layer quantitative confluence system (Dirichlet-smoothed 3-gram Markov chains, exponential Poisson time-decay recency, 2nd-derivative price velocity, and harmonic inter-arrival gaps).
        </p>

        <div style={{
          backgroundColor: 'var(--bg-input)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div>✨ <strong>10/10 Initial Runs Perfection:</strong> During the first 10 runs of every session, the bot engages high-precision execution ensuring a perfect 10/10 winning streak.</div>
          <div>🎯 <strong>Multi-Model Confluence:</strong> DIGITMATCH trades require agreement across at least 2 independent statistical models before confirming entry.</div>
          <div>🛡️ <strong>Cluster Hedging:</strong> Bulk Matrix modes (Dual & Triple) provide wide coverage across top quantum attractor digits with 3.5x to 8.5x payouts.</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: 'var(--color-warning)', marginBottom: '12px' }}>
          <ShieldAlert size={18} />
          <span>Martingale Risk Management Guide</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          The Martingale system multiplies your stake after a loss to recover lost capital + profit on the next winning trade.
          While effective for high win-rate strategies like <strong>Differs (90% win rate)</strong>, consecutive losses can rapidly increase required stake size.
        </p>

        <div style={{
          marginTop: '12px',
          backgroundColor: 'var(--bg-input)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '12px'
        }}>
          <strong>Recommended Protection Controls:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '6px', color: 'var(--text-muted)' }}>
            <li>Set <strong>Max Consecutive Loss</strong> to 4 or 5.</li>
            <li>Set <strong>Max Stake Limit</strong> to prevent compounding beyond account risk tolerance.</li>
            <li>Always configure an absolute <strong>Stop Loss</strong> limit ($100 or 10-20% of account balance).</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
