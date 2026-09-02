import React from 'react';
import { Activity, ShieldAlert, Volume2, VolumeX, Settings, Radio, LogIn, CheckCircle } from 'lucide-react';

export const Navbar = ({ 
  connected, 
  isAuthorized, 
  isDemo, 
  balance, 
  currency, 
  simulationMode, 
  soundEffects,
  onToggleSound,
  onOpenRiskModal,
  onOpenSettings,
  onDerivLogin
}) => {
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

      {/* Center: Connection Status Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {simulationMode ? (
          <div className="status-pill connected" style={{ background: 'rgba(0, 212, 255, 0.1)', borderColor: 'rgba(0, 212, 255, 0.3)', color: 'var(--accent-cyan)' }}>
            <Radio size={14} className="pulse" />
            <span>Simulator Mode (Testing)</span>
          </div>
        ) : isAuthorized ? (
          <div className="status-pill connected">
            <span className="status-dot pulse" />
            <span>Connected to Deriv — {isDemo ? 'Demo Account' : 'Real Account'}</span>
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
            color: 'var(--color-success)',
            backgroundColor: 'rgba(0, 230, 118, 0.1)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(0, 230, 118, 0.3)'
          }}>
            <CheckCircle size={14} />
            <span>{isDemo ? 'Demo' : 'Real'} Access Active</span>
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
          alignItems: 'flex-end'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Account Balance
          </span>
          <span className="font-mono" style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-success)' }}>
            ${balance ? Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '1,234.56'} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{currency || 'USD'}</span>
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

