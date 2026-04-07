import React, { useState, useEffect } from 'react';
import { Users, Mail, BadgeCheck, Search, X, PieChart, Activity, Clock } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Technician.css';

const Technician = () => {
  const [technicians, setTechnicians] = useState([]);
  const [allTickets, setAllTickets] = useState([]); // Real-time ticket state
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch both Technicians and their assigned tickets in parallel
    const [techRes, ticketRes] = await Promise.all([
      supabase.from('Technician').select('*'),
      supabase.from('Ticket').select('*').in('status', ['pending', 'attending'])
    ]);

    if (techRes.data) setTechnicians(techRes.data);
    if (ticketRes.data) setAllTickets(ticketRes.data);
    
    setLoading(false);
  };

  const filteredTechs = technicians.filter(tech => {
    const name = tech.fullName || "";
    const id = tech.employeeID || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || id.toString().includes(searchTerm);
  });

  // Helper to get tickets for a specific tech
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
        {filteredTechs.map((tech, index) => {
          const name = tech.fullName || "Unknown";
          const id = tech.employeeID || "N/A";
          const jobTitle = tech.jobTitle || "Technician";
          const group = tech.targetGroup || "General";
          const email = tech.email || "No Email";
          
          // Real-time Status Calculation
          const activeTickets = getTechTickets(id);
          const isAttending = activeTickets.some(t => t.status === 'attending');
          const status = isAttending ? "Active" : activeTickets.length > 0 ? "Assigned" : "Available";

          return (
            <div key={id} className="glass-card tech-card">
              <div className="dept-tag">{group}</div>

              <div className="tech-card-header">
                <div className="avatar-large">{name[0]}</div>
                <div className={`status-indicator ${status.toLowerCase()}`}>
                  {status}
                </div>
              </div>
              
              <div className="tech-info">
                <h3>{name}</h3>
                <p className="job-title">{jobTitle}</p>
                
                <div className="detail-row">
                  <BadgeCheck size={16} className="icon-green" />
                  <span>Employee ID: <strong>{id}</strong></span>
                </div>
                
                <div className="detail-row">
                  <Users size={16} className="icon-blue" />
                  <span>Queue: <strong>{activeTickets.length} Tickets</strong></span>
                </div>

                <div className="detail-row">
                  <Mail size={16} />
                  <span className="email-text">{email}</span>
                </div>
              </div>

              <button 
                className="view-schedule-btn" 
                onClick={() => setSelectedTech(tech)}
              >
                ALLOCATION PROFILE
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
        // 1. Get all tickets for this technician
        const rawTickets = getTechTickets(techId);

        // 2. Sort the sequence: ATTENDING first, then PENDING (Ascending by TicketID or Database Order)
        const techTickets = [...rawTickets].sort((a, b) => {
          // If one is attending and the other isn't, put attending first
          if (a.status === 'attending' && b.status !== 'attending') return -1;
          if (a.status !== 'attending' && b.status === 'attending') return 1;
          
          // For pending tickets, we want to follow the "bottom-to-top" logic 
          // If your Database/Algorithm provides a specific order, sort by ID or Created At
          return a.TicketID - b.TicketID; 
        });
        
        // Dynamic Utility Calculation (Simulated logic based on task count)
        const utility = Math.min(techTickets.length * 20, 100); 

        return (
          <div className="modal-overlay" onClick={() => setSelectedTech(null)}>
            <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedTech(null)}><X /></button>
              
              <div className="modal-header">
                <div className="avatar-large">{name[0]}</div>
                <div>
                  <h2>{name}</h2>
                  <p>{job}</p>
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
                <h3>Current Sequence (Optimization Output)</h3>
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
                  <p className="empty-text">No tickets currently assigned.</p>
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