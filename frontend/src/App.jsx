import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import html2pdf from 'html2pdf.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Step Progress Bar ──────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = [
    { num: 1, label: 'Patient Info' },
    { num: 2, label: 'Upload Report' },
    { num: 3, label: 'Analysis' },
    { num: 4, label: 'AI Doctor' },
  ];
  return (
    <div className="step-bar">
      {steps.map((s, i) => (
        <React.Fragment key={s.num}>
          <div className={`step-item ${current >= s.num ? 'active' : ''} ${current === s.num ? 'current' : ''}`}>
            <div className="step-circle">{current > s.num ? '✓' : s.num}</div>
            <span className="step-label">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`step-line ${current > s.num ? 'done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Step 1: Patient Intake ─────────────────────────────────────────────────
function PatientIntake({ onComplete }) {
  const [form, setForm] = useState({ name: '', age: '', gender: '', height: '', weight: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bmi = form.height && form.weight
    ? (form.weight / ((form.height / 100) ** 2)).toFixed(1)
    : null;

  const bmiCategory = (val) => {
    if (val < 18.5) return { label: 'Underweight', color: '#58a6ff' };
    if (val < 25) return { label: 'Normal', color: '#3fb950' };
    if (val < 30) return { label: 'Overweight', color: '#d29922' };
    return { label: 'Obese', color: '#f85149' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/patient/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          age: parseInt(form.age),
          gender: form.gender,
          height: parseFloat(form.height),
          weight: parseFloat(form.weight),
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        onComplete(data.session_id, data.patient_info);
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch {
      setError('Cannot connect to the server. Make sure the backend is running.');
    }
    setLoading(false);
  };

  return (
    <div className="step-content fade-in">
      <div className="intake-card">
        <div className="intake-header">
          <div className="intake-icon">🩺</div>
          <h2>Patient Information</h2>
          <p>Tell us about yourself so we can provide personalized health insights</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-3">
            <div className="form-group span-full">
              <label>Full Name</label>
              <input type="text" placeholder="Enter your name" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Age (years)</label>
              <input type="number" placeholder="e.g. 32" value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })} required min="1" max="120" />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Height (cm)</label>
              <input type="number" placeholder="e.g. 170" value={form.height}
                onChange={e => setForm({ ...form, height: e.target.value })} required min="50" max="250" />
            </div>
            <div className="form-group">
              <label>Weight (kg)</label>
              <input type="number" placeholder="e.g. 70" value={form.weight}
                onChange={e => setForm({ ...form, weight: e.target.value })} required min="10" max="300" />
            </div>
            {bmi && (
              <div className="form-group bmi-display">
                <label>Your BMI</label>
                <div className="bmi-value" style={{ '--bmi-color': bmiCategory(parseFloat(bmi)).color }}>
                  <span className="bmi-number">{bmi}</span>
                  <span className="bmi-label" style={{ color: bmiCategory(parseFloat(bmi)).color }}>
                    {bmiCategory(parseFloat(bmi)).label}
                  </span>
                </div>
              </div>
            )}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Continue to Upload Report →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Step 2: Upload Report ──────────────────────────────────────────────────
function UploadReport({ sessionId, patientInfo, onComplete }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress('Reading your report with AI Vision...');

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('file', file);

    try {
      const res = await fetch(`${API}/report/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        setProgress('Analyzing your report...');
        // Now analyze
        const analyzeForm = new FormData();
        analyzeForm.append('session_id', sessionId);
        const res2 = await fetch(`${API}/report/analyze`, { method: 'POST', body: analyzeForm });
        const data2 = await res2.json();
        if (data2.status === 'success') {
          onComplete(data.extracted_data, data2.analysis);
        } else {
          setError('Analysis failed: ' + (data2.detail || 'Unknown error'));
        }
      } else {
        setError('Upload failed: ' + (data.detail || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to process report. Check if backend is running.');
    }
    setUploading(false);
    setProgress('');
  };

  return (
    <div className="step-content fade-in">
      <div className="upload-card">
        <div className="intake-header">
          <div className="intake-icon">📄</div>
          <h2>Upload Health Report</h2>
          <p>Upload your blood test, CBC, or any lab report — our AI will read and analyze every parameter</p>
        </div>

        <div className="patient-summary-bar">
          <span>👤 {patientInfo.name}</span>
          <span>🎂 {patientInfo.age} yrs</span>
          <span>⚖️ BMI: {patientInfo.bmi}</span>
        </div>

        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            hidden
            onChange={e => setFile(e.target.files[0])}
          />
          {file ? (
            <div className="file-selected">
              <div className="file-icon">📋</div>
              <div className="file-name">{file.name}</div>
              <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <div className="drop-placeholder">
              <div className="drop-icon">☁️</div>
              <div className="drop-text">Drag & Drop your report here</div>
              <div className="drop-sub">or click to browse — PDF, PNG, JPG supported</div>
            </div>
          )}
        </div>

        {uploading && (
          <div className="processing-indicator">
            <div className="spinner" />
            <span>{progress}</span>
          </div>
        )}

        {error && <div className="error-msg">{error}</div>}

        <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Processing with AI...' : '🔬 Analyze My Report'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 & 4: Analysis + Chat ────────────────────────────────────────────
function AnalysisDashboard({ sessionId, patientInfo, extractedData, analysis }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: `Hello ${patientInfo.name}! 👋 I'm Dr. HealthAI. I've reviewed your complete health report. Feel free to ask me anything — like "What does my hemoglobin level mean?" or "Should I be worried about my cholesterol?". I'm here to help! 😊`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const downloadPDF = () => {
    const element = document.getElementById('report-content');
    const opt = {
      margin:       0.5,
      filename:     `${patientInfo.name}_Health_Report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleTTS = (text) => {
    if (!window.speechSynthesis) return alert("Text-to-speech not supported in your browser.");
    window.speechSynthesis.cancel(); // Stop any currently playing audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const healthScore = Math.max(0, 100 - ((analysis.concerning_findings?.length || 0) * 10) - ((analysis.disease_risks?.length || 0) * 15));


  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    const newMsgs = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMsgs);
    setChatInput('');
    setLoadingChat(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userMsg }),
      });
      const data = await res.json();
      setMessages([...newMsgs, { role: 'ai', text: data.response || 'No response.' }]);
    } catch {
      setMessages([...newMsgs, { role: 'ai', text: 'Error contacting the AI. Please check the backend.' }]);
    }
    setLoadingChat(false);
  };

  const quickQuestions = [
    "Explain my report in simple words",
    "What should I eat to improve?",
    "Should I see a specialist?",
    "Are there any urgent concerns?",
  ];

  const severityIcon = (s) => s === 'serious' ? '🔴' : s === 'moderate' ? '🟠' : '🟡';
  const urgencyIcon = (u) => u === 'urgent' ? '🔴' : u === 'soon' ? '🟠' : '🟢';
  const riskIcon = (r) => r === 'high' ? '🔴' : r === 'moderate' ? '🟠' : '🟢';

  return (
    <div className="analysis-layout fade-in">
      {/* Left: Analysis */}
      <div className="analysis-panel" id="report-content">
        <div className="analysis-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="patient-badge-large">
            <div className="avatar">{patientInfo.name?.charAt(0)?.toUpperCase()}</div>
            <div>
              <h3>{patientInfo.name}'s Health Report</h3>
              <span>{patientInfo.age} yrs • {patientInfo.gender} • BMI: {patientInfo.bmi}</span>
            </div>
          </div>
          <button className="btn-secondary" onClick={downloadPDF} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', backgroundColor: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', transition: 'all 0.2s' }}>
            📄 Download PDF
          </button>
        </div>

        {/* Summary */}
        {analysis.summary && (
          <div className="summary-card">
            <p>{analysis.summary}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="analysis-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            📊 Overview
          </button>
          <button className={activeTab === 'good' ? 'active' : ''} onClick={() => setActiveTab('good')}>
            ✅ Good ({analysis.good_findings?.length || 0})
          </button>
          <button className={activeTab === 'bad' ? 'active' : ''} onClick={() => setActiveTab('bad')}>
            ⚠️ Concerns ({analysis.concerning_findings?.length || 0})
          </button>
          <button className={activeTab === 'risks' ? 'active' : ''} onClick={() => setActiveTab('risks')}>
            🔴 Risks ({analysis.disease_risks?.length || 0})
          </button>
          <button className={activeTab === 'tests' ? 'active' : ''} onClick={() => setActiveTab('tests')}>
            🧪 Follow-up ({analysis.follow_up_tests?.length || 0})
          </button>
        </div>

        <div className="analysis-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-grid">
              {/* Health Score Component */}
              <div className="stat-card span-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(63,185,80,0.1) 0%, rgba(88,166,255,0.1) 100%)', border: '1px solid rgba(63,185,80,0.2)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Overall Wellness Score</h4>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Based on analyzed report parameters</p>
                </div>
                <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `conic-gradient(${healthScore > 80 ? '#3fb950' : healthScore > 50 ? '#d29922' : '#f85149'} ${healthScore}%, transparent 0)` }}>
                  <div style={{ position: 'absolute', width: '70px', height: '70px', backgroundColor: 'var(--panel-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {healthScore}
                  </div>
                </div>
              </div>

              <div className="stat-card good">
                <div className="stat-number">{analysis.good_findings?.length || 0}</div>
                <div className="stat-label">Normal Parameters</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-number">{analysis.concerning_findings?.length || 0}</div>
                <div className="stat-label">Concerning Findings</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-number">{analysis.disease_risks?.length || 0}</div>
                <div className="stat-label">Potential Risks</div>
              </div>
              <div className="stat-card info">
                <div className="stat-number">{analysis.follow_up_tests?.length || 0}</div>
                <div className="stat-label">Follow-up Tests</div>
              </div>

              {analysis.lifestyle_tips?.length > 0 && (
                <div className="lifestyle-section">
                  <h4>💡 Personalized Tips</h4>
                  <ul>
                    {analysis.lifestyle_tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Correlation Plot Restoration */}
              <div className="lifestyle-section" style={{ marginTop: '1rem' }}>
                <h4>📈 Population Correlation Analysis</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  A reference visualization of health metrics across our patient database tracking correlations.
                </p>
                <img src={`${API}/static/correlation.png`} alt="Correlation Matrix" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--panel-border)' }} />
              </div>
            </div>
          )}

          {/* Good Findings Tab */}
          {activeTab === 'good' && (
            <div className="findings-list">
              {analysis.good_findings?.length === 0 && <div className="empty-state">No findings in this category</div>}
              {analysis.good_findings?.map((f, i) => (
                <div key={i} className="finding-card good">
                  <div className="finding-header">
                    <span className="finding-name">✅ {f.parameter}</span>
                    <span className="finding-value">{f.value}</span>
                  </div>
                  <p className="finding-explain">{f.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Concerning Findings Tab */}
          {activeTab === 'bad' && (
            <div className="findings-list">
              {analysis.concerning_findings?.length === 0 && <div className="empty-state">No concerning findings — great news! 🎉</div>}
              {analysis.concerning_findings?.map((f, i) => (
                <div key={i} className="finding-card concern">
                  <div className="finding-header">
                    <span className="finding-name">{severityIcon(f.severity)} {f.parameter}</span>
                    <span className="finding-value">{f.value}</span>
                  </div>
                  <span className={`severity-badge ${f.severity}`}>{f.severity}</span>
                  <p className="finding-explain">{f.explanation}</p>
                  {f.what_to_do && <p className="finding-action">💊 {f.what_to_do}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Disease Risks Tab */}
          {activeTab === 'risks' && (
            <div className="findings-list">
              {analysis.disease_risks?.length === 0 && <div className="empty-state">No significant disease risks detected 🎉</div>}
              {analysis.disease_risks?.map((r, i) => (
                <div key={i} className="finding-card risk">
                  <div className="finding-header">
                    <span className="finding-name">{riskIcon(r.risk_level)} {r.disease}</span>
                    <span className={`risk-badge ${r.risk_level}`}>{r.risk_level} risk</span>
                  </div>
                  <p className="finding-explain">{r.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Follow-up Tests Tab */}
          {activeTab === 'tests' && (
            <div className="findings-list">
              {analysis.follow_up_tests?.length === 0 && <div className="empty-state">No follow-up tests recommended</div>}
              {analysis.follow_up_tests?.map((t, i) => (
                <div key={i} className="finding-card test">
                  <div className="finding-header">
                    <span className="finding-name">🧪 {t.test_name}</span>
                    <span className={`urgency-badge ${t.urgency}`}>{urgencyIcon(t.urgency)} {t.urgency}</span>
                  </div>
                  <p className="finding-explain">{t.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Doctor Chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <div className="doctor-badge">
            <div className="doctor-avatar">🤖</div>
            <div>
              <h3>Dr. HealthAI</h3>
              <span className="online-status">● Online — Aware of your full report</span>
            </div>
          </div>
        </div>

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`}>
              {m.role === 'ai' && <div className="msg-avatar">🤖</div>}
              <div className="msg-content">
                <div className="msg-text">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
                {m.role === 'ai' && (
                  <button className="btn-tts" onClick={() => handleTTS(m.text)} title="Read Aloud" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '1.2rem', padding: '0.2rem', marginTop: '0.5rem' }}>
                    🔊
                  </button>
                )}
              </div>
            </div>
          ))}
          {loadingChat && (
            <div className="msg msg-ai">
              <div className="msg-avatar">🤖</div>
              <div className="msg-content">
                <div className="msg-text thinking">
                  Dr. HealthAI is thinking<span className="loading-dots"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div className="quick-questions">
            {quickQuestions.map((q, i) => (
              <button key={i} className="quick-btn" onClick={() => { setChatInput(q); }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <form className="chat-input-area" onSubmit={sendMessage}>
          <input
            type="text"
            placeholder="Ask Dr. HealthAI about your report..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            disabled={loadingChat}
          />
          <button type="submit" className="btn-send" disabled={loadingChat || !chatInput.trim()}>
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="logo-area">
          <div className="logo-icon">
            <span className="logo-pulse"></span>
            H
          </div>
          <div className="logo-text">Health<span>AI</span> Diagnostics</div>
        </div>
        <div className="status-badges">
          <div className="badge">
            <span className="badge-dot green"></span>
            Gemini 2.5 Flash
          </div>
          <div className="badge">
            <span className="badge-dot blue"></span>
            Vision + RAG Active
          </div>
        </div>
      </header>

      {step < 3 && <StepBar current={step} />}

      <main className="main-area">
        {step === 1 && (
          <PatientIntake onComplete={(sid, info) => {
            setSessionId(sid);
            setPatientInfo(info);
            setStep(2);
          }} />
        )}
        {step === 2 && (
          <UploadReport
            sessionId={sessionId}
            patientInfo={patientInfo}
            onComplete={(extracted, analyzed) => {
              setExtractedData(extracted);
              setAnalysis(analyzed);
              setStep(3);
            }}
          />
        )}
        {step >= 3 && analysis && (
          <AnalysisDashboard
            sessionId={sessionId}
            patientInfo={patientInfo}
            extractedData={extractedData}
            analysis={analysis}
          />
        )}
      </main>
    </div>
  );
}
