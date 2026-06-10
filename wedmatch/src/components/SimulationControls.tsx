import React from 'react';
import type { User, BookingRequest, Project } from '../types';

interface SimulationControlsProps {
  simulatedTime: Date;
  activeRole: 'Company' | 'Freelancer' | 'Client';
  setActiveRole: (role: 'Company' | 'Freelancer' | 'Client') => void;
  onAdvanceTime: (days: number) => void;
  onResetDb: () => void;
  activeRequests?: BookingRequest[];
  freelancers: User[];
  activeFreelancer: User;
  onFreelancerChange: (id: string) => void;
  onCancelRequest?: (requestId: string) => void;
  projects?: Project[];
  activeClientProjectId?: string;
  setActiveClientProjectId?: (id: string) => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  simulatedTime,
  activeRole,
  setActiveRole,
  onAdvanceTime,
  onResetDb,
  activeRequests,
  freelancers,
  activeFreelancer,
  onFreelancerChange,
  onCancelRequest,
  projects,
  activeClientProjectId,
  setActiveClientProjectId,
}) => {
    // Format simulated date nicely
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };
  
    // Helper to calculate time remaining on the active request
    const getTimeRemaining = (expiresAtStr: string) => {
      const expiresAt = new Date(expiresAtStr);
      const diffMs = expiresAt.getTime() - simulatedTime.getTime();
      if (diffMs <= 0) return 'Expired';
  
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffDays > 0) {
        return `${diffDays}d ${diffHours}h remaining`;
      }
      return `${diffHours}h remaining`;
    };
  
    // Group active requests by groupId if present
    const displayRequests = React.useMemo(() => {
      if (!activeRequests) return [];
      
      const grouped: Record<string, BookingRequest[]> = {};
      const singles: BookingRequest[] = [];
      
      activeRequests.forEach(req => {
        if (req.groupId) {
          if (!grouped[req.groupId]) {
            grouped[req.groupId] = [];
          }
          grouped[req.groupId].push(req);
        } else {
          singles.push(req);
        }
      });
      
      const result: {
        id: string;
        freelancerName: string;
        freelancerSpecialization: string;
        projectName: string;
        expiresAt: string;
        isGrouped: boolean;
        shootsCount: number;
      }[] = [];
      
      // Process groups
      Object.keys(grouped).forEach(groupId => {
        const reqs = grouped[groupId];
        const first = reqs[0];
        result.push({
          id: first.id,
          freelancerName: first.freelancerName,
          freelancerSpecialization: first.freelancerSpecialization,
          projectName: first.projectName,
          expiresAt: first.expiresAt,
          isGrouped: true,
          shootsCount: reqs.length
        });
      });
      
      // Process singles
      singles.forEach(req => {
        result.push({
          id: req.id,
          freelancerName: req.freelancerName,
          freelancerSpecialization: req.freelancerSpecialization,
          projectName: req.projectName,
          expiresAt: req.expiresAt,
          isGrouped: false,
          shootsCount: 1
        });
      });
      
      return result;
    }, [activeRequests]);

    return (
      <div className="simulation-bar">
        <div className="sim-header">
          <span>Interactive Demo & Simulation Environment</span>
          <span>WedMatch Engine v1.0</span>
        </div>
  
        <div className="sim-controls-grid">
          <div className="sim-date-display">
            <span className="sim-date-label">Simulated Date:</span>
            <span className="sim-date-value">{formatDate(simulatedTime)}</span>
          </div>
  
          <div className="sim-buttons">
            <button 
              className="btn btn-secondary" 
              onClick={() => onAdvanceTime(1)}
              title="Advance simulated clock by 24 hours"
            >
              +1 Day
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ borderColor: 'var(--warning-border)', color: 'var(--warning)' }}
              onClick={() => onAdvanceTime(3)}
              title="Advance simulated clock by 3 days to test request expiration"
            >
              +3 Days (Trigger Expiration)
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ color: 'var(--danger)' }} 
              onClick={onResetDb}
              title="Reset DB state back to default seed data"
            >
              Reset Demo
            </button>
          </div>
  
          <div className="role-switcher-tabs" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className={`role-tab ${activeRole === 'Company' ? 'active' : ''}`}
              onClick={() => setActiveRole('Company')}
            >
              Company View (WedLuxe)
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className={`role-tab ${activeRole === 'Freelancer' ? 'active' : ''}`}
                onClick={() => setActiveRole('Freelancer')}
              >
                Freelancer View
              </button>
              {activeRole === 'Freelancer' && (
                <select
                  className="input-field"
                  style={{ 
                    width: '160px', 
                    padding: '6px 10px', 
                    fontSize: '0.8rem', 
                    background: 'var(--bg-primary)', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontWeight: '600'
                  }}
                  value={activeFreelancer.id}
                  onChange={(e) => onFreelancerChange(e.target.value)}
                >
                  {freelancers.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.specialization})</option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className={`role-tab ${activeRole === 'Client' ? 'active' : ''}`}
                onClick={() => setActiveRole('Client')}
              >
                Client View
              </button>
              {activeRole === 'Client' && projects && activeClientProjectId && setActiveClientProjectId && (
                <select
                  className="input-field"
                  style={{ 
                    width: '180px', 
                    padding: '6px 10px', 
                    fontSize: '0.8rem', 
                    background: 'var(--bg-primary)', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontWeight: '600'
                  }}
                  value={activeClientProjectId}
                  onChange={(e) => setActiveClientProjectId(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
  
        {activeRole === 'Company' && displayRequests.length > 0 && (
          <div className="exclusive-status-box" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
            <div className="ex-label">Exclusive Booking Requests Active ({displayRequests.length})</div>
            {displayRequests.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px', marginTop: '2px' }}>
                <span className="ex-value" style={{ fontSize: '0.85rem' }}>
                  <span className="badge badge-specialization" style={{ marginRight: '6px', fontSize: '0.65rem', padding: '2px 6px' }}>{req.freelancerSpecialization}</span>
                  Sent to <strong style={{ color: 'var(--text-primary)' }}>{req.freelancerName}</strong> for project <em>"{req.projectName}"</em>
                  {req.isGrouped && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}> ({req.shootsCount} shoots combined)</span>}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-pending" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Pending</span>
                  <span className="ex-time" style={{ fontSize: '0.75rem' }}>
                    {getTimeRemaining(req.expiresAt)}
                  </span>
                  {onCancelRequest && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ 
                        padding: '2px 8px', 
                        fontSize: '0.65rem', 
                        background: 'rgba(239, 68, 68, 0.2)', 
                        color: 'rgb(248, 113, 113)', 
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const confirmMsg = req.isGrouped 
                          ? `Are you sure you want to withdraw/cancel the project-wide booking request (${req.shootsCount} shoots) sent to ${req.freelancerName}?`
                          : `Are you sure you want to withdraw/cancel the booking request sent to ${req.freelancerName}?`;
                        if (confirm(confirmMsg)) {
                          onCancelRequest(req.id);
                        }
                      }}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
};
