import * as m1 from './dialogue/dialogue.module.js'
import * as m2 from './dialogue/dialogue.service.js'
import * as m3 from './group/group.module.js'
import * as m4 from './group/group.service.js'

export namespace conversation{
  export const DialogueModule = m1.DialogueModule
  export type DialogueModule = m1.DialogueModule

  export const DialogueService = m2.DialogueService
  export type DialogueService = m2.DialogueService

  export const GroupModule = m3.GroupModule
  export type GroupModule = m3.GroupModule

  export const GroupService = m4.GroupService
  export type GroupService = m4.GroupService
}
