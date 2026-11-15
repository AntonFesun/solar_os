import { balanceResidual } from '../domain/balance';
import { FixtureSiteApi } from './fixture-site-api';
import { DEFAULT_SETTINGS, SITE_ID } from '../model/site-model';

describe('FixtureSiteApi', () => {
  it('patches settings in memory and keeps one balanced snapshot', () => {
    const api = new FixtureSiteApi();
    const before = api.getLive(SITE_ID).solarW;
    const next = api.patchSettings(SITE_ID, { name: 'North Barn', pvCapacityW: 1500, theme: 'light' });

    expect(next.name).toBe('North Barn');
    expect(next.theme).toBe('light');
    expect(api.getSettings(SITE_ID).pvCapacityW).toBe(1500);
    expect(api.getLive(SITE_ID).solarW).toBeLessThan(before);
    expect(balanceResidual(api.getLive(SITE_ID))).toBeCloseTo(0, 6);
    expect(api.getSolar(SITE_ID).powerW).toBe(api.getLive(SITE_ID).solarW);
    expect(api.getBattery(SITE_ID).soc).toBeCloseTo(api.getLive(SITE_ID).batterySoc, 6);
  });

  it('rejects an unknown site and ignores a blank name', () => {
    const api = new FixtureSiteApi();
    expect(() => api.getLive('other-site')).toThrow(/Unknown DEMO site/);
    api.patchSettings(SITE_ID, { name: '   ' });
    expect(api.getSettings(SITE_ID).name).toBe(DEFAULT_SETTINGS.name);
  });
});
