import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Page from '../pages/board/index.jsx';
import { SETTINGS } from '../pages/board/settings.js';
import { boot } from '../runtime/boot.jsx';
import { mountResearch } from '../runtime/research.jsx';
import { mountCollab } from '../runtime/collab.jsx';
window.L = L;
boot(Page, SETTINGS).then(() => { mountResearch(); mountCollab('board'); });
