import * as core from '@actions/core'
import * as github from '@actions/github'
import mustache from 'mustache'
import { Util } from './util'
import { Config } from './config'
import { Reaction } from './reaction'

export namespace Action {
  export async function run() {
    try {
      const context = github.context
      const payload = context.payload.issue || context.payload.pull_request
      const commentBody = context.payload.comment!.body as string

      if (!Util.isValidEvent('issue_comment', 'created') || !payload) {
        core.warning('This action is only supposed on comment created.')
        return
      }

      // Check if the first line of the comment is a slash command
      const firstLine = commentBody.split(/\r?\n/)[0].trim()
      if (firstLine.length < 2 || firstLine.charAt(0) !== '/') {
        core.debug(
          'The first line of the comment is not a valid slash command.',
        )
        return
      }

      const octokit = Util.getOctokit()
      const configPath = core.getInput('CONFIG_FILE')
      const config = await Config.get(octokit, configPath)
      if (configPath) {
        core.debug(
          `Load config from "${configPath}": \n${JSON.stringify(
            config,
            null,
            2,
          )}`,
        )
      }

      const { command, args } = Util.tokeniseCommand(firstLine.slice(1))
      core.debug(`Command Name: ${command}`)
      core.debug(`Command Args: ${args}`)

      const actions = Config.getActions(
        config,
        context.payload.issue != null ? 'issues' : 'pulls',
        command,
      )

      core.debug(`Actions: ${JSON.stringify(actions, null, 2)}`)

      const {
        comment,
        reactions,
        open,
        close,
        lock,
        unlock,
        lockReason,
        labels,
      } = actions

      const data = { args, input: args.join(' ') }
      const params = { ...context.repo, issue_number: payload.number }

      if (comment) {
        const body = Util.pickComment(comment, {
          ...data,
          author: payload.user.login,
        })

        await Util.ensureUnlock(octokit, context, async () => {
          const { data } = await octokit.issues.createComment({
            ...params,
            body,
          })

          if (reactions) {
            Reaction.add(octokit, data.id, reactions)
          }
        })
      }

      if (open && payload.state === 'closed') {
        await octokit.issues.update({ ...params, state: 'open' })
      }

      if (close && payload.state === 'open') {
        await octokit.issues.update({ ...params, state: 'closed' })
      }

      if (lock && !payload.locked) {
        await Util.lockIssue(octokit, context, lockReason)
      }

      if (unlock && payload.locked) {
        await octokit.issues.unlock({ ...params })
      }

      if (labels) {
        const labelsToAdd: string[] = []
        const labelsToRemove: string[] = []
        const processLabel = (raw: string) => {
          const label = mustache.render(raw, data)
          if (label.startsWith('-')) {
            labelsToRemove.push(label.substr(1))
          } else {
            labelsToAdd.push(label)
          }
        }

        if (Array.isArray(labels)) {
          labels.forEach((item) => processLabel(item))
        } else {
          processLabel(labels)
        }

        if (labelsToAdd.length) {
          octokit.issues.addLabels({ ...params, labels: labelsToAdd })
        }

        labelsToRemove.forEach((name) => {
          octokit.issues.removeLabel({ ...params, name })
        })
      }
    } catch (e) {
      core.error(e)
      core.setFailed(e.message)
    }
  }
}
