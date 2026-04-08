import React, { useState, useEffect } from 'react';
import { Users, Mail, BadgeCheck, Search, X, Activity, Clock } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Technician.css';

const Technician = () => {
  const [technicians, setTechnicians] = useState([]);
  const [allTickets, setAllTickets] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [techRes, ticketRes] = await Promise.all([
        supabase.from('Technician').select('*'),
        supabase.from('Ticket').select('*').in('status', ['pending', 'attending'])
      ]);

      if (techRes.data) setTechnicians(techRes.data);
      if (ticketRes.data) setAllTickets(ticketRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  };

  const toggleAvailability = async (techId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('Technician')
        .update({ isAvailable: !currentStatus })
        .eq('employeeID', techId);

      if (error) throw error;
      
      setTechnicians(prev => prev.map(t => 
        t.employeeID === techId ? { ...t, isAvailable: !currentStatus } : t
      ));
    } catch (err) {
      alert("Error updating availability");
    }
  };

  const filteredTechs = technicians.filter(tech => {
    const name = tech.fullName || "";
    const id = tech.employeeID || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || id.toString().includes(searchTerm);
  });

  const getTechTickets = (techId) => {
    return allTickets.filter(t => String(t.attendById) === String(techId));
  };

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="loader-text">ACCESSING PERSONNEL REGISTRY...</div>
      </div>
    );
  }

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Technician Registry</h1>
          <p>Personnel Management System</p>
        </div>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search name or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="tech-grid">
        {filteredTechs.map((tech) => {
          const name = tech.fullName || "Unknown";
          const id = tech.employeeID || "N/A";
          const jobTitle = tech.jobTitle || "Technician";
          const group = tech.targetGroup || "General";
          const isAvailable = tech.isAvailable ?? true;
          
          const activeTickets = getTechTickets(id);
          const isAttending = activeTickets.some(t => t.status === 'attending');
          
          // Updated Status Logic to include "Unavailable"
          let status = "Available";
          if (!isAvailable) {
            status = "Unavailable";
          } else if (isAttending) {
            status = "Active";
          } else if (activeTickets.length > 0) {
            status = "Assigned";
          }

          return (
            <div key={id} className={`glass-card tech-card ${!isAvailable ? 'tech-card-off-duty' : ''}`}>
              <div className="dept-tag">{group}</div>

              <div className="tech-card-header">
                <div className="avatar-large">{name[0]}</div>
                
                <div className="availability-control">
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={isAvailable} 
                      onChange={() => toggleAvailability(id, isAvailable)}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span className="availability-text">
                    {isAvailable ? "ONLINE" : "OFF-DUTY"}
                  </span>
                </div>
              </div>
              
              <div className="tech-info">
                {/* Status indicator now turns grey/red for Unavailable */}
                <div className={`status-indicator ${status.toLowerCase()}`}>
                  {status}
                </div>
                
                <h3>{name}</h3>
                <p className="job-title">{jobTitle}</p>
                
                {/* We still show all their info so the manager can contact them if needed */}
                <div className="detail-row">
                  <BadgeCheck size={16} className={isAvailable ? "icon-green" : "icon-grey"} />
                  <span>Employee ID: <strong>{id}</strong></span>
                </div>
                
                {/* 3. In the "Queue" display row, just show the actual length*/}
                <div className="detail-row">
                  <Users size={16} className={isAvailable ? "icon-blue" : "icon-grey"} />
                  {/* This will now show "1" even if they are off-duty */}
                  <span>Queue: <strong>{activeTickets.length} Tickets</strong></span>
                </div>

                <div className="detail-row">
                  <Mail size={16} />
                  <span className="email-text">{tech.email || "No Email"}</span>
                </div>
              </div>

              <button 
                className="view-schedule-btn" 
                onClick={() => setSelectedTech(tech)}
              >
                {isAvailable ? "ALLOCATION PROFILE" : "VIEW HISTORICAL"}
              </button>
            </div>
          );
        })}
      </div>

      {/* --- ALLOCATION PROFILE MODAL --- */}
      {selectedTech && (() => {
        const techId = selectedTech.employeeID;
        const name = selectedTech.fullName || "Technician";
        const job = selectedTech.jobTitle || "Specialist";
        const techTickets = [...getTechTickets(techId)].sort((a, b) => {
          if (a.status === 'attending' && b.status !== 'attending') return -1;
          if (a.status !== 'attending' && b.status === 'attending') return 1;
          return a.TicketID - b.TicketID; 
        });
        
        const utility = Math.min(techTickets.length * 20, 100); 

        return (
          <div className="modal-overlay" onClick={() => setSelectedTech(null)}>
            <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedTech(null)}><X /></button>
              
              <div className="modal-header">
                <div className="avatar-large">{name[0]}</div>
                <div>
                  <h2>{name}</h2>
                  <p>{job} {!selectedTech.isAvailable && <span style={{color: '#ff4d4d'}}>(Off-Duty)</span>}</p>
                </div>
              </div>

              <div className="modal-stats-grid">
                <div className="mini-stat">
                  <Activity size={18} className="icon-green" />
                  <div><p className="label">Current Utility</p><p className="val">{utility}%</p></div>
                </div>
                <div className="mini-stat">
                  <Clock size={18} className="icon-blue" />
                  <div><p className="label">Tasks in Queue</p><p className="val">{techTickets.length}</p></div>
                </div>
              </div>

              <div className="allocation-viz">
                <h3>Real-time Task Distribution</h3>
                <div className="progress-stack">
                  <div className="progress-segment mfg" style={{width: `${utility}%`}}>{utility}% Busy</div>
                  <div className="progress-segment idle" style={{width: `${100 - utility}%`}}>{100 - utility}% Available</div>
                </div>
              </div>

              <div className="assigned-tickets">
                <h3>Current Sequence</h3>
                {techTickets.length > 0 ? techTickets.map((t, idx) => (
                  <div key={t.TicketID} className={`mini-ticket ${t.status}`}>
                    <div className="ticket-main-info">
                      <span className="sequence-number">{idx + 1}</span>
                      <span className="t-id">#T-{t.TicketID}</span>
                      <strong className="m-name">{t.machineName || "N/A"}</strong>
                    </div>
                    <span className={`status-badge ${t.status}`}>
                      {t.status === 'attending' ? 'IN PROGRESS' : 'NEXT'}
                    </span>
                  </div>
                )) : (
                  <div className="empty-state-modal">
                    <p>No active assignments found for this personnel.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
};

export default Technician;