import { useMemo } from 'react'

const BG_COLORS = [
  '#1f86c7', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export default function ProfileAvatar({ avatarUrl, name, size = 32, className = '' }) {
  const initials = useMemo(() => {
    if (!name) return '?'
    return String(name)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  }, [name])

  const bgColor = useMemo(() => {
    const index = name ? name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % BG_COLORS.length : 0
    return BG_COLORS[index]
  }, [name])

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Profile'}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: bgColor, fontSize: Math.round(size * 0.35) }}
    >
      {initials}
    </div>
  )
}