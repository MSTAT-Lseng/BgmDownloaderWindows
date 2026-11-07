/**
 * @file 关于页：展示应用信息，提供官网、检查更新与邮箱反馈入口。
 * 对应原 App 的 app/pages/about.tsx。
 */

import { useEffect, useState } from 'react'
import { Icon, type IoniconsName } from '../components/Icon'
import { getApi } from '../services/bridge'
import { useToast } from '../services/toast'

export function AboutScreen() {
  const [version, setVersion] = useState('')
  const { show } = useToast()

  useEffect(() => {
    void getApi()
      .getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('0.0.0'))
  }, [])

  const openUrl = (url: string) => {
    void getApi()
      .openExternal(url)
      .catch((err) => console.error("Couldn't load page", err))
  }

  /** 手动检查更新：先提示，再交给主进程弹窗 */
  const checkUpdateHandler = async () => {
    show('检查更新中...')
    try {
      const result = await getApi().checkUpdate()
      if (!result.hasUpdate) show('已经是最新版本')
    } catch {
      show('检查更新失败')
    }
  }

  return (
    <div className="page about-page">
      <div className="about-logo">
        <img className="about-logo__img" src="./images/appicon.png" alt="" />
        <p className="about-logo__name">番剧下载</p>
        <p className="about-logo__version">Version {version || '—'}</p>
      </div>

      <div className="list">
        <AboutItem
          title="访问官网"
          subTitle="番剧下载的官方网站"
          icon="earth-outline"
          onPress={() => openUrl('https://mstat.top/bgm_downloader/')}
        />
        <AboutItem title="检查更新" icon="cloud-download-outline" onPress={() => void checkUpdateHandler()} />
        <AboutItem title="邮箱反馈" subTitle="ms_tat@163.com" icon="mail-outline" onPress={() => openUrl('mailto:ms_tat@163.com')} />
      </div>

      <div className="about-footer">
        <p>Copyright © 2026 过气萌新</p>
        <p>Some Rights Reserved</p>
      </div>
    </div>
  )
}

/** 关于页的列表行，与设置页的配置行风格保持一致 */
function AboutItem({
  title,
  subTitle,
  icon,
  onPress
}: {
  title: string
  subTitle?: string
  icon: IoniconsName
  onPress: () => void
}) {
  return (
    <button className="about-item" onClick={onPress}>
      <span className="setting-item__left">
        <Icon name={icon} size={20} color="#fff" style={{ marginRight: 12 }} />
        <span className="setting-item__text">
          <span className="setting-item__title">{title}</span>
          {subTitle ? <span className="setting-item__sub">{subTitle}</span> : null}
        </span>
      </span>
      <Icon name="chevron-forward" size={18} color="#444" />
    </button>
  )
}
