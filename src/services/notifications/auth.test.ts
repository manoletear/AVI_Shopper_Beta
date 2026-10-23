import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCronAuthorized } from './auth';
import { whatsappChannel, pushChannel } from './channels';

describe('avisos', () => {
  it('el cron exige la clave', () => {
    assert.equal(isCronAuthorized('Bearer secreto', 'secreto'), true);
    assert.equal(isCronAuthorized('Bearer otro', 'secreto'), false);
    assert.equal(isCronAuthorized(null, undefined), false);
  });

  it('WhatsApp y el push no envían aunque exista una clave', async () => {
    const draft = { userId: 'u', title: 't', message: 'm', level: 'info' as const, dedupeTitle: 't' };
    assert.equal(await whatsappChannel({ WHATSAPP_TOKEN: 'x', WHATSAPP_PHONE_ID: '1' }).deliver(draft), 'skipped');
    assert.equal(await pushChannel({ PUSH_API_KEY: 'x' }).deliver(draft), 'skipped');
  });
});
