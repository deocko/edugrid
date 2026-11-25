/**
 * Vibración corta al tocar un botón (barra inferior en celular y tableta).
 * Android: Vibration API. iPhone (Safari 18 o más nuevo) no tiene esa API, pero vibra al tocar
 * un interruptor nativo (`<input type="checkbox" switch>`), así que se usa uno oculto.
 * En equipos sin vibración no hace nada.
 */
let iosSwitch: HTMLLabelElement | null = null

export function tapFeedback() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12)
      return
    }
    if (typeof document === 'undefined') return
    if (!iosSwitch) {
      const label = document.createElement('label')
      label.setAttribute('aria-hidden', 'true')
      label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.tabIndex = -1
      label.appendChild(input)
      document.body.appendChild(label)
      iosSwitch = label
    }
    iosSwitch.click()
  } catch {
    // Sin vibración disponible: no pasa nada.
  }
}
