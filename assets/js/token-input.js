/**
 * @author Kor Dwarshuis
 * @contact kor@dwarshuis.com
 * @created 2024-09-07
 * @description This script adds a button next to the search bar that allows users to input their GitHub token.
 */

function tokenInput() {
   let buttonTokenInput = document.createElement("button");
   buttonTokenInput.classList.add("button-token-input");
   buttonTokenInput.classList.add("btn", "btn-sm", "btn-outline-secondary","me-1");
   buttonTokenInput.innerHTML = "&#128273;";
   document.querySelector('#repo_issues').insertAdjacentElement('afterend', buttonTokenInput);
   buttonTokenInput.addEventListener('click', () => {
      const token = prompt('Please enter your GitHub token:');

      if (!token) {
         alert('GitHub token is not set.');
         return;
      }

      // Save token to local storage
      localStorage.setItem('githubToken', token);
      console.log("GitHub token is set.");
   });
}

document.addEventListener("DOMContentLoaded", function () {
   tokenInput();
});
