"use client";

import { useState } from "react";
import {
  Shield,
  Sword,
  Server,
  Wrench,
  ExternalLink,
  Terminal,
  Eye,
  Database,
  Globe,
  Lock,
  Cpu,
  Bug,
  Search,
  Activity,
  Network,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Tool Definitions ──────────────────────────────────────────────────────────
// node-00: 192.168.0.68 (RPi4 — Control / Gateway)
// node-01: 192.168.0.57 (HP ProBook 640 G1 — Kali / Red Team)
// node-02: 192.168.0.66 (ASUS TP550LA — Blue Team)
// ──────────────────────────────────────────────────────────────────────────────

interface Tool {
  name: string;
  description: string;
  url: string;
  badge?: string;
  external?: boolean; // true = Cloudflare subdomain, false = internal IP
}

const redTeamTools: Tool[] = [
  {
    name: "Kali Linux",
    description: "Red Team OS — full offensive toolset via Guacamole",
    url: "https://guac.cyberopsplatform.co.uk",
    badge: "node-01",
    external: true,
  },
  {
    name: "BloodHound CE",
    description: "Active Directory attack path analysis",
    url: "http://192.168.0.57:8888",
    badge: "node-01 :8888",
    external: false,
  },
  {
    name: "Nmap / Recon",
    description: "Network scanner + recon",
    url: "/dashboard",
    badge: "Dashboard",
    external: false,
  },
  {
    name: "GoPhish",
    description: "Phishing simulation platform",
    url: "https://192.168.0.66:8333",
    badge: "node-02 :8333",
    external: false,
  },
  {
    name: "Ollama Pentest",
    description: "Pentest-tuned LLM inference (qwen3.5:9b-Pentest)",
    url: "http://192.168.0.64:3000",
    badge: "node-03 :3000",
    external: false,
  },
];

const blueTeamTools: Tool[] = [
  {
    name: "MISP",
    description: "Threat intelligence platform",
    url: "https://192.168.0.66:4443",
    badge: "node-02 :4443",
    external: false,
  },
  {
    name: "REMnux",
    description: "Malware analysis OS — via Guacamole",
    url: "https://guac.cyberopsplatform.co.uk",
    badge: "node-02",
    external: true,
  },
  {
    name: "SIFT Workstation",
    description: "DFIR / forensics OS — via Guacamole",
    url: "https://guac.cyberopsplatform.co.uk",
    badge: "node-02",
    external: true,
  },
  {
    name: "VirusTotal",
    description: "File / URL / hash analysis",
    url: "/dashboard",
    badge: "Dashboard",
    external: false,
  },
  {
    name: "AbuseIPDB",
    description: "IP reputation lookup",
    url: "/dashboard",
    badge: "Dashboard",
    external: false,
  },
  {
    name: "Shodan",
    description: "Internet asset discovery",
    url: "/dashboard",
    badge: "Dashboard",
    external: false,
  },
];

const platformTools: Tool[] = [
  {
    name: "Apache Guacamole",
    description: "Browser-based remote desktop / SSH gateway",
    url: "https://guac.cyberopsplatform.co.uk",
    badge: "node-01",
    external: true,
  },
  {
    name: "Authentik SSO",
    description: "Identity provider and MFA management",
    url: "https://auth.cyberopsplatform.co.uk",
    badge: "node-00",
    external: true,
  },
  {
    name: "MCP Gateway",
    description: "AI-powered tool integration with Claude",
    url: "https://mcp.cyberopsplatform.co.uk",
    badge: "node-00",
    external: true,
  },
  {
    name: "Portainer",
    description: "Docker container management UI",
    url: "https://192.168.0.68:9443",
    badge: "node-00 :9443",
    external: false,
  },
  {
    name: "Pi-hole",
    description: "DNS sinkhole and ad blocking",
    url: "http://192.168.0.68:8080/admin",
    badge: "node-00 :8080",
    external: false,
  },
];

const utilityTools: Tool[] = [
  {
    name: "CyberChef",
    description: "Data encoding, decoding, and analysis Swiss Army knife",
    url: "https://gchq.github.io/CyberChef/",
    badge: "web",
    external: true,
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ text, external }: { text?: string; external?: boolean }) {
  if (!text) return null;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-mono ${
        external
          ? "bg-green-900/40 text-green-400 border border-green-800/50"
          : "bg-slate-800 text-slate-400 border border-slate-700"
      }`}
    >
      {text}
    </span>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="card-hover bg-cyber-card border border-cyber-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{tool.name}</span>
            <StatusBadge text={tool.badge} external={tool.external} />
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{tool.description}</p>
        </div>
      </div>
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-medium
          bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white
          border border-slate-700 hover:border-slate-500
          transition-all duration-150"
      >
        <ExternalLink size={12} />
        Launch
      </a>
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tools: Tool[];
  accentColor: string;
}

function Section({ title, subtitle, icon, tools, accentColor }: SectionProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 mb-4 w-full text-left group"
      >
        <div className={`p-2 rounded-lg ${accentColor} bg-opacity-10`}>{icon}</div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-slate-600 group-hover:text-slate-400 transition-colors">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────

export function PlatformDashboard() {
  return (
    <div className="min-h-screen grid-bg">

      {/* Node Status Bar */}
      <div className="border-b border-cyber-border/50 bg-cyber-bg/60">
        <div className="max-w-screen-2xl mx-auto px-6 py-2 flex flex-wrap gap-4 text-xs font-mono">
          {[
            { label: "node-00", ip: "192.168.0.68", role: "RPi4 · Gateway", color: "text-green-400" },
            { label: "node-01", ip: "192.168.0.57", role: "HP ProBook · Red Team", color: "text-red-400" },
            { label: "node-02", ip: "192.168.0.66", role: "ASUS · Blue Team", color: "text-blue-400" },
          ].map((node) => (
            <div key={node.label} className="flex items-center gap-2 text-slate-500">
              <span className={`status-dot w-1.5 h-1.5 rounded-full inline-block ${node.color.replace("text-", "bg-")}`} />
              <span className={node.color}>{node.label}</span>
              <span className="text-slate-600">{node.ip}</span>
              <span className="hidden md:inline text-slate-700">— {node.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        <Section
          title="Red Team"
          subtitle="Offensive security tools — node-01 (192.168.0.57)"
          icon={<Sword size={16} className="text-red-400" />}
          tools={redTeamTools}
          accentColor="bg-red-500"
        />

        <Section
          title="Blue Team"
          subtitle="Defensive security, SIEM, threat intel — node-02 (192.168.0.66)"
          icon={<Shield size={16} className="text-blue-400" />}
          tools={blueTeamTools}
          accentColor="bg-blue-500"
        />

        <Section
          title="Platform"
          subtitle="Infrastructure services — node-00 (192.168.0.68)"
          icon={<Server size={16} className="text-green-400" />}
          tools={platformTools}
          accentColor="bg-green-500"
        />

        <Section
          title="Utilities"
          subtitle="Cross-platform tools and lab targets"
          icon={<Wrench size={16} className="text-yellow-400" />}
          tools={utilityTools}
          accentColor="bg-yellow-500"
        />

        {/* MCP Gateway Quick Info */}
        <div className="mt-4 p-4 bg-cyber-card border border-purple-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={14} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">MCP Gateway</span>
            <span className="text-xs bg-purple-900/40 text-purple-400 border border-purple-800/50 px-2 py-0.5 rounded">
              mcp.cyberopsplatform.co.uk
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Claude AI with live tools — connect at <code className="text-purple-300">https://mcp.cyberopsplatform.co.uk/mcp/sse</code>
          </p>
          <div className="flex flex-wrap gap-2">
            {["nmap", "shodan", "virustotal", "abuseipdb", "recon"].map((tool) => (
              <span
                key={tool}
                className="text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-border mt-8 py-4">
        <div className="max-w-screen-2xl mx-auto px-6 text-xs text-slate-600 font-mono flex justify-between items-center">
          <span>CyberOps Platform — Luiz Ferreira</span>
          <span>
            <span className="text-slate-700">Internal IPs reachable on LAN only · </span>
            <a
              href="https://guac.cyberopsplatform.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 hover:text-green-500 transition-colors"
            >
              guac ↗
            </a>
            {" · "}
            <a
              href="https://auth.cyberopsplatform.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 hover:text-green-500 transition-colors"
            >
              auth ↗
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
