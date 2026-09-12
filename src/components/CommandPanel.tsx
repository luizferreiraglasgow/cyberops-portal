'use client'
import { useEffect, useRef, useState } from 'react'
interface CommandPanelProps { title: string; commands: string[]; onClose: () => void }
export function CommandPanel({ title, commands, onClose }: CommandPanelProps) {
  const [copied, setCopied] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  function copyCommand(cmd: string, idx: number) {
    navigator.clipboard.writeText(cmd).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 1500) })
  }
  function copyAll() {
    const text = commands.filter(c => !c.startsWith('#') && c.trim()).join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopied(-1); setTimeout(() => setCopied(null), 1500) })
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
      <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 92vw)', background: '#0d1424', borderLeft: '1px solid #1e3a5f', zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#475569', fontSize: '0.65rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Commands</div>
            <div style={{ color: '#00d4ff', fontFamily: 'monospace', fontWeight: 600, fontSize: '1rem' }}>{title}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copyAll} style={{ background: copied === -1 ? '#00d4ff22' : 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', borderRadius: 6, padding: '4px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>{copied === -1 ? '✓ Copied' : 'Copy all'}</button>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {commands.map((cmd, i) => {
            if (cmd === '') return <div key={i} style={{ height: 8 }} />
            const isComment = cmd.startsWith('#')
            const isNote = cmd.startsWith('→')
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', gap: 8, cursor: isComment || isNote ? 'default' : 'pointer' }} onClick={() => !isComment && !isNote && copyCommand(cmd, i)} title={isComment || isNote ? '' : 'Click to copy'}>
                <pre style={{ margin: 0, flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: isComment ? '#475569' : isNote ? '#f59e0b' : '#00ff9d', lineHeight: 1.6 }}>{cmd}</pre>
                {!isComment && !isNote && <span style={{ fontSize: '0.65rem', color: copied === i ? '#00d4ff' : '#334155', flexShrink: 0, fontFamily: 'monospace', minWidth: 40, textAlign: 'right' }}>{copied === i ? '✓' : '⎘'}</span>}
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e3a5f', color: '#334155', fontSize: '0.68rem', fontFamily: 'monospace', flexShrink: 0 }}>Click a command to copy · ESC to close</div>
      </div>
    </>
  )
}
