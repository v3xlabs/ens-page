import { createFileRoute } from "@tanstack/solid-router";

import { ActivityFeed } from "../components/activity-feed";
import { ActivityFlows } from "../components/activity-flow";
import { Page } from "../components/page";
import { useActivityResume } from "../hooks/useActivityResume";

export const ActivityPage = () => {
  useActivityResume();

  return (
    <div class="space-y-6">
      <ActivityFlows />
      <ActivityFeed />
    </div>
  );
};

export const Route = createFileRoute("/activity")({
  component: () => <Page width="narrow"><ActivityPage /></Page>,
});
