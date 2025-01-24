/* @refresh reload */
import { App } from './app'
import { hydrate } from 'solid-js/web'

hydrate(() => <App />, document.getElementById('root') as HTMLElement)
