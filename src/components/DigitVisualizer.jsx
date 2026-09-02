import React from 'react';
import { BarChart2 } from 'lucide-react';

export const DigitVisualizer = ({ digitCounts }) => {
  const total = digitCounts.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="card" style={{ marginBottom: '16px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
          <BarChart2 size={16} />
          <span>Real-Time Digit Frequency Analysis (Last {total} Ticks)</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Digits 0–9</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: '6px',
        alignItems: 'flex-end',
        height: '80px',
        paddingTop: '10px'
      }}>
        {digitCounts.map((count, digit) => {
          const pct = Math.round((count / total) * 100);
          const maxCount = Math.max(...digitCounts, 1);
          const barHeight = Math.max(Math.round((count / maxCount) * 100), 8);

          return (
            <div key={digit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
              <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}%</span>
              <div style={{
                width: '100%',
                height: `${barHeight}%`,
                backgroundColor: count === maxCount && count > 0 ? 'var(--accent-cyan)' : 'rgba(30, 58, 95, 0.8)',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease, background-color 0.3s ease',
                boxShadow: count === maxCount && count > 0 ? '0 0 8px rgba(0, 212, 255, 0.4)' : 'none'
              }} />
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: count === maxCount && count > 0 ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                {digit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
