import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import mustache from 'mustache'
import random from 'lodash.random'

export namespace Util {
  export function getOctokit() {
    const token = core.getInput('GITHUB_TOKEN', { required: true })
    return github.getOctokit(token)
  }

  export function pickComment(
    comment: string | string[],
    args?: { [key: string]: any },
  ) {
    let result: string
    if (typeof comment === 'string' || comment instanceof String) {
      result = comment.toString()
    } else {
      const pos = random(0, comment.length, false)
      result = comment[pos] || comment[0]
    }

    return args ? mustache.render(result, args) : result
  }

  export function isValidEvent(event: string, action?: string) {
    const context = github.context
    const payload = context.payload
    if (event === context.eventName) {
      return action == null || action === payload.action
    }
    return false
  }

  export async function getFileContent(
    octokit: ReturnType<typeof getOctokit>,
    path: string,
  ) {
    try {
      const response = await octokit.repos.getContent({
        ...github.context.repo,
        path,
      })

      const content = response.data.content
      return Buffer.from(content, 'base64').toString()
    } catch (err) {
      return null
    }
  }

  export async function lockIssue(
    octokit: ReturnType<typeof getOctokit>,
    context: Context,
    lockReason?: string,
  ): Promise<any> {
    const payload = context.payload.issue || context.payload.pull_request
    if (payload) {
      const params = { ...context.repo, issue_number: payload.number }
      return lockReason
        ? octokit.github.issues.lock({
            ...params,
            lock_reason: lockReason,
            headers: {
              Accept: 'application/vnd.github.sailor-v-preview+json',
            },
          })
        : octokit.github.issues.lock({ ...params })
    }
  }

  export async function ensureUnlock(
    octokit: ReturnType<typeof getOctokit>,
    context: Context,
    callback: (() => void) | (() => Promise<any>),
  ) {
    const payload = context.payload.issue || context.payload.pull_request
    if (payload && payload.locked) {
      const params = { ...context.repo, issue_number: payload.number }
      const lockReason = payload.active_lock_reason as string
      await octokit.issues.unlock({ ...params })
      await callback()
      await lockIssue(octokit, context, lockReason)
    } else {
      await callback()
    }
  }

  // https://regex101.com/r/3PkLfT/1
  const TOKENISE_REGEX = /\S+="[^"\\]*(?:\\.[^"\\]*)*"|"[^"\\]*(?:\\.[^"\\]*)*"|\S+/g

  export function tokeniseCommand(command: string) {
    let matches
    const output: string[] = []
    while ((matches = TOKENISE_REGEX.exec(command))) {
      output.push(matches[0])
    }

    return {
      command: output[0],
      args: output.slice(1),
    }
  }
}
