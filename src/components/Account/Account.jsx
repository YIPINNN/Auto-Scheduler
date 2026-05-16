import React, { useState, useEffect } from 'react';
import { Mail, Shield, LogOut, Key, Briefcase, Users, Cpu, Activity, CheckCircle, Clock, RefreshCw, Layers } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Account.css';

const Account = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  // --- REAL-TIME DATA TELEMETRY LOGIC ---
  const fetchUserProfile = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      // Single Source of Truth: Lookup directly via unique employeeID 
      const { data, error } = await supabase
        .from('Technician')
        .select('*')
        .eq('employeeID', user.employeeID)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Telemetry Retrieval Exception:", err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Synchronized Engine Streaming Loop
  useEffect(() => {
    if (user?.employeeID) {
      // First load utilizes standard loader animation graphic
      fetchUserProfile(true);

      // Background telemetry loop stream updates profiles quietly every 8 seconds
      const backgroundTelemetryStream = setInterval(() => {
        fetchUserProfile(false);
      }, 8000);

      return () => clearInterval(backgroundTelemetryStream);
    }
  }, [user]);

  // --- DYNAMIC SLIDER TOGGLE HANDLER ---
  const handleToggleAvailability = async () => {
    if (!profile || updatingAvailability) return;
    setUpdatingAvailability(true);
    
    const nextAvailabilityState = !profile.isAvailable;
    
    try {
      const { error } = await supabase
        .from('Technician')
        .update({ isAvailable: nextAvailabilityState })
        .eq('employeeID', profile.employeeID);

      if (error) throw error;
      
      // Update state locally for immediate tactical UI confirmation
      setProfile(prev => ({ ...prev, isAvailable: nextAvailabilityState }));
    } catch (err) {
      alert("System synchronization failure: " + err.message);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  // Privilege Node Evaluations (Admin: 5013 | Manager: 5002)
  const isManager = profile?.jobTitleID === 5002 || user.role === 'Manager';
  const isAdmin = profile?.jobTitleID === 5103 || profile?.jobTitleID === 5013 || user.role === 'Administrator';

  // Dynamic Label Generation
  const getRoleLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isManager) return 'Manager';
    return profile?.jobTitle || 'Technician';
  };

  const getRoleTagClass = () => {
    if (isAdmin) return 'tag-manager'; // Reuses your premium green visual framework
    if (isManager) return 'tag-manager'; 
    return 'tag-employee'; // Blue framework
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Account Settings</h1>
          <p>Personnel credentials and live dispatch telemetry desk</p>
        </div>
      </header>

      <div className="account-layout-grid">
        {/* --- LEFT DESK PANEL: PROFILE OVERVIEW --- */}
        <div className="glass-card profile-card">
          <div className="avatar-huge">
            {profile?.fullName ? profile.fullName[0] : (user.name ? user.name[0] : 'U')}
          </div>
          <h2>{profile?.fullName || user.name}</h2>
          <span className={`role-tag ${getRoleTagClass()}`}>
            {getRoleLabel()}
          </span>
          
          <div className="info-list">
            <div className="info-item">
              <Mail size={16} /> 
              <div className="info-text">
                <small>Email Address</small>
                <span>{profile?.email || user.email}</span>
              </div>
            </div>
            <div className="info-item">
              <Key size={16} /> 
              <div className="info-text">
                <small>Employee Reference ID</small>
                <span>{user.employeeID}</span>
              </div>
            </div>
            <div className="info-item">
              <Shield size={16} /> 
              <div className="info-text">
                <small>Privilege Classification</small>
                <span>
                  {isAdmin ? 'Tier-1 Root Security Node' : isManager ? 'Tier-1 Manager' : 'Tier-2 Field Operational Technician'}
                </span>
              </div>
            </div>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={16} /> TERMINATE ACCESS SESSION
          </button>
        </div>

        {/* --- RIGHT DESK PANEL: REAL-TIME TELEMETRY STATS --- */}
        <div className="glass-card dynamic-view-card">
          {loading ? (
            <div className="account-loader">
              <RefreshCw size={24} className="spin" />
              <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem' }}>Syncing telemetry streams...</p>
            </div>
          ) : (
            <div className="role-view-content animate-fade">
              <div className="title-group-account">
                <Activity size={18} className={profile?.isAvailable ? "icon-glow-green" : "icon-glow-red"} />
                <h3>Live System Status Core Matrix</h3>
              </div>

              {/* AUTOMATED WORKLOAD TELEMETRY QUAD-GRID */}
              <div className="employee-meta-grid">
                <div className="meta-card">
                  <Layers size={16} />
                  <div>
                    <small>Target Assignment Module</small>
                    <p>{profile?.targetGroup || "Admin Infrastructure"}</p>
                  </div>
                </div>
                <div className="meta-card">
                  <Briefcase size={16} />
                  <div>
                    <small>Live Task Workload Queue</small>
                    <p>{profile?.workload !== undefined ? `${profile.workload} Assigned Tickets` : "0 Active"}</p>
                  </div>
                </div>
                <div className="meta-card">
                  <Cpu size={16} />
                  <div>
                    <small>Job Configuration ID</small>
                    <p>{profile?.jobTitleID || "5013"}</p>
                  </div>
                </div>
                <div className="meta-card">
                  <Clock size={16} />
                  <div>
                    <small>Registry Startup Date</small>
                    <p>{profile?.startDate ? new Date(profile.startDate).toLocaleDateString() : "Operational"}</p>
                  </div>
                </div>
              </div>

              {/* DYNAMIC DISPATCH DISPATCH AVAILABILITY SWITCH CONTROL */}
              <div className="availability-dashboard-card">
                <div className="availability-card-meta">
                  <h4>Dispatch Availability Status Node</h4>
                  <p>Toggle operational profile availability. Changing this status dynamically informs the algorithmic assignment arrays across the scheduling registries.</p>
                </div>
                <div className="availability-action-row">
                  <div className={`status-badge-indicator ${profile?.isAvailable ? 'online' : 'offline'}`}>
                    {profile?.isAvailable ? "ONLINE & READY FOR DISPATCH" : "OFF-DUTY / SYSTEM INACTIVE"}
                  </div>
                  <label className="switch account-toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={profile?.isAvailable ?? false} 
                      onChange={handleToggleAvailability}
                      disabled={updatingAvailability}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Account;