
/*************************
 * 기본 설정
 *************************/
const WORKER_BASE = "https://yellow-sun.limdoor.workers.dev";

const map = L.map("map").setView([33.3, 126.3], 18);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const START_YEAR = 2023;
const YEAR_RANGE = 40;
const zones = ["A","B","C","D","E","F"];

let currentZone = "A";
let selected = null;
let statYearVal = new Date().getFullYear();

const treeData = new Map();
const parcelLayer = L.featureGroup().addTo(map);
const gridLayer = L.featureGroup().addTo(map);

/*************************
 * 아이콘
 *************************/
function icon(color){
  return L.divIcon({
    iconSize:[26,26],
    iconAnchor:[13,13],
    html: `
      <svg width="26" height="26">
        <circle cx="13" cy="13" r="10" fill="${color}"/>
        <rect x="11" y="20" width="4" height="6" fill="#8d6e63"/>
      </svg>`
  });
}

/*************************
 * 자동 번호
 *************************/
function nextNum(zone){
  let max = 0;
  treeData.forEach(d=>{
    if(d.id.startsWith(zone+"-")){
      max = Math.max(max, parseInt(d.id.split("-")[1]));
    }
  });
  return max + 1;
}

/*************************
 * 연도 선택
 *************************/
function buildYears(sel, el){
  el.innerHTML = "";
  for(let i=0;i<YEAR_RANGE;i++){
    const y = START_YEAR + i;
    const o = document.createElement("option");
    o.value = y;
    o.textContent = y+"년";
    if(y === Number(sel)) o.selected = true;
    el.appendChild(o);
  }
}

/*************************
 * 구역 변경
 *************************/
zoneSelect.onchange = e => currentZone = e.target.value;

/*************************
 * 나무 생성
 *************************/
map.on("click", e=>{
  const id = currentZone + "-" + nextNum(currentZone);
  const y = new Date().getFullYear();

  const m = L.marker(e.latlng,{
    icon: icon("green"),
    draggable:true
  }).addTo(map);

  treeData.set(m,{
    id,
    last:y,
    history:{ [y]:{yield:"", disease:"green", memo:""} }
  });

  m.on("click", ev=>{
    ev.originalEvent.stopPropagation();
    selected = m;
    openForm();
  });

  save();
});

/*************************
 * 나무 편집 UI
 *************************/
function openForm(){
  const d = treeData.get(selected);
  const form = document.getElementById("form");

  form.innerHTML = `
    <b>나무 정보</b><br><br>
    번호 <input id="treeID"><br>
    연도 <select id="yearSel"></select><br>
    생산량 <input id="yieldInp" type="number"><br>
    상태
    <select id="diseaseSel">
      <option value="green">정상</option>
      <option value="orange">주의</option>
      <option value="red">병해</option>
    </select>
    <textarea id="memoInp" placeholder="메모"></textarea>
    <div style="display:flex;gap:6px">
      <button onclick="saveTree()">저장</button>
      <button onclick="deleteTree()" style="color:red">삭제</button>
      <button onclick="closeForm()">닫기</button>
    </div>
  `;

  document.getElementById("treeID").value = d.id;

  const yearSel = document.getElementById("yearSel");
  buildYears(d.last, yearSel);
  loadYear();

  yearSel.onchange = loadYear;
  form.style.display = "block";
}

function loadYear(){
  const d = treeData.get(selected);
  const y = Number(document.getElementById("yearSel").value);

  if(!d.history[y]) d.history[y]={yield:"", disease:"green", memo:""};

  yieldInp.value = d.history[y].yield;
  diseaseSel.value = d.history[y].disease;
  memoInp.value = d.history[y].memo;
}

function saveTree(){
  const d = treeData.get(selected);
  const y = Number(yearSel.value);

  d.id = treeID.value.trim();
  d.history[y] = {
    yield: yieldInp.value,
    disease: diseaseSel.value,
    memo: memoInp.value
  };
  d.last = y;

  selected.setIcon(icon(diseaseSel.value));
  closeForm();
  updateStat();
  save();
}

function deleteTree(){
  if(!confirm("이 나무를 삭제하시겠습니까?")) return;
  map.removeLayer(selected);
  treeData.delete(selected);
  selected=null;
  closeForm();
  updateStat();
  save();
}

function closeForm(){
  document.getElementById("form").style.display="none";
}

/*************************
 * 통계
 *************************/
buildYears(statYearVal, statYear);
statYear.onchange = ()=>{
  statYearVal = Number(statYear.value);
  updateStat();
};

function toggleStat(){
  const s = document.getElementById("stat");
  s.style.display = s.style.display==="block"?"none":"block";
  updateStat();
}

function updateStat(){
  const body = statBody;
  body.innerHTML = "";

  const stat = {};
  zones.forEach(z=>stat[z]={g:0,o:0,r:0,gc:0,oc:0,rc:0});

  treeData.forEach(d=>{
    const h = d.history[statYearVal];
    if(!h) return;
    const z = d.id.split("-")[0];
    const v = Number(h.yield)||0;
    if(h.disease==="green"){stat[z].g+=v;stat[z].gc++;}
    if(h.disease==="orange"){stat[z].o+=v;stat[z].oc++;}
    if(h.disease==="red"){stat[z].r+=v;stat[z].rc++;}
  });

  zones.forEach(z=>{
    const s = stat[z];
    body.innerHTML += `
      <tr>
        <td>${z}</td>
        <td class="green">${s.g}(${s.gc})</td>
        <td class="orange">${s.o}(${s.oc})</td>
        <td class="red">${s.r}(${s.rc})</td>
        <td><b>${s.g+s.o+s.r}(${s.gc+s.oc+s.rc})</b></td>
      </tr>`;
  });
}

/*************************
 * 저장 / 백업
 *************************/
function save(){
  const arr=[];
  treeData.forEach((d,m)=>arr.push({lat:m.getLatLng(), data:d}));
  localStorage.setItem("orchard", JSON.stringify(arr));
}

(function load(){
  const s = localStorage.getItem("orchard");
  if(!s) return;
  JSON.parse(s).forEach(i=>{
    const m = L.marker(i.lat,{
      icon: icon(i.data.history[i.data.last].disease),
      draggable:true
    }).addTo(map);
    m.on("click",e=>{
      e.originalEvent.stopPropagation();
      selected=m; openForm();
    });
    treeData.set(m,i.data);
  });
})();

function backup(){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(
    new Blob([localStorage.getItem("orchard")],{type:"application/json"})
  );
  a.download="orchard.json";
  a.click();
}

/*************************
 * 지번 검색 + 격자
 *************************/
function toggleParcel(){
  parcelBox.style.display = parcelBox.style.display==="block"?"none":"block";
}

async function searchParcel(){
  const q = addr.value.trim();
  if(!q) return;

  try{
    const r = await fetch(`${WORKER_BASE}/parcel?q=${encodeURIComponent(q)}`);
    if(!r.ok) throw new Error("worker error");
    const j = await r.json();

    parcelLayer.clearLayers();
    gridLayer.clearLayers();

    const poly = L.polygon(j.polygon,{
      color:"#005eff",
      weight:2,
      fill:false
    }).addTo(parcelLayer);

    map.fitBounds(poly.getBounds());
    drawGrid(poly);
  }catch(e){
    alert("지번 검색 실패");
    console.error(e);
  }
}

function drawGrid(poly){
  const b = poly.getBounds();
  const step = 0.000018; // 약 2m

  for(let lat=b.getSouth();lat<b.getNorth();lat+=step){
    gridLayer.addLayer(
      L.polyline([[lat,b.getWest()],[lat,b.getEast()]],{className:"grid-line"})
    );
  }
  for(let lng=b.getWest();lng<b.getEast();lng+=step){
    gridLayer.addLayer(
      L.polyline([[b.getSouth(),lng],[b.getNorth(),lng]],{className:"grid-line"})
    );
  }
}
