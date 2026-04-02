const state = {
  selectedRole: "student",
  sessionUser: null,
  bootstrap: {
    teachers: [],
    dayOptions: [],
    courseTypes: [],
    slotOptions: [],
    paymentProviders: {},
  },
  selectedSlot: null,
  currentProfile: null,
  pendingPaymentBookingId: null,
};

const roleTabs = document.querySelector("#role-tabs");
const authNameInput = document.querySelector("#auth-name");
const authPhoneInput = document.querySelector("#auth-phone");
const phoneAuthFields = document.querySelector("#phone-auth-fields");
const adminAuthFields = document.querySelector("#admin-auth-fields");
const adminUsernameInput = document.querySelector("#admin-username");
const adminPasswordInput = document.querySelector("#admin-password");
const authSubmit = document.querySelector("#auth-submit");
const authStatus = document.querySelector("#auth-status");
const logoutButton = document.querySelector("#logout-button");

const studentWorkspace = document.querySelector("#student-workspace");
const teacherWorkspace = document.querySelector("#teacher-workspace");
const adminWorkspace = document.querySelector("#admin-workspace");

const teacherFilter = document.querySelector("#teacher-filter");
const dateFilter = document.querySelector("#date-filter");
const courseFilter = document.querySelector("#course-filter");
const teacherGrid = document.querySelector("#teacher-grid");
const resultsCount = document.querySelector("#results-count");

const studentProfileGoals = document.querySelector("#student-profile-goals");
const studentProfileBody = document.querySelector("#student-profile-body");
const studentProfileArea = document.querySelector("#student-profile-area");
const studentProfileSave = document.querySelector("#student-profile-save");
const studentProfileStatus = document.querySelector("#student-profile-status");

const teacherProfileCertifications = document.querySelector("#teacher-profile-certifications");
const teacherProfileSpecialty = document.querySelector("#teacher-profile-specialty");
const teacherProfileFocus = document.querySelector("#teacher-profile-focus");
const teacherProfilePrice = document.querySelector("#teacher-profile-price");
const teacherProfileAreas = document.querySelector("#teacher-profile-areas");
const teacherProfileSave = document.querySelector("#teacher-profile-save");
const teacherProfileStatus = document.querySelector("#teacher-profile-status");

const selectedSlotView = document.querySelector("#selected-slot");
const bookingForm = document.querySelector("#booking-form");
const goalNotesInput = document.querySelector("#goal-notes");
const bodyNotesInput = document.querySelector("#body-notes");
const addressInput = document.querySelector("#address");
const paymentOptions = document.querySelector("#payment-options");
const depositSummary = document.querySelector("#deposit-summary");
const bookingStatus = document.querySelector("#booking-status");
const paymentSheet = document.querySelector("#payment-sheet");
const paymentSceneLabel = document.querySelector("#payment-scene-label");
const paymentGatewayMessage = document.querySelector("#payment-gateway-message");
const paymentQrWrap = document.querySelector("#payment-qr-wrap");
const paymentQrImage = document.querySelector("#payment-qr-image");
const paymentMobileWrap = document.querySelector("#payment-mobile-wrap");
const paymentRefresh = document.querySelector("#payment-refresh");
const supportContactName = document.querySelector("#support-contact-name");
const supportContactId = document.querySelector("#support-contact-id");
const copySupportWechat = document.querySelector("#copy-support-wechat");

const studentBookingList = document.querySelector("#student-booking-list");
const teacherBookingList = document.querySelector("#teacher-booking-list");
const adminBookingList = document.querySelector("#admin-booking-list");
const studentNotifications = document.querySelector("#student-notifications");
const teacherNotifications = document.querySelector("#teacher-notifications");
const adminNotifications = document.querySelector("#admin-notifications");

const teacherManagerSelect = document.querySelector("#teacher-manager-select");
const teacherDateSelect = document.querySelector("#teacher-date-select");
const teacherSlotSelect = document.querySelector("#teacher-slot-select");
const addSlotButton = document.querySelector("#add-slot-button");
const scheduleList = document.querySelector("#schedule-list");
const teacherStatus = document.querySelector("#teacher-status");

const adminTeacherCount = document.querySelector("#admin-teacher-count");
const adminStudentCount = document.querySelector("#admin-student-count");
const adminBookingCount = document.querySelector("#admin-booking-count");
const adminTeacherList = document.querySelector("#admin-teacher-list");
const adminStudentList = document.querySelector("#admin-student-list");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "请求失败，请稍后重试。");
  }

  return payload;
}

function populateSelect(select, options, includeAllLabel) {
  select.innerHTML = "";

  if (includeAllLabel) {
    const option = document.createElement("option");
    option.value = "all";
    option.textContent = includeAllLabel;
    select.append(option);
  }

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  });
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCurrency(amount) {
  return `¥${Math.round(Number(amount || 0))}`;
}

function parsePrice(label) {
  return Number(String(label || "").replace(/[^\d.]/g, ""));
}

function getTeacherById(teacherId) {
  return state.bootstrap.teachers.find((teacher) => teacher.id === teacherId);
}

function getSelectedPaymentMethod() {
  const selected = bookingForm.querySelector('input[name="payment-method"]:checked');
  return selected ? selected.value : "";
}

function formatPaymentMethod(method) {
  return method === "wechat" ? "微信支付" : "支付宝";
}

function formatDepositStatus(status) {
  if (status === "paid") {
    return "已支付";
  }
  if (status === "pending") {
    return "待支付";
  }
  return "支付处理中";
}

function formatGatewayStatus(status) {
  if (status === "captured" || status === "paid") {
    return "已确认";
  }
  if (status === "awaiting_contact") {
    return "待联系客服";
  }
  if (status === "manual_review") {
    return "待人工确认";
  }
  if (status === "credentials_required") {
    return "网关待接入";
  }
  if (status === "failed") {
    return "支付失败";
  }
  return "处理中";
}

function resetPaymentSheet() {
  state.pendingPaymentBookingId = null;
  paymentSheet.classList.add("hidden");
  paymentGatewayMessage.textContent = "请添加客服微信，完成 20% 预约金支付后再提交确认。";
  paymentSceneLabel.textContent = "人工确认";
}

function setSelectedRole(role) {
  state.selectedRole = role;
  roleTabs.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });
  phoneAuthFields.classList.toggle("hidden", role === "admin");
  adminAuthFields.classList.toggle("hidden", role !== "admin");
}

function showWorkspace(role) {
  studentWorkspace.classList.toggle("hidden", role !== "student");
  teacherWorkspace.classList.toggle("hidden", role !== "teacher");
  adminWorkspace.classList.toggle("hidden", role !== "admin");
}

function setAuthMessage(message) {
  authStatus.textContent = message;
}

function renderSelectedSlot() {
  if (!state.selectedSlot) {
    selectedSlotView.textContent = "请先在老师资料卡中选择一个可预约时间。";
    depositSummary.textContent = "请选择时段后查看本次课程预约金金额。";
    resetPaymentSheet();
    return;
  }

  const teacher = getTeacherById(state.selectedSlot.teacherId);
  const total = parsePrice(teacher.price);
  const deposit = total * 0.2;
  const balance = total - deposit;

  selectedSlotView.innerHTML = `
    <div class="booking-preview">
      <strong>${teacher.name} · ${teacher.specialty || "待完善资料"}</strong>
      <p class="booking-meta">${formatLongDate(state.selectedSlot.date)} · ${state.selectedSlot.time}</p>
      <p class="booking-meta">方便区域 ${teacher.serviceAreas || "待填写"} · 课程价格 ${teacher.price}</p>
      <p class="booking-meta">预约金 ${formatCurrency(deposit)}，剩余尾款 ${formatCurrency(balance)}</p>
    </div>
  `;

  depositSummary.innerHTML = `
    <strong>本次课程总价 ${formatCurrency(total)}</strong>
    <span>支付 20% 预约金 ${formatCurrency(deposit)} 后锁定课程，支付成功后不退还。</span>
  `;
}

function fillStudentProfile(profile) {
  studentProfileGoals.value = profile.goals || "";
  studentProfileBody.value = profile.bodyCondition || "";
  studentProfileArea.value = profile.area || "";
  goalNotesInput.value = profile.goals || "";
  bodyNotesInput.value = profile.bodyCondition || "";
  addressInput.value = profile.area || "";
}

async function submitManualPaymentConfirmation() {
  if (!state.pendingPaymentBookingId) {
    bookingStatus.textContent = "请先创建预约。";
    return;
  }

  await api("/api/bookings/manual-payment-submitted", {
    method: "POST",
    body: JSON.stringify({
      bookingId: state.pendingPaymentBookingId,
    }),
  });
  paymentGatewayMessage.textContent = "已提交人工确认，客服与管理员核对到账后会确认预约。";
  bookingStatus.textContent = "已通知管理员人工确认预约金，请等待确认结果。";
  await renderBookings();
  await renderNotifications();
}

function fillTeacherProfile(profile) {
  teacherProfileCertifications.value = profile.certifications || "";
  teacherProfileSpecialty.value = profile.specialty || "";
  teacherProfileFocus.value = profile.focus || "";
  teacherProfilePrice.value = profile.price || "";
  teacherProfileAreas.value = profile.serviceAreas || "";
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap", { method: "GET" });
  state.bootstrap = payload;

  populateSelect(
    teacherFilter,
    payload.teachers.map((teacher) => ({
      value: teacher.id,
      label: `${teacher.name} · ${teacher.specialty || "老师资料待完善"}`,
    })),
    "全部老师",
  );
  populateSelect(
    dateFilter,
    payload.dayOptions.map((day) => ({ value: day.value, label: day.label })),
    null,
  );
  populateSelect(
    courseFilter,
    payload.courseTypes.map((course) => ({ value: course, label: course })),
    "全部课程",
  );
  populateSelect(
    teacherManagerSelect,
    payload.teachers.map((teacher) => ({
      value: teacher.id,
      label: `${teacher.name} · ${teacher.specialty || "老师资料待完善"}`,
    })),
    null,
  );
  populateSelect(
    teacherDateSelect,
    payload.dayOptions.map((day) => ({ value: day.value, label: day.label })),
    null,
  );
  populateSelect(
    teacherSlotSelect,
    payload.slotOptions.map((slot) => ({ value: slot, label: slot })),
    null,
  );

  if (payload.supportContact) {
    supportContactName.textContent = payload.supportContact.name;
    supportContactId.textContent = payload.supportContact.wechatId;
  }
}

async function loadSession() {
  const payload = await api("/api/auth/me", { method: "GET" });
  state.sessionUser = payload.user;
}

async function loadMyProfile() {
  if (!state.sessionUser) {
    return null;
  }

  const payload = await api("/api/profile/me", { method: "GET" });
  state.currentProfile = payload.profile;
  return payload.profile;
}

async function saveStudentProfile() {
  try {
    const payload = await api("/api/profile/me", {
      method: "PUT",
      body: JSON.stringify({
        name: state.sessionUser.name,
        goals: studentProfileGoals.value.trim(),
        bodyCondition: studentProfileBody.value.trim(),
        area: studentProfileArea.value.trim(),
      }),
    });
    state.currentProfile = payload.profile;
    fillStudentProfile(payload.profile);
    studentProfileStatus.textContent = "学生资料已保存。";
  } catch (error) {
    studentProfileStatus.textContent = error.message;
  }
}

async function saveTeacherProfile() {
  try {
    const payload = await api("/api/profile/me", {
      method: "PUT",
      body: JSON.stringify({
        name: state.sessionUser.name,
        certifications: teacherProfileCertifications.value.trim(),
        specialty: teacherProfileSpecialty.value.trim(),
        focus: teacherProfileFocus.value.trim(),
        price: teacherProfilePrice.value.trim(),
        serviceAreas: teacherProfileAreas.value.trim(),
      }),
    });
    state.currentProfile = payload.profile;
    fillTeacherProfile(payload.profile);
    teacherProfileStatus.textContent = "老师资料已保存。";
    await loadBootstrap();
    await renderTeacherCards();
  } catch (error) {
    teacherProfileStatus.textContent = error.message;
  }
}

async function renderTeacherCards() {
  const query = new URLSearchParams({
    date: dateFilter.value,
    teacherId: teacherFilter.value,
    course: courseFilter.value,
  });

  const payload = await api(`/api/availability?${query.toString()}`, { method: "GET" });
  const teachers = payload.teachers;
  const availableCount = teachers.reduce(
    (count, teacher) => count + teacher.slots.filter((slot) => !slot.booked).length,
    0,
  );

  resultsCount.textContent = availableCount;
  teacherGrid.innerHTML = "";

  if (!teachers.length) {
    teacherGrid.innerHTML = '<div class="empty-state">当前没有符合条件的老师或空档。</div>';
    return;
  }

  teachers.forEach((teacher, index) => {
    const availableSlots = teacher.slots.filter((slot) => !slot.booked).length;
    const card = document.createElement("article");
    card.className = "teacher-card";
    card.style.animationDelay = `${index * 70}ms`;
    card.innerHTML = `
      <div class="teacher-head">
        <div class="teacher-head-main">
          <strong>${teacher.name}</strong>
          <p class="teacher-meta">${teacher.specialty || "老师资料待完善"}</p>
        </div>
        <div class="teacher-head-side">
          <span class="tag teacher-price-tag">${teacher.price}</span>
          <span class="availability-pill">${availableSlots} 个时段</span>
        </div>
      </div>
      <div class="teacher-note-card">
        <p class="teacher-meta"><strong>培训认证：</strong>${teacher.certifications || "待完善"}</p>
        <p class="teacher-meta"><strong>擅长方向：</strong>${teacher.focus || "待完善"}</p>
        <p class="teacher-meta"><strong>方便区域：</strong>${teacher.serviceAreas || "待完善"}</p>
      </div>
      <div class="teacher-stats">
        <span class="tag">${formatLongDate(dateFilter.value)}</span>
        <span class="tag">${teacher.experience || "教学经验待完善"}</span>
      </div>
      <div class="slot-group">
        <p class="panel-label">可预约时间</p>
        <div class="slot-row">
          ${
            teacher.slots.length
              ? teacher.slots
                  .map(
                    (slot) => `
              <button
                class="slot-button ${
                  state.selectedSlot &&
                  state.selectedSlot.teacherId === teacher.id &&
                  state.selectedSlot.date === dateFilter.value &&
                  state.selectedSlot.time === slot.time
                    ? "selected"
                    : ""
                }"
                type="button"
                data-teacher="${teacher.id}"
                data-time="${slot.time}"
                ${slot.booked ? "disabled" : ""}
              >
                ${slot.booked ? `${slot.time} · 已预约` : slot.time}
              </button>
            `,
                  )
                  .join("")
              : '<p class="slot-empty">该老师当天暂未开放时间。</p>'
          }
        </div>
      </div>
    `;
    teacherGrid.append(card);
  });

  teacherGrid.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSlot = {
        teacherId: button.dataset.teacher,
        date: dateFilter.value,
        time: button.dataset.time,
      };
      renderSelectedSlot();
      renderTeacherCards();
    });
  });
}

function renderNotificationList(container, items, emptyText) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-head">
        <div>
          <h4>${item.title}</h4>
          <p class="booking-meta">${formatDateTime(item.createdAt)}</p>
        </div>
      </div>
      <div class="record-details">
        <p>${item.message}</p>
      </div>
    `;
    container.append(card);
  });
}

function renderBookingList(container, bookings, emptyText) {
  container.innerHTML = "";

  if (!bookings.length) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  bookings.forEach((booking) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-head">
        <div>
          <h4>${booking.studentName} 与 ${booking.teacherName}</h4>
          <p class="booking-meta">${formatLongDate(booking.date)} · ${booking.time}</p>
        </div>
        <span class="tag">${booking.teacherSpecialty || "课程待完善"}</span>
      </div>
      <div class="record-details">
        <p><strong>身体情况：</strong>${booking.bodyNotes}</p>
        <p><strong>课程目标：</strong>${booking.goalNotes}</p>
        <p><strong>上门地址：</strong>${booking.address}</p>
        <p><strong>支付方式：</strong>${formatPaymentMethod(booking.paymentMethod)}</p>
        <p><strong>预约金：</strong>${formatCurrency(booking.depositAmount)}，支付成功后不退还</p>
        <p><strong>支付状态：</strong>${formatDepositStatus(booking.depositStatus)} · ${formatGatewayStatus(booking.paymentGatewayStatus)}</p>
      </div>
    `;
    container.append(card);
  });
}

function renderAdminBookingList(bookings) {
  adminBookingList.innerHTML = "";

  if (!bookings.length) {
    adminBookingList.innerHTML = '<div class="empty-state">暂无预约记录。</div>';
    return;
  }

  bookings.forEach((booking) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-head">
        <div>
          <h4>${booking.studentName} 与 ${booking.teacherName}</h4>
          <p class="booking-meta">${formatLongDate(booking.date)} · ${booking.time}</p>
        </div>
        <span class="tag">${formatDepositStatus(booking.depositStatus)} · ${formatGatewayStatus(booking.paymentGatewayStatus)}</span>
      </div>
      <div class="record-details">
        <p><strong>手机号：</strong>${booking.studentPhone}</p>
        <p><strong>上门地址：</strong>${booking.address}</p>
        <p><strong>预约金：</strong>${formatCurrency(booking.depositAmount)}，尾款 ${formatCurrency(booking.remainingAmount)}</p>
        <p><strong>学生备注：</strong>${booking.goalNotes}</p>
      </div>
      <div class="admin-booking-actions">
        ${
          booking.depositStatus !== "paid"
            ? `<button class="primary-button admin-confirm-button" type="button" data-booking-id="${booking.id}">确认收款并确认预约</button>`
            : '<span class="helper-text">该预约已确认成功。</span>'
        }
      </div>
    `;
    adminBookingList.append(card);
  });

  adminBookingList.querySelectorAll(".admin-confirm-button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api("/api/admin/bookings/confirm-payment", {
          method: "POST",
          body: JSON.stringify({
            bookingId: button.dataset.bookingId,
          }),
        });
        await renderBookings();
        await renderNotifications();
      } catch (error) {
        authStatus.textContent = error.message;
      }
    });
  });
}

async function renderNotifications() {
  if (!state.sessionUser) {
    return;
  }

  const payload = await api("/api/notifications", { method: "GET" });
  const items = payload.notifications;

  if (state.sessionUser.role === "student") {
    renderNotificationList(studentNotifications, items, "暂无学生通知。");
  }

  if (state.sessionUser.role === "teacher") {
    renderNotificationList(teacherNotifications, items, "预约金支付成功后会在这里收到通知。");
  }

  if (state.sessionUser.role === "admin") {
    renderNotificationList(adminNotifications, items, "暂无管理员通知。");
  }
}

async function renderBookings() {
  if (!state.sessionUser) {
    return;
  }

  if (state.sessionUser.role === "admin") {
    const overview = await api("/api/admin/overview", { method: "GET" });
    adminTeacherCount.textContent = overview.teachers.length;
    adminStudentCount.textContent = overview.students.length;
    adminBookingCount.textContent = overview.bookings.filter((booking) => booking.depositStatus === "paid").length;

    adminTeacherList.innerHTML = overview.teachers.length
      ? overview.teachers
          .map(
            (teacher) => `
        <article class="record-card">
          <div class="record-head">
            <div>
              <h4>${teacher.name}</h4>
              <p class="booking-meta">${teacher.phone}</p>
            </div>
            <span class="tag">${teacher.specialty || "资料待完善"}</span>
          </div>
          <div class="record-details">
            <p><strong>认证：</strong>${teacher.certifications || "待完善"}</p>
            <p><strong>擅长：</strong>${teacher.focus || "待完善"}</p>
            <p><strong>区域：</strong>${teacher.serviceAreas || "待完善"}</p>
            <p><strong>价格：</strong>${teacher.price}</p>
          </div>
        </article>
      `,
          )
          .join("")
      : '<div class="empty-state">暂无已注册老师。</div>';

    adminStudentList.innerHTML = overview.students.length
      ? overview.students
          .map(
            (student) => `
        <article class="record-card">
          <div class="record-head">
            <div>
              <h4>${student.name}</h4>
              <p class="booking-meta">${student.phone}</p>
            </div>
            <span class="tag">学生</span>
          </div>
          <div class="record-details">
            <p><strong>运动目标：</strong>${student.goals || "待完善"}</p>
            <p><strong>身体状况：</strong>${student.bodyCondition || "待完善"}</p>
            <p><strong>区域：</strong>${student.area || "待完善"}</p>
          </div>
        </article>
      `,
          )
          .join("")
      : '<div class="empty-state">暂无已注册学生。</div>';

    renderAdminBookingList(overview.bookings);
    return;
  }

  const payload = await api("/api/bookings", { method: "GET" });
  if (state.sessionUser.role === "student") {
    renderBookingList(studentBookingList, payload.bookings, "你还没有成功预约的课程。");
  }

  if (state.sessionUser.role === "teacher") {
    renderBookingList(teacherBookingList, payload.bookings, "还没有学生预约你的课程。");
  }
}

async function renderSchedule() {
  if (!state.sessionUser || !["teacher", "admin"].includes(state.sessionUser.role)) {
    return;
  }

  const teacherId =
    state.sessionUser.role === "teacher" ? state.sessionUser.id : teacherManagerSelect.value;

  const payload = await api(`/api/staff/schedule?teacherId=${teacherId}`, { method: "GET" });
  scheduleList.innerHTML = "";

  payload.days.forEach((day) => {
    const card = document.createElement("article");
    card.className = "schedule-entry";
    card.innerHTML = `
      <div class="schedule-head">
        <strong>${day.label}</strong>
        <span class="tag">${day.slots.length} 个时段</span>
      </div>
      <div class="slot-row">
        ${
          day.slots.length
            ? day.slots
                .map(
                  (slot) => `
          <span class="slot-chip">
            ${slot}
            <button type="button" data-date="${day.value}" data-time="${slot}" data-teacher="${teacherId}">
              删除
            </button>
          </span>
        `,
                )
                .join("")
            : '<p class="slot-empty">当天还没有开放时间。</p>'
        }
      </div>
    `;
    scheduleList.append(card);
  });

  scheduleList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(
          `/api/staff/schedule?teacherId=${button.dataset.teacher}&date=${button.dataset.date}&time=${encodeURIComponent(button.dataset.time)}`,
          { method: "DELETE" },
        );
        teacherStatus.textContent = "时段已删除。";
        await renderSchedule();
      } catch (error) {
        teacherStatus.textContent = error.message;
      }
    });
  });
}

async function handleAuth() {
  try {
    const payload =
      state.selectedRole === "admin"
        ? await api("/api/auth/admin-password", {
            method: "POST",
            body: JSON.stringify({
              username: adminUsernameInput.value.trim(),
              password: adminPasswordInput.value,
            }),
          })
        : await api("/api/auth/phone", {
            method: "POST",
            body: JSON.stringify({
              role: state.selectedRole,
              name: authNameInput.value.trim(),
              phone: authPhoneInput.value.trim(),
            }),
          });

    state.sessionUser = payload.user;
    await loadBootstrap();
    logoutButton.classList.remove("hidden");
    setAuthMessage(`${payload.user.name} 已进入${payload.user.role === "student" ? "学生" : payload.user.role === "teacher" ? "老师" : "管理员"}主页。`);
    await hydrateWorkspace();
  } catch (error) {
    setAuthMessage(error.message);
  }
}

async function handleLogout() {
  await api("/api/auth/logout", { method: "POST" });
  resetPaymentSheet();
  state.sessionUser = null;
  state.currentProfile = null;
  state.selectedSlot = null;
  logoutButton.classList.add("hidden");
  showWorkspace(null);
  setAuthMessage("已退出登录。");
}

async function handleBooking(event) {
  event.preventDefault();

  if (!state.selectedSlot) {
    bookingStatus.textContent = "请先选择一个可预约时段。";
    return;
  }

  const paymentMethod = getSelectedPaymentMethod();
  if (!paymentMethod) {
    bookingStatus.textContent = "请选择微信支付。";
    return;
  }

  try {
    const payload = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        teacherId: state.selectedSlot.teacherId,
        date: state.selectedSlot.date,
        time: state.selectedSlot.time,
        bodyNotes: bodyNotesInput.value.trim(),
        goalNotes: goalNotesInput.value.trim(),
        address: addressInput.value.trim(),
        paymentMethod,
      }),
    });
    state.pendingPaymentBookingId = payload.booking.id;
    paymentSheet.classList.remove("hidden");
    paymentGatewayMessage.textContent = "请添加客服微信完成预约金支付，然后提交人工确认。";
    bookingStatus.textContent = "预约已创建，请添加客服微信完成预约金支付。";
    await renderBookings();
    await renderNotifications();
  } catch (error) {
    bookingStatus.textContent = error.message;
  }
}

async function addScheduleSlot() {
  try {
    const teacherId =
      state.sessionUser.role === "teacher" ? state.sessionUser.id : teacherManagerSelect.value;
    await api("/api/staff/schedule", {
      method: "POST",
      body: JSON.stringify({
        teacherId,
        date: teacherDateSelect.value,
        time: teacherSlotSelect.value,
      }),
    });
    teacherStatus.textContent = "排班已更新。";
    await renderSchedule();
  } catch (error) {
    teacherStatus.textContent = error.message;
  }
}

async function hydrateWorkspace() {
  showWorkspace(state.sessionUser.role);
  const profile = await loadMyProfile();

  if (state.sessionUser.role === "student") {
    fillStudentProfile(profile);
    await renderTeacherCards();
    await renderBookings();
    await renderNotifications();
    renderSelectedSlot();
  }

  if (state.sessionUser.role === "teacher") {
    fillTeacherProfile(profile);
    populateSelect(
      teacherManagerSelect,
      state.bootstrap.teachers.map((teacher) => ({
        value: teacher.id,
        label: `${teacher.name} · ${teacher.specialty || "老师资料待完善"}`,
      })),
      null,
    );
    teacherManagerSelect.value = state.sessionUser.id;
    teacherManagerSelect.disabled = true;
    await renderSchedule();
    await renderBookings();
    await renderNotifications();
  }

  if (state.sessionUser.role === "admin") {
    teacherManagerSelect.disabled = false;
    await renderBookings();
    await renderNotifications();
  }
}

roleTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".tab-button");
  if (!button) {
    return;
  }
  setSelectedRole(button.dataset.role);
});

authSubmit.addEventListener("click", handleAuth);
logoutButton.addEventListener("click", handleLogout);
studentProfileSave.addEventListener("click", saveStudentProfile);
teacherProfileSave.addEventListener("click", saveTeacherProfile);
teacherFilter.addEventListener("change", renderTeacherCards);
dateFilter.addEventListener("change", () => {
  state.selectedSlot = null;
  renderSelectedSlot();
  renderTeacherCards();
});
courseFilter.addEventListener("change", renderTeacherCards);
bookingForm.addEventListener("submit", handleBooking);
addSlotButton.addEventListener("click", addScheduleSlot);
teacherManagerSelect.addEventListener("change", renderSchedule);
paymentRefresh.addEventListener("click", () => {
  submitManualPaymentConfirmation().catch((error) => {
    paymentGatewayMessage.textContent = error.message;
  });
});
copySupportWechat.addEventListener("click", async () => {
  const value = supportContactId.textContent.trim();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      paymentGatewayMessage.textContent = "客服微信号已复制，请前往微信添加客服。";
      return;
    }
  } catch {}
  paymentGatewayMessage.textContent = `请手动复制客服微信号：${value}`;
});

async function init() {
  setSelectedRole("student");
  await loadBootstrap();
  await loadSession();

  if (state.sessionUser) {
    if (state.sessionUser.role === "admin") {
      setSelectedRole("admin");
      adminUsernameInput.value = "sherry7sherry";
      adminPasswordInput.value = "";
    } else {
      authNameInput.value = state.sessionUser.name || "";
      authPhoneInput.value = state.sessionUser.phone || "";
    }
    logoutButton.classList.remove("hidden");
    setAuthMessage(`${state.sessionUser.name} 已登录。`);
    await hydrateWorkspace();
  } else {
    showWorkspace(null);
  }
}

init().catch((error) => {
  setAuthMessage(error.message);
});
