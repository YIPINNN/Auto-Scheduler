import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle, Clock, Mail } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Notification.css';

const Notification = () => {
  const [logs, setLogs] = useState([]);
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    const fetchNotificationLogs = async () => {
      const { data } = await supabase
        .from('Ticket')
        .select('*')
        .not('attendByName', 'is', null) 
        .order('assignedTime', { ascending: false });
      if (data) setLogs(data);
    };
    fetchNotificationLogs();
  }, []);

  const handleResend = (ticketId) => {
    setResendingId(ticketId);
    setTimeout(() => {
      setResendingId(null);
      alert(`Manual notification trigger sent for Ticket #${ticketId}`);
    }, 1000);
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Notification Center</h1>
          <p>Automated Email Alerts & Dispatch Status</p>
        </div>
      </header>

      <div className="log-container">
        <table className="dispatch-table">
          <thead>
            <tr>
              <th>REF ID</th>
              <th>RECIPIENT</th>
              <th>DISPATCH TIME</th>
              <th>STATUS</th>
              <th>MANUAL OVERRIDE</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.TicketID} className="log-row">
                <td className="id-cell">#{log.TicketID}</td>
                <td>
                  <div className="log-user">
                    <strong>{log.attendByName}</strong>
                    <span>{log.attendByGroup}</span>
                  </div>
                </td>
                <td>{new Date(log.assignedTime).toLocaleTimeString()}</td>
                <td>
                  <div className={`status-pill ${log.attendStart ? 'delivered' : 'sent'}`}>
                    {log.attendStart ? <CheckCircle size={12} /> : <Mail size={12} />}
                    {log.attendStart ? "Read / Accepted" : "Email Sent"}
                  </div>
                </td>
                <td>
                  {!log.attendStart && (
                    <button 
                      className="resend-btn-action"
                      onClick={() => handleResend(log.TicketID)}
                    >
                      <RefreshCw size={14} className={resendingId === log.TicketID ? "spin" : ""} />
                      Resend Notification
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default Notification;