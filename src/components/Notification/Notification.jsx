import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, CheckCircle, Clock, Mail, ExternalLink, Search, ShieldAlert, BellRing } from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './Notification.css';

const Notification = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); 
  const [resendingId, setResendingId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track the current real-world timestamp dynamically to compute intervals
  const [currentSystemTime, setCurrentSystemTime] = useState(new Date());

  const fetchNotificationLogs = async () => {
    try {
      const { data } = await supabase
        .from('Ticket')
        .select('*')
        .not('attendByName', 'is', null) 
        .in('status', ['pending', 'attending']) // Only evaluate unclosed, active workflows
        .order('ticketID', { ascending: true }); 
        
      if (data) setLogs(data);
    } catch (err) {
      console.error("Notification Fetch Error:", err);
    }
  };

  // --- AUTOMATED BROWSER-SIDE RULE WORKLOAD ENGINE ---
  useEffect(() => {
    // Initial fetch to paint telemetry grid
    const initializeData = async () => {
      setLoading(true);
      await fetchNotificationLogs();
      setLoading(false);
    };
    initializeData();

    // 1. Maintain a 1-second ticks pool to track countdowns dynamically
    const clockTimer = setInterval(() => {
      setCurrentSystemTime(new Date());
    }, 1000);

    // 2. Rules Evaluation Evaluator: Evaluates dispatch policies every 30 seconds
    const ruleEvaluationEngine = setInterval(async () => {
      await evaluateNotificationRules();
    }, 30000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(ruleEvaluationEngine);
    };
  }, []);

  const evaluateNotificationRules = async () => {
    // Read fresh states directly from memory log matrix array
    for (const log of logs) {
      // Safely fall back to the master startup timestamp if specialized timestamps are null
      const baseTime = log.assignedTime || log.ticketStart;
      if (!baseTime) continue;

      const elapsedMs = new Date() - new Date(baseTime);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);

      // Rule Node A: Pending State check condition (Trigger every 15 minutes)
      if (log.status === 'pending' && elapsedMinutes > 0 && elapsedMinutes % 15 === 0) {
        console.log(`[RULE EXECUTION] Auto-firing alert escalation webhook for pending ticket #${log.ticketID}`);
        await executeAutomatedAlert(log.ticketID, 'escalation-pending');
      }

      // Rule Node B: Attending State check condition (Trigger every 60 minutes)
      if (log.status === 'attending' && elapsedMinutes > 0 && elapsedMinutes % 60 === 0) {
        console.log(`[RULE EXECUTION] Auto-firing workspace closing reminder for attending ticket #${log.ticketID}`);
        await executeAutomatedAlert(log.ticketID, 'closure-reminder');
      }
    }
  };

  const executeAutomatedAlert = async (ticketId, ruleType) => {
    try {
      // Hits your FastAPI endpoint with custom search parameters indicating rule context
      await fetch(`http://localhost:8000/resend-notification/${ticketId}?rule_context=${ruleType}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error(`Automated execution failed for ticket #${ticketId}:`, err);
    }
  };

  const handleResend = async (ticketId) => {
    setResendingId(ticketId);
    try {
      const response = await fetch(`http://localhost:8000/resend-notification/${ticketId}`, {
        method: 'POST'
      });
      if (response.ok) {
        alert(`Notification for Ticket #${ticketId} resent!`);
        await fetchNotificationLogs();
      }
    } catch (err) {
      console.error("Manual trigger failed", err);
    }
    setResendingId(null);
  };

  const handleVerifyEmail = (log) => {
    const isPending = log.status === 'pending';
    const subject = encodeURIComponent(
      isPending 
        ? `[ALERT ESCALATION] Maintenance Queue Stalled: Ticket #${log.ticketID}`
        : `[CLOSURE REMINDER] Active Maintenance Site Pending Closure: Ticket #${log.ticketID}`
    );
    const body = encodeURIComponent(
      isPending
        ? `Hello ${log.attendByName},\n\nYour assigned ticket #${log.ticketID} on ${log.machineName} is currently STALLED in Pending status. Please attend immediately.`
        : `Hello ${log.attendByName},\n\nOur logging metrics register your node as Active on ${log.machineName}. If engineering repairs are complete, please close the ticket to clear deployment telemetry.`
    );
    window.location.href = `mailto:${log.email || 'tech_service@yourcompany.com'}?subject=${subject}&body=${body}`;
  };

  // Helper calculation wrapper to output real-time clock tickers into the table cells
  const getElapsedString = (baseTime) => {
    if (!baseTime) return "0m";
    const diffMs = currentSystemTime - new Date(baseTime);
    const totalMinutes = Math.floor(diffMs / 60000);
    
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const filteredLogs = logs.filter(log => {
    const id = log.ticketID?.toString() || "";
    const name = log.attendByName?.toLowerCase() || "";
    return id.includes(searchTerm) || name.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="dashboard-content"><div className="loader-text">ACCESSING DISPATCH LOGS...</div></div>;

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Notification Center</h1>
          <p>Automated Escalation Arrays & Heartbeat Dispatch Watchdog</p>
        </div>
        
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

      {/* AUTOMATED COMPLIANCE CONTROLLER HUD */}
      <section className="rules-overview-hud">
        <div className="hud-card border-amber">
          <Clock size={20} className="icon-glow-amber" />
          <div className="hud-meta">
            <h4> Escalation Check</h4>
            <p>Pending Tickets query loop alerts every <strong>15 Minutes</strong> if unacknowledged.</p>
          </div>
        </div>
        <div className="hud-card border-blue">
          <BellRing size={20} className="icon-glow-blue" />
          <div className="hud-meta">
            <h4>Closure Watchdog</h4>
            <p>Active Attending task lines request feedback updates every <strong>1 Hour</strong> until closure.</p>
          </div>
        </div>
      </section>

      <div className="log-container glass-card">
        <table className="dispatch-table">
          <thead>
            <tr>
              <th>REF ID</th>
              <th>TECHNICIAN / RECIPIENT</th>
              <th>PROTOCOL STATUS</th>
              <th>ELAPSED INTERVAL</th>
              <th>VERIFICATION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
              <tr key={log.ticketID} className="log-row">
                <td className="id-cell">#{log.ticketID}</td>
                <td>
                  <div className="log-user">
                    <strong>{log.attendByName}</strong>
                    <span>Module Group: {log.targetGroup || 'General TECH'}</span>
                  </div>
                </td>
                <td>
                  <div className={`status-pill ${log.status === 'attending' ? 'delivered' : 'sent'}`}>
                    <div className="pulse-dot"></div>
                    {log.status === 'attending' ? "Active on Site" : "Pending Acknowledgment"}
                  </div>
                </td>
                <td>
                  <div className="elapsed-time-ticker">
                    {getElapsedString(log.assignedTime || log.ticketStart)}
                  </div>
                </td>
                <td>
                  <button className="verify-link" onClick={() => handleVerifyEmail(log)}>
                    <ExternalLink size={14} />
                    Verify Payload Template
                  </button>
                </td>
                <td>
                  <button 
                    className="resend-btn-action"
                    disabled={resendingId === log.ticketID}
                    onClick={() => handleResend(log.ticketID)}
                  >
                    <Send size={14} className={resendingId === log.ticketID ? "fly-away" : ""} />
                    {resendingId === log.ticketID ? "Triggering..." : "Manual Overrides"}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                  No unclosed operations tracking logs running inside telemetry arrays.
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