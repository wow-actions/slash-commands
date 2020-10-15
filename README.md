# Custom Slash Commands

> A Github Action to perform commands when Issues or Pull Requests are commented with slash commands. Slash commands are lines that start with `/` in comments on Issues or Pull Requests.

## How It Works

This Github Action performs certain commands when an issue or pull request is commented with slash command. The following commands are supported:

- Post a comment (`comment` and `reactions` option)
- Add or remove labels (`label` option), label prefixed with `-` will be removed, others will be added. User `'-*'` to remove all labels.
- Close (`close` option)
- Reopen (`open` option)
- Lock with an optional lock reason (`lock` and `lockReason` options)
- Unlock (`unlock` option)
- Pin an issue (`pin` option)
- UnPin an issue (`unpin` option)
- Assign issues/PRs(`assign` option), username prefixed with `-` will be removed from assignees, others will be added. User `'-*'` to remove all assignees.
- Dispatch the command (`dispatch` option). You can use this command to trigger a webhook event called `repository_dispatch` when you want activity that happens outside of GitHub to trigger a GitHub Actions workflow or GitHub App webhook. You must configure your GitHub Actions workflow or GitHub App to run when the `repository_dispatch` event occurs. And the `event_type` is the command name, the `client_payload` contains command args.

## Usage

Create `.github/workflows/slash-commands.yml` in the default branch:

```yaml
name: Slash Commands
on:
  issue_comment:
    types: [created]
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: bubkoo/slash-commands@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CONFIG_FILE: your-config-file-path # .github/slash-commands.yml
```

### Options

- `GITHUB_TOKEN`: Your GitHub token for authentication.
- `CONFIG_FILE`: Path to command config file, specify a yaml file with the following structure:

```yml
# Specify commands for issues and pull requests
# ---------------------------------------------
command1: CommandConfig
command2: CommandConfig

# Optionally, specify commands just for issues
# --------------------------------------------
issues:
  command3: CommandConfig
  command4: CommandConfig

# Optionally, specify commands just for pull requests
# ---------------------------------------------------
pulls:
  command5: CommandConfig
  command6: CommandConfig
```

Demo config file:

```yml
# Specify commands for issues and pull requests
# ---------------------------------------------

hi:
  # Post a comment, `{{ author }}` is an author placeholder
  comment: hi @{{ author }}

wow:
  # Post a comment
  # `{{ args.* }}` is command args placeholder
  # `{{ input }}` is command input placeholder
  comment: wow {{ args.0 }}, and the command args is {{ input }}
  # Reactions to be added to comment
  reactions: ['+1']

heated:
  # Lock the thread
  lock: true
  # Set a lock reason, such as `off-topic`, `too heated`, `resolved` or `spam`
  lockReason: too heated
  # Reactions to be added to comment
  reactions: ['eyes', 'heart']
  # Post a comment
  comment: The thread has been temporarily locked.

unheated:
  # Unlock the thread
  unlock: true

label:
  label:
    # Add custom label
    - static-label
    # Space separated labels
    - 'label-1 label-2'
    # Add labels from args
    - '{{ args.0 }}'
    - '{{ args.1 }}'
    - '{{ args.2 }}'

unlabel:
  label:
    # Remove custom label
    - -static-label
    # Remove labels from args
    - '-{{ args.0 }}'
    - '-{{ args.1 }}'
    - '-{{ args.2 }}'
relabel:
  label:
    # Remove all labels
    - -*
    # add label from args
    - '{{ input }}'

handover:
  # handover issues/PRs to the given users
  assign:
    - '-*' # first remove all the old assignees
    - '{{ input }}'
assign:
  # assign issues/PRs to Jhon and the given users
  assign:
    - Jhon
    - '{{ input }}'

# Optionally, specify commands just for issues
# --------------------------------------------
issues:
  pin:
    # Pin the issue
    pin: true

  unpin:
    # UnPin the issue
    unpin: true

  feature:
    # Close the issue
    close: true
    # Post a comment, `{{ author }}` is an author placeholder
    comment: >
      :wave: @{{ author }}, please use our idea board to request new features.


  needs-more-info:
    # Close the issue
    close: true
    # Post a comment, `{{ author }}` is author placeholder
    comment: >
      @{{ author }}
      
      In order to communicate effectively, we have a certain format requirement for the issue, your issue is automatically closed because there is no recurring step or reproducible warehouse, and will be REOPEN after the offer.


# Optionally, specify commands just for pull requests
# ---------------------------------------------------
pulls:
  hello:
    # Post a comment, `{{ input }}` is command input placeholder
    comment: hello {{ input }}
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
