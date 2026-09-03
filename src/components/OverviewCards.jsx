import React from 'react';
import { TrendingUp, TrendingDown, Target, Zap, Shield, Award } from 'lucide-react';

export const OverviewCards = ({ state = {} }) => {
  const {
    sessionPnL = 0,
    tradeCount = 0,
    wins = 0,
    losses = 0,
    consecutiveLosses = 0,
    currentStreak = { type: 'NONE', count: 0 },
    currentStake = 5,
    lastExitDigit = null
  } = state || {};

  const numPnL = Number(sessionPnL) || 0;
  const numStake = Number(currentStake) || 5;
  const numTradeCount = Number(tradeCount) || 0;
  const numWins = Number(wins) || 0;
  const numLosses = Number(losses) || 0;
  const numConsecLosses = Number(consecutiveLosses) || 0;
  const streak = currentStreak || { type: 'NONE', count: 0 };

  const winRate = numTradeCount > 0 ? ((numWins / numTradeCount) * 100).toFixed(1) : '0.0';
  const isPositive = numPnL >= 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '12px',
      marginBottom: '16px'
    }}>
      {/* Session P&L Highlight Card */}
      <div className="card" style={{
        background: isPositive 
          ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(17, 24, 39, 1) 100%)' 
          : 'linear-gradient(135deg, rgba(255, 61, 90, 0.08) 0%, rgba(17, 24, 39, 1) 100%)',
        borderColor: isPositive ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 61, 90, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Session Net P&L
          </span>
          {isPositive ? <TrendingUp size={18} color="var(--color-success)" /> : <TrendingDown size={18} color="var(--color-danger)" />}
        </div>
        <div className="font-mono" style={{
          fontSize: '26px',
          fontWeight: '700',
          color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px'
        }}>
          {isPositive ? `+$${numPnL.toFixed(2)}` : `-$${Math.abs(numPnL).toFixed(2)}`}
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>
            ▲ {numWins} wins / {numLosses} losses
          </span>
        </div>
      </div>

      {/* Win Rate Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Win Rate
          </span>
          <Award size={18} color="var(--accent-cyan)" />
        </div>
        <div className="font-mono" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
          {winRate}%
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Total Trades: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{numTradeCount}</span>
        </div>
      </div>

      {/* Streak Metric Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Current Streak
          </span>
          <Zap size={18} color="var(--color-warning)" />
        </div>
        <div className="font-mono" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {streak.type === 'WIN' ? `W${streak.count}` : streak.type === 'LOSS' ? `L${streak.count}` : 'NONE'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Consecutive Loss: <span className="font-mono" style={{ color: numConsecLosses > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{numConsecLosses}</span>
        </div>
      </div>

      {/* Current Stake & Last Exit Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Next Stake / Exit
          </span>
          <Target size={18} color="var(--accent-cyan)" />
        </div>
        <div className="font-mono" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
          ${numStake.toFixed(2)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Last Exit Digit: <span className="font-mono" style={{ color: 'var(--color-warning)', fontWeight: '700' }}>{lastExitDigit !== null && lastExitDigit !== undefined ? lastExitDigit : '-'}</span>
        </div>
      </div>
    </div>
  );
};
