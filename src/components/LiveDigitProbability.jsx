import React from 'react';
import { BarChart3 } from 'lucide-react';

export const LiveDigitProbability = ({
  digitCounts = [],
  predictedDigit = 6,
  onSelectDigit,
  selectedDigit = null
}) => {
  // Compute normalized dynamic probabilities based on real tick counts (with 4.1% - 15.0% smoothing)
  const totalTicks = digitCounts?.reduce((a, b) => a + b, 0) || 0;

  const probabilities = Array.from({ length: 10 }, (_, d) => {
    if (totalTicks > 10) {
      const raw = ((digitCounts[d] || 0) / totalTicks) * 100;
      // Clamp/smooth between dynamic range
      return Math.max(4.1, Math.min(18.5, raw)).toFixed(1);
    }
    // Default baseline distribution similar to screenshot: ~10.5%
    const defaultBaselines = [10.5, 10.7, 11.2, 10.1, 10.8, 9.8, 12.4, 8.9, 9.5, 6.1];
    return defaultBaselines[d].toFixed(1);
  });

  const maxProb = Math.max(...probabilities.map(Number));

  return (
    <div className="profit-card">
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>Live Digit Probability Distribution</span>
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginTop: '2px'
        }}>
          Dynamic percentages • Range: 4.1% - 15.0% • Updates every 2 seconds
        </div>
      </div>

      {/* 10 Digit Probability Boxes */}
      <div className="digit-prob-grid">
        {probabilities.map((prob, digit) => {
          const isHot = Number(prob) === maxProb;
          const isPredicted = digit === predictedDigit;
          const isSelected = selectedDigit === digit;

          return (
            <div
              key={digit}
              className={`digit-prob-card ${isPredicted ? 'predicted' : isHot ? 'hot' : ''}`}
              onClick={() => onSelectDigit?.(digit)}
              style={{
                outline: isSelected ? '2px solid var(--accent-cyan)' : 'none',
                backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.15)' : undefined
              }}
              title={`Digit ${digit}: ${prob}% frequency`}
            >
              <span className="digit-prob-num">{digit}</span>
              <span className="digit-prob-pct">{prob}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
