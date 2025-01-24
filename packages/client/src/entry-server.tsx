import { App } from './app'
import { renderToString } from 'solid-js/web'

export function render(url: string) {
  void url

  const html = renderToString(() => <App />)

  return { html }
}
