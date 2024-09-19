import { urlPattern } from './kits/url-pattern.js'

export namespace path{
  export const chatroom = urlPattern.path('chatroom', Number)
  export const receiver = urlPattern.path('receiver')
}
