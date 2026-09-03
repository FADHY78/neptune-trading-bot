import React, { useState } from 'react';
import { 
  Key, Eye, EyeOff, Play, Square, Trash2, Cpu, ShieldAlert, Zap, 
  Settings2, RefreshCw, CheckSquare, Layers, Sliders, ToggleLeft, ToggleRight
} from 'lucide-react';
import { DERIV_SYMBOLS } from '../constants/symbols.js';
import { STRATEGY_PRESETS } from '../constants/strategies.js';

export const ControlPanel = ({
  config,
  onChangeConfig,
  onOAuthLogin,
  onOAuthSignUp,
  onConnectDeriv,
  availableSymbols = [],
  isConnecting,
  isConnected,
  isAuthorized,
  isRunning,
  onStartBot,
  onStopBot,
  onClearData,
  onLogout,
  accountList = [],
  currentLoginId = '',
  onSelectAccount,
  balance = 0,
  currency = 'USD',
  isDemo = true
}) => {
  const [showToken, setShowToken] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('all'); // 'all', '1s', 'continuous', 'other'

  const handleInputChange = (field, value) => {
    onChangeConfig({ ...config, [field]: value });
  };

  const handleSymbolToggle = (symbol) => {
    const active = config.activeSymbols || [];
    let updated;
    if (active.includes(symbol)) {
      if (active.length === 1) return; // Must keep at least one
      updated = active.filter(s => s !== symbol);
    } else {
      updated = [...active, symbol];
    }
    onChangeConfig({ ...config, activeSymbols: updated });
  };

  const handleDigitToggle = (digit) => {
    const selected = config.selectedDigits || [];
    let updated;
    if (selected.includes(digit)) {
      if (selected.length === 1) return;
      updated = selected.filter(d => d !== digit);
    } else {
      updated = [...selected, digit];
    }
    onChangeConfig({ ...config, selectedDigits: updated });
  };

  // Compute Martingale Preview
  const stake = Number(config.initialStake) || 5;
  const factor = Number(config.martingaleFactor) || 12;
  const maxStake = Number(config.maxStake) || 260;

  const step1 = stake;
  const step2 = Math.min(step1 * factor, maxStake);
  const step3 = Math.min(step2 * factor, maxStake);

  return (
    <aside className="panel" style={{
      width: '380px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px',
      backgroundColor: 'var(--bg-panel)'
    }}>
      {/* A. API Connection Panel */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
            <Key size={16} />
            <span>Deriv API Connection</span>
          </div>
          {/* Mode Switcher */}
          <button
            onClick={() => handleInputChange('simulationMode', !config.simulationMode)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: config.simulationMode ? 'var(--accent-cyan)' : 'var(--color-success)',
              fontSize: '11px',
              fontWeight: '600'
            }}
            title="Toggle between Simulator Mode and Real Deriv WebSocket API"
          >
            {config.simulationMode ? <ToggleLeft size={20} /> : <ToggleRight size={20} />}
            <span>{config.simulationMode ? 'Simulator' : 'Live WS'}</span>
          </button>
        </div>

        {!config.simulationMode && (
          <>
            {isAuthorized ? (
              <div style={{
                backgroundColor: isDemo ? 'rgba(0, 212, 255, 0.06)' : 'rgba(0, 230, 118, 0.08)',
                border: `1px solid ${isDemo ? 'rgba(0, 212, 255, 0.25)' : 'rgba(0, 230, 118, 0.3)'}`,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-dot pulse" style={{ backgroundColor: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)' }} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)', textTransform: 'uppercase' }}>
                      {isDemo ? 'Demo Trading Account' : 'Real Money Account'}
                    </span>
                  </div>
                  {onLogout && (
                    <button
                      className="btn btn-secondary"
                      onClick={onLogout}
                      style={{ fontSize: '10px', padding: '3px 8px', height: 'auto' }}
                      title="Disconnect Deriv Session"
                    >
                      Log Out
                    </button>
                  )}
                </div>

                {/* Account Selection Dropdown */}
                {accountList && accountList.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Active Trading Account:
                    </label>
                    <select
                      className="input-field font-mono"
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px', cursor: 'pointer' }}
                      value={currentLoginId}
                      onChange={(e) => {
                        const target = accountList.find(a => a.loginid === e.target.value);
                        if (target && onSelectAccount) onSelectAccount(target);
                      }}
                    >
                      {accountList.map(acc => (
                        <option key={acc.loginid} value={acc.loginid}>
                          {acc.isVirtual ? 'DEMO' : 'REAL'} - {acc.loginid} ({acc.currency || 'USD'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Live Balance:</span>
                  <span className="font-mono font-bold" style={{ color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)', fontSize: '14px' }}>
                    ${Number(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency || 'USD'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <button
                  className="btn btn-primary"
                  style={{ gap: '6px', fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
                  onClick={onOAuthLogin}
                  disabled={isConnecting}
                  title="Log in using Deriv OAuth 2.0 PKCE flow"
                >
                  <span>🔑 Log in (Deriv)</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '11px', padding: '8px 10px', justifyContent: 'center' }}
                  onClick={onOAuthSignUp}
                  disabled={isConnecting}
                  title="Create a new Deriv account with PKCE registration flow"
                >
                  <span>✨ Sign Up</span>
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              — OR CONNECT WITH API TOKEN —
            </div>

            <div className="input-group">
              <label className="input-label">
                <span>API Token</span>
                <span 
                  onClick={() => setShowToken(!showToken)} 
                  style={{ cursor: 'pointer', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showToken ? 'Hide' : 'Show'}
                </span>
              </label>
              <input
                type={showToken ? "text" : "password"}
                className="input-field font-mono"
                placeholder="Paste your Deriv API Token"
                value={config.apiToken}
                onChange={(e) => handleInputChange('apiToken', e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span>App ID (Deriv WebSocket)</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Default: 1089</span>
              </label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="1089"
                value={config.appId}
                onChange={(e) => handleInputChange('appId', e.target.value)}
              />
            </div>

            <button
              className={`btn ${isAuthorized ? 'btn-success' : 'btn-secondary'}`}
              style={{ width: '100%', marginTop: '4px' }}
              onClick={onConnectDeriv}
              disabled={isConnecting || !config.apiToken}
            >
              {isConnecting ? (
                <>
                  <RefreshCw size={14} className="pulse" />
                  <span>Connecting...</span>
                </>
              ) : isAuthorized ? (
                <span>Connected & Authorized ✓</span>
              ) : (
                <span>Connect with Token</span>
              )}
            </button>
          </>
        )}

        {config.simulationMode && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-input)',
            padding: '8px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)'
          }}>
            ⚡ <strong>Simulation Mode Active:</strong> Allows complete testing of strategies, Martingale progression, and Stop Loss / Take Profit without connecting a real Deriv token.
          </div>
        )}
      </div>

      {/* B. Strategy Selector */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
          <Cpu size={16} />
          <span>Strategy Selection</span>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Select Strategy</label>
          <select
            className="input-field"
            value={config.strategyId}
            onChange={(e) => handleInputChange('strategyId', e.target.value)}
            disabled={isRunning}
          >
            {STRATEGY_PRESETS.map((strat) => (
              <option key={strat.id} value={strat.id}>
                {strat.popular ? `⭐ ${strat.name}` : strat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Over / Under Interactive Controls */}
        {config.strategyId === 'over-under-barrier' && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.25)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎯 Over / Under Trade Direction & Barrier Setup
            </div>

            {/* Direction Toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <button
                type="button"
                className={`btn ${config.overUnderDirection !== 'UNDER' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '8px 6px',
                  backgroundColor: config.overUnderDirection !== 'UNDER' ? 'rgba(0, 230, 118, 0.18)' : 'transparent',
                  borderColor: config.overUnderDirection !== 'UNDER' ? 'var(--color-success)' : 'var(--border-color)',
                  color: config.overUnderDirection !== 'UNDER' ? 'var(--color-success)' : 'var(--text-secondary)'
                }}
                onClick={() => handleInputChange('overUnderDirection', 'OVER')}
                disabled={isRunning}
              >
                ▲ OVER (Digit &gt; {config.barrier !== undefined ? config.barrier : 4})
              </button>

              <button
                type="button"
                className={`btn ${config.overUnderDirection === 'UNDER' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '8px 6px',
                  backgroundColor: config.overUnderDirection === 'UNDER' ? 'rgba(255, 61, 90, 0.18)' : 'transparent',
                  borderColor: config.overUnderDirection === 'UNDER' ? 'var(--color-danger)' : 'var(--border-color)',
                  color: config.overUnderDirection === 'UNDER' ? 'var(--color-danger)' : 'var(--text-secondary)'
                }}
                onClick={() => handleInputChange('overUnderDirection', 'UNDER')}
                disabled={isRunning}
              >
                ▼ UNDER (Digit &lt; {config.barrier !== undefined ? config.barrier : 4})
              </button>
            </div>

            {/* Barrier Selection */}
            <div className="input-group" style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Selected Barrier Digit</label>
                <span className="font-mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                  Target Barrier: {config.barrier !== undefined ? config.barrier : 4}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(d => {
                  const isSelected = (config.barrier !== undefined ? Number(config.barrier) : 4) === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleInputChange('barrier', d)}
                      disabled={isRunning}
                      style={{
                        padding: '6px 0',
                        fontSize: '12px',
                        fontWeight: '700',
                        borderRadius: '4px',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                        color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                        cursor: isRunning ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Winning Digits Info */}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {config.overUnderDirection === 'UNDER' ? (
                <>Winning Digits: <strong style={{ color: 'var(--color-success)' }}>[{Array.from({ length: config.barrier !== undefined ? config.barrier : 4 }, (_, i) => i).join(', ')}]</strong></>
              ) : (
                <>Winning Digits: <strong style={{ color: 'var(--color-success)' }}>[{Array.from({ length: 9 - (config.barrier !== undefined ? config.barrier : 4) }, (_, i) => (config.barrier !== undefined ? config.barrier : 4) + 1 + i).join(', ')}]</strong></>
              )}
              <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                ⚡ Bot scans live tick momentum and enters when {config.overUnderDirection || 'OVER'} probability is maximized.
              </span>
            </div>
          </div>
        )}

        {/* Even / Odd Interactive Controls */}
        {config.strategyId === 'even-odd-wave' && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.25)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ Parity Selection & Opportunity Scanner
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { id: 'auto', label: 'Auto Scan', desc: 'Markov wave' },
                { id: 'even', label: 'Even Only', desc: '0, 2, 4, 6, 8' },
                { id: 'odd', label: 'Odd Only', desc: '1, 3, 5, 7, 9' }
              ].map(opt => {
                const isSelected = (config.evenOddMode || 'auto') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleInputChange('evenOddMode', opt.id)}
                    disabled={isRunning}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                      color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: isRunning ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div>{opt.label}</div>
                    <div style={{ fontSize: '9px', fontWeight: '400', opacity: 0.8 }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              ⚡ Bot scans tick persistence runs and Markov transition probability to execute optimal parity entries.
            </div>
          </div>
        )}
      </div>

      {/* C. General Settings */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
          <Sliders size={16} />
          <span>General Trade Settings</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="input-group">
            <label className="input-label">Currency</label>
            <select
              className="input-field"
              value={config.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              disabled={isRunning}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AUD">AUD ($)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Initial Stake ($)</label>
            <input
              type="number"
              min="0.35"
              step="0.5"
              className="input-field font-mono"
              value={config.initialStake}
              onChange={(e) => handleInputChange('initialStake', e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Take Profit ($)</label>
            <input
              type="number"
              step="5"
              className="input-field font-mono"
              style={{ color: 'var(--color-success)' }}
              value={config.takeProfit}
              onChange={(e) => handleInputChange('takeProfit', e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Stop Loss ($)</label>
            <input
              type="number"
              step="5"
              className="input-field font-mono"
              style={{ color: 'var(--color-danger)' }}
              value={config.stopLoss}
              onChange={(e) => handleInputChange('stopLoss', e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Max Consecutive Losses Stop Limit</label>
          <input
            type="number"
            min="1"
            max="10"
            className="input-field font-mono"
            value={config.maxConsecLoss}
            onChange={(e) => handleInputChange('maxConsecLoss', e.target.value)}
            disabled={isRunning}
          />
        </div>
      </div>

      {/* D. Active Symbols Grid */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
            <Layers size={16} />
            <span>Active Symbols ({config.activeSymbols?.length || 0} Selected)</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '10px', padding: '3px 8px' }}
              onClick={() => {
                const allSyms = (availableSymbols && availableSymbols.length > 0 ? availableSymbols : DERIV_SYMBOLS)
                  .filter(s => s.symbol.startsWith('1HZ'))
                  .map(s => s.symbol);
                onChangeConfig({ ...config, activeSymbols: allSyms });
              }}
              disabled={isRunning}
            >
              Select (1s)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '10px', padding: '3px 8px' }}
              onClick={() => {
                const allSyms = (availableSymbols && availableSymbols.length > 0 ? availableSymbols : DERIV_SYMBOLS)
                  .map(s => s.symbol);
                onChangeConfig({ ...config, activeSymbols: allSyms });
              }}
              disabled={isRunning}
            >
              Select All
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {['all', '1s', 'continuous', 'step_jump'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSymbolFilter(cat)}
              style={{
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: symbolFilter === cat ? 'var(--accent-cyan)' : 'var(--bg-input)',
                color: symbolFilter === cat ? '#040914' : 'var(--text-secondary)',
                fontWeight: symbolFilter === cat ? '700' : '500',
                cursor: 'pointer'
              }}
            >
              {cat === 'all' ? 'All Synthetic' : cat === '1s' ? 'Volatility (1s)' : cat === 'continuous' ? 'Standard Vol' : 'Step / Jump'}
            </button>
          ))}
        </div>

        {/* Symbols List */}
        <div style={{
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '4px'
        }}>
          {(availableSymbols && availableSymbols.length > 0 ? availableSymbols : DERIV_SYMBOLS)
            .filter((sym) => {
              if (symbolFilter === '1s') return sym.symbol.startsWith('1HZ');
              if (symbolFilter === 'continuous') return sym.symbol.startsWith('R_');
              if (symbolFilter === 'step_jump') return sym.symbol.startsWith('JD') || sym.symbol.startsWith('stp') || sym.symbol.startsWith('BOOM') || sym.symbol.startsWith('CRASH');
              return true;
            })
            .map((sym) => {
              const isChecked = (config.activeSymbols || []).includes(sym.symbol);
              return (
                <label 
                  key={sym.symbol} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: isChecked ? 'rgba(0, 212, 255, 0.08)' : 'var(--bg-input)',
                    border: `1px solid ${isChecked ? 'rgba(0, 212, 255, 0.3)' : 'var(--border-color)'}`,
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSymbolToggle(sym.symbol)}
                      disabled={isRunning}
                    />
                    <div>
                      <span className="font-mono" style={{ fontSize: '11px', fontWeight: '700', color: isChecked ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                        {sym.symbol}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {sym.name || sym.display_name}
                      </span>
                    </div>
                  </div>
                  {sym.category && (
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '2px 6px', borderRadius: '3px' }}>
                      {sym.category}
                    </span>
                  )}
                </label>
              );
            })}
        </div>
      </div>

      {/* E. Trading Logic Selection */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
          <Zap size={16} />
          <span>Trading Logic</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          <label className="checkbox-label">
            <input
              type="radio"
              name="tradingLogic"
              checked={config.tradingLogic === 'analyze'}
              onChange={() => handleInputChange('tradingLogic', 'analyze')}
              disabled={isRunning}
            />
            <span>Analyze & Trade Best Opportunity</span>
          </label>

          <label className="checkbox-label">
            <input
              type="radio"
              name="tradingLogic"
              checked={config.tradingLogic === 'random'}
              onChange={() => handleInputChange('tradingLogic', 'random')}
              disabled={isRunning}
            />
            <span>Trade Random Digits (0–9)</span>
          </label>

          <label className="checkbox-label">
            <input
              type="radio"
              name="tradingLogic"
              checked={config.tradingLogic === 'specific'}
              onChange={() => handleInputChange('tradingLogic', 'specific')}
              disabled={isRunning}
            />
            <span>Trade Specific Digits</span>
          </label>
        </div>

        {config.tradingLogic === 'specific' && (
          <div className="digit-grid">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
              const active = (config.selectedDigits || []).includes(digit);
              return (
                <button
                  key={digit}
                  type="button"
                  className={`digit-btn ${active ? 'active' : ''}`}
                  onClick={() => handleDigitToggle(digit)}
                  disabled={isRunning}
                >
                  {digit}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* F. Strategy Options */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
          <Settings2 size={16} />
          <span>Strategy Options</span>
        </div>

        <label className="checkbox-label" style={{ marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={config.forceSymbolSwitch}
            onChange={(e) => handleInputChange('forceSymbolSwitch', e.target.checked)}
            disabled={isRunning}
          />
          <span>Force Symbol Switch After Trade</span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Decision Interval (s)</label>
            <input
              type="number"
              min="1"
              className="input-field font-mono"
              value={config.decisionInterval}
              onChange={(e) => handleInputChange('decisionInterval', e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Post-Trade Cooldown (s)</label>
            <input
              type="number"
              min="0"
              className="input-field font-mono"
              value={config.postTradeCooldown}
              onChange={(e) => handleInputChange('postTradeCooldown', e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <label className="checkbox-label" style={{ marginBottom: '6px' }}>
          <input
            type="checkbox"
            checked={config.fastExecution !== false}
            onChange={(e) => handleInputChange('fastExecution', e.target.checked)}
            disabled={isRunning}
          />
          <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>⚡ Millisecond Turbo Execution (Sub-second tick sniping)</span>
        </label>

        <label className="checkbox-label" style={{ marginBottom: '6px' }}>
          <input
            type="checkbox"
            checked={config.avoidLastLosingDigit}
            onChange={(e) => handleInputChange('avoidLastLosingDigit', e.target.checked)}
            disabled={isRunning}
          />
          <span>Avoid re-trading on last losing exit digit</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.avoidLastExitDigit}
            onChange={(e) => handleInputChange('avoidLastExitDigit', e.target.checked)}
            disabled={isRunning}
          />
          <span>Avoid re-trading on last trade's exit digit</span>
        </label>
      </div>

      {/* G. Risk Management - Martingale */}
      <div className="card" style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--color-warning)' }}>
            <ShieldAlert size={16} />
            <span>Risk Management (Martingale)</span>
          </div>
          <input
            type="checkbox"
            checked={config.useMartingale}
            onChange={(e) => handleInputChange('useMartingale', e.target.checked)}
            disabled={isRunning}
            style={{ accentColor: 'var(--color-warning)', cursor: 'pointer' }}
          />
        </div>

        {config.useMartingale && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="input-group">
                <label className="input-label">Multiplier Factor</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input-field font-mono"
                  value={config.martingaleFactor}
                  onChange={(e) => handleInputChange('martingaleFactor', e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Max Stake Limit ($)</label>
                <input
                  type="number"
                  step="10"
                  className="input-field font-mono"
                  value={config.maxStake}
                  onChange={(e) => handleInputChange('maxStake', e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Martingale Progression Preview */}
            {(() => {
              const s1 = Number(config.initialStake) || 5;
              const f = Number(config.martingaleFactor) || 12;
              const maxL = Number(config.maxStake) || 260;
              const s2 = Math.min(s1 * f, maxL);
              const s3 = Math.min(s2 * f, maxL);
              return (
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '8px',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progression:</span>
                  <span className="font-mono" style={{ color: 'var(--color-warning)', fontWeight: '600' }}>
                    ${s1.toFixed(2)} → ${s2.toFixed(2)} → ${s3.toFixed(2)}
                  </span>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* H. Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        {!isRunning ? (
          <button
            className="btn btn-success"
            style={{ flex: 1, padding: '12px' }}
            onClick={onStartBot}
          >
            <Play size={16} fill="currentColor" />
            <span>Start Bot</span>
          </button>
        ) : (
          <button
            className="btn btn-danger"
            style={{ flex: 1, padding: '12px' }}
            onClick={onStopBot}
          >
            <Square size={16} fill="currentColor" />
            <span>Stop Bot</span>
          </button>
        )}

        <button
          className="btn btn-secondary"
          style={{ padding: '12px' }}
          onClick={onClearData}
          title="Reset Logs & Session Statistics"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </aside>
  );
};
