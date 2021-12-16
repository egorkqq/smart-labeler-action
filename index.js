const core = require("@actions/core");
const github = require("@actions/github");

const featureAliases = [
  "feat",
  "feature",
  "style",
];

const fixAliases = [
  "bug",
  "fix",
  "bugfix",
];

const refactorAliases = [
  "refactor",
]

const choreAliases = [
  "chore",
  "docs",
  "build",
];

function getLabelValue(label) {
  const labelValue = label.split(":")[1];
  console.log('Get value ', labelValue, 'from label ', label);

  return labelValue;
}

function getTypeValue(typeLabelName) {
  if (featureAliases.includes(typeLabelName)) {
    console.log('Get type value feature from label ', typeLabelName);

    return "feature";
  } else if (fixAliases.includes(typeLabelName)) { 
    console.log('Get type value fix from label ', typeLabelName);

    return "fix";
  } else if (refactorAliases.includes(typeLabelName)) {
    console.log('Get type value refactor from label ', typeLabelName);

    return "refactor";
  } else if (choreAliases.includes(typeLabelName)) {
    console.log('Get type value chore from label ', typeLabelName);

    return "chore";
  } else {
    console.log('Cant get type value from label ', typeLabelName);

    return "no_type"
  }
}

function getNameFromTitle(title, regex) {
  const match = title ? title.match(regex) : null;
  if (!match || match.length <= 1) {
    console.log('Cant get label info from PR title');

    return null;
  }
  console.log('Found label info from PR title: ', match[1]);

  return match[1];
}

function getIssueNumber(body) {
  const match = body ? body.match(/#(\d+)/) : null;
  if (!match || match.length <= 1) {
    console.log('Issue number not found in PR description');

    return null;
  }
  console.log('Issue number is ', match[1]);

  return match[1];
}

async function fetchLabelsFromIssue(issue, octokit, owner, repo) {
  if (!issue) return [];

  const { data } = await octokit.rest.issues.get({
    issue_number: issue,
    owner,
    repo,
  });

  return data.labels;
}

async function fetchRepositoryLabels(octokit, owner, repo) {
  const { data: repositoryLabels } = await octokit.request(
    "GET /repos/{owner}/{repo}/labels",
    {
      owner,
      repo,
      per_page: 100
    }
  );
  console.log('Repository labels List: ', repositoryLabels.map(({name}) => name));

  return repositoryLabels;
}


async function run(octokit) {
  const {
    pull_request: { title, body, number: prNumber },
  } = github.context.payload;
  const { owner, repo } = github.context.repo;

  const issueNumber = getIssueNumber(body);

  const featLabelName = getNameFromTitle(title, /\((\w+)\)/);
  const formattedFeat = featLabelName.split("-").join(" ");

  const typeLabelName = getNameFromTitle(title, /(\w+)\(/);
  const formattedType = getTypeValue(typeLabelName);

  if (!issueNumber && !featLabelName && !typeLabelName) {
    throw new Error(
      "Startin 'self-distructing... I can not find source for picking label"
    );
  }

  const issueLabels = await fetchLabelsFromIssue(issueNumber, octokit, owner, repo);
  const repositoryLabels = await fetchRepositoryLabels(octokit, owner, repo)


  const parsedLabels = repositoryLabels.filter((label) => {
    const formattedLabel = getLabelValue(label.name);
    
    return (
      formattedLabel.includes(formattedFeat) || formattedLabel.includes(formattedType)
    );
  });

  if (!parsedLabels.length && !issueLabels.length) {
    throw new Error("Labels not found");
  }

  console.log("Adding these labels from issue:", issueLabels);
  console.log("And these from PR name:", parsedLabels);

  return await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: [...issueLabels, ...parsedLabels].map(({ name }) => name),
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
