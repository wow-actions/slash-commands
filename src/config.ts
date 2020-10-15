import * as github from '@actions/github'
import yaml from 'js-yaml'
import { Util } from './util'

export namespace Config {
  export type LockReason = 'off-topic' | 'too heated' | 'resolved' | 'spam'

  interface Actions {
    close?: boolean
    open?: boolean
    lock?: boolean
    unlock?: boolean
    lockReason?: LockReason
    pin?: boolean
    unpin?: boolean
    dispatch?: boolean
    comment?: string | string[]
    reactions?: string | string[]
    label?: string | string[]
    labels?: string | string[]
    assign?: string | string[]
  }

  interface Strict {
    [command: string]: Actions
  }

  interface Loose {
    issues?: Strict
    pulls?: Strict
  }

  type Definition = Strict & Loose

  export async function get(
    octokit: ReturnType<typeof github.getOctokit>,
    path?: string,
  ): Promise<Definition> {
    try {
      if (path) {
        const content = await Util.getFileContent(octokit, path)
        if (content) {
          const config = yaml.safeLoad(content)
          return typeof config === 'object' ? (config as Definition) : {}
        }
      }

      return {}
    } catch (e) {
      if (e.status === 404) {
        return {}
      }

      throw e
    }
  }

  export function getActions(
    config: Definition,
    type: 'issues' | 'pulls',
    command: string,
  ): Actions {
    const section = config[type]
    if (section && section[command]) {
      return section[command]
    }

    return config[command] || {}
  }
}
