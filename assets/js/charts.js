(function () {
  'use strict';

  /* Charts */

  document.querySelectorAll('.chartjs').forEach(chart => {
    new Chart(chart, JSON.parse(chart.textContent));
  });

})();