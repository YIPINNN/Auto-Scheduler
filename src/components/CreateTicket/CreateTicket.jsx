import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, HardDrive, Settings, Layers, ClipboardList, Users, MapPin 
} from 'lucide-react';
import supabase from '../../config/supabaseClient';
import './CreateTicket.css';

const CreateTicket = () => {
  const [currentUser, setCurrentUser] = useState({ id: '', name: 'Loading...' });

  const initialState = {
    machineName: '',
    machineID: '',
    lineName: '', 
    lotId: '',
    currentRecipe: '', // Manual text input
    alarmCode: '', 
    targetGroup: '',
    ticketType: 'i-Downtime', 
    downtimeDescription: '',
    downType: 'UNPLAN',
    ticketRemark: '',
    rootCause: '',
    correctiveAction: '',
  };

  const [formData, setFormData] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetGroups, setTargetGroups] = useState([]);
  const [alarmCodes, setAlarmCodes] = useState([]); 

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Fetch Current Authenticated User
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
      const { error } = await supabase
        .from('Ticket')
        .insert([{
          ...formData,
          status: 'unassigned', 
          createdById: currentUser.id,
          createdByName: currentUser.name,
          triggerType: 'Manual',
        }]);

      if (error) throw error;
      
      alert("Ticket successfully initialized.");
      
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
          <p>Logged as <strong>{currentUser.name}</strong></p>
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

              <div className="input-group">
                <label className="single-line-label">Machine Name</label>
                <input required value={formData.machineName} onChange={e => setFormData({...formData, machineName: e.target.value})} />
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

            {/* --- Column 2: Diagnostics --- */}
            <div className="form-column">
              <h3 className="section-title"><Settings size={18} /> Diagnostics</h3>
              <div className="input-group">
                <label className="single-line-label">Root Cause</label>
                <input value={formData.rootCause} onChange={e => setFormData({...formData, rootCause: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="single-line-label">Corrective Action</label>
                <input value={formData.correctiveAction} onChange={e => setFormData({...formData, correctiveAction: e.target.value})} />
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
              
              <div className="input-group">
                <label className="single-line-label"><Layers size={14} /> Lot ID</label>
                <input value={formData.lotId} onChange={e => setFormData({...formData, lotId: e.target.value})} />
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
              placeholder="Full breakdown description..." 
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="neon-dispatch-btn" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : <><PlusCircle size={20} /> Create Downtime Ticket </>}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default CreateTicket;