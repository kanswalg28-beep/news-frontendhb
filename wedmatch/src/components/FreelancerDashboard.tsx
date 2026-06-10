import React, { useState, useMemo, useEffect } from 'react';
import type { User, CompanyReview, Specialization } from '../types';
import { 
  getBookingRequests, 
  getCalendarBlocks, 
  acceptBookingRequest, 
  declineBookingRequest, 
  toggleManualBlock,
  getUsers,
  getCompanyReviews,
  addCompanyReview,
  updateFreelancerProfile,
  getFreelancerAllocations,
  getShootSchedules
} from '../db';

interface FreelancerDashboardProps {
  currentFreelancer: User;
  simulatedTime: Date;
  onStateChange: () => void;
  dbTrigger: number;
}

export const FreelancerDashboard: React.FC<FreelancerDashboardProps> = ({
  currentFreelancer,
  simulatedTime,
  onStateChange,
  dbTrigger,
}) => {
  // Quick Block Date Form State
  const [quickBlockDate, setQuickBlockDate] = useState('');
  const [quickBlockLabel, setQuickBlockLabel] = useState('WhatsApp Booking');

  // Company Reviews Modal State
  const [reviewsCompany, setReviewsCompany] = useState<User | null>(null);

  // Call Sheet Modal State (date string)
  const [selectedCallSheetDate, setSelectedCallSheetDate] = useState<string | null>(null);

  // Leave Review Form State (tied to booking request ID)
  const [activeReviewBookingId, setActiveReviewBookingId] = useState<string | null>(null);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');

  // Profile Editing State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(currentFreelancer.name);
  const [editLocation, setEditLocation] = useState(currentFreelancer.location || '');
  const [editSpecialization, setEditSpecialization] = useState<Specialization>(currentFreelancer.specialization || 'Photographer');
  const [editRate, setEditRate] = useState(currentFreelancer.ratePerDay || 0);
  const [editBio, setEditBio] = useState(currentFreelancer.bio || '');
  const [editPortfolio, setEditPortfolio] = useState(currentFreelancer.portfolioLinks?.join(', ') || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync edit profile form state with currentFreelancer prop updates
  useEffect(() => {
    setEditName(currentFreelancer.name);
    setEditLocation(currentFreelancer.location || '');
    setEditSpecialization(currentFreelancer.specialization || 'Photographer');
    setEditRate(currentFreelancer.ratePerDay || 0);
    setEditBio(currentFreelancer.bio || '');
    setEditPortfolio(currentFreelancer.portfolioLinks?.join(', ') || '');
  }, [currentFreelancer]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const portfolioLinks = editPortfolio
      .split(',')
      .map(link => link.trim())
      .filter(link => link.length > 0);

    updateFreelancerProfile(currentFreelancer.id, {
      name: editName,
      location: editLocation,
      specialization: editSpecialization,
      ratePerDay: editRate,
      bio: editBio,
      portfolioLinks
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onStateChange();
  };

  // Fetch incoming pending requests for this freelancer
  const incomingRequests = useMemo(() => {
    return getBookingRequests().filter(
      (r) => r.freelancerId === currentFreelancer.id && r.status === 'Pending'
    );
  }, [currentFreelancer.id, simulatedTime, dbTrigger]);

  const groupedRequests = useMemo(() => {
    const groups: { key: string; requests: typeof incomingRequests }[] = [];
    incomingRequests.forEach(req => {
      const key = req.groupId || req.id;
      const existing = groups.find(g => g.key === key);
      if (existing) {
        existing.requests.push(req);
      } else {
        groups.push({ key, requests: [req] });
      }
    });
    return groups;
  }, [incomingRequests]);

  // Fetch confirmed booking history for this freelancer
  const bookingHistory = useMemo(() => {
    return getBookingRequests().filter(
      (r) => r.freelancerId === currentFreelancer.id && r.status === 'Confirmed'
    );
  }, [currentFreelancer.id, simulatedTime, dbTrigger]);

  // Fetch all calendar blocks for this freelancer
  const freelancerBlocks = useMemo(() => {
    return getCalendarBlocks().filter((b) => b.freelancerId === currentFreelancer.id);
  }, [currentFreelancer.id, simulatedTime, dbTrigger]);

  // Fetch freelancer allocations (assigned shoots)
  const allocations = useMemo(() => {
    return getFreelancerAllocations(currentFreelancer.id);
  }, [currentFreelancer.id, dbTrigger]);

  // Fetch all users to display company trust details
  const allUsers = useMemo(() => {
    return getUsers();
  }, [simulatedTime, dbTrigger]);

  // Reviewed Bookings tracking (mock storage to prevent duplicate reviews)
  const reviewedBookingIds = useMemo(() => {
    const stored = localStorage.getItem('wedmatch_reviewed_bookings');
    return stored ? JSON.parse(stored) as string[] : [];
  }, [simulatedTime]);

  const handleAccept = (reqId: string) => {
    acceptBookingRequest(reqId);
    onStateChange();
  };

  const handleDecline = (reqId: string) => {
    declineBookingRequest(reqId);
    onStateChange();
  };

  const handleDayClick = (dateStr: string, hasBooking: boolean, hasAssignedShoot: boolean) => {
    if (hasAssignedShoot) {
      setSelectedCallSheetDate(dateStr);
      return;
    }
    if (hasBooking) return;
    toggleManualBlock(currentFreelancer.id, dateStr, 'Busy');
    onStateChange();
  };

  const handleQuickBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBlockDate) {
      alert('Please select a date first.');
      return;
    }
    
    // Check if date is already booked or offline blocked
    const exists = freelancerBlocks.some(b => b.date === quickBlockDate);
    if (exists) {
      alert('This date is already blocked or booked.');
      return;
    }

    toggleManualBlock(currentFreelancer.id, quickBlockDate, quickBlockLabel);
    setQuickBlockDate('');
    onStateChange();
  };

  // Submit company rating/review
  const handleSubmitReview = (e: React.FormEvent, companyId: string, bookingId: string) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;

    addCompanyReview(companyId, currentFreelancer.name, newReviewRating, newReviewText);

    // Save reviewed booking state to localStorage
    const updated = [...reviewedBookingIds, bookingId];
    localStorage.setItem('wedmatch_reviewed_bookings', JSON.stringify(updated));

    // Reset review state
    setActiveReviewBookingId(null);
    setNewReviewRating(5);
    setNewReviewText('');
    
    onStateChange();
  };

  // Helper to fetch company reviews for the active modal
  const companyReviews = useMemo((): CompanyReview[] => {
    if (!reviewsCompany) return [];
    return getCompanyReviews(reviewsCompany.id);
  }, [reviewsCompany, simulatedTime]);

  // Format date remaining label
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

  // Render Calendar Grid for June 2026
  const renderCalendarGrid = () => {
    const year = 2026;
    const month = 5; // June (0-indexed)
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    
    const calendarDays = [];
    
    // Empty padding slots
    for (let i = 0; i < firstDayIndex; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const block = freelancerBlocks.find((b) => b.date === dateStr);
      const dayShoots = allocations.filter((s) => s.date === dateStr);
      const hasAssignedShoot = dayShoots.length > 0;
      
      let dayClass = 'calendar-day';
      let statusText = '';
      let isBooking = false;

      if (block) {
        if (block.type === 'Offline') {
          dayClass += ' busy';
          statusText = block.label || 'Busy (Offline)';
        } else if (block.type === 'Booking') {
          dayClass += ' booked';
          statusText = block.companyName || 'Booked';
          isBooking = true;
        }
      }

      if (hasAssignedShoot) {
        dayClass += ' assigned-shoot';
        statusText = `📋 Shoot: ${dayShoots.map(s => s.title).join(', ')}`;
        isBooking = true; // Still blocks offline toggles
      }

      calendarDays.push(
        <div 
          key={dateStr} 
          className={dayClass}
          onClick={() => handleDayClick(dateStr, isBooking, hasAssignedShoot)}
          style={{ cursor: hasAssignedShoot || !isBooking ? 'pointer' : 'not-allowed' }}
          title={hasAssignedShoot ? `Allocated Shoot: Click to view Call Sheet` : isBooking ? `Booked by: ${block?.companyName}` : 'Click to toggle Busy/Available status'}
        >
          <span className="calendar-day-label">{day}</span>
          {statusText && (
            <span className="calendar-day-status" title={statusText}>
              {statusText}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="calendar-widget card">
        <div className="calendar-header">
          <span className="calendar-month-year">June 2026</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            * Click any date to toggle Busy block
          </span>
        </div>
        <div className="calendar-weekdays">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>
        <div className="calendar-days">
          {calendarDays}
        </div>
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color legend-available"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-busy"></div>
            <span>Busy (Offline)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-booked"></div>
            <span>Confirmed Booking</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.18)', border: '1px solid rgba(16, 185, 129, 0.6)' }}></div>
            <span>Assigned Shoot (Call Sheet)</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-grid">
      {/* Left Column: Requests, Profile, Quick Block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Profile Card */}
        <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <img src={currentFreelancer.avatarUrl} alt={currentFreelancer.name} className="avatar" style={{ width: '64px', height: '64px' }} />
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{currentFreelancer.name}</h2>
            <span className="badge badge-specialization" style={{ margin: '4px 0', display: 'inline-block' }}>
              {currentFreelancer.specialization}
            </span>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              📍 {currentFreelancer.location} &bull; ₹{currentFreelancer.ratePerDay?.toLocaleString()}/day
            </div>
          </div>
        </div>

        {/* Collapsible Edit Profile Settings */}
        <div className="card" style={{ padding: '18px' }}>
          <div 
            style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setIsEditProfileOpen(!isEditProfileOpen)}
          >
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ Edit Profile Settings
            </h3>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
              {isEditProfileOpen ? 'Hide' : 'Edit'}
            </button>
          </div>

          {isEditProfileOpen && (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--bg-tertiary)', paddingTop: '16px' }}>
              {saveSuccess && (
                <div style={{ color: 'var(--success)', fontSize: '0.85rem', padding: '8px', background: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: '6px' }}>
                  ✓ Profile updated successfully!
                </div>
              )}
              <div className="filter-group" style={{ marginBottom: '0' }}>
                <label className="filter-label" style={{ fontSize: '0.7rem' }}>Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '8px' }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="filter-group" style={{ flex: 1, marginBottom: '0' }}>
                  <label className="filter-label" style={{ fontSize: '0.7rem' }}>Specialization</label>
                  <select 
                    className="input-field" 
                    style={{ padding: '8px' }}
                    value={editSpecialization}
                    onChange={(e) => setEditSpecialization(e.target.value as Specialization)}
                  >
                    <option value="Photographer">Photographer</option>
                    <option value="Videographer">Videographer</option>
                    <option value="Cinematographer">Cinematographer</option>
                    <option value="Candid">Candid</option>
                  </select>
                </div>

                <div className="filter-group" style={{ flex: 1, marginBottom: '0' }}>
                  <label className="filter-label" style={{ fontSize: '0.7rem' }}>Daily Rate (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    style={{ padding: '8px' }}
                    value={editRate}
                    onChange={(e) => setEditRate(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="filter-group" style={{ marginBottom: '0' }}>
                <label className="filter-label" style={{ fontSize: '0.7rem' }}>Location</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '8px' }}
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  required
                />
              </div>

              <div className="filter-group" style={{ marginBottom: '0' }}>
                <label className="filter-label" style={{ fontSize: '0.7rem' }}>Portfolio Links (Comma separated)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '8px' }}
                  placeholder="https://link1.com, https://link2.com"
                  value={editPortfolio}
                  onChange={(e) => setEditPortfolio(e.target.value)}
                />
              </div>

              <div className="filter-group" style={{ marginBottom: '0' }}>
                <label className="filter-label" style={{ fontSize: '0.7rem' }}>Bio / Description</label>
                <textarea 
                  className="input-field" 
                  style={{ padding: '8px' }}
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-success" style={{ padding: '8px', marginTop: '4px' }}>
                Save Profile
              </button>
            </form>
          )}
        </div>

        {/* Mobile-first Quick Block Date Button Bar */}
        <div className="card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ Mobile Quick Manual Block
          </h3>
          <form onSubmit={handleQuickBlock} className="quick-block-inputs">
            <input 
              type="date" 
              className="input-field" 
              style={{ flex: 1, minWidth: '130px', padding: '8px' }} 
              value={quickBlockDate} 
              onChange={(e) => setQuickBlockDate(e.target.value)}
              required 
            />
            <select 
              className="input-field" 
              style={{ flex: 1, minWidth: '150px', padding: '8px' }}
              value={quickBlockLabel}
              onChange={(e) => setQuickBlockLabel(e.target.value)}
            >
              <option value="WhatsApp Booking">WhatsApp Booking</option>
              <option value="Phone Booking">Phone Booking</option>
              <option value="Personal Holiday">Personal Holiday</option>
              <option value="Other Shoot (Offline)">Other Shoot (Offline)</option>
              <option value="Busy">Generic Busy Day</option>
            </select>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
              Block Date
            </button>
          </form>
        </div>

        {/* Incoming Requests Feed */}
        <div className="card">
          <h2 className="sidebar-title">Incoming Project Requests</h2>
          
          {groupedRequests.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <span className="empty-state-icon">📥</span>
              <p>No incoming booking requests at the moment.</p>
            </div>
          ) : (
            <div className="incoming-requests">
              {groupedRequests.map(({ key, requests: groupReqs }) => {
                const firstReq = groupReqs[0];
                const companyInfo = allUsers.find((u) => u.id === firstReq.companyId);
                const isGroup = groupReqs.length > 1;
                
                // Calculate total budget
                const totalOffer = groupReqs.reduce((sum, r) => sum + r.budget, 0);
                
                return (
                  <div key={key} className="request-item" style={{ flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                      <div className="req-meta" style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span className="req-comp-name" style={{ fontSize: '1rem' }}>{firstReq.companyName}</span>
                          {companyInfo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="rating-stars">⭐ {companyInfo.rating || 'N/A'}</span>
                              <button 
                                type="button"
                                className="btn btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: '4px' }}
                                onClick={() => setReviewsCompany(companyInfo)}
                              >
                                View ({companyInfo.reviewsCount || 0} reviews)
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {companyInfo?.companyBadges && (
                          <div style={{ display: 'flex', gap: '4px', margin: '6px 0 2px 0' }}>
                            {companyInfo.companyBadges.map(badge => (
                              <span key={badge} className="badge trust-badge">{badge}</span>
                            ))}
                          </div>
                        )}
                        
                        <span className="req-proj-title" style={{ marginTop: '4px', display: 'block' }}>{firstReq.projectName}</span>
                        
                        {isGroup ? (
                          <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.8rem', borderLeft: '3px solid var(--primary)' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '6px', color: 'var(--text-primary)' }}>📅 Functions covered in Project:</div>
                            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {groupReqs.map(r => (
                                <li key={r.id}>
                                  <strong>{r.startDate}</strong>: Single day shoot (Role: {r.freelancerSpecialization}) - ₹{r.budget.toLocaleString()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <span className="req-dates">
                            📅 <strong>{firstReq.startDate}</strong> to <strong>{firstReq.endDate}</strong>
                          </span>
                        )}
                        
                        <p className="req-details" style={{ marginTop: '8px' }}>{firstReq.details}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                          <span className="req-budget-tag">
                            Total Offer: ₹{totalOffer.toLocaleString()} {isGroup && `(₹${firstReq.budget.toLocaleString()}/day)`}
                          </span>
                          <span className="badge badge-pending">
                            ⏳ {getTimeRemaining(firstReq.expiresAt)}
                          </span>
                        </div>
                      </div>

                      <div className="req-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleAccept(firstReq.id)}
                        >
                          Accept Project
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDecline(firstReq.id)}
                        >
                          Decline Project
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmed Bookings History with Company Review Forms */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Confirmed Bookings List ({bookingHistory.length})
          </h3>
          {bookingHistory.length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No confirmed bookings yet.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookingHistory.map(b => {
                const isReviewed = reviewedBookingIds.includes(b.id);
                return (
                  <div 
                    key={b.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      padding: '12px', 
                      background: 'var(--bg-tertiary)', 
                      borderRadius: '6px', 
                      fontSize: '0.85rem',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>{b.companyName}</strong> - {b.projectName}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {b.startDate} to {b.endDate}
                        </div>
                      </div>
                      <div className="badge badge-confirmed" style={{ alignSelf: 'flex-start' }}>Confirmed</div>
                    </div>

                    {/* Rate Studio block */}
                    {isReviewed ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontStyle: 'italic', marginTop: '4px' }}>
                        ✓ Thank you! You reviewed this studio.
                      </div>
                    ) : activeReviewBookingId === b.id ? (
                      <form onSubmit={(e) => handleSubmitReview(e, b.companyId, b.id)} className="review-form-container">
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Rate WedLuxe for this project:</h4>
                        
                        <div className="star-rating-input">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`star-input-btn ${newReviewRating >= star ? 'active' : ''}`}
                              onClick={() => setNewReviewRating(star)}
                            >
                              ★
                            </button>
                          ))}
                        </div>

                        <input 
                          type="text" 
                          placeholder="e.g. Paid on time. Great accommodation and travel support..."
                          className="input-field" 
                          style={{ padding: '8px', fontSize: '0.8rem' }}
                          value={newReviewText}
                          onChange={(e) => setNewReviewText(e.target.value)}
                          required
                        />

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            Submit
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            onClick={() => setActiveReviewBookingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', alignSelf: 'flex-start', marginTop: '4px' }}
                        onClick={() => {
                          setActiveReviewBookingId(b.id);
                          setNewReviewRating(5);
                          setNewReviewText('');
                        }}
                      >
                        ✍️ Rate this Studio
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Calendar */}
      <div>
        <h2 className="sidebar-title" style={{ marginBottom: '20px' }}>My Calendar & Availability</h2>
        {renderCalendarGrid()}
      </div>

      {/* Company Reviews Modal */}
      {reviewsCompany && (
        <div className="modal-overlay" onClick={() => setReviewsCompany(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{reviewsCompany.name} Trust Reviews</h2>
              <button className="modal-close" onClick={() => setReviewsCompany(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>{reviewsCompany.name}</h3>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {reviewsCompany.companyBadges?.map(badge => (
                      <span key={badge} className="badge trust-badge">{badge}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="rating-stars" style={{ fontSize: '1.2rem' }}>
                    ⭐ {reviewsCompany.rating}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Based on {reviewsCompany.reviewsCount} reviews
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '16px' }}>
                <h4 className="filter-label" style={{ marginBottom: '12px' }}>Freelancer Feedback</h4>
                
                {companyReviews.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No reviews yet for this studio.</span>
                ) : (
                  <div className="reviews-list-container">
                    {companyReviews.map((rev) => (
                      <div key={rev.id} className="review-item-card">
                        <div className="review-header">
                          <span className="review-author">{rev.freelancerName}</span>
                          <span className="review-date">
                            <span style={{ color: '#fbbf24', marginRight: '6px' }}>
                              {'★'.repeat(Math.round(rev.rating || 5))}{'☆'.repeat(5 - Math.round(rev.rating || 5))}
                            </span>
                            {rev.date}
                          </span>
                        </div>
                        <p className="review-text">"{rev.text}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReviewsCompany(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Call Sheet Modal */}
      {selectedCallSheetDate && (
        <div className="modal-overlay" onClick={() => setSelectedCallSheetDate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>📋 Call Sheet & Shoot Details</h2>
              <button className="modal-close" onClick={() => setSelectedCallSheetDate(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ gap: '16px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Shoot Date</span>
                  <h3 style={{ color: 'var(--success)', marginTop: '2px' }}>{selectedCallSheetDate}</h3>
                </div>
                <span className="badge badge-confirmed">Confirmed Assignment</span>
              </div>

              {(() => {
                const dayShoots = allocations.filter(s => s.date === selectedCallSheetDate);
                if (dayShoots.length === 0) {
                  return <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No shoots assigned for this date.</div>;
                }
                
                return dayShoots.map(shoot => {
                  // Find all shoots on the same project on the same date
                  const projectShoots = getShootSchedules().filter(
                    s => s.projectId === shoot.projectId && s.date === selectedCallSheetDate
                  );
                  const users = getUsers();
                  const coShooters: { freelancer: User; role: Specialization; shootTitle: string }[] = [];
                  projectShoots.forEach(s => {
                    s.crewSlots.forEach(slot => {
                      if (slot.allocatedFreelancerId && slot.allocatedFreelancerId !== currentFreelancer.id) {
                        const f = users.find(u => u.id === slot.allocatedFreelancerId);
                        if (f) {
                          coShooters.push({ freelancer: f, role: slot.role, shootTitle: s.title });
                        }
                      }
                    });
                  });

                  return (
                    <div key={shoot.id} className="card" style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--success)', margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{shoot.title}</h4>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Project: <strong>{shoot.projectName}</strong>
                          </div>
                        </div>
                        <span className="badge badge-specialization" style={{ fontSize: '0.7rem' }}>{shoot.roleNeeded}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem', borderTop: '1px solid var(--bg-tertiary)', paddingTop: '10px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>🕒 Timing:</span>
                          <div style={{ color: 'var(--text-primary)', marginTop: '2px', fontWeight: '600' }}>{shoot.time}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>📍 Venue:</span>
                          <div style={{ color: 'var(--text-primary)', marginTop: '2px', fontWeight: '600' }}>{shoot.venue}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', marginTop: '4px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Client Contact Details:</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>Name: <strong style={{ color: 'var(--text-primary)' }}>{shoot.clientName}</strong></div>
                          <div>Phone: <strong style={{ color: 'var(--text-primary)' }}>🇮🇳 {shoot.clientPhone}</strong></div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>👥 Co-Shooters Team:</span>
                        {coShooters.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Sole coverage (No other co-shooters allocated on this date)
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {coShooters.map((cs, idx) => (
                              <div key={idx} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                <span>👤 <strong>{cs!.freelancer.name}</strong> ({cs!.shootTitle})</span>
                                <span className="badge badge-specialization" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{cs!.role}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCallSheetDate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
