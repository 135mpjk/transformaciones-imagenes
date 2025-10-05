import {
  rotateAroundCenter, scaleAroundCenter, transMatrix,
  reflectXMatrix, reflectYMatrix, matVec, matrixToHTML, vecToHTML,
  grayscaleRGB, negativeRGB, detailedDotHTML
} from "./transformations.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("fileInput");
const transformSelect = document.getElementById("transformSelect");
const resetBtn = document.getElementById("resetBtn");
const info = document.getElementById("matrixInfo");

const zoom = document.getElementById("zoomCanvas");
const zctx = zoom.getContext("2d");
const mathPanel = document.getElementById("mathPanel");

// Wizard
const prevBtn = document.getElementById("prevStepBtn");
const nextBtn = document.getElementById("nextStepBtn");

let image = new Image();
let origImgData = null;

// píxel seleccionado (puede cambiar con click)
let sel = { x:0, y:0, pPrime:null };

canvas.width = 640; canvas.height = 380;
ctx.fillStyle = "#111"; ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.fillStyle = "#a0b3ff";
ctx.font = "16px Segoe UI, Arial";
ctx.fillText("Carga una imagen para comenzar…", 16, 28);

// -------- Carga de imagen ----------
dropArea.addEventListener("click", () => fileInput.click());
dropArea.addEventListener("dragover", e => e.preventDefault());
dropArea.addEventListener("drop", (e)=>{
  e.preventDefault();
  handleFile({ target:{ files: e.dataTransfer.files }});
});
fileInput.addEventListener("change", handleFile);

function handleFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    image = new Image();
    image.src = ev.target.result;
    image.onload = ()=>{
      canvas.width = image.width; canvas.height = image.height;
      ctx.drawImage(image,0,0);
      origImgData = ctx.getImageData(0,0,canvas.width,canvas.height);
      info.innerHTML = "<b>Imagen cargada.</b> Usa el modo guiado para ver la explicación completa.";
      setSelectedPixel(Math.floor(canvas.width/2), Math.floor(canvas.height/2));
      resetWizard();
      updateParamVisibility();
    };
  };
  reader.readAsDataURL(f);
}

// -------- Elegir píxel con click ----------
canvas.addEventListener("click", (e)=>{
  if(!origImgData) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  setSelectedPixel(x,y);
  step = 0;
  runStep(); // vuelve a explicar desde el inicio con el nuevo píxel
});

function setSelectedPixel(x,y){
  sel.x = Math.max(0, Math.min(canvas.width-1, x));
  sel.y = Math.max(0, Math.min(canvas.height-1, y));
  drawZoomPixel("Píxel elegido");
}

// -------- Mostrar/ocultar parámetros ----------
transformSelect.addEventListener("change", ()=>{
  updateParamVisibility();
  resetWizard();
});
function updateParamVisibility(){
  document.querySelectorAll(".param").forEach(p=>p.classList.add("hidden"));
  if (transformSelect.value==="rotate") document.getElementById("angleControl").classList.remove("hidden");
  if (transformSelect.value==="scale")  document.getElementById("scaleControl").classList.remove("hidden");
  if (transformSelect.value==="translate") document.getElementById("translateControl").classList.remove("hidden");
}

// -------- Botón restaurar ----------
resetBtn.addEventListener("click", ()=>{
  if(!origImgData) return;
  ctx.putImageData(origImgData,0,0);
  resetWizard();
  drawZoomPixel("Píxel elegido");
  info.innerHTML = "<b>Imagen restaurada.</b>";
});

// =====================  WIZARD (paso a paso)  =====================
/*
  Pasos claros (solo columna derecha):
   1) Elegimos un píxel y por qué usamos [x,y,1]^T.
   2) Construimos la matriz de la transformación (o regla del filtro).
   3) Calculamos la nueva posición o el nuevo color (con cuentas).
   4) Mostramos el movimiento (geom) o aplicamos al píxel (filtro).
   5) Aplicamos a toda la imagen (barrido progresivo).
*/
let step = 0;
let sweepTimer = null;

function resetWizard(){
  step = 0;
  clearTimers();
  if(origImgData) ctx.putImageData(origImgData,0,0);
  mathPanel.innerHTML = "";
  explainStep0();
  updateButtons();
}
function clearTimers(){
  if(sweepTimer){ clearInterval(sweepTimer); sweepTimer=null; }
}
function updateButtons(){
  prevBtn.disabled = (step<=0);
}

function selectedPixel(){ return {x:sel.x, y:sel.y}; }

function drawZoomPixel(label="Píxel elegido"){
  if(!origImgData){ zctx.fillStyle="#000"; zctx.fillRect(0,0,zoom.width,zoom.height); return; }
  const {x,y}=selectedPixel();

  const Z=9; // 9x9 celdas
  const cell = Math.floor(zoom.width / Z);
  zctx.fillStyle="#000"; zctx.fillRect(0,0,zoom.width,zoom.height);
  const {width:w,height:h}=canvas;
  const src = origImgData.data;

  for(let j=0;j<Z;j++){
    for(let i=0;i<Z;i++){
      const px = Math.min(w-1, Math.max(0, x - Math.floor(Z/2) + i));
      const py = Math.min(h-1, Math.max(0, y - Math.floor(Z/2) + j));
      const idx = (py*w+px)*4;
      const r=src[idx], g=src[idx+1], b=src[idx+2];
      zctx.fillStyle=`rgb(${r},${g},${b})`;
      zctx.fillRect(i*cell, j*cell, cell, cell);
      zctx.strokeStyle="rgba(255,255,255,.15)";
      zctx.strokeRect(i*cell, j*cell, cell, cell);
    }
  }
  zctx.strokeStyle="#ffd166"; zctx.lineWidth=2;
  const c = Math.floor(Z/2);
  zctx.strokeRect(c*cell+1, c*cell+1, cell-2, cell-2);

  zctx.fillStyle="#cfe1ff"; zctx.font="12px Segoe UI, Arial";
  zctx.fillText(`${label}: (${x}, ${y})`, 8, zoom.height-8);
}



function explainStep0(){
  if(!origImgData){ mathPanel.innerHTML="<span class='muted'>Carga una imagen para comenzar.</span>"; return; }
  const {x,y}=selectedPixel();
  mathPanel.innerHTML = `
    <p><b>1) Elegimos un píxel.</b></p>
    <p>Este punto está en la posición <span class="hl">(${x}, ${y})</span> dentro de la imagen.</p>
    <p>Para poder sumar desplazamientos con matrices, lo escribimos como <b>vector columna</b> con un 1 extra:</p>
    ${vecToHTML([x,y],0,'p')}
    <p class="muted">Ese “1” permite que la matriz añada traslaciones además de giros o escalas.</p>
  `;
  ctx.putImageData(origImgData,0,0);
  ctx.strokeStyle="#ffd166"; ctx.lineWidth=2;
  ctx.strokeRect(x-3,y-3,6,6);
}

function currentMatrixAndText(){
  const t = transformSelect.value;
  const w=canvas.width, h=canvas.height;
  if (t==="rotate"){
    const angle = parseFloat(document.getElementById("angleInput").value)||0;
    const M = rotateAroundCenter(w,h,angle);
    return {M, title:`2) Construimos la matriz de <b>rotación</b>`, desc:`Girar la imagen ${angle}° alrededor del centro mueve cada punto sin cambiar su distancia al centro.`};
  }
  if (t==="scale"){
    const sx=parseFloat(document.getElementById("scaleXInput").value)||1;
    const sy=parseFloat(document.getElementById("scaleYInput").value)||1;
    const M= scaleAroundCenter(w,h,sx,sy);
    return {M, title:`2) Construimos la matriz de <b>escalamiento</b>`, desc:`Multiplica distancias: en X por ${sx} y en Y por ${sy}. El área cambia por sx·sy.`};
  }
  if (t==="translate"){
    const tx=parseFloat(document.getElementById("txInput").value)||0;
    const ty=parseFloat(document.getElementById("tyInput").value)||0;
    const M= transMatrix(tx,ty);
    return {M, title:`2) Construimos la matriz de <b>traslación</b>`, desc:`Suma un desplazamiento fijo: +${tx} en X y +${ty} en Y.`};
  }
  if (t==="reflectX"){
    const M= reflectXMatrix(w);
    return {M, title:`2) Construimos la matriz de <b>reflexión vertical</b>`, desc:`Invierte izquierda↔derecha dentro del ancho de la imagen.`};
  }
  if (t==="reflectY"){
    const M= reflectYMatrix(h);
    return {M, title:`2) Construimos la matriz de <b>reflexión horizontal</b>`, desc:`Invierte arriba↔abajo dentro del alto de la imagen.`};
  }
  return {M:null,title:"",desc:""};
}

function explainStep1(){
  const {x,y}=selectedPixel();
  const kind = transformSelect.value;
  if(kind==="grayscale"||kind==="negative"){
    mathPanel.innerHTML = `
      <p><b>2) Regla del filtro de color.</b></p>
      ${
        kind==="grayscale"
        ? `<p>Convertimos el color (R,G,B) del píxel en un gris parecido a cómo lo ve el ojo humano:</p>
           <p class="eq">I = 0.3·R + 0.59·G + 0.11·B</p>`
        : `<p>Para el negativo, a cada canal le restamos su valor a 255 (así invertimos el color):</p>
           <p class="eq">R' = 255 - R,&nbsp; G' = 255 - G,&nbsp; B' = 255 - B</p>`
      }
    `;
    return;
  }
  const {M,title,desc} = currentMatrixAndText();
  mathPanel.innerHTML = `
    <p><b>${title}</b></p>
    <p>${desc}</p>
    ${matrixToHTML(M)}
    <p>Aplicaremos esta misma matriz a <b>todos</b> los puntos de la imagen, empezando por nuestro píxel.</p>
    ${vecToHTML([x,y],0,'p')}
  `;
}

function explainStep2(){
  const {x,y}=selectedPixel();
  const kind = transformSelect.value;
  const src = origImgData.data, w=canvas.width;
  const idx=(sel.y*w+sel.x)*4;
  const rgb=[src[idx],src[idx+1],src[idx+2]];

  if(kind==="grayscale"){
    const I = (0.3*rgb[0] + 0.59*rgb[1] + 0.11*rgb[2])|0;
    mathPanel.innerHTML = `
      <p><b>3) Calculamos el nuevo color del píxel.</b></p>
      <p class="eq">I = 0.3·${rgb[0]} + 0.59·${rgb[1]} + 0.11·${rgb[2]} = <span class="hl">${I}</span></p>
      <p class="eq">Color final = [${I}, ${I}, ${I}]</p>
      <p>Pintamos ese valor en el píxel elegido.</p>
    `;
    ctx.putImageData(origImgData,0,0);
    ctx.fillStyle=`rgb(${I},${I},${I})`;
    ctx.fillRect(sel.x, sel.y, 1, 1);
    return;
  }
  if(kind==="negative"){
    const out=[255-rgb[0], 255-rgb[1], 255-rgb[2]];
    mathPanel.innerHTML = `
      <p><b>3) Calculamos el nuevo color del píxel.</b></p>
      <p class="eq">[R',G',B'] = [255-${rgb[0]}, 255-${rgb[1]}, 255-${rgb[2]}] = <span class="hl">[${out[0]}, ${out[1]}, ${out[2]}]</span></p>
      <p>Pintamos ese valor en el píxel elegido.</p>
    `;
    ctx.putImageData(origImgData,0,0);
    ctx.fillStyle=`rgb(${out[0]},${out[1]},${out[2]})`;
    ctx.fillRect(sel.x, sel.y, 1, 1);
    return;
  }

  // geométricas
  const {M} = currentMatrixAndText();
  const [nx,ny] = matVec(M,[x,y,1]);
  sel.pPrime = [nx,ny];
  mathPanel.innerHTML = `
    <p><b>3) Calculamos la nueva posición del píxel.</b></p>
    ${vecToHTML([x,y],0,'p')}
    ${detailedDotHTML(M, x, y)}
    <p>El píxel debe pasar de <span class="hl">(${x}, ${y})</span> a <span class="hl">(${nx.toFixed(2)}, ${ny.toFixed(2)})</span>.</p>
  `;
  ctx.putImageData(origImgData,0,0);
  drawPoint(x,y,"#ffd166");
  drawPoint(nx,ny,"#2ecc71");
  drawArrow(x,y,nx,ny,"#2ecc71");
}

function explainStep3(){
  const kind = transformSelect.value;
  if(kind==="grayscale"||kind==="negative"){
    progressiveFilterSweep(kind);
    mathPanel.innerHTML += `<p><b>4) Aplicamos el mismo cálculo a todos los píxeles.</b> Verás cómo se va completando la imagen.</p>`;
    return;
  }
  const [x,y]=[sel.x, sel.y];
  const [nx,ny]=sel.pPrime || [x,y];
  mathPanel.innerHTML += `<p><b>4) Mostramos el movimiento del píxel.</b> Lo desplazamos paso a paso desde (${x}, ${y}) hasta (${nx.toFixed(2)}, ${ny.toFixed(2)}).</p>`;
  animatePixelMove(x,y,nx,ny);
}

function explainStep4(){
  const kind = transformSelect.value;
  if(kind==="grayscale"||kind==="negative"){
    return; // ya se hace en el paso anterior
  }
  mathPanel.innerHTML += `<p><b>5) Aplicamos la misma operación a toda la imagen.</b> Vamos recorriendo las filas poco a poco.</p>`;
  progressiveGeometrySweep();
}

function drawPoint(x,y,color){
  ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.strokeRect(Math.round(x)-3,Math.round(y)-3,6,6);
}
function drawArrow(x1,y1,x2,y2,color="#2ecc71"){
  ctx.strokeStyle=color; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}

function animatePixelMove(x,y,nx,ny){
  const steps = 30;
  const dx=(nx-x)/steps, dy=(ny-y)/steps;
  let k=0;
  const id = setInterval(()=>{
    if(!origImgData){ clearInterval(id); return; }
    ctx.putImageData(origImgData,0,0);
    const cx = x + dx*k, cy = y + dy*k;
    drawPoint(cx,cy,"#2ecc71");
    drawArrow(x,y,cx,cy,"#2ecc71");
    k++;
    if(k>steps){ clearInterval(id); }
  }, 18);
}

// Barrido progresivo (geom)
function progressiveGeometrySweep(){
  if(sweepTimer) clearInterval(sweepTimer);
  const {width:w,height:h}=canvas;
  const src = origImgData;
  const s = src.data;
  const dst = ctx.createImageData(w,h);
  const d = dst.data;
  const {M}=currentMatrixAndText();
  let row=0;
  sweepTimer=setInterval(()=>{
    for(let r=0;r<4 && row<h;r++,row++){
      for(let x=0;x<w;x++){
        const i=(row*w+x)*4;
        const [nx,ny]=matVec(M,[x,row]);
        const xi=Math.round(nx), yi=Math.round(ny);
        if(xi>=0&&xi<w&&yi>=0&&yi<h){
          const j=(yi*w+xi)*4;
          d[j]=s[i]; d[j+1]=s[i+1]; d[j+2]=s[i+2]; d[j+3]=255;
        }
      }
    }
    ctx.putImageData(dst,0,0);
    info.innerHTML = `<small>Procesando fila ${Math.min(row,h)} de ${h}…</small>`;
    if(row>=h){ clearInterval(sweepTimer); info.innerHTML = `<small>Completado.</small>`; }
  }, 28);
}

// Barrido progresivo (filtro)
function progressiveFilterSweep(kind){
  if(sweepTimer) clearInterval(sweepTimer);
  const {width:w,height:h}=canvas;
  const src = origImgData.data;
  const dst = ctx.createImageData(w,h);
  const d = dst.data;

  let row=0;
  sweepTimer=setInterval(()=>{
    for(let r=0;r<6 && row<h;r++,row++){
      for(let x=0;x<w;x++){
        const i=(row*w+x)*4;
        const rgb=[src[i],src[i+1],src[i+2]];
        const out = (kind==="grayscale") ? grayscaleRGB(rgb) : negativeRGB(rgb);
        d[i]=out[0]; d[i+1]=out[1]; d[i+2]=out[2]; d[i+3]=255;
      }
    }
    ctx.putImageData(dst,0,0);
    info.innerHTML = `<small>Procesando fila ${Math.min(row,h)} de ${h}…</small>`;
    if(row>=h){ clearInterval(sweepTimer); info.innerHTML = `<small>Completado.</small>`; }
  }, 28);
}

// ---- Navegación de pasos ----
prevBtn.addEventListener("click", ()=>{ if(step>0){ step--; runStep(); }});
nextBtn.addEventListener("click", ()=>{ step++; runStep(); });

function runStep(){
  if(!origImgData){ mathPanel.innerHTML="<span class='muted'>Carga una imagen primero.</span>"; return; }
  ctx.putImageData(origImgData,0,0);
  if(step<=0){ explainStep0(); return; }
  if(step===1){ explainStep1(); return; }
  if(step===2){ explainStep2(); return; }
  if(step===3){ explainStep3(); return; }
  if(step>=4){ explainStep4(); return; }
}
