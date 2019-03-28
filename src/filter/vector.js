//@flow
import {Seismogram, Trace, ensureIsTrace } from '../model/seismogram';

export const DtoR = Math.PI / 180;

export function rotate(seisA: Trace | Seismogram, azimuthA: number, seisB: Trace | Seismogram, azimuthB: number, azimuth: number) {
  const traceA = ensureIsTrace(seisA);
  const traceB = ensureIsTrace(seisB);
  if (traceA.segments.length !== traceB.segments.length) {
    throw new Error("Traces do not have same number of segments: "+traceA.segments.length+" !== "+traceB.segments.length);
  }
  let rotOutRad = [];
  let rotOutTrans = [];
  for( let i=0; i< traceA.segments.length; i++) {
    let result = rotateSeismograms(traceA.segments[i], azimuthA,
                                   traceB.segments[i], azimuthB, azimuth);
    rotOutRad.push(result.radial);
    rotOutTrans.push(result.transverse);
  }
  let out = {
    "radial": new Trace(rotOutRad),
    "transverse": new Trace(rotOutTrans),
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}

export function rotateSeismograms(seisA: Seismogram, azimuthA: number, seisB: Seismogram, azimuthB: number, azimuth: number) {
  if (seisA.y.length != seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate != seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if ((azimuthA + 90) % 360 != azimuthB % 360) {
    throw new Error("Expect azimuthB to be azimuthA + 90, but was "+azimuthA+" "+azimuthB);
  }
//  [   cos(theta)    -sin(theta)    0   ]
//  [   sin(theta)     cos(theta)    0   ]
//  [       0              0         1   ]
// seisB => x
// seisA => y
// sense of rotation is opposite for aziumth vs math
  const rotRadian = 1 * DtoR * (azimuth - azimuthA);
  const cosTheta = Math.cos(rotRadian);
  const sinTheta = Math.sin(rotRadian);
  let x = new Array(seisA.y.length);
  let y = new Array(seisA.y.length);
  for (var i = 0; i < seisA.y.length; i++) {
    x[i] = cosTheta * seisB.yAtIndex(i) - sinTheta * seisA.yAtIndex(i);
    y[i] = sinTheta * seisB.yAtIndex(i) + cosTheta * seisA.yAtIndex(i);
  }
  let outSeisRad = seisA.clone();
  outSeisRad.y = y;
  outSeisRad.channelCode = seisA.chanCode.slice(0,2)+"R";
  let outSeisTan = seisA.clone();
  outSeisTan.y = x;
  outSeisTan.channelCode = seisA.chanCode.slice(0,2)+"T";
  let out = {
    "radial": outSeisRad,
    "transverse": outSeisTan,
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}
export function vectorMagnitude(seisA: Seismogram, seisB: Seismogram, seisC: Seismogram) {
  if (seisA.y.length != seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate != seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if (seisA.y.length != seisC.y.length) {
    throw new Error("seisA and seisC should be of same lenght but was "
    +seisA.y.length+" "+seisC.y.length);
  }
  if (seisA.sampleRate != seisC.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisC.sampleRate);
  }
  let y = new Array(seisA.y.length);
  for (var i = 0; i < seisA.y.length; i++) {
    y[i] = Math.sqrt(seisA.yAtIndex(i) * seisA.yAtIndex(i)
      + seisB.yAtIndex(i) * seisB.yAtIndex(i)
      + seisC.yAtIndex(i) * seisC.yAtIndex(i));
  }
  let outSeis = seisA.clone();
  outSeis.y = y;
  outSeis.channelCode = seisA.chanCode.slice(0,2)+"M";
  return outSeis;
}