import React, { useEffect, useRef, useState } from 'react';
import { Hash, TrendingUp, Activity, PieChart, Clock, Zap } from 'lucide-react';

// Format raw number to 2 decimal places for display
function fmtPrice(price) {
  if (price === null || price === undefined) return null;
  const n = Number(price);
  if (isNaN(n) || n === 0) return null;
  return n.toFixed(2);
}

export const LiveMarketMetrics = ({
  currentDigit,
  livePrice,          // raw number from Deriv tick (e.g. 20.49460)
  totalTicks = 0,
  evenPercentage = 0,
  oddPercentage = 0,
  lastUpdate = null,
  volatility = null,
}) => {
  const [digitPulse, setDigitPulse] = useState(false);
  const [pricePulse, setPricePulse] = useState(false);
  const prevDigitRef = useRef(currentDigit);
  const prevPriceRef = useRef(livePrice);

  useEffect(() => {
    if (currentDigit !== prevDigitRef.current && currentDigit !== null && currentDigit !== undefined) {
      setDigitPulse(true);
      setTimeout(() => setDigitPulse(false), 400);
      prevDigitRef.current = currentDigit;
    }
  }, [currentDigit]);

  useEffect(() => {
    if (livePrice !== prevPriceRef.current && livePrice !== null) {
      setPricePulse(true);
      setTimeout(() => setPricePulse(false), 300);
      prevPriceRef.current = livePrice;
    }
  }, [livePrice]);

  const displayPrice = fmtPrice(livePrice);
  const displayVol = (volatility !== null && volatility !== undefined) ? Number(volatility).toFixed(1) : null;
  const waiting = <span style={{ color: '#4a5680', fontSize: '13px', fontWeight: '600' }}>Waiting...</span>;

  return (
    <div className="market-metrics-grid" style={{
      background: 'linear-gradient(145deg, #101a4f 0%, #0d153d 100%)',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      borderRadius: 'var(--radius-xl)',
      padding: '16px',
      boxShadow: '0 0 24px rgba(37, 99, 235, 0.18)'
    }}>

      {/* 1. CURRENT DIGIT — last digit of the live price at full pip precision */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Hash size={13} color="#60a5fa" />
          <span>Current Digit</span>
        </div>
        <div className="metric-value font-mono" style={{
          color: 'var(--accent-cyan)',
          fontSize: '32px',
          fontWeight: '900',
          transition: 'transform 0.15s ease',
          transform: digitPulse ? 'scale(1.3)' : 'scale(1)',
          textShadow: digitPulse ? '0 0 20px var(--accent-cyan)' : '0 0 8px rgba(0,212,255,0.35)'
        }}>
          {(currentDigit !== null && currentDigit !== undefined) ? currentDigit : waiting}
        </div>
      </div>

      {/* 2. LIVE PRICE — 2 decimal places from the raw Deriv quote */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <TrendingUp size={13} color="#60a5fa" />
          <span>Live Price</span>
        </div>
        <div className="metric-value font-mono" style={{
          color: displayPrice ? '#ffffff' : '#4a5680',
          fontSize: '20px',
          fontWeight: '800',
          textShadow: pricePulse ? '0 0 14px rgba(255,255,255,0.7)' : 'none',
          transition: 'text-shadow 0.3s ease'
        }}>
          {displayPrice ? `$${displayPrice}` : waiting}
        </div>
      </div>

      {/* 3. TOTAL TICKS */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Activity size={13} color="#60a5fa" />
          <span>Total Ticks</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
          {totalTicks > 0 ? totalTicks : waiting}
        </div>
      </div>

      {/* 4. % EVEN/ODD */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <PieChart size={13} color="#60a5fa" />
          <span>% Even/Odd</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#93c5fd', fontSize: '18px', fontWeight: '700' }}>
          {totalTicks > 0 ? `${evenPercentage}%/${oddPercentage}%` : waiting}
        </div>
      </div>

      {/* 5. LAST UPDATE */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Clock size={13} color="#60a5fa" />
          <span>Last Update</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: '600' }}>
          {lastUpdate || waiting}
        </div>
      </div>

      {/* 6. VOLATILITY — symbol-based or delta-computed */}
      <div className="metric-item">
        <div className="metric-label" style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Zap size={13} color="#60a5fa" />
          <span>Volatility</span>
        </div>
        <div className="metric-value font-mono" style={{ color: '#38bdf8', fontSize: '20px', fontWeight: '700' }}>
          {displayVol || waiting}
        </div>
      </div>

    </div>
  );
};



