import React, { useState } from 'react';
import { Activity, ShieldAlert, Volume2, VolumeX, Settings, Radio, LogIn, CheckCircle, ChevronDown, User, ShieldCheck } from 'lucide-react';

export const Navbar = ({ 
  connected, 
  isAuthorized, 
  isDemo, 
  balance, 
  currency, 
  simulationMode, 
  soundEffects,
  accountList = [],
  currentLoginId = '',
  onSelectAccount,
  onToggleSound,
  onOpenRiskModal,
  onOpenSettings,
  onDerivLogin
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <header style={{
      backgroundColor: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border-color)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #00D4FF 0%, #0055ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)'
        }}>
          <Activity size={22} color="#040914" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>Neptune</span>
            <span style={{ color: 'var(--text-primary)' }}>Trading Bot</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Deriv Automated Digit Terminal</div>
        </div>
      </div>

      {/* Center: Live Account Switcher & Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {simulationMode ? (
          <div className="status-pill connected" style={{ background: 'rgba(0, 212, 255, 0.1)', borderColor: 'rgba(0, 212, 255, 0.3)', color: 'var(--accent-cyan)' }}>
            <Radio size={14} className="pulse" />
            <span>Simulator Mode (Testing)</span>
          </div>
        ) : isAuthorized ? (
          <div style={{ position: 'relative' }}>
            {/* Account Selector Button */}
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="status-pill connected"
              style={{
                cursor: 'pointer',
                background: isDemo ? 'rgba(0, 212, 255, 0.08)' : 'rgba(0, 230, 118, 0.1)',
                borderColor: isDemo ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 230, 118, 0.4)',
                color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px'
              }}
              title="Click to switch Deriv Real or Demo account"
            >
              <span className="status-dot pulse" style={{ backgroundColor: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)' }} />
              <span style={{ fontWeight: '700' }}>
                {isDemo ? 'DEMO' : 'REAL'}:
              </span>
              <span className="font-mono" style={{ fontSize: '12px' }}>
                {currentLoginId || (isDemo ? 'VRTC' : 'CR')}
              </span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>({currency || 'USD'})</span>
              {accountList && accountList.length > 1 && (
                <ChevronDown size={14} style={{ marginLeft: '2px' }} />
              )}
            </button>

            {/* Account Selection Dropdown */}
            {showAccountMenu && accountList && accountList.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                minWidth: '260px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                padding: '8px',
                zIndex: 200
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', fontWeight: '700' }}>
                  Switch Account ({accountList.length} Accounts Found)
                </div>
                {accountList.map((acc) => {
                  const isActive = acc.loginid === currentLoginId;
                  return (
                    <div
                      key={acc.loginid}
                      onClick={() => {
                        if (onSelectAccount) onSelectAccount(acc);
                        setShowAccountMenu(false);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isActive ? 'var(--bg-input)' : 'transparent',
                        border: isActive ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                        marginBottom: '4px',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: acc.isVirtual ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                          color: acc.isVirtual ? 'var(--accent-cyan)' : 'var(--color-success)',
                          textTransform: 'uppercase'
                        }}>
                          {acc.isVirtual ? 'DEMO' : 'REAL'}
                        </span>
                        <div>
                          <div className="font-mono" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {acc.loginid}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Currency: {acc.currency || 'USD'}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <CheckCircle size={14} color="var(--color-success)" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : connected ? (
          <div className="status-pill connected" style={{ color: 'var(--color-warning)' }}>
            <span className="status-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
            <span>Deriv WebSocket Ready (Awaiting Token)</span>
          </div>
        ) : (
          <div className="status-pill disconnected">
            <span className="status-dot" />
            <span>Disconnected from Deriv</span>
          </div>
        )}
      </div>

      {/* Right Controls & Balance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Deriv OAuth Login Button */}
        {!isAuthorized ? (
          <button 
            className="btn btn-primary"
            onClick={onDerivLogin}
            title="Log in with Deriv OAuth to access real-time data & live trading"
            style={{ padding: '7px 14px', fontSize: '12px' }}
          >
            <LogIn size={15} />
            <span>Log in with Deriv</span>
          </button>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)',
            backgroundColor: isDemo ? 'rgba(0, 212, 255, 0.08)' : 'rgba(0, 230, 118, 0.1)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: `1px solid ${isDemo ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`
          }}>
            <ShieldCheck size={14} />
            <span>{isDemo ? 'Demo Live' : 'Real Money Active'}</span>
          </div>
        )}

        {/* Balance Display */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '6px 14px',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          minWidth: '110px'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isDemo ? 'Demo Balance' : 'Real Balance'}
          </span>
          <span className="font-mono" style={{ fontSize: '15px', fontWeight: '700', color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)' }}>
            ${balance !== undefined && balance !== null ? Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}{' '}
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{currency || 'USD'}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <button 
          className="btn btn-secondary" 
          onClick={onToggleSound}
          title={soundEffects ? "Sound Enabled" : "Sound Muted"}
          style={{ padding: '8px 12px' }}
        >
          {soundEffects ? <Volume2 size={16} color="var(--accent-cyan)" /> : <VolumeX size={16} color="var(--text-muted)" />}
        </button>

        <button 
          className="btn btn-secondary" 
          onClick={onOpenRiskModal}
          title="Risk Warning & Guidance"
          style={{ padding: '8px 12px' }}
        >
          <ShieldAlert size={16} color="var(--color-warning)" />
        </button>
      </div>
    </header>
  );
};

