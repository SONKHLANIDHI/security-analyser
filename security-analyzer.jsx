import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are SENTINEL — an elite AI security analyst specializing in code vulnerability detection.

Analyze the provided code for security vulnerabilities. Return ONLY a valid JSON object (no markdown, no backticks) in this exact shape:

{
  "summary": "One-sentence overall security verdict",
  "riskScore": <integer 0-100>,
  "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE",
  "vulnerabilities": [
    {
      "id": "VULN-001",
      "title": "Short vulnerability name",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "e.g. Injection, XSS, Auth, Crypto, IDOR, SSRF, DoS, etc.",
      "description": "Clear explanation of the vulnerability",
      "lineRef": "e.g. Line 12-15 or 'Multiple locations'",
      "fix": "Concrete fix recommendation"
    }
  ],
  "positives": ["list", "of", "good", "security", "practices", "found"],
  "recommendations": ["Top", "overall", "recommendations"]
}

Be thorough, precise, and technical. If no vulnerabilities found, return empty array and riskScore ≤ 10.`;

const SEVERITY_CONFIG = {
  CRITICAL: { color: "#ff2d55", bg: "rgba(255,45,85,0.12)", border: "rgba(255,45,85,0.4)", glyph: "◈" },
  HIGH:     { color: "#ff9500", bg: "rgba(255,149,0,0.12)",  border: "rgba(255,149,0,0.4)",  glyph: "◆" },
  MEDIUM:   { color: "#ffd60a", bg: "rgba(255,214,10,0.1)",  border: "rgba(255,214,10,0.35)", glyph: "◇" },
  LOW:      { color: "#30d158", bg: "rgba(48,209,88,0.1)",   border: "rgba(48,209,88,0.3)",  glyph: "○" },
  SAFE:     { color: "#30d158", bg: "rgba(48,209,88,0.1)",   border: "rgba(48,209,88,0.3)",  glyph: "✓" },
};

const PLACEHOLDER = `// Paste any code here for analysis
// Supports: JavaScript, Python, Go, Java, PHP, C/C++, etc.

function login(req, res) {
  const { username, password } = req.body;
  const query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;
  db.query(query, (err, result) => {
    if (result.length > 0) {
      req.session.user = result[0];
      res.redirect('/dashboard');
    }
  });
}`;

function ScoreRing({ score, level }) {
  const cfg = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.SAFE;
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
      <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={cfg.color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${cfg.color})`, transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginTop: 2 }}>RISK</span>
      </div>
    </div>
  );
}

function VulnCard({ vuln, index }) {
  const [open, setOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[vuln.severity] || SEVERITY_CONFIG.LOW;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 6, marginBottom: 8, cursor: "pointer",
        transition: "all 0.2s",
        animation: `slideIn 0.3s ease ${index * 0.07}s both`,
      }}
    >
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: cfg.color, fontSize: 16, flexShrink: 0 }}>{cfg.glyph}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{vuln.title}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              color: cfg.color, background: cfg.bg,
              border: `1px solid ${cfg.border}`, borderRadius: 3,
              padding: "1px 6px",
            }}>{vuln.severity}</span>
            <span style={{
              fontSize: 10, color: "rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.05)", borderRadius: 3,
              padding: "1px 6px",
            }}>{vuln.category}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {vuln.id} · {vuln.lineRef}
          </div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${cfg.border}` }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "10px 0 8px", lineHeight: 1.6 }}>{vuln.description}</p>
          <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "10px 12px", borderLeft: `3px solid ${cfg.color}` }}>
            <div style={{ fontSize: 10, color: cfg.color, letterSpacing: 1.5, marginBottom: 4, fontWeight: 700 }}>FIX</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.6 }}>{vuln.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Typing({ text }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(iv);
    }, 18);
    return () => clearInterval(iv);
  }, [text]);
  return <span>{displayed}<span style={{ animation: "blink 1s step-end infinite", color: "#00ff88" }}>█</span></span>;
}

export default function SecurityAnalyzer() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanLog, setScanLog] = useState([]);
  const logRef = useRef(null);

  const LOGS = [
    "Initializing SENTINEL engine...",
    "Parsing AST and control flow graph...",
    "Running OWASP Top 10 ruleset...",
    "Checking injection vectors (SQLi, XSS, XXE)...",
    "Auditing authentication & session logic...",
    "Scanning cryptographic implementations...",
    "Analyzing dependency attack surface...",
    "Evaluating access control patterns...",
    "Cross-referencing CVE database...",
    "Generating threat model report...",
  ];

  async function analyze() {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setScanLog([]);

    // Animate log lines
    LOGS.forEach((msg, i) => {
      setTimeout(() => setScanLog(l => [...l, msg]), i * 380);
    });

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Analyze this code for security vulnerabilities:\n\n\`\`\`\n${code}\n\`\`\`` }],
        }),
      });

      const data = await resp.json();
      const raw = data.content?.map(b => b.text || "").join("") || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (e) {
      setError("Analysis failed. Check your code and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [scanLog]);

  const levelCfg = result ? (SEVERITY_CONFIG[result.riskLevel] || SEVERITY_CONFIG.SAFE) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e0e0e0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "0 0 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        textarea:focus { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(0,255,136,0.15)",
        padding: "20px 32px",
        display: "flex", alignItems: "center", gap: 16,
        background: "rgba(0,255,136,0.02)",
      }}>
        <div style={{
          width: 36, height: 36, border: "2px solid #00ff88",
          borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 16px rgba(0,255,136,0.3)",
        }}>
          <span style={{ color: "#00ff88", fontSize: 16 }}>⬡</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: 2 }}>
            SENTINEL
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,255,136,0.6)", letterSpacing: 3 }}>AI SECURITY ANALYZER v2.1</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "pulse 2s infinite", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "rgba(0,255,136,0.7)", letterSpacing: 1 }}>ONLINE</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "flex", gap: 20, flexWrap: "wrap" }}>

        {/* Input Panel */}
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "rgba(0,255,136,0.5)", letterSpacing: 2, marginBottom: 8 }}>// CODE INPUT</div>
          <div style={{
            border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 8, overflow: "hidden",
            background: "rgba(0,255,136,0.02)",
          }}>
            <div style={{
              padding: "8px 14px", borderBottom: "1px solid rgba(0,255,136,0.1)",
              display: "flex", gap: 6, alignItems: "center",
            }}>
              {["#ff5f57","#ffbd2e","#28c840"].map((c, i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginLeft: 8 }}>target.code</span>
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={PLACEHOLDER}
              style={{
                width: "100%", minHeight: 320, background: "transparent",
                border: "none", color: "#a8d8a8", fontSize: 13, lineHeight: 1.7,
                padding: "16px", resize: "vertical", fontFamily: "inherit",
              }}
            />
          </div>
          <button
            onClick={analyze}
            disabled={loading || !code.trim()}
            style={{
              marginTop: 12, width: "100%", padding: "14px",
              background: loading ? "rgba(0,255,136,0.06)" : "rgba(0,255,136,0.12)",
              border: `1px solid ${loading ? "rgba(0,255,136,0.2)" : "rgba(0,255,136,0.5)"}`,
              borderRadius: 6, color: loading ? "rgba(0,255,136,0.4)" : "#00ff88",
              fontSize: 12, fontWeight: 700, letterSpacing: 3, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 0 20px rgba(0,255,136,0.1)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "[ SCANNING... ]" : "[ RUN SECURITY SCAN ]"}
          </button>

          {/* Scan Log */}
          {(loading || scanLog.length > 0) && (
            <div style={{
              marginTop: 12, background: "#050508", border: "1px solid rgba(0,255,136,0.1)",
              borderRadius: 6, padding: "12px 14px", maxHeight: 180, overflowY: "auto",
            }} ref={logRef}>
              {scanLog.map((line, i) => (
                <div key={i} style={{ fontSize: 11, color: "rgba(0,255,136,0.6)", marginBottom: 3, animation: `slideIn 0.2s ease both` }}>
                  <span style={{ color: "rgba(0,255,136,0.3)", marginRight: 8 }}>▶</span>{line}
                </div>
              ))}
              {loading && <div style={{ fontSize: 11, color: "rgba(0,255,136,0.4)" }}>
                <Typing text="Analyzing..." />
              </div>}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.3)",
              borderRadius: 6, fontSize: 12, color: "#ff2d55",
            }}>⚠ {error}</div>
          )}
        </div>

        {/* Results Panel */}
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "rgba(0,255,136,0.5)", letterSpacing: 2, marginBottom: 8 }}>// ANALYSIS REPORT</div>

          {!result && !loading && (
            <div style={{
              border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 8,
              padding: "60px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>⬡</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>
                Paste code and run scan<br />to generate security report
              </div>
            </div>
          )}

          {result && (
            <div style={{ animation: "slideIn 0.4s ease both" }}>
              {/* Score Header */}
              <div style={{
                background: `${levelCfg.bg}`,
                border: `1px solid ${levelCfg.border}`,
                borderRadius: 8, padding: "18px 20px",
                display: "flex", alignItems: "center", gap: 18, marginBottom: 16,
              }}>
                <ScoreRing score={result.riskScore} level={result.riskLevel} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 18, fontWeight: 800, color: levelCfg.color,
                    fontFamily: "'Syne', sans-serif", letterSpacing: 2,
                  }}>{result.riskLevel}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4, lineHeight: 1.5 }}>
                    {result.summary}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["CRITICAL","HIGH","MEDIUM","LOW"].map(sev => {
                      const count = (result.vulnerabilities || []).filter(v => v.severity === sev).length;
                      if (!count) return null;
                      const c = SEVERITY_CONFIG[sev];
                      return (
                        <span key={sev} style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 3,
                          background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                          fontWeight: 700, letterSpacing: 1,
                        }}>{count} {sev}</span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Vulnerabilities */}
              {result.vulnerabilities?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8 }}>
                    VULNERABILITIES ({result.vulnerabilities.length})
                  </div>
                  {result.vulnerabilities.map((v, i) => <VulnCard key={v.id} vuln={v} index={i} />)}
                </div>
              )}

              {/* Positives */}
              {result.positives?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "rgba(48,209,88,0.5)", letterSpacing: 2, marginBottom: 8 }}>SECURITY POSITIVES</div>
                  <div style={{
                    background: "rgba(48,209,88,0.05)", border: "1px solid rgba(48,209,88,0.2)",
                    borderRadius: 6, padding: "12px 14px",
                  }}>
                    {result.positives.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4, display: "flex", gap: 8 }}>
                        <span style={{ color: "#30d158", flexShrink: 0 }}>✓</span>{p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8 }}>RECOMMENDATIONS</div>
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6, padding: "12px 14px",
                  }}>
                    {result.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4, display: "flex", gap: 8 }}>
                        <span style={{ color: "rgba(0,255,136,0.4)", flexShrink: 0 }}>{i + 1}.</span>{r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
