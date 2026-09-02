import React from 'react';
import { Info, ExternalLink, Code2, Server } from 'lucide-react';

export const AboutTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
          <Info size={18} />
          <span>About Neptune Trading Bot v1.0.0</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '14px' }}>
          Neptune Trading Bot is a high-performance automated digit trading application designed to run seamlessly in modern Web browsers. 
          It communicates directly with Deriv WebSocket API servers without requiring third-party intermediate backends.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--accent-cyan)', marginBottom: '6px' }}>
              <Server size={14} />
              <span>Deriv OAuth 2.0 & WebSocket</span>
            </div>
            <code className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              OAuth: auth.deriv.com/oauth2/auth (PKCE) | WS: wss://ws.derivws.com/websockets/v3
            </code>
          </div>

          <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--accent-cyan)', marginBottom: '6px' }}>
              <Code2 size={14} />
              <span>Tech Stack</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              React 18 + Vite + Lucide Icons + Web Audio API
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
          Useful Documentation Links
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <a
            href="https://developers.deriv.com/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12px', textDecoration: 'none' }}
          >
            <span>Deriv API Documentation</span>
            <ExternalLink size={14} />
          </a>

          <a
            href="https://app.deriv.com/account/api-token"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12px', textDecoration: 'none' }}
          >
            <span>Generate Deriv API Token</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
