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
    if ($("authPanel")) {
      $("authPanel").style.display = show ? "none" : "block";
    }

    document.querySelectorAll(
      "main,header,nav,.app,.dashboard,.container"
    ).forEach(el => {
      if (!el.contains($("authPanel"))) {
        el.style.display = show ? "" : "none";
      }
    });
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
          <th>Kategori</th><th>Keterangan</th>
          <th>Nominal</th><th>Status</th>
        </tr></thead>
        <tbody>${transactions.map(t => {
          const unit = units.find(u => u.id === t.unit_id);
          const jenis = t.direction === "in"
            ? "Pemasukan" : "Pengeluaran";

          return `<tr>
            <td>${escapeHTML(t.transaction_date)}</td>
            <td>${escapeHTML(unit?.name || "Unit")}</td>
            <td>${jenis}</td>
            <td>${escapeHTML(t.category)}</td>
            <td>${escapeHTML(t.description)}</td>
            <td>${rupiah(t.amount)}</td>
            <td>${escapeHTML(t.status)}</td>
          </tr>`;
        }).join("")}</tbody>`;
    }

    if ($("emptyState")) {
      $("emptyState").style.display = transactions.length ? "none" : "block";
    }
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
      toggleApp(true);

      if ($("txDate") && !$("txDate").value) {
        $("txDate").value = new Date().toISOString().slice(0, 10);
      }

      if ($("transactionForm")) {
        $("transactionForm").removeEventListener("submit", submitTransaction);
        $("transactionForm").addEventListener("submit", submitTransaction);
      }

      if ($("exportBtn")) {
        $("exportBtn").addEventListener("click", exportCSV);
      }

      if (!$("signOutBtn")) {
        const signOut = document.createElement("button");
        signOut.id = "signOutBtn";
        signOut.type = "button";
        signOut.textContent = "Keluar";
        signOut.addEventListener("click", async () => {
          await sb.auth.signOut();
          toggleApp(false);
        });

        const header = document.querySelector("header");
        if (header) {
          header.appendChild(signOut);
        } else {
          document.body.prepend(signOut);
        }
      }

      await loadTransactions();

    } catch (error) {
      toggleApp(false);
      const loginMessage = $("loginMessage");
      if (loginMessage) {
        loginMessage.textContent = "Gagal memuat aplikasi: " + error.message;
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

  document.addEventListener("DOMContentLoaded", init);
})();
