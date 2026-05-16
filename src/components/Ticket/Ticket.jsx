import React, { useState, useEffect } from 'react';
import { Search, X, Info, HardDrive, UserPlus, RefreshCw, PencilLine, Check } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Ticket.css';

// 1. Accept user object context as a prop from App.jsx
const Ticket = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isEditing, setIsEditing] = useState(false); 
  const [editForm, setEditForm] = useState({}); 
  const [loading, setLoading] = useState(true);

  // Helper boolean to check if user has structural authorization (Manager/Admin)
  const isAuthorized = user?.role === 'Manager' || user?.role === 'Administrator';

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: ticketData, error: tErr } = await supabase
        .from('Ticket')
        .select('*')
        .order('ticketID', { ascending: true });

      const { data: techData, error: techErr } = await supabase
        .from('Technician')
        .select('employeeID, fullName')
        .eq('isAvailable', true);

      if (tErr) throw tErr;
      if (techErr) throw techErr;

      setTickets(ticketData || []);
      setTechnicians(techData || []);
    } catch (err) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const openModal = (ticket, editMode = false) => {
    // If a normal technician somehow forces an edit invocation, block it immediately
    if (editMode && !isAuthorized) return;

    setSelectedTicket(ticket);
    setIsEditing(editMode);
    setEditForm({ ...ticket }); 
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    if (!isAuthorized) {
      alert("Permission Denied: Only Managers or Administrators can manipulate ticket lifecycle states.");
      return;
    }

    try {
      const { error } = await supabase
        .from('Ticket')
        .update({ status: newStatus })
        .eq('ticketID', ticketId);

      if (error) throw error;
      
      setTickets(prev => prev.map(t => 
        t.ticketID === ticketId ? { ...t, status: newStatus } : t
      ));
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  const handleUpdateTicket = async () => {
    if (!isAuthorized) return;

    try {
      const selectedTech = technicians.find(
        t => t.employeeID.toString() === editForm.attendById?.toString()
      );

      if (!selectedTech) {
        alert("Please select a technician.");
        return;
      }
      
      const updatedPayload = {
        ...editForm,
        attendByName: selectedTech.fullName,
        status: 'pending' 
      };

      const { error } = await supabase
        .from('Ticket')
        .update(updatedPayload)
        .eq('ticketID', editForm.ticketID);

      if (error) throw error;

      try {
        await fetch(`http://localhost:8000/resend-notification/${editForm.ticketID}`, {
          method: 'POST'
        });
        console.log("Notification triggered for manual assignment");
      } catch (notifyErr) {
        console.error("Notification failed to send, but database was updated.");
      }

      setTickets(prev => prev.map(t => t.ticketID === editForm.ticketID ? updatedPayload : t));
      setSelectedTicket(null);
      setIsEditing(false);
      
      alert(`Ticket #${editForm.ticketID} assigned to ${selectedTech.fullName} successfully!`);
    } catch (err) {
      alert("Error saving changes: " + err.message);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const id = t.ticketID?.toString() || "";
    const machine = t.machineName?.toLowerCase() || "";
    return id.includes(searchTerm) || machine.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="dashboard-content"><div className="loader-text">READING SYSTEM LOGS...</div></div>;

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <span className="system-badge">Logged in as: {user?.role}</span>
          <h1>Maintenance Tickets</h1>
          <p>Displaying Top {tickets.length} Active Incidents</p>
        </div>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search TicketID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="refresh-btn" onClick={fetchInitialData} style={{marginLeft: '10px', background: 'none', border: '1px solid #4ecca3', color: '#4ecca3', borderRadius: '5px', cursor: 'pointer', padding: '5px'}}>Refresh</button>
        </div>
      </header>

      <div className="ticket-list-wrapper">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>MACHINE</th>
              <th>ASSIGNED TO</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => (
              <tr key={t.ticketID} className="ticket-row">
                <td className="id-cell">#{t.ticketID}</td>
                <td>
                  <div className="machine-cell">
                    <HardDrive size={14} className="icon-blue" />
                    <span>{t.machineName}</span>
                  </div>
                </td>
                <td>
                  <div className="tech-cell">
                    {t.attendByName ? (
                      <span className="assigned-tech-name">{t.attendByName}</span>
                    ) : (
                      <span className="wait-text">Waiting for MO-SAHH</span>
                    )}
                  </div>
                </td>
                <td>
                  {/* 2. CONDITIONAL STATUS INTERFACE RENDERING */}
                  {isAuthorized ? (
                    <select 
                      className={`status-select ${t.status || 'pending'}`}
                      value={t.status || 'pending'}
                      onChange={(e) => handleStatusChange(t.ticketID, e.target.value)}
                    >
                      <option value="unassigned">UNASSIGNED</option>
                      <option value="pending">PENDING</option>
                      <option value="attending">ATTENDING</option>
                      <option value="completed">COMPLETED</option>
                    </select>
                  ) : (
                    <span className={`status-pill-static ${t.status || 'pending'}`}>
                      {t.status ? t.status.toUpperCase() : 'PENDING'}
                    </span>
                  )}
                </td>
                <td className="actions-cell" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button className="detail-btn" onClick={() => openModal(t, false)} title="View Details">
                    <Info size={18} />
                  </button>
                  
                  {/* 3. SHIELD WRAPPER: Edit button only renders for Admin and Managers */}
                  {isAuthorized && (
                    <button className="edit-icon-btn" onClick={() => openModal(t, true)} style={{ background: 'none', border: 'none', color: '#4ecca3', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Reassign Task Asset">
                      <PencilLine size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODALS CONTROLS --- */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => { setSelectedTicket(null); setIsEditing(false); }}>
          
          {isEditing && isAuthorized ? (
            <div className="modal-content glass-card wide-modal" style={{ width: '450px' }} onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => { setSelectedTicket(null); setIsEditing(false); }}><X /></button>
              <div className="modal-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserPlus size={24} color="#4ecca3" /> Reassign Ticket #{selectedTicket.ticketID}
                </h2>
              </div>

              <div className="modal-body" style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Select Technician</label>
                  <select 
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    value={editForm.attendById || ""} 
                    onChange={e => setEditForm({...editForm, attendById: e.target.value})}
                  >
                    <option value="">-- No Technician Assigned --</option>
                    {technicians.map(tech => (
                      <option key={tech.employeeID} value={tech.employeeID}>{tech.fullName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                   <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Alarm Code Override</label>
                   <input 
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    value={editForm.alarmCode || ""} 
                    onChange={e => setEditForm({...editForm, alarmCode: e.target.value})} 
                  />
                </div>
                
                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="cancel-btn" onClick={() => setIsEditing(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleUpdateTicket} style={{ background: '#4ecca3', border: 'none', color: '#1a1a2e', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={18} /> Confirm Changes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="modal-content glass-card ticket-modal" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedTicket(null)}><X /></button>
              <div className="modal-header">
                <h2>Ticket Details: #{selectedTicket.ticketID}</h2>
                <p>{selectedTicket.machineName} | {selectedTicket.lineName || "External Source"}</p>
              </div>
              
              <div className="ticket-details-grid">
                <div className="detail-box">
                  <label>Alarm Code</label>
                  <p>{selectedTicket.alarmCode || "N/A"}</p>
                </div>
                <div className="detail-box">
                  <label>Target Group</label>
                  <p>{selectedTicket.targetGroup || "General"}</p>
                </div>
                <div className="detail-box full">
                  <label>Problem Description</label>
                  <p>{selectedTicket.downtimeDescription || "No description provided."}</p>
                </div>
                <div className="detail-box">
                  <label>Root Cause</label>
                  <p className="border-red">{selectedTicket.rootCause || "Under Investigation"}</p>
                </div>
                <div className="detail-box">
                  <label>Corrective Action</label>
                  <p className="border-green">{selectedTicket.correctiveAction || "Pending Work"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default Ticket;