'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

type EngagementType = 'web-app' | 'network' | 'active-directory' | 'mobile' | 'api-cloud' | 'red-team' | 'physical' | 'ddos' | 'social'
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

interface NormalizedTarget {
  raw: string
  host: string   // bare hostname or IP — no scheme, path, port or trailing slash
  url: string    // single clean URL (https unless the raw input was http)
  isIp: boolean
  isCidr: boolean
}

// Turn whatever the user typed (https://site/, site.com, 10.0.0.5, 10.0.0.0/24)
// into the forms each tool actually expects. DNS/port tools want `host`;
// web tools want `url`. This is what stops `http://https://…`, `whois https://…`
// and `nmap …/24` on a hostname.
function normalizeTarget(raw: string): NormalizedTarget {
  const trimmed = (raw || '').trim()
  const isCidr = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(trimmed)
  if (isCidr) return { raw: trimmed, host: trimmed, url: trimmed, isIp: false, isCidr: true }
  const scheme = /^http:\/\//i.test(trimmed) ? 'http' : 'https'
  const host = trimmed
    .replace(/^[a-z]+:\/\//i, '') // strip scheme
    .replace(/[/?#].*$/, '')       // strip path / query / fragment
    .replace(/:\d+$/, '')          // strip port
    .trim()
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  return { raw: trimmed, host, url: `${scheme}://${host}`, isIp, isCidr: false }
}

function generatePlan(input: EngagementInput): EngagementPlan {
  const phases: Phase[] = []
  const targets = input.targets.split('\n').map(t => t.trim()).filter(Boolean)
  const nt = normalizeTarget(targets[0] || '<target>')
  const host = nt.host                 // bare domain / IP for DNS, OSINT, port scans
  const url = nt.url                   // clean URL for web tools
  // Host-discovery target: only a bare IP gets a /24 sweep; a domain is scanned as-is.
  const sweep = targets.length > 1
    ? targets.map(x => normalizeTarget(x).host).join(' ')
    : nt.isCidr ? nt.host : nt.isIp ? `${nt.host}/24` : nt.host
  const isAD = input.types.includes('active-directory')
  const isWeb = input.types.includes('web-app') || input.types.includes('api-cloud')
  const isNetwork = input.types.includes('network') || input.types.includes('red-team')
  const isMobile = input.types.includes('mobile')
  const isDDoS = input.types.includes('ddos')

  phases.push({
    name: 'Phase 1 — Passive Reconnaissance',
    priority: 'critical',
    tools: ['theHarvester', 'Subfinder', 'Amass', 'Shodan'],
    commands: [
      `# OSINT — emails and subdomains`,
      `theHarvester -d ${host} -b all -f recon_${host}.html`,
      `subfinder -d ${host} -all -recursive -o subs.txt`,
      `amass enum -passive -d ${host} | tee amass_subs.txt   # Amass v5 removed -o`,
      `cat subs.txt amass_subs.txt 2>/dev/null | sort -u > all_subs.txt`,
      ``,
      `# Shodan  (run 'shodan init <API_KEY>' once first)`,
      `shodan search "hostname:${host}"`,
      `shodan search "ssl:${host} port:443"`,
      ``,
      `# Whois / DNS`,
      `whois ${host}`,
      `dig ${host} ANY +short`,
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
      `nmap -sn ${sweep} -oG hosts_alive.txt`,
      ``,
      `# Full port scan`,
      `nmap -sV -sC -p- --open -T4 ${host} -oX nmap_full.xml`,
      ``,
      `# Rustscan (faster)`,
      `rustscan -a ${host} --ulimit 5000 -- -sV -sC`,
      ``,
      `# Live web services  (on Kali the ProjectDiscovery tool is 'httpx-toolkit' — 'httpx' is the Python lib)`,
      `cat all_subs.txt | httpx-toolkit -silent -status-code -title -tech-detect -o web_alive.txt`,
      ``,
      `# Screenshots`,
      `httpx-toolkit -l web_alive.txt -screenshot -srd screenshots`,
    ],
  })

  if (isWeb) {
    phases.push({
      name: 'Phase 3 — Web / API Analysis',
      priority: 'high',
      tools: ['Burp Suite', 'ffuf', 'Nuclei', 'SQLmap'],
      commands: [
        `# Directory fuzzing  (needs seclists: sudo apt install seclists)`,
        `ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt -u ${url}/FUZZ -mc 200,301,302 -o ffuf_dirs.json`,
        ``,
        `# Parameters (Wayback)`,
        `waybackurls ${host} | grep "?.*=" | sort -u > wayback_params.txt`,
        `gau ${host} >> wayback_params.txt`,
        ``,
        `# Nuclei — known vulnerabilities  (run 'nuclei -update-templates' first)`,
        `nuclei -u ${url} -s critical,high -o nuclei_results.txt`,
        `nuclei -u ${url} -tags cve,tech,exposure`,
        ``,
        `# Automated SQLi (only if authorized)`,
        `sqlmap -u "${url}/page?id=1" --batch --level=3 --risk=2`,
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
        `msfconsole -q -x "db_nmap -sV ${host}; vulns"`,
        ``,
        `# SMB (EternalBlue check)`,
        `nmap --script smb-vuln-ms17-010 ${host}`,
        ``,
        `# Brute force SSH`,
        `hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://${host} -t 4`,
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
        `crackmapexec smb ${host} -u '' -p '' --shares  # null session`,
        ``,
        `# Kerberoasting`,
        `GetUserSPNs.py domain.local/user:pass -dc-ip ${host} -request -outputfile kerberoast.hashes`,
        `hashcat -m 13100 kerberoast.hashes /usr/share/wordlists/rockyou.txt`,
        ``,
        `# AS-REP Roasting`,
        `GetNPUsers.py domain.local/ -usersfile users.txt -no-pass -dc-ip ${host}`,
        ``,
        `# BloodHound collection`,
        `bloodhound-python -u user -p pass -d domain.local -dc ${host} -c All`,
        ``,
        `# Pass-the-Hash`,
        `crackmapexec smb ${host} -u admin -H <NTLM_HASH>`,
        ``,
        `# DCSync (if Domain Admin)`,
        `secretsdump.py domain.local/admin:pass@${host}`,
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

  if (isDDoS) {
    const _nt = normalizeTarget(targets[0] || '<target>')
    const _h = _nt.host
    const _u = _nt.url
    phases.push({
      name: 'Phase — DDoS / DoS Assessment',
      priority: 'high',
      tools: ['hping3','nmap-dos','slowhttptest','testssl.sh','ab','wrk','siege'],
      commands: [
        '# PASSIVE — safe, no flooding',
        `curl -sI https://${_h} | grep -iE 'cf-ray|server|x-cache|via|x-waf|x-ddos'`,
        `dig ${_h} +short`,
        `mtr --report --report-cycles 5 ${_h}`,
        `whois $(dig +short ${_h} | head -1)`,
        `shodan host $(dig +short ${_h} | head -1)`,
        `nmap -sV --script dos ${_h} -p 80,443,8080 -oN ddos-vulnscan.txt`,
        `nmap -sV --script http-slowloris-check ${_h} -p 80,443`,
        `testssl.sh --severity HIGH ${_u}`,
        `nmap -sV --script ssl-heartbleed ${_h} -p 443`,
        `nmap -sU -p 19,53,111,123,161,389,1900,3702 ${_h} --open`,
        `dig ${_h} ANY @${_h}`,
        `nmap -sU -p 123 --script ntp-monlist ${_h}`,
        `ab -n 10 -c 1 ${_u}/`,
        `siege --benchmark -r 1 ${_u}/`,
        `nikto -host ${_h} -Tuning 6`,
        '# ACTIVE — lab + explicit written authorization only',
        `slowhttptest -c 500 -H -g -o slowloris_report -i 10 -r 200 -t GET -u ${_u}/ -x 24 -p 3`,
        `slowhttptest -c 500 -B -g -o rudy_report -i 110 -r 200 -t POST -u ${_u}/ -x 24 -p 3`,
        `slowhttptest -c 500 -X -g -o slowread_report -r 200 -u ${_u}/ -x 24 -p 3 -k 3`,
        `ab -n 10000 -c 100 ${_u}/`,
        `siege -c 50 -t 60s ${_u}/`,
        `wrk -t12 -c400 -d30s ${_u}/`,
        `sudo hping3 --flood --syn -V -p 80 ${_h}`,
        `sudo hping3 --udp --flood -p 53 ${_h}`,
      ],
      notes: 'Passive: safe for any authorized target. Active: written auth + lab only.'
        + (input.restrictions ? ' | ' + input.restrictions : ''),
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
    'mobile': 'Mobile', 'api-cloud': 'API/Cloud', 'red-team': 'Red Team', 'physical': 'Physical', 'ddos': 'DDoS/DoS', 'social': 'Social Engineering',
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
  const [aiBackend, setAiBackend] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [scopeDoc, setScopeDoc] = useState<{ name: string; text: string; chars: number; truncated?: boolean } | null>(null)
  const [scopeDocError, setScopeDocError] = useState<string | null>(null)
  const [scopeDocLoading, setScopeDocLoading] = useState(false)
  // Social Engineering (R1 clean panel — client-side config only; no backend yet)
  const [seProfile, setSeProfile] = useState<'awareness' | 'blackbox' | 'adversary'>('awareness')
  const [seEmail, setSeEmail] = useState(true)
  const [seSms, setSeSms] = useState(false)
  const [seAdvanced, setSeAdvanced] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  function toggleType(t: EngagementType) {
    setInput(prev => {
      // 'social' is an exclusive engagement type — it opens a Campaign Workspace, not a command plan.
      if (t === 'social') {
        const solo = prev.types.length === 1 && prev.types[0] === 'social'
        return { ...prev, types: solo ? ['web-app'] : ['social'] }
      }
      const base = prev.types.filter(x => x !== 'social')
      const next = base.includes(t) ? base.filter(x => x !== t) : [...base, t]
      return { ...prev, types: next.length ? next : ['web-app'] }
    })
    setPlan(null)
  }

  function analyze() {
    if (!input.targets.trim()) return
    if (input.types.includes('social')) return  // social uses the Campaign Workspace, not generatePlan()
    setPlan(generatePlan(input))
  }

  async function uploadScopeDoc(file: File) {
    setScopeDocError(null); setScopeDocLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/scope/extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) {
        setScopeDoc(null)
        setScopeDocError(json.error ?? `Could not read the document (${res.status}).`)
      } else {
        setScopeDoc({ name: json.filename, text: json.text, chars: json.chars, truncated: json.truncated })
      }
    } catch {
      setScopeDoc(null); setScopeDocError('Upload failed — check your connection and try again.')
    } finally { setScopeDocLoading(false) }
  }

  function clearScopeDoc() { setScopeDoc(null); setScopeDocError(null) }

  // Map the gateway/proxy response to a clear, actionable message.
  function friendlyError(res: Response, json: { error?: string; notice?: string }): string {
    const raw = (json?.error || json?.notice || '').toString()
    if (res.status === 401) return 'Your session expired — please sign in again.'
    if (res.status === 403) return 'Access denied by the gateway (CORS / origin). Open this from the portal.'
    if (res.status === 429 || /quota|billing|exhaust|balance|resource_exhausted/i.test(raw))
      return 'Gemini limit reached — check the prepaid balance. ' + (raw || '')
    if (res.status === 503) return raw || 'The gateway is not fully configured (missing API token).'
    if (res.status === 502 || res.status === 504 || /timeout|timed out|deadline/i.test(raw))
      return 'The plan took too long (60s limit) — try again, or narrow the scope.'
    return raw || `Request failed on the gateway (HTTP ${res.status}).`
  }

  async function analyzeAI() {
    if (!input.targets.trim()) return
    if (input.types.includes('social')) return  // social uses the Campaign Workspace
    setAiLoading(true); setAiPlan(null); setAiError(null); setAiBackend(null); setAiModel(null); setAiNotice(null)
    const engagement_type = (input.types[0] || 'web-app').replace(/-/g, '_')
    const extraTypes = input.types.slice(1).map(t => t.replace(/-/g, '_')).join(', ')
    // Send bare hosts (no scheme/path) so the model doesn't echo URLs into
    // domain/port tools, and spell out the formatting rules explicitly.
    const cleanTargets = input.targets.split('\n').map(s => s.trim()).filter(Boolean)
      .map(s => normalizeTarget(s).host).join('\n')
    const targetRules = 'Target formatting rules the plan MUST follow: for DNS/OSINT/port tools '
      + '(theHarvester, subfinder, amass, whois, dig, dnsx, nmap, rustscan) use the BARE domain or IP '
      + '— no scheme, no path, no trailing slash; for web tools (ffuf, nuclei, sqlmap, httpx) use a single '
      + 'clean URL like https://host. Never emit http://https://, never append /24 to a hostname (only to a '
      + 'bare IP), and on Kali call the ProjectDiscovery HTTP prober as httpx-toolkit (httpx is the Python lib).'
    // Fold the uploaded scope document into additional_context so the current
    // gateway (which already injects additional_context into the Gemini prompt)
    // plans from the real document; also send scope_document for forward-compat.
    const scopeBlock = scopeDoc?.text
      ? `\n\nScope Document (${scopeDoc.name}) — authoritative RoE / NDA / briefing. Derive targets, scope and restrictions from this and never exceed it:\n${scopeDoc.text.slice(0, 12000)}`
      : ''
    try {
      const res = await fetch('/api/gateway/scope-analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagement_type,
          targets: cleanTargets || input.targets,
          objectives: input.objectives,
          restrictions: input.restrictions,
          scope_document: scopeDoc?.text || '',
          additional_context: `Available timeframe: ${input.timeframe}` + (extraTypes ? `. Additional engagement types: ${extraTypes}` : '') + `. ${targetRules}` + scopeBlock,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.status === 'error' || (json.error && !json.plan)) {
        setAiError(friendlyError(res, json))
      } else if (json.plan) {
        setAiPlan(json.plan as string)
        setAiBackend((json.backend as string) ?? 'gemini')
        setAiModel((json.model as string) ?? null)
        setAiNotice((json.notice as string) ?? null)
      } else {
        setAiError(friendlyError(res, json))
      }
    } catch { setAiError('Could not reach the MCP gateway.') } finally { setAiLoading(false) }
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
    { id: 'ddos', label: 'DDoS / DoS', icon: '⚡' },
    { id: 'social', label: 'Social Engineering', icon: '🎣' },
  ]
  const isSocial = input.types.includes('social')
  const seProfiles: { id: 'awareness' | 'blackbox' | 'adversary'; label: string; caps: string[] }[] = [
    { id: 'awareness', label: 'Awareness', caps: ['Email', 'SMS', 'Reporting telemetry'] },
    { id: 'blackbox', label: 'Black-Box', caps: ['+ OSINT enrichment', '+ Target segmentation', '+ Scenario chaining'] },
    { id: 'adversary', label: 'Adversary Simulation', caps: ['+ Advanced identity interaction', 'needs Zone B feed + separate sign-off'] },
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
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="scopeDocInput" style={{ display: 'block', border: `1px dashed ${scopeDoc ? '#00d4ff' : '#1e3a5f'}`, borderRadius: 8, padding: '18px', textAlign: 'center', color: '#334155', fontSize: '0.75rem', fontFamily: 'monospace', cursor: scopeDocLoading ? 'wait' : 'pointer' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{scopeDocLoading ? '⏳' : scopeDoc ? '📄' : '📁'}</div>
                {scopeDocLoading ? (
                  <span style={{ color: '#00d4ff' }}>Reading document…</span>
                ) : scopeDoc ? (
                  <span style={{ color: '#00d4ff' }}>{scopeDoc.name} · {scopeDoc.chars.toLocaleString()} chars{scopeDoc.truncated ? ' (truncated)' : ''}</span>
                ) : (
                  <>Upload scope doc · RoE · NDA · Briefing
                    <div style={{ marginTop: 4, color: '#475569', fontSize: '0.7rem' }}>PDF · DOCX · TXT — sent to the AI as the real scope</div>
                  </>
                )}
              </label>
              <input id="scopeDocInput" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadScopeDoc(f); e.target.value = '' }} />
              {scopeDoc && !scopeDocLoading && (
                <button onClick={clearScopeDoc} style={{ marginTop: 6, background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: 6, padding: '3px 10px', fontSize: '0.68rem', fontFamily: 'monospace', cursor: 'pointer' }}>✕ Remove document</button>
              )}
              {scopeDocError && <div style={{ marginTop: 6, color: '#ff6b6b', fontSize: '0.7rem', fontFamily: 'monospace' }}>{scopeDocError}</div>}
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
            {isSocial ? (
              <div role="note" style={{ padding: '12px', border: '1px solid #14b8a6', background: '#14b8a622', borderRadius: 8, color: '#5eead4', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.5 }}>
                🎣 Social Engineering opens a <strong>Campaign Workspace</strong> — configure the profile, channels and telemetry in the panel on the right, then Build.
              </div>
            ) : (<>
            <button className="cyber-btn w-full" onClick={analyze} disabled={!input.targets.trim()} style={{ padding: '12px', fontSize: '0.9rem' }}>⚡ Analyze Scope & Generate Plan</button>
            <button onClick={analyzeAI} disabled={!input.targets.trim() || aiLoading} style={{ width: '100%', marginTop: 10, padding: '11px', fontSize: '0.85rem', fontFamily: 'monospace', borderRadius: 8, cursor: input.targets.trim() && !aiLoading ? 'pointer' : 'not-allowed', background: 'transparent', border: '1px solid #8b5cf6', color: '#c4b5fd' }}>{aiLoading ? '✨ Generating with Gemini…' : '✨ Generate with Gemini (AI)'}</button>
            </>)}
          </div>
          <div>
            {isSocial ? (
              <div className="cyber-card p-6" style={{ borderColor: '#14b8a6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.2rem' }}>🎣</span>
                  <h2 style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Social Engineering — Human Attack Simulation</h2>
                </div>
                <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.6, margin: '0 0 18px' }}>Configure the campaign, then open the Campaign Workspace. Provider-owned simulation — attempt-only telemetry, no credential capture.</p>
                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
                  <legend style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 8, padding: 0 }}>Profile</legend>
                  <div role="group" aria-label="Campaign profile" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {seProfiles.map(p => (
                      <button key={p.id} type="button" aria-pressed={seProfile === p.id} onClick={() => setSeProfile(p.id)}
                        style={{ background: seProfile === p.id ? '#14b8a622' : 'transparent', border: `1px solid ${seProfile === p.id ? '#14b8a6' : '#1e3a5f'}`, color: seProfile === p.id ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
                    {(seProfiles.find(p => p.id === seProfile)?.caps ?? []).map((c, i) => (
                      <li key={i} style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>▸ {c}</li>
                    ))}
                  </ul>
                </fieldset>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 8 }}>Channels</div>
                  <div role="group" aria-label="Delivery channels" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" aria-pressed={seEmail} onClick={() => setSeEmail(v => !v)}
                      style={{ background: seEmail ? '#14b8a622' : 'transparent', border: `1px solid ${seEmail ? '#14b8a6' : '#1e3a5f'}`, color: seEmail ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>{seEmail ? '☑' : '☐'} Email</button>
                    <button type="button" aria-pressed={seSms} onClick={() => setSeSms(v => !v)}
                      style={{ background: seSms ? '#14b8a622' : 'transparent', border: `1px solid ${seSms ? '#14b8a6' : '#1e3a5f'}`, color: seSms ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>{seSms ? '☑' : '☐'} SMS</button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button type="button" aria-pressed={seAdvanced} onClick={() => setSeAdvanced(v => !v)}
                      style={{ background: 'transparent', border: `1px solid ${seAdvanced ? '#f59e0b' : '#1e3a5f'}`, color: seAdvanced ? '#fcd34d' : '#475569', borderRadius: 6, padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'monospace' }}>{seAdvanced ? '🔓' : '🔒'} Vishing / Impersonation</button>
                    <div style={{ color: seAdvanced ? '#f59e0b' : '#475569', fontFamily: 'monospace', fontSize: '0.68rem', marginTop: 6, lineHeight: 1.5 }}>
                      {seAdvanced ? '⚠ Higher human & legal risk — requires separate written sign-off before use.' : 'Locked — higher-risk channels stay behind a separate sign-off.'}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 8 }}>Telemetry</div>
                  <div style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>✓ Zone A — Human layer (provider-owned, always on)</div>
                  <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>○ Zone B — Defensive layer (client tenant · not connected)</div>
                  <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem', marginTop: 6, lineHeight: 1.5 }}>Records arrival · interaction · simulated submission · report events. Never passwords, secrets or reusable credentials.</div>
                </div>
                <button type="button" onClick={() => router.push('/campaigns/new')}
                  style={{ width: '100%', padding: '12px', fontSize: '0.85rem', fontFamily: 'monospace', borderRadius: 8, background: '#14b8a622', border: '1px solid #14b8a6', color: '#5eead4', cursor: 'pointer' }}>
                  🚀 Build Campaign
                </button>
                <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem', textAlign: 'center', margin: '8px 0 0' }}>Opens the Campaign Builder — creates a DRAFT campaign.</p>
              </div>
            ) : (<>
            {(aiLoading || aiPlan || aiError) && (() => {
              const isOllama = !!aiBackend && /ollama/i.test(aiBackend)
              const accent = aiError ? '#ff6b6b' : isOllama ? '#f59e0b' : '#8b5cf6'
              return (
              <div className="cyber-card p-5" style={{ marginBottom: 16, borderColor: accent }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: isOllama ? '#fcd34d' : '#c4b5fd', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✨ AI Plan</span>
                  {aiPlan && (
                    <span style={{ background: isOllama ? '#78350f' : '#312e81', border: `1px solid ${isOllama ? '#f59e0b' : '#8b5cf6'}`, color: isOllama ? '#fcd34d' : '#c4b5fd', borderRadius: 4, padding: '2px 8px', fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 700 }}>
                      {isOllama ? '⚠ Local Ollama (lower quality)' : 'Gemini'}{aiModel ? ` · ${aiModel}` : ''}
                    </span>
                  )}
                </div>
                {aiLoading && <div style={{ color: '#c4b5fd', fontFamily: 'monospace', fontSize: '0.8rem' }}>Generating…{scopeDoc ? ' (using your uploaded scope document)' : ''}</div>}
                {aiError && <div style={{ color: '#ff6b6b', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.5 }}>{aiError}</div>}
                {aiNotice && aiPlan && <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '0.72rem', marginBottom: 10, padding: '6px 10px', background: '#78350f22', border: '1px solid #78350f', borderRadius: 6 }}>⚠️ {aiNotice}</div>}
                {aiPlan && <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(aiPlan) }} />}
              </div>
            )})()}
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
            </>)}
          </div>
        </div>
      </main>
    </>
  )
}
