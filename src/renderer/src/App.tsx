/**
 * @file 应用外壳：窗口标题栏 + 顶部标题栏 + 页面容器 + 底部标签栏。
 *
 * 对应原 App 的 app/_layout.tsx 与 app/(tabs)/_layout.tsx：
 * 标签页显示底部标签栏，二级页面（搜索 / 设置 / 关于…）显示返回按钮。
 */

import type { ReactNode } from 'react'
import { AppHeader } from './components/AppHeader'
import { CalendarIcon, Icon, SourceIcon, StarTabIcon } from './components/Icon'
import { WindowTitlebar } from './components/WindowTitlebar'
import { useNavigation, type Route, type TabKey } from './navigation'
import { AboutScreen } from './pages/AboutScreen'
import { CalendarScreen } from './pages/CalendarScreen'
import { FavoriteScreen } from './pages/FavoriteScreen'
import { MoreSearchScreen } from './pages/MoreSearchScreen'
import { SearchScreen } from './pages/SearchScreen'
import { SettingsScreen } from './pages/SettingsScreen'
import { SourceScreen } from './pages/SourceScreen'
import { WebviewScreen } from './pages/WebviewScreen'

/** 各标签对应的顶部标题 */
const TAB_TITLES: Record<TabKey, string> = {
  calendar: '日历',
  source: '源',
  favorite: '收藏'
}

/** 底部标签定义 */
const TABS: { key: TabKey; label: string; Icon: (props: { color: string }) => ReactNode }[] = [
  { key: 'calendar', label: '日历', Icon: CalendarIcon },
  { key: 'source', label: '源', Icon: SourceIcon },
  { key: 'favorite', label: '收藏', Icon: StarTabIcon }
]

export function App() {
  const { route, canGoBack, activeTab, switchTab, back, push } = useNavigation()

  const isWebview = route.name === 'webview'
  const isTabs = route.name === 'tabs'

  /** 当前页面的标题与顶栏按钮 */
  const header = resolveHeader(route, activeTab, {
    back,
    openSettings: () => push({ name: 'settings' }),
    openMoreSearch: () => push({ name: 'more-search' })
  })

  return (
    <div className="app">
      <WindowTitlebar />

      {/* 内置浏览器页自带完整工具栏，避免出现两层标题 */}
      {!isWebview && (
        <AppHeader
          title={header.title}
          showBack={canGoBack && !isTabs}
          onBackPress={back}
          icon={header.icon}
          onIconPress={header.onIconPress}
        />
      )}

      <main className={`app__content${isWebview ? ' app__content--flush' : ''}`}>
        <PageContent route={route} />
      </main>

      <nav className="tabbar">
        {TABS.map(({ key, label, Icon: TabIcon }) => {
          const focused = activeTab === key
          const color = focused ? 'rgba(124, 146, 255, 1)' : 'rgba(234, 240, 255, 0.55)'
          return (
            <button
              key={key}
              className={`tabbar__item${focused ? ' tabbar__item--active' : ''}`}
              onClick={() => switchTab(key)}
            >
              <TabIcon color={color} />
              <span className="tabbar__label">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** 根据当前路由渲染页面内容 */
function PageContent({ route }: { route: Route }) {
  switch (route.name) {
    case 'tabs':
      return <TabContent tab={route.tab} />
    case 'search':
      return <SearchScreen q={route.q} />
    case 'webview':
      return <WebviewScreen url={route.url} type={route.type} userAgent={route.userAgent} title={route.title} />
    case 'settings':
      return <SettingsScreen />
    case 'about':
      return <AboutScreen />
    case 'more-search':
      return <MoreSearchScreen />
    default:
      return null
  }
}

/** 三个标签页分别是独立组件，切换时重新挂载以刷新数据 */
function TabContent({ tab }: { tab: TabKey }) {
  switch (tab) {
    case 'calendar':
      return <CalendarScreen />
    case 'source':
      return <SourceScreen />
    case 'favorite':
      return <FavoriteScreen />
  }
}

interface HeaderActions {
  back: () => void
  openSettings: () => void
  openMoreSearch: () => void
}

/** 计算每个页面的标题与顶栏右侧按钮 */
function resolveHeader(route: Route, activeTab: TabKey, actions: HeaderActions) {
  switch (route.name) {
    case 'tabs':
      return {
        title: TAB_TITLES[activeTab] ?? '番剧下载',
        icon: <Icon name="settings-outline" size={20} />,
        onIconPress: actions.openSettings
      }
    case 'search':
      return {
        title: route.q ? `搜索: ${route.q}` : '搜索',
        icon: <Icon name="albums-outline" size={20} />,
        onIconPress: actions.openMoreSearch
      }
    case 'settings':
      return { title: '设置', icon: undefined, onIconPress: undefined }
    case 'about':
      return { title: '关于', icon: undefined, onIconPress: undefined }
    case 'more-search':
      return { title: '更多搜索', icon: undefined, onIconPress: undefined }
    default:
      return { title: '番剧下载', icon: undefined, onIconPress: undefined }
  }
}
