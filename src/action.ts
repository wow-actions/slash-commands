import * as core from '@actions/core'
import * as github from '@actions/github'
import { Util } from './util'
import { Config } from './config'

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
        label,
        labels,
        pin,
        unpin,
        assign,
        dispatch,
      } = actions

      const data = { args, input: args.join(' ') }
      const params = { ...context.repo, issue_number: payload.number }

      if (pin) {
        await Util.pin(octokit, true)
      }

      if (unpin) {
        await Util.pin(octokit, false)
      }

      if (comment) {
        await Util.comment(octokit, comment, reactions, data)
      }

      if (open && payload.state === 'closed') {
        await octokit.issues.update({ ...params, state: 'open' })
      }

      if (close && payload.state === 'open') {
        await octokit.issues.update({ ...params, state: 'closed' })
      }

      if (lock && !payload.locked) {
        await octokit.issues.lock({
          ...params,
          lock_reason: lockReason,
        })
      }

      if (unlock && payload.locked) {
        await octokit.issues.unlock({ ...params })
      }

      if (label) {
        await Util.label(octokit, label, data)
      }

      if (labels) {
        await Util.label(octokit, labels, data)
      }

      if (assign) {
        await Util.assign(octokit, assign, data)
      }

      if (dispatch) {
        await octokit.repos.createDispatchEvent({
          ...context.repo,
          event_type: command,
          client_payload: { args: data.args },
        })
      }

      core.setOutput('command', command)
      core.setOutput('args', args.join(' '))
    } catch (e) {
      core.error(e)
      core.setFailed(e.message)
    }
  }
}
