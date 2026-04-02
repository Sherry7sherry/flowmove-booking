const http = require("http");
const https = require("https");
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
const PAYMENT_CONFIG = {
  wechat: {
    appid: process.env.WECHAT_PAY_APPID || "",
    mchid: process.env.WECHAT_PAY_MCHID || "",
    serial: process.env.WECHAT_PAY_SERIAL || "",
    privateKey: process.env.WECHAT_PAY_PRIVATE_KEY || "",
    privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY_PATH || "",
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || "",
    enabled: Boolean(
      process.env.WECHAT_PAY_APPID &&
        process.env.WECHAT_PAY_MCHID &&
        process.env.WECHAT_PAY_SERIAL &&
        (process.env.WECHAT_PAY_PRIVATE_KEY || process.env.WECHAT_PAY_PRIVATE_KEY_PATH),
    ),
  },
  alipay: {
    enabled: Boolean(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY),
    mode: "wap",
  },
};
const SUPPORT_CONTACT = {
  name: process.env.SUPPORT_CONTACT_NAME || "ShiningShining",
  wechatId: process.env.SUPPORT_CONTACT_WECHAT || "peach_starlover",
  note:
    process.env.SUPPORT_CONTACT_NOTE ||
    "添加后请备注预约姓名、老师姓名和上课时间，客服核对到账后会人工确认预约。",
};
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "sherry7sherry";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1qaz2wsx";
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
        phone: "13800010001",
        specialty: "普拉提塑形",
        focus: "核心激活 / 体态调整 / 产后恢复",
        experience: "6 年教学经验",
        price: "¥420 / 次",
        serviceAreas: "静安区、徐汇区、长宁区",
        certifications: "Balanced Body 普拉提认证，孕产运动专项培训",
      }),
      createAccount("mia", "FlowMove2026!", {
        id: "mia",
        role: "teacher",
        name: "Mia",
        phone: "13800010002",
        specialty: "瑜伽伸展",
        focus: "肩颈舒缓 / 柔韧改善 / 睡眠放松",
        experience: "5 年教学经验",
        price: "¥380 / 次",
        serviceAreas: "浦东新区、杨浦区、虹口区",
        certifications: "RYT 500 小时认证，功能性拉伸培训",
      }),
      createAccount("zoe", "FlowMove2026!", {
        id: "zoe",
        role: "teacher",
        name: "Zoe",
        phone: "13800010003",
        specialty: "功能训练融合",
        focus: "腰背稳定 / 私教入门 / 久坐改善",
        experience: "7 年教学经验",
        price: "¥460 / 次",
        serviceAreas: "黄浦区、普陀区、闵行区",
        certifications: "NASM CPT，运动康复进阶培训",
      }),
    ],
    admins: [
      createAccount("admin", "FlowMoveAdmin2026!", {
        id: "admin",
        role: "admin",
        name: "运营管理员",
        phone: "13800019999",
        username: ADMIN_USERNAME,
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
    notifications: [],
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
    certifications: teacher.certifications || "",
    phone: teacher.phone,
  };
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.teachers) || !Array.isArray(data.admins)) {
    return createSeedData();
  }

  const defaults = createSeedData();
  const days = getDayOptions();
  const availability = {};

  const allTeachers = data.teachers.length ? data.teachers : defaults.teachers;

  allTeachers.forEach((teacher) => {
    const defaultTeacher = defaults.teachers.find((item) => item.id === teacher.id);
    const existingTeacherAvailability = data.availability?.[teacher.id] || {};
    availability[teacher.id] = {};

    days.forEach((day) => {
      availability[teacher.id][day] =
        existingTeacherAvailability[day] ||
        (defaultTeacher ? defaults.availability[defaultTeacher.id]?.[day] || [] : []);
    });
  });

  return {
    teachers: data.teachers.length ? data.teachers : defaults.teachers,
    admins: data.admins.length ? data.admins : defaults.admins,
    students: Array.isArray(data.students) ? data.students : [],
    availability,
    bookings: Array.isArray(data.bookings) ? data.bookings : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
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
  if (req.url.startsWith("/assets/")) {
    const filePath = path.join(ROOT, req.url);
    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return true;
  }

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
    paymentMethod: booking.paymentMethod || "wechat",
    depositStatus: booking.depositStatus || "pending",
    paymentGatewayStatus: booking.paymentGatewayStatus || "not_configured",
    depositAmount: Number(booking.depositAmount || 0),
    remainingAmount: Number(booking.remainingAmount || 0),
    manualPaymentSubmittedAt: booking.manualPaymentSubmittedAt || null,
    manualPaymentConfirmedAt: booking.manualPaymentConfirmedAt || null,
    teacherName: teacher ? teacher.name : booking.teacherId,
    teacherSpecialty: teacher ? teacher.specialty : "",
    teacherPrice: teacher ? teacher.price : "",
  };
}

function parsePriceAmount(priceLabel) {
  return Number(String(priceLabel || "").replace(/[^\d.]/g, ""));
}

function getPaymentProviderMeta() {
  return {
    wechat: {
      label: "微信支付",
      enabled: PAYMENT_CONFIG.wechat.enabled,
      mode: "desktop_qr + mobile_h5",
    },
    alipay: {
      label: "支付宝",
      enabled: PAYMENT_CONFIG.alipay.enabled,
      mode: PAYMENT_CONFIG.alipay.mode,
    },
  };
}

async function getWechatPrivateKey() {
  if (PAYMENT_CONFIG.wechat.privateKey) {
    return PAYMENT_CONFIG.wechat.privateKey;
  }

  if (PAYMENT_CONFIG.wechat.privateKeyPath) {
    return fs.readFile(PAYMENT_CONFIG.wechat.privateKeyPath, "utf8");
  }

  throw new Error("WECHAT_PAY_PRIVATE_KEY 未配置。");
}

async function wechatRequest(method, requestPath, body) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = body ? JSON.stringify(body) : "";
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonce}\n${payload}\n`;
  const privateKey = await getWechatPrivateKey();
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  const signature = signer.sign(privateKey, "base64");
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${PAYMENT_CONFIG.wechat.mchid}",` +
    `nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${PAYMENT_CONFIG.wechat.serial}",` +
    `signature="${signature}"`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.mch.weixin.qq.com",
        path: requestPath,
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const parsed = text ? JSON.parse(text) : {};

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
            return;
          }

          reject(new Error(parsed.message || parsed.detail || `微信支付请求失败：${res.statusCode}`));
        });
      },
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  const remote = req.socket.remoteAddress || "";
  return remote.replace("::ffff:", "") || "127.0.0.1";
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function buildWechatOutTradeNo(booking) {
  return `fm${booking.id.replace(/-/g, "").slice(0, 26)}`;
}

async function createWechatPayment(booking, req, scene) {
  if (!PAYMENT_CONFIG.wechat.enabled) {
    return {
      status: "credentials_required",
      scene,
      message: "微信支付商户参数尚未配置，暂时不能发起真实支付。",
    };
  }

  const amount = {
    total: Math.round(booking.depositAmount * 100),
    currency: "CNY",
  };
  const outTradeNo = booking.paymentIntent?.outTradeNo || buildWechatOutTradeNo(booking);
  const origin = getOrigin(req);
  const description = `FlowMove 课程预约金 ${booking.date} ${booking.time}`;

  if (scene === "desktop") {
    const payload = await wechatRequest("POST", "/v3/pay/transactions/native", {
      appid: PAYMENT_CONFIG.wechat.appid,
      mchid: PAYMENT_CONFIG.wechat.mchid,
      description,
      out_trade_no: outTradeNo,
      notify_url: PAYMENT_CONFIG.wechat.notifyUrl || `${origin}/api/payments/wechat/notify`,
      amount,
    });

    return {
      status: "pending",
      scene: "desktop",
      codeUrl: payload.code_url,
      outTradeNo,
    };
  }

  const payload = await wechatRequest("POST", "/v3/pay/transactions/h5", {
    appid: PAYMENT_CONFIG.wechat.appid,
    mchid: PAYMENT_CONFIG.wechat.mchid,
    description,
    out_trade_no: outTradeNo,
    notify_url: PAYMENT_CONFIG.wechat.notifyUrl || `${origin}/api/payments/wechat/notify`,
    amount,
    scene_info: {
      payer_client_ip: getClientIp(req),
      h5_info: {
        type: "Wap",
      },
    },
  });

  return {
    status: "pending",
    scene: "mobile",
    h5Url: payload.h5_url,
    outTradeNo,
  };
}

async function queryWechatPayment(outTradeNo) {
  if (!PAYMENT_CONFIG.wechat.enabled) {
    return { tradeState: "NOT_CONFIGURED" };
  }

  const result = await wechatRequest(
    "GET",
    `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${PAYMENT_CONFIG.wechat.mchid}`,
  );

  return result;
}

function markBookingPaid(booking, data) {
  if (booking.depositStatus === "paid") {
    return;
  }

  booking.depositStatus = "paid";
  booking.paymentGatewayStatus = "captured";
  booking.paidAt = new Date().toISOString();
  booking.manualPaymentConfirmedAt = booking.manualPaymentConfirmedAt || booking.paidAt;

  const teacher = data.teachers.find((item) => item.id === booking.teacherId);
  data.notifications.unshift(
    createNotification(
      "student",
      booking.studentId,
      "预约金已确认到账",
      `${teacher ? teacher.name : "老师"} 的 ${booking.date} ${booking.time} 课程已确认预约成功。`,
    ),
  );
  data.notifications.unshift(
    createNotification(
      "teacher",
      booking.teacherId,
      "预约金已确认到账",
      `${booking.studentName} 的 ${booking.date} ${booking.time} 课程预约金已确认到账，课程已锁定。`,
    ),
  );
  data.admins.forEach((admin) => {
    data.notifications.unshift(
      createNotification(
        "admin",
        admin.id,
        "预约已确认成功",
        `${booking.studentName} 与 ${teacher ? teacher.name : booking.teacherId} 的课程预约已确认成功。`,
      ),
    );
  });
}

function getRoleCollection(data, role) {
  if (role === "teacher") {
    return data.teachers;
  }

  if (role === "admin") {
    return data.admins;
  }

  return data.students;
}

function shapeUserForSession(user) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
  };
}

function createNotification(recipientRole, recipientId, title, message) {
  return {
    id: crypto.randomUUID(),
    recipientRole,
    recipientId,
    title,
    message,
    createdAt: new Date().toISOString(),
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
      paymentProviders: getPaymentProviderMeta(),
      supportContact: SUPPORT_CONTACT,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 200, { user: null });
    }
    return sendJson(res, 200, { user: session.user });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/admin-password") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { error: "管理员用户名或密码不正确。" });
    }

    const data = await readData();
    let admin = data.admins.find((item) => item.id === "admin");

    if (!admin) {
      admin = {
        id: "admin",
        role: "admin",
        name: "系统管理员",
        phone: "13800019999",
        username: ADMIN_USERNAME,
      };
      data.admins.unshift(admin);
      await writeData(data);
    }

    admin.username = ADMIN_USERNAME;
    const sessionUser = shapeUserForSession(admin);
    const token = createSession(sessionUser);
    setSessionCookie(res, token);
    return sendJson(res, 200, { user: sessionUser });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/phone") {
    const body = await readBody(req);
    const role = String(body.role || "").trim();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!["student", "teacher", "admin"].includes(role) || !name || !phone) {
      return sendJson(res, 400, { error: "请选择身份并填写姓名和手机号。" });
    }

    const data = await readData();
    const collection = getRoleCollection(data, role);
    let user = collection.find((item) => item.phone === phone);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        role,
        name,
        phone,
        specialty: role === "teacher" ? "" : undefined,
        focus: role === "teacher" ? "" : undefined,
        experience: role === "teacher" ? "" : undefined,
        price: role === "teacher" ? "¥0 / 次" : undefined,
        serviceAreas: role === "teacher" ? "" : role === "student" ? "" : undefined,
        certifications: role === "teacher" ? "" : undefined,
        goals: role === "student" ? "" : undefined,
        bodyCondition: role === "student" ? "" : undefined,
        area: role === "student" ? "" : undefined,
      };
      collection.push(user);
    } else {
      user.name = name;
    }

    await writeData(data);
    const sessionUser = shapeUserForSession(user);
    const token = createSession(sessionUser);
    setSessionCookie(res, token);
    return sendJson(res, 200, { user: sessionUser });
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

  if (req.method === "GET" && url.pathname === "/api/profile/me") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const data = await readData();
    const collection = getRoleCollection(data, session.user.role);
    const user = collection.find((item) => item.id === session.user.id);

    if (!user) {
      return sendJson(res, 404, { error: "未找到当前用户资料。" });
    }

    return sendJson(res, 200, { profile: user });
  }

  if (req.method === "PUT" && url.pathname === "/api/profile/me") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const body = await readBody(req);
    const data = await readData();
    const collection = getRoleCollection(data, session.user.role);
    const user = collection.find((item) => item.id === session.user.id);

    if (!user) {
      return sendJson(res, 404, { error: "未找到当前用户资料。" });
    }

    user.name = String(body.name || user.name).trim();

    if (session.user.role === "teacher") {
      user.certifications = String(body.certifications || "").trim();
      user.focus = String(body.focus || "").trim();
      user.specialty = String(body.specialty || "").trim();
      user.price = String(body.price || "").trim() || user.price;
      user.serviceAreas = String(body.serviceAreas || "").trim();
    }

    if (session.user.role === "student") {
      user.goals = String(body.goals || "").trim();
      user.bodyCondition = String(body.bodyCondition || "").trim();
      user.area = String(body.area || "").trim();
    }

    await writeData(data);
    return sendJson(res, 200, { profile: user });
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
    const paymentMethod = String(body.paymentMethod || "").trim();

    if (!teacherId || !date || !time || !bodyNotes || !goalNotes || !address || !paymentMethod) {
      return sendJson(res, 400, { error: "请完整填写预约信息。" });
    }

    if (paymentMethod !== "wechat") {
      return sendJson(res, 400, { error: "当前版本仅支持微信支付预约金。" });
    }

    if (!validateAddress(address)) {
      return sendJson(res, 400, { error: "地址需至少包含区和街名。" });
    }

    const data = await readData();
    const teacher = data.teachers.find((item) => item.id === teacherId);

    if (!teacher) {
      return sendJson(res, 404, { error: "老师不存在。" });
    }

    const availableSlots = data.availability[teacherId]?.[date] || [];
    const alreadyBooked = data.bookings.some(
      (booking) => booking.teacherId === teacherId && booking.date === date && booking.time === time,
    );

    if (!availableSlots.includes(time) || alreadyBooked) {
      return sendJson(res, 409, { error: "该时段已不可预约，请刷新后重试。" });
    }

    const totalAmount = parsePriceAmount(teacher.price);
    const depositAmount = Math.round(totalAmount * 0.2);
    const remainingAmount = totalAmount - depositAmount;

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
      paymentMethod,
      totalAmount,
      depositRate: 0.2,
      depositAmount,
      remainingAmount,
      depositStatus: "pending",
      paymentGatewayStatus: "awaiting_contact",
      nonRefundableDeposit: true,
      paymentIntent: null,
      createdAt: new Date().toISOString(),
    };

    data.bookings.unshift(booking);
    await writeData(data);
    return sendJson(res, 201, { booking: shapeBooking(booking, data) });
  }

  if (req.method === "POST" && url.pathname === "/api/bookings/manual-payment-submitted") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    if (session.user.role !== "student") {
      return sendJson(res, 403, { error: "只有学生可以提交支付确认。" });
    }

    const body = await readBody(req);
    const bookingId = String(body.bookingId || "");
    const data = await readData();
    const booking = data.bookings.find(
      (item) => item.id === bookingId && item.studentId === session.user.id,
    );

    if (!booking) {
      return sendJson(res, 404, { error: "未找到该预约。" });
    }

    if (booking.depositStatus === "paid") {
      return sendJson(res, 200, { booking: shapeBooking(booking, data) });
    }

    booking.paymentGatewayStatus = "manual_review";
    booking.manualPaymentSubmittedAt = new Date().toISOString();

    const teacher = data.teachers.find((item) => item.id === booking.teacherId);
    data.notifications.unshift(
      createNotification(
        "teacher",
        booking.teacherId,
        "学生已提交付款确认",
        `${booking.studentName} 表示已向客服支付 ${booking.depositAmount} 元预约金，请等待管理员核对。`,
      ),
    );
    data.admins.forEach((admin) => {
      data.notifications.unshift(
        createNotification(
          "admin",
          admin.id,
          "有预约待人工确认",
          `${booking.studentName} 已提交 ${teacher ? teacher.name : booking.teacherId} 的预约金付款确认，请核对到账。`,
        ),
      );
    });

    await writeData(data);
    return sendJson(res, 200, { booking: shapeBooking(booking, data) });
  }

  if (req.method === "POST" && url.pathname === "/api/payments/wechat/prepare") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const body = await readBody(req);
    const bookingId = String(body.bookingId || "");
    const scene = body.scene === "mobile" ? "mobile" : "desktop";

    const data = await readData();
    const booking = data.bookings.find(
      (item) => item.id === bookingId && item.studentId === session.user.id,
    );

    if (!booking) {
      return sendJson(res, 404, { error: "未找到该预约。" });
    }

    if (booking.paymentMethod !== "wechat") {
      return sendJson(res, 400, { error: "当前只支持准备微信支付。" });
    }

    const payment = await createWechatPayment(booking, req, scene);
    booking.paymentIntent = {
      provider: "wechat",
      scene,
      outTradeNo: payment.outTradeNo || booking.paymentIntent?.outTradeNo || null,
      codeUrl: payment.codeUrl || null,
      h5Url: payment.h5Url || null,
      status: payment.status,
      createdAt: new Date().toISOString(),
    };
    booking.paymentGatewayStatus = payment.status;
    await writeData(data);

    return sendJson(res, 200, { payment, booking: shapeBooking(booking, data) });
  }

  if (req.method === "GET" && url.pathname === "/api/payments/wechat/status") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const bookingId = String(url.searchParams.get("bookingId") || "");
    const data = await readData();
    const booking = data.bookings.find(
      (item) => item.id === bookingId && item.studentId === session.user.id,
    );

    if (!booking) {
      return sendJson(res, 404, { error: "未找到该预约。" });
    }

    if (!booking.paymentIntent?.outTradeNo) {
      return sendJson(res, 200, {
        payment: {
          status: booking.paymentGatewayStatus,
          depositStatus: booking.depositStatus,
        },
        booking: shapeBooking(booking, data),
      });
    }

    const result = await queryWechatPayment(booking.paymentIntent.outTradeNo);

    if (result.trade_state === "SUCCESS") {
      markBookingPaid(booking, data);
      await writeData(data);
      return sendJson(res, 200, {
        payment: {
          status: "paid",
          depositStatus: "paid",
          transactionId: result.transaction_id || "",
        },
        booking: shapeBooking(booking, data),
      });
    }

    if (result.trade_state === "NOTPAY") {
      booking.paymentGatewayStatus = "pending";
      await writeData(data);
      return sendJson(res, 200, {
        payment: {
          status: "pending",
          depositStatus: booking.depositStatus,
        },
        booking: shapeBooking(booking, data),
      });
    }

    if (result.tradeState === "NOT_CONFIGURED") {
      return sendJson(res, 200, {
        payment: {
          status: "credentials_required",
          depositStatus: booking.depositStatus,
        },
        booking: shapeBooking(booking, data),
      });
    }

    booking.paymentGatewayStatus = "failed";
    await writeData(data);
    return sendJson(res, 200, {
      payment: {
        status: "failed",
        depositStatus: booking.depositStatus,
        tradeState: result.trade_state || "UNKNOWN",
      },
      booking: shapeBooking(booking, data),
    });
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

  if (req.method === "GET" && url.pathname === "/api/notifications") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    const data = await readData();
    const notifications = data.notifications.filter(
      (item) =>
        (item.recipientRole === session.user.role && item.recipientId === session.user.id) ||
        (session.user.role === "admin" && item.recipientRole === "admin"),
    );

    return sendJson(res, 200, { notifications });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/overview") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    if (session.user.role !== "admin") {
      return sendJson(res, 403, { error: "只有管理员可以查看总览。" });
    }

    const data = await readData();
    return sendJson(res, 200, {
      teachers: data.teachers.map((teacher) => sanitizeTeacher(teacher)),
      students: data.students,
      bookings: data.bookings.map((booking) => shapeBooking(booking, data)),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/bookings/confirm-payment") {
    const session = requireUser(req, res);
    if (!session) {
      return;
    }

    if (session.user.role !== "admin") {
      return sendJson(res, 403, { error: "只有管理员可以确认预约金。" });
    }

    const body = await readBody(req);
    const bookingId = String(body.bookingId || "");
    const data = await readData();
    const booking = data.bookings.find((item) => item.id === bookingId);

    if (!booking) {
      return sendJson(res, 404, { error: "未找到该预约。" });
    }

    markBookingPaid(booking, data);
    await writeData(data);
    return sendJson(res, 200, { booking: shapeBooking(booking, data) });
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
