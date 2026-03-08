import type { StarSnapshot } from "../../lib/types.js";
import { raw } from "hono/html";

export function StarChart({
  history,
  canvasId,
}: {
  history: StarSnapshot[];
  canvasId: string;
}) {
  // Prepare data for Chart.js — all data is from local files, not user input
  const labels = history.map((s) => {
    const d = new Date(s.ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const stars = history.map((s) => s.stars);

  // Chart.js config uses only numeric data from local campaign files
  const chartConfig = JSON.stringify({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Stars",
          data: stars,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false },
        x: { grid: { display: false } },
      },
    },
  });

  return (
    <div>
      <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2">
        Star History
      </h3>
      <div class="h-48">
        <canvas id={canvasId}></canvas>
      </div>
      {raw(
        `<script>new Chart(document.getElementById('${canvasId}'), ${chartConfig});</script>`,
      )}
    </div>
  );
}
