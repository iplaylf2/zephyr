/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { RedisClientType } from '@redis/client'

export interface RedisService extends RedisClientType {}
export abstract class RedisService {}
