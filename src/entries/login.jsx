import Page from '../pages/login/index.jsx';
import { SETTINGS } from '../pages/login/settings.js';
import { boot } from '../runtime/boot.jsx';
boot(Page, SETTINGS, { needsStore: false });
