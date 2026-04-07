import React, { useState, useEffect } from "react";
import supabase from "../../config/supabaseClient";
import { Upload, Loader2, AlertCircle, Terminal, History } from 'lucide-react';
import "./Schedule.css";

const Schedule = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]); 
  const [rawOutput, setRawOutput] = useState([]);
  const [scenarios, setScenarios] = useState([]); 
  const [scenarioName, setScenarioName] = useState("");

  const colors = ["#4ecca3", "#3b82f6", "#a855f7", "#facc15", "#ff4d4d"];

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    const { data } = await supabase
      .from('Optimization_Results')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setScenarios(data);
  };

  const processOptimization = async (file) => {
    if (!file) return;
    
    if (!scenarioName) {
      alert("Please enter a Scenario Name first (e.g. PI04_Initial)");
      return;
    }

    setIsProcessing(true);
    setResults([]); 
    setRawOutput([]);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      // API call with scenario_name as query param
      const response = await fetch(`http://127.0.0.1:8000/optimize?scenario_name=${encodeURIComponent(scenarioName)}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === "success") {
        const finalResult = Array.isArray(data.result) ? data.result : [];
        setResults(finalResult); 
        
        setRawOutput(finalResult.map(res => 
          `ALGORITHM: Tech ${res.tech} optimized with ${res.tickets.length} tasks.`
        ));
        
        fetchScenarios(); // Refresh history list
        alert("MO-SAHH Algorithm: Optimization Complete & Saved!");
      } else {
        throw new Error(data.message || "Optimization failed");
      }
    } catch (error) {
      console.error("Connection Error:", error);
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
      // Reset file input value so same file can be uploaded again if needed
      document.getElementById('fileInput').value = "";
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    setIsDragging(e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processOptimization(file);
  };

  // Fixed Select Button Logic
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processOptimization(file);
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Optimization Engine</h1>
          <p>MATLAB-Powered MO-SAHH Scheduler</p>
        </div>
        {isProcessing && (
          <div className="status-loader">
            <Loader2 className="spin" size={18} />
            <span>MO-SAHH Executing...</span>
          </div>
        )}
      </header>

      {/* Scenario Name Input Section */}
      <section className="glass-card scenario-input-panel">
        <div className="input-row">
          <History size={18} color="#4ecca3" />
          <input 
            type="text" 
            placeholder="Step 1: Enter Scenario Name (e.g. PI04_Run1)" 
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
          />
        </div>
      </section>

      {/* Drop Zone with Fixed Select Button */}
      <section 
        className={`drop-zone ${isDragging ? "active" : ""}`}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className="drop-content">
          <Upload size={40} color={isDragging ? "#4ecca3" : "#94a3b8"} />
          <h3>Step 2: Drop Ticket Dataset</h3>
          <p>Drag & drop <strong>input.txt</strong> or click select</p>
          
          <input 
            type="file" 
            id="fileInput" 
            hidden 
            onChange={handleFileSelect} 
            accept=".txt" 
          />
          
          <button 
            className="neon-btn" 
            type="button"
            onClick={() => document.getElementById('fileInput').click()}
          >
            Select File
          </button>
        </div>
      </section>

      <section className="glass-card schedule-viz">
        <h3>Assignment Timeline (Gantt Visualization)</h3>
        <div className="gantt-container">
          {results.length > 0 ? (
            results.map((row, idx) => (
              <div key={idx} className="gantt-row">
                <div className="gantt-label">
                  <div className="avatar-mini" style={{backgroundColor: colors[idx % colors.length] + '44'}}>
                    {String(row.tech).slice(-2)}
                  </div>
                  <span>Tech {String(row.tech).slice(-4)}</span>
                </div>
                <div className="gantt-track">
                  {row.tickets.map((ticket, tIdx) => (
                    <div 
                      key={tIdx} 
                      className="gantt-block" 
                      style={{ backgroundColor: colors[idx % colors.length] }}
                    >
                      T-{String(ticket)}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-gantt">
              <AlertCircle size={20} />
              <p>Waiting for algorithm output...</p>
            </div>
          )}
        </div>
      </section>

      {rawOutput.length > 0 && (
        <section className="glass-card debug-terminal">
          <div className="terminal-header">
            <Terminal size={14} /> <span>MO-SAHH_V2_LOG</span>
          </div>
          <div className="terminal-content">
            {rawOutput.map((line, index) => (
              <div key={index} className="terminal-line">
                <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
                <span className="success-text">{line}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scenario History Section */}
      <section className="glass-card scenario-history-list">
        <h3>Scenario History (Saved States)</h3>
        <div className="history-grid">
          {scenarios.map((s) => (
            <button 
              key={s.id} 
              className={`history-item ${scenarioName === s.scenario_name ? "active-history" : ""}`} 
              onClick={() => { 
                setResults(s.result_data); 
                setScenarioName(s.scenario_name); 
              }}
            >
              <strong>{s.scenario_name}</strong>
              <small>{new Date(s.created_at).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Schedule;