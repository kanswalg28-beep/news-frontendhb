import React, { useState, useEffect } from 'react';
import type { Project, GalleryPhoto } from '../types';
import { getProjects, submitAlbumSelection, addNotificationLog } from '../db';

interface ClientPortalProps {
  projectId: string;
  onStateChange: () => void;
}

const MOCK_FACE_DETAILS = [
  { id: 'face_bride', name: 'Bride', avatar: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' },
  { id: 'face_groom', name: 'Groom', avatar: 'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' },
  { id: 'face_sister1', name: 'Sister', avatar: 'https://images.unsplash.com/photo-1610030469668-93535c17b6b3?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' },
  { id: 'face_uncle1', name: 'Uncle', avatar: 'https://images.unsplash.com/photo-1607190074257-dd4b7af0309f?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' },
  { id: 'face_friend1', name: 'Friend 1', avatar: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' },
  { id: 'face_friend2', name: 'Friend 2', avatar: 'https://images.unsplash.com/photo-1583939411023-14785f74ff08?w=150&h=150&auto=format&fit=crop&q=80&crop=entropy' }
];

export const ClientPortal: React.FC<ClientPortalProps> = ({ projectId, onStateChange }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Mehendi' | 'Haldi' | 'Wedding'>('All');
  const [selectedFaceFilter, setSelectedFaceFilter] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);
  
  // Simulated Face Recognition Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFaceId, setScannedFaceId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch project on load / trigger changes
  useEffect(() => {
    const projs = getProjects();
    const p = projs.find(proj => proj.id === projectId);
    if (p) {
      setProject(p);
      // Populate selected album photos from DB
      const selected = (p.uploadedPhotos || [])
        .filter(photo => photo.selectedForAlbum)
        .map(photo => photo.id);
      setSelectedPhotoIds(selected);
    }
  }, [projectId]);

  if (!project) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Gallery Not Found</h2>
        <p>Please check the project ID or speak to your wedding production studio.</p>
      </div>
    );
  }

  const photos = project.uploadedPhotos || [];
  const galleryPublished = project.galleryPublished;

  // Filter photos based on category & face selection
  const filteredPhotos = photos.filter(photo => {
    const matchesCategory = selectedCategory === 'All' || photo.category === selectedCategory;
    const matchesFace = !selectedFaceFilter || (photo.detectedFaces || []).includes(selectedFaceFilter);
    return matchesCategory && matchesFace;
  });

  // Handle Heart / Toggle selection
  const handleToggleSelection = (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (project.albumSelectionSubmitted) return;

    setSelectedPhotoIds(prev => {
      const next = prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId];
      return next;
    });
  };

  // Submit Album Selection
  const handleSubmitAlbum = () => {
    if (selectedPhotoIds.length === 0) {
      alert('Please select at least 1 photo for your printed album.');
      return;
    }

    if (confirm(`Submit these ${selectedPhotoIds.length} photos to the studio for your printed album? This will finalize your selection.`)) {
      submitAlbumSelection(project.id, selectedPhotoIds);
      
      // Send simulated WhatsApp notification log to Company view
      addNotificationLog({
        recipientName: 'WedLuxe Productions',
        type: 'WhatsApp',
        message: `📲 WhatsApp Outgoing: Client ${project.clientName} has submitted ${selectedPhotoIds.length} selections for their Premium Wedding Album. Deliverable status automatically updated to 'Review'!`
      });

      // Reload project state
      const projs = getProjects();
      const updatedProj = projs.find(p => p.id === project.id);
      if (updatedProj) {
        setProject(updatedProj);
      }
      
      // Broadcast update
      onStateChange();
      
      // Dispatch custom notification event for Toast alerts in app
      window.dispatchEvent(
        new CustomEvent('wedmatch-notification', {
          detail: { message: `🎉 Album selection submitted successfully! Deliverable status updated.` }
        })
      );
    }
  };

  // Simulate Guest Selfie Face Scan
  const triggerSelfieScan = () => {
    setIsScanning(true);
    setUploadProgress(0);
    setScannedFaceId(null);
    setSelectedFaceFilter(null);

    // Step 1: Simulate photo upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 120);

    // Step 2: Run laser scan animation and set match
    setTimeout(() => {
      setIsScanning(false);
      // Let's match Amit / Uncle or Sister face randomly
      const matchingFaces = ['face_sister1', 'face_uncle1', 'face_friend2'];
      const randomFace = matchingFaces[Math.floor(Math.random() * matchingFaces.length)];
      const faceName = MOCK_FACE_DETAILS.find(f => f.id === randomFace)?.name || 'Guest';

      setScannedFaceId(randomFace);
      setSelectedFaceFilter(randomFace);

      // Toast alert
      window.dispatchEvent(
        new CustomEvent('wedmatch-notification', {
          detail: { message: `⚡ AI Face Match found! Recognized as: ${faceName}. Filtering your photos.` }
        })
      );
    }, 2500);
  };

  const clearFilters = () => {
    setSelectedFaceFilter(null);
    setScannedFaceId(null);
  };

  return (
    <div className="client-portal-wrapper" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Wedding Header Banner */}
      <div 
        className="wedding-hero-banner"
        style={{
          position: 'relative',
          height: '340px',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
          marginBottom: '30px',
          backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(18, 24, 36, 0.95)), url('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1600&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '40px',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--glass-shadow)'
        }}
      >
        <div style={{ zIndex: 2 }}>
          <span className="badge badge-accent" style={{ fontSize: '0.8rem', padding: '4px 12px', marginBottom: '12px', display: 'inline-block' }}>
            ✨ Wedding Gallery Portal
          </span>
          <h1 
            style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '2.8rem', 
              color: 'var(--text-primary)', 
              margin: '0 0 8px 0', 
              letterSpacing: '-0.02em',
              fontWeight: 700 
            }}
          >
            {project.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0', fontSize: '1.1rem', maxWidth: '600px' }}>
            Welcome to your digital memories hub. View, select album favorites, download in high resolution, and use AI face search to find your own pictures.
          </p>
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span>📅 {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' })}</span>
            <span>📍 Mumbai Palace & Resort</span>
            <span>👤 Client: {project.clientName}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Portal */}
      {!galleryPublished ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-lg)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚧</div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '8px' }}>Gallery in Post-Production</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 20px auto' }}>
            The production crew is currently editing, cataloging, and running face tagging. Once the gallery is published, you will receive your live access link!
          </p>
          {project.googleDriveLink && (
            <a 
              href={project.googleDriveLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              🔗 View Raw Photos on Google Drive
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          
          {/* AI Face Recognition Panel */}
          <div 
            className="card" 
            style={{ 
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.7))',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--border-radius-md)',
              padding: '24px',
              boxShadow: 'var(--glass-shadow)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <span>🔍</span> AI Face Search & Guest Recognition
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px 0' }}>
                  Click a recognized guest thumbnail to show only photos they appear in, or upload a guest selfie to auto-scan and search.
                </p>
                
                {/* Detected Faces Carousel/Row */}
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {MOCK_FACE_DETAILS.map(face => {
                    const isSelected = selectedFaceFilter === face.id;
                    const count = photos.filter(p => (p.detectedFaces || []).includes(face.id)).length;
                    return (
                      <button
                        key={face.id}
                        onClick={() => setSelectedFaceFilter(isSelected ? null : face.id)}
                        style={{
                          background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                          borderRadius: '50px',
                          padding: '6px 12px 6px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          transition: 'var(--transition-fast)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <img 
                          src={face.avatar} 
                          alt={face.name} 
                          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{face.name} ({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Guest Selfie Scanning Button & Box */}
              <div 
                style={{ 
                  background: 'rgba(15, 23, 42, 0.4)', 
                  border: '1px dashed var(--card-border)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  minWidth: '260px', 
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isScanning ? (
                  <div>
                    {/* Laser Scanner animation */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '4px', 
                        background: '#06b6d4',
                        boxShadow: '0 0 10px #06b6d4, 0 0 20px #06b6d4', 
                        animation: 'scan-laser 1.5s infinite ease-in-out',
                        zIndex: 10 
                      }}
                    />
                    <style>{`
                      @keyframes scan-laser {
                        0% { top: 0%; }
                        50% { top: 100%; }
                        100% { top: 0%; }
                      }
                    `}</style>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🤖</div>
                    <div style={{ color: 'var(--info)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>AI Facial Feature Detection...</div>
                    <div className="progress-bar-bg" style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      <div className="progress-bar-fill" style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--info)', transition: 'width 0.1s ease' }} />
                    </div>
                  </div>
                ) : scannedFaceId ? (
                  <div>
                    <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                      🟢 Face Matched Successfully!
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <img 
                        src={MOCK_FACE_DETAILS.find(f => f.id === scannedFaceId)?.avatar} 
                        alt="Match" 
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--success)' }}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {MOCK_FACE_DETAILS.find(f => f.id === scannedFaceId)?.name}
                      </span>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={clearFilters}>
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '4px' }}>📸</span>
                    <button 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.8rem', padding: '6px 12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--info)' }}
                      onClick={triggerSelfieScan}
                    >
                      <span>⚡</span> Upload Selfie (Simulate Face Scan)
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                      Locates your photos instantly using biometric matching
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Indicators */}
            {(selectedFaceFilter || selectedCategory !== 'All') && (
              <div style={{ borderTop: '1px solid var(--card-border)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Filters:</span>
                  {selectedCategory !== 'All' && (
                    <span className="badge badge-specialization" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)' }}>
                      Category: {selectedCategory}
                    </span>
                  )}
                  {selectedFaceFilter && (
                    <span className="badge badge-specialization" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--info)' }}>
                      👤 Face: {MOCK_FACE_DETAILS.find(f => f.id === selectedFaceFilter)?.name}
                    </span>
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ({filteredPhotos.length} matches found)
                  </span>
                </div>
                <button 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => {
                    setSelectedCategory('All');
                    clearFilters();
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* Album Selection Info Bar */}
          <div 
            className="album-selection-bar card"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08))',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--border-radius-md)',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '2rem' }}>📖</div>
              <div>
                <h4 style={{ margin: '0 0 2px 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                  Printed Album Favorites Selector
                </h4>
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {project.albumSelectionSubmitted 
                    ? `Selection finalized and locked. Selected ${selectedPhotoIds.length} photos.` 
                    : `Heart photos in the gallery to choose which ones you want printed in your Premium Wedding Album.`
                  }
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Favorites Count</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{selectedPhotoIds.length} Photos Chosen</strong>
              </div>

              {project.albumSelectionSubmitted ? (
                <div 
                  className="badge badge-confirmed" 
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>✓</span> Selection Submitted
                </div>
              ) : (
                <button 
                  className="btn btn-primary"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                  onClick={handleSubmitAlbum}
                  disabled={selectedPhotoIds.length === 0}
                >
                  Submit Selection to Studio
                </button>
              )}
            </div>
          </div>

          {/* Event Filter & Drive Download Tabs Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            {/* Event Tabs */}
            <div className="tab-container" style={{ display: 'inline-flex', padding: '4px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
              {(['All', 'Mehendi', 'Haldi', 'Wedding'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                    color: selectedCategory === cat ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    fontSize: '0.85rem'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Google Drive Link */}
            {project.googleDriveLink && (
              <a 
                href={project.googleDriveLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <span>💾</span> Download All Photos (Google Drive)
              </a>
            )}
          </div>

          {/* Photo Grid */}
          {filteredPhotos.length === 0 ? (
            <div className="card" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--card-border)' }}>
              <h3>No Photos Found</h3>
              <p>Try clearing your AI face search filter or selecting another event category.</p>
            </div>
          ) : (
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '20px' 
              }}
            >
              {filteredPhotos.map(photo => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    className="gallery-card"
                    onClick={() => setLightboxPhoto(photo)}
                    style={{
                      background: 'var(--card-bg)',
                      border: isSelected ? '2px solid var(--success)' : '1px solid var(--card-border)',
                      borderRadius: 'var(--border-radius-md)',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)',
                      boxShadow: 'var(--glass-shadow)'
                    }}
                  >
                    {/* Event Category Badge */}
                    <span 
                      className="badge badge-specialization" 
                      style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        left: '12px', 
                        zIndex: 5, 
                        background: 'rgba(15, 23, 42, 0.85)', 
                        backdropFilter: 'blur(4px)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {photo.category}
                    </span>

                    {/* Heart Checkbox Button */}
                    <button
                      onClick={(e) => handleToggleSelection(photo.id, e)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        zIndex: 5,
                        background: isSelected ? 'var(--success)' : 'rgba(15, 23, 42, 0.85)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'var(--transition-fast)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                      disabled={project.albumSelectionSubmitted}
                    >
                      {isSelected ? '❤️' : '🤍'}
                    </button>

                    {/* Image Area */}
                    <div style={{ overflow: 'hidden', height: '220px', position: 'relative' }}>
                      <img 
                        src={photo.url} 
                        alt={photo.category} 
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.5s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    </div>

                    {/* Photo Details/Faces list */}
                    <div style={{ padding: '12px', fontSize: '0.8rem', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Detected faces:</span>
                      {(photo.detectedFaces || []).length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                      ) : (
                        (photo.detectedFaces || []).map(faceId => {
                          const faceName = MOCK_FACE_DETAILS.find(f => f.id === faceId)?.name || 'Guest';
                          return (
                            <span 
                              key={faceId} 
                              style={{ 
                                background: 'rgba(255,255,255,0.06)', 
                                border: '1px solid var(--card-border)', 
                                borderRadius: '4px', 
                                padding: '1px 6px',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {faceName}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(9, 13, 20, 0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button 
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '2rem',
              cursor: 'pointer'
            }}
            onClick={() => setLightboxPhoto(null)}
          >
            &times;
          </button>

          <div 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '80%', 
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={lightboxPhoto.url} 
              alt={lightboxPhoto.category} 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '12px',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            />

            <div 
              style={{
                marginTop: '16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '10px',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                color: 'var(--text-primary)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <span className="badge badge-specialization">{lightboxPhoto.category}</span>
              
              <button
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: selectedPhotoIds.includes(lightboxPhoto.id) ? 'var(--success)' : 'var(--card-border)'
                }}
                disabled={project.albumSelectionSubmitted}
                onClick={() => handleToggleSelection(lightboxPhoto.id)}
              >
                {selectedPhotoIds.includes(lightboxPhoto.id) ? '❤️ Selected for Album' : '🤍 Add to Album selection'}
              </button>

              <div style={{ fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Appears:</span>
                {(lightboxPhoto.detectedFaces || []).map(faceId => {
                  const faceName = MOCK_FACE_DETAILS.find(f => f.id === faceId)?.name || 'Guest';
                  return (
                    <span 
                      key={faceId} 
                      style={{ 
                        background: 'rgba(255,255,255,0.06)', 
                        border: '1px solid var(--card-border)', 
                        borderRadius: '4px', 
                        padding: '1px 6px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {faceName}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
