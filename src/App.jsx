import React, { useState, useEffect } from 'react';
import { ProfitPlusHeader } from './components/ProfitPlusHeader.jsx';
import { ProfitPlusControls } from './components/ProfitPlusControls.jsx';
import { LiveDigitProbability } from './components/LiveDigitProbability.jsx';
import { LiveMarketMetrics } from './components/LiveMarketMetrics.jsx';
import { ProfitPlusAiEngine } from './components/ProfitPlusAiEngine.jsx';
import { FrequencyDistributionAnalysis } from './components/FrequencyDistributionAnalysis.jsx';
import { OverviewCards } from './components/OverviewCards.jsx';
import { LogTerminal } from './components/LogTerminal.jsx';
import { StrategyDocs } from './components/StrategyDocs.jsx';
import { AboutTab } from './components/AboutTab.jsx';
import { RiskModal } from './components/RiskModal.jsx';
import { loadStoredConfig, saveStoredConfig, isDisclaimerAccepted, setDisclaimerAccepted } from './services/storage.js';
import { derivApi } from './services/derivWs.js';
import { botEngine } from './services/botEngine.js';
import { aiAnalyst } from './services/aiAnalyst.js';
import { getSymbolDisplayName } from './constants/symbols.js';
import { Terminal, Shield, BookOpen, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export function App() {
  const [config, setConfig] = useState(loadStoredConfig);
  const [showRiskModal, setShowRiskModal] = useState(!isDisclaimerAccepted());
  const [theme, setTheme] = useState('dark');
  const [viewMode, setViewMode] = useState('phone'); // 'phone' or 'pc'
  const [activeTab, setActiveTab] = useState('logs'); // 'logs', 'metrics', 'guidance', 'about'
  const [showBottomDrawer, setShowBottomDrawer] = useState(false);
  const [selectedDigit, setSelectedDigit] = useState(null);
  const [isAiCalculating, setIsAiCalculating] = useState(false);

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

  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [botState, setBotState] = useState(botEngine.getState());
  const [analysis, setAnalysis] = useState(aiAnalyst.getLastAnalysis());

  // Handle theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Save config on change
  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    saveStoredConfig(newConfig);
    // Refresh AI analysis on config change
    aiAnalyst.analyzeMarket(newConfig);
  };

  // Deriv OAuth 2.0 & Token URL Checks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const loginStatus = urlParams.get('login');
    const errorParam = urlParams.get('error');

    if (code && state) {
      botEngine.log('Completing Deriv OAuth handshake...', 'info');
      window.location.replace(`/api/deriv/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      return;
    }

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
          botEngine.log(`Profit Plus Connected: ${derivApi.loginid} ($${Number(derivApi.balance || 0).toFixed(2)})`, 'won');
        }).catch(err => {
          botEngine.log(`Deriv Direct Login Failed: ${err.message}`, 'alert');
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }

    if (loginStatus === 'success') {
      botEngine.log('Profit Plus: Deriv OAuth login successful!', 'won');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      botEngine.log(`OAuth Notice: ${errorParam}`, 'alert');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check for active server session
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
        botEngine.log(`Profit Plus Session Active: ${sessionRes.activeAccount.loginid}`, 'won');
      } else {
        setWsState(prev => ({ ...prev, isConnecting: false }));
      }
    }).catch(() => {
      setWsState(prev => ({ ...prev, isConnecting: false }));
    });
  }, []);

  const handleDerivOAuthLogin = () => {
    window.location.href = '/api/deriv/oauth/start';
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
  };

  // Subscribe to Bot Engine and AI Analyst updates
  useEffect(() => {
    const unsubBot = botEngine.subscribe((newState) => {
      setBotState(newState);
    });

    const unsubAi = aiAnalyst.subscribe((newAnalysis) => {
      setAnalysis(newAnalysis);
    });

    // Run initial market scan
    const initialAi = aiAnalyst.analyzeMarket(config);
    setAnalysis(initialAi);

    // Auto-refresh AI every 3 seconds
    const interval = setInterval(() => {
      aiAnalyst.analyzeMarket(config);
    }, 3000);

    return () => {
      unsubBot();
      unsubAi();
      clearInterval(interval);
    };
  }, [config]);

  // Deriv WebSocket Event Listeners
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
      }
    };

    const onTick = (tickData) => {
      if (tickData && tickData.lastDigit !== undefined) {
        botEngine.recordTickDigit(tickData.lastDigit, tickData.symbol, tickData.quote);
      }
    };

    derivApi.on('onAuthorize', onAuth);
    derivApi.on('onBalance', onBal);
    derivApi.on('onSymbols', onSyms);
    derivApi.on('onTick', onTick);

    // Public feed for live volatility ticks
    derivApi.connectPublicWs().then(() => {
      const active = config?.activeSymbols?.[0] || '1HZ10V';
      derivApi.subscribeTick(active);
      ['1HZ10V', '1HZ100V', '1HZ50V', '1HZ75V', '1HZ25V'].forEach(sym => {
        derivApi.subscribeTick(sym);
      });
    }).catch(() => {});

    return () => {
      derivApi.off('onAuthorize', onAuth);
      derivApi.off('onBalance', onBal);
      derivApi.off('onSymbols', onSyms);
      derivApi.off('onTick', onTick);
    };
  }, [config?.activeSymbols]);

  // Connect to Deriv API with Token
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
      botEngine.log(`Connected to Deriv (${derivApi.isDemo ? 'Demo' : 'Real'}) - ${derivApi.loginid}`, 'info');
    } catch (e) {
      setWsState(prev => ({ ...prev, isConnecting: false, isAuthorized: false }));
      botEngine.log(`Connection Failed: ${e.message}`, 'alert');
    }
  };

  // Switch between Real & Demo accounts
  const handleSelectAccount = async (targetAccount) => {
    if (!targetAccount || targetAccount.loginid === wsState.loginid) return;
    setWsState(prev => ({ ...prev, isConnecting: true }));
    try {
      if (derivApi.isServerSession) {
        const res = await derivApi.switchServerAccount(targetAccount.loginid);
        setWsState(prev => ({
          ...prev,
          isConnecting: false,
          isAuthorized: true,
          loginid: res.activeAccount.loginid,
          isDemo: Boolean(res.activeAccount.isVirtual),
          currency: res.activeAccount.currency || prev.currency,
          balance: res.activeAccount.balance !== undefined ? res.activeAccount.balance : prev.balance
        }));
        return;
      }
      if (targetAccount.token) {
        await derivApi.authorize(targetAccount.token);
        const updated = { ...config, apiToken: targetAccount.token, currency: targetAccount.currency || 'USD' };
        setConfig(updated);
        saveStoredConfig(updated);
      } else {
        await derivApi.switchAccount(targetAccount.loginid);
      }
      setWsState(prev => ({
        ...prev,
        isConnecting: false,
        isAuthorized: true,
        loginid: targetAccount.loginid,
        isDemo: targetAccount.isVirtual,
        balance: derivApi.balance
      }));
    } catch (err) {
      setWsState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Start & Stop Bot
  const handleStartBot = () => {
    if (!config.simulationMode && !derivApi.authorized) {
      alert('Please connect to Deriv API or toggle Simulator mode in Trading Parameters.');
      return;
    }
    botEngine.start(config);
  };

  const handleStopBot = () => {
    botEngine.stop('User stopped bot via UI button.');
  };

  // AI Strategy Analysis
  const handleAnalyzeStrategy = () => {
    setIsAiCalculating(true);
    setTimeout(() => {
      aiAnalyst.analyzeMarket(config);
      setIsAiCalculating(false);
    }, 600);
  };

  // Derived AI Recommendation values
  const bestOpportunity = analysis?.bestOpportunity;
  const currentActiveSymbol = config?.activeSymbols?.[0] || '1HZ10V';
  const activeSymbolDisplayName = getSymbolDisplayName(currentActiveSymbol);

  const predictedDigit = bestOpportunity?.target !== undefined ? Number(bestOpportunity.target) : 6;
  const confidenceScore = bestOpportunity?.confidence || 81.7;
  const strategyName = bestOpportunity?.strategyName?.includes('Matches') ? 'Matches' : (bestOpportunity?.strategyName || 'Matches');
  const recommendedBanner = bestOpportunity?.contractType === 'DIGITMATCH' ? 'Matches' : 
    (bestOpportunity?.contractType === 'DIGITEVEN' ? 'Even' : (bestOpportunity?.contractType === 'DIGITODD' ? 'Odd' : 'Matches'));

  return (
    <div className="profit-app">
      <div className={`dashboard-container ${viewMode === 'pc' ? 'pc-mode' : 'phone-mode'}`}>
        {/* 1. TOP HEADER (Branding, Badges, Account, Theme, Logout) */}
        <ProfitPlusHeader
          connected={wsState.connected}
          isAuthorized={wsState.isAuthorized}
          isDemo={wsState.isDemo}
          balance={wsState.balance}
          currency={config.currency || wsState.currency}
          simulationMode={config.simulationMode}
          currentLoginId={wsState.loginid}
          accountList={wsState.accountList}
          onSelectAccount={handleSelectAccount}
          onLogout={handleLogout}
          onDerivLogin={handleDerivOAuthLogin}
          theme={theme}
          onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
          viewMode={viewMode}
          onToggleViewMode={(mode) => setViewMode(mode)}
        />

        {/* 2. RESPONSIVE DASHBOARD LAYOUT */}
        {viewMode === 'pc' ? (
          /* ======================== PC / DESKTOP VIEW ======================== */
          <div className="dashboard-grid-pc">
            {/* Left Sidebar: Controls & Trading Parameters */}
            <div className="pc-sidebar-col">
              <ProfitPlusControls
                config={config}
                onChangeConfig={handleConfigChange}
                isRunning={botState.running}
                onStartBot={handleStartBot}
                onStopBot={handleStopBot}
                onAnalyzeStrategy={handleAnalyzeStrategy}
                recommendedSignal={recommendedBanner}
                isConnected={wsState.connected}
                isAuthorized={wsState.isAuthorized}
                isConnecting={wsState.isConnecting}
                availableSymbols={availableSymbols}
                onOAuthLogin={handleDerivOAuthLogin}
                onConnectDeriv={handleConnectDeriv}
              />

              {/* Live Market Metrics (6 Items) */}
              <LiveMarketMetrics
                currentDigit={botState.currentDigit}
                livePrice={botState.livePrice}
                totalTicks={botState.totalTicks}
                evenPercentage={botState.evenPercentage}
                oddPercentage={botState.oddPercentage}
                lastUpdate={botState.lastUpdate}
                volatility={botState.volatility}
              />
            </div>

            {/* Main Area: Probability Distribution, AI Engine, Frequency Chart, and Live Logs */}
            <div className="pc-main-col">
              {/* Live Digit Probability Distribution (10 Boxes) */}
              <LiveDigitProbability
                digitCounts={botState.digitCounts}
                predictedDigit={predictedDigit}
                selectedDigit={selectedDigit}
                onSelectDigit={(d) => setSelectedDigit(d)}
              />

              {/* AI Analysis Engine */}
              <ProfitPlusAiEngine
                strategy={strategyName}
                prediction={predictedDigit}
                confidence={confidenceScore}
                activeSymbolName={activeSymbolDisplayName}
                variance={botState.volatility || 1.2}
                currentPrice={botState.livePrice || 18.91691}
                frequencyPatternPct={6.0}
                isCalculating={isAiCalculating}
                onTriggerAnalysis={handleAnalyzeStrategy}
              />

              {/* Frequency Distribution Analysis (Bar Chart, Pie Chart, Grid View) */}
              <FrequencyDistributionAnalysis
                digitCounts={botState.digitCounts}
                totalTicks={botState.totalTicks}
                predictedDigit={predictedDigit}
              />

              {/* Trading Session Performance Overview */}
              <OverviewCards state={botState} />

              {/* Live Terminal Logs */}
              <div className="profit-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    <Terminal size={16} />
                    <span>Real-Time Execution Logs</span>
                  </div>
                </div>
                <LogTerminal logs={botState.logs} onClearLogs={() => botEngine.clearLogs()} />
              </div>
            </div>
          </div>
        ) : (
          /* ======================== PHONE / MOBILE VIEW (MATCHES SCREENSHOTS 1-4) ======================== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            {/* 1. Volatility, Strategy, Connection Status, Start/Stop & Matches Banner (Screenshots 3 & 4) */}
            <ProfitPlusControls
              config={config}
              onChangeConfig={handleConfigChange}
              isRunning={botState.running}
              onStartBot={handleStartBot}
              onStopBot={handleStopBot}
              onAnalyzeStrategy={handleAnalyzeStrategy}
              recommendedSignal={recommendedBanner}
              isConnected={wsState.connected}
              isAuthorized={wsState.isAuthorized}
              isConnecting={wsState.isConnecting}
              availableSymbols={availableSymbols}
              onOAuthLogin={handleDerivOAuthLogin}
              onConnectDeriv={handleConnectDeriv}
            />

            {/* 2. Live Digit Probability Distribution (Screenshots 3 & 4: 10 digit boxes) */}
            <LiveDigitProbability
              digitCounts={botState.digitCounts}
              predictedDigit={predictedDigit}
              selectedDigit={selectedDigit}
              onSelectDigit={(d) => setSelectedDigit(d)}
            />

            {/* 3. Live Market Metrics Grid (Screenshots 1 & 2: 6 Metrics) */}
            <LiveMarketMetrics
              currentDigit={botState.currentDigit}
              livePrice={botState.livePrice}
              totalTicks={botState.totalTicks}
              evenPercentage={botState.evenPercentage}
              oddPercentage={botState.oddPercentage}
              lastUpdate={botState.lastUpdate}
              volatility={botState.volatility}
            />

            {/* 4. AI Analysis Engine (Screenshots 1 & 2: Calculating Bar or Prediction Insights) */}
            <ProfitPlusAiEngine
              strategy={strategyName}
              prediction={predictedDigit}
              confidence={confidenceScore}
              activeSymbolName={activeSymbolDisplayName}
              variance={botState.volatility || 1.2}
              currentPrice={botState.livePrice || 18.91691}
              frequencyPatternPct={6.0}
              isCalculating={isAiCalculating}
              onTriggerAnalysis={handleAnalyzeStrategy}
            />

            {/* 5. Frequency Distribution Analysis (Screenshots 1 & 2: Bar Chart / Pie Chart / Grid View) */}
            <FrequencyDistributionAnalysis
              digitCounts={botState.digitCounts}
              totalTicks={botState.totalTicks}
              predictedDigit={predictedDigit}
            />

            {/* 6. Mobile Bottom Actions & Expandable Trading Logs Drawer */}
            <div className="profit-card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '16px' }}
                    onClick={() => {
                      setActiveTab('logs');
                      setShowBottomDrawer(true);
                    }}
                  >
                    <Terminal size={12} />
                    <span>Logs</span>
                  </button>

                  <button
                    className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '16px' }}
                    onClick={() => {
                      setActiveTab('stats');
                      setShowBottomDrawer(true);
                    }}
                  >
                    <BarChart3 size={12} />
                    <span>Stats</span>
                  </button>

                  <button
                    className={`btn ${activeTab === 'docs' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '16px' }}
                    onClick={() => {
                      setActiveTab('docs');
                      setShowBottomDrawer(true);
                    }}
                  >
                    <BookOpen size={12} />
                    <span>Docs</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowBottomDrawer(!showBottomDrawer)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-bright-blue)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px'
                  }}
                >
                  <span>{showBottomDrawer ? 'Collapse' : 'Expand'}</span>
                  {showBottomDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showBottomDrawer && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  {activeTab === 'logs' && (
                    <LogTerminal logs={botState.logs} onClearLogs={() => botEngine.clearLogs()} />
                  )}
                  {activeTab === 'stats' && (
                    <OverviewCards state={botState} />
                  )}
                  {activeTab === 'docs' && (
                    <StrategyDocs />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Risk Disclosure Modal */}
      <RiskModal
        isOpen={showRiskModal}
        onClose={() => {
          setDisclaimerAccepted();
          setShowRiskModal(false);
        }}
      />
    </div>
  );
}

export default App;
