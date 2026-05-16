import React, { useState, useEffect } from 'react';
import supabase from '../../config/supabaseClient';
import { Clock, Play, CheckCircle, AlertCircle, RefreshCw, Layers, HardDrive, Info, X, ClipboardList, MapPin, Tag } from 'lucide-react';
import './TaskToDo.css';

// 1. Accept user prop passed from App.jsx layout router context
const TaskToDo = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Modal States
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Initialize base query for all active/completed operational tickets
      let query = supabase
        .from('Ticket')
        .select('*')
        .in('status', ['pending', 'attending', 'completed']);

      // 2. MODIFIED LOGIC BOUNDARY:
      // Both Employees AND Managers will now only see tickets assigned strictly to them.
      // Only the structural "Administrator" role is excluded from this individual constraint.
      if (user.role !== 'Administrator') {
        query = query.eq('attendById', String(user.employeeID));
      }

      const { data, error } = await query.order('ticketID', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching operations tasks:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]); // Re-fetch data if user context changes shifts

  const updateTaskStatus = async (ticketID, currentStatus) => {
    setUpdatingId(ticketID);
    let nextStatus = '';
    let updateFields = {};

    if (currentStatus === 'pending') {
      nextStatus = 'attending';
      updateFields = { 
        status: nextStatus,
        assignedTime: new Date().toISOString()
      };
    } else if (currentStatus === 'attending') {
      nextStatus = 'completed';
      updateFields = { 
        status: nextStatus
      };
    }

    try {
      const { error } = await supabase
        .from('Ticket')
        .update(updateFields)
        .eq('ticketID', ticketID);

      if (error) throw error;
      await fetchTasks();
    } catch (err) {
      alert("Database Synchronization Failed: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter tasks into their respective pipeline columns
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const attendingTasks = tasks.filter(t => t.status === 'attending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Modular Component for rendering matching task cards
  const TaskCard = ({ task }) => {
    const isUpdating = updatingId === task.ticketID;
    return (
      <div className={`task-glass-card status-${task.status}`}>
        <div className="task-card-header">
          <span className="task-badge-id">T-{task.ticketID}</span>
          <button className="info-icon-btn" onClick={() => setSelectedTicket(task)} title="View Complete Details">
            <Info size={16} />
          </button>
        </div>

        <div className="task-card-body">
          <h4 className="task-machine-title">
            <HardDrive size={14} className="icon-blue" /> {task.machineName}
          </h4>
          <div className="task-meta-row">
            <span><Layers size={12} /> Line: {task.lineName || "Ext"}</span>
            <span>Group: {task.targetGroup || "Gen"}</span>
          </div>
          {task.alarmCode && (
            <div className="task-alarm-badge">
              <AlertCircle size={10} />
              <span>Alarm: {task.alarmCode}</span>
            </div>
          )}
        </div>

        <div className="task-card-actions">
          {task.status === 'pending' && (
            <button className="task-action-btn accept-btn" disabled={isUpdating} onClick={() => updateTaskStatus(task.ticketID, task.status)}>
              {isUpdating ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
              Accept Task
            </button>
          )}
          {task.status === 'attending' && (
            <button className="task-action-btn complete-btn" disabled={isUpdating} onClick={() => updateTaskStatus(task.ticketID, task.status)}>
              {isUpdating ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
              Complete Job
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <span className="system-badge">{user?.role} Queue Monitor</span>
          <h1>Task To Do</h1>
          <p>
            {user?.role === 'Employee' 
              ? `Operational maintenance pipeline for ${user?.name || 'Technician'}` 
              : 'Global facility deployment pipeline grid matrix view'}
          </p>
        </div>
        <button className="refresh-btn-ui" onClick={fetchTasks} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </header>

      {loading && tasks.length === 0 ? (
        <div className="empty-tasks-state">
          <RefreshCw size={30} className="spin" />
          <p>Reading active processing queues...</p>
        </div>
      ) : (
        /* --- 3-SECTION PIPELINE VIEW --- */
        <section className="pipeline-board-container">
          
          {/* Column 1: Pending Task */}
          <div className="pipeline-column">
            <div className="column-header-node border-pending">
              <h3>Pending Tasks</h3>
              <span className="node-count-badge count-pending">{pendingTasks.length}</span>
            </div>
            <div className="column-card-stack">
              {pendingTasks.length > 0 ? pendingTasks.map(t => <TaskCard key={t.ticketID} task={t} />) : (
                <div className="empty-column-slate"><p>No pending entries</p></div>
              )}
            </div>
          </div>

          {/* Column 2: Attending Task */}
          <div className="pipeline-column">
            <div className="column-header-node border-attending">
              <h3>Attending Tasks</h3>
              <span className="node-count-badge count-attending">{attendingTasks.length}</span>
            </div>
            <div className="column-card-stack">
              {attendingTasks.length > 0 ? attendingTasks.map(t => <TaskCard key={t.ticketID} task={t} />) : (
                <div className="empty-column-slate"><p>No active attendances</p></div>
              )}
            </div>
          </div>

          {/* Column 3: Completed Task */}
          <div className="pipeline-column">
            <div className="column-header-node border-completed">
              <h3>Completed Tasks</h3>
              <span className="node-count-badge count-completed">{completedTasks.length}</span>
            </div>
            <div className="column-card-stack">
              {completedTasks.length > 0 ? completedTasks.map(t => <TaskCard key={t.ticketID} task={t} />) : (
                <div className="empty-column-slate"><p>No completions logged</p></div>
              )}
            </div>
          </div>

        </section>
      )}

      {/* --- LIVE EXTENDED TICKET DETAIL MODAL --- */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content glass-card ticket-info-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedTicket(null)}><X size={18} /></button>
            
            <div className="modal-header">
              <div className="modal-header-badge">T-{selectedTicket.ticketID}</div>
              <h2>Operational Blueprint</h2>
              <p><HardDrive size={14} /> {selectedTicket.machineName} &mdash; <span className={`status-text-${selectedTicket.status}`}>{selectedTicket.status}</span></p>
            </div>

            <div className="ticket-details-grid">
              <div className="detail-box">
                <label><Tag size={12} /> Ticket Type</label>
                <p>{selectedTicket.ticketType || "i-Downtime"}</p>
              </div>
              <div className="detail-box">
                <label><MapPin size={12} /> Line Name</label>
                <p>{selectedTicket.lineName || "N/A"}</p>
              </div>
              <div className="detail-box">
                <label>Current Recipe</label>
                <p style={{color: '#4ecca3', fontWeight: 'bold'}}>{selectedTicket.currentRecipe || "None Listed"}</p>
              </div>
              <div className="detail-box">
                <label>Alarm Identification</label>
                <p style={{color: '#ff4d4d'}}>{selectedTicket.alarmCode || "N/A"}</p>
              </div>
              <div className="detail-box">
                <label>Down Type Classification</label>
                <p>{selectedTicket.downType || "UNPLAN"}</p>
              </div>
              <div className="detail-box">
                <label>Target Dispatch Group</label>
                <p>{selectedTicket.targetGroup || "N/A"}</p>
              </div>
              <div className="detail-box">
                <label>Lot Identification ID</label>
                <p>{selectedTicket.lotId || "N/A"}</p>
              </div>
              <div className="detail-box">
                <label>Assigned Tech Name</label>
                <p style={{color: '#3b82f6'}}>{selectedTicket.attendByName || "Unassigned"}</p>
              </div>
              <div className="detail-box full">
                <label>Ticket Remark Reference</label>
                <p>{selectedTicket.ticketRemark || "No operational notes attached."}</p>
              </div>
              <div className="detail-box full">
                <label><ClipboardList size={12} /> Detailed Breakdown Description</label>
                <p className="description-container">{selectedTicket.downtimeDescription || "No log entry descriptions provided."}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TaskToDo;