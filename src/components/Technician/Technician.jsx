import React, { useState, useEffect } from 'react';
import { Users, Mail, BadgeCheck, Search, X, PieChart, Activity, Clock } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Technician.css';

const Technician = () => {
  const [technicians, setTechnicians] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState(null); // State for the Modal

  useEffect(() => {
    const fetchTechnicians = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('Technician')
        .select('*');
      
      if (data) {
        console.log("Fetched Data:", data[0]); // Check column names in console
        setTechnicians(data);
      }
      if (error) console.error("Supabase Error:", error);
      setLoading(false);
    };
    fetchTechnicians();
  }, []);

  const filteredTechs = technicians.filter(tech => {
    const name = tech['Full Name'] || tech.fullName || "";
    const id = tech['Employee ID'] || tech.employeeID || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || id.toString().includes(searchTerm);
  });

  if (loading) return <div className="dashboard-content"><p>Loading personnel...</p></div>;

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
          // Mapping CSV Columns to variables
          const name = tech['Full Name'] || tech.fullName || "Unknown";
          const id = tech['Employee ID'] || tech.employeeID || "N/A";
          const jobTitle = tech['Job Title'] || tech.jobTitle || "Technician";
          const group = tech['TargetGroup'] || tech.targetGroup || "General";
          const status = tech['Status'] || tech.status || "Inactive";
          const email = tech['Email'] || tech.email || "No Email";

          return (
            <div key={id + index} className="glass-card tech-card">
              {/* Optional: Add a small badge for the TargetGroup */}
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
                  <span>Team: <strong>{group}</strong></span>
                </div>

                <div className="detail-row">
                  <Mail size={16} />
                  <span className="email-text">{email}</span>
                </div>
              </div>

              <button 
                className="view-schedule-btn" 
                onClick={(e) => {
                  e.stopPropagation(); // Prevents conflicts
                  console.log("Opening tech:", tech['Full Name']); // Check your console (F12)
                  setSelectedTech(tech);
                }}
              >
                ALLOCATION PROFILE
              </button>
            </div>
          );
        })}
      </div>

      {/* --- ALLOCATION PROFILE MODAL --- */}
      {selectedTech && (() => {
        // Extract values once with fallbacks to prevent "undefined[0]" errors
        const name = selectedTech['Full Name'] || selectedTech.fullName || "Technician";
        const job = selectedTech['Job Title'] || selectedTech.jobTitle || "Specialist";
        
        return (
          <div className="modal-overlay" onClick={() => setSelectedTech(null)}>
            <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedTech(null)}><X /></button>
              
              <div className="modal-header">
                {/* Safe access to first letter */}
                <div className="avatar-large">{name[0]}</div>
                <div>
                  <h2>{name}</h2>
                  <p>{job}</p>
                </div>
              </div>

              <div className="modal-stats-grid">
                <div className="mini-stat">
                  <Activity size={18} className="icon-green" />
                  <div><p className="label">Utility</p><p className="val">84%</p></div>
                </div>
                <div className="mini-stat">
                  <Clock size={18} className="icon-blue" />
                  <div><p className="label">Avg Response</p><p className="val">14m</p></div>
                </div>
              </div>

              <div className="allocation-viz">
                <h3>Task Distribution</h3>
                <div className="progress-stack">
                  <div className="progress-segment mfg" style={{width: '60%'}}>60% Tasks</div>
                  <div className="progress-segment travel" style={{width: '25%'}}>25% Travel</div>
                  <div className="progress-segment idle" style={{width: '15%'}}>15% Idle</div>
                </div>
              </div>

              <div className="assigned-tickets">
                <h3>Current Sequence</h3>
                <div className="mini-ticket"><span>#T-8821</span> <strong>Machine A-01</strong></div>
                <div className="mini-ticket"><span>#T-8845</span> <strong>Machine B-04</strong></div>
              </div>
            </div>
          </div>
        );
      })()}

    </main>
  );
};

export default Technician;