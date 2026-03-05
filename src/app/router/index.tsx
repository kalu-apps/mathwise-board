import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { MainLayout } from "@/app/layouts/MainLayout";
import { RoleProtectedRoute } from "@/app/router/guards/RoleProtectedRoute";
import { t } from "@/shared/i18n";
import { PageLoader } from "@/shared/ui/loading";
import { isWhiteboardOnlyMode } from "@/shared/config/runtime";

const Home = lazy(() => import("@/pages/home/Home"));
const Courses = lazy(() => import("@/pages/courses/Courses"));
const CourseDetails = lazy(() => import("@/pages/courses/CourseDetails"));
const CourseTestDetails = lazy(() => import("@/pages/courses/CourseTestDetails"));
const LessonDetails = lazy(() => import("@/pages/lessons/LessonDetails"));
const Booking = lazy(() => import("@/pages/booking/Booking"));
const AboutTeacher = lazy(() => import("@/pages/about-teacher/AboutTeacher"));
const NotFound = lazy(() => import("@/pages/notfound/NotFound"));
const StudentProfile = lazy(() => import("@/pages/profile/StudentProfile"));
const StudentPurchaseDetails = lazy(
  () => import("@/pages/profile/StudentPurchaseDetails")
);
const TeacherDashboard = lazy(() => import("@/pages/teacher/TeacherDashboard"));
const TeacherTestTemplatesPage = lazy(
  () => import("@/pages/teacher/TeacherTestTemplatesPage")
);
const TeacherTestEditorPage = lazy(
  () => import("@/pages/teacher/TeacherTestEditorPage")
);
const TeacherStudentProfile = lazy(
  () => import("@/pages/teacher/TeacherStudentProfile")
);
const ChatPage = lazy(() => import("@/pages/chat/ChatPage"));
const WorkbookHubPage = lazy(() => import("@/pages/workbook/WorkbookHubPage"));
const WorkbookSessionPage = lazy(
  () => import("@/pages/workbook/WorkbookSessionPage")
);
const WorkbookInviteJoinPage = lazy(
  () => import("@/pages/workbook/WorkbookInviteJoinPage")
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

const whiteboardOnlyChildren: RouteObject[] = [
  {
    path: "/",
    element: withSuspense(<WorkbookLaunchPage />),
  },
  {
    path: "/workbook",
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

const fullChildren: RouteObject[] = [
  /** 🏠 */
  { path: "/", element: withSuspense(<Home />) },

  /** 📚 */
  { path: "/courses", element: withSuspense(<Courses />) },

  /** 📘 ВАЖНО: courseId */
  { path: "/courses/:courseId", element: withSuspense(<CourseDetails />) },

  /** ▶️ Урок (доступ контролируется ВНУТРИ страницы) */
  {
    path: "/lessons/:id",
    element: withSuspense(<LessonDetails />),
  },
  {
    path: "/courses/:courseId/tests/:testItemId",
    element: withSuspense(<CourseTestDetails />),
  },

  /** 📅 Индивидуальные занятия */
  { path: "/booking", element: withSuspense(<Booking />) },
  { path: "/about-teacher", element: withSuspense(<AboutTeacher />) },
  { path: "/contact", element: withSuspense(<AboutTeacher />) },

  /** 👤 Ученик */
  {
    path: "/student/profile",
    element: (
      <RoleProtectedRoute allow={["student"]}>
        {withSuspense(<StudentProfile />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/profile/purchases/:purchaseId",
    element: (
      <RoleProtectedRoute allow={["student"]}>
        {withSuspense(<StudentPurchaseDetails />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/student/profile/purchases/:purchaseId",
    element: (
      <RoleProtectedRoute allow={["student"]}>
        {withSuspense(<StudentPurchaseDetails />)}
      </RoleProtectedRoute>
    ),
  },

  /** 👨‍🏫 Учитель */
  {
    path: "/teacher/profile",
    element: (
      <RoleProtectedRoute allow={["teacher"]}>
        {withSuspense(<TeacherDashboard />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/teacher/students/:studentId",
    element: (
      <RoleProtectedRoute allow={["teacher"]}>
        {withSuspense(<TeacherStudentProfile />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/teacher/tests",
    element: (
      <RoleProtectedRoute allow={["teacher"]}>
        {withSuspense(<TeacherTestTemplatesPage />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/teacher/tests/:templateId",
    element: (
      <RoleProtectedRoute allow={["teacher"]}>
        {withSuspense(<TeacherTestEditorPage />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/chat",
    element: (
      <RoleProtectedRoute allow={["student", "teacher"]}>
        {withSuspense(<ChatPage />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/workbook",
    element: (
      <RoleProtectedRoute allow={["student", "teacher"]}>
        {withSuspense(<WorkbookHubPage />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/workbook/session/:sessionId",
    element: (
      <RoleProtectedRoute allow={["student", "teacher"]}>
        {withSuspense(<WorkbookSessionPage />)}
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/workbook/invite/:token",
    element: withSuspense(<WorkbookInviteJoinPage />),
  },
];

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: isWhiteboardOnlyMode ? whiteboardOnlyChildren : fullChildren,
  },

  /** 404 */
  {
    path: "*",
    element: withSuspense(<NotFound />),
  },
]);
