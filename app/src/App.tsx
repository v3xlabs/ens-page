import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";

import { CmdK } from "./components/cmd-k";
import { Navbar } from "./components/navbar";
import { EditPage } from "./pages/edit";
import { HomePage } from "./pages/home";
import { NamePage } from "./pages/name";
import { NamesPage } from "./pages/names";
import { SettingsPage } from "./pages/settings";

const AppShell = () => (
  <main class="min-h-screen bg-background-secondary px-4 py-4 text-text-primary sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <Navbar />
      <CmdK />
      <Outlet />
    </div>
  </main>
);

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ component: HomePage, getParentRoute: () => rootRoute, path: "/" });
const namesRoute = createRoute({ component: NamesPage, getParentRoute: () => rootRoute, path: "/names" });
const settingsRoute = createRoute({ component: SettingsPage, getParentRoute: () => rootRoute, path: "/settings" });
const nameRoute = createRoute({ component: NamePage, getParentRoute: () => rootRoute, path: "/$name" });
const editRoute = createRoute({ component: EditPage, getParentRoute: () => rootRoute, path: "/$name/edit" });

const routeTree = rootRoute.addChildren([indexRoute, namesRoute, settingsRoute, nameRoute, editRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

export const App = () => <RouterProvider router={router} />;
