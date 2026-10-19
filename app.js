const UNITS = ["TK IT Al Haromain","SD Islam Plus Al Haromain","SMP Plus Al Maliki","Pesantren"];
const STORAGE_KEY = "alharomain-finance-demo-v1";
const now = new Date();
const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const monthKey = d => localDate(d).slice(0,7);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n||0);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function demoData(){
 const m = monthKey(now);
 const dates = [localDate(new Date(now.getFullYear(),now.getMonth(),2)),localDate(new Date(now.getFullYear(),now.getMonth(),5)),localDate(new Date(now.getFullYear(),now.getMonth(),8)),localDate(new Date(now.getFullYear(),now.getMonth(),11)),localDate(new Date(now.getFullYear(),now.getMonth(),14)),localDate(new Date(now.getFullYear(),now.getMonth(),17))];
 return {
  transactions:[
   {id:1,date:dates[0],unit:UNITS[1],type:"income",category:"SPP",amount:7200000,note:"Penerimaan SPP contoh",status:"approved"},
   {id:2,date:dates[1],unit:UNITS[1],type:"expense",category:"Gaji dan honor",amount:2800000,note:"Honor guru — contoh",status:"approved"},
   {id:3,date:dates[2],unit:UNITS[2],type:"income",category:"SPP",amount:4800000,note:"Penerimaan SPP contoh",status:"approved"},
   {id:4,date:dates[3],unit:UNITS[3],type:"expense",category:"Operasional",amount:950000,note:"Kebutuhan asrama — contoh",status:"approved"},
   {id:5,date:dates[4],unit:UNITS[0],type:"income",category:"SPP",amount:2250000,note:"Penerimaan SPP contoh",status:"approved"},
   {id:6,date:dates[5],unit:UNITS[2],type:"expense",category:"Perawatan",amount:450000,note:"Perawatan fasilitas — contoh",status:"approved"}
  ],
  invoices:[
   {code:"DEMO-001",unit:UNITS[1],period:m,amount:150000,paid:150000},
   {code:"DEMO-002",unit:UNITS[1],period:m,amount:150000,paid:50000},
   {code:"DEMO-003",unit:UNITS[2],period:m,amount:200000,paid:0},
   {code:"DEMO-004",unit:UNITS[0],period:m,amount:125000,paid:125000},
   {code:"DEMO-005",unit:UNITS[3],period:m,amount:300000,paid:100000}
  ]
 };
}
function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):demoData()}catch(e){return demoData()}}
let db=loadData();
const $ = id => document.getElementById(id);
$("monthFilter").value=monthKey(now); $("txDate").value=localDate(now);
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}
function visibleUnit(){return $("unitFilter").value}
function filteredTransactions(){
 const month=$("monthFilter").value, unit=visibleUnit();
 return db.transactions.filter(t=>(!month||t.date.startsWith(month))&&(unit==="all"||t.unit===unit)).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id)
}
function filteredInvoices(){
 const month=$("monthFilter").value, unit=visibleUnit();
 return db.invoices.filter(i=>(!month||i.period===month)&&(unit==="all"||i.unit===unit))
}
function sum(items, fn){return items.reduce((a,x)=>a+fn(x),0)}
function render(){
 const role=$("roleFilter").value;
 const unitSelect=$("unitFilter");
 if(role==="treasurer"){
  if(unitSelect.value==="all") unitSelect.value=UNITS[1];
  unitSelect.querySelector('option[value="all"]').disabled=true;
 }else unitSelect.querySelector('option[value="all"]').disabled=false;
 const tx=filteredTransactions(), inv=filteredInvoices();
 const income=sum(tx.filter(t=>t.type==="income"),t=>t.amount);
 const expense=sum(tx.filter(t=>t.type==="expense"),t=>t.amount);
 const spp=sum(tx.filter(t=>t.type==="income"&&t.category==="SPP"),t=>t.amount);
 const arrears=sum(inv,i=>Math.max(0,i.amount-i.paid));
 $("incomeTotal").textContent=rupiah(income);$("expenseTotal").textContent=rupiah(expense);
 $("sppTotal").textContent=rupiah(spp);$("arrearsTotal").textContent=rupiah(arrears);
 const units=visibleUnit()==="all"?UNITS:[visibleUnit()];
 $("unitSummary").innerHTML=units.map(u=>{
  const a=sum(tx.filter(t=>t.unit===u&&t.type==="income"),t=>t.amount);
  const b=sum(tx.filter(t=>t.unit===u&&t.type==="expense"),t=>t.amount);
  return `<tr><td><strong>${escapeHtml(u)}</strong></td><td class="amount-income">${rupiah(a)}</td><td class="amount-expense">${rupiah(b)}</td><td>${rupiah(a-b)}</td></tr>`
 }).join("")||'<tr><td colspan="4">Tidak ada data.</td></tr>';
 $("transactionsTable").innerHTML=tx.map(t=>`<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.unit)}</td><td><span class="pill ${t.type==="income"?"pill-paid":"pill-unpaid"}">${t.type==="income"?"Pemasukan":"Pengeluaran"}</span></td><td>${escapeHtml(t.category)}</td><td>${escapeHtml(t.note)}</td><td class="right ${t.type==="income"?"amount-income":"amount-expense"}">${rupiah(t.amount)}</td></tr>`).join("");
 $("emptyState").classList.toggle("hidden",tx.length>0);
 $("sppTable").innerHTML=inv.map(i=>{
  const remaining=Math.max(0,i.amount-i.paid), status=remaining===0?"Lunas":i.paid>0?"Sebagian":"Belum bayar";
  const cls=remaining===0?"pill-paid":i.paid>0?"pill-partial":"pill-unpaid";
  return `<tr><td>${escapeHtml(i.code)}</td><td>${escapeHtml(i.unit)}</td><td>${escapeHtml(i.period)}</td><td>${rupiah(i.amount)}</td><td>${rupiah(i.paid)}</td><td><span class="pill ${cls}">${status}</span></td></tr>`
 }).join("")||'<tr><td colspan="6">Tidak ada tagihan.</td></tr>';
}
$("transactionForm").addEventListener("submit",e=>{
 e.preventDefault();
 if($("roleFilter").value!=="treasurer" && $("roleFilter").value!=="foundation"){return}
 const amount=Number($("txAmount").value);
 if(!Number.isFinite(amount)||amount<=0){$("formMessage").textContent="Nominal harus lebih dari nol.";return}
 const tx={id:Date.now(),date:$("txDate").value,unit:$("txUnit").value,type:$("txType").value,category:$("txCategory").value,amount,note:$("txNote").value.trim(),status:"demo"};
 if(!tx.date||!tx.note){$("formMessage").textContent="Lengkapi tanggal dan keterangan.";return}
 if($("roleFilter").value==="treasurer"&&tx.unit!==visibleUnit()){tx.unit=visibleUnit()}
 db.transactions.push(tx);save();render();$("transactionForm").reset();$("txDate").value=localDate(now);$("formMessage").textContent="Transaksi demo tersimpan di browser ini."; 
});
["monthFilter","unitFilter","roleFilter"].forEach(id=>$(id).addEventListener("change",()=>{if(id==="roleFilter"&&$("roleFilter").value==="treasurer")$("txUnit").value=visibleUnit()==="all"?UNITS[1]:visibleUnit();render()}));
$("resetBtn").addEventListener("click",()=>{if(confirm("Kembalikan seluruh data demo ke kondisi awal?")){db=demoData();save();render();$("formMessage").textContent="Data demo telah direset."}});
$("exportBtn").addEventListener("click",()=>{
 const rows=[["Tanggal","Unit","Jenis","Kategori","Keterangan","Nominal"],...filteredTransactions().map(t=>[t.date,t.unit,t.type,t.category,t.note,t.amount])];
 const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="al-haromain-finance-demo.csv";a.click();URL.revokeObjectURL(url);
});
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt){alert("Jika tombol instalasi belum tersedia, buka menu Chrome lalu pilih Tambahkan ke layar utama.");return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden")});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("Service worker belum terdaftar",err)));
render();
