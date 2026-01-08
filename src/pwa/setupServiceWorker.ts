export type RegisterSWFn = (opts: {
  immediate?: boolean
  onRegisterError?: (error: unknown) => void
}) => void

type ServiceWorkerLike = {
  addEventListener: (type: string, listener: (event?: unknown) => void) => void
  getRegistration: () => Promise<ServiceWorkerRegistrationLike | undefined | null>
}

type ServiceWorkerRegistrationLike = {
  update: () => Promise<void>
  waiting?: { postMessage: (message: unknown) => void } | null
  installing?: {
    state?: string
    addEventListener: (type: string, listener: () => void) => void
  } | null
  addEventListener: (type: string, listener: () => void) => void
}

type NavigatorLike = {
  onLine: boolean
  serviceWorker?: ServiceWorkerLike
}

type WindowLike = {
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  location: { reload: () => void }
}

let hasReloadedForSwUpdate = false

export function setupPwaServiceWorker(params: {
  registerSW?: RegisterSWFn
  navigatorObj: NavigatorLike
  windowObj: WindowLike
}): void {
  const { registerSW, navigatorObj, windowObj } = params

  const sw = navigatorObj.serviceWorker
  if (!sw) return

  // SW 등록(자동 주입 스크립트 대신) + 에러를 치명적으로 올리지 않도록 보호
  try {
    registerSW?.({
      immediate: true,
      onRegisterError(error) {
        console.warn('[pwa] service worker register failed', error)
      },
    })
  } catch (error) {
    console.warn('[pwa] registerSW init failed', error)
  }

  // 컨트롤러 교체 시 1회 리로드
  sw.addEventListener('controllerchange', () => {
    if (hasReloadedForSwUpdate) return
    hasReloadedForSwUpdate = true
    windowObj.location.reload()
  })

  const tryUpdate = async (reg: ServiceWorkerRegistrationLike) => {
    if (!navigatorObj.onLine) return
    try {
      await reg.update()
    } catch {
      // ignore
    }
  }

  void sw
    .getRegistration()
    .then((reg) => {
      if (!reg) return

      void tryUpdate(reg)

      const onOnline = () => void tryUpdate(reg)
      windowObj.addEventListener('online', onOnline)

      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        } catch {
          // ignore
        }
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && reg.waiting) {
            try {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            } catch {
              // ignore
            }
          }
        })
      })

      windowObj.addEventListener('beforeunload', () => {
        windowObj.removeEventListener('online', onOnline)
      })
    })
    .catch(() => {
      // ignore
    })
}
