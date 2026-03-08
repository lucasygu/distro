import type { LogEntry } from "../../lib/types.js";

export function EventTimeline({ entries }: { entries: LogEntry[] }) {
  // Show most recent first, limit to 50
  const recent = [...entries].reverse().slice(0, 50);

  return (
    <div>
      <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2">
        Event Timeline
      </h3>
      <div class="space-y-0 max-h-96 overflow-y-auto">
        {recent.map((e) => (
          <div class="event-row flex items-start gap-3 py-1.5 px-2 text-sm">
            <span class="text-gray-400 font-mono text-xs whitespace-nowrap">
              {e.timestamp}
            </span>
            <span class={`font-mono text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${eventColor(e.event)}`}>
              {e.event}
            </span>
            <span class="text-gray-700 truncate flex-1">{e.detail}</span>
            {e.driver && (
              <a
                href={e.driver}
                target="_blank"
                class="text-blue-500 hover:text-blue-700 text-xs whitespace-nowrap"
              >
                link
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function eventColor(event: string): string {
  switch (event) {
    case "REPLY":
      return "bg-green-100 text-green-800";
    case "MILESTONE":
      return "bg-amber-100 text-amber-800";
    case "STARS":
      return "bg-yellow-100 text-yellow-800";
    case "MONITOR":
      return "bg-blue-100 text-blue-800";
    case "INSIGHT":
      return "bg-purple-100 text-purple-800";
    case "WARNING":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
