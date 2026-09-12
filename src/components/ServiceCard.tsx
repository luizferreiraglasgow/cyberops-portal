'use client'
interface ServiceCardProps { title: string; description: string; url: string; icon: string; status?: 'online' | 'offline' | 'unknown' }
export function ServiceCard({ title, description, url, icon, status = 'online' }: ServiceCardProps) {
  const statusColor = { online: '#00ff9d', offline: '#ff4444', unknown: '#ffcc00' }[status]
  const statusLabel = { online: 'Online', offline: 'Offline', unknown: 'Unknown' }[status]
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="cyber-card block p-6 no-underline" style={{ textDecoration: 'none' }}>
      <div className="flex items-start justify-between mb-3">
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <span className="text-xs font-mono px-2 py-1 rounded-full" style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>● {statusLabel}</span>
      </div>
      <h3 className="font-semibold text-lg mb-1" style={{ color: '#00d4ff' }}>{title}</h3>
      <p className="text-sm" style={{ color: '#94a3b8' }}>{description}</p>
      <div className="mt-4 text-xs font-mono truncate" style={{ color: '#475569' }}>{url}</div>
    </a>
  )
}
