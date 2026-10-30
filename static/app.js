const departments = {
 "Amazonas": [-6.23,-77.87,"Chachapoyas"],
 "Áncash": [-9.53,-77.53,"Huaraz"],
 "Apurímac": [-13.64,-72.88,"Abancay"],
 "Arequipa": [-16.40,-71.54,"Arequipa"],
 "Ayacucho": [-13.16,-74.22,"Ayacucho"],
 "Cajamarca": [-7.16,-78.51,"Cajamarca"],
 "Callao": [-12.06,-77.15,"Callao"],
 "Cusco": [-13.52,-71.97,"Cusco"],
 "Huancavelica": [-12.79,-74.97,"Huancavelica"],
 "Huánuco": [-9.93,-76.24,"Huánuco"],
 "Ica": [-14.07,-75.73,"Ica"],
 "Junín": [-12.07,-75.21,"Huancayo"],
 "La Libertad": [-8.11,-79.03,"Trujillo"],
 "Lambayeque": [-6.77,-79.84,"Chiclayo"],
 "Lima": [-12.05,-77.04,"Lima"],
 "Loreto": [-3.75,-73.25,"Iquitos"],
 "Madre de Dios": [-12.59,-69.19,"Puerto Maldonado"],
 "Moquegua": [-17.19,-70.94,"Moquegua"],
 "Pasco": [-10.68,-76.26,"Cerro de Pasco"],
 "Piura": [-5.19,-80.63,"Piura"],
 "Puno": [-15.84,-70.02,"Puno"],
 "San Martín": [-6.03,-76.97,"Moyobamba"],
 "Tacna": [-18.01,-70.25,"Tacna"],
 "Tumbes": [-3.57,-80.45,"Tumbes"],
 "Ucayali": [-8.38,-74.53,"Pucallpa"]
};

const select = document.getElementById("department");
let selected = "Lima";
let geoLayer = null;
const departmentLayers = {};
let selectedDepartmentLayer = null;

const map = L.map("map", {zoomControl:true}).setView([-9.2,-75.0],5);

const satelliteLayer = L.tileLayer(
 "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
 {attribution:"Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics",maxZoom:18}
);
const streetLayer = L.tileLayer(
 "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
 {attribution:"© OpenStreetMap contributors",maxZoom:19}
);
satelliteLayer.addTo(map);

function normalize(s){
 return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
}

function focusDepartment(name){
 const layer = departmentLayers[normalize(name)];

 if(!layer)return false;

 if(selectedDepartmentLayer){
  selectedDepartmentLayer.setStyle({
   color:"#48d8f1",
   weight:1.5,
   fillColor:"#19a8c7",
   fillOpacity:0.08
  });
 }

 selectedDepartmentLayer = layer;

 layer.setStyle({
  color:"#ffe16b",
  weight:3,
  fillColor:"#25c9ee",
  fillOpacity:0.22
 });

 if(layer.bringToFront)layer.bringToFront();

 map.fitBounds(layer.getBounds(), {
  padding:[35,35],
  maxZoom:8,
  animate:true
 });

 return true;
}

function chooseDepartment(name, zoom=true){
 const match = Object.keys(departments).find(
  n=>normalize(n)===normalize(name)
 );

 if(!match)return;

 selected=match;
 select.value=match;

 const [lat,lon,capital]=departments[match];

 document.getElementById("weatherLocation").textContent=
  match+" · "+capital;

 if(zoom){
  if(!focusDepartment(match)){
   map.setView([lat,lon],7);
  }
 }

 loadWeather();
 updateSimulation();
}

select.addEventListener("change",()=>chooseDepartment(select.value));

document.getElementById("satellite").onclick=()=>{
 if(map.hasLayer(streetLayer))map.removeLayer(streetLayer);
 satelliteLayer.addTo(map);
};
document.getElementById("street").onclick=()=>{
 if(map.hasLayer(satelliteLayer))map.removeLayer(satelliteLayer);
 streetLayer.addTo(map);
};
document.getElementById("peru").onclick=()=>{
 if(geoLayer && geoLayer.getBounds().isValid()){
  map.fitBounds(geoLayer.getBounds(),{
   padding:[20,20],
   animate:true
  });
 }else{
  map.setView([-9.2,-75.0],5);
 }
};

fetch("/api/departamentos")
.then(r=>{
 if(!r.ok)throw Error("GeoJSON no disponible");
 return r.json();
})
.then(data=>{
 geoLayer=L.geoJSON(data,{
  style:{
   color:"#48d8f1",
   weight:1.5,
   fillColor:"#19a8c7",
   fillOpacity:0.08
  },
  onEachFeature:(feature,layer)=>{
   const props=feature.properties||{};
   const name=props.name||props.NAME||props.NOMBDEP;

   if(name){
    const key=normalize(name);
    departmentLayers[key]=layer;

    layer.bindTooltip(name,{
     sticky:true,
     direction:"top"
    });

    layer.on("mouseover",()=>{
     if(layer!==selectedDepartmentLayer){
      layer.setStyle({
       color:"#ffffff",
       weight:2.5,
       fillOpacity:0.17
      });
     }
    });

    layer.on("mouseout",()=>{
     if(layer!==selectedDepartmentLayer){
      layer.setStyle({
       color:"#48d8f1",
       weight:1.5,
       fillColor:"#19a8c7",
       fillOpacity:0.08
      });
     }
    });

    layer.on("click",()=>{
     chooseDepartment(name,true);
    });
   }
  }
 }).addTo(map);

 focusDepartment(selected);

 console.log(
  "Mapa geográfico cargado:",
  Object.keys(departmentLayers).length,
  "departamentos"
 );
})
.catch(err=>console.warn(
 "No se pudo cargar la capa departamental:",
 err
));

async function loadWeather(){
 const location=departments[selected];
 if(!location)return;

 const [lat,lon,capital]=location;
 document.getElementById("weatherDescription").textContent="Consultando información meteorológica...";

 try{
  const response=await fetch(
   "/api/clima/departamento?departamento="+encodeURIComponent(selected)
  );
  if(!response.ok){
   const error=await response.json();
   throw Error(error.detail||"Servicio meteorológico no disponible");
  }

  const d=await response.json();
  const c=d.current||{};
  const hourly=d.hourly||{};
  const daily=d.daily||{};

  const descriptions={
   0:"Despejado ☀️",1:"Mayormente despejado 🌤️",
   2:"Parcialmente nublado ⛅",3:"Nublado ☁️",
   45:"Niebla 🌫️",48:"Niebla con escarcha 🌫️",
   51:"Llovizna 🌦️",53:"Llovizna moderada 🌦️",
   55:"Llovizna intensa 🌧️",61:"Lluvia ligera 🌧️",
   63:"Lluvia moderada 🌧️",65:"Lluvia intensa 🌧️",
   80:"Chubascos 🌦️",81:"Chubascos moderados 🌧️",
   82:"Chubascos fuertes ⛈️",95:"Tormenta eléctrica ⛈️",
   96:"Tormenta con granizo ⛈️",99:"Tormenta fuerte ⛈️"
  };

  const fmt=(value,unit="")=>
   value===null||value===undefined?"--":value+unit;

  const times=hourly.time||[];
  const currentHour=(c.time||"").slice(0,13);
  let hourIndex=times.findIndex(t=>t.slice(0,13)===currentHour);
  if(hourIndex<0)hourIndex=0;

  document.getElementById("temperature").textContent=fmt(c.temperature_2m," °C");
  document.getElementById("rain").textContent=fmt(c.precipitation," mm");
  document.getElementById("humidity").textContent=fmt(c.relative_humidity_2m," %");
  document.getElementById("wind").textContent=fmt(c.wind_speed_10m," km/h");
  document.getElementById("weatherDescription").textContent=
   descriptions[c.weather_code]||"Condición meteorológica variable";

  document.getElementById("probability").textContent=
   fmt(hourly.precipitation_probability?.[hourIndex]," %");
  document.getElementById("feels").textContent=fmt(c.apparent_temperature," °C");
  document.getElementById("pressure").textContent=fmt(c.pressure_msl," hPa");
  document.getElementById("gust").textContent=fmt(c.wind_gusts_10m," km/h");

  const max=daily.temperature_2m_max?.[0];
  const min=daily.temperature_2m_min?.[0];
  const dailyRain=daily.precipitation_sum?.[0];

  document.getElementById("weatherLocation").textContent=
   selected+" · "+capital+" · "+(d.timezone||"Hora local");

  document.getElementById("weatherSource").textContent=
   "Fuente: Open-Meteo · Modelo meteorológico para "+capital+
   " · Registro de referencia: "+(c.time||"No disponible")+
   ". No es una medición directa de una estación SENAMHI."+
   " Máxima prevista: "+fmt(max," °C")+
   " · Mínima prevista: "+fmt(min," °C")+
   " · Lluvia diaria prevista: "+fmt(dailyRain," mm");

  drawForecast(hourly);

 }catch(e){
  document.getElementById("weatherDescription").textContent="Clima no disponible";
  document.getElementById("weatherSource").textContent=
   "No se pudo consultar el servicio meteorológico: "+e.message;
  console.error("Clima departamental:",e);
 }
}

function drawForecast(hourly){
 const canvas=document.getElementById("forecastChart");
 const ctx=canvas.getContext("2d");
 const w=canvas.clientWidth,h=180,ratio=window.devicePixelRatio||1;
 canvas.width=w*ratio;canvas.height=h*ratio;ctx.scale(ratio,ratio);
 ctx.clearRect(0,0,w,h);
 const vals=(hourly.precipitation||[]).slice(0,24);
 const probs=(hourly.precipitation_probability||[]).slice(0,24);
 if(!vals.length)return;
 const max=Math.max(5,...vals);
 ctx.strokeStyle="#2b465f";ctx.fillStyle="#91a9c0";ctx.font="10px Arial";
 for(let i=0;i<4;i++){
  let y=15+i*42;ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(w-8,y);ctx.stroke();
 }
 const step=(w-40)/vals.length;
 vals.forEach((v,i)=>{
  let bh=(v/max)*130;
  ctx.fillStyle="#27b8df";
  ctx.fillRect(28+i*step,155-bh,Math.max(3,step-3),bh);
 });
 ctx.fillStyle="#a9c3d8";
 ctx.fillText("Precipitación horaria (mm)",28,174);
}


// Controles sencillos del simulador.
function bindSimulationControl(inputId, outputId, suffix){
 const input=document.getElementById(inputId);
 const output=document.getElementById(outputId);
 if(!input||!output)return;
 const update=()=>output.textContent=input.value+suffix;
 input.addEventListener("input",update);
 update();
}

bindSimulationControl("simRainInput","simRainValue"," mm");
bindSimulationControl("simRiverInput","simRiverValue"," m");
bindSimulationControl("simDurationInput","simDurationValue"," h");

async function updateSimulation(){
 try{
  const rainValue=document.getElementById("simRainInput")?.value||40;
  const riverValue=document.getElementById("simRiverInput")?.value||1.5;
  const durationValue=document.getElementById("simDurationInput")?.value||6;
  const simulationUrl="/api/simulacion?departamento="+encodeURIComponent(selected)+
   "&lluvia_mm="+encodeURIComponent(rainValue)+
   "&nivel_rio_m="+encodeURIComponent(riverValue)+
   "&duracion_horas="+encodeURIComponent(durationValue);
  const r=await fetch(simulationUrl);
  const d=await r.json();
  const colors={"BAJO":"#4bd8a0","MEDIO":"#f1c45f","ALTO":"#ff9854","CRÍTICO":"#ff5c72"};
  document.getElementById("risk").textContent=d.riesgo+" · "+d.indice+"/100";
  document.getElementById("risk").style.color=colors[d.riesgo];
  document.getElementById("riskText").textContent=
   "Escenario configurable para "+d.departamento+" · "+d.capital+
   ". Datos introducidos por el usuario; no son mediciones reales ni una alerta oficial.";
  document.getElementById("riskBar").style.width=d.indice+"%";
  document.getElementById("riskBar").style.background=colors[d.riesgo];
  document.getElementById("riverLevel").textContent=d.nivel_rio+" m";
  document.getElementById("simRain").textContent=d.lluvia+" mm";
  document.getElementById("simUpdated").textContent="Última simulación: "+d.actualizado;
  document.getElementById("lastUpdate").textContent="Actualizado: "+d.actualizado;
 }catch(e){document.getElementById("riskText").textContent="Error al consultar el backend";}
}
document.getElementById("simulate").onclick=updateSimulation;

// ESCENA 3D DEMOSTRATIVA
let renderer,scene,camera,water,terrain,animating=false,waterValue=0.25,frame;
function init3D(){
 const container=document.getElementById("scene3d");
 if(!window.THREE){container.textContent="No se pudo cargar Three.js. Comprueba tu conexión.";return;}
 scene=new THREE.Scene();
 scene.background=new THREE.Color(0x071c30);
 scene.fog=new THREE.Fog(0x071c30,18,45);
 camera=new THREE.PerspectiveCamera(45,container.clientWidth/330,0.1,100);
 camera.position.set(9,8,12);
 camera.lookAt(0,0,0);
 renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.setSize(container.clientWidth,330);
 container.innerHTML="";
 container.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xb9e8ff,0x263d32,2));
 const sun=new THREE.DirectionalLight(0xffffff,2.2);
 sun.position.set(5,10,7);scene.add(sun);

 const geometry=new THREE.PlaneGeometry(14,14,70,70);
 const pos=geometry.attributes.position;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i);
  const height=0.35*Math.sin(x*0.7)*Math.cos(y*0.6)+
   0.7*Math.exp(-((x-3)**2+(y-2)**2)/8)+
   0.6*Math.exp(-((x+3)**2+(y+2)**2)/7);
  pos.setZ(i,height);
 }
 geometry.computeVertexNormals();
 terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
  color:0x426e52,roughness:1,side:THREE.DoubleSide
 }));
 terrain.rotation.x=-Math.PI/2;
 scene.add(terrain);

 const riverGeometry=new THREE.PlaneGeometry(2.4,14,1,1);
 water=new THREE.Mesh(riverGeometry,new THREE.MeshStandardMaterial({
  color:0x16a9df,transparent:true,opacity:0.7,roughness:0.2
 }));
 water.rotation.x=-Math.PI/2;
 water.position.set(0,-0.15,0);
 scene.add(water);

 const grid=new THREE.GridHelper(14,14,0x47738c,0x294b62);
 grid.position.y=-0.05;scene.add(grid);

 const animate=()=>{
  frame=requestAnimationFrame(animate);
  if(animating){
   waterValue+=0.0015;
   if(waterValue>1)waterValue=0;
   updateWater();
  }
  water.position.y=-0.45+waterValue*1.0;
  renderer.render(scene,camera);
 };
 animate();
}
function updateWater(){
 waterValue=Math.max(0,Math.min(1,waterValue));
 water.position.y=-0.45+waterValue*1.0;
 document.getElementById("waterLevel").value=Math.round(waterValue*100);
 document.getElementById("waterLabel").textContent=Math.round(waterValue*100)+"%";
}
document.getElementById("waterLevel").addEventListener("input",e=>{
 waterValue=Number(e.target.value)/100;updateWater();
});
document.getElementById("play3d").onclick=()=>{
 animating=!animating;
 document.getElementById("play3d").textContent=animating?"Ⅱ Pausar simulación":"▶ Iniciar simulación";
};
document.getElementById("reset3d").onclick=()=>{
 animating=false;waterValue=0.25;updateWater();
 document.getElementById("play3d").textContent="▶ Iniciar simulación";
};
window.addEventListener("resize",()=>{
 if(renderer&&camera){
  const c=document.getElementById("scene3d");
  camera.aspect=c.clientWidth/330;camera.updateProjectionMatrix();
  renderer.setSize(c.clientWidth,330);
 }
});
init3D();
chooseDepartment("Lima",false);

// =====================================================
// MONITOREO METEOROLÓGICO NACIONAL - 25 DEPARTAMENTOS
// =====================================================

function weatherName(code) {
    const labels = {
        0: "Despejado ☀️",
        1: "Mayormente despejado 🌤️",
        2: "Parcialmente nublado ⛅",
        3: "Nublado ☁️",
        45: "Niebla 🌫️",
        48: "Niebla 🌫️",
        51: "Llovizna 🌦️",
        53: "Llovizna 🌦️",
        55: "Llovizna intensa 🌧️",
        61: "Lluvia ligera 🌧️",
        63: "Lluvia moderada 🌧️",
        65: "Lluvia intensa 🌧️",
        80: "Chubascos 🌦️",
        81: "Chubascos 🌧️",
        82: "Chubascos fuertes ⛈️",
        95: "Tormenta ⛈️",
        96: "Tormenta con granizo ⛈️",
        99: "Tormenta fuerte ⛈️"
    };
    return labels[code] || "Condición variable";
}

async function loadNationalWeather() {
    const status = document.getElementById("nationalStatus");
    const body = document.getElementById("nationalWeatherBody");
    const button = document.getElementById("refreshNational");

    if (!status || !body) return;

    status.textContent = "Consultando los 25 departamentos...";
    if (button) button.disabled = true;

    try {
        const response = await fetch("/api/clima/nacional?actualizar=true");
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Servicio meteorológico no disponible");
        }

        const data = await response.json();

        body.innerHTML = "";

        data.departments.forEach(item => {
            const row = document.createElement("tr");

            const values = [
                item.department,
                item.capital,
                item.temperature == null ? "--" : item.temperature + " °C",
                item.precipitation == null ? "--" : item.precipitation + " mm",
                item.humidity == null ? "--" : item.humidity + " %",
                item.wind == null ? "--" : item.wind + " km/h",
                weatherName(item.weather_code)
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                if (index === 2) cell.className = "national-temp";
                row.appendChild(cell);
            });

            row.title = "Seleccionar " + item.department;
            row.addEventListener("click", () => {
                chooseDepartment(item.department);
                document.getElementById("clima").scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            });

            body.appendChild(row);
        });

        status.textContent =
            data.count + " departamentos consultados · Fuente: " +
            data.source + " · Actualización: " +
            new Date(data.updated_at).toLocaleString("es-PE");

    } catch (error) {
        status.textContent = "Error de conexión: " + error.message;
        console.error("Monitoreo nacional:", error);
    } finally {
        if (button) button.disabled = false;
    }
}

const nationalRefreshButton = document.getElementById("refreshNational");
if (nationalRefreshButton) {
    nationalRefreshButton.addEventListener("click", loadNationalWeather);
}

loadNationalWeather();
setInterval(loadNationalWeather, 10 * 60 * 1000);


// =====================================================
// CENTRO NACIONAL DE ALERTAS - DATOS DEL BACKEND
// =====================================================

let nationalRiskDepartments = [];

const riskElements = {
    status: document.getElementById("riskCenterStatus"),
    body: document.getElementById("riskDepartmentBody"),
    department: document.getElementById("riskDepartmentFilter"),
    level: document.getElementById("riskLevelFilter"),
    refresh: document.getElementById("refreshRisk"),
    tableStatus: document.getElementById("riskTableStatus"),
    alertMessage: document.getElementById("riskAlertMessage")
};

function riskNumber(value) {
    return value === null || value === undefined ? "--" : value;
}

function riskClass(level) {
    return ({
        "BAJO": "BAJO",
        "MEDIO": "MEDIO",
        "ALTO": "ALTO",
        "CRÍTICO": "CRÍTICO",
        "SIN DATOS": "SIN-DATOS"
    })[level] || "SIN-DATOS";
}

function renderRiskTable() {
    const departmentFilter = riskElements.department.value;
    const levelFilter = riskElements.level.value;

    const filtered = nationalRiskDepartments.filter(item => {
        const departmentMatch =
            !departmentFilter || item.department === departmentFilter;
        const levelMatch =
            !levelFilter || item.risk_level === levelFilter;
        return departmentMatch && levelMatch;
    });

    riskElements.body.innerHTML = "";

    if (!filtered.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = "No hay departamentos para estos filtros.";
        row.appendChild(cell);
        riskElements.body.appendChild(row);
    }

    filtered.forEach(item => {
        const row = document.createElement("tr");
        const values = [
            item.department,
            item.capital,
            item.meteorological_index === null
                ? "--"
                : item.meteorological_index + "/100",
            item.risk_level,
            item.precipitation_next_6h_mm === null
                ? "--"
                : item.precipitation_next_6h_mm + " mm",
            item.maximum_rain_probability_percent === null
                ? "--"
                : item.maximum_rain_probability_percent + " %"
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");
            if (index !== 3) cell.textContent = value;

            if (index === 2) cell.className = "risk-index";

            if (index === 3) {
                const pill = document.createElement("span");
                pill.className = "risk-pill " + riskClass(item.risk_level);
                pill.textContent = value;
                cell.appendChild(pill);
            }

            row.appendChild(cell);
        });

        row.title = "Ver " + item.department + " en el mapa";
        row.addEventListener("click", () => {
            chooseDepartment(item.department);
            document.getElementById("mapa-section").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        riskElements.body.appendChild(row);
    });

    riskElements.tableStatus.textContent =
        "Mostrando " + filtered.length + " de " +
        nationalRiskDepartments.length + " departamentos.";
}

function updateRiskSummary(summary, alertCount) {
    document.getElementById("countLow").textContent =
        riskNumber(summary["BAJO"]);
    document.getElementById("countMedium").textContent =
        riskNumber(summary["MEDIO"]);
    document.getElementById("countHigh").textContent =
        riskNumber(summary["ALTO"]);
    document.getElementById("countCritical").textContent =
        riskNumber(summary["CRÍTICO"]);
    document.getElementById("countAlerts").textContent =
        riskNumber(alertCount);

    if (alertCount > 0) {
        riskElements.alertMessage.textContent =
            "Atención: existen " + alertCount +
            " departamentos clasificados con riesgo ALTO o CRÍTICO. " +
            "Consulta las condiciones meteorológicas y los avisos oficiales.";
        riskElements.alertMessage.style.borderColor = "#9a593a";
    } else {
        riskElements.alertMessage.textContent =
            "No se registran departamentos en nivel ALTO o CRÍTICO " +
            "según el índice meteorológico consultado. Esto no descarta " +
            "peligros locales ni reemplaza los avisos oficiales.";
        riskElements.alertMessage.style.borderColor = "#5b482b";
    }
}

async function loadRiskCenter() {
    if (!riskElements.body) return;

    riskElements.status.textContent =
        "Consultando el índice meteorológico nacional...";
    riskElements.refresh.disabled = true;

    try {
        const [riskResponse, alertsResponse] = await Promise.all([
            fetch("/api/riesgo/nacional"),
            fetch("/api/alertas")
        ]);

        if (!riskResponse.ok) {
            throw new Error("No se pudo consultar el índice nacional.");
        }

        if (!alertsResponse.ok) {
            throw new Error("No se pudo consultar el servicio de alertas.");
        }

        const data = await riskResponse.json();
        const alerts = await alertsResponse.json();

        if (!Array.isArray(data.departments)) {
            throw new Error("La respuesta de riesgo no tiene departamentos.");
        }

        nationalRiskDepartments = data.departments;

        const summary = data.risk_summary || {};

        updateRiskSummary(summary, alerts.count ?? alerts.alerts?.length ?? 0);

        const currentDepartments = nationalRiskDepartments
            .map(item => item.department)
            .filter(Boolean);

        const previousValue = riskElements.department.value;

        riskElements.department.innerHTML =
            '<option value="">Todos los departamentos</option>';

        currentDepartments.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            riskElements.department.appendChild(option);
        });

        if (currentDepartments.includes(previousValue)) {
            riskElements.department.value = previousValue;
        }

        renderRiskTable();

        riskElements.status.textContent =
            data.count + " departamentos evaluados · Fuente: " +
            data.source + " · Actualización: " +
            new Date(data.updated_at).toLocaleString("es-PE");

    } catch (error) {
        riskElements.status.textContent =
            "Error al actualizar el centro de alertas: " + error.message;
        riskElements.alertMessage.textContent =
            "No se pudo verificar el estado nacional. Comprueba la conexión con el backend.";
        console.error("Centro Nacional de Alertas:", error);
    } finally {
        riskElements.refresh.disabled = false;
    }
}

riskElements.department.addEventListener("change", renderRiskTable);
riskElements.level.addEventListener("change", renderRiskTable);

riskElements.refresh.addEventListener("click", loadRiskCenter);

document.getElementById("clearRiskFilters").addEventListener("click", () => {
    riskElements.department.value = "";
    riskElements.level.value = "";
    renderRiskTable();
});

loadRiskCenter();
setInterval(loadRiskCenter, 10 * 60 * 1000);

