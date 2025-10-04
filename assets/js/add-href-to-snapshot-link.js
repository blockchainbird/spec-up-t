/**
 * @file This file adds an href attribute to the snapshot link on the page via client side JS DOM manipulation.
 * @author Kor Dwarshuis
 * @version 0.0.1
 * @license MIT
 * @since 2024-09-25
 */

function addHrefToSnapshotLink() {
   const snapshotLink = document.querySelector('#snapshot-link-in-content');

   // Get the current URL of the page
   const currentUrl = window.location.href;

   // Remove query parameters and hash for URL processing
   const urlWithoutParams = currentUrl.split('?')[0].split('#')[0];

   // Regex to match up to and including the 'versions/' directory (if it exists)
   // Updated to handle file:// URLs and various protocols
   const versionsRegex = new RegExp('^([^?#]+)/versions/(?:[^/?#]+/?)*');
   const versionsMatch = versionsRegex.exec(urlWithoutParams);

   let snapshotLinkHref;
   if (versionsMatch) {
      // If we are already in the 'versions' directory or deeper, strip down to 'versions/'
      snapshotLinkHref = `${versionsMatch[1]}/versions/index.html`;
   } else {
      // Clean up the URL: remove index.html, remove trailing slashes, remove any existing /versions/ suffixes
      let cleanUrl = urlWithoutParams
         .replace(/\/index\.html$/, '')
         .replace(/\/$/, '')
         .replace(/\/versions+$/, ''); // Remove any trailing /versions (including multiple)

      // Append '/versions/' to the current directory
      snapshotLinkHref = cleanUrl + '/versions/index.html';
   }

   // Set the 'href' attribute of the snapshot link element to the constructed URL
   if (snapshotLink) {
      snapshotLink.setAttribute('href', snapshotLinkHref);
   }
}

document.addEventListener("DOMContentLoaded", function () {
   addHrefToSnapshotLink();
});
