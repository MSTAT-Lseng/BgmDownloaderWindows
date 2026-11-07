/**
 * @file 设置页：搜索超时时间的选择，以及关于软件的入口。
 * 对应原 App 的 app/settings.tsx。
 */

import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useNavigation } from '../navigation'
import { getApi } from '../services/bridge'
import { getSearchTimeout, setSearchTimeout, TIMEOUT_OPTIONS } from '../services/settings'

export function SettingsScreen() {
  const { push } = useNavigation()
  const [version, setVersion] = useState('')
  const [timeout, setTimeoutState] = useState<number>(5)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getSearchTimeout().then(setTimeoutState)
    void getApi()
      .getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('0.0.0'))
  }, [])

  /** 选中某个超时秒数：写库成功后立即更新界面并关闭弹窗 */
  const handleSelectTimeout = async (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return
    try {
      setSaving(true)
      await setSearchTimeout(value)
      setTimeoutState(value)
      setModalVisible(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="settings-content">
        <p className="settings-section">搜索</p>

        <SettingItem
          title="超时时间"
          subTitle="加载搜索结果最长的等待时间"
          icon="timer-outline"
          rightText={`${timeout} 秒`}
          onPress={() => setModalVisible(true)}
        />

        <p className="settings-section">关于</p>

        <SettingItem
          title="关于软件"
          icon="information-circle-outline"
          rightText={version ? `v${version}` : ''}
          onPress={() => push({ name: 'about' })}
        />
      </div>

      {modalVisible && (
        <div className="modal-mask modal-mask--bottom" onClick={() => !saving && setModalVisible(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__header">
              <h2 className="sheet__title">搜索超时时间</h2>
              <button className="icon-btn" onClick={() => setModalVisible(false)} disabled={saving} title="关闭">
                <Icon name="close" size={18} color="#AAA" />
              </button>
            </div>

            <p className="sheet__desc">选择一次搜索最多等待的时间（单位：秒）。</p>

            <div className="option-list">
              {TIMEOUT_OPTIONS.map((v) => {
                const selected = v === timeout
                return (
                  <button
                    key={v}
                    className={`option-item${selected ? ' option-item--selected' : ''}`}
                    onClick={() => void handleSelectTimeout(v)}
                    disabled={saving}
                  >
                    <span className="option-item__left">
                      <span className="option-item__text">{v} 秒</span>
                      {selected ? <span className="option-item__tag">当前</span> : null}
                    </span>
                    <Icon
                      name={selected ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={selected ? '#2F80ED' : '#444'}
                    />
                  </button>
                )
              })}
            </div>

            <p className="sheet__hint">提示：超时时间越长，弱网下更不容易失败，但等待会更久。</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** 通用配置行：左侧图标 + 标题 / 副标题，右侧文字与箭头 */
function SettingItem({
  title,
  subTitle,
  icon,
  rightText,
  onPress
}: {
  title: string
  subTitle?: string
  icon: 'timer-outline' | 'information-circle-outline'
  rightText?: string
  onPress?: () => void
}) {
  return (
    <button className="setting-item" onClick={onPress} disabled={!onPress}>
      <span className="setting-item__left">
        <Icon name={icon} size={20} color="#fff" style={{ marginRight: 12 }} />
        <span className="setting-item__text">
          <span className="setting-item__title">{title}</span>
          {subTitle ? <span className="setting-item__sub">{subTitle}</span> : null}
        </span>
      </span>
      <span className="setting-item__right">
        {rightText ? <span className="setting-item__value">{rightText}</span> : null}
        {onPress ? <Icon name="chevron-forward" size={18} color="#444" /> : null}
      </span>
    </button>
  )
}
