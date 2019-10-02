// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';
import { checkStringOrDate, meanOfSlice, isDef, stringify } from './util';
import * as seedcodec from './seedcodec';

import {Channel, InstrumentSensitivity} from './stationxml.js';
import {Quake} from './quakeml.js';
import {StartEndDuration } from './util';

export type HighLowType = {
      xScaleDomain: Array<number>;
      xScaleRange: Array<number>;
      secondsPerPixel: number;
      samplesPerPixel: number;
      highlowArray: Array<number>;
};

export type MarkerType = {
  name: string,
  time: moment,
  type: string,
  description: string
};

/**
* A contiguous segment of a Seismogram.
* @param  yArray array of Y sample values, ie the timeseries
* @param  sampleRate sample rate of the seismogram, hertz
* @param  startTime start time of seismogrm as a momentjs moment in utc or a string that can be parsed
*/
export class SeismogramSegment {
  /** Array of y values */
  _y: null | Int32Array | Float32Array | Float64Array;
  _compressed: null | Array<seedcodec.EncodedDataSegment>;
  /**  @private the sample rate in hertz */
  _sampleRate: number;
  /** @private */
  _startTime: moment;
  _endTime_cache: null | moment;
  _endTime_cache_numPoints: number;
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  yUnit: string;
  _highlow: HighLowType;
  constructor(yArray: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array,
              sampleRate: number,
              startTime: moment) {
    if (yArray instanceof Int32Array || yArray instanceof Float32Array || yArray instanceof Float64Array) {
      this._y = yArray;
      this._compressed = null;
    } else if (Array.isArray(yArray) && yArray.every( ee => ee instanceof seedcodec.EncodedDataSegment)) {
        this._compressed = yArray;
        this._y = null;
    } else if (Array.isArray(yArray) && yArray.every( ee => typeof ee === 'number')) {
      // numbers in js are 64bit, so...
      this._y = Float64Array.from(((yArray: any): Array<number>));
      this._compressed = null;
    }
    this._sampleRate = sampleRate;
    this._startTime = checkStringOrDate(startTime);
    this.yUnit = 'count';
    // to avoid recalc of end time as it is kind of expensive
    this._endTime_cache = null;
    this._endTime_cache_numPoints = 0;
  }
  /** Y data of the seismogram. Decompresses data if needed.
  */
  get y(): Int32Array | Float32Array | Float64Array {
    let out;
    if (this._y) {
      out = this._y;
    } else {
      if ( ! this.isEncoded()) {
        throw new Error("Seismogram not y as TypedArray or encoded.");
      }
      // data is still compressed
      let outLen = this.numPoints;

      if ( this._compressed === null) {
        // for flow
        throw new Error("Seismogram not y as TypedArray or encoded.");
      }
      if (this._compressed[0].compressionType === seedcodec.DOUBLE) {
        out = new Float64Array(outLen);
      } else if (this._compressed[0].compressionType === seedcodec.FLOAT) {
        out = new Float32Array(outLen);
      } else {
        out = new Int32Array(outLen);
      }
      let currIdx = 0;
      for (let c of this._compressed) {
        const cData = c.decode();
        for (let i=0; i<c.numSamples; i++) {
          out[currIdx+i] = cData[i];
        }
        currIdx += c.numSamples;
      }
      this._y = out;
      this._compressed = null;
    }
    return out;
  }
  set y(value: Int32Array | Float32Array | Float64Array) {
    this._y = value;
    this._invalidate_endTime_cache();
  }
  get startTime(): moment {
    return this._startTime;
  }
  set startTime(value: moment | string) {
    this._startTime = checkStringOrDate(value);
    this._invalidate_endTime_cache();
  }
  get endTime(): moment {
    if ( ! this._endTime_cache || this._endTime_cache_numPoints !== this.numPoints) {
      // array length modified, recalc cached end time
      this._endTime_cache_numPoints = this.numPoints;
      this._endTime_cache = this.timeOfSample(this._endTime_cache_numPoints-1);
    }
    return this._endTime_cache;
  }
  get sampleRate() {
    return this._sampleRate;
  }
  set sampleRate(value: number) {
    this._sampleRate = value;
    this._invalidate_endTime_cache();
  }
  get numPoints(): number {
    let out = 0;
    if (this._y) {
      out = this._y.length;
    } else if (this._compressed) {
      for (let c of this._compressed) {
        out += c.numSamples;
      }
    }
    return out;
  }
  get netCode(): string {
    return this.networkCode;
  }
  get staCode(): string {
    return this.stationCode;
  }
  get locId(): string {
    return this.locationCode;
  }
  get locCode(): string {
    return this.locationCode;
  }
  get chanCode(): string {
    return this.channelCode;
  }
  isEncoded(): boolean {
    if (this._y && this._y.length > 0) {
      return false;
    } else if (this._compressed && this._compressed.length > 0) {
      return true;
    } else {
      return false;
    }
  }
  getEncoded(): Array<seedcodec.EncodedDataSegment> {
    if (this.isEncoded()) {
      return ((this._compressed: any): Array<seedcodec.EncodedDataSegment>);
    } else {
      throw new Error("Data is not encoded.");
    }
  }
  yAtIndex(i: number): number {
    return this.y[i];
  }
  /** Finds the min and max values of a SeismogramSegment, with an optional
    * accumulator for use with gappy data. */
  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    let minAmp = Number.MAX_SAFE_INTEGER;
    let maxAmp = -1 * (minAmp);
    if ( minMaxAccumulator) {
      minAmp = minMaxAccumulator[0];
      maxAmp = minMaxAccumulator[1];
    }
    let yData = this.y;
    for (let n = 0; n < yData.length; n++) {
      if (minAmp > yData[n]) {
        minAmp = yData[n];
      }
      if (maxAmp < yData[n]) {
        maxAmp = yData[n];
      }
    }
    return [ minAmp, maxAmp ];
  }
  timeOfSample(i: number ): moment {
    return moment.utc(this.startTime).add(i/this.sampleRate, 'seconds');
  }
  hasCodes(): boolean {
    return isDef(this.networkCode)
      || isDef(this.stationCode)
      || isDef(this.locationCode)
      || isDef(this.channelCode);
  }
  /** @return nslc codes separated by '.'
  */
  codes(sep: string = '.'): string {
    return (this.networkCode ? this.networkCode : '')
    +sep+(this.stationCode ? this.stationCode : '')
    +sep+(this.locationCode ? this.locationCode : '')
    +sep+(this.channelCode ? this.channelCode : '');
  }
  seisId(): string {
   return (this.codes()+"_"+this.startTime.toISOString()+"_"+this.endTime.toISOString()).replace(/\./g,'_').replace(/:/g,'');
  }
  clone(): SeismogramSegment {
    let clonedData = this._y;
    if (clonedData !== null) {
      clonedData = clonedData.slice();
    } else if (this.isEncoded()) {
      // shallow copy array, assume Encoded is immutable
      clonedData = Array.from(this.getEncoded());
    } else {
      throw new Error("no _y and no _compressed");
    }
    return this.cloneWithNewData(clonedData);
  }

  cloneWithNewData(clonedData: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array,
    clonedStartTime: moment = this._startTime): SeismogramSegment {
    let out = new SeismogramSegment(clonedData,
                          this.sampleRate,
                          moment.utc(clonedStartTime));
    out.networkCode = this.networkCode;
    out.stationCode = this.stationCode;
    out.locationCode = this.locationCode;
    out.channelCode = this.channelCode;
    out.yUnit = this.yUnit;
    return out;
  }
  cut(timeWindow: StartEndDuration): SeismogramSegment | null {
    if (timeWindow.endTime.isBefore(this._startTime) || timeWindow.startTime.isAfter(this.endTime)) {
      return null;
    }
    let sIndex = 0;
    if (timeWindow.startTime.isAfter(this._startTime)) {
      let milliDiff = timeWindow.startTime.diff(this._startTime);
      let offset = milliDiff * this.sampleRate /1000.0;
      sIndex = Math.floor(offset);
    }
    let eIndex = this.y.length;
    if (timeWindow.endTime.isBefore(this.endTime)) {
      let milliDiff = moment.utc(this.endTime).diff(timeWindow.endTime);
      let offset = milliDiff * this.sampleRate /1000.0;
      eIndex = this.y.length - Math.floor(offset);
    }
    let cutY = this.y.slice(sIndex, eIndex);

    let out = this.cloneWithNewData(cutY,
        moment.utc(this._startTime).add(sIndex / this.sampleRate, 'seconds'));

    return out;
  }
  _invalidate_endTime_cache() {
    this._endTime_cache = null;
    this._endTime_cache_numPoints = 0;
  }
}

/** Represents time window for a single channel that may
  * contain gaps or overlaps, but is otherwise more or less
  * continuous, or at least adjacent data from the channel.
  * Each segment within
  * the Seismogram will have the same units, channel identifiers
  * and sample rate, but cover different times. */
export class Seismogram {
  _segmentArray: Array<SeismogramSegment>;
  _startTime: moment;
  _endTime: moment;
  _y: null | Int32Array | Float32Array | Float64Array;
  constructor(segmentArray: SeismogramSegment | Array<SeismogramSegment>) {
    this._y = null;
    if ( Array.isArray(segmentArray) && segmentArray[0] instanceof SeismogramSegment) {
      this._segmentArray = segmentArray;
    } else if ( segmentArray instanceof SeismogramSegment) {
      this._segmentArray = [ segmentArray ];
    } else {
      throw new Error(`segmentArray is not Array<SeismogramSegment> or SeismogramSegment: ${stringify(segmentArray)}`);
    }
    this.checkAllSimilar();
    this.findStartEnd();
  }
  checkAllSimilar() {
    if (this._segmentArray.length === 0) {throw new Error("Seismogram is empty");}
    let f = this._segmentArray[0];
    this._segmentArray.forEach((s, i) => {
      if (! s) {
        throw new Error(`index ${i} is null in trace`);
      }
      this.checkSimilar(f, s);
    });
  }
  checkSimilar(f: SeismogramSegment, s: SeismogramSegment) {
    if (s.networkCode !== f.networkCode) {throw new Error("NetworkCode not same: "+s.networkCode+" !== "+f.networkCode);}
    if (s.stationCode !== f.stationCode) {throw new Error("StationCode not same: "+s.stationCode+" !== "+f.stationCode);}
    if (s.locationCode !== f.locationCode) {throw new Error("LocationCode not same: "+s.locationCode+" !== "+f.locationCode);}
    if (s.channelCode !== f.channelCode) {throw new Error("ChannelCode not same: "+s.channelCode+" !== "+f.channelCode);}
    if (s.yUnit !== f.yUnit) {throw new Error("yUnit not same: "+s.yUnit+" !== "+f.yUnit);}
    if (s.sampleRate !== f.sampleRate) {throw new Error("SampleRate not same: "+s.sampleRate+" !== "+f.sampleRate);}
  }
  findStartEnd() {
    let allStart = this._segmentArray.map(seis => {
      return moment.utc(seis.startTime);
    });
    this._startTime = moment.min(allStart);
    let allEnd = this._segmentArray.map(seis => {
      return moment.utc(seis.endTime);
    });
    this._endTime = moment.max(allEnd);
  }
  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    if (this._segmentArray.length === 0) {
      throw new Error("No data");
    }
    for (let s of this._segmentArray) {
      minMaxAccumulator = s.findMinMax(minMaxAccumulator);
    }
    if (minMaxAccumulator){
      return minMaxAccumulator;
    } else {
      // should never happen, for flow
      throw new Error("No data to calc minmax");
    }
  }
  /**
   * calculates the mean of a seismogrma.
   * @param   seis input seismogram
   * @return       mean value
   */
  mean(): number {
    let meanVal = 0;

    let npts = this.numPoints;
    for (let s of this.segments) {
      meanVal += meanOfSlice(s.y, s.y.length)*s.numPoints;
    }
    meanVal = meanVal / npts;
    return meanVal;
  }

  get startTime(): moment {
    return this._startTime;
  }
  get endTime(): moment {
    return this._endTime;
  }
  get networkCode(): string {
    return this._segmentArray[0].networkCode;
  }
  set networkCode(value: string) {
    this._segmentArray.forEach(s => s.networkCode = value);
  }
  get stationCode(): string {
    return this._segmentArray[0].stationCode;
  }
  set stationCode(value: string) {
    this._segmentArray.forEach(s => s.stationCode = value);
  }
  get locationCode(): string {
    return this._segmentArray[0].locationCode;
  }
  set locationCode(value: string) {
    this._segmentArray.forEach(s => s.locationCode = value);
  }
  get channelCode(): string {
    return this._segmentArray[0].channelCode;
  }
  set channelCode(value: string) {
    this._segmentArray.forEach(s => s.channelCode = value);
  }
  get sampleRate(): number {
    return this._segmentArray[0].sampleRate;
  }
  get yUnit(): string {
    return this._segmentArray[0].yUnit;
  }
  get numPoints(): number {
    return this._segmentArray.reduce((accumulator, seis) => accumulator + seis.numPoints, 0);
  }
  hasCodes(): boolean {
    return this._segmentArray[0].hasCodes();
  }
  codes(): string {
    return this._segmentArray[0].codes();
  }
  get segments(): Array<SeismogramSegment> {
    return this._segmentArray;
  }
  append(seismogram: SeismogramSegment | Seismogram) {
    if (seismogram instanceof Seismogram) {
      seismogram._segmentArray.forEach(s => this.append(s));
    } else {
      this.checkSimilar(this._segmentArray[0], seismogram);
      this._startTime = moment.min([ this.startTime, moment.utc(seismogram.startTime)]);
      this._endTime = moment.max([ this.endTime, moment.utc(seismogram.endTime)]);
      this._segmentArray.push(seismogram);
    }
  }
  /**
   * Cut the seismogram. Creates a new seismogram with all datapoints
   * contained in the time window.
   * @param  timeWindow start and end of cut
   * @return            new seismogram
   */
  cut(timeWindow: StartEndDuration): null | Seismogram {
    // coarse trim first
    let out = this.trim(timeWindow);
    if (out && out._segmentArray) {
      let cutSeisArray = this._segmentArray.map(seg => seg.cut(timeWindow)).filter(Boolean);
      if (cutSeisArray.length > 0) {
        out = new Seismogram(cutSeisArray);
      }
    }
    return out;
  }
  /**
    * Creates a new Seismogram composed of all seismogram segments that overlap the
    * given time window. If none do, this returns null. This is a faster but coarser
    * version of cut as it only removes whole segments that do not overlap the
    * time window. For most seismograms that consist of a single contiguous
    * data segment, this will do nothing.
    * @see cut
    */
  trim(timeWindow: StartEndDuration): null | Seismogram {
    let out = null;
    if (this._segmentArray) {
      let trimSeisArray = this._segmentArray.filter(function(d) {
        return d.endTime.isAfter(timeWindow.startTime);
      }).filter(function(d) {
        return d.startTime.isBefore(timeWindow.endTime);
      });
      if (trimSeisArray.length > 0) {
        out = new Seismogram(trimSeisArray);
      }
    }
    return out;
  }
  break(duration: moment.Duration) {
    if (this._segmentArray) {
      let breakStart = moment.utc(this.startTime);
      let out = [];
      while (breakStart.isBefore(this.endTime)) {
        let breakWindow = new StartEndDuration(breakStart, null, duration);
        let cutSeisArray = this._segmentArray.map(seg => seg.cut(breakWindow));
        out = out.concat(cutSeisArray);
        breakStart.add(duration);
      }
      // check for null, filter true if seg not null
      out = out.filter(Boolean);
      this._segmentArray = out;
    }
    return this;
  }
  isContiguous() {
    if (this._segmentArray.length === 1) {
      return true;
    }
    let prev = null;
    for (const s of this._segmentArray) {
      if (prev && ! (prev.endTime.isBefore(s.startTime)
          && prev.endTime.add(1000*1.5/prev.sampleRate, 'ms').isAfter(s.startTime))) {
        return false;
      }
      prev = s;
    }
    return true;
  }
  merge(): Int32Array | Float32Array | Float64Array {
    let outArray;
    if (this._segmentArray[0].y instanceof Int32Array) {
      outArray = new Int32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float32Array) {
      outArray = new Float32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float64Array) {
      outArray = new Float64Array(this.numPoints);
    } else {
      throw new Error(`data not one of Int32Array, Float32Array or Float64Array: ${this._segmentArray[0].y.constructor.name}`);
    }
    let i=0;
    this._segmentArray.forEach( seg => {
      for(let v of seg.y) {
        outArray[i] = v;
        i++;
      }
    });
    return outArray;
  }
  /**
   * Gets the timeseries as an typed array if it is contiguous.
   * @throws {NonContiguousData} if data is not contiguous.
   * @return  timeseries as array of number
   */
  get y(): Int32Array | Float32Array | Float64Array {
    if ( ! this._y) {
      if (this.isContiguous()) {
        this._y = this.merge();
      }
    }
    if (this._y) {
      return this._y;
    } else {
      throw new Error("Seismogram is not contiguous, acces each SeismogramSegment idividually.");
    }
  }
  set y(val: Int32Array | Float32Array | Float64Array ) {
    // ToDo
    throw new Error("seismogram y setter not impl, see cloneWithNewData()");
  }
  clone(): Seismogram {
    let cloned = this._segmentArray.map( s => s.clone());
    return new Seismogram(cloned);
  }

  cloneWithNewData(newY: Int32Array | Float32Array | Float64Array): Seismogram {
    if (newY && newY.length > 0) {
      let seg = this._segmentArray[0].cloneWithNewData(newY);
      return new Seismogram([seg]);
    } else {
      throw new Error("Y value is empty");
    }
  }
  /** factory method to create a single segment Seismogram from either encoded data
   *  or a TypedArray, along with sample rate and start time.
  */
  static createFromContiguousData(yArray: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array,
                                  sampleRate: number,
                                  startTime: moment) {
    const seg = new SeismogramSegment(yArray, sampleRate, startTime);
    return new Seismogram([seg]);
  }
}

export class NonContiguousData extends Error {
  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export function ensureIsSeismogram(seisSeismogram: Seismogram | SeismogramSegment) {
  if (typeof seisSeismogram === "object") {
    if (seisSeismogram instanceof Seismogram) {
      return seisSeismogram;
    } else if (seisSeismogram instanceof SeismogramSegment) {
      return new Seismogram([ seisSeismogram ]);
    } else {
      let s = typeof seisSeismogram;
      if (seisSeismogram.prototype && seisSeismogram.prototype.constructor) {
        s += " "+seisSeismogram.prototype.constructor.name;
      } else {
        s += " "+seisSeismogram;
      }
      throw new Error("must be Seismogram or SeismogramSegment but "+s);
    }
  } else {
    throw new Error("must be Seismogram or SeismogramSegment but not an object");
  }
}


export class SeismogramDisplayData {
  /** @private */
  _seismogram: Seismogram | null;
  label: string | null;
  markerList: Array<MarkerType>;
  channel: Channel | null;
  _instrumentSensitivity: InstrumentSensitivity | null;
  quakeList: Array<Quake>;
  timeWindow: StartEndDuration;
  alignmentTime: moment | null;
  doShow: boolean;
  _statsCache: SeismogramDisplayStats | null;
  constructor(timeWindow: StartEndDuration) {
    if ( ! timeWindow) {
      throw new Error("StartEndDuration must not be missing.");
    }
    this._seismogram = null;
    this.label = null;
    this.markerList = [];
    this.channel = null;
    this._instrumentSensitivity = null;
    this.quakeList = [];
    this.timeWindow = timeWindow;
    this.alignmentTime = null;
    this.doShow = true;
    this._statsCache = null;
  }
  static fromSeismogram(seismogram: Seismogram ): SeismogramDisplayData {
    const out = new SeismogramDisplayData(new StartEndDuration(seismogram.startTime, seismogram.endTime, null, null));
    out.seismogram = seismogram;
    return out;
  }
  static fromChannelAndTimeWindow(channel: Channel, timeWindow: StartEndDuration): SeismogramDisplayData {
    const out = new SeismogramDisplayData(timeWindow);
    out.channel = channel;
    return out;
  }
  static fromChannelAndTimes(channel: Channel, startTime: moment, endTime: moment): SeismogramDisplayData {
    const out = new SeismogramDisplayData(new StartEndDuration(startTime, endTime));
    out.channel = channel;
    return out;
  }
  addQuake(quake: Quake | Array<Quake> ) {
    if (Array.isArray(quake)) {
      quake.forEach(q => this.quakeList.push(q));
    } else {
      this.quakeList.push(quake);
    }
  }
  addMarkers(markers: MarkerType | Array<MarkerType>) {
      if (Array.isArray(markers)) {
        markers.forEach(m => this.markerList.push(m));
      } else {
        this.markerList.push(markers);
      }
  }
  hasQuake(): boolean {
    return this.quakeList.length > 0;
  }
  hasChannel(): boolean {
    return this.channel !== null;
  }
  hasSensitivity(): boolean {
    return this._instrumentSensitivity !== null
        || (isDef(this.channel) && this.channel.hasInstrumentSensitivity());
  }
  get startTime(): moment {
    return this.timeWindow.startTime;
  }
  get endTime(): moment {
    return this.timeWindow.endTime;
  }
  get sensitivity(): InstrumentSensitivity | null {
    const channel = this.channel;
    if (this._instrumentSensitivity) {
      return this._instrumentSensitivity;
    } else if (isDef(channel) && channel.hasInstrumentSensitivity()) {
      return channel.instrumentSensitivity;
    } else {
      return null;
    }
  }
  set sensitivity(value: InstrumentSensitivity | null) {
    this._instrumentSensitivity = value;
  }
  get min() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.min;
  }
  get max() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.max;
  }
  get mean() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.mean;
  }
  get seismogram() {
    return this._seismogram;
  }
  set seismogram(value: Seismogram | null) {
    this._seismogram = value;
    this._statsCache = null;
  }
  calcStats() {
    let stats = new SeismogramDisplayStats();
    if (this.seismogram) {
      let minMax = this.seismogram.findMinMax();
      stats.min = minMax[0];
      stats.max = minMax[1];
      // $FlowFixMe  know seismogram is not null
      stats.mean = this.seismogram.mean();
    }
    this._statsCache = stats;
    return stats;
  }
  clone(): SeismogramDisplayData {
    return this.cloneWithNewSeismogram(this.seismogram ? this.seismogram.clone() : null);
  }
  cloneWithNewSeismogram(seis: Seismogram | null): SeismogramDisplayData {
      let out = new SeismogramDisplayData(this.timeWindow);
      Object.getOwnPropertyNames(this).forEach( name => {
        if (name === 'seismogram') {
          out.seismogram = seis;
        // $FlowFixMe
        } else if (this[name] instanceof moment) {
          // $FlowFixMe
          out[name] = moment.utc(this[name]);
          // $FlowFixMe
        } else if ( Array.isArray(this[name]) ) {
          // $FlowFixMe
          out[name] = this[name].slice();
        } else {
          // $FlowFixMe
          out[name] = this[name];
        }
      });
      return out;
  }
}

export class SeismogramDisplayStats {
  min: number;
  max: number;
  mean: number;
  trendSlope: number;
  constructor() {
    this.min = 0;
    this.max = 0;
    this.mean = 0;
    this.trendSlope = 0;
  }
}

export function findStartEnd(sddList: Array<SeismogramDisplayData>): StartEndDuration {
  let allStart = sddList.map(sdd => {
    return moment.utc(sdd.timeWindow.startTime);
  });
  let startTime = moment.min(allStart);
  let allEnd = sddList.map(sdd => {
    return moment.utc(sdd.timeWindow.endTime);
  });
  let endTime = moment.max(allEnd);
  return new StartEndDuration(startTime, endTime);
}

export function findMinMax(sddList: Array<SeismogramDisplayData>): Array<number> {
  let min = sddList.map(sdd => {
    return sdd.min;
  }).reduce(function (p, v) {
    return ( p < v ? p : v );
  });
  let max = sddList.map(sdd => {
    return sdd.max;
  }).reduce(function (p, v) {
    return ( p > v ? p : v );
  });
  return [min, max];
}

const initial_minAmp = Number.MAX_SAFE_INTEGER;
const initial_maxAmp = -1 * (initial_minAmp);

export function findMinMaxOverTimeRange(sddList: Array<SeismogramDisplayData>, timeWindow: StartEndDuration): Array<number> {
  let minMaxArr = sddList.map(sdd => {
      if (sdd.seismogram) {
        const cutSeis = sdd.seismogram.cut(timeWindow);
        if (cutSeis) {
          return cutSeis.findMinMax();
        }
      }
      return [initial_minAmp,initial_maxAmp];
    });
  let min = minMaxArr.map(mm => {
    return mm[0];
  }).reduce(function (p, v) {
    return ( p < v ? p : v );
  });
  let max = minMaxArr.map(mm => {
    return mm[1];
  }).reduce(function (p, v) {
    return ( p > v ? p : v );
  });
  return [min, max];
}


export function findStartEndOfSeismograms(data: Array<Seismogram>, accumulator?: StartEndDuration): StartEndDuration {
  let out: StartEndDuration;
  if ( ! accumulator && ! data) {
    throw new Error("data and accumulator are not defined");
  } else if ( ! accumulator) {
    out = new StartEndDuration( moment.utc('2500-01-01'), moment.utc('1001-01-01'));
  } else {
    out = accumulator;
  }
  if ( Array.isArray(data)) {
    for (let s of data) {
      if ( s.startTime < out.startTime) {
        out = new StartEndDuration( moment.utc(s.startTime), out.endTime);
      }
      if ( out.endTime < s.endTime ) {
        out = new StartEndDuration( out.startTime, moment.utc(s.endTime));
      }
    }
  } else {
    throw new Error(`Expected Array as first arg but was: ${typeof data}`);
  }
  return out;
}


export function findMinMaxOfSeismograms(data: Array<Seismogram> , minMaxAccumulator ?: Array<number>): Array<number> {
  for(let s of data) {
    minMaxAccumulator = s.findMinMax(minMaxAccumulator);
  }
  if (minMaxAccumulator) {
    return minMaxAccumulator;
  } else {
    return [-1, 1];
  }
}
