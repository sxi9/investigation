import Page from '../pages/desk/index.jsx';
import { SETTINGS } from '../pages/desk/settings.js';
import { boot } from '../runtime/boot.jsx';
import { mountCollab } from '../runtime/collab.jsx';
import { mountAccount } from '../runtime/account.jsx';
boot(Page, SETTINGS).then(() => { mountCollab('desk'); mountAccount('desk'); });
