import React from 'react';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export const RiskModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 9, 20, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        maxWidth: '520px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 179, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-warning)'
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Risk Warning & Disclosure
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Please read carefully before trading
            </span>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>
          <p style={{ marginBottom: '10px' }}>
            ⚠️ <strong>Financial Risk Notice:</strong> Trading digit contracts on Deriv.com carries a high level of risk and may result in the loss of your entire stake.
          </p>
          <p style={{ marginBottom: '10px' }}>
            🤖 <strong>Automated Bot Disclosure:</strong> Neptune Trading Bot operates strictly based on user-defined algorithms and risk parameters. Past performance or simulation results do not guarantee future profits.
          </p>
          <p>
            🛡️ <strong>Risk Management:</strong> Always set strict Stop Loss limits and use Martingale multipliers responsibly. Only trade with capital you can afford to lose.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-primary"
            onClick={onClose}
            style={{ width: '100%', gap: '8px' }}
          >
            <CheckCircle size={18} />
            <span>I Understand & Agree — Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
