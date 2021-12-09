# smart-labeler-action

Github Action for automatic labeling pull requests

## Inputs

## `github-token`

**Required** secret token of repository.

## Example usage

```
uses: egorkqq/smart-labeler-action@v1
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}

```