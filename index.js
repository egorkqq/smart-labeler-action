const core = require("@actions/core");
const github = require("@actions/github");

const featureAliases = [
  "feat",
  "feature",
  "refactor",
  "style",
];

const bugAliases = [
  "bug",
  "fix",
  "bugfix",
];

const choreAliases = [
  "chore",
  "docs",
  "build",
];

function getLabelValue(label) {

  return label.split(":")[1];
}

function getTypeValue(typeLabelName) {
  if (featureAliases.includes(typeLabelName)) return "feature";
  if (bugAliases.includes(typeLabelName)) return "bug";
  if (choreAliases.includes(typeLabelName)) return "chore";

  return "no_type"
}


async function run(octokit) {
  const {
    pull_request: { title, body, number: prNumber },
  } = github.context.payload;
  const { owner, repo } = github.context.repo;

  const issueMatch = body ? body.match(/#(\d+)/) : null;
  const featLabelMatch = title ? title.match(/\/(\w+)/) : null;
  const typeLabelMatch = title ? title.match(/(\w+)\(/) : null;

  const noRelatedIssue = !issueMatch || issueMatch.length <= 1;
  const noFeat = !featLabelMatch || featLabelMatch.length <= 1;
  const noType = !typeLabelMatch || typeLabelMatch.length <= 1;

  if (noRelatedIssue && noFeat && noType) {
    throw new Error(
      "Startin 'self-distructing... I can not find source for picking label"
    );
  }

  const issueNumber = noRelatedIssue ? null : issueMatch[1];
  const featLabelName = noFeat ? null : featLabelMatch[1];
  const typeLabelName = noType ? null : typeLabelMatch[1];

  let labels = [];

  if (issueNumber) {
    const { data: issue } = await octokit.rest.issues.get({
      issue_number: issueNumber,
      owner,
      repo,
    });

    labels = [...labels, ...issue.labels];
  }

  const { data: repositoryLabels } = await octokit.request(
    "GET /repos/{owner}/{repo}/labels",
    {
      owner,
      repo,
    }
  );

  const parsedLabels = repositoryLabels.filter((label) => {
    const formattedLabel = getLabelValue(label.name);
    const formattedFeat = featLabelName.split("-").join(" ");
    const formattedType = getTypeValue(typeLabelName);
    
    return (
      formattedLabel.includes(formattedFeat) || formattedLabel.includes(formattedType)
    );
  });

  if (!parsedLabels.length && !labels.length) {
    throw new Error("Labels not found");
  }

  console.log("Adding these labels from issue:", labels);
  console.log("And these from PR name:", parsedLabels);

  return await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: [...labels, ...parsedLabels].map(({ name }) => name),
  });
}

async function main() {
  try {
    const octokit = github.getOctokit(core.getInput("github-token"));
    
    await run(octokit);
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
