import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Activity, Share2, Layers, Play, RefreshCw, TriangleAlert, CircleCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [logs, setLogs] = useState([{ type: 'info', text: 'System initialized. Ready for simulation.' }]);

  // UNIFIED STATE - Shared across all phases
  // We use sorted keys for deterministic Matrix Columns: R1, R2, R3...
  const [resources, setResources] = useState({ R1: 10, R2: 5, R3: 7 });
  const [processes, setProcesses] = useState(['P1', 'P2', 'P3', 'P4', 'P5']);
  const [bankerMatrices, setBankerMatrices] = useState({
    max_demand: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
    allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]]
  });
  const [simSteps, setSimSteps] = useState([
    { process: 'P1', resource: 'R1' },
    { process: 'P2', resource: 'R2' }
  ]);
  const [simulationResult, setSimulationResult] = useState(null);

  // ADVANCED STATE
  const [requestMatrix, setRequestMatrix] = useState([
    [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]
  ]);

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { type, text, time: new Date().toLocaleTimeString() }].slice(-10));
  };

  const syncAddResource = () => {
    // Generate next ID based on existing keys logic
    const resKeys = Object.keys(resources).sort();
    const lastKey = resKeys[resKeys.length - 1] || 'R0';
    const nextId = parseInt(lastKey.substring(1)) + 1;
    const name = `R${nextId}`;
    setResources(prev => ({ ...prev, [name]: 0 }));
    setBankerMatrices(prev => ({
      max_demand: prev.max_demand.map(row => [...row, 0]),
      allocation: prev.allocation.map(row => [...row, 0])
    }));
    setRequestMatrix(prev => prev.map(row => [...row, 0]));
  };

  const syncRemoveResource = (name) => {
    const resKeys = Object.keys(resources);
    const resIdx = resKeys.indexOf(name);
    if (resIdx === -1) return;

    const newResources = { ...resources };
    delete newResources[name];
    setResources(newResources);

    setBankerMatrices(prev => ({
      max_demand: prev.max_demand.map(row => row.filter((_, j) => j !== resIdx)),
      allocation: prev.allocation.map(row => row.filter((_, j) => j !== resIdx))
    }));
    setRequestMatrix(prev => prev.map(row => row.filter((_, j) => j !== resIdx)));

    setSimSteps(prev => prev.filter(s => s.resource !== name));
  };

  const syncAddProcess = () => {
    const nextId = processes.length + 1;
    const name = `P${nextId}`;
    setProcesses(prev => [...prev, name]);
    const numRes = Object.keys(resources).length;
    setBankerMatrices(prev => ({
      max_demand: [...prev.max_demand, Array(numRes).fill(0)],
      allocation: [...prev.allocation, Array(numRes).fill(0)]
    }));
    setRequestMatrix(prev => [...prev, Array(numRes).fill(0)]);
  };

  const syncRemoveProcess = (name) => {
    const procIdx = processes.indexOf(name);
    if (procIdx === -1) return;

    setProcesses(prev => prev.filter(p => p !== name));
    setBankerMatrices(prev => ({
      max_demand: prev.max_demand.filter((_, i) => i !== procIdx),
      allocation: prev.allocation.filter((_, i) => i !== procIdx)
    }));
    setRequestMatrix(prev => prev.filter((_, i) => i !== procIdx));

    setSimSteps(prev => prev.filter(s => s.process !== name));
  };

  const updateResourceUnits = (name, units) => {
    setResources(prev => ({ ...prev, [name]: Number(units) }));
  };

  const updateBankerMatrix = (type, row, col, val) => {
    const newMatrix = [...bankerMatrices[type]];
    newMatrix[row] = [...newMatrix[row]];
    newMatrix[row][col] = Number(val);
    setBankerMatrices(prev => ({ ...prev, [type]: newMatrix }));
  };

  return (
    <div className="app-container">
      <div className="centered-dashboard">
        <header>
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            Nexus Deadlock Core
          </motion.h1>
          <p className="tagline">Unified Resource & Process Management</p>
        </header>

        <main className="dashboard-content">
        <section className="card full-width">
          <h2><Layers size={20} /> System Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h4 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Processes</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {processes.map(p => (
                  <div key={p} className="resource-input" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span style={{ fontWeight: 'bold' }}>{p}</span>
                    <button className="danger-btn" onClick={() => syncRemoveProcess(p)}>×</button>
                  </div>
                ))}
                <button className="secondary compact" onClick={syncAddProcess} style={{ padding: '4px 12px' }}>+ Add Process</button>
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Resources</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {Object.entries(resources).map(([name, units]) => (
                  <div key={name} className="resource-input" style={{ background: 'rgba(25, 212, 191, 0.05)' }}>
                    <span>{name}:</span>
                    <input type="number" value={units} onChange={e => updateResourceUnits(name, e.target.value)} min="0" className="compact" />
                    <button className="danger-btn" onClick={() => syncRemoveResource(name)}>×</button>
                  </div>
                ))}
                <button className="secondary compact" onClick={syncAddResource} style={{ padding: '4px 12px' }}>+ Add Resource</button>
              </div>
            </div>
          </div>
        </section>

        <div className="three-phase-grid">
          <section className="card">
            <SimulationPhase
              addLog={addLog}
              resources={resources}
              processes={processes}
              simSteps={simSteps}
              setSimSteps={setSimSteps}
              setSimulationResult={setSimulationResult}
            />
          </section>
          <section className="card">
            <DetectionPhase
              addLog={addLog}
              simulationResult={simulationResult}
              resources={resources}
              processes={processes}
              bankerMatrices={bankerMatrices}
              updateBankerMatrix={updateBankerMatrix}
            />
          </section>
          <section className="card">
            <BankersPhase
              addLog={addLog}
              resources={resources}
              processes={processes}
              bankerMatrices={bankerMatrices}
              updateBankerMatrix={updateBankerMatrix}
            />
          </section>
        </div>
        <MultiInstanceDetectionPhase
          addLog={addLog}
          resources={resources}
          bankerMatrices={bankerMatrices}
          updateBankerMatrix={updateBankerMatrix}
          requestMatrix={requestMatrix}
          setRequestMatrix={setRequestMatrix}
        />


        <section className="card full-width">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2><Activity size={20} /> Execution Logs</h2>
          </div>
          <div className="terminal">
            {logs.map((log, i) => (
              <div key={i} className={`terminal-line ${log.type}`}>
                <span>[{log.time}]</span>
                {log.text}
              </div>
            ))}
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}



function SimulationPhase({ addLog, resources, processes, simSteps, setSimSteps, setSimulationResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const addStep = () => {
    if (processes.length === 0 || Object.keys(resources).length === 0) return;
    setSimSteps(prev => [...prev, { process: processes[0], resource: Object.keys(resources)[0] }]);
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/simulate`, {
        resources: resources,
        steps: simSteps,
        processes: processes
      });
      setResult(res.data);
      setSimulationResult(res.data);
      addLog('Simulation executed with global parameters.', 'info');
      res.data.steps.forEach(step => {
        addLog(`${step.action}: ${step.success ? 'SUCCESS' : 'DENIED'}`, step.success ? 'success' : 'error');
      });
    } catch (err) {
      addLog('Simulation failed.', 'error');
    }
    setLoading(false);
  };

  return (
    <section className="card">
      <h2><Play size={20} /> Phase 1: Simulation</h2>


      <div style={{ marginBottom: '1.2rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Execution Sequence</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {simSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <select value={step.process} onChange={e => {
                const ns = [...simSteps]; ns[i].process = e.target.value; setSimSteps(ns);
              }}>
                {processes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <span>needs</span>
              <select value={step.resource} onChange={e => {
                const ns = [...simSteps]; ns[i].resource = e.target.value; setSimSteps(ns);
              }}>
                {Object.keys(resources).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button className="danger-btn" onClick={() => setSimSteps(simSteps.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
          <button className="secondary compact" onClick={addStep} style={{ width: 'fit-content' }}>+ Add Step</button>
        </div>
      </div>

      <button onClick={runSimulation} disabled={loading} style={{ width: '100%' }}>
        {loading ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
        {loading ? 'Simulating...' : 'Run Simulation'}
      </button>

      {result && <div className="status-badge status-info" style={{ marginTop: '10px', textAlign: 'center' }}>Simulation Logged</div>}
    </section>
  );
}

function BankersPhase({ addLog, resources, processes, bankerMatrices, updateBankerMatrix }) {
  const [safeStatus, setSafeStatus] = useState(null);
  const [requestProcess, setRequestProcess] = useState(0);
  const [requestUnits, setRequestUnits] = useState(Array(Object.keys(resources).length).fill(0));

  useEffect(() => {
    if (requestUnits.length !== Object.keys(resources).length) {
      setRequestUnits(Array(Object.keys(resources).length).fill(0));
    }
  }, [resources]);

  const checkSafe = async () => {
    try {
      const res = await axios.post(`${API_BASE}/banker/safe`, {
        total: Object.values(resources),
        max_demand: bankerMatrices.max_demand,
        allocation: bankerMatrices.allocation
      });
      setSafeStatus(res.data);
      addLog(`Safety Analysis: System is ${res.data.safe ? 'SAFE' : 'UNSAFE'}`, res.data.safe ? 'success' : 'error');
    } catch (err) { addLog('Safety check failed.', 'error'); }
  };

  const submitRequest = async () => {
    try {
      const res = await axios.post(`${API_BASE}/banker/request`, {
        total: Object.values(resources),
        max_demand: bankerMatrices.max_demand,
        allocation: bankerMatrices.allocation,
        process_idx: requestProcess,
        request: requestUnits
      });
      if (res.data.granted) {
        res.data.new_allocation.forEach((row, i) => {
          row.forEach((val, j) => updateBankerMatrix('allocation', i, j, val));
        });
        addLog(`Request GRANTED for P${requestProcess + 1}. Safe Sequence: ${res.data.sequence.join(' → ')}`, 'success');
        setRequestUnits(Array(Object.keys(resources).length).fill(0));
      } else {
        addLog(`Request DENIED for P${requestProcess + 1} (Unsafe State)`, 'error');
      }
    } catch (err) { 
      console.error('Request error:', err.response?.data || err.message);
      addLog(`Request failed: ${err.response?.data?.error || err.message}`, 'error'); 
    }
  };

  return (
    <section>
      <h2><Shield size={20} /> Phase 3: Avoidance</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="grid-table compact-table">
          <thead>
            <tr><th>Proc</th><th>Max Demand</th><th>Alloc</th><th>Need</th></tr>
          </thead>
          <tbody>
            {processes.map((pName, i) => (
              <tr key={pName}>
                <td>{pName}</td>
                <td><div style={{ display: 'flex', gap: '2px' }}>{bankerMatrices.max_demand[i].map((v, j) => <input key={j} type="number" className="compact" value={v} onChange={e => updateBankerMatrix('max_demand', i, j, e.target.value)} />)}</div></td>
                <td><div style={{ display: 'flex', gap: '2px' }}>{bankerMatrices.allocation[i].map((v, j) => <input key={j} type="number" className="compact" value={v} onChange={e => updateBankerMatrix('allocation', i, j, e.target.value)} />)}</div></td>
                <td><span style={{ fontSize: '10px' }}>{bankerMatrices.max_demand[i].map((m, j) => m - bankerMatrices.allocation[i][j]).join(',')}</span></td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(25, 212, 191, 0.1)' }}>
              <td style={{ fontWeight: 'bold' }}>Available</td>
              <td colSpan="3">
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Object.keys(resources).map((rName, j) => {
                    const totalRes = resources[rName];
                    const allocSum = bankerMatrices.allocation.reduce((sum, row) => sum + row[j], 0);
                    const available = totalRes - allocSum;
                    return <span key={j} style={{ minWidth: '40px', textAlign: 'center', padding: '4px 8px', background: 'rgba(255, 140, 0, 0.2)', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{available}</span>;
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="secondary" onClick={checkSafe} style={{ width: '100%', marginTop: '1rem' }}>Check Safe State</button>
      {safeStatus && (
        <div className={`status-badge ${safeStatus.safe ? 'status-safe' : 'status-danger'}`} style={{ marginTop: '1rem', textAlign: 'center' }}>
          {safeStatus.safe ? `Seq: ${safeStatus.sequence.join(' → ')}` : 'System Unsafe!'}
        </div>
      )}
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
        <h3>Submit Request</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem', alignItems: 'end', marginTop: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Process</label>
            <select value={requestProcess} onChange={e => setRequestProcess(Number(e.target.value))} style={{ width: '100%' }}>
              {processes.map((p, i) => <option key={p} value={i}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Request Units</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '0.5rem' }}>
              {Object.keys(resources).map((rName, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{rName}</span>
                  <input 
                    type="number" 
                    value={requestUnits[i] || 0}
                    onChange={e => {
                      const nr = [...requestUnits]; 
                      nr[i] = Number(e.target.value); 
                      setRequestUnits(nr);
                    }} 
                    style={{ width: '100%', minWidth: '60px', padding: '0.4rem' }}
                    min="0"
                  />
                </div>
              ))}
            </div>
          </div>
          <button onClick={submitRequest} style={{ width: '100%', padding: '0.6rem 1rem' }}>Send Request</button>
        </div>
      </div>
    </section>
  );
}

function DetectionPhase({ addLog, simulationResult, resources, processes, bankerMatrices, updateBankerMatrix }) {
  const [deadlockState, setDeadlockState] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [recoveryData, setRecoveryData] = useState(null);

  const checkGraph = async () => {
    if (!simulationResult) {
      addLog('No simulation data found. Run Phase 1 first.', 'error');
      return;
    }

    const nodes = [];
    const edges = [];

    // Correct OS Theory Mapping:
    // Allocation: R -> P (Resource held by Process)
    // Request: P -> R (Process waiting for Resource)

    Object.keys(resources).forEach(r => nodes.push({ id: r, type: 'resource' }));
    Object.keys(simulationResult.processes).forEach(p => nodes.push({ id: p, type: 'process' }));

    Object.entries(simulationResult.processes).forEach(([pName, allocations]) => {
      Object.entries(allocations).forEach(([rName, units]) => {
        if (units > 0) edges.push({ from: rName, to: pName, type: 'allocation' });
      });
    });

    simulationResult.steps.forEach(step => {
      if (!step.success) {
        const parts = step.action.split(' ');
        if (parts.length >= 3) {
          const pName = parts[0];
          const rName = parts[2];
          edges.push({ from: pName, to: rName, type: 'request' });
        }
      }
    });

    setGraphData({ nodes, edges });

    try {
      const res = await axios.post(`${API_BASE}/detect`, {
        nodes: nodes.map(n => n.id),
        edges: edges.map(e => [e.from, e.to])
      });
      setDeadlockState(res.data.deadlock);
      addLog(`RAG Analysis: ${res.data.deadlock ? 'DEADLOCK' : 'SAFE'}`, res.data.deadlock ? 'error' : 'success');

      if (res.data.deadlock) {
        handleRecovery();
      }
    } catch (err) { addLog('Graph analysis failed.', 'error'); }
  };

  const handleRecovery = async () => {
    try {
      const res = await axios.post(`${API_BASE}/recovery`, {
        processes: processes,
        allocation: bankerMatrices.allocation,
        max_demand: bankerMatrices.max_demand,
        resources: Object.keys(resources)
      });
      setRecoveryData(res.data);
      addLog(`Recovery Suggestion: Terminate ${res.data.victim.name}`, 'warning');
    } catch (err) { console.error('Recovery failed'); }
  };

  const applyRecovery = () => {
    if (!recoveryData) return;
    const { victim, new_allocation } = recoveryData;

    // In our simplified logic, termination releases all resources
    new_allocation.forEach((row, i) => {
      row.forEach((val, j) => updateBankerMatrix('allocation', i, j, val));
    });

    addLog(`System Recovered: ${victim.name} terminated.`, 'success');
    setRecoveryData(null);
    setDeadlockState(false);
  };

  return (
    <section>
      <h2><Share2 size={20} /> Phase 2: Detection & Recovery</h2>
      <p className="helper-text">
        Graph Analysis uses R→P (Hold) and P→R (Request) edges.
      </p>

      <div className="rag-svg-container">
        <VisualRAG data={graphData} />
      </div>

      <button className="secondary" onClick={checkGraph} style={{ width: '100%', marginBottom: '1rem' }}>
        Run RAG Analysis
      </button>

      {deadlockState !== null && (
        <div className={`status-badge ${deadlockState ? 'status-danger' : 'status-safe'}`} style={{ width: '100%' }}>
          {deadlockState ? 'Deadlock (Circular Wait) Found!' : 'No Resource Deadlocks Found'}
        </div>
      )}

      {recoveryData && (
        <div className="recovery-card">
          <h4 style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>Deadlock Recovery Required</h4>
          <p style={{ fontSize: '0.8rem', margin: '0.5rem 0' }}>
            Recommended Victim: <span className="victim-highlight">{recoveryData.victim.name}</span>
          </p>
          <button className="compact" onClick={applyRecovery} style={{ background: 'var(--danger)', color: '#fff', width: '100%' }}>
            Terminate & Reclaim Resources
          </button>
        </div>
      )}
    </section>
  );
}

function VisualRAG({ data }) {
  if (data.nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
        <Share2 size={40} />
      </div>
    );
  }

  const width = 400;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 100;

  const nodePos = {};
  data.nodes.forEach((node, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI;
    nodePos[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-muted)" />
        </marker>
        <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--danger)" />
        </marker>
      </defs>

      {data.edges.map((edge, i) => {
        const start = nodePos[edge.from];
        const end = nodePos[edge.to];
        const isRequest = edge.type === 'request';
        return (
          <line
            key={i}
            x1={start.x} y1={start.y}
            x2={end.x} y2={end.y}
            stroke={isRequest ? 'var(--danger)' : 'var(--accent-primary)'}
            strokeWidth="1.5"
            strokeDasharray={isRequest ? "4" : "0"}
            markerEnd={`url(#${isRequest ? 'arrowhead-red' : 'arrowhead'})`}
            className="rag-edge"
          />
        );
      })}

      {data.nodes.map((node, i) => (
        <g key={i} transform={`translate(${nodePos[node.id].x}, ${nodePos[node.id].y})`}>
          {node.type === 'resource' ? (
            <rect x="-15" y="-15" width="30" height="30" rx="4" fill="var(--bg-card)" stroke="var(--accent-primary)" strokeWidth="2" />
          ) : (
            <circle r="15" fill="var(--bg-card)" stroke="var(--accent-secondary)" strokeWidth="2" />
          )}
          <text textAnchor="middle" dy=".3em" fontSize="10" fill="white" fontWeight="bold">{node.id}</text>
        </g>
      ))}
    </svg>
  );
}


function MultiInstanceDetectionPhase({ addLog, resources, bankerMatrices, updateBankerMatrix, requestMatrix, setRequestMatrix }) {
  const [deadlockInfo, setDeadlockInfo] = useState(null);
  const [manualAvailable, setManualAvailable] = useState(null);

  // Derive Available from Total Resources - Total Allocated
  const resNames = Object.keys(resources).sort(); // Sort to ensure Matrix Columns match R1, R2, R3...
  const totalResources = resNames.map(name => resources[name]);
  const numProcs = bankerMatrices.allocation.length;
  const numRes = resNames.length;

  const currentAllocated = new Array(numRes).fill(0);
  bankerMatrices.allocation.forEach(row => {
    row.forEach((val, j) => {
      currentAllocated[j] += val;
    });
  });

  const calculatedAvailable = totalResources.map((total, i) => total - currentAllocated[i]);
  const available = manualAvailable || calculatedAvailable;

  const handleAvailableChange = (idx, val) => {
    const newVal = Number(val);
    if (manualAvailable) {
      const newManual = [...manualAvailable];
      newManual[idx] = newVal;
      setManualAvailable(newManual);
    } else {
      const newManual = [...calculatedAvailable];
      newManual[idx] = newVal;
      setManualAvailable(newManual);
    }
  };

  const resetAvailable = () => setManualAvailable(null);

  const runDetection = async () => {
    try {
      const res = await axios.post(`${API_BASE}/detect/multi`, {
        available: available,
        allocation: bankerMatrices.allocation,
        request: requestMatrix
      });
      setDeadlockInfo(res.data);
      addLog(`Multi-Instance Analysis: ${res.data.deadlock ? 'DEADLOCK FOUND' : 'NO DEADLOCK'}`, res.data.deadlock ? 'error' : 'success');
    } catch (err) { addLog('Detection failed.', 'error'); }
  };

  const updateRequest = (i, j, val) => {
    const newReq = requestMatrix.map(row => [...row]);
    newReq[i][j] = Number(val);
    setRequestMatrix(newReq);
  };

  return (
    <section className="card full-width" style={{ marginTop: '1rem', borderTop: '1px dashed var(--glass-border)' }}>
      <h3><Share2 size={18} /> Multi-Instance Deadlock Detection</h3>
      <p className="helper-text">
        Checks if the <strong>Current State</strong> (Allocation + Pending Requests) is deadlocked.
        Differs from Banker's (Avoidance) which checks <em>Future</em> Maximum Needs.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '2rem', marginTop: '1rem' }}>
        <div>
          <h4>Current Available</h4>
          <div style={{ display: 'flex', gap: '5px' }}>
            {available.map((v, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px' }}>{resNames[i]}</div>
                <input
                  type="number"
                  className="compact"
                  value={v}
                  onChange={e => handleAvailableChange(i, e.target.value)}
                  style={{ border: manualAvailable ? '1px solid var(--accent-secondary)' : '' }}
                />
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>(Editable)</span>
            {manualAvailable && <button className="compact secondary" onClick={resetAvailable} style={{ fontSize: '10px', padding: '2px 6px' }}>Reset</button>}
          </div>
        </div>
        <div>
          <h4>Allocation (Shared)</h4>
          {bankerMatrices.allocation.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              <span style={{ fontSize: '12px', width: '20px' }}>P{i + 1}</span>
              {row.map((v, j) => (
                <input
                  key={j}
                  type="number"
                  className="compact"
                  value={v}
                  onChange={e => updateBankerMatrix('allocation', i, j, e.target.value)}
                />
              ))}
            </div>
          ))}
        </div>
        <div>
          <h4>Current Requests</h4>
          {requestMatrix.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
              <span style={{ fontSize: '12px', width: '20px' }}>P{i + 1}</span>
              {row.map((v, j) => (
                <input
                  key={j}
                  type="number"
                  className="compact"
                  value={v}
                  onChange={e => updateRequest(i, j, e.target.value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <button className="secondary" onClick={runDetection} style={{ width: '100%', marginTop: '1.5rem' }}>
        Run Detection Algorithm
      </button>
      {deadlockInfo && (
        <div className={`status-badge ${deadlockInfo.deadlock ? 'status-danger' : 'status-safe'}`} style={{ width: '100%', marginTop: '1rem' }}>
          {deadlockInfo.deadlock
            ? `Deadlocked Processes: ${deadlockInfo.deadlocked_processes.map(p => `P${p}`).join(', ')}`
            : 'System is Deadlock-Free'}
        </div>
      )}
    </section>
  );
}

export default App;
