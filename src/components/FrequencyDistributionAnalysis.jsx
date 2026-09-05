import React, { useState } from 'react';
import { BarChart2, PieChart as PieIcon, Grid, History } from 'lucide-react';

export const FrequencyDistributionAnalysis = ({
  digitCounts = [],
  totalTicks = 214,
  predictedDigit = 6
}) => {
  const [activeTab, setActiveTab] = useState('bar'); // 'bar', 'pie', 'grid'

  const counts = digitCounts?.length === 10 ? digitCounts : [18, 22, 28, 20, 24, 19, 31, 15, 23, 14];
  const maxVal = Math.max(...counts, 1);
  const total = counts.reduce((a, b) => a + b, 0) || 1;

  // Compute Y-axis steps (e.g. 7, 14, 21, 28)
  const step = Math.ceil(maxVal / 4);
  const yAxisMarkers = [step * 4, step * 3, step * 2, step];

  return (
    <div className="profit-card">
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '15px',
          fontWeight: '800',
          color: '#ffffff'
        }}>
          <History size={17} color="var(--accent-cyan)" />
          <span>Frequency Distribution Analysis</span>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginTop: '2px'
        }}>
          Statistical analysis of digit occurrence patterns
        </div>
      </div>

      {/* Tabs: Bar Chart, Pie Chart, Grid View */}
      <div className="freq-tabs">
        <button
          className={`freq-tab-btn ${activeTab === 'bar' ? 'active' : ''}`}
          onClick={() => setActiveTab('bar')}
        >
          <BarChart2 size={14} />
          <span>Bar Chart</span>
        </button>

        <button
          className={`freq-tab-btn ${activeTab === 'pie' ? 'active' : ''}`}
          onClick={() => setActiveTab('pie')}
        >
          <PieIcon size={14} />
          <span>Pie Chart</span>
        </button>

        <button
          className={`freq-tab-btn ${activeTab === 'grid' ? 'active' : ''}`}
          onClick={() => setActiveTab('grid')}
        >
          <Grid size={14} />
          <span>Grid View</span>
        </button>
      </div>

      {/* Tab 1: Bar Chart (Image 2) */}
      {activeTab === 'bar' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '190px', padding: '0 4px' }}>
          {/* Y-Axis Labels */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '140px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            paddingRight: '6px',
            borderRight: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            {yAxisMarkers.map(mark => (
              <span key={mark}>{mark}</span>
            ))}
            <span>0</span>
          </div>

          {/* 10 Vertical Bars (0 to 9) */}
          <div style={{
            display: 'flex',
            flex: 1,
            alignItems: 'flex-end',
            height: '170px',
            gap: '6px',
            paddingBottom: '2px'
          }}>
            {counts.map((count, digit) => {
              const pct = Math.round((count / total) * 100);
              const heightPct = Math.max(Math.round((count / (step * 4)) * 100), 6);
              const isHot = count === maxVal;
              const isPredicted = digit === predictedDigit;

              return (
                <div key={digit} className={`freq-bar-item ${isHot ? 'hot' : ''}`}>
                  <span className="font-mono" style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    {count}
                  </span>
                  <div
                    className="freq-bar-pillar"
                    style={{
                      height: `${heightPct}%`,
                      background: isPredicted
                        ? 'linear-gradient(180deg, #00d4ff 0%, #2563eb 100%)'
                        : isHot
                        ? 'linear-gradient(180deg, #a855f7 0%, #3b82f6 100%)'
                        : undefined
                    }}
                  />
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: isPredicted ? 'var(--accent-cyan)' : isHot ? '#a855f7' : '#ffffff'
                    }}
                  >
                    {digit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Pie / Donut Chart */}
      {activeTab === 'pie' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0' }}>
          <svg viewBox="0 0 100 100" style={{ width: '150px', height: '150px', transform: 'rotate(-90deg)' }}>
            {(() => {
              let cumulative = 0;
              const colors = [
                '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899',
                '#f59e0b', '#6366f1', '#14b8a6', '#0ea5e9', '#d946ef'
              ];
              return counts.map((count, digit) => {
                const fraction = count / total;
                const dashArray = `${fraction * 314.15} 314.15`;
                const dashOffset = -cumulative * 314.15;
                cumulative += fraction;

                return (
                  <circle
                    key={digit}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={colors[digit % colors.length]}
                    strokeWidth="14"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                  />
                );
              });
            })()}
          </svg>

          {/* Legend Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '6px',
            marginTop: '12px',
            width: '100%'
          }}>
            {counts.map((count, digit) => {
              const pct = ((count / total) * 100).toFixed(1);
              return (
                <div key={digit} style={{
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(10, 16, 46, 0.6)',
                  padding: '4px 6px',
                  borderRadius: '4px'
                }}>
                  <span style={{ fontWeight: '700', color: '#ffffff' }}>D{digit}:</span>
                  <span className="font-mono" style={{ color: 'var(--text-bright-blue)' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Grid View */}
      {activeTab === 'grid' && (
        <div style={{ overflowX: 'auto', marginTop: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 8px' }}>Digit</th>
                <th style={{ padding: '6px 8px' }}>Occurrences</th>
                <th style={{ padding: '6px 8px' }}>Percentage</th>
                <th style={{ padding: '6px 8px' }}>Parity</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count, digit) => {
                const pct = ((count / total) * 100).toFixed(1);
                const isHot = count === maxVal;
                const isCold = count === Math.min(...counts);
                const isEven = digit % 2 === 0;

                return (
                  <tr key={digit} style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    <td className="font-mono" style={{ padding: '6px 8px', fontWeight: '700', color: '#ffffff' }}>
                      Digit {digit}
                    </td>
                    <td className="font-mono" style={{ padding: '6px 8px', color: 'var(--text-bright-blue)' }}>
                      {count}
                    </td>
                    <td className="font-mono" style={{ padding: '6px 8px' }}>
                      {pct}%
                    </td>
                    <td style={{ padding: '6px 8px', color: isEven ? '#60a5fa' : '#c084fc', fontWeight: '600' }}>
                      {isEven ? 'EVEN' : 'ODD'}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        background: isHot ? 'rgba(168, 85, 247, 0.2)' : isCold ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: isHot ? '#c084fc' : isCold ? '#38bdf8' : 'var(--text-muted)'
                      }}>
                        {isHot ? '🔥 HOT' : isCold ? '❄️ COLD' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
