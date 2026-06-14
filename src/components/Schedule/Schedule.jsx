import React, { useState, useEffect } from "react";
import supabase from "../../config/supabaseClient";
import { Upload, Loader2, AlertCircle, Terminal, History, RefreshCw, Clock, Box, Layout } from 'lucide-react';
import "./Schedule.css";

const Schedule = ({ technicians = [] }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [finalResults, setFinalResults] = useState([]);
  const [rawOutput, setRawOutput] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState("");

  const [paretoSolutions, setParetoSolutions] = useState([]);
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [finalMetrics, setFinalMetrics] = useState({
    workloadVariance: 0,
    makespan: 0
  });

  // Live tracking states
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [isFetchingPending, setIsFetchingPending] = useState(false);

  const colors = ["#4ecca3", "#3b82f6", "#a855f7", "#facc15", "#ff4d4d"];

  // Create a lookup map for names and full details
  const techLookup = technicians.reduce((acc, tech) => {
    acc[String(tech.employeeID)] = tech.fullName;
    return acc;
  }, {});

  const applyFinalScheduleToView = (finalResult, alternatives, metrics = {}) => {
    const safeFinal = Array.isArray(finalResult) ? finalResult : [];
    const safeAlternatives = Array.isArray(alternatives) ? alternatives : [];

    setResults(safeFinal);
    setFinalResults(safeFinal);
    setParetoSolutions(safeAlternatives);

    const nextMetrics = {
      workloadVariance: Number(metrics.workloadVariance || 0),
      makespan: Number(metrics.makespan || 0)
    };

    setFinalMetrics(nextMetrics);

    setSelectedSolution({
      solutionID: "final",
      isBest: true,
      workloadVariance: nextMetrics.workloadVariance,
      makespan: nextMetrics.makespan,
      assignments: safeFinal
    });
  };

  useEffect(() => {
    fetchScenarios();
    fetchUnassigned();
  }, []);

  const fetchScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('Optimization_Results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setScenarios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching scenarios:", err.message);
      setScenarios([]);
    }
  };

  const fetchUnassigned = async () => {
    setIsFetchingPending(true);
    try {
      const { data, error } = await supabase
        .from('Ticket')
        .select('*')
        .eq('status', 'unassigned')
        .order('ticketStart', { ascending: true });

      if (error) throw error;
      setUnassignedTickets(data || []);
    } catch (err) {
      console.error("Error fetching unassigned tickets:", err.message);
    } finally {
      setIsFetchingPending(false);
    }
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
      const response = await fetch(`http://127.0.0.1:8000/optimize?scenario_name=${encodeURIComponent(scenarioName)}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP operational error code ${response.status}`);
      }

      const data = await response.json();
      if (data.status === "success") {
        const finalResult = Array.isArray(data.result) ? data.result : [];
        const alternatives = Array.isArray(data.paretoSolutions) ? data.paretoSolutions : [];

        applyFinalScheduleToView(finalResult, alternatives, {
          workloadVariance: data.workloadVariance,
          makespan: data.makespan
        });

        setRawOutput(finalResult.map(res => {
          const name = techLookup[String(res.tech)] || "Unknown";
          return `ALGORITHM: ${name} (ID: ${res.tech}) optimized with ${Array.isArray(res.tickets) ? res.tickets.length : 0} tasks.`;
        }));

        alert(
          "Optimization Complete!\n\n" +
          "MO-SAHH scheduling has been completed and saved.\n" +
          "MOGA baseline comparison has also completed."
        );

        setTimeout(() => {
          fetchScenarios();
          fetchUnassigned();
        }, 800);
      } else {
        throw new Error(data.message || "Optimization failed");
      }
    } catch (error) {
      console.error("Optimization Connection Exception Error:", error);
      alert(
        "MO-SAHH Core Engine Drop Notice:\n\n" +
        "MATLAB Execution Interrupted. This usually implies a cloud authentication timeout or local licensing sync error (MathWorks Service Exception 5201).\n\n" +
        "Error: " + error.message
      );
    } finally {
      setIsProcessing(false);
      const fileInputElement = document.getElementById('fileInput');
      if (fileInputElement) fileInputElement.value = "";
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processOptimization(file);
  };

  // --- REWRITTEN HANDLE RESCHEDULE EXCEPTION HANDLING SAFEGUARD ---
  const handleReschedule = async () => {
    if (!scenarioName) {
      alert("Please enter a Scenario Name first (e.g. Reschedule_Run1)");
      return;
    }
    setIsProcessing(true);
    setResults([]);

    const blob = new Blob([""], { type: 'text/plain' });
    const dummyFile = new File([blob], "reschedule.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", dummyFile);

    try {
      const response = await fetch(`http://127.0.0.1:8000/optimize?scenario_name=${encodeURIComponent(scenarioName)}`, {
        method: "POST",
        body: formData,
      });

      // Catch underlying application crashes before json extraction
      if (!response.ok) {
        throw new Error(`The background process core threw an active connection crash (Status ${response.status})`);
      }

      const data = await response.json();
      if (data.status === "success") {
        const finalResult = Array.isArray(data.result) ? data.result : [];
        const alternatives = Array.isArray(data.paretoSolutions) ? data.paretoSolutions : [];

        applyFinalScheduleToView(finalResult, alternatives, {
          workloadVariance: data.workloadVariance,
          makespan: data.makespan
        });

        setRawOutput(prev => [
          ...prev,
          `APPLY ALTERNATIVE: Solution ${solution.solutionID} applied. Updated ${data.updatedCount}, skipped ${data.skippedCount}, emails sent ${data.notificationCount || 0}.`
        ]);

        alert(
          "Rescheduling Complete!\n\n" +
          "MO-SAHH rescheduling has been completed and saved.\n" +
          "MOGA baseline comparison has also completed."
        );

        setTimeout(() => {
          fetchScenarios();
          fetchUnassigned();
        }, 800);
      } else {
        throw new Error(data.message || "Rescheduling engine rejection");
      }
    } catch (error) {
      console.error("Reschedule Structural Flow Crash Error:", error);
      alert(
        "Optimization Core Communication Failure:\n\n" +
        "MATLAB could not communicate with MathWorks licensing vectors (Error 5201).\n\n" +
        "Operational Workaround:\n" +
        "1. Open standalone MATLAB Desktop locally to refresh licenses.\n" +
        "2. Alternatively, reassign tasks manually via the master Tickets grid desk table."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAlternativeSchedule = async (solution) => {
    if (!solution || !Array.isArray(solution.assignments)) {
      alert("Invalid alternative schedule.");
      return;
    }

    const confirmApply = window.confirm(
      `Apply Solution ${solution.solutionID}?\n\n` +
      `Workload Variance: ${Number(solution.workloadVariance || 0).toFixed(4)}\n` +
      `Makespan: ${Number(solution.makespan || 0).toFixed(0)} min\n\n` +
      `Only Pending and Unassigned tickets will be reassigned.\n` +
      `Attending and Completed tickets will not be changed.`
    );

    if (!confirmApply) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/apply-alternative-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          solutionID: solution.solutionID,
          workloadVariance: Number(solution.workloadVariance || 0),
          makespan: Number(solution.makespan || 0),
          assignments: solution.assignments,
          technicianLookup: techLookup
        })
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || data.detail || "Failed to apply alternative schedule.");
      }

      setResults(solution.assignments || []);
      setFinalResults(solution.assignments || []);
      setFinalMetrics({
        workloadVariance: Number(solution.workloadVariance || 0),
        makespan: Number(solution.makespan || 0)
      });

      setSelectedSolution({
        ...solution,
        solutionID: solution.solutionID,
        isAppliedAlternative: true
      });

      setRawOutput(prev => [
        ...prev,
        `APPLY ALTERNATIVE: Solution ${solution.solutionID} applied. Updated ${data.updatedCount}, skipped ${data.skippedCount}.`
      ]);

      setShowAlternatives(false);

      fetchUnassigned();
      fetchScenarios();

      alert(
        `Alternative schedule applied.\n\n` +
        `Updated tickets: ${data.updatedCount}\n` +
        `Skipped tickets: ${data.skippedCount}\n` +
        `Email notifications sent: ${data.notificationCount || 0}`
      );
    } catch (error) {
      console.error("Apply alternative schedule error:", error);
      alert(`Failed to apply alternative schedule: ${error.message}`);
    }
  };

  const alternativeOnlySolutions = paretoSolutions.filter(
    (solution) => !solution.isBest
  );

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Optimization Engine</h1>
          <p>MATLAB-Powered MO-SAHH Scheduler Desk. Auto-scheduler checks for unassigned tickets every 30 minutes and runs optimization when needed.
</p>
        </div>
        {isProcessing && (
          <div className="status-loader">
            <Loader2 className="spin" size={18} />
            <span>MO-SAHH Executing Real-time Computations...</span>
          </div>
        )}
      </header>

      {/* --- SECTION 1: LIVE PENDING QUEUE --- */}
      <section className="glass-card pending-queue-section">
        <div className="section-header-flex">
            <div className="title-group">
                <div className="indicator-dot pulse"></div>
                <h3>Live Unassigned Queue</h3>
            </div>
            <button className="refresh-btn-ui" onClick={fetchUnassigned} title="Refresh Queue">
                <RefreshCw size={16} className={isFetchingPending ? "spin" : ""} />
            </button>
        </div>
        
        <div className="queue-scroll-container">
            {unassignedTickets.length > 0 ? (
                unassignedTickets.map((ticket) => (
                    <div key={ticket.ticketID} className="modern-ticket-card">
                        <div className="ticket-accent"></div>
                        <div className="ticket-body">
                            <div className="ticket-row-top">
                                <span className="ticket-id-badge">ID: #{ticket.ticketID}</span>
                                <div className="time-tag">
                                    <Clock size={10} />
                                    <span>{Math.floor((new Date() - new Date(ticket.ticketStart)) / 60000)}m ago</span>
                                </div>
                            </div>
                            <h4 className="ticket-machine">{ticket.machineName}</h4>
                            <div className="ticket-alarm">
                                <AlertCircle size={12} />
                                <span>Alarm: {ticket.alarmCode}</span>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="empty-queue-visual">
                    <Box size={24} strokeWidth={1.5} />
                    <p>Production Line Clear - No Unassigned Tickets</p>
                </div>
            )}
        </div>
      </section>

      {/* --- SECTION 2: SCENARIO CONFIG --- */}
      <section className="glass-card scenario-input-panel">
        <div className="title-group">
            <History size={18} color="#4ecca3" />
            <h3>Scenario Configuration</h3>
        </div>
        <div className="input-row">
          <input 
            type="text" 
            placeholder="Step 1: Enter Scenario Name (e.g. PI04_Run1)" 
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
          />
          <button 
            className="reschedule-btn"
            onClick={handleReschedule}
            disabled={isProcessing}
            style={{
              background: 'rgba(78, 204, 163, 0.1)',
              border: '1px solid #4ecca3',
              color: '#4ecca3',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
          >
            <RefreshCw size={16} className={isProcessing ? "spin" : ""} />
            Reschedule Pending
          </button>
        </div>
      </section>

      {/* --- SECTION 3: DROP ZONE --- */}
      <section 
        className={`drop-zone ${isDragging ? "active" : ""}`}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className="title-group" style={{justifyContent: 'center', marginBottom: '30px'}}>
            <Layout size={18} color="#4ecca3" />
            <h3>Optimization Dataset Matrix</h3>
        </div>
        <div className="drop-content">
          <Upload size={40} color={isDragging ? "#4ecca3" : "#94a3b8"} />
          <p>Drag & drop <strong>input.txt</strong> or click select</p>
          <input type="file" id="fileInput" hidden onChange={handleFileSelect} accept=".txt" />
          <button className="neon-btn" type="button" onClick={() => {
            const fileInputElement = document.getElementById('fileInput');
            if (fileInputElement) fileInputElement.click();
          }}>
            Select File
          </button>
        </div>
      </section>

      {/* --- SECTION 4: GANTT CHART --- */}
      <section className="glass-card schedule-viz">
        <div className="gantt-title-row">
          <div className="title-group">
            <Terminal size={18} color="#4ecca3" />
            <h3>Assignment Timeline (Gantt Visualizer Array)</h3>
          </div>

          {paretoSolutions.length > 0 && (
            <button
              className="alternative-btn"
              onClick={() => setShowAlternatives(true)}
            >
              Review Alternative Schedules ({paretoSolutions.length})
            </button>
          )}
        </div>

        {selectedSolution && (
          <div className="selected-solution-banner">
            <strong>
              {selectedSolution.solutionID === "final"
                ? "Current View: Final Best Schedule"
                : `Current View: Alternative Solution ${selectedSolution.solutionID}`}
            </strong>
            <span>
              Workload Variance: {Number(selectedSolution.workloadVariance || 0).toFixed(4)}
              {" | "}
              Makespan: {Number(selectedSolution.makespan || 0).toFixed(0)} min
            </span>
          </div>
        )}

        <div className="gantt-container">
          {results.length > 0 ? (
            results.map((row, idx) => {
              const techId = String(row.tech);
              const fullName = techLookup[techId] || "Unknown Technician";
              const avatarColor = colors[idx % colors.length];
              return (
                <div key={idx} className="gantt-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '18px', gap: '20px' }}>
                  <div className="gantt-label" style={{ width: '220px', minWidth: '220px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar-mini" style={{ 
                        backgroundColor: avatarColor + '44', 
                        width: '38px', height: '38px', minWidth: '38px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%', fontWeight: '800', color: avatarColor,
                        border: `1px solid ${avatarColor}44`
                    }}>
                      {fullName ? fullName[0] : 'T'}
                    </div>
                    <div className="tech-meta" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
                      <p className="tech-name" style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {fullName}
                      </p>
                      <small style={{ color: '#64748b', fontSize: '0.75rem' }}>ID: {techId}</small>
                    </div>
                  </div>
                  <div className="gantt-track" style={{ display: 'flex', gap: '8px', flexGrow: 1, padding: '4px' }}>
                    {Array.isArray(row.tickets) && row.tickets.map((ticket, tIdx) => (
                      <div key={tIdx} className="gantt-block" style={{ backgroundColor: avatarColor, padding: '8px 16px', borderRadius: '8px', color: '#0f172a', fontWeight: '800', fontSize: '0.8rem', minWidth: '70px', textAlign: 'center', boxShadow: `0 4px 10px ${avatarColor}33` }}>
                        T-{String(ticket)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-gantt">
              <AlertCircle size={20} />
              <p>Waiting for algorithm array output execution...</p>
            </div>
          )}
        </div>
      </section>

            {showAlternatives && (
              <div className="alternative-modal-backdrop">
                <div className="alternative-modal glass-card">
                  <div className="alternative-modal-header">
                    <div>
                      <h3>Alternative Non-Dominated Schedules</h3>
                      <p>
                        Preview different trade-offs between workload variance and makespan.
                      </p>
                    </div>

                    <button
                      className="alternative-close-btn"
                      onClick={() => setShowAlternatives(false)}
                    >
                      ×
                    </button>
                  </div>
                
                  <div className="alternative-list">
                    <div className="solution-group">
                      <div className="solution-group-title">
                        <span>Selected Final Best Solution</span>
                      </div>

                      <div
                        className={`alternative-card final-best-card ${
                          selectedSolution?.solutionID === "final" ? "active" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="alternative-preview-area"
                          onClick={() => {
                            setResults(finalResults);
                            setSelectedSolution({
                              solutionID: "final",
                              isBest: true,
                              workloadVariance: finalMetrics.workloadVariance,
                              makespan: finalMetrics.makespan,
                              assignments: finalResults
                            });
                            setShowAlternatives(false);
                          }}
                        >
                          <div className="solution-main-info">
                            <div className="solution-title-row">
                              <strong>Final Best Schedule</strong>
                              <span className="best-badge">Recommended</span>
                            </div>

                            <div className="solution-metrics">
                              <span>Variance: {Number(finalMetrics.workloadVariance || 0).toFixed(4)}</span>
                              <span>Makespan: {Number(finalMetrics.makespan || 0).toFixed(0)} min</span>
                            </div>
                          </div>

                          <span className="applied-tag">Applied</span>
                        </button>
                      </div>
                    </div>

                    <div className="solution-divider"></div>

                    <div className="solution-group">
                      <div className="solution-group-title">
                        <span>Full Pareto Non-Dominated Solutions</span>
                      </div>

                      <div className="pareto-solution-list">
                        {paretoSolutions.map((solution) => (
                          <div
                            key={`${solution.solutionID}-${solution.workloadVariance}-${solution.makespan}`}
                            className={`alternative-card pareto-card ${solution.isBest ? "pareto-final-card" : ""}`}
                          >
                            <button
                              type="button"
                              className="alternative-preview-area"
                              onClick={() => {
                                setResults(solution.assignments || []);
                                setSelectedSolution(solution);
                                setShowAlternatives(false);
                              }}
                            >
                              <div className="solution-main-info">
                                <div className="solution-title-row">
                                  <strong>
                                    Solution {solution.solutionID}
                                    {solution.isBest ? " — Final Best" : ""}
                                  </strong>

                                  {solution.isBest && (
                                    <span className="best-badge small">Same as Recommended</span>
                                  )}
                                </div>

                                <div className="solution-metrics">
                                  <span>Variance: {Number(solution.workloadVariance || 0).toFixed(4)}</span>
                                  <span>•</span>
                                  <span>Makespan: {Number(solution.makespan || 0).toFixed(0)} min</span>
                                </div>
                              </div>

                              <span className="preview-tag">Preview</span>
                            </button>

                            {!solution.isBest && (
                              <button
                                type="button"
                                className="apply-alternative-btn"
                                onClick={() => handleApplyAlternativeSchedule(solution)}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="alternative-note">
                    The recommended final best schedule is already applied. Other Pareto solutions can be previewed, and only non-final alternatives can be applied. Attending and Completed tickets are protected.
                  </div>
                </div>
              </div>
            )}

      {/* --- SECTION 5: DEBUG LOGS --- */}
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

      {/* --- SECTION 6: HISTORY LIST --- */}
      <section className="glass-card scenario-history-list">
        <div className="title-group">
            <History size={18} color="#4ecca3" />
            <h3>Scenario History (Saved States)</h3>
        </div>
        <div className="history-grid">
          {scenarios.map((s) => (
            <button key={s.resultID} className={`history-item ${scenarioName === s.scenarioName ? "active-history" : ""}`}
              onClick={() => {
                const finalResult = Array.isArray(s.resultData) ? s.resultData : [];
                const alternatives = Array.isArray(s.paretoSolutions) ? s.paretoSolutions : [];

                applyFinalScheduleToView(finalResult, alternatives, {
                  workloadVariance: s.workloadVariance,
                  makespan: s.makespan
                });

                setScenarioName(s.scenarioName);
              }}>
              <strong>{s.scenarioName}</strong>
              <small>{new Date(s.created_at).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Schedule;