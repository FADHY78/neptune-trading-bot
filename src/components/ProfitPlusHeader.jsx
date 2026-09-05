import React, { useState } from 'react';
import { Layers, ShieldCheck, Sun, Moon, LogOut, ChevronDown, Radio, Activity, RefreshCw } from 'lucide-react';

export const ProfitPlusHeader = ({
  connected,
  isAuthorized,
  isDemo,
  balance,
  currency,
  simulationMode,
  currentLoginId,
  accountList = [],
  onSelectAccount,
  onLogout,
  onDerivLogin,
  theme = 'dark',
  onToggleTheme,
  viewMode = 'auto',
  onToggleViewMode
}) => {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  return (
    <header className="profit-card" style={{
      borderRadius: 'var(--radius-lg)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      background: 'linear-gradient(135deg, #0e1740 0%, #131d52 100%)',
      border: '1px solid rgba(59, 130, 246, 0.3)'
    }}>
      {/* Brand Icon & Titles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Layered Cube / Stack Icon */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #00d4ff 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0, 212, 255, 0.45)',
          flexShrink: 0
        }}>
          <Layers size={24} color="#ffffff" strokeWidth={2.4} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '20px',
              fontWeight: '800',
              letterSpacing: '-0.3px',
              color: '#ffffff'
            }}>
              Profit Plus
            </span>
          </div>

          <div style={{
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginTop: '-2px'
          }}>
            Professional Trading Dashboard
          </div>

          {/* Badges: Premium & Secure */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '700',
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              color: 'var(--accent-cyan)'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-cyan)', display: 'inline-block' }} />
              Premium
            </span>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '700',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd'
            }}>
              <ShieldCheck size={11} color="#60a5fa" />
              Secure
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls: Account, Theme & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Deriv Account / Balance Badge */}
        {isAuthorized ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              style={{
                background: isDemo ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 230, 118, 0.12)',
                border: `1px solid ${isDemo ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 230, 118, 0.4)'}`,
                color: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Switch Real / Demo account"
            >
              <span className="pulse-dot" style={{ backgroundColor: isDemo ? 'var(--accent-cyan)' : 'var(--color-success)' }} />
              <span>{isDemo ? 'DEMO' : 'REAL'}:</span>
              <span className="font-mono">${Number(balance || 0).toFixed(2)}</span>
              {accountList?.length > 1 && <ChevronDown size={14} />}
            </button>

            {showAccountDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: '#0d143a',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                padding: '6px',
                zIndex: 100,
                minWidth: '200px'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', fontWeight: '600' }}>
                  SWITCH ACCOUNT
                </div>
                {accountList.map((acc, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectAccount?.(acc);
                      setShowAccountDropdown(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: acc.loginid === currentLoginId ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      color: acc.loginid === currentLoginId ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <span>{acc.loginid}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: acc.isVirtual ? 'var(--accent-cyan)' : 'var(--color-success)' }}>
                      {acc.isVirtual ? 'DEMO' : 'REAL'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : simulationMode ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            padding: '5px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Radio size={12} className="pulse-dot" />
            <span>Simulator Active</span>
          </div>
        ) : (
          <button
            onClick={onDerivLogin}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 0 10px rgba(37, 99, 235, 0.4)'
            }}
          >
            Log in with Deriv
          </button>
        )}

        {/* View Layout Toggle (Phone Preview / Desktop PC) */}
        <div className="view-switcher-pill" title="Switch layout mode between Desktop PC and Phone">
          <button
            className={`view-btn ${viewMode === 'pc' ? 'active' : ''}`}
            onClick={() => onToggleViewMode?.('pc')}
          >
            PC
          </button>
          <button
            className={`view-btn ${viewMode === 'phone' ? 'active' : ''}`}
            onClick={() => onToggleViewMode?.('phone')}
          >
            Phone
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-color)',
            color: '#ffffff',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Toggle Light/Dark Theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <LogOut size={13} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
