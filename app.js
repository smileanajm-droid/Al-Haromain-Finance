/* Al-Haromain Finance — Supabase */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const rupiah = n => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n || 0));

  let sb, session, profile;
  let units = [], accounts = [], transactions = [];
  let selectedMonth = "", selectedUnit = "all";

  function message(text, error = false) {
    const el = $("formMessage");
    if (el) {
      el.textContent = text;
      el.style.color = error ? "#b42318" : "#137547";
    } else {
      alert(text);
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function createLogin() {
    if ($("authPanel")) return;

    const panel = document.createElement("section");
    panel.id = "authPanel";
    panel.style.cssText =
      "max-width:460px;margin:24px auto;padding:20px;border:1px solid #ddd;border-radius:14px;background:white";

    panel.innerHTML = `
      <h2>Masuk — Al-Haromain Finance</h2>
      <p>Gunakan akun yang sudah terdaftar di Supabase.</p>
      <form id="loginForm">
        <label>Email</label>
        <input id="loginEmail" type="email" required
          autocomplete="username"
          style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0">
        <label>Kata sandi</label>
        <input id="loginPassword" type="password" required
          autocomplete="current-password"
          style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0">
        <button id="loginBtn" type="submit"
          style="width:100%;padding:12px;background:#176b45;color:white;border:0;border-radius:8px">
          Masuk
        </button>
        <p id="loginMessage" style="color:#b42318"></p>
      </form>`;

    document.body.prepend(panel);

    $("loginForm").addEventListener("submit", async event => {
      event.preventDefault();
      $("loginBtn").disabled = true;
      $("loginMessage").textContent = "Sedang masuk…";

      const { data, error } = await sb.auth.signInWithPassword({
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
      });

      $("loginBtn").disabled = false;

      if (error) {
        $("loginMessage").textContent = "Gagal masuk: " + error.message;
        return;
      }

      session = data.session;
      await loadApp();
    });
  }

  function toggleApp(show) {
  const authPanel = $("authPanel");

  if (authPanel) {
    authPanel.style.display = show ? "none" : "block";
  }

  const main = document.querySelector("main");
  const header = document.querySelector("header");

  if (main) {
    main.style.display = show ? "" : "none";
  }

  if (header) {
    header.style.display = show ? "" : "none";
  }

  const signOut = $("signOutBtn");
  if (signOut) {
    signOut.style.display = show ? "" : "none";
  }
  }
  
  async function loadProfile() {
    const { data, error } = await sb
      .from("profiles")
      .select("user_id, full_name, role, unit_id, is_active")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      throw new Error("Profil gagal dibaca: " + error.message);
    }

    if (!data) {
      throw new Error(
        "Profil akun belum ditemukan. Pastikan user_id pada tabel profiles sesuai dengan akun login."
      );
    }

    if (!data.is_active) {
      throw new Error("Akun Anda tidak aktif. Hubungi administrator yayasan.");
    }

    profile = data;
  }
  
  async function loadUnits() {
    const { data, error } = await sb
      .from("units")
      .select("id,name,code,is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw Error("Unit gagal dibaca: " + error.message);

    units = data || [];

    if (profile.role === "unit_treasurer") {
      units = units.filter(unit => unit.id === profile.unit_id);
      if (!units.length) throw Error("Unit bendahara tidak ditemukan.");
    }
  }

  async function loadAccounts() {
    let query = sb
      .from("cash_accounts")
      .select("id,unit_id,account_name,account_type,is_active")
      .eq("is_active", true);

    if (profile.role === "unit_treasurer") {
      query = query.eq("unit_id", profile.unit_id);
    }

    const { data, error } = await query;

    if (error) throw Error("Akun kas gagal dibaca: " + error.message);
    accounts = data || [];
  }

  async function loadTransactions() {
    let query = sb
      .from("transactions")
      .select("id,unit_id,cash_account_id,transaction_date,direction,category,amount,description,status,requested_by,approved_by,approved_at,created_at")
      .order("transaction_date", { ascending: false })
      .limit(1000);

    if (profile.role === "unit_treasurer") {
      query = query.eq("unit_id", profile.unit_id);
    } else if (selectedUnit !== "all") {
      query = query.eq("unit_id", selectedUnit);
    }

    if (selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const start = `${year}-${month}-01`;
      const next = new Date(Number(year), Number(month), 1);
      const end =
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

      query = query.gte("transaction_date", start)
        .lt("transaction_date", end);
    }

    const { data, error } = await query;
    if (error) throw Error("Transaksi gagal dibaca: " + error.message);

    transactions = data || [];
    render();
  }
   function fillSelect(element, rows, key, label, placeholder = null) {
    if (!element) return;
    element.innerHTML = "";

    if (placeholder !== null) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = placeholder;
      element.appendChild(option);
    }

    rows.forEach(row => {
      const option = document.createElement("option");
      option.value = row[key];
      option.textContent = label(row);
      element.appendChild(option);
    });
  }

  function setupControls() {
    fillSelect($("txUnit"), units, "id", unit => unit.name, "Pilih unit");

    if ($("txUnit") && profile.role === "unit_treasurer") {
      $("txUnit").value = profile.unit_id;
      $("txUnit").disabled = true;
    }

    if ($("unitFilter")) {
      if (profile.role === "foundation_admin") {
        fillSelect(
          $("unitFilter"),
          [{ id: "all", name: "Semua unit" }, ...units],
          "id",
          unit => unit.name
        );
        $("unitFilter").value = selectedUnit;
      } else {
        fillSelect($("unitFilter"), units, "id", unit => unit.name);
        $("unitFilter").value = profile.unit_id;
        $("unitFilter").disabled = true;
      }
    }

    if ($("roleFilter")) {
  const roleNames = {
    foundation_admin: "Pengurus Yayasan",
    education_director: "Direktur Pendidikan",
    foundation_treasurer: "Bendahara Yayasan",
    auditor: "Auditor",
    unit_head: "Kepala Unit",
    unit_treasurer: "Bendahara Unit",
    admin_staff: "Staf Administrasi"
  };

  $("roleFilter").innerHTML = "";

  const option = document.createElement("option");
  option.value = profile.role;
  option.textContent = roleNames[profile.role] || profile.role;
  $("roleFilter").appendChild(option);

  $("roleFilter").value = profile.role;
  $("roleFilter").disabled = true;
    }

    // Sesuai constraint database: direction = in atau out.
    if ($("txType")) {
      $("txType").innerHTML =
        '<option value="in">Pemasukan</option>' +
        '<option value="out">Pengeluaran</option>';
    }

    if ($("transactionForm")) {
      const canWrite = profile.role === "unit_treasurer";
      $("transactionForm").style.display = canWrite ? "" : "none";

      $("transactionForm")
        .querySelectorAll("input,select,textarea,button")
        .forEach(el => el.disabled = !canWrite);

      $("transactionForm").addEventListener("submit", submitTransaction);
    }

    if ($("monthFilter")) {
      $("monthFilter").addEventListener("change", async () => {
        selectedMonth = $("monthFilter").value;
        await refreshTransactions();
      });
    }

    if ($("unitFilter")) {
      $("unitFilter").addEventListener("change", async () => {
        if (profile.role === "foundation_admin") {
          selectedUnit = $("unitFilter").value || "all";
        }
        await refreshTransactions();
      });
    }

    if ($("exportBtn")) {
      $("exportBtn").addEventListener("click", exportCSV);
    }

    if ($("resetBtn")) {
      $("resetBtn").style.display = "none";
    }
  }
  // ===== DAFTAR DATA SISWA =====
  let studentRecords = [];

  async function loadStudents() {
    const body = $("studentListBody");
    const status = $("studentListMessage");

    if (!body) return;

    body.innerHTML =
      '<tr><td colspan="4">Memuat data siswa...</td></tr>';

    const { data, error } = await sb
.from("students")
.select("id, unit_id, student_code, full_name, class_name, enrollment_status, monthly_fee")
.order("full_name", { ascending: true });

if (!error) {
  console.log("Jumlah data siswa terbaca:", (data || []).length);
}

    if (error) {
      body.innerHTML = "";
      if (status) {
        status.textContent = "Gagal memuat data siswa: " + error.message;
        status.style.color = "#b42318";
      }
      return;
    }

    studentRecords = data || [];
    renderStudentList();
  }

  function renderStudentList() {
    const body = $("studentListBody");
    const search = $("studentSearch");
    const status = $("studentListMessage");

    if (!body) return;

    const keyword = (search?.value || "").trim().toLowerCase();

    const filtered = studentRecords.filter(student =>
      String(student.student_code || "").toLowerCase().includes(keyword) ||
      String(student.full_name || "").toLowerCase().includes(keyword) ||
      String(student.class_name || "").toLowerCase().includes(keyword)
    );

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="4">Belum ada data siswa yang cocok.</td></tr>';
    } else {
      body.innerHTML = filtered.map(student => `
        <tr>
          <td>${escapeHTML(student.student_code)}</td>
          <td>${escapeHTML(student.full_name)}</td>
          <td>${escapeHTML(student.class_name || "-")}</td>
          <td>${escapeHTML(student.enrollment_status || "-")}</td>
        </tr>
      `).join("");
    }

    if (status) {
      status.textContent = `Menampilkan ${filtered.length} dari ${studentRecords.length} siswa.`;
      status.style.color = "#137547";
    }
  }
function setupSPPFields() {
  const category = $("txCategory");
  const studentField = $("studentField");
  const feePeriodField = $("feePeriodField");
  const studentSelect = $("txStudent");
  const feePeriod = $("txFeePeriod");

  if (!category || !studentField || !feePeriodField || !studentSelect) {
    return;
  }

  function updateSPPFields() {
    const isSPP = category.value.trim().toLowerCase() === "spp";

    studentField.hidden = !isSPP;
    feePeriodField.hidden = !isSPP;

    studentSelect.required = isSPP;

    if (feePeriod) {
      feePeriod.required = isSPP;
    }
  }

  const unitStudents = studentRecords.filter(student =>
    student.unit_id === profile.unit_id &&
    student.enrollment_status === "active"
  );
console.log("Profil unit:", profile.unit_id);
console.log("Jumlah siswa cocok:", unitStudents.length, studentRecords);
  studentSelect.innerHTML = '<option value="">Pilih siswa</option>';

  unitStudents.forEach(student => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent =
      `${student.student_code} - ${student.full_name}` +
      (student.class_name ? ` (${student.class_name})` : "");
    studentSelect.appendChild(option);
  });

  category.addEventListener("change", updateSPPFields);
  studentSelect.addEventListener("change", () => {
  const selectedStudent = studentRecords.find(
    student => student.id === studentSelect.value
  );

  const amountInput = $("txAmount");

  if (
    selectedStudent &&
    selectedStudent.monthly_fee !== null &&
    selectedStudent.monthly_fee !== undefined &&
    amountInput
  ) {
    amountInput.value = selectedStudent.monthly_fee;
  }
});
  updateSPPFields();
}
  if ($("studentSearch")) {
    $("studentSearch").addEventListener("input", renderStudentList);
  }
  async function refreshTransactions() {
    try {
      await loadTransactions();
    } catch (error) {
      message(error.message, true);
    }
  }

  function render() {
    const approved = transactions.filter(t => t.status === "approved");

    const income = approved
      .filter(t => t.direction === "in")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = approved
      .filter(t => t.direction === "out")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    if ($("incomeTotal")) $("incomeTotal").textContent = rupiah(income);
    if ($("expenseTotal")) $("expenseTotal").textContent = rupiah(expense);

    if ($("sppTotal")) {
      const spp = approved
        .filter(t => t.direction === "in" &&
          /spp|syahriah|iuran/i.test(t.category))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      $("sppTotal").textContent = rupiah(spp);
    }

    if ($("arrearsTotal")) {
      const pending = transactions.filter(t => t.status === "pending").length;
      $("arrearsTotal").textContent =
        `${pending} transaksi menunggu persetujuan`;
    }

    if ($("unitSummary")) {
      $("unitSummary").innerHTML =
        `<table>
          <thead><tr>
            <th>Unit</th><th>Pemasukan</th>
            <th>Pengeluaran</th><th>Selisih</th>
          </tr></thead>
          <tbody>${units.map(unit => {
            const list = approved.filter(t => t.unit_id === unit.id);
            const masuk = list.filter(t => t.direction === "in")
              .reduce((sum, t) => sum + Number(t.amount), 0);
            const keluar = list.filter(t => t.direction === "out")
              .reduce((sum, t) => sum + Number(t.amount), 0);

            return `<tr>
              <td>${escapeHTML(unit.name)}</td>
              <td>${rupiah(masuk)}</td>
              <td>${rupiah(keluar)}</td>
              <td>${rupiah(masuk - keluar)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>`;
    }
    
    if ($("transactionsTable")) {
      $("transactionsTable").innerHTML =
        `<thead><tr>
          <th>Tanggal</th><th>Unit</th><th>Jenis</th>
          <th>Kategori</th><th>Keterangan</th><th>Nominal</th>
          <th>Status</th><th>Aksi</th>
        </tr></thead>
        <tbody>${transactions.map(t => {
          const unit = units.find(u => u.id === t.unit_id);
          const jenis = t.direction === "in" ? "Pemasukan" : "Pengeluaran";
          const canApprove =
            profile.role === "foundation_admin" &&
            t.status === "pending" &&
            t.requested_by !== session.user.id;

          const actions = canApprove
            ? `<button type="button" data-approve="${t.id}">Setujui</button>
               <button type="button" data-reject="${t.id}">Tolak</button>`
            : "—";

          return `<tr>
            <td>${escapeHTML(t.transaction_date)}</td>
            <td>${escapeHTML(unit?.name || "Unit")}</td>
            <td>${jenis}</td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.description)}</td>
            <td>${rupiah(t.amount)}</td>
            <td>${escapeHTML(t.status)}</td>
            <td>${actions}</td>
          </tr>`;
        }).join("")}</tbody>`;

      $("transactionsTable").querySelectorAll("[data-approve]").forEach(btn => {
        btn.addEventListener("click", () =>
          decideTransaction(btn.dataset.approve, "approved")
        );
      });

      $("transactionsTable").querySelectorAll("[data-reject]").forEach(btn => {
        btn.addEventListener("click", () =>
          decideTransaction(btn.dataset.reject, "rejected")
        );
      });
    }
    

    if ($("emptyState")) {
      $("emptyState").style.display = transactions.length ? "none" : "block";
    }
  }
 
  async function decideTransaction(id, status) {
    if (profile?.role !== "foundation_admin") {
      message("Hanya Pengurus Yayasan yang dapat memproses persetujuan.", true);
      return;
    }

    if (!["approved", "rejected"].includes(status)) return;

    const transaction = transactions.find(t => t.id === id);
    if (!transaction || transaction.status !== "pending") {
      message("Transaksi sudah diproses atau tidak ditemukan.", true);
      return;
    }

    const action = status === "approved" ? "menyetujui" : "menolak";
    if (!confirm(`Yakin ingin ${action} transaksi ini?`)) return;

    const { data, error } = await sb
      .from("transactions")
      .update({
        status,
        approved_by: session.user.id,
        approved_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      message("Gagal memproses persetujuan: " + error.message, true);
      return;
    }

    if (!data || data.length === 0) {
      message("Tidak ada perubahan. Periksa kebijakan akses Supabase.", true);
      return;
    }

    message(status === "approved"
      ? "Transaksi berhasil disetujui."
      : "Transaksi berhasil ditolak."
    );

    await refreshTransactions();
  }
  
  async function submitTransaction(event) {
    event.preventDefault();

    if (!profile || profile.role !== "unit_treasurer") {
      message("Akun yayasan hanya untuk melihat data. Input dilakukan oleh bendahara unit.", true);
      return;
    }

    const date = $("txDate")?.value;
    const direction = $("txType")?.value;
    const category = $("txCategory")?.value?.trim();
const amount = Number($("txAmount")?.value);
const description = $("txNote")?.value?.trim();
const account = accounts.find(a => a.unit_id === profile.unit_id);

const isSPP = category?.toLowerCase() === "spp";
const studentId = isSPP ? $("txStudent")?.value : null;
const feeMonth = isSPP ? $("txFeePeriod")?.value : "";
const feePeriod = feeMonth ? `${feeMonth}-01` : null;

    if (
      !date ||
      !["in", "out"].includes(direction) ||
      !category ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !account
    ) {
      message("Lengkapi tanggal, jenis, kategori, nominal, dan pastikan akun kas unit tersedia.", true);
      return;
    }
if (isSPP) {
  if (!studentId || !feeMonth) {
    message("Pilih siswa dan periode pembayaran SPP.", true);
    return;
  }

  const selectedStudent = studentRecords.find(
    student =>
      student.id === studentId &&
      student.unit_id === profile.unit_id &&
      student.enrollment_status === "active"
  );

  if (!selectedStudent) {
    message("Siswa tidak valid atau bukan dari unit Anda.", true);
    return;
  }
}
    const button = $("transactionForm")?.querySelector(
      'button[type="submit"], button:not([type])'
    );

    if (button) button.disabled = true;
    message("Menyimpan transaksi ke Supabase...");

    const payload = {
  unit_id: profile.unit_id,
  cash_account_id: account.id,
  transaction_date: date,
  direction,
  category,
  amount,
  description: description || category,
  student_id: isSPP ? studentId : null,
  fee_period: isSPP ? feePeriod : null,
  status: "pending",
  requested_by: session.user.id
};

    const { error } = await sb.from("transactions").insert(payload);

    if (button) button.disabled = false;

    if (error) {
      message("Transaksi belum tersimpan: " + error.message, true);
      return;
    }

    message("Transaksi berhasil disimpan dan menunggu persetujuan.");
    $("transactionForm").reset();

    if ($("txDate")) {
      $("txDate").value = new Date().toISOString().slice(0, 10);
    }

    await refreshTransactions();
  }

  function exportCSV() {
    const rows = [
      ["Tanggal", "Unit", "Jenis", "Kategori", "Nominal", "Keterangan", "Status"]
    ];

    for (const t of transactions) {
      rows.push([
        t.transaction_date,
        units.find(u => u.id === t.unit_id)?.name || t.unit_id || "",
        t.direction === "in" ? "Pemasukan" : "Pengeluaran",
        t.category,
        t.amount,
        t.description,
        t.status
      ]);
    }

    const csv = rows.map(row =>
      row.map(value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "laporan-keuangan-al-haromain.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }


async function loadApp() {
  try {
    await loadProfile();
    await loadUnits();
    await loadAccounts();

    setupControls();
    setupStudentImport();
    await loadStudents();
setupSPPFields();
    toggleApp(true);

    // Sembunyikan pemberitahuan demo lama.
    document.querySelectorAll(".notice").forEach(el => {
      el.style.display = "none";
    });

    // Sesuaikan teks formulir dengan aplikasi terhubung.
    const submitButton = $("transactionForm")?.querySelector(
      'button[type="submit"]'
    );
    if (submitButton) {
      submitButton.textContent = "Simpan transaksi";
    }

    // Form hanya untuk bendahara unit.
    if ($("transactionForm")) {
      $("transactionForm").removeEventListener(
        "submit",
        submitTransaction
      );
      $("transactionForm").addEventListener(
        "submit",
        submitTransaction
      );
    }

    if ($("txDate")) {
      $("txDate").value = new Date().toISOString().slice(0, 10);
    }

    if ($("exportBtn")) {
      $("exportBtn").onclick = exportCSV;
    }

    if (!$("signOutBtn")) {
      const signOut = document.createElement("button");
      signOut.id = "signOutBtn";
      signOut.type = "button";
      signOut.textContent = "Keluar";

      signOut.onclick = async () => {
        await sb.auth.signOut();
        toggleApp(false);
      };

      const header = document.querySelector("header");
      if (header) header.appendChild(signOut);
      else document.body.prepend(signOut);
    }

    await loadTransactions();

  } catch (error) {
    toggleApp(false);

    const loginMessage = $("loginMessage");
    if (loginMessage) {
      loginMessage.textContent =
        "Gagal memuat aplikasi: " + error.message;
    }
  }
}

  async function init() {
    createLogin();

    const config = window.SUPABASE_CONFIG;

    if (
      !window.supabase ||
      !config ||
      !config.url ||
      !config.publishableKey
    ) {
      const loginMessage = $("loginMessage");
      if (loginMessage) {
        loginMessage.textContent =
          "Konfigurasi Supabase tidak terbaca. Periksa supabase-config.js.";
      }
      return;
    }

    sb = window.supabase.createClient(
      config.url,
      config.publishableKey
    );

    const { data, error } = await sb.auth.getSession();

    if (error) {
      const loginMessage = $("loginMessage");
      if (loginMessage) loginMessage.textContent = error.message;
      return;
    }

    session = data.session;

    if (session) {
      await loadApp();
    } else {
      toggleApp(false);
    }

    sb.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;

      if (!newSession) {
        toggleApp(false);
      }
    });
  }
  // ===== IMPORT DATA SISWA DARI EXCEL =====
  function setupStudentImport() {
    const fileInput = $("studentExcelFile");
    const importBtn = $("importStudentBtn");
    const templateBtn = $("downloadStudentTemplate");
    const statusEl = $("studentImportMessage");

    if (!fileInput || !importBtn || !templateBtn || !statusEl) return;

    const showStatus = (text, error = false) => {
      statusEl.textContent = text;
      statusEl.style.color = error ? "#b42318" : "#137547";
    };

    templateBtn.onclick = () => {
      if (!window.XLSX) {
        showStatus("Pustaka Excel belum tersedia. Periksa index.html.", true);
        return;
      }

      const rows = [
["student_code", "full_name", "class_name", "enrolled_on", "monthly_fee"],
["SD001", "Ahmad Contoh", "Kelas 1", "2026-07-15", 100000],
["SD002", "Aisyah Contoh", "Kelas 1", "2026-07-15", 50000]

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "Data Siswa");
      XLSX.writeFile(workbook, "Template_Data_Siswa.xlsx");
      showStatus("Template Excel berhasil dibuat.");
    };

    importBtn.onclick = async () => {
      if (!window.XLSX) {
        showStatus("Pustaka Excel belum tersedia. Periksa index.html.", true);
        return;
      }

      if (!session?.user || !profile) {
        showStatus("Silakan login terlebih dahulu.", true);
        return;
      }

      if (profile.role !== "unit_treasurer" || !profile.unit_id) {
        showStatus(
          "Impor belum diizinkan untuk peran ini. Admin Yayasan memerlukan kebijakan akses khusus.",
          true
        );
        return;
      }

      const file = fileInput.files?.[0];
      if (!file) {
        showStatus("Pilih file Excel terlebih dahulu.", true);
        return;
      }

      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        showStatus("Format file harus .xlsx atau .xls.", true);
        return;
      }

      importBtn.disabled = true;

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false
        });

        if (!rows.length) {
          throw new Error("File Excel tidak berisi data.");
        }

        const normalize = value =>
          String(value ?? "").trim().toLowerCase();

        const prepared = [];
        const errors = [];
        const seenCodes = new Set();

        rows.forEach((row, index) => {
          const normalized = {};
          Object.keys(row).forEach(key => {
            normalized[normalize(key)] = row[key];
          });

          const code = String(
            normalized.student_code ?? normalized.kode_siswa ?? ""
          ).trim();

          const name = String(
            normalized.full_name ?? normalized.nama_siswa ?? ""
          ).trim();

          const className = String(
            normalized.class_name ?? normalized.kelas ?? ""
          ).trim();

          const enrolledOn = String(
            normalized.enrolled_on ?? normalized.tanggal_masuk ?? ""
          ).trim();
          const monthlyFeeRaw =
  normalized.monthly_fee ??
  normalized.besaran_spp ??
  normalized.spp ??
  "";

const monthlyFeeText = String(monthlyFeeRaw).trim();
const monthlyFee = monthlyFeeText === ""
  ? null
  : Number(monthlyFeeText);

          if (!code || !name || !className) {
            errors.push(`Baris ${index + 2}: kode, nama, dan kelas wajib diisi.`);
            return;
          }
if (
  monthlyFee !== null &&
  (!Number.isFinite(monthlyFee) || monthlyFee < 0)
) {
  errors.push(
    `Baris ${index + 2}: nominal SPP harus berupa angka nol atau lebih.`
  );
  return;
}
          if (seenCodes.has(code)) {
            errors.push(`Baris ${index + 2}: kode siswa ${code} duplikat di file.`);
            return;
          }

          seenCodes.add(code);

          const student = {
  unit_id: profile.unit_id,
  student_code: code,
  full_name: name,
  class_name: className,
  monthly_fee: monthlyFee,
  enrollment_status: "active"
};

          if (enrolledOn) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(enrolledOn)) {
              errors.push(
                `Baris ${index + 2}: tanggal masuk harus berformat YYYY-MM-DD.`
              );
              return;
            }
            student.enrolled_on = enrolledOn;
          }

          prepared.push(student);
        });

        if (errors.length) {
          showStatus(
            `Impor dibatalkan. Perbaiki ${errors.length} masalah: ` +
            errors.slice(0, 5).join(" "),
            true
          );
          return;
        }

        if (!prepared.length) {
          throw new Error("Tidak ada baris siswa yang valid.");
        }

        const confirmed = window.confirm(
          `Impor ${prepared.length} siswa ke unit akun Anda? Data dengan kode yang sudah ada mungkin ditolak oleh database.`
        );

        if (!confirmed) {
          showStatus("Impor dibatalkan.");
          return;
        }

        const { data, error } = await sb
          .from("students")
          .insert(prepared)
          .select("id");

        if (error) {
          throw new Error(error.message);
        }

        showStatus(
          `Berhasil menyimpan ${data?.length ?? prepared.length} data siswa.`
        );

        fileInput.value = "";
      } catch (error) {
        showStatus("Impor gagal: " + error.message, true);
      } finally {
        importBtn.disabled = false;
      }
    };
  }
  document.addEventListener("DOMContentLoaded", init);
})();
