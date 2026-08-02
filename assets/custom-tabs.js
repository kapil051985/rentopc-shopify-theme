(function () {
  function init(root) {
    var tabs = root.querySelectorAll('.custom-tab');
    var tabContents = root.querySelectorAll('.custom__tab-content');
    if (!tabs.length || !tabContents.length) return;

    function cleanTables(container) {
      var tables = container.querySelectorAll('table');
      tables.forEach(function (table) {
        var rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return;

        var maxCols = 0;
        rows.forEach(function (row) {
          var cells = row.querySelectorAll('td, th');
          if (cells.length > maxCols) maxCols = cells.length;
        });

        var colEmpty = [];
        for (var c = 0; c < maxCols; c++) {
          colEmpty[c] = true;
        }

        rows.forEach(function (row) {
          var cells = row.querySelectorAll('td, th');
          cells.forEach(function (cell, cIndex) {
            var text = cell.textContent.trim();
            if (text.length > 0) {
              colEmpty[cIndex] = false;
            }
          });
        });

        for (var c = maxCols - 1; c >= 0; c--) {
          if (colEmpty[c]) {
            rows.forEach(function (row) {
              var cells = row.querySelectorAll('td, th');
              if (cells[c]) {
                cells[c].parentNode.removeChild(cells[c]);
              }
            });
          }
        }
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var contentId = this.dataset.contentId;
        var content = contentId ? document.getElementById(contentId) : null;

        tabContents.forEach(function (c) {
          c.classList.remove('active');
        });
        tabs.forEach(function (t) {
          t.classList.remove('active');
        });

        this.classList.add('active');
        if (content) {
          content.classList.add('active');
          cleanTables(content);
        }
      });
    });

    // Clean tables in the default active tab on load
    var activeContent = root.querySelector('.custom__tab-content.active');
    if (activeContent) cleanTables(activeContent);
  }

  function boot() {
    document.querySelectorAll('[data-custom-tabs]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

