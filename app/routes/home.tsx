import { Link } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { CourseStatus } from "~/db/schema";
import {
  BookOpen,
  Clock,
  GraduationCap,
  ArrowRight,
  User,
  Moon,
  Sun,
} from "lucide-react";
import {
  landingStats,
  lessonCountLabel,
  type LandingStatKey,
} from "~/modules/landing-page";
import { CourseImage } from "~/components/course-image";
import { DevUI } from "~/components/dev-ui";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { eq, like, and, or, sql } from "drizzle-orm";
import { db } from "~/db";
import { courses, categories, users, modules, lessons } from "~/db/schema";

function getAllUsers() {
  return db.select().from(users).all();
}

function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function getAllCategories() {
  return db.select().from(categories).orderBy(categories.name).all();
}

function buildCourseQuery(
  search: string | null,
  category: string | null,
  status: CourseStatus | null,
  sortBy: string | null,
  limit: number,
  offset: number
) {
  const conditions = [];

  if (status) {
    conditions.push(eq(courses.status, status));
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(like(courses.title, term), like(courses.description, term))
    );
  }

  const query = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id));

  if (category) {
    conditions.push(eq(categories.slug, category));
  }

  const filtered =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  const sorted =
    sortBy === "title"
      ? filtered.orderBy(courses.title)
      : sortBy === "oldest"
        ? filtered.orderBy(courses.createdAt)
        : filtered.orderBy(sql`${courses.createdAt} DESC`);

  return sorted.limit(limit).offset(offset).all();
}

function getLessonCountForCourse(courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .get();

  return count?.count ?? 0;
}

const STAT_ICONS: Record<LandingStatKey, typeof BookOpen> = {
  courses: BookOpen,
  categories: GraduationCap,
  pace: Clock,
};

export function meta() {
  return [
    { title: "Cadence — Learn at your own pace" },
    {
      name: "description",
      content:
        "A modern course platform for developers. Browse courses, track your progress, and learn at your own pace.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const courses = buildCourseQuery(
    null,
    null,
    CourseStatus.Published,
    "newest",
    50,
    0
  );
  const featured = courses.slice(0, 3).map((course) => ({
    ...course,
    lessonCount: getLessonCountForCourse(course.id),
  }));
  const categories = getAllCategories();
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  return {
    featuredCourses: featured,
    totalCourses: courses.length,
    totalCategories: categories.length,
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      : null,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    featuredCourses,
    totalCourses,
    totalCategories,
    users,
    currentUser,
    devCountry,
    countryTierInfo,
    countries,
  } = loaderData;
  const stats = landingStats({ totalCourses, totalCategories });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cadence-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Cadence
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/courses"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Courses
            </Link>
            <button
              onClick={toggleDarkMode}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>
            {currentUser ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Log In
                </Link>
                <Button asChild size="sm">
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
            Courses for developers
          </p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Learn to code,
            <br />
            <span className="text-muted-foreground">at your own pace</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Structured courses built by experienced instructors. Track your
            progress, take quizzes, and build real-world skills.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link to="/courses">
                Browse Courses
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
        {featuredCourses.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/40 p-6">
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              Newest courses
            </p>
            <ul className="space-y-3">
              {featuredCourses.map((course) => (
                <li key={course.id}>
                  <Link
                    to={`/courses/${course.slug}`}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:text-primary">
                        {course.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.instructorName ?? "Instructor"} ·{" "}
                        {lessonCountLabel(course.lessonCount)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="border-y border-border bg-muted/50 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.key];
            return (
              <div key={stat.key} className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {featuredCourses.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Featured Courses
              </h2>
              <p className="mt-2 text-muted-foreground">
                Start learning with our most popular courses
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/courses">
                View all
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.slug}`}
                className="group"
              >
                <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
                  <CourseImage
                    src={course.coverImageUrl}
                    alt={course.title}
                    className="aspect-video w-full object-cover"
                  />
                  <CardHeader>
                    <h3 className="font-semibold leading-snug group-hover:text-primary">
                      {course.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {course.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {course.instructorName ?? "Instructor"}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3" />
                      {lessonCountLabel(course.lessonCount)}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Cadence</p>
            <p>Structured courses for developers, at your own pace.</p>
          </div>
          <nav className="flex gap-6">
            <Link to="/courses" className="hover:text-foreground">
              Courses
            </Link>
            {currentUser ? (
              <Link to="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
            ) : (
              <Link to="/signup" className="hover:text-foreground">
                Sign Up
              </Link>
            )}
          </nav>
        </div>
      </footer>

      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
    </div>
  );
}
