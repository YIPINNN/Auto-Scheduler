import React, { useState, useEffect } from 'react';
import { Search, X, Info, HardDrive } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Ticket.css';

const Ticket = () => {
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Ticket') 
        .select('*')
        // SORT: Ascending (1, 2, 3...)
        .order('TicketID', { ascending: true }); 
      
      if (error) throw error;
      if (data) setTickets(data);
    } catch (err) {
      console.error("Supabase Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const { error } = await supabase
        .from('Ticket')
        .update({ status: newStatus })
        .eq('TicketID', ticketId);

      if (error) throw error;
      
      setTickets(prev => prev.map(t => 
        t.TicketID === ticketId ? { ...t, status: newStatus } : t
      ));
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  const filteredTickets = tickets.filter(t => {
    const id = t.TicketID?.toString() || "";
    const machine = t.machineName?.toLowerCase() || "";
    return id.includes(searchTerm) || machine.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="dashboard-content"><div className="loader-text">READING SYSTEM LOGS...</div></div>;

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
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
          <button className="refresh-btn" onClick={fetchTickets} style={{marginLeft: '10px', background: 'none', border: '1px solid #4ecca3', color: '#4ecca3', borderRadius: '5px', cursor: 'pointer', padding: '5px'}}>Refresh</button>
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
              <th>INFO</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => (
              <tr key={t.TicketID} className="ticket-row">
                <td className="id-cell">#{t.TicketID}</td>
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
                  <select 
                    className={`status-select ${t.status || 'pending'}`}
                    value={t.status || 'pending'}
                    onChange={(e) => handleStatusChange(t.TicketID, e.target.value)}
                  >
                    <option value="pending">PENDING</option>
                    <option value="attending">ATTENDING</option>
                    <option value="completed">COMPLETED</option>
                  </select>
                </td>
                <td>
                  <button className="detail-btn" onClick={() => setSelectedTicket(t)}>
                    <Info size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content glass-card ticket-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedTicket(null)}><X /></button>
            <div className="modal-header">
              <h2>Ticket Details: #{selectedTicket.TicketID}</h2>
              <p>{selectedTicket.machineName} | {selectedTicket.LineName || "Main Line"}</p>
            </div>
            
            <div className="ticket-details-grid">
              <div className="detail-box full">
                <label>Problem Description</label>
                <p>{selectedTicket.downtimeDescription}</p>
              </div>
              <div className="detail-box">
                <label>Root Cause</label>
                <p className="border-red">{selectedTicket.rootCause || "Analyzing..."}</p>
              </div>
              <div className="detail-box">
                <label>Corrective Action</label>
                <p className="border-green">{selectedTicket.correctiveAction || "Pending..."}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Ticket;