// Logic for the board page, carried over from design/Investigation Board.dc.html with the runtime base
// class swapped for the shim in src/dc.js. Patches applied by the converter: desk/login/board routes; desk route; desk route (bookmarklet string); server mode: an empty visible set does not re-seed the sample cases; server mode: start a blank case instead of the sample when the user has none; board applies other people's changes arriving from the server; legal hold: the board refuses to delete a held case; enrichment on pin: indicators added to the board are looked up once; enrichment when an inbox indicator is pinned; CORS proxy goes through our own allow-listed server endpoint instead of allorigins.win; jget routes CORS-blocked hosts through the proxy; media blobs are mirrored to the server file store; media blobs missing locally are fetched from the server.
/* eslint-disable */
import React from 'react';
import { DCLogic } from '../../dc.js';

class Component extends DCLogic {
  static K = (() => {
    const RED = '#ff2a3c';
    const TYPES = {
      photo: { label: 'Photo', w: 220, title: 'Untitled photo' },
      note: { label: 'Note', w: 180, title: '' },
      link: { label: 'Link', w: 240, title: 'Untitled link' },
      person: { label: 'Person', w: 210, title: 'Unknown subject' },
      indicator: { label: 'Indicator', w: 230, title: '' },
      doc: { label: 'Document', w: 220, title: 'Untitled document' },
      event: { label: 'Event', w: 200, title: 'Untitled event' },
      location: { label: 'Location', w: 220, title: 'Unknown location' },
      ttp: { label: 'Technique', w: 210, title: '' },
      tx: { label: 'Transfer', w: 240, title: '' },
      target: { label: 'Target', w: 220, title: 'Unknown organisation' },
      video: { label: 'Video', w: 240, title: 'Untitled video' }, audio: { label: 'Audio', w: 220, title: 'Untitled recording' }, pdf: { label: 'PDF', w: 240, title: 'Untitled PDF' }, email: { label: 'Email', w: 250, title: 'Untitled email' }, code: { label: 'Log / code', w: 260, title: 'Snippet' }, feed: { label: 'Live feed', w: 260, title: 'Feed' }, monitor: { label: 'Monitor', w: 230, title: 'Site watch' },
      vehicle: { label: 'Vehicle', w: 220, title: 'Unknown vehicle' }, object: { label: 'Object', w: 220, title: 'Unknown object' }, statement: { label: 'Statement', w: 240, title: 'Statement' },
    };
    const RELS = [
      { id: 'linked', label: 'linked to', color: RED },
      { id: 'suspected', label: 'suspected', color: RED, dash: true },
      { id: 'alias', label: 'alias of', color: '#f1ede2' },
      { id: 'controls', label: 'controls', color: '#e8a71c' },
      { id: 'resolves', label: 'resolves to', color: '#4ea1e8' },
      { id: 'located', label: 'located at', color: '#4bbf6b' },
    ];
    return {
      RED, TYPES, ORDER: Object.keys(TYPES), RELS, REL: Object.fromEntries(RELS.map(r => [r.id, r])),
      KINDS: { domain: 'Domain', ip: 'IP address', url: 'URL', hash: 'File hash', handle: 'Handle', email: 'Email', wallet: 'Wallet', cve: 'CVE', phone: 'Phone' },
      PIN: {
        red: ['#ff9ba1', RED, '#6b0a10'], brass: ['#ffe9a3', '#c9962a', '#5a3d0a'],
        person: ['#ff9ba1', RED, '#6b0a10'], indicator: ['#ffe2a0', '#e8a71c', '#6b4a0e'], link: ['#bfe0ff', '#4ea1e8', '#123a66'],
        location: ['#c8f5d4', '#4bbf6b', '#124d26'], note: ['#ffffff', '#cfc9b8', '#4e4a40'], photo: ['#e4e4ff', '#8c8cf0', '#2d2d70'],
        doc: ['#e6e6e6', '#8a8a8a', '#2e2e2e'], event: ['#ffd0d0', '#c04040', '#4a0606'], ttp: ['#e6d5ff', '#9b6bff', '#2e1a66'], tx: ['#c9f5ef', '#2fc4b2', '#0e4d45'], target: ['#ffd9b0', '#e07a2f', '#5a2a08'], video: ['#d9d9ff', '#6c6cf0', '#22226b'], audio: ['#d9d9ff', '#6c6cf0', '#22226b'], pdf: ['#e0dcd2', '#b9b3a6', '#4a463f'], email: ['#ffe2a0', '#e8a71c', '#6b4a0e'], code: ['#cfd3c3', '#7f8a6a', '#2d3324'], feed: ['#ffd9b0', '#e07a2f', '#5a2a08'], monitor: ['#c9f5ef', '#2fc4b2', '#0e4d45'], vehicle: ['#bfe0ff', '#4ea1e8', '#123a66'], object: ['#e0dcd2', '#b9b3a6', '#4a463f'], statement: ['#fff6c2', '#e0c84a', '#5a4d0e'],
      },
      TYPE_COLOR: { person: RED, indicator: '#e8a71c', link: '#4ea1e8', location: '#4bbf6b', event: '#f1ede2', doc: '#b9b3a6', note: '#f3e58c', photo: '#8c8cf0', ttp: '#9b6bff', tx: '#2fc4b2', target: '#e07a2f', video: '#6c6cf0', audio: '#6c6cf0', pdf: '#b9b3a6', email: '#e8a71c', code: '#7f8a6a', feed: '#e07a2f', monitor: '#2fc4b2', vehicle: '#4ea1e8', object: '#b9b3a6', statement: '#e0c84a' },
      MONTHS: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
      KEY: 'cyber-investigation-board.v1',
      STAMPS: [['', 'None', ''], ['confirmed', 'Confirmed', '#3fae63'], ['unverified', 'Unverified', RED], ['false', 'False lead', '#9a948a']],
      STAMP_LABEL: { confirmed: 'Confirmed', unverified: 'Unverified', false: 'False lead' },
      STAMP_INK: { confirmed: '#1f7a3d', unverified: '#b4222a', false: '#5a5650' },
      CONF: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']],
      TLP: [['', 'TLP: unset', '#8d877b', '#fff'], ['clear', 'TLP:CLEAR', '#f3f1ea', '#1b1a17'], ['green', 'TLP:GREEN', '#3fae63', '#fff'], ['amber', 'TLP:AMBER', '#e8a71c', '#1b1a17'], ['amber+strict', 'TLP:AMBER+STRICT', '#e8a71c', '#1b1a17'], ['red', 'TLP:RED', '#ff2a3c', '#fff']],
      SRC_GRADES: [['A', 'A · Reliable'], ['B', 'B · Usually reliable'], ['C', 'C · Fairly reliable'], ['D', 'D · Not usually reliable'], ['E', 'E · Unreliable'], ['F', 'F · Cannot be judged']],
      INFO_GRADES: [['1', '1 · Confirmed'], ['2', '2 · Probably true'], ['3', '3 · Possibly true'], ['4', '4 · Doubtful'], ['5', '5 · Improbable'], ['6', '6 · Cannot be judged']],
      CONF_LEVELS: [['low', 'Low confidence'], ['moderate', 'Moderate'], ['high', 'High confidence']],
      TEMPLATES: [
        { id: 'blank', name: 'Blank board', blurb: 'An empty case. Start from the inbox or paste a report into Extract IOCs.', tlp: '', hyps: [], items: [], tasks: [] },
        { id: 'phish', name: 'Phishing campaign', blurb: 'Lure, infrastructure, victims and the actor behind it. Hypotheses for crime vs. espionage.', tlp: 'amber', hyps: ['Financially motivated crew reusing a kit', 'State-directed credential collection', 'Opportunistic, no persistent actor'], items: [['indicator', { kind: 'domain', value: '', title: 'Lure domain' }], ['indicator', { kind: 'email', value: '', title: 'Sender address' }], ['indicator', { kind: 'url', value: '', title: 'Landing page' }], ['ttp', { value: 'T1566.002', title: 'Spearphishing Link', kind: 'Initial Access' }], ['person', { title: 'Unknown operator', tags: 'actor' }], ['target', { title: 'Targeted organisation' }], ['event', { title: 'First lure delivered' }]], tasks: ['Pull headers from one original message', 'WHOIS + passive DNS on the lure domain', 'Check the kit against urlscan / PhishTank', 'List every recipient and who clicked'] },
        { id: 'crypto', name: 'Crypto theft', blurb: 'Drain, laundering path, exchanges to notify. Built for on-chain tracing with transfer cards.', tlp: 'amber', hyps: ['Compromised signer or key', 'Smart-contract exploit', 'Insider with wallet access'], items: [['event', { title: 'Funds leave the victim wallet' }], ['indicator', { kind: 'wallet', value: '', title: 'Attacker wallet' }], ['tx', { amount: '', chain: 'Ethereum', title: 'First hop' }], ['target', { title: 'Victim platform', sector: 'Crypto' }], ['person', { title: 'Unknown actor', tags: 'actor' }], ['ttp', { value: 'T1657', title: 'Financial Theft', kind: 'Impact' }], ['doc', { title: 'Freeze requests sent', body: 'Tether / Circle / exchanges — time, reference, outcome' }]], tasks: ['Trace the first three hops on each chain', 'Send freeze requests to issuers and exchanges', 'Match the pattern against prior DPRK and exploit cases', 'Secure signer logs and build the access timeline'] },
        { id: 'ransom', name: 'Ransomware intrusion', blurb: 'Initial access to encryption with the leak site, affiliate and the data taken.', tlp: 'red', hyps: ['Affiliate entered through an exposed service', 'Credential bought from an initial-access broker', 'Phishing with a loader'], items: [['event', { title: 'Initial access' }], ['event', { title: 'Encryption begins' }], ['ttp', { value: 'T1190', title: 'Exploit Public-Facing Application', kind: 'Initial Access' }], ['ttp', { value: 'T1486', title: 'Data Encrypted for Impact', kind: 'Impact' }], ['indicator', { kind: 'hash', value: '', title: 'Encryptor sample' }], ['link', { title: 'Leak site post', url: '' }], ['person', { title: 'Ransomware affiliate', tags: 'actor' }], ['target', { title: 'Victim organisation' }]], tasks: ['Collect the ransom note and sample hash', 'Confirm the entry point from VPN / edge logs', 'Inventory what was exfiltrated before encryption', 'Decide on negotiation posture and notify counsel'] },
        { id: 'insider', name: 'Insider threat', blurb: 'A person, their access, what moved where, and the alternative explanations you owe them.', tlp: 'red', hyps: ['Deliberate exfiltration', 'Negligent handling, no intent', 'Compromised account, not the person'], items: [['person', { title: 'Subject', body: 'role · access · start date' }], ['event', { title: 'Anomalous access observed' }], ['doc', { title: 'Data of concern', body: 'what · where it lives · classification' }], ['indicator', { kind: 'email', value: '', title: 'Personal address used' }], ['ttp', { value: 'T1567', title: 'Exfiltration Over Web Service', kind: 'Exfiltration' }], ['location', { title: 'Location at time of access' }]], tasks: ['Preserve DLP, proxy and badge logs', 'Interview the line manager (HR present)', 'Rule out account compromise first', 'Document the legal basis for monitoring'] },
        { id: 'imperson', name: 'Impersonation / disinformation', blurb: 'Fake accounts, cloned sites and the narrative, with takedowns tracked as tasks.', tlp: 'green', hyps: ['Coordinated campaign by one operator', 'Organic pile-on amplified by bots', 'Scam using the brand as bait'], items: [['indicator', { kind: 'handle', value: '', title: 'Impersonating account' }], ['indicator', { kind: 'domain', value: '', title: 'Cloned site' }], ['photo', { title: 'Screenshot of the post' }], ['target', { title: 'Impersonated brand / executive' }], ['person', { title: 'Operator', tags: 'actor' }], ['event', { title: 'First post seen' }]], tasks: ['Archive every post before reporting it', 'File platform takedowns and log the references', 'Check registration overlap between the domains', 'Brief the executive protection and comms teams'] },
      ],
      CHAINS: ['Ethereum', 'Bitcoin', 'Tron', 'XRP Ledger', 'Solana', 'BNB Chain', 'Polygon', 'Avalanche', 'Arbitrum', 'Base', 'Optimism', 'Other'],
      EXPLORER: { Ethereum: ['https://etherscan.io/tx/', 'https://etherscan.io/address/'], Bitcoin: ['https://www.blockchain.com/explorer/transactions/btc/', 'https://www.blockchain.com/explorer/addresses/btc/'], Tron: ['https://tronscan.org/#/transaction/', 'https://tronscan.org/#/address/'], 'XRP Ledger': ['https://xrpscan.com/tx/', 'https://xrpscan.com/account/'], Solana: ['https://solscan.io/tx/', 'https://solscan.io/account/'], 'BNB Chain': ['https://bscscan.com/tx/', 'https://bscscan.com/address/'], Polygon: ['https://polygonscan.com/tx/', 'https://polygonscan.com/address/'], Avalanche: ['https://snowtrace.io/tx/', 'https://snowtrace.io/address/'], Arbitrum: ['https://arbiscan.io/tx/', 'https://arbiscan.io/address/'], Base: ['https://basescan.org/tx/', 'https://basescan.org/address/'], Optimism: ['https://optimistic.etherscan.io/tx/', 'https://optimistic.etherscan.io/address/'] },
      ACTORS: [
        { name: 'TraderTraitor', aliases: ['Jade Sleet', 'UNC4899', 'Slow Pisces'], origin: 'DPRK', motive: 'crypto theft', summary: 'Targets exchanges and Web3 developers with fake job offers and trojanised coding tasks, then drains hot wallets in one burst. Attributed by the FBI to the Bybit (2025) and Binance (2026) heists.', techniques: ['T1566.003', 'T1204', 'T1195.002', 'T1657'] },
        { name: 'Lazarus Group', aliases: ['Hidden Cobra', 'Diamond Sleet', 'ZINC'], origin: 'DPRK', motive: 'espionage · theft', summary: 'Long-running state operation spanning espionage, destructive attacks and large-scale financial theft against banks and crypto platforms.', techniques: ['T1566.001', 'T1105', 'T1036', 'T1486'] },
        { name: 'Kimsuky', aliases: ['Emerald Sleet', 'Velvet Chollima', 'APT43'], origin: 'DPRK', motive: 'espionage', summary: 'Rapport-building phishing of think tanks, journalists and policy experts, often posing as colleagues over weeks before delivering a lure.', techniques: ['T1598', 'T1566.001', 'T1204'] },
        { name: 'Scattered Spider', aliases: ['UNC3944', 'Octo Tempest', 'Muddled Libra'], origin: 'English-speaking', motive: 'extortion', summary: 'Talks its way through help desks, defeats MFA with fatigue prompts or SIM swaps, then hands off to ransomware partners.', techniques: ['T1566.004', 'T1621', 'T1078', 'T1486'] },
        { name: 'LockBit', aliases: ['LockBit 3.0', 'LockBit Black'], origin: 'RaaS', motive: 'ransomware', summary: 'Ransomware-as-a-service franchise; affiliates enter through exposed services and stolen credentials, exfiltrate, then encrypt.', techniques: ['T1190', 'T1078', 'T1021', 'T1486'] },
        { name: 'ALPHV / BlackCat', aliases: ['Noberus'], origin: 'RaaS', motive: 'ransomware', summary: 'Rust-based ransomware operation known for triple extortion: encryption, leak site and pressure on customers and partners.', techniques: ['T1078', 'T1567', 'T1486'] },
        { name: 'Cl0p', aliases: ['Lace Tempest', 'TA505-linked'], origin: 'Russian-speaking', motive: 'extortion', summary: 'Mass exploitation of file-transfer appliances, data theft and extortion, frequently without deploying encryption at all.', techniques: ['T1190', 'T1567', 'T1657'] },
        { name: 'APT28', aliases: ['Fancy Bear', 'Forest Blizzard', 'Sofacy'], origin: 'Russia · GRU', motive: 'espionage', summary: 'Credential phishing and brute force against governments, defence and media; webmail and VPN credentials are the usual prize.', techniques: ['T1566.002', 'T1110', 'T1078', 'T1598'] },
        { name: 'APT29', aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium'], origin: 'Russia · SVR', motive: 'espionage', summary: 'Supply-chain and cloud identity intrusions; patient, quiet access to diplomatic and technology targets.', techniques: ['T1195.002', 'T1078', 'T1550', 'T1621'] },
        { name: 'Sandworm', aliases: ['APT44', 'Seashell Blizzard', 'Voodoo Bear'], origin: 'Russia · GRU', motive: 'disruption', summary: 'Destructive operations against energy, government and telecoms; wipers and ransomware used as sabotage.', techniques: ['T1190', 'T1485', 'T1486', 'T1489'] },
        { name: 'Volt Typhoon', aliases: ['Vanguard Panda', 'Bronze Silhouette'], origin: 'China', motive: 'pre-positioning', summary: 'Living-off-the-land access inside critical-infrastructure networks through compromised edge devices, kept quiet for later use.', techniques: ['T1190', 'T1078', 'T1059', 'T1133'] },
        { name: 'FIN7', aliases: ['Carbanak', 'Sangria Tempest'], origin: 'Russian-speaking', motive: 'financial', summary: 'Phishing with malicious documents and USB drops against retail, hospitality and finance; later a ransomware affiliate.', techniques: ['T1566.001', 'T1204', 'T1078'] },
      ],
      TACTICS: ['Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'],
      ATTACK: [
        ['T1598', 'Phishing for Information', 'Reconnaissance'], ['T1589', 'Gather Victim Identity Information', 'Reconnaissance'],
        ['T1583', 'Acquire Infrastructure', 'Resource Development'], ['T1583.001', 'Acquire Infrastructure: Domains', 'Resource Development'], ['T1588', 'Obtain Capabilities', 'Resource Development'],
        ['T1566', 'Phishing', 'Initial Access'], ['T1566.001', 'Spearphishing Attachment', 'Initial Access'], ['T1566.002', 'Spearphishing Link', 'Initial Access'], ['T1566.003', 'Spearphishing via Service', 'Initial Access'], ['T1566.004', 'Spearphishing Voice', 'Initial Access'], ['T1199', 'Trusted Relationship', 'Initial Access'], ['T1078', 'Valid Accounts', 'Initial Access'], ['T1190', 'Exploit Public-Facing Application', 'Initial Access'], ['T1133', 'External Remote Services', 'Initial Access'], ['T1195', 'Supply Chain Compromise', 'Initial Access'], ['T1195.002', 'Compromise Software Supply Chain', 'Initial Access'],
        ['T1059', 'Command and Scripting Interpreter', 'Execution'], ['T1204', 'User Execution', 'Execution'],
        ['T1053', 'Scheduled Task/Job', 'Persistence'], ['T1098', 'Account Manipulation', 'Persistence'], ['T1136', 'Create Account', 'Persistence'],
        ['T1036', 'Masquerading', 'Defense Evasion'], ['T1027', 'Obfuscated Files or Information', 'Defense Evasion'], ['T1070', 'Indicator Removal', 'Defense Evasion'],
        ['T1621', 'Multi-Factor Authentication Request Generation', 'Credential Access'], ['T1110', 'Brute Force', 'Credential Access'], ['T1003', 'OS Credential Dumping', 'Credential Access'], ['T1552', 'Unsecured Credentials', 'Credential Access'], ['T1557', 'Adversary-in-the-Middle', 'Credential Access'],
        ['T1021', 'Remote Services', 'Lateral Movement'], ['T1534', 'Internal Spearphishing', 'Lateral Movement'], ['T1550', 'Use Alternate Authentication Material', 'Lateral Movement'],
        ['T1114', 'Email Collection', 'Collection'], ['T1056', 'Input Capture', 'Collection'],
        ['T1071', 'Application Layer Protocol', 'Command and Control'], ['T1105', 'Ingress Tool Transfer', 'Command and Control'],
        ['T1041', 'Exfiltration Over C2 Channel', 'Exfiltration'], ['T1567', 'Exfiltration Over Web Service', 'Exfiltration'],
        ['T1486', 'Data Encrypted for Impact', 'Impact'], ['T1485', 'Data Destruction', 'Impact'], ['T1489', 'Service Stop', 'Impact'], ['T1657', 'Financial Theft', 'Impact'],
      ],
    };
  })();

  static uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  static sample() {
    const it = (id, type, x, y, f) => ({ id, type, title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', image: null, pinned: true, x, y, ...f });
    return {
      id: 'c1', v: 2, number: 'CASE 0417', title: 'Operation Lantern', dismissed: [],
      notes: '14 MAR — Harbor CU (fictional) reports a credential-phishing wave. The landing page is a pixel clone of the member login.\n\nWorking theory: the 2025 "Lantern" kit has been rebranded, not rebuilt. CSS bundle hash matches.\n\nTODO\n- pivot on the /24 for sibling typosquats\n- registrar abuse takedown\n- pull the buyer list from the forum mirror',
      items: [
        it('e1', 'event', 60, 40, { title: 'Domain registered', body: 'harb0r-cu-login[.]com through a privacy proxy', date: '2026-03-02', tags: 'infra' }),
        it('i1', 'indicator', 60, 230, { status: 'confirmed', kind: 'domain', value: 'harb0r-cu-login[.]com', title: 'Phishing domain', body: 'Typosquat of the real member portal. Still resolving.', tags: 'infra, phish' }),
        it('i2', 'indicator', 60, 470, { status: 'confirmed', kind: 'ip', value: '203.0.113.42', title: 'Hosting IP', body: 'VPS, AS64512 (fictional). Same /24 as the 2025 kit.', tags: 'infra' }),
        it('loc1', 'location', 360, 520, { title: 'Amsterdam, NL — VPS datacenter', body: 'Provider ignores abuse mail. Escalate via upstream.', tags: 'infra' }),
        it('ph1', 'photo', 380, 250, { status: 'confirmed', title: 'Phish page — login clone', body: 'Captured 14 Mar 09:12 UTC', date: '2026-03-14', tags: 'phish' }),
        it('p1', 'person', 420, 20, { status: 'unverified', title: '"LANTERN" — unknown operator', body: 'aliases: lantern_0x, lantern.ops\nPortuguese + English. Active 22:00–03:00 UTC.', tags: 'actor' }),
        it('d1', 'doc', 680, 250, { title: 'Phish email sample', body: 'Subject: Action required: verify your Harbor CU account\nFrom: spoofed, SPF fail\nLink → harb0r-cu-login[.]com/auth', date: '2026-03-14', tags: 'phish' }),
        it('i4', 'indicator', 730, 30, { kind: 'handle', value: '@lantern_0x', title: 'Seller handle (Telegram)', body: 'Sells the "Lantern" kit, $300/mo.', tags: 'actor, telegram' }),
        it('l1', 'link', 1010, 60, { status: 'unverified', title: 'Kit listing — forum mirror', url: 'hxxps://cardz-market[.]top/thread/88121', body: 'Archived 10 Mar. Seller: @lantern_0x', date: '2026-03-10', tags: 'kit, forum' }),
        it('n1', 'note', 1010, 300, { body: 'Same CSS hash as the 2025 Lantern kit. Not a new actor — a rebrand.', tags: 'kit' }),
        it('i3', 'indicator', 700, 520, { status: 'confirmed', kind: 'hash', value: '9f2c4b7e1a0d3c5f8e6b2a1d4c7f9e0b3a5d8c1f2e4b6a7c9d0e1f3a5b7c9d2e', title: 'Kit bundle (sha256)', body: 'lantern-kit-v3.zip', tags: 'kit' }),
        it('e2', 'event', 1010, 520, { title: 'First phishing wave', body: '1,200 emails from support@harb0r-cu-login[.]com', date: '2026-03-14', tags: 'phish' }),
        it('e3', 'event', 1280, 420, { title: 'Victim reports credential loss', body: 'Three members, two with MFA fatigue prompts', date: '2026-03-16' }),
        it('tt1', 'ttp', 1290, 120, { status: 'confirmed', value: 'T1566.002', title: 'Spearphishing Link', kind: 'Initial Access', body: 'Lure links to the member-portal clone', tags: 'phish' }),
        it('tt2', 'ttp', 1290, 600, { value: 'T1621', title: 'Multi-Factor Authentication Request Generation', kind: 'Credential Access', body: 'MFA fatigue prompts reported by two victims' }),
        it('x1', 'link', 0, 0, { pinned: false, title: 'WHOIS — registrar lookup', url: 'hxxps://whois.example/harb0r-cu-login[.]com', body: 'Privacy proxy; created 02 Mar' }),
        it('x2', 'indicator', 0, 0, { pinned: false, kind: 'email', value: 'support@harb0r-cu-login[.]com', title: 'Sender address, wave 1' }),
        it('x3', 'note', 0, 0, { pinned: false, body: 'Pivot on the TLS cert fingerprint — does the same /24 host other typosquats?' }),
      ],
      threads: [
        { id: 't1', from: 'p1', to: 'i4', rel: 'alias' }, { id: 't2', from: 'i4', to: 'i1', rel: 'controls' }, { id: 't3', from: 'i1', to: 'i2', rel: 'resolves' },
        { id: 't4', from: 'i2', to: 'loc1', rel: 'located' }, { id: 't5', from: 'd1', to: 'i1', rel: 'linked' }, { id: 't6', from: 'ph1', to: 'i1', rel: 'linked' },
        { id: 't7', from: 'n1', to: 'i3', rel: 'linked' }, { id: 't8', from: 'i3', to: 'l1', rel: 'linked' }, { id: 't9', from: 'l1', to: 'i4', rel: 'controls' },
        { id: 't10', from: 'e1', to: 'i1', rel: 'linked' }, { id: 't11', from: 'i3', to: 'p1', rel: 'suspected', conf: 'low' }, { id: 't12', from: 'e3', to: 'd1', rel: 'linked' },
        { id: 't13', from: 'tt1', to: 'd1', rel: 'linked' }, { id: 't14', from: 'tt2', to: 'e3', rel: 'linked', conf: 'medium' },
      ],
    };
  }

  static sample2() {
    const it = (id, type, x, y, f) => ({ id, type, title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', image: null, pinned: true, x, y, ...f });
    const th = (id, from, to, rel, conf) => ({ id, from, to, rel, conf: conf || 'high' });
    return {
      id: 'c2', v: 3, number: 'CASE 0418', title: 'Binance $6.3B heist', dismissed: [],
      notes: '29 OCT 2026 — about $6.3B drained from Binance hot wallets across ten chains in roughly 20 minutes. Largest crypto theft on record (previous: Bybit, $1.5B, 2025).\n\nATTRIBUTION — FBI (31 Oct): DPRK TraderTraitor, Lazarus-linked. TRM Labs and Chainalysis concur. DPRK denies (Kim Yo Jong statement, 3 Nov).\n\nWORKING THEORY — months-long intrusion from June: fake job interviews → malware on a software engineer\'s laptop → internal dev systems and wallet infrastructure → signatures obtained in advance, executed in one burst via EIP-7702 delegation.\n\nOPEN\n- which internal AI tool was abused, and how\n- pin the FBI-published ETH / BTC / SOL addresses as wallet indicators (Extract IOCs)\n- laundering path for the ~$1.8B still with the attackers\n- Binance technical post-mortem still pending\n\nSOURCES — FBI Cyber alert 31 Oct · CNBC 29–30 Oct · Guardian 30 Oct, 1 Nov · BBC live 30 Oct · Binance preliminary report 3 Nov.',
      items: [
        it('b_p1', 'person', 40, 40, { status: 'confirmed', title: 'TraderTraitor (DPRK)', body: 'aliases: Lazarus-linked unit\nAttributed by FBI, TRM Labs, Chainalysis.\nAlso behind the $1.5B Bybit hack (2025).', tags: 'actor, dprk' }),
        it('b_loc1', 'location', 40, 300, { status: 'unverified', title: 'Pyongyang, DPRK — attributed origin', body: 'State-sponsored; proceeds reported to fund weapons programmes.', tags: 'actor' }),
        it('b_d_attrib', 'doc', 40, 560, { status: 'confirmed', title: 'Attribution assessments', body: 'TRM Labs: linked to North Korean hackers.\nChainalysis (Levin): likely TraderTraitor, citing links to earlier attacks.\nElliptic: almost certainly the largest known theft of any kind.\nFBI alert 31 Oct: North Korea responsible.', tags: 'attribution' }),
        it('b_d_related', 'doc', 40, 820, { status: 'unverified', title: 'Related incidents — same playbook', body: 'Bybit, $1.5B (Feb 2025) — FBI: TraderTraitor.\nKelpDAO (Apr 2026).\nBinance: features of this attack match both.', tags: 'attribution' }),
        it('b_tt1', 'ttp', 330, 40, { status: 'unverified', value: 'T1566.003', title: 'Spearphishing via Service', kind: 'Initial Access', body: 'Fake job interviews used to reach engineers (Binance statement).', tags: 'intrusion' }),
        it('b_e5', 'event', 330, 300, { status: 'confirmed', title: 'FBI attributes the attack to DPRK', body: 'Publishes ETH, BTC and SOL addresses tied to the theft; asks the public for information. Same day Binance reports 90% of losses replenished.', date: '2026-10-31', tags: 'attribution' }),
        it('b_l_fbi', 'link', 330, 560, { status: 'confirmed', title: 'FBI Cyber alert — North Korea responsible', url: 'https://www.fbi.gov/investigate/cyber/alerts/2026/north-korea-responsible-for-6-billion-binance-attack', body: 'Source of the published attacker addresses.', date: '2026-10-31', tags: 'source' }),
        it('b_e0', 'event', 600, 40, { status: 'unverified', title: 'Intrusion campaign begins', body: 'June 2026 (day not published). Multi-stage: employee devices, internal development systems, wallet infrastructure. The platform\'s own AI tool was reportedly leveraged.', date: '2026-06-01', tags: 'intrusion' }),
        it('b_d2', 'doc', 600, 300, { status: 'confirmed', title: 'Status of the funds', body: 'Binance, 3 Nov: ~$2.85B frozen or intercepted (≈45% of $6.34B).\nPress summary: ~$3.0B frozen by issuers and partners · ~$1.5B could not be frozen · ~$1.8B still with the attackers.\nNo conversion to fiat observed as of 30 Oct.', tags: 'funds' }),
        it('b_e7', 'event', 600, 560, { status: 'confirmed', title: 'Binance preliminary report; DPRK denial', body: '$2.85B frozen/intercepted; 98% of stolen tokens replenished. Kim Yo Jong (KCNA) denies North Korean involvement, also for Bybit. US Secret Service tracking and freezing funds.', date: '2026-11-03', tags: 'response' }),
        it('b_e6', 'event', 600, 820, { status: 'confirmed', title: 'Withdrawals resume', body: '$4.65B processed on day one, starting with ETH, USDT, USDC. Losses covered from SAFU, futures insurance fund, BTC reserve and treasury.', date: '2026-11-01', tags: 'response' }),
        it('b_n_laptop', 'note', 860, 40, { status: 'unverified', body: 'Initial statement: entry via a compromised software engineer\'s laptop. Later: other issues found. Attack prepared at least 36 hours in advance.', tags: 'intrusion' }),
        it('b_e2', 'event', 860, 300, { status: 'confirmed', title: 'Issuers freeze stablecoins', body: 'Tether freezes wallets 17:01 ET, Circle 17:04. Tether blocks the Binance hot wallet 18:06, Circle 19:53. Binance revokes the attackers\' permissions 20:10 ET. Ripple also freezes.', date: '2026-10-29', tags: 'response, funds' }),
        it('b_n1', 'note', 860, 560, { status: 'confirmed', body: 'Losses by chain: ETH $3.8B · BTC $1.5B (18,270 BTC) · TRON $628M · XRP $296M · SOL $96M. Ten chains in total.', tags: 'funds' }),
        it('b_l_cnbc', 'link', 860, 820, { title: 'CNBC — what we know and what comes next', url: 'https://www.cnbc.com/2026/10/30/billions-in-crypto-frozen-in-binance-hack-heres-what-happens-next-.html', body: '$6.36B moved across 10 blockchains, most within ~20 minutes.', date: '2026-10-30', tags: 'source' }),
        it('b_tt2', 'ttp', 1120, 40, { status: 'unverified', value: 'T1204', title: 'User Execution', kind: 'Execution', body: 'Malicious software delivered through the interview lure; engineer device compromised.', tags: 'intrusion' }),
        it('b_e1', 'event', 1120, 300, { status: 'confirmed', title: 'Hot wallets drained — 16:05 ET', body: 'Starts on XRP Ledger 16:05 ET; Ethereum and Bitcoin 16:20. Main ETH transaction 16:24 (64 transfers); one transfer above $2.5B. ~20 minutes, ten chains.', date: '2026-10-29', tags: 'heist' }),
        it('b_e3', 'event', 1120, 560, { status: 'confirmed', title: 'Second wave — Avalanche, Polygon', body: '19:05 ET. Final Ethereum transaction 19:56 ET.', date: '2026-10-29', tags: 'heist' }),
        it('b_l_wiki', 'link', 1120, 820, { title: 'Wikipedia — 2026 Binance hack', url: 'https://en.wikipedia.org/wiki/2026_Binance_hack', body: 'Running summary with per-chain losses and the freeze timeline.', tags: 'source' }),
        it('b_d_path', 'doc', 1390, 40, { status: 'unverified', title: 'Attack path — EIP-7702', body: 'Hot wallet drained via EIP-7702 account delegation (CEO Richard Teng). Signatures obtained in advance, executed in one burst. Full post-mortem pending.', tags: 'heist' }),
        it('b_tt3', 'ttp', 1390, 300, { status: 'confirmed', value: 'T1657', title: 'Financial Theft', kind: 'Impact', body: '$6.3B across ten chains.', tags: 'heist' }),
        it('b_e4', 'event', 1390, 560, { status: 'confirmed', title: '17,260 ETH moved to a fresh wallet', body: '01:15 ET. First visible laundering step; funds not yet converted to fiat.', date: '2026-10-30', tags: 'laundering' }),
        it('b_p2', 'person', 1650, 40, { title: 'Richard Teng — Binance CEO', body: 'Public statements: EIP-7702 used on the hot wallet; $6B set aside; services to resume within 40 hours.', tags: 'witness' }),
        it('b_n2', 'note', 1650, 300, { status: 'unverified', body: 'Pattern match with Bybit and KelpDAO: small Tornado Cash withdrawals fund an operator wallet; staging long before the theft; pre-signed, one burst.', tags: 'laundering, attribution' }),
        it('b_tx2', 'tx', 1650, 560, { status: 'confirmed', chain: 'Ethereum', amount: '> $2.5B in one transfer', txFrom: 'Binance hot wallet', txTo: 'Attacker-controlled wallet', title: 'Largest single transfer of the drain', body: 'Part of the 64-transfer Ethereum batch at 16:24 ET.', date: '2026-10-29', tags: 'heist' }),
        it('b_tx1', 'tx', 1650, 820, { status: 'confirmed', chain: 'Ethereum', amount: '17,260 ETH', txFrom: 'Attacker-controlled wallet', txTo: 'Fresh wallet (unlabelled)', title: 'First laundering hop', body: '01:15 ET, 30 Oct. Paste the published address and tx hash here.', date: '2026-10-30', tags: 'laundering' }),
        it('b_x1', 'note', 0, 0, { pinned: false, body: 'Open the FBI alert, copy the published ETH / BTC / SOL addresses, then run Extract IOCs to pin them as wallet indicators.' }),
        it('b_x2', 'link', 0, 0, { pinned: false, title: 'Guardian — withdrawals resume after record hack', url: 'https://www.theguardian.com/business/2026/nov/01/binance-losses-covered-hack-fbi-north-korea-cryptocurrency', date: '2026-11-01', tags: 'source' }),
        it('b_x3', 'indicator', 0, 0, { pinned: false, kind: 'wallet', value: '', title: 'Attacker wallet (from the FBI alert)', body: 'Paste one published address per card, or use Extract IOCs.', status: 'unverified' }),
      ],
      threads: [
        th('bt1', 'b_p1', 'b_e1', 'linked'), th('bt2', 'b_p1', 'b_loc1', 'located', 'medium'), th('bt3', 'b_p1', 'b_tt1', 'linked'),
        th('bt4', 'b_tt1', 'b_e0', 'linked'), th('bt5', 'b_e0', 'b_n_laptop', 'linked'), th('bt6', 'b_n_laptop', 'b_tt2', 'linked', 'medium'),
        th('bt7', 'b_tt2', 'b_d_path', 'linked', 'medium'), th('bt8', 'b_d_path', 'b_e1', 'linked'), th('bt9', 'b_e1', 'b_e2', 'linked'),
        th('bt10', 'b_e1', 'b_e3', 'linked'), th('bt11', 'b_e3', 'b_e4', 'linked'), th('bt12', 'b_e4', 'b_n2', 'suspected', 'medium'),
        th('bt13', 'b_e1', 'b_n1', 'linked'), th('bt14', 'b_e2', 'b_d2', 'linked'), th('bt15', 'b_e7', 'b_d2', 'linked'),
        th('bt16', 'b_e5', 'b_p1', 'linked'), th('bt17', 'b_l_fbi', 'b_e5', 'linked'), th('bt18', 'b_d_attrib', 'b_p1', 'linked'),
        th('bt19', 'b_d_related', 'b_p1', 'suspected', 'medium'), th('bt20', 'b_p2', 'b_d_path', 'linked'), th('bt21', 'b_tt3', 'b_e1', 'linked'),
        th('bt22', 'b_d2', 'b_n1', 'linked'), th('bt23', 'b_e6', 'b_e7', 'linked'),
        th('bt24', 'b_e1', 'b_tx2', 'linked'), th('bt25', 'b_e4', 'b_tx1', 'linked'), th('bt26', 'b_tx2', 'b_tx1', 'suspected', 'medium'),
      ],
    };
  }

  static numbered(c) {
    let mi = 0, mt = 0; c.items.forEach(i => { if (i.num > mi) mi = i.num; }); c.threads.forEach(t => { if (t.num > mt) mt = t.num; });
    const ni = c.items.some(i => i.pinned && !i.num), nt = c.threads.some(t => !t.num);
    if (!ni && !nt) return c;
    return { ...c, items: ni ? c.items.map(i => i.pinned && !i.num ? { ...i, num: ++mi } : i) : c.items, threads: nt ? c.threads.map(t => t.num ? t : { ...t, num: ++mt }) : c.threads };
  }
  static numText(prefix, n) { return n ? prefix + String(n).padStart(2, '0') : ''; }
  static THEMES = {
    noir: { label: 'Noir', desk: '#0b0b0c', lamp: '255,236,190', panel: 'rgba(14,14,16,.85)', panel2: '#111113', input: '#0c0c0e', btn: '#17171a', btnHover: '#222226', border: '#2c2c31', border2: '#232326', text: '#e8e4da', text2: '#d8d3c7', textStrong: '#f3f1ea', textMuted: '#8d877b', textFaint: '#5f5a52', accent: '#ff2a3c', accentInk: '#ffffff', folderA: '#d8bd83', folderB: '#b9995c', tab: '#c9ad74', paper: '#f3f1ea', ink: '#1b1a17', inkMuted: '#5a4a22', filter: 'none', boardBg: '#101012', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1c1c20 0%, #101012 55%, #070708 100%)', bpaper: '', bnote: '', pin: ['#ff9ba1', '#ff2a3c', '#6b0a10'] },
    cold: { label: 'Cold case', desk: '#0e0d0b', lamp: '220,200,160', panel: 'rgba(18,16,13,.85)', panel2: '#131210', input: '#0d0c0a', btn: '#1a1814', btnHover: '#26231d', border: '#2e2a24', border2: '#262320', text: '#d9d2c2', text2: '#cbc3b1', textStrong: '#ece5d4', textMuted: '#857d6c', textFaint: '#5a5448', accent: '#b4222a', accentInk: '#ffffff', folderA: '#bfae8a', folderB: '#9f8f6c', tab: '#b3a27e', paper: '#e9e2d2', ink: '#2a2622', inkMuted: '#5f5440', filter: 'sepia(.35) contrast(.92)', boardBg: '#121110', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1f1c17 0%, #121110 55%, #080706 100%)', bpaper: '#e7ddc3', bnote: '#e6d079', pin: ['#e0c9a0', '#a8853f', '#4a3410'] },
    midnight: { label: 'Midnight', desk: '#070b16', lamp: '170,200,255', panel: 'rgba(10,14,26,.85)', panel2: '#0d1324', input: '#080c18', btn: '#131a30', btnHover: '#1b2442', border: '#1f2740', border2: '#1a2136', text: '#dfe6f5', text2: '#c9d3ea', textStrong: '#f1f5ff', textMuted: '#7f8db0', textFaint: '#4f5a78', accent: '#ffb547', accentInk: '#1b1a17', folderA: '#8f9ec4', folderB: '#6273a0', tab: '#7f8fb8', paper: '#eef1f8', ink: '#141a2a', inkMuted: '#2d3a5c', filter: 'none', boardBg: '#0a0f1e', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #15203a 0%, #0a0f1e 55%, #04060d 100%)', bpaper: '#eef1f8', bnote: '#f3e58c', pin: ['#ffe2a0', '#ffb547', '#6b4a0e'] },
    warroom: { label: 'War room', desk: '#0a1410', lamp: '220,255,200', panel: 'rgba(10,18,14,.85)', panel2: '#0f1a15', input: '#091009', btn: '#15231c', btnHover: '#1e3127', border: '#22302a', border2: '#1c2822', text: '#e2e8dc', text2: '#cfd8cc', textStrong: '#f1f5ee', textMuted: '#7f9484', textFaint: '#4f6356', accent: '#ff2a3c', accentInk: '#ffffff', folderA: '#b7b58a', folderB: '#8f8e63', tab: '#a6a47a', paper: '#f1efe4', ink: '#1b1f16', inkMuted: '#4a5030', filter: 'none', boardBg: '#0c1611', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #17271e 0%, #0c1611 55%, #040a07 100%)', bpaper: '#f1efe4', bnote: '#efe2a0', pin: ['#ff9ba1', '#ff2a3c', '#6b0a10'] },
    redroom: { label: 'Red room', desk: '#160608', lamp: '255,200,200', panel: 'rgba(24,8,10,.85)', panel2: '#1c0a0d', input: '#120507', btn: '#2a1114', btnHover: '#3a181c', border: '#3a1a1e', border2: '#2e1518', text: '#f1e6e6', text2: '#e3d2d2', textStrong: '#fff5f5', textMuted: '#a07a7e', textFaint: '#6a4a4e', accent: '#f3f1ea', accentInk: '#1b1a17', folderA: '#a9a39e', folderB: '#7f7975', tab: '#9c9691', paper: '#f4f0ee', ink: '#1b1515', inkMuted: '#5a3a3a', filter: 'none', boardBg: '#1a0709', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #2c0d11 0%, #1a0709 55%, #0a0203 100%)', bpaper: '#f4f0ee', bnote: '#f3e58c', pin: ['#ffffff', '#cfc9b8', '#4e4a40'] },
    daylight: { label: 'Daylight', desk: '#d9d2c3', lamp: '255,255,255', panel: 'rgba(255,255,255,.55)', panel2: '#ece7dc', input: '#fbf9f4', btn: '#f3efe6', btnHover: '#ffffff', border: '#b9b0a0', border2: '#c9c1b2', text: '#1b1a17', text2: '#2e2b26', textStrong: '#000000', textMuted: '#5a564e', textFaint: '#8a857b', accent: '#c81e2c', accentInk: '#ffffff', folderA: '#e7cf96', folderB: '#cdb374', tab: '#dcc389', paper: '#ffffff', ink: '#1b1a17', inkMuted: '#6d5a2e', filter: 'none', boardBg: '#cfc7b6', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #e2dbcc 0%, #cfc7b6 55%, #b3aa98 100%)', bpaper: '#ffffff', bnote: '#fff3a3', pin: ['#ff9ba1', '#c81e2c', '#6b0a10'] },
    mono: { label: 'Mono', desk: '#000000', lamp: '255,255,255', panel: 'rgba(0,0,0,.85)', panel2: '#0a0a0a', input: '#050505', btn: '#161616', btnHover: '#242424', border: '#333333', border2: '#262626', text: '#ffffff', text2: '#dddddd', textStrong: '#ffffff', textMuted: '#999999', textFaint: '#666666', accent: '#ffffff', accentInk: '#000000', folderA: '#a6a6a6', folderB: '#7a7a7a', tab: '#969696', paper: '#ffffff', ink: '#000000', inkMuted: '#444444', filter: 'grayscale(1)', boardBg: '#000000', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1a1a1a 0%, #000 55%, #000 100%)', bpaper: '#ffffff', bnote: '#e6e6e6', pin: ['#ffffff', '#bbbbbb', '#333333'] },
    terminal: { label: 'Terminal', desk: '#030604', lamp: '120,255,160', panel: 'rgba(3,8,5,.85)', panel2: '#07120b', input: '#040a06', btn: '#0b1a10', btnHover: '#12271a', border: '#143a22', border2: '#0f2a19', text: '#9dffbd', text2: '#7fe6a3', textStrong: '#c9ffdc', textMuted: '#3fae63', textFaint: '#246b3d', accent: '#39ff8a', accentInk: '#031a0c', folderA: '#7fae8c', folderB: '#5a8a68', tab: '#72a080', paper: '#dff7e6', ink: '#06130a', inkMuted: '#245a36', filter: 'none', boardBg: '#040806', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #0b1a10 0%, #040806 55%, #000 100%)', bpaper: '#dff7e6', bnote: '#cdf0d8', pin: ['#b8ffd0', '#39ff8a', '#0b5a2e'] },
    amber: { label: 'Amber CRT', desk: '#060402', lamp: '255,190,80', panel: 'rgba(8,5,2,.85)', panel2: '#120c04', input: '#0a0603', btn: '#1c1206', btnHover: '#2a1b09', border: '#3a2810', border2: '#2c1e0c', text: '#ffd28a', text2: '#f2c070', textStrong: '#ffe7b8', textMuted: '#a8803a', textFaint: '#6b5224', accent: '#ffb000', accentInk: '#1b1200', folderA: '#d9a95a', folderB: '#b0833c', tab: '#cc9d50', paper: '#fbe9c8', ink: '#2a1a05', inkMuted: '#7a5212', filter: 'none', boardBg: '#070401', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #1b1105 0%, #070401 55%, #000 100%)', bpaper: '#fbe9c8', bnote: '#f7dc9a', pin: ['#ffe0a0', '#ffb000', '#6b4600'] },
    blueprint: { label: 'Blueprint', desk: '#0b1d3a', lamp: '120,200,255', panel: 'rgba(8,22,46,.85)', panel2: '#0e2246', input: '#081a38', btn: '#132d58', btnHover: '#1b3a70', border: '#244a80', border2: '#1c3c6a', text: '#dceaff', text2: '#c4d8f6', textStrong: '#ffffff', textMuted: '#7fa6d8', textFaint: '#4f6f9c', accent: '#5ad1ff', accentInk: '#06203a', folderA: '#9db7d9', folderB: '#6f8fba', tab: '#8ea9cf', paper: '#f4f8ff', ink: '#0b1d3a', inkMuted: '#2b4f80', filter: 'none', boardBg: '#0b1d3a', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #163366 0%, #0b1d3a 55%, #050e1e 100%)', bpaper: '#f4f8ff', bnote: '#e2efff', pin: ['#c8f0ff', '#5ad1ff', '#0f5a80'] },
    bureau: { label: 'Bureau 1972', desk: '#2b2118', lamp: '255,220,160', panel: 'rgba(34,26,19,.85)', panel2: '#33281d', input: '#241b13', btn: '#3b2f23', btnHover: '#4a3b2c', border: '#5a4836', border2: '#4a3b2c', text: '#efe4cf', text2: '#dfd2ba', textStrong: '#fff8e8', textMuted: '#a8947a', textFaint: '#7a6a55', accent: '#c0392b', accentInk: '#ffffff', folderA: '#a9a677', folderB: '#7f7c52', tab: '#9b9869', paper: '#f1e9d2', ink: '#1e1a12', inkMuted: '#5c4e2a', filter: 'sepia(.15)', boardBg: '#2b2118', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #3d3024 0%, #2b2118 55%, #15100b 100%)', bpaper: '#f1e9d2', bnote: '#ecd98a', pin: ['#ffe9a3', '#c9962a', '#5a3d0a'] },
    arctic: { label: 'Arctic', desk: '#e8edf2', lamp: '255,255,255', panel: 'rgba(255,255,255,.6)', panel2: '#f4f7fa', input: '#ffffff', btn: '#f6f8fb', btnHover: '#ffffff', border: '#b8c4d0', border2: '#cbd5df', text: '#10202e', text2: '#243648', textStrong: '#000000', textMuted: '#5f7082', textFaint: '#8e9cab', accent: '#1f8fff', accentInk: '#ffffff', folderA: '#d4dde8', folderB: '#aebbca', tab: '#c6d1de', paper: '#ffffff', ink: '#10202e', inkMuted: '#3d556e', filter: 'none', boardBg: '#dfe6ee', boardGrad: 'radial-gradient(120% 90% at 50% 0%, #f2f6fa 0%, #dfe6ee 55%, #c4cfdb 100%)', bpaper: '#ffffff', bnote: '#fff5b8', pin: ['#bfe0ff', '#1f8fff', '#0b3a66'] },
  };
  static THEME_IDS = ['noir', 'cold', 'midnight', 'warroom', 'redroom', 'daylight', 'mono', 'terminal', 'amber', 'blueprint', 'bureau', 'arctic'];
  theme() { const p = this.props.theme; if (p && p !== 'auto' && Component.THEMES[p]) return Component.THEMES[p]; return Component.THEMES[this.deskTheme] || Component.THEMES.noir; }
  readDeskTheme() { try { const d = JSON.parse(localStorage.getItem('cyber-investigation-board.desk.v1') || '{}'); return d && d.theme ? d.theme : 'noir'; } catch (e) { return 'noir'; } }
  relColor(r) { const th = this.theme(); return (r.id === 'linked' || r.id === 'suspected') && th.accent !== '#ff2a3c' ? th.accent : r.color; }

  state = this.initState();
  drag = null; hist = []; saveTimer = null; toastTimer = null; uploadFor = null; lastMoved = false; tokenCache = new WeakMap(); setters = {};

  initState(savedIn) {
    let saved = savedIn || null, lockedPayload = null;
    if (!savedIn) { try { const raw = localStorage.getItem(Component.K.KEY); if (raw) { const d = JSON.parse(raw); if (d && d.enc === 1 && d.data) lockedPayload = d; else if (d && Array.isArray(d.cases) && (d.cases.length || (Array.isArray(d.seeded) && d.seeded.includes('server')))) saved = d; } } catch (e) {} }
    if (lockedPayload) { this.lockedPayload = lockedPayload; this.seeded = ['c2']; return { tool: 'move', rel: 'linked', tab: 'inspector', showInbox: false, showRight: false, analyst: '', cases: [{ id: 'locked', number: 'LOCKED', title: 'Enter the passphrase', notes: '', items: [], threads: [], dismissed: [] }], activeId: 'locked', view: { x: 0, y: 0, z: 1 }, sel: null, selThread: null, pending: null, linking: null, search: '', hidden: {}, hover: null, reveal: false, mode: 'board', present: false, presentIdx: 0, selGroup: null, quick: '', screen: 'home', opening: null, hoverCase: null, renameId: null, savedAt: '', snapName: '', diffId: null, actorsOpen: false, ai: { busy: false, forId: null, res: null, err: '' }, achOpen: false, hypText: '', reqOpen: false, req: { kind: 'takedown', to: '', sel: {} }, taskText: '', taskDue: '', commentText: '', osintOpen: false, osint: { q: '', type: '', value: '', ran: false, live: [], pinnedId: null }, notifOpen: false, tasksOpen: false, tasksView: 'kanban', calMonth: new Date().toISOString().slice(0, 7), diffOpen: false, diffA: '', diffB: '', diffMix: 50, annOpen: false, annTool: 'box', settingsOpen: false, mmoOpen: false, geoQuery: '', recOn: false, routeOn: false, geoStatus: '', walkOn: false, radioOn: false, clock: '', events: [], notifSeen: '', tplOpen: false, mergeTo: '', play: { on: false, idx: 0 }, diffReport: null, lockOpen: false, lockPass: '', locked: true, lockErr: '', mobile: false, toast: '' }; }
    let cases = this.migrate(saved && saved.cases.length ? saved.cases : saved ? [{ id: Component.uid(), v: 3, number: 'CASE 0417', title: 'Untitled case', notes: '', items: [], threads: [], groups: [], dismissed: [], review: 'draft', log: [] }] : [Component.sample()]);
    let activeId = saved && cases.some(c => c.id === saved.activeId) ? saved.activeId : cases[0].id;
    const seeded = (saved && saved.seeded) || []; this.seeded = seeded;
    if (!seeded.includes('c2') && !cases.some(c => c.id === 'c2')) { cases = [...cases, Component.sample2()]; activeId = 'c2'; this.seeded = [...seeded, 'c2']; }
    cases = cases.map(Component.numbered);
    return {
      tool: 'move', rel: 'linked', tab: 'inspector', showInbox: true, showRight: true, analyst: '', ...(saved || {}),
      cases, activeId, view: { x: 0, y: 0, z: 1 }, sel: null, selThread: null, pending: null, linking: null, search: '', hidden: {}, hover: null, reveal: false, mode: 'board', present: false, presentIdx: 0, selGroup: null, quick: '', screen: 'home', opening: null, hoverCase: null, renameId: null, savedAt: '', snapName: '', diffId: null, actorsOpen: false, ai: { busy: false, forId: null, res: null, err: '' }, achOpen: false, hypText: '', reqOpen: false, req: { kind: 'takedown', to: '', sel: {} }, taskText: '', taskDue: '', commentText: '', osintOpen: false, notifOpen: false, tasksOpen: false, tasksView: 'kanban', calMonth: new Date().toISOString().slice(0, 7), diffOpen: false, diffA: '', diffB: '', diffMix: 50, annOpen: false, annTool: 'box', settingsOpen: false, mmoOpen: false, geoQuery: '', recOn: false, routeOn: false, geoStatus: '', walkOn: false, radioOn: false, clock: '', events: (saved && saved.events) || [], notifSeen: (saved && saved.notifSeen) || '', tplOpen: false, mergeTo: '', play: { on: false, idx: 0 }, diffReport: null, lockOpen: false, lockPass: '', locked: false, lockErr: '', mobile: false, osint: { q: '', type: '', value: '', ran: false, live: [], pinnedId: null }, extract: { open: false, text: '', rows: [] }, toast: '', newFrom: '', newTo: '', newRel: 'linked',
    };
  }

  applyRemote(ev) {
    if (!ev) return;
    if (ev.type === 'case-deleted') { this.setState(s => { const cases = s.cases.filter(c => c.id !== ev.id); return cases.length ? { cases, activeId: s.activeId === ev.id ? cases[0].id : s.activeId, sel: s.activeId === ev.id ? null : s.sel } : {}; }); return; }
    const c = ev.case; if (!c || !c.id) return;
    this.setState(s => ({ cases: s.cases.some(x => x.id === c.id) ? s.cases.map(x => x.id === c.id ? Component.numbered(c) : x) : [...s.cases, Component.numbered(c)] }));
    if (this.state.activeId === c.id && c.updatedBy) this.toast('Updated by ' + c.updatedBy);
  }
  componentDidMount() {
    if (window.CIBStore && window.CIBStore.onRemote) window.CIBStore.onRemote(ev => this.applyRemote(ev));
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('paste', this.onPaste);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onLamp);
    this.lastTool = this.props.defaultTool;
    if (this.props.defaultTool) this.setState({ tool: this.props.defaultTool });
    if (window.innerWidth < 1100) this.setState({ showInbox: false });
    window.addEventListener('resize', this.onResize);
    this.deskTheme = this.readDeskTheme(); window.addEventListener('storage', this.onStorage);
    this.tickClock(); this.clockTimer = setInterval(() => this.tickClock(), 30000); this.pollTimer = setInterval(() => this.pollAll(), 60000); setTimeout(() => this.pollAll(), 4000);
    this.settings = this.loadSettings(); this.rainSetup(); window.addEventListener('keydown', this.typeSound);
    if (window.CIBAuth) { const u = window.CIBAuth.require("/"); this.user = u; this.setState({ screen: 'board' }); if (u) { if (!u.guest && (this.state.analyst || '') !== u.name) this.setState({ analyst: u.name }); const vis = this.state.cases.filter(c => window.CIBAuth.canSee(u, c)); if (vis.length && !vis.some(c => c.id === this.state.activeId)) this.setState({ activeId: vis[0].id }); } window.addEventListener('pointerdown', this.onTouchAuth); }
    const hm = String(location.hash || '').match(/case=([^&]+)/); if (hm) { const id = decodeURIComponent(hm[1]); if (this.state.cases.some(c => c.id === id)) this.setState({ activeId: id, screen: 'board' }); }
    const om = String(location.hash || '').match(/osint=([^&]*)/); if (om) { const q = decodeURIComponent(om[1]); this.setState({ screen: 'board' }); setTimeout(() => this.openOsint(q), 400); }
    if (hm || om) history.replaceState(null, '', location.pathname + location.search);
    [300, 1200, 3000].forEach(ms => setTimeout(this.onResize, ms));
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.onResize()); this.ro.observe(document.documentElement); }
    setTimeout(() => this.fit(), 150);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(() => this.fit(), 60));
  }
  componentWillUnmount() {
    clearInterval(this.clockTimer); clearInterval(this.pollTimer); clearInterval(this.routeTimer); window.removeEventListener('keydown', this.typeSound); if (this.rainRaf) cancelAnimationFrame(this.rainRaf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('paste', this.onPaste);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onLamp);
    window.removeEventListener('resize', this.onResize); if (this.ro) this.ro.disconnect();
  }
  onTouchAuth = () => { const now = Date.now(); if (now - (this.lastTouch || 0) > 30000) { this.lastTouch = now; if (!window.CIBAuth.user()) return window.CIBAuth.require("/"); window.CIBAuth.touch(); } };
  canEditCase() { const A = window.CIBAuth; return !A || !this.user || A.canEdit(this.user, this.cs()); }
  onStorage = e => { if (!e.key || e.key === 'cyber-investigation-board.desk.v1') { const t = this.readDeskTheme(); if (t !== this.deskTheme) { this.deskTheme = t; this.forceUpdate(); } } };
  onResize = () => { const m = window.innerWidth < 720; if (m !== this.state.mobile) { this.setState(s => ({ mobile: m, mode: m ? 'list' : (s.mode === 'list' ? 'board' : s.mode), showInbox: m ? false : (window.innerWidth >= 1100), showRight: m ? false : true })); setTimeout(() => this.fit(), 120); } };
  onLamp = e => {
    const el = document.querySelector('[data-lamp]'); if (!el) return;
    const r = this.rect(), x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.background = 'radial-gradient(520px 520px at ' + x + 'px ' + y + 'px, rgba(255,232,180,.17) 0%, rgba(255,232,180,.05) 35%, rgba(0,0,0,0) 62%), radial-gradient(140% 120% at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,.78) 100%)';
  };
  componentDidUpdate() {
    this.syncMaps(); this.annSync();
    const s = this.state, sig = [s.cases, s.activeId, s.tool, s.rel, s.tab, s.showInbox, s.showRight, s.analyst];
    if (!this.lastSig || sig.some((v, i) => v !== this.lastSig[i])) { this.lastSig = sig; clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.save(), 400); }
    const dt = this.props.defaultTool;
    if (dt !== this.lastTool) { this.lastTool = dt; if (dt && dt !== s.tool) this.setState({ tool: dt, pending: null }); }
  }
  save() {
    const { cases, activeId, tool, rel, tab, showInbox, showRight, analyst, locked, events, notifSeen } = this.state; if (locked) return;
    const payload = JSON.stringify({ cases, activeId, tool, rel, tab, showInbox, showRight, analyst, events: (events || []).slice(-200), notifSeen, seeded: this.seeded || [] });
    if (this.cryptoKey) { this.encrypt(payload).then(enc => { try { localStorage.setItem(Component.K.KEY, JSON.stringify(enc)); } catch (e) { this.toast('Browser storage is full — large images were not saved'); } }).catch(() => this.toast('Encryption failed — not saved')); return; }
    try { localStorage.setItem(Component.K.KEY, payload); }
    catch (e) { this.toast('Browser storage is full — large images were not saved'); }
  }
  // ---------- encryption at rest (AES-256-GCM, PBKDF2)
  b64 = { enc: u8 => btoa(String.fromCharCode(...u8)), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
  async deriveKey(pass, salt) { const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  async encrypt(text) { const iv = crypto.getRandomValues(new Uint8Array(12)); const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.cryptoKey, new TextEncoder().encode(text))); const out = []; for (let i = 0; i < data.length; i += 0x8000) out.push(String.fromCharCode.apply(null, data.subarray(i, i + 0x8000))); return { enc: 1, salt: this.b64.enc(this.cryptoSalt), iv: this.b64.enc(iv), data: btoa(out.join('')) }; }
  async decrypt(payload, key) { const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.b64.dec(payload.iv) }, key, this.b64.dec(payload.data)); return new TextDecoder().decode(buf); }
  lockSet = async () => {
    const pass = this.state.lockPass || ''; if (pass.length < 8) return this.toast('Use at least 8 characters');
    this.cryptoSalt = crypto.getRandomValues(new Uint8Array(16)); this.cryptoKey = await this.deriveKey(pass, this.cryptoSalt);
    this.setState({ lockOpen: false, lockPass: '' }); this.save(); this.logEvt('Encryption at rest enabled'); this.toast('Saved cases are now encrypted');
  };
  lockClear = () => { if (!window.confirm('Store cases unencrypted from now on?')) return; this.cryptoKey = null; this.cryptoSalt = null; this.setState({ lockOpen: false, lockPass: '' }); this.save(); this.logEvt('Encryption at rest disabled'); this.toast('Passphrase removed'); };
  unlock = async () => {
    const p = this.lockedPayload, pass = this.state.lockPass || ''; if (!p) return;
    try {
      const salt = this.b64.dec(p.salt), key = await this.deriveKey(pass, salt), text = await this.decrypt(p, key), d = JSON.parse(text);
      this.cryptoKey = key; this.cryptoSalt = salt; this.lockedPayload = null;
      const st = this.initState(d); this.setState({ ...st, locked: false, lockPass: '', lockErr: '', mobile: this.state.mobile, mode: this.state.mobile ? 'list' : 'board' }); setTimeout(() => this.fit(), 120);
    } catch (e) { this.setState({ lockErr: 'That passphrase does not open these files.', lockPass: '' }); }
  };

  // ---------- case + item mutations
  cs() { const s = this.state; return s.cases.find(c => c.id === s.activeId) || s.cases[0]; }
  upCase(fn) { if (!this.canEditCase()) { if (!this.roToastAt || Date.now() - this.roToastAt > 3000) { this.roToastAt = Date.now(); this.toast('Read-only: your role cannot change this file'); } return; } this.setState(s => ({ cases: s.cases.map(c => c.id === s.activeId ? Component.numbered(fn(c)) : c) })); }
  upItem(id, patch) { this.upCase(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, ...patch } : i) })); }
  snap() { this.hist.push(JSON.stringify(this.cs())); if (this.hist.length > 25) this.hist.shift(); }
  undo() {
    const raw = this.hist.pop(); if (!raw) return this.toast('Nothing to undo');
    const c = JSON.parse(raw);
    this.setState(s => ({ cases: s.cases.map(x => x.id === c.id ? c : x), sel: null, selThread: null }));
    this.toast('Undone');
  }
  toast(msg) { clearTimeout(this.toastTimer); this.setState({ toast: msg }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2400); }
  snapOn() { return !!(this.props.snapToGrid ?? false); }
  snapPos(p) { return { x: Math.round(p.x / 20) * 20, y: Math.round(p.y / 20) * 20 }; }

  addItem(type, extra = {}, pinned = false, at = null) {
    this.sfx(pinned ? 'pin' : 'paper');
    const K = Component.K, id = Component.uid(), w = K.TYPES[type].w;
    let pos = { x: 0, y: 0 };
    if (pinned) {
      const c = at || this.center();
      pos = at ? { x: c.x - w / 2, y: c.y - 10 } : { x: c.x - w / 2 + Math.round(Math.random() * 80 - 40), y: c.y - 70 + Math.round(Math.random() * 80 - 40) };
      if (this.snapOn()) pos = this.snapPos(pos);
    }
    const it = { id, type, title: K.TYPES[type].title, body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', chain: '', amount: '', txFrom: '', txTo: '', source: '', collected: '', srcGrade: '', infoGrade: '', tlp: '', firstSeen: '', lastSeen: '', sector: '', region: '', impact: '', image: null, lat: '', lon: '', radius: '', geoLabel: '', marks: [], transcript: '', peaks: null, media: false, mediaName: '', feedKind: 'rss', feedUrl: '', feedQuery: '', feedItems: [], feedAt: '', feedStatus: '', monEvery: 15, monLast: null, monHist: [], watch: false, walletLast: null, time: '', stance: '', narrative: '', translation: '', lang: '', role: '', hand: false, f1: '', f2: '', f3: '', pinned, x: pos.x, y: pos.y, ...extra };
    this.snap();
    this.upCase(c => ({ ...c, items: [...c.items, it] }));
    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector', showRight: true });
    this.logEvt((pinned ? 'Pinned ' : 'Added to inbox: ') + K.TYPES[type].label.toLowerCase() + (this.itemLabel(it) ? ' — ' + this.itemLabel(it) : ''));
    if (pinned && type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);
    return id;
  }
  addThread(from, to, rel, why) {
    if (!from || !to || from === to) return; this.sfx('thread');
    const cs = this.cs();
    if (cs.threads.some(t => (t.from === from && t.to === to) || (t.from === to && t.to === from))) return this.toast('Those two are already connected');
    const id = Component.uid(), r = Component.K.REL[rel] ? rel : 'linked';
    this.snap();
    this.upCase(c => ({ ...c, threads: [...c.threads, { id, from, to, rel: r, conf: 'high', why: why || '' }] }));
    this.setState({ selThread: id, sel: null, pending: null, selGroup: null });
    const A = cs.items.find(i => i.id === from), B = cs.items.find(i => i.id === to);
    this.logEvt('Thread pinned: ' + (A ? this.itemLabel(A) : '?') + ' → ' + (B ? this.itemLabel(B) : '?') + ' (' + Component.K.REL[r].label + ')');
    this.toast('Thread pinned — ' + Component.K.REL[r].label);
  }
  removeThread(id) {
    const cs = this.cs(), t = cs.threads.find(x => x.id === id); if (t) { const A = cs.items.find(i => i.id === t.from), B = cs.items.find(i => i.id === t.to); this.logEvt('Thread cut: ' + (A ? this.itemLabel(A) : '?') + ' → ' + (B ? this.itemLabel(B) : '?')); }
    this.snap();
    this.upCase(c => ({ ...c, threads: c.threads.filter(t => t.id !== id) }));
    this.setState(s => ({ selThread: s.selThread === id ? null : s.selThread }));
  }
  removeItem(id) {
    const it = this.cs().items.find(i => i.id === id); if (it) this.logEvt('Removed ' + Component.K.TYPES[it.type].label.toLowerCase() + ' — ' + this.itemLabel(it));
    this.snap();
    this.upCase(c => ({ ...c, items: c.items.filter(i => i.id !== id), threads: c.threads.filter(t => t.from !== id && t.to !== id) }));
    this.setState(s => ({ sel: s.sel === id ? null : s.sel }));
    this.toast('Deleted · Ctrl+Z to undo');
  }
  pinItem(id, at) {
    const it = this.cs().items.find(i => i.id === id); if (!it) return;
    const w = Component.K.TYPES[it.type].w, c = at || this.center();
    let pos = { x: c.x - w / 2, y: c.y - 10 }; if (this.snapOn()) pos = this.snapPos(pos);
    this.upItem(id, { pinned: true, ...pos });
    this.setState({ sel: id, selThread: null, selGroup: null, tab: 'inspector' });
    this.logEvt('Pinned to board: ' + this.itemLabel(it));
    if (it.type === 'indicator' && it.value && window.CIBEnrich) window.CIBEnrich.schedule(id);
  }

  // ---------- log, clusters, snapshots
  logEvt(m) { const t = new Date().toISOString(), by = (this.state.analyst || '').trim(); this.upCase(c => ({ ...c, log: [...(c.log || []), { t, m: (by ? by + ' · ' : '') + m }].slice(-400) })); }
  fmtWhen(t) { const d = new Date(t), now = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return d.toDateString() === now.toDateString() ? hm : d.getDate() + ' ' + Component.K.MONTHS[d.getMonth()] + ' ' + hm; }
  groupMembers(g, items) { const K = Component.K; return items.filter(i => { if (!i.pinned) return false; const cx = i.x + K.TYPES[i.type].w / 2, cy = i.y + this.h(i.id) / 2; return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h; }); }
  addGroup = (title) => {
    const spot = this.freeSpot(520, 340), g = { id: Component.uid(), title: typeof title === 'string' && title ? title : 'New cluster', x: spot.x, y: spot.y, w: 520, h: 340 };
    this.snap(); this.upCase(cs => ({ ...cs, groups: [...(cs.groups || []), g] }));
    this.setState({ selGroup: g.id, sel: null, selThread: null, pending: null, tab: 'inspector', showRight: true, mode: 'board' });
    this.logEvt('Cluster added: ' + g.title); setTimeout(() => this.focusGroup(g), 60); return g;
  };
  focusGroup(g) { const r = this.rect(), v = this.state.view; this.setState({ view: { ...v, x: r.width / 2 - (g.x + g.w / 2) * v.z, y: r.height / 2 - (g.y + g.h / 2) * v.z } }); }
  removeGroup(id) { const g = (this.cs().groups || []).find(x => x.id === id); this.snap(); this.upCase(c => ({ ...c, groups: (c.groups || []).filter(x => x.id !== id) })); this.setState(s => ({ selGroup: s.selGroup === id ? null : s.selGroup })); if (g) this.logEvt('Cluster removed: ' + g.title); }
  groupDown(e, g) {
    if (e.button !== 0) return; e.stopPropagation();
    const members = this.groupMembers(g, this.cs().items).map(i => ({ id: i.id, x: i.x, y: i.y }));
    this.drag = { kind: 'group', id: g.id, sx: e.clientX, sy: e.clientY, gx: g.x, gy: g.y, members, moved: false };
    this.setState({ selGroup: g.id, sel: null, selThread: null, pending: null, tab: 'inspector', showRight: true });
  }
  groupResizeDown(e, g) { if (e.button !== 0) return; e.stopPropagation(); this.drag = { kind: 'gresize', id: g.id, sx: e.clientX, sy: e.clientY, gw: g.w, gh: g.h, moved: false }; this.setState({ selGroup: g.id, sel: null, selThread: null }); }
  saveSnapshot = () => {
    const cs = this.cs(), name = (this.state.snapName || '').trim() || 'Snapshot ' + ((cs.snapshots || []).length + 1);
    const snap = { id: Component.uid(), name, t: new Date().toISOString(), items: cs.items.map(i => ({ ...i, image: i.image ? '__keep__' : null })), threads: cs.threads, groups: cs.groups || [] };
    this.upCase(c => ({ ...c, snapshots: [...(c.snapshots || []), snap] })); this.setState({ snapName: '' }); this.logEvt('Snapshot saved: ' + name); this.toast('Snapshot saved — ' + name);
  };
  restoreSnapshot(id) {
    const cs = this.cs(), sn = (cs.snapshots || []).find(x => x.id === id); if (!sn) return;
    if (!window.confirm('Restore "' + sn.name + '"? The current board can be brought back with Ctrl+Z.')) return;
    const imgs = Object.fromEntries(cs.items.map(i => [i.id, i.image]));
    this.snap(); this.upCase(c => ({ ...c, items: sn.items.map(i => ({ ...i, image: i.image === '__keep__' ? (imgs[i.id] || null) : i.image })), threads: sn.threads, groups: sn.groups || [] }));
    this.setState({ sel: null, selThread: null, selGroup: null, diffId: null }); this.logEvt('Snapshot restored: ' + sn.name); this.toast('Restored — ' + sn.name); setTimeout(() => this.fit(), 60);
  }
  diffSnapshot(sn, cs) {
    const L = it => Component.numText('E', it.num) + ' ' + this.itemLabel(it), TL = (t, byId) => Component.numText('T', t.num) + ' ' + (byId[t.from] ? this.itemLabel(byId[t.from]) : '?') + ' → ' + (byId[t.to] ? this.itemLabel(byId[t.to]) : '?');
    const a = Object.fromEntries(sn.items.map(i => [i.id, i])), b = Object.fromEntries(cs.items.map(i => [i.id, i])), ta = Object.fromEntries(sn.threads.map(t => [t.id, t])), tb = Object.fromEntries(cs.threads.map(t => [t.id, t]));
    const rows = [];
    cs.items.filter(i => !a[i.id]).forEach(i => rows.push({ color: '#3fae63', text: '+ ' + L(i) }));
    sn.items.filter(i => !b[i.id]).forEach(i => rows.push({ color: '#ff2a3c', text: '− ' + L(i) }));
    cs.items.filter(i => a[i.id] && ['title', 'body', 'value', 'status', 'date', 'tags', 'pinned'].some(k => (a[i.id][k] || '') !== (i[k] || ''))).forEach(i => rows.push({ color: '#e8a71c', text: '~ ' + L(i) }));
    cs.threads.filter(t => !ta[t.id]).forEach(t => rows.push({ color: '#3fae63', text: '+ ' + TL(t, b) }));
    sn.threads.filter(t => !tb[t.id]).forEach(t => rows.push({ color: '#ff2a3c', text: '− ' + TL(t, a) }));
    const n = (c) => rows.filter(r => r.color === c).length;
    return { rows, summary: rows.length ? n('#3fae63') + ' added · ' + n('#ff2a3c') + ' removed · ' + n('#e8a71c') + ' changed' : 'No differences from the current board' };
  }

  // ---------- media, files, parsing
  esc(x) { return String(x ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  idb() { if (!this._idb) this._idb = new Promise((res, rej) => { const r = indexedDB.open('cib-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return this._idb; }
  putBlob(id, blob) { if (window.CIBStore && window.CIBStore.putFile) window.CIBStore.putFile(id, blob, this.state.activeId).catch(() => {}); return this.idb().then(db => new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); })); }
  getBlob(id) { return this.idb().then(db => new Promise((res, rej) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => { if (q.result) return res(q.result); if (window.CIBStore && window.CIBStore.getFile) window.CIBStore.getFile(id).then(b => { if (b) this.putBlob(id, b); res(b || null); }).catch(() => res(null)); else res(null); }; q.onerror = () => rej(q.error); })); }
  mediaSrc(it) { if (!it.media) return ''; const m = this.mediaUrl || (this.mediaUrl = {}); if (m[it.id]) return m[it.id]; if (!m['_' + it.id]) { m['_' + it.id] = true; this.getBlob(it.id).then(bl => { if (bl) { m[it.id] = URL.createObjectURL(bl); this.forceUpdate(); } }).catch(() => {}); } return ''; }
  addFile(f, at) {
    const t = f.type || '', n = f.name || 'file', ext = (n.split('.').pop() || '').toLowerCase();
    if (t.startsWith('image/')) return Promise.all([this.readImage(f), this.fileMeta(f)]).then(([src, meta]) => { const id = this.addItem('photo', { title: n.replace(/\.[^.]+$/, ''), image: src, date: this.today(), collected: this.today(), ...meta }, true, at); this.exifGps(src).then(g => { if (g) { this.upItem(id, { lat: g.lat.toFixed(5), lon: g.lon.toFixed(5), geoLabel: 'EXIF GPS' }); this.toast('GPS found in the photo — plotted on the map'); } }); });
    const kind = t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : (t === 'application/pdf' || ext === 'pdf') ? 'pdf' : (ext === 'eml' || t === 'message/rfc822') ? 'email' : ['log', 'txt', 'json', 'csv', 'js', 'py', 'ps1', 'sh', 'xml', 'html', 'yaml', 'yml', 'conf', 'ini', 'md'].includes(ext) ? 'code' : 'doc';
    return this.fileMeta(f).then(async meta => {
      if (kind === 'email') { const em = this.parseEml(await f.text()); this.addItem('email', { title: em.subject || n, body: em.preview, emFrom: em.from, emTo: em.to, emDate: em.date, emPath: em.path.join(' → '), emUrls: em.urls, emIps: em.ips, emAttach: em.attachments, emReply: em.replyTo, date: em.isoDate || this.today(), collected: this.today(), ...meta }, true, at); return; }
      if (kind === 'code') { this.addItem('code', { title: n, body: (await f.text()).slice(0, 20000), lang: ext, date: this.today(), collected: this.today(), ...meta }, true, at); return; }
      if (kind === 'doc') { this.addItem('doc', { title: n, body: Math.max(1, Math.round(f.size / 1024)) + ' KB · ' + (t || 'file'), date: this.today(), collected: this.today(), ...meta }, true, at); return; }
      const id = this.addItem(kind, { title: n.replace(/\.[^.]+$/, ''), date: this.today(), collected: this.today(), mediaName: n, ...meta }, true, at);
      await this.putBlob(id, f); this.upItem(id, { media: true }); if (kind === 'audio') this.peaksFor(id, f);
    });
  }
  pickMedia(id) { this.uploadFor = id; const inp = document.querySelector('[data-file="media"]'); if (inp) { inp.value = ''; inp.click(); } }
  onMediaFile = e => { const f = e.target.files && e.target.files[0], id = this.uploadFor; if (!f || !id) return; const it = this.cs().items.find(i => i.id === id); if (!it) return; this.fileMeta(f).then(async meta => { const { source, ...m } = meta; if (it.type === 'email') { const em = this.parseEml(await f.text()); this.upItem(id, { title: em.subject || it.title, body: em.preview, emFrom: em.from, emTo: em.to, emDate: em.date, emPath: em.path.join(' → '), emUrls: em.urls, emIps: em.ips, emAttach: em.attachments, emReply: em.replyTo, ...m }); return; } await this.putBlob(id, f); this.upItem(id, { media: true, mediaName: f.name, ...m }); if (it.type === 'audio') this.peaksFor(id, f); this.logEvt('File attached: ' + f.name + ' sha256 ' + m.fileHash.slice(0, 12) + '…'); }); };
  parseEml(text) {
    const nl = text.indexOf('\r\n\r\n') >= 0 ? '\r\n' : '\n', idx = text.indexOf(nl + nl), rawH = idx < 0 ? text : text.slice(0, idx), body = idx < 0 ? '' : text.slice(idx + nl.length * 2);
    const lines = rawH.split(nl).reduce((a, l) => { if (/^[ \t]/.test(l) && a.length) a[a.length - 1] += ' ' + l.trim(); else a.push(l); return a; }, []);
    const H = {}, all = []; lines.forEach(l => { const m = l.match(/^([\w-]+):\s*(.*)$/); if (m) { const k = m[1].toLowerCase(); all.push([k, m[2]]); if (!H[k]) H[k] = m[2]; } });
    const dec = s => String(s || '').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, enc, d) => { try { return enc.toUpperCase() === 'B' ? decodeURIComponent(escape(atob(d))) : d.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))); } catch (e) { return d; } });
    const ips = []; all.filter(([k]) => k === 'received').forEach(([, v]) => { (v.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach(ip => { if (!/^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) && !ips.includes(ip)) ips.push(ip); }); });
    let plain = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)));
    (body.match(/\n(?:[A-Za-z0-9+/=]{60,}\r?\n)+/g) || []).forEach(b64 => { try { plain += '\n' + atob(b64.replace(/\s+/g, '')); } catch (e) {} });
    const urls = Array.from(new Set((plain.match(/https?:\/\/[^\s"'<>)\]]+/g) || []).map(u => u.replace(/[.,;:!?]+$/, '')))).slice(0, 40);
    const attachments = Array.from(new Set((rawH + body).match(/filename="?([^";\r\n]+)"?/gi) || [])).map(x => x.replace(/^filename="?/i, '').replace(/"$/, ''));
    const textOnly = plain.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const d = H.date ? new Date(H.date) : null;
    return { from: dec(H.from), to: dec(H.to), subject: dec(H.subject), date: H.date || '', isoDate: d && !isNaN(d) ? d.toISOString().slice(0, 10) : '', path: ips.slice().reverse(), ips, urls, attachments, preview: textOnly.slice(0, 600), replyTo: dec(H['reply-to']) };
  }
  emailExtract = () => {
    const it = this.cs().items.find(i => i.id === this.state.sel); if (!it || it.type !== 'email') return; const src = 'Extracted from email: ' + (it.title || ''), seen = new Set(this.cs().items.map(i => (i.value || '').toLowerCase())); let n = 0;
    const add = (type, extra) => { const key = String(extra.value || extra.title || '').toLowerCase(); if (!key || seen.has(key)) return; seen.add(key); this.addItem(type, { source: src, collected: this.today(), ...extra }, false); n++; };
    const em = (it.emFrom || '').match(/[\w.+-]+@[\w.-]+\.\w+/); if (em) { add('indicator', { kind: 'email', value: em[0].toLowerCase(), title: 'Sender' }); add('indicator', { kind: 'domain', value: em[0].split('@')[1].toLowerCase(), title: 'Sender domain' }); }
    const rp = (it.emReply || '').match(/[\w.+-]+@[\w.-]+\.\w+/); if (rp) add('indicator', { kind: 'email', value: rp[0].toLowerCase(), title: 'Reply-To' });
    (it.emUrls || []).forEach(u => add('indicator', { kind: 'url', value: u, title: 'Link in body' })); (it.emIps || []).forEach(ip => add('indicator', { kind: 'ip', value: ip, title: 'Relay in Received path' })); (it.emAttach || []).forEach(a => add('doc', { title: a, body: 'Attachment named in the email' }));
    this.logEvt('Email extracted: ' + n + ' cards'); this.toast(n + ' cards added to the inbox');
  };
  exifGps(dataUrl) { return new Promise(res => { try { if (!/^data:image\/jpe?g/i.test(dataUrl)) return res(null); const bin = atob(dataUrl.split(',')[1].slice(0, 260000)), n = bin.length; let p = 2; while (p < n) { if (bin.charCodeAt(p) !== 0xFF) break; const marker = bin.charCodeAt(p + 1), len = (bin.charCodeAt(p + 2) << 8) | bin.charCodeAt(p + 3); if (marker === 0xE1 && bin.substr(p + 4, 4) === 'Exif') { const t = p + 10, le = bin.substr(t, 2) === 'II'; const u16 = o => le ? (bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8)) : ((bin.charCodeAt(o) << 8) | bin.charCodeAt(o + 1)); const u32 = o => le ? ((u16(o) | (u16(o + 2) << 16)) >>> 0) : (((u16(o) << 16) | u16(o + 2)) >>> 0); const ifd0 = t + u32(t + 4); let gps = 0; const cnt = u16(ifd0); for (let i = 0; i < cnt; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gps = t + u32(e + 8); } if (!gps) return res(null); const rat = o => { const a = u32(o), c = u32(o + 4); return c ? a / c : 0; }; const g = {}, gc = u16(gps); for (let i = 0; i < gc; i++) { const e = gps + 2 + i * 12, tag = u16(e); if (tag === 1 || tag === 3) g[tag] = bin[e + 8]; if (tag === 2 || tag === 4) { const o = t + u32(e + 8); g[tag] = rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600; } } if (g[2] == null || g[4] == null) return res(null); return res({ lat: g[1] === 'S' ? -g[2] : g[2], lon: g[3] === 'W' ? -g[4] : g[4] }); } p += 2 + len; } res(null); } catch (e) { res(null); } }); }
  embedUrl(u) { u = String(u || '').trim(); if (!u) return null; let m; if ((m = u.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/))) return 'https://www.youtube-nocookie.com/embed/' + m[1]; if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return 'https://player.vimeo.com/video/' + m[1]; if ((m = u.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/))) return 'https://platform.twitter.com/embed/Tweet.html?id=' + m[1] + '&theme=dark'; if ((m = u.match(/tiktok\.com\/.*\/video\/(\d+)/))) return 'https://www.tiktok.com/embed/v2/' + m[1]; if ((m = u.match(/t\.me\/(\w+)\/(\d+)/))) return 'https://t.me/' + m[1] + '/' + m[2] + '?embed=1&dark=1'; if ((m = u.match(/dailymotion\.com\/video\/(\w+)/))) return 'https://www.dailymotion.com/embed/video/' + m[1]; if (/\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(u)) return { direct: u }; return null; }
  fmtT(t) { t = Math.max(0, Math.round(+t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  markMedia = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; let t = 0; if (it.type === 'pdf') { const p = window.prompt('Page number'); if (!p) return; t = parseInt(p, 10) || 1; } else { const el = document.querySelector('[data-media="' + it.id + '"]'); t = el ? el.currentTime : 0; } this.upItem(it.id, { marks: [...(it.marks || []), { t, label: it.type === 'pdf' ? 'Page ' + t : 'Bookmark' }] }); };
  seekMedia(it, t) { if (it.type === 'pdf') { this.pdfPage = this.pdfPage || {}; this.pdfPage[it.id] = t; this.forceUpdate(); return; } const el = document.querySelector('[data-media="' + it.id + '"]'); if (el) { el.currentTime = t; if (el.play) el.play().catch(() => {}); } }
  frameGrab = () => { const it = this.cs().items.find(i => i.id === this.state.sel), el = it && document.querySelector('[data-media="' + it.id + '"]'); if (!el || !el.videoWidth) return this.toast('Attach a video file first; embeds cannot be captured'); try { const cv = document.createElement('canvas'); cv.width = el.videoWidth; cv.height = el.videoHeight; cv.getContext('2d').drawImage(el, 0, 0); const src = cv.toDataURL('image/jpeg', .9); this.addItem('photo', { title: (it.title || 'Video') + ' @ ' + this.fmtT(el.currentTime), image: src, date: it.date || this.today(), collected: this.today(), source: 'Frame from ' + (it.mediaName || it.title), fileName: 'frame.jpg', addedAt: new Date().toISOString(), addedBy: (this.state.analyst || '').trim() || 'unknown analyst' }, true); this.toast('Frame pinned'); } catch (e) { this.toast('Cannot capture that frame'); } };
  toggleRec = async () => { const id = this.state.sel; if (!id) return; if (this.rec) { this.rec.stop(); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const rec = new MediaRecorder(stream), chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); this.rec = null; const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); await this.putBlob(id, blob); this.upItem(id, { media: true, mediaName: 'voice-note-' + this.today() + '.webm', fileName: 'voice-note.webm', addedAt: new Date().toISOString(), addedBy: (this.state.analyst || '').trim() || 'unknown analyst' }); this.peaksFor(id, blob); this.setState({ recOn: false }); this.logEvt('Voice note recorded'); }; rec.start(); this.rec = rec; this.setState({ recOn: true }); } catch (e) { this.toast('Microphone unavailable'); } };
  peaksFor(id, blob) { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; blob.arrayBuffer().then(buf => new AC().decodeAudioData(buf)).then(ab => { const d = ab.getChannelData(0), N = 48, step = Math.max(1, Math.floor(d.length / N)), out = []; for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(d[j])); out.push(m); } const mx = Math.max(.01, ...out); this.upItem(id, { peaks: out.map(x => Math.max(4, Math.round(x / mx * 100))) }); }).catch(() => {}); } catch (e) {} }
  codeLines(text) { const RX = /((?:https?:\/\/)[^\s"'<>]+|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-f0-9]{32,64}\b|\b[\w.-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ru|cn|xyz|top|info|biz|onion|su|cc|tk|pw|me|co|uk|de|app|dev)\b|\bCVE-\d{4}-\d{4,7}\b|\b(?:error|fail(?:ed|ure)?|denied|unauthori[sz]ed|malware|exploit|powershell|cmd\.exe|mimikatz|base64)\b)/gi; return String(text || '').split('\n').slice(0, 60).map(l => { const segs = []; let last = 0, m; RX.lastIndex = 0; while ((m = RX.exec(l))) { if (m.index > last) segs.push({ t: l.slice(last, m.index), color: '#cfd3c3', bg: 'transparent' }); const hot = /^(error|fail|denied|unauth|malware|exploit|powershell|cmd|mimikatz|base64)/i.test(m[0]); segs.push({ t: m[0], color: hot ? '#ffb3b8' : '#ffe2a0', bg: hot ? 'rgba(255,42,60,.18)' : 'rgba(232,167,28,.12)' }); last = m.index + m[0].length; } if (last < l.length || !segs.length) segs.push({ t: l.slice(last) || ' ', color: '#cfd3c3', bg: 'transparent' }); return segs; }); }
  linksOf(it) { const out = [], seen = new Set(), push = u => { u = String(u || '').trim().replace(/[.,;:!?)]+$/, ''); if (!/^https?:\/\//i.test(u) || seen.has(u)) return; seen.add(u); let label = u; try { const x = new URL(u); label = x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.slice(0, 18) + (x.pathname.length > 18 ? '…' : '') : ''); } catch (e) {} out.push({ href: u, label }); }; if (it.type !== 'link' && it.type !== 'monitor') push(it.url); if (it.type === 'indicator' && it.kind === 'url') push(this.refang(it.value)); (String(it.body || '').match(/https?:\/\/[^\s"'<>)\]]+/g) || []).forEach(push); return out.slice(0, 6); }
  // ---------- maps + geo
  tileUrl() { const light = (this.theme().desk || '#000') > '#8'; return 'https://server.arcgisonline.com/ArcGIS/rest/services/' + (light ? 'World_Street_Map' : 'Canvas/World_Dark_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}'; }
  geoOf(it) { const la = parseFloat(it.lat), lo = parseFloat(it.lon); return isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? [la, lo] : null; }
  syncMaps() {
    if (!window.L) return; const cs = this.cs(); if (!cs) return; this.maps = this.maps || {};
    document.querySelectorAll('[data-map]').forEach(el => { const id = el.getAttribute('data-map'), key = el.getAttribute('data-geo'), it = cs.items.find(i => i.id === id), g = it && this.geoOf(it); if (!g) return; let M = this.maps[id]; if (!M || M.el !== el) { if (M) { try { M.map.remove(); } catch (e) {} } const map = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: false }); L.tileLayer(this.tileUrl(), { maxZoom: 16 }).addTo(map); M = this.maps[id] = { el, map, key: '' }; } if (M.key !== key) { M.key = key; if (M.marker) M.marker.remove(); if (M.circle) M.circle.remove(); M.marker = L.circleMarker(g, { radius: 6, color: '#6b0a10', fillColor: '#ff2a3c', fillOpacity: 1, weight: 2 }).addTo(M.map); const r = parseFloat(it.radius); if (isFinite(r) && r > 0) M.circle = L.circle(g, { radius: r, color: '#ff2a3c', weight: 1, fillOpacity: .08 }).addTo(M.map); M.map.setView(g, isFinite(r) && r > 0 ? Math.max(6, Math.min(16, Math.round(15 - Math.log2(r / 300)))) : 13); setTimeout(() => M.map.invalidateSize(), 60); } });
    Object.keys(this.maps).forEach(id => { if (!document.contains(this.maps[id].el)) { try { this.maps[id].map.remove(); } catch (e) {} delete this.maps[id]; } });
    this.syncGeo();
  }
  syncGeo() {
    const el = document.querySelector('[data-geomap]'); if (!el || !window.L) { if (this.geo) { try { this.geo.map.remove(); } catch (e) {} this.geo = null; } return; }
    const cs = this.cs(); if (!this.geo || this.geo.el !== el) { const map = L.map(el, { zoomControl: true, attributionControl: true }); L.tileLayer(this.tileUrl(), { maxZoom: 16, attribution: 'Tiles © Esri' }).addTo(map); this.geo = { el, map, layer: L.layerGroup().addTo(map), key: '' }; map.setView([20, 0], 2); setTimeout(() => map.invalidateSize(), 60); }
    const G = this.geo, located = cs.items.map(i => ({ i, g: this.geoOf(i) })).filter(x => x.g), key = located.map(x => x.i.id + x.g.join(',') + (x.i.date || '') + (x.i.time || '')).join('|') + '#' + cs.threads.length;
    if (G.key === key) return; G.key = key; G.layer.clearLayers(); const byId = {};
    located.forEach(x => { byId[x.i.id] = x; L.circleMarker(x.g, { radius: 7, color: '#111', fillColor: this.pinColors(x.i.type, 'by type')[1], fillOpacity: 1, weight: 1.5 }).bindPopup('<b>' + this.esc(this.itemLabel(x.i)) + '</b><br>' + this.esc(Component.K.TYPES[x.i.type].label + (x.i.date ? ' · ' + this.fmtDate(x.i.date) + (x.i.time ? ' ' + x.i.time : '') : '') + (x.i.geoLabel ? ' · ' + x.i.geoLabel : ''))).on('click', () => this.setState({ sel: x.i.id, tab: 'inspector', showRight: true })).addTo(G.layer); });
    cs.threads.forEach(t => { const A = byId[t.from], B = byId[t.to]; if (A && B) L.polyline([A.g, B.g], { color: '#ff2a3c', weight: 2, opacity: .85 }).addTo(G.layer); });
    const route = located.filter(x => x.i.date).sort((a, c) => (a.i.date + (a.i.time || '')) < (c.i.date + (c.i.time || '')) ? -1 : 1); if (route.length > 1) L.polyline(route.map(x => x.g), { color: '#e8a71c', weight: 2, dashArray: '6 6', opacity: .9 }).addTo(G.layer);
    if (located.length) G.map.fitBounds(L.latLngBounds(located.map(x => x.g)).pad(.3), { maxZoom: 12 });
    if (!located.length) G.map.setView([20, 0], 2); const st = located.length ? located.length + ' located · ' + route.length + ' dated' : 'Nothing located yet — add lat/lon to a location card, Locate IPs, or drop a geotagged photo'; if (st !== this.state.geoStatus) this.setState({ geoStatus: st });
  }
  toggleGeo = () => { this.drag = null; clearInterval(this.routeTimer); this.setState(s => ({ mode: s.mode === 'geo' ? 'board' : 'geo', linking: null, pending: null, routeOn: false })); setTimeout(() => this.fit(), 80); };
  playRoute = () => { if (this.state.routeOn) { clearInterval(this.routeTimer); return this.setState({ routeOn: false }); } const cs = this.cs(), route = cs.items.map(i => ({ i, g: this.geoOf(i) })).filter(x => x.g && x.i.date).sort((a, c) => (a.i.date + (a.i.time || '')) < (c.i.date + (c.i.time || '')) ? -1 : 1); if (route.length < 2 || !this.geo) return this.toast('Need two or more dated, located cards'); let k = 0; const step = () => { const x = route[k]; this.geo.map.flyTo(x.g, 10, { duration: .9 }); L.popup({ closeButton: false }).setLatLng(x.g).setContent('<b>' + this.esc(this.fmtDate(x.i.date) + (x.i.time ? ' ' + x.i.time : '')) + '</b><br>' + this.esc(this.itemLabel(x.i))).openOn(this.geo.map); k = (k + 1) % route.length; }; step(); this.routeTimer = setInterval(step, 1800); this.setState({ routeOn: true }); };
  async locateIp(cid, it) { try { const r = await (await fetch('https://ipapi.co/' + encodeURIComponent(this.refang(it.value)) + '/json/')).json(); if (r && isFinite(r.latitude)) this.upItemIn(cid, it.id, { lat: String(r.latitude), lon: String(r.longitude), geoLabel: [r.city, r.country_name, r.org].filter(Boolean).join(' · ') }); } catch (e) {} }
  locateIps = async () => { const cs = this.cs(), list = cs.items.filter(i => i.type === 'indicator' && i.kind === 'ip' && !this.geoOf(i)); if (!list.length) return this.toast('Every IP is already located'); this.setState({ geoStatus: 'Locating ' + list.length + ' IPs…' }); for (const it of list) { await this.locateIp(cs.id, it); await new Promise(r => setTimeout(r, 450)); } this.toast(list.length + ' IPs located'); };
  locateSel = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (it) this.locateIp(this.cs().id, it).then(() => this.toast('Located')); };
  geocode = async () => { const q = (this.state.geoQuery || '').trim(), id = this.state.sel; if (!q || !id) return; try { const r = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))).json(); if (!r.length) return this.toast('Nothing found for that address'); this.upItem(id, { lat: (+r[0].lat).toFixed(5), lon: (+r[0].lon).toFixed(5), geoLabel: r[0].display_name.slice(0, 90) }); this.setState({ geoQuery: '' }); this.toast('Pinned on the map'); } catch (e) { this.toast('Geocoder unreachable'); } };
  // ---------- live feeds, monitors, wallets
  upItemIn(cid, id, patch) { this.setState(s => ({ cases: s.cases.map(c => c.id === cid ? { ...c, items: c.items.map(i => i.id === id ? { ...i, ...patch } : i) } : c) })); }
  pushEvent(ev) { this.setState(s => ({ events: [...(s.events || []), { id: Component.uid(), t: new Date().toISOString(), ...ev }].slice(-200) })); }
  proxy(u) { return '/api/proxy?url=' + encodeURIComponent(u); }
  async fetchText(u) { try { const r = await fetch(u); if (r.ok) return await r.text(); throw new Error('HTTP ' + r.status); } catch (e) { const r2 = await fetch(this.proxy(u)); if (!r2.ok) throw new Error('HTTP ' + r2.status); return r2.text(); } }
  async fetchJson(u) { return JSON.parse(await this.fetchText(u)); }
  async fetchFeed(it) {
    const k = it.feedKind || 'rss', u = (it.feedUrl || '').trim(), q = (it.feedQuery || '').trim().toLowerCase(), enc = encodeURIComponent, hit = s => !q || q.split(/[,\s]+/).filter(Boolean).some(w => String(s).toLowerCase().includes(w)), iso = d => { const x = new Date(d); return isNaN(x) ? '' : x.toISOString(); }, strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let rows = [];
    if (k === 'rss') { if (!u) throw new Error('Feed URL needed'); const xml = new DOMParser().parseFromString(await this.fetchText(u), 'text/xml'); rows = Array.from(xml.querySelectorAll('item, entry')).map(n => { const g = s => { const e = n.getElementsByTagName(s)[0]; return e ? e.textContent.trim() : ''; }; const le = n.getElementsByTagName('link')[0]; return { title: g('title'), link: le ? (le.getAttribute('href') || le.textContent.trim()) : '', date: iso(g('pubDate') || g('updated') || g('published') || g('dc:date')) }; }); }
    else if (k === 'threatfox') { const r = await (await fetch('https://threatfox-api.abuse.ch/api/v1/', { method: 'POST', body: JSON.stringify({ query: 'get_iocs', days: 1 }) })).json(); rows = (r.data || []).map(x => ({ title: x.ioc + ' · ' + x.threat_type + ' · ' + (x.malware_printable || x.malware), link: 'https://threatfox.abuse.ch/ioc/' + x.id + '/', date: iso(x.first_seen), ioc: x.ioc })); }
    else if (k === 'urlhaus') { const r = await (await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/100/', { method: 'POST' })).json(); rows = (r.urls || []).map(x => ({ title: x.url + ' · ' + (x.threat || '') + (x.tags ? ' · ' + x.tags.join(',') : ''), link: x.urlhaus_reference, date: iso(x.date_added), ioc: x.url })); }
    else if (k === 'kev') { const r = await this.fetchJson('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'); rows = (r.vulnerabilities || []).sort((a, c) => c.dateAdded.localeCompare(a.dateAdded)).slice(0, 80).map(x => ({ title: x.cveID + ' · ' + x.vendorProject + ' ' + x.product + ' · ' + x.vulnerabilityName, link: 'https://nvd.nist.gov/vuln/detail/' + x.cveID, date: iso(x.dateAdded), ioc: x.cveID })); }
    else if (k === 'nvd') { const r = await (await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=25&keywordSearch=' + enc(u || q || 'exploited'))).json(); rows = (r.vulnerabilities || []).map(v => ({ title: v.cve.id + ' · ' + ((v.cve.descriptions.find(d => d.lang === 'en') || {}).value || '').slice(0, 140), link: 'https://nvd.nist.gov/vuln/detail/' + v.cve.id, date: iso(v.cve.published), ioc: v.cve.id })); }
    else if (k === 'reddit') { const path = /^u\//i.test(u) ? 'user/' + u.slice(2) : 'r/' + u.replace(/^r\//i, ''); const r = await (await fetch('https://www.reddit.com/' + path + '/new.json?limit=25')).json(); rows = ((r.data || {}).children || []).map(c => ({ title: c.data.title || (c.data.body || '').slice(0, 120), link: 'https://www.reddit.com' + c.data.permalink, date: new Date(c.data.created_utc * 1000).toISOString() })); }
    else if (k === 'mastodon') { const m = u.match(/^(?:https?:\/\/)?([^/@#\s]+\.[^/@#\s]+)?\/?(?:@([\w.]+)|#(\w+))?/) || []; const inst = 'https://' + (m[1] || 'mastodon.social'); if (m[3]) { const r = await (await fetch(inst + '/api/v1/timelines/tag/' + enc(m[3]) + '?limit=25')).json(); rows = r.map(p => ({ title: '@' + p.account.acct + ': ' + strip(p.content).slice(0, 140), link: p.url, date: p.created_at })); } else { const a = await (await fetch(inst + '/api/v1/accounts/lookup?acct=' + enc(m[2] || u.replace(/^@/, '')))).json(); const r = await (await fetch(inst + '/api/v1/accounts/' + a.id + '/statuses?limit=25')).json(); rows = r.map(p => ({ title: strip(p.content).slice(0, 140) || '(media)', link: p.url, date: p.created_at })); } }
    else if (k === 'bluesky') { const r = await (await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?limit=25&actor=' + enc(u.replace(/^@/, '')))).json(); rows = (r.feed || []).map(f => ({ title: (f.post.record.text || '').slice(0, 140), link: 'https://bsky.app/profile/' + f.post.author.handle + '/post/' + f.post.uri.split('/').pop(), date: f.post.record.createdAt })); }
    else if (k === 'telegram') { const ch = u.replace(/^(https?:\/\/)?t\.me\/(s\/)?/, '').replace(/^@/, '').split('/')[0]; const html = new DOMParser().parseFromString(await this.fetchText('https://t.me/s/' + ch), 'text/html'); rows = Array.from(html.querySelectorAll('.tgme_widget_message')).map(n => { const t = n.querySelector('.tgme_widget_message_text'), tm = n.querySelector('time'), a = n.querySelector('a.tgme_widget_message_date'); return { title: (t ? t.textContent : '(media)').trim().slice(0, 140), link: a ? a.href : 'https://t.me/s/' + ch, date: tm ? tm.getAttribute('datetime') : '' }; }).reverse(); }
    else if (k === 'ransomware') { const r = await this.fetchJson('https://api.ransomware.live/v2/recentvictims'); rows = (Array.isArray(r) ? r : (r.victims || r.data || [])).slice(0, 80).map(x => ({ title: (x.victim || x.post_title || '?') + ' · ' + (x.group || x.group_name || '') + ((x.activity || x.sector) ? ' · ' + (x.activity || x.sector) : ''), link: x.claim_url || x.post_url || 'https://www.ransomware.live/', date: iso(x.discovered || x.published) })); }
    return rows.filter(r => r.title && hit(r.title + ' ' + (r.ioc || ''))).slice(0, 40);
  }
  async refreshFeed(cid, it) { this.upItemIn(cid, it.id, { feedStatus: 'fetching…' }); try { const rows = await this.fetchFeed(it), old = new Set((it.feedItems || []).map(r => r.link + r.title)), fresh = rows.filter(r => !old.has(r.link + r.title)); this.upItemIn(cid, it.id, { feedItems: rows, feedAt: new Date().toISOString(), feedStatus: rows.length ? rows.length + ' items' : 'No items matched' }); if ((it.feedItems || []).length && fresh.length) this.pushEvent({ kind: 'feed', text: fresh.length + ' new in ' + (it.title || 'feed') + ': ' + fresh[0].title.slice(0, 80), caseId: cid, itemId: it.id }); } catch (e) { this.upItemIn(cid, it.id, { feedStatus: 'Blocked or unreachable — ' + String(e.message || e).slice(0, 60), feedAt: new Date().toISOString() }); } }
  async checkMonitor(cid, it) { const u = (it.url || '').trim(); if (!u) return; let status = 'down', title = '', hash = ''; try { const txt = await this.fetchText(u); status = 'up'; const m = txt.match(/<title[^>]*>([^<]*)<\/title>/i); title = m ? m[1].trim().slice(0, 120) : ''; const dg = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, '').slice(0, 300000))); hash = Array.from(new Uint8Array(dg)).slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { try { await fetch(u, { mode: 'no-cors', cache: 'no-store' }); status = 'reachable'; } catch (e2) { status = 'down'; } } const prev = it.monLast, changed = !!(prev && prev.hash && hash && prev.hash !== hash), wentDown = !!(prev && prev.status !== 'down' && status === 'down'), at = new Date().toISOString(); this.upItemIn(cid, it.id, { monLast: { at, status, title, hash, changed }, monHist: [...(it.monHist || []), { at, status, changed }].slice(-40) }); if (changed) this.pushEvent({ kind: 'monitor', text: 'Page changed: ' + (it.title || u), caseId: cid, itemId: it.id }); if (wentDown) this.pushEvent({ kind: 'monitor', text: 'Site down: ' + (it.title || u), caseId: cid, itemId: it.id }); }
  async checkWallet(cid, it) { const v = this.refang(it.value || ''); let r; try { if (/^0x/i.test(v)) { const j = await (await fetch('https://api.blockcypher.com/v1/eth/main/addrs/' + v + '/balance')).json(); r = { bal: (j.balance / 1e18).toFixed(4) + ' ETH', n: j.n_tx }; } else if (/^(bc1|[13])/.test(v)) { const j = await (await fetch('https://blockchain.info/rawaddr/' + v + '?cors=true&limit=1')).json(); r = { bal: (j.final_balance / 1e8).toFixed(4) + ' BTC', n: j.n_tx }; } else return; } catch (e) { return; } const prev = it.walletLast; this.upItemIn(cid, it.id, { walletLast: { ...r, at: new Date().toISOString() } }); if (prev && r.n > prev.n) this.pushEvent({ kind: 'wallet', text: (r.n - prev.n) + ' new transaction(s) on ' + v.slice(0, 12) + '… · now ' + r.bal, caseId: cid, itemId: it.id }); }
  refreshSel = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; if (it.type === 'feed') this.refreshFeed(this.cs().id, it); else if (it.type === 'monitor') this.checkMonitor(this.cs().id, it); };
  pollAll() { const now = Date.now(); this.state.cases.forEach(c => c.items.forEach(it => { if (it.type === 'feed' && (!it.feedAt || now - new Date(it.feedAt).getTime() > 15 * 60e3) && (it.feedUrl || !['rss', 'reddit', 'mastodon', 'bluesky', 'telegram'].includes(it.feedKind || 'rss'))) this.refreshFeed(c.id, it); else if (it.type === 'monitor' && it.url && (!it.monLast || now - new Date(it.monLast.at).getTime() > Math.max(1, +it.monEvery || 15) * 60e3)) this.checkMonitor(c.id, it); else if (it.type === 'indicator' && it.kind === 'wallet' && it.watch && (!it.walletLast || now - new Date(it.walletLast.at).getTime() > 10 * 60e3)) this.checkWallet(c.id, it); })); }
  toggleWatch = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; this.upItem(it.id, { watch: !it.watch }); if (!it.watch) setTimeout(() => this.checkWallet(this.cs().id, { ...it, watch: true }), 200); };
  // ---------- layouts + analysis
  arrange = e => { const kind = e.target.value; e.target.value = ''; if (!kind) return; const K = Component.K, cs = this.cs(), items = cs.items.filter(i => i.pinned); if (!items.length) return; this.snap();
    const W = i => K.TYPES[i.type].w, H = i => this.h(i.id), n = items.length, idx = Object.fromEntries(items.map((i, k) => [i.id, k])), adj = items.map(() => []); cs.threads.forEach(t => { if (idx[t.from] != null && idx[t.to] != null) { adj[idx[t.from]].push(idx[t.to]); adj[idx[t.to]].push(idx[t.from]); } });
    let pos;
    if (kind === 'force') { pos = items.map((i, k) => ({ x: Math.cos(k * 2.4) * (200 + k * 12) + 500, y: Math.sin(k * 2.4) * (200 + k * 12) + 400 })); for (let it = 0; it < 280; it++) { const f = pos.map(() => ({ x: 0, y: 0 })), damp = 1 - it / 280; for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { let dx = pos[c].x - pos[a].x, dy = pos[c].y - pos[a].y; const d2 = dx * dx + dy * dy + 1, d = Math.sqrt(d2), rep = 160000 / d2; dx /= d; dy /= d; f[a].x -= dx * rep; f[a].y -= dy * rep; f[c].x += dx * rep; f[c].y += dy * rep; } for (let a = 0; a < n; a++) adj[a].forEach(c => { const dx = pos[c].x - pos[a].x, dy = pos[c].y - pos[a].y, d = Math.hypot(dx, dy) || 1, k = (d - 360) * 0.03; f[a].x += dx / d * k; f[a].y += dy / d * k; }); for (let a = 0; a < n; a++) { f[a].x -= (pos[a].x - 500) * 0.003; f[a].y -= (pos[a].y - 400) * 0.003; pos[a].x += Math.max(-40, Math.min(40, f[a].x)) * damp; pos[a].y += Math.max(-40, Math.min(40, f[a].y)) * damp; } } }
    else if (kind === 'radial' || kind === 'tiers') { const root = idx[this.state.sel] != null ? idx[this.state.sel] : adj.reduce((m, a, k) => a.length > adj[m].length ? k : m, 0), lvl = new Array(n).fill(-1); lvl[root] = 0; const qd = [root]; while (qd.length) { const a = qd.shift(); adj[a].forEach(c => { if (lvl[c] < 0) { lvl[c] = lvl[a] + 1; qd.push(c); } }); } const maxL = Math.max(0, ...lvl); lvl.forEach((l, k) => { if (l < 0) lvl[k] = maxL + 1; }); const groups = {}; lvl.forEach((l, k) => { (groups[l] = groups[l] || []).push(k); }); pos = new Array(n); Object.keys(groups).forEach(l => { const g = groups[l], L = +l; let x = 600 - g.reduce((s, kk) => s + W(items[kk]) + 40, 0) / 2; g.forEach((k, j) => { if (kind === 'radial') { const r = L * 340, a = (j / g.length) * Math.PI * 2 - Math.PI / 2; pos[k] = { x: 700 + Math.cos(a) * r, y: 600 + Math.sin(a) * r }; } else { pos[k] = { x, y: 80 + L * 300 }; x += W(items[k]) + 40; } }); }); }
    else { const types = {}; items.forEach((i, k) => { (types[i.type] = types[i.type] || []).push(k); }); pos = new Array(n); let x = 80; Object.keys(types).forEach(t => { let y = 80, colw = 0; types[t].forEach(k => { pos[k] = { x, y }; y += H(items[k]) + 40; colw = Math.max(colw, W(items[k])); }); x += colw + 60; }); }
    const map = Object.fromEntries(items.map((i, k) => [i.id, pos[k]])); this.upCase(c => ({ ...c, items: c.items.map(i => map[i.id] ? { ...i, x: Math.round(map[i.id].x), y: Math.round(map[i.id].y) } : i) })); this.logEvt('Arranged: ' + kind); setTimeout(() => this.fit(), 120); };
  pol(it, cs) { if (!it || !['person', 'indicator', 'target', 'vehicle'].includes(it.type)) return null; const linked = new Set([it.id]); cs.threads.forEach(t => { if (t.from === it.id) linked.add(t.to); if (t.to === it.id) linked.add(t.from); }); const ev = cs.items.filter(i => linked.has(i.id) && i.date); if (ev.length < 2) return null; const days = new Array(7).fill(0), hours = new Array(24).fill(0); let hasH = false; ev.forEach(i => { const d = new Date(i.date + 'T' + (i.time || '12:00')); if (isNaN(d)) return; days[d.getDay()]++; if (i.time) { hasH = true; hours[d.getHours()]++; } }); const md = Math.max(1, ...days), mh = Math.max(1, ...hours), DL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; return { count: ev.length + ' dated items', days: days.map((n, k) => ({ h: Math.round(n / md * 100), l: DL[k], title: n + ' on ' + DN[k] })), hasHours: hasH, hours: hours.map((n, k) => ({ h: Math.round(n / mh * 100), title: n + ' at ' + k + ':00' })) }; }
  tickClock() { const d = new Date(); this.setState({ clock: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }); }

  // ---------- OSINT workbench
  openOsint = (q) => { this.sfx('drawer'); this.setState(s => ({ osintOpen: true, osint: { ...s.osint, q: typeof q === 'string' ? q : s.osint.q } })); setTimeout(() => { const el = document.querySelector('[data-osint]'); if (el) { el.focus(); if (typeof q === 'string') this.runOsint(); } }, 60); };
  closeOsint = () => this.setState({ osintOpen: false });
  osintDetect(raw) {
    const t = String(raw || '').trim(); if (!t) return ['', ''];
    const v = this.refang(t);
    if (/^https?:\/\//i.test(v)) return ['url', v];
    if (/^CVE-\d{4}-\d{4,7}$/i.test(v)) return ['cve', v.toUpperCase()];
    if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v)) return ['hash', v.toLowerCase()];
    if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(v)) return ['ip', v];
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return ['email', v.toLowerCase()];
    if (/^(0x[a-f0-9]{40}|bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|T[a-zA-Z0-9]{33}|r[a-zA-Z0-9]{24,34})$/i.test(v)) return ['wallet', v];
    if (/^\+?[\d\s().-]{7,20}$/.test(v) && /\d{6,}/.test(v.replace(/\D/g, ''))) return ['phone', v.replace(/[^\d+]/g, '')];
    if (/^@[a-z0-9_.]{2,40}$/i.test(v)) return ['handle', v.slice(1)];
    if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(v)) return ['domain', v.toLowerCase()];
    if (/^[a-z0-9_.-]{2,40}$/i.test(v)) return ['handle', v];
    if (/\b(inc|ltd|llc|gmbh|corp|co|plc|sa|ag|bv|limited|group|holdings|bank|exchange|labs|technologies)\b\.?$/i.test(v) || /^[A-Z][A-Za-z0-9&.'-]*(\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,5}\s+(Inc|Ltd|LLC|GmbH|Corp|Co|PLC|SA|AG|BV)\.?$/.test(v)) return ['org', t];
    return ['name', t];
  }
  async jget(url, opts) { const u = (window.CIBProxy && window.CIBProxy.needs(url)) ? this.proxy(url) : url; const r = await fetch(u, opts); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  dns(name, type) { return this.jget('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type).then(d => (d.Answer || []).map(a => a.data)); }
  osintLookups(type, v) {
    const enc = encodeURIComponent, L = (id, label, href, run) => ({ id, label, href, run }), host = type === 'url' ? (() => { try { return new URL(v).hostname; } catch (e) { return ''; } })() : v;
    const rdapDomain = d => this.jget('https://rdap.org/domain/' + enc(d)).then(r => { const out = []; const reg = (r.entities || []).find(e => (e.roles || []).includes('registrar')); const fn = reg && reg.vcardArray && reg.vcardArray[1] && reg.vcardArray[1].find(x => x[0] === 'fn'); if (fn) out.push('Registrar: ' + fn[3]); (r.events || []).forEach(e => out.push(e.eventAction + ': ' + String(e.eventDate).slice(0, 10))); if (r.nameservers) out.push('NS: ' + r.nameservers.map(n => n.ldhName).join(', ')); if (r.status) out.push('Status: ' + r.status.join(', ')); return out.length ? out : ['No RDAP record']; });
    const dnsAll = d => Promise.all(['A', 'AAAA', 'MX', 'NS', 'TXT'].map(t => this.dns(d, t).then(a => a.length ? t + ': ' + a.slice(0, 6).join(' · ') : null).catch(() => null))).then(x => { const o = x.filter(Boolean); return o.length ? o : ['No records — does not resolve']; });
    const wayback = u => this.jget('https://archive.org/wayback/available?url=' + enc(u)).then(r => { const c = r.archived_snapshots && r.archived_snapshots.closest; return c ? ['Archived ' + c.timestamp.slice(0, 4) + '-' + c.timestamp.slice(4, 6) + '-' + c.timestamp.slice(6, 8), c.url] : ['Not in the Wayback Machine']; });
    const urlscan = q => this.jget('https://urlscan.io/api/v1/search/?q=' + enc(q) + '&size=5').then(r => (r.results || []).length ? [r.total + ' scans'].concat(r.results.slice(0, 4).map(x => String(x.task.time).slice(0, 10) + ' ' + x.page.url)) : ['No public scans']);
    const threatfox = q => this.jget('https://threatfox-api.abuse.ch/api/v1/', { method: 'POST', body: JSON.stringify({ query: 'search_ioc', search_term: q }) }).then(r => r.query_status === 'ok' ? r.data.slice(0, 4).map(x => x.threat_type + ' · ' + (x.malware_printable || x.malware) + ' · ' + x.first_seen.slice(0, 10) + (x.tags ? ' · ' + x.tags.join(',') : '')) : ['Not in ThreatFox']);
    if (type === 'domain' || type === 'url') {
      const list = [L('dns', 'DNS (Google DoH)', 'https://dns.google/query?name=' + enc(host), () => dnsAll(host)), L('rdap', 'RDAP · registration', 'https://rdap.org/domain/' + enc(host), () => rdapDomain(host)), L('wb', 'Wayback Machine', 'https://web.archive.org/web/*/' + enc(host) + '*', () => wayback(type === 'url' ? v : host)), L('us', 'urlscan.io', 'https://urlscan.io/search/#' + enc((type === 'url' ? 'page.url:"' + v + '"' : 'domain:' + host)), () => urlscan(type === 'url' ? 'page.url:"' + v + '"' : 'domain:' + host)), L('tf', 'ThreatFox (abuse.ch)', 'https://threatfox.abuse.ch/browse.php?search=ioc%3A' + enc(host), () => threatfox(type === 'url' ? v : host)), L('crt', 'crt.sh · certificates', 'https://crt.sh/?q=' + enc(host), () => this.jget('https://crt.sh/?q=' + enc('%.' + host) + '&output=json').then(r => { const names = Array.from(new Set(r.flatMap(x => String(x.name_value).split('\n')))).slice(0, 8); return names.length ? [r.length + ' certificate rows'].concat(names) : ['No certificates']; }))];
      return list;
    }
    if (type === 'ip') return [L('geo', 'Geolocation · ASN (ipapi.co)', 'https://ipinfo.io/' + enc(v), () => this.jget('https://ipapi.co/' + enc(v) + '/json/').then(r => r.error ? [r.reason || 'Lookup refused'] : [[r.city, r.region, r.country_name].filter(Boolean).join(', '), (r.asn || '') + ' ' + (r.org || ''), r.timezone ? 'TZ ' + r.timezone : ''].filter(Boolean))), L('ptr', 'Reverse DNS', 'https://dns.google/query?name=' + enc(v.split('.').reverse().join('.') + '.in-addr.arpa') + '&rr_type=PTR', () => this.dns(v.split('.').reverse().join('.') + '.in-addr.arpa', 'PTR').then(a => a.length ? a : ['No PTR record'])), L('rdap', 'RDAP · netblock', 'https://rdap.org/ip/' + enc(v), () => this.jget('https://rdap.org/ip/' + enc(v)).then(r => [[r.name, r.handle].filter(Boolean).join(' · '), (r.startAddress || '') + ' – ' + (r.endAddress || ''), r.country ? 'Country ' + r.country : ''].filter(Boolean))), L('us', 'urlscan.io', 'https://urlscan.io/search/#ip%3A' + enc(v), () => urlscan('ip:' + v)), L('tf', 'ThreatFox (abuse.ch)', 'https://threatfox.abuse.ch/browse.php?search=ioc%3A' + enc(v), () => threatfox(v))];
    if (type === 'email') { const dom = v.split('@')[1]; return [L('mx', 'Mail domain · MX', 'https://dns.google/query?name=' + enc(dom) + '&rr_type=MX', () => this.dns(dom, 'MX').then(a => a.length ? ['Accepts mail via ' + a.slice(0, 4).join(' · ')] : ['No MX — address cannot receive mail'])), L('rdap', 'Mail domain · RDAP', 'https://rdap.org/domain/' + enc(dom), () => rdapDomain(dom)), L('grav', 'Gravatar', 'https://gravatar.com/', async () => { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v.trim().toLowerCase())); const hx = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); return new Promise(res => { const im = new Image(); im.onload = () => res(['Gravatar avatar exists — profile: https://gravatar.com/' + hx]); im.onerror = () => res(['No Gravatar for this address']); im.src = 'https://www.gravatar.com/avatar/' + hx + '?d=404'; }); }), L('gh', 'GitHub commits with this email', 'https://github.com/search?q=' + enc(v) + '&type=commits', () => this.jget('https://api.github.com/search/users?q=' + enc(v) + '+in:email').then(r => r.total_count ? r.items.slice(0, 5).map(u => u.login + ' · ' + u.html_url) : ['No public GitHub account lists this email']))]; }
    if (type === 'handle') return [L('gh', 'GitHub', 'https://github.com/' + enc(v), () => this.jget('https://api.github.com/users/' + enc(v)).then(r => [[r.name, r.login].filter(Boolean).join(' · '), r.bio || '', [r.location, r.blog].filter(Boolean).join(' · '), r.public_repos + ' repos · joined ' + String(r.created_at).slice(0, 10)].filter(Boolean)).catch(e => { throw new Error(/404/.test(e.message) ? 'No GitHub user' : e.message); })), L('kb', 'Keybase · proofs', 'https://keybase.io/' + enc(v), () => this.jget('https://keybase.io/_/api/1.0/user/lookup.json?usernames=' + enc(v) + '&fields=proofs_summary').then(r => { const u = r.them && r.them[0]; if (!u) return ['No Keybase user']; const p = (u.proofs_summary && u.proofs_summary.all) || []; return p.length ? p.map(x => x.proof_type + ': ' + x.nametag) : ['Keybase user, no proofs']; })), L('rd', 'Reddit', 'https://www.reddit.com/user/' + enc(v), () => this.jget('https://www.reddit.com/user/' + enc(v) + '/about.json').then(r => r.data ? ['Karma ' + (r.data.total_karma || 0) + ' · created ' + new Date(r.data.created_utc * 1000).toISOString().slice(0, 10)] : ['No Reddit user'])), L('hn', 'Hacker News', 'https://news.ycombinator.com/user?id=' + enc(v), () => this.jget('https://hacker-news.firebaseio.com/v0/user/' + enc(v) + '.json').then(r => r ? ['Karma ' + r.karma + ' · created ' + new Date(r.created * 1000).toISOString().slice(0, 10) + (r.about ? ' · ' + String(r.about).replace(/<[^>]+>/g, '').slice(0, 120) : '')] : ['No HN user']))];
    if (type === 'hash') return [L('mb', 'MalwareBazaar', 'https://bazaar.abuse.ch/browse.php?search=' + enc(v), () => this.jget('https://mb-api.abuse.ch/api/v1/', { method: 'POST', body: new URLSearchParams({ query: 'get_info', hash: v }) }).then(r => r.query_status === 'ok' ? r.data.slice(0, 1).flatMap(x => [x.file_name + ' · ' + x.file_type, (x.signature || 'unsigned') + ' · first seen ' + x.first_seen, 'tags: ' + (x.tags || []).join(', ')]) : ['Not in MalwareBazaar'])), L('tf', 'ThreatFox', 'https://threatfox.abuse.ch/browse.php?search=ioc%3A' + enc(v), () => threatfox(v))];
    if (type === 'wallet') { const eth = /^0x/i.test(v), btc = /^(bc1|[13])/.test(v); return [eth ? L('bc', 'Balance · activity (BlockCypher)', 'https://etherscan.io/address/' + enc(v), () => this.jget('https://api.blockcypher.com/v1/eth/main/addrs/' + enc(v) + '/balance').then(r => ['Balance ' + (r.balance / 1e18).toFixed(4) + ' ETH', r.n_tx + ' transactions', 'Received ' + (r.total_received / 1e18).toFixed(2) + ' ETH'])) : btc ? L('bc', 'Balance · activity (blockchain.com)', 'https://www.blockchain.com/explorer/addresses/btc/' + enc(v), () => this.jget('https://blockchain.info/rawaddr/' + enc(v) + '?cors=true&limit=3').then(r => ['Balance ' + (r.final_balance / 1e8).toFixed(4) + ' BTC', r.n_tx + ' transactions', 'Received ' + (r.total_received / 1e8).toFixed(2) + ' BTC'].concat((r.txs || []).slice(0, 3).map(t => new Date(t.time * 1000).toISOString().slice(0, 10) + ' tx ' + t.hash.slice(0, 16) + '…')))) : L('bc', 'Explorer', 'https://blockchair.com/search?q=' + enc(v), () => Promise.resolve(['Chain not auto-detected; use the launchers']))]; }
    if (type === 'cve') return [L('nvd', 'NVD', 'https://nvd.nist.gov/vuln/detail/' + enc(v), () => this.jget('https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=' + enc(v)).then(r => { const c = r.vulnerabilities && r.vulnerabilities[0] && r.vulnerabilities[0].cve; if (!c) return ['Not in NVD']; const m = c.metrics && (c.metrics.cvssMetricV31 || c.metrics.cvssMetricV30 || c.metrics.cvssMetricV2); const sc = m && m[0] && m[0].cvssData; return [(c.descriptions.find(d => d.lang === 'en') || c.descriptions[0]).value.slice(0, 240), sc ? 'CVSS ' + sc.baseScore + ' ' + (sc.baseSeverity || m[0].baseSeverity || '') : 'No CVSS yet', 'Published ' + String(c.published).slice(0, 10), c.cisaExploitAdd ? 'IN CISA KEV since ' + c.cisaExploitAdd + ' — actively exploited' : 'Not in CISA KEV'].filter(Boolean); }))];
    return [];
  }
  osintLaunchers(type, v) {
    const enc = encodeURIComponent, q = enc(v), G = (head, links) => ({ head, links: links.map(([label, href]) => ({ label, href })) });
    const host = type === 'url' ? (() => { try { return new URL(v).hostname; } catch (e) { return v; } })() : v;
    const search = [['Google', 'https://www.google.com/search?q=' + enc('"' + v + '"')], ['Bing', 'https://www.bing.com/search?q=' + enc('"' + v + '"')], ['DuckDuckGo', 'https://duckduckgo.com/?q=' + enc('"' + v + '"')], ['Yandex', 'https://yandex.com/search/?text=' + enc('"' + v + '"')]];
    const infra = h => [['VirusTotal', 'https://www.virustotal.com/gui/search/' + enc(h)], ['urlscan', 'https://urlscan.io/search/#' + enc(h)], ['Shodan', 'https://www.shodan.io/search?query=' + enc(h)], ['Censys', 'https://search.censys.io/search?resource=hosts&q=' + enc(h)], ['SecurityTrails', 'https://securitytrails.com/domain/' + enc(h) + '/dns'], ['crt.sh', 'https://crt.sh/?q=' + enc(h)], ['WHOIS', 'https://who.is/whois/' + enc(h)], ['ViewDNS', 'https://viewdns.info/reverseip/?host=' + enc(h) + '&t=1'], ['Wayback', 'https://web.archive.org/web/*/' + enc(h) + '*'], ['OTX', 'https://otx.alienvault.com/indicator/domain/' + enc(h)]];
    const rep = h => [['Talos', 'https://talosintelligence.com/reputation_center/lookup?search=' + enc(h)], ['URLhaus', 'https://urlhaus.abuse.ch/browse.php?search=' + enc(h)], ['ThreatFox', 'https://threatfox.abuse.ch/browse.php?search=ioc%3A' + enc(h)], ['Safe Browsing', 'https://transparencyreport.google.com/safe-browsing/search?url=' + enc(h)], ['PhishTank', 'https://phishtank.org/'], ['Pulsedive', 'https://pulsedive.com/indicator/?ioc=' + enc(btoa(h))]];
    if (type === 'domain') return [G('INFRASTRUCTURE', infra(v)), G('REPUTATION', rep(v)), G('SEARCH', search.concat([['Google site:', 'https://www.google.com/search?q=' + enc('site:' + v)], ['Hunter · emails', 'https://hunter.io/try/search/' + q], ['Hudson Rock · infostealer', 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain?domain=' + q]]))];
    if (type === 'url') return [G('URL ANALYSIS', [['VirusTotal', 'https://www.virustotal.com/gui/search/' + q], ['urlscan', 'https://urlscan.io/search/#' + enc('page.url:"' + v + '"')], ['Wayback', 'https://web.archive.org/web/*/' + q], ['URLhaus', 'https://urlhaus.abuse.ch/browse.php?search=' + q], ['Safe Browsing', 'https://transparencyreport.google.com/safe-browsing/search?url=' + q], ['CheckPhish', 'https://checkphish.bolster.ai/'], ['Hybrid Analysis', 'https://www.hybrid-analysis.com/search?query=' + q]]), G('HOST · ' + host.toUpperCase(), infra(host)), G('REPUTATION', rep(host))];
    if (type === 'ip') return [G('INFRASTRUCTURE', [['Shodan', 'https://www.shodan.io/host/' + q], ['Censys', 'https://search.censys.io/hosts/' + q], ['VirusTotal', 'https://www.virustotal.com/gui/ip-address/' + q], ['ipinfo', 'https://ipinfo.io/' + q], ['BGP.he.net', 'https://bgp.he.net/ip/' + q], ['ViewDNS reverse', 'https://viewdns.info/reverseip/?host=' + q + '&t=1'], ['SecurityTrails', 'https://securitytrails.com/list/ip/' + q]]), G('REPUTATION', [['AbuseIPDB', 'https://www.abuseipdb.com/check/' + q], ['GreyNoise', 'https://viz.greynoise.io/ip/' + q], ['Talos', 'https://talosintelligence.com/reputation_center/lookup?search=' + q], ['OTX', 'https://otx.alienvault.com/indicator/ip/' + q], ['ThreatFox', 'https://threatfox.abuse.ch/browse.php?search=ioc%3A' + q], ['Spamhaus', 'https://check.spamhaus.org/results/?query=' + q]]), G('SEARCH', search)];
    if (type === 'email') return [G('BREACHES · REPUTATION', [['Have I Been Pwned', 'https://haveibeenpwned.com/account/' + q], ['EmailRep', 'https://emailrep.io/' + q], ['Hunter verifier', 'https://hunter.io/email-verifier/' + q], ['Epieos', 'https://epieos.com/?q=' + q + '&t=email'], ['Hudson Rock', 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email=' + q], ['DeHashed', 'https://dehashed.com/search?query=' + q]]), G('PRESENCE', [['GitHub commits', 'https://github.com/search?q=' + q + '&type=commits'], ['Gravatar', 'https://gravatar.com/'], ['Skype / Teams', 'https://www.google.com/search?q=' + enc('"' + v + '" site:linkedin.com OR site:github.com OR site:x.com')], ['Pastebin search', 'https://www.google.com/search?q=' + enc('"' + v + '" site:pastebin.com OR site:ghostbin.com OR site:paste.ee')]]), G('SEARCH', search)];
    if (type === 'handle') return [G('ENUMERATION', [['WhatsMyName', 'https://whatsmyname.app/?q=' + q], ['Namechk', 'https://namechk.com/'], ['Instant Username', 'https://instantusername.com/?q=' + q], ['Keybase', 'https://keybase.io/' + q]]), G('PLATFORMS', [['GitHub', 'https://github.com/' + q], ['X', 'https://x.com/' + q], ['Instagram', 'https://www.instagram.com/' + q + '/'], ['TikTok', 'https://www.tiktok.com/@' + q], ['Reddit', 'https://www.reddit.com/user/' + q], ['Telegram', 'https://t.me/' + q], ['YouTube', 'https://www.youtube.com/@' + q], ['LinkedIn', 'https://www.linkedin.com/in/' + q], ['Mastodon search', 'https://mastodon.social/@' + q], ['Steam', 'https://steamcommunity.com/id/' + q], ['Pinterest', 'https://www.pinterest.com/' + q + '/'], ['Twitch', 'https://www.twitch.tv/' + q], ['Medium', 'https://medium.com/@' + q], ['Discord lookup', 'https://discord.id/'], ['Bitcointalk', 'https://bitcointalk.org/index.php?action=profile;u=' + q]]), G('SEARCH', search)];
    if (type === 'hash') return [G('MALWARE', [['VirusTotal', 'https://www.virustotal.com/gui/file/' + q], ['MalwareBazaar', 'https://bazaar.abuse.ch/browse.php?search=' + q], ['Hybrid Analysis', 'https://www.hybrid-analysis.com/search?query=' + q], ['ANY.RUN', 'https://app.any.run/submissions/#filehash:' + q], ['Intezer', 'https://analyze.intezer.com/files/' + q], ['Joe Sandbox', 'https://www.joesandbox.com/search?q=' + q], ['OTX', 'https://otx.alienvault.com/indicator/file/' + q], ['Triage', 'https://tria.ge/s?q=' + q]]), G('SEARCH', search)];
    if (type === 'wallet') return [G('EXPLORERS', [['Blockchair', 'https://blockchair.com/search?q=' + q], ['Etherscan', 'https://etherscan.io/address/' + q], ['Blockchain.com', 'https://www.blockchain.com/explorer/search?search=' + q], ['Tronscan', 'https://tronscan.org/#/address/' + q], ['Solscan', 'https://solscan.io/account/' + q], ['XRPScan', 'https://xrpscan.com/account/' + q], ['OXT', 'https://oxt.me/address/' + q]]), G('INTELLIGENCE', [['Arkham', 'https://intel.arkm.com/explorer/address/' + q], ['Chainabuse', 'https://www.chainabuse.com/address/' + q], ['Breadcrumbs', 'https://www.breadcrumbs.app/reports/search?q=' + q], ['MetaSleuth', 'https://metasleuth.io/result/eth/' + q], ['OFAC SDN', 'https://sanctionssearch.ofac.treas.gov/'], ['Bitcoin Who\'s Who', 'https://www.bitcoinwhoswho.com/address/' + q]]), G('SEARCH', search)];
    if (type === 'cve') return [G('VULNERABILITY', [['NVD', 'https://nvd.nist.gov/vuln/detail/' + q], ['CVE.org', 'https://www.cve.org/CVERecord?id=' + q], ['CISA KEV', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=' + q], ['Exploit-DB', 'https://www.exploit-db.com/search?cve=' + q.replace(/^CVE-/i, '')], ['GitHub PoCs', 'https://github.com/search?q=' + q + '&type=repositories'], ['Vulners', 'https://vulners.com/search?query=' + q], ['Rapid7', 'https://www.rapid7.com/db/?q=' + q], ['Shodan exploits', 'https://exploits.shodan.io/?q=' + q], ['EPSS', 'https://api.first.org/data/v1/epss?cve=' + q]]), G('SEARCH', search)];
    if (type === 'phone') return [G('NUMBER', [['Google', 'https://www.google.com/search?q=' + enc('"' + v + '"')], ['Yandex', 'https://yandex.com/search/?text=' + q], ['WhatsApp', 'https://wa.me/' + q.replace(/\+/g, '')], ['Telegram', 'https://t.me/' + q], ['Sync.me', 'https://sync.me/search/?number=' + q.replace(/\+/g, '')], ['Spokeo', 'https://www.spokeo.com/search?q=' + q], ['Truecaller', 'https://www.truecaller.com/search/us/' + q.replace(/\+/g, '')], ['Who called', 'https://who-called.co.uk/Number/' + q.replace(/\+/g, '')]])];
    if (type === 'org') return [G('COMPANY RECORDS', [['OpenCorporates', 'https://opencorporates.com/companies?q=' + q], ['Companies House', 'https://find-and-update.company-information.service.gov.uk/search?q=' + q], ['SEC EDGAR', 'https://www.sec.gov/cgi-bin/browse-edgar?company=' + q + '&action=getcompany'], ['Crunchbase', 'https://www.crunchbase.com/textsearch?q=' + q], ['LinkedIn', 'https://www.linkedin.com/search/results/companies/?keywords=' + q], ['GLEIF LEI', 'https://search.gleif.org/#/search/simpleSearch=' + q]]), G('RISK · SANCTIONS', [['OpenSanctions', 'https://www.opensanctions.org/search/?q=' + q], ['ICIJ Offshore Leaks', 'https://offshoreleaks.icij.org/search?q=' + q], ['OFAC', 'https://sanctionssearch.ofac.treas.gov/'], ['UK sanctions', 'https://search-uk-sanctions-list.service.gov.uk/?q=' + q]]), G('ATTACK SURFACE', [['Shodan org:', 'https://www.shodan.io/search?query=' + enc('org:"' + v + '"')], ['Censys', 'https://search.censys.io/search?resource=hosts&q=' + q], ['crt.sh', 'https://crt.sh/?O=' + q], ['Hunter', 'https://hunter.io/try/search/' + q], ['Ransomware.live', 'https://www.ransomware.live/#/search?q=' + q]]), G('SEARCH', search)];
    return [G('PEOPLE', [['LinkedIn', 'https://www.linkedin.com/search/results/people/?keywords=' + q], ['X', 'https://x.com/search?q=' + enc('"' + v + '"') + '&f=user'], ['Facebook', 'https://www.facebook.com/search/people/?q=' + q], ['Instagram', 'https://www.instagram.com/explore/search/keyword/?q=' + q], ['Wikidata', 'https://www.wikidata.org/w/index.php?search=' + q], ['Yandex images', 'https://yandex.com/images/search?text=' + q]]), G('RECORDS · RISK', [['OpenSanctions', 'https://www.opensanctions.org/search/?q=' + q], ['ICIJ Offshore Leaks', 'https://offshoreleaks.icij.org/search?q=' + q], ['OpenCorporates officers', 'https://opencorporates.com/officers?q=' + q], ['Companies House officers', 'https://find-and-update.company-information.service.gov.uk/search/officers?q=' + q], ['Interpol notices', 'https://www.interpol.int/How-we-work/Notices/Red-Notices/View-Red-Notices'], ['Court records', 'https://www.google.com/search?q=' + enc('"' + v + '" site:courtlistener.com OR site:pacer.gov OR site:judiciary.uk')]]), G('SEARCH', search.concat([['News', 'https://news.google.com/search?q=' + enc('"' + v + '"')], ['Pastes', 'https://www.google.com/search?q=' + enc('"' + v + '" site:pastebin.com')]]))];
  }
  runOsint = () => {
    const [type, value] = this.osintDetect(this.state.osint.q); if (!type) return;
    const looks = this.osintLookups(type, value);
    const live = looks.map(l => ({ id: l.id, label: l.label, href: l.href, status: 'busy', lines: [] }));
    this.setState(s => ({ osint: { ...s.osint, type, value, ran: true, live, pinnedId: null, forced: s.osint.forced } }));
    looks.forEach(l => { Promise.resolve().then(() => l.run()).then(lines => this.setOsintLine(l.id, 'ok', (lines || []).filter(Boolean).slice(0, 10))).catch(e => this.setOsintLine(l.id, 'blocked', [/Failed to fetch|NetworkError|Load failed/i.test(String(e && e.message)) ? 'Blocked by the browser — open it in a new tab' : String(e && e.message || e)])); });
  };
  setOsintLine(id, status, lines) { this.setState(s => ({ osint: { ...s.osint, live: s.osint.live.map(x => x.id === id ? { ...x, status, lines } : x) } })); }
  osintSummary() { const o = this.state.osint; return o.live.filter(l => l.status === 'ok' && l.lines.length).map(l => l.label + ': ' + l.lines.slice(0, 4).join(' | ')).join('\n'); }
  osintPin = () => {
    const o = this.state.osint; if (!o.ran) return;
    const K = Component.K, kindMap = { domain: 'domain', ip: 'ip', url: 'url', email: 'email', hash: 'hash', wallet: 'wallet', cve: 'cve', handle: 'handle', phone: 'phone' };
    const body = this.osintSummary(), common = { source: 'OSINT workbench · ' + this.today(), collected: this.today(), status: 'unverified', body: body ? body.slice(0, 900) : '' };
    let id;
    if (kindMap[o.type]) id = this.addItem('indicator', { kind: kindMap[o.type], value: o.type === 'handle' ? '@' + o.value : o.value, lastSeen: this.today(), ...common }, true);
    else if (o.type === 'org') id = this.addItem('target', { title: o.value, ...common }, true);
    else id = this.addItem('person', { title: o.value, ...common }, true);
    this.setState(s => ({ osint: { ...s.osint, pinnedId: id }, osintOpen: false })); this.toast('Pinned with the findings as context');
  };
  osintCopy = () => { const o = this.state.osint, txt = String(o.type || '').toUpperCase() + ' ' + o.value + '\n' + this.osintSummary(); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => this.toast('Findings copied')); };

  // ---------- actor library, Claude analysis, STIX
  openActors = () => this.setState({ actorsOpen: true });
  closeActors = () => this.setState({ actorsOpen: false });
  freeSpot(w, h) {
    const K = Component.K, cs = this.cs(), items = cs.items.filter(i => i.pinned), groups = cs.groups || [];
    if (!items.length && !groups.length) { const c = this.center(); return { x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2) }; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    items.forEach(i => { x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); x1 = Math.max(x1, i.x + K.TYPES[i.type].w); y1 = Math.max(y1, i.y + this.h(i.id)); });
    groups.forEach(g => { x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y - 34); x1 = Math.max(x1, g.x + g.w); y1 = Math.max(y1, g.y + g.h); });
    return (x1 - x0) >= (y1 - y0) ? { x: Math.round(x0), y: Math.round(y1 + 90) } : { x: Math.round(x1 + 90), y: Math.round(y0) };
  }
  dropActor(a) {
    const K = Component.K, gh = Math.max(300, Math.ceil(a.techniques.length / 2) * 150 + 90), spot = this.freeSpot(760, gh), gx = spot.x, gy = spot.y, base = { title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', chain: '', amount: '', txFrom: '', txTo: '', image: null, pinned: true };
    const pid = Component.uid(), items = [{ ...base, id: pid, type: 'person', title: a.name, body: 'aka ' + a.aliases.join(', ') + '\n' + a.origin + ' · ' + a.motive + '\n\n' + a.summary, tags: 'actor', status: 'unverified', x: gx + 20, y: gy + 44 }];
    const ids = a.techniques.map((tid, i) => { const t = K.ATTACK.find(x => x[0] === tid), id = Component.uid(); items.push({ ...base, id, type: 'ttp', value: tid, title: t ? t[1] : '', kind: t ? t[2] : '', tags: 'actor', status: 'unverified', x: gx + 270 + (i % 2) * 235, y: gy + 44 + Math.floor(i / 2) * 150 }); return id; });
    const threads = ids.map(id => ({ id: Component.uid(), from: pid, to: id, rel: 'linked', conf: 'medium', why: 'Typical of ' + a.name + ' in public reporting; confirm against this case.' }));
    const g = { id: Component.uid(), title: a.name, x: gx, y: gy, w: 760, h: gh };
    this.snap();
    this.upCase(cs => ({ ...cs, items: [...cs.items, ...items], threads: [...cs.threads, ...threads], groups: [...(cs.groups || []), g] }));
    this.setState({ actorsOpen: false, sel: pid, selThread: null, selGroup: null, mode: 'board', tab: 'inspector', showRight: true });
    this.logEvt('Actor profile dropped in: ' + a.name + ' (' + ids.length + ' techniques)');
    this.toast(a.name + ' pinned with ' + ids.length + ' techniques'); setTimeout(() => this.fit(), 80);
  }
  analyse = async () => {
    const sel = this.cs().items.find(i => i.id === this.state.sel); if (!sel) return;
    if (!window.claude || !window.claude.complete) return this.toast('Claude analysis runs inside the Claude app preview');
    const cs = this.cs(), K = Component.K, L = i => this.itemLabel(i);
    this.setState({ ai: { busy: true, forId: sel.id, res: null, err: '' } });
    const others = cs.items.filter(i => i.pinned && i.id !== sel.id && i.num).map(i => 'E' + i.num + ' [' + K.TYPES[i.type].label + '] ' + L(i) + (i.body ? ' — ' + String(i.body).replace(/\s+/g, ' ').slice(0, 140) : '')).join('\n');
    const byId = Object.fromEntries(cs.items.map(i => [i.id, i]));
    const links = cs.threads.map(t => { const A = byId[t.from], B = byId[t.to]; return A && B ? 'E' + (A.num || '?') + ' ' + (K.REL[t.rel] || K.REL.linked).label + ' E' + (B.num || '?') : null; }).filter(Boolean).join('\n');
    const card = { type: K.TYPES[sel.type].label, number: sel.num ? 'E' + sel.num : null, title: sel.title, value: sel.value, kind: sel.type === 'indicator' ? sel.kind : undefined, body: sel.body, url: sel.url, date: sel.date, tags: sel.tags, status: sel.status, chain: sel.chain, amount: sel.amount, from: sel.txFrom, to: sel.txTo };
    Object.keys(card).forEach(k => { if (card[k] === undefined || card[k] === '' || card[k] === null) delete card[k]; });
    const system = 'You are a senior threat-intelligence analyst helping with an investigation board. Be concrete, sceptical and brief. Never invent facts: when something is unknown, say what would establish it. Answer with a single JSON object and nothing else.';
    const prompt = 'CASE: ' + cs.number + ' — ' + cs.title + '\nCASE NOTES:\n' + String(cs.notes || '').slice(0, 1500) + '\n\nCARD UNDER REVIEW:\n' + JSON.stringify(card) + '\n\nOTHER CARDS ON THE BOARD:\n' + (others || '(none)') + '\n\nEXISTING THREADS:\n' + (links || '(none)')
      + '\n\nReturn JSON with exactly these keys:\n{"summary": "<=80 words: what this card most likely is and how it fits the case", "assessment": one of "confirmed" | "unverified" | "false" | null, "threads": [{"to": "E<number of another card>", "rel": one of "linked" | "suspected" | "alias" | "controls" | "resolves" | "located", "why": "<=20 words"}], "next_steps": ["<=12 words each, max 4"]}\nOnly suggest threads that are not already on the board and that the evidence actually supports; an empty list is fine.';
    try {
      const text = await window.claude.complete({ system, messages: [{ role: 'user', content: prompt }], max_tokens: 1200 });
      const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b < 0) throw new Error('No JSON in the reply');
      const res = JSON.parse(text.slice(a, b + 1));
      this.setState({ ai: { busy: false, forId: sel.id, res, err: '' } }); this.logEvt('Claude assessment requested — ' + L(sel));
    } catch (e) { this.setState({ ai: { busy: false, forId: sel.id, res: null, err: String(e && e.message || e) } }); }
  };
  stixId(type) { const u = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); return type + '--' + u; }
  exportStix = () => {
    const K = Component.K, cs = this.cs(), now = new Date().toISOString(), ids = {}, objs = [], conf = i => i.status === 'confirmed' ? 85 : i.status === 'false' ? 10 : 40;
    const reportId = this.stixId('report');
    const desc = i => [i.body, i.tags ? 'tags: ' + i.tags : '', i.num ? 'exhibit E' + i.num : ''].filter(Boolean).join('\n');
    const base = (type, i) => ({ type, spec_version: '2.1', id: ids[i.id] = this.stixId(type), created: now, modified: now });
    cs.items.forEach(i => {
      const v = this.refang(i.value || '').trim(), d = desc(i);
      if (i.type === 'indicator') {
        if (i.kind === 'cve') { objs.push({ ...base('vulnerability', i), name: v.toUpperCase(), description: d, external_references: [{ source_name: 'cve', external_id: v.toUpperCase() }] }); return; }
        const pat = i.kind === 'domain' ? "[domain-name:value = '" + v + "']" : i.kind === 'ip' ? "[ipv4-addr:value = '" + v + "']" : i.kind === 'url' ? "[url:value = '" + v + "']" : i.kind === 'email' ? "[email-addr:value = '" + v + "']" : i.kind === 'handle' ? "[user-account:account_login = '" + v.replace(/^@/, '') + "']" : i.kind === 'hash' ? "[file:hashes.'" + (v.length === 64 ? 'SHA-256' : v.length === 40 ? 'SHA-1' : 'MD5') + "' = '" + v + "']" : "[x-cryptocurrency-wallet:address = '" + v + "']";
        if (!v) return;
        objs.push({ ...base('indicator', i), name: i.title || v, description: d, pattern: pat, pattern_type: 'stix', valid_from: now, confidence: conf(i), labels: [i.kind, 'malicious-activity'] });
      } else if (i.type === 'ttp') { const id = String(i.value || '').toUpperCase(); objs.push({ ...base('attack-pattern', i), name: i.title || id, description: d, external_references: id ? [{ source_name: 'mitre-attack', external_id: id, url: 'https://attack.mitre.org/techniques/' + id.replace('.', '/') + '/' }] : [] }); }
      else if (i.type === 'person') { const actor = /\bactor\b/i.test(i.tags || ''); objs.push(actor ? { ...base('threat-actor', i), name: i.title || 'Unknown actor', description: d, confidence: conf(i) } : { ...base('identity', i), name: i.title || 'Unknown subject', identity_class: 'individual', description: d }); }
      else if (i.type === 'location') objs.push({ ...base('location', i), name: i.title || 'Unknown location', description: d });
      else if (i.type === 'tx') objs.push({ ...base('x-cryptocurrency-transaction', i), name: this.itemLabel(i), chain: i.chain || '', amount: i.amount || '', from_address: i.txFrom || '', to_address: i.txTo || '', tx_hash: v, description: d, confidence: conf(i) });
      else objs.push({ ...base('note', i), abstract: this.itemLabel(i), content: [i.url, i.body, i.date ? 'date: ' + i.date : ''].filter(Boolean).join('\n') || this.itemLabel(i), object_refs: [reportId] });
    });
    const RT = { resolves: 'resolves-to', located: 'located-at', controls: 'controls', alias: 'related-to', suspected: 'related-to', linked: 'related-to' };
    cs.threads.forEach(t => {
      const A = cs.items.find(i => i.id === t.from), B = cs.items.find(i => i.id === t.to); if (!A || !B || !ids[t.from] || !ids[t.to]) return;
      let rt = RT[t.rel] || 'related-to'; if (A.type === 'person' && /actor/i.test(A.tags || '') && B.type === 'ttp') rt = 'uses'; if (A.type === 'indicator' && rt === 'related-to') rt = 'indicates';
      objs.push({ type: 'relationship', spec_version: '2.1', id: this.stixId('relationship'), created: now, modified: now, relationship_type: rt, source_ref: ids[t.from], target_ref: ids[t.to], description: t.why || '', confidence: t.conf === 'high' ? 85 : t.conf === 'low' ? 25 : 55 });
    });
    (cs.groups || []).forEach(g => { const refs = this.groupMembers(g, cs.items).map(i => ids[i.id]).filter(Boolean); if (refs.length) objs.push({ type: 'grouping', spec_version: '2.1', id: this.stixId('grouping'), created: now, modified: now, name: g.title, context: 'suspicious-activity', object_refs: refs }); });
    objs.unshift({ type: 'report', spec_version: '2.1', id: reportId, created: now, modified: now, name: cs.number + ' — ' + cs.title, description: cs.notes || '', published: now, report_types: ['threat-report'], object_refs: objs.map(o => o.id) });
    this.dl(new Blob([JSON.stringify({ type: 'bundle', id: this.stixId('bundle'), objects: objs }, null, 2)], { type: 'application/json' }), this.slug(cs) + '.stix.json');
    this.logEvt('STIX bundle exported (' + objs.length + ' objects)'); this.toast('STIX 2.1 bundle downloaded — ' + objs.length + ' objects');
  };

  // ---------- timeline + presentation + quick add
  timelineLayout(pinned) {
    const K = Component.K, COLW = 290, X0 = 80, pos = {}, axis = [];
    const dated = pinned.filter(i => i.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.num || 0) - (b.num || 0)), undated = pinned.filter(i => !i.date).sort((a, b) => (a.num || 0) - (b.num || 0));
    const cols = []; dated.forEach(i => { let c = cols[cols.length - 1]; if (!c || c.date !== i.date) { c = { date: i.date, items: [] }; cols.push(c); } c.items.push(i); });
    let x = X0, bottom = 80;
    cols.forEach(c => { let y = 80; c.items.forEach(i => { pos[i.id] = { x: x + (COLW - 50 - K.TYPES[i.type].w) / 2 + 25, y }; y += this.h(i.id) + 44; }); axis.push({ x, label: this.fmtDate(c.date), items: c.items.length }); bottom = Math.max(bottom, y); x += COLW; });
    const width = Math.max(x - X0, 4 * COLW), shelfY = bottom + 50; let sx = X0, sy = shelfY, rowH = 0;
    undated.forEach(i => { const w = K.TYPES[i.type].w; if (sx + w > X0 + width) { sx = X0; sy += rowH + 40; rowH = 0; } pos[i.id] = { x: sx, y: sy }; sx += w + 30; rowH = Math.max(rowH, this.h(i.id)); });
    axis.forEach(a => { a.h = bottom - 40; a.w = COLW; });
    return { pos, axis, shelfY: undated.length ? shelfY : null, width, bottom: undated.length ? sy + rowH : bottom };
  }
  laneLayout(pinned, threads) {
    const K = Component.K, COLW = 290, X0 = 80, pos = {}, axis = [], byId = Object.fromEntries(pinned.map(i => [i.id, i]));
    const ttps = pinned.filter(i => i.type === 'ttp'), tactics = K.TACTICS.filter(t => ttps.some(i => i.kind === t)); if (ttps.some(i => !K.TACTICS.includes(i.kind))) tactics.push('Unassigned');
    const col = {}; tactics.forEach(t => { col[t] = []; });
    ttps.forEach(i => { col[K.TACTICS.includes(i.kind) ? i.kind : 'Unassigned'].push(i); });
    const under = {}, placed = new Set(ttps.map(i => i.id));
    threads.forEach(t => { const A = byId[t.from], B = byId[t.to]; if (!A || !B) return; const [tt, ev] = A.type === 'ttp' && B.type !== 'ttp' ? [A, B] : B.type === 'ttp' && A.type !== 'ttp' ? [B, A] : [null, null]; if (tt && !placed.has(ev.id)) { (under[tt.id] = under[tt.id] || []).push(ev); placed.add(ev.id); } });
    let x = X0, bottom = 80;
    tactics.forEach(t => { let y = 80; col[t].sort((a, b) => (a.num || 0) - (b.num || 0)).forEach(i => { pos[i.id] = { x: x + 25 + (COLW - 50 - K.TYPES[i.type].w) / 2, y }; y += this.h(i.id) + 30; (under[i.id] || []).forEach(ev => { pos[ev.id] = { x: x + 25 + (COLW - 50 - K.TYPES[ev.type].w) / 2, y }; y += this.h(ev.id) + 30; }); y += 20; }); axis.push({ x, label: t.toUpperCase(), h: 0, w: COLW }); bottom = Math.max(bottom, y); x += COLW; });
    const rest = pinned.filter(i => !placed.has(i.id)).sort((a, b) => (a.num || 0) - (b.num || 0)), width = Math.max(x - X0, 4 * COLW), shelfY = bottom + 50; let sx = X0, sy = shelfY, rowH = 0;
    rest.forEach(i => { const w = K.TYPES[i.type].w; if (sx + w > X0 + width) { sx = X0; sy += rowH + 40; rowH = 0; } pos[i.id] = { x: sx, y: sy }; sx += w + 30; rowH = Math.max(rowH, this.h(i.id)); });
    axis.forEach(a => { a.h = bottom - 40; });
    return { pos, axis, shelfY: rest.length ? shelfY : null, width, bottom: rest.length ? sy + rowH : bottom, shelfLabel: 'NOT TIED TO A TECHNIQUE', empty: !tactics.length };
  }
  listLayout(pinned) {
    const K = Component.K, pos = {}, X0 = 30; let y = 40; const W = Math.max(...pinned.map(i => K.TYPES[i.type].w), 200);
    pinned.slice().sort((a, b) => (a.num || 0) - (b.num || 0)).forEach(i => { pos[i.id] = { x: X0 + (W - K.TYPES[i.type].w) / 2, y }; y += this.h(i.id) + 36; });
    return { pos, axis: [], shelfY: null, width: W, bottom: y, empty: false };
  }
  toggleList = () => { this.drag = null; this.setState(s => ({ mode: s.mode === 'list' ? 'board' : 'list', linking: null, pending: null })); setTimeout(() => this.fit(), 80); };
  playSeq(cs) {
    const byId = Object.fromEntries(cs.items.map(i => [i.id, i])), seen = new Set(), seq = [];
    const pushItem = i => { if (i && i.pinned && !seen.has(i.id)) { seen.add(i.id); seq.push({ k: 'i', id: i.id }); } };
    cs.threads.slice().sort((a, b) => (a.num || 0) - (b.num || 0)).forEach(t => { pushItem(byId[t.from]); pushItem(byId[t.to]); seq.push({ k: 't', id: t.id }); });
    cs.items.filter(i => i.pinned).sort((a, b) => (a.num || 0) - (b.num || 0)).forEach(pushItem);
    return seq;
  }
  playToggle = () => { const on = this.state.play.on; if (on && this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; this.setState(s => ({ play: { ...s.play, paused: true } })); return; } const seq = this.playSeq(this.cs()); this.setState(s => ({ play: { on: true, idx: s.play.on && s.play.idx < seq.length ? s.play.idx : 0, prog: 0, paused: false }, reveal: false })); this.playTimer = setInterval(() => { this.setState(s => { const cs = this.cs(), sq = this.playSeq(cs), n = sq.length; if (s.play.idx >= n) { clearInterval(this.playTimer); this.playTimer = null; return { play: { ...s.play, paused: true } }; } const cur = sq[s.play.idx], it = cur.k === 'i' ? cs.items.find(i => i.id === cur.id) : null, words = it ? ((it.title || '') + ' ' + (it.body || '') + ' ' + (it.value || '')).trim().split(/\s+/).length : 0, ticks = cur.k === 't' ? 12 : Math.max(10, Math.min(45, words + (it && it.image ? 12 : 4))), prog = (s.play.prog || 0) + 1 / ticks; if (prog >= 1.15) return { play: { ...s.play, idx: s.play.idx + 1, prog: 0 } }; return { play: { ...s.play, prog } }; }); }, 70); };
  typeWords(text, prog) { const w = String(text || '').split(/(\s+)/); const n = Math.ceil(Math.min(1, prog) * w.filter(x => x.trim()).length); let k = 0; return w.filter(x => { if (!x.trim()) return true; k++; return k <= n; }).join('').replace(/\s+$/, ''); }
  playStop = () => { if (this.playTimer) clearInterval(this.playTimer); this.playTimer = null; this.setState({ play: { on: false, idx: 0 } }); };
  mergeInto(srcId, dstId) {
    const cs = this.cs(), A = cs.items.find(i => i.id === srcId), B = cs.items.find(i => i.id === dstId); if (!A || !B || A.id === B.id) return;
    this.snap();
    const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
    const merged = { ...B, body: [B.body, A.title && A.title !== B.title ? 'aka ' + A.title : '', A.value && A.value !== B.value ? A.value : '', A.body].filter(Boolean).join('\n'), tags: uniq([...this.tagList(B.tags), ...this.tagList(A.tags)]).join(', '), todo: [...(B.todo || []), ...(A.todo || [])], comments: [...(B.comments || []), ...(A.comments || [])], source: B.source || A.source, image: B.image || A.image, status: B.status || A.status };
    this.upCase(c => { const seenPair = new Set(); const threads = c.threads.map(t => ({ ...t, from: t.from === srcId ? dstId : t.from, to: t.to === srcId ? dstId : t.to })).filter(t => { if (t.from === t.to) return false; const k = [t.from, t.to].sort().join('|'); if (seenPair.has(k)) return false; seenPair.add(k); return true; }); return { ...c, items: c.items.filter(i => i.id !== srcId).map(i => i.id === dstId ? merged : i), threads }; });
    this.setState({ sel: dstId, mergeTo: '' }); this.logEvt('Merged "' + this.itemLabel(A) + '" into "' + this.itemLabel(B) + '"'); this.toast('Merged — threads re-pointed');
  }
  parseStixPattern(p) { const m = String(p || '').match(/\[(domain-name|ipv4-addr|ipv6-addr|url|email-addr|file:hashes[^=]*|user-account:account_login|x-cryptocurrency-wallet:address)(?::value)?\s*=\s*'([^']+)'/i); if (!m) return null; const t = m[1].toLowerCase(); const kind = t.startsWith('domain') ? 'domain' : t.startsWith('ipv') ? 'ip' : t === 'url' ? 'url' : t.startsWith('email') ? 'email' : t.startsWith('file') ? 'hash' : t.startsWith('user') ? 'handle' : 'wallet'; return { kind, value: m[2] }; }
  importStix(b, name) {
    const K = Component.K, objs = b.objects || [], ids = {}, items = [], threads = [];
    const base = (o, type, f) => { const it = { id: Component.uid(), type, title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', chain: '', amount: '', txFrom: '', txTo: '', source: 'STIX import · ' + (name || 'bundle'), collected: this.today(), srcGrade: '', infoGrade: '', tlp: '', firstSeen: '', lastSeen: '', sector: '', region: '', impact: '', image: null, pinned: true, x: 0, y: 0, ...f }; ids[o.id] = it.id; items.push(it); };
    const rep = objs.find(o => o.type === 'report');
    objs.forEach(o => {
      const d = o.description || '';
      if (o.type === 'indicator') { const p = this.parseStixPattern(o.pattern); if (p) base(o, 'indicator', { kind: p.kind, value: p.value, title: o.name && o.name !== p.value ? o.name : '', body: d, status: (o.confidence || 0) >= 70 ? 'confirmed' : 'unverified', firstSeen: String(o.valid_from || '').slice(0, 10), tags: (o.labels || []).filter(l => l !== 'malicious-activity').join(', ') }); }
      else if (o.type === 'vulnerability') base(o, 'indicator', { kind: 'cve', value: o.name, body: d });
      else if (o.type === 'attack-pattern') { const ref = (o.external_references || []).find(r => r.source_name === 'mitre-attack'); const a = ref && K.ATTACK.find(x => x[0] === ref.external_id); base(o, 'ttp', { value: ref ? ref.external_id : '', title: o.name, kind: a ? a[2] : '', body: d }); }
      else if (o.type === 'threat-actor') base(o, 'person', { title: o.name, body: [d, (o.aliases || []).length ? 'aka ' + o.aliases.join(', ') : ''].filter(Boolean).join('\n'), tags: 'actor' });
      else if (o.type === 'intrusion-set' || o.type === 'campaign') base(o, 'person', { title: o.name, body: d, tags: 'actor' });
      else if (o.type === 'identity') base(o, o.identity_class === 'organization' ? 'target' : 'person', { title: o.name, body: d });
      else if (o.type === 'malware' || o.type === 'tool') base(o, 'doc', { title: o.name, body: [o.type, d].filter(Boolean).join(' · ') });
      else if (o.type === 'location') base(o, 'location', { title: o.name || [o.city, o.country].filter(Boolean).join(', '), body: d });
      else if (o.type === 'x-cryptocurrency-transaction') base(o, 'tx', { title: o.name, chain: o.chain || '', amount: o.amount || '', txFrom: o.from_address || '', txTo: o.to_address || '', value: o.tx_hash || '', body: d });
      else if (o.type === 'note') base(o, 'note', { body: [o.abstract, o.content].filter(Boolean).join('\n') });
      else if (o.type === 'observed-data' || o.type === 'infrastructure') base(o, 'doc', { title: o.name || o.type, body: d });
    });
    const RT = { 'resolves-to': 'resolves', 'located-at': 'located', uses: 'linked', indicates: 'linked', 'attributed-to': 'suspected', controls: 'controls', 'communicates-with': 'linked' };
    objs.filter(o => o.type === 'relationship' && ids[o.source_ref] && ids[o.target_ref]).forEach(o => threads.push({ id: Component.uid(), from: ids[o.source_ref], to: ids[o.target_ref], rel: RT[o.relationship_type] || 'linked', conf: (o.confidence || 50) >= 70 ? 'high' : (o.confidence || 50) >= 40 ? 'medium' : 'low', why: o.description || '' }));
    const groups = objs.filter(o => o.type === 'grouping').map(o => ({ id: Component.uid(), title: o.name || 'Group', x: 0, y: 0, w: 520, h: 340, members: (o.object_refs || []).map(r => ids[r]).filter(Boolean) }));
    const cols = Math.max(3, Math.ceil(Math.sqrt(items.length))); items.forEach((it, i) => { it.x = 60 + (i % cols) * 270; it.y = 60 + Math.floor(i / cols) * 190; });
    const gs = groups.map(g => { const mem = items.filter(i => g.members.includes(i.id)); if (!mem.length) return null; const x0 = Math.min(...mem.map(i => i.x)) - 20, y0 = Math.min(...mem.map(i => i.y)) - 40, x1 = Math.max(...mem.map(i => i.x + K.TYPES[i.type].w)) + 20, y1 = Math.max(...mem.map(i => i.y)) + 200; return { id: g.id, title: g.title, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }).filter(Boolean);
    const n = Math.max(416, ...this.state.cases.map(c => parseInt(String(c.number || '').replace(/\D/g, ''), 10) || 0)) + 1;
    return { id: Component.uid(), v: 3, number: 'CASE ' + String(n).padStart(4, '0'), title: rep ? String(rep.name).replace(/^CASE \d+ — /, '') : (name || 'Imported STIX bundle'), notes: rep ? rep.description || '' : '', items, threads, groups: gs, dismissed: [], log: [{ t: new Date().toISOString(), m: 'Imported STIX bundle: ' + items.length + ' objects, ' + threads.length + ' relationships' }] };
  }
  importCsv(text, name) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean); if (!lines.length) return 0;
    const delim = (lines[0].match(/\t/g) || []).length ? '\t' : (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === delim && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
    const first = split(lines[0]).map(x => x.toLowerCase()), hasHead = first.some(x => /^(type|kind|value|indicator|ioc|title|name|description|notes|date|tags|source)$/.test(x));
    const col = names => { const i = first.findIndex(x => names.includes(x)); return i; };
    const cV = hasHead ? col(['value', 'indicator', 'ioc']) : 0, cT = hasHead ? col(['type', 'kind']) : -1, cTi = hasHead ? col(['title', 'name']) : -1, cB = hasHead ? col(['description', 'notes', 'body', 'context']) : -1, cD = hasHead ? col(['date', 'first_seen', 'firstseen', 'seen']) : -1, cTg = hasHead ? col(['tags', 'tag']) : -1, cS = hasHead ? col(['source']) : -1;
    const known = new Set(this.cs().items.filter(i => i.type === 'indicator').map(i => this.refang(i.value || '').toLowerCase()));
    let n = 0; const KM = { domain: 'domain', 'domain-name': 'domain', fqdn: 'domain', hostname: 'domain', ip: 'ip', ipv4: 'ip', 'ip-dst': 'ip', 'ip-src': 'ip', url: 'url', email: 'email', 'email-src': 'email', md5: 'hash', sha1: 'hash', sha256: 'hash', hash: 'hash', wallet: 'wallet', btc: 'wallet', cve: 'cve', handle: 'handle', username: 'handle', phone: 'phone' };
    const batch = [];
    lines.slice(hasHead ? 1 : 0).forEach(l => {
      const c = split(l), raw = c[cV >= 0 ? cV : 0]; if (!raw) return;
      let kind = cT >= 0 ? KM[String(c[cT]).toLowerCase()] : null; const det = this.osintDetect(raw);
      if (!kind) kind = ['domain', 'ip', 'url', 'email', 'hash', 'wallet', 'cve', 'handle', 'phone'].includes(det[0]) ? det[0] : null;
      if (!kind) { batch.push(['note', { body: raw }]); return; }
      const v = kind === 'handle' ? det[1] : this.refang(raw); if (known.has(v.toLowerCase())) return; known.add(v.toLowerCase());
      batch.push(['indicator', { kind, value: kind === 'handle' ? '@' + v : v, title: cTi >= 0 ? c[cTi] || '' : '', body: cB >= 0 ? c[cB] || '' : '', date: cD >= 0 ? c[cD] || '' : '', firstSeen: cD >= 0 ? c[cD] || '' : '', tags: cTg >= 0 ? c[cTg] || '' : '', source: cS >= 0 && c[cS] ? c[cS] : 'CSV import · ' + (name || 'file'), collected: this.today(), status: 'unverified' }]);
    });
    this.snap();
    const K = Component.K, items = batch.map(([type, f]) => ({ id: Component.uid(), type, title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', chain: '', amount: '', txFrom: '', txTo: '', source: '', collected: '', srcGrade: '', infoGrade: '', tlp: '', firstSeen: '', lastSeen: '', sector: '', region: '', impact: '', image: null, pinned: false, x: 0, y: 0, ...f }));
    this.upCase(c => ({ ...c, items: [...c.items, ...items] })); n = items.length;
    this.logEvt('Imported ' + n + ' rows from ' + (name || 'CSV') + ' into the inbox'); return n;
  }
  createCase(tpl) {
    const K = Component.K, s = this.state, n = Math.max(416, ...s.cases.map(c => parseInt(String(c.number || '').replace(/\D/g, ''), 10) || 0)) + 1;
    const base = f => ({ id: Component.uid(), title: '', body: '', url: '', value: '', kind: 'domain', date: '', tags: '', status: '', chain: '', amount: '', txFrom: '', txTo: '', source: '', collected: '', srcGrade: '', infoGrade: '', tlp: '', firstSeen: '', lastSeen: '', sector: '', region: '', impact: '', image: null, pinned: true, x: 0, y: 0, ...f });
    const items = tpl.items.map(([type, f], i) => base({ type, title: K.TYPES[type].title, ...f, x: 60 + (i % 4) * 270, y: 60 + Math.floor(i / 4) * 210 }));
    if (tpl.tasks.length) items.push(base({ type: 'doc', title: 'Case plan', body: 'Opening tasks for this playbook. Tick them off in the inspector.', tags: 'plan', x: 60 + (items.length % 4) * 270, y: 60 + Math.floor(items.length / 4) * 210, todo: tpl.tasks.map(t => ({ id: Component.uid(), text: t, owner: (s.analyst || '').trim(), due: '', done: false, at: new Date().toISOString() })) }));
    const c = { id: Component.uid(), v: 3, number: 'CASE ' + String(n).padStart(4, '0'), title: tpl.id === 'blank' ? 'Untitled case' : tpl.name, notes: '', items, threads: [], groups: [], dismissed: [], tlp: tpl.tlp || '', hypotheses: tpl.hyps.map(t => ({ id: Component.uid(), text: t })), log: [{ t: new Date().toISOString(), m: 'Case opened from template: ' + tpl.name }] };
    this.setState({ cases: [...s.cases, c], activeId: c.id, sel: null, selThread: null, selGroup: null, pending: null, tplOpen: false, mode: s.mobile ? 'list' : 'board', screen: 'board' });
    setTimeout(() => this.fit(), 80);
  };
  fingerprint(cs, mode) { const J = cs.judgement || {}; return { id: Component.uid(), t: new Date().toISOString(), mode, fp: { judgement: J.text || '', confidence: J.confidence || '', inds: cs.items.filter(i => i.type === 'indicator' && i.value).map(i => (i.kind || '') + ':' + this.refang(i.value).toLowerCase()), ttps: cs.items.filter(i => i.type === 'ttp').map(i => i.value), items: cs.items.filter(i => i.pinned).length, threads: cs.threads.length, tasksOpen: cs.items.reduce((n, i) => n + (i.todo || []).filter(t => !t.done).length, 0), review: cs.review || 'draft', tlp: cs.tlp || '' } }; }
  reportDiff(a, b) {
    if (!a) return [{ color: '#8d877b', text: 'First version — nothing to compare against' }];
    const rows = [], A = a.fp, B = b.fp, setA = new Set(A.inds), setB = new Set(B.inds);
    B.inds.filter(x => !setA.has(x)).forEach(x => rows.push({ color: '#3fae63', text: '+ indicator ' + x.split(':').slice(1).join(':') }));
    A.inds.filter(x => !setB.has(x)).forEach(x => rows.push({ color: '#ff2a3c', text: '− indicator ' + x.split(':').slice(1).join(':') }));
    B.ttps.filter(x => !A.ttps.includes(x)).forEach(x => rows.push({ color: '#3fae63', text: '+ technique ' + x }));
    if (A.judgement !== B.judgement) rows.push({ color: '#e8a71c', text: '~ key judgement changed' });
    if (A.confidence !== B.confidence) rows.push({ color: '#e8a71c', text: '~ confidence ' + (A.confidence || '—') + ' → ' + (B.confidence || '—') });
    if (A.review !== B.review) rows.push({ color: '#e8a71c', text: '~ review ' + A.review + ' → ' + B.review });
    if (A.tlp !== B.tlp) rows.push({ color: '#e8a71c', text: '~ handling ' + (A.tlp || 'unset') + ' → ' + (B.tlp || 'unset') });
    ['items', 'threads', 'tasksOpen'].forEach(k => { if (A[k] !== B[k]) rows.push({ color: '#8d877b', text: k + ' ' + A[k] + ' → ' + B[k] }); });
    return rows.length ? rows : [{ color: '#8d877b', text: 'No material change since the previous version' }];
  }
  toggleKillchain = () => { this.drag = null; this.setState(s => ({ mode: s.mode === 'killchain' ? 'board' : 'killchain', linking: null, pending: null })); setTimeout(() => this.fit(), 80); };
  posOf(it) { const lay = this.state.mode !== 'board' ? this.lastLayout : null; return lay && lay.pos[it.id] ? { x: lay.pos[it.id].x, y: lay.pos[it.id].y } : { x: it.x, y: it.y }; }
  toggleTimeline = () => { this.drag = null; this.setState(s => ({ mode: s.mode === 'timeline' ? 'board' : 'timeline', linking: null, pending: null })); setTimeout(() => this.fit(), 80); };
  isStale(it, days) { if (it.type !== 'indicator') return false; const d = it.lastSeen || it.collected || it.date; if (!d) return false; const age = (Date.now() - new Date(d).getTime()) / 864e5; return age > days; }
  ageText(it) { const d = it.lastSeen || it.collected || it.date; if (!d) return 'No sighting dates yet'; const age = Math.floor((Date.now() - new Date(d).getTime()) / 864e5); return age <= 0 ? 'Seen today' : 'Last seen ' + age + (age === 1 ? ' day ago' : ' days ago'); }
  xcase(it) {
    if (!it || it.type !== 'indicator' || !it.value) return [];
    const v = this.refang(it.value).toLowerCase(), s = this.state;
    return s.cases.filter(c => c.id !== s.activeId && c.items.some(i => i.type === 'indicator' && this.refang(i.value || '').toLowerCase() === v)).map(c => ({ label: c.number + ' · ' + c.title, onOpen: () => { const hit = c.items.find(i => i.type === 'indicator' && this.refang(i.value || '').toLowerCase() === v); this.setState({ activeId: c.id, sel: hit ? hit.id : null, selThread: null, selGroup: null, pending: null }); setTimeout(() => { if (hit) this.focusItem(hit.id); else this.fit(); }, 80); } }));
  }
  setReview = e => {
    const v = e.target.value, by = (this.state.analyst || '').trim();
    if (v === 'published' && !by) return this.toast('Enter your analyst name before publishing');
    if (v === 'published') { const cs0 = this.cs(), J0 = cs0.judgement || {}, missing = [!J0.text ? 'key judgement' : '', !J0.confidence ? 'confidence level' : '', cs0.items.some(i => i.pinned && i.type === 'indicator' && !i.status) ? 'stamp every pinned indicator' : ''].filter(Boolean); if (missing.length) return this.toast('Before publishing: ' + missing.join(' · ')); }
    this.upCase(c => ({ ...c, review: v, signoff: v === 'published' ? { by, at: new Date().toISOString() } : (v === 'draft' ? null : c.signoff || null) }));
    this.logEvt('Review state → ' + v);
  };
  addTask = () => { const id = this.state.sel, text = (this.state.taskText || '').trim(); if (!id || !text) return; const t = { id: Component.uid(), text, owner: (this.state.analyst || '').trim(), due: this.state.taskDue || '', done: false, at: new Date().toISOString() }; this.upCase(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, todo: [...(i.todo || []), t] } : i) })); this.setState({ taskText: '', taskDue: '' }); this.logEvt('Task added: ' + text); };
  addComment = () => { const id = this.state.sel, text = (this.state.commentText || '').trim(); if (!id || !text) return; const cm = { id: Component.uid(), text, by: (this.state.analyst || '').trim() || 'anon', at: new Date().toISOString() }; this.upCase(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, comments: [...(i.comments || []), cm] } : i) })); this.setState({ commentText: '' }); };
  openAch = () => { this.sfx('drawer'); this.setState({ achOpen: true }); }; closeAch = () => { this.sfx('close'); this.setState({ achOpen: false }); };
  addHyp = () => { const text = (this.state.hypText || '').trim(); if (!text) return; this.upCase(c => ({ ...c, hypotheses: [...(c.hypotheses || []), { id: Component.uid(), text }] })); this.setState({ hypText: '' }); this.logEvt('Hypothesis added: ' + text); };
  openReq = () => { const inds = this.cs().items.filter(i => i.type === 'indicator' && i.value); this.setState({ reqOpen: true, req: { ...this.state.req, sel: Object.fromEntries(inds.filter(i => i.status !== 'false').map(i => [i.id, true])) } }); }; closeReq = () => this.setState({ reqOpen: false });
  reqText() {
    const K = Component.K, cs = this.cs(), r = this.state.req, by = (this.state.analyst || '').trim() || 'Investigations team', tlp = K.TLP.find(t => t[0] === (cs.tlp || '')) || K.TLP[0];
    const inds = cs.items.filter(i => i.type === 'indicator' && r.sel[i.id]);
    const lines = inds.map(i => '  - ' + (K.KINDS[i.kind] || i.kind) + ': ' + this.defang(i.value, i.kind) + (i.status ? ' [' + (K.STAMP_LABEL[i.status] || '') + ']' : '') + (i.source ? ' — source: ' + i.source : '') + (i.lastSeen ? ' — last seen ' + i.lastSeen : ''));
    const head = (cs.tlp ? tlp[1] + '\n' : '') + 'Case reference: ' + cs.number + ' — ' + cs.title + '\nDate: ' + this.today() + '\nTo: ' + (r.to || '[recipient]') + '\nFrom: ' + by + '\n\n';
    const bodies = {
      takedown: 'Subject: Takedown request — ' + inds.length + ' malicious indicator(s)\n\nWe are investigating ' + cs.title + ' and have identified the following resources used in the activity. We request that they be suspended or removed under your abuse policy. Indicators are defanged; replace [.] with a dot.\n\n' + lines.join('\n') + '\n\nSummary of the activity:\n' + (cs.judgement && cs.judgement.text ? cs.judgement.text : (cs.notes || '').split('\n')[0]) + '\n\nEvidence is available on request. Please confirm receipt and the action taken, and preserve logs relating to these resources.\n\n' + by,
      rfi: 'Subject: Request for information — ' + cs.title + '\n\nWe are investigating ' + cs.title + ' and would value any information you hold on the following indicators, including first/last seen dates, associated infrastructure, account details and any related reporting.\n\n' + lines.join('\n') + '\n\nContext:\n' + (cs.judgement && cs.judgement.text ? cs.judgement.text : (cs.notes || '').split('\n')[0]) + '\n\nHandling: ' + (cs.tlp ? tlp[1] : 'as agreed') + '. Please reply through the usual channel.\n\n' + by,
      block: 'Subject: Blocking request — ' + inds.length + ' indicator(s) from ' + cs.number + '\n\nPlease add the following to the blocklist / detection rules and alert on any hits. Indicators are defanged.\n\n' + lines.join('\n') + '\n\nRationale: ' + (cs.judgement && cs.judgement.text ? cs.judgement.text : 'see case ' + cs.number) + '\n\nReview date: 30 days.\n\n' + by,
    };
    return head + bodies[r.kind || 'takedown'];
  }
  reqOpenLetter = () => { const txt = this.reqText(), w = window.open('', '_blank'); if (!w) return this.toast('Allow pop-ups to open the letter'); w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Request</title><style>body{margin:0;background:#f4f2ec;color:#1b1a17}pre{max-width:820px;margin:0 auto;padding:48px;font:13px/1.65 ui-monospace,Menlo,monospace;white-space:pre-wrap}.p{position:fixed;right:16px;top:16px;font:12px sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:9px 12px;background:#1b1a17;color:#f4f2ec;border:0;cursor:pointer}@media print{.p{display:none}}</style></head><body><button class="p" onclick="window.print()">Print / Save as PDF</button><pre>' + txt.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</pre></body></html>'); w.document.close(); this.logEvt('Request generated (' + this.state.req.kind + ')'); };
  reqCopy = () => { const txt = this.reqText(); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => this.toast('Request text copied')); };
  exhibits() { return this.cs().items.filter(i => i.pinned).sort((a, b) => (a.num || 0) - (b.num || 0)); }
  togglePresent = () => {
    const on = !this.state.present; this.sfx(on ? 'drawer' : 'close');
    this.setState({ present: on, hover: null, pending: null, linking: null });
    if (on) { const list = this.exhibits(), idx = Math.max(0, list.findIndex(i => i.id === this.state.sel)); if (list.length) setTimeout(() => this.stepPresent(0, idx), 80); }
    else setTimeout(() => this.fit(), 80);
  };
  stepPresent(dir, at) {
    const list = this.exhibits(); if (!list.length) return;
    const idx = at != null ? at : Math.min(list.length - 1, Math.max(0, this.state.presentIdx + dir)), it = list[idx], K = Component.K;
    const r = this.rect(), z = Math.max(this.state.view.z, .95), w = K.TYPES[it.type].w, hh = this.h(it.id), p = this.posOf(it);
    this.setState({ presentIdx: idx, sel: it.id, selThread: null, selGroup: null, view: { z, x: r.width / 2 - (p.x + w / 2) * z, y: r.height / 2 - (p.y + hh / 2) * z } });
  }
  onQuick = e => this.setState({ quick: e.target.value });
  onQuickKey = e => { if (e.key === 'Enter') { e.preventDefault(); this.quickAdd(this.state.quick); } else if (e.key === 'Escape') { e.target.blur(); this.setState({ quick: '' }); } };
  quickAdd(text) {
    text = String(text || '').trim(); if (!text) return;
    const K = Component.K, CMD = { d: ['indicator', 'domain'], i: ['indicator', 'ip'], h: ['indicator', 'hash'], m: ['indicator', 'email'], w: ['indicator', 'wallet'], cve: ['indicator', 'cve'], '@': ['indicator', 'handle'], u: ['link'], e: ['event'], n: ['note'], p: ['person'], t: ['ttp'], l: ['location'], doc: ['doc'], c: ['cluster'], x: ['tx'], org: ['target'], v: ['video'], vid: ['video'], a: ['audio'], pdf: ['pdf'], mail: ['email'], code: ['code'], log: ['code'], feed: ['feed'], mon: ['monitor'], car: ['vehicle'], veh: ['vehicle'], obj: ['object'], st: ['statement'] };
    const m = text.match(/^(@|[a-z]{1,3})\s+(.+)$/i); let cmd = m ? m[1].toLowerCase() : '', rest = m ? m[2].trim() : text, type, kind;
    if (CMD[cmd]) [type, kind] = CMD[cmd];
    else {
      rest = text;
      if (/^https?:\/\//i.test(rest)) type = 'link';
      else if (/^T\d{4}(\.\d{3})?$/i.test(rest)) type = 'ttp';
      else if (/^\d{4}-\d{2}-\d{2}\b/.test(rest)) type = 'event';
      else { const f = this.extractIocs(rest); if (f.length === 1 && this.refang(rest).toLowerCase().replace(/^@/, '') === f[0].value.toLowerCase().replace(/^@/, '')) { type = 'indicator'; kind = f[0].kind; } else type = 'note'; }
    }
    let id = null;
    if (type === 'cluster') { this.addGroup(rest); }
    else if (type === 'indicator') { const v = kind === 'handle' ? rest.replace(/^@?/, '@') : this.refang(rest); id = this.addItem('indicator', { kind, value: v, status: 'unverified', title: '' }, true); }
    else if (type === 'link') id = this.addItem('link', { title: this.host(rest), url: rest }, true);
    else if (type === 'ttp') { const a = K.ATTACK.find(x => x[0].toLowerCase() === rest.trim().toLowerCase()); id = this.addItem('ttp', a ? { value: a[0], title: a[1], kind: a[2] } : { value: rest.toUpperCase() }, true); }
    else if (type === 'event') { const em = rest.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/); id = this.addItem('event', em ? { date: em[1], title: em[2] || 'Untitled event' } : { title: rest, date: this.today() }, true); }
    else if (type === 'note') id = this.addItem('note', { body: rest }, true);
    else if (type === 'tx') { const cm = rest.match(/^(.*?)\s+(?:on\s+)?(ethereum|bitcoin|tron|solana|xrp ledger|xrp|bnb chain|polygon|avalanche|arbitrum|base|optimism)$/i); const chain = cm ? Component.K.CHAINS.find(c => c.toLowerCase().startsWith(cm[2].toLowerCase().slice(0, 3))) || '' : ''; id = this.addItem('tx', { amount: cm ? cm[1] : rest, chain, status: 'unverified' }, true); }
    else id = this.addItem(type, { title: rest }, true);
    this.setState({ quick: '' });
    this.toast((type === 'cluster' ? 'Cluster' : K.TYPES[type].label) + ' added — ' + rest.slice(0, 48));
    return id;
  }

  // ---------- geometry + view
  board() { return document.querySelector('[data-board]'); }
  rect() { const b = this.board(); return b ? b.getBoundingClientRect() : { left: 0, top: 0, width: 1000, height: 600 }; }
  s2w(cx, cy) { const r = this.rect(), v = this.state.view; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; }
  center() { const r = this.rect(); return this.s2w(r.left + r.width / 2, r.top + r.height / 2); }
  pin(it) { return { x: it.x + Component.K.TYPES[it.type].w / 2, y: it.y + 10 }; }
  h(id) { const el = document.querySelector('[data-card="' + id + '"][data-kind="card"]'); return el ? el.offsetHeight : 160; }
  hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  rot(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return ((h % 13) - 6) * 0.5; }
  zoomAt(sx, sy, f) {
    this.setState(s => { const v = s.view, z = Math.min(4, Math.max(.15, v.z * f)), k = z / v.z; return { view: { x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k, z } }; });
  }
  fit() {
    const r = this.rect(), items = this.cs().items.filter(i => i.pinned), K = Component.K;
    if (!items.length) return this.setState({ view: { x: 0, y: 0, z: 1 } });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const tl = this.state.mode !== 'board';
    items.forEach(i => { const w = K.TYPES[i.type].w, h = this.h(i.id), p = this.posOf(i); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y - (tl ? 60 : 12)); x1 = Math.max(x1, p.x + w); y1 = Math.max(y1, p.y + h); });
    if (!tl) (this.cs().groups || []).forEach(g => { x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y - 34); x1 = Math.max(x1, g.x + g.w); y1 = Math.max(y1, g.y + g.h); });
    if (this.state.mode === 'list') { const z = Math.min(1.2, Math.max(.6, (r.width - 32) / (x1 - x0 + 40))); return this.setState({ view: { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: 16 - y0 * z } }); }
    const M = 60, z = Math.min(1.4, r.width / (x1 - x0 + M * 2), r.height / (y1 - y0 + M * 2));
    this.setState({ view: { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z } });
  }
  focusItem(id) {
    const it = this.cs().items.find(i => i.id === id); if (!it) return; this.sfx('flip');
    this.setState({ sel: id, selThread: null, tab: 'inspector', showRight: true });
    if (!it.pinned) return;
    const r = this.rect(), v = this.state.view, w = Component.K.TYPES[it.type].w, h = this.h(id), p = this.posOf(it);
    this.setState({ view: { ...v, x: r.width / 2 - (p.x + w / 2) * v.z, y: r.height / 2 - (p.y + h / 2) * v.z } });
  }

  // ---------- pointer interactions
  cardDown(e, it) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = this.state;
    if (s.tool === 'connect') {
      if (!s.pending) this.setState({ pending: it.id, sel: it.id, selThread: null });
      else if (s.pending !== it.id) this.addThread(s.pending, it.id, s.rel);
      else this.setState({ pending: null });
      return;
    }
    this.setState({ sel: it.id, selThread: null, pending: null, selGroup: null });
    if (s.mode !== 'board') return;
    this.drag = { kind: 'card', id: it.id, sx: e.clientX, sy: e.clientY, ix: it.x, iy: it.y, moved: false };
  }
  pinDown(e, it) {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const p = this.pin(it);
    this.drag = { kind: 'link', id: it.id, sx: e.clientX, sy: e.clientY, moved: false };
    this.setState({ linking: { from: it.id, x: p.x, y: p.y }, sel: it.id, selThread: null, pending: null, selGroup: null });
  }
  boardDown = e => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('[data-ui]')) return;
    this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.state.view.x, vy: this.state.view.y, moved: false };
    this.setState({ sel: null, selThread: null, pending: null, selGroup: null });
  };
  onMove = e => {
    const d = this.drag; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.kind === 'pan') this.setState(s => ({ view: { ...s.view, x: d.vx + dx, y: d.vy + dy } }));
    else if (d.kind === 'card') { const z = this.state.view.z; let p = { x: d.ix + dx / z, y: d.iy + dy / z }; if (this.snapOn()) p = this.snapPos(p); this.upItem(d.id, p); }
    else if (d.kind === 'link') { const w = this.s2w(e.clientX, e.clientY); this.setState({ linking: { from: d.id, x: w.x, y: w.y } }); }
    else if (d.kind === 'group') { const z = this.state.view.z, ox = dx / z, oy = dy / z; this.upCase(c => ({ ...c, groups: (c.groups || []).map(g => g.id === d.id ? { ...g, x: d.gx + ox, y: d.gy + oy } : g), items: c.items.map(i => { const m = d.members.find(x => x.id === i.id); return m ? { ...i, x: m.x + ox, y: m.y + oy } : i; }) })); }
    else if (d.kind === 'gresize') { const z = this.state.view.z; this.upCase(c => ({ ...c, groups: (c.groups || []).map(g => g.id === d.id ? { ...g, w: Math.max(220, d.gw + dx / z), h: Math.max(140, d.gh + dy / z) } : g) })); }
  };
  onUp = e => {
    const d = this.drag; if (!d) return;
    this.drag = null; this.lastMoved = d.moved; if (d.moved && this.state.hover) this.setState({ hover: null });
    if (d.kind === 'link') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el && el.closest ? el.closest('[data-card]') : null;
      const to = card && card.getAttribute('data-card');
      if (to && to !== d.id) this.addThread(d.id, to, this.state.rel);
      this.setState({ linking: null });
    }
  };
  onWheel = e => {
    const b = this.board(); if (!b || !b.contains(e.target)) return;
    e.preventDefault();
    const r = this.rect();
    this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  };
  onKey = e => {
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    const s = this.state;
    if (s.screen === 'home') { if (e.key === 'Escape') this.setState(st => ({ tplOpen: false, lockOpen: false, renameId: null, extract: { ...st.extract, open: false } })); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return this.undo(); }
    if (e.key === 'Escape') { this.drag = null; if (s.present) return this.togglePresent(); this.setState(st => ({ pending: null, linking: null, sel: null, selThread: null, selGroup: null, actorsOpen: false, notifOpen: false, tasksOpen: false, diffOpen: false, annOpen: false, settingsOpen: false, mmoOpen: false, achOpen: false, reqOpen: false, osintOpen: false, tplOpen: false, lockOpen: false, extract: { ...st.extract, open: false } })); }
    else if (s.present && (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); this.stepPresent(1); }
    else if (s.present && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); this.stepPresent(-1); }
    else if (e.key === '/') { e.preventDefault(); const q = document.querySelector('[data-quick]'); if (q) q.focus(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (s.selThread) { e.preventDefault(); this.removeThread(s.selThread); }
      else if (s.sel) { e.preventDefault(); this.removeItem(s.sel); }
      else if (s.selGroup) { e.preventDefault(); this.removeGroup(s.selGroup); }
    }
    else if (e.key === 't' || e.key === 'T') this.toggleTimeline();
    else if (e.key === 'k' || e.key === 'K') this.toggleKillchain();
    else if (e.key === 'g' || e.key === 'G') this.toggleGeo();
    else if (e.key === 'o' || e.key === 'O') this.openOsint();
    else if (e.key === 'p' || e.key === 'P') this.togglePresent();
    else if (e.key === 'v' || e.key === 'V') this.setState({ tool: 'move', pending: null });
    else if (e.key === 'c' || e.key === 'C') this.setState({ tool: 'connect' });
    else if (e.key === 'f' || e.key === 'F') this.fit();
    else if (e.key === 'r' || e.key === 'R') this.setState(st => ({ reveal: !st.reveal }));
  };
  onPaste = e => {
    if (this.state.screen === 'home' || this.state.locked) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    const cd = e.clipboardData; if (!cd) return;
    const img = Array.from(cd.files || []).find(f => f.type.startsWith('image/'));
    if (img) { e.preventDefault(); this.addFile(new File([img], 'pasted-screenshot.png', { type: img.type }), null).then(() => this.toast('Screenshot pinned to the board')); return; }
    const text = (cd.getData('text') || '').trim(); if (!text) return;
    e.preventDefault();
    if (/^https?:\/\/\S+$/i.test(text)) { this.addItem('link', { title: this.host(text), url: text }, true); this.toast('Link pinned'); }
    else { this.addItem('note', { body: text }, true); this.toast('Note pinned'); }
  };
  host(u) { try { return new URL(u).hostname; } catch (e) { return u; } }
  stop = e => e.stopPropagation();

  // ---------- drag & drop (inbox items, files, urls)
  inboxDragStart(e, it) { e.dataTransfer.setData('text/cib-item', it.id); e.dataTransfer.effectAllowed = 'copyMove'; }
  allowDrop = e => { e.preventDefault(); };
  boardDrop = e => {
    e.preventDefault();
    const w = this.s2w(e.clientX, e.clientY), dt = e.dataTransfer;
    const id = dt.getData('text/cib-item');
    if (id) return this.pinItem(id, w);
    const files = Array.from(dt.files || []);
    if (files.length) {
      files.forEach((f, i) => {
        const at = { x: w.x + i * 30, y: w.y + i * 30 };
        this.addFile(f, at);
      });
      return;
    }
    const text = (dt.getData('text/uri-list') || dt.getData('text') || '').split('\n')[0].trim();
    if (/^https?:\/\//i.test(text)) this.addItem('link', { title: this.host(text), url: text }, true, w);
    else if (text) this.addItem('note', { body: text }, true, w);
  };
  cardDrop(e, it) {
    const img = Array.from(e.dataTransfer.files || []).find(f => f.type.startsWith('image/'));
    if (img && (it.type === 'photo' || it.type === 'person' || it.type === 'location')) {
      e.preventDefault(); e.stopPropagation();
      this.readImage(img).then(src => this.upItem(it.id, { image: src }));
      return;
    }
    e.stopPropagation(); this.boardDrop(e);
  }
  readImage(file) {
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 900 / Math.max(im.width, im.height));
          if (k === 1 && file.size < 300000) return res(fr.result);
          const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', .82));
        };
        im.onerror = () => res(fr.result);
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async fileMeta(f) {
    let fileHash = '';
    try { const buf = await f.arrayBuffer(); const dg = await crypto.subtle.digest('SHA-256', buf); fileHash = Array.from(new Uint8Array(dg)).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { fileHash = ''; }
    return { fileName: f.name || 'pasted image', fileHash, addedAt: new Date().toISOString(), addedBy: (this.state.analyst || '').trim() || 'unknown analyst', source: '' };
  }
  pickImage(id) { this.uploadFor = id; const inp = document.querySelector('[data-file="image"]'); if (inp) { inp.value = ''; inp.click(); } }
  onImageFile = e => { const f = e.target.files && e.target.files[0], id = this.uploadFor; if (!f || !id) return; Promise.all([this.readImage(f), this.fileMeta(f)]).then(([src, meta]) => { const { source, ...m } = meta; this.upItem(id, { image: src, ...m }); this.logEvt('File attached: ' + meta.fileName + ' sha256 ' + meta.fileHash.slice(0, 12) + '…'); }); };

  // ---------- cases, import / export
  newCase = () => this.setState({ tplOpen: true });
  goHome = () => { this.drag = null; this.setState({ screen: 'home', present: false, hover: null, linking: null, pending: null, sel: null, selThread: null, selGroup: null }); };
  openCase(id) { if (this.state.opening) return; this.setState({ opening: id }); setTimeout(() => { this.setState({ activeId: id, screen: 'board', opening: null, hoverCase: null, sel: null, selThread: null, selGroup: null, pending: null, mode: this.state.mobile ? 'list' : 'board' }); setTimeout(() => this.fit(), 120); }, 460); }
  dupCase(id) { const c = this.state.cases.find(x => x.id === id); if (!c) return; const n = Math.max(416, ...this.state.cases.map(x => parseInt(String(x.number || '').replace(/\D/g, ''), 10) || 0)) + 1; const copy = JSON.parse(JSON.stringify(c)); copy.id = Component.uid(); copy.number = 'CASE ' + String(n).padStart(4, '0'); copy.title = c.title + ' (copy)'; copy.review = 'draft'; copy.signoff = null; copy.log = [...(copy.log || []), { t: new Date().toISOString(), m: 'Duplicated from ' + c.number }]; this.setState(s => ({ cases: [...s.cases, copy] })); this.toast('Duplicated as ' + copy.number); }
  deleteCaseById(id) { const c = this.state.cases.find(x => x.id === id); if (!c) return; if (c.legalHold) return this.toast(c.number + ' is under legal hold and cannot be deleted'); if (!window.confirm('Delete ' + c.number + ' — ' + c.title + '? This cannot be undone.')) return; this.setState(s => { const cases = s.cases.filter(x => x.id !== id); const next = cases.length ? cases : [{ id: Component.uid(), number: 'CASE 0001', title: 'Untitled case', notes: '', items: [], threads: [], dismissed: [] }]; return { cases: next, activeId: next.some(x => x.id === s.activeId) ? s.activeId : next[0].id }; }); this.toast('Deleted ' + c.number); }
  exportCaseById(id) { const c = this.state.cases.find(x => x.id === id); if (!c) return; this.dl(new Blob([JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: [c] }, null, 2)], { type: 'application/json' }), this.slug(c) + '.json'); }
  exportAll = () => { const cs = this.state.cases; this.dl(new Blob([JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: cs }, null, 2)], { type: 'application/json' }), 'case-files-' + this.today() + '.json'); this.toast(cs.length + (cs.length === 1 ? ' case exported' : ' cases exported')); };
  saveNow = () => { this.save(); this.setState({ savedAt: new Date().toISOString() }); this.toast(this.cryptoKey ? 'Saved (encrypted)' : 'Saved to this browser'); };
  newCaseBlank = () => {
    const s = this.state, n = Math.max(416, ...s.cases.map(c => parseInt(String(c.number || '').replace(/\D/g, ''), 10) || 0)) + 1;
    const c = { id: Component.uid(), number: 'CASE ' + String(n).padStart(4, '0'), title: 'Untitled case', notes: '', items: [], threads: [], dismissed: [] };
    this.setState({ cases: [...s.cases, c], activeId: c.id, sel: null, selThread: null, pending: null, view: { x: 60, y: 60, z: 1 } });
  };
  deleteCase = () => {
    const cs = this.cs();
    if (!window.confirm('Delete ' + cs.number + ' — ' + cs.title + '? This cannot be undone.')) return;
    this.setState(s => {
      const cases = s.cases.filter(c => c.id !== cs.id);
      const next = cases.length ? cases : [{ id: Component.uid(), number: 'CASE 0001', title: 'Untitled case', notes: '', items: [], threads: [], dismissed: [] }];
      return { cases: next, activeId: next[0].id, sel: null, selThread: null, pending: null };
    });
    setTimeout(() => this.fit(), 60);
  };
  onSwitchCase = e => { this.setState({ activeId: e.target.value, sel: null, selThread: null, pending: null }); setTimeout(() => this.fit(), 60); };
  onCaseTitle = e => { const v = e.target.value; this.upCase(c => ({ ...c, title: v })); };
  onNotes = e => { const v = e.target.value; this.upCase(c => ({ ...c, notes: v })); };
  onSearch = e => this.setState({ search: e.target.value });
  slug(cs) { return (cs.number + '-' + cs.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
  today() { return new Date().toISOString().slice(0, 10); }
  exportJson = () => { const cs = this.cs(); this.dl(new Blob([JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: [cs] }, null, 2)], { type: 'application/json' }), this.slug(cs) + '.json'); this.toast('Case exported'); };
  importJson = () => { const inp = document.querySelector('[data-file="import"]'); if (inp) { inp.value = ''; inp.click(); } };
  onImportFile = e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const txt = String(fr.result || '');
        if (!/^\s*[\[{]/.test(txt)) { const n = this.importCsv(txt, f.name); this.setState({ showInbox: true }); this.toast(n ? n + ' rows added to the inbox' : 'Nothing recognisable in that file'); return; }
        const d = JSON.parse(txt);
        if (d.type === 'bundle' && Array.isArray(d.objects)) { const c = Component.numbered(this.importStix(d, f.name.replace(/\.[^.]+$/, ''))); this.setState(s => ({ cases: [...s.cases, c], activeId: c.id, sel: null, selThread: null, selGroup: null, screen: 'board' })); setTimeout(() => this.fit(), 80); this.toast('STIX bundle imported — ' + c.items.length + ' cards, ' + c.threads.length + ' threads'); return; }
        const list = Array.isArray(d.cases) ? d.cases : (d.items ? [d] : []);
        if (!list.length) throw new Error('no cases');
        const norm = list.map(c => ({ id: Component.uid(), number: c.number || 'CASE ----', title: c.title || f.name.replace(/\.json$/i, ''), notes: c.notes || '', groups: c.groups || [], log: c.log || [], snapshots: c.snapshots || [], items: (c.items || []).map(i => ({ ...i })), threads: c.threads || [], dismissed: c.dismissed || [] }));
        this.setState(s => ({ cases: [...s.cases, ...norm.map(Component.numbered)], activeId: norm[0].id, sel: null, selThread: null }));
        setTimeout(() => this.fit(), 80);
        this.toast('Imported ' + norm.length + (norm.length > 1 ? ' cases' : ' case'));
      } catch (x) { this.toast('Could not read that file'); }
    };
    fr.readAsText(f);
  };
  renderBoard = async () => {
    const K = Component.K, cs = this.cs(), items = cs.items.filter(i => i.pinned), V = this.visuals();
    if (!items.length) return this.toast('Nothing pinned to export');
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    (cs.groups || []).forEach(g => { ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(243,241,234,.38)'; ctx.lineWidth = 1; ctx.strokeRect(g.x, g.y, g.w, g.h); ctx.fillStyle = 'rgba(243,241,234,.035)'; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.setLineDash([]); ctx.font = "12px 'Archivo Narrow', sans-serif"; const tw2 = ctx.measureText(String(g.title || '').toUpperCase()).width + 20; ctx.fillStyle = '#f3f1ea'; ctx.fillRect(g.x, g.y - 28, tw2, 26); ctx.fillStyle = '#1b1a17'; ctx.fillText(String(g.title || '').toUpperCase(), g.x + 10, g.y - 10); ctx.restore(); });
    items.forEach(i => { const w = K.TYPES[i.type].w, h = this.h(i.id); x0 = Math.min(x0, i.x - 24); y0 = Math.min(y0, i.y - 24); x1 = Math.max(x1, i.x + w + 24); y1 = Math.max(y1, i.y + h + 24); });
    const M = 70, HEAD = 70, W = x1 - x0 + M * 2, H = y1 - y0 + M * 2 + HEAD, S = Math.min(2, 6000 / Math.max(W, H));
    const cv = document.createElement('canvas'); cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    const ctx = cv.getContext('2d'); ctx.scale(S, S);
    ctx.fillStyle = '#101012'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, Math.max(W, H)); g.addColorStop(0, 'rgba(255,244,214,.13)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8d877b'; ctx.font = "11px 'Archivo Narrow', sans-serif"; ctx.fillText(cs.number.toUpperCase() + '  ·  ' + this.today(), M, M - 28);
    ctx.fillStyle = '#f3f1ea'; ctx.font = "24px 'Special Elite', monospace"; ctx.fillText(cs.title, M, M);
    const imgs = {};
    await Promise.all(items.filter(i => i.image).map(i => new Promise(res => { const im = new Image(); im.onload = () => { imgs[i.id] = im; res(); }; im.onerror = res; im.src = i.image; })));
    ctx.translate(M - x0, M + HEAD - y0);
    const cover = (im, x, y, w, h) => { const k = Math.max(w / im.width, h / im.height), sw = w / k, sh = h / k; ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h); };
    items.forEach(i => {
      const w = K.TYPES[i.type].w, h = this.h(i.id), p = this.pin(i);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.rot(i.id) * Math.PI / 180); ctx.translate(-w / 2, -10);
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8; ctx.fillStyle = this.paperBg(i.type, V.paper); ctx.fillRect(0, 0, w, h);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#a39d90'; ctx.font = "9px 'Archivo Narrow', sans-serif"; ctx.textAlign = 'right'; ctx.fillText(K.TYPES[i.type].label.toUpperCase(), w - 8, 14); ctx.textAlign = 'left';
      if (V.numbers && i.num) { ctx.fillStyle = '#9a2b2b'; ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillText('№ ' + Component.numText('', i.num) + ((i.srcGrade || i.infoGrade) ? '  ' + (i.srcGrade || '?') + (i.infoGrade || '?') : ''), 8, 14); }
      let y = 36;
      if (i.type === 'event') { ctx.fillStyle = '#b4222a'; ctx.fillRect(0, 0, 6, h); ctx.fillStyle = '#1b1a17'; ctx.font = "18px 'Special Elite', monospace"; ctx.fillText(this.fmtDate(i.date), 12, y); y += 22; }
      if (imgs[i.id]) {
        if (i.type === 'person') { cover(imgs[i.id], 12, 22, 64, 64); }
        else { const ih = i.type === 'location' ? 90 : 150; cover(imgs[i.id], 10, 22, w - 20, ih); y = 22 + ih + 18; }
      } else if (i.type === 'photo' || i.type === 'location') { const ih = i.type === 'location' ? 90 : 150; ctx.fillStyle = '#dcd9d0'; ctx.fillRect(10, 22, w - 20, ih); y = 22 + ih + 18; }
      const tx = i.type === 'person' ? (imgs[i.id] ? 86 : 12) : 12, tw = w - tx - 12;
      if (i.type === 'indicator') { ctx.fillStyle = '#9a2b2b'; ctx.font = "9px 'Archivo Narrow', sans-serif"; ctx.fillText((K.KINDS[i.kind] || i.kind || '').toUpperCase(), 12, y - 8); ctx.fillStyle = '#1b1a17'; ctx.font = "12px 'IBM Plex Mono', monospace"; this.wrapText(ctx, i.value, tw, 3, true).forEach(l => { ctx.fillText(l, 12, y + 6); ctx.fillStyle = K.RED; ctx.fillRect(12, y + 9, Math.min(tw, ctx.measureText(l).width), 2); ctx.fillStyle = '#1b1a17'; y += 17; }); y += 8; }
      if (i.type === 'tx') { ctx.fillStyle = '#9a2b2b'; ctx.font = "9px 'Archivo Narrow', sans-serif"; ctx.fillText(String(i.chain || 'TRANSFER').toUpperCase(), 12, y - 8); ctx.fillStyle = '#1b1a17'; ctx.font = "20px 'Special Elite', monospace"; this.wrapText(ctx, i.amount || '', tw, 2).forEach(l => { ctx.fillText(l, 12, y + 10); y += 24; }); ctx.font = "10px 'IBM Plex Mono', monospace"; [['FROM', i.txFrom], ['TO', i.txTo]].forEach(([l, v]) => { if (!v) return; ctx.fillStyle = '#9a2b2b'; ctx.fillText(l, 12, y + 4); ctx.fillStyle = '#3a362f'; this.wrapText(ctx, v, tw - 40, 2, true).forEach(x => { ctx.fillText(x, 50, y + 4); y += 13; }); }); y += 10; }
      if (i.type === 'ttp') { ctx.font = "15px 'IBM Plex Mono', monospace"; const idw = ctx.measureText(i.value || '').width + 14; ctx.fillStyle = '#1b1a17'; ctx.fillRect(12, y - 15, idw, 21); ctx.fillStyle = '#f3f1ea'; ctx.fillText(i.value || '', 19, y + 1); ctx.fillStyle = '#9a2b2b'; ctx.font = "9px 'Archivo Narrow', sans-serif"; ctx.fillText(String(i.kind || '').toUpperCase(), 12 + idw + 8, y); y += 22; }
      if (i.type === 'note') { ctx.fillStyle = '#2a2622'; ctx.font = "20px 'Reenie Beanie', cursive"; this.wrapText(ctx, i.body || i.title, tw, 7).forEach(l => { ctx.fillText(l, 14, y); y += 22; }); }
      else {
        if (i.title) { ctx.fillStyle = '#1b1a17'; ctx.font = (i.type === 'event' ? "600 14px 'Archivo Narrow', sans-serif" : "14px 'Special Elite', monospace"); this.wrapText(ctx, i.title, tw, 3).forEach(l => { ctx.fillText(l, tx, y); y += 17; }); }
        if (i.url) { ctx.fillStyle = '#1f4e8c'; ctx.font = "10px 'IBM Plex Mono', monospace"; this.wrapText(ctx, i.url, tw, 3, true).forEach(l => { ctx.fillText(l, tx, y); y += 13; }); }
        if (i.body) { ctx.fillStyle = '#6d675c'; ctx.font = "11px 'IBM Plex Mono', monospace"; this.wrapText(ctx, i.body, tw, 6).forEach(l => { ctx.fillText(l, tx, y + 2); y += 15; }); }
      }
      if (i.status && K.STAMP_LABEL[i.status]) { const txt = K.STAMP_LABEL[i.status].toUpperCase(); ctx.save(); ctx.font = "12px 'Special Elite', monospace"; const sw = ctx.measureText(txt).width + 18; ctx.translate(w - 10 - sw / 2, h - 16); ctx.rotate(-12 * Math.PI / 180); ctx.globalAlpha = .85; ctx.strokeStyle = K.STAMP_INK[i.status]; ctx.lineWidth = 1; ctx.strokeRect(-sw / 2, -10, sw, 20); ctx.strokeRect(-sw / 2 + 3, -7, sw - 6, 14); ctx.fillStyle = K.STAMP_INK[i.status]; ctx.textAlign = 'center'; ctx.fillText(txt, 0, 4); ctx.restore(); }
      ctx.restore();
    });
    cs.threads.filter(t => byId[t.from] && byId[t.to]).forEach(t => {
      const r = K.REL[t.rel] || K.REL.linked, a = this.pin(byId[t.from]), b = this.pin(byId[t.to]), c = t.wp ? this.curveVia(a, b, t.wp) : this.curve(a, b, V.thread);
      const path = () => { ctx.beginPath(); ctx.moveTo(a.x, a.y); if (c.c) ctx.quadraticCurveTo(c.c.x, c.c.y, b.x, b.y); else ctx.lineTo(b.x, b.y); ctx.stroke(); };
      ctx.lineCap = 'round';
      ctx.save(); ctx.translate(3, 6); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = V.width + 1.5; path(); ctx.restore();
      const conf = t.conf || 'high'; ctx.globalAlpha = conf === 'low' ? .55 : 1; ctx.strokeStyle = this.relColor(r); ctx.lineWidth = V.width; ctx.setLineDash(r.dash ? [7, 5] : conf === 'medium' ? [14, 7] : conf === 'low' ? [3, 7] : []); path(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (V.fiber) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 7]); path(); ctx.setLineDash([]); }
      if (V.labels || (V.numbers && t.num)) {
        ctx.save(); ctx.translate(c.mx, c.my); ctx.rotate(c.angle * Math.PI / 180);
        ctx.font = "10px 'Archivo Narrow', sans-serif"; const label = [V.numbers && t.num ? Component.numText('T', t.num) : '', V.labels ? r.label.toUpperCase() : ''].filter(Boolean).join('  '), tw = ctx.measureText(label).width + 16;
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.fillStyle = '#f3f1ea'; ctx.fillRect(-tw / 2, -9, tw, 18); ctx.shadowColor = 'transparent';
        ctx.fillStyle = r.color; ctx.fillRect(-tw / 2, -9, 3, 18);
        ctx.fillStyle = '#1b1a17'; ctx.textAlign = 'center'; ctx.fillText(label, 1.5, 3.5); ctx.textAlign = 'left';
        ctx.restore();
      }
    });
    items.forEach(i => {
      const p = this.pin(i), col = this.pinColors(i.type, V.pins);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 9, 3, 7, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const rg = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 9); rg.addColorStop(0, col[0]); rg.addColorStop(.45, col[1]); rg.addColorStop(1, col[2]);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    if (cs.tlp) { const t = K.TLP.find(x => x[0] === cs.tlp); if (t) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = "bold 14px 'IBM Plex Mono', monospace"; const tw3 = ctx.measureText(t[1]).width + 24; ctx.fillStyle = t[2]; ctx.fillRect(cv.width - tw3 - 16, 16, tw3, 30); ctx.fillStyle = t[3]; ctx.fillText(t[1], cv.width - tw3 - 4, 36); } }
    return cv;
  };
  exportPng = async () => { const cv = await this.renderBoard(); if (!cv) return; cv.toBlob(b => { if (b) this.dl(b, this.slug(this.cs()) + '.png'); }, 'image/png'); this.toast('Board image exported'); };
  wrapText(ctx, text, maxW, maxLines, breakAll) {
    const out = [];
    String(text || '').split(/\n/).forEach(par => {
      if (breakAll) { let line = ''; for (const ch of par) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; } out.push(line); return; }
      let line = '';
      par.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
      out.push(line);
    });
    return out.slice(0, maxLines);
  }

  // ---------- intelligence helpers
  migrate(cases) {
    const SAMPLES = { c1: Component.sample(), c2: Component.sample2() };
    return cases.map(c => {
      const S = SAMPLES[c.id]; if (!S || (c.v || 0) >= (S.v || 0)) return c;
      const have = new Set(c.items.map(i => i.id)), haveT = new Set(c.threads.map(t => t.id)), sI = Object.fromEntries(S.items.map(i => [i.id, i])), sT = Object.fromEntries(S.threads.map(t => [t.id, t]));
      return { ...c, v: S.v, items: [...c.items.map(i => ({ ...i, status: (i.status ?? (sI[i.id] ? sI[i.id].status : '')) || '' })), ...S.items.filter(i => !have.has(i.id))], threads: [...c.threads.map(t => ({ ...t, conf: t.conf || (sT[t.id] && sT[t.id].conf) || 'high' })), ...S.threads.filter(t => !haveT.has(t.id))] };
    });
  }
  refang(v) { return String(v || '').replace(/\[\.\]|\(\.\)|\{\.\}/g, '.').replace(/\[:\]/g, ':').replace(/\[@\]/g, '@').replace(/hxxp/gi, 'http'); }
  defang(v, kind) { if (!['domain', 'ip', 'url', 'email'].includes(kind)) return v; return this.refang(v).replace(/\./g, '[.]').replace(/^http/i, 'hxxp'); }
  display(it, V) { const v = it.value || ''; if (it.type !== 'indicator' || !(V || this.visuals()).defang) return v; return this.defang(v, it.kind); }
  pivots(it) {
    const enc = encodeURIComponent;
    if (it.type === 'tx') { const E = Component.K.EXPLORER[it.chain]; if (!E) return []; const out = [], hx = String(it.value || '').trim(); if (hx) out.push({ label: 'Transaction', href: E[0] + enc(hx) }); [['From', it.txFrom], ['To', it.txTo]].forEach(([l, v]) => { v = String(v || '').trim(); if (/^(0x[a-f0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59}|T[a-zA-Z0-9]{33}|r[a-zA-Z0-9]{24,34}|[1-9A-HJ-NP-Za-km-z]{32,44})$/i.test(v)) out.push({ label: l + ' address', href: E[1] + enc(v) }); }); return out; }
    if (it.type === 'ttp') { const id = String(it.value || '').trim().toUpperCase(); return /^T\d{4}(\.\d{3})?$/.test(id) ? [{ label: 'ATT&CK', href: 'https://attack.mitre.org/techniques/' + id.replace('.', '/') + '/' }] : []; }
    if (it.type !== 'indicator') return [];
    const v = this.refang(it.value || '').trim(); if (!v) return [];
    const k = it.kind, L = (label, href) => ({ label, href });
    if (k === 'domain') return [L('VirusTotal', 'https://www.virustotal.com/gui/domain/' + enc(v)), L('urlscan', 'https://urlscan.io/search/#' + enc(v)), L('crt.sh', 'https://crt.sh/?q=' + enc(v)), L('WHOIS', 'https://who.is/whois/' + enc(v)), L('Shodan', 'https://www.shodan.io/search?query=hostname%3A' + enc(v))];
    if (k === 'ip') return [L('VirusTotal', 'https://www.virustotal.com/gui/ip-address/' + enc(v)), L('Shodan', 'https://www.shodan.io/host/' + enc(v)), L('AbuseIPDB', 'https://www.abuseipdb.com/check/' + enc(v)), L('Censys', 'https://search.censys.io/hosts/' + enc(v))];
    if (k === 'url') return [L('VirusTotal', 'https://www.virustotal.com/gui/search/' + enc(v)), L('urlscan', 'https://urlscan.io/search/#' + enc(v))];
    if (k === 'hash') return [L('VirusTotal', 'https://www.virustotal.com/gui/file/' + enc(v)), L('MalwareBazaar', 'https://bazaar.abuse.ch/browse.php?search=' + enc(v)), L('Hybrid Analysis', 'https://www.hybrid-analysis.com/search?query=' + enc(v))];
    if (k === 'email') return [L('VirusTotal', 'https://www.virustotal.com/gui/search/' + enc(v)), L('EmailRep', 'https://emailrep.io/' + enc(v))];
    if (k === 'handle') return [L('WhatsMyName', 'https://whatsmyname.app/?q=' + enc(v.replace(/^@/, '')))];
    if (k === 'wallet') return /^0x/i.test(v) ? [L('Etherscan', 'https://etherscan.io/address/' + enc(v))] : [L('Blockchain.com', 'https://www.blockchain.com/explorer/search?search=' + enc(v))];
    if (k === 'cve') return [L('NVD', 'https://nvd.nist.gov/vuln/detail/' + enc(v.toUpperCase())), L('CISA KEV', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=' + enc(v.toUpperCase()))];
    return [];
  }
  extractIocs(raw) {
    let text = ' ' + this.refang(raw) + ' '; const out = [], seen = new Set();
    const push = (kind, v) => { const key = kind + ':' + v.toLowerCase(); if (seen.has(key)) return; seen.add(key); out.push({ kind, value: v }); };
    const take = (re, kind, fn) => { (text.match(re) || []).forEach(m => { const v = fn ? fn(m) : m; if (v) push(kind, v); text = text.split(m).join(' '); }); };
    take(/\bCVE-\d{4}-\d{4,7}\b/gi, 'cve', m => m.toUpperCase());
    take(/\bhttps?:\/\/[^\s"'<>()\[\]]+/gi, 'url', m => m.replace(/[.,;:]+$/, ''));
    take(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, 'email', m => m.toLowerCase());
    take(/\b[a-f0-9]{64}\b/gi, 'hash', m => m.toLowerCase()); take(/\b[a-f0-9]{40}\b/gi, 'hash', m => m.toLowerCase()); take(/\b[a-f0-9]{32}\b/gi, 'hash', m => m.toLowerCase());
    take(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, 'ip');
    take(/\b0x[a-fA-F0-9]{40}\b/g, 'wallet'); take(/\bbc1[a-z0-9]{25,59}\b/g, 'wallet'); take(/\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, 'wallet');
    take(/(?:^|[\s(])@[a-z0-9_]{3,32}\b/gi, 'handle', m => m.trim().replace(/^\(/, ''));
    const EXT = /\.(exe|dll|zip|rar|7z|txt|pdf|docx?|xlsx?|pptx?|ps1|js|php|html?|png|jpe?g|gif|py|sh|bat|lnk|iso|msi|apk|bin|dat|log|csv|json|xml|md)$/i;
    take(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi, 'domain', m => EXT.test(m) ? null : m.toLowerCase());
    return out;
  }
  openExtract = () => this.setState({ extract: { open: true, text: '', rows: [] } });
  closeExtract = () => this.setState(s => ({ extract: { ...s.extract, open: false } }));
  onExtractText = e => { const v = e.target.value; this.setState(s => ({ extract: { ...s.extract, text: v } })); };
  runExtract = () => {
    const found = this.extractIocs(this.state.extract.text);
    const known = new Set(this.cs().items.filter(i => i.type === 'indicator').map(i => this.refang(i.value || '').toLowerCase()));
    const rows = found.map(f => { const k = known.has(f.value.toLowerCase()); return { ...f, known: k, checked: !k }; });
    this.setState(s => ({ extract: { ...s.extract, rows } }));
    if (!rows.length) this.toast('No indicators found in that text');
  };
  addExtracted(pinned) {
    const rows = this.state.extract.rows.filter(r => r.checked && !r.known); if (!rows.length) return this.toast('Nothing selected');
    const c = this.center();
    rows.forEach((r, i) => this.addItem('indicator', { kind: r.kind, value: r.value, status: 'unverified', title: '' }, pinned, pinned ? { x: c.x - 300 + (i % 4) * 250, y: c.y - 120 + Math.floor(i / 4) * 150 } : null));
    this.setState(s => ({ extract: { ...s.extract, open: false, rows: [] } }));
    this.toast(rows.length + (pinned ? ' indicators pinned to the board' : ' indicators added to the inbox'));
  }
  setTechnique = e => {
    const v = e.target.value, id = this.state.sel; if (!id) return;
    const A = Component.K.ATTACK, m = A.find(a => a[0] + ' — ' + a[1] === v) || A.find(a => a[0].toLowerCase() === v.trim().toLowerCase());
    if (m) this.upItem(id, { value: m[0], title: m[1], kind: m[2] }); else this.upItem(id, { value: v });
  };
  flowLayer(threads, V) {
    if (!V.flow || !threads.length) return null;
    const h = React.createElement;
    return h('svg', { style: { position: 'absolute', left: 0, top: 0, width: 10, height: 10, overflow: 'visible', pointerEvents: 'none' } },
      threads.map(t => h('g', { key: t.id, style: { opacity: t.opacity } },
        h('path', { d: t.d, style: { fill: 'none', stroke: t.flowColor, strokeWidth: 2.2, strokeLinecap: 'round', strokeDasharray: '12 48', animation: 'flow 1.2s linear infinite', filter: 'drop-shadow(0 0 3px ' + t.color + ')' } }),
        h('circle', { r: 2.4, style: { fill: '#fff', filter: 'drop-shadow(0 0 4px #fff) drop-shadow(0 0 9px ' + t.color + ')' } },
          h('animateMotion', { dur: t.dur + 's', repeatCount: 'indefinite', path: t.d }))
      )));
  }
  exportBrief = () => { this.sfx('flip'); return this.openBrief('full'); };
  exportOnePager = () => this.openBrief('exec');
  openBrief = async (mode, ret) => {
    const K = Component.K, cs = this.cs(), V = this.visuals(), byId = Object.fromEntries(cs.items.map(i => [i.id, i])), tlp = K.TLP.find(t => t[0] === (cs.tlp || '')) || K.TLP[0];
    const esc = x => String(x ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const num = (p, n) => n ? '<span class="mono">' + Component.numText(p, n) + '</span>' : '';
    const label = i => (i.num ? num('E', i.num) + ' ' : '') + esc(this.itemLabel(i)), tags = i => this.tagList(i.tags).map(t => '#' + esc(t)).join(' '), mono = x => '<span class="mono">' + esc(x) + '</span>';
    const stamp = i => i.status && K.STAMP_LABEL[i.status] ? '<span class="st st-' + i.status + '">' + K.STAMP_LABEL[i.status] + '</span>' : '';
    const grade = i => (i.srcGrade || i.infoGrade) ? mono((i.srcGrade || '?') + (i.infoGrade || '?')) : '';
    const src = i => [i.source ? esc(i.source) : '', i.collected ? 'collected ' + esc(this.fmtDate(i.collected)) : '', grade(i)].filter(Boolean).join(' · ');
    const table = (heads, rows) => rows.length ? '<table><thead><tr>' + heads.map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : '<p class="muted">None recorded.</p>';
    const J = cs.judgement || {}, review = cs.review || 'draft', signoff = cs.signoff ? 'Signed off by ' + esc(cs.signoff.by) + ' on ' + new Date(cs.signoff.at).toLocaleString() : 'Not signed off';
    const cv = cs.items.some(i => i.pinned) ? await this.renderBoard() : null;
    const inds = cs.items.filter(i => i.type === 'indicator'), ttps = cs.items.filter(i => i.type === 'ttp'), people = cs.items.filter(i => i.type === 'person'), targets = cs.items.filter(i => i.type === 'target'), tl = cs.items.filter(i => i.date).sort((a, b) => a.date < b.date ? -1 : 1), rest = cs.items.filter(i => !['indicator', 'ttp', 'person', 'tx', 'target'].includes(i.type));
    const tasks = cs.items.flatMap(i => (i.todo || []).map(t => ({ ...t, item: i })));
    const hyps = cs.hypotheses || [], ach = cs.ach || {};
    const css = "body{margin:0;background:#f4f2ec;color:#1b1a17;font:13px/1.5 'Archivo Narrow',sans-serif}.page{max-width:900px;margin:0 auto;padding:40px 48px}h1{font:30px 'Special Elite',monospace;margin:2px 0 14px}h2{font:12px 'Archivo Narrow',sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#9a2b2b;border-bottom:1px solid #1b1a17;padding-bottom:4px;margin:28px 0 10px}.meta{font:11px 'IBM Plex Mono',monospace;color:#6d675c;letter-spacing:.06em}img.board{width:100%;display:block;border:1px solid #1b1a17}pre{font:12px/1.65 'Special Elite',monospace;white-space:pre-wrap;margin:0}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;font:10px 'Archivo Narrow',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6d675c;padding:4px 6px;border-bottom:1px solid #1b1a17}td{padding:5px 6px;border-bottom:1px solid #d9d6cd;vertical-align:top}.mono{font:11px 'IBM Plex Mono',monospace;word-break:break-all}.muted{color:#6d675c}.st{display:inline-block;font:10px 'Special Elite',monospace;letter-spacing:.14em;text-transform:uppercase;border:3px double currentColor;padding:1px 5px;transform:rotate(-4deg)}.st-confirmed{color:#1f7a3d}.st-unverified{color:#b4222a}.st-false{color:#5a5650}.tlp{display:inline-block;font:11px 'IBM Plex Mono',monospace;letter-spacing:.12em;padding:3px 8px;margin-bottom:10px}.judge{font:17px/1.45 'Special Elite',monospace;border-left:4px solid #9a2b2b;padding:6px 14px;margin:6px 0}.conf{font:11px 'Archivo Narrow',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9a2b2b}.print{position:fixed;right:16px;top:16px;font:12px 'Archivo Narrow',sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:9px 12px;background:#1b1a17;color:#f4f2ec;border:0;cursor:pointer}.c{text-align:center;font:12px 'IBM Plex Mono',monospace}.C{color:#1f7a3d}.I{color:#b4222a}.N{color:#6d675c}@media print{.print{display:none}.page{padding:0}@page{margin:16mm}}";
    const top = (cs.tlp ? '<div class="tlp" style="background:' + tlp[2] + ';color:' + tlp[3] + '">' + tlp[1] + '</div>' : '')
      + '<div class="meta">' + esc(cs.number) + ' · ' + (mode === 'exec' ? 'EXECUTIVE ONE-PAGER' : 'CASE BRIEF') + ' · ' + this.today() + ' · ' + esc(review.toUpperCase()) + ' · ' + signoff + '</div>'
      + '<h1>' + esc(cs.title) + '</h1>'
      + (J.text ? '<div class="conf">Key judgement · ' + esc(J.confidence || 'unstated') + ' confidence</div><div class="judge">' + esc(J.text) + '</div>' : '')
      + (J.dissent ? '<div class="muted"><strong>Dissent / what would change the call:</strong> ' + esc(J.dissent) + '</div>' : '');
    let body;
    if (mode === 'court') {
      const ex = cs.items.filter(i => i.pinned).sort((a, c) => (a.num || 0) - (c.num || 0)), by = (this.state.analyst || '').trim() || '[name]';
      body = (cs.tlp ? '<div class="tlp" style="background:' + tlp[2] + ';color:' + tlp[3] + '">' + tlp[1] + '</div>' : '') + '<div class="meta">' + esc(cs.number) + ' · EVIDENTIAL BRIEF · ' + this.today() + '</div><h1>' + esc(cs.title) + '</h1>'
        + '<h2>Declaration</h2><p>I, ' + esc(by) + ', prepared this brief from the case record identified above. The exhibits listed below were collected, labelled and preserved as described in the custody appendix. Where an item is marked unverified, no finding should be drawn from it. I believe the facts stated in this brief are true to the best of my knowledge.</p><p class="muted">Signed: ____________________ Date: ' + this.today() + '</p>'
        + (J.text ? '<h2>Summary of findings</h2><div class="conf">' + esc(J.confidence || 'unstated') + ' confidence</div><div class="judge">' + esc(J.text) + '</div>' + (J.dissent ? '<p class="muted">Alternative explanation considered: ' + esc(J.dissent) + '</p>' : '') : '')
        + '<h2>Exhibit list</h2>' + table(['Exhibit', 'Type', 'Description', 'Status', 'Source · collected', 'Grade'], ex.map(i => [num('E', i.num), esc(K.TYPES[i.type].label), esc(this.itemLabel(i)) + (i.value ? ' <span class="mono">' + esc(this.display(i, V)) + '</span>' : ''), stamp(i), src(i), grade(i)]))
        + '<h2>Persons</h2>' + table(['Name', 'Role', 'Notes', 'Status'], people.map(i => [esc(i.title), esc(i.role || '—'), esc(i.body), stamp(i)]))
        + '<h2>Chronology</h2>' + table(['Date', 'Time', 'Event', 'Exhibit'], tl.map(i => [mono(this.fmtDate(i.date)), mono(i.time || ''), esc(this.itemLabel(i)), num('E', i.num)]))
        + '<h2>Relationships relied upon</h2>' + table(['№', 'From', 'Relation', 'To', 'Confidence', 'Basis'], cs.threads.map(t => [num('T', t.num), byId[t.from] ? label(byId[t.from]) : '—', esc((K.REL[t.rel] || K.REL.linked).label), byId[t.to] ? label(byId[t.to]) : '—', esc(t.conf || 'high'), esc(t.why || t.note || '')]))
        + '<h2>Appendix A · chain of custody</h2>' + table(['Exhibit', 'File', 'SHA-256', 'Added by', 'When'], cs.items.filter(i => i.fileHash || i.fileName).map(i => [num('E', i.num), esc(i.fileName || i.mediaName || ''), mono(i.fileHash || ''), esc(i.addedBy || ''), mono(i.addedAt ? new Date(i.addedAt).toLocaleString() : '')]))
        + '<h2>Appendix B · case log</h2>' + table(['When', 'Entry'], (cs.log || []).slice(-120).map(l => [mono(new Date(l.t).toLocaleString()), esc(l.m)]));
    } else if (mode === 'exec') {
      body = top
        + '<h2>What happened</h2>' + table(['Date', 'Event'], tl.filter(i => i.type === 'event').slice(0, 7).map(i => [mono(this.fmtDate(i.date)), esc(i.title) + (i.body ? '<div class="muted">' + esc(String(i.body).slice(0, 160)) + '</div>' : '')]))
        + '<h2>Who</h2>' + table(['Actor / subject', 'Notes', 'Status'], people.map(i => [esc(i.title), esc(String(i.body || '').split('\n')[0]), stamp(i)]))
        + (targets.length ? '<h2>Targets</h2>' + table(['Organisation', 'Sector', 'Region', 'Impact'], targets.map(i => [esc(i.title), esc(i.sector), esc(i.region), esc(i.impact)])) : '')
        + '<h2>By the numbers</h2><p>' + inds.length + ' indicators (' + inds.filter(i => i.status === 'confirmed').length + ' confirmed) · ' + ttps.length + ' ATT&amp;CK techniques · ' + cs.threads.length + ' threads · ' + cs.items.filter(i => i.pinned).length + ' exhibits</p>'
        + '<h2>Next actions</h2>' + table(['Task', 'Owner', 'Due'], tasks.filter(t => !t.done).map(t => [esc(t.text) + ' <span class="muted">(' + esc(this.itemLabel(t.item)) + ')</span>', esc(t.owner || '—'), mono(t.due || '—')]));
    } else {
      body = top + (cv ? '<img class="board" src="' + cv.toDataURL('image/jpeg', .85) + '">' : '')
        + '<h2>Summary</h2><pre>' + esc(cs.notes || '—') + '</pre>'
        + (hyps.length ? '<h2>Competing hypotheses</h2>' + table(['Evidence', ...hyps.map(hy => esc(hy.text))], cs.items.filter(i => i.pinned && i.status !== 'false').sort((a, b) => (a.num || 0) - (b.num || 0)).map(i => [label(i), ...hyps.map(hy => { const v = ach[i.id + '|' + hy.id] || ''; return '<div class="c ' + v + '">' + (v === 'C' ? 'consistent' : v === 'I' ? 'inconsistent' : v === 'N' ? 'neutral' : '·') + '</div>'; })])) + '<p class="muted">Inconsistencies: ' + hyps.map(hy => esc(hy.text) + ' = ' + cs.items.filter(i => i.pinned && ach[i.id + '|' + hy.id] === 'I').length).join(' · ') + '</p>' : '')
        + '<h2>Indicators</h2>' + table(['№', 'Type', 'Value', 'Status', 'Source', 'Seen', 'Context'], inds.map(i => [num('E', i.num), esc(K.KINDS[i.kind] || i.kind), mono(this.display(i, V)), stamp(i), src(i), mono([i.firstSeen, i.lastSeen].filter(Boolean).join(' → ')), esc([i.title, i.body].filter(Boolean).join(' — ')) + (i.tags ? ' ' + tags(i) : '')]))
        + (cs.items.some(i => i.type === 'tx') ? '<h2>Transfers</h2>' + table(['№', 'Chain', 'Amount', 'From', 'To', 'Tx hash', 'Date'], cs.items.filter(i => i.type === 'tx').map(i => [num('E', i.num), esc(i.chain), esc(i.amount), mono(i.txFrom), mono(i.txTo), mono(i.value), esc(this.fmtDate(i.date))])) : '')
        + '<h2>ATT&amp;CK techniques</h2>' + table(['ID', 'Technique', 'Tactic', 'Notes'], ttps.map(i => [mono(i.value), esc(i.title), esc(i.kind), esc(i.body)]))
        + '<h2>People &amp; personas</h2>' + table(['Name', 'Aliases / notes', 'Source', 'Status'], people.map(i => [esc(i.title), esc(i.body), src(i), stamp(i)]))
        + (targets.length ? '<h2>Targets</h2>' + table(['Organisation', 'Sector', 'Region', 'Impact', 'Notes'], targets.map(i => [esc(i.title), esc(i.sector), esc(i.region), esc(i.impact), esc(i.body)])) : '')
        + '<h2>Timeline</h2>' + table(['Date', 'Event', 'Type'], tl.map(i => [mono(this.fmtDate(i.date)), label(i), esc(K.TYPES[i.type].label)]))
        + '<h2>Threads</h2>' + table(['№', 'From', 'Relation', 'To', 'Confidence', 'Evidence'], cs.threads.map(t => [num('T', t.num), byId[t.from] ? label(byId[t.from]) : '—', esc((K.REL[t.rel] || K.REL.linked).label), byId[t.to] ? label(byId[t.to]) : '—', esc(t.conf || 'high'), esc(t.why || '')]))
        + ((cs.groups || []).length ? '<h2>Clusters</h2>' + table(['Cluster', 'Cards'], (cs.groups || []).map(g => [esc(g.title), this.groupMembers(g, cs.items).map(label).join(', ') || '<span class="muted">empty</span>'])) : '')
        + '<h2>Evidence</h2>' + table(['Type', 'Item', 'Status', 'Source', 'Custody'], rest.map(i => [esc(K.TYPES[i.type].label), label(i) + (i.tags ? ' ' + tags(i) : ''), stamp(i), src(i), i.fileHash ? mono(i.fileName + ' · sha256 ' + i.fileHash + ' · ' + i.addedBy + ' · ' + new Date(i.addedAt).toLocaleString()) : '']))
        + (tasks.length ? '<h2>Tasks</h2>' + table(['Task', 'Card', 'Owner', 'Due', 'Done'], tasks.map(t => [esc(t.text), esc(this.itemLabel(t.item)), esc(t.owner || '—'), mono(t.due || '—'), t.done ? 'yes' : 'open'])) : '')
        + ((cs.log || []).length ? '<h2>Case log</h2>' + table(['When', 'Entry'], (cs.log || []).slice(-60).reverse().map(l => [mono(new Date(l.t).toLocaleString()), esc(l.m)])) : '');
    }
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(cs.number + ' — ' + cs.title) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Mono&family=Archivo+Narrow:wght@400;600&display=swap"><style>' + css + '</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><div class="page">' + body + '</div></body></html>';
    if (ret) return html; const w = window.open('', '_blank'); if (!w) return this.toast('Allow pop-ups to open the brief');
    w.document.open(); w.document.write(html); w.document.close(); const fpr = this.fingerprint(cs, mode); this.upCase(c => ({ ...c, reports: [...(c.reports || []), fpr].slice(-40) })); this.logEvt((mode === 'exec' ? 'One-pager' : 'Case brief') + ' opened'); this.toast((mode === 'exec' ? 'One-pager' : 'Case brief') + ' opened in a new tab');
  };

  // ---------- derived helpers
  visuals() {
    const P = this.props, paper = P.paper ?? 'classic', pins = P.pins ?? 'red', thread = P.thread ?? 'taut', lighting = P.lighting ?? 'spotlight';
    const shadow = lighting === 'flat' ? '0 3px 6px rgba(0,0,0,.5)' : lighting === 'harsh' ? '12px 18px 20px rgba(0,0,0,.85), 2px 3px 4px rgba(0,0,0,.6)' : '0 8px 14px rgba(0,0,0,.65), 0 2px 3px rgba(0,0,0,.5)';
    return { paper, pins, thread, lighting, mood: P.mood ?? 'noir', rings: P.coffeeRings ?? true, staleDays: P.staleDays ?? 30, flutter: P.flutter ?? true, handwriting: P.handwriting ?? false, rain: P.rain ?? false, flow: P.threadFlow ?? true, numbers: P.numbers ?? true, defang: P.defang ?? true, labels: P.threadLabels ?? true, fiber: thread === 'yarn', width: thread === 'yarn' ? 3.4 : thread === 'slack' ? 1.9 : 1.7, shadow, shadowSel: shadow + ', 0 0 0 7px rgba(255,42,60,.16)' };
  }
  paperBg(type, paper) {
    const th = this.theme(); if (paper === 'classic' && th.bpaper) return type === 'note' ? (th.bnote || th.bpaper) : th.bpaper;
    if (paper === 'white') return '#f4f3ef';
    if (paper === 'aged') return type === 'note' ? '#e6d079' : '#e7ddc3';
    return type === 'note' ? '#f3e58c' : '#f3f1ea';
  }
  pinColors(type, pins) { const P = Component.K.PIN, th = this.theme(); return pins === 'brass' ? P.brass : pins === 'by type' ? (P[type] || P.red) : (th.pin || P.red); }
  pinGrad(type, pins) { const c = this.pinColors(type, pins); return 'radial-gradient(circle at 35% 30%, ' + c[0] + ' 0%, ' + c[1] + ' 45%, ' + c[2] + ' 100%)'; }
  fmtDate(d) { if (!d) return ''; const p = d.split('-'); if (p.length < 3) return d; return p[2] + ' ' + (Component.K.MONTHS[+p[1] - 1] || p[1]) + ' ' + p[0]; }
  tagList(t) { return String(t || '').split(',').map(s => s.trim()).filter(Boolean); }
  itemLabel(it) { if (it.type === 'tx') return it.title || [it.amount, it.chain].filter(Boolean).join(' · ') || 'Transfer'; if (it.type === 'ttp') return [it.value, it.title].filter(Boolean).join(' · ') || 'Technique'; return it.title || it.value || it.url || (it.body || '').slice(0, 40) || Component.K.TYPES[it.type].label; }
  matches(it, q) { return [it.title, it.body, it.url, it.value, it.tags, it.kind, it.status, it.chain, it.amount, it.txFrom, it.txTo, it.source, it.sector, it.region, it.impact, it.transcript, it.emFrom, it.emTo, it.feedUrl, it.feedQuery, it.narrative, it.role, it.f1, it.f2, it.f3, it.geoLabel, it.translation, Component.K.TYPES[it.type].label].join(' ').toLowerCase().includes(q); }
  curveVia(a, b, w) { const c = { x: 2 * w.x - (a.x + b.x) / 2, y: 2 * w.y - (a.y + b.y) / 2 }; let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (angle > 90) angle -= 180; if (angle < -90) angle += 180; return { d: 'M' + a.x + ' ' + a.y + ' Q' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y, c, mx: w.x, my: w.y, angle, len: Math.hypot(b.x - a.x, b.y - a.y) }; }
  upThread(id, patch) { this.upCase(c => ({ ...c, threads: c.threads.map(t => t.id === id ? { ...t, ...patch } : t) })); }
  wpDown(t) { return e => { e.stopPropagation(); e.preventDefault(); const move = ev => { const p = this.s2w(ev.clientX, ev.clientY); this.upThread(t.id, { wp: { x: Math.round(p.x), y: Math.round(p.y) } }); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }; }
  syncRels(cs) { const K = Component.K, base = K.RELS_BASE || (K.RELS_BASE = K.RELS.slice()); const custom = (cs.customRels || []).map(r => ({ ...r, custom: true })); K.RELS = base.concat(custom); K.REL = Object.fromEntries(K.RELS.map(r => [r.id, r])); }
  addCustomRel = () => { const label = window.prompt('Relation label (e.g. "paid", "drove", "called")'); if (!label) return; const pal = ['#ff7a45', '#2fc4b2', '#9b6bff', '#4ea1e8', '#e0c84a', '#ff4fa3', '#3fae63'], n = (this.cs().customRels || []).length, color = window.prompt('Colour (hex)', pal[n % pal.length]) || pal[n % pal.length]; const id = 'custom-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-'); this.upCase(c => ({ ...c, customRels: [...(c.customRels || []).filter(r => r.id !== id), { id, label, color, dash: '0' }] })); if (this.state.selThread) this.upThread(this.state.selThread, { rel: id }); this.setState({ rel: id }); this.logEvt('Custom relation added: ' + label); };
  threadMidPin = () => { const t = this.cs().threads.find(x => x.id === this.state.selThread); if (!t) return; if (t.wp) return this.upThread(t.id, { wp: null }); const byId = Object.fromEntries(this.cs().items.map(i => [i.id, i])), A = byId[t.from], B = byId[t.to]; if (!A || !B) return; const a = this.pin(A), c = this.pin(B); this.upThread(t.id, { wp: { x: Math.round((a.x + c.x) / 2), y: Math.round((a.y + c.y) / 2) - 40 } }); };
  threadAddNote = () => { const t = this.cs().threads.find(x => x.id === this.state.selThread); if (!t) return; const byId = Object.fromEntries(this.cs().items.map(i => [i.id, i])), A = byId[t.from], B = byId[t.to]; if (!A || !B) return; const a = this.pin(A), c = this.pin(B), m = t.wp || { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; const id = this.addItem('note', { body: t.note || t.why || '' }, true, { x: m.x - 90, y: m.y + 20 }); this.upCase(cs => ({ ...cs, threads: [...cs.threads, { id: Component.uid(), from: t.from, to: id, rel: t.rel, conf: 'high' }, { id: Component.uid(), from: id, to: t.to, rel: t.rel, conf: 'high' }].filter(x => x.id !== t.id) })); this.setState({ sel: id, selThread: null }); this.toast('Note pinned into the thread'); };
  fullscreen = () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); setTimeout(() => this.forceUpdate(), 300); };
  loadSettings() { try { return { splunk: 'https://splunk.example.com/en-US/app/search/search?q=search%20{q}', elastic: 'https://kibana.example.com/app/discover#/?_a=(query:(language:kuery,query:%27{q}%27))', sentinel: 'https://portal.azure.com/#view/Microsoft_Azure_Security_Insights/MainMenuBlade/~/7', qradar: 'https://qradar.example.com/console/qradar/jsp/QRadar.jsp?appName=QRadar&pageId=EventList&quickSearch={q}', radio: 'https://ice1.somafm.com/secretagent-128-mp3', vt: '', shodan: '', ...(JSON.parse(localStorage.getItem('cyber-investigation-board.settings.v1') || '{}')) }; } catch (e) { return {}; } }
  saveSettings(patch) { this.settings = { ...(this.settings || {}), ...patch }; try { localStorage.setItem('cyber-investigation-board.settings.v1', JSON.stringify(this.settings)); } catch (e) {} this.forceUpdate(); }
  siemLinks(v) { const S = this.settings || {}, q = encodeURIComponent(v); return [['Splunk', S.splunk], ['Elastic', S.elastic], ['Sentinel', S.sentinel], ['QRadar', S.qradar]].filter(x => x[1]).map(([label, tpl]) => ({ label, href: tpl.split('{q}').join(q) })); }
  rainSetup() {}
  // ---------- foley: synthesised paper, pin, drawer, stamp sounds (no files)
  sfx(kind) { if (!(this.props.sounds ?? true) || !window.CIBFoley) return; if (window.CIBFoley.enable) window.CIBFoley.enable(true); window.CIBFoley.play(kind); }
  typeSound = e => { if (!(this.props.typewriter ?? false)) return; const t = e.target; if (!t || !(t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') || !e.key || e.key.length !== 1) return; if (window.CIBFoley) return this.sfx('type'); try { const AC = window.AudioContext || window.webkitAudioContext; this.ac = this.ac || new AC(); const ac = this.ac, n = 1800, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 7); const o = ac.createBufferSource(); o.buffer = buf; const g = ac.createGain(); g.gain.value = .22; o.connect(g).connect(ac.destination); o.start(); } catch (err) {} };
  toggleRadio = () => { if (!this.radio) { this.radio = new Audio(); } if (this.state.radioOn) { this.radio.pause(); this.setState({ radioOn: false }); return; } this.radio.src = (this.settings && this.settings.radio) || 'https://ice1.somafm.com/secretagent-128-mp3'; this.radio.volume = .35; this.radio.play().then(() => this.setState({ radioOn: true })).catch(() => this.toast('Stream blocked; set another station in Settings')); };
  toggleWalk = async () => { if (this.walkRec) { this.walkRec.stop(); return; } try { const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); let mic = null; try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) {} const tracks = [...disp.getVideoTracks()], AC = window.AudioContext || window.webkitAudioContext; if (AC && (disp.getAudioTracks().length || mic)) { const ac = new AC(), dst = ac.createMediaStreamDestination(); if (disp.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(disp.getAudioTracks())).connect(dst); if (mic) ac.createMediaStreamSource(mic).connect(dst); tracks.push(...dst.stream.getAudioTracks()); } const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' }), chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.onstop = () => { disp.getTracks().forEach(t => t.stop()); if (mic) mic.getTracks().forEach(t => t.stop()); this.walkRec = null; this.setState({ walkOn: false }); this.dlBlob(new Blob(chunks, { type: 'video/webm' }), (this.cs().number || 'case').replace(/\s+/g, '-') + '-walkthrough.webm'); this.logEvt('Walkthrough recorded'); }; disp.getVideoTracks()[0].onended = () => { if (this.walkRec) this.walkRec.stop(); }; rec.start(1000); this.walkRec = rec; this.setState({ walkOn: true }); this.toast('Recording — press Stop when done'); } catch (e) { this.toast('Screen capture cancelled'); } };
  dlBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  crc32(u8) { const T = this._crcT || (this._crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })()); let crc = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) crc = T[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
  zip(files) { const enc = new TextEncoder(), parts = [], central = []; let off = 0; const le16 = n => [n & 255, (n >> 8) & 255], le32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; files.forEach(f => { const name = enc.encode(f.name), crc = this.crc32(f.data), sz = f.data.length, hdr = new Uint8Array([0x50, 0x4b, 3, 4, ...le16(20), ...le16(0x800), ...le16(0), ...le16(0), ...le16(0x21), ...le32(crc), ...le32(sz), ...le32(sz), ...le16(name.length), ...le16(0)]); parts.push(hdr, name, f.data); central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...le16(20), ...le16(20), ...le16(0x800), ...le16(0), ...le16(0), ...le16(0x21), ...le32(crc), ...le32(sz), ...le32(sz), ...le16(name.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(off)]), name); off += hdr.length + name.length + sz; }); const cd = central.reduce((s, x) => s + x.length, 0); return new Blob([...parts, ...central, new Uint8Array([0x50, 0x4b, 5, 6, ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length), ...le32(cd), ...le32(off), ...le16(0)])], { type: 'application/zip' }); }
  exportPack = async () => { const cs = this.cs(), enc = new TextEncoder(), files = [], sha = async u8 => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8))).map(x => x.toString(16).padStart(2, '0')).join(''); this.toast('Building the pack…'); files.push({ name: 'case.json', data: enc.encode(JSON.stringify({ format: 'cyber-investigation-board', version: 1, cases: [cs] }, null, 2)) }); try { const html = await this.openBrief('full', true); if (html) files.push({ name: 'brief.html', data: enc.encode(html) }); } catch (e) {} try { const cv = await this.renderBoard(); if (cv && cv.toBlob) { const bl = await new Promise(r => cv.toBlob(r, 'image/jpeg', .9)); files.push({ name: 'board.jpg', data: new Uint8Array(await bl.arrayBuffer()) }); } } catch (e) {} for (const it of cs.items) { try { const pre = 'media/' + (it.num ? 'E' + String(it.num).padStart(2, '0') + '-' : ''); if (it.image && /^data:/.test(it.image)) { const bl = await (await fetch(it.image)).blob(); files.push({ name: pre + (it.fileName || it.id + '.png').replace(/[^\w.-]+/g, '_'), data: new Uint8Array(await bl.arrayBuffer()) }); } else if (it.media) { const bl = await this.getBlob(it.id); if (bl) files.push({ name: pre + (it.mediaName || it.id).replace(/[^\w.-]+/g, '_'), data: new Uint8Array(await bl.arrayBuffer()) }); } } catch (e) {} } const lines = ['HAND-OVER PACK · ' + cs.number + ' — ' + cs.title, 'Generated ' + new Date().toISOString() + ' by ' + ((this.state.analyst || '').trim() || 'unknown analyst'), '']; for (const f of files) lines.push(await sha(f.data) + '  ' + f.name); files.push({ name: 'MANIFEST.txt', data: enc.encode(lines.join('\n')) }); this.dlBlob(this.zip(files), (cs.number || 'case').replace(/\s+/g, '-') + '-handover.zip'); this.logEvt('Hand-over pack exported (' + files.length + ' files)'); };
  exportCourt = () => this.openBrief('court');
  async claudeJson(system, prompt, max) { if (!window.claude || !window.claude.complete) throw new Error('Claude tools run inside the Claude app preview'); const text = await window.claude.complete({ system, messages: [{ role: 'user', content: prompt }], max_tokens: max || 900 }); const a = text.indexOf('{'), c = text.lastIndexOf('}'); if (a < 0 || c < 0) throw new Error('No JSON in the reply'); return JSON.parse(text.slice(a, c + 1)); }
  itemText(it) { return [it.title, it.body, it.transcript, it.value, it.url].filter(Boolean).join('\n'); }
  aiTranslate = async () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; try { this.toast('Translating…'); const r = await this.claudeJson('You translate evidence for an investigator. Reply with JSON only.', 'Detect the language of this text and translate it to English faithfully. Return {"lang": "<language name>", "translation": "<english>"}\n\nTEXT:\n' + this.itemText(it).slice(0, 4000), 1200); this.upItem(it.id, { lang: r.lang || '?', translation: r.translation || '' }); this.logEvt('Translated ' + this.itemLabel(it) + ' from ' + (r.lang || '?')); } catch (e) { this.toast(String(e.message || e)); } };
  aiStance = async () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; try { this.toast('Reading stance…'); const r = await this.claudeJson('You analyse posts for a disinformation / crime investigator. Reply with JSON only.', 'For this text give {"sentiment": "positive|negative|neutral|mixed", "stance": "support|oppose|neutral|unclear", "narrative": "<=8 words naming the claim or narrative it pushes", "note": "<=40 words why"}\n\nTEXT:\n' + this.itemText(it).slice(0, 3000)); this.upItem(it.id, { stance: r.stance || 'unclear', narrative: r.narrative || '', body: (it.body || '') + (r.note ? '\n\n[stance: ' + r.sentiment + ' · ' + r.note + ']' : '') }); } catch (e) { this.toast(String(e.message || e)); } };
  aiEntities = async () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; const text = this.itemText(it).slice(0, 6000); let ents = []; try { this.toast('Extracting entities…'); const r = await this.claudeJson('You extract entities for an investigator. Reply with JSON only.', 'From the text list entities as {"entities": [{"type": "person|org|place|money|date|vehicle|object|phone|email", "name": "...", "note": "<=12 words context"}]} (max 25, no duplicates).\n\nTEXT:\n' + text, 1500); ents = r.entities || []; } catch (e) { ents = (text.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []).map(x => ({ type: 'email', name: x })).concat((text.match(/\+?\d[\d\s().-]{7,}\d/g) || []).map(x => ({ type: 'phone', name: x.trim() })), (text.match(/[$€£]\s?\d[\d,.]*(?:\s?(?:k|m|bn|million|billion))?/gi) || []).map(x => ({ type: 'money', name: x })), (text.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || []).map(x => ({ type: 'date', name: x }))); if (!ents.length) return this.toast('Nothing found (Claude tools need the Claude app preview)'); } const seen = new Set(this.cs().items.map(i => (i.title || i.value || '').toLowerCase())); let n = 0; ents.forEach(e => { const nm = String(e.name || '').trim(); if (!nm || seen.has(nm.toLowerCase())) return; seen.add(nm.toLowerCase()); const src = 'Entity from ' + this.itemLabel(it), map = { person: ['person', { title: nm }], org: ['target', { title: nm }], place: ['location', { title: nm }], vehicle: ['vehicle', { title: nm }], object: ['object', { title: nm }], money: ['tx', { title: nm, amount: nm }], date: ['event', { title: e.note || 'Mentioned date', date: /^\d{4}-\d{2}-\d{2}$/.test(nm) ? nm : '' }], phone: ['indicator', { kind: 'phone', value: nm }], email: ['indicator', { kind: 'email', value: nm.toLowerCase() }] }; const m = map[e.type] || ['note', { body: nm }]; this.addItem(m[0], { ...m[1], body: m[1].body || e.note || '', source: src, collected: this.today() }, false); n++; }); this.toast(n + ' entity cards in the inbox'); this.logEvt('Entities extracted from ' + this.itemLabel(it) + ': ' + n); };
  copySlack = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it) return; const K = Component.K, cs = this.cs(), txt = '*' + cs.number + ' · ' + this.itemLabel(it) + '* (' + K.TYPES[it.type].label + (it.status ? ' · ' + (K.STAMP_LABEL[it.status] || it.status) : '') + ')\n' + [it.value ? '`' + this.defang(it.value, it.kind) + '`' : '', it.body, it.url, it.source ? '_Source: ' + it.source + '_' : ''].filter(Boolean).join('\n'); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => this.toast('Copied as Slack / Teams markdown')); };
  upCaseIn(cid, fn) { this.setState(s => ({ cases: s.cases.map(c => c.id === cid ? fn(c) : c) })); }
  notifList() { const s = this.state, me = (s.analyst || '').trim().toLowerCase(), seen = s.notifSeen || '', out = [], today = this.today(); (s.events || []).forEach(ev => out.push({ t: ev.t, kind: ev.kind, text: ev.text, caseId: ev.caseId, itemId: ev.itemId })); s.cases.forEach(c => { c.items.forEach(i => { (i.comments || []).forEach(cm => { const m = String(cm.text || '').match(/@([\w.-]+)/g) || []; if (me && m.some(x => x.slice(1).toLowerCase() === me.split(/\s+/)[0]) && String(cm.by || '').toLowerCase() !== me) out.push({ t: cm.at, kind: 'mention', text: cm.by + ' mentioned you on ' + this.itemLabel(i) + ': ' + cm.text.slice(0, 80), caseId: c.id, itemId: i.id }); }); (i.todo || []).forEach(t => { if (!t.done && t.due && t.due < today) out.push({ t: t.due + 'T23:59:00.000Z', kind: 'overdue', text: 'Overdue: ' + t.text, caseId: c.id, itemId: i.id }); }); }); if ((c.review || '') === 'in review') out.push({ t: (c.log || []).length ? c.log[c.log.length - 1].t : '', kind: 'review', text: c.number + ' is waiting for review', caseId: c.id }); }); return out.sort((a, c) => (c.t || '').localeCompare(a.t || '')).slice(0, 60).map(n => ({ ...n, unread: (n.t || '') > seen })); }
  openNotifs = () => { this.sfx('paper'); this.setState({ notifOpen: true }); }; closeNotifs = () => { this.sfx('close'); this.setState({ notifOpen: false }); };
  markNotifsRead = () => this.setState({ notifSeen: new Date().toISOString() });
  digestMail = () => { const list = this.notifList().slice(0, 25), body = 'Daily digest · ' + this.today() + '\n\n' + list.map(n => '- ' + (n.t ? this.fmtWhen(n.t) + ' ' : '') + n.text).join('\n'); location.href = 'mailto:?subject=' + encodeURIComponent('Investigation digest ' + this.today()) + '&body=' + encodeURIComponent(body.slice(0, 1800)); };
  openTasks = () => { this.sfx('drawer'); this.setState({ tasksOpen: true }); }; closeTasks = () => { this.sfx('close'); this.setState({ tasksOpen: false }); };
  allTasks() { const out = []; this.state.cases.forEach(c => c.items.forEach(i => (i.todo || []).forEach(t => out.push({ ...t, caseId: c.id, caseNo: c.number, itemId: i.id, itemLabel: this.itemLabel(i) })))); return out; }
  toggleTaskIn(cid, iid, tid) { this.upCaseIn(cid, c => ({ ...c, items: c.items.map(i => i.id === iid ? { ...i, todo: (i.todo || []).map(t => t.id === tid ? { ...t, done: !t.done } : t) } : i) })); }
  jumpTo(cid, iid) { this.setState({ activeId: cid, notifOpen: false, tasksOpen: false, mmoOpen: false, sel: iid || null, tab: 'inspector', showRight: true }); setTimeout(() => { if (iid) this.focusItem(iid); }, 120); }
  openDiff = () => { this.sfx('drawer'); this.setState({ diffOpen: true }); }; closeDiff = () => { this.sfx('close'); this.setState({ diffOpen: false }); };
  diffText(a, c) { const A = String(a || '').split('\n').slice(0, 300), B = String(c || '').split('\n').slice(0, 300), n = A.length, m = B.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); const rows = []; let i = 0, j = 0; while (i < n || j < m) { if (i < n && j < m && A[i] === B[j]) { rows.push({ a: A[i], b: B[j], bgA: 'transparent', bgB: 'transparent' }); i++; j++; } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { rows.push({ a: '', b: B[j], bgA: 'transparent', bgB: 'rgba(63,174,99,.22)' }); j++; } else { rows.push({ a: A[i], b: '', bgA: 'rgba(255,42,60,.22)', bgB: 'transparent' }); i++; } } return rows; }
  openAnnotate = () => { const it = this.cs().items.find(i => i.id === this.state.sel); if (!it || !it.image) return; const img = new Image(); img.onload = () => { this.ann = { img, shapes: [], cur: null, id: it.id }; this.setState({ annOpen: true, annTool: 'box' }); }; img.src = it.image; };
  closeAnn = () => { this.ann = null; this.setState({ annOpen: false }); };
  annSync() { const cv = document.querySelector('[data-ann]'); if (!cv || !this.ann) return; const A = this.ann; if (A.canvas !== cv) { A.canvas = cv; cv.width = A.img.naturalWidth; cv.height = A.img.naturalHeight; } this.annDraw(); }
  annDraw() { const A = this.ann; if (!A || !A.canvas) return; const cv = A.canvas, ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(A.img, 0, 0); const all = A.cur ? A.shapes.concat([A.cur]) : A.shapes; all.forEach(sh => { const x = Math.min(sh.x1, sh.x2), y = Math.min(sh.y1, sh.y2), w = Math.abs(sh.x2 - sh.x1), h = Math.abs(sh.y2 - sh.y1); if (sh.tool === 'blur' && w > 2 && h > 2) { const px = Math.max(8, Math.round(Math.max(w, h) / 12)), tmp = document.createElement('canvas'); tmp.width = Math.max(1, Math.round(w / px)); tmp.height = Math.max(1, Math.round(h / px)); tmp.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, tmp.width, tmp.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h); ctx.imageSmoothingEnabled = true; } else if (sh.tool === 'crop') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(x, y, w, h); ctx.fill('evenodd'); ctx.restore(); ctx.strokeStyle = '#fff'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); } else { ctx.strokeStyle = '#ff2a3c'; ctx.lineWidth = Math.max(2, cv.width / 300); ctx.lineCap = 'round'; if (sh.tool === 'arrow') { ctx.beginPath(); ctx.moveTo(sh.x1, sh.y1); ctx.lineTo(sh.x2, sh.y2); ctx.stroke(); const ang = Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1), L = Math.max(12, cv.width / 50); ctx.beginPath(); ctx.moveTo(sh.x2, sh.y2); ctx.lineTo(sh.x2 - L * Math.cos(ang - .4), sh.y2 - L * Math.sin(ang - .4)); ctx.moveTo(sh.x2, sh.y2); ctx.lineTo(sh.x2 - L * Math.cos(ang + .4), sh.y2 - L * Math.sin(ang + .4)); ctx.stroke(); } else ctx.strokeRect(x, y, w, h); } }); }
  annPt(e) { const cv = this.ann.canvas, r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  annDown = e => { if (!this.ann) return; e.stopPropagation(); const p = this.annPt(e); this.ann.cur = { tool: this.state.annTool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  annMove = e => { if (!this.ann || !this.ann.cur) return; const p = this.annPt(e); this.ann.cur.x2 = p.x; this.ann.cur.y2 = p.y; this.annDraw(); };
  annUp = () => { const A = this.ann; if (!A || !A.cur) return; const sh = A.cur; A.cur = null; if (Math.abs(sh.x2 - sh.x1) > 3 || Math.abs(sh.y2 - sh.y1) > 3) { if (sh.tool === 'crop') A.shapes = A.shapes.filter(x => x.tool !== 'crop'); A.shapes.push(sh); } this.annDraw(); };
  annUndo = () => { if (this.ann) { this.ann.shapes.pop(); this.annDraw(); } };
  annSave = () => { const A = this.ann; if (!A) return; const crop = A.shapes.find(x => x.tool === 'crop'); A.shapes = A.shapes.filter(x => x.tool !== 'crop'); this.annDraw(); let out = A.canvas; if (crop) { const x = Math.min(crop.x1, crop.x2), y = Math.min(crop.y1, crop.y2), w = Math.abs(crop.x2 - crop.x1), h = Math.abs(crop.y2 - crop.y1), c2 = document.createElement('canvas'); c2.width = w; c2.height = h; c2.getContext('2d').drawImage(A.canvas, x, y, w, h, 0, 0, w, h); out = c2; } const it = this.cs().items.find(i => i.id === A.id), src = out.toDataURL('image/jpeg', .92); this.upItem(A.id, { image: src, imagePrev: it ? (it.imagePrev || it.image) : null, addedAt: new Date().toISOString(), addedBy: (this.state.analyst || '').trim() || 'unknown analyst', fileName: ((it && it.fileName) || 'image') + ' (annotated)' }); this.logEvt('Image annotated' + (crop ? ' and cropped' : '') + ': ' + (it ? this.itemLabel(it) : '')); this.closeAnn(); this.toast('Saved as a new version; the original stays in the record'); };
  openMmo = () => { this.sfx('drawer'); this.setState({ mmoOpen: true }); }; closeMmo = () => { this.sfx('close'); this.setState({ mmoOpen: false }); };
  alibiCheck(p, cs) { const linked = new Set([p.id]); cs.threads.forEach(t => { if (t.from === p.id) linked.add(t.to); if (t.to === p.id) linked.add(t.from); }); const ev = cs.items.filter(i => linked.has(i.id) && i.date && i.time).map(i => ({ i, t: new Date(i.date + 'T' + i.time).getTime(), g: this.geoOf(i) })).sort((a, c) => a.t - c.t); const conflicts = []; for (let k = 1; k < ev.length; k++) { const a = ev[k - 1], c = ev[k], mins = (c.t - a.t) / 60000; if (mins < 60 && (!a.g || !c.g || Math.hypot(a.g[0] - c.g[0], (a.g[1] - c.g[1]) * Math.cos(a.g[0] * Math.PI / 180)) * 111 > 3)) conflicts.push(this.itemLabel(a.i) + ' → ' + this.itemLabel(c.i) + ' in ' + Math.round(mins) + ' min'); } return { n: ev.length, conflicts }; }
  static MODES = {
    investigation: { label: 'Investigation', roles: [], rels: [], labels: {}, starter: [], prompt: 'Working theory, leads, to-dos…' },
    homicide: { label: 'Homicide', labels: { person: 'Person', location: 'Scene', object: 'Physical evidence', statement: 'Statement', event: 'Timeline entry', doc: 'Report', indicator: 'Trace / data' }, roles: ['victim', 'suspect', 'witness', 'person of interest', 'next of kin', 'first responder', 'pathologist', 'investigating officer'], rels: [['last-seen-with', '#e8a71c'], ['threatened', '#ff2a3c'], ['alibi-for', '#3fae63'], ['owned', '#4ea1e8'], ['present-at', '#9b6bff'], ['benefits-from-death', '#ff7a45']], starter: [['person', { title: 'Victim', role: 'victim' }], ['location', { title: 'Primary scene', body: 'Secured? Entry/exit, forced? CCTV coverage?' }], ['event', { title: 'Last seen alive' }], ['event', { title: 'Body found' }], ['object', { title: 'Weapon / cause-of-death item', f2: 'scene' }], ['doc', { title: 'Post-mortem report', body: 'Time of death window, cause, manner' }], ['statement', { title: 'First witness statement' }], ['person', { title: 'Suspect 1', role: 'suspect' }], ['note', { body: 'Victimology: routine, relationships, threats, money' }], ['note', { body: 'Timeline gap: last seen → found. Phone, cards, transport, CCTV' }]], prompt: 'Victimology, time-of-death window, scene, suspects (means · motive · opportunity), alibis, forensic results, next actions…' },
    heist: { label: 'Heist / robbery', labels: { person: 'Person', location: 'Scene / route', object: 'Property / tool', vehicle: 'Vehicle', event: 'Timeline entry', tx: 'Proceeds / transfer', indicator: 'Trace / data' }, roles: ['victim', 'suspect', 'witness', 'insider', 'fence / receiver', 'getaway driver', 'security staff', 'investigating officer'], rels: [['cased', '#e8a71c'], ['drove', '#4ea1e8'], ['fenced-to', '#ff7a45'], ['tipped-off', '#ff2a3c'], ['shared-proceeds', '#2fc4b2'], ['alibi-for', '#3fae63']], starter: [['location', { title: 'Target premises', body: 'Entry method, alarm, cameras, keys' }], ['event', { title: 'Offence window' }], ['object', { title: 'Property taken', body: 'Serials, value, traceability' }], ['vehicle', { title: 'Getaway vehicle' }], ['person', { title: 'Insider?', role: 'person of interest' }], ['statement', { title: 'Security / staff statement' }], ['tx', { title: 'Proceeds movement' }], ['note', { body: 'Reconnaissance: who visited / asked about the site beforehand?' }], ['note', { body: 'Disposal: pawn, marketplaces, crypto, fences' }]], prompt: 'How it was done, who knew, vehicles and routes, disposal of proceeds, suspects, alibis…' },
    missing: { label: 'Missing person', labels: { person: 'Person', location: 'Sighting / place', event: 'Timeline entry', indicator: 'Trace / data', object: 'Belonging' }, roles: ['missing person', 'family', 'last contact', 'witness', 'person of interest', 'search coordinator'], rels: [['last-contact', '#e8a71c'], ['sighted-at', '#3fae63'], ['travelled-with', '#4ea1e8'], ['conflict-with', '#ff2a3c']], starter: [['person', { title: 'Missing person', role: 'victim' }], ['event', { title: 'Last confirmed contact' }], ['location', { title: 'Last known location' }], ['object', { title: 'Phone / bank card / passport', body: 'Taken or left behind?' }], ['note', { body: 'Risk assessment: age, health, history, threats' }], ['note', { body: 'Digital footprint: last device activity, social accounts, transport cards' }]], prompt: 'Risk level, timeline since last contact, search areas, lines of enquiry…' },
    kyc: { label: 'Due diligence / KYC', labels: { target: 'Counterparty', indicator: 'Red flag', person: 'Principal / UBO', doc: 'Filing' }, roles: ['beneficial owner', 'director', 'nominee', 'PEP', 'sanctioned party'], rels: [['owns', '#e8a71c'], ['controls', '#ff7a45'], ['directs', '#4ea1e8'], ['sanctioned-with', '#ff2a3c']], starter: [['target', { title: 'Counterparty under review' }], ['doc', { title: 'Corporate registry extract', body: 'Registration, officers, filings' }], ['doc', { title: 'Sanctions & PEP screening', body: 'OFAC, UK, EU, UN; adverse media' }], ['doc', { title: 'Ownership chart', body: 'Trace to natural persons ≥25%' }], ['note', { body: 'Source of funds / wealth?' }]], prompt: 'Scope, risk rating, red flags, ownership chain, decision…' },
    aml: { label: 'Fraud & AML', labels: { tx: 'Transaction', target: 'Account / entity', indicator: 'Typology flag' }, roles: ['account holder', 'mule', 'beneficiary', 'originator', 'reporting officer'], rels: [['paid', '#2fc4b2'], ['layered-through', '#9b6bff'], ['same-device', '#e8a71c'], ['structured-with', '#ff2a3c']], starter: [['tx', { title: 'First suspicious transaction' }], ['note', { body: 'Typology: structuring / layering / mule / invoice fraud?' }], ['doc', { title: 'Transaction export', body: 'Period, accounts, counterparties' }], ['event', { title: 'Alert raised', date: new Date().toISOString().slice(0, 10) }]], prompt: 'Typology, flow of funds, SAR/STR decision, exposure…' },
    journalism: { label: 'Journalism', labels: { indicator: 'Lead', doc: 'Document', target: 'Organisation', statement: 'Interview' }, roles: ['source', 'subject', 'spokesperson', 'whistleblower', 'expert'], rels: [['told', '#4ea1e8'], ['denies', '#ff2a3c'], ['corroborates', '#3fae63'], ['contradicts', '#e8a71c'], ['funded', '#9b6bff']], starter: [['note', { body: 'The story in one sentence' }], ['statement', { title: 'Interview 1', f3: 'on record / background / off record' }], ['doc', { title: 'Key document', body: 'Where obtained, how verified' }], ['note', { body: 'Right of reply sent? Date?' }]], prompt: 'Angle, what is proven vs alleged, sources, right of reply, legal review…' },
    litigation: { label: 'Litigation case map', labels: { event: 'Fact', doc: 'Exhibit', statement: 'Witness statement', person: 'Party / witness', ttp: 'Legal issue' }, roles: ['claimant', 'defendant', 'witness', 'expert', 'counsel'], rels: [['proves', '#3fae63'], ['rebuts', '#ff2a3c'], ['relies-on', '#4ea1e8'], ['breached', '#e8a71c']], starter: [['note', { body: 'Causes of action / charges' }], ['event', { title: 'Key fact 1' }], ['statement', { title: 'Witness statement' }], ['doc', { title: 'Exhibit A' }], ['note', { body: 'Limitation / deadlines' }]], prompt: 'Elements to prove, evidence for each, weaknesses, deadlines…' },
    ma: { label: 'M&A target research', labels: { target: 'Target company', person: 'Executive / owner', indicator: 'Risk item', tx: 'Deal / round' }, roles: ['CEO', 'founder', 'investor', 'board', 'advisor'], rels: [['owns', '#e8a71c'], ['invested-in', '#2fc4b2'], ['customer-of', '#4ea1e8'], ['competes-with', '#ff7a45'], ['litigating', '#ff2a3c']], starter: [['target', { title: 'Target company' }], ['note', { body: 'Thesis: why buy, at what price' }], ['doc', { title: 'Financials', body: 'Revenue, margin, churn, debt' }], ['person', { title: 'Founder / CEO' }], ['note', { body: 'Red flags: litigation, key-person, concentration' }]], prompt: 'Thesis, valuation, synergies, risks, integration…' },
    ci: { label: 'Competitive intelligence', labels: { target: 'Competitor', person: 'Key person', indicator: 'Signal', event: 'Move' }, roles: ['executive', 'product lead', 'sales lead', 'partner', 'former employee'], rels: [['partnered', '#2fc4b2'], ['hired-from', '#e8a71c'], ['launched', '#4ea1e8'], ['lost-deal-to', '#ff2a3c']], starter: [['target', { title: 'Competitor A' }], ['feed', { title: 'Competitor news', feedKind: 'rss' }], ['monitor', { title: 'Pricing page watch' }], ['event', { title: 'Product launch' }], ['note', { body: 'What would change our roadmap?' }]], prompt: 'Who, what moved, why it matters, our response…' },
    supply: { label: 'Supply-chain risk', labels: { target: 'Supplier', location: 'Site / port', indicator: 'Risk signal', tx: 'Order / shipment' }, roles: ['supplier contact', 'auditor', 'logistics', 'regulator'], rels: [['supplies', '#2fc4b2'], ['sub-contracts', '#9b6bff'], ['ships-via', '#4ea1e8'], ['single-source', '#ff2a3c'], ['audited-by', '#3fae63']], starter: [['target', { title: 'Tier-1 supplier' }], ['target', { title: 'Tier-2 supplier' }], ['location', { title: 'Factory / port' }], ['note', { body: 'Single points of failure?' }], ['feed', { title: 'Sanctions & disruption news', feedKind: 'rss' }]], prompt: 'Tiers, concentration, geopolitical / ESG / sanctions exposure, mitigations…' },
    hr: { label: 'HR / insider investigation', labels: { person: 'Employee', indicator: 'Access / artefact', doc: 'Policy / record', statement: 'Interview' }, roles: ['subject', 'complainant', 'witness', 'manager', 'HR', 'legal'], rels: [['reports-to', '#4ea1e8'], ['accessed', '#e8a71c'], ['exfiltrated-to', '#ff2a3c'], ['interviewed-by', '#3fae63']], starter: [['person', { title: 'Subject', role: 'suspect' }], ['statement', { title: 'Complaint / allegation' }], ['doc', { title: 'Policy relied on' }], ['event', { title: 'Access anomaly' }], ['note', { body: 'Fairness: subject informed? representation? data minimisation' }]], prompt: 'Allegation, scope, evidence, interviews, finding, outcome…' },
    genealogy: { label: 'Genealogy', labels: { person: 'Ancestor', doc: 'Record', event: 'Life event', location: 'Place' }, roles: ['direct ancestor', 'spouse', 'sibling', 'in-law', 'unverified'], rels: [['parent-of', '#e8a71c'], ['married', '#ff4fa3'], ['sibling-of', '#4ea1e8'], ['lived-at', '#3fae63'], ['same-person?', '#9b6bff']], starter: [['person', { title: 'You' }], ['person', { title: 'Parent' }], ['doc', { title: 'Birth / marriage / death record' }], ['event', { title: 'Emigration' }], ['location', { title: 'Family home' }]], prompt: 'Brick walls, record sources, name variants, DNA matches…' },
    plot: { label: 'Plot board (writers)', labels: { person: 'Character', event: 'Scene', location: 'Setting', object: 'MacGuffin / prop', note: 'Beat', doc: 'Chapter' }, roles: ['protagonist', 'antagonist', 'ally', 'mentor', 'foil', 'red herring'], rels: [['loves', '#ff4fa3'], ['betrays', '#ff2a3c'], ['secretly', '#9b6bff'], ['foreshadows', '#e8a71c'], ['pays-off', '#3fae63']], starter: [['person', { title: 'Protagonist' }], ['person', { title: 'Antagonist' }], ['event', { title: 'Inciting incident' }], ['event', { title: 'Midpoint' }], ['event', { title: 'Climax' }], ['object', { title: 'The thing everyone wants' }]], prompt: 'Premise, theme, acts, what each character wants / fears…' },
    ux: { label: 'UX research synthesis', labels: { person: 'Participant', statement: 'Quote', note: 'Insight', event: 'Session', doc: 'Artefact', ttp: 'Theme' }, roles: ['participant', 'stakeholder', 'researcher', 'expert user', 'novice'], rels: [['evidence-for', '#3fae63'], ['contradicts', '#ff2a3c'], ['leads-to', '#4ea1e8'], ['same-theme', '#9b6bff']], starter: [['note', { body: 'Research question' }], ['person', { title: 'P1' }], ['statement', { title: 'Quote', f1: 'P1' }], ['note', { body: 'Insight 1' }], ['note', { body: 'Opportunity / how might we' }]], prompt: 'Questions, themes, insights, opportunities, confidence…' },
    postmortem: { label: 'Incident post-mortem', labels: { event: 'Timeline entry', indicator: 'Signal / alert', ttp: 'Contributing factor', person: 'Responder', doc: 'Runbook / log' }, roles: ['incident commander', 'responder', 'on-call', 'customer', 'vendor'], rels: [['caused', '#ff2a3c'], ['delayed', '#e8a71c'], ['detected-by', '#3fae63'], ['mitigated-by', '#4ea1e8']], starter: [['event', { title: 'First impact' }], ['event', { title: 'Detected' }], ['event', { title: 'Mitigated' }], ['event', { title: 'Resolved' }], ['note', { body: 'Contributing factors (blameless)' }], ['note', { body: 'Action items with owners' }]], prompt: 'Impact, timeline, root causes, what went well, action items…' },
    sales: { label: 'Sales account map', labels: { target: 'Account', person: 'Stakeholder', event: 'Meeting', indicator: 'Buying signal', tx: 'Deal' }, roles: ['economic buyer', 'champion', 'influencer', 'blocker', 'user', 'procurement'], rels: [['reports-to', '#4ea1e8'], ['influences', '#e8a71c'], ['champions', '#3fae63'], ['blocks', '#ff2a3c'], ['introduced', '#2fc4b2']], starter: [['target', { title: 'Account' }], ['person', { title: 'Economic buyer' }], ['person', { title: 'Champion' }], ['event', { title: 'Discovery call' }], ['tx', { title: 'Opportunity', amount: '' }], ['note', { body: 'Pain, metrics, decision process, paper process' }]], prompt: 'Who decides, who influences, where we are strong / weak, next step…' },
  };
  syncMode(cs) { const K = Component.K, base = K.TYPE_LABELS || (K.TYPE_LABELS = Object.fromEntries(Object.keys(K.TYPES).map(t => [t, K.TYPES[t].label]))), M = Component.MODES[cs.domain || 'investigation'] || Component.MODES.investigation; Object.keys(K.TYPES).forEach(t => { K.TYPES[t].label = (M.labels || {})[t] || base[t]; }); }
  exampleHomicide() {
    const W = n => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + n;
    const c = { id: Component.uid(), v: 3, number: 'CASE 1888', title: 'Whitechapel murders, autumn 1888', domain: 'homicide', notes: 'Worked example on the public record (Metropolitan Police file MEPO 3/140, inquest reports, Macnaghten memorandum 1894). Five canonical victims between 31 Aug and 9 Nov 1888 inside roughly one square mile of Whitechapel and Spitalfields. No conviction was ever obtained.\n\nWorking questions\n- Local knowledge: every scene is within minutes of the common lodging houses of Flower and Dean St / Dorset St.\n- The double event of 30 Sep: Stride (c. 01:00, Berner St) and Eddowes (c. 01:45, Mitre Square) are ~0.8 km apart — interrupted at the first scene?\n- Anatomical skill: the Eddowes and Chapman post-mortems disagree on it.\n- Letters: Dear Boss and From Hell are probably hoaxes (press origin suspected for Dear Boss); treat as unverified.', items: [], threads: [], groups: [], dismissed: [], review: 'draft', tlp: 'clear', judgement: { text: 'We assess that the five canonical murders were committed by one local offender with knowledge of the Spitalfields rookery; no named suspect reaches the evidential standard.', confidence: 'moderate', dissent: 'Stride may not be part of the series (no mutilation, interrupted attack); some authors separate Kelly.' }, customRels: Component.MODES.homicide.rels.map(([label, color]) => ({ id: 'custom-' + label.replace(/[^a-z0-9]+/gi, '-'), label, color, dash: '0', auto: true })), seededModes: ['homicide'], log: [{ t: new Date().toISOString(), m: 'Example case created from public-record sources (Wikipedia / Wikimedia Commons, public domain images)' }] };
    this.setState(s => ({ cases: [...s.cases, c], activeId: c.id, sel: null, selThread: null }), () => {
      const src = 'Public record · Wikipedia / MEPO 3/140', A = (type, extra, x, y) => this.addItem(type, { source: src, collected: this.today(), status: type === 'indicator' ? 'confirmed' : extra.status || '', ...extra }, true, { x, y });
      const vN = A('person', { title: 'Mary Ann Nichols', role: 'victim', body: 'b. 1845. Found 03:40, Buck\'s Row. Lodged Thrawl St / Flower and Dean St.', date: '1888-08-31', time: '03:40', status: 'confirmed' }, 80, 80);
      const vC = A('person', { title: 'Annie Chapman', role: 'victim', body: 'b. 1841. Found c. 06:00, back yard of 29 Hanbury St. Last seen 05:30 by Elizabeth Long.', date: '1888-09-08', time: '06:00', status: 'confirmed' }, 80, 330);
      const vS = A('person', { title: 'Elizabeth Stride', role: 'victim', body: 'b. 1843, Sweden. Found c. 01:00, Dutfield\'s Yard, Berner St. Throat cut, no mutilation.', date: '1888-09-30', time: '01:00', status: 'confirmed' }, 80, 580);
      const vE = A('person', { title: 'Catherine Eddowes', role: 'victim', body: 'b. 1842. Found 01:45, Mitre Square, City of London. Released from Bishopsgate police station 01:00.', date: '1888-09-30', time: '01:45', status: 'confirmed' }, 80, 830);
      const vK = A('person', { title: 'Mary Jane Kelly', role: 'victim', body: 'c. 1863, Ireland. Found 10:45 in her room, 13 Miller\'s Court, Dorset St. Only indoor scene.', date: '1888-11-09', time: '10:45', status: 'confirmed' }, 80, 1080);
      const map = A('photo', { title: 'The seven Whitechapel murder sites, 1894 OS map', image: W('Whitechapel_Spitalfields_7_murders.JPG') + '?width=900', body: 'Ordnance Survey 1894, annotated. Every scene inside ~1 km².', fileName: 'Whitechapel_Spitalfields_7_murders.JPG', addedBy: 'example', addedAt: new Date().toISOString() }, 420, 80);
      const rook = A('photo', { title: 'The Spitalfields rookery', image: W('Spitalfields_rookery.jpg') + '?width=700', body: 'Common lodging houses on Flower and Dean St, Thrawl St, Dorset St — all five victims lodged here.', fileName: 'Spitalfields_rookery.jpg', addedBy: 'example', addedAt: new Date().toISOString() }, 420, 420);
      const punch = A('photo', { title: '“The Nemesis of Neglect”, Punch, 29 Sep 1888', image: W('Jack-the-Ripper-The-Nemesis-of-Neglect-Punch-London-Charivari-cartoon-poem-1888-09-29.jpg') + '?width=600', body: 'John Tenniel. Press pressure on the Metropolitan Police at its height.', fileName: 'Nemesis-of-Neglect-1888.jpg', addedBy: 'example', addedAt: new Date().toISOString() }, 420, 760);
      const bucks = A('photo', { title: 'Buck\'s Row plan, 1888', image: W("Buck's_Row_plan_Kelly_1888.jpg") + '?width=600', body: 'Scene plan for the Nichols murder (now Durward St).', fileName: 'Bucks_Row_plan_1888.jpg', addedBy: 'example', addedAt: new Date().toISOString() }, 420, 1100);
      const lBucks = A('location', { title: 'Buck\'s Row (Durward St)', lat: '51.5209', lon: '-0.0607', radius: '60', body: 'Gateway of the stable yard. Found by Charles Cross and Robert Paul.', date: '1888-08-31', time: '03:40' }, 760, 80);
      const lHan = A('location', { title: '29 Hanbury Street', lat: '51.5205', lon: '-0.0730', radius: '40', body: 'Back yard, reached through the passage. 17 people lived in the house.', date: '1888-09-08', time: '06:00' }, 760, 330);
      const lBern = A('location', { title: 'Dutfield\'s Yard, Berner St', lat: '51.5133', lon: '-0.0620', radius: '40', body: 'Beside the International Working Men\'s Educational Club. Attack seen by Israel Schwartz c. 00:45.', date: '1888-09-30', time: '01:00' }, 760, 580);
      const lMitre = A('location', { title: 'Mitre Square', lat: '51.5139', lon: '-0.0776', radius: '40', body: 'City of London jurisdiction. PC Watkins\' beat passed at 01:30 — nothing; 01:44 — body.', date: '1888-09-30', time: '01:45' }, 760, 830);
      const lMill = A('location', { title: '13 Miller\'s Court, Dorset St', lat: '51.5192', lon: '-0.0745', radius: '30', body: 'Single room, rent in arrears. Found by Thomas Bowyer collecting rent.', date: '1888-11-09', time: '10:45' }, 760, 1080);
      const graf = A('object', { title: 'Goulston Street graffito + apron piece', f1: 'Found 02:55, 30 Sep', f2: 'Wentworth Model Dwellings doorway', f3: 'Chalk message erased on Warren\'s order before photography', body: 'Piece of Eddowes\'s apron found below chalk writing. Only physical trace linking a route away from Mitre Square.', date: '1888-09-30', time: '02:55', lat: '51.5165', lon: '-0.0729' }, 1100, 830);
      const dear = A('doc', { title: '“Dear Boss” letter', body: 'Dated 25 Sep, received 27 Sep 1888 by the Central News Agency. First use of the name “Jack the Ripper”. Police later believed it a journalist\'s hoax.', date: '1888-09-27', status: 'unverified' }, 1100, 80);
      const hell = A('doc', { title: '“From Hell” letter', body: 'Received 16 Oct 1888 by George Lusk, Whitechapel Vigilance Committee, with half a human kidney. Authenticity disputed.', date: '1888-10-16', status: 'unverified' }, 1100, 330);
      const macn = A('doc', { title: 'Macnaghten memorandum', body: 'Sir Melville Macnaghten, 23 Feb 1894. Names Druitt, Kosminski and Ostrog as the suspects worth considering; argues for five victims only.', date: '1894-02-23', status: 'confirmed' }, 1100, 580);
      const wL = A('statement', { title: 'Joseph Lawende', f1: 'Joseph Lawende, commercial traveller', f2: 'City Police · inquest 11 Oct', f3: 'Fair — saw face briefly in poor light', body: 'c. 01:35, 30 Sep: saw a woman he later identified by clothing as Eddowes talking with a man at the Church Passage entrance to Mitre Square. Man: ~30, fair moustache, loose jacket, peaked cap, red neckerchief.', date: '1888-09-30', time: '01:35', role: 'witness' }, 1440, 830);
      const wS = A('statement', { title: 'Israel Schwartz', f1: 'Israel Schwartz', f2: 'Met Police, Abberline · not called at inquest', f3: 'Good — witnessed the assault', body: 'c. 00:45, 30 Sep, Berner St: saw a man throw Stride to the ground; a second man lit a pipe across the street. First man shouted “Lipski”.', date: '1888-09-30', time: '00:45' }, 1440, 580);
      const wLong = A('statement', { title: 'Elizabeth Long', f1: 'Elizabeth Long', f2: 'Inquest, 19 Sep', f3: 'Fair — timing disputed by the surgeon', body: 'c. 05:30, 8 Sep: saw Chapman outside 29 Hanbury St with a man, “shabby genteel”, dark, foreign-looking, over 40. Heard “Will you?” — “Yes.”', date: '1888-09-08', time: '05:30' }, 1440, 330);
      const sK = A('person', { title: 'Aaron Kosminski', role: 'suspect', body: 'Polish-born barber, Whitechapel resident. Named by Macnaghten (1894) and Swanson\'s marginalia; committed to Colney Hatch asylum 1891. Means: lived locally. Motive: alleged “great hatred of women”. Never charged.', status: 'unverified' }, 1800, 80);
      const sD = A('person', { title: 'Montague John Druitt', role: 'suspect', body: 'Barrister and schoolmaster, 31. Body recovered from the Thames 31 Dec 1888; Macnaghten\'s preferred suspect on “private information”. Lived in Blackheath; alibi evidence (cricket fixtures) for some dates.', status: 'unverified' }, 1800, 330);
      const sT = A('person', { title: 'Francis Tumblety', role: 'suspect', body: 'American quack doctor, in London autumn 1888; arrested on unrelated charges 7 Nov, fled to the US. Named in the 1913 Littlechild letter. Was in custody / abroad for parts of the sequence.', status: 'unverified' }, 1800, 580);
      const sC = A('person', { title: 'George Chapman (Seweryn Kłosowski)', role: 'suspect', body: 'Polish barber-surgeon living in Whitechapel 1888; hanged 1903 for poisoning three wives. Abberline\'s later favourite. Method (poison) differs sharply.', status: 'unverified' }, 1800, 830);
      const ev1 = A('event', { title: 'Double event: two murders in 45 minutes', date: '1888-09-30', time: '01:00', body: 'Stride 01:00 Berner St → Eddowes 01:45 Mitre Square (~0.8 km). Apron piece 02:55 Goulston St, back toward Spitalfields.' }, 1100, 1100);
      const ev2 = A('event', { title: 'Warren orders graffito erased', date: '1888-09-30', time: '05:30', body: 'Sir Charles Warren has the chalk writing removed before daylight to avoid anti-Jewish riots. Warren resigns 8 Nov.' }, 1440, 1100);
      const note1 = A('note', { body: 'Pattern: all weekends / early hours, all within walking distance of the same lodging houses. Local man, or a man with a reason to be there before dawn.' }, 1800, 1100);
      const note2 = A('note', { body: 'Every named suspect is post-hoc. Kosminski: witness ID (Lawende?) never formally recorded. Druitt: no evidence beyond timing of his death.' }, 2080, 1100);
      const T = (from, to, rel, why, conf) => ({ id: Component.uid(), from, to, rel, why: why || '', conf: conf || 'high' });
      this.upCase(cs => Component.numbered({ ...cs, threads: [
        T(vN, lBucks, 'custom-present-at', 'Found at the stable gateway, 03:40'), T(vC, lHan, 'custom-present-at', 'Back yard, 06:00'), T(vS, lBern, 'custom-present-at', 'Dutfield\'s Yard, 01:00'), T(vE, lMitre, 'custom-present-at', 'South-west corner, 01:45'), T(vK, lMill, 'custom-present-at', 'Room 13, found 10:45'),
        T(wLong, vC, 'custom-last-seen-with', 'Saw her with a man at 05:30, if her timing is right', 'medium'), T(wS, vS, 'custom-last-seen-with', 'Witnessed the assault at 00:45', 'high'), T(wL, vE, 'custom-last-seen-with', 'Church Passage, 01:35', 'medium'),
        T(graf, vE, 'linked', 'Apron piece matched to Eddowes\'s apron at the mortuary'), T(graf, lMitre, 'linked', 'Route from the square toward Spitalfields'), T(ev1, vS, 'linked'), T(ev1, vE, 'linked'), T(ev2, graf, 'linked', 'Erased 05:30'),
        T(sK, vE, 'suspected', 'Swanson marginalia: witness identification at the Seaside Home — unrecorded', 'low'), T(sK, rook, 'linked', 'Lived with family in Greenfield St / Sion Square, minutes from every scene', 'medium'), T(sD, macn, 'linked', 'Macnaghten\'s “private information”', 'low'), T(sT, vK, 'suspected', 'Littlechild letter 1913; in custody 7–16 Nov, released on bail before Kelly? disputed', 'low'), T(sC, rook, 'linked', 'Barber-surgeon in Whitechapel 1888', 'low'),
        T(dear, vE, 'linked', 'Posted before the double event; “clip the lady\'s ears” — Eddowes\'s earlobe was cut', 'low'), T(hell, vE, 'linked', 'Kidney sent to Lusk; Eddowes\'s left kidney was removed', 'low'),
        T(map, lBucks, 'linked'), T(map, lMill, 'linked'), T(rook, vN, 'linked', 'Lodged 18 Thrawl St and 56 Flower and Dean St'), T(rook, vC, 'linked', 'Crossingham\'s, 35 Dorset St'), T(rook, vK, 'linked', '13 Miller\'s Court is off Dorset St'), T(bucks, lBucks, 'linked'), T(punch, ev2, 'linked', 'Press pressure after the double event'), T(note1, rook, 'linked'), T(note2, sK, 'linked'), T(note2, sD, 'linked'),
      ], mmo: { [sK + '|means']: 'Y', [sK + '|motive']: '?', [sK + '|opp']: 'Y', [sK + '|alibi']: 'N', [sD + '|means']: '?', [sD + '|motive']: '?', [sD + '|opp']: '?', [sD + '|alibi']: 'N', [sT + '|means']: 'Y', [sT + '|motive']: '?', [sT + '|opp']: 'N', [sT + '|alibi']: '?', [sC + '|means']: 'Y', [sC + '|motive']: '?', [sC + '|opp']: 'Y', [sC + '|alibi']: 'N' } }));
      this.logEvt('Example homicide case seeded: 30 cards, 32 threads'); setTimeout(() => this.fit(), 150); this.toast('Whitechapel 1888 example loaded — try Suspects, Geo (G), Timeline (T) and Play');
    });
  }
  setMode = e => { const id = e.target.value, M = Component.MODES[id]; if (id === 'example-homicide') { e.target.value = this.cs().domain || 'investigation'; return this.exampleHomicide(); } if (!M) return; const cs = this.cs(); this.upCase(c => ({ ...c, domain: id, customRels: [...(c.customRels || []).filter(r => !r.auto), ...M.rels.map(([label, color]) => ({ id: 'custom-' + label.replace(/[^a-z0-9]+/gi, '-'), label, color, dash: '0', auto: true }))], seededModes: [...(c.seededModes || []), id] })); if (!(cs.seededModes || []).includes(id) && M.starter.length && window.confirm('Add the ' + M.label + ' starter checklist (' + M.starter.length + ' cards) to the inbox?')) { M.starter.forEach(([t, extra]) => this.addItem(t, { source: M.label + ' starter', ...extra }, false)); } if (!(cs.notes || '').trim() && M.prompt) this.upCase(c => ({ ...c, notes: '' })); this.logEvt('Board mode → ' + M.label); this.toast(M.label + ' mode: roles, relations and labels updated'); };
  relMemory(it, cs) { if (!it) return []; const byId = Object.fromEntries(cs.items.map(i => [i.id, i])), nb = id => new Set(cs.threads.filter(t => t.from === id || t.to === id).map(t => t.from === id ? t.to : t.from)), mine = nb(it.id), out = []; cs.threads.filter(t => t.from === it.id || t.to === it.id).forEach(t => { const oid = t.from === it.id ? t.to : t.from, o = byId[oid]; if (!o) return; const shared = [...nb(oid)].filter(x => mine.has(x) && x !== it.id).length, dated = [it, o].filter(x => x.date).map(x => x.date).sort(), strength = 1 + (t.why ? 1 : 0) + (t.note ? 1 : 0) + shared + Math.min(2, (o.comments || []).length) + (o.status === 'confirmed' ? 1 : 0), r = Component.K.REL[t.rel] || Component.K.REL.linked; out.push({ id: oid, label: this.itemLabel(o), rel: r.label, color: this.relColor(r), strength, since: dated.length ? this.fmtDate(dated[0]) : '', bars: [1, 2, 3, 4, 5].map(k => k <= Math.min(5, strength) ? 3 + k * 2 : 2), onOpen: () => this.focusItem(oid) }); }); return out.sort((a, c) => c.strength - a.strength); }
  recordFields(it) { const L = { vehicle: ['PLATE', 'MAKE / MODEL', 'COLOUR'], object: ['SERIAL / ID', 'FOUND WHERE', 'OWNER'], statement: ['GIVEN BY', 'TAKEN BY', 'RELIABILITY'] }[it.type] || ['FIELD 1', 'FIELD 2', 'FIELD 3']; return [{ k: L[0], v: it.f1 || '' }, { k: L[1], v: it.f2 || '' }, { k: L[2], v: it.f3 || '' }]; }
  curve(a, b, mode) {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI; if (angle > 90) angle -= 180; if (angle < -90) angle += 180;
    if (mode === 'taut') return { d: 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, angle, c: null };
    const sag = Math.min(70, dist * (mode === 'yarn' ? 0.08 : 0.13)), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + sag;
    return { d: 'M' + a.x + ' ' + a.y + ' Q' + cx + ' ' + cy + ' ' + b.x + ' ' + b.y, mx: .25 * a.x + .5 * cx + .25 * b.x, my: .25 * a.y + .5 * cy + .25 * b.y, angle, c: { x: cx, y: cy } };
  }
  tokens(it) {
    const cache = this.tokenCache; if (cache.has(it)) return cache.get(it);
    const out = new Set();
    this.tagList(it.tags).forEach(t => out.add('#' + t.toLowerCase()));
    let text = [it.title, it.body, it.url, it.value].filter(Boolean).join(' ').toLowerCase().replace(/\[\.\]/g, '.').replace(/hxxp/g, 'http');
    (text.match(/[a-z0-9._-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || []).forEach(m => { out.add(m); text = text.split(m).join(' '); });
    (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach(m => out.add(m));
    (text.match(/\b[a-f0-9]{32,64}\b/g) || []).forEach(m => out.add(m));
    (text.match(/@[a-z0-9_]{3,}/g) || []).forEach(m => out.add(m));
    (text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g) || []).forEach(m => { if (!/^\d+(\.\d+)*$/.test(m)) out.add(m); });
    cache.set(it, out); return out;
  }
  suggestions(cs) {
    const pinned = cs.items.filter(i => i.pinned), dis = new Set(cs.dismissed || []);
    const linked = new Set(); cs.threads.forEach(t => { linked.add(t.from + '|' + t.to); linked.add(t.to + '|' + t.from); });
    const out = [];
    for (let a = 0; a < pinned.length; a++) for (let b = a + 1; b < pinned.length; b++) {
      const A = pinned[a], B = pinned[b], key = A.id + '|' + B.id;
      if (linked.has(key) || dis.has(key) || dis.has(B.id + '|' + A.id)) continue;
      const ta = this.tokens(A), tb = this.tokens(B); let shared = null;
      for (const t of ta) if (tb.has(t) && (!shared || (shared.startsWith('#') && !t.startsWith('#')))) shared = t;
      if (!shared) continue;
      let rel = 'linked';
      const ind = x => x.type === 'indicator';
      if (A.type === 'location' || B.type === 'location') rel = 'located';
      else if ((A.type === 'person' && ind(B) && B.kind === 'handle') || (B.type === 'person' && ind(A) && A.kind === 'handle')) rel = 'alias';
      else if (ind(A) && ind(B) && ((A.kind === 'domain' && B.kind === 'ip') || (A.kind === 'ip' && B.kind === 'domain'))) rel = 'resolves';
      out.push({ a: A, b: B, shared, rel });
    }
    return out.slice(0, 8);
  }
  setter(name) { return this.setters[name] || (this.setters[name] = e => { const v = e.target.value, id = this.state.sel; if (name === 'status') this.sfx('stamp'); if (id) this.upItem(id, { [name]: v }); }); }

  renderVals() {
    const K = Component.K, s = this.state, cs = this.cs(), P = this.props, V = this.visuals(); this.syncRels(cs); this.syncMode(cs);
    const q = s.search.trim().toLowerCase();
    let focus = null, focus2 = null;
    if (s.reveal) {
      if (s.sel) { focus = new Set([s.sel]); cs.threads.forEach(t => { if (t.from === s.sel) focus.add(t.to); if (t.to === s.sel) focus.add(t.from); }); focus2 = new Set(); cs.threads.forEach(t => { if (focus.has(t.from) && !focus.has(t.to)) focus2.add(t.to); if (focus.has(t.to) && !focus.has(t.from)) focus2.add(t.from); }); }
      else if (s.selThread) { const t = cs.threads.find(x => x.id === s.selThread); if (t) focus = new Set([t.from, t.to]); }
    }
    const lvl = it => (shown && !shown.has(it.id)) ? 3 : (!!s.hidden[it.type] || (!!q && !this.matches(it, q)) || (!!focus && !focus.has(it.id) && !(focus2 && focus2.has(it.id)))) ? 2 : (focus2 && focus2.has(it.id)) ? 1 : 0;
    const dim = it => lvl(it) >= 2;
    const isTL = s.mode === 'timeline', isKC = s.mode === 'killchain', isList = s.mode === 'list', isGeo = s.mode === 'geo', hasLay = isTL || isKC || isList;
    const seq = s.play.on ? this.playSeq(cs) : null, playCur = seq ? seq[s.play.idx] : null, playProg = Math.min(1, s.play.prog || 0), shown = seq ? new Set(seq.slice(0, s.play.idx + (playCur ? 1 : 0)).map(x => x.id)) : null;
    const pinnedRaw = cs.items.filter(i => i.pinned), inboxItems = cs.items.filter(i => !i.pinned);
    const lay = isTL ? this.timelineLayout(pinnedRaw) : isKC ? this.laneLayout(pinnedRaw, cs.threads) : isList ? this.listLayout(pinnedRaw) : null; this.lastLayout = lay;
    const pinned = lay ? pinnedRaw.map(i => lay.pos[i.id] ? { ...i, x: lay.pos[i.id].x, y: lay.pos[i.id].y } : i) : pinnedRaw;
    const byId = Object.fromEntries(cs.items.map(i => [i.id, i])); pinned.forEach(i => { byId[i.id] = i; });
    const label = it => this.itemLabel(it);

    const hov = s.hover && !this.drag && !s.linking ? byId[s.hover] : null, hovT = hov ? cs.threads.filter(t => t.from === hov.id || t.to === hov.id) : [], hovN = new Set(hovT.map(t => t.from === hov.id ? t.to : t.from));
    const cards = pinned.map(it => {
      const T = K.TYPES[it.type], p = this.pin(it), isSel = s.sel === it.id, isPend = s.pending === it.id, tags = this.tagList(it.tags), isN = hovN.has(it.id);
      return {
        id: it.id, x: it.x, y: it.y, w: T.w, px: p.x, py: p.y, rot: this.rot(it.id),
        bg: this.paperBg(it.type, V.paper), shadow: isSel ? V.shadowSel : V.shadow, opacity: lvl(it) === 3 ? 0 : lvl(it) === 2 ? .14 : lvl(it) === 1 ? .5 : 1, pe: lvl(it) === 3 ? 'none' : 'auto',
        aria: T.label + (it.num ? ' exhibit ' + it.num : '') + ': ' + label(it) + (it.status ? ', ' + (K.STAMP_LABEL[it.status] || '') : ''),
        onKey: e => { const k = e.key; if (k === 'Enter' || k === ' ') { e.preventDefault(); this.setState({ sel: it.id, selThread: null, selGroup: null, tab: 'inspector', showRight: true }); } else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.removeItem(it.id); } else if (/^Arrow/.test(k) && s.mode === 'board') { e.preventDefault(); const d = e.shiftKey ? 1 : 10, dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0; this.upItem(it.id, { x: it.x + dx, y: it.y + dy }); } else if (k === 'c' || k === 'C') { e.preventDefault(); this.setState({ tool: 'connect', pending: it.id, sel: it.id }); } },
        outline: isSel ? '2px solid ' + K.RED : isPend ? '2px dashed ' + K.RED : isN ? '2px solid rgba(255,42,60,.55)' : '2px solid transparent',
        hasNum: V.numbers && !!it.num, numText: Component.numText('', it.num),
        isTx: it.type === 'tx', chainLabel: it.chain || 'Transfer', amount: it.amount || '—', txFrom: it.txFrom || '—', txTo: it.txTo || '—', hasHash: !!it.value, hashShort: it.value && it.value.length > 22 ? it.value.slice(0, 12) + '…' + it.value.slice(-8) : (it.value || ''),
        ring: V.rings && (this.hash(it.id) % 7 === 0), ringX: -18 + (this.hash(it.id + 'x') % 30), ringY: -14 + (this.hash(it.id + 'y') % 40),
        hasGrade: !!(it.srcGrade || it.infoGrade), grade: (it.srcGrade || '?') + (it.infoGrade || '?'), hasTlp: !!it.tlp, tlpColor: (K.TLP.find(t => t[0] === it.tlp) || K.TLP[0])[2], tlpTitle: (K.TLP.find(t => t[0] === it.tlp) || K.TLP[0])[1], stale: this.isStale(it, V.staleDays),
        isTarget: it.type === 'target', sector: it.sector || '—', region: it.region || '—', impact: it.impact || '—', time: it.time || '',
        hasRole: !!it.role, role: it.role || '', roleColor: it.role === 'suspect' ? '#b4222a' : it.role === 'victim' ? '#1f4e8c' : it.role === 'witness' ? '#1f7a3d' : '#5a5650',
        isRecord: ['vehicle', 'object', 'statement'].includes(it.type), typeLabel: K.TYPES[it.type].label, fields: this.recordFields(it).filter(f => f.v),
        links: this.linksOf(it), get hasLinks() { return this.links.length > 0; },
        isVideo: it.type === 'video', isAudio: it.type === 'audio', isPdf: it.type === 'pdf', isEmail: it.type === 'email', isCode: it.type === 'code', isFeed: it.type === 'feed', isMonitor: it.type === 'monitor',
        embed: typeof this.embedUrl(it.url) === 'string' ? this.embedUrl(it.url) : '', get hasEmbed() { return !!this.embed; }, mediaSrc: it.media ? this.mediaSrc(it) : ((this.embedUrl(it.url) || {}).direct || ''), get hasMedia() { return !!this.mediaSrc && !this.embed; }, get noMedia() { return !this.mediaSrc && !this.embed; }, onPickMedia: e => { e.stopPropagation(); this.pickMedia(it.id); },
        pdfSrc: (it.media ? this.mediaSrc(it) : '') + '#page=' + ((this.pdfPage || {})[it.id] || 1) + '&toolbar=0', marks: (it.marks || []).map(m => ({ label: it.type === 'pdf' ? 'p.' + m.t : this.fmtT(m.t) + ' ' + (m.label || ''), onSeek: e => { e.stopPropagation(); this.seekMedia(it, m.t); } })), get hasMarks() { return this.marks.length > 0; },
        hasPeaks: !!(it.peaks && it.peaks.length), peaks: it.peaks || [], onRecord: e => { e.stopPropagation(); this.setState({ sel: it.id }, () => this.toggleRec()); }, recLabel: s.recOn && s.sel === it.id ? '■ Stop' : '● Record', recBorder: s.recOn && s.sel === it.id ? '#ff2a3c' : '#9a9488', recBg: s.recOn && s.sel === it.id ? '#ff2a3c' : 'transparent', recColor: s.recOn && s.sel === it.id ? '#fff' : '#3a362f', transcript: it.transcript || '',
        emFrom: it.emFrom || '—', emTo: it.emTo || '—', emDate: it.emDate || '—', emPath: it.emPath || '—', emCounts: [(it.emUrls || []).length + ' links', (it.emIps || []).length + ' relay IPs', (it.emAttach || []).length + ' attachments'].join(' · '),
        codeLines: it.type === 'code' ? this.codeLines(it.body) : [],
        feedKindLabel: ({ rss: 'RSS', threatfox: 'ThreatFox', urlhaus: 'URLhaus', kev: 'CISA KEV', nvd: 'NVD', reddit: 'Reddit', mastodon: 'Mastodon', bluesky: 'Bluesky', telegram: 'Telegram', ransomware: 'Leak sites' })[it.feedKind || 'rss'] || 'Feed', feedWhen: it.feedAt ? this.fmtWhen(it.feedAt) : 'not fetched', feedRows: (it.feedItems || []).slice(0, 8).map(fr => ({ when: fr.date ? this.fmtWhen(fr.date) : '', title: fr.title, onPin: e => { e.stopPropagation(); this.addItem('link', { title: fr.title.slice(0, 80), url: fr.link, date: fr.date ? fr.date.slice(0, 10) : this.today(), source: (it.title || 'feed') + ' · ' + this.fmtWhen(fr.date || new Date().toISOString()), collected: this.today() }, true); this.toast('Pinned'); } })), feedEmpty: !(it.feedItems || []).length, feedStatus: it.feedStatus || 'Set a source in the inspector, then Refresh',
        monColor: !it.monLast ? '#8d877b' : it.monLast.status === 'down' ? '#ff2a3c' : it.monLast.changed ? '#e8a71c' : '#3fae63', monStatus: !it.monLast ? 'not checked' : it.monLast.status + (it.monLast.changed ? ' · changed' : ''), monWhen: it.monLast ? this.fmtWhen(it.monLast.at) : '', monBars: (it.monHist || []).slice(-24).map(hh => ({ h: hh.status === 'down' ? 4 : hh.changed ? 14 : 9, color: hh.status === 'down' ? '#ff2a3c' : hh.changed ? '#e8a71c' : '#3fae63', title: this.fmtWhen(hh.at) + ' ' + hh.status })), monTitle: it.monLast && it.monLast.title ? '“' + it.monLast.title + '”' : '',
        hasGeo: !!this.geoOf(it), geoKey: [it.lat, it.lon, it.radius].join(','), geoText: [it.lat && it.lon ? (+it.lat).toFixed(3) + ', ' + (+it.lon).toFixed(3) : '', it.geoLabel].filter(Boolean).join(' · '),
        hasFoot: !!((it.todo || []).some(t => !t.done) || (it.comments || []).length), foot: [(it.todo || []).filter(t => !t.done).length ? (it.todo || []).filter(t => !t.done).length + ' open task' + ((it.todo || []).filter(t => !t.done).length === 1 ? '' : 's') : '', (it.comments || []).length ? (it.comments || []).length + ' comment' + ((it.comments || []).length === 1 ? '' : 's') : ''].filter(Boolean).join(' · '),
        onEnter: () => { if (!this.drag && s.hover !== it.id) { this.sfx('hover'); this.setState({ hover: it.id }); } }, onLeave: () => { if (this.state.hover === it.id) this.setState({ hover: null }); },
        typeLabel: T.label, kindLabel: it.type === 'ttp' ? (it.kind || 'Technique') : (K.KINDS[it.kind] || it.kind || ''),
        isPhoto: it.type === 'photo', isNote: it.type === 'note', isLink: it.type === 'link', isPerson: it.type === 'person', isIndicator: it.type === 'indicator', isDoc: it.type === 'doc', isEvent: it.type === 'event', isLocation: it.type === 'location',
        title: it.title, body: it.body, url: it.url, value: it.value, noteText: it.body || it.title, dateLabel: this.fmtDate(it.date),
        tags, hasTags: tags.length > 0, image: it.image, hasImage: !!it.image, noImage: !it.image,
        href: /^https?:\/\//i.test(it.url || '') ? it.url : '', hasHref: /^https?:\/\//i.test(it.url || ''),
        initial: (String(it.url || it.title || '?').replace(/^(hxxps?|https?):\/\//i, '').replace(/^www\./i, '')[0] || '?').toUpperCase(),
        pinGrad: this.pinGrad(it.type, V.pins), isTtp: it.type === 'ttp', valueText: this.display(it, V),
        hasStamp: !!it.status && !!K.STAMP_LABEL[it.status], stampText: K.STAMP_LABEL[it.status] || '', stampColor: K.STAMP_INK[it.status] || '#5a5650',
        onDown: e => this.cardDown(e, it), onPinDown: e => this.pinDown(e, it), onDrop: e => this.cardDrop(e, it),
        onPick: e => { e.stopPropagation(); if (!this.lastMoved) this.pickImage(it.id); },
      };
    });

    const liveThreads = cs.threads.filter(t => byId[t.from] && byId[t.to] && byId[t.from].pinned && byId[t.to].pinned);
    const threads = liveThreads.map(t => {
      const r = K.REL[t.rel] || K.REL.linked, A = byId[t.from], B = byId[t.to], pa = this.pin(A), pb = this.pin(B), g = t.wp ? this.curveVia(pa, pb, t.wp) : this.curve(pa, pb, V.thread), isSel = s.selThread === t.id, conf = t.conf || 'high', dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const isHov = !!hov && (t.from === hov.id || t.to === hov.id), lit = isSel || isHov, showNum = V.numbers && !!t.num;
      return {
        id: t.id, d: g.d, drawing: !!(playCur && playCur.k === 't' && playCur.id === t.id), dashOff: playCur && playCur.k === 't' && playCur.id === t.id ? String(Math.round((1 - playProg) * 3000)) : '0', get dashDraw() { return this.drawing ? '3000' : this.dash; }, color: this.relColor(r), flowColor: 'color-mix(in srgb, ' + this.relColor(r) + ' 55%, white)', dur: Math.min(4.5, Math.max(1.3, dist / 160)).toFixed(2),
        width: (lit ? V.width + 1.3 : V.width) - (conf === 'low' ? .4 : 0), shadowWidth: V.width + 1.5, dash: r.dash ? '7 5' : conf === 'medium' ? '14 7' : conf === 'low' ? '3 7' : 'none',
        mx: g.mx, my: g.my, angle: g.angle, label: r.label, showLabel: V.labels, showNum, showChip: V.labels || showNum, numText: Component.numText('T', t.num), fiber: V.fiber,
        chipBg: isHov ? '#fff' : '#f3f1ea', chipShadow: isHov ? '0 0 0 1px ' + r.color + ', 0 4px 10px rgba(0,0,0,.7)' : '0 2px 4px rgba(0,0,0,.6)',
        opacity: (shown && !shown.has(t.id)) ? 0 : (dim(A) || dim(B)) ? .12 : (lvl(A) === 1 || lvl(B) === 1) ? .4 : (hov && !isHov) ? .3 : conf === 'low' ? .6 : 1, outline: isSel ? '2px solid ' + K.RED : 'none', glow: lit ? 'drop-shadow(0 0 5px ' + this.relColor(r) + ')' : 'none',
        onClick: e => { e.stopPropagation(); this.setState({ selThread: t.id, sel: null, pending: null, tab: 'inspector', showRight: true }); },
      };
    });

    const sel = s.sel ? byId[s.sel] : null, selT = s.selThread ? cs.threads.find(t => t.id === s.selThread) : null;
    const selVals = sel ? {
      id: sel.id, typeLabel: K.TYPES[sel.type].label, title: sel.title, body: sel.body, url: sel.url, value: sel.value, kind: sel.kind || 'domain', date: sel.date || '', tags: sel.tags || '',
      isIndicator: sel.type === 'indicator', isLink: sel.type === 'link', isTtp: sel.type === 'ttp', isTx: sel.type === 'tx', isTarget: sel.type === 'target', sector: sel.sector || '', region: sel.region || '', impact: sel.impact || '',
      isPerson: sel.type === 'person', role: sel.role || '', isRecord: ['vehicle', 'object', 'statement'].includes(sel.type), f1: sel.f1 || '', f2: sel.f2 || '', f3: sel.f3 || '', f1Label: this.recordFields(sel)[0].k, f2Label: this.recordFields(sel)[1].k, f3Label: this.recordFields(sel)[2].k,
      handLabel: sel.hand ? 'Handwritten ✓' : 'Handwritten', handBorder: sel.hand ? '#ff2a3c' : '#2c2c31', handColor: sel.hand ? '#ff2a3c' : '#d8d3c7', hasImage: !!sel.image,
      isMediaType: ['video', 'audio', 'pdf', 'email'].includes(sel.type), isVideo: sel.type === 'video', isAudio: sel.type === 'audio', isPdf: sel.type === 'pdf', isEmail: sel.type === 'email', isTimed: ['video', 'audio', 'pdf'].includes(sel.type), url: sel.url || '', mediaBtn: sel.type === 'email' ? 'Load .eml file' : sel.media ? 'Replace file' : 'Attach file', mediaName: [sel.mediaName, sel.fileHash ? 'sha256 ' + sel.fileHash.slice(0, 16) + '…' : ''].filter(Boolean).join(' · '), hasCustodyMedia: !!sel.mediaName, transcript: sel.transcript || '',
      markRows: (sel.marks || []).map((m, k) => ({ at: sel.type === 'pdf' ? 'p.' + m.t : this.fmtT(m.t), label: m.label || '', onLabel: e => { const v = e.target.value; this.upItem(sel.id, { marks: sel.marks.map((x, j) => j === k ? { ...x, label: v } : x) }); }, onEvent: () => { this.addItem('event', { title: (m.label || 'Bookmark') + ' · ' + (sel.title || '') + ' @ ' + (sel.type === 'pdf' ? 'p.' + m.t : this.fmtT(m.t)), date: sel.date || this.today(), time: sel.time || '', source: sel.mediaName || sel.url || '', collected: this.today() }, false); this.toast('Event card in the inbox'); }, onRemove: () => this.upItem(sel.id, { marks: sel.marks.filter((x, j) => j !== k) }) })), hasMarks: !!(sel.marks || []).length,
      isFeed: sel.type === 'feed', feedKind: sel.feedKind || 'rss', feedUrl: sel.feedUrl || '', feedQuery: sel.feedQuery || '', feedStatus: sel.feedStatus || '', feedUrlLabel: ({ rss: 'FEED URL', reddit: 'SUBREDDIT OR u/USER', mastodon: 'instance/@user OR #tag', bluesky: 'HANDLE', telegram: 'CHANNEL', nvd: 'KEYWORD' })[sel.feedKind || 'rss'] || 'NOT NEEDED FOR THIS SOURCE', feedUrlHint: ({ rss: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', reddit: 'r/netsec', mastodon: 'infosec.exchange/@malwrhunterteam', bluesky: 'bellingcat.com', telegram: 'channelname', nvd: 'fortinet' })[sel.feedKind || 'rss'] || 'leave empty',
      isMonitor: sel.type === 'monitor', monEvery: String(sel.monEvery || 15), monDetail: sel.monLast ? ['Status ' + sel.monLast.status, sel.monLast.title ? 'Title “' + sel.monLast.title + '”' : '', 'Checked ' + this.fmtWhen(sel.monLast.at), (sel.monHist || []).filter(h => h.changed).length + ' changes seen'].filter(Boolean).join('\n') : 'Not checked yet',
      isLocation: sel.type === 'location', lat: sel.lat || '', lon: sel.lon || '', radius: sel.radius || '', geoText: sel.geoLabel || (this.geoOf(sel) ? 'Located' : 'Not located'), isIp: sel.type === 'indicator' && sel.kind === 'ip', isWallet: sel.type === 'indicator' && sel.kind === 'wallet', watchLabel: sel.watch ? 'Watching ✓' : 'Watch wallet', watchBorder: sel.watch ? '#ff2a3c' : '#2c2c31', watchColor: sel.watch ? '#ff2a3c' : '#d8d3c7', walletText: sel.walletLast ? sel.walletLast.bal + ' · ' + sel.walletLast.n + ' tx · ' + this.fmtWhen(sel.walletLast.at) : '', isSiem: sel.type === 'indicator' && ['ip', 'domain', 'url', 'hash', 'email'].includes(sel.kind),
      isDated: !!sel.date || ['event', 'tx', 'statement'].includes(sel.type), time: sel.time || '', isPost: ['note', 'link', 'code', 'statement'].includes(sel.type), stance: sel.stance || '', narrative: sel.narrative || '', hasText: !!(sel.body || sel.transcript || sel.title), hasTranslation: !!sel.translation, lang: sel.lang || '?', translation: sel.translation || '',
      ...(() => { const p = this.pol(sel, cs); return p ? { hasPol: true, polCount: p.count, polDays: p.days, hasPolHours: p.hasHours, polHours: p.hours } : { hasPol: false, polDays: [], polHours: [] }; })(),
      source: sel.source || '', collected: sel.collected || '', srcGrade: sel.srcGrade || '', infoGrade: sel.infoGrade || '', tlp: sel.tlp || '', firstSeen: sel.firstSeen || '', lastSeen: sel.lastSeen || '', ageText: this.ageText(sel), ageColor: this.isStale(sel, V.staleDays) ? K.RED : '#8d877b',
      hasCustody: !!sel.fileHash || !!sel.fileName, custody: [sel.fileName, sel.fileHash ? 'sha256 ' + sel.fileHash : '', sel.addedBy ? 'added by ' + sel.addedBy : '', sel.addedAt ? new Date(sel.addedAt).toLocaleString() : ''].filter(Boolean).join('\n'), chain: sel.chain || '', amount: sel.amount || '', txFrom: sel.txFrom || '', txTo: sel.txTo || '', status: sel.status || '', canImage: sel.type === 'photo' || sel.type === 'person' || sel.type === 'location', hasImage: !!sel.image,
      pinLabel: sel.pinned ? 'ON THE BOARD' : 'IN THE INBOX', pinAction: sel.pinned ? 'Unpin to inbox' : 'Pin to board', numText: Component.numText('EXHIBIT ', sel.num),
      bodyLabel: sel.type === 'person' ? 'ALIASES / NOTES' : sel.type === 'note' ? 'NOTE' : sel.type === 'indicator' ? 'CONTEXT' : 'DETAILS',
    } : {};
    const selLinks = sel ? cs.threads.filter(t => t.from === sel.id || t.to === sel.id).map(t => {
      const other = byId[t.from === sel.id ? t.to : t.from], r = K.REL[t.rel] || K.REL.linked;
      return { id: t.id, numText: Component.numText('T', t.num), relLabel: r.label, color: r.color, other: other ? label(other) : '—', onSelect: () => this.setState({ selThread: t.id, sel: null }), onRemove: e => { e.stopPropagation(); this.removeThread(t.id); } };
    }) : [];
    const selTVals = selT ? { a: byId[selT.from] ? label(byId[selT.from]) : '—', b: byId[selT.to] ? label(byId[selT.to]) : '—', rel: selT.rel, numText: Component.numText('T', selT.num), why: selT.why || '' } : {};
    const groupsRaw = cs.groups || [], selG = s.selGroup ? groupsRaw.find(g => g.id === s.selGroup) : null;
    const groups = groupsRaw.map(g => { const on = s.selGroup === g.id, mem = this.groupMembers(g, cs.items); return { id: g.id, x: g.x, y: g.y, w: g.w, h: g.h, title: g.title || 'Cluster', count: mem.length ? String(mem.length) : '', border: on ? K.RED : 'rgba(243,241,234,.38)', tabBg: on ? '#fff' : '#f3f1ea', onDown: e => this.groupDown(e, g), onResize: e => this.groupResizeDown(e, g) }; });
    const selGVals = selG ? { title: selG.title || '', count: (() => { const n = this.groupMembers(selG, cs.items).length; return n + (n === 1 ? ' CARD' : ' CARDS'); })(), members: this.groupMembers(selG, cs.items).map(i => ({ numText: Component.numText('E', i.num), label: label(i), onFocus: () => this.focusItem(i.id) })) } : {};
    const connected = new Set(); cs.threads.forEach(t => { connected.add(t.from); connected.add(t.to); });
    const row = i => ({ numText: Component.numText('E', i.num), label: label(i), sub: K.TYPES[i.type].label, onFocus: () => this.focusItem(i.id) });
    const auditGroups = [
      ['UNCONNECTED CARDS', pinnedRaw.filter(i => !connected.has(i.id)).map(row)],
      ['INDICATORS WITHOUT A STAMP', cs.items.filter(i => i.type === 'indicator' && !i.status).map(row)],
      ['EVENTS WITHOUT A DATE', cs.items.filter(i => i.type === 'event' && !i.date).map(row)],
      ['THREADS WITHOUT EVIDENCE', cs.threads.filter(t => !t.why).map(t => ({ numText: Component.numText('T', t.num), label: (byId[t.from] ? label(byId[t.from]) : '?') + ' → ' + (byId[t.to] ? label(byId[t.to]) : '?'), sub: (K.REL[t.rel] || K.REL.linked).label, onFocus: () => this.setState({ selThread: t.id, sel: null, selGroup: null, tab: 'inspector' }) }))],
      ['STALE INDICATORS', cs.items.filter(i => this.isStale(i, V.staleDays)).map(row)],
      ['CARDS WITHOUT A SOURCE', pinnedRaw.filter(i => !i.source && !['note', 'ttp'].includes(i.type)).map(row)],
      ['OPEN TASKS', cs.items.flatMap(i => (i.todo || []).filter(t => !t.done).map(t => ({ numText: t.due && t.due < this.today() ? 'OVERDUE' : (t.due || ''), label: t.text, sub: label(i), onFocus: () => this.focusItem(i.id) })))],
      ['STILL IN THE INBOX', inboxItems.map(row)],
      ['NARRATIVES', Object.entries(cs.items.reduce((m, i) => { if (i.narrative) { const k = i.narrative; m[k] = m[k] || { n: 0, s: 0, o: 0 }; m[k].n++; if (i.stance === 'support') m[k].s++; if (i.stance === 'oppose') m[k].o++; } return m; }, {})).map(([k, v]) => ({ numText: v.n + '×', label: k, sub: v.s + ' support · ' + v.o + ' oppose', onFocus: () => this.setState({ search: k }) }))],
    ];
    const audit = auditGroups.map(([head, rows]) => ({ head, rows, count: String(rows.length), countColor: rows.length ? K.RED : '#3fae63', empty: rows.length === 0 }));
    const logRows = (cs.log || []).slice().reverse().map(l => ({ when: this.fmtWhen(l.t), text: l.m }));
    const snapshots = (cs.snapshots || []).slice().reverse().map(sn => { const show = s.diffId === sn.id, d = show ? this.diffSnapshot(sn, cs) : null; return { id: sn.id, name: sn.name, when: this.fmtWhen(sn.t), border: show ? '#3a3a40' : '#232326', showDiff: show, diffLabel: show ? 'Hide diff' : 'Diff', diffSummary: d ? d.summary : '', diffRows: d ? d.rows : [], onDiff: () => this.setState(st => ({ diffId: st.diffId === sn.id ? null : sn.id })), onRestore: () => this.restoreSnapshot(sn.id), onRemove: () => this.upCase(c => ({ ...c, snapshots: (c.snapshots || []).filter(x => x.id !== sn.id) })) }; });
    const exList = this.exhibits(), exIdx = Math.min(s.presentIdx, Math.max(0, exList.length - 1));
    const mergeTargets = sel ? cs.items.filter(i => i.id !== sel.id && i.type === sel.type).map(i => ({ id: i.id, label: Component.numText('E', i.num) + ' ' + label(i) })) : [];
    const xsearch = q.length >= 2 ? s.cases.filter(c => c.id !== s.activeId).flatMap(c => c.items.filter(i => this.matches(i, q)).slice(0, 4).map(i => ({ caseNum: c.number, label: this.itemLabel(i), type: K.TYPES[i.type].label, onOpen: () => { this.setState({ activeId: c.id, sel: i.id, selThread: null, selGroup: null, pending: null, search: '' }); setTimeout(() => this.focusItem(i.id), 80); } }))).slice(0, 8) : [];
    const reports = (cs.reports || []).slice().reverse().map((r, i, arr) => { const prev = arr[i + 1], show = s.diffReport === r.id; return { id: r.id, name: r.mode === 'exec' ? 'One-pager' : 'Case brief', when: this.fmtWhen(r.t), showDiff: show, diffLabel: show ? 'Hide' : 'Diff vs previous', diffRows: show ? this.reportDiff(prev, r) : [], onDiff: () => this.setState(st => ({ diffReport: st.diffReport === r.id ? null : r.id })) }; });
    const playN = seq ? seq.length : this.playSeq(cs).length;
    const tlpRow = K.TLP.find(t => t[0] === (cs.tlp || '')) || K.TLP[0], J = cs.judgement || {};
    const tasks = sel ? (sel.todo || []).map(t => ({ text: t.text, done: !!t.done, deco: t.done ? 'line-through' : 'none', opacity: t.done ? .5 : 1, meta: [t.owner, t.due ? this.fmtDate(t.due) : ''].filter(Boolean).join(' · '), dueColor: !t.done && t.due && t.due < this.today() ? K.RED : '#8d877b', onToggle: () => this.upCase(c => ({ ...c, items: c.items.map(i => i.id === sel.id ? { ...i, todo: (i.todo || []).map(x => x.id === t.id ? { ...x, done: !x.done } : x) } : i) })), onRemove: () => this.upCase(c => ({ ...c, items: c.items.map(i => i.id === sel.id ? { ...i, todo: (i.todo || []).filter(x => x.id !== t.id) } : i) })) })) : [];
    const comments = sel ? (sel.comments || []).map(cm => ({ by: cm.by, when: this.fmtWhen(cm.at), text: cm.text, mentions: (String(cm.text || '').match(/@([\w.-]+)/g) || []).map(x => x.slice(1)), get hasMentions() { return this.mentions.length > 0; }, onRemove: () => this.upCase(c => ({ ...c, items: c.items.map(i => i.id === sel.id ? { ...i, comments: (i.comments || []).filter(x => x.id !== cm.id) } : i) })) })) : [];
    const xc = this.xcase(sel);
    const hyps = cs.hypotheses || [], ach = cs.ach || [], achItems = pinnedRaw.filter(i => i.status !== 'false').sort((a, b) => (a.num || 0) - (b.num || 0));
    const hypVals = hyps.map(hy => { const n = achItems.filter(i => (cs.ach || {})[i.id + '|' + hy.id] === 'I').length; return { id: hy.id, text: hy.text, score: n + ' inconsistent', scoreColor: n === 0 ? '#3fae63' : n < 3 ? '#e8a71c' : K.RED, onRemove: () => this.upCase(c => ({ ...c, hypotheses: (c.hypotheses || []).filter(x => x.id !== hy.id) })) }; });
    const achRows = hyps.length ? achItems.map(i => ({ numText: Component.numText('E', i.num), label: label(i), cells: hyps.map(hy => { const key = i.id + '|' + hy.id, v = (cs.ach || {})[key] || ''; return { label: v === 'C' ? 'CONSISTENT' : v === 'I' ? 'INCONSISTENT' : v === 'N' ? 'NEUTRAL' : '·', bg: v === 'C' ? '#143d24' : v === 'I' ? '#4a0e14' : v === 'N' ? '#1d1d21' : '#111113', color: v === 'C' ? '#7fe0a0' : v === 'I' ? '#ff8a94' : v ? '#8d877b' : '#3a3a40', onCycle: () => this.upCase(c => { const cur = (c.ach || {})[key] || '', next = cur === '' ? 'C' : cur === 'C' ? 'I' : cur === 'I' ? 'N' : ''; return { ...c, ach: { ...(c.ach || {}), [key]: next } }; }) }; }) })) : [];
    const reqInds = cs.items.filter(i => i.type === 'indicator' && i.value);
    const reqRows = reqInds.map(i => ({ kind: K.KINDS[i.kind] || i.kind, value: this.defang(i.value, i.kind), status: i.status ? (K.STAMP_LABEL[i.status] || '') : '', checked: !!s.req.sel[i.id], onToggle: () => this.setState(st => ({ req: { ...st.req, sel: { ...st.req.sel, [i.id]: !st.req.sel[i.id] } } })) }));
    let aiVals = {};
    if (sel && s.ai.res && s.ai.forId === sel.id) {
      const R = s.ai.res, byNum = Object.fromEntries(cs.items.filter(i => i.num).map(i => ['E' + i.num, i])), stampOk = ['confirmed', 'unverified', 'false'].includes(R.assessment);
      const th = Array.isArray(R.threads) ? R.threads.map(t => { const o = byNum[String(t.to || '').toUpperCase().replace(/^E?/, 'E')]; const rel = K.REL[t.rel] ? t.rel : 'linked'; const exists = o && cs.threads.some(x => (x.from === sel.id && x.to === o.id) || (x.to === sel.id && x.from === o.id)); return o ? { rel: K.REL[rel].label, other: label(o), why: t.why || '', btn: exists ? 'On board' : 'Pin', onPin: () => { if (!exists) this.addThread(sel.id, o.id, rel, t.why || ''); } } : null; }).filter(Boolean) : [];
      aiVals = { summary: R.summary || '', hasStamp: stampOk && (sel.status || '') !== R.assessment, stampLabel: stampOk ? K.STAMP_LABEL[R.assessment] : '', applyStamp: () => { this.upItem(sel.id, { status: R.assessment }); this.logEvt('Stamped ' + String(K.STAMP_LABEL[R.assessment]).toUpperCase() + ' on Claude\'s assessment — ' + label(sel)); },
        hasThreads: th.length > 0, threads: th, hasSteps: Array.isArray(R.next_steps) && R.next_steps.length > 0, steps: Array.isArray(R.next_steps) ? R.next_steps.map(String) : [],
        toNotes: () => { const txt = '\n\nCLAUDE on ' + Component.numText('E', sel.num) + ' ' + label(sel) + ' (' + this.today() + '):\n' + (R.summary || '') + (Array.isArray(R.next_steps) && R.next_steps.length ? '\n- ' + R.next_steps.join('\n- ') : ''); this.upCase(c => ({ ...c, notes: (c.notes || '') + txt })); this.toast('Appended to the case notes'); },
        dismiss: () => this.setState({ ai: { busy: false, forId: null, res: null, err: '' } }) };
    }
    let hoverVals = null;
    if (hov) {
      const T = K.TYPES[hov.type], r0 = this.rect(), v = s.view, PW = hov.image ? Math.min(420, Math.max(280, r0.width - 40)) : 236, PAD = 10, ch = this.h(hov.id);
      const right = (hov.x + T.w) * v.z + v.x + 14, left = hov.x * v.z + v.x - PW - 14;
      let px = right + PW + PAD > r0.width ? left : right; if (px < PAD) px = right + PW + PAD > r0.width ? Math.max(PAD, r0.width - PW - PAD) : right;
      let py = hov.y * v.z + v.y; const maxH = Math.max(120, r0.height - 2 * PAD); py = Math.min(py, r0.height - PAD - Math.min(maxH, 320)); py = Math.max(PAD, py);
      const meta = [hov.date ? this.fmtDate(hov.date) : '', hov.type === 'indicator' ? (K.KINDS[hov.kind] || hov.kind) : '', hov.status && K.STAMP_LABEL[hov.status] ? K.STAMP_LABEL[hov.status] : '', ...this.tagList(hov.tags).map(t => '#' + t)].filter(Boolean).join(' · ');
      hoverVals = {
        x: Math.round(px), y: Math.round(py), maxH, w: PW, hasImage: !!hov.image, image: hov.image || '', numText: Component.numText('EXHIBIT ', hov.num) || 'EXHIBIT', typeLabel: T.label, title: label(hov), meta, hasMeta: !!meta,
        linkHead: hovT.length ? hovT.length + (hovT.length === 1 ? ' thread' : ' threads') : 'No threads yet · drag the pin to connect',
        links: hovT.map(t => { const o = byId[t.from === hov.id ? t.to : t.from], r = K.REL[t.rel] || K.REL.linked; return { numText: Component.numText('T', t.num), other: o ? label(o) : '—', rel: r.label, color: r.color }; }),
      };
    }

    const tabs = [['inspector', 'Inspector'], ['threads', 'Threads'], ['audit', 'Audit'], ['log', 'Log'], ['notes', 'Notes']].map(([id, lbl]) => ({ id, label: lbl, bg: s.tab === id ? '#17171a' : 'transparent', color: s.tab === id ? '#fff' : '#8d877b', border: s.tab === id ? K.RED : 'transparent', onClick: () => this.setState({ tab: id }) }));
    const spools = K.RELS.map(r => ({ id: r.id, label: r.label, color: r.color, bg: s.rel === r.id ? '#1d1d21' : 'transparent', border: s.rel === r.id ? r.color : '#2c2c31', onPick: () => this.setState({ rel: r.id }) }));
    const addTypes = K.ORDER.map(t => ({ id: t, label: K.TYPES[t].label, onAdd: () => this.addItem(t) }));
    const typeChips = K.ORDER.map(t => ({ id: t, label: K.TYPES[t].label, bg: s.hidden[t] ? 'transparent' : '#1d1d21', color: s.hidden[t] ? '#5f5a52' : '#d8d3c7', deco: s.hidden[t] ? 'line-through' : 'none', onToggle: () => this.setState(st => ({ hidden: { ...st.hidden, [t]: !st.hidden[t] } })) }));
    const inbox = inboxItems.map(it => ({
      id: it.id, typeLabel: K.TYPES[it.type].label, label: label(it), sub: it.type === 'indicator' ? (K.KINDS[it.kind] || it.kind) + (it.body ? ' · ' + it.body : '') : (it.url || it.body || ''), bg: s.sel === it.id ? '#1d1d21' : 'transparent',
      onDragStart: e => this.inboxDragStart(e, it), onSelect: () => this.setState({ sel: it.id, selThread: null, tab: 'inspector', showRight: true }), onPin: e => { e.stopPropagation(); this.pinItem(it.id); },
    }));
    const sugg = (P.autoSuggest ?? true) ? this.suggestions(cs).map(sg => ({
      a: label(sg.a), b: label(sg.b), reason: sg.shared, relLabel: K.REL[sg.rel].label, color: K.REL[sg.rel].color,
      onAccept: () => this.addThread(sg.a.id, sg.b.id, sg.rel), onDismiss: () => this.upCase(c => ({ ...c, dismissed: [...(c.dismissed || []), sg.a.id + '|' + sg.b.id] })),
    })) : [];
    const threadRows = cs.threads.map(t => {
      const r = K.REL[t.rel] || K.REL.linked;
      return { id: t.id, a: byId[t.from] ? label(byId[t.from]) : '—', b: byId[t.to] ? label(byId[t.to]) : '—', relLabel: r.label, color: r.color, border: s.selThread === t.id ? K.RED : '#232326', onSelect: () => this.setState({ selThread: t.id, sel: null, tab: 'inspector' }), onRemove: e => { e.stopPropagation(); this.removeThread(t.id); } };
    });
    const timeline = cs.items.filter(i => i.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).map(i => ({
      id: i.id, dateLabel: this.fmtDate(i.date), title: label(i), color: K.TYPE_COLOR[i.type] || K.RED, opacity: i.pinned ? 1 : .45,
      dateColor: s.sel === i.id ? K.RED : '#8d877b', ring: s.sel === i.id ? K.RED : 'transparent', onFocus: () => this.focusItem(i.id),
    }));
    const nbOf = id => new Set(cs.threads.filter(t => t.from === id || t.to === id).map(t => t.from === id ? t.to : t.from));
    threads.forEach(th => { const t = cs.threads.find(x => x.id === th.id); if (!t) return; if (!t.width) { const shared = [...nbOf(t.from)].filter(x => nbOf(t.to).has(x)).length, strength = (t.why ? 1 : 0) + (t.note ? 1 : 0) + shared; if (strength) th.width = Math.min(6, (+th.width || 2) + strength * .6); } if (t.style === 'dashed') th.dash = '12 9'; else if (t.style === 'dotted') th.dash = '2 8'; else if (t.style === 'solid') th.dash = '0'; if (t.width) th.width = +t.width; th.hasNote = !!t.note; th.note = t.note || ''; th.markerEnd = t.arrow === 'to' || t.arrow === 'both' ? 'url(#arrowHead)' : 'none'; th.markerStart = t.arrow === 'from' || t.arrow === 'both' ? 'url(#arrowHead)' : 'none'; });
    cards.forEach(c => { const it = byId[c.id] || {}, hh = this.hash(c.id); c.anim = V.flutter && !s.play.on && !(this.drag && this.drag.id === c.id) ? 'flutter ' + (6 + hh % 5) + 's ease-in-out ' + (-(hh % 7)) + 's infinite' : 'none'; c.clip = 'none'; c.bodyFont = (it.hand || V.handwriting) ? "19px/1.15 'Reenie Beanie',cursive" : "11px/1.35 'IBM Plex Mono',monospace"; if (playCur && playCur.k === 'i' && playCur.id === c.id) { c.title = this.typeWords(c.title, playProg * 1.6); c.body = this.typeWords(c.body, Math.max(0, playProg * 1.4 - .3)); c.clip = 'inset(0 0 ' + Math.round((1 - Math.min(1, playProg * 1.25)) * 100) + '% 0)'; } });
    const hint = s.linking ? 'Release over a card to pin the thread' : isGeo ? 'Geo view: every located card on one map · G to return' : isList ? 'List view: exhibits in number order · tap a card to open it' : isTL ? 'Timeline view: cards sit by date, undated ones on the shelf · T to return to the board' : isKC ? (lay && lay.empty ? 'Kill chain: add technique cards (t T1566) to see lanes · K to return' : 'Kill chain: techniques by tactic, linked evidence beneath · K to return') : s.reveal ? (sel || selT ? 'Reveal: showing the selection and its direct threads · R to exit' : 'Reveal: select a card or thread to isolate it') : s.tool === 'connect' ? (s.pending ? 'Now click the second card' : 'Click the first card, then the second') : 'Drag cards · drag the board to pan · wheel to zoom · drag a pin onto another card to connect';
    const v = s.view;

    return {
      activeId: s.activeId, caseOptions: s.cases.filter(c => !window.CIBAuth || !this.user || window.CIBAuth.canSee(this.user, c)).map(c => ({ id: c.id, label: c.number + ' · ' + c.title })), caseTitle: cs.title,
      userName: this.user ? this.user.name + ' · ' + (window.CIBAuth ? window.CIBAuth.roleLabel(this.user.role) : this.user.role) + (this.canEditCase() ? '' : ' · read-only') : 'No session', userDot: this.user ? (this.canEditCase() ? '#3fae63' : '#e8a71c') : '#8d877b', userTitle: this.user ? 'Signed in as ' + this.user.name : '',
      onSwitchCase: this.onSwitchCase, onCaseTitle: this.onCaseTitle, newCase: this.newCase, deleteCase: this.deleteCase,
      search: s.search, onSearch: this.onSearch, exportPng: this.exportPng, exportJson: this.exportJson, importJson: this.importJson, onImportFile: this.onImportFile, onImageFile: this.onImageFile,
      toolMove: () => this.setState({ tool: 'move', pending: null }), toolConnect: () => this.setState({ tool: 'connect' }),
      toggleReveal: () => this.setState(st => ({ reveal: !st.reveal })),
      revBg: s.reveal ? '#f3f1ea' : '#17171a', revFg: s.reveal ? '#1b1a17' : '#d8d3c7', revBorder: s.reveal ? '#f3f1ea' : '#2c2c31',
      exportBrief: this.exportBrief, flowLayer: this.flowLayer(threads, V),
      stampOpts: K.STAMPS.map(([id, lbl, col]) => { const on = !!sel && (sel.status || '') === id; return { id, label: lbl, border: on ? (col || '#f3f1ea') : '#2c2c31', bg: on ? '#1d1d21' : 'transparent', color: on ? (col || '#fff') : '#8d877b', onPick: () => { if (!sel) return; this.upItem(sel.id, { status: id }); this.logEvt((id ? 'Stamped ' + lbl.toUpperCase() : 'Stamp removed') + ' — ' + label(sel)); } }; }),
      confOpts: K.CONF.map(([id, lbl]) => { const on = !!selT && (selT.conf || 'high') === id; return { id, label: lbl, border: on ? K.RED : '#2c2c31', bg: on ? '#1d1d21' : 'transparent', color: on ? '#fff' : '#8d877b', onPick: () => { if (!selT) return; this.upCase(c => ({ ...c, threads: c.threads.map(t => t.id === selT.id ? { ...t, conf: id } : t) })); this.logEvt('Confidence ' + lbl.toLowerCase() + ' — ' + selTVals.a + ' → ' + selTVals.b); } }; }),
      pivots: sel ? this.pivots(sel) : [], hasPivots: !!sel && (sel.type === 'indicator' || this.pivots(sel).length > 0),
      chains: K.CHAINS, setChain: this.setter('chain'), setAmount: this.setter('amount'), setTxFrom: this.setter('txFrom'), setTxTo: this.setter('txTo'),
      actorsOpen: s.actorsOpen, openActors: this.openActors, closeActors: this.closeActors, actors: K.ACTORS.map(a => ({ name: a.name, aliases: a.aliases.join(', '), origin: a.origin, motive: a.motive, summary: a.summary, techniques: a.techniques, onDrop: () => this.dropActor(a) })),
      exportStix: this.exportStix, analyse: this.analyse, aiLabel: s.ai.busy && sel && s.ai.forId === sel.id ? 'Thinking…' : 'Analyse with Claude', aiNote: sel && s.ai.forId === sel.id && s.ai.err ? 'Failed: ' + s.ai.err : 'Reads the whole board, suggests threads',
      hasAi: !!sel && !!s.ai.res && s.ai.forId === sel.id, ai: aiVals,
      worldFilter: [V.mood === 'cold case' ? 'sepia(.42) contrast(.9) brightness(.9)' : '', this.theme().filter !== 'none' ? this.theme().filter : ''].filter(Boolean).join(' ') || 'none', lightLamp: V.lighting === 'lamp',
      boardBg: this.theme().boardBg, boardGrad: this.theme().boardGrad,
      copySelValue: () => { if (!sel) return; const txt = this.display(sel, V); if (navigator.clipboard && txt) navigator.clipboard.writeText(txt).then(() => this.toast('Copied ' + txt)); },
      copyLabel: V.defang ? 'defanged' : 'raw', setTechnique: this.setTechnique, attackCatalog: K.ATTACK.map(a => ({ label: a[0] + ' — ' + a[1] })), tactics: K.TACTICS,
      extractOpen: s.extract.open, extractText: s.extract.text, openExtract: this.openExtract, closeExtract: this.closeExtract, onExtractText: this.onExtractText, runExtract: this.runExtract,
      extractRows: s.extract.rows.map((r, i) => ({ kindLabel: K.KINDS[r.kind] || r.kind, display: V.defang ? this.defang(r.value, r.kind) : r.value, known: r.known, checked: r.checked, opacity: r.known ? .45 : 1, note: r.known ? 'already on the case' : '', onToggle: () => this.setState(st => ({ extract: { ...st.extract, rows: st.extract.rows.map((x, j) => j === i ? { ...x, checked: !x.checked } : x) } })) })),
      hasExtract: s.extract.rows.length > 0, extractSummary: s.extract.rows.length ? s.extract.rows.length + ' found · ' + s.extract.rows.filter(r => !r.known).length + ' new' : '',
      addExtractInbox: () => this.addExtracted(false), addExtractBoard: () => this.addExtracted(true),
      moveBg: s.tool === 'move' ? '#f3f1ea' : '#17171a', moveFg: s.tool === 'move' ? '#1b1a17' : '#d8d3c7', moveBorder: s.tool === 'move' ? '#f3f1ea' : '#2c2c31',
      connBg: s.tool === 'connect' ? K.RED : '#17171a', connFg: s.tool === 'connect' ? '#fff' : '#d8d3c7', connBorder: s.tool === 'connect' ? K.RED : '#2c2c31',
      spools, hint, zoomLabel: Math.round(v.z * 100) + '%',
      zoomOut: () => { const r = this.rect(); this.zoomAt(r.width / 2, r.height / 2, 1 / 1.25); }, zoomIn: () => { const r = this.rect(); this.zoomAt(r.width / 2, r.height / 2, 1.25); }, fitBtn: () => this.fit(),
      toggleInbox: () => this.setState(st => ({ showInbox: !st.showInbox })), toggleRight: () => this.setState(st => ({ showRight: !st.showRight })),
      inboxBg: s.showInbox ? '#2a2a2e' : '#17171a', rightBg: s.showRight ? '#2a2a2e' : '#17171a',
      showInbox: s.showInbox, inboxCount: inboxItems.length + ' unpinned', addTypes, typeChips, inbox, inboxEmpty: inboxItems.length === 0,
      boardDown: this.boardDown, allowDrop: this.allowDrop, boardDrop: this.boardDrop, stop: this.stop,
      worldTransform: 'translate(' + v.x + 'px, ' + v.y + 'px) scale(' + v.z + ')',
      lightSpot: V.lighting === 'spotlight', lightHarsh: V.lighting === 'harsh',
      cards, threads, isLinking: !!s.linking,
      linkX1: s.linking && byId[s.linking.from] ? this.pin(byId[s.linking.from]).x : 0, linkY1: s.linking && byId[s.linking.from] ? this.pin(byId[s.linking.from]).y : 0,
      linkX2: s.linking ? s.linking.x : 0, linkY2: s.linking ? s.linking.y : 0, linkColor: (K.REL[s.rel] || K.REL.linked).color,
      boardEmpty: pinned.length === 0, hasToast: !!s.toast, toast: s.toast,
      showRight: s.showRight, tabs, tabInspector: s.tab === 'inspector', tabThreads: s.tab === 'threads', tabNotes: s.tab === 'notes',
      tlp: cs.tlp || '', tlps: K.TLP.map(t => ({ id: t[0], label: t[1] })), tlpColor: tlpRow[2], tlpInk: tlpRow[3], tlpLabel: tlpRow[1], hasTlpBanner: !!cs.tlp, setTlp: e => { const v = e.target.value; this.upCase(c => ({ ...c, tlp: v })); this.logEvt('Handling set to ' + ((K.TLP.find(t => t[0] === v) || K.TLP[0])[1])); },
      review: cs.review || 'draft', reviewColor: (cs.review || 'draft') === 'published' ? '#3fae63' : (cs.review === 'in review' ? '#e8a71c' : '#8d877b'), setReview: this.setReview,
      analyst: s.analyst || '', onAnalyst: e => this.setState({ analyst: e.target.value }),
      srcGrades: K.SRC_GRADES.map(g => ({ id: g[0], label: g[1] })), infoGrades: K.INFO_GRADES.map(g => ({ id: g[0], label: g[1] })),
      setSource: this.setter('source'), setCollected: this.setter('collected'), setSrcGrade: this.setter('srcGrade'), setInfoGrade: this.setter('infoGrade'), setItemTlp: this.setter('tlp'), setFirstSeen: this.setter('firstSeen'), setLastSeen: this.setter('lastSeen'), setSector: this.setter('sector'), setRegion: this.setter('region'), setImpact: this.setter('impact'),
      hasXCase: xc.length > 0, xcase: xc,
      tasks, taskCount: String(tasks.filter(t => !t.done).length) + ' open', taskText: s.taskText, taskDue: s.taskDue, onTaskText: e => this.setState({ taskText: e.target.value }), onTaskDue: e => this.setState({ taskDue: e.target.value }), onTaskKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.addTask(); } },
      comments, commentCount: String(comments.length), commentText: s.commentText, onCommentText: e => this.setState({ commentText: e.target.value }), onCommentKey: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.addComment(); } },
      judgement: { text: J.text || '', dissent: J.dissent || '' }, setJudgeText: e => { const v = e.target.value; this.upCase(c => ({ ...c, judgement: { ...(c.judgement || {}), text: v } })); }, setJudgeDissent: e => { const v = e.target.value; this.upCase(c => ({ ...c, judgement: { ...(c.judgement || {}), dissent: v } })); },
      confLevels: K.CONF_LEVELS.map(([id, lbl]) => { const on = (J.confidence || '') === id; return { label: lbl, border: on ? K.RED : '#2c2c31', bg: on ? '#1d1d21' : 'transparent', color: on ? '#fff' : '#8d877b', onPick: () => { this.upCase(c => ({ ...c, judgement: { ...(c.judgement || {}), confidence: id } })); this.logEvt('Judgement confidence → ' + id); } }; }),
      signoffText: cs.signoff ? 'Signed off by ' + cs.signoff.by + ' · ' + this.fmtWhen(cs.signoff.at) : ((cs.review || 'draft') === 'draft' ? 'Draft · not yet reviewed' : 'In review · not signed off'),
      achOpen: s.achOpen, openAch: this.openAch, closeAch: this.closeAch, hypText: s.hypText, onHypText: e => this.setState({ hypText: e.target.value }), onHypKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.addHyp(); } }, hyps: hypVals, hypCount: hyps.length, hasHyps: hyps.length > 0, noHyps: hyps.length === 0, achRows,
      reqOpen: s.reqOpen, openReq: this.openReq, closeReq: this.closeReq, req: { kind: s.req.kind, to: s.req.to }, onReqKind: e => { const v = e.target.value; this.setState(st => ({ req: { ...st.req, kind: v } })); }, onReqTo: e => { const v = e.target.value; this.setState(st => ({ req: { ...st.req, to: v } })); }, reqRows, noReqRows: reqRows.length === 0, reqCount: String(reqRows.filter(r => r.checked).length), reqAll: () => this.setState(st => ({ req: { ...st.req, sel: Object.fromEntries(reqInds.map(i => [i.id, true])) } })), reqNone: () => this.setState(st => ({ req: { ...st.req, sel: {} } })), reqOpenLetter: this.reqOpenLetter, reqCopy: this.reqCopy,
      osintOpen: s.osintOpen, openOsint: () => this.openOsint(), closeOsint: this.closeOsint, onOsintQ: e => { const v = e.target.value; this.setState(st => ({ osint: { ...st.osint, q: v } })); }, onOsintKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.runOsint(); } }, runOsint: this.runOsint,
      osintIdle: !s.osint.ran, osintRan: s.osint.ran, osint: { q: s.osint.q, value: s.osint.value, typeLabel: ({ domain: 'Domain', ip: 'IP address', url: 'URL', email: 'Email', handle: 'Username', hash: 'File hash', wallet: 'Wallet', cve: 'CVE', phone: 'Phone', org: 'Organisation', name: 'Person' })[s.osint.type] || '' },
      osintTypes: [['domain', 'Domain'], ['ip', 'IP'], ['email', 'Email'], ['handle', 'Username'], ['hash', 'Hash'], ['wallet', 'Wallet'], ['cve', 'CVE'], ['phone', 'Phone'], ['name', 'Person'], ['org', 'Company']].map(([id, lbl]) => { const d = this.osintDetect(s.osint.q)[0], on = d === id; return { label: lbl, border: on ? K.RED : '#2c2c31', bg: on ? '#1d1d21' : 'transparent', color: on ? '#fff' : '#8d877b', onPick: () => { if (!s.osint.q.trim()) return; const v = s.osint.q.trim(); const looks = this.osintLookups(id, v); this.setState(st => ({ osint: { ...st.osint, type: id, value: v, ran: true, live: looks.map(l => ({ id: l.id, label: l.label, href: l.href, status: 'busy', lines: [] })) } })); looks.forEach(l => Promise.resolve().then(() => l.run()).then(lines => this.setOsintLine(l.id, 'ok', (lines || []).filter(Boolean).slice(0, 10))).catch(e => this.setOsintLine(l.id, 'blocked', [/Failed to fetch|NetworkError|Load failed/i.test(String(e && e.message)) ? 'Blocked by the browser — open it in a new tab' : String(e && e.message || e)]))); } }; }),
      osintExamples: [['harb0r-cu-login[.]com', 'harb0r-cu-login[.]com'], ['8.8.8.8', '8.8.8.8'], ['CVE-2024-3400', 'CVE-2024-3400'], ['@torvalds', '@torvalds'], ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'], ['Binance Holdings Ltd', 'Binance Holdings Ltd']].map(([lbl, v]) => ({ label: lbl, onPick: () => this.openOsint(v) })),
      osintLive: s.osint.live.map(l => ({ ...l, accent: l.status === 'ok' ? '#3fae63' : l.status === 'busy' ? '#e8a71c' : K.RED, status: l.status === 'ok' ? 'live' : l.status === 'busy' ? 'querying…' : 'blocked', hasHref: !!l.href })), osintLiveCount: String(s.osint.live.length), osintNoLive: s.osint.ran && s.osint.live.length === 0,
      osintLaunchers: s.osint.ran ? this.osintLaunchers(s.osint.type, s.osint.value) : [], osintStatus: s.osint.live.some(l => l.status === 'busy') ? 'Querying…' : (s.osint.live.filter(l => l.status === 'ok').length + ' live · ' + s.osint.live.filter(l => l.status === 'blocked').length + ' blocked'),
      osintPin: this.osintPin, osintPinLabel: s.osint.pinnedId ? 'Pinned ✓' : 'Pin as card', osintCopy: this.osintCopy, selToOsint: () => sel && this.openOsint(this.refang(sel.value || '')),
      isHome: s.screen === 'home' && !s.locked && !window.CIBAuth, goHome: () => { if (window.CIBAuth) location.href = "/desk.html"; else this.goHome(); }, saveNow: this.saveNow, exportAll: this.exportAll, saveLabel: s.savedAt ? 'Saved ' + this.fmtWhen(s.savedAt) : 'Save now',
      homeStats: s.cases.length + (s.cases.length === 1 ? ' case file' : ' case files') + ' · ' + s.cases.reduce((n, c) => n + c.items.length, 0) + ' exhibits · ' + s.cases.reduce((n, c) => n + c.threads.length, 0) + ' threads' + (s.analyst ? ' · ' + s.analyst : ''),
      storageNote: this.cryptoKey ? 'encrypted at rest' : 'unencrypted — use Encrypt for shared machines',
      folders: s.cases.filter(c => !window.CIBAuth || !this.user || window.CIBAuth.canSee(this.user, c)).map((c, idx) => {
        const hov = s.hoverCase === c.id, op = s.opening === c.id, tl = K.TLP.find(t => t[0] === (c.tlp || '')) || K.TLP[0], rv = c.review || 'draft', last = (c.log || []).length ? (c.log || [])[(c.log || []).length - 1] : null;
        const sheets = c.items.filter(i => i.pinned).sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 3).reverse().map((i, k, arr) => ({ type: K.TYPES[i.type].label, label: this.itemLabel(i), x: 6 + k * 10, r: 26 - k * 10, y: 16 - k * 7, rot: (k - 1) * 1.5 }));
        return {
          id: c.id, number: c.number, title: c.title, delay: Math.min(idx * 70, 600), sheets, renaming: s.renameId === c.id, notRenaming: s.renameId !== c.id,
          meta: [rv === 'published' && c.signoff ? 'signed ' + c.signoff.by : rv.toUpperCase(), c.judgement && c.judgement.confidence ? c.judgement.confidence + ' confidence' : ''].filter(Boolean).join(' · '),
          counts: c.items.filter(i => i.pinned).length + ' exhibits · ' + c.threads.length + ' threads · ' + c.items.filter(i => !i.pinned).length + ' in inbox', last: last ? 'Last activity ' + this.fmtWhen(last.t) : 'No activity yet',
          stamp: rv === 'published' ? 'Published' : rv === 'in review' ? 'In review' : 'Draft', stampColor: rv === 'published' ? '#1f7a3d' : rv === 'in review' ? '#9a6b12' : '#5a5650',
          tlpColor: c.tlp ? tl[2] : 'transparent', tlpInk: tl[3], tlpLabel: c.tlp ? tl[1].replace('TLP:', '') : '', tlpH: c.tlp ? 34 : 0,
          lift: op ? 'translateY(-18px) scale(1.08)' : hov ? 'translateY(-8px)' : 'none', opacity: op ? 0 : 1,
          cover: op ? 'rotateY(-70deg)' : hov ? 'rotateY(-34deg)' : 'rotateY(0deg)', papers: op || hov ? 'translateY(-14px)' : 'translateY(0)',
          shadow: hov || op ? '0 26px 40px rgba(0,0,0,.75)' : '0 10px 18px rgba(0,0,0,.6)', coverShadow: hov || op ? '14px 10px 30px rgba(0,0,0,.55)' : '2px 2px 6px rgba(0,0,0,.35)',
          onEnter: () => this.setState({ hoverCase: c.id }), onLeave: () => { if (this.state.hoverCase === c.id) this.setState({ hoverCase: null }); },
          onOpen: e => { if (e && e.stopPropagation) e.stopPropagation(); this.openCase(c.id); }, onKey: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openCase(c.id); } },
          onRename: e => { e.stopPropagation(); this.setState({ renameId: c.id }); }, onTitle: e => { const v = e.target.value; this.setState(st => ({ cases: st.cases.map(x => x.id === c.id ? { ...x, title: v } : x) })); }, onTitleKey: e => { if (e.key === 'Enter' || e.key === 'Escape') this.setState({ renameId: null }); }, onTitleDone: () => this.setState({ renameId: null }),
          onDup: e => { e.stopPropagation(); this.dupCase(c.id); }, onExport: e => { e.stopPropagation(); this.exportCaseById(c.id); }, onDelete: e => { e.stopPropagation(); this.deleteCaseById(c.id); },
        };
      }),
      hasMergeTargets: !!sel && mergeTargets.length > 0, mergeTargets, mergeTo: s.mergeTo, onMergeTo: e => this.setState({ mergeTo: e.target.value }), doMerge: () => { if (!sel || !s.mergeTo) return this.toast('Pick the card to merge into'); if (window.confirm('Merge "' + label(sel) + '" into the selected card?')) this.mergeInto(sel.id, s.mergeTo); },
      hasXSearch: xsearch.length > 0, xsearch, xsearchCount: String(xsearch.length),
      tplOpen: s.tplOpen, closeTpl: () => this.setState({ tplOpen: false }), templates: K.TEMPLATES.map(t => ({ name: t.name, blurb: t.blurb, meta: t.id === 'blank' ? '' : t.items.length + ' cards · ' + t.hyps.length + ' hypotheses · ' + t.tasks.length + ' tasks' + (t.tlp ? ' · TLP:' + t.tlp.toUpperCase() : ''), onPick: () => this.createCase(t) })),
      playOn: s.play.on, playLabel: s.play.on && !s.play.paused ? 'Pause' : 'Play', playToggle: this.playToggle, playStop: this.playStop, playMax: String(playN), playIdx: String(s.play.on ? s.play.idx : playN), onPlayIdx: e => { const v = +e.target.value; if (this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; } this.setState({ play: { on: true, idx: v, paused: true } }); }, playPos: (s.play.on ? s.play.idx : playN) + ' / ' + playN, playHint: s.play.on ? 'Scrub or press Play; threads appear after the cards they join. Exit restores the full board.' : 'Replays the board in the order exhibits and threads were pinned.',
      reports, reportCount: String((cs.reports || []).length), noReports: !(cs.reports || []).length,
      lockOpen: s.lockOpen, openLock: () => this.setState({ lockOpen: true, lockPass: '' }), closeLock: () => this.setState({ lockOpen: false, lockPass: '' }), lockPass: s.lockPass, onLockPass: e => this.setState({ lockPass: e.target.value }), onLockKey: e => { if (e.key === 'Enter') this.lockSet(); }, onUnlockKey: e => { if (e.key === 'Enter') this.unlock(); },
      lockSet: this.lockSet, lockClear: this.lockClear, lockHas: !!this.cryptoKey, lockSetLabel: this.cryptoKey ? 'Change passphrase' : 'Encrypt saved cases', lockLabel: this.cryptoKey ? 'Encrypted' : 'Encrypt', lockColor: this.cryptoKey ? '#3fae63' : '#d8d3c7', lockTitle: this.cryptoKey ? 'Saved cases are encrypted in this browser — click to change or remove the passphrase' : 'Encrypt the saved cases in this browser with a passphrase',
      lockBlurb: this.cryptoKey ? 'Cases are encrypted with AES-256-GCM before they touch browser storage. Change the passphrase or remove it to store cases in the clear again.' : 'Set a passphrase and every save is encrypted with AES-256-GCM (key derived with PBKDF2, 310k rounds). You will be asked for it whenever the board opens. There is no recovery: forgetting it means wiping the saved cases.',
      locked: s.locked, lockErr: !!s.lockErr, lockErrText: s.lockErr, unlock: this.unlock, lockWipe: () => { if (window.confirm('Wipe the encrypted cases saved in this browser and start over?')) { localStorage.removeItem(K.KEY); location.reload(); } },
      mobile: s.mobile, toggleList: this.toggleList, listLabel: isList ? 'Board' : 'List', panelLabel: s.showRight ? 'Close' : 'Panel', asideW: s.mobile ? '100%' : '300px', asidePos: s.mobile ? 'fixed' : 'relative', asideInset: s.mobile ? '0' : 'auto',
      exportOnePager: this.exportOnePager, toggleKillchain: this.toggleKillchain, kcBg: isKC ? '#f3f1ea' : '#17171a', kcFg: isKC ? '#1b1a17' : '#d8d3c7', kcBorder: isKC ? '#f3f1ea' : '#2c2c31',
      chrome: !s.present && !s.mobile, present: s.present, togglePresent: this.togglePresent, presentLabel: exList.length ? 'EXHIBIT ' + String(exIdx + 1).padStart(2, '0') + ' / ' + String(exList.length).padStart(2, '0') : 'NO EXHIBITS', caseNumber: cs.number,
      showInboxUI: s.showInbox && !s.present && !s.mobile, showRightUI: s.showRight && !s.present,
      quick: s.quick, onQuick: this.onQuick, onQuickKey: this.onQuickKey,
      toggleTimeline: this.toggleTimeline, isTimeline: hasLay, tlBg: isTL ? '#f3f1ea' : '#17171a', tlFg: isTL ? '#1b1a17' : '#d8d3c7', tlBorder: isTL ? '#f3f1ea' : '#2c2c31',
      tlAxis: lay ? lay.axis : [], tlShelf: !!(lay && lay.shelfY != null), tlShelfY: lay && lay.shelfY != null ? lay.shelfY - 24 : 0, tlWidth: lay ? lay.width : 0, tlShelfLabel: lay && lay.shelfLabel ? lay.shelfLabel : 'UNDATED',
      showGroups: !hasLay, groups, addGroup: () => this.addGroup(), hasSelGroup: !!selG, selG: selGVals, setGroupTitle: e => { const v = e.target.value; selG && this.upCase(c => ({ ...c, groups: (c.groups || []).map(g => g.id === selG.id ? { ...g, title: v } : g) })); }, deleteGroup: () => selG && this.removeGroup(selG.id),
      setThreadWhy: e => { const v = e.target.value; selT && this.upCase(c => ({ ...c, threads: c.threads.map(t => t.id === selT.id ? { ...t, why: v } : t) })); },
      setThreadNote: e => { const v = e.target.value; selT && this.upThread(selT.id, { note: v }); }, setThreadStyle: e => { const v = e.target.value; selT && this.upThread(selT.id, { style: v }); }, setThreadArrow: e => { const v = e.target.value; selT && this.upThread(selT.id, { arrow: v }); }, setThreadWidth: e => { const v = e.target.value; selT && this.upThread(selT.id, { width: v }); }, threadMidPin: this.threadMidPin, midPinLabel: selT && selT.wp ? 'Remove mid-pin' : 'Add mid-pin', addCustomRel: this.addCustomRel, threadAddNote: this.threadAddNote,
      wpPins: hasLay ? [] : cs.threads.filter(t => t.wp && byId[t.from] && byId[t.to] && byId[t.from].pinned && byId[t.to].pinned).map(t => ({ x: t.wp.x, y: t.wp.y, onDown: this.wpDown(t) })),
      modeRoles: (Component.MODES[cs.domain || 'investigation'] || Component.MODES.investigation).roles, boardMode: cs.domain || 'investigation', modeList: Object.keys(Component.MODES).map(id => ({ id, label: Component.MODES[id].label })).concat([{ id: 'example-homicide', label: '▶ Example: Whitechapel 1888 (homicide)' }]), onBoardMode: this.setMode,
      ...(() => { const rm = this.relMemory(sel, cs); return { hasRelMem: rm.length > 0, relMem: rm, relMemCount: String(rm.length) }; })(),
      navBack: () => history.back(), navFwd: () => history.forward(), navReload: () => location.reload(), navUndo: () => this.undo(), themeSel: this.deskTheme || 'noir', themeList: Component.THEME_IDS.map(id => ({ id, label: Component.THEMES[id].label })), onThemeSel: e => { const v = e.target.value; this.deskTheme = v; try { const d = JSON.parse(localStorage.getItem('cyber-investigation-board.desk.v1') || '{}'); d.theme = v; localStorage.setItem('cyber-investigation-board.desk.v1', JSON.stringify(d)); } catch (err) {} this.forceUpdate(); }, clock: s.clock,
      fullscreen: this.fullscreen, fsLabel: document.fullscreenElement ? 'Exit full screen' : 'Full screen', watermark: s.present ? 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><text x="20" y="120" transform="rotate(-20 210 110)" font-family="monospace" font-size="18" fill="#ffffff">' + ((this.user && this.user.name) || (s.analyst || 'viewer')) + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</text></svg>') + '")' : 'none', rainOn: V.rain,
      ...(() => { const nl = this.notifList(), unread = nl.filter(n => n.unread).length; return { notifOpen: s.notifOpen, openNotifs: this.openNotifs, closeNotifs: this.closeNotifs, markNotifsRead: this.markNotifsRead, digestMail: this.digestMail, notifCount: String(unread), bellColor: unread ? K.RED : '#8d877b', noNotifs: nl.length === 0, notifs: nl.map(n => ({ color: n.unread ? ({ mention: '#4ea1e8', overdue: K.RED, feed: '#e07a2f', monitor: '#2fc4b2', wallet: '#e8a71c', review: '#9b6bff' })[n.kind] || '#8d877b' : '#3a3a40', text: n.text, meta: [n.kind, n.t ? this.fmtWhen(n.t) : ''].filter(Boolean).join(' · '), onOpen: () => this.jumpTo(n.caseId, n.itemId) })) }; })(),
      ...(() => { const all = this.allTasks(), today = this.today(), wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), row = t => ({ text: t.text, meta: [t.caseNo, t.itemLabel, t.owner, t.due ? this.fmtDate(t.due) : ''].filter(Boolean).join(' · '), toggleLabel: t.done ? 'Reopen' : 'Done', onToggle: () => this.toggleTaskIn(t.caseId, t.itemId, t.id), onOpen: () => this.jumpTo(t.caseId, t.itemId) }), cols = [['OVERDUE', K.RED, t => !t.done && t.due && t.due < today], ['THIS WEEK', '#e8a71c', t => !t.done && t.due && t.due >= today && t.due <= wk], ['LATER', '#4ea1e8', t => !t.done && t.due && t.due > wk], ['NO DATE', '#8d877b', t => !t.done && !t.due], ['DONE', '#3fae63', t => t.done]], cm = s.calMonth || new Date().toISOString().slice(0, 7), yy = +cm.slice(0, 4), mm = +cm.slice(5, 7), first = new Date(yy, mm - 1, 1), start = (first.getDay() + 6) % 7, days = new Date(yy, mm, 0).getDate(), cells = []; for (let k = 0; k < start; k++) cells.push({ n: '', bg: 'transparent', color: '#5f5a52', items: [] }); for (let d = 1; d <= days; d++) { const iso = yy + '-' + String(mm).padStart(2, '0') + '-' + String(d).padStart(2, '0'), its = all.filter(t => t.due === iso); cells.push({ n: String(d), bg: iso === today ? '#1d1d21' : 'transparent', color: iso === today ? K.RED : '#8d877b', items: its.map(t => ({ text: t.text, title: t.caseNo + ' · ' + t.itemLabel, color: t.done ? '#5f5a52' : iso < today ? K.RED : '#f3f1ea', onOpen: () => this.jumpTo(t.caseId, t.itemId) })) }); } return { tasksOpen: s.tasksOpen, openTasks: this.openTasks, closeTasks: this.closeTasks, tasksIsKanban: (s.tasksView || 'kanban') === 'kanban', tasksIsCal: s.tasksView === 'cal', tasksKanban: () => this.setState({ tasksView: 'kanban' }), tasksCal: () => this.setState({ tasksView: 'cal' }), tkB1: (s.tasksView || 'kanban') === 'kanban' ? K.RED : '#2c2c31', tkC1: (s.tasksView || 'kanban') === 'kanban' ? '#fff' : '#8d877b', tkB2: s.tasksView === 'cal' ? K.RED : '#2c2c31', tkC2: s.tasksView === 'cal' ? '#fff' : '#8d877b', kanban: cols.map(([label, color, f]) => { const its = all.filter(f); return { label, color, count: String(its.length), items: its.map(row) }; }), calTitle: first.toLocaleString(undefined, { month: 'long', year: 'numeric' }), calDays: cells, calPrev: () => this.setState({ calMonth: new Date(yy, mm - 2, 1).toISOString().slice(0, 7) }), calNext: () => this.setState({ calMonth: new Date(yy, mm, 1).toISOString().slice(0, 7) }) }; })(),
      ...(() => { const opts = cs.items.filter(i => i.image || ['doc', 'note', 'code', 'email', 'statement'].includes(i.type)), A = cs.items.find(i => i.id === s.diffA), B = cs.items.find(i => i.id === s.diffB), isImg = !!(A && B && A.image && B.image), isTxt = !!(A && B && !isImg), rows = isTxt ? this.diffText(this.itemText(A), this.itemText(B)) : []; return { diffOpen: s.diffOpen, openDiff: this.openDiff, closeDiff: this.closeDiff, diffA: s.diffA, diffB: s.diffB, onDiffA: e => this.setState({ diffA: e.target.value }), onDiffB: e => this.setState({ diffB: e.target.value }), diffOptions: opts.map(i => ({ id: i.id, label: (i.num ? Component.numText('E', i.num) + ' ' : '') + this.itemLabel(i) })), diffIsImage: isImg, diffIsText: !isImg, diffRows: rows, diffSummary: isTxt ? rows.filter(r => r.bgA !== 'transparent').length + ' removed · ' + rows.filter(r => r.bgB !== 'transparent').length + ' added' : isImg ? 'Drag the slider to blend A over B' : 'Pick two cards', diffImgA: (A && A.image) || '', diffImgB: (B && B.image) || '', diffMix: String(s.diffMix ?? 50), diffMixOp: String((s.diffMix ?? 50) / 100), onDiffMix: e => this.setState({ diffMix: +e.target.value }) }; })(),
      annOpen: s.annOpen, openAnnotate: this.openAnnotate, closeAnn: this.closeAnn, annUndo: this.annUndo, annSave: this.annSave, annDown: this.annDown, annMove: this.annMove, annUp: this.annUp, annTools: [['box', 'Box'], ['arrow', 'Arrow'], ['blur', 'Blur / redact'], ['crop', 'Crop']].map(([id, label]) => ({ label, border: s.annTool === id ? K.RED : '#2c2c31', bg: s.annTool === id ? '#1d1d21' : 'transparent', color: s.annTool === id ? '#fff' : '#8d877b', onPick: () => this.setState({ annTool: id }) })),
      settingsOpen: s.settingsOpen, openSettings: () => this.setState({ settingsOpen: true }), closeSettings: () => this.setState({ settingsOpen: false }), settingRows: [['SPLUNK', 'splunk', 'https://splunk…/search?q=search%20{q}'], ['ELASTIC / KIBANA', 'elastic', 'https://kibana…/app/discover#/?_a=(query:(query:%27{q}%27))'], ['MICROSOFT SENTINEL', 'sentinel', 'Log Analytics URL with {q}'], ['QRADAR', 'qradar', '…quickSearch={q}'], ['RADIO STREAM URL', 'radio', 'https://ice1.somafm.com/secretagent-128-mp3'], ['VIRUSTOTAL API KEY (backend)', 'vt', ''], ['SHODAN API KEY (backend)', 'shodan', '']].map(([label, key, hint]) => ({ label, hint, value: (this.settings || {})[key] || '', onChange: e => this.saveSettings({ [key]: e.target.value }) })), bookmarklet: 'javascript:(function(){location.href=' + JSON.stringify(location.href.replace(/[^/]*$/, '') + 'desk.html#drop=') + '+encodeURIComponent(location.href+String.fromCharCode(10)+document.title)})()', noNav: e => e.preventDefault(),
      siemLinks: sel && sel.value ? this.siemLinks(this.refang(sel.value)) : [], setRole: this.setter('role'), setF1: this.setter('f1'), setF2: this.setter('f2'), setF3: this.setter('f3'), setUrl: this.setter('url'), setTranscript: this.setter('transcript'), setFeedKind: this.setter('feedKind'), setFeedUrl: this.setter('feedUrl'), setFeedQuery: this.setter('feedQuery'), setMonEvery: this.setter('monEvery'), setLat: this.setter('lat'), setLon: this.setter('lon'), setRadius: this.setter('radius'), setTime: this.setter('time'), setStance: this.setter('stance'), setNarrative: this.setter('narrative'), toggleHand: () => sel && this.upItem(sel.id, { hand: !sel.hand }),
      pickSelMedia: () => sel && this.pickMedia(sel.id), onMediaFile: this.onMediaFile, toggleRec: this.toggleRec, recLabel: s.recOn ? '■ Stop recording' : '● Record voice note', recBorder: s.recOn ? K.RED : '#2c2c31', recColor: s.recOn ? K.RED : '#d8d3c7', markMedia: this.markMedia, frameGrab: this.frameGrab, emailExtract: this.emailExtract, refreshSel: this.refreshSel, geoQuery: s.geoQuery, onGeoQuery: e => this.setState({ geoQuery: e.target.value }), onGeoKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.geocode(); } }, geocode: this.geocode, locateSel: this.locateSel, toggleWatch: this.toggleWatch, aiTranslate: this.aiTranslate, aiStance: this.aiStance, aiEntities: this.aiEntities, copySlack: this.copySlack,
      isGeo, toggleGeo: this.toggleGeo, geoBg: isGeo ? '#f3f1ea' : '#17171a', geoFg: isGeo ? '#1b1a17' : '#d8d3c7', geoBorder: isGeo ? '#f3f1ea' : '#2c2c31', locateIps: this.locateIps, playRoute: this.playRoute, routeLabel: s.routeOn ? '■ Stop route' : '▶ Play route', geoStatus: s.geoStatus, onArrange: this.arrange,
      exportCourt: this.exportCourt, exportPack: this.exportPack, toggleWalk: this.toggleWalk, walkLabel: s.walkOn ? '■ Stop recording' : '● Record walkthrough', walkBorder: s.walkOn ? K.RED : '#2c2c31', walkColor: s.walkOn ? K.RED : '#d8d3c7', toggleRadio: this.toggleRadio, radioLabel: s.radioOn ? '♪ Radio on' : '♪ Radio', radioColor: s.radioOn ? '#e8a71c' : '#d8d3c7',
      ...(() => { const sus = cs.items.filter(i => i.type === 'person' && i.role === 'suspect'), cols = ['means', 'motive', 'opp', 'alibi']; return { mmoOpen: s.mmoOpen, openMmo: this.openMmo, closeMmo: this.closeMmo, noSuspects: sus.length === 0, suspects: sus.map(p => { const M = (cs.mmo || {}), vals = cols.map(c => M[p.id + '|' + c] || ''), score = vals.filter(v => v === 'Y').length, al = this.alibiCheck(p, cs); return { name: p.title, score: score + ' / 4 established', scoreColor: score >= 3 ? K.RED : score === 2 ? '#e8a71c' : '#8d877b', onOpen: () => this.jumpTo(cs.id, p.id), tlText: al.conflicts.length ? 'CONFLICT: ' + al.conflicts.join('; ') : al.n + ' timed events · no conflict', tlColor: al.conflicts.length ? K.RED : '#8d877b', cells: cols.map((c, k) => { const v = vals[k]; return { label: v === 'Y' ? '✓' : v === 'N' ? '✗' : v === '?' ? '?' : '·', bg: v === 'Y' ? '#4a0e14' : v === 'N' ? '#143d24' : '#111113', color: v === 'Y' ? '#ff8a94' : v === 'N' ? '#7fe0a0' : '#8d877b', onCycle: () => this.upCase(x => { const cur = (x.mmo || {})[p.id + '|' + c] || '', next = cur === '' ? 'Y' : cur === 'Y' ? 'N' : cur === 'N' ? '?' : ''; return { ...x, mmo: { ...(x.mmo || {}), [p.id + '|' + c]: next } }; }) }; }) }; }) }; })(),
      tabAudit: s.tab === 'audit', tabLog: s.tab === 'log', audit,
      logRows, logCount: String((cs.log || []).length), noLog: !(cs.log || []).length, clearLog: () => { if (window.confirm('Clear the case log?')) this.upCase(c => ({ ...c, log: [] })); },
      snapshots, snapCount: String((cs.snapshots || []).length), noSnapshots: !(cs.snapshots || []).length, snapName: s.snapName, onSnapName: e => this.setState({ snapName: e.target.value }), onSnapKey: e => { if (e.key === 'Enter') this.saveSnapshot(); }, saveSnapshot: this.saveSnapshot,
      hasHover: !!hoverVals, hover: hoverVals || {}, hasSel: !!sel, sel: selVals, setTitle: this.setter('title'), setBody: this.setter('body'), setUrl: this.setter('url'), setValue: this.setter('value'), setKind: this.setter('kind'), setDate: this.setter('date'), setTags: this.setter('tags'),
      pickSelImage: () => sel && this.pickImage(sel.id), clearSelImage: () => sel && this.upItem(sel.id, { image: null }),
      togglePinSel: () => { if (!sel) return; if (sel.pinned) { this.upItem(sel.id, { pinned: false }); this.logEvt('Moved to inbox: ' + label(sel)); this.toast('Moved to the inbox'); } else this.pinItem(sel.id); },
      deleteSel: () => sel && this.removeItem(sel.id), selLinks, selLinkCount: selLinks.length,
      hasSelThread: !!selT, selT: selTVals, rels: K.RELS,
      setThreadRel: e => { const rel = e.target.value; selT && this.upCase(c => ({ ...c, threads: c.threads.map(t => t.id === selT.id ? { ...t, rel } : t) })); },
      swapThread: () => selT && this.upCase(c => ({ ...c, threads: c.threads.map(t => t.id === selT.id ? { ...t, from: t.to, to: t.from } : t) })),
      deleteThread: () => selT && this.removeThread(selT.id),
      noSel: !sel && !selT && !selG, stats: pinned.length + ' pinned · ' + inboxItems.length + ' in inbox · ' + liveThreads.length + ' threads',
      newFrom: s.newFrom, newTo: s.newTo, newRel: s.newRel, onNewFrom: e => this.setState({ newFrom: e.target.value }), onNewTo: e => this.setState({ newTo: e.target.value }), onNewRel: e => this.setState({ newRel: e.target.value }),
      pinnedOptions: pinned.map(i => ({ id: i.id, label: K.TYPES[i.type].label + ' · ' + label(i) })),
      addNewThread: () => { if (!s.newFrom || !s.newTo) return this.toast('Pick both cards first'); this.addThread(s.newFrom, s.newTo, s.newRel); this.setState({ tab: 'threads', newFrom: '', newTo: '' }); },
      showSuggest: P.autoSuggest ?? true, suggestions: sugg, suggestionCount: sugg.length, noSuggestions: sugg.length === 0,
      threadRows, threadCount: cs.threads.length, notes: cs.notes || '', onNotes: this.onNotes,
      timeline, timelineEmpty: timeline.length === 0,
    };
  }
}

export default Component;
