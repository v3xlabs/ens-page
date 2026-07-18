import { createFileRoute, Outlet } from "@tanstack/solid-router";

export const Route = createFileRoute("/$name")({
  component: Outlet,
});
