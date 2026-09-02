import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.jsx';
import { ControlPanel } from './components/ControlPanel.jsx';
import { OverviewCards } from './components/OverviewCards.jsx';
import { DigitVisualizer } from './components/DigitVisualizer.jsx';
import { LogTerminal } from './components/LogTerminal.jsx';
import { StrategyDocs } from './components/StrategyDocs.jsx';
import { AboutTab } from './components/AboutTab.jsx';
import { RiskModal } from './components/RiskModal.jsx';
import { loadStoredConfig, saveStoredConfig, isDisclaimerAccepted, setDisclaimerAccepted } from './services/storage.js';
import { derivApi, getDerivOAuth2Url, parseDerivOAuthParams, exchangeCodeForToken } from './services/derivWs.js';
import { botEngine } from './services/botEngine.js';

export function App() {
  const [config, setConfig] = useState(loadStoredConfig);
  const [showRiskModal, setShowRiskModal] = useState(!isDisclaimerAccepted());
  const [activeTab, setActiveTab] = useState('logs'); // 'logs', 'guidance', 'about'
  
  // Deriv WS Connection State
  const [wsState, setWsState] = useState({
    connected: false,
    isConnecting: false,
    isAuthorized: false,
    balance: 0,
    currency: 'USD',
    isDemo: true,
    loginid: '',
    accountList: []
  });

  // Dynamic Deriv Symbols
  const [availableSymbols, setAvailableSymbols] = useState([]);

  // Bot Engine State
  const [botState, setBotState] = useState(botEngine.getState());

  // Save config on change
  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    saveStoredConfig(newConfig);
  };

  // Deriv OAuth 2.0 & Backend Session Check (Digit Atlas Architecture)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const loginStatus = urlParams.get('login');
    const errorParam = urlParams.get('error');

    // If Deriv redirected back to root '/' with OAuth code & state
    if (code && state) {
      botEngine.log('Completing Deriv OAuth PKCE handshake with backend...', 'info');
      window.location.replace(`/api/deriv/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      return;
    }

    // If Deriv redirected with direct trading tokens (?acct1=...&token1=...)
    if (urlParams.has('acct1') && urlParams.has('token1')) {
      const parsedAccounts = [];
      let i = 1;
      while (urlParams.has(`acct${i}`) && urlParams.has(`token${i}`)) {
        const loginid = urlParams.get(`acct${i}`);
        const token = urlParams.get(`token${i}`);
        const currency = urlParams.get(`cur${i}`) || 'USD';
        const isVirtual = loginid.startsWith('VRTC') || loginid.startsWith('VRT');
        parsedAccounts.push({ loginid, token, currency, isVirtual });
        i++;
      }
      parsedAccounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
      const active = parsedAccounts[0];

      if (active) {
        localStorage.setItem('deriv_accounts', JSON.stringify(parsedAccounts));
        const updatedConfig = { ...config, apiToken: active.token, currency: active.currency };
        setConfig(updatedConfig);
        saveStoredConfig(updatedConfig);

        botEngine.log(`Deriv Official Auth: Connecting to ${active.isVirtual ? 'Demo' : 'Real'} Account (${active.loginid})...`, 'info');
        derivApi.connect(active.token, '1089').then(() => {
          setWsState({
            connected: true,
            isConnecting: false,
            isAuthorized: true,
            balance: derivApi.balance,
            currency: derivApi.currency || active.currency,
            isDemo: derivApi.isDemo,
            loginid: derivApi.loginid || active.loginid,
            accountList: derivApi.accountList.length > 0 ? derivApi.accountList : parsedAccounts
          });
          botEngine.log(`Deriv Login Successful! Account: ${derivApi.loginid} (Balance: $${Number(derivApi.balance || 0).toFixed(2)})`, 'won');
        }).catch(err => {
          botEngine.log(`Deriv Direct Login Failed: ${err.message}`, 'alert');
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }

    if (loginStatus === 'success') {
      botEngine.log('Deriv OAuth 2.0 login successful! Secure HTTP-only session active.', 'won');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      botEngine.log(`Deriv OAuth Error: ${errorParam}`, 'alert');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check for active server session (Digit Atlas secure HTTP-only cookie)
    setWsState(prev => ({ ...prev, isConnecting: true }));
    derivApi.checkServerSession().then((sessionRes) => {
      if (sessionRes && sessionRes.authenticated) {
        setWsState({
          connected: true,
          isConnecting: false,
          isAuthorized: true,
          balance: sessionRes.activeAccount.balance || 0,
          currency: sessionRes.activeAccount.currency || 'USD',
          isDemo: Boolean(sessionRes.activeAccount.isVirtual),
          loginid: sessionRes.activeAccount.loginid,
          accountList: sessionRes.accounts || []
        });
        botEngine.log(`Deriv Secure Session active (${sessionRes.activeAccount.isVirtual ? 'Demo Account' : 'Real Account'}) - Login ID: ${sessionRes.activeAccount.loginid}`, 'won');
      } else {
        setWsState(prev => ({ ...prev, isConnecting: false }));
      }
    }).catch((err) => {
      console.warn('Session check warning:', err);
      setWsState(prev => ({ ...prev, isConnecting: false }));
    });
  }, []);

  const handleDerivOAuthLogin = () => {
    window.location.href = '/api/deriv/oauth/start';
  };

  const handleDerivOAuthSignUp = () => {
    window.location.href = '/api/deriv/oauth/start?signup=true';
  };

  const handleLogout = async () => {
    botEngine.log('Logging out from Deriv session...', 'info');
    localStorage.removeItem('deriv_accounts');
    derivApi.disconnect();
    await derivApi.logoutServer();
    setWsState({
      connected: false,
      isConnecting: false,
      isAuthorized: false,
      balance: 0,
      currency: 'USD',
      isDemo: true,
      loginid: '',
      accountList: []
    });
    botEngine.log('Deriv session terminated. Click "Log in with Deriv" to connect.', 'info');
  };

  // Subscribe to Bot Engine Updates
  useEffect(() => {
    const unsubscribe = botEngine.subscribe((newState) => {
      setBotState(newState);
    });
    return unsubscribe;
  }, []);

  // Connect to Deriv WebSocket API
  const handleConnectDeriv = async () => {
    if (!config.apiToken) return;
    setWsState(prev => ({ ...prev, isConnecting: true }));

    try {
      const numericAppId = /^\d+$/.test(String(config.appId || '').trim()) ? String(config.appId).trim() : '1089';
      await derivApi.connect(config.apiToken, numericAppId);
      setWsState({
        connected: true,
        isConnecting: false,
        isAuthorized: derivApi.authorized,
        balance: derivApi.balance,
        currency: derivApi.currency,
        isDemo: derivApi.isDemo,
        loginid: derivApi.loginid,
        accountList: derivApi.accountList
      });
      botEngine.log(`Connected to Deriv API (${derivApi.isDemo ? 'Demo Account' : 'Real Account'}) - Login ID: ${derivApi.loginid} (Balance: $${Number(derivApi.balance || 0).toFixed(2)})`, 'info');
    } catch (e) {
      setWsState(prev => ({ ...prev, isConnecting: false, isAuthorized: false }));
      botEngine.log(`Deriv Connection Failed: ${e.message}`, 'alert');
    }
  };

  // Deriv WS Balance, Symbols & Auth Listeners
  useEffect(() => {
    const onAuth = (authData) => {
      setWsState(prev => ({
        ...prev,
        isAuthorized: true,
        balance: authData.balance,
        currency: authData.currency,
        isDemo: authData.isVirtual,
        loginid: authData.loginid,
        accountList: authData.accountList || prev.accountList
      }));
    };

    const onBal = (balData) => {
      setWsState(prev => ({
        ...prev,
        balance: balData.balance,
        currency: balData.currency
      }));
    };

    const onSyms = (symbols) => {
      if (symbols && symbols.length > 0) {
        setAvailableSymbols(symbols);
        botEngine.log(`Loaded ${symbols.length} live markets from Deriv API`, 'info');
      }
    };

    const onTick = (tickData) => {
      if (tickData && tickData.lastDigit !== undefined) {
        botEngine.recordTickDigit(tickData.lastDigit);
      }
    };

    derivApi.on('onAuthorize', onAuth);
    derivApi.on('onBalance', onBal);
    derivApi.on('onSymbols', onSyms);
    derivApi.on('onTick', onTick);

    return () => {
      derivApi.off('onAuthorize', onAuth);
      derivApi.off('onBalance', onBal);
      derivApi.off('onSymbols', onSyms);
      derivApi.off('onTick', onTick);
    };
  }, []);

  // Switch between Real & Demo accounts
  const handleSelectAccount = async (targetAccount) => {
    if (!targetAccount || targetAccount.loginid === wsState.loginid) return;

    botEngine.log(`Switching account to ${targetAccount.isVirtual ? 'Demo' : 'Real'} (${targetAccount.loginid})...`, 'info');
    setWsState(prev => ({ ...prev, isConnecting: true }));

    try {
      if (derivApi.isServerSession) {
        const res = await derivApi.switchServerAccount(targetAccount.loginid);
        const newBalance = res.activeAccount.balance !== undefined ? res.activeAccount.balance : prev.balance;
        setWsState(prev => ({
          ...prev,
          isConnecting: false,
          isAuthorized: true,
          loginid: res.activeAccount.loginid,
          isDemo: Boolean(res.activeAccount.isVirtual),
          currency: res.activeAccount.currency || prev.currency,
          balance: newBalance
        }));
        botEngine.log(`Switched successfully to ${res.activeAccount.isVirtual ? 'Demo' : 'Real'} Account: ${res.activeAccount.loginid} (Balance: $${Number(newBalance || 0).toFixed(2)})`, 'won');
        return;
      }

      if (targetAccount.token) {
        // If account has dedicated token, authorize directly
        await derivApi.authorize(targetAccount.token);
        const updated = {
          ...config,
          apiToken: targetAccount.token,
          currency: targetAccount.currency || 'USD'
        };
        setConfig(updated);
        saveStoredConfig(updated);
      } else {
        // Switch account locally on websocket instance
        await derivApi.switchAccount(targetAccount.loginid);
      }

      setWsState(prev => ({
        ...prev,
        isConnecting: false,
        isAuthorized: true,
        loginid: targetAccount.loginid,
        isDemo: targetAccount.isVirtual,
        currency: targetAccount.currency || prev.currency,
        balance: derivApi.balance
      }));

      botEngine.log(`Switched successfully to ${targetAccount.isVirtual ? 'Demo' : 'Real'} Account: ${targetAccount.loginid}`, 'won');
    } catch (err) {
      console.error('Account switch failed:', err);
      botEngine.log(`Failed to switch account: ${err.message}`, 'alert');
      setWsState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Start Bot Handler
  const handleStartBot = () => {
    if (!config.simulationMode && !derivApi.authorized) {
      alert('Please enter your Deriv API Token and click "Connect to Deriv API", or toggle "Simulator" mode.');
      return;
    }
    botEngine.start(config);
  };

  // Stop Bot Handler
  const handleStopBot = () => {
    botEngine.stop('User stopped bot via UI button.');
  };

  // Clear Data Handler
  const handleClearData = () => {
    botEngine.clearLogs();
    botEngine.resetSession();
  };

  const handleCloseRiskModal = () => {
    setDisclaimerAccepted();
    setShowRiskModal(false);
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        connected={wsState.connected}
        isAuthorized={wsState.isAuthorized}
        isDemo={wsState.isDemo}
        balance={wsState.balance}
        currency={config.currency || wsState.currency}
        simulationMode={config.simulationMode}
        soundEffects={config.soundEffects}
        accountList={wsState.accountList}
        currentLoginId={wsState.loginid}
        onSelectAccount={handleSelectAccount}
        onToggleSound={() => handleConfigChange({ ...config, soundEffects: !config.soundEffects })}
        onOpenRiskModal={() => setShowRiskModal(true)}
        onDerivLogin={handleDerivOAuthLogin}
        onLogout={handleLogout}
      />

      {/* Main Dashboard Workspace */}
      <main className="main-content">
        {/* LEFT PANEL — CONTROLS */}
        <ControlPanel
          config={config}
          onChangeConfig={handleConfigChange}
          onOAuthLogin={handleDerivOAuthLogin}
          onOAuthSignUp={handleDerivOAuthSignUp}
          onConnectDeriv={handleConnectDeriv}
          availableSymbols={availableSymbols}
          isConnecting={wsState.isConnecting}
          isConnected={wsState.connected}
          isAuthorized={wsState.isAuthorized}
          isRunning={botState.running}
          onStartBot={handleStartBot}
          onStopBot={handleStopBot}
          onClearData={handleClearData}
          onLogout={handleLogout}
          accountList={wsState.accountList}
          currentLoginId={wsState.loginid}
          onSelectAccount={handleSelectAccount}
          balance={wsState.balance}
          currency={wsState.currency}
          isDemo={wsState.isDemo}
        />

        {/* RIGHT PANEL — LIVE TRADING VIEW */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top Overview Cards */}
          <OverviewCards state={botState} />

          {/* Real-time Digit Frequency Analysis Chart */}
          <DigitVisualizer digitCounts={botState.digitCounts} />

          {/* Navigation Tab Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px'
          }}>
            <button
              className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setActiveTab('logs')}
            >
              <span>Logs Terminal</span>
              {botState.running && <span className="status-dot pulse" style={{ backgroundColor: 'var(--color-success)' }} />}
            </button>

            <button
              className={`btn ${activeTab === 'guidance' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setActiveTab('guidance')}
            >
              <span>Guidance & Risk</span>
            </button>

            <button
              className={`btn ${activeTab === 'about' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setActiveTab('about')}
            >
              <span>About / Docs</span>
            </button>
          </div>

          {/* Active Tab View */}
          {activeTab === 'logs' && (
            <LogTerminal logs={botState.logs} onClearLogs={() => botEngine.clearLogs()} />
          )}
          {activeTab === 'guidance' && <StrategyDocs />}
          {activeTab === 'about' && <AboutTab />}
        </section>
      </main>

      {/* Mandatory Risk Disclosure Modal */}
      <RiskModal isOpen={showRiskModal} onClose={handleCloseRiskModal} />
    </div>
  );
}

export default App;
