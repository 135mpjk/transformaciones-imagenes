// ===============  Geometría (coordenadas homogéneas)  ===============
export function rotMatrix(thetaRad){
  const c = Math.cos(thetaRad), s = Math.sin(thetaRad);
  return [
    [ c,-s, 0],
    [ s, c, 0],
    [ 0, 0, 1],
  ];
}
export function transMatrix(tx,ty){
  return [
    [1,0,tx],
    [0,1,ty],
    [0,0, 1],
  ];
}
export function scaleMatrix(sx,sy){
  return [
    [sx,0, 0],
    [0,sy, 0],
    [0 ,0, 1],
  ];
}
export function reflectXMatrix(width){
  return [
    [-1,0,width-1],
    [ 0,1,0],
    [ 0,0,1],
  ];
}
export function reflectYMatrix(height){
  return [
    [1, 0,0],
    [0,-1,height-1],
    [0, 0,1],
  ];
}

export function matMul(A,B){
  const R=[[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++)
    for(let j=0;j<3;j++)
      R[i][j]=A[i][0]*B[0][j]+A[i][1]*B[1][j]+A[i][2]*B[2][j];
  return R;
}
export function matVec(M,[x,y,one=1]){
  return [
    M[0][0]*x + M[0][1]*y + M[0][2]*one,
    M[1][0]*x + M[1][1]*y + M[1][2]*one,
    1
  ];
}

export function rotateAroundCenter(width,height,deg){
  const theta = deg*Math.PI/180;
  const T1 = transMatrix(-width/2,-height/2);
  const R  = rotMatrix(theta);
  const T2 = transMatrix(width/2,height/2);
  return matMul(T2, matMul(R, T1));
}
export function scaleAroundCenter(width,height,sx,sy){
  const T1 = transMatrix(-width/2,-height/2);
  const S  = scaleMatrix(sx,sy);
  const T2 = transMatrix(width/2,height/2);
  return matMul(T2, matMul(S, T1));
}

// ===============  Filtros de color (RGB)  ===============
export function grayscaleRGB([r,g,b]){
  const I = 0.3*r + 0.59*g + 0.11*b;
  return [I,I,I,255];
}
export function negativeRGB([r,g,b]){
  return [255-r, 255-g, 255-b, 255];
}

// Utilidades HTML
export function matrixToHTML(M,prec=3){
  const rows = M.map(row => row.map(v => (Math.abs(v)<1e-12?0:v).toFixed(prec)));
  return `<div class="eq">[${rows[0].join('&nbsp;&nbsp;')}]<br>[${rows[1].join('&nbsp;&nbsp;')}]<br>[${rows[2].join('&nbsp;&nbsp;')}]</div>`;
}
export function vecToHTML(v,prec=2,label='p'){
  const [x,y] = v;
  return `<div class="eq">${label} = [${x.toFixed(prec)}, ${y.toFixed(prec)}, 1]^T</div>`;
}
export function detailedDotHTML(M, x, y){
  const a11=M[0][0], a12=M[0][1], a13=M[0][2];
  const a21=M[1][0], a22=M[1][1], a23=M[1][2];
  const xp = a11*x + a12*y + a13;
  const yp = a21*x + a22*y + a23;
  return `
    <p><b>Cómo se calcula la nueva posición:</b></p>
    <p class="eq">x' = ${a11.toFixed(3)}·${x} + ${a12.toFixed(3)}·${y} + ${a13.toFixed(3)}·1 = <span class="hl">${xp.toFixed(2)}</span></p>
    <p class="eq">y' = ${a21.toFixed(3)}·${x} + ${a22.toFixed(3)}·${y} + ${a23.toFixed(3)}·1 = <span class="hl">${yp.toFixed(2)}</span></p>
  `;
}
