/**
 * @file 图标组件。
 *
 * 原 App 用 @expo/vector-icons（Ionicons）和 react-native-svg。
 * 桌面版把 Ionicons 字体打包进应用，用字符码点渲染，视觉与原来一致；
 * 标签栏的三个 lucide 图标则直接内联成 SVG，省掉一次字体加载。
 */

import type { CSSProperties } from 'react'

/**
 * Ionicons 常用图标的码点（取自 @expo/vector-icons 的 glyphmaps/Ionicons.json）。
 *
 * 注意：码点写错不会报错，只会渲染成另一个字形（例如 62485 是 logo-steam）。
 * 增删条目时请对照官方 glyphmap 核对。
 */
const IONICONS = {
  'settings-outline': 62828,
  'chevron-back': 61993,
  'chevron-forward': 62011,
  'open-outline': 62600,
  'star-outline': 62873,
  'star-half-outline': 62871,
  'star': 62869,
  'albums-outline': 61712,
  'close': 62026,
  'checkmark-circle': 61982,
  'timer-outline': 62945,
  'information-circle-outline': 62361,
  'cloud-download-outline': 62040,
  'earth-outline': 62147,
  'mail-outline': 62516,
  'eye-off-outline': 62184,
  'eye-outline': 62186,
  'search-outline': 62819,
  'reload-outline': 62750,
  'add-outline': 61703
} as const

export type IoniconsName = keyof typeof IONICONS

interface IconProps {
  name: IoniconsName
  size?: number
  color?: string
  style?: CSSProperties
}

/** Ionicons 字符图标 */
export function Icon({ name, size = 20, color = '#EAF0FF', style }: IconProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: "'Ionicons', system-ui, sans-serif",
        fontSize: size,
        lineHeight: 1,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 部分 Windows 字体渲染会偏移，这里固定行高保证居中
        height: size,
        width: size,
        ...style
      }}
    >
      {String.fromCodePoint(IONICONS[name])}
    </span>
  )
}

/** 标签栏用的日历图标（lucide calendar） */
export function CalendarIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

/** 标签栏用的「源」图标（lucide square-code） */
export function SourceIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="m10 9-3 3 3 3" />
      <path d="m14 15 3-3-3-3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

/** 标签栏用的收藏图标（lucide star） */
export function StarTabIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  )
}

/** 搜索框里的放大镜 */
export function SearchIcon({ size = 18, color = '#667085' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-4-4" />
    </svg>
  )
}

/** 刷新图标（lucide rotate-cw）；加载中时旋转，由外部传入 className 控制 */
export function RefreshIcon({
  size = 18,
  color = '#EAF0FF',
  className
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}
