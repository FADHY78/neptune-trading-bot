import React from 'react';
import { Hash, DollarSign, Activity, PieChart, Clock, Zap } from 'lucide-react';

export const LiveMarketMetrics = ({
  currentDigit = 4,
  livePrice = 20.49460,
  totalTicks = 214,
  evenPercentage = 44,
  oddPercentage = 56,
  lastUpdate = '00:42:18',
  volatility = 1.2
}) => {
  return (
    <div className="market-metrics-grid" style={{
      background: 'linear-gradient(145deg, #101a4f 0%, #0d153d 100%)',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      borderRadius: 'var(--radius-xl)',
      padding: '16px',
      boxShadow: '0 0 24px rgba(37, 99, 235, 0.18)'
    }}>
      {/* 1. CURRENT DIGIT */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Hash size={13} color="#60a5fa" />
          <span>Current Digit</span>
        </div>
        <div className="metric-value font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '24px', fontWeight: '800' }}>
          {currentDigit !== null && currentDigit !== undefined ? currentDigit : '-'}
        </div>
      </div>

      {/* 2. LIVE PRICE (2 decimal places) */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <DollarSign size={13} color="#60a5fa" />
          <span>Live Price</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '800' }}>
          ${typeof livePrice === 'number' ? livePrice.toFixed(2) : (Number(livePrice) ? Number(livePrice).toFixed(2) : (livePrice || '20.49'))}
        </div>
      </div>

      {/* 3. TOTAL TICKS */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Activity size={13} color="#60a5fa" />
          <span>Total Ticks</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
          {totalTicks || 0}
        </div>
      </div>

      {/* 4. % EVEN/ODD */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <PieChart size={13} color="#60a5fa" />
          <span>% Even/Odd</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#93c5fd', fontSize: '20px', fontWeight: '700' }}>
          {evenPercentage}%/{oddPercentage}%
        </div>
      </div>

      {/* 5. LAST UPDATE */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Clock size={13} color="#60a5fa" />
          <span>Last Update</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '600' }}>
          {lastUpdate || '00:00:00'}
        </div>
      </div>

      {/* 6. VOLATILITY */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Zap size={13} color="#60a5fa" />
          <span>Volatility</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#38bdf8', fontSize: '20px', fontWeight: '700' }}>
          {volatility || '1.2'}
        </div>
      </div>
    </div>
  );
};
