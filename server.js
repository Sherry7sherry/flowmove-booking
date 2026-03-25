const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, ".local-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
};
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();
let writeQueue = Promise.resolve();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function createAccount(username, password, profile) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    ...profile,
    username,
    salt,
    passwordHash: hashPassword(password, salt),
  };
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayOptions() {
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return toLocalDateString(date);
  });
}

function createSeedData() {
  const days = getDayOptions();

  return {
    teachers: [
      createAccount("tina", "FlowMove2026!", {
        id: "tina",
        role: "teacher",
        name: "Tina",
        specialty: "普拉提塑形",
        focus: "核心激活 / 体态调整 / 产后恢复",
        experience: "6 年教学经验",
        price: "¥420 / 次",
        serviceAreas: "静安区、徐汇区、长宁区",
      }),
      createAccount("mia", "FlowMove2026!", {
        id: "mia",
        role: "teacher",
        name: "Mia",
        specialty: "瑜伽伸展",
        focus: "肩颈舒缓 / 柔韧改善 / 睡眠放松",
        experience: "5 年教学经验",
        price: "¥380 / 次",
        serviceAreas: "浦东新区、杨浦区、虹口区",
      }),
      createAccount("zoe", "FlowMove2026!", {
        id: "zoe",
        role: "teacher",
        name: "Zoe",
        specialty: "功能训练融合",
        focus: "腰背稳定 / 私教入门 / 久坐改善",
        experience: "7 年教学经验",
        price: "¥460 / 次",
        serviceAreas: "黄浦区、普陀区、闵行区",
      }),
    ],
    admins: [
      createAccount("admin", "FlowMoveAdmin2026!", {
        id: "admin",
        role: "admin",
        name: "运营管理员",
      }),
    ],
    students: [],
    availability: {
      tina: {
        [days[0]]: ["09:30-10:30", "15:00-16:00", "19:00-20:00"],
        [days[1]]: ["08:00-09:00", "13:30-14:30"],
        [days[2]]: ["11:00-12:00", "20:15-21:15"],
      },
      mia: {
        [days[0]]: ["11:00-12:00", "16:30-17:30"],
        [days[1]]: ["09:30-10:30", "19:00-20:00"],
        [days[2]]: ["08:00-09:00", "15:00-16:00"],
      },
      zoe: {
        [days[0]]: ["13:30-14:30", "20:15-21:15"],
        [days[1]]: ["11:00-12:00", "16:30-17:30"],
        [days[2]]: ["09:30-10:30", "19:00-20:00"],
      },
    },
    bookings: [],
  };
}

function sanitizeTeacher(teacher) {
  return {
    id: teacher.id,
    name: teacher.name,
    specialty: teacher.specialty,
    focus: teacher.focus,
    experience: teacher.experience,
    price: teacher.price,
    serviceAreas: teacher.serviceAreas,
  };
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.teachers) || !Array.isArray(data.admins)) {
    return createSeedData();
  }

  const defaults = createSeedData();
  const days = getDayOptions();
  const availability = {};

  defaults.teachers.forEach((teacher) => {
    const existingTeacherAvailability = data.availability?.[teacher.id] || {};
    availability[teacher.id] = {};

    days.forEach((day) => {
      availability[teacher.id][day] =
        existingTeacherAvailability[day] || defaults.availability[teacher.id][day] || [];
    });
  });

  return {
    teachers: data.teachers.length ? data.teachers : defaults.teachers,
    admins: data.admins.length ? data.admins : defaults.admins,
    students: Array.isArray(data.students) ? data.students : [],
    availability,
    bookings: Array.isArray(data.bookings) ? data.bookings : [],
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    const normalized = normalizeData(parsed);
    await fs.writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), "utf8");
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(createSeedData(), null, 2), "utf8");
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalizeData(JSON.parse(raw));
}

async function writeData(nextData) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(nextData, null, 2), "utf8"),
  );
  return writeQueue;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

async function serveStatic(req, res) {
  const fileName = STATIC_FILES[req.url];
  if (!fileName) {
    return false;
  }

  const filePath = path.join(ROOT, fileName);
  const contentType =
    fileName.endsWith(".css")
      ? "text/css; charset=utf-8"
      : fileName.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : "text/html; charset=utf-8";

  const content = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, decodeURIComponent(rest.join("="))];
      }),
  );
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function destroySession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.flowmove_session;
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { token, ...session };
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `flowmove_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "flowmove_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  );
}

function requireUser(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "请先登录。" });
    return null;
  }
  return session;
}

function formatDayLabel(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function getScheduleWindow() {
  return getDayOptions().map((value) => ({
    value,
    label: formatDayLabel(value),
  }));
}

function isValidScheduleDate(date) {
  return getDayOptions().includes(date);
}

function validateAddress(address) {
  return /区.+(路|街|巷|道|镇|村)/.test(address);
}

function canManageTeacher(user, teacherId) {
  return user.role === "admin" || (user.role === "teacher" && user.id === teacherId);
}

function shapeBooking(booking, data) {
  const teacher = data.teachers.find((item) => item.id === booking.teacherId);
  return {
    ...booking,
    teacherName: teacher ? teacher.name : booking.teacherId,
    teacherSpecialty: teacher ? teacher.specialty : "",
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/healthz") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const data = await readData();
    return sendJson(res, 200, {
      dayOptions: getScheduleWindow(),
      teachers: data.teachers.map(sanitizeTeacher),
      courseTypes: ["普拉提", "瑜伽", "体态调整", "康复舒缓"],
      slotOptions: [
        "08:00-09:00",
        "09:30-10:30",
        "11:00-12:00",
        "13:30-14:30",
        "15:00-16:00",
        "16:30-17:30",
        "19:00-20:00",
        "20:15-21:15",
      ],
      demoAccounts: {
        teacher: "tina / FlowMove2026!",
        admin: "admin / FlowMoveAdmin2026!",
      },
    });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 200, { user: null });
    }
    return sendJson(res, 200, { user: session.user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/student") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!name || !phone) {
      return sendJson(res, 400, { error: "请填写学生姓名和手机号。" });
    }

    const data = await readData();
    let student = data.students.find((item) => item.phone === phone);

    if (!student) {
      student = {
        id: crypto.randomUUID(),
        role: "student",
        name,
        phone,
      };
      data.students.push(student);
      await writeData(data);
    } else {
      student.name = name;
      await writeData(data);
    }

    const user = {
      id: student.id,
      role: "student",
      name: student.name,
      phone: student.phone,
    };
    const token = createSession(user);
    setSessionCookie(res, token);
    return sendJson(res, 200, { user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/staff") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const data = await readData();
    const staff = [...data.teachers, ...data.admins].find((item) => item.username === username);

    if (!staff || hashPassword(password, staff.salt) !== staff.passwordHash) {
      return sendJson(res, 401, { error: "账号或密码不正确。" });
    }

    const user = {
      id: staff.id,
      role: staff.role,
      name: staff.name,
      username: staff.username,
    };
    const token = createSession(user);
    setSessionCookie(res, token);
    return sendJson(res, 200, { user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = getSession(req);
    destroySession(session?.token);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/availability") {
    const date = url.searchParams.get("date");
    const teacherId = url.searchParams.get("teacherId");
    const course = url.searchParams.get("course");
    const data = await readData();
    const bookedLookup = new Set(
      data.bookings.map((booking) => `${booking.teacherId}_${booking.date}_${booking.time}`),
    );

    const teachers = data.teachers
      .filter((teacher) => !teacherId || teacherId === "all" || teacher.id === teacherId)
      .filter(
        (teacher) =>
          !course ||
          course === "all" ||
          teacher.specialty.includes(course) ||
          teacher.focus.includes(course),
      )
      .map((teacher) => ({
        ...sanitizeTeacher(teacher),
        slots: (data.availability[teacher.id]?.[date] || []).map((time) => ({
          time,
          booked: bookedLookup.has(`${teacher.id}_${date}_${time}`),
        })),
      }));

    return sendJson(res, 200, { teachers });
  }

  if (req.method === "POST" && url.pathname === "/api/bookings") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    if (session.user.role !== "student") {
      return sendJson(res, 403, { error: "只有学生可以提交预约。" });
    }

    const body = await readBody(req);
    const teacherId = String(body.teacherId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");
    const bodyNotes = String(body.bodyNotes || "").trim();
    const goalNotes = String(body.goalNotes || "").trim();
    const address = String(body.address || "").trim();

    if (!teacherId || !date || !time || !bodyNotes || !goalNotes || !address) {
      return sendJson(res, 400, { error: "请完整填写预约信息。" });
    }

    if (!validateAddress(address)) {
      return sendJson(res, 400, { error: "地址需至少包含区和街名。" });
    }

    const data = await readData();
    const availableSlots = data.availability[teacherId]?.[date] || [];
    const alreadyBooked = data.bookings.some(
      (booking) => booking.teacherId === teacherId && booking.date === date && booking.time === time,
    );

    if (!availableSlots.includes(time) || alreadyBooked) {
      return sendJson(res, 409, { error: "该时段已不可预约，请刷新后重试。" });
    }

    const booking = {
      id: crypto.randomUUID(),
      teacherId,
      date,
      time,
      studentId: session.user.id,
      studentName: session.user.name,
      studentPhone: session.user.phone,
      bodyNotes,
      goalNotes,
      address,
      createdAt: new Date().toISOString(),
    };

    data.bookings.unshift(booking);
    await writeData(data);
    return sendJson(res, 201, { booking: shapeBooking(booking, data) });
  }

  if (req.method === "GET" && url.pathname === "/api/bookings") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const data = await readData();
    let bookings = data.bookings;

    if (session.user.role === "student") {
      bookings = bookings.filter((booking) => booking.studentId === session.user.id);
    }

    if (session.user.role === "teacher") {
      bookings = bookings.filter((booking) => booking.teacherId === session.user.id);
    }

    return sendJson(res, 200, {
      bookings: bookings.map((booking) => shapeBooking(booking, data)),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/staff/schedule") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const teacherId =
      session.user.role === "teacher" ? session.user.id : url.searchParams.get("teacherId");

    if (!teacherId || !canManageTeacher(session.user, teacherId)) {
      return sendJson(res, 403, { error: "没有权限查看该老师排班。" });
    }

    const data = await readData();
    const days = getScheduleWindow().map((day) => ({
      ...day,
      slots: data.availability[teacherId]?.[day.value] || [],
    }));
    return sendJson(res, 200, { days });
  }

  if (req.method === "POST" && url.pathname === "/api/staff/schedule") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const body = await readBody(req);
    const teacherId = String(body.teacherId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");

    if (!canManageTeacher(session.user, teacherId)) {
      return sendJson(res, 403, { error: "没有权限操作该老师排班。" });
    }

    if (!isValidScheduleDate(date) || !time) {
      return sendJson(res, 400, { error: "只能维护未来 3 天内的时段。" });
    }

    const data = await readData();
    data.availability[teacherId] = data.availability[teacherId] || {};
    data.availability[teacherId][date] = data.availability[teacherId][date] || [];

    if (data.availability[teacherId][date].includes(time)) {
      return sendJson(res, 409, { error: "该时段已存在。" });
    }

    data.availability[teacherId][date].push(time);
    data.availability[teacherId][date].sort();
    await writeData(data);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && url.pathname === "/api/staff/schedule") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const teacherId = String(url.searchParams.get("teacherId") || "");
    const date = String(url.searchParams.get("date") || "");
    const time = String(url.searchParams.get("time") || "");

    if (!canManageTeacher(session.user, teacherId)) {
      return sendJson(res, 403, { error: "没有权限操作该老师排班。" });
    }

    const data = await readData();
    const booked = data.bookings.some(
      (booking) => booking.teacherId === teacherId && booking.date === date && booking.time === time,
    );

    if (booked) {
      return sendJson(res, 409, { error: "该时段已有预约，不能删除。" });
    }

    data.availability[teacherId][date] = (data.availability[teacherId][date] || []).filter(
      (slot) => slot !== time,
    );
    await writeData(data);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "接口不存在。" });
}

async function requestListener(req, res) {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    const served = await serveStatic(req, res);
    if (!served) {
      sendText(res, 404, "Not Found");
    }
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "服务器开小差了，请稍后重试。" });
  }
}

ensureDataFile().then(() => {
  http.createServer(requestListener).listen(PORT, HOST, () => {
    console.log(`FlowMove server running at http://${HOST}:${PORT}`);
  });
});
