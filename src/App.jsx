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

  // Deriv OAuth 2.0 Redirect & PKCE Token Handler
  useEffect(() => {
    const oauthParams = parseDerivOAuthParams();

    // Check for callback error
    if (oauthParams.error) {
      botEngine.log(`OAuth Error: ${oauthParams.errorDescription || oauthParams.error}`, 'alert');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Modern Deriv OAuth 2.0 PKCE Code Exchange
    if (oauthParams.isCodeFlow && oauthParams.code) {
      if (!oauthParams.validState) {
        botEngine.log('OAuth Security Warning: State mismatch (potential CSRF). Exchange aborted.', 'alert');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const activeClientId = config.appId || '34hP1yTdG6Hc7grRIWQWH';
      const redirectUri = `${window.location.origin}${window.location.pathname}`;

      // Clean up URL immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      setWsState(prev => ({ ...prev, isConnecting: true }));
      botEngine.log('Exchanging authorization code for Deriv access token (PKCE)...', 'info');

      exchangeCodeForToken({
        code: oauthParams.code,
        clientId: activeClientId,
        redirectUri
      })
        .then(async (tokenData) => {
          const accessToken = tokenData.access_token;
          if (!accessToken) {
            throw new Error('No access_token returned by Deriv token endpoint');
          }

          const updatedConfig = {
            ...config,
            apiToken: accessToken,
            simulationMode: false
          };
          setConfig(updatedConfig);
          saveStoredConfig(updatedConfig);

          botEngine.log('Deriv OAuth 2.0 PKCE login successful!', 'won');

          // Connect to Deriv WebSocket with access token
          await derivApi.connect(accessToken, activeClientId);
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
          botEngine.log(`Connected & Authorized (${derivApi.isDemo ? 'Demo Account' : 'Real Account'}) - Login ID: ${derivApi.loginid}`, 'won');
        })
        .catch((err) => {
          console.error('PKCE exchange error:', err);
          botEngine.log(`Deriv OAuth PKCE failed: ${err.message}`, 'alert');
          setWsState(prev => ({ ...prev, isConnecting: false }));
        });
      return;
    }

    // Direct token callback fallback (?acct1=...&token1=...)
    if (oauthParams.accounts && oauthParams.accounts.length > 0) {
      const primary = oauthParams.accounts[0];
      if (primary.token) {
        const token = primary.token;
        const currency = primary.currency || 'USD';

        window.history.replaceState({}, document.title, window.location.pathname);

        const updatedConfig = {
          ...config,
          apiToken: token,
          currency: currency,
          simulationMode: false
        };
        setConfig(updatedConfig);
        saveStoredConfig(updatedConfig);

        setWsState(prev => ({ ...prev, isConnecting: true }));
        derivApi.connect(token, config.appId || '34hP1yTdG6Hc7grRIWQWH').then(() => {
          botEngine.log(`Deriv Login successful! Account: ${primary.account}`, 'won');
        }).catch((e) => {
          botEngine.log(`Deriv Authorization Error: ${e.message}`, 'alert');
          setWsState(prev => ({ ...prev, isConnecting: false }));
        });
      }
    }
  }, []);

  const handleDerivOAuthLogin = async () => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const url = await getDerivOAuth2Url({
        clientId: config.appId || '34hP1yTdG6Hc7grRIWQWH',
        redirectUri,
        scope: 'trade account_manage'
      });
      window.location.href = url;
    } catch (e) {
      botEngine.log(`Failed to initiate Deriv OAuth: ${e.message}`, 'alert');
    }
  };

  const handleDerivOAuthSignUp = async () => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const url = await getDerivOAuth2Url({
        clientId: config.appId || '34hP1yTdG6Hc7grRIWQWH',
        redirectUri,
        scope: 'trade account_manage',
        isSignUp: true
      });
      window.location.href = url;
    } catch (e) {
      botEngine.log(`Failed to initiate Deriv Sign Up: ${e.message}`, 'alert');
    }
  };

  // Auto-connect on startup if token is present
  useEffect(() => {
    const oauthParams = parseDerivOAuthParams();
    const hasOAuthParams = oauthParams.isCodeFlow || (oauthParams.accounts && oauthParams.accounts.length > 0);
    if (!hasOAuthParams && config.apiToken && !config.simulationMode) {
      handleConnectDeriv();
    }
  }, []);

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
      await derivApi.connect(config.apiToken, config.appId || '34hP1yTdG6Hc7grRIWQWH');
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
      botEngine.log(`Connected to Deriv API (${derivApi.isDemo ? 'Demo Account' : 'Real Account'}) - Login ID: ${derivApi.loginid}`, 'info');
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

    derivApi.on('onAuthorize', onAuth);
    derivApi.on('onBalance', onBal);
    derivApi.on('onSymbols', onSyms);

    return () => {
      derivApi.off('onAuthorize', onAuth);
      derivApi.off('onBalance', onBal);
      derivApi.off('onSymbols', onSyms);
    };
  }, []);

  // Switch between Real & Demo accounts
  const handleSelectAccount = async (targetAccount) => {
    if (!targetAccount || targetAccount.loginid === wsState.loginid) return;

    botEngine.log(`Switching account to ${targetAccount.isVirtual ? 'Demo' : 'Real'} (${targetAccount.loginid})...`, 'info');
    setWsState(prev => ({ ...prev, isConnecting: true }));

    try {
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
