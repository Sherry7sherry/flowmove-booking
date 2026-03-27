const state = {
  authMode: "student",
  sessionUser: null,
  selectedSlot: null,
  bootstrap: {
    teachers: [],
    dayOptions: [],
    courseTypes: [],
    slotOptions: [],
    demoAccounts: {},
  },
};

const authTabs = document.querySelector("#auth-tabs");
const studentAuthPanel = document.querySelector("#student-auth-panel");
const staffAuthPanel = document.querySelector("#staff-auth-panel");
const studentNameInput = document.querySelector("#student-name");
const studentPhoneInput = document.querySelector("#student-phone");
const studentLoginButton = document.querySelector("#student-login-button");
const staffUsernameInput = document.querySelector("#staff-username");
const staffPasswordInput = document.querySelector("#staff-password");
const staffLoginButton = document.querySelector("#staff-login-button");
const logoutButton = document.querySelector("#logout-button");
const sessionStatus = document.querySelector("#session-status");
const demoAccounts = document.querySelector("#demo-accounts");
const teacherFilter = document.querySelector("#teacher-filter");
const dateFilter = document.querySelector("#date-filter");
const courseFilter = document.querySelector("#course-filter");
const teacherGrid = document.querySelector("#teacher-grid");
const resultsCount = document.querySelector("#results-count");
const selectedSlotView = document.querySelector("#selected-slot");
const bookingForm = document.querySelector("#booking-form");
const bodyNotesInput = document.querySelector("#body-notes");
const goalNotesInput = document.querySelector("#goal-notes");
const addressInput = document.querySelector("#address");
const paymentOptions = document.querySelector("#payment-options");
const depositSummary = document.querySelector("#deposit-summary");
const bookingStatus = document.querySelector("#booking-status");
const bookingList = document.querySelector("#booking-list");
const teacherManagerSelect = document.querySelector("#teacher-manager-select");
const teacherDateSelect = document.querySelector("#teacher-date-select");
const teacherSlotSelect = document.querySelector("#teacher-slot-select");
const addSlotButton = document.querySelector("#add-slot-button");
const scheduleList = document.querySelector("#schedule-list");
const teacherStatus = document.querySelector("#teacher-status");
const recordCaption = document.querySelector("#record-caption");

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

function setAuthMode(mode) {
  state.authMode = mode;

  authTabs.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });

  studentAuthPanel.classList.toggle("hidden", mode !== "student");
  staffAuthPanel.classList.toggle("hidden", mode !== "staff");
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

function formatLongDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${dateString}T00:00:00`));
}

function getTeacherById(teacherId) {
  return state.bootstrap.teachers.find((teacher) => teacher.id === teacherId);
}

function parsePrice(priceLabel) {
  return Number(String(priceLabel).replace(/[^\d.]/g, ""));
}

function formatCurrency(amount) {
  return `¥${Math.round(amount)}`;
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

  return "待确认";
}

function formatGatewayStatus(status) {
  if (status === "ready_for_gateway") {
    return "已生成支付单";
  }

  if (status === "gateway_not_configured" || status === "not_configured") {
    return "待接入支付网关";
  }

  return "待处理";
}

function updateSessionUI() {
  const user = state.sessionUser;

  if (!user) {
    sessionStatus.textContent = "未登录，可先浏览老师信息。";
    logoutButton.classList.add("hidden");
    teacherManagerSelect.disabled = false;
    bookingStatus.textContent = "学生登录后即可提交预约并完成 20% 定金支付。";
    teacherStatus.textContent = "老师或管理员登录后可操作。";
    recordCaption.textContent = "登录后加载对应身份的预约记录。";
    return;
  }

  logoutButton.classList.remove("hidden");

  if (user.role === "student") {
    sessionStatus.textContent = `${user.name} 已以学生身份登录，可以提交预约。`;
    bookingStatus.textContent = "请选择时段、填写信息并完成 20% 定金支付。";
    teacherStatus.textContent = "当前不是老师端账号，排班区域仅可查看。";
    teacherManagerSelect.disabled = false;
    recordCaption.textContent = "当前展示你的个人预约记录。";
    studentNameInput.value = user.name;
    studentPhoneInput.value = user.phone;
    return;
  }

  if (user.role === "teacher") {
    sessionStatus.textContent = `${user.name} 已以老师身份登录，可以维护自己的排班。`;
    bookingStatus.textContent = "老师账号不能提交学生预约。";
    teacherStatus.textContent = "你可以维护自己的未来 3 天空余时段。";
    teacherManagerSelect.value = user.id;
    teacherManagerSelect.disabled = true;
    recordCaption.textContent = "当前展示你的预约课表。";
    return;
  }

  sessionStatus.textContent = `${user.name} 已以管理员身份登录，可管理全部老师排班。`;
  bookingStatus.textContent = "管理员账号不能提交学生预约。";
  teacherStatus.textContent = "你可以切换老师并维护任意老师的排班。";
  teacherManagerSelect.disabled = false;
  recordCaption.textContent = "当前展示全量预约记录。";
}

function updateSelectedSlotView() {
  if (!state.selectedSlot) {
    selectedSlotView.textContent = "请先在右侧老师卡片中选择一个空余时间。";
    depositSummary.textContent = "请选择时段后查看本次课程定金金额。";
    return;
  }

  const teacher = getTeacherById(state.selectedSlot.teacherId);
  const total = parsePrice(teacher.price);
  const deposit = total * 0.2;
  const balance = total - deposit;
  selectedSlotView.innerHTML = `
    <div class="booking-preview">
      <strong>${teacher.name} · ${teacher.specialty}</strong>
      <p class="booking-meta">${formatLongDate(state.selectedSlot.date)} · ${state.selectedSlot.time}</p>
      <p class="booking-meta">${teacher.price} · 服务区域 ${teacher.serviceAreas}</p>
      <p class="booking-meta">定金 ${formatCurrency(deposit)}，剩余尾款 ${formatCurrency(balance)}</p>
    </div>
  `;
  depositSummary.innerHTML = `
    <strong>本次课程总价 ${formatCurrency(total)}</strong>
    <span>需先支付 20% 定金 ${formatCurrency(deposit)}，剩余 ${formatCurrency(balance)} 可在线下补齐。</span>
  `;
}

async function loadBootstrap() {
  const payload = await api("/api/bootstrap", { method: "GET" });
  state.bootstrap = payload;
  demoAccounts.textContent = `老师示例：${payload.demoAccounts.teacher}；管理员示例：${payload.demoAccounts.admin}`;

  populateSelect(
    teacherFilter,
    payload.teachers.map((teacher) => ({
      value: teacher.id,
      label: `${teacher.name} · ${teacher.specialty}`,
    })),
    "全部老师",
  );

  populateSelect(
    teacherManagerSelect,
    payload.teachers.map((teacher) => ({
      value: teacher.id,
      label: `${teacher.name} · ${teacher.specialty}`,
    })),
    null,
  );

  populateSelect(
    dateFilter,
    payload.dayOptions.map((day) => ({ value: day.value, label: day.label })),
    null,
  );

  populateSelect(
    teacherDateSelect,
    payload.dayOptions.map((day) => ({ value: day.value, label: day.label })),
    null,
  );

  populateSelect(
    courseFilter,
    payload.courseTypes.map((course) => ({ value: course, label: course })),
    "全部课程",
  );

  populateSelect(
    teacherSlotSelect,
    payload.slotOptions.map((slot) => ({ value: slot, label: slot })),
    null,
  );

  paymentOptions.querySelectorAll('input[name="payment-method"]').forEach((input) => {
    const provider = payload.paymentProviders?.[input.value];
    const container = input.closest(".payment-option");

    if (!provider) {
      return;
    }

    container.classList.toggle("is-disabled", !provider.enabled);
    const hint = container.querySelector("small");
    hint.textContent = provider.enabled
      ? `将拉起${provider.label}完成 20% 定金支付`
      : `${provider.label}网关待接入，当前先保留支付流程`;
  });
}

async function loadSession() {
  const payload = await api("/api/auth/me", { method: "GET" });
  state.sessionUser = payload.user;

  if (!state.sessionUser || state.sessionUser.role !== "teacher") {
    teacherManagerSelect.disabled = false;
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
    teacherGrid.innerHTML =
      '<div class="empty-state">没有符合当前筛选条件的老师，请调整筛选条件。</div>';
    return;
  }

  teachers.forEach((teacher, index) => {
    const card = document.createElement("article");
    card.className = "teacher-card";
    card.style.animationDelay = `${index * 70}ms`;
    const availableSlots = teacher.slots.filter((slot) => !slot.booked).length;
    const slotMarkup = teacher.slots.length
      ? teacher.slots
          .map((slot) => {
            const selected =
              state.selectedSlot &&
              state.selectedSlot.teacherId === teacher.id &&
              state.selectedSlot.date === dateFilter.value &&
              state.selectedSlot.time === slot.time;

            return `
              <button
                class="slot-button ${selected ? "selected" : ""}"
                type="button"
                data-teacher="${teacher.id}"
                data-time="${slot.time}"
                ${slot.booked ? "disabled" : ""}
              >
                ${slot.booked ? `${slot.time} · 已预约` : slot.time}
              </button>
            `;
          })
          .join("")
      : '<p class="slot-empty">该老师当天暂未开放可预约时段。</p>';

    card.innerHTML = `
      <div class="teacher-head">
        <div class="teacher-head-main">
          <strong>${teacher.name}</strong>
          <p class="teacher-meta">${teacher.specialty}</p>
        </div>
        <div class="teacher-head-side">
          <span class="tag teacher-price-tag">${teacher.price}</span>
          <span class="availability-pill">${availableSlots} 个时段</span>
        </div>
      </div>
      <div class="teacher-note-card">
        <p class="teacher-meta">${teacher.experience}</p>
        <p class="teacher-meta">${teacher.focus}</p>
      </div>
      <div class="teacher-stats">
        <span class="tag">${formatLongDate(dateFilter.value)}</span>
        <span class="tag">服务区域 ${teacher.serviceAreas}</span>
      </div>
      <div class="slot-group">
        <p class="panel-label">空余时间</p>
        <div class="slot-row">${slotMarkup}</div>
      </div>
    `;

    teacherGrid.append(card);
  });

  teacherGrid.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.sessionUser || state.sessionUser.role !== "student") {
        bookingStatus.textContent = "请先以学生身份登录，再选择预约时段。";
        return;
      }

      state.selectedSlot = {
        teacherId: button.dataset.teacher,
        date: dateFilter.value,
        time: button.dataset.time,
      };
      updateSelectedSlotView();
      renderTeacherCards();
    });
  });
}

async function renderSchedule() {
  scheduleList.innerHTML =
    '<div class="empty-state">登录老师或管理员账号后，这里会显示未来 3 天排班。</div>';

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
    const chips = day.slots.length
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
      : '<p class="slot-empty">当天还没有开放时间。</p>';

    card.innerHTML = `
      <div class="schedule-head">
        <strong>${day.label}</strong>
        <span class="tag">${day.slots.length} 个时段</span>
      </div>
      <div class="slot-row">${chips}</div>
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
        await refreshDataViews();
      } catch (error) {
        teacherStatus.textContent = error.message;
      }
    });
  });
}

async function renderBookings() {
  bookingList.innerHTML =
    '<div class="empty-state">登录后会显示与你身份对应的预约记录。</div>';

  if (!state.sessionUser) {
    return;
  }

  const payload = await api("/api/bookings", { method: "GET" });
  bookingList.innerHTML = "";

  if (!payload.bookings.length) {
    bookingList.innerHTML =
      '<div class="empty-state">当前还没有预约记录，可以先完成一单演示预约。</div>';
    return;
  }

  payload.bookings.forEach((booking) => {
    const card = document.createElement("article");
    card.className = "record-card";
      card.innerHTML = `
        <div class="record-head">
          <div>
            <h4>${booking.studentName} 已预约 ${booking.teacherName}</h4>
            <p class="booking-meta">${formatLongDate(booking.date)} · ${booking.time}</p>
        </div>
        <span class="tag">${booking.teacherSpecialty}</span>
      </div>
        <div class="record-details">
          <p><strong>身体情况：</strong>${booking.bodyNotes}</p>
          <p><strong>改善目标：</strong>${booking.goalNotes}</p>
          <p><strong>上门地址：</strong>${booking.address}</p>
          <p><strong>联系方式：</strong>${booking.studentPhone}</p>
          <p><strong>支付方式：</strong>${formatPaymentMethod(booking.paymentMethod)}</p>
          <p><strong>定金状态：</strong>${formatDepositStatus(booking.depositStatus)} ${formatCurrency(booking.depositAmount)}，尾款 ${formatCurrency(booking.remainingAmount)}</p>
          <p><strong>网关状态：</strong>${formatGatewayStatus(booking.paymentGatewayStatus)}</p>
        </div>
      `;
    bookingList.append(card);
  });
}

async function refreshDataViews() {
  await renderTeacherCards();
  await renderSchedule();
  await renderBookings();
}

async function handleStudentLogin() {
  try {
    const payload = await api("/api/auth/student", {
      method: "POST",
      body: JSON.stringify({
        name: studentNameInput.value.trim(),
        phone: studentPhoneInput.value.trim(),
      }),
    });
    state.sessionUser = payload.user;
    state.selectedSlot = null;
    updateSessionUI();
    updateSelectedSlotView();
    await refreshDataViews();
  } catch (error) {
    sessionStatus.textContent = error.message;
  }
}

async function handleStaffLogin() {
  try {
    const payload = await api("/api/auth/staff", {
      method: "POST",
      body: JSON.stringify({
        username: staffUsernameInput.value.trim(),
        password: staffPasswordInput.value,
      }),
    });
    state.sessionUser = payload.user;
    state.selectedSlot = null;
    updateSessionUI();
    updateSelectedSlotView();
    await refreshDataViews();
  } catch (error) {
    sessionStatus.textContent = error.message;
  }
}

async function handleLogout() {
  await api("/api/auth/logout", { method: "POST" });
  state.sessionUser = null;
  state.selectedSlot = null;
  teacherManagerSelect.disabled = false;
  updateSessionUI();
  updateSelectedSlotView();
  await refreshDataViews();
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!state.sessionUser || state.sessionUser.role !== "student") {
    bookingStatus.textContent = "请先以学生身份登录。";
    return;
  }

  if (!state.selectedSlot) {
    bookingStatus.textContent = "请先选择一个可预约时段。";
    return;
  }

  const paymentMethod = getSelectedPaymentMethod();
  if (!paymentMethod) {
    bookingStatus.textContent = "请选择微信支付或支付宝作为定金支付方式。";
    return;
  }

  try {
    const bookingPayload = await api("/api/bookings", {
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
    const paymentPayload = await api("/api/payments/create", {
      method: "POST",
      body: JSON.stringify({
        bookingId: bookingPayload.booking.id,
      }),
    });
    bookingForm.reset();
    studentNameInput.value = state.sessionUser.name;
    studentPhoneInput.value = state.sessionUser.phone;
    state.selectedSlot = null;
    updateSelectedSlotView();
    if (paymentPayload.payment.status === "gateway_not_configured") {
      bookingStatus.textContent = `预约已创建，需支付 ${formatCurrency(paymentPayload.payment.amount)} 定金；当前${formatPaymentMethod(paymentMethod)}网关待接入。`;
    } else {
      bookingStatus.textContent = `预约已创建，正在跳转${formatPaymentMethod(paymentMethod)}支付 ${formatCurrency(paymentPayload.payment.amount)} 定金。`;
    }
    await refreshDataViews();
  } catch (error) {
    bookingStatus.textContent = error.message;
  }
}

async function handleAddSlot() {
  if (!state.sessionUser || !["teacher", "admin"].includes(state.sessionUser.role)) {
    teacherStatus.textContent = "请先登录老师或管理员账号。";
    return;
  }

  const teacherId =
    state.sessionUser.role === "teacher" ? state.sessionUser.id : teacherManagerSelect.value;

  try {
    await api("/api/staff/schedule", {
      method: "POST",
      body: JSON.stringify({
        teacherId,
        date: teacherDateSelect.value,
        time: teacherSlotSelect.value,
      }),
    });
    teacherStatus.textContent = "空余时段已添加。";
    await refreshDataViews();
  } catch (error) {
    teacherStatus.textContent = error.message;
  }
}

authTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".tab-button");
  if (!button) {
    return;
  }
  setAuthMode(button.dataset.authMode);
});

studentLoginButton.addEventListener("click", handleStudentLogin);
staffLoginButton.addEventListener("click", handleStaffLogin);
logoutButton.addEventListener("click", handleLogout);
bookingForm.addEventListener("submit", handleBookingSubmit);
teacherFilter.addEventListener("change", async () => {
  state.selectedSlot = null;
  updateSelectedSlotView();
  await renderTeacherCards();
});
dateFilter.addEventListener("change", async () => {
  state.selectedSlot = null;
  updateSelectedSlotView();
  await renderTeacherCards();
});
courseFilter.addEventListener("change", async () => {
  state.selectedSlot = null;
  updateSelectedSlotView();
  await renderTeacherCards();
});
teacherManagerSelect.addEventListener("change", renderSchedule);
addSlotButton.addEventListener("click", handleAddSlot);

async function init() {
  setAuthMode("student");
  await loadBootstrap();
  await loadSession();
  updateSessionUI();
  updateSelectedSlotView();
  await refreshDataViews();
}

init().catch((error) => {
  sessionStatus.textContent = error.message;
});
