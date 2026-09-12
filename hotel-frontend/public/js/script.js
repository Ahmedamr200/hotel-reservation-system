// ============================================================
// AURANILE GRAND RESORT & SPA - PRODUCTION GUEST PORTAL
// Modern Hospitality Frontend Controller (script.js)
// ============================================================

// ============================================================
// 1. CONFIGURATION & ENDPOINTS
// ============================================================

const BACKEND_API = "http://localhost:3000";
const AI_API = "http://localhost:8000/api/chat";
const RESET_API = "http://localhost:8000/api/reset";

// ============================================================
// 2. AUTHENTICATION & SESSION STATE
// ============================================================

let currentAuthUser = null;

function initAuthSession() {
  const stored = localStorage.getItem("auranile_auth_user");
  if (stored) {
    try {
      currentAuthUser = JSON.parse(stored);
    } catch {
      currentAuthUser = null;
    }
  } else {
    currentAuthUser = null;
  }

  updateAuthUI();

  // If user is not logged in, prompt sign in modal after brief delay
  if (!currentAuthUser) {
    setTimeout(() => {
      openAuthModal("login");
    }, 400);
  }
}

function updateAuthUI() {
  const navUserName = document.getElementById("navUserName");
  const navUserAvatar = document.getElementById("navUserAvatar");
  const userProfileArea = document.getElementById("userProfileArea");
  const authButtonsArea = document.getElementById("authButtonsArea");

  const chatGuestName = document.getElementById("chatGuestName");
  const chatGuestEmail = document.getElementById("chatGuestEmail");
  const chatGuestDiscount = document.getElementById("chatGuestDiscount");

  const complaintName = document.getElementById("complaintName");
  const complaintContact = document.getElementById("complaintContact");

  if (currentAuthUser && currentAuthUser.name) {
    if (navUserName) navUserName.textContent = currentAuthUser.name;
    if (navUserAvatar) navUserAvatar.textContent = currentAuthUser.name.charAt(0).toUpperCase();

    if (userProfileArea) userProfileArea.classList.remove("hidden");
    if (authButtonsArea) authButtonsArea.classList.add("hidden");

    if (chatGuestName) chatGuestName.textContent = currentAuthUser.name;
    if (chatGuestEmail) chatGuestEmail.textContent = currentAuthUser.email;
    if (chatGuestDiscount) {
      chatGuestDiscount.textContent = currentAuthUser.hasCompensationDiscount
        ? "Active (10% Off Next Stay)"
        : "None (Standard Rate)";
      chatGuestDiscount.className = currentAuthUser.hasCompensationDiscount ? "gold-text" : "";
    }

    if (complaintName && !complaintName.value) complaintName.value = currentAuthUser.name;
    if (complaintContact && !complaintContact.value) complaintContact.value = currentAuthUser.email || currentAuthUser.phone;
  } else {
    if (userProfileArea) userProfileArea.classList.add("hidden");
    if (authButtonsArea) authButtonsArea.classList.remove("hidden");
    if (chatGuestName) chatGuestName.textContent = "Guest User";
    if (chatGuestEmail) chatGuestEmail.textContent = "guest@auranile.com";
    if (chatGuestDiscount) chatGuestDiscount.textContent = "None (Standard Rate)";
  }
}

// ============================================================
// 3. GLOBAL STATE & IMAGERY
// ============================================================

let allRooms = [];
let filteredRooms = [];
let allBookings = [];
let allComplaints = [];
let selectedRoom = null;
let currentActiveSection = "dashboard";
let currentRoomTypeFilter = "ALL";
let currentFloorFilter = "ALL";
let currentBookingFilter = "ALL";

// Global search context dates
let searchCheckInDate = "";
let searchCheckOutDate = "";

// High-Definition Room Images
const ROOM_IMAGES = {
  Single: [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80",
  ],
  Double: [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80",
  ],
  Twin: [
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1540518614846-7ede433c4ef2?auto=format&fit=crop&w=800&q=80",
  ],
  Suite: [
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
  ],
  Family: [
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80",
  ],
};

function getRoomImage(roomType, roomNumber) {
  const list = ROOM_IMAGES[roomType] || ROOM_IMAGES["Double"];
  const num = parseInt(roomNumber, 10) || 0;
  return list[num % list.length];
}

function getRoomAmenities(roomType) {
  const base = [
    { icon: "wifi", text: "High-Speed Wi-Fi" },
    { icon: "wind", text: "Climate Control" },
    { icon: "coffee", text: "Gourmet Breakfast" }
  ];
  if (roomType === "Suite") {
    return [
      ...base,
      { icon: "star", text: "Nile Panorama" },
      { icon: "shield-check", text: "Jacuzzi Bath" }
    ];
  }
  if (roomType === "Family") {
    return [
      ...base,
      { icon: "star", text: "Kids Lounge" },
      { icon: "shield-check", text: "65\" Smart TV" }
    ];
  }
  if (roomType === "Double") {
    return [
      ...base,
      { icon: "star", text: "Private Balcony" }
    ];
  }
  return base;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// 4. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌟 AuraNile Grand Resort & Spa Initialized.");
  initAuthSession();
  setupNavigation();
  setupAuthModal();
  setupPasswordToggles();
  setupSearchCapsule();
  setupRoomFilters();
  setupBookingModal();
  setupBookingStatusTabs();
  setupComplaintsForm();
  setupChat();

  // Load initial rooms
  await loadRooms();

  // Load customer data if logged in
  if (currentAuthUser && currentAuthUser.id) {
    await Promise.all([loadBookings(), loadComplaints()]);
  }

  updateAllStats();
});

// ============================================================
// 5. NAVIGATION CONTROLLER
// ============================================================

function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-item, [data-section]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      if (target) {
        showSection(target);
      }
    });
  });
}

function showSection(sectionId) {
  currentActiveSection = sectionId;

  document.querySelectorAll(".page-section").forEach((sec) => {
    sec.classList.remove("active-section");
  });

  const activeSec = document.getElementById(sectionId);
  if (activeSec) {
    activeSec.classList.add("active-section");
  }

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.section === sectionId) {
      btn.classList.add("active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 6. SEARCH CAPSULE (AIRBNB / BOOKING STYLE)
// ============================================================

function setupSearchCapsule() {
  const inInput = document.getElementById("searchCheckIn");
  const outInput = document.getElementById("searchCheckOut");
  const typeSelect = document.getElementById("searchRoomType");

  const today = new Date();
  const nextStay = new Date();
  nextStay.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split("T")[0];
  const nextStayStr = nextStay.toISOString().split("T")[0];

  if (inInput) {
    inInput.min = todayStr;
    inInput.value = todayStr;
    searchCheckInDate = todayStr;
    inInput.addEventListener("change", (e) => {
      searchCheckInDate = e.target.value;
      if (outInput) outInput.min = searchCheckInDate;
    });
  }

  if (outInput) {
    outInput.min = todayStr;
    outInput.value = nextStayStr;
    searchCheckOutDate = nextStayStr;
    outInput.addEventListener("change", (e) => {
      searchCheckOutDate = e.target.value;
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      currentRoomTypeFilter = e.target.value;
      // sync with pill filters
      const pills = document.querySelectorAll("#roomTypeFilters .filter-pill");
      pills.forEach((p) => {
        if (p.dataset.type === e.target.value) {
          p.classList.add("active");
        } else {
          p.classList.remove("active");
        }
      });
      applyRoomFilters();
    });
  }
}

function applyGlobalSearch() {
  const inInput = document.getElementById("searchCheckIn");
  const outInput = document.getElementById("searchCheckOut");
  const typeSelect = document.getElementById("searchRoomType");

  if (inInput && inInput.value) searchCheckInDate = inInput.value;
  if (outInput && outInput.value) searchCheckOutDate = outInput.value;
  if (typeSelect) currentRoomTypeFilter = typeSelect.value;

  applyRoomFilters();
  showSection("rooms");
  showToast(`Showing verified suites for selected dates (${searchCheckInDate} to ${searchCheckOutDate})`, "info");
}

// ============================================================
// 7. PASSWORD SHOW / HIDE TOGGLES
// ============================================================

function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll(".btn-toggle-pwd");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      const isPassword = targetInput.type === "password";
      targetInput.type = isPassword ? "text" : "password";

      const svgUse = btn.querySelector("use");
      if (svgUse) {
        svgUse.setAttribute("href", isPassword ? "#icon-eye-off" : "#icon-eye");
      }
    });
  });
}

// ============================================================
// 8. AUTHENTICATION MODAL (MANDATORY PASSWORD ENFORCED)
// ============================================================

function setupAuthModal() {
  const authModal = document.getElementById("authModal");
  const closeAuthModal = document.getElementById("closeAuthModal");
  const navLoginBtn = document.getElementById("navLoginBtn");
  const navRegisterBtn = document.getElementById("navRegisterBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (navLoginBtn) {
    navLoginBtn.addEventListener("click", () => openAuthModal("login"));
  }
  if (navRegisterBtn) {
    navRegisterBtn.addEventListener("click", () => openAuthModal("register"));
  }
  if (closeAuthModal) {
    closeAuthModal.addEventListener("click", () => authModal.classList.add("hidden"));
  }
  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) authModal.classList.add("hidden");
    });
  }

  // Tab switching
  if (tabLoginBtn && tabRegisterBtn) {
    tabLoginBtn.addEventListener("click", () => {
      tabLoginBtn.classList.add("active");
      tabRegisterBtn.classList.remove("active");
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      document.getElementById("authModalTitle").textContent = "Sign In to Your Account";
    });

    tabRegisterBtn.addEventListener("click", () => {
      tabRegisterBtn.classList.add("active");
      tabLoginBtn.classList.remove("active");
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      document.getElementById("authModalTitle").textContent = "Create Guest Account";
    });
  }

  // Mandatory Password Login Submit
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const submitBtn = document.getElementById("loginSubmitBtn");

      if (!email || !password) {
        showToast("Please enter both email and password / يرجى إدخال البريد الإلكتروني وكلمة المرور", "warning");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Verifying credentials...</span>`;

      try {
        const res = await fetch(`${BACKEND_API}/customers/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok || data.statusCode >= 400) {
          throw new Error(data.message || "Invalid credentials / البريد الإلكتروني أو كلمة المرور غير صحيحة");
        }

        currentAuthUser = data;
        localStorage.setItem("auranile_auth_user", JSON.stringify(currentAuthUser));
        updateAuthUI();

        authModal.classList.add("hidden");
        showToast(`Welcome back, ${currentAuthUser.name}!`, "success");

        // Load customer data
        await Promise.all([loadBookings(), loadComplaints()]);
      } catch (err) {
        showToast(`${err.message}`, "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg class="btn-icon-svg"><use href="#icon-lock"/></svg>
          <span>Sign In to Portal</span>
        `;
      }
    });
  }

  // Mandatory Password Register Submit
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const phone = document.getElementById("regPhone").value.trim();
      const password = document.getElementById("regPassword").value;
      const passwordConfirm = document.getElementById("regPasswordConfirm").value;
      const submitBtn = document.getElementById("registerSubmitBtn");

      if (!name || !email || !phone || !password || !passwordConfirm) {
        showToast("Please fill in all required fields / يرجى إكمال جميع الحقول المطلوبة", "warning");
        return;
      }

      if (password !== passwordConfirm) {
        showToast("Passwords do not match / كلمتا المرور غير متطابقتين", "danger");
        return;
      }

      if (password.length < 4) {
        showToast("Password must be at least 4 characters / كلمة المرور يجب أن لا تقل عن 4 خانات", "warning");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Creating Account...</span>`;

      try {
        const createRes = await fetch(`${BACKEND_API}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password }),
        });

        const data = await createRes.json();

        if (!createRes.ok || data.statusCode >= 400) {
          throw new Error(data.message || "Registration failed / فشل إنشاء الحساب");
        }

        currentAuthUser = data;
        localStorage.setItem("auranile_auth_user", JSON.stringify(currentAuthUser));
        updateAuthUI();

        authModal.classList.add("hidden");
        showToast(`Account created successfully! Welcome, ${data.name}.`, "success");

        await Promise.all([loadBookings(), loadComplaints()]);
      } catch (err) {
        showToast(`${err.message}`, "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg class="btn-icon-svg"><use href="#icon-lock"/></svg>
          <span>Create Account & Sign In</span>
        `;
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to sign out? (هل ترغب في تسجيل الخروج؟)")) {
        localStorage.removeItem("auranile_auth_user");
        currentAuthUser = null;
        updateAuthUI();

        allBookings = [];
        allComplaints = [];
        renderBookings([]);
        renderComplaints([]);
        updateAllStats();

        resetConversation();
        showSection("dashboard");
        showToast("Signed out successfully.", "info");

        setTimeout(() => {
          openAuthModal("login");
        }, 300);
      }
    });
  }
}

function openAuthModal(mode = "login") {
  const authModal = document.getElementById("authModal");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const title = document.getElementById("authModalTitle");

  if (mode === "login") {
    tabLoginBtn.classList.add("active");
    tabRegisterBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    if (title) title.textContent = "Sign In to Your Account";
  } else {
    tabRegisterBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    if (title) title.textContent = "Create Guest Account";
  }

  authModal.classList.remove("hidden");
}

// ============================================================
// 9. ROOMS INVENTORY & FILTERS (AIRBNB / BOOKING GRADE)
// ============================================================

async function loadRooms() {
  const container = document.getElementById("roomsContainer");

  try {
    const res = await fetch(`${BACKEND_API}/rooms`);
    if (!res.ok) throw new Error("Could not connect to backend");

    allRooms = await res.json();
    filteredRooms = [...allRooms];
    renderRooms(filteredRooms);
    updateAllStats();
  } catch (err) {
    console.error("Rooms fetch error:", err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon-wrap">
            <svg class="empty-svg"><use href="#icon-info"/></svg>
          </div>
          <h4>Unable to Load Inventory</h4>
          <p>Could not connect to backend server at http://localhost:3000. Please ensure the server is active.</p>
        </div>
      `;
    }
  }
}

function setupRoomFilters() {
  const chips = document.querySelectorAll("#roomTypeFilters .filter-pill");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => {
        c.classList.remove("active");
        c.setAttribute("aria-selected", "false");
      });
      chip.classList.add("active");
      chip.setAttribute("aria-selected", "true");
      currentRoomTypeFilter = chip.dataset.type;

      // Sync select
      const typeSelect = document.getElementById("searchRoomType");
      if (typeSelect) typeSelect.value = currentRoomTypeFilter;

      applyRoomFilters();
    });
  });

  const floorSelect = document.getElementById("floorFilter");
  if (floorSelect) {
    floorSelect.addEventListener("change", (e) => {
      currentFloorFilter = e.target.value;
      applyRoomFilters();
    });
  }
}

function applyRoomFilters() {
  filteredRooms = allRooms.filter((room) => {
    const matchesType =
      currentRoomTypeFilter === "ALL" ||
      (room.roomType && room.roomType.toLowerCase() === currentRoomTypeFilter.toLowerCase());

    const matchesFloor =
      currentFloorFilter === "ALL" ||
      String(room.floor) === String(currentFloorFilter);

    return matchesType && matchesFloor;
  });

  renderRooms(filteredRooms);
}

function renderRooms(rooms) {
  const container = document.getElementById("roomsContainer");
  if (!container) return;

  if (!rooms || rooms.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-icon-wrap">
          <svg class="empty-svg"><use href="#icon-bed"/></svg>
        </div>
        <h4>No Suites Match Your Filters</h4>
        <p>Try adjusting your room type selection or floor level filter to see available inventory.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  rooms.forEach((room) => {
    const card = document.createElement("div");
    card.className = "luxury-room-card";

    const image = getRoomImage(room.roomType, room.roomNumber);
    const amenities = getRoomAmenities(room.roomType);
    const reviewScore = (9.5 + (parseInt(room.roomNumber, 10) % 5) * 0.1).toFixed(1);
    const reviewCount = 120 + (parseInt(room.roomNumber, 10) % 80);

    card.innerHTML = `
      <div class="room-card-media">
        <img src="${image}" alt="${escapeHTML(room.roomType)} Suite #${escapeHTML(room.roomNumber)}" loading="lazy">
        <div class="room-badge-stack">
          <span class="room-badge avail">Verified Live</span>
          <span class="room-badge floor">Floor ${room.floor || 1}</span>
        </div>
        <button class="btn-wishlist" title="Save to favorites" aria-label="Save to favorites">
          <svg class="heart-svg"><use href="#icon-heart"/></svg>
        </button>
      </div>

      <div class="room-card-details">
        <div class="room-card-top">
          <div>
            <h3>${escapeHTML(room.roomType)} Suite #${escapeHTML(room.roomNumber)}</h3>
          </div>
          <div class="room-review-pill">
            <svg style="width: 12px; height: 12px; color: var(--gold-accent);"><use href="#icon-star"/></svg>
            <span>${reviewScore}</span>
          </div>
        </div>

        <div class="room-capacity-text">
          <svg style="width: 14px; height: 14px; color: var(--text-muted);"><use href="#icon-user"/></svg>
          <span>Accommodates up to ${room.capacity || 2} Guests • ${reviewCount} Reviews</span>
        </div>

        <div class="room-amenity-tags">
          ${amenities.map((a) => `
            <span class="room-amenity-tag">
              <svg class="amenity-svg"><use href="#icon-${a.icon}"/></svg>
              <span>${a.text}</span>
            </span>
          `).join("")}
        </div>

        <div class="room-card-footer">
          <div class="room-pricing-area">
            <span class="rate-label">Guaranteed Nightly Rate</span>
            <div class="rate-price">
              $${Number(room.pricePerNight).toFixed(0)} <span>/ night</span>
            </div>
          </div>

          <div class="room-action-buttons">
            <button class="btn-ask-ai-room" title="Ask AI about this room">
              <svg style="width: 13px; height: 13px;"><use href="#icon-sparkles"/></svg>
              <span>Ask AI</span>
            </button>
            <button class="btn-book-room">Reserve</button>
          </div>
        </div>
      </div>
    `;

    // Book button
    const bookBtn = card.querySelector(".btn-book-room");
    bookBtn.addEventListener("click", () => openBookingModal(room));

    // Ask AI button
    const inquireBtn = card.querySelector(".btn-ask-ai-room");
    inquireBtn.addEventListener("click", () => {
      showSection("assistant");
      const d1 = searchCheckInDate || "2026-09-15";
      const d2 = searchCheckOutDate || "2026-09-18";
      const msg = `What is the total price and details for ${room.roomType} Suite ${room.roomNumber} from ${d1} to ${d2}?`;
      sendMessage(msg);
    });

    // Wishlist button toggle
    const wishBtn = card.querySelector(".btn-wishlist");
    wishBtn.addEventListener("click", () => {
      wishBtn.classList.toggle("saved");
      showToast(`Saved Suite #${room.roomNumber} to your wishlist`, "info");
    });

    container.appendChild(card);
  });
}

// ============================================================
// 10. MULTI-STEP BOOKING WORKFLOW
// ============================================================

function setupBookingModal() {
  const modal = document.getElementById("bookingModal");
  const closeBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelModal");
  const form = document.getElementById("bookingForm");

  if (closeBtn) closeBtn.addEventListener("click", closeBookingModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeBookingModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBookingModal();
    });
  }

  // Live recalculation on date change
  const inInput = document.getElementById("bookingCheckIn");
  const outInput = document.getElementById("bookingCheckOut");

  if (inInput && outInput) {
    inInput.addEventListener("change", updateBookingPriceSummary);
    outInput.addEventListener("change", updateBookingPriceSummary);
  }

  if (form) {
    form.addEventListener("submit", handleBookingSubmit);
  }
}

function openBookingModal(room) {
  if (!currentAuthUser) {
    showToast("Please sign in or register before completing your reservation.", "warning");
    openAuthModal("login");
    return;
  }

  selectedRoom = room;

  const idInput = document.getElementById("selectedRoomId");
  const numInput = document.getElementById("selectedRoomNumber");
  const preview = document.getElementById("selectedRoomPreview");

  if (idInput) idInput.value = room.id;
  if (numInput) numInput.value = room.roomNumber;

  // Use global search dates or default
  const today = new Date();
  const nextStay = new Date();
  nextStay.setDate(today.getDate() + 3);

  const inInput = document.getElementById("bookingCheckIn");
  const outInput = document.getElementById("bookingCheckOut");

  if (inInput) inInput.value = searchCheckInDate || today.toISOString().split("T")[0];
  if (outInput) outInput.value = searchCheckOutDate || nextStay.toISOString().split("T")[0];

  // Pre-fill user data
  const custName = document.getElementById("customerName");
  const custEmail = document.getElementById("customerEmail");
  const custPhone = document.getElementById("customerPhone");

  if (custName && currentAuthUser) custName.value = currentAuthUser.name;
  if (custEmail && currentAuthUser) custEmail.value = currentAuthUser.email;
  if (custPhone && currentAuthUser) custPhone.value = currentAuthUser.phone;

  if (preview) {
    preview.innerHTML = `
      <img src="${getRoomImage(room.roomType, room.roomNumber)}" alt="${room.roomType}">
      <div>
        <strong style="font-size: 15px; color: var(--navy-dark);">${escapeHTML(room.roomType)} Suite #${escapeHTML(room.roomNumber)}</strong>
        <p style="font-size: 12.5px; color: var(--text-muted); margin: 2px 0;">Floor ${room.floor || 1} • Max ${room.capacity || 2} Guests</p>
        <strong style="color: var(--navy-primary); font-size: 15px;">$${Number(room.pricePerNight).toFixed(0)} <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;">/ night</span></strong>
      </div>
    `;
  }

  updateBookingPriceSummary();

  const modal = document.getElementById("bookingModal");
  if (modal) modal.classList.remove("hidden");
}

function updateBookingPriceSummary() {
  if (!selectedRoom) return;

  const inVal = document.getElementById("bookingCheckIn").value;
  const outVal = document.getElementById("bookingCheckOut").value;

  const baseRateEl = document.getElementById("summaryBaseRate");
  const nightsEl = document.getElementById("summaryNights");
  const discountRow = document.getElementById("summaryDiscountRow");
  const finalTotalEl = document.getElementById("summaryFinalTotal");

  const basePrice = Number(selectedRoom.pricePerNight) || 100;
  if (baseRateEl) baseRateEl.textContent = `$${basePrice.toFixed(0)} / night`;

  if (!inVal || !outVal) return;

  const inDate = new Date(inVal);
  const outDate = new Date(outVal);
  let nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
  if (nights < 1) nights = 1;

  if (nightsEl) nightsEl.textContent = `${nights} ${nights === 1 ? "night" : "nights"}`;

  let total = basePrice * nights;

  // Check compensation discount
  if (currentAuthUser && currentAuthUser.hasCompensationDiscount) {
    if (discountRow) discountRow.classList.remove("hidden");
    total = total * 0.9;
  } else {
    if (discountRow) discountRow.classList.add("hidden");
  }

  if (finalTotalEl) finalTotalEl.textContent = `$${total.toFixed(0)}`;
}

function closeBookingModal() {
  const modal = document.getElementById("bookingModal");
  if (modal) modal.classList.add("hidden");
  selectedRoom = null;
}

async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!selectedRoom) {
    showToast("Please select a room first.", "warning");
    return;
  }

  const name = document.getElementById("customerName").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const checkIn = document.getElementById("bookingCheckIn").value;
  const checkOut = document.getElementById("bookingCheckOut").value;

  if (!name || !email || !phone || !checkIn || !checkOut) {
    showToast("Please fill in all required fields.", "warning");
    return;
  }

  const submitBtn = document.getElementById("confirmBookingSubmitBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Securing reservation...</span>`;
  }

  try {
    let customerId = currentAuthUser?.id;

    if (!customerId) {
      throw new Error("Please log in to complete your reservation.");
    }

    // Create Reservation
    const resRes = await fetch(`${BACKEND_API}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: selectedRoom.id,
        customerId: customerId,
        checkIn: checkIn,
        checkOut: checkOut,
      }),
    });

    const resData = await resRes.json();

    if (!resRes.ok || resData.statusCode >= 400) {
      throw new Error(resData.message || "Failed to confirm reservation.");
    }

    const confirmedRoomNum = selectedRoom.roomNumber;
    closeBookingModal();
    showToast(`Reservation confirmed for Suite #${confirmedRoomNum}! (REF: ${resData.id.slice(0, 8)})`, "success");

    // Reload customer bookings and navigate
    await loadBookings();
    showSection("bookings");
  } catch (err) {
    console.error("Booking error:", err);
    showToast(`${err.message}`, "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg class="btn-icon-svg"><use href="#icon-lock"/></svg>
        <span>Confirm & Guarantee Reservation</span>
      `;
    }
  }
}

// ============================================================
// 11. MY BOOKINGS (STAYS & ITINERARY)
// ============================================================

async function loadBookings() {
  const container = document.getElementById("bookingsContainer");

  try {
    let url = `${BACKEND_API}/reservations`;
    if (currentAuthUser && currentAuthUser.id) {
      url += `?customerId=${encodeURIComponent(currentAuthUser.id)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not fetch reservations");

    const data = await res.json();

    if (currentAuthUser && currentAuthUser.id) {
      allBookings = data.filter((b) => b.customerId === currentAuthUser.id || (b.customer && b.customer.email === currentAuthUser.email));
    } else {
      allBookings = [];
    }

    filterAndRenderBookings();
    updateAllStats();
  } catch (err) {
    console.error("Error loading bookings:", err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon-wrap">
            <svg class="empty-svg"><use href="#icon-info"/></svg>
          </div>
          <h4>Could Not Load Bookings</h4>
          <p>Please verify that the backend is running at http://localhost:3000</p>
        </div>
      `;
    }
  }
}

function setupBookingStatusTabs() {
  const tabs = document.querySelectorAll("#bookingStatusTabs .b-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentBookingFilter = tab.dataset.filter;
      filterAndRenderBookings();
    });
  });
}

function filterAndRenderBookings() {
  let filtered = allBookings;
  if (currentBookingFilter !== "ALL") {
    filtered = allBookings.filter(
      (b) => (b.status || "confirmed").toLowerCase() === currentBookingFilter.toLowerCase()
    );
  }
  renderBookings(filtered);
}

function renderBookings(bookings) {
  const container = document.getElementById("bookingsContainer");
  if (!container) return;

  const countAll = document.getElementById("countAllBookings");
  const countConf = document.getElementById("countConfirmedBookings");
  const countCanc = document.getElementById("countCancelledBookings");

  if (countAll) countAll.textContent = allBookings.length;
  if (countConf) countConf.textContent = allBookings.filter((b) => (b.status || "confirmed").toLowerCase() === "confirmed").length;
  if (countCanc) countCanc.textContent = allBookings.filter((b) => (b.status || "").toLowerCase() === "cancelled").length;

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-icon-wrap">
          <svg class="empty-svg"><use href="#icon-calendar"/></svg>
        </div>
        <h4>No Reservations on Record</h4>
        <p>You haven't booked any stays yet. Explore our verified rooms and plan your luxury Nile getaway today.</p>
        <button class="btn-gold" data-section="rooms" style="margin: 0 auto;">
          <svg class="btn-icon-svg"><use href="#icon-bed"/></svg>
          <span>Browse Available Rooms</span>
        </button>
      </div>
    `;
    const bookBtn = container.querySelector("[data-section='rooms']");
    if (bookBtn) bookBtn.addEventListener("click", () => showSection("rooms"));
    return;
  }

  container.innerHTML = "";

  const sorted = [...bookings].reverse();

  sorted.forEach((booking) => {
    const card = document.createElement("div");
    const isCancelled = (booking.status || "").toLowerCase() === "cancelled";
    card.className = `booking-luxury-card ${isCancelled ? "cancelled" : "confirmed"}`;

    const roomType = booking.room?.roomType || "Double";
    const roomNumber = booking.room?.roomNumber || "101";
    const image = getRoomImage(roomType, roomNumber);

    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const diffTime = Math.abs(checkOutDate - checkInDate);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const pricePerNight = booking.room?.pricePerNight || 120;
    const totalPrice = nights * pricePerNight;

    card.innerHTML = `
      <div class="booking-thumb-box">
        <img src="${image}" alt="${roomType}">
      </div>

      <div class="booking-content-col">
        <div class="booking-head-row">
          <span class="booking-ref-badge">REF #${escapeHTML(booking.id.slice(0, 8))}</span>
          <span class="status-pill ${isCancelled ? "cancelled" : "confirmed"}">
            <svg style="width: 12px; height: 12px;"><use href="#icon-${isCancelled ? "x" : "check"}"/></svg>
            <span>${isCancelled ? "Cancelled" : "Confirmed"}</span>
          </span>
        </div>

        <h4 class="booking-title">${escapeHTML(roomType)} Suite #${escapeHTML(roomNumber)}</h4>

        <div class="booking-meta-grid">
          <div class="booking-meta-item">
            <svg style="width: 14px; height: 14px; color: var(--navy-primary);"><use href="#icon-calendar"/></svg>
            <strong>${escapeHTML(booking.checkIn)} ➜ ${escapeHTML(booking.checkOut)} (${nights} ${nights === 1 ? "night" : "nights"})</strong>
          </div>
          <div class="booking-meta-item">
            <svg style="width: 14px; height: 14px; color: var(--text-light);"><use href="#icon-user"/></svg>
            <span>${escapeHTML(booking.customer?.name || currentAuthUser?.name || "Guest")}</span>
          </div>
        </div>
      </div>

      <div class="booking-end-col">
        <div>
          <small style="color: var(--text-muted); display: block;">Total Stay Rate</small>
          <strong class="booking-total-price-tag">$${totalPrice}</strong>
        </div>

        ${
          !isCancelled
            ? `<button class="btn-cancel-reservation" data-id="${booking.id}">
                Cancel Reservation
               </button>`
            : `<span style="font-size: 12px; color: var(--danger); font-weight: 700;">Cancelled on Record</span>`
        }
      </div>
    `;

    const cancelBtn = card.querySelector(".btn-cancel-reservation");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => cancelBooking(booking.id));
    }

    container.appendChild(card);
  });
}

async function cancelBooking(reservationId) {
  if (!confirm("Are you sure you want to cancel this reservation? (هل ترغب في إلغاء هذا الحجز؟)")) {
    return;
  }

  try {
    const res = await fetch(`${BACKEND_API}/reservations/${reservationId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Cancellation failed");
    }

    showToast("Reservation cancelled successfully.", "warning");

    const found = allBookings.find((b) => b.id === reservationId);
    if (found) {
      found.status = "cancelled";
    }

    filterAndRenderBookings();
    updateAllStats();
  } catch (err) {
    console.error("Cancel failed:", err);
    showToast(`${err.message}`, "danger");
  }
}

// ============================================================
// 12. GUEST SUPPORT & LIVE RESOLUTION TRACKER
// ============================================================

const STAGES = [
  { id: 1, key: "Under Review", label: "Under Review", ar: "قيد المراجعة", pct: 25 },
  { id: 2, key: "In Progress", label: "In Progress", ar: "جاري المعالجة", pct: 50 },
  { id: 3, key: "Waiting for Customer", label: "Waiting for Customer", ar: "بانتظار العميل", pct: 75 },
  { id: 4, key: "Resolved", label: "Resolved & Compensated", ar: "تم الحل والتعويض", pct: 100 },
];

function setupComplaintsForm() {
  const form = document.getElementById("complaintForm");
  const chips = document.querySelectorAll("#complaintCategoryChips .cat-chip");
  const catInput = document.getElementById("complaintCategory");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      if (catInput) catInput.value = chip.dataset.cat;
    });
  });

  if (form) {
    form.addEventListener("submit", handleComplaintSubmit);
  }
}

async function loadComplaints() {
  const container = document.getElementById("complaintsContainer");

  try {
    let url = `${BACKEND_API}/complaints`;
    if (currentAuthUser && currentAuthUser.id) {
      url += `?customerId=${encodeURIComponent(currentAuthUser.id)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch complaints");

    const data = await res.json();
    if (currentAuthUser && currentAuthUser.id) {
      allComplaints = data.filter((c) => c.customerId === currentAuthUser.id || (c.customer && c.customer.email === currentAuthUser.email));
    } else {
      allComplaints = [];
    }

    renderComplaints(allComplaints);
    updateAllStats();
  } catch (err) {
    console.error("Error loading complaints:", err);
  }
}

async function handleComplaintSubmit(e) {
  e.preventDefault();

  if (!currentAuthUser || !currentAuthUser.id) {
    showToast("Please sign in or create an account to file feedback.", "warning");
    openAuthModal("login");
    return;
  }

  const name = document.getElementById("complaintName").value.trim();
  const contact = document.getElementById("complaintContact").value.trim();
  const reservationId = document.getElementById("complaintReservationId").value.trim();
  const category = document.getElementById("complaintCategory").value;
  const description = document.getElementById("complaintDescription").value.trim();

  if (!name || !contact || !description) {
    showToast("Please provide your name, contact info, and description.", "warning");
    return;
  }

  const btn = document.getElementById("submitComplaintBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Submitting feedback...</span>`;
  }

  try {
    const payload = {
      customerId: currentAuthUser.id,
      category: category,
      description: description,
    };
    if (reservationId) payload.reservationId = reservationId;

    const compRes = await fetch(`${BACKEND_API}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const compData = await compRes.json();

    if (!compRes.ok || compData.statusCode >= 400) {
      throw new Error(compData.message || "Could not submit complaint.");
    }

    currentAuthUser.hasCompensationDiscount = true;
    localStorage.setItem("auranile_auth_user", JSON.stringify(currentAuthUser));
    updateAuthUI();

    showToast("Feedback recorded! 10% Compensation Discount activated for your account.", "success");

    allComplaints.unshift({
      ...compData,
      status: compData.status || "Under Review",
      customer: { name, phone: contact },
    });

    renderComplaints(allComplaints);
    updateAllStats();

    document.getElementById("complaintDescription").value = "";
    document.getElementById("complaintReservationId").value = "";
  } catch (err) {
    console.error("Complaint error:", err);
    showToast(`${err.message}`, "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="btn-icon-svg"><use href="#icon-shield-check"/></svg>
        <span>Submit Feedback & Activate 10% Discount</span>
      `;
    }
  }
}

function renderComplaints(complaints) {
  const container = document.getElementById("complaintsContainer");
  const counter = document.getElementById("complaintsCounterText");
  if (!container) return;

  if (counter) counter.textContent = `${complaints ? complaints.length : 0} Recorded`;

  if (!complaints || complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-icon-wrap">
          <svg class="empty-svg"><use href="#icon-shield-check"/></svg>
        </div>
        <h4>No Feedback on Record</h4>
        <p>Any inquiry or service concern submitted through this form will appear here with a live horizontal progress tracker.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  const categoryLabels = {
    room: "Cleanliness & Housekeeping",
    service: "Front Desk & Service",
    food: "Dining & Room Service",
    maintenance: "Room Facilities & AC",
    billing: "Billing & Invoicing",
    noise: "Comfort & Environment",
  };

  complaints.forEach((comp) => {
    const card = document.createElement("div");
    card.className = "stage-tracker-card";

    const currentStatus = comp.status || "Under Review";
    let activeIndex = STAGES.findIndex((s) => s.key.toLowerCase() === currentStatus.toLowerCase());
    if (activeIndex === -1) activeIndex = 0;

    const currentStageObj = STAGES[activeIndex];
    const progressWidth = currentStageObj.pct;

    const dateStr = comp.createdAt
      ? new Date(comp.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Today";

    card.innerHTML = `
      <div class="tracker-card-head">
        <span class="tracker-category">${categoryLabels[comp.category] || comp.category || "General Feedback"}</span>
        <span class="tracker-date">${dateStr}</span>
      </div>

      <p class="tracker-desc">${escapeHTML(comp.description)}</p>

      <div class="stepper-progress-wrapper">
        <div class="stepper-header-info">
          <span class="current-stage-title">Status: ${currentStageObj.label} (${currentStageObj.ar})</span>
          <span class="percentage-badge">${progressWidth}% Complete</span>
        </div>

        <div class="stepper-horizontal-track">
          <div class="stepper-progress-fill" style="width: ${progressWidth}%;"></div>

          ${STAGES.map((s, idx) => {
            let stateClass = "";
            let iconOrNum = idx + 1;
            if (idx < activeIndex) {
              stateClass = "completed";
              iconOrNum = "✓";
            } else if (idx === activeIndex) {
              stateClass = "active";
            }

            return `
              <div class="step-node ${stateClass}">
                <div class="node-circle">${iconOrNum}</div>
                <span class="node-label">${s.label}</span>
              </div>
            `;
          }).join("")}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
          <small style="color: var(--text-muted); font-size: 11.5px;">Ref ID: #${escapeHTML(comp.id.slice(0, 8))}</small>
          <button class="btn-advance-stage" data-id="${comp.id}" style="background: transparent; border: 1px solid var(--border-color); font-size: 11.5px; padding: 3px 10px; border-radius: var(--radius-xs); color: var(--navy-primary); font-weight: 600;">
            Advance Resolution Stage
          </button>
        </div>
      </div>
    `;

    const advanceBtn = card.querySelector(".btn-advance-stage");
    if (advanceBtn) {
      advanceBtn.addEventListener("click", () => advanceComplaintStage(comp.id));
    }

    container.appendChild(card);
  });
}

async function advanceComplaintStage(complaintId) {
  const comp = allComplaints.find((c) => c.id === complaintId);
  if (!comp) return;

  const currentStatus = comp.status || "Under Review";
  let activeIndex = STAGES.findIndex((s) => s.key.toLowerCase() === currentStatus.toLowerCase());
  if (activeIndex === -1) activeIndex = 0;

  const nextIndex = (activeIndex + 1) % STAGES.length;
  const nextStatus = STAGES[nextIndex].key;

  try {
    const res = await fetch(`${BACKEND_API}/complaints/${complaintId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (res.ok) {
      comp.status = nextStatus;
      renderComplaints(allComplaints);
      showToast(`Tracker updated: ${nextStatus}`, "info");
    }
  } catch (err) {
    console.error("Failed to advance stage:", err);
  }
}

// ============================================================
// 13. AI CONCIERGE CHAT INTERFACE
// ============================================================

function setupChat() {
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendButton");
  const resetBtn = document.getElementById("chatResetButton");

  if (!input || !sendBtn) return;

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });

  sendBtn.addEventListener("click", handleChatSend);

  const chips = document.querySelectorAll(".chat-suggestion");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        input.value = prompt;
        handleChatSend();
      }
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", resetConversation);
  }
}

async function handleChatSend() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";

  appendMessage("user", text);
  const loadingBubble = appendMessage("bot", "...", true);

  try {
    const userId = currentAuthUser?.email || currentAuthUser?.id || "guest_user";
    const res = await fetch(AI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, message: text }),
    });

    const data = await res.json();
    loadingBubble.remove();

    if (data && data.message) {
      appendMessage("bot", data.message);
    } else {
      appendMessage("bot", "I am currently connected with the resort system. How may I assist you with your stay?");
    }

    if (data.action) {
      await Promise.all([loadBookings(), loadComplaints()]);
    }
  } catch (err) {
    loadingBubble.remove();
    appendMessage(
      "bot",
      "I am currently unable to reach the AI server. Please ensure the Python FastAPI agent is active on port 8000."
    );
  }
}

function sendMessage(text) {
  const input = document.getElementById("chatInput");
  if (input) {
    input.value = text;
    handleChatSend();
  }
}

function appendMessage(sender, text, isLoading = false) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${sender}`;

  const isBot = sender === "bot";
  const avatar = isBot
    ? `<svg class="bubble-avatar-svg"><use href="#icon-sparkles"/></svg>`
    : (currentAuthUser?.name?.charAt(0).toUpperCase() || "U");
  const name = isBot ? "AuraNile Concierge" : (currentAuthUser?.name || "You");

  // Format bold markdown
  const formattedText = escapeHTML(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");

  bubble.innerHTML = `
    <div class="bubble-avatar">${avatar}</div>
    <div class="bubble-body">
      <span class="bubble-sender">${name}</span>
      <div class="bubble-text">${isLoading ? '<div class="spinner-gold" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></div>' : formattedText}</div>
    </div>
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

async function resetConversation() {
  const container = document.getElementById("chatMessages");
  if (container) {
    container.innerHTML = `
      <div class="msg-bubble bot">
        <div class="bubble-avatar">
          <svg class="bubble-avatar-svg"><use href="#icon-sparkles"/></svg>
        </div>
        <div class="bubble-body">
          <span class="bubble-sender">AuraNile Concierge</span>
          <div class="bubble-text">Conversation reset. How can I assist with your stay today?</div>
        </div>
      </div>
    `;
  }

  try {
    const userId = currentAuthUser?.id || "guest_user";
    await fetch(RESET_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    showToast("Chat session reset.", "info");
  } catch {
    // ignore
  }
}

// ============================================================
// 14. STATS & TOAST SYSTEM
// ============================================================

function updateAllStats() {
  const availEl = document.getElementById("availableCount");
  const bookEl = document.getElementById("bookingCount");
  const compEl = document.getElementById("complaintCount");

  const navRooms = document.getElementById("navRoomsBadge");
  const navBookings = document.getElementById("navBookingsBadge");
  const navComplaints = document.getElementById("navComplaintsBadge");

  if (availEl) availEl.textContent = allRooms.length;
  if (bookEl) bookEl.textContent = allBookings.length;
  if (compEl) compEl.textContent = allComplaints.length;

  if (navRooms) navRooms.textContent = allRooms.length;
  if (navBookings) navBookings.textContent = allBookings.length;
  if (navComplaints) navComplaints.textContent = allComplaints.length;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-lux ${type}`;

  const iconKey = type === "success" ? "check" : (type === "danger" ? "x" : "info");

  toast.innerHTML = `
    <svg style="width: 16px; height: 16px; flex-shrink: 0;"><use href="#icon-${iconKey}"/></svg>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}