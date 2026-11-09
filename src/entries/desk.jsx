import Page from '../pages/desk/index.jsx';
import { SETTINGS } from '../pages/desk/settings.js';
import { boot } from '../runtime/boot.jsx';
import { mountCollab } from '../runtime/collab.jsx';
boot(Page, SETTINGS).then(() => mountCollab('desk'));
