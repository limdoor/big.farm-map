
// --- 지도 초기화 ---
const map = L.map("map").setView([33.3,126.3],18);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// --- 변수 초기화 ---
const START_YEAR = 2023, YEAR_RANGE = 40;
const zones = ["A","B","C","D","E","F"];
let currentZone = "A", selected = null, statYearVal = new Date().getFullYear();
const treeData = new Map();
const parcelLayer = L.featureGroup().addTo(map);
const gridLayer = L.featureGroup().addTo(map);

// --- 아이콘 ---
function icon(c) {
  return L.divIcon({
    iconSize:[26,26], iconAnchor:[13,13],
    html:`<svg width="26" height="26">
      <circle cx="13" cy="13" r="10" fill="${c}"/>
      <rect x="11" y="20" width="4" height="6" fill="#8d6e63"/>
    </svg>`
  });
}

// --- 자동 번호 ---
function nextNum(z){
  let m=0;
  treeData.forEach(d=>{
    if(d.id.startsWith(z+"-")) m=Math.max(m,parseInt(d.id.split("-")[1]));
  });
  return m+1;
}

// --- 연도 선택 ---
function buildYears(sel,el){
  el.innerHTML="";
  for(let i=0;i<YEAR_RANGE;i++){
    const y=START_YEAR+i;
    const o=document.createElement("option");
    o.value=y;o.text=y+"년";
    if(y===Number(sel)) o.selected=true;
    el.appendChild(o);
  }
}

// --- 구역 변경 ---
zoneSelect.onchange = e => currentZone = e.target.value;

// --- 나무 생성 ---
map.on("click",e=>{
  const id=currentZone+"-"+nextNum(currentZone);
  const y=new Date().getFullYear();
  const m=L.marker(e.latlng,{icon:icon("green"),draggable:true}).addTo(map);
  treeData.set(m,{id,last:y,history:{[y]:{yield:"",disease:"green",memo:""}}});
  m.on("click",ev=>{ev.originalEvent.stopPropagation(); selected=m; openForm();});
  save();
});

// --- 나무 편집 ---
const treeID=document.getElementById("treeID");
const yearSel=document.getElementById("yearSel");
const yieldInp=document.getElementById("yieldInp");
const diseaseSel=document.getElementById("diseaseSel");
const memoInp=document.getElementById("memoInp");

function openForm(){
  const d=treeData.get(selected);
  treeID.value=d.id;
  buildYears(d.last, yearSel);
  loadYear();
  document.getElementById("form").style.display="block";
}

function loadYear(){
  const d=treeData.get(selected);
  const y=Number(yearSel.value);
  if(!d.history[y]) d.history[y]={yield:"",disease:"green",memo:""};
  yieldInp.value=d.history[y].yield;
  diseaseSel.value=d.history[y].disease;
  memoInp.value=d.history[y].memo;
}

yearSel.onchange = loadYear;

function saveTree(){
  const d = treeData.get(selected);
  d.id = treeID.value.trim();
  const y = Number(yearSel.value);
  d.history[y] = {yield:yieldInp.value,disease:diseaseSel.value,memo:memoInp.value};
  d.last = y;
  selected.setIcon(icon(diseaseSel.value));
  closeForm(); updateStat(); save();
}

function deleteTree(){
  if(!confirm("이 나무를 삭제하시겠습니까?")) return;
  map.removeLayer(selected); treeData.delete(selected); selected=null; closeForm(); updateStat(); save();
}

function closeForm(){document.getElementById("form").style.display="none";}

// --- 통계 ---
const statYearSelect=document.getElementById("statYear");
buildYears(statYearVal, statYearSelect);
statYearSelect.onchange = ()=>{statYearVal = Number(statYearSelect.value); updateStat();};

function toggleStat(){
  const s=document.getElementById("stat");
  s.style.display = s.style.display==="block"?"none":"block";
  updateStat();
}

function updateStat(){
  const statBody=document.getElementById("statBody");
  statBody.innerHTML="";
  const stat={};
  zones.forEach(z=>stat[z]={gS:0,oS:0,rS:0,gC:0,oC:0,rC:0});
  treeData.forEach(d=>{
    const h=d.history[statYearVal];
    if(!h) return;
    const z=d.id.split("-")[0];
    const v=parseFloat(h.yield)||0;
    if(h.disease==="green"){stat[z].gS+=v; stat[z].gC++;}
    if(h.disease==="orange"){stat[z].oS+=v; stat[z].oC++;}
    if(h.disease==="red"){stat[z].rS+=v; stat[z].rC++;}
  });
  zones.forEach(z=>{
    const s=stat[z];
    statBody.innerHTML += `<tr>
      <td>${z}</td>
      <td class="green">${s.gS}(${s.gC})</td>
      <td class="orange">${s.oS}(${s.oC})</td>
      <td class="red">${s.rS}(${s.rC})</td>
      <td><b>${s.gS+s.oS+s.rS}(${s.gC+s.oC+s.rC})</b></td>
    </tr>`;
  });
}

// --- 로컬 저장 ---
function save(){
  const arr=[];
  treeData.forEach((d,m)=>arr.push({lat:m.getLatLng(),data:d}));
  localStorage.setItem("orchard",JSON.stringify(arr));
}

function load(){
  const s=localStorage.getItem("orchard"); if(!s) return;
  JSON.parse(s).forEach(i=>{
    const m=L.marker(i.lat,{icon:icon(i.data.history[i.data.last].disease),draggable:true}).addTo(map);
    m.on("click",ev=>{ev.originalEvent.stopPropagation(); selected=m; openForm();});
    treeData.set(m,i.data);
  });
}
load();

// --- 백업 ---
function backup(){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([localStorage.getItem("orchard")],{type:"application/json"}));
  a.download="orchard.json"; a.click();
}

// --- 지번 검색 ---
function toggleParcel(){parcelBox.style.display = parcelBox.style.display==="block"?"none":"block";}
async function searchParcel(){
  const q=document.getElementById("addr").value.trim();
  if(!q) return;
  try{
    const r = await fetch(`https://yellow-sun.limdoor.workers.dev/parcel?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    parcelLayer.clearLayers(); gridLayer.clearLayers();
    const poly=L.polygon(j.polygon,{color:"blue",fill:false}).addTo(parcelLayer);
    map.fitBounds(poly.getBounds());
    drawGrid(poly);
  }catch(e){alert("지번 검색 실패");}
  document.getElementById("addr").value="";
}

// --- 2m 격자 ---
function drawGrid(poly){
  const b=poly.getBounds();
  const step=0.000018;
  gridLayer.clearLayers();
  for(let lat=b.getSouth();lat<b.getNorth();lat+=step)
    gridLayer.addLayer(L.polyline([ [lat,b.getWest()], [lat,b.getEast()] ],{className:"grid-line"}));
  for(let lng=b.getWest();lng<b.getEast();lng+=step)
    gridLayer.addLayer(L.polyline([ [b.getSouth(),lng], [b.getNorth(),lng] ],{className:"grid-line"}));
}
