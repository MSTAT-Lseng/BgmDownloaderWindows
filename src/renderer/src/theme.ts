/**
 * @file 常用的主题色与尺寸常量。
 *
 * 颜色沿用 Expo 版的深色基调（背景 #05070C、标题 #E9EDF5 等），
 * 保证桌面版与原 App 视觉一致。
 */

export const COLORS = {
  /** 页面底色 */
  background: '#05070C',
  /** 顶栏 / 卡片底色 */
  surface: '#0B0F1A',
  /** 略亮的卡片 */
  surfaceAlt: '#0B1020',
  /** 分组卡片 */
  surfaceRaised: '#111827',
  /** 主文字 */
  text: '#E9EDF5',
  /** 标题栏文字 */
  headerText: '#EAF0FF',
  /** 次要文字 */
  textMuted: '#90A0B8',
  /** 更弱的文字 */
  textFaint: 'rgba(255,255,255,0.45)',
  /** 强调色 */
  primary: '#3B82F6',
  /** 标签页选中色 */
  tabActive: 'rgba(124, 146, 255, 1)',
  /** 标签页未选中色 */
  tabInactive: 'rgba(234, 240, 255, 0.55)',
  /** 分割线 */
  border: 'rgba(255,255,255,0.08)',
  /** 危险操作 */
  danger: '#ef5350'
} as const

/** 顶栏高度（不含窗口标题栏） */
export const HEADER_HEIGHT = 52
/** 底部标签栏高度 */
export const TABBAR_HEIGHT = 58
