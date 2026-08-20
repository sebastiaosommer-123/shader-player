/**
 * Which device last drove the page — a pointer, or the keyboard.
 *
 * `:focus-visible` is very nearly this already, and every ring in the app is
 * behind it, but it has one hole. When focus is moved by *script* rather than by
 * the user, the engines disagree about what to paint: Chrome looks at the last
 * real interaction and stays quiet after a tap, WebKit paints the ring anyway.
 * Radix moves focus by script twice per dialog — into it on open, back to the
 * trigger on close — so on iOS every tap that opened the gallery lit a ring
 * around its close button, and every tap that closed it lit one around the
 * thumbnail it returned to.
 *
 * So a ring gets a second condition alongside `:focus-visible`: the keyboard has
 * to be what the page was last driven with. That pairing is the `focusKey`
 * variant in globals.css, and this attribute is what feeds it.
 *
 * Note what this does *not* do: focus still moves exactly as it did, because a
 * screen reader on a touchscreen needs it to, and the ring still appears for
 * every keyboard user on every device — a Bluetooth keyboard on a tablet is a
 * keyboard. Only the drawing is conditional, which is the whole distinction
 * between focus as an accessibility state and focus as a tap state.
 *
 * A boot script rather than an effect, for the same reason as
 * SIDEBAR_WIDTH_BOOT_SCRIPT: the attribute has to be on <html> before the first
 * paint, and the listeners have to be live before the first tap — which on a
 * phone comfortably beats hydration.
 */

/** Read by the `focusKey` variant in globals.css. Keep the two in step. */
export const INPUT_MODALITY_ATTRIBUTE = "data-input"

/**
 * Pointer is the resting state, so nothing is drawn until a key is actually
 * pressed. Capture phase on both, so the attribute is already correct by the
 * time the event reaches a handler that moves focus — a `keydown` listener that
 * ran second would set the modality one frame after the focus it explains.
 *
 * Modified keys are not the keyboard being used to navigate: ⌘R and ⌘L are the
 * browser's, and treating them as intent would ring whatever the last tap left
 * focused.
 */
export const INPUT_MODALITY_BOOT_SCRIPT = `try{var d=document.documentElement,a=${JSON.stringify(
  INPUT_MODALITY_ATTRIBUTE
)},s=function(v){if(d.getAttribute(a)!==v)d.setAttribute(a,v)};s("pointer");addEventListener("pointerdown",function(){s("pointer")},true);addEventListener("keydown",function(e){if(e.metaKey||e.altKey||e.ctrlKey)return;s("keyboard")},true)}catch(e){}`
