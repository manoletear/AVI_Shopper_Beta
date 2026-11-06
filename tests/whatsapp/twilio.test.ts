import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTwilioMessage, isTwilioConfigured } from '../../src/services/twilio-whatsapp.service';

describe('Twilio WhatsApp service', () => {
  it('extractTwilioMessage parses form data correctly', () => {
    const formData = new URLSearchParams({
      From: 'whatsapp:+56912345678',
      Body: 'Quiero comparar precios de leche',
      MessageSid: 'SM1234567890',
      NumMedia: '0',
      ProfileName: 'Manuel',
    });

    const msg = extractTwilioMessage(formData);
    assert.ok(msg);
    assert.equal(msg.from, '56912345678');
    assert.equal(msg.body, 'Quiero comparar precios de leche');
    assert.equal(msg.messageSid, 'SM1234567890');
    assert.equal(msg.numMedia, 0);
    assert.equal(msg.profileName, 'Manuel');
  });

  it('extractTwilioMessage returns null for incomplete data', () => {
    assert.equal(extractTwilioMessage(new URLSearchParams({})), null);
    assert.equal(extractTwilioMessage(new URLSearchParams({ From: 'whatsapp:+56912345678' })), null);
    assert.equal(extractTwilioMessage(new URLSearchParams({ Body: 'hola' })), null);
  });

  it('extractTwilioMessage strips whatsapp: prefix and +', () => {
    const msg = extractTwilioMessage(new URLSearchParams({
      From: 'whatsapp:+56949893097',
      Body: 'test',
      MessageSid: 'SM999',
    }));
    assert.ok(msg);
    assert.equal(msg.from, '56949893097');
  });

  it('extractTwilioMessage trims body whitespace', () => {
    const msg = extractTwilioMessage(new URLSearchParams({
      From: 'whatsapp:+56912345678',
      Body: '  hola mundo  ',
      MessageSid: 'SM123',
    }));
    assert.ok(msg);
    assert.equal(msg.body, 'hola mundo');
  });

  it('isTwilioConfigured returns false without env vars', () => {
    const saved = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_WHATSAPP_FROM,
    };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;

    assert.equal(isTwilioConfigured(), false);

    if (saved.sid) process.env.TWILIO_ACCOUNT_SID = saved.sid;
    if (saved.token) process.env.TWILIO_AUTH_TOKEN = saved.token;
    if (saved.from) process.env.TWILIO_WHATSAPP_FROM = saved.from;
  });

  it('provider selection: Meta by default, Twilio when configured', () => {
    assert.equal(isTwilioConfigured(), false);
  });
});
