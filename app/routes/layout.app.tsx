import { Outlet, useSearchParams } from "react-router";
import { PrototypeSwitcher } from "~/components/prototype-switcher";
import {
  PROTOTYPE_VARIANTS,
  VariantASidebarItem,
  VariantBTopBar,
  VariantCInboxPage,
  VariantCSidebarItem,
  useMockInbox,
  type MockNotification,
} from "~/components/notifications-prototype";
import type { Route } from "./+types/layout.app";
import { Sidebar } from "~/components/sidebar";
import { DevUI } from "~/components/dev-ui";
import { Toaster } from "sonner";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  users,
  courses,
  modules,
  lessons,
  lessonProgress,
  teams,
  teamMembers,
  TeamMemberRole,
  LessonProgressStatus,
  UserRole,
} from "~/db/schema";

function getAllUsers() {
  return db.select().from(users).all();
}

function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function getTeamForAdmin(userId: number) {
  const membership = db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .get();

  if (!membership) return undefined;

  return db.select().from(teams).where(eq(teams.id, membership.teamId)).get();
}

function isTeamAdmin(userId: number) {
  return !!getTeamForAdmin(userId);
}

function getCourseLessonIds(courseId: number): number[] {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id)))!)
    .all();

  return courseLessons.map((l) => l.id);
}

function calculateProgress(
  userId: number,
  courseId: number,
  weightByDuration: boolean
) {
  const lessonIds = getCourseLessonIds(courseId);

  if (lessonIds.length === 0) return 0;

  if (weightByDuration) {
    const courseLessons = db
      .select({
        id: lessons.id,
        durationMinutes: lessons.durationMinutes,
      })
      .from(lessons)
      .where(or(...lessonIds.map((id) => eq(lessons.id, id)))!)
      .all();

    const totalDuration = courseLessons.reduce(
      (sum, l) => sum + (l.durationMinutes ?? 1),
      0
    );

    if (totalDuration === 0) return 0;

    const completed = db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.status, LessonProgressStatus.Completed),
          or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
        )
      )
      .all();

    const completedIds = new Set(completed.map((p) => p.lessonId));

    const completedDuration = courseLessons
      .filter((l) => completedIds.has(l.id))
      .reduce((sum, l) => sum + (l.durationMinutes ?? 1), 0);

    return Math.round((completedDuration / totalDuration) * 100);
  }

  const completedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
      )
    )
    .get();

  return Math.round(((completedCount?.count ?? 0) / lessonIds.length) * 100);
}

function getCompletedLessonCount(userId: number, courseId: number) {
  const lessonIds = getCourseLessonIds(courseId);
  if (lessonIds.length === 0) return 0;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
      )
    )
    .get();

  return result?.count ?? 0;
}

function getTotalLessonCount(courseId: number) {
  return getCourseLessonIds(courseId).length;
}

function getRecentlyProgressedCourses(userId: number, limit: number = 3) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      coverImageUrl: courses.coverImageUrl,
      lastActivityId: sql<number>`max(${lessonProgress.id})`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessonProgress.userId, userId))
    .groupBy(courses.id)
    .orderBy(desc(sql`max(${lessonProgress.id})`))
    .limit(limit)
    .all();
}

// PROTOTYPE: mock Notifications built from real course/lesson names.
const MOCK_EXCERPTS = [
  "Great question! The trick is to memoise the selector so it only reruns when the input changes.",
  "I hit the same error. Restarting the dev server fixed it for me.",
  "Could you share the full stack trace? It's hard to tell from the snippet.",
  "Yes, that's covered in the next module, so hang tight.",
  "Thanks, this cleared it up.",
  "Why do we use a transaction here instead of two separate writes?",
  "The video says 3:40 but the code on screen doesn't match the repo.",
  "Is there a version of this exercise for TypeScript 5.5?",
];
const MOCK_NAMES = [
  "Priya Shah",
  "Marcus Lee",
  "Elena Rossi",
  "Tom Becker",
  "Aisha Bello",
  "Jonas Berg",
];

function getPrototypeNotifications(
  user: { id: number; role: UserRole; name: string } | null
): MockNotification[] {
  if (!user || user.role === UserRole.Admin) return [];
  const rows = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .orderBy(courses.id, modules.position, lessons.position)
    .all();
  if (rows.length === 0) return [];

  const own = rows.filter((r) => r.instructorId === user.id);
  const pool = user.role === UserRole.Instructor && own.length ? own : rows;
  const courseIds = [...new Set(rows.map((r) => r.courseId))];
  const now = Date.now();
  const out: MockNotification[] = [];
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

  for (let i = 0; i < 28; i++) {
    const lesson = pool[(i * 7 + user.id) % pool.length];
    const h = i < 3 ? i * 0.4 + 0.1 : i * 9;
    const read = i >= 6 && i % 3 !== 0;
    const isStudent = user.role !== UserRole.Instructor;
    const newLessonCourse = courseIds[i % 2 === 0 ? 0 : 1 % courseIds.length];
    const makeNewLesson = isStudent && (i % 4 === 1 || i === 2 || i === 4);
    const lessonForNew =
      rows.filter((r) => r.courseId === newLessonCourse)[i % 5] ?? lesson;
    const base = makeNewLesson ? lessonForNew : lesson;
    out.push({
      id: i + 1,
      kind: makeNewLesson
        ? "new_lesson"
        : isStudent
          ? "reply_to_comment"
          : "comment_on_course",
      courseId: base.courseId,
      courseTitle: base.courseTitle,
      courseSlug: base.courseSlug,
      lessonId: base.lessonId,
      lessonTitle: base.lessonTitle,
      actorName: makeNewLesson ? null : MOCK_NAMES[i % MOCK_NAMES.length],
      actorIsInstructor: isStudent && !makeNewLesson && i % 3 === 0,
      isReply: !isStudent && i % 2 === 1,
      excerpt: makeNewLesson ? null : MOCK_EXCERPTS[i % MOCK_EXCERPTS.length],
      createdAt: hoursAgo(h),
      readAt: read ? hoursAgo(h / 2) : null,
    });
  }
  return out;
}

export async function loader({ request }: Route.LoaderArgs) {
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  const recentCourses = currentUserId
    ? getRecentlyProgressedCourses(currentUserId).map((course) => {
        const completedLessons = getCompletedLessonCount(
          currentUserId,
          course.courseId
        );
        const totalLessons = getTotalLessonCount(course.courseId);
        const progress = calculateProgress(currentUserId, course.courseId, false);
        return {
          courseId: course.courseId,
          title: course.courseTitle,
          slug: course.courseSlug,
          coverImageUrl: course.coverImageUrl,
          completedLessons,
          totalLessons,
          progress,
        };
      })
    : [];

  return {
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          avatarUrl: currentUser.avatarUrl ?? null,
        }
      : null,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
    isTeamAdmin: currentUserId ? isTeamAdmin(currentUserId) : false,
    prototypeNotifications: getPrototypeNotifications(currentUser ?? null),
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const {
    users,
    currentUser,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries,
    isTeamAdmin: userIsTeamAdmin,
    prototypeNotifications,
  } = loaderData;

  // PROTOTYPE: variant switcher for the notification bell and inbox
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";
  const inbox = useMockInbox(prototypeNotifications, currentUser?.id);
  const hasBell = prototypeNotifications.length > 0;
  const showInboxPage = hasBell && variant === "C" && searchParams.get("inbox") === "1";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentUser={currentUser}
        recentCourses={recentCourses}
        isTeamAdmin={userIsTeamAdmin}
        notificationsSlot={
          !hasBell ? null : variant === "A" ? (
            <VariantASidebarItem inbox={inbox} />
          ) : variant === "C" ? (
            <VariantCSidebarItem inbox={inbox} />
          ) : null
        }
      />
      <main className="flex-1 overflow-y-auto">
        {hasBell && variant === "B" && <VariantBTopBar inbox={inbox} />}
        {showInboxPage ? <VariantCInboxPage inbox={inbox} /> : <Outlet />}
      </main>
      <PrototypeSwitcher
        variants={PROTOTYPE_VARIANTS}
        current={variant}
        extra={
          <>
            <span className="mx-1 h-4 w-px bg-white/30" />
            <span className="font-mono text-xs text-white/70">
              unread {inbox.unreadCount}
            </span>
            <button
              onClick={inbox.simulateArrival}
              className="rounded-full px-2 py-0.5 text-xs hover:bg-white/20"
              title="Simulate a new Notification arriving (as if by the 60s poll)"
            >
              + new
            </button>
            <button
              onClick={inbox.resetAllUnread}
              className="rounded-full px-2 py-0.5 text-xs hover:bg-white/20"
              title="Mark everything unread again"
            >
              reset
            </button>
          </>
        }
      />
      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
