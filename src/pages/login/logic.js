// Logic for the login page, carried over from design/Login.dc.html with the runtime base
// class swapped for the shim in src/dc.js. Patches applied by the converter: desk route; login copy reflects the server-side accounts; login footer reflects scrypt + server sessions; login: second step when the account has TOTP enabled; login: submit the authenticator code; login: copy for the TOTP step; login: TOTP blurb and labels; login: TOTP submit label; login: TOTP blurb; login footer: session policy.
/* eslint-disable */
import React from 'react';
import { DCLogic } from '../../dc.js';

class Component extends DCLogic {
  static T = { noir: ['Noir', '#0b0b0c', '255,236,190'], cold: ['Cold case', '#0e0d0b', '220,200,160'], midnight: ['Midnight', '#070b16', '170,200,255'], warroom: ['War room', '#0a1410', '220,255,200'], redroom: ['Red room', '#160608', '255,200,200'], daylight: ['Daylight', '#d9d2c3', '255,255,255'], mono: ['Mono', '#000000', '255,255,255'], terminal: ['Terminal', '#030604', '120,255,160'], amber: ['Amber CRT', '#060402', '255,190,80'], blueprint: ['Blueprint', '#0b1d3a', '120,200,255'], bureau: ['Bureau 1972', '#2b2118', '255,220,160'], arctic: ['Arctic', '#e8edf2', '255,255,255'] };
  static DESK = 'cyber-investigation-board.desk.v1';
  readTheme() { try { const d = JSON.parse(localStorage.getItem(Component.DESK) || '{}'); return Component.T[d.theme] ? d.theme : 'noir'; } catch (e) { return 'noir'; } }
  setTheme = e => { const v = e.target.value; try { const d = JSON.parse(localStorage.getItem(Component.DESK) || '{}'); d.theme = v; localStorage.setItem(Component.DESK, JSON.stringify(d)); } catch (err) {} this.setState({ theme: v }); };
  state = { theme: this.readTheme(), mode: window.CIBAuth && window.CIBAuth.hasUsers() ? 'login' : 'setup', name: '', pass: '', pass2: '', error: '', busy: false, shake: false, user: null };
  componentDidMount() { const A = window.CIBAuth; if (A) { const u = A.user(); if (u && !u.mustChange) return this.go(); } setTimeout(() => { const el = document.querySelector('[data-first]') || document.querySelector('input[type=password]'); if (el) el.focus(); }, 80); }
  next() { const m = String(location.hash || '').match(/next=([^&]+)/); return m ? decodeURIComponent(m[1]) : (this.props.deskFile || "/desk.html"); }
  go() { if (window.CIBFoley) window.CIBFoley.play('latch'); setTimeout(() => location.replace(this.next()), 220); }
  submit = async () => {
    const A = window.CIBAuth, s = this.state; if (!A || s.busy) return;
    this.setState({ busy: true, error: '' });
    try {
      if (s.mode === 'setup') { if (s.pass !== s.pass2) throw new Error('Passwords do not match'); await A.createUser({ name: s.name, pass: s.pass, role: 'admin' }); await A.login(s.name, s.pass); return this.go(); }
      if (s.mode === 'totp') { const u2 = await A.loginTotp(s.challenge, s.pass); if (u2.mustChange) return this.setState({ mode: 'change', user: u2, pass: '', pass2: '', busy: false }); return this.go(); }
      if (s.mode === 'change') { if (s.pass !== s.pass2) throw new Error('Passwords do not match'); await A.setPassword(s.user.id, s.pass, false, s.user.name); return this.go(); }
      const u = await A.login(s.name, s.pass);
      if (u.totpRequired) return this.setState({ mode: 'totp', challenge: u.challenge, pass: '', busy: false });
      if (u.mustChange) return this.setState({ mode: 'change', user: u, pass: '', pass2: '', busy: false });
      this.go();
    } catch (e) { if (window.CIBFoley) window.CIBFoley.play('close'); this.setState({ error: String(e && e.message || e), busy: false, shake: true, pass: '', pass2: '' }); setTimeout(() => this.setState({ shake: false }), 500); }
  };
  renderVals() {
    const s = this.state, setup = s.mode === 'setup', change = s.mode === 'change', totp = s.mode === 'totp';
    return {
      hasSso: !setup && !change && !totp && !!(window.CIBAuth && window.CIBAuth.sso()), ssoLabel: (window.CIBAuth && window.CIBAuth.sso() || {}).label || 'Single sign-on', sso: () => { const o = window.CIBAuth.sso(); if (o) location.href = o.start + '?next=' + encodeURIComponent(this.next()); },
      title: setup ? 'Open the office.' : change ? 'Choose a new password.' : totp ? 'Second factor.' : 'Sign in.',
      blurb: setup ? 'No accounts exist yet. The first account becomes the administrator; add analysts, reviewers and viewers from the desk afterwards.' : change ? 'Your password was reset by an administrator. Set your own before continuing.' : totp ? 'This account has two-factor authentication on. Enter the six-digit code from your authenticator app.' : 'Accounts, roles and sessions are kept on the server. Passwords are hashed with scrypt and never stored in the browser.',
      askName: !change && !totp, askConfirm: setup || change, passLabel: setup || change ? 'PASSWORD · 8+ CHARACTERS' : totp ? 'AUTHENTICATOR CODE · 6 DIGITS' : 'PASSWORD', passAuto: setup || change ? 'new-password' : totp ? 'one-time-code' : 'current-password',
      name: s.name, pass: s.pass, pass2: s.pass2, onName: e => this.setState({ name: e.target.value }), onPass: e => this.setState({ pass: e.target.value }), onPass2: e => this.setState({ pass2: e.target.value }), onKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.submit(); } },
      hasError: !!s.error, error: s.error, submit: this.submit, submitLabel: s.busy ? 'Checking…' : setup ? 'Create admin account' : change ? 'Save and continue' : totp ? 'Verify code' : 'Sign in',
      cardAnim: s.shake ? 'shake .4s ease' : 'cardIn .5s ease-out both',
      theme: s.theme, themes: Object.keys(Component.T).map(id => ({ id, label: Component.T[id][0] })), onTheme: this.setTheme, navBack: () => history.back(), navFwd: () => history.forward(), navReload: () => location.reload(),
      deskBg: (Component.T[s.theme] || Component.T.noir)[1], lampGrad: 'radial-gradient(70% 55% at 50% -5%, rgba(' + (Component.T[s.theme] || Component.T.noir)[2] + ',.17) 0%, rgba(' + (Component.T[s.theme] || Component.T.noir)[2] + ',0) 60%), radial-gradient(130% 110% at 50% 60%, rgba(0,0,0,0) 40%, rgba(0,0,0,' + ((Component.T[s.theme] || Component.T.noir)[1] > '#8' ? .18 : .8) + ') 100%)', hasPublic: !setup && !change && !!(window.CIBAuth && window.CIBAuth.hasPublic()), guest: () => { window.CIBAuth.guest(); this.go(); },
      foot: setup ? 'Passwords are hashed with scrypt on the server and never stored in the browser. There is no recovery without another admin.' : 'Sessions last 12 hours and lock after 15 minutes idle; ten wrong passwords lock the account for 15 minutes. Forgotten password: ask an administrator to reset it.',
    };
  }
}

export default Component;
