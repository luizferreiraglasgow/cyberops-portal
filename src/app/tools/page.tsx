'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { CommandPanel } from '@/components/CommandPanel'
import { MethodologyModal } from '@/components/MethodologyModal'
import { toolCategories, GUACAMOLE_URL, Tool, ToolCategory } from '@/data/tools'

const teamConfig = {
  red: { label: 'Red Team', bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5' },
  blue: { label: 'Blue Team', bg: '#1e3a5f', border: '#3b82f6', color: '#93c5fd' },
  'bug-hunting': { label: 'Bug Hunting', bg: '#78350f', border: '#f59e0b', color: '#fcd34d' },
}

function TeamBadge({ team }: { team: keyof typeof teamConfig }) {
  const cfg = teamConfig[team]
  return (
    <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, borderRadius: 4, padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
      {cfg.label}
    </span>
  )
}

function NodeBadge({ node, guacNode }: { node: Tool['node'], guacNode?: string }) {
  const label = guacNode === 'node-01' ? 'Kali · node-01'
    : guacNode === 'node-02' ? 'Ubuntu · node-02'
    : node === 'api' ? 'API'
    : node === 'web' ? 'Web'
    : node
  const color = guacNode === 'node-01' ? '#ef4444' : guacNode === 'node-02' ? '#3b82f6' : '#f59e0b'
  return <span style={{ fontSize: '0.65rem', color, fontFamily: 'monospace', opacity: 0.7 }}>{label}</span>
}

function ToolRow({ tool, onCommand, onMethodology }: { tool: Tool; onCommand: (tool: Tool) => void; onMethodology: (tool: Tool) => void }) {
  const guacUrl = tool.guacNode ? `${GUACAMOLE_URL}/#/` : null
  const launchUrl = tool.webUrl ? (tool.webUrl.startsWith('http') ? tool.webUrl : tool.webUrl) : guacUrl ?? GUACAMOLE_URL
  const launchTarget = tool.webUrl?.startsWith('http') ? '_blank' : '_self'
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid #0f1e35', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 500 }}>{tool.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ color: '#475569', fontSize: '0.75rem' }}>{tool.description}</span>
          <NodeBadge node={tool.node} guacNode={tool.guacNode} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {tool.actions.includes('launch') && (
          <a href={launchUrl} target={launchTarget} rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="cyber-btn" style={{ fontSize: '0.75rem', padding: '5px 14px', whiteSpace: 'nowrap' }}>Launch ↗</button>
          </a>
        )}
        {tool.actions.includes('commands') && tool.commands && (
          <button onClick={() => onCommand(tool)} style={{ background: '#00d4ff0d', border: '1px solid #1e3a5f', color: '#00d4ff', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>💡 Commands</button>
        )}
        {tool.actions.includes('methodology') && tool.methodology && (
          <button onClick={() => onMethodology(tool)} style={{ background: '#f59e0b0d', border: '1px solid #78350f', color: '#f59e0b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>📋 Methodology</button>
        )}
      </div>
    </div>
  )
}

function CategorySection({ category, onCommand, onMethodology }: { category: ToolCategory; onCommand: (tool: Tool) => void; onMethodology: (tool: Tool) => void }) {
  return (
    <div className="cyber-card p-5 mb-5">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid #0f1e35', paddingBottom: 12 }}>
        <TeamBadge team={category.team} />
        <h2 style={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>{category.name}</h2>
        <span style={{ color: '#334155', fontSize: '0.7rem', fontFamily: 'monospace', marginLeft: 'auto' }}>{category.tools.length} tools</span>
      </div>
      <div>{category.tools.map(tool => <ToolRow key={tool.id} tool={tool} onCommand={onCommand} onMethodology={onMethodology} />)}</div>
    </div>
  )
}

export default function ToolsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<Tool | null>(null)
  const [panelType, setPanelType] = useState<'commands' | 'methodology' | null>(null)
  const [filterTeam, setFilterTeam] = useState<'all' | 'red' | 'blue' | 'bug-hunting'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  function openCommand(tool: Tool) { setActivePanel(tool); setPanelType('commands') }
  function openMethodology(tool: Tool) { setActivePanel(tool); setPanelType('methodology') }
  function closePanel() { setActivePanel(null); setPanelType(null) }

  const filtered = toolCategories
    .filter(cat => filterTeam === 'all' || cat.team === filterTeam)
    .map(cat => ({ ...cat, tools: search ? cat.tools.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())) : cat.tools }))
    .filter(cat => cat.tools.length > 0)

  const totalTools = toolCategories.reduce((s, c) => s + c.tools.length, 0)

  return (
    <>
      <Navbar />
      <div style={{ background: '#070b14', borderBottom: '1px solid #0f1e35', padding: '8px 0' }}>
        <div className="max-w-7xl mx-auto px-4" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'homelab', value: '24h online', color: '#00ff9d' },
            { label: 'RPi4', value: 'node-00', color: '#00d4ff' },
            { label: 'Kali Linux', value: 'node-01', color: '#ef4444' },
            { label: 'Ubuntu', value: 'node-02', color: '#3b82f6' },
            { label: 'uptime', value: '99.9%', color: '#f59e0b' },
            { label: 'infra cost', value: '£0/mo', color: '#00ff9d' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ color: '#475569', fontSize: '0.7rem', fontFamily: 'monospace' }}>{item.label}</span>
              <span style={{ color: item.color, fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 600 }}>· {item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>Tools + Tips</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{totalTools} tools · Red Team · Blue Team · Bug Hunting</p>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'red', 'blue', 'bug-hunting'] as const).map(team => (
              <button key={team} onClick={() => setFilterTeam(team)}
                style={{ background: filterTeam === team ? '#00d4ff22' : 'transparent', border: `1px solid ${filterTeam === team ? '#00d4ff' : '#1e3a5f'}`, color: filterTeam === team ? '#00d4ff' : '#64748b', borderRadius: 6, padding: '5px 14px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace', textTransform: 'capitalize' }}>
                {team === 'all' ? 'All' : team === 'red' ? '🔴 Red Team' : team === 'blue' ? '🔵 Blue Team' : '🟡 Bug Hunting'}
              </button>
            ))}
          </div>
          <input className="cyber-input" placeholder="Search tool…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240, marginLeft: 'auto' }} />
        </div>
        {filtered.length === 0 ? (
          <div className="cyber-card p-10 text-center" style={{ color: '#334155', fontFamily: 'monospace' }}>No tools found</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
            {filtered.map(cat => (
              <div key={cat.id} className={cat.team === 'bug-hunting' ? 'xl:col-span-2' : ''}>
                <CategorySection category={cat} onCommand={openCommand} onMethodology={openMethodology} />
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#070b14', border: '1px solid #0f1e35', borderRadius: 8, color: '#334155', fontSize: '0.72rem', fontFamily: 'monospace' }}>
          💡 <span style={{ color: '#00d4ff' }}>Launch</span> buttons open Guacamole SSH — pick <strong style={{ color: '#ef4444' }}>node-01 (Kali)</strong> for Red Team or <strong style={{ color: '#3b82f6' }}>node-02 (Ubuntu)</strong> for Blue Team.
          &nbsp;Tools marked API open the internal panel.
        </div>
      </main>
      {activePanel && panelType === 'commands' && activePanel.commands && (
        <CommandPanel title={activePanel.name} commands={activePanel.commands} onClose={closePanel} />
      )}
      {activePanel && panelType === 'methodology' && activePanel.methodology && (
        <MethodologyModal title={activePanel.name} steps={activePanel.methodology} onClose={closePanel} />
      )}
    </>
  )
}
