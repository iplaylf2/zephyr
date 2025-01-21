import { urlPattern } from './kits/url-pattern.js'

export namespace path{
  export const group = urlPattern.path('group', Number)
  export const token = urlPattern.path('token')
}
