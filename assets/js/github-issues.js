(function () {
  'use strict';

  /* GitHub Issues */

  let source = specConfig.source;
  if (source) {
    if (source.host === 'github') {
      fetch(`https://api.github.com/repos/${source.account + '/' + source.repo}/issues`)
        .then(response => response.json())
        .then(issues => {
          let count = issues.length;
          document.querySelectorAll('[issue-count]').forEach(node => {
            node.setAttribute('issue-count', count)
          });
          repo_issue_list.innerHTML = issues.map(issue => {
            return `<li class="repo-issue">
              <detail-box>
                <section>${md.render(issue.body || '')}</section>
                <header class="repo-issue-title">
                  <span class="repo-issue-number">${issue.number}</span>
                  <span class="repo-issue-link">
                    <a href="${issue.html_url}" target="_blank">${issue.title}</a>
                  </span>
                  <span detail-box-toggle></span>
                </header>
              </detail-box>
            </li>`
          }).join('');
          Prism.highlightAllUnder(repo_issue_list);
        })
    }
  }

})();