// @flow

import { FedCatalogQuery } from '../src/irisfedcatalog.js';
import { allChannels } from '../src/stationxml.js';
import { StartEndDuration } from '../src/util.js';
import { SeismogramDisplayData } from '../src/seismogram.js';
import { isDef } from '../src/util.js';
import moment from 'moment';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


test("station queries test", () => {

    let fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    return fedCatQuery.setupQueryFdsnStation('network').then(parsedResult => {
      expect(parsedResult.queries).toHaveLength(1);
      expect(parsedResult.queries[0]).toBeDefined();
    });
});

test("live parse result", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const LEVEL = 'station';
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  fedCatQuery._level = LEVEL;
  fedCatQuery.targetService('station');
  return fedCatQuery.queryRaw().then(function(parsedResult) {
    expect(parsedResult.queries).toHaveLength(1);
    expect(parsedResult.params.get('level')).toEqual(LEVEL);
  });
});

test("run BK networks", () => {
    let fedCatQuery = new FedCatalogQuery();
    const NET = 'BK';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    return fedCatQuery.queryNetworks().then(netArray => {
      expect(netArray).toHaveLength(2);
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[1]).toBeDefined();
      expect(netArray[1].networkCode).toBe(NET);
    });
});

test("run CO active stations", () => {
    let fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    expect(fedCatQuery.endAfter(moment.utc('2021-01-01'))).toBe(fedCatQuery);
    expect(fedCatQuery.startBefore(moment.utc('2021-01-01'))).toBe(fedCatQuery);
    return fedCatQuery.queryStations().then(netArray => {
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[0].stations).toHaveLength(10);
    });
});

test("channels for CO", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:10:00Z');
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    expect(netList).toHaveLength(1);
    const net = netList[0];
    expect(net.stations).toHaveLength(1);
    expect(net.stations[0].channels).toHaveLength(1);
  });
});


test( "run dataselect test", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = "HHZ";
  const START = moment.utc('2020-09-01T00:00:00Z');
  const END = moment.utc('2020-09-01T00:10:00Z');
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  expect(fedCatQuery.networkCode()).toBe(NET);
  expect(fedCatQuery.stationCode(STA)).toBe(fedCatQuery);
  expect(fedCatQuery.locationCode(LOC)).toBe(fedCatQuery);
  expect(fedCatQuery.channelCode(CHAN)).toBe(fedCatQuery);
  expect(fedCatQuery.startTime(START)).toBe(fedCatQuery);
  expect(fedCatQuery.endTime(END)).toBe(fedCatQuery);
  return fedCatQuery.queryFdsnDataselect().then(sddList => {
    expect(sddList).toHaveLength(1);
    expect(sddList[0]).toBeDefined();
    expect(sddList[0].networkCode).toBe(NET);
    expect(sddList[0].stationCode).toBe(STA);
    expect(sddList[0].locationCode).toBe(LOC);
    expect(sddList[0].channelCode).toBe(CHAN);
    expect(sddList[0].seismogram).toBeDefined();
  });
});


test("seismograms for CO.BIRD for timewindow", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:01:00Z');
  const sed = new StartEndDuration(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryFdsnDataselect().then(sddList => {
    expect(sddList).toHaveLength(1);
    const sdd = sddList[0];
    expect(sdd.stationCode).toEqual(STA);
    expect(sdd.channelCode).toEqual(CHAN);
    // for flow
    const seismogram = isDef(sdd.seismogram) ? sdd.seismogram : null;
    expect(seismogram).toBeDefined();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.isContiguous()).toBeTrue();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.y).toHaveLength(sed.duration.asSeconds()*100+1);
  });
});


test("sddlist seismograms for CO.BIRD for timewindow", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:01:00Z');
  const sed = new StartEndDuration(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    let sddList = [];
    for(let c of allChannels(netList)) {
      sddList.push(SeismogramDisplayData.fromChannelAndTimeWindow(c, sed));
    }
    expect(sddList).toHaveLength(1);
    return sddList;
  }).then(sddList => {
    return fedCatQuery.postQuerySeismograms(sddList);
  }).then(sddList => {
    expect(sddList).toHaveLength(1);
    const sdd = sddList[0];
    expect(sdd.stationCode).toEqual(STA);
    expect(sdd.channelCode).toEqual(CHAN);

    const seismogram = isDef(sdd.seismogram) ? sdd.seismogram : null;
    expect(seismogram).toBeDefined();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.isContiguous()).toBeTrue();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.y).toHaveLength(sed.duration.asSeconds()*100+1);
  });
});