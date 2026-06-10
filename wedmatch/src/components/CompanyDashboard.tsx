import React, { useState, useMemo } from 'react';
import type { User, Specialization, Project, ShootSchedule, Deliverable, DeliverableStatus, CrewSlot, GalleryPhoto } from '../types';
import { 
  getAvailableFreelancers, 
  sendBookingRequest, 
  sendProjectBookingRequests,
  getCalendarBlocks, 
  getCompanyReviews,
  getProjects,
  getShootSchedules,
  getDeliverables,
  saveDeliverables,
  createProject,
  updateProject,
  allocateFreelancer,
  getUsers,
  cancelBookingRequest,
  getSlotActiveRequest,
  isSlotLocked,
  UNSPLASH_PHOTO_POOL,
  saveProjectPhotos,
  publishProjectGallery,
  runAiFaceScanning,
  addNotificationLog
} from '../db';

interface CompanyDashboardProps {
  currentCompany: User;
  simulatedTime: Date;
  onStateChange: () => void;
  dbTrigger: number;
  setActiveRole?: (role: 'Company' | 'Freelancer' | 'Client') => void;
  setActiveClientProjectId?: (id: string) => void;
}

const calculateEstimatedCrewCost = (shoots: { date: string; crewSlots: { role: Specialization }[] }[]) => {
  const roleRates: Record<Specialization, number> = {
    Photographer: 5000,
    Videographer: 5000,
    Cinematographer: 8000,
    Candid: 8000
  };

  const roleDates: Record<Specialization, Set<string>> = {
    Photographer: new Set<string>(),
    Videographer: new Set<string>(),
    Cinematographer: new Set<string>(),
    Candid: new Set<string>()
  };

  shoots.forEach(shoot => {
    (shoot.crewSlots || []).forEach(slot => {
      if (roleDates[slot.role]) {
        roleDates[slot.role].add(shoot.date);
      }
    });
  });

  let totalCost = 0;
  (Object.keys(roleDates) as Specialization[]).forEach(role => {
    totalCost += roleDates[role].size * roleRates[role];
  });

  return totalCost;
};

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  currentCompany,
  simulatedTime,
  onStateChange,
  dbTrigger,
  setActiveRole,
  setActiveClientProjectId,
}) => {

  // Selected Freelancer for Profile Modal
  const [selectedFreelancer, setSelectedFreelancer] = useState<User | null>(null);

  // Company Reviews Modal State
  const [isCompanyReviewsOpen, setIsCompanyReviewsOpen] = useState(false);

  // Active sub-tab state inside ERP
  const [activeTab, setActiveTab] = useState<'projects' | 'allocation' | 'galleries'>('projects');

  // Selected Project for Editing
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Crew Allocation States
  const [allocationModalSlot, setAllocationModalSlot] = useState<{ shoot: ShootSchedule; slot: CrewSlot } | null>(null);
  const [allocationSearchLocation, setAllocationSearchLocation] = useState('');
  const [allocationRequestModal, setAllocationRequestModal] = useState<{ freelancer: User; shoot: ShootSchedule; slot: CrewSlot } | null>(null);
  const [requestBudgetInput, setRequestBudgetInput] = useState<number>(5000);
  const [requestDetailsInput, setRequestDetailsInput] = useState<string>('');

  // Project-wide crew allocation states
  const [projectAllocationModalProj, setProjectAllocationModalProj] = useState<Project | null>(null);
  const [projectAllocationRole, setProjectAllocationRole] = useState<Specialization>('Photographer');
  const [projectAllocationSearchLocation, setProjectAllocationSearchLocation] = useState('');
  const [projectAllocationRequestModal, setProjectAllocationRequestModal] = useState<{
    freelancer: User;
    project: Project;
    role: Specialization;
    matchingSlots: { shootId: string; slotId: string; date: string; title: string }[];
  } | null>(null);

  React.useEffect(() => {
    if (allocationRequestModal) {
      setRequestBudgetInput(allocationRequestModal.freelancer.ratePerDay || 5000);
      setRequestDetailsInput(`Coverage for ${allocationRequestModal.shoot.title} event at ${allocationRequestModal.shoot.venue}.`);
    }
  }, [allocationRequestModal]);

  React.useEffect(() => {
    if (projectAllocationRequestModal) {
      setRequestBudgetInput(projectAllocationRequestModal.freelancer.ratePerDay || 5000);
      const functionsStr = projectAllocationRequestModal.matchingSlots.map(s => s.title).join(', ');
      setRequestDetailsInput(`Comprehensive project coverage for shoots: ${functionsStr}.`);
    }
  }, [projectAllocationRequestModal]);

  // Project Management states
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('+91 ');
  const [projBilling, setProjBilling] = useState<number>(200000);
  const [projExpenses, setProjExpenses] = useState<number>(5000);

  // Photo Sharing & AI face scanning states
  const [photoManagingProject, setPhotoManagingProject] = useState<Project | null>(null);
  const [googleDriveInput, setGoogleDriveInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStepMsg, setUploadStepMsg] = useState('');
  const [selectedUploadCategory, setSelectedUploadCategory] = useState<'Mehendi' | 'Haldi' | 'Wedding'>('Wedding');
  
  const [isScanningFaces, setIsScanningFaces] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [scanFaceCount, setScanFaceCount] = useState(0);

  // Dynamic shoots list in form
  const [formShoots, setFormShoots] = useState<{
    title: string;
    date: string;
    time: string;
    venue: string;
    crewSlots: { role: Specialization; allocatedFreelancerId: string | null }[];
  }[]>([
    { 
      title: 'Mehendi', 
      date: '2026-06-23', 
      time: '16:00', 
      venue: 'Delhi', 
      crewSlots: [
        { role: 'Photographer', allocatedFreelancerId: null },
        { role: 'Videographer', allocatedFreelancerId: null }
      ]
    },
    { 
      title: 'Haldi', 
      date: '2026-06-24', 
      time: '10:00', 
      venue: 'Delhi', 
      crewSlots: [
        { role: 'Photographer', allocatedFreelancerId: null },
        { role: 'Videographer', allocatedFreelancerId: null }
      ]
    },
    { 
      title: 'Wedding', 
      date: '2026-06-24', 
      time: '18:00', 
      venue: 'Delhi', 
      crewSlots: [
        { role: 'Photographer', allocatedFreelancerId: null },
        { role: 'Videographer', allocatedFreelancerId: null }
      ]
    }
  ]);

  // Dynamic deliverables list in form
  const [formDeliverables, setFormDeliverables] = useState<{
    name: string;
    packageType: 'Included' | 'Addon';
    deadline: string;
    cost: number;
  }[]>([
    { name: 'Traditional Album', packageType: 'Included', deadline: '2026-08-01', cost: 10000 },
    { name: 'Cinematic Highlight Teaser', packageType: 'Included', deadline: '2026-08-01', cost: 7000 },
    { name: 'Reels Bundle (x3)', packageType: 'Included', deadline: '2026-08-01', cost: 1500 },
    { name: 'Traditional Full Wedding Video', packageType: 'Included', deadline: '2026-08-01', cost: 5000 },
    { name: 'Premium Canvas Frame (1 Unit)', packageType: 'Included', deadline: '2026-08-01', cost: 1000 }
  ]);

  // Fetch projects list
  const projectsList = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger;
    return getProjects().filter(p => p.companyId === currentCompany.id);
  }, [currentCompany.id, dbTrigger]);

  // Fetch shoots list
  const shootsList = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger;
    return getShootSchedules();
  }, [dbTrigger]);

  // Fetch deliverables list
  const deliverablesList = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dbTrigger;
    return getDeliverables();
  }, [dbTrigger]);


  // Fetch all calendar blocks to display in profile modal
  const allBlocks = useMemo(() => {
    return getCalendarBlocks();
  }, [selectedFreelancer, simulatedTime, dbTrigger]);

  // Fetch company reviews for the client reviews modal
  const clientReviews = useMemo(() => {
    return getCompanyReviews(currentCompany.id);
  }, [currentCompany.id, dbTrigger]);

  const handleCloseProjectModal = () => {
    setIsCreateProjectOpen(false);
    setEditingProject(null);
    setProjName('');
    setClientNameInput('');
    setClientPhoneInput('+91 ');
    setProjBilling(200000);
    setProjExpenses(5000);
    setFormShoots([
      { 
        title: 'Mehendi', 
        date: '2026-06-23', 
        time: '16:00', 
        venue: 'Delhi', 
        crewSlots: [
          { role: 'Photographer', allocatedFreelancerId: null },
          { role: 'Videographer', allocatedFreelancerId: null }
        ]
      },
      { 
        title: 'Haldi', 
        date: '2026-06-24', 
        time: '10:00', 
        venue: 'Delhi', 
        crewSlots: [
          { role: 'Photographer', allocatedFreelancerId: null },
          { role: 'Videographer', allocatedFreelancerId: null }
        ]
      },
      { 
        title: 'Wedding', 
        date: '2026-06-24', 
        time: '18:00', 
        venue: 'Delhi', 
        crewSlots: [
          { role: 'Photographer', allocatedFreelancerId: null },
          { role: 'Videographer', allocatedFreelancerId: null }
        ]
      }
    ]);
    setFormDeliverables([
      { name: 'Traditional Album', packageType: 'Included', deadline: '2026-08-01', cost: 10000 },
      { name: 'Cinematic Highlight Teaser', packageType: 'Included', deadline: '2026-08-01', cost: 7000 },
      { name: 'Reels Bundle (x3)', packageType: 'Included', deadline: '2026-08-01', cost: 1500 },
      { name: 'Traditional Full Wedding Video', packageType: 'Included', deadline: '2026-08-01', cost: 5000 },
      { name: 'Premium Canvas Frame (1 Unit)', packageType: 'Included', deadline: '2026-08-01', cost: 1000 }
    ]);
  };

  const handleOpenEditProject = (proj: Project) => {
    setEditingProject(proj);
    setProjName(proj.name);
    setClientNameInput(proj.clientName);
    setClientPhoneInput(proj.clientPhone);
    setProjBilling(proj.billingAmount);
    setProjExpenses(proj.extraExpenses);
    
    // Fetch shoots and deliverables for this project
    const projShoots = shootsList.filter(s => s.projectId === proj.id);
    const projDelivs = deliverablesList.filter(d => d.projectId === proj.id);

    // Populate builder states
    setFormShoots(projShoots.map(s => ({
      id: s.id,
      title: s.title,
      date: s.date,
      time: s.time,
      venue: s.venue,
      crewSlots: (s.crewSlots || []).map(slot => ({
        id: slot.id,
        role: slot.role,
        allocatedFreelancerId: slot.allocatedFreelancerId
      }))
    })));

    setFormDeliverables(projDelivs.map(d => ({
      id: d.id,
      name: d.name,
      packageType: d.packageType,
      deadline: d.deadline,
      cost: d.cost || 0
    })));

    setIsCreateProjectOpen(true);
  };

  const handleProjectFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !clientNameInput.trim() || !clientPhoneInput.trim()) {
      alert('Project name, client name, and client phone are required.');
      return;
    }

    if (editingProject) {
      updateProject(editingProject.id, {
        name: projName,
        clientName: clientNameInput,
        clientPhone: clientPhoneInput,
        billingAmount: projBilling,
        extraExpenses: projExpenses,
        shoots: formShoots,
        deliverables: formDeliverables
      });
    } else {
      createProject({
        companyId: currentCompany.id,
        name: projName,
        clientName: clientNameInput,
        clientPhone: clientPhoneInput,
        billingAmount: projBilling,
        extraExpenses: projExpenses,
        shoots: formShoots,
        deliverables: formDeliverables
      });
    }

    handleCloseProjectModal();
    onStateChange();
  };


  // Helper to render calendar in Profile Modal
  const renderProfileCalendar = (freelancerId: string) => {
    // We will render June 2026 as it is our demo target month
    const year = 2026;
    const month = 5; // 0-indexed, so 5 is June
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Weekday of 1st day of month (June 1, 2026 is Monday, so day.getDay() is 1)
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    
    const calendarDays = [];
    // Pad initial empty days
    for (let i = 0; i < firstDayIndex; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    const freelancerBlocks = allBlocks.filter(b => b.freelancerId === freelancerId);
    const targetDate = allocationModalSlot?.shoot.date || null;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const block = freelancerBlocks.find(b => b.date === dateStr);
      const isTargetDate = targetDate && dateStr === targetDate;

      let dayClass = 'calendar-day';
      let statusText = '';

      if (block) {
        if (block.type === 'Offline') {
          dayClass += ' busy';
          statusText = 'Busy';
        } else if (block.type === 'Booking') {
          dayClass += ' booked';
          statusText = `Booked`;
        }
      } else if (isTargetDate) {
        dayClass += ' selected-date';
      }

      calendarDays.push(
        <div 
          key={dateStr} 
          className={dayClass}
          style={isTargetDate && !block ? { border: '2px solid var(--primary)', background: 'var(--primary-light)' } : {}}
          title={block?.type === 'Booking' ? `Booked by: ${block.companyName}` : undefined}
        >
          <span className="calendar-day-label">{day}</span>
          {statusText && <span className="calendar-day-status">{statusText}</span>}
        </div>
      );
    }

    return (
      <div className="calendar-widget card" style={{ padding: '16px', marginTop: '12px' }}>
        <div className="calendar-header">
          <span className="calendar-month-year">June 2026 Availability</span>
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
            <span>Booked</span>
          </div>
        </div>
      </div>
    );
  };

  // Photo management handlers
  const handleOpenManagePhotos = (proj: Project) => {
    setPhotoManagingProject(proj);
    setGoogleDriveInput(proj.googleDriveLink || '');
  };

  const handleSimulatePhotoUpload = () => {
    if (!googleDriveInput.trim()) {
      alert('Please enter a Google Drive folder link before uploading photos.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStepMsg('Authenticating Google Drive API...');

    // Simulate upload sequence
    const steps = [
      { progress: 15, msg: 'Creating remote folder sync...' },
      { progress: 40, msg: `Transferring high-res images to ${selectedUploadCategory} subfolder...` },
      { progress: 75, msg: 'Saving file metadata and generating CDN URLs...' },
      { progress: 100, msg: 'Photo upload completed successfully!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setUploadProgress(steps[currentStep].progress);
        setUploadStepMsg(steps[currentStep].msg);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          if (photoManagingProject) {
            // Get photos from UNSPLASH_PHOTO_POOL matching this category
            const categoryPhotos = UNSPLASH_PHOTO_POOL.filter((p: GalleryPhoto) => p.category === selectedUploadCategory);
            const existingPhotos = photoManagingProject.uploadedPhotos || [];
            const newPhotos = categoryPhotos.map((p: GalleryPhoto) => ({
              ...p,
              id: `${p.id}_${Math.random().toString(36).substring(2, 6)}`,
              selectedForAlbum: false
            }));

            const merged = [...existingPhotos, ...newPhotos];
            saveProjectPhotos(photoManagingProject.id, merged, googleDriveInput);
            
            // Reload project state
            const updatedProjects = getProjects();
            const up = updatedProjects.find(p => p.id === photoManagingProject.id);
            if (up) setPhotoManagingProject(up);
            onStateChange();

            // Dispatch Toast Notification
            window.dispatchEvent(
              new CustomEvent('wedmatch-notification', {
                detail: { message: `🎉 Successfully uploaded ${newPhotos.length} photos to ${selectedUploadCategory}!` }
              })
            );
          }
        }, 600);
      }
    }, 800);
  };

  const handleRealLocalFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!photoManagingProject) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!googleDriveInput.trim()) {
      alert('Please enter a Google Drive folder link before uploading photos.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStepMsg('Reading local files...');

    const faceCombos = [
      ['face_bride', 'face_groom'],
      ['face_bride', 'face_sister1'],
      ['face_groom', 'face_uncle1'],
      ['face_friend1', 'face_friend2'],
      ['face_bride', 'face_groom', 'face_uncle1'],
      ['face_sister1', 'face_friend1']
    ];

    setTimeout(() => {
      setUploadProgress(40);
      setUploadStepMsg('Generating browser object URLs for local display...');

      const newPhotos: GalleryPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const objectUrl = URL.createObjectURL(file);
        const randomFaces = faceCombos[Math.floor(Math.random() * faceCombos.length)];

        newPhotos.push({
          id: `real_${Math.random().toString(36).substring(2, 9)}`,
          url: objectUrl,
          category: selectedUploadCategory,
          detectedFaces: randomFaces,
          selectedForAlbum: false
        });
      }

      setUploadProgress(85);
      setUploadStepMsg('Writing metadata and syncing with connected Drive...');

      setTimeout(() => {
        setIsUploading(false);
        const existingPhotos = photoManagingProject.uploadedPhotos || [];
        const merged = [...existingPhotos, ...newPhotos];
        
        saveProjectPhotos(photoManagingProject.id, merged, googleDriveInput);
        
        // Reload project state
        const updatedProjects = getProjects();
        const up = updatedProjects.find(p => p.id === photoManagingProject.id);
        if (up) setPhotoManagingProject(up);
        onStateChange();

        // Dispatch Toast Notification
        window.dispatchEvent(
          new CustomEvent('wedmatch-notification', {
            detail: { message: `🎉 Successfully uploaded ${newPhotos.length} real files to ${selectedUploadCategory}!` }
          })
        );
      }, 800);
    }, 1200);
  };

  const handleRunFaceScanning = () => {
    if (!photoManagingProject) return;
    const photos = photoManagingProject.uploadedPhotos || [];
    if (photos.length === 0) {
      alert('Please upload photos before running AI face recognition.');
      return;
    }

    setIsScanningFaces(true);
    setScanningProgress(0);
    setScanFaceCount(0);

    // Simulate scanning images
    const interval = setInterval(() => {
      setScanningProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 8;
      });
      setScanFaceCount(prev => prev + Math.floor(Math.random() * 2));
    }, 150);

    setTimeout(() => {
      setIsScanningFaces(false);
      runAiFaceScanning(photoManagingProject.id);
      
      // Reload project state
      const updatedProjects = getProjects();
      const up = updatedProjects.find(p => p.id === photoManagingProject.id);
      if (up) setPhotoManagingProject(up);
      onStateChange();

      // Dispatch Toast Notification
      window.dispatchEvent(
        new CustomEvent('wedmatch-notification', {
          detail: { message: `⚡ AI Face Scan finished! Detected 6 unique family member/guest profiles.` }
        })
      );
    }, 2200);
  };

  const handlePublishGallery = () => {
    if (!photoManagingProject) return;
    const photos = photoManagingProject.uploadedPhotos || [];
    if (photos.length === 0) {
      alert('Cannot publish an empty gallery. Please upload photos first.');
      return;
    }

    publishProjectGallery(photoManagingProject.id);

    // Simulate WhatsApp Notification log
    const portalUrl = `${window.location.origin}/?role=Client&projectId=${photoManagingProject.id}`;
    const message = `👋 Hello ${photoManagingProject.clientName}! Your wedding pictures are live on our premium client portal. Click the link to view, share with guests (using AI face search), and heart your favorites for the printed album! 🔗 View Gallery: ${portalUrl}`;

    addNotificationLog({
      recipientName: photoManagingProject.clientName,
      type: 'WhatsApp',
      message: `📲 WhatsApp Outgoing: ${message}`
    });

    // Reload project state
    const updatedProjects = getProjects();
    const up = updatedProjects.find(p => p.id === photoManagingProject.id);
    if (up) setPhotoManagingProject(up);
    onStateChange();

    // Close photo manager modal
    setPhotoManagingProject(null);

    // Dispatch toast alert
    window.dispatchEvent(
      new CustomEvent('wedmatch-notification', {
        detail: { message: `✨ Gallery published! WhatsApp notification sent to ${photoManagingProject.clientName}.` }
      })
    );
  };

  // Render projects dashboard list
  const renderProjectsDashboard = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Wedding Projects Dashboard</h2>
          <button 
            type="button" 
            className="btn btn-success"
            onClick={() => {
              setEditingProject(null);
              setIsCreateProjectOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ➕ Create Project
          </button>
        </div>

        {projectsList.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-state-icon">📂</span>
            <h3>No Active Projects</h3>
            <p style={{ marginTop: '8px' }}>Create a project and start assigning hired creators to shoot schedules.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {projectsList.map((proj: Project) => {
              const projShoots = shootsList.filter(s => s.projectId === proj.id);
              const projDelivs = deliverablesList.filter(d => d.projectId === proj.id);
              
              // Financial cost calculations
              const crewCosts = calculateEstimatedCrewCost(projShoots);

              const deliverablesCost = projDelivs.reduce((sum, d) => sum + (d.cost || 0), 0);
              const totalProjectCost = crewCosts + deliverablesCost + proj.extraExpenses;
              const netProfit = proj.billingAmount - totalProjectCost;
              const profitPercentage = proj.billingAmount > 0 ? Math.round((netProfit / proj.billingAmount) * 100) : 0;

              return (
                <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{proj.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Client: <strong>{proj.clientName}</strong> ({proj.clientPhone}) &bull; Created: {new Date(proj.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {proj.galleryPublished && (
                        <span className="badge badge-confirmed" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                          ✨ Gallery Live
                        </span>
                      )}
                      {proj.googleDriveLink ? (
                        <span className="badge badge-pending" style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)', borderColor: 'var(--info-light)' }} title={proj.googleDriveLink}>
                          🔗 Connected
                        </span>
                      ) : (
                        <span className="badge badge-pending" style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'transparent', color: 'var(--text-muted)' }}>
                          🔗 Drive Off
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary)', color: 'white' }}
                        onClick={() => handleOpenManagePhotos(proj)}
                      >
                        📸 Manage Photos
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleOpenEditProject(proj)}
                      >
                        ✏️ Edit Project
                      </button>
                    </div>
                  </div>

                  {/* Deliverables Checklist */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      📦 Deliverables & Album Progress
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {projDelivs.map((deliv: Deliverable) => {
                        const statusColors: Record<DeliverableStatus, string> = {
                          'Pending': 'var(--text-muted)',
                          'In Progress': 'var(--warning)',
                          'Review': 'var(--primary)',
                          'Delivered': 'var(--success)'
                        };

                        const toggleDeliverableStatus = (delivId: string, currentStatus: DeliverableStatus) => {
                          const delivs = getDeliverables();
                          const idx = delivs.findIndex(d => d.id === delivId);
                          if (idx !== -1) {
                            const nextStatusMap: Record<DeliverableStatus, DeliverableStatus> = {
                              'Pending': 'In Progress',
                              'In Progress': 'Review',
                              'Review': 'Delivered',
                              'Delivered': 'Pending'
                            };
                            delivs[idx].status = nextStatusMap[currentStatus];
                            saveDeliverables(delivs);
                            onStateChange();
                          }
                        };

                        return (
                          <div 
                            key={deliv.id} 
                            style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => toggleDeliverableStatus(deliv.id, deliv.status)}
                            title="Click to cycle status: Pending -> In Progress -> Review -> Delivered"
                          >
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)' }}>{deliv.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Due: {deliv.deadline} &bull; <span style={{ opacity: 0.8 }}>{deliv.packageType}</span> &bull; <span>₹{deliv.cost?.toLocaleString() || 0}</span>
                              </div>
                            </div>
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                border: `1px solid ${statusColors[deliv.status]}`,
                                color: statusColors[deliv.status],
                                background: 'transparent'
                              }}
                            >
                              {deliv.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Costing breakdown */}
                  <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Project Budget: </span>
                        <strong style={{ color: 'var(--success)' }}>₹{proj.billingAmount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Crew Payout: </span>
                        <strong style={{ color: 'var(--warning)' }}>₹{crewCosts.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Deliverables Cost: </span>
                        <strong style={{ color: 'var(--primary)' }}>₹{deliverablesCost.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Other Expenses: </span>
                        <strong style={{ color: 'var(--danger)' }}>₹{proj.extraExpenses.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. Net Margin:</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          ₹{netProfit.toLocaleString()} ({profitPercentage}%)
                        </div>
                      </div>
                      {/* Mini Profit Progress Bar */}
                      <div style={{ width: '60px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.max(0, Math.min(100, profitPercentage))}%`, 
                          height: '100%', 
                          background: profitPercentage >= 40 ? 'var(--success)' : profitPercentage >= 20 ? 'var(--primary)' : 'var(--danger)' 
                        }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Galleries & Photo Management Hub Tab
  const renderGalleriesDashboard = () => {
    const totalGalleries = projectsList.length;
    const connectedDriveCount = projectsList.filter(p => p.googleDriveLink).length;
    const publishedCount = projectsList.filter(p => p.galleryPublished).length;
    const scannedCount = projectsList.filter(p => p.facesScanned).length;
    const albumSubmittedCount = projectsList.filter(p => p.albumSelectionSubmitted).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>📸 Client Galleries & Photo Sharing Hub</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Connect Google Drive folders, upload deliverables, trigger AI face scanning, and manage live couple portal links.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (projectsList.length > 0) {
                handleOpenManagePhotos(projectsList[0]);
              } else {
                alert('Please create a project first.');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span> Connect New Gallery
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>📂</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Galleries</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>{totalGalleries}</strong>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>🔗</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Drive Connected</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--info)' }}>{connectedDriveCount} / {totalGalleries}</strong>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>⚡</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI Scans Complete</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--primary-light)' }}>{scannedCount} / {totalGalleries}</strong>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>✨</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Galleries Published</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--success)' }}>{publishedCount} / {totalGalleries}</strong>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>📖</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Albums Submitted</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>{albumSubmittedCount} / {totalGalleries}</strong>
          </div>
        </div>

        {/* Galleries List */}
        {projectsList.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-state-icon">📸</span>
            <h3>No Galleries to Manage</h3>
            <p style={{ marginTop: '8px' }}>Create a project to connect a client photo gallery.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {projectsList.map((proj: Project) => {
              const photoCount = (proj.uploadedPhotos || []).length;
              const mehCount = (proj.uploadedPhotos || []).filter(p => p.category === 'Mehendi').length;
              const halCount = (proj.uploadedPhotos || []).filter(p => p.category === 'Haldi').length;
              const wedCount = (proj.uploadedPhotos || []).filter(p => p.category === 'Wedding').length;
              
              const selectedCount = (proj.uploadedPhotos || []).filter(p => p.selectedForAlbum).length;

              return (
                <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', position: 'relative' }}>
                  
                  {/* Card Header */}
                  <div style={{ borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{proj.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Client Couple: <strong>{proj.clientName}</strong> &bull; {proj.clientPhone}
                      </div>
                    </div>
                    
                    <span 
                      className={`badge ${proj.galleryPublished ? 'badge-confirmed' : 'badge-pending'}`} 
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    >
                      {proj.galleryPublished ? '🟢 Live' : '🔴 Draft'}
                    </span>
                  </div>

                  {/* Connection Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    
                    {/* Google Drive Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>🔗 Google Drive:</span>
                      {proj.googleDriveLink ? (
                        <a 
                          href={proj.googleDriveLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ color: 'var(--info)', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          Connected Drive Folder
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Disconnected</span>
                      )}
                    </div>

                    {/* Photos Count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>🖼️ Photos Uploaded:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {photoCount > 0 ? (
                          `${photoCount} photos (${wedCount} Wed, ${halCount} Hal, ${mehCount} Meh)`
                        ) : (
                          'No photos'
                        )}
                      </strong>
                    </div>

                    {/* AI Face Scanning Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>👤 AI biometric Scan:</span>
                      {proj.facesScanned ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>🟢 Scanned & Tagged</span>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>⚠️ Not Scanned</span>
                      )}
                    </div>

                    {/* Album Selection Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>📖 Album Print Selection:</span>
                      {proj.albumSelectionSubmitted ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ✅ Submitted ({selectedCount} photos favorited)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          ⏳ Pending Client Selection {selectedCount > 0 ? `(${selectedCount} favorited)` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleOpenManagePhotos(proj)}
                    >
                      📸 Manage Photos
                    </button>

                    {setActiveRole && setActiveClientProjectId && proj.galleryPublished ? (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--primary)' }}
                        onClick={() => {
                          setActiveClientProjectId(proj.id);
                          setActiveRole('Client');
                        }}
                      >
                        👁️ View Live Gallery
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px', opacity: 0.5, cursor: 'not-allowed' }}
                        disabled
                        title="Publish gallery first to view"
                      >
                        👁️ Portal Unavailable
                      </button>
                    )}
                  </div>

                  {/* Quick publish controls */}
                  {!proj.galleryPublished && photoCount > 0 && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', background: 'var(--success)', borderColor: 'var(--success)', fontSize: '0.8rem', padding: '6px 12px' }}
                      onClick={() => {
                        setPhotoManagingProject(proj);
                        handlePublishGallery();
                      }}
                    >
                      ✨ Publish Draft Gallery & Notify Couple
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Team Allocation Dashboard View
  const renderTeamAllocation = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Team Allocation & Crew Management</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Allocate confirmed hired creators to shoot schedules
          </span>
        </div>

        {projectsList.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-state-icon">👥</span>
            <h3>No Active Projects</h3>
            <p style={{ marginTop: '8px' }}>Create a project in the Projects Hub to begin allocating crew.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {projectsList.map((proj: Project) => {
              const projShoots = shootsList.filter(s => s.projectId === proj.id);
              
              return (
                <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--success)' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-tertiary)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>{proj.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Client: <strong>{proj.clientName}</strong> &bull; Location: <strong>{projShoots[0]?.venue || 'TBD'}</strong>
                      </div>
                    </div>
                    {projShoots.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                          setProjectAllocationModalProj(proj);
                          setProjectAllocationRole('Photographer');
                          setProjectAllocationSearchLocation(projShoots[0]?.venue || '');
                        }}
                      >
                        🔗 Allocate Crew for Entire Project
                      </button>
                    )}
                  </div>

                  {/* Dynamic Shoot Schedule */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📅 Shoot Schedule & Crew Allocation
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {projShoots.length === 0 ? (
                        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          No shoots scheduled for this project. Edit the project to add shoots.
                        </div>
                      ) : (
                        projShoots.map((shoot: ShootSchedule) => {
                          return (
                            <div key={shoot.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{shoot.title}</strong>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    📅 {shoot.date} at {shoot.time} &bull; 📍 {shoot.venue}
                                  </div>
                                </div>
                              </div>

                              {/* Crew Slots Nested list */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--bg-tertiary)', paddingTop: '8px', marginTop: '4px' }}>
                                {(shoot.crewSlots || []).map(slot => {
                                  const allocatedFreelancer = getUsers().find(f => f.id === slot.allocatedFreelancerId);
                                  const activeRequest = getSlotActiveRequest(slot.id);

                                  return (
                                    <div key={slot.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '6px' }}>
                                      <div style={{ width: '130px' }}>
                                        <span className="badge badge-specialization" style={{ fontSize: '0.7rem' }}>{slot.role}</span>
                                      </div>

                                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                                        {slot.allocatedFreelancerId ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: '600' }}>
                                              👤 Hired: {allocatedFreelancer?.name}
                                            </span>
                                            <button 
                                              type="button" 
                                              className="modal-close" 
                                              style={{ position: 'static', border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                                              onClick={() => {
                                                allocateFreelancer(shoot.id, slot.id, null);
                                                onStateChange();
                                              }}
                                              title="Unassign freelancer"
                                            >
                                              &times;
                                            </button>
                                          </div>
                                        ) : activeRequest ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                                              ⏳ Requested: {activeRequest.freelancerName}
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                              onClick={() => {
                                                cancelBookingRequest(activeRequest.id);
                                                onStateChange();
                                              }}
                                            >
                                              Withdraw
                                            </button>
                                          </div>
                                        ) : (
                                          <div>
                                            <button
                                              type="button"
                                              className="btn btn-primary"
                                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                              onClick={() => {
                                                setAllocationModalSlot({ shoot, slot });
                                                setAllocationSearchLocation(shoot.venue);
                                              }}
                                            >
                                              🔍 Find & Request Crew
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render create project form (matching IPC Studios style)
  const renderCreateProjectForm = () => {
    // Calculate estimated crew costs from the form's scheduled shoot roles and dates
    const estCrewCost = calculateEstimatedCrewCost(formShoots);

    const estDeliverablesCost = formDeliverables.reduce((sum, d) => sum + (d.cost || 0), 0);
    const estProfit = projBilling - estCrewCost - estDeliverablesCost - projExpenses;
    const estProfitPercent = projBilling > 0 ? Math.round((estProfit / projBilling) * 100) : 0;

    const handleAddShootRow = () => {
      setFormShoots(prev => [
        ...prev,
        { 
          title: 'New Event Shoot', 
          date: '2026-06-25', 
          time: '12:00', 
          venue: 'Venue Location', 
          crewSlots: [
            { role: 'Photographer', allocatedFreelancerId: null }
          ]
        }
      ]);
    };

    const handleRemoveShootRow = (idx: number) => {
      setFormShoots(prev => prev.filter((_, i) => i !== idx));
    };

    const handleShootRowChange = (idx: number, field: string, val: any) => {
      setFormShoots(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
      });
    };

    const handleAddCrewSlot = (shootIdx: number) => {
      setFormShoots(prev => {
        const next = [...prev];
        next[shootIdx] = {
          ...next[shootIdx],
          crewSlots: [...next[shootIdx].crewSlots, { role: 'Photographer', allocatedFreelancerId: null }]
        };
        return next;
      });
    };

    const handleRemoveCrewSlot = (shootIdx: number, slotIdx: number) => {
      setFormShoots(prev => {
        const next = [...prev];
        next[shootIdx] = {
          ...next[shootIdx],
          crewSlots: next[shootIdx].crewSlots.filter((_, i) => i !== slotIdx)
        };
        return next;
      });
    };

    const handleCrewSlotRoleChange = (shootIdx: number, slotIdx: number, role: Specialization) => {
      setFormShoots(prev => {
        const next = [...prev];
        const nextSlots = [...next[shootIdx].crewSlots];
        nextSlots[slotIdx] = { ...nextSlots[slotIdx], role };
        next[shootIdx] = { ...next[shootIdx], crewSlots: nextSlots };
        return next;
      });
    };

    const handleAddDelivRow = () => {
      setFormDeliverables(prev => [
        ...prev,
        { name: 'Photo Hard Drive', packageType: 'Included', deadline: '2026-08-01', cost: 0 }
      ]);
    };

    const handleRemoveDelivRow = (idx: number) => {
      setFormDeliverables(prev => prev.filter((_, i) => i !== idx));
    };

    const handleDelivRowChange = (idx: number, field: string, val: any) => {
      setFormDeliverables(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: val };
        return next;
      });
    };

    return (
      <form onSubmit={handleProjectFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Projects Hub / {editingProject ? 'Edit Project' : 'Create Project'}
            </div>
            <h2 style={{ marginTop: '4px' }}>{editingProject ? '✏️ Edit Wedding Project' : 'Create Wedding Project'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCloseProjectModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success">
              {editingProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </div>

        {/* Card 1: Project Name & Client Phone */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="filter-group" style={{ margin: 0 }}>
            <label className="filter-label" style={{ fontSize: '0.9rem' }}>Project Name</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter Project Name (e.g. Kapoor Destination Wedding)" 
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              required
              style={{ fontSize: '1.2rem', padding: '12px 16px' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '12px' }}>Clients</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="filter-group" style={{ margin: 0 }}>
                <label className="filter-label">Client Name*</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Enter client name" 
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  required
                />
              </div>
              <div className="filter-group" style={{ margin: 0 }}>
                <label className="filter-label">Client Phone*</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-tertiary)', padding: '0 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                    🇮🇳 +91
                  </div>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter phone number" 
                    value={clientPhoneInput.replace('+91 ', '')}
                    onChange={(e) => setClientPhoneInput('+91 ' + e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Shoot Schedule builder */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Shoot Schedule</h4>
            <button type="button" className="btn btn-secondary" onClick={handleAddShootRow} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              ➕ Add Shoot Schedule
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formShoots.map((shoot, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: '1.5', minWidth: '150px' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Shoot Title (e.g. Sangeet)" 
                      value={shoot.title}
                      onChange={(e) => handleShootRowChange(idx, 'title', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={shoot.date}
                      onChange={(e) => handleShootRowChange(idx, 'date', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: '0.8', minWidth: '80px' }}>
                    <input 
                      type="time" 
                      className="input-field" 
                      value={shoot.time}
                      onChange={(e) => handleShootRowChange(idx, 'time', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: '1.5', minWidth: '150px' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Venue location" 
                      value={shoot.venue}
                      onChange={(e) => handleShootRowChange(idx, 'venue', e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    onClick={() => handleRemoveShootRow(idx)}
                    disabled={formShoots.length <= 1}
                    title="Remove Shoot"
                  >
                    🗑️
                  </button>
                </div>

                {/* Nested Crew Slots Builder */}
                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>👥 Required Crew Roles</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleAddCrewSlot(idx)}
                    >
                      ➕ Add Crew Role
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shoot.crewSlots.map((slot, slotIdx) => (
                      <div key={slotIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <select 
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', height: 'auto' }}
                            value={slot.role}
                            onChange={(e) => handleCrewSlotRoleChange(idx, slotIdx, e.target.value as Specialization)}
                          >
                            <option value="Photographer">Photographer</option>
                            <option value="Videographer">Videographer</option>
                            <option value="Cinematographer">Cinematographer</option>
                            <option value="Candid">Candid Photographer</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', color: 'var(--danger)', fontSize: '0.8rem' }}
                          onClick={() => handleRemoveCrewSlot(idx, slotIdx)}
                          disabled={shoot.crewSlots.length <= 1}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Deliverables */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Deliverables</h4>
            <button type="button" className="btn btn-secondary" onClick={handleAddDelivRow} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              ➕ Add Deliverable
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formDeliverables.map((deliv, idx) => (
              <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ flex: '2', minWidth: '180px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Deliverable Name (e.g. Traditional Album)" 
                    value={deliv.name}
                    onChange={(e) => handleDelivRowChange(idx, 'name', e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: '1', minWidth: '130px' }}>
                  <select 
                    className="input-field"
                    value={deliv.packageType}
                    onChange={(e) => handleDelivRowChange(idx, 'packageType', e.target.value as 'Included' | 'Addon')}
                  >
                    <option value="Included">Included in Package</option>
                    <option value="Addon">Add-on Extra</option>
                  </select>
                </div>
                <div style={{ flex: '1', minWidth: '110px' }}>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={deliv.deadline}
                    onChange={(e) => handleDelivRowChange(idx, 'deadline', e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: '0.8', minWidth: '100px' }}>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Cost (₹)" 
                    value={deliv.cost || 0}
                    onChange={(e) => handleDelivRowChange(idx, 'cost', Number(e.target.value))}
                    required
                  />
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                  onClick={() => handleRemoveDelivRow(idx)}
                  disabled={formDeliverables.length <= 1}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Costs breakdown */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Project Cost Details</h4>
          <div style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', display: 'grid', gap: '16px' }}>
            <div className="filter-group" style={{ margin: 0 }}>
              <label className="filter-label">Client Billing (₹ Total Budget)</label>
              <input 
                type="number" 
                className="input-field" 
                value={projBilling}
                onChange={(e) => setProjBilling(Number(e.target.value))}
                required
              />
            </div>
            <div className="filter-group" style={{ margin: 0 }}>
              <label className="filter-label">Estimated Extra Expenses (₹ Gear, Travel)</label>
              <input 
                type="number" 
                className="input-field" 
                value={projExpenses}
                onChange={(e) => setProjExpenses(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', marginTop: '8px', width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Crew Cost: </span>
                <strong style={{ color: 'var(--warning)', fontSize: '1rem' }}>₹{estCrewCost.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Deliverables Cost: </span>
                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>₹{estDeliverablesCost.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Aggregated Expenses: </span>
                <strong style={{ color: 'var(--danger)', fontSize: '1rem' }}>₹{projExpenses.toLocaleString()}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. Net Margin:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: estProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                ₹{estProfit.toLocaleString()} ({estProfitPercent}%)
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {!isCreateProjectOpen && (
        <div className="role-switcher-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            type="button"
            className={`role-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            📂 Projects Hub
          </button>
          <button
            type="button"
            className={`role-tab ${activeTab === 'allocation' ? 'active' : ''}`}
            onClick={() => setActiveTab('allocation')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            👥 Team Allocation
          </button>
          <button
            type="button"
            className={`role-tab ${activeTab === 'galleries' ? 'active' : ''}`}
            onClick={() => setActiveTab('galleries')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            📸 Galleries & Photos
          </button>
        </div>
      )}

      {isCreateProjectOpen ? (
        renderCreateProjectForm()
      ) : activeTab === 'projects' ? (
        renderProjectsDashboard()
      ) : activeTab === 'allocation' ? (
        renderTeamAllocation()
      ) : (
        renderGalleriesDashboard()
      )}

      {/* Photo Management Modal */}
      {photoManagingProject && (
        <div className="modal-overlay" onClick={() => setPhotoManagingProject(null)}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>📸 Manage Photo Gallery & AI Scan</h2>
              <button className="modal-close" onClick={() => setPhotoManagingProject(null)}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
              
              {/* Google Drive Connection Section */}
              <div className="card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', padding: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔗</span> Connect Google Drive Assets
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Link a Google Drive folder. Raw uploaded wedding images will sync into our system for AI face search and client album selection.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={googleDriveInput}
                    onChange={(e) => setGoogleDriveInput(e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    onClick={() => setGoogleDriveInput(`https://drive.google.com/drive/folders/mock_${photoManagingProject.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`)}
                  >
                    Auto-Generate Link
                  </button>
                </div>
              </div>

              {/* Photo Uploader Section */}
              <div 
                style={{ 
                  background: 'rgba(15, 23, 42, 0.3)', 
                  border: '2px dashed var(--card-border)', 
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                {isUploading ? (
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📤</div>
                    <div style={{ color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                      {uploadStepMsg}
                    </div>
                    <div className="progress-bar-bg" style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)', overflow: 'hidden', maxWidth: '300px', margin: '12px auto 6px auto' }}>
                      <div className="progress-bar-fill" style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{uploadProgress}% Uploaded</span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📸</span>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>Upload Photos & Deliverables</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '480px', margin: '0 auto 16px auto' }}>
                      Connect a real Google Drive folder above. Then select local image files to upload for biometric scanning and portal favorites selection.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Function Category:</span>
                      <select
                        className="input-field"
                        style={{ width: '150px', padding: '6px 10px', fontSize: '0.8rem' }}
                        value={selectedUploadCategory}
                        onChange={(e) => setSelectedUploadCategory(e.target.value as any)}
                      >
                        <option value="Mehendi">Mehendi</option>
                        <option value="Haldi">Haldi</option>
                        <option value="Wedding">Wedding</option>
                      </select>
                    </div>

                    <input 
                      type="file" 
                      id="real-file-picker" 
                      multiple 
                      accept="image/*" 
                      onChange={handleRealLocalFilesUpload} 
                      style={{ display: 'none' }} 
                    />

                    <div 
                      onClick={() => document.getElementById('real-file-picker')?.click()}
                      style={{
                        padding: '20px',
                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                        marginBottom: '16px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    >
                      <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '6px' }}>📁</span>
                      <strong style={{ color: 'var(--primary-light)', fontSize: '0.9rem' }}>Choose Real Photo Files from Computer</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                        Supports JPG, PNG, WEBP (Loads previews instantly)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR</span>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        onClick={handleSimulatePhotoUpload}
                      >
                        🚀 Populate Seed Photos (Sandbox)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time scanning animation overlay */}
              {isScanningFaces && (
                <div 
                  style={{
                    background: 'rgba(9, 13, 20, 0.9)',
                    border: '1px solid var(--info)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '4px', 
                      background: '#06b6d4',
                      boxShadow: '0 0 10px #06b6d4', 
                      animation: 'scan-laser 2s infinite ease-in-out' 
                    }}
                  />
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
                  <h4 style={{ color: 'var(--info)', marginBottom: '4px' }}>AI Biometric Facial Recognition Scanning...</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                    Mapping facial structures & tagging guest profiles across {(photoManagingProject.uploadedPhotos || []).length} photos...
                  </p>
                  <div className="progress-bar-bg" style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden', maxWidth: '360px', margin: '0 auto 6px auto' }}>
                    <div className="progress-bar-fill" style={{ width: `${scanningProgress}%`, height: '100%', background: 'var(--info)', transition: 'width 0.1s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Progress: {scanningProgress}% &bull; Matches Detected: {scanFaceCount}
                  </div>
                </div>
              )}

              {/* Uploaded Gallery Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Uploaded Photos ({(photoManagingProject.uploadedPhotos || []).length})
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {photoManagingProject.facesScanned ? (
                      <span className="badge badge-confirmed" style={{ fontSize: '0.75rem' }}>
                        ⚡ AI Scan Complete
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', borderColor: 'var(--info)', color: 'var(--info)' }}
                        onClick={handleRunFaceScanning}
                        disabled={isScanningFaces || (photoManagingProject.uploadedPhotos || []).length === 0}
                      >
                        ⚡ Run AI Face Scanning
                      </button>
                    )}
                  </div>
                </div>

                {(photoManagingProject.uploadedPhotos || []).length === 0 ? (
                  <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed var(--card-border)' }}>
                    No photos uploaded yet. Link Drive and upload simulated photos above.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
                    {(photoManagingProject.uploadedPhotos || []).map((photo, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--card-border)', height: '90px' }}>
                        <img src={photo.url} alt="Uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '0.6rem', padding: '1px 4px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '3px' }}>
                          {photo.category}
                        </span>
                        {photo.detectedFaces && photo.detectedFaces.length > 0 && photoManagingProject.facesScanned && (
                          <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '0.6rem', padding: '1px 4px', background: 'rgba(6, 182, 212, 0.8)', color: '#fff', borderRadius: '3px' }} title="Faces Scanned">
                            👤 {photo.detectedFaces.length}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="modal-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--bg-secondary)', zIndex: 10, display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--card-border)' }}>
              <button className="btn btn-secondary" onClick={() => setPhotoManagingProject(null)}>
                Cancel
              </button>

              <button
                className="btn btn-primary"
                onClick={handlePublishGallery}
                disabled={(photoManagingProject.uploadedPhotos || []).length === 0}
                style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
              >
                ✨ Publish Client Portal Gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Freelancer Profile Modal */}
      {selectedFreelancer && (
        <div className="modal-overlay" onClick={() => setSelectedFreelancer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedFreelancer.name}'s Profile</h2>
              <button className="modal-close" onClick={() => setSelectedFreelancer(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <img src={selectedFreelancer.avatarUrl} alt={selectedFreelancer.name} className="avatar" style={{ width: '80px', height: '80px' }} />
                <div>
                  <h3>{selectedFreelancer.name}</h3>
                  <span className="badge badge-specialization" style={{ marginTop: '6px', display: 'inline-block' }}>
                    {selectedFreelancer.specialization}
                  </span>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                    📍 {selectedFreelancer.location} &bull; ₹{selectedFreelancer.ratePerDay?.toLocaleString()}/day
                  </div>
                </div>
              </div>

              <div>
                <h4 className="filter-label" style={{ marginBottom: '8px' }}>About</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>{selectedFreelancer.bio}</p>
              </div>

              <div>
                <h4 className="filter-label">Portfolio & Socials</h4>
                <div className="portfolio-grid">
                  {selectedFreelancer.portfolioLinks?.map((link, idx) => {
                    if (!link || typeof link !== 'string') return null;
                    const cleanLink = link.replace('https://', '').replace('http://', '');
                    return (
                      <a key={idx} href={link} target="_blank" rel="noreferrer" className="portfolio-link">
                        {cleanLink}
                      </a>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="filter-label">Availability & Booking Calendar</h4>
                {allocationModalSlot && isSlotLocked(allocationModalSlot.slot.id) && (
                  <div style={{ 
                    color: 'var(--warning)', 
                    fontSize: '0.8rem', 
                    padding: '10px', 
                    background: 'var(--warning-light)', 
                    border: '1px solid var(--warning-border)', 
                    borderRadius: '6px', 
                    marginBottom: '12px' 
                  }}>
                    ⚠️ <strong>Exclusivity Lock:</strong> This crew slot is currently locked by a pending request.
                  </div>
                )}
                {renderProfileCalendar(selectedFreelancer.id)}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedFreelancer(null)}>Close</button>
              {allocationModalSlot && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setAllocationRequestModal({ freelancer: selectedFreelancer, shoot: allocationModalSlot.shoot, slot: allocationModalSlot.slot });
                    setSelectedFreelancer(null);
                  }}
                  disabled={isSlotLocked(allocationModalSlot.slot.id)}
                  title={isSlotLocked(allocationModalSlot.slot.id) ? `This slot already has a pending booking request.` : undefined}
                >
                  {isSlotLocked(allocationModalSlot.slot.id) ? `Locked (Pending Request)` : 'Request Booking for this Slot'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Find Crew Modal */}
      {allocationModalSlot && (
        <div className="modal-overlay" onClick={() => setAllocationModalSlot(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>🔍 Find Crew for {allocationModalSlot.shoot.title}</h2>
              <button className="modal-close" onClick={() => setAllocationModalSlot(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                Event: <strong>{allocationModalSlot.shoot.title}</strong> &bull; Date: <strong>{allocationModalSlot.shoot.date}</strong> &bull; Role Required: <span className="badge badge-specialization" style={{ fontSize: '0.65rem' }}>{allocationModalSlot.slot.role}</span>
              </div>

              <div className="filter-group" style={{ margin: 0 }}>
                <label className="filter-label">Filter by Location</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Goa, Mumbai, Delhi"
                  value={allocationSearchLocation}
                  onChange={(e) => setAllocationSearchLocation(e.target.value)}
                />
              </div>

              {(() => {
                const availableFreelancers = getAvailableFreelancers({
                  startDate: allocationModalSlot.shoot.date,
                  endDate: allocationModalSlot.shoot.date,
                  location: allocationSearchLocation || undefined,
                  specialization: allocationModalSlot.slot.role
                });

                if (availableFreelancers.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: '20px 0' }}>
                      <span className="empty-state-icon">🔍</span>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No available {allocationModalSlot.slot.role}s found for this date/location.</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {availableFreelancers.map(f => (
                      <div key={f.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <img src={f.avatarUrl} alt={f.name} className="avatar" style={{ width: '40px', height: '40px' }} />
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{f.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {f.location} &bull; ₹{f.ratePerDay?.toLocaleString()}/day</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => setSelectedFreelancer(f)}
                          >
                            View Profile
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setAllocationRequestModal({ freelancer: f, shoot: allocationModalSlot.shoot, slot: allocationModalSlot.slot });
                            }}
                          >
                            Request Booking
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAllocationModalSlot(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Booking Request Modal */}
      {allocationRequestModal && (
        <div className="modal-overlay" onClick={() => setAllocationRequestModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Send Booking Request</h2>
              <button className="modal-close" onClick={() => setAllocationRequestModal(null)}>&times;</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              try {
                sendBookingRequest({
                  companyId: currentCompany.id,
                  companyName: currentCompany.name,
                  freelancerId: allocationRequestModal.freelancer.id,
                  freelancerName: allocationRequestModal.freelancer.name,
                  projectName: projectsList.find(p => p.id === allocationRequestModal.shoot.projectId)?.name || 'Wedding Event',
                  details: requestDetailsInput,
                  budget: requestBudgetInput,
                  startDate: allocationRequestModal.shoot.date,
                  endDate: allocationRequestModal.shoot.date,
                  shootId: allocationRequestModal.shoot.id,
                  slotId: allocationRequestModal.slot.id
                });
                
                setRequestDetailsInput('');
                setRequestBudgetInput(5000);
                setAllocationRequestModal(null);
                setAllocationModalSlot(null);
                onStateChange();
              } catch (err: any) {
                alert(err.message || 'An error occurred.');
              }
            }}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Booking request to <strong>{allocationRequestModal.freelancer.name}</strong> for:
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
                    📅 {allocationRequestModal.shoot.date} ({allocationRequestModal.shoot.title})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Role: {allocationRequestModal.slot.role}
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Budget (₹ Offer Total)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={requestBudgetInput} 
                    onChange={(e) => setRequestBudgetInput(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Project Details / Shoot Schedule Brief</label>
                  <textarea 
                    className="input-field" 
                    rows={4}
                    placeholder="Provide details about timeline, attire, style, gear required..."
                    value={requestDetailsInput} 
                    onChange={(e) => setRequestDetailsInput(e.target.value)}
                    required
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Slot-Level Exclusivity Lock:</strong> Sending this proposal blocks this crew slot. You cannot request another creator for this slot until this proposal is accepted, declined, or withdrawn.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAllocationRequestModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success">Submit Proposal</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Company Reviews Modal */}
      {isCompanyReviewsOpen && (
        <div className="modal-overlay" onClick={() => setIsCompanyReviewsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>My Studio Trust Reviews</h2>
              <button className="modal-close" onClick={() => setIsCompanyReviewsOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>{currentCompany.name}</h3>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {currentCompany.companyBadges?.map(badge => (
                      <span key={badge} className="badge trust-badge">{badge}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="rating-stars" style={{ fontSize: '1.2rem' }}>
                    ⭐ {currentCompany.rating}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Based on {currentCompany.reviewsCount} reviews
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--bg-tertiary)', paddingTop: '16px' }}>
                <h4 className="filter-label" style={{ marginBottom: '12px' }}>Freelancer Feedback Log</h4>
                
                {clientReviews.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No feedback left yet. Completed projects will list reviews here.</span>
                ) : (
                  <div className="reviews-list-container">
                    {clientReviews.map((rev) => (
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
              <button className="btn btn-secondary" onClick={() => setIsCompanyReviewsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Project-wide Find Crew Modal */}
      {projectAllocationModalProj && (
        <div className="modal-overlay" onClick={() => setProjectAllocationModalProj(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <h2>🔗 Project Crew Matching: {projectAllocationModalProj.name}</h2>
              <button type="button" className="modal-close" onClick={() => setProjectAllocationModalProj(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px' }}>
                <div className="filter-group" style={{ margin: 0 }}>
                  <label className="filter-label">1. Choose Specialization Role</label>
                  <select 
                    className="input-field"
                    value={projectAllocationRole}
                    onChange={(e) => setProjectAllocationRole(e.target.value as Specialization)}
                  >
                    <option value="Photographer">Photographer</option>
                    <option value="Videographer">Videographer</option>
                    <option value="Cinematographer">Cinematographer</option>
                    <option value="Candid">Candid Photographer</option>
                  </select>
                </div>

                <div className="filter-group" style={{ margin: 0 }}>
                  <label className="filter-label">2. Filter by Location</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Delhi, Mumbai, Goa"
                    value={projectAllocationSearchLocation}
                    onChange={(e) => setProjectAllocationSearchLocation(e.target.value)}
                  />
                </div>
              </div>

              {(() => {
                const projShoots = shootsList.filter(s => s.projectId === projectAllocationModalProj.id);
                const matchingSlots = projShoots.reduce((acc, shoot) => {
                  const slots = (shoot.crewSlots || []).filter(slot => slot.role === projectAllocationRole && !slot.allocatedFreelancerId);
                  slots.forEach(slot => {
                    acc.push({
                      shootId: shoot.id,
                      slotId: slot.id,
                      date: shoot.date,
                      title: shoot.title
                    });
                  });
                  return acc;
                }, [] as { shootId: string; slotId: string; date: string; title: string }[]);

                if (matchingSlots.length === 0) {
                  return (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)', marginTop: '16px' }}>
                      ℹ️ No unallocated <strong>{projectAllocationRole}</strong> slots found in this project.
                    </div>
                  );
                }

                // Find freelancers who are available on ALL of these dates
                const datesToBook = matchingSlots.map(s => s.date);
                const availableFreelancers = getAvailableFreelancers({
                  location: projectAllocationSearchLocation || undefined,
                  specialization: projectAllocationRole
                }).filter(f => {
                  const blocks = getCalendarBlocks().filter(b => b.freelancerId === f.id);
                  const hasConflict = datesToBook.some(date => 
                    blocks.some(b => b.date === date)
                  );
                  return !hasConflict;
                });

                return (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
                      📋 Project needs <strong>{projectAllocationRole}</strong> for <strong>{matchingSlots.length} shoot(s)</strong>:
                      <div style={{ fontWeight: 'bold', marginTop: '6px' }}>
                        {matchingSlots.map(s => `${s.title} (${s.date})`).join(', ')}
                      </div>
                    </div>

                    <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Available candidates free on all dates:</h4>
                    {availableFreelancers.length === 0 ? (
                      <div className="empty-state" style={{ padding: '20px 0' }}>
                        <span className="empty-state-icon">🔍</span>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No {projectAllocationRole}s are available for all {matchingSlots.length} dates in the selected location.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                        {availableFreelancers.map(f => (
                          <div key={f.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <img src={f.avatarUrl} alt={f.name} className="avatar" style={{ width: '40px', height: '40px' }} />
                              <div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{f.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {f.location} &bull; ₹{f.ratePerDay?.toLocaleString()}/day</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                type="button" 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => setSelectedFreelancer(f)}
                              >
                                View Profile
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-primary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setProjectAllocationRequestModal({
                                    freelancer: f,
                                    project: projectAllocationModalProj,
                                    role: projectAllocationRole,
                                    matchingSlots
                                  });
                                }}
                              >
                                Request for Entire Project
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setProjectAllocationModalProj(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Project-wide Booking Request Modal */}
      {projectAllocationRequestModal && (
        <div className="modal-overlay" onClick={() => setProjectAllocationRequestModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Send Project Booking Request</h2>
              <button type="button" className="modal-close" onClick={() => setProjectAllocationRequestModal(null)}>&times;</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              try {
                sendProjectBookingRequests({
                  companyId: currentCompany.id,
                  companyName: currentCompany.name,
                  freelancerId: projectAllocationRequestModal.freelancer.id,
                  freelancerName: projectAllocationRequestModal.freelancer.name,
                  projectName: projectAllocationRequestModal.project.name,
                  details: requestDetailsInput,
                  dailyBudget: requestBudgetInput,
                  slots: projectAllocationRequestModal.matchingSlots
                });
                
                setRequestDetailsInput('');
                setRequestBudgetInput(5000);
                setProjectAllocationRequestModal(null);
                setProjectAllocationModalProj(null);
                onStateChange();
              } catch (err: any) {
                alert(err.message || 'An error occurred.');
              }
            }}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Booking request to <strong>{projectAllocationRequestModal.freelancer.name}</strong> for project:
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px', fontSize: '1rem' }}>
                    📂 {projectAllocationRequestModal.project.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Role: {projectAllocationRequestModal.role} &bull; Shoots: {projectAllocationRequestModal.matchingSlots.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px' }}>
                    {projectAllocationRequestModal.matchingSlots.map(s => `${s.title} (${s.date})`).join(', ')}
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Daily Budget Rate (₹ per Shoot/Day)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={requestBudgetInput} 
                    onChange={(e) => setRequestBudgetInput(Number(e.target.value))}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Total Estimated Offer: <strong>₹{(requestBudgetInput * new Set(projectAllocationRequestModal.matchingSlots.map(s => s.date)).size).toLocaleString()}</strong> for {new Set(projectAllocationRequestModal.matchingSlots.map(s => s.date)).size} shoot day(s)
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Project Details / Collective Shoot Brief</label>
                  <textarea 
                    className="input-field" 
                    rows={4}
                    placeholder="Provide details about the overall project requirements..."
                    value={requestDetailsInput} 
                    onChange={(e) => setRequestDetailsInput(e.target.value)}
                    required
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Project-Wide Exclusivity Lock:</strong> Sending this collective request blocks all required crew slots in this project. You cannot request another creator for these slots until this request is resolved.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setProjectAllocationRequestModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success">Send Project Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

