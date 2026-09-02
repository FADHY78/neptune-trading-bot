import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Pause, Play, Download, Trash2 } from 'lucide-react';

export const LogTerminal = ({ logs, onClearLogs }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleDownloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neptune-trading-logs-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getLogColor = (type, text) => {
    if (type === 'purchasing' || text.includes('PURCHASING ON')) return 'var(--accent-cyan)';
    if (type === 'won' || text.includes('CONTRACT WON')) return 'var(--color-success)';
    if (type === 'lost' || text.includes('CONTRACT LOST')) return 'var(--color-danger)';
    if (type === 'cooldown' || text.includes('Cooldown')) return 'var(--text-muted)';
    if (type === 'alert' || text.includes('Martingale')) return 'var(--color-warning)';
    return 'var(--text-primary)';
  };

  return (
    <div style={{
      backgroundColor: '#070A14',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      height: '480px',
      overflow: 'hidden'
    }}>
      {/* Terminal Header */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          <Terminal size={15} color="var(--accent-cyan)" />
          <span>Real-time Trading Terminal Logs</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '999px' }}>
            {logs.length} lines
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Pause Auto-scroll" : "Resume Auto-scroll"}
          >
            {autoScroll ? <Pause size={12} /> : <Play size={12} />}
            <span>{autoScroll ? 'Pause Scroll' : 'Resume Scroll'}</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            title="Export session logs to text file"
          >
            <Download size={12} />
            <span>Export</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            onClick={onClearLogs}
            title="Clear Log Terminal"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div style={{
        flex: 1,
        padding: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '1.6',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>
            System ready. Configure your parameters and click [Start Bot] to begin live execution.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '10px', wordBreak: 'break-all' }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{log.timestamp}]</span>
              <span style={{ color: getLogColor(log.type, log.text) }}>{log.text}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
