import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  initDatabase, 
  getSimulatedTime, 
  saveSimulatedTime, 
  resetDatabase, 
  getCompanyActiveRequests, 
  checkExpiration, 
  getUsers,
  getNotificationLogs,
  cancelBookingRequest
} from './db';
import { SimulationControls } from './components/SimulationControls';
import { CompanyDashboard } from './components/CompanyDashboard';
import { FreelancerDashboard } from './components/FreelancerDashboard';

interface Toast {
  id: string;
  message: string;
}

function App() {
  // Initialize DB once on start
  useEffect(() => {
    initDatabase();
  }, []);

  const [activeRole, setActiveRole] = useState<'Company' | 'Freelancer'>('Company');
  const [simulatedTime, setSimulatedTime] = useState<Date>(() => getSimulatedTime());
  const [dbTrigger, setDbTrigger] = useState(0);
  const [activeFreelancerId, setActiveFreelancerId] = useState<string>('f1');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  // Trigger state refresh
  const handleStateChange = useCallback(() => {
    setDbTrigger((prev) => prev + 1);
  }, []);

  // Sync users
  const users = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger; // dependency to force recalculation
    return getUsers();
  }, [dbTrigger]);

  // Sync notification logs
  const logs = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger;
    return getNotificationLogs();
  }, [dbTrigger]);

  const currentCompany = useMemo(() => {
    return users.find((u) => u.role === 'Company') || { id: 'c1', name: 'WedLuxe Productions', email: 'info@wedluxe.com', role: 'Company' as const };
  }, [users]);

  const currentFreelancer = useMemo(() => {
    return users.find((u) => u.id === activeFreelancerId) || { id: 'f1', name: 'Amit Sharma', role: 'Freelancer' as const, email: 'amit@gmail.com' };
  }, [users, activeFreelancerId]);

  // Find active booking requests for company (if any)
  const activeRequests = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger;
    return getCompanyActiveRequests(currentCompany.id);
  }, [currentCompany.id, dbTrigger]);

  // Time Travel Handler
  const handleAdvanceTime = (days: number) => {
    const nextTime = new Date(simulatedTime);
    nextTime.setDate(nextTime.getDate() + days);
    
    // Save to DB and update react state
    saveSimulatedTime(nextTime);
    setSimulatedTime(nextTime);
    
    // Check if anything expired immediately on travel
    checkExpiration(nextTime);
    handleStateChange();
  };

  // Reset Database Handler
  const handleResetDb = () => {
    if (window.confirm('Are you sure you want to reset the database to default seed data? All active requests, ratings, reviews, and logs will be reset.')) {
      resetDatabase();
      setSimulatedTime(getSimulatedTime());
      handleStateChange();
      setToasts([]);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    cancelBookingRequest(requestId);
    handleStateChange();
  };


  // Event listener for dispatching toasts in real-time
  useEffect(() => {
    const handleNotification = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.message) {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message: detail.message }]);
        
        // Auto dismiss after 6 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 6000);
        
        // Auto-expand logs terminal briefly so they notice it
        setIsConsoleOpen(true);
      }
    };

    window.addEventListener('wedmatch-notification', handleNotification);
    return () => window.removeEventListener('wedmatch-notification', handleNotification);
  }, []);

  // Periodic expiration scheduler (polling every 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = getSimulatedTime();
      const expired = checkExpiration(currentTime);
      if (expired) {
        handleStateChange();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [handleStateChange]);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-alert">
            <div className="toast-msg">{toast.message}</div>
            <button className="toast-close" onClick={() => handleDismissToast(toast.id)}>&times;</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-badge">W</div>
          <div>
            <h1 className="logo-text">WedMatch</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
              B2B Wedding Creator Network
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>Logged in as:</div>
            <strong style={{ color: 'var(--primary)' }}>
              {activeRole === 'Company' ? currentCompany.name : currentFreelancer.name}
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              ({activeRole === 'Company' ? 'Studio' : 'Freelancer'})
            </span>
          </div>
        </div>
      </header>

      {/* Interactive Time Travel and Role Switcher Banner */}
      <SimulationControls
        simulatedTime={simulatedTime}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        onAdvanceTime={handleAdvanceTime}
        onResetDb={handleResetDb}
        activeRequests={activeRequests}
        freelancers={users.filter(u => u.role === 'Freelancer')}
        activeFreelancer={currentFreelancer}
        onFreelancerChange={setActiveFreelancerId}
        onCancelRequest={handleCancelRequest}
      />

      {/* Main Content Area */}
      <main style={{ minHeight: '60vh' }}>
        {activeRole === 'Company' ? (
          <CompanyDashboard
            currentCompany={currentCompany}
            simulatedTime={simulatedTime}
            onStateChange={handleStateChange}
            dbTrigger={dbTrigger}
          />
        ) : (
          <FreelancerDashboard
            currentFreelancer={currentFreelancer}
            simulatedTime={simulatedTime}
            onStateChange={handleStateChange}
            dbTrigger={dbTrigger}
          />
        )}
      </main>

      {/* Collapsible Bottom Developer Console (Simulated WhatsApp/Email API Logs) */}
      <div className={`developer-console ${isConsoleOpen ? 'expanded' : 'collapsed'}`}>
        <div className="console-header" onClick={() => setIsConsoleOpen(!isConsoleOpen)}>
          <div className="console-title">
            <span>📟 WhatsApp & Email Outgoing API Logs</span>
            {logs.length > 0 && <span className="console-badge-count">{logs.length}</span>}
          </div>
          <button className="console-toggle-btn">
            {isConsoleOpen ? 'Minimize ▾' : 'Expand Terminal ▴'}
          </button>
        </div>
        <div className="console-logs">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Console Idle. Send a request or trigger time travel to see outgoing API logs.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={log.type === 'WhatsApp' ? 'log-wa' : 'log-email'}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '16px', marginTop: '32px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <p>&copy; 2026 WedMatch Platform. Designed for Indian Wedding Production Hubs.</p>
        <p style={{ marginTop: '4px', opacity: 0.8 }}>
          Developed using React + TypeScript + Vanilla CSS. Built in planning mode.
        </p>
      </footer>
    </div>
  );
}

export default App;
