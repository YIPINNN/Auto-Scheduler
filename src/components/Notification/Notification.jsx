import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle, Clock, Mail, ExternalLink, Search } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Notification.css';

const Notification = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // New Search State
  const [resendingId, setResendingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotificationLogs();
  }, []);

  const fetchNotificationLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('Ticket')
        .select('*')
        .not('attendByName', 'is', null) 
        // SORT: Ascending (Oldest assignments at the top)
        .order('ticketID', { ascending: true }); 
        
      if (data) setLogs(data);
    } catch (err) {
      console.error("Notification Fetch Error:", err);
    }
    setLoading(false);
  };

  const handleResend = async (ticketId) => {
    setResendingId(ticketId);
    try {
      const response = await fetch(`http://localhost:8000/resend-notification/${ticketId}`, {
        method: 'POST'
      });
      if (response.ok) {
        alert(`Notification for Ticket #${ticketId} resent!`);
      }
    } catch (err) {
      console.error("Manual trigger failed", err);
    }
    setResendingId(null);
  };

  const handleVerifyEmail = (log) => {
    const subject = encodeURIComponent(`[MO-SAHH] New Assignment: Ticket #${log.ticketID}`);
    const body = encodeURIComponent(`Hello ${log.attendByName},\n\nYou have been assigned to ${log.machineName}.\nAlarm Code: ${log.alarmCode}\nPlease report to the site immediately.`);
    window.location.href = `mailto:tech_service@yourcompany.com?subject=${subject}&body=${body}`;
  };

  // Filter Logic: Search by Ticket ID or Technician Name
  const filteredLogs = logs.filter(log => {
    const id = log.ticketID?.toString() || "";
    const name = log.attendByName?.toLowerCase() || "";
    return id.includes(searchTerm) || name.includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="loader-text">ACCESSING DISPATCH LOGS...</div>
      </div>
    );
  }

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Notification Center</h1>
          <p>Automated Email Alerts & Dispatch Status</p>
        </div>
        
        {/* New Search Box in Header */}
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search ID or Tech..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="refresh-btn-circular" onClick={fetchNotificationLogs} style={{marginLeft: '15px'}}>
             <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="log-container glass-card">
        <table className="dispatch-table">
          <thead>
            <tr>
              <th>REF ID</th>
              <th>TECHNICIAN / RECIPIENT</th>
              <th>PROTOCOL STATUS</th>
              <th>VERIFICATION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
              <tr key={log.TicketID} className="log-row">
                <td className="id-cell">#{log.ticketID}</td>
                <td>
                  <div className="log-user">
                    <strong>{log.attendByName}</strong>
                    <span>{log.targetGroup || 'General TECH'}</span>
                  </div>
                </td>
                <td>
                  <div className={`status-pill ${log.status === 'attending' ? 'delivered' : 'sent'}`}>
                    <div className="pulse-dot"></div>
                    {log.status === 'attending' ? "Accepted & Active" : "Dispatch Sent"}
                  </div>
                </td>
                <td>
                  <button className="verify-link" onClick={() => handleVerifyEmail(log)}>
                    <ExternalLink size={14} />
                    View Draft Proof
                  </button>
                </td>
                <td>
                  <button 
                    className="resend-btn-action"
                    disabled={resendingId === log.ticketID}
                    onClick={() => handleResend(log.ticketID)}
                  >
                    <Send size={14} className={resendingId === log.ticketID ? "fly-away" : ""} />
                    {resendingId === log.ticketID ? "Sending..." : "Manual Resend"}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                  No matching dispatch logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default Notification;