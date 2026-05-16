import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, HardDrive, Settings, Layers, ClipboardList, Users, MapPin, Clock, Info
} from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './CreateTicket.css';

const CreateTicket = ({ user }) => {
  const [currentUser, setCurrentUser] = useState({ id: '', name: 'Loading...' });

  const initialState = {
    machineName: '',
    machineID: '',
    lineName: '', 
    lotId: '',
    currentRecipe: '', 
    alarmCode: '', 
    targetGroup: '',
    ticketType: 'i-Downtime', 
    downtimeDescription: '',
    downType: 'UNPLAN',
    ticketRemark: '',
    rootCause: '',
    correctiveAction: '',
    estimatedDuration: '', // Minutes input tracker
  };

  const [formData, setFormData] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetGroups, setTargetGroups] = useState([]);
  const [alarmCodes, setAlarmCodes] = useState([]); 

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Fetch Current Authenticated User Data
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser({
            id: user.id,
            name: user.user_metadata?.full_name || user.email
          });
        }

        // Fetch Target Groups
        const { data: groupData } = await supabase.from('TargetGroup').select('targetGroup');
        if (groupData) {
          setTargetGroups(groupData);
          if (groupData.length > 0) {
            setFormData(prev => ({ ...prev, targetGroup: groupData[0].targetGroup }));
          }
        }

        // Fetch Alarm Codes
        const { data: codeData, error: codeError } = await supabase
          .from('AlarmCode')
          .select('alarmCode')
          .order('alarmCode', { ascending: true });

        if (codeError) throw codeError;
        
        if (codeData) {
          setAlarmCodes(codeData);
          if (codeData.length > 0) {
            setFormData(prev => ({ ...prev, alarmCode: codeData[0].alarmCode }));
          }
        }
      } catch (err) {
        console.error("Initialization Error:", err.message);
      }
    };

    fetchMasterData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Math Calculation Interception: Parse minutes entered and inject the 5-minute transition overhead
      const rawMinutes = parseInt(formData.estimatedDuration, 10) || 0;
      const calculatedDurationWithBuffer = rawMinutes + 5;

      const { error } = await supabase
        .from('Ticket')
        .insert([{
          ...formData,
          estimatedDuration: calculatedDurationWithBuffer, // Commits the adjusted duration to BigInt column
          status: 'unassigned', 
          createdById: user?.employeeID || 'SYSTEM',
          createdByName: user?.name || 'Unknown Operator',
          triggerType: 'Manual',
          ticketStart: new Date().toISOString()
        }]);

      if (error) throw error;
      
      alert(`Ticket initialized successfully. Database committed execution slot: ${calculatedDurationWithBuffer} mins (includes 5m overhead).`);
      
      setFormData({ 
        ...initialState, 
        targetGroup: targetGroups[0]?.targetGroup || '',
        alarmCode: alarmCodes[0]?.alarmCode || ''
      });
    } catch (err) {
      alert("Database Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Ticket Creation</h1>
          <p>Logged as <strong>{user?.name || "System Specialist"}</strong></p>
        </div>
      </header>

      <section className="create-ticket-wrapper">
        <form className="glass-card professional-form" onSubmit={handleSubmit}>
          
          <div className="form-grid">
            {/* --- Column 1: Asset & Classification --- */}
            <div className="form-column">
              <h3 className="section-title"><HardDrive size={18} /> Asset & Classification</h3>
              
              <div className="input-row-2">
                <div className="input-group">
                  <label className="single-line-label">Ticket Type</label>
                  <select 
                    value={formData.ticketType} 
                    onChange={e => setFormData({...formData, ticketType: e.target.value})}
                  >
                    <option value="i-Downtime">i-Downtime</option>
                    <option value="PM">PM</option>
                    <option value="PMLC">PMLC</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="single-line-label"><MapPin size={14} /> Line Name</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Key in Line..."
                    value={formData.lineName} 
                    onChange={e => setFormData({...formData, lineName: e.target.value})} 
                  />
                </div>
              </div>

              {/* Combined Row for Clean Grid Alignment: Machine Name & Machine ID */}
              <div className="input-row-2">
                <div className="input-group">
                  <label className="single-line-label">Machine Name</label>
                  <input required placeholder="e.g. Sorter Alpha" value={formData.machineName} onChange={e => setFormData({...formData, machineName: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="single-line-label">Machine ID Reference</label>
                  <input required placeholder="e.g. MC-7002" value={formData.machineID} onChange={e => setFormData({...formData, machineID: e.target.value})} />
                </div>
              </div>

              <div className="input-group">
                <label className="single-line-label">Current Recipe</label>
                <input 
                  type="text" 
                  placeholder="Key in Recipe..."
                  value={formData.currentRecipe} 
                  onChange={e => setFormData({...formData, currentRecipe: e.target.value})} 
                />
              </div>

              <div className="input-group">
                <label className="single-line-label">Alarm Code</label>
                <select 
                  required 
                  value={formData.alarmCode} 
                  onChange={e => setFormData({...formData, alarmCode: e.target.value})}
                >
                  {alarmCodes.length === 0 ? (
                    <option disabled value="">Loading codes...</option>
                  ) : (
                    alarmCodes.map((item, index) => (
                      <option key={index} value={item.alarmCode}>{item.alarmCode}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* --- Column 2: Diagnostics & Timing --- */}
            <div className="form-column">
              <h3 className="section-title"><Settings size={18} /> Diagnostics & Telemetry</h3>
              <div className="input-group">
                <label className="single-line-label">Root Cause</label>
                <input placeholder="Optional investigation fields..." value={formData.rootCause} onChange={e => setFormData({...formData, rootCause: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="single-line-label">Corrective Action</label>
                <input placeholder="Optional containment actions..." value={formData.correctiveAction} onChange={e => setFormData({...formData, correctiveAction: e.target.value})} />
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label className="single-line-label">Down Type</label>
                  <select value={formData.downType} onChange={e => setFormData({...formData, downType: e.target.value})}>
                    <option value="UNPLAN">UNPLAN</option>
                    <option value="PLAN">PLAN</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="single-line-label"><Users size={14} /> Group</label>
                  <select value={formData.targetGroup} onChange={e => setFormData({...formData, targetGroup: e.target.value})}>
                    {targetGroups.map((g, i) => <option key={i} value={g.targetGroup}>{g.targetGroup}</option>)}
                  </select>
                </div>
              </div>
              
              {/* Added Real-Time Maintenance Duration Inputs Configuration Controls */}
              <div className="input-row-2">
                <div className="input-group">
                  <label className="single-line-label"><Layers size={14} /> Lot ID</label>
                  <input placeholder="Batch lot number..." value={formData.lotId} onChange={e => setFormData({...formData, lotId: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="single-line-label"><Clock size={14} /> Estimated Time Need (Minutes)</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    placeholder="Duration value in mins..."
                    value={formData.estimatedDuration} 
                    onChange={e => setFormData({...formData, estimatedDuration: e.target.value})} 
                  />
                </div>
              </div>

              {/* High-Tech Engine Information Micro-banner Component UI notice */}
              <div className="timing-buffer-notice-banner" style={{ display: 'flex', gap: '10px', background: 'rgba(78, 204, 163, 0.05)', border: '1px solid rgba(78, 204, 163, 0.15)', padding: '12px 16px', borderRadius: '8px', marginTop: '-5px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4', textAlign: 'left' }}>
                <Info size={28} style={{ color: '#4ecca3', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#4ecca3', display: 'block', marginBottom: '2px' }}>MO-SAHH Engine Matrix Policy Applied:</strong>
                  The system automatically locks an additional <strong>+5 minutes</strong> overhead buffer for route transition constraints to optimize technician shift handovers.
                </span>
              </div>

            </div>
          </div>

          <div className="form-full-width">
            <h3 className="section-title"><ClipboardList size={18} /> Additional Information</h3>
            <div className="input-group" style={{ marginBottom: '15px' }}>
              <label className="single-line-label">Ticket Remark</label>
              <input value={formData.ticketRemark} onChange={e => setFormData({...formData, ticketRemark: e.target.value})} placeholder="Short reference note..." />
            </div>
            <textarea 
              rows="3" 
              value={formData.downtimeDescription} 
              onChange={e => setFormData({...formData, downtimeDescription: e.target.value})} 
              placeholder="Full breakdown description notes..." 
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="neon-dispatch-btn" disabled={isSubmitting}>
              {isSubmitting ? "Syncing Telemetry Grid..." : <><PlusCircle size={20} /> Create Downtime Ticket </>}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default CreateTicket;