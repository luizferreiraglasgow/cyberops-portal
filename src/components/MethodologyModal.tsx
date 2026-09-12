'use client'
import { useEffect } from 'react'
interface MethodologyModalProps { title: string; steps: string[]; onClose: () => void }
export function MethodologyModal({ title, steps, onClose }: MethodologyModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 12, width: 'min(600px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(0,212,255,0.08)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: '#475569', fontSize: '0.65rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Methodology</div>
            <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600, fontSize: '1rem' }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ background: '#00d4ff18', border: '1px solid #00d4ff40', borderRadius: '50%', width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d4ff', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, marginTop: 1 }}>{i + 1}</div>
                <div style={{ color: step.startsWith(' ') ? '#64748b' : '#94a3b8', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.65, paddingTop: 4 }}>{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
