import { urlPattern } from './kits/url-pattern.js'

export namespace path{
  export const group = urlPattern.path('group', Number)
  export const receiver = urlPattern.path('receiver')
}
