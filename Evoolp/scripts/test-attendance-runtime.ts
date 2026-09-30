import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://localhost:3000";
const prisma = new PrismaClient();

async function runRuntimeVerification() {
  console.log("==========================================");
  console.log("RUNNING ATTENDANCE RUNTIME HTTP SMOKE TESTS");
  console.log("==========================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testId: string, message: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testId}: ${message}`);
    } else {
      console.error(`[FAIL] ${testId}: ${message}`);
      throw new Error(`Test failed: ${testId} - ${message}`);
    }
  }

  try {
    // 1. Verify unauthenticated access to /dashboard/attendance redirects to /login
    const unauthRes = await fetch(`${BASE_URL}/dashboard/attendance`, {
      redirect: "manual",
    });
    const isRedirect = unauthRes.status === 307 || unauthRes.status === 302 || unauthRes.status === 303;
    assert(
      isRedirect && Boolean(unauthRes.headers.get("location")?.includes("/login")),
      "HTTP-01",
      `Unauthenticated access to /dashboard/attendance correctly redirects to /login (Status: ${unauthRes.status})`
    );

    // 2. Fetch login page and extract CSRF token
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [];
    const csrfCookie = cookies.join("; ");
    assert(!!csrfToken, "HTTP-02", `NextAuth CSRF token retrieved: ${csrfToken.slice(0, 10)}...`);

    // 3. Authenticate as Administrator (admin@demo.evoerp.in)
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "admin@demo.evoerp.in",
        password: "Password123!",
        csrfToken,
        redirect: "false",
      }),
      redirect: "manual",
    });

    const adminCookies = adminLoginRes.headers.getSetCookie ? adminLoginRes.headers.getSetCookie() : [];
    const adminSessionCookie = adminCookies.join("; ");
    assert(
      adminSessionCookie.includes("authjs.session-token") || adminSessionCookie.includes("next-auth.session-token"),
      "HTTP-03",
      "Administrator authenticated successfully; session token issued"
    );

    // 4. Request /dashboard/attendance with Administrator session
    const adminAttendanceRes = await fetch(`${BASE_URL}/dashboard/attendance`, {
      headers: {
        Cookie: `${csrfCookie}; ${adminSessionCookie}`,
      },
    });
    assert(
      adminAttendanceRes.status === 200,
      "HTTP-04",
      `Administrator /dashboard/attendance loaded successfully (HTTP ${adminAttendanceRes.status})`
    );

    const adminHtml = await adminAttendanceRes.text();
    assert(
      adminHtml.includes("Daily Attendance Register"),
      "HTTP-05",
      "Page contains header: 'Daily Attendance Register'"
    );
    assert(
      adminHtml.includes("Today&#x27;s Attendance") || adminHtml.includes("Today's Attendance"),
      "HTTP-06",
      "Page renders metric card: 'Today\'s Attendance'"
    );
    assert(
      adminHtml.includes("Registers Marked"),
      "HTTP-07",
      "Page renders metric card: 'Registers Marked'"
    );
    assert(
      adminHtml.includes("Pending Registers"),
      "HTTP-08",
      "Page renders metric card: 'Pending Registers'"
    );
    assert(
      adminHtml.includes("Absentees Today"),
      "HTTP-09",
      "Page renders metric card: 'Absentees Today'"
    );
    assert(
      adminHtml.includes("Class 6"),
      "HTTP-10",
      "Class selector option 'Class 6' rendered in DOM"
    );
    const secIdx = adminHtml.indexOf("sectionSelect");
    if (secIdx !== -1) {
      console.log("DEBUG sectionSelect snippet:", adminHtml.slice(secIdx, secIdx + 250));
    }
    assert(
      adminHtml.includes("Section A") || adminHtml.includes("sectionSelect"),
      "HTTP-11",
      "Section selector rendered in DOM"
    );
    assert(
      adminHtml.includes("All Present") && adminHtml.includes("All Absent"),
      "HTTP-12",
      "Quick bulk action buttons 'All Present' and 'All Absent' rendered in DOM"
    );

    // 5. Authenticate as Teacher (teacher@demo.evoerp.in)
    const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "teacher@demo.evoerp.in",
        password: "Password123!",
        csrfToken,
        redirect: "false",
      }),
      redirect: "manual",
    });

    const teacherCookies = teacherLoginRes.headers.getSetCookie ? teacherLoginRes.headers.getSetCookie() : [];
    const teacherSessionCookie = teacherCookies.join("; ");
    assert(
      teacherSessionCookie.includes("authjs.session-token") || teacherSessionCookie.includes("next-auth.session-token"),
      "HTTP-13",
      "Teacher authenticated successfully; session token issued"
    );

    // 6. Request /dashboard/attendance with Teacher session
    const teacherAttendanceRes = await fetch(`${BASE_URL}/dashboard/attendance`, {
      headers: {
        Cookie: `${csrfCookie}; ${teacherSessionCookie}`,
      },
    });
    assert(
      teacherAttendanceRes.status === 200,
      "HTTP-14",
      `Teacher authorized and /dashboard/attendance returned HTTP 200`
    );

    const teacherHtml = await teacherAttendanceRes.text();
    assert(
      teacherHtml.includes("Daily Attendance Register"),
      "HTTP-15",
      "Teacher view renders attendance register workspace"
    );

    // 7. Verify Student Role is Blocked from /dashboard/attendance
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "student@demo.evoerp.in",
        password: "Password123!",
        csrfToken,
        redirect: "false",
      }),
      redirect: "manual",
    });
    const studentCookies = studentLoginRes.headers.getSetCookie ? studentLoginRes.headers.getSetCookie() : [];
    const studentSessionCookie = studentCookies.join("; ");

    const studentAttendanceRes = await fetch(`${BASE_URL}/dashboard/attendance`, {
      headers: {
        Cookie: `${csrfCookie}; ${studentSessionCookie}`,
      },
      redirect: "manual",
    });
    const studentBlocked =
      studentAttendanceRes.status === 307 ||
      studentAttendanceRes.status === 302 ||
      studentAttendanceRes.status === 303 ||
      studentAttendanceRes.status === 403;
    assert(
      studentBlocked,
      "HTTP-16",
      `Student role correctly blocked from /dashboard/attendance (Redirect/Forbidden: ${studentAttendanceRes.status})`
    );

    console.log("==========================================");
    console.log(`RUNTIME HTTP SMOKE SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log("==========================================");
  } catch (err) {
    console.error("Runtime verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRuntimeVerification();
