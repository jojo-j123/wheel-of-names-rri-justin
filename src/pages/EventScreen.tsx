import { Stage } from '../components/stage/Stage'
import { usePresent } from '../hooks/usePresent'
import { useActiveEvent } from '../store/appStore'

/** Main operator screen: the live wheel + a subtle ADMIN button + draw controls. */
export function EventScreen() {
  const event = useActiveEvent()
  const present = usePresent()
  if (!event) return null
  return <Stage key={event.id} event={event} mode="operator" onPresent={() => present(event.id)} />
}
