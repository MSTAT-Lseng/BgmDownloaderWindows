/**
 * @file 应用内弹窗的可见性广播。
 *
 * 背景：内置浏览器页用原生 WebContentsView 承载站点页面，它是独立的合成层，
 * 永远浮在渲染进程内容之上。应用内弹窗（遮罩 + 对话框）属于渲染层，
 * 弹窗一旦落在该视图的区域内就会被盖住——表现为「点了收藏，标题栏和标签栏变灰，
 * 但对话框看不见」。遮罩之所以可见，是因为它铺满了整个窗口，只有边缘露出来。
 *
 * 解决办法：弹窗打开期间把原生视图隐藏，关闭后再显示。
 * 这里用极简的订阅表实现，prompt / confirm 打开时登记，WebviewScreen 订阅。
 */

type Listener = (anyOpen: boolean) => void

const listeners = new Set<Listener>()
// 记录当前打开的弹窗种类，避免 prompt 和 confirm 同时关闭时过早结束隐藏
const openDialogs = new Set<string>()

function notify() {
  const anyOpen = openDialogs.size > 0
  listeners.forEach((fn) => fn(anyOpen))
}

/** 登记某个弹窗的打开 / 关闭状态 */
export function setDialogOpen(kind: string, open: boolean) {
  if (open) openDialogs.add(kind)
  else openDialogs.delete(kind)
  notify()
}

/** 订阅「是否有任何弹窗打开」，返回取消订阅函数 */
export function subscribeDialogOpen(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
