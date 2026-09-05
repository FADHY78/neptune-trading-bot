import React, { useState } from 'react';
import { 
  BarChart2, Cpu, Signal, Play, Square, Info, Sliders, ChevronDown, ChevronUp, Key, ShieldCheck 
} from 'lucide-react';
import { DERIV_SYMBOLS } from '../constants/symbols.js';
import { STRATEGY_PRESETS } from '../constants/strategies.js';

export const ProfitPlusControls = ({
  config,
  onChangeConfig,
  isRunning,
  onStartBot,
  onStopBot,
  onAnalyzeStrategy,
  onAnalyzeMatches,
  recommendedSignal = 'Matches',
  isConnected,
  isAuthorized,
  isConnecting,
  availableSymbols = [],
  onOAuthLogin,
  onConnectDeriv
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Available Volatility Indices
  const volSymbols = DERIV_SYMBOLS.filter(s => s.category.includes('(1s)') || s.category === 'Continuous');

  const handleSymbolChange = (e) => {
    const sym = e.target.value;
    onChangeConfig({
      ...config,
      activeSymbols: [sym]
    });
  };

  const handleStrategyChange = (e) => {
    const stratId = e.target.value;
    onChangeConfig({
      ...config,
      strategyId: stratId
    });
  };

  const activeSymbol = config?.activeSymbols?.[0] || '1HZ100V';
  const activeStrategy = config?.strategyId || 'matches-sniper-76';

  return (
    <div className="profit-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Volatility Dropdown */}
      <div className="profit-select-group">
        <label className="profit-label">
          <BarChart2 size={15} color="#60a5fa" />
          <span>Volatility</span>
        </label>
        <select
          className="profit-select"
          value={activeSymbol}
          onChange={handleSymbolChange}
        >
          {volSymbols.map(s => (
            <option key={s.symbol} value={s.symbol}>
              {s.name} ({s.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* 2. Strategy Dropdown */}
      <div className="profit-select-group">
        <label className="profit-label">
          <Cpu size={15} color="#60a5fa" />
          <span>Strategy</span>
        </label>
        <select
          className="profit-select"
          value={activeStrategy}
          onChange={handleStrategyChange}
        >
          {STRATEGY_PRESETS.map(st => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Connection Status Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#93c5fd', fontWeight: '600' }}>
          <Signal size={15} color="#60a5fa" />
          <span>Connection Status</span>
        </div>

        <div className={`profit-status-pill ${isConnected || config.simulationMode ? 'live' : ''}`}>
          <span className="pulse-dot" style={{
            backgroundColor: isConnected || config.simulationMode ? 'var(--color-success)' : 'var(--color-danger)'
          }} />
          <span>{config.simulationMode ? 'Simulator Active' : isConnected ? 'Live' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
        </div>
      </div>

      {/* 4. Action Controls: Start & Stop */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-bright-blue)', marginBottom: '8px' }}>
          Controls
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-action-start"
            onClick={onStartBot}
            disabled={isRunning}
          >
            <Play size={16} fill="currentColor" />
            <span>Start</span>
          </button>

          <button
            className="btn-action-stop"
            onClick={onStopBot}
            disabled={!isRunning}
          >
            <Square size={16} fill="currentColor" />
            <span>Stop</span>
          </button>
        </div>
      </div>

      {/* 5. Analyze Strategy Button */}
      <button
        className="btn-action-analyze"
        onClick={onAnalyzeStrategy}
      >
        <Info size={16} />
        <span>Analyze Strategy</span>
      </button>

      {/* 6. Strategic Signal / Matches Analysis Button (Clickable as in screenshots 3 & 4) */}
      <button
        type="button"
        className="signal-banner"
        onClick={() => onAnalyzeMatches ? onAnalyzeMatches() : onAnalyzeStrategy()}
        style={{
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          outline: 'none',
          transition: 'transform 0.15s ease, box-shadow 0.2s ease',
          userSelect: 'none'
        }}
        title="Click to analyze market for Matches digit"
      >
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffffff', display: 'inline-block', boxShadow: '0 0 6px #fff' }} />
        <span>Matches</span>
      </button>

      {/* 7. Collapsible Advanced Trading Parameters (Stake, Martingale, Stop Loss) */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-bright-blue)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={14} />
            <span>Trading Parameters & Risk Management</span>
          </div>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {/* Initial Stake */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Initial Stake ($)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.35"
                  className="profit-input"
                  value={config.initialStake || 5}
                  onChange={(e) => onChangeConfig({ ...config, initialStake: parseFloat(e.target.value) || 1 })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Martingale Factor
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  className="profit-input"
                  value={config.martingaleFactor || 12}
                  onChange={(e) => onChangeConfig({ ...config, martingaleFactor: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Take Profit & Stop Loss */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Take Profit ($)
                </label>
                <input
                  type="number"
                  step="5"
                  className="profit-input"
                  value={config.takeProfit || 50}
                  onChange={(e) => onChangeConfig({ ...config, takeProfit: parseFloat(e.target.value) || 50 })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Stop Loss ($)
                </label>
                <input
                  type="number"
                  step="5"
                  className="profit-input"
                  value={config.stopLoss || 50}
                  onChange={(e) => onChangeConfig({ ...config, stopLoss: parseFloat(e.target.value) || 50 })}
                />
              </div>
            </div>

            {/* Simulator Mode Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-input)'
            }}>
              <span style={{ fontSize: '12px', color: '#e2e8f0' }}>Simulator Mode</span>
              <button
                onClick={() => onChangeConfig({ ...config, simulationMode: !config.simulationMode })}
                style={{
                  background: config.simulationMode ? 'var(--accent-cyan)' : '#334155',
                  color: config.simulationMode ? '#000000' : '#ffffff',
                  border: 'none',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {config.simulationMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* API Token Input if not logged in */}
            {!isAuthorized && (
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Deriv API Token
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="password"
                    placeholder="Paste Deriv API Token"
                    className="profit-input"
                    value={config.apiToken || ''}
                    onChange={(e) => onChangeConfig({ ...config, apiToken: e.target.value })}
                  />
                  <button
                    onClick={onConnectDeriv}
                    style={{
                      background: 'var(--accent-blue)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
