import * as core from '@actions/core'
import * as github from '@actions/github'
import mustache from 'mustache'
import random from 'lodash.random'
import { Config } from './config'
import { Reaction } from './reaction'

export namespace Util {
  // https://regex101.com/r/3PkLfT/1
  const TOKENISE_REGEX =
    /\S+="[^"\\]*(?:\\.[^"\\]*)*"|"[^"\\]*(?:\\.[^"\\]*)*"|\S+/g

  export function tokeniseCommand(command: string) {
    let matches
    const output: string[] = []
    // eslint-disable-next-line no-cond-assign
    while ((matches = TOKENISE_REGEX.exec(command))) {
      output.push(matches[0])
    }

    return {
      command: output[0],
      args: output.slice(1),
    }
  }

  export function getOctokit() {
    const token = core.getInput('GITHUB_TOKEN', { required: true })
    return github.getOctokit(token)
  }

  export function pickComment(
    content: string | string[],
    args?: { [key: string]: any },
  ) {
    let result: string
    if (typeof content === 'string' || content instanceof String) {
      result = content.toString()
    } else {
      const pos = random(0, content.length, false)
      result = content[pos] || content[0]
    }

    return args ? mustache.render(result, args) : result
  }

  export function isValidEvent(event: string, action?: string) {
    const { context } = github
    const { payload } = context
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
      const response = await octokit.rest.repos.getContent({
        ...github.context.repo,
        path,
      })

      const { content } = response.data as any
      return Buffer.from(content, 'base64').toString()
    } catch (err) {
      return null
    }
  }

  export async function ensureUnlock(
    octokit: ReturnType<typeof getOctokit>,
    callback: (() => void) | (() => Promise<any>),
  ) {
    const { context } = github
    const payload = context.payload.issue || context.payload.pull_request
    if (payload && payload.locked) {
      const params = { ...context.repo, issue_number: payload.number }
      const lockReason = payload.active_lock_reason as Config.LockReason
      await octokit.rest.issues.unlock({ ...params })
      await callback()
      await octokit.rest.issues.lock({
        ...params,
        lock_reason: lockReason,
      })
    } else {
      await callback()
    }
  }

  export async function comment(
    octokit: ReturnType<typeof getOctokit>,
    content: string | string[],
    reactions: string | string[] | undefined,
    metadata: any,
  ) {
    const { context } = github
    const payload = (context.payload.issue || context.payload.pull_request)!
    const params = { ...context.repo, issue_number: payload.number }
    const body = pickComment(content, {
      ...metadata,
      author: payload.user.login,
    })

    return ensureUnlock(octokit, async () => {
      const { data } = await octokit.rest.issues.createComment({
        ...params,
        body,
      })

      if (reactions) {
        await Reaction.add(octokit, data.id, reactions)
      }
    })
  }

  export async function label(
    octokit: ReturnType<typeof getOctokit>,
    labels: string | string[],
    metadata: any,
  ) {
    const labelsToAdd: string[] = []
    const labelsToRemove: string[] = []
    const { context } = github
    const payload = (context.payload.issue || context.payload.pull_request)!
    const params = { ...context.repo, issue_number: payload.number }
    const process = (raw: string) => {
      mustache
        .render(raw, metadata)
        .split(/\s+/)
        .forEach((item) => {
          let name = item.trim()
          if (name.startsWith('-')) {
            name = name.substr(1)
            if (name.length) {
              labelsToRemove.push(name)
            }
          } else if (name.length) {
            labelsToAdd.push(name)
          }
        })
    }

    if (Array.isArray(labels)) {
      labels.forEach((item) => process(item))
    } else {
      process(labels)
    }

    if (labelsToAdd.length) {
      await octokit.rest.issues.addLabels({ ...params, labels: labelsToAdd })
    }

    if (labelsToRemove.length) {
      const removeAll = labelsToRemove.some((item) => item === '*')
      let items: string[] = labelsToRemove
      if (removeAll && payload.labels) {
        items = payload.labels.map((item: any) => item.name)
      }

      await Promise.all(
        items.map(async (name) => {
          await octokit.rest.issues.removeLabel({ ...params, name })
        }),
      )
    }
  }

  export async function assign(
    octokit: ReturnType<typeof getOctokit>,
    users: string | string[],
    data: any,
  ) {
    const { context } = github
    const payload = (context.payload.issue || context.payload.pull_request)!
    const assigneesToAdd: string[] = []
    const assigneesToRemove: string[] = []

    const process = (raw: string) => {
      const username = (user: string) => {
        const ret = user.trim()
        return ret.startsWith('@') ? ret.substr(1) : ret
      }

      return mustache
        .render(raw, data)
        .split(/\s+/g)
        .forEach((item) => {
          let user = item.trim()
          if (user.startsWith('-')) {
            user = username(user.substr(1))
            if (user.length) {
              assigneesToRemove.push(user)
            }
          } else {
            user = username(user)
            if (user.length) {
              assigneesToAdd.push(user)
            }
          }
        })
    }

    if (Array.isArray(users)) {
      users.forEach(process)
    } else {
      process(users)
    }

    if (assigneesToRemove.length) {
      const removeAll = assigneesToRemove.some((user) => user === '*')
      let assignees = assigneesToRemove
      if (removeAll && payload.assignees) {
        assignees = payload.assignees.map((item: any) => item.login)
      }

      await octokit.rest.issues.removeAssignees({
        ...context.repo,
        assignees,
        issue_number: payload.number,
      })
    }

    if (assigneesToAdd.length) {
      await octokit.rest.issues.addAssignees({
        ...context.repo,
        assignees: assigneesToAdd,
        issue_number: payload.number,
      })
    }
  }

  export async function pin(
    octokit: ReturnType<typeof getOctokit>,
    pinned: boolean,
  ) {
    // https://developer.github.com/v4/input_object/pinissueinput/
    const mutation = pinned
      ? `mutation ($input: PinIssueInput!) {
          pinIssue(input: $input) {
            issue {
              title
            }
          }
        }`
      : `mutation ($input: UnpinIssueInput!) {
          unpinIssue(input: $input) {
            issue {
              title
            }
          }
        }`

    const { context } = github
    const payload = (context.payload.issue || context.payload.pull_request)!
    return octokit.graphql(mutation, {
      input: {
        issueId: payload.node_id,
        clientMutationId: 'top3 pinned',
      },
      headers: {
        Accept: 'application/vnd.github.elektra-preview',
      },
    })
  }
}
