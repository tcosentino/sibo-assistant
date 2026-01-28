const GITHUB_REPO = 'tcosentino/sibo-assistant';

function createGitHubIssueUrl(type: 'bug' | 'food-request'): string {
  const baseUrl = `https://github.com/${GITHUB_REPO}/issues/new`;

  if (type === 'bug') {
    const title = encodeURIComponent('[Bug] ');
    const body = encodeURIComponent(`## Description
Describe the issue you encountered.

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
What did you expect to happen?

## Actual Behavior
What actually happened?

## Device/Browser
- Device:
- Browser:
`);
    const labels = encodeURIComponent('bug');
    return `${baseUrl}?title=${title}&body=${body}&labels=${labels}`;
  }

  // food-request
  const title = encodeURIComponent('[Food Request] ');
  const body = encodeURIComponent(`## Food to Add
Name of the food you'd like added:

## Category
(vegetable, fruit, protein, grain, dairy, condiment, fat, beverage)

## Additional Info
Any other details that might help (common names, FODMAP info if known, etc.):
`);
  const labels = encodeURIComponent('enhancement,food-request');
  return `${baseUrl}?title=${title}&body=${body}&labels=${labels}`;
}

export function FeedbackButtons() {
  return (
    <div className="feedback-buttons">
      <a
        href={createGitHubIssueUrl('bug')}
        target="_blank"
        rel="noopener noreferrer"
        className="feedback-buttons__btn feedback-buttons__btn--issue"
      >
        <span className="feedback-buttons__icon">🐛</span>
        Report Issue
      </a>
      <a
        href={createGitHubIssueUrl('food-request')}
        target="_blank"
        rel="noopener noreferrer"
        className="feedback-buttons__btn feedback-buttons__btn--request"
      >
        <span className="feedback-buttons__icon">🍎</span>
        Request Food
      </a>
    </div>
  );
}
