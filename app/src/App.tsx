import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";

import { Navbar } from "./components/navbar";
import { HomePage, NamePage, NamesPage, SettingsPage } from "./pages";

const AppShell = () => (
  <main class="min-h-screen bg-background-secondary px-4 py-4 text-text-primary sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <Navbar navigate={(to, parameters) => void router.navigate({ params: parameters, to })} />
      <Outlet />
    </div>
  </main>
);

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ component: HomePage, getParentRoute: () => rootRoute, path: "/" });
const namesRoute = createRoute({ component: NamesPage, getParentRoute: () => rootRoute, path: "/names" });
const settingsRoute = createRoute({ component: SettingsPage, getParentRoute: () => rootRoute, path: "/settings" });
const nameRoute = createRoute({ component: NamePage, getParentRoute: () => rootRoute, path: "/$name" });

const routeTree = rootRoute.addChildren([indexRoute, namesRoute, settingsRoute, nameRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

export const App = () => <RouterProvider router={router} />;
