import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { MainLayout } from "@/app/layouts/MainLayout";
import { t } from "@/shared/i18n";
import { PageLoader } from "@/shared/ui/loading";
const NotFound = lazy(() => import("@/pages/notfound/NotFound"));
const WorkbookSessionPage = lazy(
  () => import("@/pages/workbook/WorkbookSessionPage")
);
const WorkbookInviteJoinPage = lazy(
  () => import("@/pages/workbook/WorkbookInviteJoinPage")
);
const WorkbookHubPage = lazy(
  () => import("@/pages/workbook/WorkbookHubPage")
);
const WorkbookLaunchPage = lazy(
  () => import("@/pages/workbook/WorkbookLaunchPage")
);

const routeSuspenseFallback = (
  <PageLoader
    minHeight="28vh"
    title={t("route.loadingPage")}
    showRingDelayMs={180}
    showRingMinVisibleMs={220}
  />
);

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={routeSuspenseFallback}>{node}</Suspense>
);

const whiteboardChildren: RouteObject[] = [
  {
    path: "/",
    element: withSuspense(<WorkbookHubPage />),
  },
  {
    path: "/workbook",
    element: withSuspense(<WorkbookHubPage />),
  },
  {
    path: "/workbook/launch",
    element: withSuspense(<WorkbookLaunchPage />),
  },
  {
    path: "/workbook/session/:sessionId",
    element: withSuspense(<WorkbookSessionPage />),
  },
  {
    path: "/workbook/invite/:token",
    element: withSuspense(<WorkbookInviteJoinPage />),
  },
];

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: whiteboardChildren,
  },

  /** 404 */
  {
    path: "*",
    element: withSuspense(<NotFound />),
  },
]);
