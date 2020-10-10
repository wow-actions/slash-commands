# Custom Slash Commands

> A Github Action to perform commands when Issues or Pull Requests are commented with slash commands. Slash commands are lines that start with `/` in comments on Issues or Pull Requests.

## How It Works

This Github Action performs certain commands when an issue or pull request is commented with slash command. The following commands are supported:

- Post a comment (`comment` and `reactions` option)
- Close (`close` option)
- Reopen (`open` option)
- Lock with an optional lock reason (`lock` and `lockReason` options)
- Unlock (`unlock` option)
- Add or remove labels (`labels` option), label prefixed with `-` will be removed, other label will be added.

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
      - uses: bubkoo/custom-slash-commands@v1
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

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
