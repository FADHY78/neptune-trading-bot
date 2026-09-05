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
    <div className="market-metrics-grid">
      {/* 1. CURRENT DIGIT */}
      <div className="metric-item">
        <div className="metric-label">
          <Hash size={13} color="#60a5fa" />
          <span>Current Digit</span>
        </div>
        <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
          {currentDigit !== null && currentDigit !== undefined ? currentDigit : '-'}
        </div>
      </div>

      {/* 2. LIVE PRICE */}
      <div className="metric-item">
        <div className="metric-label">
          <DollarSign size={13} color="#60a5fa" />
          <span>Live Price</span>
        </div>
        <div className="metric-value">
          ${typeof livePrice === 'number' ? livePrice.toFixed(5) : livePrice || '0.00000'}
        </div>
      </div>

      {/* 3. TOTAL TICKS */}
      <div className="metric-item">
        <div className="metric-label">
          <Activity size={13} color="#60a5fa" />
          <span>Total Ticks</span>
        </div>
        <div className="metric-value" style={{ color: '#ffffff' }}>
          {totalTicks || 0}
        </div>
      </div>

      {/* 4. % EVEN/ODD */}
      <div className="metric-item">
        <div className="metric-label">
          <PieChart size={13} color="#60a5fa" />
          <span>% Even/Odd</span>
        </div>
        <div className="metric-value" style={{ color: '#93c5fd' }}>
          {evenPercentage}%/{oddPercentage}%
        </div>
      </div>

      {/* 5. LAST UPDATE */}
      <div className="metric-item">
        <div className="metric-label">
          <Clock size={13} color="#60a5fa" />
          <span>Last Update</span>
        </div>
        <div className="metric-value" style={{ fontSize: '18px', color: '#e2e8f0' }}>
          {lastUpdate || '00:00:00'}
        </div>
      </div>

      {/* 6. VOLATILITY */}
      <div className="metric-item">
        <div className="metric-label">
          <Zap size={13} color="#60a5fa" />
          <span>Volatility</span>
        </div>
        <div className="metric-value" style={{ color: '#38bdf8' }}>
          {volatility || '1.2'}
        </div>
      </div>
    </div>
  );
};
