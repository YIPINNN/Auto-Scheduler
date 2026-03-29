import React, { useState, useEffect } from "react";
import supabase from "../../config/supabaseClient";
import { Upload, Play, CheckCircle } from 'lucide-react';
import "./Schedule.css";

const Schedule = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock Data for the Sequence-based Gantt
  const scheduleData = [
    { tech: "Ahmad", tasks: ["T-001", "T-005", "T-009"], color: "#4ecca3" },
    { tech: "Sarah", tasks: ["T-002", "T-004"], color: "#3b82f6" },
    { tech: "Logen", tasks: ["T-003", "T-007", "T-008", "T-012"], color: "#a855f7" },
  ];

  const handleDrag = (e) => {
    e.preventDefault();
    setIsDragging(e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setIsProcessing(true);
    
    // Simulate MO-SAHH algorithm trigger
    setTimeout(() => {
      setIsProcessing(false);
      alert("MO-SAHH Algorithm: Optimization Complete!");
    }, 2000);
  };

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Optimization Engine</h1>
          <p>Sequence-based Technician Assignment</p>
        </div>
        {isProcessing && <span className="loader-text">🤖 Algorithm Running...</span>}
      </header>

      {/* 1. DROP ZONE */}
      <section 
        className={`drop-zone ${isDragging ? "active" : ""}`}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className="drop-content">
          <Upload size={40} color={isDragging ? "#4ecca3" : "#94a3b8"} />
          <h3>Drop Ticket Dataset</h3>
          <p>Drag & drop txt file to trigger **MO-SAHH** optimization</p>
          <button className="neon-btn">Select File</button>
        </div>
      </section>

      {/* 2. SEQUENCE GANTT CHART */}
      <section className="glass-card schedule-viz">
        <h3>Assignment Timeline (By Ticket Sequence)</h3>
        <div className="gantt-container">
          {scheduleData.map((row, idx) => (
            <div key={idx} className="gantt-row">
              <div className="gantt-label">
                <div className="avatar-mini">{row.tech[0]}</div>
                <span>{row.tech}</span>
              </div>
              <div className="gantt-track">
                {row.tasks.map((task, tIdx) => (
                  <div 
                    key={tIdx} 
                    className="gantt-block" 
                    style={{ backgroundColor: row.color }}
                  >
                    {task}
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {/* X-AXIS Labels */}
          <div className="gantt-axis">
            <div className="axis-spacer"></div>
            <div className="axis-labels">
              <span>Sequence 1</span>
              <span>Sequence 2</span>
              <span>Sequence 3</span>
              <span>Sequence 4</span>
              <span>Sequence 5</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Schedule;