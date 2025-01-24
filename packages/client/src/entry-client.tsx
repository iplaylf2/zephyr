/* @refresh reload */
import { App } from './app'
import { hydrate } from 'solid-js/web'

hydrate(() => <App />, document.documentElement)
